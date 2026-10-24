// Engine side of the annex analytical oracles (D1-13 A21-A24, A35; C4 A37-A39 valid references; C2.1 SOC and
// anchor oracles). Expected values are the written contract numbers; every assertion reads ledger records only.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as h from './helpers/depot-lab-cases.mjs';
const {T}=h;
const runCase=c=>{const r=h.run(c.s??c,{harness:c.harness??null});assert.equal(r.terminal_status,'COMPLETE');return r.ledger.records;};
test('A21: one vehicle through the 60% band edge, target and release',()=>{
 const recs=runCase(h.a21());
 const want={admit:[0,120],intake:[120,240],to_charging:[240,360],connect:[360,480],charge:[480,2064],inspection:[2064,2364],unplug:[2364,2484],egress:[2484,2604]};
 for(const [k,v]of Object.entries(want))assert.deepEqual(h.interval(recs,T('V1',k)),v,k);
 const p=h.progressOf(recs,'flow:V1:charge');
 assert.deepEqual(p.map(x=>[x.to_tick,x.credited,x.quantization_slack,x.undrawn_final_tick]),[[1344,86400000000,'0/1','0/1'],[2064,43200000000,'0/1','0/1']]);
 assert.equal(p.reduce((n,x)=>n+x.credited,0),129600000000);
 assert.deepEqual(h.allocationsOf(recs,'flow:V1:charge').map(a=>[a.tick,a.rate]),[[480,'100000000/1'],[1344,'60000000/1']]);
 assert.equal(h.busySeconds(recs,'worker:X01'),1020);
 assert.deepEqual(h.changesOf(recs,'port:DC1'),[['RESERVE',240,T('V1','to_charging')],['ACQUIRE',480,T('V1','to_charging')],['RELEASE',2484,T('V1','to_charging')]]);
 assert.deepEqual(h.ownership(recs,'position:W1'),[[0,360,T('V1','admit')]]);
 assert.deepEqual(h.ownership(recs,'position:C1'),[[240,2604,T('V1','to_charging')]]);
 assert.deepEqual(h.horizon(recs).released,['visit:V1']);
});
test('A22: both stable-id assignments on one port',()=>{
 for(const [first,rel,connect]of [['A',[1860,3180],1980],['B',[1320,3180],1440]]){
  const recs=runCase(h.a22(first));
  assert.deepEqual([h.releaseTick(recs,'A'),h.releaseTick(recs,'B')],rel,first);
  assert.equal(h.startTick(recs,T('B','connect')),connect,first);
  assert.equal(h.startTick(recs,T('B','to_charging')),connect-120,first);
 }
});
test('A23: two connected cars share the 100 kW site, then the survivor takes all of it',()=>{
 const recs=runCase(h.a23());
 assert.deepEqual(h.allocationsOf(recs,'flow:A:charge').map(a=>[a.tick,a.rate]),[[0,'50000000/1'],[1080,'100000000/1']]);
 assert.deepEqual(h.allocationsOf(recs,'flow:B:charge').map(a=>[a.tick,a.rate]),[[0,'50000000/1']]);
 assert.equal(h.completeTick(recs,T('B','charge')),1080);assert.equal(h.completeTick(recs,T('A','charge')),1620);
 assert.deepEqual([h.releaseTick(recs,'A'),h.releaseTick(recs,'B')],[2160,1620]);
 const all=[...h.progressOf(recs,'flow:A:charge'),...h.progressOf(recs,'flow:B:charge')];
 assert.equal(all.reduce((n,x)=>n+x.credited,0),162000000000);
 assert.ok(all.every(x=>x.quantization_slack==='0/1'&&x.undrawn_final_tick==='0/1'));
 assert.deepEqual(h.interval(recs,T('B','inspection')),[1080,1380]);assert.deepEqual(h.interval(recs,T('A','inspection')),[1620,1920]);
});
test('A24: one port versus two ports under the fixed ready-tick rule',()=>{
 let recs=runCase(h.a24(1));
 assert.deepEqual([h.completeTick(recs,T('A','charge')),h.completeTick(recs,T('B','charge'))],[1320,3180]);
 assert.deepEqual([h.releaseTick(recs,'A'),h.releaseTick(recs,'B')],[1860,3720]);
 assert.deepEqual(h.interval(recs,T('B','to_charging')),[1860,1980]);assert.deepEqual(h.interval(recs,T('B','connect')),[1980,2100]);
 recs=runCase(h.a24(2));
 const want={'A:to_charging':[0,120],'B:to_charging':[120,240],'A:connect':[240,360],'B:connect':[360,480],'A:charge':[360,2400],'B:charge':[480,2520],'A:inspection':[2400,2700],'B:inspection':[2700,3000]};
 for(const [k,v]of Object.entries(want)){const [vid,tpl]=k.split(':');assert.deepEqual(h.interval(recs,T(vid,tpl)),v,k);}
 assert.deepEqual(h.allocationsOf(recs,'flow:A:charge').map(a=>[a.tick,a.rate]),[[360,'100000000/1'],[480,'50000000/1']]);
 assert.deepEqual(h.allocationsOf(recs,'flow:B:charge').map(a=>[a.tick,a.rate]),[[480,'50000000/1'],[2400,'100000000/1']]);
 assert.deepEqual([h.releaseTick(recs,'A'),h.releaseTick(recs,'B')],[2940,3240]);
});
test('A35: Wi-Fi generation label changes no operational record',()=>{
 const arms=['wifi6','wifi7'].map(g=>{const c=h.a35(g);return {r:h.run(c.s,{harness:c.harness})};});
 for(const {r}of arms){
  const recs=r.ledger.records;
  assert.deepEqual(h.interval(recs,T('V1','software_download')),[0,160]);
  assert.equal(h.progressOf(recs,'flow:V1:software_download').reduce((n,x)=>n+x.credited,0),2000000000);
  assert.equal(h.completeTick(recs,T('V1','software_check')),220);assert.equal(h.completeTick(recs,T('V1','software_activation')),820);assert.equal(h.completeTick(recs,T('V1','software_postcheck')),880);
  assert.deepEqual(h.interval(recs,T('V1','inspection')),[880,1180]);assert.deepEqual(h.interval(recs,T('V1','egress')),[1180,1300]);
  assert.equal(new Set(h.of(recs,'ALLOCATION_DELTA').flatMap(x=>x.payload.changes.map(c=>c.flow_id))).size,1);
  assert.deepEqual(h.ownership(recs,'position:W1').map(x=>x[1]),[1300]);
 }
 assert.deepEqual(arms[0].r.ledger.records,arms[1].r.ledger.records);
 assert.notEqual(arms[0].r.ledger.scenario_digest,arms[1].r.ledger.scenario_digest);
});
test('A37 valid reference: same-tick acquisitions are seen by the next proposal',()=>{
 const recs=runCase(h.a37());
 assert.deepEqual([h.interval(recs,T('V001','admit')),h.interval(recs,T('V002','admit'))],[[0,120],[120,240]]);
 const d=h.decisionsOf(recs,T('V002','admit'));
 assert.deepEqual(d.map(x=>[x.tick,x.accepted]),[[0,false],[120,true]]);
 assert.deepEqual(d[0].reasons,[{code:'HELD_UNITS',holder_visit_ids:['visit:V001'],resource_ids:['lane:01','worker:M01']}]);
 for(const u of ['worker:M01','lane:01']){const o=h.ownership(recs,u);for(let i=1;i<o.length;i++)assert.ok(o[i][0]>=o[i-1][1],u);}
});
test('A38 valid reference: received bytes still need the local lifecycle',()=>{
 const c=h.a38(),recs=runCase(c);
 assert.equal(h.startTick(recs,T('V1','software_download')),null);
 const want={software_check:[0,60],software_activation:[60,660],software_postcheck:[660,720],inspection:[720,1020],egress:[1020,1140]};
 for(const [k,v]of Object.entries(want))assert.deepEqual(h.interval(recs,T('V1',k)),v,k);
});
test('A39: a finite cold cache waits without fetch, eviction or bypass; 2 GB proceeds',()=>{
 let recs=runCase(h.a39(1000000000));
 assert.equal(h.starts(recs,'fetch').length,0);assert.equal(h.starts(recs,'software_download').length,0);
 assert.deepEqual(h.decisionsOf(recs,'task:cache:sw-new:fetch').map(d=>d.reasons.map(r=>r.code)),[['FULL_STOCK_CACHE']]);
 assert.deepEqual(h.horizon(recs).unreleased,['visit:V1']);assert.equal(h.contentOf(recs).length,0);
 recs=runCase(h.a39(2000000000));
 assert.deepEqual(h.interval(recs,'task:cache:sw-new:fetch'),[0,80]);assert.deepEqual(h.interval(recs,'task:cache:sw-new:check'),[80,140]);
 const want={software_download:[140,300],software_check:[300,360],software_activation:[360,960],software_postcheck:[960,1020],inspection:[1020,1320],egress:[1320,1440]};
 for(const [k,v]of Object.entries(want))assert.deepEqual(h.interval(recs,T('V1',k)),v,k);
 assert.deepEqual(h.allocationsOf(recs,'flow:V1:software_download')[0].resource_path,['cache:read','client:V1','network:pool']);
});
test('SOC 20 to 21%: 22 ticks, 40,000,000 mJ undrawn, no overshoot',()=>{
 const recs=runCase(h.a21({target:21}));
 const [s,e]=h.interval(recs,T('V1','charge'));assert.equal(e-s,22);
 assert.deepEqual(h.progressOf(recs,'flow:V1:charge').map(x=>[x.credited,x.undrawn_final_tick,x.quantization_slack]),[[2160000000,'40000000/1','0/1']]);
});
test('SOC at or above target creates no charge work; 80 to 90 uses only the 30 kW band',()=>{
 for(const [soc,target]of [[80,80],[90,80]]){
  const recs=runCase(h.a21({soc,target}));
  assert.equal(h.of(recs,'TASK_TRANSITION').filter(r=>/:(to_charging|connect|charge|unplug)$/.test(r.payload.task_id)).length,0);
  assert.deepEqual(h.horizon(recs).released,['visit:V1']);
 }
 const recs=runCase(h.a21({soc:80,target:90}));
 const [s,e]=h.interval(recs,T('V1','charge'));assert.equal(e-s,720);
 assert.deepEqual(h.allocationsOf(recs,'flow:V1:charge').map(a=>a.rate),['30000000/1']);
});
test('uncontended charge ticks from 20% for targets 60/80/90/100',()=>{
 for(const [target,ticks]of [[60,864],[80,1584],[90,2304],[100,3024]]){
  const recs=runCase(h.a21({target,H:7200}));
  const [s,e]=h.interval(recs,T('V1','charge'));assert.equal(e-s,ticks,String(target));
 }
});
test('anchor oracle: an unrelated event keeps the anchor; a real change discards the half byte',()=>{
 let recs=runCase(h.anchorCase('unrelated'));
 assert.ok(h.of(recs,'SHIFT_CHANGE').some(r=>r.tick===1));
 for(const v of ['V1','V2']){
  assert.deepEqual(h.interval(recs,T(v,'software_download')),[0,2]);
  assert.deepEqual(h.progressOf(recs,`flow:${v}:software_download`).map(x=>[x.from_tick,x.to_tick,x.allocation_anchor_tick,x.credited,x.quantization_slack]),[[0,2,0,1,'0/1']]);
  assert.deepEqual(h.allocationsOf(recs,`flow:${v}:software_download`).map(a=>[a.tick,a.rate]),[[0,'1/2']]);
 }
 recs=runCase(h.anchorCase('change'));
 for(const v of ['V1','V2']){
  assert.deepEqual(h.progressOf(recs,`flow:${v}:software_download`).map(x=>[x.from_tick,x.to_tick,x.credited,x.quantization_slack]),[[0,1,0,'1/2'],[1,4,1,'0/1']]);
  assert.equal(h.completeTick(recs,T(v,'software_download')),4);
 }
 assert.deepEqual(h.interval(recs,T('V3','software_download')),[1,4]);
});
