import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readdirSync,rmSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {MAC_CHROME,chromePolicy,launchChrome} from './cdp-browser.mjs';
import {hostedSite,serveSite} from './hosted-site-fixture.mjs';
import {MEASURE,TITLES as ROUTES,settle} from './viewport-measure.mjs';

const SIZES=[[320,700],[390,844],[768,1000],[1280,900]];
// Before-baseline at the base (spec section 9): at 320 px the depot page is 355 px wide, because the 322 px "Depot content
// cache (diagnostic field)" select overflows with its label and note. Two more sources were recorded with it: the import
// and share block (#share) reaches 329 px on its own, so a fix to the select alone still fails this cell, and the fixed
// motion control sits at the right edge of the widened page. Step A cannot fix it, so the cell must keep overflowing from
// that select, from those recorded sources only and by at most 8 px past 355, until the entry is removed deliberately.
// The 8 px absorbs font and rounding differences between Chrome builds (the CI image has 155), since the select is as
// wide as its longest option's text; a new overflowing element fails at any size.
const KNOWN_OVERFLOW=new Map([['/depot-readiness/ 320',{cause:'Depot content cache (diagnostic field)',scrollWidth:355,tolerance:8,within:['#share','.visitor-motion-control']}]]);
// In-page predicate: inside the cause select's own field, or inside one of the other recorded sources.
const recorded=({cause,within})=>`(el=>{const s=[...document.querySelectorAll('select')].find(s=>s.labels?.[0]?.textContent.trim()===${JSON.stringify(cause)});
 return !!s?.parentElement?.contains(el)||${JSON.stringify(within)}.some(w=>el.closest(w));})`;

async function measureWidth(browser,origin,width,height){
 const page=await browser.newPage(),cells=[];let errors;
 page.on(({method,params})=>{
  if(method==='Runtime.exceptionThrown')errors?.push('exception '+(params.exceptionDetails.exception?.description??params.exceptionDetails.text));
  if(method==='Runtime.consoleAPICalled'&&params.type==='error')errors?.push('console '+params.args.map(a=>a.value??a.description).join(' '));
  // Off-loopback requests (the analytics tag) fail by design: the browser resolves no other host.
  if(method==='Log.entryAdded'&&params.entry.level==='error'&&!(params.entry.source==='network'&&params.entry.url&&!params.entry.url.startsWith(origin+'/')))errors?.push(params.entry.source+' '+params.entry.text);
 });
 await page.emulate({width,height,mobile:width<500});
 for(const route of Object.keys(ROUTES)){
  errors=[];
  await page.navigate(origin+route);
  const settled=await settle(page),known=KNOWN_OVERFLOW.get(`${route} ${width}`);
  cells.push({route,width,settled,errors,...await page.evaluate(MEASURE(width,known&&recorded(known)))});
 }
 await page.close();
 return cells;
}

test('Chrome is required under CI or FLEETLAB_REQUIRE_CHROME=1, is skipped only otherwise, and must launch when found',async()=>{
 const missing='/nonexistent/fleetlab-chrome';
 assert.equal(chromePolicy({}).path,MAC_CHROME);
 assert.deepEqual(chromePolicy({FLEETLAB_CHROME:missing}),{path:missing,found:false,required:false,skip:`Chrome not found at ${missing}; set FLEETLAB_CHROME to run this check`});
 for(const env of [{CI:'true'},{FLEETLAB_REQUIRE_CHROME:'1'},{CI:'true',FLEETLAB_REQUIRE_CHROME:'0'}])assert.deepEqual(chromePolicy({...env,FLEETLAB_CHROME:missing}),{path:missing,found:false,required:true,skip:false});
 await assert.rejects(launchChrome(missing),/Chrome is required but not found at \/nonexistent\/fleetlab-chrome/);
 const root=mkdtempSync(join(tmpdir(),'fleetlab-not-chrome-')),fake=join(root,'chrome'),profiles=()=>readdirSync(tmpdir()).filter(n=>n.startsWith('fleetlab-chrome-'));
 try{
  writeFileSync(fake,'#!/bin/sh\nexit 3\n',{mode:0o755});
  assert.equal(chromePolicy({FLEETLAB_CHROME:fake}).skip,false);
  const before=profiles();
  await assert.rejects(launchChrome(fake),/did not launch: Chrome exited with 3/);
  assert.deepEqual(profiles(),before);
 }finally{rmSync(root,{recursive:true,force:true});}
});

const chrome=chromePolicy();
test('8 hosted pages at 320, 390, 768 and 1280 px have no page-level horizontal overflow beyond the recorded baseline',{skip:chrome.skip,timeout:120000},async t=>{
 const browser=await launchChrome(chrome.path);t.after(()=>browser.close());
 t.diagnostic(`browser ${browser.version.product} (protocol ${browser.version.protocolVersion}) at ${chrome.path}`);
 const server=await serveSite(hostedSite());t.after(()=>server.close());
 const cells=(await Promise.all(SIZES.map(([width,height])=>measureWidth(browser,server.origin,width,height)))).flat();
 const keys=cells.map(c=>`${c.route} ${c.width}`);
 assert.equal(cells.length,32);assert.equal(new Set(keys).size,32);
 for(const key of KNOWN_OVERFLOW.keys())assert.ok(keys.includes(key),key);
 const problems=[];
 for(const c of cells){
  const key=`${c.route} ${c.width}`,known=KNOWN_OVERFLOW.get(key),cause=known?.cause,wide=c.scrollWidth>c.width,over=`${c.over.length} overflowing: ${c.over.slice(0,12).join(', ')}`;
  if(c.title!==ROUTES[c.route])problems.push(`${key}: title ${JSON.stringify(c.title)}`);
  if(c.clientWidth!==c.width)problems.push(`${key}: clientWidth ${c.clientWidth}, so the emulated width did not take effect`);
  if(c.visibility!=='visible')problems.push(`${key}: page is ${c.visibility} and may not have rendered`);
  if(c.errors.length)problems.push(`${key}: page errors: ${c.errors.join('; ')}`);
  if(wide&&!cause)problems.push(`${key}: scrollWidth ${c.scrollWidth} > ${c.width}; ${over}`);
  if(cause&&!wide)problems.push(`${key}: the known baseline overflow is gone (scrollWidth ${c.scrollWidth}); remove it from KNOWN_OVERFLOW`);
  if(cause&&wide&&!c.over.some(e=>e.startsWith('select')&&e.includes(`"${cause}"`)))problems.push(`${key}: overflows, but not from the select labelled "${cause}"; ${over}`);
  if(cause&&c.scrollWidth>known.scrollWidth+known.tolerance)problems.push(`${key}: scrollWidth ${c.scrollWidth} is more than ${known.tolerance} px past the recorded ${known.scrollWidth}; ${over}`);
  if(cause&&c.outside.length)problems.push(`${key}: overflows from elements outside the recorded sources: ${c.outside.join(', ')}`);
  if(cause&&wide)t.diagnostic(`known baseline exception ${key}: scrollWidth ${c.scrollWidth}; ${over}`);
  if(!c.settled)t.diagnostic(`${key} still changing after 5 s; measured at the cap`);
 }
 assert.equal(problems.length,0,problems.join('\n'));
});
