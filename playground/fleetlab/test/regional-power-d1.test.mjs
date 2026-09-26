import test from 'node:test';
import assert from 'node:assert/strict';
import {installFakeDom} from './helpers/fake-dom.mjs';
import * as view from '../src/ui/regional-power-view.js';
import {regionalPowerDemoConfig} from '../src/model/regional-power.js';
import {bayExperimentSteps,freezeBayExperiment,bayModelVersion} from '../src/model/bay-experiment-contract.js';
import {number,signed} from '../src/ui/format.js';

const options={treatment:'charging_deadlines',seeds:[1001],tuning_seeds:[42,43,44],margin:.02,resamples:1000,null_treatment:false};
const resultFor=condition=>{const steps=bayExperimentSteps(freezeBayExperiment(regionalPowerDemoConfig(condition),{...options,seeds:Array.from({length:12},(_,i)=>1001+i),resamples:2000}));let next;do{next=steps.next();}while(!next.done);return next.value;};
const withDom=fn=>{const restore=installFakeDom();try{return fn();}finally{restore();}};
const fixture=(outcome='UNCHANGED',recommendation='NO_RECOMMENDATION',primary={mean_delta:0,ci_low:-.01,ci_high:.01},guardrails=[])=>({
  ...freezeBayExperiment(regionalPowerDemoConfig(),options),replications:12,validity:'VALID',descriptive:false,reason:null,per_seed:[],limitations:[],
  analysis:{validity:'VALID',outcome,recommendation,primary:{metric:'completion_fraction',baseline_mean:.4,candidate_mean:.4,...primary},guardrail_statuses:guardrails},
});
const render=r=>{assert.equal(typeof view.comparisonView,'function','comparison rendering is independently inspectable');return view.comparisonView(r);};
const summary=r=>render(r).querySelector('.regional-verdict').textContent;
const rail=(metric,status,harm,max_harm)=>({metric,status,harm,max_harm});

test('Austin exposes its composite model identity, internal share slot and focusable heading without running',()=>withDom(()=>{
  const panel=view.createRegionalPowerPanel();try{
    const header=panel.element.querySelector('p.model-identity');assert.ok(header,'model identity is visible before running');
    assert.ok(header.textContent.includes(bayModelVersion(panel.getState().config)));
    assert.match(header.textContent,/Fictional Austin-inspired schematic \(not imported roads\)/);
    assert.match(header.textContent,/Results are not interchangeable with other FleetLab models\./);
    assert.equal(panel.heading,panel.element.querySelector('h2'));assert.equal(panel.heading.getAttribute('tabindex'),'-1');
    assert.ok(panel.element.contains(panel.shareSlot));assert.equal(panel.getState().result,null);
  }finally{panel.destroy();}
}));

test('Austin header keeps the submitted composite version marked stale after editing settings',async()=>{
  const restore=installFakeDom(),panel=view.createRegionalPowerPanel();try{
    const result=await panel.run(),header=panel.element.querySelector('p.model-identity');assert.ok(header);
    assert.ok(header.textContent.includes(result.version));assert.match(result.version,/region-package-1\.0\.0/);
    const field=panel.element.querySelector('[aria-label="Regional nominal site power (kW)"]');field.value='90';field.dispatchEvent(new Event('input'));
    assert.ok(header.textContent.includes(result.version));assert.match(header.textContent,/stale/i);
  }finally{panel.destroy();restore();}
});

test('computed default Austin comparison displays analysis values as points and identifies the unfinished-visit HOLD',()=>withDom(()=>{
  const result=resultFor('moderate'),p=result.analysis.primary,root=render(result),text=root.querySelector('.regional-verdict').textContent;
  assert.match(text,/Deadline priority changed completion by \+0\.19 percentage points/);
  assert.ok(text.includes(`95% interval ${signed(p.ci_low*100,2)} to ${signed(p.ci_high*100,2)}`));
  assert.ok(text.includes(`inside the ±${number(result.spec.margin*100,2)}-point equivalence band → ${result.analysis.outcome}`));
  const g=result.analysis.guardrail_statuses.find(g=>g.metric==='unfinished_visits');
  assert.ok(text.includes(`Unfinished depot visits rose by ${number(g.harm,2)} per seed; allowed 0 → HOLD.`));
  const exact=root.querySelector('.regional-exact-values');assert.ok(exact);assert.match(exact.querySelector('summary').textContent,/Exact/);
  assert.equal(JSON.parse(exact.querySelector('pre').textContent).analysis.primary.ci_high,p.ci_high);
}));

for(const [outcome,recommendation,primary,relation,next] of [
  ['IMPROVED','ADVANCE_TO_NEXT_TEST',{mean_delta:.04,ci_low:.03,ci_high:.05},'above the +2.00-point improvement margin','Advance to the next simulation test'],
  ['REGRESSED','HOLD',{mean_delta:-.04,ci_low:-.05,ci_high:-.03},'below the -2.00-point regression margin','Completion regressed'],
  ['UNCHANGED','NO_RECOMMENDATION',{mean_delta:0,ci_low:-.01,ci_high:.01},'inside the ±2.00-point equivalence band','No change is recommended'],
  ['INCONCLUSIVE','RUN_MORE_EXPERIMENTS',{mean_delta:.02,ci_low:.01,ci_high:.03},'crossing a practical-margin boundary','Run more experiments'],
])test(`Austin explains ${outcome} and ${recommendation} from the supplied analysis`,()=>withDom(()=>{
  const text=summary(fixture(outcome,recommendation,primary));assert.ok(text.includes(`${relation} → ${outcome}.`),text);assert.ok(text.includes(next),text);assert.ok(text.includes(recommendation),text);
}));

