import {test} from 'node:test';
import assert from 'node:assert/strict';
import {installFakeDom} from '../../../playground/fleetlab/test/helpers/fake-dom.mjs';
import {decorateVisitors} from '../hosted/visitor.mjs';
const {mountConceptLoops}=await import('../../../playground/fleetlab/src/ui/rebalancing-concept.js').catch(()=>({}));
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function setup({reduced=false,denied=false,pending=false}={}){
 assert.equal(typeof mountConceptLoops,'function','concept-loop controller exists');
 const restore=installFakeDom(globalThis,{media:{'(prefers-reduced-motion: reduce)':reduced}});
 let observer,resolvePlay,rejectPlay,plays=0,loads=0;
 window.IntersectionObserver=class{constructor(cb){observer??=cb;}observe(){}disconnect(){}};
 const watchers=[];window.MutationObserver=class{constructor(cb){this.cb=cb;watchers.push(this);}observe(target,options){this.target=target;this.options=options;}disconnect(){this.off=true;}};
 const f=document.createElement('figure'),v=document.createElement('video'),b=document.createElement('button'),status=document.createElement('span');
 v.setAttribute('data-concept-loop','');v.setAttribute('data-src','./nf05.mp4');v.setAttribute('poster','./nf05.webp');v.setAttribute('aria-label','Empty vehicles moving between illustrated zones');
 b.setAttribute('data-loop-control','');status.setAttribute('data-loop-status','');f.appendChild(v);f.appendChild(b);f.appendChild(status);document.body.appendChild(f);
 v.load=()=>{loads++;};v.paused=true;v.play=()=>{plays++;if(denied)return Promise.reject(Error('blocked'));return new Promise((resolve,reject)=>{rejectPlay=reject;resolvePlay=()=>{v.paused=false;v.dispatchEvent(new Event('play'));resolve();};if(!pending)resolvePlay();});};v.pause=()=>{v.paused=true;v.dispatchEvent(new Event('pause'));};
 const dispose=mountConceptLoops(document);
 return{v,b,status,restore,dispose,show:visible=>observer([{target:v,isIntersecting:visible,intersectionRatio:visible?1:0}]),watchers,fire:()=>{for(const w of watchers)if(!w.off&&w.target===document.documentElement&&w.options?.attributes)w.cb([]);},hold(on){document.documentElement.toggleAttribute('data-visitor-user-paused',on);this.fire();},get plays(){return plays;},get loads(){return loads;},complete:()=>resolvePlay(),interrupt:()=>rejectPlay(Object.assign(Error("interrupted by pause"),{name:"AbortError"}))};
}
test('visible concept motion starts silently, while explicit Pause persists after visibility changes',async()=>{const x=setup();try{x.show(true);await tick();assert.equal(x.v.muted,true);assert.equal(x.v.loop,true);assert.equal(x.v.paused,false);assert.equal(x.b.textContent,'Pause');x.b.click();x.show(false);x.show(true);await tick();assert.equal(x.plays,1);assert.equal(x.b.textContent,'Play');}finally{x.dispose();x.restore();}});
test('reduced motion never attaches a video source automatically and explicit Play still works',async()=>{const x=setup({reduced:true});try{x.show(true);await tick();assert.equal(x.plays,0);assert.equal(x.v.getAttribute('src'),null);x.b.click();await tick();assert.equal(x.plays,1);assert.equal(x.v.paused,false);}finally{x.dispose();x.restore();}});
test('a preference change pauses an already playing loop and does not resume by itself',async()=>{const x=setup();try{x.show(true);await tick();x.restore.dom.media.set('(prefers-reduced-motion: reduce)',true);assert.equal(x.v.paused,true);x.restore.dom.media.set('(prefers-reduced-motion: reduce)',false);x.show(false);x.show(true);await tick();assert.equal(x.plays,1);}finally{x.dispose();x.restore();}});
test('autoplay denial preserves the poster and offers a deliberate retry',async()=>{const x=setup({denied:true});try{x.show(true);await tick();assert.equal(x.v.paused,true);assert.equal(x.b.textContent,'Play');assert.match(x.status.textContent,/poster/i);x.show(false);x.show(true);await tick();assert.equal(x.plays,1);}finally{x.dispose();x.restore();}});
test('pausing while playback is pending rejects a late start',async()=>{const x=setup({pending:true});try{x.show(true);x.b.click();x.complete();await tick();assert.equal(x.v.paused,true);assert.equal(x.b.textContent,'Play');}finally{x.dispose();x.restore();}});

