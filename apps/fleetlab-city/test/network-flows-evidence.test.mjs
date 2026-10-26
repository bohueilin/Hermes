import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,mkdtempSync,mkdirSync,readFileSync,rmSync,symlinkSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {BRAND_MEDIA} from '../hosted/site-transform.mjs';
import {DISCLOSED,EXPECTED,FLEET_DAY,NAMED,NETWORK,PAGES,PAUSE,SCHEMA,SIZES,isGoogle,recordEvidence,serveStage,validate} from './network-flows-evidence.mjs';
import {TITLES} from './viewport-measure.mjs';

const RUNNER=fileURLToPath(new URL('./network-flows-evidence.mjs',import.meta.url));
const read=path=>readFileSync(new URL('../../../'+path,import.meta.url),'utf8');
const SHA='a'.repeat(64);

// A complete synthetic record, shaped like the runner's output at the base.
function sample(){
 const gtag={url:'https://www.googletagmanager.com/gtag/js?id=G-0',host:'www.googletagmanager.com',google:true,blocked:true,errorText:'inspector'};
 const pages=Object.entries(PAGES).flatMap(([page,path])=>SIZES.map(([width,height])=>({page,path,width,height,method:'cdp-device-metrics',title:TITLES[path],status:200,visibility:'visible',settled:true,
  innerWidth:width,clientWidth:width,scrollWidth:width,pageOverflow:false,offenders:[],consoleErrors:[],externalRequests:[{...gtag}],screenshot:{name:`${page}-${width}x${height}.png`,bytes:3,sha256:SHA}})));
 const network=NETWORK.pages.flatMap(page=>NETWORK.sizes.map(([width,height])=>{
  const image=(url,startMs,final='Low')=>({url,type:'Image',priority:{initial:'Low',final},initiator:{type:'parser',url:PAGES[page]},startMs,beforeFcp:startMs<20,status:200,errorText:null});
  const requests=[{url:PAGES[page],type:'Document',priority:{initial:'VeryHigh',final:'VeryHigh'},initiator:{type:'other'},startMs:0,beforeFcp:true,status:200,errorText:null},
   {...gtag,type:'Script',priority:{initial:'Low',final:'Low'},initiator:{type:'parser'},startMs:5,beforeFcp:true,status:null,external:true},
   ...page==='capacity'?[image(NAMED['D-01'],30),image(NAMED['FL-A4'],45)]:[image(NAMED['D-05'],10,'High')]];
  const named=Object.fromEntries(Object.entries(NAMED).map(([key,path])=>{const hits=requests.filter(q=>q.url===path);
   return [key,{path,requests:hits.length,priorities:hits.map(q=>q.priority),beforeFcp:hits.some(q=>q.beforeFcp),elements:hits.length}];}));
  return {page,path:PAGES[page],width,height,cache:'cold',quietReached:true,quietWaitMs:512,fcpMs:24,fcpSinceRequestMs:20,lcp:{ms:60,size:1,url:null,element:'h1'},beforeFcpCount:requests.filter(q=>q.beforeFcp).length,named,
   ...page==='capacity'?{fla4GotPriority:false,d01DecoyRequested:true}:{d05RequestCount:1},consoleErrors:[],requests};
 }));
 const flV2=state=>({present:true,state,visibleRatio:0.3});
 return {schema:SCHEMA,source_commit:'b'.repeat(40),stage:{path:'stage',integration_manifest_sha256:SHA,teaching_receipt_sha256:SHA},browser:{product:'Chrome/155.0.0.0'},
  server:{host:'127.0.0.1',headers_applied:false},scope:'Synthetic record.',notRun:Object.entries(DISCLOSED).map(([item,reason])=>({item,reason})),pages,network,
  pause:{page:'rebalancing',path:PAGES.rebalancing,width:1280,height:900,video:PAUSE.video,waitMs:1009,
   nf05:{visibleRatio:1,playingConfirmed:true,pausedBefore:false,pausedAfter:false,currentTimeBefore:0.5,currentTimeAfter:1.5,timeDeltaS:1},
   control:{selector:PAUSE.control,pressedBy:'Input.dispatchMouseEvent',textBefore:'Pause visual motion',textAfter:'Resume visual motion',ariaPressedAfter:'true'},
   flV2:{before:flV2('playing'),after:flV2('poster')}},
  fleetDay:{path:FLEET_DAY.path,width:390,height:844,a2Present:true,a2:{src:FLEET_DAY.a2},v1Elements:0,v1Requests:0,screenshot:{name:'fleet-day-390x844.png',bytes:3,sha256:SHA}}};
}
const problems=change=>{const r=sample();change(r);return validate(r).join('\n');};
const cell=(r,page,width)=>r.pages.find(c=>c.page===page&&c.width===width),net=(r,page,width)=>r.network.find(c=>c.page===page&&c.width===width);