test('Austin lists every regressed guardrail and does not turn unavailable harm into zero',()=>withDom(()=>{
  const text=summary(fixture('UNCHANGED','HOLD',undefined,[rail('unfinished_visits','REGRESSED',.33,0),rail('terminal_energy_kwh','REGRESSED',5.39,5),rail('max_request_wait_min','NOT_EVALUABLE',null,5)]));
  assert.match(text,/Unfinished depot visits rose by 0\.33 per seed; allowed 0 → HOLD\./);
  assert.match(text,/Terminal energy fell by 5\.39 kWh; allowed 5 → HOLD\./);
  assert.match(text,/Maximum request wait: not evaluable/);assert.doesNotMatch(text,/Maximum request wait[^.]*\b0\b/);
}));

test('computed outage comparison describes lost terminal energy as a fall with its declared allowance',()=>withDom(()=>{
  const result=resultFor('outage'),g=result.analysis.guardrail_statuses.find(g=>g.metric==='terminal_energy_kwh'),text=summary(result);
  assert.equal(g.status,'REGRESSED');assert.ok(text.includes(`Terminal energy fell by ${number(g.harm,2)} kWh; allowed ${number(g.max_harm)} → HOLD.`));
}));

for(const [name,lo,hi,outcome,recommendation,expected] of [
  ['inclusive edges',-.02,.02,'UNCHANGED','NO_RECOMMENDATION','95% interval -2.00 to +2.00'],
  ['just above margin',.020000001,.03,'IMPROVED','ADVANCE_TO_NEXT_TEST','95% interval +2.0000001 to +3'],
  ['just below negative margin',-.03,-.020000001,'REGRESSED','HOLD','to -2.0000001'],
  ['adjacent double above margin',.020000000000000004,.03,'IMPROVED','ADVANCE_TO_NEXT_TEST','+2.0000000000000004'],
])test(`Austin threshold formatting preserves ${name}`,()=>withDom(()=>{
  const text=summary(fixture(outcome,recommendation,{mean_delta:lo,ci_low:lo,ci_high:hi}));assert.ok(text.includes(expected),text);assert.ok(text.includes(`→ ${outcome}.`));
}));

for(const [harm,status,recommendation,expected] of [
  [5,'WITHIN','NO_RECOMMENDATION','fell by 5.00 kWh; allowed 5 → within allowance'],
  [5.000000001,'REGRESSED','HOLD','fell by 5.000000001 kWh; allowed 5 → HOLD'],
  [0.0000000001,'REGRESSED','HOLD','rose by 0.0000000001 per seed; allowed 0 → HOLD'],
])test(`Austin preserves strict guardrail allowance at harm ${harm}`,()=>withDom(()=>{
  const metric=harm<1?'unfinished_visits':'terminal_energy_kwh',max=harm<1?0:5;
  assert.ok(summary(fixture('UNCHANGED',recommendation,undefined,[rail(metric,status,harm,max)])).includes(expected));
}));

test('Austin guardrail verbs reverse when the declared direction changes',()=>withDom(()=>{
  const result=fixture('UNCHANGED','HOLD',undefined,[rail('terminal_energy_kwh','REGRESSED',6,5)]);
  result.spec=structuredClone(result.spec);result.spec.guardrails.find(g=>g.metric==='terminal_energy_kwh').direction='lower_is_better';
  assert.match(summary(result),/Terminal energy rose by 6\.00 kWh/);
}));

test('Austin discloses submitted resource settings without substituting defaults',()=>withDom(()=>{
  const result=fixture();result.spec=structuredClone(result.spec);Object.assign(result.spec.baseline.resources,{delay_min:7,outage_ports:3,outage_start_min:15,outage_end_min:135});
  assert.match(render(result).textContent,/7-minute resource-observation delay and 3 charging port\(s\) per depot out from minute 15 to 135/);
}));

test('Austin descriptive, invalid and same-policy states retain their explanations',()=>withDom(()=>{
  const descriptive=fixture();descriptive.analysis=null;descriptive.descriptive=true;descriptive.spec=structuredClone(descriptive.spec);descriptive.spec.null_treatment=true;
  const first=render(descriptive);assert.match(first.textContent,/One seed is descriptive; no interval or recommendation\./);assert.match(first.textContent,/Same-policy controls retain the baseline in both arms\./);assert.equal(first.querySelector('.regional-verdict'),null);
  const invalid={...fixture(),validity:'INVALID_EXPERIMENT',analysis:null,reason:'Required metric or population unavailable; no comparison or recommendation.'};
  const second=render(invalid);assert.match(second.querySelector('[role="alert"]').textContent,/Required metric or population unavailable/);assert.equal(second.querySelector('.regional-verdict'),null);
}));

test('a paired same-policy control does not attribute its result to deadline priority',()=>withDom(()=>{
  const result=fixture();result.spec=structuredClone(result.spec);result.spec.null_treatment=true;
  const text=summary(result);assert.match(text,/Same-policy control changed completion/);assert.doesNotMatch(text,/Deadline priority changed/);
}));
