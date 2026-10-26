// Step A browser evidence (spec section 10), a runner, not a test:
// node apps/fleetlab-city/test/network-flows-evidence.mjs --stage <directory holding site/> --out <directory>
// Serves the stage's site/ from 127.0.0.1 without its _headers, drives headless Chrome over CDP, and writes evidence.json
// and its screenshots to --out. A measurement that cannot be taken is listed in notRun with its reason, never invented.
// Prints a summary and exits 1 unless the record validates.
import {createHash} from 'node:crypto';
import {existsSync,mkdirSync,readFileSync,realpathSync,statSync,writeFileSync} from 'node:fs';
import {createServer} from 'node:http';
import {extname,join,relative,resolve,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {parseArgs} from 'node:util';
import {setTimeout as sleep} from 'node:timers/promises';
import {chromePolicy,launchChrome} from './cdp-browser.mjs';
import {MEASURE,TITLES,settle} from './viewport-measure.mjs';

export const SCHEMA='fleetlab.network-flows-browser-evidence/1.0.0';
export const PAGES={hub:'/network-flows/',capacity:'/network-flows/capacity/','software-delivery':'/network-flows/software-delivery/',
 'delivery-order':'/network-flows/delivery-order/',rebalancing:'/network-flows/rebalancing/',dispatch:'/network-flows/dispatch/',depot:'/depot-readiness/'};
export const SIZES=[[320,700],[390,844],[768,1000],[1280,900]];
export const NETWORK={pages:['capacity','dispatch'],sizes:[[390,844],[1280,900]]};
// FL-A4 is the Capacity hero art. D-01 is the eager fallback diagram that, at the base, visitor.mjs puts in the Capacity
// hero and enhancement-media.mjs removes in the same task (the decoy). D-05 is the Dispatch diagram visitor.mjs inserts twice.
export const NAMED={'FL-A4':'/enhancement-media/FL-A4-capacity-hero.webp','D-01':'/diagrams/D-01-depot-scenario.webp','D-05':'/diagrams/D-05-opportunity-cost.webp'};
// The DOM hooks below are product ids and classes; the test ties each to the product source that creates it.
export const PAUSE={page:'rebalancing',size:[1280,900],video:'/site-media/r1-nf05.mp4',control:'.visitor-motion-control',flV2:'enhancement-deadhead-art',minVisible:0.25,waitMs:1000};
export const FLEET_DAY={path:'/#/fleet-day',size:[390,844],figure:'enhancement-fleet-day',a2:'/enhancement-media/FL-A2-one-fleet-day-panorama.webp',v1:'FL-V1'};
// Always listed in notRun: the runner never takes either measurement.
export const DISCLOSED={'physical-phone':'Spec section 10: the physical-phone check runs on the release candidate only.',
 'hosted-headers':'The stage is served without its _headers, so the hosted CSP, framing and cache headers are not exercised here.'};
const GOOGLE=['google.com','googletagmanager.com','google-analytics.com','googleapis.com','gstatic.com','doubleclick.net','googlesyndication.com','googleadservices.com'];
export const isGoogle=host=>GOOGLE.some(d=>host===d||host.endsWith('.'+d));
const PRIORITIES=new Set(['VeryLow','Low','Medium','High','VeryHigh']),HIGH=new Set(['High','VeryHigh']);
const size=([w,h])=>`${w}x${h}`;
export const EXPECTED=[...Object.keys(PAGES).flatMap(p=>SIZES.map(s=>`page ${p} ${size(s)}`)),
 ...NETWORK.pages.flatMap(p=>NETWORK.sizes.map(s=>`network ${p} ${size(s)}`)),'pause','fleet-day'];
export const SCOPE='Local headless Chrome over CDP with device-metrics emulation, against a built stage site/ served from 127.0.0.1 without its _headers. '+
 'Off-loopback hosts never resolve and Google hosts are blocked. prefers-reduced-motion is no-preference. Not the live site and not a physical phone.';
const METHOD='cdp-device-metrics';
const METHODS={[METHOD]:'Emulation.setDeviceMetricsOverride at the size (mobile below 500 px, deviceScaleFactor 1) with scrollbars hidden; a fresh Page.navigate per cell; '+
 'measured once scroll size and element count hold for 600 ms, capped at 5 s after load; overflowing elements are those past the width with no clipping ancestor below body; viewport PNG screenshot. '+
 'Each page cell also records its title, visibility state and document status, so a cell measured on a missing or hidden page shows it.',
 network:'One new tab per cell after Network.clearBrowserCache, unthrottled; priority is the initial priority and the last Network.resourceChangedPriority. Chrome reports a change only while the request is in flight, so on loopback a late in-viewport boost can be missed; '+
  'the initial priority is the stable figure. Before-FCP compares requestWillBeSent with the firstContentfulPaint lifecycle event of the same loader; LCP is the last buffered largest-contentful-paint entry. '+
  'Dedicated workers are auto-attached and held until Network is enabled in them, because a worker script\'s response and the worker\'s own requests (marked worker) are reported on the worker only. '+
  'After settling, the cell waits until no request is in flight for 500 ms, capped at 10 s: quietReached says whether that happened and quietWaitMs how long the wait took. '+
  'D-01 is the eager fallback diagram the base puts in the Capacity hero and removes once FL-A4 is inserted, so d01DecoyRequested says whether that removed image was still fetched.',
 pause:'r1-nf05 must be at least 25% inside the viewport and advancing before the global control is pressed with Input.dispatchMouseEvent at its centre; state is read again after 1 s.'};

const sha=data=>createHash('sha256').update(data).digest('hex');
const int=n=>Number.isSafeInteger(n)&&n>=0,num=n=>typeof n==='number'&&Number.isFinite(n),str=s=>typeof s==='string'&&s.length>0;
const hex=(s,n)=>typeof s==='string'&&new RegExp(`^[0-9a-f]{${n}}$`).test(s),bool=b=>typeof b==='boolean',list=a=>Array.isArray(a)?a:[];

// Returns the problems found; an empty list means the record is valid. With dir, screenshots are also checked on disk.
export function validate(record,{dir}={}){
 const problems=[],check=(ok,where,what)=>{if(!ok)problems.push(`${where}: ${what}`);return ok;},r=record??{};
 check(r.schema===SCHEMA,'schema',`must be ${SCHEMA}`);
 check(hex(r.source_commit,40),'source_commit','must be a 40-character hex commit');
 check(str(r.stage?.path)&&hex(r.stage?.integration_manifest_sha256,64)&&hex(r.stage?.teaching_receipt_sha256,64),'stage','needs path, integration_manifest_sha256 and teaching_receipt_sha256');
 check(str(r.browser?.product),'browser','needs the product');
 check(r.server?.headers_applied===false&&r.server?.host==='127.0.0.1','server','must be 127.0.0.1 with headers_applied false');
 check(str(r.scope),'scope','must be a statement');
 check(Array.isArray(r.notRun),'notRun','must be a list');
 const measured=[],shots=[];
 const shot=(s,where)=>{if(check(/^[a-z0-9-]+\.png$/.test(s?.name??'')&&int(s.bytes)&&s.bytes>0&&hex(s.sha256,64),where,'screenshot needs a plain .png name, bytes and sha256'))shots.push([s,where]);};
 const external=(entries,where)=>{for(const e of list(entries)){
  if(!check(str(e?.url)&&str(e?.host)&&bool(e?.google)&&bool(e?.blocked),where,'external request needs url, host, google and blocked'))continue;
  check(e.host!=='127.0.0.1'&&e.google===isGoogle(e.host),where,`${e.host} is misclassified`);check(e.blocked,where,`${e.url} left loopback`);
 }};
 for(const c of list(r.pages)){
  const where=`page ${c?.page} ${c?.width}x${c?.height}`;measured.push(where);
  check(PAGES[c?.page]===c?.path&&SIZES.some(([w,h])=>w===c?.width&&h===c?.height),where,'unknown page or size');
  check(c?.method===METHOD&&bool(c?.settled),where,'needs method and settled');
  // A cell measured on a missing page, a hidden tab or an unemulated width measured nothing.
  check(str(c?.title)&&c.title===TITLES[c.path],where,`title must be ${JSON.stringify(TITLES[c?.path])}`);
  check(c?.status===200,where,'the page document must have status 200');
  check(c?.visibility==='visible',where,'visibility must be visible, or the page may not have rendered');
  if(check(int(c?.innerWidth)&&int(c?.clientWidth)&&int(c?.scrollWidth)&&bool(c?.pageOverflow),where,'needs innerWidth, clientWidth, scrollWidth and pageOverflow')){
   check(c.clientWidth===c.width,where,'clientWidth must equal the width, or the emulated width did not take effect');
   check(c.pageOverflow===c.scrollWidth>c.width,where,'pageOverflow must equal scrollWidth > width');
  }
  check(Array.isArray(c?.offenders)&&c.offenders.every(str)&&Array.isArray(c?.consoleErrors)&&c.consoleErrors.every(str)&&Array.isArray(c?.externalRequests),where,'needs offenders, consoleErrors and externalRequests lists');
  external(c?.externalRequests,where);shot(c?.screenshot,where);
 }
 for(const c of list(r.network)){
  const where=`network ${c?.page} ${c?.width}x${c?.height}`;measured.push(where);
  check(NETWORK.pages.includes(c?.page)&&PAGES[c.page]===c.path&&NETWORK.sizes.some(([w,h])=>w===c.width&&h===c.height)&&c.cache==='cold',where,'unknown page or size, or not a cold cache');
  check(num(c?.fcpMs)&&c.fcpMs>0&&num(c?.fcpSinceRequestMs)&&num(c?.lcp?.ms)&&c.lcp.ms>0&&str(c.lcp.element),where,'needs fcpMs, fcpSinceRequestMs and lcp');
  check(bool(c?.quietReached)&&num(c?.quietWaitMs)&&c.quietWaitMs>=0,where,'needs quietReached and quietWaitMs');
  const reqs=list(c?.requests);
  check(reqs[0]?.url===c?.path&&reqs[0]?.type==='Document'&&reqs[0]?.status===200,where,'the first request must be the page document, with status 200');
  for(const q of reqs)check(str(q?.url)&&str(q?.type)&&PRIORITIES.has(q?.priority?.initial)&&PRIORITIES.has(q?.priority?.final)&&str(q?.initiator?.type)&&num(q?.startMs)
   &&q.beforeFcp===q.startMs<c.fcpSinceRequestMs,where,`request ${q?.url} needs url, type, priority, initiator, startMs and a beforeFcp that matches FCP`);
  check(c?.beforeFcpCount===reqs.filter(q=>q?.beforeFcp).length,where,'beforeFcpCount must count the before-FCP requests');
  external(reqs.filter(q=>q?.external),where);
  for(const [key,path]of Object.entries(NAMED)){
   const n=c?.named?.[key],hits=reqs.filter(q=>q?.url===path);
   check(n?.path===path&&n.requests===hits.length&&int(n.elements),where,`named ${key} must count the requests for ${path} and its elements`);
  }
  if(c?.page==='capacity'){
   const hits=reqs.filter(q=>q?.url===NAMED['FL-A4']);
   check(c.fla4GotPriority===hits.some(q=>HIGH.has(q.priority?.initial)||HIGH.has(q.priority?.final)),where,'fla4GotPriority must match the FL-A4 request priorities');
   check(c.d01DecoyRequested===c.named?.['D-01']?.requests>0,where,'d01DecoyRequested must match the D-01 requests');
  }
  if(c?.page==='dispatch')check(c.d05RequestCount===c.named?.['D-05']?.requests,where,'d05RequestCount must match the D-05 requests');
 }
 const p=r.pause;
 if(p!==null&&p!==undefined){
  measured.push('pause');
  check(p.page===PAUSE.page&&p.path===PAGES[PAUSE.page]&&p.video===PAUSE.video&&p.width===PAUSE.size[0]&&p.height===PAUSE.size[1],'pause','wrong page, video or size');
  check(num(p.nf05?.visibleRatio)&&p.nf05.visibleRatio>=PAUSE.minVisible&&p.nf05.playingConfirmed===true,'pause',`r1-nf05 must be at least ${PAUSE.minVisible*100}% visible and confirmed playing before the press`);
  check(num(p.nf05?.currentTimeBefore)&&num(p.nf05?.currentTimeAfter)&&num(p.nf05?.timeDeltaS)&&Math.abs(p.nf05.currentTimeAfter-p.nf05.currentTimeBefore-p.nf05.timeDeltaS)<1e-6&&bool(p.nf05?.pausedAfter),'pause','needs currentTimeBefore, currentTimeAfter, timeDeltaS and pausedAfter');
  check(num(p.waitMs)&&p.waitMs>=PAUSE.waitMs,'pause',`must wait at least ${PAUSE.waitMs} ms after the press`);
  check(p.control?.selector===PAUSE.control&&str(p.control?.textBefore)&&str(p.control?.textAfter)&&str(p.control?.ariaPressedAfter),'pause','needs the control state');
  check(bool(p.flV2?.before?.present)&&bool(p.flV2?.after?.present),'pause','needs the FL-V2 state before and after');
 }
 const f=r.fleetDay;
 if(f!==null&&f!==undefined){
  measured.push('fleet-day');
  check(f.path===FLEET_DAY.path&&f.width===FLEET_DAY.size[0]&&f.height===FLEET_DAY.size[1],'fleet-day','wrong route or size');
  check(bool(f.a2Present)&&(!f.a2Present||f.a2?.src===FLEET_DAY.a2),'fleet-day',`a2Present needs the A2 image ${FLEET_DAY.a2}`);
  check(int(f.v1Elements)&&int(f.v1Requests),'fleet-day','needs v1Elements and v1Requests counts');
  shot(f.screenshot,'fleet-day');
 }
 const skipped=list(r.notRun).map(n=>{check(str(n?.item)&&str(n?.reason),'notRun',`${JSON.stringify(n)} needs an item and a reason`);return n?.item;});
 check(skipped.includes('physical-phone'),'notRun','must list physical-phone, which runs on the release candidate only');
 if(r.server?.headers_applied===false)check(skipped.includes('hosted-headers'),'notRun','must list hosted-headers while headers_applied is false');
 for(const item of EXPECTED){
  const n=measured.filter(m=>m===item).length+skipped.filter(s=>s===item).length;
  check(n===1,item,n?'is measured or listed in notRun more than once':'is neither measured nor listed in notRun');
 }
 for(const item of new Set(measured))check(EXPECTED.includes(item),item,'is not an expected measurement');
 check(new Set(skipped).size===skipped.length,'notRun','items must be unique');
 check(new Set(shots.map(([s])=>s.name)).size===shots.length,'screenshots','names must be unique');
 if(dir)for(const [s,where]of shots){
  let data=null;try{data=readFileSync(join(dir,s.name));}catch{}
  check(data&&data.length===s.bytes&&sha(data)===s.sha256,where,`${s.name} is missing or differs from its record`);
 }
 return problems;
}

const TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8',
 '.json':'application/json','.xml':'application/xml','.txt':'text/plain; charset=utf-8','.md':'text/markdown; charset=utf-8','.csv':'text/csv; charset=utf-8',
 '.sha256':'text/plain; charset=utf-8','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.mp4':'video/mp4','.gz':'application/gzip'};