test('the runner pins the spec section 10 pages, sizes, network cells, pause and Fleet day checks, and ties its DOM hooks to the product',()=>{
 assert.equal(SCHEMA,'fleetlab.network-flows-browser-evidence/1.0.0');
 assert.deepEqual(PAGES,{hub:'/network-flows/',capacity:'/network-flows/capacity/','software-delivery':'/network-flows/software-delivery/','delivery-order':'/network-flows/delivery-order/',
  rebalancing:'/network-flows/rebalancing/',dispatch:'/network-flows/dispatch/',depot:'/depot-readiness/'});
 assert.deepEqual(SIZES,[[320,700],[390,844],[768,1000],[1280,900]]);
 assert.deepEqual(NETWORK,{pages:['capacity','dispatch'],sizes:[[390,844],[1280,900]]});
 assert.equal(EXPECTED.length,7*4+2*2+2);assert.equal(new Set(EXPECTED).size,EXPECTED.length);
 assert.deepEqual(PAUSE,{page:'rebalancing',size:[1280,900],video:'/site-media/r1-nf05.mp4',control:'.visitor-motion-control',flV2:'enhancement-deadhead-art',minVisible:0.25,waitMs:1000});
 assert.deepEqual(FLEET_DAY,{path:'/#/fleet-day',size:[390,844],figure:'enhancement-fleet-day',a2:'/enhancement-media/FL-A2-one-fleet-day-panorama.webp',v1:'FL-V1'});
 assert.deepEqual(Object.keys(DISCLOSED),['physical-phone','hosted-headers']);
 for(const path of Object.values(PAGES))assert.ok(TITLES[path],path);
 // The media paths and DOM hooks must stay real, or a renamed file, id or class would make a lookup silently count zero
 // or report absent. Only names are tied to the product source, never the BEFORE behaviour that Step B changes.
 for(const path of [...Object.values(NAMED),PAUSE.video,FLEET_DAY.a2])assert.ok(BRAND_MEDIA[path.slice(1)],path);
 const media=read('apps/fleetlab-city/hosted/enhancement-media.mjs');
 for(const id of [PAUSE.flV2,FLEET_DAY.figure])assert.ok(media.includes(`'${id}'`),id);
 assert.ok(read('apps/fleetlab-city/hosted/visitor.mjs').includes(`class:'${PAUSE.control.slice(1)}'`),PAUSE.control);
 assert.ok(read('playground/fleetlab/rebalancing/index.html').includes(`data-src="${PAUSE.video}"`));
 assert.ok(read('apps/fleetlab-city/hosted/fleet-day-redirect.html').includes(`url=${FLEET_DAY.path}"`),FLEET_DAY.path);
 // Each hook is named once, in its constant, so every lookup in the runner goes through the tied name.
 const runner=readFileSync(RUNNER,'utf8');
 for(const hook of [PAUSE.flV2,FLEET_DAY.figure,PAUSE.control.slice(1),FLEET_DAY.path])assert.equal(runner.split(hook).length-1,1,hook);
 for(const host of ['www.googletagmanager.com','region1.google-analytics.com','google.com','www.google.com'])assert.ok(isGoogle(host),host);
 for(const host of ['127.0.0.1','notgoogle.com','google.com.example'])assert.ok(!isGoogle(host),host);
});

