import assert from 'node:assert/strict';
import {test} from 'node:test';
// Missing implementation is reported as a contract assertion during the first red run.
const model=await import('../src/model/depot-flow.js').catch(()=>({}));
const verifier=await import('../src/model/depot-flow-verify.js').catch(()=>({}));
test('default lesson computes all three literal schedules',()=>{
  assert.equal(typeof model.runFlowComparison,'function','comparison implementation is required');
  const r=model.runFlowComparison();
  assert.equal(r.comparison_eligible,true);
  assert.deepEqual(r.arms.map(a=>a.verification.metrics.ready_s),[{A:720,B:780},{A:780,B:240},{A:780,B:180}]);
  assert.deepEqual(r.arms.map(a=>a.verification.metrics.on_time),[1,2,2]);
  assert.deepEqual(r.arms.map(a=>a.verification.metrics.lateness_lower_bound_s),[480,0,0]);
});
test('literal counterexamples preserve tradeoffs and charging bottleneck',()=>{
  for(const [options,times,late] of [
    [{b_gb:15},[[720,840],[840,360],[840,240]],[540,60,0]],
    [{uplink_gbps:0.5},[[1320,1440],[1440,360],[1440,240]],[1560,600,540]],
    [{charger_kw:20},[[1080,780],[1080,240],[1080,180]],[660,180,180]],
    [{b_gb:45},[[720,1080],[1080,840],[1080,480]],[780,720,360]],
  ]){
    const r=model.runFlowComparison(options);assert.equal(r.comparison_eligible,true);
    assert.deepEqual(r.arms.map(a=>Object.values(a.verification.metrics.ready_s)),times);
    assert.deepEqual(r.arms.map(a=>a.verification.metrics.lateness_lower_bound_s),late);
  }
});
test('36 runs conserve work; historical 10 kWh fixture stays reproducible',()=>{
  for(const uplink_gbps of [0.5,1])for(const b_gb of [7.5,15,45])for(const charger_kw of [20,60]){
    const r=model.runFlowComparison({uplink_gbps,b_gb,charger_kw});
    assert.equal(r.comparison_eligible,true);assert.ok(r.scenario.horizon_s<=2100);
    for(const a of r.arms){assert.equal(a.verification.metrics.unfinished_due,0);assert.equal(a.verification.metrics.pending,0);}
  }
  const r=model.runFlowComparison({fixture:1});
  assert.deepEqual(r.arms.map(a=>a.verification.metrics.ready_s),[{A:720,B:780},{A:780,B:240},{A:780,B:180}]);
});
test('deadline equality, zero-work dependencies and horizon censoring',()=>{
  const s=model.flowScenario();s.vehicles[1].deadline_s=780;
  let r=model.simulateFlow(s,'nf_fifo');assert.equal(verifier.verifyFlow(r).metrics.on_time,2);
  s.vehicles=s.vehicles.map(v=>({...v,upload_bytes:0,energy_j:0,post_s:0,deadline_s:0}));
  r=model.simulateFlow(s,'nf_fifo');assert.equal(verifier.verifyFlow(r).metrics.on_time,2);
  const short=model.flowScenario();short.horizon_s=660;
  const v=verifier.verifyFlow(model.simulateFlow(short,'nf_fifo'));
  assert.equal(v.metrics.pending,1);assert.equal(v.metrics.unfinished_due,1);assert.equal(v.metrics.lateness_lower_bound_s,360);
  short.horizon_s=300;assert.equal(verifier.verifyFlow(model.simulateFlow(short,'nf_fifo')).metrics.unfinished_due,1);
});
test('individual bounds flag impossible deadlines without implying joint feasibility',()=>{
  const r=model.runFlowComparison({b_gb:45,charger_kw:20});
  assert.deepEqual(r.bounds.map(b=>b.earliest_s),[1080,480]);
  assert.deepEqual(r.bounds.map(b=>b.individually_impossible),[true,true]);
});
test('precision, overflow and cyclic prerequisites fail closed',()=>{
  for(const change of [s=>s.uplink_bytes_s=0.1,s=>s.vehicles[0].upload_bytes=Number.MAX_SAFE_INTEGER,s=>s.vehicles[0].post_s=-1,s=>s.dependencies.upload=['post'],s=>s.horizon_s=Infinity]){
    const s=model.flowScenario();change(s);assert.throws(()=>model.simulateFlow(s,'nf_fifo'));
  }
});
test('faulty allocations terminate at zero and mid-service; conservation cannot rescue a policy error',()=>{
  for(const at of [0,60])for(const bad of [()=>({A:-1}),()=>({A:Infinity}),()=>({A:125000001}),()=>({ghost:1}),()=>({}),()=>{throw Error('broken');}]){
    const s=model.flowScenario();s.vehicles[1].deadline_s=60;
    const r=model.simulateFlow(s,'nf_fifo',{propose:o=>o.time_s>=at?bad():{A:s.uplink_bytes_s}});
    assert.equal(r.policy_status,'policy_error');assert.equal(r.end_s,at);
    assert.ok(r.diagnostics.length);const v=verifier.verifyFlow(r);assert.equal(v.model_validity,'VALID');assert.equal(v.comparison_eligible,false);
  }
});
test('zero capacity is valid censored work; frozen current observations expose no future ledger',()=>{
  const s=model.flowScenario();s.uplink_bytes_s=0;s.charger_j_s=0;
  const v=verifier.verifyFlow(model.simulateFlow(s,'nf_fifo'));assert.equal(v.model_validity,'VALID');assert.equal(v.metrics.unfinished_due,2);
  let observed;
  model.simulateFlow(model.flowScenario(),'nf_fifo',{propose:o=>{observed=o;assert.equal(Object.hasOwn(o,'events'),false);assert.equal(Object.isFrozen(o),true);return Object.fromEntries(o.eligible.slice(0,1).map(v=>[v.id,o.uplink_bytes_s]));}});
  assert.ok(observed);
});
test('read-only verifier rejects forged service, readiness, completion inventory and totals',()=>{
  const original=model.simulateFlow(model.flowScenario(),'nf_fifo');const before=JSON.stringify(original);
  for(const mutate of [
    r=>r.intervals[0].upload.A++,
    r=>r.events.find(e=>e.type==='ready').time_s--,
    r=>r.events.push({...r.events.find(e=>e.type==='complete')}),
    r=>r.events.splice(r.events.findIndex(e=>e.type==='complete'),1),
    r=>r.totals.upload_bytes.A++,
    r=>r.intervals[0].charge.B=1,
  ]){const r=structuredClone(original);mutate(r);const v=verifier.verifyFlow(r);assert.equal(v.model_validity,'INVALID');assert.equal(v.comparison_eligible,false);}
  assert.equal(JSON.stringify(original),before);
});

