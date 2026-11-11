import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chromePolicy,launchChrome} from './cdp-browser.mjs';
import {hostedSite,serveSite} from './hosted-site-fixture.mjs';

const chrome=chromePolicy();
test('concept motion obeys real CSS pause, visibility and reduced-motion gates without losing its phase',{skip:chrome.skip,timeout:120000},async t=>{
 const browser=await launchChrome(chrome.path);t.after(()=>browser.close());
 const server=await serveSite(hostedSite());t.after(()=>server.close());
 for(const width of[320,1280]){
  const page=await browser.newPage();t.after(()=>page.close().catch(()=>{}));await page.emulate({width,height:900,mobile:width<500});
  for(const [path,selector,particle]of[['/network-flows/capacity/','[data-concept-motion="pipe"]','.depot-pipe-route[data-pipe-active="true"] .depot-pipe-connector'],['/#/fleet-day','[data-concept-motion="fleet"]','.concept-cycle-pod']]){
   // The runner's own reduced-motion setting must not decide the first check; the reduced case is emulated below.
   await page.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
   await page.navigate(server.origin+path);
   await page.evaluate(`new Promise((resolve,reject)=>{let left=100;const check=()=>{const n=document.querySelector('${selector}');if(n){for(let a=n.parentElement;a;a=a.parentElement)if(a.tagName==='DETAILS')a.open=true;n.scrollIntoView({block:'center',behavior:'instant'});resolve();}else if(left--)setTimeout(check,50);else reject(Error('Concept not mounted'));};check();})`);
   const result=await page.evaluate(`(async()=>{
    const wait=ms=>new Promise(done=>setTimeout(done,ms)),target=document.querySelector('${selector}'),pod=target.querySelector('${particle}'),pseudo=${selector.includes('pipe')?"'::after'":"null"},root=document.documentElement;
    let frames=0;const tick=()=>{frames++;requestAnimationFrame(tick);};requestAnimationFrame(tick);
    for(let i=0;i<30&&target.getAttribute('data-concept-motion-state')!=='running';i++)await wait(100);
    const running={state:target.getAttribute('data-concept-motion-state'),play:getComputedStyle(pod,pseudo).animationPlayState};
    const gates={hidden:document.hidden,reduce:matchMedia('(prefers-reduced-motion: reduce)').matches,motion:root.getAttribute('data-visitor-motion'),site:root.getAttribute('data-motion'),top:Math.round(target.getBoundingClientRect().top)};
    root.setAttribute('data-visitor-user-paused','');const immediate=getComputedStyle(pod,pseudo).animationPlayState;await wait(100);
    // The pod's own animation: getAnimations() also lists CSS transitions, which a pause must not stop.
    const animation=target.getAnimations({subtree:true}).find(a=>a.effect?.target===pod&&(a.effect.pseudoElement??null)===pseudo);
    // A pause or resume is pending until the animation's next ready point, which waits for a rendered frame.
    const settle=()=>Promise.race([animation?.ready,wait(2000)]),trace={pending:{play:animation?.playState,pending:animation?.pending,frames}};
    await settle();Object.assign(trace,{settled:{play:animation?.playState,pending:animation?.pending,frames}});
    const first=animation?.currentTime;await wait(150);const held=animation?.currentTime;trace.held={frames};
    root.removeAttribute('data-visitor-user-paused');await wait(150);await settle();await wait(50);const resumed=animation?.currentTime;trace.resumed={play:animation?.playState,frames};
    document.querySelector('.visitor-motion-control').click();await wait(100);const global=getComputedStyle(pod,pseudo).animationPlayState;
    document.querySelector('.visitor-motion-control').click();await wait(100);
    // Viewport and media-query changes reach the page with a rendered frame, so wait for the state rather than a fixed time.
    scrollTo({top:0,behavior:'instant'});for(let i=0;i<20&&target.getAttribute('data-concept-motion-state')!=='paused';i++)await wait(100);const offscreen=target.getAttribute('data-concept-motion-state');
    target.scrollIntoView({block:'center',behavior:'instant'});await wait(150);
    return{running,gates,trace,name:animation?.animationName,immediate,first,held,resumed,global,offscreen,overflow:document.documentElement.scrollWidth>innerWidth,caption:target.closest('figure')?.querySelector('figcaption')?.textContent??target.closest('.depot-pipe')?.querySelector('.depot-pipe-caption')?.textContent};
   })()`);
   assert.deepEqual(result.running,{state:'running',play:'running'},`${width} ${path} ${JSON.stringify(result.gates)}`);
   assert.equal(result.immediate,'paused','user pause has a synchronous CSS veto');
   assert.equal(result.global,'paused');assert.ok(result.name,'the pod animation is found');assert.equal(result.held,result.first,`paused phase does not advance ${JSON.stringify(result.trace)}`);assert.ok(result.resumed>result.held,`resuming continues the held animation ${JSON.stringify(result.trace)}`);
   assert.equal(result.offscreen,'paused');assert.equal(result.overflow,false);assert.equal(result.caption,'Concept illustration · not simulation output');
   await page.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
   const reduced=await page.evaluate(`(async()=>{const n=document.querySelector('${selector}'),p=n.querySelector('${particle}');
    for(let i=0;i<20&&n.getAttribute('data-concept-motion-state')!=='paused';i++)await new Promise(done=>setTimeout(done,100));
    return{state:n.getAttribute('data-concept-motion-state'),animation:getComputedStyle(p,${selector.includes('pipe')?"'::after'":"null"}).animationName,visible:n.getBoundingClientRect().height>0};})()`);
   assert.deepEqual(reduced,{state:'paused',animation:'none',visible:true});
   await page.send('Emulation.setEmulatedMedia',{features:[]});
  }
 }
});
