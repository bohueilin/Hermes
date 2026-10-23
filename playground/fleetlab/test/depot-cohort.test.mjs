import assert from 'node:assert/strict';
import {test} from 'node:test';
const model=await import('../src/model/depot-cohort.js').catch(()=>({}));
const contract=await import('../src/model/depot-cohort-contract.js').catch(()=>({}));
const verifier=await import('../src/model/depot-cohort-verify.js').catch(()=>({}));
const scenario=options=>{assert.equal(typeof contract.cohortScenario,'function','NF02 contract is required');return contract.cohortScenario(options);};
const run=(s,rule='cohort_fifo',runtime)=>{assert.equal(typeof model.simulateCohort,'function','NF02 engine is required');return model.simulateCohort(s,rule,runtime);};
const verify=r=>{assert.equal(typeof verifier.verifyCohort,'function','Independent NF02 verifier is required');return verifier.verifyCohort(r);};
const ready=r=>Object.fromEntries(r.events.filter(e=>e.type==='ready').map(e=>[e.vehicle,e.time_s]));
const misses=v=>v.metrics.late+v.metrics.unfinished_due;

for(const quantum of [1000,250])test(`all four schedules preserve literal service and outcomes at ${quantum} ms`,()=>{
  scenario();assert.equal(typeof model.runCohortComparison,'function');
  const result=model.runCohortComparison({time_quantum_ms:quantum});
  assert.equal(result.comparison_eligible,true);
  const expected=[{A:600,B:660,C:1020,D:1140},{A:1140,B:360,C:1020,D:540},{A:720,B:780,C:1140,D:240},{A:1140,B:180,C:660,D:300}];
  assert.deepEqual(result.arms.map(a=>a.verification.metrics.ready_s),expected);
  assert.deepEqual(result.arms.map(a=>ready(a.record)),expected);
  assert.deepEqual(result.arms.map(a=>misses(a.verification)),[1,2,1,1]);
  assert.deepEqual(result.arms.map(a=>a.verification.metrics.lateness_lower_bound_s),[780,720,120,540]);
  for(const {record,verification} of result.arms){
    assert.equal(verification.model_validity,'VALID');
    assert.equal(Object.values(record.totals.upload_bytes).reduce((a,b)=>a+b,0),127.5e9);
    assert.equal(Math.max(...record.events.filter(e=>e.task==='upload').map(e=>e.time_s)),1020);
    assert.ok(record.intervals.length<=6000);
  }
  assert.ok(JSON.stringify(result).length<64*1024*1024);
});

test('deadline equality settles completion first; censored outcomes retain lower bounds',()=>{
  const s=scenario();s.horizon_s=600;s.vehicles[0].deadline_s=600;
  const r=run(s),v=verify(r);
  assert.equal(v.model_validity,'VALID');assert.equal(v.metrics.on_time,1);
  assert.deepEqual(v.visits.map(x=>x.outcome),['on_time','pending','pending','unfinished_due']);
  assert.equal(v.metrics.lateness_lower_bound_s,240);assert.equal(v.metrics.final_lateness,false);
  assert.ok(r.events.findIndex(e=>e.type==='ready'&&e.vehicle==='A')<r.events.findIndex(e=>e.type==='deadline'&&e.vehicle==='A'));
});

test('valid final grants execute only remaining work and never reuse spare bytes within the slot',()=>{
  const s=scenario();s.horizon_s=2;s.uplink_bytes_s=5;
  s.vehicles.forEach(v=>{v.upload_bytes=0;v.post_s=0;});s.vehicles[0].upload_bytes=2;s.vehicles[1].upload_bytes=3;
  const r=run(s),v=verify(r);
  assert.equal(v.model_validity,'VALID');assert.deepEqual(ready(r),{C:0,D:0,A:1,B:2});
  assert.deepEqual(r.intervals.map(i=>[i.grants,i.upload,i.unused]),[[{A:5},{A:2},{A:3}],[{B:5},{B:3},{B:2}]]);
  assert.deepEqual(r.totals.upload_bytes,{A:2,B:3,C:0,D:0});
});

test('serial rules retain a holder until completion; known exact sizes rank shortest upload',()=>{
  const r=run(scenario(),'cohort_shortest_upload');
  assert.deepEqual(r.events.filter(e=>e.task==='upload').map(e=>[e.vehicle,e.time_s]),[['B',60],['D',180],['C',540],['A',1020]]);
  const swapped=structuredClone(r);swapped.rule='cohort_departure_deadline';assert.equal(verify(swapped).model_validity,'INVALID');
});

