// Divisible allocation and credit (C2.1; engineering note 8.6, BD-11): exact weight-1 max-min with tight sets, interval
// floor credit with anchor preservation, quantization slack, undrawn final tick and the sub-quantum guard.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as h from './helpers/depot-lab-cases.mjs';
import {maxMin,creditAt,closureTick,undrawnAt,slackAt,subQuantum} from '../src/model/depot-lab/allocation.js';
import {Q,parseRational,formatRational,mulBig,floor,ceil,sub,div,add,cmp,ZERO} from '../src/model/depot-lab/rational.js';
import {preset} from '../src/model/depot-lab/presets.js';
import {validateScenario} from '../src/model/depot-lab/schema.js';
const fmt=m=>Object.fromEntries([...m].map(([k,v])=>[k,[formatRational(v.rate),v.tight]]));
const caps=o=>new Map(Object.entries(o).map(([k,v])=>[k,BigInt(v)]));
test('max-min: equal shares, own caps, zero capacity and multi-resource bottlenecks are exact',()=>{
 assert.deepEqual(fmt(maxMin(['a','b','c'].map(id=>({id,path:['r'],cap:null})),caps({r:10}))),{a:['10/3',['r']],b:['10/3',['r']],c:['10/3',['r']]});
 assert.deepEqual(fmt(maxMin([{id:'a',path:['site'],cap:20n},{id:'b',path:['site'],cap:100n}],caps({site:100}))),{a:['20/1',['a','site']],b:['80/1',['site']]});
 assert.deepEqual(fmt(maxMin([{id:'x',path:['z'],cap:null},{id:'y',path:['r'],cap:null}],caps({z:0,r:5}))),{x:['0/1',['z']],y:['5/1',['r']]});
 assert.deepEqual(fmt(maxMin([{id:'a',path:['r1'],cap:null},{id:'b',path:['r1','r2'],cap:null},{id:'c',path:['r2'],cap:null}],caps({r1:1,r2:2}))),{a:['1/2',['r1']],b:['1/2',['r1','r2']],c:['3/2',['r2']]});
 assert.deepEqual(fmt(maxMin([{id:'f',path:['client:V1','network:pool','network:wan_down'],cap:null}],caps({'client:V1':12500000,'network:pool':37500000,'network:wan_down':25000000}))),{f:['12500000/1',['client:V1']]});
 // Ties freeze together: own cap and port rating reached on the same level are both tight.
 assert.deepEqual(fmt(maxMin([{id:'flow:B:charge',path:['port:AC01','site:supply'],cap:11000000n}],caps({'port:AC01':11000000,'site:supply':300000000}))),{'flow:B:charge':['11000000/1',['flow:B:charge','port:AC01']]});
});
test('credit helpers: interval floor, closure tick, undrawn and slack',()=>{
 const half=Q(1n,2n);
 assert.equal(creditAt(half,0,1,1n),0n);assert.equal(creditAt(half,0,2,1n),1n);assert.equal(creditAt(half,0,9,1n),1n);
 assert.equal(closureTick(half,0,1n,10),2);assert.equal(closureTick(half,0,1n,1),null);assert.equal(closureTick(ZERO,0,1n,10),null);
 assert.equal(closureTick(Q(100000000n),480,2160000000n,3600),502);
 assert.equal(formatRational(undrawnAt(Q(100000000n),480,502,2160000000n)),'40000000/1');
 assert.equal(formatRational(slackAt(half,0,1,0n)),'1/2');
 assert.equal(subQuantum(Q(1n,3n),1,1n,3),true);assert.equal(subQuantum(half,0,1n,2),false);assert.equal(subQuantum(ZERO,0,1n,2),false);
 assert.equal(subQuantum(half,0,1n,2,0n),false,'an unrelated event at 1 keeps the deliverable byte');
});
// Replays ALLOCATION_DELTA and PROGRESS records: capacity feasibility, the bottleneck characterization and exact credits.
function checkAllocations(s,recs){
 const n=s.network,cap=new Map([['network:pool',n.pool_bytes_per_tick],['network:wan_down',n.wan_down_bytes_per_tick],['network:wan_up',n.wan_up_bytes_per_tick],['cache:read',n.cache_read_bytes_per_tick],['site:supply',(s.site.supply_w-s.site.background_w)*1000]]);
 for(const p of s.site.ports)cap.set(`port:${p.id}`,p.rating_w*1000);
 const capOf=r=>BigInt(r.startsWith('client:')?n.client_bytes_per_tick:cap.get(r));
 const active=new Map(),hist=new Map();let tick=-1;
 const check=()=>{
  const load=new Map();for(const [,a]of active)for(const r of a.path)load.set(r,add(load.get(r)??ZERO,a.rate));
  for(const [r,l]of load)assert.ok(cmp(l,Q(capOf(r)))<=0,`${r} over capacity at ${tick}`);
  for(const [id,a]of active){
   // Tight ids are exactly the saturated path resources (plus the flow at its own cap); some tight resource is a
   // bottleneck on which the flow's rate is maximal, unless the flow sits at its own cap.
   for(const r of a.path)assert.equal(a.tight.includes(r),cmp(load.get(r),Q(capOf(r)))===0,`${id} tight ${r} at ${tick}`);
   const maximal=r=>[...active.values()].every(b=>!b.path.includes(r)||cmp(b.rate,a.rate)<=0);
   assert.ok(a.tight.includes(id)||a.tight.some(r=>r!==id&&maximal(r)),`${id} bottleneck at ${tick}`);
  }
 };
 const flowOf=task=>{const p=task.split(':');return p[1]==='cache'?`flow:cache:${p[2]}:fetch`:`flow:${p[1]}:${p[2]}`;};
 for(const r of recs){
  if(r.tick!==tick){if(tick>=0)check();tick=r.tick;}
  if(r.kind==='ALLOCATION_DELTA')for(const c of r.payload.changes){const a={rate:parseRational(c.rate),path:c.resource_path,tight:c.tight_resource_ids};active.set(c.flow_id,a);(hist.get(c.flow_id)??hist.set(c.flow_id,[]).get(c.flow_id)).push([r.tick,a.rate]);}
  if(r.kind==='TASK_TRANSITION'&&['COMPLETE','PAUSE','CANCEL'].includes(r.payload.transition))active.delete(flowOf(r.payload.task_id));
  if(r.kind==='PROGRESS')for(const c of r.payload.changes){
   const rate=hist.get(c.flow_id).filter(([t])=>t<=c.allocation_anchor_tick).at(-1)[1],exact=mulBig(rate,BigInt(c.to_tick-c.allocation_anchor_tick));
   assert.equal(c.credited,c.anchor_credited_after-c.anchor_credited_before);
   if(r.phase===0){assert.equal(c.quantization_slack,'0/1');assert.equal(formatRational(sub(exact,Q(BigInt(c.anchor_credited_after)))),c.undrawn_final_tick);assert.equal(c.to_tick,c.allocation_anchor_tick+Number(ceil(div(Q(BigInt(c.anchor_credited_after)),rate))));}
   else if(r.phase===5){assert.equal(BigInt(c.anchor_credited_after),floor(exact));assert.equal(c.quantization_slack,formatRational(sub(exact,Q(floor(exact)))));assert.equal(c.undrawn_final_tick,'0/1');}
   else{assert.ok(BigInt(c.anchor_credited_after)<=floor(exact));assert.deepEqual([c.quantization_slack,c.undrawn_final_tick],['0/1','0/1']);}
  }
 }
}
test('preset allocations are feasible, max-min characterized and credited exactly',()=>{
 for(const k of ['B/baseline','D/baseline','DR/candidate','P/baseline','PS/candidate','M/baseline','S200/baseline']){
  const [id,a]=k.split('/'),s=validateScenario(preset(id)[a],{origin:'editor'}).scenario;
  checkAllocations(s,h.run(s).ledger.records);
 }
});
test('analytical allocations: A23 and A24 always sum to the 100 kW site while charging',()=>{
 for(const c of [h.a23(),h.a24(2)]){
  const recs=h.run(c.s,{harness:c.harness}).ledger.records;checkAllocations(c.s,recs);
  const rates=new Map();
  for(const r of recs){
   if(r.kind==='ALLOCATION_DELTA')for(const x of r.payload.changes)rates.set(x.flow_id,parseRational(x.rate));
   if(r.kind==='TASK_TRANSITION'&&r.payload.transition==='COMPLETE'&&r.payload.task_id.endsWith(':charge'))rates.delete(`flow:${r.payload.task_id.split(':')[1]}:charge`);
   if(r.kind==='ALLOCATION_DELTA'&&rates.size===2)assert.equal(formatRational([...rates.values()].reduce(add,ZERO)),'100000000/1');
  }
 }
});
test('completed transfers credit exactly their bytes and charges exactly their required energy',()=>{
 const s=validateScenario(preset('B').baseline,{origin:'editor'}).scenario,recs=h.run(s).ledger.records;
 const sum=f=>h.progressOf(recs,f).reduce((n,x)=>n+x.credited,0);
 for(const v of s.visits){
  assert.equal(sum(`flow:${v.id}:charge`),2160000000*(80-v.initial_soc_pct));
  assert.equal(sum(`flow:${v.id}:software_download`),2000000000);
  if(h.completeTick(recs,h.T(v.id,'upload'))!==null)assert.equal(sum(`flow:${v.id}:upload`),v.initial_log_bytes);
 }
 assert.equal(sum('flow:cache:sw-v2:fetch'),2000000000);
});
