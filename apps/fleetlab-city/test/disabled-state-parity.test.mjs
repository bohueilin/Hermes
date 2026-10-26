// Lesson control states v1 (Step B plan, section 3): one disabled and loading language across the five lessons.
// It parses each lesson page's real stylesheets in page order (styles.css for Capacity, the lesson visual.css, then the
// hosted brand.css, which imports visitor.css and enhancement-media.css), applies !important, specificity and order,
// resolves var(), and composites colour and opacity over the real ancestor surfaces of each control, in the states
// the lesson's own code produces in the Playground fake DOM.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {loadSheets,paint,computed,buildDocument,specificity,parseComplex} from './css-cascade.mjs';
import {installFakeDom} from '../../../playground/fleetlab/test/helpers/fake-dom.mjs';
import {buildSite} from '../../../playground/fleetlab/tools/pack.mjs';
import {renderPage} from '../hosted/site-transform.mjs';
import {startRebalancing} from '../../../playground/fleetlab/src/ui/rebalancing-app.js';
import {performR1Job} from '../../../playground/fleetlab/src/runtime/rebalancing-job.js';
import {startDispatch} from '../../../playground/fleetlab/src/ui/dispatch-app.js';
import {performDispatchJob} from '../../../playground/fleetlab/src/runtime/dispatch-job.js';
import {createOrderPage} from '../../../playground/fleetlab/src/ui/delivery-order-page.js';
import {ORDER_STUDY} from '../../../playground/fleetlab/src/data/delivery-order-study.js';
import {createCapacityPage} from '../../../playground/fleetlab/src/ui/depot-capacity-page.js';
import {CAPACITY_STUDY} from '../../../playground/fleetlab/src/data/depot-capacity-study.js';
import {createDeliveryPage} from '../../../playground/fleetlab/src/ui/software-delivery-page.js';
import {DELIVERY_STUDY} from '../../../playground/fleetlab/src/data/software-delivery-study.js';
import {reconstructDeliveryPair} from '../../../playground/fleetlab/src/runtime/software-delivery-worker.js';

const repo=fileURLToPath(new URL('../../../',import.meta.url)),read=path=>readFileSync(repo+path,'utf8');
const pg='playground/fleetlab/',hosted='apps/fleetlab-city/hosted/';

// The component spec: every lesson resolves every disabled control to these values.
const SPEC={opacity:1,'background-color':'#dce2d7','border-color':'#dce2d7',color:'#465d52',cursor:'not-allowed',transform:'none'};
const RANGE={opacity:.55,cursor:'not-allowed'};
const FLOOR=4.5;
const LESSONS={capacity:'#capacity-root','software-delivery':'#delivery-root','delivery-order':'#order-root',rebalancing:'#main',dispatch:'#main'};
const ENVS=[{label:'1280 fine pointer',width:1280,hover:'hover',pointer:'fine',reducedMotion:'no-preference'},{label:'390 touch',width:390,hover:'none',pointer:'coarse',reducedMotion:'no-preference'}];
const IDLE={r1:'Watch the comparison ↓',r3:'Follow the first assignment ↓',r1Apply:'Apply moves & advance 10 min',r3Apply:'Apply & advance 30 s'};

