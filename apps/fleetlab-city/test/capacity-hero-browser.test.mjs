import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chromePolicy,launchChrome} from './cdp-browser.mjs';
import {hostedSite,serveSite} from './hosted-site-fixture.mjs';

const FLA4='/enhancement-media/FL-A4-capacity-hero.webp',D01='/diagrams/D-01-depot-scenario.webp';
// The tint is whatever capacity/visual.css declares for the Capacity art box, read back as the computed rgb().
const hex=readFileSync(new URL('../../../playground/fleetlab/capacity/visual.css',import.meta.url),'utf8').match(/^\.capacity-hero \.enhancement-visual\{background:#([0-9a-f]{6})\}$/m)?.[1];
const tint=hex&&`rgb(${[0,2,4].map(i=>parseInt(hex.slice(i,i+2),16)).join(', ')})`;
// 767 and 768 straddle the stacking breakpoint in capacity/visual.css; only the two-column layout puts FL-A4 above the fold.
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
