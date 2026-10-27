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
// sits in the column of the lesson footer above it with no block padding or margin, and keeps a visible focus ring.
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
    height:box.height,line:line.height,gaps:[n.paddingTop,n.paddingBottom,q.marginTop,q.marginBottom].map(px),
    left:line.left,column:footer.getBoundingClientRect().left+px(getComputedStyle(footer).paddingLeft),right:box.right,width:document.documentElement.clientWidth,
    focus:[a.matches(':focus-visible'),f.outlineStyle,px(f.outlineWidth)]});};read();})`);
  assert.ok(!UA_LINKS.includes(s.link),`${cell}: the Next link keeps the browser default colour ${s.link}`);
  assert.ok(s.height<=s.line+1,`${cell}: the nav is ${s.height} px tall for a ${s.line} px line`);
  assert.ok(s.right<=s.width,`${cell}: the nav overflows`);
  if(route==='capacity'){
   assert.equal(s.link,s.ink,`${cell}: the Next link takes the lesson ink`);
   assert.deepEqual(s.gaps,[0,0,0,0],`${cell}: nav block padding and paragraph block margins`);
   assert.ok(Math.abs(s.left-s.column)<1,`${cell}: the Next line starts at ${s.left}, the footer column at ${s.column}`);
   assert.ok(s.focus[0]&&s.focus[1]!=='none'&&s.focus[2]>=2,`${cell}: focus ring ${JSON.stringify(s.focus)}`);
  }
  await page.close();
 }
});

// Every link the hub and its five lessons render takes a colour from the system, never the browser's unvisited blue or
// visited purple, and reads at 4.5:1 or better against its effective background. The sweep waits until the page stops
// adding links, and Capacity must include its release-source link. The effective background composites each ancestor's
// background-color, innermost on top, down to the first opaque one, over a white canvas. A link with a background-image
// on that walk sits over artwork whose colour is not known here, so it is skipped and counted; there is none today.
// getComputedStyle reports the unvisited style only, so the visited half rests on the default-colour check.
const CONTRAST=`(()=>{const rgba=s=>{const m=/^rgba?\\(([^)]*)\\)$/.exec(s),p=m?m[1].split(/[\\s,\\/]+/).filter(Boolean).map(Number):[];return p.length>=3&&!p.some(Number.isNaN)?[p[0],p[1],p[2],p[3]??1]:null;};
 const over=(top,bottom)=>{const a=top[3]+bottom[3]*(1-top[3]);return [...[0,1,2].map(i=>(top[i]*top[3]+bottom[i]*bottom[3]*(1-top[3]))/a),a];};
 const lum=c=>{const [r,g,b]=c.slice(0,3).map(v=>v/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return .2126*r+.7152*g+.0722*b;};
 return a=>{const layers=[];for(let e=a;e;e=e.parentElement){const s=getComputedStyle(e);if(s.backgroundImage!=='none')return {image:true};const c=rgba(s.backgroundColor);
   if(!c)return {unparsed:s.backgroundColor};if(c[3]>0){layers.push(c);if(c[3]>=1)break;}}
  const bg=layers.reverse().reduce((b,c)=>over(c,b),[255,255,255,1]),ink=rgba(getComputedStyle(a).color);if(!ink)return {unparsed:getComputedStyle(a).color};
  const [x,y]=[lum(over(ink,bg)),lum(bg)].sort((m,n)=>n-m);return {ratio:(x+.05)/(y+.05),background:'rgb('+bg.slice(0,3).map(Math.round).join(', ')+')'};};})()`;
test('no link on the Network Flows hub or its five lessons keeps the browser default colour or reads under 4.5:1',{skip:chrome.skip,timeout:180000},async t=>{
 const browser=await launchChrome(chrome.path);t.after(()=>browser.close());
 const server=await serveSite(hostedSite());t.after(()=>server.close());
 let skipped=0;
 for(const path of ['','capacity/','software-delivery/','delivery-order/','rebalancing/','dispatch/'])for(const [width,height] of [[1280,900],[390,844]]){
  const page=await browser.newPage(),cell=`/network-flows/${path} ${width}x${height}`;
  await page.emulate({width,height,mobile:width<500});
  await page.navigate(server.origin+'/network-flows/'+path);
  const links=await page.evaluate(`new Promise(done=>{const contrast=${CONTRAST};let last=-1,stable=0;const tick=()=>{const all=[...document.querySelectorAll('a')];stable=all.length===last?stable+1:0;last=all.length;
   if(stable<3)return setTimeout(tick,200);done(all.map(a=>({href:a.getAttribute('href'),text:a.textContent.trim().slice(0,60),color:getComputedStyle(a).color,...contrast(a)})));};setTimeout(tick,300);})`);
  assert.ok(links.length>0,`${cell}: no links rendered`);
  if(path==='capacity/')assert.ok(links.some(l=>l.href==='./release.json'),`${cell}: the release-source link was not rendered`);
  assert.deepEqual(links.filter(l=>UA_LINKS.includes(l.color)),[],cell);
  assert.deepEqual(links.filter(l=>l.unparsed),[],`${cell}: colours the contrast check cannot read`);
  skipped+=links.filter(l=>l.image).length;
  assert.deepEqual(links.filter(l=>l.ratio<4.5).map(l=>`${l.href} "${l.text}" ${l.color} on ${l.background}: ${l.ratio.toFixed(2)}:1`),[],`${cell}: links under 4.5:1`);
  await page.close();
 }
 t.diagnostic(`links over a background-image, skipped: ${skipped}`);
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
