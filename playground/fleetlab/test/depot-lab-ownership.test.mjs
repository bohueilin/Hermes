// Ownership and attended work (D1-08 Q2, D1-09; engineering note 8.1, 8.3, 12): exclusive atomic units, retained
// origins, reserved destinations and ports, vendor units, shift fit and the W spaces witness, read from records only.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as h from './helpers/depot-lab-cases.mjs';
import {preset,PRESET_IDS} from '../src/model/depot-lab/presets.js';
import {validateScenario} from '../src/model/depot-lab/schema.js';
const {T}=h;
const arms=PRESET_IDS.flatMap(id=>['baseline','candidate'].filter(a=>preset(id)[a]).map(a=>[`${id}/${a}`,validateScenario(preset(id)[a],{origin:'editor'}).scenario]));
const RUNS=new Map(arms.filter(([k])=>!k.startsWith('S200')).map(([k,s])=>[k,h.run(s).ledger.records]));
// Replays every RESOURCE_DELTA against exclusive ownership: reserve or acquire only free units (or acquire a unit the
// same task reserved), release only what the named task holds; no released visit keeps a unit.
function replay(recs){
 const own=new Map(),visitOf=id=>id.split(':')[1];
 for(const r of h.of(recs,'RESOURCE_DELTA'))for(const c of r.payload.changes){
  const o=own.get(c.resource_id);
  if(c.change==='RESERVE'){assert.equal(o,undefined,`${c.resource_id} reserved while owned at ${r.tick}`);own.set(c.resource_id,{task:c.owner_task_id,mode:'R'});}
  else if(c.change==='ACQUIRE'){assert.ok(!o||(o.task===c.owner_task_id&&o.mode==='R'),`${c.resource_id} acquired while owned at ${r.tick}`);own.set(c.resource_id,{task:c.owner_task_id,mode:'A'});}
  else{assert.equal(o?.task,c.owner_task_id,`${c.resource_id} released by a non-owner at ${r.tick}`);own.delete(c.resource_id);}
 }
 const released=new Set(h.horizon(recs).released.map(v=>v.slice(6)));
 for(const [id,o]of own)assert.ok(!released.has(visitOf(o.task)),`${id} still owned by released ${o.task}`);
 return own;
}
test('every unit is exclusively owned in all preset arms and analytical cases',()=>{
 for(const [k,recs]of RUNS)replay(recs,k);
 for(const c of [h.a21(),h.a37()])replay(h.run(c).ledger.records);
});
test('moves retain their origin until completion and reserve the destination (and port) at start',()=>{
 for(const [k,recs]of RUNS){
  const deltas=new Map();for(const r of h.of(recs,'RESOURCE_DELTA'))deltas.set(`${r.tick}/${r.payload.action_id}`,r.payload.changes);
  for(const r of h.of(recs,'TASK_TRANSITION')){
   const tpl=r.payload.task_id.split(':')[2];if(!['admit','to_garage','vendor_departure','vendor_reentry','to_cleaning','to_charging','egress'].includes(tpl))continue;
   const ch=deltas.get(`${r.tick}/${r.payload.action_id}`)??[],pos=ch.filter(c=>c.resource_id.startsWith('position:'));
   if(r.payload.transition==='START'){
    assert.deepEqual(ch.filter(c=>c.change==='ACQUIRE').map(c=>c.resource_id.split(':')[0]).sort(),['lane','worker'],k);
    const dest=['admit','vendor_reentry','to_garage','to_cleaning','to_charging'].includes(tpl);
    assert.deepEqual(pos.map(c=>c.change),dest?['RESERVE']:[],`${k} ${r.payload.task_id}`);
    assert.equal(ch.some(c=>c.resource_id.startsWith('port:')&&c.change==='RESERVE'),tpl==='to_charging');
   }else if(r.payload.transition==='COMPLETE'){
    const origin=!['admit','vendor_reentry'].includes(tpl),dest=['admit','vendor_reentry','to_garage','to_cleaning','to_charging'].includes(tpl);
    assert.deepEqual(pos.map(c=>c.change).sort(),[...(dest?['ACQUIRE']:[]),...(origin?['RELEASE']:[])].sort(),`${k} ${r.payload.task_id}`);
    for(const c of pos.filter(x=>x.change==='RELEASE'))assert.notEqual(c.owner_task_id,r.payload.task_id);
   }
  }
 }
});
test('ports: reserved by to_charging, acquired at connect completion, released at unplug; the position stays held to egress',()=>{
 const recs=RUNS.get('B/baseline');let n=0;
 for(const v of [...new Set(h.of(recs,'ARRIVAL').map(r=>r.payload.visit_id.slice(6)))]){
  const tc=T(v,'to_charging');if(h.startTick(recs,tc)===null)continue;n++;
  const port=h.of(recs,'RESOURCE_DELTA').find(r=>r.tick===h.startTick(recs,tc)&&r.payload.changes.some(c=>c.owner_task_id===tc&&c.resource_id.startsWith('port:'))).payload.changes.find(c=>c.resource_id.startsWith('port:')).resource_id;
  const own=h.changesOf(recs,port).filter(c=>c[2]===tc);
  assert.deepEqual(own.map(c=>[c[0],c[1]]),[['RESERVE',h.startTick(recs,tc)],['ACQUIRE',h.completeTick(recs,T(v,'connect'))],['RELEASE',h.completeTick(recs,T(v,'unplug'))]]);
  assert.ok(h.completeTick(recs,T(v,'inspection'))<=h.startTick(recs,T(v,'unplug')),'connected inspection precedes unplug');
  const pos=h.ownership(recs,h.of(recs,'RESOURCE_DELTA').find(r=>r.tick===h.completeTick(recs,tc)).payload.changes.find(c=>c.change==='ACQUIRE'&&c.owner_task_id===tc).resource_id).find(x=>x[2]===tc);
  assert.deepEqual(pos.slice(0,2),[h.startTick(recs,tc),h.releaseTick(recs,v)]);
 }
 assert.equal(n,24);
});
test('vendor route: departure releases the depot position; vendor units are held only during service',()=>{
 const recs=RUNS.get('G/candidate');
 for(const v of ['08','16','24']){
  const dep=h.interval(recs,T(v,'vendor_departure')),svc=h.interval(recs,T(v,'vendor_service')),re=h.interval(recs,T(v,'vendor_reentry'));
  assert.equal(svc[1]-svc[0],7200);assert.ok(dep[1]<=svc[0]&&svc[1]<=re[0]);
  for(const u of ['vendor:bay:01','vendor:worker:01'])assert.ok(h.ownership(recs,u).some(x=>x[0]===svc[0]&&x[1]===svc[1]&&x[2]===T(v,'vendor_service')));
  const held=h.of(recs,'RESOURCE_DELTA').flatMap(r=>r.payload.changes.map(c=>[r.tick,c])).filter(([,c])=>c.resource_id.startsWith('position:')&&c.owner_task_id.startsWith(`task:${v}:`));
  assert.ok(!held.some(([t,c])=>t>dep[1]&&t<re[0]),'no depot position between departure and re-entry');
  assert.equal(h.interval(recs,T(v,'vendor_outbound'))[1]-h.interval(recs,T(v,'vendor_outbound'))[0],1800);
 }
 assert.equal(h.starts(RUNS.get('G/baseline'),'vendor_service').length,0);
});
test('attended work never crosses a shift end; maximal adjacent unions are one shift',()=>{
 const run=availability=>{const c=h.uploadCase({logs:0,cabinWindow:0,availability});return h.run(c.s,{harness:c.harness}).ledger.records;};
 let recs=run([{start_tick:0,end_tick:1000}]);
 assert.equal(h.startTick(recs,T('V1','inspection')),null);
 assert.deepEqual(h.decisionsOf(recs,T('V1','inspection')).map(d=>[d.tick,d.reasons]),[[720,[{code:'INSUFFICIENT_SHIFT',holder_visit_ids:[],resource_ids:['worker:L01']}]]]);
 recs=run([{start_tick:0,end_tick:800},{start_tick:800,end_tick:1100}]);
 assert.deepEqual(h.interval(recs,T('V1','inspection')),[720,1020]);
 recs=run([{start_tick:0,end_tick:800},{start_tick:900,end_tick:1300}]);
 assert.deepEqual(h.interval(recs,T('V1','inspection')),[900,1200]);
});
test('attended durations follow the chosen worker profile; supervised trainees never add capacity',()=>{
 const recs=RUNS.get('TP/candidate'),base=RUNS.get('TP/baseline');
 const cab=r=>h.of(r,'TASK_TRANSITION').filter(x=>x.payload.task_id.endsWith(':cabin')&&x.payload.transition==='START').map(x=>h.interval(r,x.payload.task_id)).map(([a,b])=>b-a);
 assert.ok(cab(recs).length===24&&cab(recs).every(d=>d===480));assert.ok(cab(base).every(d=>d===600));
 const tn=RUNS.get('TN/candidate');assert.deepEqual(tn,RUNS.get('TN/baseline'));
 assert.ok(!h.of(tn,'RESOURCE_DELTA').some(r=>r.payload.changes.some(c=>c.resource_id==='worker:C02')));
});
test('W: seventeen waiting positions leave seven visits outside at 3,000; twenty-four leave none; no cleaning move before 3,600',()=>{
 for(const [arm,outside,lastIntake]of [['baseline',7,null],['candidate',0,3000]]){
  const recs=RUNS.get(`W/${arm}`),admits=h.starts(recs,'admit').map(r=>r.tick);
  assert.equal(24-admits.filter(t=>t<=3000).length,outside,arm);
  assert.ok(h.starts(recs,'to_cleaning').every(r=>r.tick>=3600));assert.equal(Math.min(...h.starts(recs,'to_cleaning').map(r=>r.tick)),3600);
  if(lastIntake!==null)assert.equal(Math.max(...h.of(recs,'TASK_TRANSITION').filter(r=>r.payload.task_id.endsWith(':intake')&&r.payload.transition==='COMPLETE').map(r=>r.tick)),lastIntake);
 }
});
test('ST and GN are structural nulls: one bay and no specialist work change nothing operational',()=>{
 for(const id of ['GN']){assert.deepEqual(RUNS.get(`${id}/candidate`),RUNS.get(`${id}/baseline`));}
 const st=RUNS.get('ST/candidate');
 const repairs=h.of(st,'TASK_TRANSITION').filter(r=>/:(diagnosis|repair)$/.test(r.payload.task_id)&&r.payload.transition==='START').map(r=>h.interval(st,r.payload.task_id));
 repairs.sort((a,b)=>a[0]-b[0]);for(let i=1;i<repairs.length;i++)assert.ok(repairs[i][0]>=repairs[i-1][1],'one garage bay serialises attended mechanical work');
});
