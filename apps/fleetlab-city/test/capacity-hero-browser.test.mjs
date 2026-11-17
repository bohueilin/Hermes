import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chromePolicy,launchChrome} from './cdp-browser.mjs';
import {hostedSite,serveSite} from './hosted-site-fixture.mjs';

const FLA4='/enhancement-media/FL-A4-capacity-hero.webp',D01='/diagrams/D-01-depot-scenario.webp';
// The tint is whatever capacity/visual.css declares for the Capacity art box, read back as the computed rgb().
const hex=readFileSync(new URL('../../../playground/fleetlab/capacity/visual.css',import.meta.url),'utf8').match(/^\.capacity-hero \.enhancement-visual\{background:#([0-9a-f]{6})\}$/m)?.[1];
const tint=hex&&`rgb(${[0,2,4].map(i=>parseInt(hex.slice(i,i+2),16)).join(', ')})`;
// 767 and 768 straddle the stacking breakpoint in capacity/visual.css. Priority follows width alone: at 767x1000 the stacked
// FL-A4 still shows its top in the first viewport, yet stays lazy.
const CELLS=[[390,844,false],[767,1000,false],[768,1000,true],[1280,900,true]];
const chrome=chromePolicy();
test('Capacity fetches no D-01 decoy, prioritises FL-A4 only in the two-column hero, and tints its box without shimmer',{skip:chrome.skip,timeout:120000},async t=>{
 assert.ok(tint,'capacity/visual.css declares the Capacity tint');
 const browser=await launchChrome(chrome.path);t.after(()=>browser.close());
 const server=await serveSite(hostedSite());t.after(()=>server.close());
 for(const [width,height,wide] of CELLS){
  const page=await browser.newPage(),events=[];page.on(m=>events.push(m));
  await page.send('Network.enable');await page.send('Network.setCacheDisabled',{cacheDisabled:true});
  await page.emulate({width,height,mobile:width<500});
  await page.navigate(server.origin+'/network-flows/capacity/');
  const s=await page.evaluate(`new Promise(done=>{const read=()=>{const f=document.getElementById('enhancement-capacity');if(!f)return setTimeout(read,50);
   const i=f.querySelector('img'),h=document.querySelector('.capacity-hero');setTimeout(()=>done({cls:f.className,loading:i.getAttribute('loading'),fetchpriority:i.getAttribute('fetchpriority'),
    bg:getComputedStyle(f.querySelector('.enhancement-visual')).backgroundColor,after:getComputedStyle(h,'::after').content,ambient:h.querySelectorAll('.visitor-ambient-art').length}),500);};read();})`);
  const sent=events.filter(e=>e.method==='Network.requestWillBeSent').map(e=>({path:new URL(e.params.request.url).pathname,priority:e.params.request.initialPriority}));
  const a4=sent.filter(q=>q.path===FLA4),cell=`${width}x${height}`;
  assert.equal(sent.filter(q=>q.path===D01).length,0,`${cell}: the removed D-01 decoy was fetched`);
  assert.deepEqual([s.loading,s.fetchpriority],wide?['eager','high']:['lazy',null],cell);
  if(wide)assert.deepEqual(a4.map(q=>q.priority),['High'],cell);else assert.ok(a4.every(q=>q.priority!=='High'),`${cell}: ${JSON.stringify(a4)}`);
  assert.deepEqual([s.cls,s.ambient,s.bg],['enhancement-media',0,tint],cell);
  assert.equal(s.after,'none',`${cell}: the pre-injection placeholder must give way to FL-A4`);
  await page.close();
 }
});

test('keyboard Watch keeps Guided chapters visible above the fold and respects the motion preference',{skip:chrome.skip,timeout:120000},async t=>{
 const browser=await launchChrome(chrome.path);t.after(()=>browser.close());
 const server=await serveSite(hostedSite());t.after(()=>server.close());
 const focusState=()=> {
  const group=document.querySelector('.capacity-chapters'),rect=group.getBoundingClientRect();
  const header=document.querySelector('.studio-header').getBoundingClientRect();
  const hit=document.elementFromPoint(rect.left+rect.width/2,rect.top+rect.height/2);
  return {focused:document.activeElement===group,name:group.getAttribute('aria-label'),
   top:rect.top,bottom:rect.bottom,left:rect.left,right:rect.right,width:innerWidth,height:innerHeight,
   headerBottom:header.bottom,hit:hit!==null&&group.contains(hit)};
 };
 const key=async(page,name,keyCode)=>{
  const event={key:name,code:name,windowsVirtualKeyCode:keyCode};
  await page.send('Input.dispatchKeyEvent',{type:'keyDown',...event,...(name==='Enter'?{text:'\r'}:{})});
  await page.send('Input.dispatchKeyEvent',{type:'keyUp',...event});
 };
 for(const [width,height] of [[320,800],[390,800],[768,800],[1280,900]]){
  for(const motion of ['reduce','no-preference']){
   const cell=`${width}x${height} ${motion}`,page=await browser.newPage();
   try{
    await page.emulate({width,height,mobile:width<500});
    await page.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:motion}]});
    await page.navigate(server.origin+'/network-flows/capacity/');
    await page.evaluate(`(async()=>{
     await document.fonts.ready;
     const watch=document.querySelector('[data-capacity-load]');
     watch.addEventListener('click',()=>{window.watchActivation=(${focusState})();},{once:true});
     watch.focus();
    })()`);
    await key(page,'Enter',13);
    const atActivation=await page.evaluate('window.watchActivation');
    assert.ok(atActivation,`${cell}: Enter must activate Watch comparison`);
    const loaded=await page.evaluate(`new Promise((resolve,reject)=>{
     const deadline=performance.now()+10000;
     function read(){
      if(document.querySelector('.capacity-status').textContent.includes('Four cells reconstructed')){
       requestAnimationFrame(()=>requestAnimationFrame(()=>resolve({focus:(${focusState})(),
        guide:document.querySelector('.capacity-guide-state').textContent})));
      }else if(performance.now()>deadline){reject(new Error('Watch did not reconstruct its four cells: '+document.querySelector('.capacity-status').textContent));}
      else{requestAnimationFrame(read);}
     }
     read();
    })`);
    for(const [moment,state] of [['activation',atActivation],['acceptance',loaded.focus]]){
     assert.ok(state?.focused,`${cell} ${moment}: Guided chapters must receive focus`);
     assert.equal(state.name,'Guided chapters');
     assert.ok(state.top>=Math.max(0,state.headerBottom)&&state.bottom<=state.height&&state.left>=0&&state.right<=state.width&&state.hit,
      `${cell} ${moment}: focused group must be fully visible and unobstructed: ${JSON.stringify(state)}`);
    }
    if(motion==='reduce')assert.match(loaded.guide,/Static storyboard/,cell);
    else assert.match(loaded.guide,/^40-second guide/,cell);
    await key(page,'Tab',9);
    assert.equal(await page.evaluate("document.activeElement.matches('.capacity-chapters button:enabled')"),true,`${cell}: Tab reaches a chapter`);
   }finally{await page.close();}
  }
 }
});
