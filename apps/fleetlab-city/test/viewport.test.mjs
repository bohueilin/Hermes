import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readdirSync,rmSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {MAC_CHROME,chromePolicy,launchChrome} from './cdp-browser.mjs';
import {hostedSite,serveSite} from './hosted-site-fixture.mjs';
import {MEASURE,TITLES as ROUTES,settle} from './viewport-measure.mjs';

const SIZES=[[320,700],[390,844],[768,1000],[1280,900]];
// Wave 2 closes the recorded Depot control/share overflow.
const KNOWN_OVERFLOW=new Map();
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

test('completed regional windows fit their sidebar; wait populations are visible in paired and scale results at both widths',{skip:chrome.skip,timeout:120000},async t=>{
 const browser=await launchChrome(chrome.path);t.after(()=>browser.close());
 const server=await serveSite(hostedSite());t.after(()=>server.close());
 // This function runs in the actual page, so text range rectangles include wrapping and font metrics.
 async function exercise(route){
  const main=document.querySelector('main:not([hidden])');
  const visible=node=>node&&node.checkVisibility()&&node.getBoundingClientRect().width>0;
  const button=prefix=>[...main.querySelectorAll('button')].find(b=>visible(b)&&(b.textContent.trim().startsWith(prefix)||b.getAttribute('aria-label')===prefix));
  const wait=async(predicate,name)=>{
   const deadline=performance.now()+15000;
   while(!predicate()){if(performance.now()>deadline)throw Error('Timed out waiting for '+name);await new Promise(resolve=>setTimeout(resolve,25));}
  };
  const click=async name=>{await wait(()=>button(name)&&!button(name).disabled,name);button(name).click();};
  await document.fonts.ready;
  const width=innerWidth,before=document.documentElement.scrollWidth;
  if(route.startsWith('regional')){
   if(width===320)await click('Knobs ·');
   await click('Run window');
   await wait(()=>main.querySelectorAll('[data-role="across-table"] tbody tr').length===5&&/seed 1001/i.test(main.querySelector('[data-role="now-chip"]')?.textContent||''),'five replications and the selected seed');
   if(width===320&&main.querySelector('.fl-knobs')?.dataset.open==='true')await click('Close knobs');
   if(width===320){
    const across=main.querySelector('button[data-group="across"]');
    if(!visible(across))throw Error('Across replications tab is hidden');
    across.click();
   }
   const sidebar=main.querySelector('.fl-side').getBoundingClientRect();
   const rows=[...main.querySelectorAll('[data-role="across-rows"] [data-row]')].map(row=>[...row.children].map(span=>{
    const range=document.createRange();range.selectNodeContents(span);
    return {text:span.innerText,inside:visible(span)&&[...range.getClientRects()].every(rect=>rect.width>0&&rect.left>=sidebar.left-1&&rect.right<=sidebar.right+1)&&span.scrollWidth<=span.clientWidth+1};
   }));
   return {width,before,after:document.documentElement.scrollWidth,rows};
  }
  if(route.startsWith('experiments')){
   await click('Run the paired comparison');
   await wait(()=>main.querySelector('article.fl-verdict[data-validity="VALID"]'),'paired verdict');
   const card=main.querySelector('article.fl-verdict'),exact=card.querySelector('.teaching-exact');
   const population='Rider waits measure request to pickup for completed rides. Bay waits measure intake end to first task start for visits that started a task, including zero waits.';
   const notes=()=>[...card.querySelectorAll('p')].filter(node=>visible(node)&&node.textContent===population&&!node.closest('details')).length;
   const closed=notes(),result=card.innerText;
   exact.querySelector('summary').click();
   const record=JSON.parse(exact.querySelector('pre').innerText);
   return {width,before,after:document.documentElement.scrollWidth,closed,opened:notes(),result,exactOpen:exact.open,metric:record.primary.metric,pairs:record.replications};
  }
  await click('Run the paired test');
  await wait(()=>main.querySelector('.scale-result table'),'Response reserve tables');
  const output=main.querySelector('.scale-result');
  return {width,before,after:document.documentElement.scrollWidth,heads:[...output.querySelectorAll('th')].filter(visible).map(e=>e.textContent),captions:[...output.querySelectorAll('caption')].filter(visible).map(e=>e.textContent)};
 }
 for(const width of [320,1280]){
  for(const route of ['regional?lesson=bay_teaching_map','regional?lesson=L1','regional?lesson=L3','experiments?lesson=UC-03','experiments?lesson=OPS-03','scale-lab?lesson=response-reserve']){
   const page=await browser.newPage();
   try{
    await page.emulate({width,height:width===320?800:900,mobile:width===320});
    await page.navigate(server.origin+'/#/'+route);
    const data=await page.evaluate('('+exercise.toString()+')('+JSON.stringify(route)+')'),id=route+' at '+width;
    assert.equal(data.width,width,id);
    assert.ok(data.before<=width&&data.after<=width,id+' overflow: '+[data.before,data.after]);
    if(route.startsWith('regional')){
     assert.equal(data.rows.length,2,id);
     assert.match(data.rows[0][0].text,/wait p90.*completed rides/);
     assert.match(data.rows[0][1].text,/in every replication, from [\d,]+ completed rides/);
     for(const row of data.rows){assert.equal(row.length,2);for(const cell of row)assert.ok(cell.text&&cell.inside,id+' clipped '+cell.text);}
    }else if(route.startsWith('experiments')){
     assert.deepEqual([data.closed,data.opened,data.exactOpen,data.pairs],[1,1,true,20],id);
     if(route.endsWith('UC-03')){assert.equal(data.metric,'wait.p90_s');assert.match(data.result,/wait p90 -572\.8 s/);}
     else{assert.match(data.metric,/^unserved\.fraction/);assert.match(data.result,/13\.3 min/);}
    }else{
     assert.ok(data.heads.includes('Mean wait per answered request (vehicles and responders)'),id);
     assert.ok(data.captions.some(s=>s.includes('Simulated mean waits count answered vehicle requests and responder calls.')),id);
    }
   }finally{await page.close();}
  }
 }
});