// Pages-like static serving: a directory needs its trailing slash and serves index.html, a miss serves 404.html, byte
// ranges are honoured, and _headers and _redirects, in any case, are never served or applied. Only Content-Type and range
// headers are sent. A path is served only when it names the file exactly, so a symlink or a mis-cased path is a miss even
// on a case-insensitive disk, as on the case-sensitive host.
export function serveStage(site){
 const root=realpathSync.native(site),exact=path=>{try{return realpathSync.native(path)===path?statSync(path):null;}catch{return null;}};
 const inside=path=>exact(path)?.isFile()?path:null;
 const server=createServer((req,res)=>{
  const send=(status,headers,body)=>{res.writeHead(status,headers);res.end(req.method==='HEAD'?undefined:body);};
  let path;try{path=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);}catch{return send(400,{},'');}
  const parts=path.split('/').slice(1);
  if(parts.some(p=>p==='.'||p==='..'||/[\0\\]/.test(p)))return send(400,{},'');
  const target=join(root,...parts);
  if(!path.endsWith('/')&&exact(target)?.isDirectory())return send(308,{Location:path+'/'},'');
  const file=['/_headers','/_redirects'].includes(path.toLowerCase())?null:inside(path.endsWith('/')?join(target,'index.html'):target);
  if(!file){const missing=inside(join(root,'404.html'));return send(404,{'Content-Type':TYPES['.html']},missing?readFileSync(missing):'Not found');}
  const data=readFileSync(file),type=TYPES[extname(file)]??'application/octet-stream',m=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range??'');
  if(!m)return send(200,{'Content-Type':type,'Accept-Ranges':'bytes','Content-Length':data.length},data);
  const start=m[1]?Number(m[1]):Math.max(0,data.length-Number(m[2])),end=m[1]&&m[2]?Math.min(Number(m[2]),data.length-1):data.length-1;
  if(!(m[1]||m[2])||start>end)return send(416,{'Content-Range':`bytes */${data.length}`},'');
  send(206,{'Content-Type':type,'Accept-Ranges':'bytes','Content-Range':`bytes ${start}-${end}/${data.length}`,'Content-Length':end-start+1},data.subarray(start,end+1));
 });
 return new Promise((resolve_,reject)=>{
  server.once('error',reject);
  server.listen(0,'127.0.0.1',()=>resolve_({origin:`http://127.0.0.1:${server.address().port}`,close:()=>new Promise(done=>{server.closeAllConnections();server.close(done);})}));
 });
}

