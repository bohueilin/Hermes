// Acceptance hardening (annex D1-13 A26, A27, A28, A33; T21 to T23) on verified projections: renaming and permutation,
// non-anticipativity, horizon sensitivity, one mechanism per family and exact rational and tight-set edges.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as h from './helpers/depot-lab-cases.mjs';
import * as m from './helpers/depot-lab-mutate.mjs';
import {preset} from '../src/model/depot-lab/presets.js';
import {validateScenario} from '../src/model/depot-lab/schema.js';
import {verifyDepotRun} from '../src/model/depot-lab-verify/verify.js';
import {checkPairCompatibility,compareDepotRuns} from '../src/model/depot-lab/compare.js';
import {jcs} from '../src/model/depot-lab/canonical.js';
import {Q,mul,parseRational,RationalGuardError} from '../src/model/depot-lab/rational.js';
const {GB}=h;
const clone=v=>JSON.parse(JSON.stringify(v));
const valid=raw=>{const v=validateScenario(raw,{origin:'editor'});assert.ok(v.ok,JSON.stringify(v.issues?.slice(0,3)));return v.scenario;};
// Engine, then the verifier on a fresh parse of the canonical ledger text.
function go(s,harness=null){
 const r=h.run(s,{harness});assert.equal(r.terminal_status,'COMPLETE');
 const e=verifyDepotRun(s,JSON.parse(jcs(r.ledger)),{harness});assert.equal(e.status,'VERIFIED',JSON.stringify(e.primary_violation));
 return {s,L:r.ledger,e,p:e.projection};
}
const arm=(id,which,edit=x=>x)=>{const raw=clone(preset(id)[which]);edit(raw);return go(valid(raw));};
const visitOf=(p,id)=>p.visits.find(v=>v.id===`visit:${id}`);
const ops=p=>p.visits.map(v=>[v.id,v.tasks.map(t=>[t.template,t.start,t.end,t.state_at_h,t.workers])]);
// ----- A26 -----
// Typed-reference renaming: visit-scoped refs, positions, ports and workers; cache refs are never renamed.
function renamer(maps){
 const one=x=>{
  const p=x.split(':');
  if(['visit','client','storage','logs'].includes(p[0])&&p.length===2&&maps.visit.has(p[1]))p[1]=maps.visit.get(p[1]);
  else if(['task','flow'].includes(p[0])&&p.length===3&&maps.visit.has(p[1]))p[1]=maps.visit.get(p[1]);
  else if(['position','port','worker'].includes(p[0])&&p.length===2&&maps[p[0]].has(p[1]))p[1]=maps[p[0]].get(p[1]);
  return p.join(':');
 };
 const deep=v=>typeof v==='string'?one(v):Array.isArray(v)?v.map(deep):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).map(([k,x])=>[one(k),deep(x)])):v;
 return deep;
}
function renameScenario(raw,maps){
 const s=clone(raw),get=(k,id)=>maps[k].get(id)??id;
 for(const p of s.site.positions)p.id=get('position',p.id);
 for(const p of s.site.ports){p.id=get('port',p.id);p.position_id=get('position',p.position_id);}
 for(const w of s.workers)w.id=get('worker',w.id);
 for(const v of s.visits)v.id=get('visit',v.id);
 return s;
}
// Digests bind the scenario text, so they are the only fields allowed to differ between renamed ledgers.
const undigested=L=>{const c=clone(L);delete c.scenario_digest;delete c.workload_digest;for(const r of c.records){if('state_digest' in r.payload)r.payload.state_digest=null;if('derived_state_digest' in r.payload)r.payload.derived_state_digest=null;}return c;};
const suffixMaps=(raw,sfx)=>({visit:new Map(raw.visits.map(v=>[v.id,v.id+sfx])),position:new Map(raw.site.positions.map(p=>[p.id,p.id+sfx])),port:new Map(raw.site.ports.map(p=>[p.id,p.id+sfx])),worker:new Map(raw.workers.map(w=>[w.id,w.id+sfx]))});
test('A26: an order-preserving renaming of visit, position, port and worker ids leaves metrics identical and the ledger identical up to renaming',()=>{
 const p=preset('B'),res={};
 for(const which of ['baseline','candidate']){
  const raw=p[which],maps=suffixMaps(raw,'x'),ren=renamer(maps);
  // Equal-length ids with one appended character keep every ASCII order, including against the cache namespace.
  for(const map of Object.values(maps)){const k=[...map.keys()];assert.deepEqual(k.slice().sort().map(x=>map.get(x)),k.map(x=>map.get(x)).sort());}
  const a=go(valid(raw)),b=go(valid(renameScenario(raw,maps)));
  assert.notEqual(a.L.scenario_digest,b.L.scenario_digest);
  assert.deepEqual(b.p.metrics,a.p.metrics,which);assert.deepEqual(b.p.vector,a.p.vector,which);
  assert.equal(b.L.records.length,a.L.records.length);
  assert.equal(jcs(undigested(b.L)),jcs(ren(undigested(a.L))),`${which} ledger up to renaming`);
  assert.equal(jcs(b.p),jcs(ren(a.p)),`${which} projection up to renaming`);
  res[which]=[a,b];
 }
 const t0=checkPairCompatibility(res.baseline[0].s,res.candidate[0].s),t1=checkPairCompatibility(res.baseline[1].s,res.candidate[1].s);
 assert.equal(compareDepotRuns(res.baseline[1].e,res.candidate[1].e,t1.treatment).classification,compareDepotRuns(res.baseline[0].e,res.candidate[0].e,t0.treatment).classification);
});
// Three isolated visits (each released before the next arrives), one position per zone except two charging positions
// with one DC and one AC port, one worker per role and no cache: no choice depends on id order.
function tieFree(N,H=43200){
 return h.scenario({H,A:24001,positions:[h.position(N.W,'waiting'),h.position(N.K,'cleaning'),h.position(N.G,'garage'),h.position(N.C1,'charging'),h.position(N.C2,'charging')],
  ports:[h.port(N.dc,N.C1,'DC'),h.port(N.ac,N.C2,'AC')],
  workers:[h.worker(N.cleaner,['cabin'],{H}),h.worker(N.lead,h.LEAD,{H}),h.worker(N.mover,h.MOVER,{H}),h.worker(N.tech,['diagnosis','mechanical_repair'],{H})],
  objects:[h.object('sw-old','software',2*GB),h.object('sw-new','software',2*GB)],
  visits:N.visits.map((id,i)=>h.visit(id,{arrival:12000*i,due:12000*i+9000,soc:20,fault:i===1?'mechanical':'none',cabin:true,installed:['sw-old'],required:['sw-new'],logs:GB}))});
}
test('A26: a tie-free scenario under an arbitrary permutation of every id gives identical metrics and mapped timelines',()=>{
 const N={visits:['a1','b2','c3'],W:'W1',K:'K1',G:'G1',C1:'C1',C2:'C2',dc:'DC1',ac:'AC1',cleaner:'C01',lead:'L01',mover:'M01',tech:'T01'};
 const pi={visit:new Map([['a1','c3'],['b2','a1'],['c3','b2']]),position:new Map([['W1','C2'],['K1','W1'],['G1','K1'],['C1','G1'],['C2','C1']]),port:new Map([['DC1','AC1'],['AC1','DC1']]),worker:new Map([['C01','T01'],['L01','C01'],['M01','L01'],['T01','M01']])};
 const P=k=>pi.position.get(N[k]);
 const permuted={visits:N.visits.map(v=>pi.visit.get(v)),W:P('W'),K:P('K'),G:P('G'),C1:P('C1'),C2:P('C2'),dc:pi.port.get('DC1'),ac:pi.port.get('AC1'),cleaner:'T01',lead:'C01',mover:'L01',tech:'M01'};
 const a=go(tieFree(N)),b=go(tieFree(permuted)),ren=renamer(pi);
 assert.equal(a.p.metrics['release.released_count'],3,'every visit is released');
 assert.deepEqual(b.p.metrics,a.p.metrics);assert.deepEqual(b.p.vector,a.p.vector);
 for(const v of a.p.visits)assert.equal(jcs(b.p.visits.find(x=>x.id===ren(v.id))),jcs(ren(v)),v.id);
 for(const k of ['ports','positions','workers','lanes'])for(const x of a.p.resources[k])assert.equal(jcs(b.p.resources[k].find(y=>y.id===ren(x.id))),jcs(ren(x)),x.id);
 const shape=L=>L.records.map(r=>[r.tick,r.phase,r.kind,r.chunk_count]);
 assert.deepEqual(shape(b.L),shape(a.L));
});
// ----- A27 -----
const upTo=(L,t)=>L.records.filter(r=>r.tick<=t).map(r=>jcs(r));
test('A27: two tapes identical until 10,800 and different afterwards produce identical records up to 10,800',()=>{
 const t=10800,A=preset('B').baseline,B=clone(A);
 B.visits=B.visits.filter(v=>v.id!=='24').map(v=>v.arrival_tick>t?{...v,arrival_tick:v.arrival_tick+17,initial_soc_pct:50,fault:'none',due_tick:v.arrival_tick+3000,upload_required:true}:v);
 const a=go(valid(A)),b=go(valid(B));
 assert.notEqual(a.L.scenario_digest,b.L.scenario_digest);
 const x=upTo(a.L,t),y=upTo(b.L,t);assert.ok(x.length>100);assert.deepEqual(y,x);
 assert.notDeepEqual(b.L.records.slice(x.length).map(r=>jcs(r)),a.L.records.slice(x.length).map(r=>jcs(r)),'the tapes differ afterwards');
});
// Lead L01 is off between 1,000 and 2,000; V1's intake window opens at 900, after which 120 s no longer fit the shift.
const windowTape=futureWindow=>h.scenario({H:6000,A:5001,positions:[h.position('W1','waiting'),h.position('W2','waiting')],
 workers:[h.worker('L01',h.LEAD,{H:6000,availability:[{start_tick:0,end_tick:1000},{start_tick:2000,end_tick:6000}]}),h.worker('M01',h.MOVER,{H:6000})],
 visits:[h.visit('V1',{windows:[{task_template:'intake',earliest_start_tick:900}]}),h.visit('V2',{arrival:5000,windows:futureWindow?[{task_template:'egress',earliest_start_tick:890}]:[]})]});
