import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { requestGate } from '../web/view-model.mjs';

// Exercise the actual two UI handlers with deferred network responses. The seam
// excludes page bootstrapping, which requires a browser and the full city pack.
const app = readFileSync(new URL('../web/app.mjs', import.meta.url), 'utf8');
const qualification = readFileSync(new URL('../web/qualification.mjs', import.meta.url), 'utf8');
const layer = app.slice(app.indexOf('async function changeMask('), app.indexOf("document.querySelector('.brand')"));
const version = qualification.slice(qualification.indexOf('  async function choose('), qualification.indexOf("  $('candidate-map').disabled=false"));
function harness() {
  const pending = [];
  const readData = path => new Promise((resolve,reject)=>pending.push({path,resolve,reject}));
  const build = new Function('readData','atlasGate',`
    let atlasVersion='recorded', roads={}, mask='support';
    const ui=new Map(); const $=id=>{if(!ui.has(id))ui.set(id,{textContent:'',setAttribute(){}});return ui.get(id);};
    const document={querySelectorAll:()=>[]}; const catalog={scenario_points:[]};
    const observed={version:'recorded',roads:'recorded',mask:'support',errors:[]};
    const map={setRoads:r=>observed.roads=r.id,setMask:m=>observed.mask=m,setScenario(){}};
    const notice=e=>observed.errors.push(e);
    const setVersion=(v,r)=>{atlasVersion=v;observed.version=v;map.setRoads(r);};
    ${layer}\n${version}
    return {changeMask,choose,observed};`);
  return {...build(readData,requestGate()),pending};
}
test('old recorded source roads cannot overwrite a newer candidate map', async()=>{
  const h=harness();const old=h.changeMask('source');const next=h.choose('candidate');
  h.pending[1].resolve({id:'candidate'});await next;
  h.pending[0].resolve({id:'recorded-source'});await old;
  assert.equal(h.observed.version,'candidate');assert.equal(h.observed.roads,'candidate');
});
test('new routing-support selection cancels a pending source layer', async()=>{
  const h=harness();const old=h.changeMask('source');await h.changeMask('support');
  h.pending[0].resolve({id:'recorded-source'});await old;
  assert.equal(h.observed.mask,'support');assert.equal(h.observed.roads,'recorded');
});
test('last map-version selection wins regardless of response order', async()=>{
  for(const order of [[0,1],[1,0]]){
    const h=harness();const a=h.choose('candidate');const b=h.choose('recorded');
    for(const n of order){h.pending[n].resolve({id:n===0?'candidate':'recorded'});await(n===0?a:b);}
    assert.equal(h.observed.version,'recorded');assert.equal(h.observed.roads,'recorded');
  }
});
test('a stale layer failure cannot replace the current view with an error', async()=>{
  const h=harness();const old=h.changeMask('source');const next=h.choose('candidate');
  h.pending[1].resolve({id:'candidate'});await next;h.pending[0].reject(new Error('stale'));await old;
  assert.deepEqual(h.observed.errors,[]);
});