// Visible fraction of an element's box inside the viewport, and its media state when it is a video.
const STATE=`(el=>{if(!el)return null;const r=el.getBoundingClientRect(),w=Math.max(0,Math.min(r.right,innerWidth)-Math.max(r.left,0)),h=Math.max(0,Math.min(r.bottom,innerHeight)-Math.max(r.top,0));
 const v=el.localName==='video'?el:el.querySelector('video');
 return {visibleRatio:r.width*r.height?w*h/(r.width*r.height):0,...(v?{paused:v.paused,currentTime:v.currentTime,readyState:v.readyState,hidden:v.hidden,src:v.getAttribute('src')}:{})};})`;
const NF05=`${STATE}(document.querySelector('video[data-src="${PAUSE.video}"]'))`;
const FLV2=`(()=>{const f=document.getElementById('${PAUSE.flV2}');return f?{present:true,state:f.getAttribute('data-concept-state'),...${STATE}(f)}:{present:false};})()`;
const CONTROL=`(()=>{const c=document.querySelector('${PAUSE.control}');if(!c)return null;const r=c.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2,hit=document.elementFromPoint(x,y);
 return {x,y,hit:!!hit&&c.contains(hit),text:c.textContent,ariaPressed:c.getAttribute('aria-pressed'),visitorMotion:document.documentElement.getAttribute('data-visitor-motion')};})()`;

