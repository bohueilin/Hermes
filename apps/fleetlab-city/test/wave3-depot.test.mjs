import {test} from 'node:test';
import assert from 'node:assert/strict';
import {installFakeDom} from '../../../playground/fleetlab/test/helpers/fake-dom.mjs';
import * as brand from '../hosted/brand.mjs';
const cfg={radio:300,client:100,down:200,up:100,read:1000,cache:'cold',capacity:20};
function field(key,value){const f=document.createElement('div');f.className='field';const t=document.createElement('span');t.className='technical-only';t.textContent=`${key}: ${JSON.stringify(value)}`;f.appendChild(t);document.body.appendChild(f);return t;}
test('directional calculator keeps cache delivery on radio and uploads on WAN up',()=>{
 assert.equal(typeof brand.depotPipeRates,'function');
 const cold=brand.depotPipeRates(cfg,{downloads:2,uploads:1,warm:false});
 assert.equal(cold.download,100);assert.equal(cold.upload,100);
 const warm=brand.depotPipeRates({...cfg,down:10},{downloads:2,uploads:1,warm:true});
 assert.equal(warm.download,100);assert.equal(warm.upload,100);
 assert.equal(brand.depotPipeRates({...cfg,cache:'off',down:10},{downloads:2,uploads:1,warm:true}).download,5);
 assert.equal(brand.depotPipeRates(cfg,{downloads:4,uploads:2,warm:true}).download,50);
});
test('accepted Readiness values override illustrative defaults, including invalid typed edits',()=>{
 const restore=installFakeDom();try{
 assert.equal(typeof brand.readDepotPipeConfig,'function');
 const accepted=field('network.wan_up_bytes_per_tick (bytes/s)',6250000);
 const invalid=document.createElement('input');invalid.value='-999';invalid.setAttribute('aria-invalid','true');accepted.parentNode.appendChild(invalid);
 field('network.cache.state','off');field('network.cache.capacity_bytes (bytes)',0);
 assert.equal(brand.readDepotPipeConfig(document).up,50);
 assert.equal(brand.readDepotPipeConfig(document).cache,'off');
 assert.equal(brand.readDepotPipeConfig(document).capacity,0);
 }finally{restore();}
});
test('shared explorer binds controls once and updates rates without model mutation',()=>{
 const restore=installFakeDom();try{
 assert.equal(typeof brand.DepotPipe,'function');const p=brand.DepotPipe(document,cfg);document.body.appendChild(p);
 assert.match(p.textContent,/Concept illustration · not simulation output/);
 assert.match(p.textContent,/WAN down/);assert.match(p.textContent,/WAN up/);
 const select=p.querySelector('select');select.value='warm';select.dispatchEvent(new Event('change',{bubbles:true}));
 assert.match(p.textContent,/Warm cache delivery/);
 const n=p.querySelector('input');n.value='6';n.dispatchEvent(new Event('change',{bubbles:true}));
 assert.match(p.querySelector('[data-pipe-rates]').textContent,/42\.9/);
 }finally{restore();}
});
test('Readiness decoration is idempotent and follows accepted edited rates and exact current results',()=>{
 const restore=installFakeDom();try{
 const intro=document.createElement('section');intro.className='depot-intro';document.body.appendChild(intro);
 const up=field('network.wan_up_bytes_per_tick (bytes/s)',12500000);field('visits (count)',24);
 const outcome=document.createElement('div');outcome.id='outcome';document.body.appendChild(outcome);
 const state=document.createElement('div');state.setAttribute('data-state','verified');outcome.appendChild(state);
 const tile=document.createElement('article');tile.setAttribute('data-term','visit.turnaround_observed_s');outcome.appendChild(tile);
 const row=document.createElement('p');row.setAttribute('data-arm','baseline');tile.appendChild(row);
 const exact=document.createElement('span');exact.className='technical-only';exact.textContent='245194 s';row.appendChild(exact);
 brand.decorateDepotPipes(document);brand.decorateDepotPipes(document);
 assert.equal(intro.querySelectorAll('.depot-pipe').length,1);assert.equal(row.querySelectorAll('.depot-visit-mean').length,1);
 assert.match(row.textContent,/10216\.4 s/);assert.match(row.textContent,/2 h 50 min/);assert.match(intro.textContent,/WAN up 100 Mbps/);
 up.textContent='network.wan_up_bytes_per_tick (bytes/s): 6250000';brand.decorateDepotPipes(document);
 assert.match(intro.textContent,/WAN up 50 Mbps/);
 outcome.replaceChildren();brand.decorateDepotPipes(document);assert.equal(outcome.querySelector('.depot-visit-mean'),null);
 }finally{restore();}
});
test('visible topology joins cache delivery to the same radio and vehicle endpoint with bounded usage',()=>{
 const restore=installFakeDom();try{
 const p=brand.DepotPipe(document,cfg);document.body.appendChild(p);
 assert.ok(p.querySelector('[data-path="warm-delivery"] [data-resource="radio"]'));
 assert.ok(p.querySelector('[data-path="warm-delivery"] [data-resource="vehicle"]'));
 assert.ok(p.querySelector('[data-path="cache-fill"] [data-resource="cache"]'));
 assert.equal(p.querySelector('[data-path="warm-delivery"] [data-resource="wan-down"]'),null);
 const meters=p.querySelectorAll('[role="meter"]');assert.equal(meters.length,4);
 for(const m of meters)assert.ok(Number(m.getAttribute('aria-valuenow'))<=Number(m.getAttribute('aria-valuemax')));
 assert.match(p.textContent,/Unused radio: 0\.0 Mbps/);
 assert.equal(Number(meters[0].getAttribute('aria-valuenow')),Number(meters[1].getAttribute('aria-valuenow'))+Number(meters[2].getAttribute('aria-valuenow')));
 const doubled=brand.DepotPipe(document,{...cfg,radio:600,cache:'off',capacity:0,up:50});
 const original=brand.DepotPipe(document,{...cfg,radio:300,cache:'off',capacity:0,up:50});
 assert.equal(original.querySelector('[data-pipe-rates]').textContent,doubled.querySelector('[data-pipe-rates]').textContent);
 assert.match(original.textContent,/Unused radio: 50\.0 Mbps/);assert.match(doubled.textContent,/Unused radio: 350\.0 Mbps/);
 const off=brand.DepotPipe(document,{...cfg,cache:'off',capacity:0,up:50});document.body.appendChild(off);
 assert.match(off.textContent,/No enabled cache/);
 assert.equal(off.querySelector('option[value="warm"]').disabled,true);
 }finally{restore();}
});
test('real Readiness controls expose unquoted cache state and displayed candidate values',async()=>{
 const {mountSetup}=await import('../../../playground/fleetlab/src/ui/depot-lab-controls.js');
 const {createDepotSession}=await import('../../../playground/fleetlab/src/runtime/depot-lab-session.js');
 const restore=installFakeDom();let ui;try{
 for(const [tag,id]of [['div','questions'],['select','preset'],['p','preset-regime'],['div','counters'],['div','setup']]){const n=document.createElement(tag);n.id=id;document.body.appendChild(n);}
 const session=createDepotSession({preset:'D',workerFactory:()=>({postMessage(){},terminate(){}}),onChange:s=>ui?.render(s)});ui=mountSetup({doc:document,session});
 const c=brand.readDepotPipeConfig(document);assert.equal(c.cache,'off');assert.equal(c.capacity,0);assert.equal(c.up,50);assert.equal(c.radio,600);
 session.edit(a=>{a.network.cache.state='warm';a.network.cache.capacity_bytes=20e9;},{scope:'candidate'});
 assert.equal(brand.readDepotPipeConfig(document).cache,'warm');
 ui.destroy?.();session.destroy?.();
 }finally{restore();}
});
test('browser module initialization decorates an already interactive Readiness document',async()=>{
 const restore=installFakeDom(),prior=globalThis.MutationObserver;
 globalThis.MutationObserver=class{observe(){}disconnect(){}};
 try{
 Object.defineProperty(document,'readyState',{value:'interactive',configurable:true});
 const intro=document.createElement('section');intro.className='depot-intro';document.body.appendChild(intro);
 await import(`../hosted/brand.mjs?interactive-readiness-init`);
 assert.ok(intro.querySelector('.depot-pipe'));
 }finally{globalThis.MutationObserver=prior;restore();}
});
test('the hosted boot module imports brand.mjs, so the studio it mounts is decorated before the first paint',async()=>{
 const restore=installFakeDom(),prior=globalThis.MutationObserver;
 globalThis.MutationObserver=class{observe(){}disconnect(){}};
 try{
 Object.defineProperty(document,'readyState',{value:'interactive',configurable:true});
 // Mirrors boot.js: import brand.mjs, then mount the studio synchronously in the same module evaluation.
 const brand=new URL('../hosted/brand.mjs?boot-order',import.meta.url).href;
 await import('data:text/javascript,'+encodeURIComponent(`import ${JSON.stringify(brand)};const home=document.createElement('section');home.className='studio-overview';document.body.appendChild(home);`));
 assert.ok(document.getElementById('visitor-purpose'));
 }finally{globalThis.MutationObserver=prior;restore();}
});