for(const quantum of [1000,250])test(`eligible-ring remainder rejects lowest-ID and global-ring mutants at ${quantum} ms`,()=>{
  const s=scenario({time_quantum_ms:quantum});
  for(const [kind,wantTime,wantLate] of [['lowest',quantum===1000?541:540.25,quantum===1000?722:720.5],['global',quantum===1000?1141:1140.25,quantum===1000?721:720.25]]){
    const r=run(s,'cohort_equal_uplink',{propose:o=>{
      const n=o.eligible.length;if(!n)return {};
      const grants=Object.fromEntries(o.eligible.map(v=>[v.id,Math.floor(o.slot_bytes/n)]));
      let extra=o.slot_bytes%n;
      if(kind==='lowest')for(let j=0;j<extra;j++)grants[o.eligible[j].id]++;
      else for(let j=0;extra;j++){const id=['A','B','C','D'][(o.slot_index+j)%4];if(Object.hasOwn(grants,id)){grants[id]++;extra--;}}
      return grants;
    }});
    assert.equal(r.execution_status,'completed');assert.equal(ready(r)[kind==='lowest'?'D':'A'],wantTime);
    assert.equal(Object.entries(ready(r)).reduce((sum,[id,t])=>sum+Math.max(0,t-s.vehicles.find(v=>v.id===id).deadline_s),0),wantLate);
    assert.equal(verify(r).model_validity,'INVALID');
  }
});

test('invalid grants fail closed at their boundary with diagnostic-only comparison status',()=>{
  const bad=[()=>({A:-1}),()=>({A:Infinity}),()=>({A:NaN}),()=>({A:0.5}),()=>({A:125000001}),()=>({ghost:1}),()=>({}),()=>[],()=>null,()=>{throw Error('broken');},()=>{throw null;},()=>{throw undefined;},()=>{throw Error('');},()=>Object.defineProperty({A:1},'hidden',{value:1}),()=>({A:1,[Symbol('grant')]:1}),()=>JSON.parse('{"__proto__":1}'),()=>Object.create({A:1})];
  for(const at of [0,3])for(const grant of bad){
    const r=run(scenario(),'cohort_fifo',{propose:o=>o.time_s>=at?grant():{A:o.slot_bytes}}),v=verify(r);
    assert.equal(r.execution_status,'failed');assert.equal(r.end_s,at);assert.equal(r.policy_status,'policy_error');assert.equal(r.diagnostics.length,1);
    assert.equal(v.model_validity,'VALID');assert.equal(v.comparison_eligible,false);
  }
});

test('cancellation records only its accepted prefix and comparison never inherits eligibility',()=>{
  let calls=0;const r=run(scenario(),'cohort_fifo',{shouldCancel:()=>calls++===3});
  const v=verify(r);assert.equal(r.end_s,3);assert.equal(r.execution_status,'cancelled');assert.equal(v.model_validity,'VALID');assert.equal(v.comparison_eligible,false);
  const result=model.runCohortComparison({}, {shouldCancel:()=>true});assert.equal(result.arms.length,0);assert.equal(result.comparison_eligible,false);
});

test('zero work finishes dependencies at zero; zero capacity is censored without hidden dropping',()=>{
  const s=scenario();s.vehicles.forEach(v=>{v.upload_bytes=0;v.post_s=0;v.deadline_s=0;});
  let r=run(s),v=verify(r);assert.equal(v.metrics.on_time,4);assert.deepEqual(ready(r),{A:0,B:0,C:0,D:0});
  const blocked=scenario();blocked.uplink_bytes_s=0;r=run(blocked);v=verify(r);
  assert.equal(v.model_validity,'VALID');assert.equal(v.metrics.unfinished_due,4);assert.equal(v.metrics.final_lateness,false);assert.deepEqual(r.totals.upload_bytes,{A:0,B:0,C:0,D:0});
});

test('scenario validation bounds quanta, arithmetic, graph and actual own keys',()=>{
  for(const mutate of [s=>s.time_quantum_ms=500,s=>s.horizon_s=1501,s=>s.uplink_bytes_s=0.1,s=>s.vehicles[0].upload_bytes=Number.MAX_SAFE_INTEGER,s=>s.vehicles[0].energy_j=1,s=>s.vehicles[0].post_s=-1,s=>s.vehicles[0].arrival_s=1,s=>s.dependencies.upload=['post'],s=>s.vehicles[0].deadline_s=0.1,s=>s.extra=1,s=>s.vehicles[0].id='constructor']){
    const s=scenario();mutate(s);assert.throws(()=>run(s));
  }
  assert.throws(()=>scenario({time_quantum_ms:100}));assert.throws(()=>scenario({unknown:true}));assert.throws(()=>run(scenario(),'nf_fifo'));
});