// One tab; the events of the current navigation only are kept, so each cell is measured from its own events. Its
// dedicated workers get the same network setup, since their script responses and requests arrive on their own sessions.
async function openTab(browser,origin,[width,height]){
 const page=await browser.newPage();let events=[];page.on(m=>events.push(m));
 const network=async send=>{await send('Network.enable');await send('Network.setBlockedURLs',{urlPatterns:GOOGLE.flatMap(d=>[`*://${d}/*`,`*://*.${d}/*`]).map(urlPattern=>({urlPattern,block:true}))});};
 await network(page.send);await page.attachChildren(network);
 await page.send('Page.setLifecycleEventsEnabled',{enabled:true});
 await page.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
 await page.emulate({width,height,mobile:width<500});
 const strip=s=>String(s).split(origin).join('');
 return {...page,strip,events:()=>events,async go(path){events=[];await page.navigate(origin+path);},
  requests(){
   const byId=new Map();
   for(const {method,params:p,sessionId}of events){
    const q=byId.get(p?.requestId);
    if(method==='Network.requestWillBeSent'&&/^https?:/.test(p.request.url)&&!q)byId.set(p.requestId,{raw:p.request.url,type:p.type,initiator:p.initiator,loaderId:p.loaderId,ts:p.timestamp,
     priority:{initial:p.request.initialPriority,final:p.request.initialPriority},status:null,errorText:null,done:false,worker:sessionId!==page.sessionId});
    else if(!q)continue;
    else if(method==='Network.resourceChangedPriority')q.priority.final=p.newPriority;
    else if(method==='Network.responseReceived')q.status=p.response.status;
    else if(method==='Network.loadingFinished')q.done=true;
    else if(method==='Network.loadingFailed'){q.done=true;q.errorText=p.errorText||p.blockedReason||'failed';}
   }
   return [...byId.values()].map(q=>{const host=new URL(q.raw).hostname,external=!q.raw.startsWith(origin+'/');
    return {...q,url:external?q.raw:strip(q.raw),host,external,google:isGoogle(host),blocked:q.status===null&&q.errorText!==null};});
  },
  consoleErrors(){
   const out=[];
   for(const {method,params:p}of events){
    if(method==='Runtime.exceptionThrown')out.push('exception '+(p.exceptionDetails.exception?.description??p.exceptionDetails.text));
    else if(method==='Runtime.consoleAPICalled'&&p.type==='error')out.push('console '+p.args.map(a=>a.value??a.description).join(' '));
    // Failed off-loopback loads are recorded as external requests instead.
    else if(method==='Log.entryAdded'&&p.entry.level==='error'&&!(p.entry.source==='network'&&p.entry.url&&!p.entry.url.startsWith(origin+'/')))out.push(p.entry.source+' '+p.entry.text);
   }
   return out.map(strip);
  },
  async screenshot(out,name){
   const {data}=await page.send('Page.captureScreenshot',{format:'png'}),bytes=Buffer.from(data,'base64');
   writeFileSync(join(out,name),bytes);return {name,bytes:bytes.length,sha256:sha(bytes)};
  }};
}
const externals=tab=>tab.requests().filter(q=>q.external).map(({url,host,google,blocked,errorText})=>({url,host,google,blocked,errorText}));
const until=async(fn,ms,step=100)=>{const end=Date.now()+ms;for(;;){const v=await fn();if(v||Date.now()>=end)return v;await sleep(step);}};
const documentOf=(tab,path)=>tab.requests().find(q=>q.type==='Document'&&q.url===path);