// Stylesheets in page order, read from the built pages rather than assumed.
const site=buildSite(repo+pg);
const links=html=>[...html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*>/g)].map(m=>m[0].match(/href="([^"]+)"/)[1]);
function cascade(lesson,{hostedLayer,edit=null}){
 const html=String(site.get(`network-flows/${lesson}/index.html`)),list=links(hostedLayer?renderPage(html,{analytics:true}):html);
 const file=href=>href==='/brand.css'?hosted+'brand.css':href==='../../styles.css'?pg+'styles.css':href==='./visual.css'?`${pg}${lesson}/visual.css`:assert.fail(`unexpected stylesheet ${href}`);
 return loadSheets(list.map(href=>{const name=file(href);let text=read(name);if(edit&&name.endsWith(`${lesson}/visual.css`))text=edit(text);return {name,text};}),href=>({name:hosted+href.replace('./',''),text:read(hosted+href.replace('./',''))}));
}
const visible=e=>{for(let a=e;a;a=a.parentElement)if(a.hasAttribute('hidden'))return false;return true;};
const isOff=e=>e.hasAttribute('disabled')||e.getAttribute('aria-disabled')==='true';
// Violations of the spec for every visible disabled control under a lesson root.
function audit(lesson,rootEl,rules){
 const problems=[],seen=[];
 for(const env of ENVS)for(const e of rootEl.querySelectorAll('button, select, input')){
  if(!visible(e)||!isOff(e))continue;
  const st={hover:null,active:null,focus:null},hov={hover:e,active:e,focus:null};
  const name=`${lesson} ${e.localName}${e.id?'#'+e.id:''} "${e.textContent.trim().slice(0,30)}" @${env.label}`;
  const p=paint(rules,e,env,st,{allowOwnImage:e.localName==='select'});
  if(e.localName==='input'&&e.getAttribute('type')==='range'){
   if(Math.abs(p.opacity-RANGE.opacity)>1e-9)problems.push(`${name}: opacity ${p.opacity}`);
   if(computed(rules,e,'cursor',env,st)!==RANGE.cursor)problems.push(`${name}: cursor`);continue;}
  if(e.localName==='input')continue;
  const got={opacity:p.opacity,...Object.fromEntries(['background-color','border-color','color','cursor','transform'].map(k=>[k,computed(rules,e,k,env,st)]))};
  for(const [k,v]of Object.entries(SPEC))if(String(got[k]).toLowerCase()!==String(v))problems.push(`${name}: ${k} ${got[k]} (spec ${v})`);
  for(const k of ['transform','background-color','color','border-color']){const h=computed(rules,e,k,env,hov);if(h!==got[k])problems.push(`${name}: hover/active ${k} ${h} (resting ${got[k]})`);}
  if(p.ratio<FLOOR)problems.push(`${name}: label contrast ${p.ratio.toFixed(2)} < ${FLOOR}`);
  seen.push(p.ratio);
 }
 return {problems,seen};
}

// ---------- lesson states (the lesson's own code, a stub worker, the source page markup) ----------
function page(lesson){const restore=installFakeDom();buildDocument(document,read(`${pg}${lesson}/index.html`));return restore;}
function lesson(name,start,perform,mode){
 const restore=page(name),sent=[],worker={postMessage:m=>sent.push(m),terminate(){}};
 const app=start({createWorker:()=>{if(mode==='throw')throw Error('worker unavailable');return worker;}});
 return {by:id=>document.getElementById(id),reply:()=>worker.onmessage({data:perform(sent.at(-1))}),fail:e=>worker.onmessage({data:{id:sent.at(-1).id,type:'error',error:e}}),app,close(){app.dispose();restore();}};
}
const rebalancing=mode=>lesson('rebalancing',startRebalancing,performR1Job,mode),dispatch=mode=>lesson('dispatch',startDispatch,performDispatchJob,mode);
// Runs the manual observation to its end with empty batches: 12 ten-minute steps on Rebalancing, 40 thirty-second steps on Dispatch.
function endRun(x,apply,steps){document.querySelector('[data-chapter="5"]').click();for(let k=0;k<steps;k++){x.by(apply).click();x.reply();}}
// The exact idle label shows if and only if the hero primary is enabled.
const heroReason=(b,idle)=>assert.equal(b.textContent===idle,!b.disabled,`#watch "${b.textContent}" disabled=${b.disabled}`);

test('lesson stylesheets load before brand.css, which imports visitor.css then enhancement-media.css',()=>{
 for(const lesson of Object.keys(LESSONS)){const html=String(site.get(`network-flows/${lesson}/index.html`));
  const own=lesson==='capacity'?['../../styles.css','./visual.css']:['./visual.css'];
  assert.deepEqual(links(html),own,lesson);assert.deepEqual(links(renderPage(html,{analytics:true})),[...own,'/brand.css'],lesson);}
 assert.match(read(hosted+'brand.css'),/^@import url\("\.\/visitor\.css"\);/);assert.match(read(hosted+'visitor.css'),/^@import url\("\.\/enhancement-media\.css"\);/);
});

