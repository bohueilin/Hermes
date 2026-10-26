import {test} from 'node:test';
import assert from 'node:assert/strict';
import {installFakeDom} from '../../../playground/fleetlab/test/helpers/fake-dom.mjs';
import {installConceptVideos} from '../hosted/enhancement-motion.mjs';

const tick=async()=>{await Promise.resolve();await Promise.resolve();};
function harness({running=true,reduced=false,observers=true}={}){
 const restore=installFakeDom(globalThis,{media:{'(prefers-reduced-motion: reduce)':reduced}}),mutations=[],intersections=[];
 class MutationObserver{constructor(fn){this.fn=fn;mutations.push(this);}observe(target,options){this.target=target;this.options=options;}}
 class IntersectionObserver{constructor(fn){this.fn=fn;this.targets=new Set();intersections.push(this);}observe(target){this.targets.add(target);}unobserve(target){this.targets.delete(target);}}
 Object.assign(window,{MutationObserver,...(observers?{IntersectionObserver}:{})});
 document.documentElement.setAttribute('data-visitor-motion',running?'running':'paused');
 const make=(wrapped=false)=>{const page=document.createElement('section'),figure=document.createElement('figure'),poster=document.createElement('img'),video=document.createElement('video'),caption=document.createElement('figcaption');
 figure.setAttribute('data-concept-media','');poster.setAttribute('src','/poster.webp');poster.setAttribute('alt','A complete static concept.');video.setAttribute('data-concept-src','/enhancement-media/film.mp4');caption.textContent='Exact full caption · not simulation output';const frame=wrapped?document.createElement('div'):figure;if(wrapped){frame.className='enhancement-visual';figure.appendChild(frame);}frame.appendChild(poster);frame.appendChild(video);figure.appendChild(caption);page.appendChild(figure);document.body.appendChild(page);
 const calls={play:0,pause:0},requests=[];video.pause=()=>{calls.pause++;video.paused=true;};video.play=()=>{calls.play++;video.paused=false;return new Promise((resolve,reject)=>requests.push({resolve,reject}));};
 return{page,figure,frame,poster,video,caption,calls,requests};};
 const attributes=target=>{for(const observer of mutations)if(observer.options.attributes&&(observer.target===target||(observer.options.subtree&&observer.target.contains(target))))observer.fn([]);};
 return{restore,make,attributes,observationCounts:()=>({mutations:mutations.length,intersections:intersections.length,targets:intersections.reduce((n,o)=>n+o.targets.size,0)}),install(){installConceptVideos(document);},show(x,visible=true){for(const observer of intersections)if(observer.targets.has(x.frame))observer.fn([{target:x.frame,isIntersecting:visible,intersectionRatio:visible?1:0}]);},mutation(){for(const observer of mutations)if(observer.options.childList)observer.fn([]);},running(value){document.documentElement.setAttribute('data-visitor-motion',value?'running':'paused');attributes(document.documentElement);},close:restore};
}
function poster(x){assert.equal(x.figure.getAttribute('data-concept-state'),'poster');assert.equal(x.video.hidden,true);assert.equal(x.caption.textContent,'Exact full caption · not simulation output');assert.equal(x.poster.getAttribute('alt'),'A complete static concept.');}

test('poster and full caption stay visible until an in-viewport muted inline play succeeds',async()=>{
 const h=harness();try{const x=h.make();h.install();poster(x);assert.equal(x.video.hasAttribute('src'),false);assert.equal(x.video.getAttribute('preload'),'none');assert.equal(x.video.autoplay,false);assert.equal(x.video.muted,true);assert.equal(x.video.loop,true);assert.equal(x.video.playsInline,true);
 h.show(x,false);assert.equal(x.calls.play,0);h.show(x);assert.equal(x.video.getAttribute('src'),'/enhancement-media/film.mp4');assert.equal(x.calls.play,1);poster(x);x.requests[0].resolve();await tick();assert.equal(x.video.hidden,false);assert.equal(x.figure.getAttribute('data-concept-state'),'playing');assert.equal(x.caption.textContent,'Exact full caption · not simulation output');
 }finally{h.close();}
});

test('global pause controls every installed video and never loads a paused video',async()=>{
 const h=harness({running:false});try{const a=h.make(),b=h.make();h.install();h.show(a);h.show(b);for(const x of[a,b]){poster(x);assert.equal(x.video.hasAttribute('src'),false);}h.running(true);for(const x of[a,b]){assert.equal(x.calls.play,1);x.requests[0].resolve();}await tick();h.running(false);for(const x of[a,b]){poster(x);assert.equal(x.video.paused,true);}h.running(true);for(const x of[a,b])assert.equal(x.calls.play,2);
 }finally{h.close();}
});