async function pageCell(tab,name,[width,height],out){
 await tab.go(PAGES[name]);
 const settled=await settle(tab),m=await tab.evaluate(MEASURE(width));
 return {page:name,path:PAGES[name],width,height,method:METHOD,title:m.title,status:documentOf(tab,PAGES[name])?.status??null,visibility:m.visibility,settled,
  innerWidth:m.innerWidth,clientWidth:m.clientWidth,scrollWidth:m.scrollWidth,
  pageOverflow:m.scrollWidth>width,offenders:m.over,consoleErrors:tab.consoleErrors(),externalRequests:externals(tab),screenshot:await tab.screenshot(out,`${name}-${width}x${height}.png`)};
}

async function networkCell(tab,name,[width,height]){
 await tab.send('Network.clearBrowserCache');await tab.go(PAGES[name]);await settle(tab);
 // Lazy and late requests: wait until nothing is in flight for 500 ms, capped at 10 s.
 const waited=Date.now();let quiet=waited;
 const quietReached=await until(()=>{if(tab.requests().some(q=>!q.done))quiet=Date.now();return Date.now()-quiet>=500;},10000),quietWaitMs=Date.now()-waited;
 const all=tab.requests(),doc=documentOf(tab,PAGES[name]);
 if(!doc)throw Error(`no document request for ${PAGES[name]}`);
 const fcp=tab.events().find(({method,params:p})=>method==='Page.lifecycleEvent'&&p.name==='firstContentfulPaint'&&p.loaderId===doc.loaderId);
 if(!fcp)throw Error('no firstContentfulPaint lifecycle event for the page document');
 const ms=ts=>Math.round((ts-doc.ts)*1e6)/1e3,fcpSinceRequestMs=ms(fcp.params.timestamp);
 const page=await tab.evaluate(`new Promise(done=>{let last=null;new PerformanceObserver(l=>{const e=l.getEntries();last=e[e.length-1];}).observe({type:'largest-contentful-paint',buffered:true});
  setTimeout(()=>{const fcp=performance.getEntriesByName('first-contentful-paint')[0],el=last?.element,img=src=>[...document.images].filter(i=>i.getAttribute('src')===src);
   const a4=img(${JSON.stringify(NAMED['FL-A4'])})[0],r=a4?.getBoundingClientRect();
   done({fcpMs:fcp?fcp.startTime:null,lcp:last&&{ms:last.startTime,size:last.size,url:last.url?new URL(last.url).pathname:null,element:el?el.localName+(el.id?'#'+el.id:'')+(el.getAttribute('src')?' '+el.getAttribute('src'):''):'(removed)'},
    elements:Object.fromEntries(Object.entries(${JSON.stringify(NAMED)}).map(([k,s])=>[k,img(s).length])),
    fla4:a4?{loading:a4.getAttribute('loading'),fetchpriority:a4.getAttribute('fetchpriority'),top:Math.round(r.top),inFirstViewport:r.top<innerHeight&&r.bottom>0}:null});},200);})`);
 if(!page.fcpMs||!page.lcp)throw Error('the page reported no first-contentful-paint or largest-contentful-paint entry');
 const requests=all.filter(q=>q.ts>=doc.ts).map(q=>{const i=q.initiator??{},frame=i.stack?.callFrames?.[0];
  return {url:q.url,type:q.type,priority:q.priority,initiator:{type:i.type??'other',...(i.url?{url:tab.strip(i.url)}:{}),...(num(i.lineNumber)?{line:i.lineNumber}:{}),...(frame?{frame:`${tab.strip(frame.url)}:${frame.lineNumber}`}:{})},
   startMs:ms(q.ts),beforeFcp:ms(q.ts)<fcpSinceRequestMs,status:q.status,errorText:q.errorText,...(q.worker?{worker:true}:{}),...(q.external?{external:true,host:q.host,google:q.google,blocked:q.blocked}:{})};});
 const named=Object.fromEntries(Object.entries(NAMED).map(([key,path])=>{const hits=requests.filter(q=>q.url===path);
  return [key,{path,requests:hits.length,priorities:hits.map(q=>q.priority),beforeFcp:hits.some(q=>q.beforeFcp),elements:page.elements[key]}];}));
 const cell={page:name,path:PAGES[name],width,height,cache:'cold',quietReached,quietWaitMs,fcpMs:page.fcpMs,fcpSinceRequestMs,lcp:page.lcp,beforeFcpCount:requests.filter(q=>q.beforeFcp).length,named};
 if(name==='capacity')Object.assign(cell,{fla4GotPriority:named['FL-A4'].priorities.some(p=>HIGH.has(p.initial)||HIGH.has(p.final)),fla4Element:page.fla4,d01DecoyRequested:named['D-01'].requests>0});
 if(name==='dispatch')cell.d05RequestCount=named['D-05'].requests;
 return {...cell,consoleErrors:tab.consoleErrors(),requests};
}