test('validate accepts a complete synthetic record, and a measurement listed in notRun in place of its result',()=>{
 assert.deepEqual(validate(sample()),[]);
 assert.equal(problems(r=>{r.pages.shift();r.network.pop();r.pause=null;r.fleetDay=null;
  r.notRun.push(...['page hub 320x700','network dispatch 1280x900','pause','fleet-day'].map(item=>({item,reason:'Chrome stopped.'})));}),'');
 assert.equal(problems(r=>{const c=cell(r,'depot',320);c.scrollWidth=355;c.innerWidth=355;c.pageOverflow=true;c.offenders=['select#dlc-36 right 355'];}),'');
});

test('validate rejects malformed records, one case per check',()=>{
 const local={url:'http://127.0.0.1/x',host:'127.0.0.1',google:false,blocked:true,errorText:'x'};
 const cases=[
  [r=>{r.schema='fleetlab.network-flows-browser-evidence/0.9.0';},/^schema: must be/m],
  [r=>{r.source_commit='b15055c';},/source_commit: must be a 40-character/],
  [r=>{r.stage.path='';},/stage: needs path/],
  [r=>{r.stage.integration_manifest_sha256='x';},/stage: needs path/],
  [r=>{delete r.stage.teaching_receipt_sha256;},/stage: needs path/],
  [r=>{delete r.browser.product;},/browser: needs the product/],
  [r=>{r.server.headers_applied=true;},/server: must be 127\.0\.0\.1 with headers_applied false/],
  [r=>{r.server.host='0.0.0.0';},/server: must be 127\.0\.0\.1 with headers_applied false/],
  [r=>{delete r.scope;},/scope: must be a statement/],
  [r=>{r.notRun={};},/notRun: must be a list/],
  [r=>{r.notRun[0].reason='';},/notRun: .* needs an item and a reason/],
  [r=>{r.notRun.push({...r.notRun[0]});},/notRun: items must be unique/],
  [r=>{r.notRun=r.notRun.filter(n=>n.item!=='physical-phone');},/notRun: must list physical-phone/],
  [r=>{r.notRun=r.notRun.filter(n=>n.item!=='hosted-headers');},/notRun: must list hosted-headers while headers_applied is false/],
  [r=>{delete cell(r,'hub',390).externalRequests[0].host;},/page hub 390x844: external request needs url, host, google and blocked/],
  [r=>{cell(r,'hub',390).externalRequests[0]={...local};},/page hub 390x844: 127\.0\.0\.1 is misclassified/],
  [r=>{cell(r,'hub',390).externalRequests[0].google=false;},/www\.googletagmanager\.com is misclassified/],
  [r=>{cell(r,'hub',390).externalRequests[0].blocked=false;},/page hub 390x844: .* left loopback/],
  [r=>{cell(r,'hub',320).width=500;},/page hub 500x700: unknown page or size/],
  [r=>{cell(r,'hub',320).path='/network-flows/capacity/';},/page hub 320x700: unknown page or size/],
  [r=>{cell(r,'hub',320).method='iframe';},/page hub 320x700: needs method and settled/],
  [r=>{delete cell(r,'hub',320).settled;},/page hub 320x700: needs method and settled/],
  [r=>{cell(r,'capacity',390).title='Page not found';},/page capacity 390x844: title must be "Scheduling or capacity\? \| FleetLab"/],
  [r=>{delete cell(r,'capacity',390).title;},/page capacity 390x844: title must be/],
  [r=>{cell(r,'capacity',390).status=404;},/page capacity 390x844: the page document must have status 200/],
  [r=>{cell(r,'capacity',390).visibility='hidden';},/page capacity 390x844: visibility must be visible/],
  [r=>{delete cell(r,'capacity',320).clientWidth;},/page capacity 320x700: needs innerWidth, clientWidth/],
  [r=>{cell(r,'capacity',320).clientWidth=980;},/page capacity 320x700: clientWidth must equal the width/],
  [r=>{cell(r,'depot',320).scrollWidth=355;},/page depot 320x700: pageOverflow must equal scrollWidth > width/],
  [r=>{cell(r,'hub',768).pageOverflow=true;},/page hub 768x1000: pageOverflow must equal/],
  [r=>{cell(r,'hub',768).offenders=null;},/page hub 768x1000: needs offenders, consoleErrors and externalRequests lists/],
  [r=>{cell(r,'hub',768).offenders=[''];},/page hub 768x1000: needs offenders/],
  [r=>{cell(r,'hub',768).consoleErrors=null;},/page hub 768x1000: needs offenders/],
  [r=>{cell(r,'hub',768).consoleErrors=[3];},/page hub 768x1000: needs offenders/],
  [r=>{cell(r,'hub',768).externalRequests={};},/page hub 768x1000: needs offenders/],
  [r=>{cell(r,'capacity',320).screenshot.name='../capacity.png';},/page capacity 320x700: screenshot needs a plain \.png name/],
  [r=>{cell(r,'capacity',320).screenshot.bytes=0;},/page capacity 320x700: screenshot needs/],
  [r=>{cell(r,'capacity',320).screenshot.sha256='x';},/page capacity 320x700: screenshot needs/],
  [r=>{cell(r,'capacity',390).screenshot.name=cell(r,'capacity',320).screenshot.name;},/screenshots: names must be unique/],
  [r=>{r.pages.pop();},/page depot 1280x900: is neither measured nor listed in notRun/],
  [r=>{r.pages.push(structuredClone(r.pages[0]));},/page hub 320x700: is measured or listed in notRun more than once/],
  [r=>{r.notRun.push({item:'page hub 320x700',reason:'also skipped'});},/page hub 320x700: is measured or listed in notRun more than once/],
  [r=>{net(r,'capacity',390).cache='warm';},/network capacity 390x844: unknown page or size, or not a cold cache/],
  [r=>{net(r,'capacity',390).path='/network-flows/dispatch/';},/network capacity 390x844: unknown page or size/],
  [r=>{net(r,'capacity',390).width=768;},/network capacity 768x844: unknown page or size/],
  [r=>{net(r,'dispatch',390).page='hub';},/network hub 390x844: is not an expected measurement/],
  [r=>{net(r,'capacity',1280).fcpMs=0;},/network capacity 1280x900: needs fcpMs, fcpSinceRequestMs and lcp/],
  [r=>{delete net(r,'capacity',1280).fcpSinceRequestMs;},/network capacity 1280x900: needs fcpMs/],
  [r=>{delete net(r,'capacity',1280).lcp;},/network capacity 1280x900: needs fcpMs/],
  [r=>{net(r,'capacity',1280).lcp.ms=0;},/network capacity 1280x900: needs fcpMs/],
  [r=>{net(r,'capacity',1280).lcp.element='';},/network capacity 1280x900: needs fcpMs/],
  [r=>{delete net(r,'capacity',1280).quietReached;},/network capacity 1280x900: needs quietReached and quietWaitMs/],
  [r=>{net(r,'capacity',1280).quietWaitMs=-1;},/network capacity 1280x900: needs quietReached and quietWaitMs/],
  [r=>{net(r,'capacity',1280).requests.shift();},/the first request must be the page document/],
  [r=>{net(r,'capacity',1280).requests[0].status=404;},/network capacity 1280x900: the first request must be the page document, with status 200/],
  [r=>{delete net(r,'capacity',1280).requests[2].type;},/request \/diagrams\/D-01-depot-scenario\.webp needs/],
  [r=>{net(r,'capacity',1280).requests[2].priority.initial='Urgent';},/request \/diagrams\/D-01-depot-scenario\.webp needs/],
  [r=>{net(r,'capacity',1280).requests[2].priority.final='Urgent';},/request \/diagrams\/D-01-depot-scenario\.webp needs/],
  [r=>{net(r,'capacity',1280).requests[2].initiator={};},/request \/diagrams\/D-01-depot-scenario\.webp needs/],
  [r=>{net(r,'capacity',1280).requests[1].startMs=null;},/request https:\/\/www\.googletagmanager\.com\S* needs/],
  [r=>{net(r,'capacity',1280).requests[2].beforeFcp='false';},/request \/diagrams\/D-01-depot-scenario\.webp needs/],
  [r=>{net(r,'capacity',1280).requests[2].beforeFcp=true;},/request \/diagrams\/D-01-depot-scenario\.webp needs .* a beforeFcp that matches FCP/],
  [r=>{net(r,'dispatch',1280).beforeFcpCount=2;},/beforeFcpCount must count the before-FCP requests/],
  [r=>{net(r,'dispatch',1280).requests[1].blocked=false;},/network dispatch 1280x900: .* left loopback/],
  [r=>{net(r,'capacity',390).named['D-01'].path=NAMED['D-05'];},/named D-01 must count the requests/],
  [r=>{net(r,'capacity',390).named['D-01'].requests=0;},/named D-01 must count the requests/],
  [r=>{net(r,'capacity',390).named['FL-A4'].elements=-1;},/named FL-A4 must count the requests for .* and its elements/],
  [r=>{net(r,'capacity',390).fla4GotPriority=true;},/fla4GotPriority must match the FL-A4 request priorities/],
  [r=>{net(r,'capacity',390).requests[3].priority.final='High';net(r,'capacity',390).named['FL-A4'].priorities[0].final='High';},/fla4GotPriority must match/],
  [r=>{net(r,'capacity',1280).d01DecoyRequested=false;},/d01DecoyRequested must match the D-01 requests/],
  [r=>{net(r,'dispatch',390).d05RequestCount=2;},/d05RequestCount must match the D-05 requests/],
  [r=>{r.pause.width=390;},/pause: wrong page, video or size/],
  [r=>{r.pause.video='/site-media/r1-nf04.mp4';},/pause: wrong page, video or size/],
  [r=>{r.pause.nf05.visibleRatio=0.2;},/pause: r1-nf05 must be at least 25% visible and confirmed playing/],
  [r=>{r.pause.nf05.playingConfirmed=false;},/pause: r1-nf05 must be at least 25% visible/],
  [r=>{r.pause.nf05.timeDeltaS=0;},/pause: needs currentTimeBefore, currentTimeAfter, timeDeltaS and pausedAfter/],
  [r=>{delete r.pause.nf05.pausedAfter;},/pause: needs currentTimeBefore/],
  [r=>{r.pause.waitMs=900;},/pause: must wait at least 1000 ms/],
  [r=>{r.pause.control.selector='.visitor-motion-toggle';},/pause: needs the control state/],
  [r=>{r.pause.control.textBefore='';},/pause: needs the control state/],
  [r=>{delete r.pause.control.textAfter;},/pause: needs the control state/],
  [r=>{delete r.pause.control.ariaPressedAfter;},/pause: needs the control state/],
  [r=>{delete r.pause.flV2.before;},/pause: needs the FL-V2 state before and after/],
  [r=>{delete r.pause.flV2.after;},/pause: needs the FL-V2 state before and after/],
  [r=>{r.pause=null;},/pause: is neither measured nor listed in notRun/],
  [r=>{r.fleetDay.path='/#/home';},/fleet-day: wrong route or size/],
  [r=>{r.fleetDay.width=320;},/fleet-day: wrong route or size/],
  [r=>{r.fleetDay.a2Present='yes';},/fleet-day: a2Present needs the A2 image/],
  [r=>{r.fleetDay.a2={src:'/enhancement-media/FL-A1-people-between-rides.webp'};},/fleet-day: a2Present needs the A2 image/],
  [r=>{r.fleetDay.v1Elements=-1;},/fleet-day: needs v1Elements and v1Requests counts/],
  [r=>{delete r.fleetDay.v1Requests;},/fleet-day: needs v1Elements and v1Requests counts/],
  [r=>{r.fleetDay.screenshot.name='fleet day.png';},/fleet-day: screenshot needs a plain \.png name/],
 ];
 for(const [change,expected]of cases)assert.match(problems(change),expected,String(change));
 for(const garbage of [null,undefined,42,'x',{pages:[null],network:[{}],notRun:[null],pause:{},fleetDay:{}}])assert.ok(validate(garbage).length>0);
});