test('policy observation is frozen current data and never exposes a future ledger',()=>{
  const s=scenario();s.horizon_s=2;let observations=0;
  run(s,'cohort_fifo',{propose:o=>{observations++;assert.ok(Object.isFrozen(o)&&Object.isFrozen(o.eligible)&&Object.isFrozen(o.eligible[0]));assert.equal(Object.hasOwn(o,'events'),false);assert.equal(o.eligible[0].remaining_bytes,60e9-o.time_s*125e6);return {A:o.slot_bytes};}});
  assert.equal(observations,2);
});

test('verifier rejects forged allocations, event inventory, coverage, totals and own-property keys without mutation',()=>{
  const original=run(scenario()),before=JSON.stringify(original);
  for(const mutate of [r=>r.intervals[0].upload.A++,r=>r.intervals[0].grants.A++,r=>r.intervals[0].unused.A=1,r=>r.intervals[0].charge.B=1,r=>r.events.find(e=>e.type==='ready').time_s--,r=>r.events.push({...r.events[0]}),r=>r.events.splice(r.events.findIndex(e=>e.type==='complete'),1),r=>r.events[1].seq=4,r=>r.totals.upload_bytes.A++,r=>r.intervals.splice(1,1),r=>r.intervals[0].end_s=2,r=>r.versions.record='bad',r=>r.intervals[0].upload=JSON.parse('{"constructor":1}'),r=>Object.defineProperty(r.intervals[0].grants,'hidden',{value:1}),r=>r.events[0].extra=1,r=>r.totals.upload_bytes.ghost=0]){
    const r=structuredClone(original);mutate(r);const v=verify(r);assert.equal(v.model_validity,'INVALID');assert.equal(v.comparison_eligible,false);assert.equal(v.metrics,null);
  }
  assert.equal(JSON.stringify(original),before);verify(original);assert.equal(JSON.stringify(original),before);
});

test('shared bound is fixture-derived and the 24 serial orders attain one miss and two late minutes',()=>{
  scenario();const result=model.runCohortComparison(),b=result.shared_bound;
  assert.equal(b.required_bytes,75e9);assert.equal(b.available_bytes,60e9);assert.equal(b.upload_by_s,480);assert.equal(b.jointly_impossible,true);
  assert.deepEqual(b.last_vehicle_lateness_s,{A:120,D:360});assert.equal(b.minimum_lateness_s,120);
  // Independent serial permutation arithmetic: upload minutes and ready deadlines, no model helper.
  function permutations(xs){return xs.length?xs.flatMap((x,i)=>permutations(xs.filter((_,j)=>i!==j)).map(t=>[x,...t])):[[]];}
  const results=permutations(['A','B','C','D']).map(order=>{let t=0,late=0,miss=0;for(const id of order){t+={A:8,B:1,C:6,D:2}[id];const d=Math.max(0,t+2-{A:10,B:15,C:22,D:6}[id]);late+=d;miss+=Number(d>0);}return {order,late,miss};});
  assert.equal(results.length,24);assert.equal(Math.min(...results.map(x=>x.late)),2);assert.equal(Math.min(...results.map(x=>x.miss)),1);
  assert.deepEqual(results.filter(x=>x.late===2).map(x=>x.order),[['D','A','B','C']]);
});

test('stored evidence and scenario arrays refuse accessors before invoking them',()=>{
  const s=scenario(),vehicle=s.vehicles[0];let reads=0;
  Object.defineProperty(s.vehicles,'0',{get(){reads++;return vehicle;},enumerable:true});
  assert.throws(()=>run(s));assert.equal(reads,0);
  const r=run(scenario()),slot=r.intervals[0];
  Object.defineProperty(r.intervals,'0',{get(){reads++;return slot;},enumerable:true});
  assert.equal(verify(r).model_validity,'INVALID');assert.equal(reads,0);
});

test('capacity bound follows perturbed work and drops impossibility when demand fits',()=>{
  const s=scenario();s.vehicles[3].upload_bytes=7.5e9;
  let b=model.cohortBounds(s).shared_bound;assert.equal(b.required_bytes,67.5e9);assert.equal(b.available_bytes,60e9);
  assert.deepEqual(b.last_vehicle_lateness_s,{A:60,D:300});
  s.vehicles[0].upload_bytes=52.5e9;b=model.cohortBounds(s).shared_bound;
  assert.equal(b.required_bytes,60e9);assert.equal(b.jointly_impossible,false);assert.equal(b.minimum_lateness_s,0);
});