async function pauseCheck(tab){
 const [width,height]=PAUSE.size;await tab.go(PAGES[PAUSE.page]);await settle(tab);
 let nf05=await tab.evaluate(NF05);
 if(!nf05)throw Error(`no video with data-src ${PAUSE.video}`);
 if(nf05.visibleRatio<PAUSE.minVisible){await tab.evaluate(`document.querySelector('video[data-src="${PAUSE.video}"]').scrollIntoView({block:'center'})`);nf05=await tab.evaluate(NF05);}
 if(nf05.visibleRatio<PAUSE.minVisible)throw Error(`r1-nf05 is only ${Math.round(nf05.visibleRatio*100)}% visible`);
 let previous=nf05;
 const playing=await until(async()=>{const now=await tab.evaluate(NF05),ok=!now.paused&&!previous.paused&&now.currentTime>previous.currentTime;previous=now;return ok;},10000,250);
 if(!playing)throw Error(`r1-nf05 was not confirmed playing within 10 s (paused ${previous.paused}, readyState ${previous.readyState}, currentTime ${previous.currentTime})`);
 const control=await tab.evaluate(CONTROL);
 if(!control)throw Error(`no ${PAUSE.control} on the page`);
 if(!control.hit)throw Error(`${PAUSE.control} is covered at its centre`);
 const flV2Before=await tab.evaluate(FLV2),before=await tab.evaluate(NF05),pressed=Date.now();
 for(const type of ['mousePressed','mouseReleased'])await tab.send('Input.dispatchMouseEvent',{type,x:control.x,y:control.y,button:'left',clickCount:1});
 await sleep(PAUSE.waitMs);
 const after=await tab.evaluate(NF05),waitMs=Date.now()-pressed,controlAfter=await tab.evaluate(CONTROL),flV2After=await tab.evaluate(FLV2);
 // Bring FL-V2 into view under the paused control, to see whether it stays on its poster.
 await tab.evaluate(`document.getElementById('${PAUSE.flV2}')?.scrollIntoView({block:'center'})`);await sleep(PAUSE.waitMs);
 const flV2InView=await tab.evaluate(FLV2);
 return {page:PAUSE.page,path:PAGES[PAUSE.page],width,height,video:PAUSE.video,waitMs,
  nf05:{visibleRatio:before.visibleRatio,playingConfirmed:true,pausedBefore:before.paused,pausedAfter:after.paused,currentTimeBefore:before.currentTime,currentTimeAfter:after.currentTime,
   timeDeltaS:after.currentTime-before.currentTime,visibleRatioAfter:after.visibleRatio},
  control:{selector:PAUSE.control,pressedBy:'Input.dispatchMouseEvent',textBefore:control.text,textAfter:controlAfter.text,ariaPressedAfter:controlAfter.ariaPressed,
   visitorMotionBefore:control.visitorMotion,visitorMotionAfter:controlAfter.visitorMotion},
  flV2:{before:flV2Before,after:flV2After,inViewAfterPause:flV2InView},consoleErrors:tab.consoleErrors()};
}