test('A27: a not-yet-arrived visit whose task window lies before its arrival changes no record before that arrival',()=>{
 const a=go(windowTape(false)),b=go(windowTape(true));
 assert.deepEqual(upTo(b.L,4999),upTo(a.L,4999));
});
const cacheTape=future=>h.scenario({H:6000,A:5001,positions:[h.position('W1','waiting'),h.position('W2','waiting')],workers:[h.worker('L01',h.LEAD,{H:6000}),h.worker('M01',h.MOVER,{H:6000})],
 network:{cache:{state:'cold',capacity_bytes:20*GB,initial_object_ids:[]}},objects:[h.object('m1','map',GB/2),h.object('m2','map',GB/2)],
 visits:[h.visit('V1',{installed:['m1'],required:['m1']}),h.visit('V2',{arrival:5000,installed:['m1'],required:[future]})]});
test('A27: an object required only by a not-yet-arrived visit is not observable before that arrival',()=>{
 const a=go(cacheTape('m1')),b=go(cacheTape('m2'));
 assert.deepEqual(upTo(b.L,4999),upTo(a.L,4999));
});
test('A27: an observation mutated to expose a future visit is rejected by the verifier',()=>{
 const s=h.scenario({H:6000,A:5001,positions:[h.position('W1','waiting'),h.position('W2','waiting')],workers:[h.worker('L01',h.LEAD,{H:6000}),h.worker('M01',h.MOVER,{H:6000})],visits:[h.visit('V1'),h.visit('V2',{arrival:5000})]});
 const L=clone(h.run(s).ledger);
 assert.equal(verifyDepotRun(s,m.renumber(clone(L))).status,'VERIFIED','control');
 const o=L.records.find(r=>r.kind==='OBSERVATION');assert.equal(o.tick,0);
 const leak=o.payload.facts.filter(f=>f.entity_id==='visit:V1').map(f=>({...f,entity_id:'visit:V2',value:f.field==='arrival_tick'?5000:f.value}));
 assert.equal(leak.length,4);
 o.payload.facts=[...o.payload.facts,...leak].sort((x,y)=>x.entity_id<y.entity_id?-1:x.entity_id>y.entity_id?1:x.field<y.field?-1:x.field>y.field?1:0);
 const e=verifyDepotRun(s,m.renumber(L));
 assert.equal(e.status,'INVALID');assert.equal(e.primary_violation.code,'OBSERVATION_MISMATCH');assert.equal(e.primary_violation.tick,0);assert.equal(e.projection,null);
});
// ----- A28 -----
const withHorizon=(raw,H)=>{const s=clone(raw),clip=l=>l.map(x=>({start_tick:x.start_tick,end_tick:Math.min(x.end_tick,H)})).filter(x=>x.start_tick<x.end_tick);s.horizon_tick=H;for(const w of s.workers)w.availability=clip(w.availability);s.vendor.availability=clip(s.vendor.availability);return s;};
test('A28: the same B pair at two horizons verifies at both; the classification is reported, not asserted',t=>{
 const out=[];
 for(const H of [43200,25200]){
  const b=go(valid(withHorizon(preset('B').baseline,H))),c=go(valid(withHorizon(preset('B').candidate,H)));
  const pair=checkPairCompatibility(b.s,c.s);assert.equal(pair.compatible,true);assert.equal(pair.treatment.fields.length,2);
  const cmp=compareDepotRuns(b.e,c.e,pair.treatment);
  assert.ok(['improvement','worse','tie','mixed'].includes(cmp.classification));
  out.push({H,classification:cmp.classification,deltas:Object.fromEntries(cmp.components.filter(x=>x.relation!=='equal').map(x=>[x.id,x.delta])),censored:[b.p.metrics['visit.censored_count'],c.p.metrics['visit.censored_count']]});
 }
 t.diagnostic(JSON.stringify({classification_changes:out[0].classification!==out[1].classification,horizons:out}));
});
// ----- A33 -----
const locationAt=(v,t)=>v.location.find(([a,b])=>a<=t&&t<b)?.[2]??null;
test('A33 positions (W): seven visits are outside at 3,000 with 24 waiting positions as 17, none with 24',()=>{
 const outside=x=>x.p.visits.filter(v=>v.arrival_tick<=3000&&locationAt(v,3000)==='outside').length;
 const b=arm('W','baseline'),c=arm('W','candidate');
 assert.equal(outside(b),7);assert.equal(outside(c),0);
});
test('A33 AC/DC (B): the candidate charges through the new DC port; the baseline has none',()=>{
 const b=arm('B','baseline'),c=arm('B','candidate'),dc3=x=>x.p.resources.ports.find(p=>p.id==='port:DC03');
 assert.equal(dc3(b),undefined);
 assert.ok(dc3(c).partition.connected_drawing>0&&dc3(c).owned_ticks>0);
 assert.ok(c.p.visits.some(v=>v.tasks.some(x=>x.template==='charge'&&x.port==='port:DC03'&&x.end!==null)));
});
test('A33 garage (G): basic to none sends 08, 16 and 24 through the five vendor tasks',()=>{
 const b=arm('G','baseline'),c=arm('G','candidate'),ids=['visit:08','visit:16','visit:24'];
 assert.deepEqual(b.p.visits.filter(v=>v.route!=='none').map(v=>[v.id,v.route]),ids.map(id=>[id,'onsite']));
 assert.ok(b.p.visits.every(v=>v.tasks.every(x=>!x.template.startsWith('vendor'))));
 for(const id of ids){
  const v=c.p.visits.find(x=>x.id===id),d=t=>{const x=v.tasks.find(y=>y.template===t);return x.end-x.start;};
  assert.equal(v.route,'vendor');assert.deepEqual(v.tasks.filter(x=>x.template.startsWith('vendor')).map(x=>x.state_at_h),Array(5).fill('COMPLETE'),id);
  assert.deepEqual([d('vendor_outbound'),d('vendor_service'),d('vendor_return')],[1800,7200,1800],id);
 }
});
test('A33 services (M): the candidate never starts the map download and its waits carry UNREACHABLE_SERVICE',()=>{
 const b=arm('M','baseline'),c=arm('M','candidate'),started=x=>x.p.events.filter(e=>e[2]==='map_download'&&e[3]==='START').length;
 assert.ok(started(b)>0);assert.equal(started(c),0);
 for(const v of c.p.visits)assert.ok(v.tasks.filter(x=>x.template.startsWith('map_')).every(x=>x.start===null),v.id);
 assert.equal(b.p.metrics['wait.reason_seconds'].UNREACHABLE_SERVICE,undefined);
 assert.ok(c.p.metrics['wait.reason_seconds'].UNREACHABLE_SERVICE>0);
 assert.ok(c.p.visits.some(v=>v.waits.some(w=>w[2]==='UNREACHABLE_SERVICE')));
 const named=c.p.visits.flatMap(v=>v.frontier_at_h.reasons.filter(r=>r.code==='UNREACHABLE_SERVICE'));
 assert.ok(named.length>0&&named.every(r=>jcs(r.resource_ids)===jcs(['service:maps'])));
 assert.equal(c.p.metrics['release.released_count'],0);
});
test('A33 Wi-Fi (D, DR): the WAN-limited pool doubling changes no operational tick; with WAN 1,000/1,000 it changes allocations',()=>{
 const b=arm('D','baseline'),c=arm('D','candidate');
 assert.deepEqual(ops(c.p),ops(b.p));assert.deepEqual(c.p.resources.network,b.p.resources.network);assert.deepEqual(c.p.metrics,b.p.metrics);
 const rb=arm('DR','baseline'),rc=arm('DR','candidate');
 assert.ok(rb.p.resources.network.tight_s['network:pool']>0);assert.equal(rc.p.resources.network.tight_s['network:pool'],undefined);
 assert.notDeepEqual(ops(rc.p),ops(rb.p));
});
test('A33 staffing (T2, ST): two bays let the second technician work; one bay leaves it idle and every tick unchanged',()=>{
 const t2=arm('T2','candidate'),T02=x=>x.p.resources.workers.find(w=>w.id==='worker:T02');
 assert.equal(T02(arm('T2','baseline')),undefined);
 assert.ok(T02(t2).busy_s>0);assert.ok(t2.p.visits.some(v=>v.tasks.some(x=>x.workers.includes('worker:T02'))));
 const sb=arm('ST','baseline'),sc=arm('ST','candidate');
 assert.equal(T02(sc).busy_s,0);assert.deepEqual(ops(sc.p),ops(sb.p));
});
test('A33 training (TP, TN): advanced cabin work takes 480 s; the supervised-only cleaner changes nothing',()=>{
 const cabin=x=>[...new Set(x.p.visits.flatMap(v=>v.tasks.filter(t=>t.template==='cabin'&&t.end!==null).map(t=>t.end-t.start)))];
 assert.deepEqual(cabin(arm('TP','baseline')),[600]);assert.deepEqual(cabin(arm('TP','candidate')),[480]);
 const nb=arm('TN','baseline'),nc=arm('TN','candidate');
 assert.deepEqual(ops(nc.p),ops(nb.p));assert.deepEqual(cabin(nc),[600]);
 assert.ok(nc.p.visits.every(v=>v.tasks.filter(t=>t.template==='cabin').every(t=>jcs(t.workers)===jcs(['worker:C01']))));
});
// ----- T21 to T23 -----
const a21due=due=>h.scenario({H:3600,positions:[h.position('C1','charging'),h.position('W1','waiting')],ports:[h.port('DC1','C1')],workers:[h.worker('X01',h.ALL)],visits:[h.visit('V1',{due,soc:20})]});
test('T21: a release exactly at its due tick (A21, 2,604) counts on time; one tick earlier due is 1 s overdue',()=>{
 const on=visitOf(go(a21due(2604)).p,'V1'),late=visitOf(go(a21due(2603)).p,'V1');
 assert.deepEqual([on.released_at,on.on_time,on.overdue_s,on.due_status],[2604,true,0,'past_due']);
 assert.deepEqual([late.released_at,late.on_time,late.overdue_s],[2604,false,1]);
});
test('T21: an at-or-above-target arrival with installed content and no upload closes with no invented tasks',()=>{
 for(const soc of [80,95]){
  const s=h.scenario({positions:[h.position('W1','waiting')],workers:[h.worker('L01',h.LEAD),h.worker('M01',h.MOVER)],objects:[h.object('sw-new','software',2*GB)],visits:[h.visit('V1',{soc,installed:['sw-new'],required:['sw-new']})]});
  const {p}=go(s),v=visitOf(p,'V1');
  assert.deepEqual(v.tasks.map(t=>t.template),['admit','intake','inspection','egress'],`soc ${soc}`);
  assert.equal(v.released_at,660);assert.equal(v.energy.credited_mj,0);assert.deepEqual(v.data,[]);
  assert.equal(p.metrics['network.useful_bytes_down']+p.metrics['network.useful_bytes_up'],0);
 }
});
function equalFlows(n){
 const ids=Array.from({length:n},(_,i)=>`V${String(i+1).padStart(2,'0')}`);
 const s=h.scenario({positions:ids.map(id=>h.position(`W${id}`,'waiting')),workers:[h.worker('L01',h.LEAD),h.worker('M01',h.MOVER)],
  network:{pool_bytes_per_tick:37500000,client_bytes_per_tick:125000000,wan_down_bytes_per_tick:250000000},
  objects:[h.object('sw-old','software',2*GB),h.object('sw-new','software',2*GB)],visits:ids.map(id=>h.visit(id,{installed:['sw-old'],required:['sw-new']}))});
 return {ids,s,harness:{initial:Object.fromEntries(ids.map(id=>[id,{position:`W${id}`,completed:['admit','intake']}]))}};
}
test('T22: 7 and 11 equal flows on a 37,500,000 bytes/tick pool get reduced prime-denominator rates and complete at anchor + ceil(R q / p)',()=>{
 const R=2000000000n;
 for(const n of [7,11]){
  const {ids,s,harness}=equalFlows(n),x=go(s,harness),p=37500000n,q=BigInt(n);
  const c=Number((R*q+p-1n)/p);assert.equal(c,n===7?374:587);
  for(const id of ids){
   const f=`flow:${id}:software_download`,al=h.allocationsOf(x.L.records,f),pr=h.progressOf(x.L.records,f);
   assert.deepEqual(al.map(a=>[a.tick,a.rate,a.tight_resource_ids]),[[0,`${p}/${q}`,['network:pool']]],f);
   const r=parseRational(al[0].rate);assert.equal(r.d,q);assert.equal(r.n,p);
   assert.equal(pr.length,1);assert.deepEqual([pr[0].allocation_anchor_tick,pr[0].to_tick,pr[0].credited,pr[0].quantization_slack],[0,c,2000000000,'0/1']);
   const undrawn=Q(p*BigInt(c)-R*q,q);assert.equal(pr[0].undrawn_final_tick,`${undrawn.n}/${undrawn.d}`);
   assert.equal(visitOf(x.p,id).tasks.find(t=>t.template==='software_download').end,c);
  }
  assert.equal(x.p.resources.network.tight_s['network:pool'],c);
 }
});
test('T22: a rational intermediate past 8,192 bits refuses with RATIONAL_GUARD; exactly 8,192 operand bits pass',()=>{
 const big=Q(1n<<4096n);
 assert.throws(()=>mul(big,big),e=>e instanceof RationalGuardError&&e.code==='INCOMPLETE_RESOURCE_LIMIT'&&e.reason==='RATIONAL_GUARD'&&e.operand_bits===8194);
 assert.throws(()=>mul(big,Q((1n<<4096n)-1n)),e=>e instanceof RationalGuardError&&e.operand_bits===8193);
 assert.equal(mul(Q((1n<<4096n)-1n),Q((1n<<4096n)-1n)).n,((1n<<4096n)-1n)**2n);
});
test('T23: an AC car whose 11 kW port equals the 11 kW vehicle cap reports both limits as tight',()=>{
 const s=h.scenario({H:20000,positions:[h.position('C1','charging'),h.position('W1','waiting')],ports:[h.port('AC01','C1','AC')],workers:[h.worker('L01',h.LEAD,{H:20000}),h.worker('M01',h.MOVER,{H:20000})],visits:[h.visit('V1',{soc:20})]});
 const x=go(s,{initial:{V1:{position:'W1',completed:['admit','intake']}}}),al=h.allocationsOf(x.L.records,'flow:V1:charge');
 assert.deepEqual(al.map(a=>[a.rate,a.tight_resource_ids]),[['11000000/1',['flow:V1:charge','port:AC01']]]);
 assert.equal(x.p.resources.site.tight_s,0);assert.equal(x.p.resources.site.peak_draw_w,'11000/1');
});
test('T23: a lone upload whose WAN-up equals its client cap reports both as tight',()=>{
 const s=h.scenario({positions:[h.position('W1','waiting')],workers:[h.worker('L01',h.LEAD),h.worker('M01',h.MOVER)],network:{wan_up_bytes_per_tick:12500000,client_bytes_per_tick:12500000},visits:[h.visit('V1',{logs:GB,uploadRequired:true})]});
 const x=go(s,{initial:{V1:{position:'W1',completed:['admit','intake']}}}),al=h.allocationsOf(x.L.records,'flow:V1:upload');
 assert.deepEqual(al.map(a=>[a.rate,a.resource_path,a.tight_resource_ids]),[['12500000/1',['client:V1','network:pool','network:wan_up'],['client:V1','network:wan_up']]]);
 assert.deepEqual(x.p.resources.network.tight_s,{'client:V1':80,'network:wan_up':80});
});
