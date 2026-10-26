import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chromePolicy,launchChrome} from './cdp-browser.mjs';
import {hostedSite,serveSite} from './hosted-site-fixture.mjs';
import {buildDocument,computed,loadSheets} from './css-cascade.mjs';
import {installFakeDom} from '../../../playground/fleetlab/test/helpers/fake-dom.mjs';

// The hosted Next-lesson nav that lessonNavigation (software-delivery-package.mjs) appends to lessons 01 to 03. Capacity's
// carries the offline app class fl-app, which styles.css lays out as a tall grid; capacity/visual.css overrides it. Each nav
// is as tall as its one line, its link never keeps the browser's default blue, and Capacity's link takes the lesson ink,
// sits in the column of the lesson footer above it, and keeps a visible focus ring.
const ROUTES=[['capacity','#capacity-root'],['software-delivery','#delivery-root'],['delivery-order','#order-root']];
const SIZES=[[1280,900],[768,1000],[390,844],[320,700]],UA_LINKS=['rgb(0, 0, 238)','rgb(85, 26, 139)'];
const chrome=chromePolicy();
test('the end-of-lesson Next link is one line in the lesson ink, and Capacity\'s aligns with its footer',{skip:chrome.skip,timeout:180000},async t=>{
 const browser=await launchChrome(chrome.path);t.after(()=>browser.close());
 const server=await serveSite(hostedSite());t.after(()=>server.close());
 for(const [route,root] of ROUTES)for(const [width,height] of SIZES){
  const page=await browser.newPage(),cell=`${route} ${width}x${height}`;
  await page.emulate({width,height,mobile:width<500});
  await page.navigate(server.origin+`/network-flows/${route}/`);
  const s=await page.evaluate(`new Promise(done=>{const read=()=>{const footer=document.querySelector('${root} footer');if(!footer)return setTimeout(read,50);
   const nav=document.querySelector('body>nav[aria-label="Next Network Flows lesson"]'),p=nav.querySelector('p'),a=nav.querySelector('a');
   const n=getComputedStyle(nav),q=getComputedStyle(p),box=nav.getBoundingClientRect(),line=p.getBoundingClientRect(),px=v=>parseFloat(v)||0;
   a.focus();const f=getComputedStyle(a);
   done({link:getComputedStyle(a).color,ink:getComputedStyle(document.querySelector('${root}>*>main')||footer).color,
    content:box.height-px(n.paddingTop)-px(n.paddingBottom)-px(n.borderTopWidth)-px(n.borderBottomWidth),line:line.height+px(q.marginTop)+px(q.marginBottom),
    left:line.left,column:footer.getBoundingClientRect().left+px(getComputedStyle(footer).paddingLeft),right:box.right,width:document.documentElement.clientWidth,
    focus:[a.matches(':focus-visible'),f.outlineStyle,px(f.outlineWidth)]});};read();})`);
  assert.ok(!UA_LINKS.includes(s.link),`${cell}: the Next link keeps the browser default colour ${s.link}`);
  assert.ok(s.content<=s.line+1,`${cell}: the nav is ${s.content} px tall for a ${s.line} px line`);
  assert.ok(s.right<=s.width,`${cell}: the nav overflows`);
  if(route==='capacity'){
   assert.equal(s.link,s.ink,`${cell}: the Next link takes the lesson ink`);
   assert.ok(Math.abs(s.left-s.column)<1,`${cell}: the Next line starts at ${s.left}, the footer column at ${s.column}`);
   assert.ok(s.focus[0]&&s.focus[1]!=='none'&&s.focus[2]>=2,`${cell}: focus ring ${JSON.stringify(s.focus)}`);
  }
  await page.close();
 }
});

// capacity/visual.css loads after styles.css, so a rule of equal specificity would win here by order alone and lose
// silently if the order changed. The Capacity nav rules must win with visual.css loaded first as well as last.
test('Capacity\'s Next-nav rules outrank the styles.css .fl-app grid rather than relying on sheet order',()=>{
 const read=path=>({name:path,text:readFileSync(new URL('../../../'+path,import.meta.url),'utf8')});
 const styles=read('playground/fleetlab/styles.css'),visual=read('playground/fleetlab/capacity/visual.css'),brand=read('apps/fleetlab-city/hosted/brand.css');
 const imported=href=>read('apps/fleetlab-city/hosted/'+href.replace('./',''));
 const restore=installFakeDom();
 try{
  buildDocument(document,String(hostedSite().get('network-flows/capacity/index.html')));
  const nav=document.querySelector('body>nav[aria-label="Next Network Flows lesson"]');
  for(const order of [[styles,visual,brand],[visual,styles,brand]])for(const width of [1280,390])
   assert.equal(computed(loadSheets(order,imported),nav,'display',{width},{hover:null,active:null,focus:null}),'block',`${order[0].name.split('/').at(-2)} first, ${width} px`);
 }finally{restore();}
});