async function fleetDay(tab,out){
 const [width,height]=FLEET_DAY.size;await tab.go(FLEET_DAY.path);await settle(tab);
 await until(()=>tab.evaluate(`!!document.getElementById('${FLEET_DAY.figure}')`),5000);
 const m=await tab.evaluate(`(()=>{const f=document.getElementById('${FLEET_DAY.figure}'),i=f?.querySelector('img'),r=i?.getBoundingClientRect(),v1=${JSON.stringify(FLEET_DAY.v1)};
  return {title:document.title,h1:document.querySelector('.operations-lab .ops-teaching h1')?.textContent??null,
   a2:i?{src:i.getAttribute('src'),loading:i.getAttribute('loading'),complete:i.complete,naturalWidth:i.naturalWidth,top:Math.round(r.top)}:null,videosInA2:f?f.querySelectorAll('video').length:0,
   v1Elements:[...document.querySelectorAll('*')].filter(e=>[...e.attributes].some(a=>a.value.includes(v1))).length};})()`);
 return {path:FLEET_DAY.path,width,height,title:m.title,h1:m.h1,a2Present:m.a2?.src===FLEET_DAY.a2,a2:m.a2,videosInA2:m.videosInA2,v1Elements:m.v1Elements,
  v1Requests:tab.requests().filter(q=>q.url.includes(FLEET_DAY.v1)).length,consoleErrors:tab.consoleErrors(),externalRequests:externals(tab),screenshot:await tab.screenshot(out,`fleet-day-${width}x${height}.png`)};
}

