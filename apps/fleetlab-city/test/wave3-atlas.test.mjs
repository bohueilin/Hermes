import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as brand from '../hosted/brand.mjs';
const road=(status,coordinates)=>({type:'Feature',properties:{status},geometry:{type:'LineString',coordinates}});
const sample={type:'FeatureCollection',features:[road('included',[[-122.5,37.7],[-122.4,37.8]]),road('unsupported',[[-122.45,37.75],[-122.42,37.76]]),road('excluded',[[-123,38],[-124,39]])]};
test('coverage projection distinguishes eligible populations and does not let excluded geometry shrink the eligible map',()=>{
 assert.equal(typeof brand.atlasCoveragePaths,'function');
 const a=brand.atlasCoveragePaths(sample),b=brand.atlasCoveragePaths({...sample,features:sample.features.slice(0,2)});
 assert.deepEqual(a.counts,{included:1,unsupported:1,excluded:1});
 assert.deepEqual(a.paths,b.paths);assert.match(a.paths.included,/^M/);assert.match(a.paths.unsupported,/^M/);
 assert.notEqual(a.paths.included,a.paths.unsupported);
 assert.ok(!JSON.stringify(a.paths).includes('NaN'));
 assert.deepEqual(sample.features[0].geometry.coordinates,[[-122.5,37.7],[-122.4,37.8]],'source data is not transformed in place');
});
test('coverage projection rejects malformed source geometry and unknown statuses instead of silently treating them as supported',()=>{
 assert.equal(typeof brand.atlasCoveragePaths,'function');
 for(const f of [road('unknown',[[0,0],[1,1]]),road('included',[[NaN,0],[1,1]]),{properties:{status:'included'},geometry:{type:'Polygon',coordinates:[]}}])assert.throws(()=>brand.atlasCoveragePaths({type:'FeatureCollection',features:[f]}),/coverage|geometry|status/i);
 assert.throws(()=>brand.atlasCoveragePaths({type:'FeatureCollection',features:[]}),/coverage/i);
});
test('coverage data is accepted only after exact bytes and SHA match the snapshot catalogue',async()=>{
 assert.equal(typeof brand.verifyAtlasBytes,'function');
 const bytes=new TextEncoder().encode(JSON.stringify(sample));const record={bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};
 assert.deepEqual(await brand.verifyAtlasBytes(bytes.buffer,record),sample);
 await assert.rejects(()=>brand.verifyAtlasBytes(bytes.buffer,{...record,bytes:record.bytes+1}),/size/i);
 await assert.rejects(()=>brand.verifyAtlasBytes(bytes.buffer,{...record,sha256:'0'.repeat(64)}),/digest/i);
 await assert.rejects(()=>brand.verifyAtlasBytes(bytes.buffer,undefined),/catalogue/i);
});

test('hosted atlas toggles checked coverage, follows version switches and remains idempotent',async()=>{
 const {installFakeDom}=await import('../../../playground/fleetlab/test/helpers/fake-dom.mjs');
 const restore=installFakeDom();const priorObserver=globalThis.MutationObserver;let notify;
 globalThis.MutationObserver=class{constructor(fn){notify=fn;}observe(){}disconnect(){}};
 try{
  Object.defineProperty(document,'baseURI',{value:'https://example.test/city-explorer/releases/test/',configurable:true});
  const el=(tag,attrs={},text='')=>{const n=document.createElement(tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);n.textContent=text;return n;};
  const atlas=el('section',{id:'atlas-view'}),bar=el('div',{class:'atlas-version-bar'}),stage=el('div',{class:'atlas-map-stage'});
  for(const id of ['recorded-map','candidate-map','temporal-map'])bar.appendChild(el('button',{id,'aria-pressed':String(id==='recorded-map')}));atlas.append(bar,stage);document.body.appendChild(atlas);
  const values={'data/source-roads.geo.json':sample,'data/candidate-roads.geo.json':{...sample,features:sample.features.slice(0,1)},'data/temporal-summary.json':{report:{timed_turn_count:175,timed_access_count:32,before:{unsupported_fraction:.0132},after:{unsupported_fraction:.0099}}}};
  const records=Object.fromEntries(Object.entries(values).map(([k,v])=>{const bytes=new TextEncoder().encode(JSON.stringify(v));return[k,{bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')}];}));
  document.defaultView.fetch=async url=>{const path=new URL(url).pathname.split('/test/')[1];return{ok:true,json:async()=>({files:records}),arrayBuffer:async()=>new TextEncoder().encode(JSON.stringify(values[path])).buffer};};
  brand.decorateAtlasCoverage(document);brand.decorateAtlasCoverage(document);
  const button=atlas.querySelector('[aria-controls="atlas-coverage-detail"]');assert.ok(button);assert.equal(atlas.querySelectorAll('.atlas-scope-badge').length,1);
  button.click();await new Promise(r=>setTimeout(r,30));assert.equal(stage.hidden,true);assert.equal(atlas.querySelectorAll('svg path').length,2);assert.match(atlas.querySelector('[role="status"]').textContent,/SF v1: 1 unsupported/);
  document.getElementById('candidate-map').setAttribute('aria-pressed','true');notify([{type:'attributes'}]);await new Promise(r=>setTimeout(r,30));assert.match(atlas.querySelector('[role="status"]').textContent,/SF v2: 0 unsupported/);
  assert.match(atlas.querySelector('.atlas-version-context').textContent,/175 timed turn rules, 32 way-access schedules/);
  button.click();assert.equal(stage.hidden,false);assert.equal(atlas.querySelector('.atlas-coverage-detail').hidden,true);
 }finally{globalThis.MutationObserver=priorObserver;restore();}
});