test('a conserving trace cannot claim a different policy identity',()=>{
  const r=model.simulateFlow(model.flowScenario(),'nf_departure_deadline');r.rule='nf_fifo';
  assert.equal(verifier.verifyFlow(r).model_validity,'INVALID');
});

test('verifier refuses inherited object names as allocation recipients',()=>{
  for(const key of ['constructor','toString','__proto__']){
    const r=model.simulateFlow(model.flowScenario(),'nf_fifo');
    const interval=r.intervals.find(i=>Object.keys(i.charge).length===0);
    interval.charge=JSON.parse(`{"${key}":1}`);
    assert.equal(verifier.verifyFlow(r).model_validity,'INVALID',key);
  }
});

test('NF-01 scope exception cannot admit duplicated labels or labels in legacy modules',async()=>{
  const {labelScanText}=await import('../tools/check-dist.mjs');
  const {FLOW_TRUST}=await import('../src/model/depot-flow-contract.js');const labels=[FLOW_TRUST.scope];
  const source=`scope:'${labels[0]}'`;
  assert.equal(labelScanText(source,'src/model/depot-flow-contract.js',labels).includes(labels[0]),false);
  assert.equal(labelScanText(source+source,'src/model/depot-flow-contract.js',labels).includes(labels[0]),true);
  assert.equal(labelScanText(source,'src/instrument/summary.js',labels).includes(labels[0]),true);
  assert.equal(labelScanText(`label:'${labels[0]}'`,'src/model/depot-flow-contract.js',labels).includes(labels[0]),true);
});