export async function recordEvidence({stage,out,chrome=chromePolicy()}){
 const site=join(stage,'site'),bytes=path=>readFileSync(join(stage,path));
 const manifest=bytes('review/integration-manifest.json'),receipt=bytes('site/downloads/teaching-package.json');
 const commits=[JSON.parse(receipt).source?.commit,JSON.parse(bytes('site/publication.json')).source_commit];
 if(!hex(commits[0],40)||commits[0]!==commits[1])throw Error(`stage source commits disagree or are missing: ${commits.join(', ')}`);
 const server=await serveStage(site);let browser;
 try{browser=await launchChrome(chrome.path);}catch(error){await server.close();throw error;}
 const notRun=Object.entries(DISCLOSED).map(([item,reason])=>({item,reason}));
 const attempt=async(item,fn)=>{try{return await fn();}catch(error){notRun.push({item,reason:String(error.message).split(server.origin).join('')});return null;}};
 const inTab=async(s,fn)=>{const tab=await openTab(browser,server.origin,s);try{return await fn(tab);}finally{await tab.close();}};
 const record={schema:SCHEMA,source_commit:commits[0],recorded_at:new Date().toISOString(),
  stage:{path:resolve(stage),integration_manifest_sha256:sha(manifest),teaching_receipt_sha256:sha(receipt)},
  browser:{product:browser.version.product,revision:browser.version.revision,protocolVersion:browser.version.protocolVersion,userAgent:browser.version.userAgent,headless:true},
  server:{host:'127.0.0.1',headers_applied:false,ranges:true,notFound:'404.html'},runner:{node:process.version,platform:`${process.platform} ${process.arch}`},
  scope:SCOPE,methods:METHODS,notRun,pages:[],network:[],pause:null,fleetDay:null};
 try{
  for(const s of SIZES)await inTab(s,async tab=>{for(const name of Object.keys(PAGES)){const cell=await attempt(`page ${name} ${size(s)}`,()=>pageCell(tab,name,s,out));if(cell)record.pages.push(cell);}});
  // A new tab per network cell, so no earlier load is in its memory cache.
  for(const name of NETWORK.pages)for(const s of NETWORK.sizes){const cell=await attempt(`network ${name} ${size(s)}`,()=>inTab(s,tab=>networkCell(tab,name,s)));if(cell)record.network.push(cell);}
  record.pause=await attempt('pause',()=>inTab(PAUSE.size,pauseCheck));
  record.fleetDay=await attempt('fleet-day',()=>inTab(FLEET_DAY.size,tab=>fleetDay(tab,out)));
 }finally{await server.close();await browser.close();}
 return record;
}

function headline(r){
 return {pagesMeasured:r.pages.length,overflowing:r.pages.filter(c=>c.pageOverflow).map(c=>`${c.page} ${c.width}x${c.height} (${c.scrollWidth})`),
  consoleErrors:r.pages.reduce((n,c)=>n+c.consoleErrors.length,0),externalRequests:[...new Set(r.pages.flatMap(c=>c.externalRequests.map(e=>e.host)))],
  network:r.network.map(c=>({cell:`${c.page} ${c.width}x${c.height}`,quiet:`${c.quietReached} after ${c.quietWaitMs} ms`,fcpMs:c.fcpMs,lcp:`${Math.round(c.lcp.ms)} ms ${c.lcp.element}`,beforeFcp:c.beforeFcpCount,
   ...(c.page==='capacity'?{fla4GotPriority:c.fla4GotPriority,fla4Priority:c.named['FL-A4'].priorities.map(p=>p.initial+'>'+p.final).join(' '),d01DecoyRequested:c.d01DecoyRequested}:{d05RequestCount:c.d05RequestCount})})),
  pause:r.pause&&{pausedAfter:r.pause.nf05.pausedAfter,timeDeltaS:r.pause.nf05.timeDeltaS,flV2:[r.pause.flV2.before.state,r.pause.flV2.after.state,r.pause.flV2.inViewAfterPause.state]},
  fleetDay:r.fleetDay&&{a2Present:r.fleetDay.a2Present,v1Elements:r.fleetDay.v1Elements},notRun:r.notRun.map(n=>n.item)};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 let summary;
 try{
  const {values:{stage,out}}=parseArgs({options:{stage:{type:'string'},out:{type:'string'}}});
  if(!stage||!out)throw Error('--stage and --out are required');
  if(!existsSync(join(stage,'site')))throw Error(`${stage} holds no site/ directory`);
  const from=relative(resolve(stage),resolve(out));
  if(!(from==='..'||from.startsWith('..'+sep)))throw Error('--out must be outside the stage, which is read-only input');
  if(existsSync(join(out,'evidence.json')))throw Error(`${join(out,'evidence.json')} exists; a recorded run is never overwritten`);
  const chrome=chromePolicy();
  if(!chrome.found)throw Error(`Chrome not found at ${chrome.path}; set FLEETLAB_CHROME`);
  mkdirSync(out,{recursive:true});
  const record=await recordEvidence({stage,out,chrome}),problems=validate(record,{dir:out});
  writeFileSync(join(out,'evidence.json'),JSON.stringify(record,null,1)+'\n');
  summary={ok:problems.length===0,evidence:join(out,'evidence.json'),problems,headline:headline(record)};
 }catch(error){summary={ok:false,error:error.message};}
 console.log(JSON.stringify(summary,null,1));
 process.exitCode=summary.ok?0:1;
}
