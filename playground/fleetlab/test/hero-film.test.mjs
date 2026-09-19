import assert from 'node:assert/strict';
import {test} from 'node:test';
import {installFakeDom} from './helpers/fake-dom.mjs';
import {createHeroFilm} from '../src/ui/hero-film.js';

function setup({reduced=false,saveData=false,pending=false,denied=false,nativeStart=false,noObserver=false,filmUrl}={}) {
  const restore=installFakeDom(globalThis,{media:{'(prefers-reduced-motion: reduce)':reduced}});
  let observer, complete, rejectPlay, plays=0, pauses=0;
  window.navigator={connection:{saveData}};
  window.IntersectionObserver=class {constructor(cb){this.cb=cb;observer=this;} observe(){} disconnect(){this.disconnected=true;}};
  if(noObserver)delete window.IntersectionObserver;
  const create=document.createElement.bind(document);
  document.createElement=(tag)=>{const node=create(tag); if(tag==='video'){
    node.paused=true;
    node.pause=()=>{pauses++;node.paused=true;node.dispatchEvent(new Event('pause'));};
    node.play=()=>{plays++;if(denied)return Promise.reject(new Error('denied')); if(nativeStart){node.paused=false;node.dispatchEvent(new Event('play'));} return new Promise((resolve,reject)=>{rejectPlay=(name)=>{node.paused=true;reject(Object.assign(new Error(name),{name}));};complete=()=>{node.paused=false;node.dispatchEvent(new Event('playing'));resolve();};if(!pending)complete();});};
    node.load=()=>{};
  }return node;};
  const hero=createHeroFilm(filmUrl===undefined?{}:{filmUrl,posterUrl:'data:image/webp;base64,AAAA'});
  document.body.appendChild(hero.element);hero.setActive(true);
  const video=hero.element.querySelector('video'),button=hero.element.querySelector('button');
  return {hero,video,button,restore,show:(visible=true)=>observer.cb([{isIntersecting:visible,intersectionRatio:visible?1:0}]),complete:()=>complete(),reject:(name='AbortError')=>rejectPlay(name),get plays(){return plays;},get pauses(){return pauses;},get observer(){return observer;}};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('visible playback reports actual state and user pause persists across navigation',async()=>{const x=setup();try{assert.equal(x.video.getAttribute('src'),null);x.show();await tick();assert.equal(x.video.muted,true);assert.match(x.button.textContent,/Pause/);x.button.click();x.hero.setActive(false);x.hero.setActive(true);x.show();await tick();assert.equal(x.plays,1);assert.match(x.button.textContent,/Play/);}finally{x.hero.destroy();x.restore();}});
for(const preference of [{reduced:true},{saveData:true}])test('motion/data preference prevents download until explicit play '+JSON.stringify(preference),async()=>{const x=setup(preference);try{x.show();assert.equal(x.video.getAttribute('src'),null);x.button.click();await tick();assert.equal(x.plays,1);assert.match(x.button.textContent,/Pause/);}finally{x.hero.destroy();x.restore();}});
for(const hide of ['navigation','document','intersection','destroy'])test('pending play is cancelled by '+hide,async()=>{const x=setup({pending:true});try{x.show();if(hide==='navigation')x.hero.setActive(false);if(hide==='document'){document.hidden=true;document.dispatchEvent(new Event('visibilitychange'));}if(hide==='intersection')x.show(false);if(hide==='destroy')x.hero.destroy();x.complete();await tick();assert.equal(x.video.paused,true);assert.match(x.button.textContent,/Play/);if(hide==='destroy'){assert.equal(x.observer.disconnected,true);const n=x.plays;x.button.click();assert.equal(x.plays,n);}}finally{x.hero.destroy();x.restore();}});
test('autoplay denial leaves poster and does not repeatedly retry',async()=>{const x=setup({denied:true});try{x.show();await tick();x.show(false);x.show();await tick();assert.equal(x.plays,1);assert.match(x.button.textContent,/Play/);assert.equal(x.hero.element.querySelector('img').hidden,false);}finally{x.hero.destroy();x.restore();}});
test('decode failure restores poster and truthful playback control',async()=>{const x=setup();try{x.show();await tick();x.video.dispatchEvent(new Event('error'));assert.equal(x.video.paused,true);assert.equal(x.hero.element.querySelector('img').hidden,false);assert.match(x.button.textContent,/Play/);}finally{x.hero.destroy();x.restore();}});
test('offline poster has no film or playback button',()=>{const x=setup({filmUrl:''});try{assert.equal(x.video,null);assert.equal(x.button,null);assert.ok(x.hero.element.querySelector('img').getAttribute('alt'));}finally{x.hero.destroy();x.restore();}});

test('observer absence stays on poster across visibility changes until explicit play',async()=>{const x=setup({noObserver:true});try{document.dispatchEvent(new Event('visibilitychange'));await tick();assert.equal(x.plays,0);assert.equal(x.video.getAttribute('src'),null);x.button.click();await tick();assert.equal(x.plays,1);}finally{x.hero.destroy();x.restore();}});
test('native pause events update the visible control',async()=>{const x=setup();try{x.show();await tick();x.video.pause();assert.match(x.button.textContent,/Play/);}finally{x.hero.destroy();x.restore();}});
test('destruction removes document and preference listeners',async()=>{const x=setup();try{x.show();await tick();x.hero.destroy();const count=x.pauses;document.hidden=true;document.dispatchEvent(new Event('visibilitychange'));x.restore.dom.media.set('(prefers-reduced-motion: reduce)',true);assert.equal(x.pauses,count);}finally{x.hero.destroy();x.restore();}});
test('returning while an old play request settles starts a fresh permitted attempt',async()=>{const x=setup({pending:true});try{x.show();x.hero.setActive(false);x.hero.setActive(true);x.complete();await tick();assert.equal(x.plays,2);x.complete();await tick();assert.equal(x.video.paused,false);assert.match(x.button.textContent,/Pause/);}finally{x.hero.destroy();x.restore();}});

test('cancelled pending rejection on navigation reentry starts one fresh allowed request',async()=>{const x=setup({pending:true});try{x.show();x.hero.setActive(false);x.hero.setActive(true);x.reject();await tick();assert.equal(x.plays,2);x.complete();await tick();assert.equal(x.video.paused,false);assert.match(x.button.textContent,/Pause/);}finally{x.hero.destroy();x.restore();}});
test('stale autoplay denial remains blocked across further visibility changes',async()=>{const x=setup({pending:true});try{x.show();x.hero.setActive(false);x.hero.setActive(true);x.reject('NotAllowedError');await tick();x.show(false);x.show();await tick();assert.equal(x.plays,1);assert.match(x.button.textContent,/Play/);}finally{x.hero.destroy();x.restore();}});
test('native play sets paused false before playing and the second click visibly pauses',async()=>{const x=setup({pending:true,nativeStart:true,reduced:true});try{x.show();x.button.click();assert.equal(x.video.paused,false);assert.match(x.button.textContent,/Pause/);assert.match(x.button.getAttribute('aria-label'),/Pause/);x.button.click();assert.equal(x.video.paused,true);assert.match(x.button.textContent,/Play/);x.reject();await tick();x.hero.setActive(false);x.hero.setActive(true);assert.equal(x.plays,1);}finally{x.hero.destroy();x.restore();}});
test('pending loading exposes cancel and returns to Play after cancellation',async()=>{const x=setup({pending:true,reduced:true});try{x.show();x.button.click();assert.match(x.button.textContent,/Cancel loading/);assert.match(x.button.getAttribute('aria-label'),/Cancel/);x.button.click();assert.match(x.button.textContent,/Play/);x.reject();await tick();assert.equal(x.plays,1);}finally{x.hero.destroy();x.restore();}});