test('visibility interruption of a pending play does not disable later automatic playback',async()=>{const x=setup({pending:true});try{x.show(true);x.show(false);x.interrupt();await tick();assert.equal(x.status.textContent,'');x.show(true);assert.equal(x.plays,2);x.complete();await tick();assert.equal(x.v.paused,false);}finally{x.dispose();x.restore();}});
test('explicit pause interruption preserves user intent without a false failure message',async()=>{const x=setup({pending:true});try{x.show(true);x.b.click();x.interrupt();await tick();assert.equal(x.status.textContent,'');x.show(false);x.show(true);assert.equal(x.plays,1);assert.equal(x.b.textContent,'Play');}finally{x.dispose();x.restore();}});

test("actual media error reloads only on explicit retry",async()=>{const x=setup();try{x.show(true);await tick();x.v.dispatchEvent(new Event("error"));x.show(false);x.show(true);assert.equal(x.loads,0);x.b.click();await tick();assert.equal(x.loads,1);assert.equal(x.v.paused,false);}finally{x.dispose();x.restore();}});

test('the hosted Pause visual motion holds a playing loop on its poster, and Resume restarts it',async()=>{const x=setup();try{x.show(true);await tick();assert.equal(x.v.paused,false);x.hold(true);assert.equal(x.v.paused,true);assert.equal(x.b.textContent,'Play');x.hold(false);await tick();assert.equal(x.v.paused,false);assert.equal(x.plays,2);assert.equal(x.b.textContent,'Pause');}finally{x.dispose();x.restore();}});
test('a visitor pause set before the loop is in view never attaches a source',async()=>{const x=setup();try{x.hold(true);x.show(true);await tick();assert.equal(x.plays,0);assert.equal(x.v.getAttribute('src'),null);}finally{x.dispose();x.restore();}});
test('a local Pause outlives the hosted Resume',async()=>{const x=setup();try{x.show(true);await tick();x.b.click();x.hold(true);x.hold(false);await tick();assert.equal(x.plays,1);assert.equal(x.v.paused,true);assert.equal(x.b.textContent,'Play');}finally{x.dispose();x.restore();}});
test('Play pressed during a visitor pause waits for Resume',async()=>{const x=setup();try{x.show(true);await tick();x.b.click();x.hold(true);x.b.click();await tick();assert.equal(x.plays,1);assert.equal(x.v.paused,true);x.hold(false);await tick();assert.equal(x.plays,2);assert.equal(x.v.paused,false);assert.equal(x.b.textContent,'Pause');}finally{x.dispose();x.restore();}});
test('under reduced motion the hosted paused state alone does not block an explicit Play',async()=>{const x=setup({reduced:true});try{document.documentElement.setAttribute('data-visitor-motion','paused');x.show(true);await tick();assert.equal(x.plays,0);x.b.click();await tick();assert.equal(x.plays,1);assert.equal(x.v.paused,false);}finally{x.dispose();x.restore();}});
test('disposal disconnects the visitor-pause watcher',()=>{const x=setup();x.dispose();assert.ok(x.watchers.length>0&&x.watchers.every(w=>w.off));x.restore();});
test('the hosted control reaches the loop, and reduced motion keeps the lesson Play working',async()=>{
 for(const order of ['pause, then reduced motion','reduced motion from the start']){
  const x=setup({reduced:order==='reduced motion from the start'}),previous=globalThis.MutationObserver;globalThis.MutationObserver=window.MutationObserver;try{
   decorateVisitors(document);const control=document.querySelector('.visitor-motion-control'),root=document.documentElement;x.show(true);await tick();
   if(order==='pause, then reduced motion'){
    assert.equal(x.v.paused,false);control.click();x.fire();assert.equal(root.hasAttribute('data-visitor-user-paused'),true);assert.equal(x.v.paused,true);
    control.click();x.fire();await tick();assert.equal(x.v.paused,false);control.click();x.fire();
    x.restore.dom.media.set('(prefers-reduced-motion: reduce)',true);x.fire();
   }
   assert.equal(control.disabled,true);assert.equal(control.textContent,'Visual motion: reduced');assert.equal(root.getAttribute('data-visitor-motion'),'paused');assert.equal(root.hasAttribute('data-visitor-user-paused'),false);
   x.b.click();await tick();assert.equal(x.v.paused,false);
  }finally{globalThis.MutationObserver=previous;x.dispose();x.restore();}
 }
});
