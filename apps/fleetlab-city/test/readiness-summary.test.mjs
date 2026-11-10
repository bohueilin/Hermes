import {test} from 'node:test';
import assert from 'node:assert/strict';
import {installFakeDom} from '../../../playground/fleetlab/test/helpers/fake-dom.mjs';
import {decorateDepotPipes} from '../hosted/brand.mjs';
import {outcomeNodes,trustNodes} from '../../../playground/fleetlab/src/ui/depot-lab-view.js';
import {runDepotJob} from '../../../playground/fleetlab/src/runtime/depot-lab-job.js';
import {createDepotRun,stepDepotRun} from '../../../playground/fleetlab/src/model/depot-lab/engine.js';
import {verifyDepotRun} from '../../../playground/fleetlab/src/model/depot-lab-verify/verify.js';
import {compareDepotRuns} from '../../../playground/fleetlab/src/model/depot-lab/compare.js';
import {preset} from '../../../playground/fleetlab/src/model/depot-lab/presets.js';
import {HONESTY} from '../../../playground/fleetlab/src/model/depot-lab/registry.js';

function run(id){
 const p=preset(id);
 const r=runDepotJob({type:'run',id:'summary-test',generation:1,arms:{baseline:JSON.stringify(p.baseline),candidate:JSON.stringify(p.candidate)}},{createDepotRun,stepDepotRun,verifyDepotRun,compareDepotRuns});
 assert.equal(r.type,'result');assert.equal(r.envelopes.baseline.status,'VERIFIED');assert.equal(r.envelopes.candidate.status,'VERIFIED');return r;
}
const paired=run('B'),nondefault=run('D');
const state=result=>({status:'verified',result,history:[],pending:null});
function mount(result){
 const intro=document.createElement('section');intro.className='depot-intro';document.body.appendChild(intro);
 const heading=document.createElement('h1');heading.textContent='What holds a car in the depot?';intro.appendChild(heading);
 const lead=document.createElement('p');lead.className='lead';lead.textContent='Change the depot, follow the work, and see what finishes and what still waits.';intro.appendChild(lead);
 const honesty=document.createElement('div');honesty.className='honesty';for(const text of HONESTY){const p=document.createElement('p');p.textContent=text;honesty.appendChild(p);}intro.appendChild(honesty);
 const trust=document.createElement('dl');trust.id='trust';trust.replaceChildren(...trustNodes(state(result)));intro.appendChild(trust);
 const outcome=document.createElement('div');outcome.id='outcome';outcome.replaceChildren(...outcomeNodes(state(result)));document.body.appendChild(outcome);
 return {intro,heading,lead,honesty,trust,outcome};
}
const rows=outcome=>outcome.querySelectorAll('tr[data-component]');
const exactRows=outcome=>new Map(rows(outcome).map(row=>[row.getAttribute('data-component'),row.textContent]));

test('Readiness leads with the question and keeps all honesty and trust text after decoration',()=>{
 const restore=installFakeDom();try{
  const x=mount(paired),honesty=x.honesty.textContent,trust=x.trust.textContent;
  decorateDepotPipes(document);decorateDepotPipes(document);
  assert.ok(x.intro.firstChild===x.heading);assert.ok(x.heading.nextSibling===x.lead);
  assert.ok(x.lead.nextSibling===x.intro.querySelector('.depot-readiness-context'));
  assert.match(x.lead.nextSibling.firstChild.textContent,/Simulation only.*no real-fleet claim or deployment permission/);
  assert.equal(x.honesty.textContent,honesty);assert.equal(x.trust.textContent,trust);
 }finally{restore();}
});

test('default comparison promotes its existing narrative and preserves all 3 changed and 14 equal values',()=>{
 const restore=installFakeDom();try{
  const {outcome}=mount(paired),before=exactRows(outcome),narrative=outcome.querySelectorAll('h3').find(n=>n.textContent==='What changed');
  decorateDepotPipes(document);decorateDepotPipes(document);
  const overview=outcome.querySelector('.depot-result-overview'),details=outcome.querySelector('details');
  assert.ok(overview);assert.ok(outcome.children[1]===overview);assert.ok(narrative.parentNode===overview);
  assert.match(overview.textContent,/Better in the candidate, 3 of 17/);
  assert.match(details.querySelector('summary').textContent,/14 equal components/);
  assert.equal(details.hasAttribute('open'),false);assert.equal(details.querySelectorAll('tr[data-component]').length,14);
  assert.equal(rows(outcome).filter(row=>!row.closest('details')).length,3);
  assert.deepEqual(exactRows(outcome),before);assert.equal(outcome.querySelectorAll('.depot-result-overview').length,1);
  assert.deepEqual(details.querySelectorAll('thead th').map(n=>n.textContent),['Component','Direction','Baseline','Candidate','Change','Relation']);
 }finally{restore();}
});

test('nondefault reruns rebuild the summary and preserve every current component',()=>{
 const restore=installFakeDom();try{
  const {outcome}=mount(paired);decorateDepotPipes(document);
  outcome.replaceChildren(...outcomeNodes(state(nondefault)));const before=exactRows(outcome);
  decorateDepotPipes(document);decorateDepotPipes(document);
  assert.deepEqual(exactRows(outcome),before);assert.equal(outcome.querySelectorAll('.depot-result-overview').length,1);
  assert.match(outcome.querySelector('.depot-result-overview').textContent,/No component is better/);
  assert.match(outcome.querySelector('details summary').textContent,/15 equal components/);
  assert.equal(outcome.querySelector('table').parentNode.hidden,true);
 }finally{restore();}
});

test('unavailable relations remain visible and are not presented as changed or equal',()=>{
 const restore=installFakeDom();try{
  // A supported presentation fixture: a verified pair with unavailable comparison values.
  const unknown=structuredClone(paired),component=unknown.comparison.components.find(x=>x.relation==='better');
  unknown.comparison.classification='NOT_AVAILABLE';component.candidate=null;component.delta=null;component.relation=null;
  const {outcome}=mount(unknown),before=exactRows(outcome);decorateDepotPipes(document);
  const overview=outcome.querySelector('.depot-result-overview'),row=outcome.querySelector(`tr[data-component="${component.id}"]`);
  assert.ok(overview);assert.ok(overview.textContent.trim());assert.match(overview.textContent,/NOT_AVAILABLE/);
  assert.ok(!row.closest('details'));assert.match(row.textContent,/Not available/);
  assert.doesNotMatch(row.closest('table').querySelector('caption').textContent,/Changed/i);
  assert.deepEqual(exactRows(outcome),before);assert.equal(outcome.querySelector('details').querySelectorAll('tr[data-component]').length,14);
 }finally{restore();}
});

test('baseline-only results have a nonempty summary and retain all baseline values without comparison labels',()=>{
 const restore=installFakeDom();try{
  const baseline={...paired,envelopes:{baseline:paired.envelopes.baseline,candidate:null},comparison:null};
  const {outcome}=mount(baseline),before=exactRows(outcome);decorateDepotPipes(document);
  assert.ok(outcome.querySelector('.depot-result-overview'));assert.match(outcome.querySelector('.depot-result-overview').textContent,/No comparison: this run has a baseline only/);
  assert.ok(!outcome.querySelector('details'));assert.deepEqual(exactRows(outcome),before);
  assert.match(outcome.querySelector('caption').textContent,/Baseline/);assert.doesNotMatch(outcome.querySelector('caption').textContent,/Changed/);
 }finally{restore();}
});
