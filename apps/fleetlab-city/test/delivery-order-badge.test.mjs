import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chromePolicy,launchChrome} from './cdp-browser.mjs';
import {hostedSite,serveSite} from './hosted-site-fixture.mjs';

// Step B W4. The Delivery Order editor badge "Your edited order is pending" follows "Selected: <scenario>." inline. On a
// phone it must move to its own line as one phrase, never break mid-phrase, and never widen the page. Its text range must
// form one line box, and it must end inside the edit-status line, for every scenario, after a real edit, at 320 and 390 px.
// At 768 and 1280 px it stays inline, on the same line as the end of "Selected: <scenario>.".
const chrome=chromePolicy();
test('the Delivery Order pending badge stays on one line at 320 and 390 px, and inline at 768 and 1280, without horizontal overflow',{skip:chrome.skip,timeout:120000},async t=>{
 const browser=await launchChrome(chrome.path);t.after(()=>browser.close());
 const server=await serveSite(hostedSite());t.after(()=>server.close());
 for(const [width,height] of [[320,700],[390,844],[768,1024],[1280,900]])for(const scenario of ['default','impossible','close']){
  const page=await browser.newPage(),cell=`${scenario} ${width}x${height}`;
  await page.emulate({width,height,mobile:width<500});
  await page.navigate(server.origin+'/network-flows/delivery-order/');
  const s=await page.evaluate(`new Promise(done=>{const read=()=>{const editor=document.querySelector('.order-shell .order-editor');if(!editor)return setTimeout(read,50);
   document.querySelector('.order-shell [data-case="${scenario}"]').click();
   [...document.querySelectorAll('.order-shell .order-editor button')].find(b=>b.textContent==='↓'&&!b.disabled).click();
   const b=document.querySelector('.order-shell [data-pending]'),range=document.createRange();range.selectNodeContents(b);
   const rects=[...range.getClientRects()].filter(r=>r.width>0),line=b.parentElement.getBoundingClientRect(),q=getComputedStyle(b.parentElement);
   const lead=document.createRange();lead.selectNodeContents(b.parentElement.firstChild);const end=[...lead.getClientRects()].filter(r=>r.width>0).at(-1);
   done({text:b.hidden?null:b.textContent,inline:!!end&&Math.min(end.bottom,rects[0].bottom)-Math.max(end.top,rects[0].top)>Math.min(end.height,rects[0].height)/2,lines:new Set(rects.map(r=>Math.round(r.top))).size,right:Math.max(...rects.map(r=>r.right)),
    column:line.right-parseFloat(q.paddingRight),scroll:document.documentElement.scrollWidth,width:document.documentElement.clientWidth});};read();})`);
  assert.equal(s.text,'Your edited order is pending',`${cell}: the badge shows after a real edit`);
  assert.equal(s.lines,1,`${cell}: the badge breaks across ${s.lines} lines`);
  if(width>=768)assert.ok(s.inline,`${cell}: the badge leaves the "Selected" line`);
  assert.ok(s.right<=s.column+0.5,`${cell}: the badge ends at ${s.right}, past the line's ${s.column}`);
  assert.ok(s.scroll<=s.width,`${cell}: the page is ${s.scroll} px wide in a ${s.width} px viewport`);
  await page.close();
 }
});