test('system and site reduced motion never load video and retain poster with full caption',async()=>{
 for(const type of['system','site']){const h=harness({reduced:type==='system'});try{if(type==='site')document.documentElement.setAttribute('data-motion','reduce');const x=h.make();h.install();h.show(x);poster(x);assert.equal(x.video.hasAttribute('src'),false);assert.equal(x.calls.play,0);
 if(type==='system')h.restore.dom.media.set('(prefers-reduced-motion: reduce)',false);else{document.documentElement.removeAttribute('data-motion');h.attributes(document.documentElement);}assert.equal(x.calls.play,1);x.requests[0].resolve();await tick();if(type==='system')h.restore.dom.media.set('(prefers-reduced-motion: reduce)',true);else{document.documentElement.setAttribute('data-motion','reduce');h.attributes(document.documentElement);}poster(x);
 }finally{h.close();}}
});

test('leaving viewport, hidden tabs and hidden route ancestors pause active video',async()=>{
 for(const type of['viewport','tab','route','aria','detach']){const h=harness();try{const x=h.make();h.install();h.show(x);x.requests[0].resolve();await tick();assert.equal(x.video.hidden,false);
 if(type==='viewport')h.show(x,false);else if(type==='tab'){document.hidden=true;document.dispatchEvent(new Event('visibilitychange'));}else if(type==='route'){x.page.hidden=true;h.attributes(x.page);}else if(type==='aria'){x.page.setAttribute('aria-hidden','true');h.attributes(x.page);}else{x.page.remove();h.mutation();}poster(x);assert.equal(x.video.paused,true);
 }finally{h.close();}}
});

test('a pending play cannot escape a later global pause',async()=>{
 const h=harness();try{const x=h.make();h.install();h.show(x);h.running(false);x.requests[0].resolve();await tick();poster(x);assert.equal(x.video.paused,true);assert.equal(x.calls.play,1);
 }finally{h.close();}
});

test('pause and resume while play is pending waits for the stale attempt before restarting',async()=>{
 const h=harness();try{const x=h.make();h.install();h.show(x);h.running(false);h.running(true);assert.equal(x.calls.play,1);x.requests[0].resolve();await tick();poster(x);assert.equal(x.calls.play,2);x.requests[1].resolve();await tick();assert.equal(x.figure.getAttribute('data-concept-state'),'playing');assert.equal(x.video.paused,false);
 }finally{h.close();}
});

test('rejected autoplay and decode failure fall back to the poster without retry loops',async()=>{
 const h=harness();try{const x=h.make();h.install();h.show(x);x.requests[0].reject(new Error('autoplay blocked'));await tick();poster(x);h.mutation();h.show(x);assert.equal(x.calls.play,1);h.running(false);h.running(true);assert.equal(x.calls.play,2);x.requests[1].resolve();await tick();x.video.dispatchEvent(new Event('error'));poster(x);h.mutation();assert.equal(x.calls.play,2);
 }finally{h.close();}
});

test('repeated installation and SPA detach/reinsert reuse one lifecycle without reviving stale play',async()=>{
 const h=harness();try{const x=h.make();h.install();const observers=h.observationCounts();h.install();assert.deepEqual(h.observationCounts(),observers);h.show(x);assert.equal(x.calls.play,1);x.page.remove();h.mutation();assert.equal(h.observationCounts().targets,0);document.body.appendChild(x.page);h.install();assert.deepEqual(h.observationCounts(),observers);h.show(x);assert.equal(x.calls.play,1);x.requests[0].resolve();await tick();assert.equal(x.calls.play,2);x.requests[1].resolve();await tick();assert.equal(x.figure.getAttribute('data-concept-state'),'playing');h.running(false);poster(x);
 }finally{h.close();}
});

test('new SPA videos are discovered while unrelated legacy video remains untouched',()=>{
 const h=harness();try{const legacy=document.createElement('video');legacy.setAttribute('src','/existing.mp4');document.body.appendChild(legacy);h.install();const x=h.make();h.mutation();poster(x);h.show(x);assert.equal(x.calls.play,1);assert.equal(legacy.getAttribute('src'),'/existing.mp4');assert.equal(legacy.hasAttribute('preload'),false);
 }finally{h.close();}
});

test('without viewport observation the page keeps the poster and does not guess autoplay visibility',()=>{
 const h=harness({observers:false});try{const x=h.make();h.install();poster(x);assert.equal(x.calls.play,0);assert.equal(x.video.hasAttribute('src'),false);
 }finally{h.close();}
});


test('only the visible media frame starts playback; an adjacent visible caption does not',()=>{
 const h=harness();try{const x=h.make(true);h.install();h.show({frame:x.figure});assert.equal(x.calls.play,0);assert.equal(x.video.hasAttribute('src'),false);h.show(x);assert.equal(x.calls.play,1);h.show(x,false);poster(x);
 }finally{h.close();}
});