test('with dir, validate checks every screenshot against the file on disk',()=>{
 const dir=mkdtempSync(join(tmpdir(),'nf-evidence-'));
 try{
  const r=sample(),png=Buffer.from('png'),sha=createHash('sha256').update(png).digest('hex');
  for(const s of [...r.pages.map(c=>c.screenshot),r.fleetDay.screenshot]){s.sha256=sha;writeFileSync(join(dir,s.name),png);}
  assert.deepEqual(validate(r,{dir}),[]);
  writeFileSync(join(dir,'hub-320x700.png'),'PNG');rmSync(join(dir,'fleet-day-390x844.png'));
  assert.deepEqual(validate(r,{dir}),['page hub 320x700: hub-320x700.png is missing or differs from its record','fleet-day: fleet-day-390x844.png is missing or differs from its record']);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('serveStage serves a stage like Pages, never serves or applies _headers or _redirects, serves exact paths only, and stays inside site/',async()=>{
 const root=mkdtempSync(join(tmpdir(),'nf-stage-')),site=join(root,'site');
 const server={close:async()=>{}};
 try{
  mkdirSync(join(site,'sub'),{recursive:true});
  writeFileSync(join(site,'_headers'),'/*\n\tContent-Security-Policy: default-src \'none\'\n\tX-Frame-Options: DENY\n');
  writeFileSync(join(site,'index.html'),'<p>home</p>');writeFileSync(join(site,'404.html'),'<p>missing</p>');writeFileSync(join(site,'sub/index.html'),'<p>sub</p>');
  writeFileSync(join(site,'clip.mp4'),Buffer.from('0123456789'));writeFileSync(join(root,'secret.txt'),'outside');symlinkSync(join(root,'secret.txt'),join(site,'link.txt'));
  // Mixed case on disk, so only a case-insensitive exclusion keeps it unserved, on any disk.
  writeFileSync(join(site,'_Redirects'),'/old /new 301\n');symlinkSync(join(site,'index.html'),join(site,'alias.html'));
  Object.assign(server,await serveStage(site));
  const get=(path,headers)=>fetch(server.origin+path,{headers,redirect:'manual'});
  let res=await get('/');
  assert.equal(res.status,200);assert.equal(res.headers.get('content-type'),'text/html; charset=utf-8');assert.equal(await res.text(),'<p>home</p>');
  for(const name of ['content-security-policy','x-frame-options','x-content-type-options','cache-control'])assert.equal(res.headers.get(name),null,name);
  res=await get('/_headers');assert.equal(res.status,404);assert.equal(await res.text(),'<p>missing</p>');
  // Mis-cased paths miss as they do on the case-sensitive host, even on a case-insensitive disk; so do symlinks.
  for(const path of ['/_HEADERS','/_Redirects','/_redirects','/SUB/','/SUB','/Sub/index.html','/Index.html','/CLIP.mp4','/alias.html']){
   res=await get(path);assert.equal(res.status,404,path);assert.equal(await res.text(),'<p>missing</p>',path);
  }
  res=await get('/sub');assert.equal(res.status,308);assert.equal(res.headers.get('location'),'/sub/');
  res=await get('/sub/');assert.equal(await res.text(),'<p>sub</p>');
  res=await get('/clip.mp4',{Range:'bytes=2-5'});
  assert.equal(res.status,206);assert.equal(res.headers.get('content-range'),'bytes 2-5/10');assert.equal(res.headers.get('content-type'),'video/mp4');assert.equal(await res.text(),'2345');
  res=await get('/clip.mp4',{Range:'bytes=-3'});assert.equal(await res.text(),'789');
  res=await get('/clip.mp4',{Range:'bytes=9-2'});assert.equal(res.status,416);await res.arrayBuffer();
  res=await get('/link.txt');assert.equal(res.status,404);await res.arrayBuffer();
  for(const path of ['/sub/..%2f..%2fsecret.txt','/a%5Cb','/a%00b','/%E0%A4%A']){res=await get(path);assert.equal(res.status,400,path);await res.arrayBuffer();}
 }finally{await server.close();rmSync(root,{recursive:true,force:true});}
});

test('the runner refuses missing arguments, a stage without site/, an output inside the stage, an existing record, and a missing Chrome before creating --out',()=>{
 const root=mkdtempSync(join(tmpdir(),'nf-cli-')),missing='/nonexistent/fleetlab-chrome';
 const run=(...args)=>{const p=spawnSync(process.execPath,[RUNNER,...args],{encoding:'utf8',env:{...process.env,FLEETLAB_CHROME:missing}});return {status:p.status,out:JSON.parse(p.stdout)};};
 try{
  assert.deepEqual(run(),{status:1,out:{ok:false,error:'--stage and --out are required'}});
  assert.deepEqual(run('--stage',root,'--out',join(root,'out')),{status:1,out:{ok:false,error:`${root} holds no site/ directory`}});
  mkdirSync(join(root,'site'));
  assert.deepEqual(run('--stage',root,'--out',join(root,'site','out')),{status:1,out:{ok:false,error:'--out must be outside the stage, which is read-only input'}});
  const out=mkdtempSync(join(tmpdir(),'nf-cli-out-'));writeFileSync(join(out,'evidence.json'),'{}');
  try{assert.deepEqual(run('--stage',root,'--out',out),{status:1,out:{ok:false,error:`${join(out,'evidence.json')} exists; a recorded run is never overwritten`}});}
  finally{rmSync(out,{recursive:true,force:true});}
  const parent=mkdtempSync(join(tmpdir(),'nf-cli-out-')),fresh=join(parent,'out');
  try{
   assert.deepEqual(run('--stage',root,'--out',fresh),{status:1,out:{ok:false,error:`Chrome not found at ${missing}; set FLEETLAB_CHROME`}});
   assert.equal(existsSync(fresh),false);
  }finally{rmSync(parent,{recursive:true,force:true});}
 }finally{rmSync(root,{recursive:true,force:true});}
});

test('recordEvidence refuses a stage whose receipt and publication commits disagree or are missing, before starting Chrome',async()=>{
 const stage=mkdtempSync(join(tmpdir(),'nf-commits-')),chrome={path:'/nonexistent/fleetlab-chrome'};
 const write=(path,data)=>{mkdirSync(join(stage,path,'..'),{recursive:true});writeFileSync(join(stage,path),JSON.stringify(data));};
 const commits=(receipt,publication)=>{write('site/downloads/teaching-package.json',{source:{commit:receipt}});write('site/publication.json',{source_commit:publication});};
 try{
  write('review/integration-manifest.json',{});
  for(const [receipt,publication] of [['a'.repeat(40),'b'.repeat(40)],[undefined,undefined],['b15055c','b15055c']]){
   commits(receipt,publication);
   await assert.rejects(recordEvidence({stage,out:join(stage,'..','unused'),chrome}),/stage source commits disagree or are missing/,`${receipt} ${publication}`);
  }
  // Agreeing commits pass this check and reach the Chrome launch.
  commits('a'.repeat(40),'a'.repeat(40));
  await assert.rejects(recordEvidence({stage,out:join(stage,'..','unused'),chrome}),/Chrome is required but not found at \/nonexistent\/fleetlab-chrome/);
 }finally{rmSync(stage,{recursive:true,force:true});}
});
