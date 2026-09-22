import test from 'node:test';
import assert from 'node:assert/strict';
import {freezeBayExperiment,advancedOperationsDemoConfig,validateBayPair} from '../src/model/bay-experiment-contract.js';
import {bayExperimentSteps} from '../src/model/bay-experiment-contract.js';
import {simulateBayAreaOperations} from '../src/model/bay-operations.js';
const run=frozen=>{const it=bayExperimentSteps(frozen);for(;;){const n=it.next();if(n.done)return n.value;}};
test('frozen treatment changes only the named assumption; tuning/evaluation sets cannot overlap',()=>{
  for(const [kind,treatment] of [['charging','charging_redistribution'],['charging','charging_deadlines'],['resources','resource_freshness'],['airport','airport_forecast']]){
    const c=advancedOperationsDemoConfig(kind),original=structuredClone(c),f=freezeBayExperiment(c,{treatment});
    assert.equal(Object.isFrozen(f.spec.baseline),true);assert.deepEqual(c,original);
    const [group,key]=f.spec.axis.path.split('.'),candidate=structuredClone(f.spec.candidate);candidate[group][key]=f.spec.axis.baseline;assert.deepEqual(candidate,f.spec.baseline);
    assert.throws(()=>freezeBayExperiment(c,{treatment,seeds:[42],tuning_seeds:[42]}),/disjoint/);
  }
});
test('one seed is descriptive only and null treatments are exactly equal',()=>{
  const f=freezeBayExperiment(advancedOperationsDemoConfig('charging'),{treatment:'charging_redistribution',seeds:[1001],null_treatment:true});
  const r=run(f);assert.equal(r.validity,'VALID');assert.equal(r.descriptive,true);assert.equal(r.analysis,null);
  assert.deepEqual(r.per_seed[0].baseline,r.per_seed[0].candidate);assert.equal(r.evidence_status,'NOT_EVIDENCE');
});
test('paired held-out runs are reproducible and report a practical margin and independent guards',()=>{
  const f=freezeBayExperiment(advancedOperationsDemoConfig('charging'),{treatment:'charging_redistribution',seeds:[1001,1002,1003],resamples:1000,null_treatment:true});
  const r=run(f);assert.equal(r.validity,'VALID');assert.deepEqual(run(f),r);
  assert.deepEqual(r.analysis.primary.paired_deltas,[0,0,0]);assert.equal(r.analysis.primary.ci_low,0);assert.equal(r.analysis.primary.ci_high,0);
  assert.equal(r.analysis.guardrail_statuses.length,f.spec.guardrails.length);
  assert.ok(r.analysis.guardrail_statuses.every(g=>g.status==='WITHIN'));
});
test('wrong producer, version, population, availability and altered demand fail closed',()=>{
  const f=freezeBayExperiment(advancedOperationsDemoConfig('charging'),{treatment:'charging_redistribution',seeds:[1001]});
  const a=simulateBayAreaOperations({...f.spec.baseline,seed:1001},{capture:false}),b=simulateBayAreaOperations({...f.spec.candidate,seed:1001},{capture:false});
  assert.equal(validateBayPair(f.spec,a,b,1001).ok,true);
  for(const change of [r=>r.version='street-lab',r=>r.extensions.metric_version='future',r=>r.metrics.total_requests++,r=>r.metrics.final_energy_kwh=null,r=>r.requests[0].created_minute++,r=>r.extensions.validity='INVALID_SIMULATION',r=>r.config.site_power_kw++]){
    const bad=structuredClone(b);change(bad);assert.equal(validateBayPair(f.spec,a,bad,1001).ok,false);
  }
});
test('missing denominator is unavailable and never receives an optimistic comparison',()=>{
  const c=advancedOperationsDemoConfig('charging');c.requests_per_hour=0;
  const r=run(freezeBayExperiment(c,{treatment:'charging_redistribution',seeds:[1001,1002]}));
  assert.equal(r.validity,'INVALID_EXPERIMENT');assert.equal(r.analysis,null);assert.match(r.reason,/unavailable/);
});
test('tampered frozen spec and oversized runs reject before simulation',()=>{
  const f=freezeBayExperiment(advancedOperationsDemoConfig('charging'),{treatment:'charging_redistribution'});
  const bad=structuredClone(f);bad.spec.candidate.fleet_size++;
  assert.throws(()=>run(bad),/frozen|digest/);
  assert.throws(()=>freezeBayExperiment(f.spec.baseline,{treatment:'charging_redistribution',seeds:Array(41).fill(1)}));
});