test('the overrides win by strictly higher specificity, and an equal-specificity override loses',()=>{
 const rules=cascade('capacity',{hostedLayer:true});
 const sel=t=>rules.flatMap(r=>r.selectors).find(s=>s.text===t);
 const lift=':is(button:not(:disabled):not(.visitor-motion-control),.studio-button,.design-primary,.catalog-card,.visitor-start-card,.visitor-city-card,.visitor-family,.motion-feedback):hover';
 assert.deepEqual(specificity(sel(lift).ast),[0,3,1]);
 assert.deepEqual(specificity(sel(':is(button:not(:disabled):not(.visitor-motion-control),.studio-button,.design-primary,.motion-feedback):active').ast),[0,3,1]);
 assert.deepEqual(specificity(sel(':is(.operations-lab,.fixture-control,.bench) :is(input,select):disabled').ast),[0,2,1]);
 assert.deepEqual(specificity(sel('.depot-capacity [aria-disabled=true]').ast),[0,2,0]);
 assert.deepEqual(specificity(sel('.studio-button:hover').ast),[0,2,0]);
 for(const id of new Set(Object.values(LESSONS)))assert.deepEqual(specificity(parseComplex(`${id} :is(button,select):is(:disabled,[aria-disabled=true])`)),[1,1,1]);
 for(const [lesson,id] of Object.entries(LESSONS))assert.ok(read(`${pg}${lesson}/visual.css`).includes(`${id} :is(button,select):is(:disabled,[aria-disabled=true]){`),lesson);
 // Probe: a lesson rule at (0,3,1) loses the hover lift to visitor.css, because brand.css loads later.
 const restore=page('capacity');try{
  const b=document.createElement('button');b.setAttribute('aria-disabled','true');const hero=document.createElement('section');hero.setAttribute('class','capacity-hero');hero.appendChild(b);document.getElementById('capacity-root').appendChild(hero);
  const strip=t=>t.replace(/#capacity-root :is\(button,select\):is\(:disabled,\[aria-disabled=true\]\)\{[^}]*\}/,''),probe='\n.capacity-hero button[aria-disabled=true]:hover{transform:none}';
  const env=ENVS[0],hov={hover:b,active:null,focus:null};
  assert.equal(computed(cascade('capacity',{hostedLayer:true,edit:t=>strip(t)+probe}),b,'transform',env,hov),'translateY(-2px)');
  assert.equal(computed(cascade('capacity',{hostedLayer:true,edit:t=>t+probe}),b,'transform',env,hov),'none');
 }finally{restore();}
});

test('every visible disabled control in the five lessons resolves to the one disabled language',async()=>{
 const all=[];
 const check=(lesson,rootEl,label)=>{for(const hostedLayer of [false,true]){const {problems,seen}=audit(lesson,rootEl,cascade(lesson,{hostedLayer}));assert.deepEqual(problems,[],`${label} (${hostedLayer?'hosted':'teaching'})`);all.push(...seen);}};
 let x=rebalancing('ok');try{check('rebalancing',x.by('main'),'rebalancing loading');x.reply();endRun(x,'apply-moves',12);check('rebalancing',x.by('main'),'rebalancing run ended');}finally{x.close();}
 x=rebalancing('ok');try{x.fail('fixture');check('rebalancing',x.by('main'),'rebalancing unavailable');}finally{x.close();}
 x=dispatch('ok');try{check('dispatch',x.by('main'),'dispatch loading');x.reply();x.by('fixture').value='counterexample';x.by('fixture').dispatchEvent(new Event('change'));check('dispatch',x.by('main'),'dispatch scenario busy');}finally{x.close();}
 x=dispatch('ok');try{x.fail('fixture');check('dispatch',x.by('main'),'dispatch unavailable');}finally{x.close();}
 x=dispatch('ok');try{x.reply();endRun(x,'apply',40);check('dispatch',x.by('main'),'dispatch run ended');}finally{x.close();}
 {const restore=page('delivery-order');try{
  const p=createOrderPage({manifest:ORDER_STUDY,runStudy:()=>new Promise(()=>{})});document.getElementById('order-root').replaceChildren(p.element);p.load();check('delivery-order',document.getElementById('order-root'),'delivery order loading');p.destroy();}finally{restore();}}
 {const restore=page('capacity');try{
  const p=createCapacityPage({manifest:CAPACITY_STUDY,yieldPage:()=>new Promise(()=>{})});document.getElementById('capacity-root').appendChild(p.element);
  p.element.querySelector('[data-capacity-load]').focus();p.watch();check('capacity',document.getElementById('capacity-root'),'capacity loading');p.destroy();}finally{restore();}}
 {const restore=page('software-delivery');try{
  const p=createDeliveryPage({manifest:DELIVERY_STUDY,runPair:e=>Promise.resolve(reconstructDeliveryPair(e))});document.getElementById('delivery-root').replaceChildren(p.element);
  [...p.element.querySelectorAll('button')].find(b=>b.textContent==='Watch comparison').click();for(let k=0;k<20;k++)await Promise.resolve();
  assert.ok([...p.element.querySelectorAll('button')].some(b=>b.disabled&&visible(b)),'software delivery shows a disabled chapter control after acceptance');
  check('software-delivery',document.getElementById('delivery-root'),'software delivery boundary');p.destroy?.();}finally{restore();}}
 assert.ok(all.length>=20,`audited ${all.length} control states`);
 console.log('disabled-state contrast',JSON.stringify([...new Set(all.map(r=>r.toFixed(2)))]));
});

test('hero primaries carry their reason inside while disabled and lose it as soon as they are enabled',()=>{
 let x=rebalancing('ok');try{const w=x.by('watch');assert.equal(w.disabled,true);assert.equal(w.textContent,'Loading the recorded comparison…');heroReason(w,IDLE.r1);
  x.reply();assert.equal(w.textContent,IDLE.r1);heroReason(w,IDLE.r1);}finally{x.close();}
 x=rebalancing('ok');try{x.fail('fixture');assert.equal(x.by('watch').textContent,'Comparison unavailable');heroReason(x.by('watch'),IDLE.r1);}finally{x.close();}
 x=rebalancing('throw');try{assert.equal(x.by('watch').textContent,'Comparison unavailable');heroReason(x.by('watch'),IDLE.r1);}finally{x.close();}
 x=dispatch('ok');try{const w=x.by('watch');assert.equal(w.textContent,'Checking the dispatch comparison…');heroReason(w,IDLE.r3);x.reply();assert.equal(w.textContent,IDLE.r3);heroReason(w,IDLE.r3);
  x.by('fixture').value='counterexample';x.by('fixture').dispatchEvent(new Event('change'));assert.equal(w.disabled,true);assert.equal(w.textContent,'Checking the dispatch comparison…');
  // A failure after an accepted comparison keeps that comparison, so the primary is enabled with its idle label.
  x.fail('fixture');assert.equal(w.disabled,false);assert.equal(w.textContent,IDLE.r3);heroReason(w,IDLE.r3);}finally{x.close();}
 x=dispatch('ok');try{x.fail('fixture');assert.equal(x.by('watch').textContent,'Comparison unavailable');heroReason(x.by('watch'),IDLE.r3);}finally{x.close();}
 x=dispatch('throw');try{assert.equal(x.by('watch').textContent,'Comparison unavailable');heroReason(x.by('watch'),IDLE.r3);}finally{x.close();}
});

test('the manual primaries read "Observation complete" once the run has ended, and the idle label returns on reset',()=>{
 for(const [open,apply,reset,steps,end,idle]of [[rebalancing,'apply-moves','reset-manual',12,7200,IDLE.r1Apply],[dispatch,'apply','reset',40,1200,IDLE.r3Apply]]){const x=open('ok');try{
  x.reply();const b=x.by(apply);assert.equal(b.textContent,idle);
  endRun(x,apply,steps-1);assert.equal(b.disabled,false);assert.equal(b.textContent,idle);
  b.click();assert.equal(b.disabled,true);assert.equal(b.textContent,idle);x.reply();
  assert.equal(x.app.getSession().get().manual.end,end);assert.equal(b.disabled,true);assert.equal(b.textContent,'Observation complete');
  x.by(reset).click();assert.equal(b.disabled,true);x.reply();assert.equal(x.app.getSession().get().manual.end,0);assert.equal(b.disabled,false);assert.equal(b.textContent,idle);
 }finally{x.close();}}
});

test('Delivery Order and Capacity keep their reason line directly after the action row, at full contrast',()=>{
 const env=ENVS[1],st={hover:null,active:null,focus:null};
 {const restore=page('delivery-order');try{
  const p=createOrderPage({manifest:ORDER_STUDY,runStudy:()=>new Promise(()=>{})});document.getElementById('order-root').replaceChildren(p.element);
  const compare=p.element.querySelector('button.primary'),row=compare.parentElement,kids=row.parentElement.children,status=p.element.querySelector('[data-status]');
  p.load();assert.equal(compare.disabled,true);assert.equal(kids[kids.indexOf(row)+1],status);assert.ok(status.textContent.length>0);
  for(const hostedLayer of [false,true])assert.ok(paint(cascade('delivery-order',{hostedLayer}),status,env,st).ratio>=FLOOR);
  p.cancel();assert.equal(compare.textContent,'Compare my order');p.destroy();}finally{restore();}}
 {const restore=page('capacity');try{
  const p=createCapacityPage({manifest:CAPACITY_STUDY,yieldPage:()=>new Promise(()=>{})});document.getElementById('capacity-root').appendChild(p.element);
  const lb=p.element.querySelector('[data-capacity-load]'),row=lb.parentElement,kids=row.parentElement.children,status=p.element.querySelector('.capacity-status');
  assert.equal(kids[kids.indexOf(row)+1],status,'the status is the next element after the Watch row');
  lb.focus();p.load();
  // set-busy keeps the focused button enabled but aria-disabled: it must still read as disabled, keep its focus ring and never lift.
  assert.equal(lb.disabled,false);assert.equal(lb.getAttribute('aria-disabled'),'true');assert.equal(lb.textContent,'Watch comparison');assert.match(status.textContent,/^Reconstructing/);
  for(const hostedLayer of [false,true]){const rules=cascade('capacity',{hostedLayer});for(const e of ENVS){const focus={hover:lb,active:lb,focus:lb};
   assert.equal(computed(rules,lb,'background-color',e,focus),SPEC['background-color']);assert.equal(computed(rules,lb,'transform',e,focus),'none');assert.equal(computed(rules,lb,'outline-style',e,focus),'solid');
   assert.ok(paint(rules,status,e,st).ratio>=FLOOR);}}
  p.destroy();}finally{restore();}}
});

test('removing a lesson block brings back a failing treatment (the audit bites)',()=>{
 const strip=t=>t.replace(/#(main|order-root|capacity-root|delivery-root) :is\(button,select\):is\(:disabled,\[aria-disabled=true\]\)\{[^}]*\}/,'');
 const x=dispatch('ok');try{
  const gone=audit('dispatch',x.by('main'),cascade('dispatch',{hostedLayer:true,edit:strip})).problems;
  assert.ok(gone.some(p=>/#watch .*background-color #0b3b2e/.test(p)),gone.join('\n'));
  const old=audit('dispatch',x.by('main'),cascade('dispatch',{hostedLayer:true,edit:t=>strip(t).replace(/#main input\[type=range\]:disabled\{[^}]*\}/,'button:disabled{opacity:.5;cursor:default}')})).problems;
  assert.ok(old.some(p=>/#watch .*label contrast 2\.9\d < 4\.5/.test(p)),old.join('\n'));
 }finally{x.close();}
});
