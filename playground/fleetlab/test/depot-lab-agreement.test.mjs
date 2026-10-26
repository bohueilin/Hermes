// Engine and verifier agreement (reconciliation 11.5 Tasks 5 and 11): seeded random edits across all seven families and
// the workload validate with schema.js, run to completion and verify VERIFIED from the canonical ledger text alone.
// Fixed edge cases cover the extremes. FLEET_PLAYGROUND_PERF=1 adds 300 more seeds. A case is a pure function of its
// seed, so a failure names the seed that reproduces it in either mode.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {preset,PRESET_IDS,defaultScenario,positionInventory,visit,worker,port,GB,MBPS} from '../src/model/depot-lab/presets.js';
import {validateScenario} from '../src/model/depot-lab/schema.js';
import {createDepotRun,stepDepotRun} from '../src/model/depot-lab/engine.js';
import {verifyDepotRun} from '../src/model/depot-lab-verify/verify.js';
import {jcs} from '../src/model/depot-lab/canonical.js';
import {ATTENDED_CLASSES,PROFICIENCY_LEVELS,proficiencyTicks,ZONES,TEMPLATES} from '../src/model/depot-lab/profiles.js';
const PERF=process.env.FLEET_PLAYGROUND_PERF==='1',DEFAULT_CASES=40,PERF_CASES=300,SEED0=20261024;
const clone=v=>JSON.parse(JSON.stringify(v));
const pad=(n,w)=>String(n).padStart(w,'0');
// Numerical Recipes LCG on 32 bits, seeded through the murmur3 finalizer so adjacent seeds diverge; no platform randomness.
function lcg(seed){
 let x=seed>>>0;x=Math.imul(x^x>>>16,0x85ebca6b);x=Math.imul(x^x>>>13,0xc2b2ae35);x=(x^x>>>16)>>>0;const u=()=>(x=(Math.imul(x,1664525)+1013904223)>>>0)/4294967296;
 const g={int:n=>Math.floor(u()*n),coin:(p=0.5)=>u()<p,pick:a=>a[g.int(a.length)]};
 g.some=(a,max=a.length)=>{const out=[];for(const x of a)if(out.length<max&&g.coin(0.4))out.push(x);return out;};
 return g;
}
const H_OF=s=>s.horizon_tick;
function breaks(g,H){
 if(g.coin(0.5)){const a=1+g.int(H-1),b=a+1+g.int(Math.max(1,H-a-1));return b<H?[{start_tick:0,end_tick:a},{start_tick:b,end_tick:H}]:[{start_tick:0,end_tick:a}];}
 const cuts=[...new Set(Array.from({length:2+2*g.int(3)},()=>g.int(H+1)))].sort((a,b)=>a-b),out=[];
 for(let i=0;i+1<cuts.length;i+=2)if(cuts[i]<cuts[i+1])out.push({start_tick:cuts[i],end_tick:cuts[i+1]});
 return out;
}
const portless=s=>s.site.positions.filter(p=>!s.site.ports.some(q=>q.position_id===p.id));
const fresh=(list,prefix,w)=>{for(let n=1;;n++){const id=`${prefix}${pad(n,w)}`;if(!list.some(x=>x.id===id))return id;}};
const endpoint=g=>({service_reachable:g.coin(0.75)?'reachable':'unreachable',entitlement:g.pick(['valid','valid','valid','denied','unknown'])});
const MBPS_STEPS=[0,10,50,100,200,300,600,1000,2000];
const capped=(g,max)=>Math.min(max,g.pick(MBPS_STEPS)*MBPS);
const qualification=(g,cls)=>{const level=g.pick(['unqualified','supervised_only','independent','independent']),proficiency=g.pick(PROFICIENCY_LEVELS);return {task_class:cls,level,proficiency,may_supervise:level==='independent'&&g.coin(0.7),solo_duration_ticks:proficiencyTicks(cls,proficiency)};};
function respace(s,g){
 const n=s.visits.length,H=H_OF(s);let gap=g.pick([0,1,30,60,300,900,1800]);
 if(n>1&&gap*(n-1)>=H)gap=Math.floor((H-1)/(n-1));
 s.visits.forEach((v,i)=>{v.arrival_tick=gap*i;});
 s.arrival_window_tick=Math.min(H,gap*(n-1)+1);
}
// [family, edit name, edit]. Every edit keeps the closed shape; fixInvariants restores cross-field rules afterwards.
const EDITS=[
 ['positions','positions.enabled',(s,g)=>{for(let k=1+g.int(3);k--;){const p=g.pick(s.site.positions);p.enabled=!p.enabled;}}],
 ['positions','positions.zone',(s,g)=>{const free=portless(s);if(free.length)g.pick(free).zone=g.pick(ZONES);}],
 ['positions','positions.add',(s,g)=>{for(let k=1+g.int(8);k--&&s.site.positions.length<200;)s.site.positions.push({id:fresh(s.site.positions,'N',3),zone:g.pick(ZONES),enabled:g.coin(0.9)});}],
 ['positions','positions.remove',(s,g)=>{for(let k=1+g.int(3);k--;){const free=portless(s);if(free.length&&s.site.positions.length>1){const p=g.pick(free);s.site.positions=s.site.positions.filter(x=>x!==p);}}}],
 ['ports','ports.enabled',(s,g)=>{if(s.site.ports.length){const p=g.pick(s.site.ports);p.enabled=!p.enabled;}}],
 ['ports','ports.rating',(s,g)=>{for(const p of s.site.ports)if(g.coin(0.4))p.rating_w=g.pick([0,7400,11000,22000,50000,150000,350000,1000000]);}],
 ['ports','ports.kind',(s,g)=>{if(s.site.ports.length){const p=g.pick(s.site.ports);p.kind=p.kind==='AC'?'DC':'AC';}}],
 ['ports','ports.add',(s,g)=>{if(s.site.ports.length>=20)return;const free=portless(s);if(!free.length)return;const p=g.pick(free);p.zone='charging';s.site.ports.push({...port(fresh(s.site.ports,g.coin()?'DC':'AC',2),p.id,g.coin()?'DC':'AC'),enabled:g.coin(0.9)});}],
 ['ports','ports.remove',(s,g)=>{if(s.site.ports.length){const p=g.pick(s.site.ports);s.site.ports=s.site.ports.filter(x=>x!==p);}}],
 ['ports','site.supply',(s,g)=>{s.site.supply_w=g.pick([0,11000,50000,100000,300000,1000000]);s.site.background_w=g.coin(0.7)?0:g.int(Math.floor(s.site.supply_w/4)+1);}],
 ['positions','site.lanes',(s,g)=>{s.site.lane_count=g.coin(0.1)?0:1+g.int(4);}],
 ['garage','garage.level',(s,g)=>{s.site.garage_level=g.pick(['none','basic','specialist']);}],
 ['garage','vendor.flags',(s,g)=>{const v=s.vendor;v.enabled=g.coin(0.7);v.bay_count=g.coin(0.8)?1:0;v.worker_count=g.coin(0.8)?1:0;for(const k of ['outbound_ticks','service_ticks','return_ticks'])if(g.coin(0.4))v[k]=g.pick([60,600,1800,7200]);}],
 ['garage','vendor.availability',(s,g)=>{s.vendor.availability=breaks(g,H_OF(s));}],
 ['services','services',(s,g)=>{for(const k of ['maps','software','uploads'])if(g.coin(0.6))s.services[k]=endpoint(g);}],
 ['wifi','network.caps',(s,g)=>{const n=s.network;n.pool_bytes_per_tick=capped(g,625000000);n.client_bytes_per_tick=capped(g,125000000);if(g.coin(0.5))n.cache_read_bytes_per_tick=capped(g,625000000);}],
 ['wifi','network.wan',(s,g)=>{s.network.wan_down_bytes_per_tick=capped(g,250000000);s.network.wan_up_bytes_per_tick=capped(g,250000000);}],
 ['wifi','network.generation',(s,g)=>{s.network.generation=s.network.generation==='wifi6'?'wifi7':'wifi6';if(g.coin(0.5))s.network.covered_zones=g.some(ZONES);}],
 ['wifi','cache',(s,g)=>{const c=s.network.cache;c.state=g.pick(['off','cold','warm']);c.capacity_bytes=g.pick([0,GB/2,GB,2*GB,5*GB/2,20*GB]);c.initial_object_ids=c.state==='warm'?g.some(s.content_objects.map(o=>o.id)):[];}],
 ['staffing','workers.qualification',(s,g)=>{if(!s.workers.length)return;for(let k=1+g.int(4);k--;){const w=g.pick(s.workers),cls=g.pick(ATTENDED_CLASSES);w.qualifications=w.qualifications.map(r=>r.task_class===cls?qualification(g,cls):r);}}],
 ['staffing','workers.availability',(s,g)=>{if(s.workers.length)g.pick(s.workers).availability=breaks(g,H_OF(s));}],
 ['staffing','workers.add',(s,g)=>{if(s.workers.length<20)s.workers.push({...worker(fresh(s.workers,'Z',2),g.pick(['cleaner','lead','mover','technician'])),availability:g.coin(0.5)?[{start_tick:0,end_tick:H_OF(s)}]:breaks(g,H_OF(s))});}],
 ['staffing','workers.remove',(s,g)=>{if(s.workers.length){const w=g.pick(s.workers);s.workers=s.workers.filter(x=>x!==w);}}],
 ['training','workers.proficiency',(s,g)=>{for(const w of s.workers)for(const r of w.qualifications)if(r.level!=='unqualified'&&g.coin(0.3)){r.proficiency=g.pick(PROFICIENCY_LEVELS);r.solo_duration_ticks=proficiencyTicks(r.task_class,r.proficiency);}}],
 ['workload','target',(s,g)=>{s.requirements.energy.target_soc_pct=g.coin(0.2)?g.pick([20,100]):20+g.int(81);}],
 ['workload','visits.count',(s,g)=>{const n=1+g.int(g.coin(0.1)?200:40),old=s.visits;s.visits=Array.from({length:n},(_,i)=>({...clone(old[i%old.length]),id:`V${pad(i+1,3)}`}));respace(s,g);}],
 ['workload','visits.spacing',respace],
 ['workload','visits.due',(s,g)=>{for(const v of s.visits){const r=g.int(10);v.due_tick=r<2?null:r<3?v.arrival_tick:v.arrival_tick+g.int(30000);}}],
 ['workload','visits.windows',(s,g)=>{s.task_windows.cabin_earliest_start_tick=g.pick([0,0,300,3600,20000]);for(const v of s.visits)if(g.coin(0.3)){const t=[...new Set([g.pick(TEMPLATES),g.pick(TEMPLATES)])];v.task_windows=t.map(task_template=>({task_template,earliest_start_tick:g.int(H_OF(s)+1)}));}}],
 ['workload','visits.uploads',(s,g)=>{for(const v of s.visits){v.upload_required=g.coin(0.4);v.initial_log_bytes=g.pick([0,1,GB/2,GB,5*GB,20*GB]);}}],
 ['workload','visits.faults',(s,g)=>{for(const v of s.visits){const r=g.int(20);v.fault=r<12?'none':r<17?'mechanical':'specialist_electrical';}}],
 ['workload','visits.soc',(s,g)=>{for(const v of s.visits)if(g.coin(0.5))v.initial_soc_pct=g.int(101);}],
 ['workload','visits.content',(s,g)=>{const kinds=k=>s.content_objects.filter(o=>o.kind===k).map(o=>o.id);for(const v of s.visits){const one=()=>['map','software'].flatMap(k=>g.coin(0.6)&&kinds(k).length?[g.pick(kinds(k))]:[]);v.required_object_ids=one();v.installed_object_ids=one();v.cabin_required=g.coin(0.7);}}],
 ['workload','objects.size',(s,g)=>{if(s.content_objects.length)g.pick(s.content_objects).size_bytes=g.pick([0,1,GB/2,2*GB,5*GB]);}],
 ['workload','horizon',(s,g)=>{s.horizon_tick=g.pick([3600,7200,14400,28800,43200]);}],
];
const FAMILIES=['positions','ports','garage','services','wifi','staffing','training','workload'];
// Cross-field rules of C1.3 that random edits can break: horizon clipping, arrival window, due after arrival,
// background, cache fit, storage residency and port positions. Each repair is deterministic.
function fixInvariants(s){
 const H=s.horizon_tick,clip=list=>list.map(x=>({start_tick:x.start_tick,end_tick:Math.min(x.end_tick,H)})).filter(x=>x.start_tick<x.end_tick);
 for(const w of s.workers)w.availability=clip(w.availability);
 s.vendor.availability=clip(s.vendor.availability);
 if(s.arrival_window_tick>H)s.arrival_window_tick=H;
 for(const v of s.visits){if(v.arrival_tick>=s.arrival_window_tick)v.arrival_tick=s.arrival_window_tick-1;if(v.due_tick!==null&&v.due_tick<v.arrival_tick)v.due_tick=v.arrival_tick+21600;}
 if(s.site.background_w>s.site.supply_w)s.site.background_w=0;
 const size=new Map(s.content_objects.map(o=>[o.id,o.size_bytes])),c=s.network.cache;
 if(c.state!=='warm')c.initial_object_ids=[];
 else{let used=0;c.initial_object_ids=c.initial_object_ids.filter(id=>size.has(id)&&(used+size.get(id)<=c.capacity_bytes)&&(used+=size.get(id),true));}
 for(const v of s.visits)if(v.installed_object_ids.reduce((n,id)=>n+size.get(id),v.initial_log_bytes)>50*GB)v.initial_log_bytes=0;
 const zone=new Map(s.site.positions.map(p=>[p.id,p.zone]));s.site.ports=s.site.ports.filter(p=>zone.get(p.position_id)==='charging');
 return s;
}
function generateCase(seed){
 const g=lcg(seed),base=g.int(PRESET_IDS.length+1),name=base===PRESET_IDS.length?'default':PRESET_IDS[base];
 let raw,arm='baseline';
 if(name==='default')raw=defaultScenario();else{const p=preset(name);arm=p.candidate&&g.coin()?'candidate':'baseline';raw=p[arm];}
 const s=clone(raw),family=FAMILIES[seed%FAMILIES.length],edits=[];
 const first=EDITS.filter(e=>e[0]===family);
 for(const e of [g.pick(first),...Array.from({length:1+g.int(6)},()=>g.pick(EDITS))]){e[2](s,g);edits.push(e[1]);}
 return {seed,origin:`${name}/${arm}`,edits,raw:fixInvariants(s)};
}
// Engine to completion, then the verifier on a fresh parse of the canonical ledger text (never engine objects).
function runAndVerify(scenario,options={}){
 const cursor=createDepotRun(scenario,options);let r;do r=stepDepotRun(cursor,{maxTicks:4096});while(!r.done);
 const text=jcs(r.ledger);
 return {run:r,text,envelope:verifyDepotRun(scenario,JSON.parse(text),{harness:options.harness??null,claimedGuard:r.guard??null})};
}
// A COMPLETE ledger must verify VERIFIED. A named D1-07 guard refusal is not a disagreement: the verifier must then
// report the same INCOMPLETE_RESOURCE_LIMIT status with no projection, and the case is reported as a refusal.
const GUARDS=['RECORD_COUNT','RECORD_BYTES','LEDGER_BYTES','VECTOR_LIMIT','SUB_QUANTUM_POSITIVE_SHARE','RATIONAL_GUARD','MICROSTEP_LIMIT'];
function agree(c){
 const v=validateScenario(c.raw,{origin:'import'}),label=`seed ${c.seed} (${c.origin}; ${c.edits.join(', ')})`;
 assert.ok(v.ok,`${label} does not validate: ${JSON.stringify(v.issues?.slice(0,3))}`);
 const {run,envelope:e}=runAndVerify(v.scenario);
 if(run.terminal_status==='INCOMPLETE_RESOURCE_LIMIT'&&GUARDS.includes(run.guard?.guard)){
  assert.equal(e.status,'INCOMPLETE_RESOURCE_LIMIT',`${label} verifier ${e.status} on a ${run.guard.guard} refusal`);assert.equal(e.projection,null);
  return {refused:run.guard.guard,detail:run.guard.detail,records:run.records,visits:v.scenario.visits.length};
 }
 assert.equal(run.terminal_status,'COMPLETE',`${label} engine ${run.terminal_status} ${JSON.stringify(run.guard)}`);
 assert.equal(e.status,'VERIFIED',`${label} verifier ${JSON.stringify(e.primary_violation)}`);
 const p=e.projection,H=v.scenario.horizon_tick;
 assert.equal(p.metrics['release.released_count']+p.metrics['release.unreleased_count'],v.scenario.visits.length,label);
 for(const x of [...p.resources.ports,...p.resources.positions])assert.equal(Object.values(x.partition).reduce((a,b)=>a+b,0),H,`${label} ${x.id}`);
 return {records:run.records,released:p.metrics['release.released_count'],visits:v.scenario.visits.length};
}
const seeds=Array.from({length:DEFAULT_CASES+(PERF?PERF_CASES:0)},(_,i)=>SEED0+i);
test('the generator covers all seven families and the workload, and is deterministic',()=>{
 const cases=seeds.slice(0,DEFAULT_CASES).map(generateCase),seen=new Set(cases.flatMap(c=>c.edits.map(n=>EDITS.find(e=>e[1]===n)[0])));
 assert.deepEqual([...FAMILIES].filter(f=>!seen.has(f)),[]);
 assert.deepEqual(generateCase(SEED0+7),generateCase(SEED0+7));
 assert.notDeepEqual(generateCase(SEED0+7).raw,generateCase(SEED0+8).raw);
});
for(const seed of seeds)test(`agreement: seed ${seed} validates, runs and verifies VERIFIED (or an agreed guard refusal)`,t=>{
 const c=generateCase(seed),out=agree(c);
 t.diagnostic(JSON.stringify({seed,origin:c.origin,edits:c.edits,...out}));
});
// ----- fixed edge cases -----
const valid=raw=>{const v=validateScenario(raw,{origin:'editor'});assert.ok(v.ok,JSON.stringify(v.issues?.slice(0,3)));return v.scenario;};
const verified=(raw,label)=>{const s=valid(raw),{run,envelope:e}=runAndVerify(s);assert.equal(run.terminal_status,'COMPLETE',label);assert.equal(e.status,'VERIFIED',`${label} ${JSON.stringify(e.primary_violation)}`);return {s,run,e,p:e.projection};};
const frontierCodes=v=>v.frontier_at_h.reasons.map(r=>r.code);
test('edge: 200 visits arriving at once into 100 waiting positions complete with chunked decisions',t=>{
 const s=defaultScenario();s.arrival_window_tick=1;
 s.site.positions=positionInventory([['waiting',100],['charging',4],['cleaning',2],['garage',1]]);
 s.site.ports=[port('AC01','P103','AC'),port('AC02','P104','AC'),port('DC01','P101','DC'),port('DC02','P102','DC')];
 s.visits=Array.from({length:200},(_,i)=>visit(pad(i+1,3),0,{fault:(i+1)%8===0?'mechanical':'none'}));
 const {run,p}=verified(s,'wide');
 const chunked=run.ledger.records.filter(r=>r.kind==='POLICY_DECISION'&&r.chunk_count>1);
 assert.ok(chunked.length>0,'some decisions are chunk groups');
 assert.ok(chunked.every(r=>r.payload.reasons.every(x=>x.resource_ids.length<=64&&x.holder_visit_ids.length<=64)));
 t.diagnostic(JSON.stringify({records:run.records,bytes:run.bytes,chunked_decision_records:chunked.length,chunked_decision_groups:new Set(chunked.map(r=>r.group_id)).size,released:p.metrics['release.released_count']}));
});
test('edge: vendor disabled with garage none holds the vendor visits before departure with STATIC_OUT_OF_SERVICE',()=>{
 const s=clone(preset('G').candidate);s.vendor.enabled=false;
 const {p}=verified(s,'vendor off');
 const vendor=p.visits.filter(v=>v.route==='vendor');
 assert.deepEqual(vendor.map(v=>v.id),['visit:08','visit:16','visit:24']);
 for(const v of vendor){
  assert.equal(v.released_at,null);assert.ok(v.tasks.filter(x=>x.template.startsWith('vendor')).every(x=>x.start===null),v.id);
  const r=v.frontier_at_h.reasons.find(x=>x.code==='STATIC_OUT_OF_SERVICE');assert.deepEqual(r?.resource_ids,['vendor:bay:01'],v.id);
  assert.match(v.location.at(-1)[2],/^position:/,`${v.id} keeps its depot position`);
 }
});
test('edge: an unreachable upload service blocks every required upload and verifies',()=>{
 const s=clone(preset('D').baseline);s.services.uploads.service_reachable='unreachable';
 const {p}=verified(s,'uploads unreachable');
 assert.equal(p.metrics['release.released_count'],0);assert.ok(p.metrics['wait.reason_seconds'].UNREACHABLE_SERVICE>0);
 assert.equal(p.metrics['network.useful_bytes_up'],0);
});
test('edge: shared targets 20 and 100 both verify; 20 creates no charge work',()=>{
 for(const pct of [20,100]){
  const s=defaultScenario();s.requirements.energy.target_soc_pct=pct;
  const {p}=verified(s,`target ${pct}`);
  const charges=p.visits.flatMap(v=>v.tasks.filter(x=>x.template==='charge'));
  if(pct===20){assert.equal(charges.length,0);assert.equal(p.metrics['charge.energy_credited_mj'],0);}else assert.equal(charges.length,24);
 }
});
test('edge: a single vehicle with a single waiting position verifies with absent zones named',()=>{
 const s=defaultScenario();s.site.positions=[{id:'P001',zone:'waiting',enabled:true}];s.site.ports=[];s.visits=[s.visits[0]];s.arrival_window_tick=1;
 const {p}=verified(s,'single');
 assert.equal(p.visits.length,1);assert.equal(p.visits[0].released_at,null);
 assert.ok(p.visits[0].frontier_at_h.reasons.some(r=>r.code==='ABSENT_INCOMPATIBLE_UNQUALIFIED'));
});
test('edge: all cleaning positions disabled report STATIC_OUT_OF_SERVICE on the cleaning move',()=>{
 const s=defaultScenario();for(const x of s.site.positions)if(x.zone==='cleaning')x.enabled=false;
 const {p}=verified(s,'cleaning off');
 assert.equal(p.metrics['release.released_count'],0);
 const v=p.visits.find(x=>x.frontier_at_h.task?.endsWith(':to_cleaning'));assert.ok(v,'some visit waits at its cleaning move');
 assert.deepEqual(v.frontier_at_h.reasons.find(r=>r.code==='STATIC_OUT_OF_SERVICE').resource_ids,['position:P022','position:P023']);
});
test('edge: zero lanes keep every visit outside with ABSENT_INCOMPATIBLE_UNQUALIFIED',()=>{
 const s=defaultScenario();s.site.lane_count=0;
 const {p}=verified(s,'zero lanes');
 assert.ok(p.visits.every(v=>v.state_at_h==='queued_outside'&&frontierCodes(v).includes('ABSENT_INCOMPATIBLE_UNQUALIFIED')));
 assert.equal(p.metrics['release.released_count'],0);
});
test('edge: S200 with pool and client caps of 300 Mbps either verifies or ends in an agreed LEDGER_BYTES refusal',t=>{
 const raw=clone(preset('S200').baseline);raw.network.pool_bytes_per_tick=300*MBPS;raw.network.client_bytes_per_tick=300*MBPS;
 const s=valid(raw),{run,envelope:e}=runAndVerify(s);
 if(run.terminal_status==='COMPLETE')assert.equal(e.status,'VERIFIED',JSON.stringify(e.primary_violation));
 else{
  assert.equal(run.terminal_status,'INCOMPLETE_RESOURCE_LIMIT');assert.equal(run.guard.guard,'LEDGER_BYTES');assert.ok(run.bytes<=33554432);
  assert.equal(e.status,'INCOMPLETE_RESOURCE_LIMIT');assert.equal(e.consistency,'NOT_AVAILABLE');assert.equal(e.projection,null);assert.equal(e.ledger.terminal_status,'INCOMPLETE_RESOURCE_LIMIT');
 }
 t.diagnostic(JSON.stringify({terminal:run.terminal_status,guard:run.guard,records:run.records,bytes:run.bytes,verifier:e.status}));
});
