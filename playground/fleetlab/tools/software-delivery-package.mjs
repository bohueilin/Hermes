import {R3_FILES,R3_ENTRIES,R3_MODULES,R3_RELEASE} from './dispatch-package.mjs';
import {R1_FILES,R1_ENTRIES,R1_MODULES,R1_RELEASE} from './rebalancing-package.mjs';
// Physical owners are explicit. Reachability adds obligations, never removes legacy ownership.
import {ORDER_FILES,ORDER_ENTRIES,ORDER_MODULES,ORDER_RELEASE} from './delivery-order-package.mjs';
import {DEPOT_FILES,DEPOT_ENTRIES,DEPOT_MODULES,DEPOT_RELEASE} from './depot-lab-package.mjs';
import {createHash} from 'node:crypto';
import {posix} from 'node:path';
import {MEDIA_LIMITS} from './media.mjs';
import {renderSitePage} from './site-shell.mjs';
import {parseModule} from './pack.mjs';
export const DELIVERY_DIR='network-flows/software-delivery';
export const DELIVERY_RELEASE=`${DELIVERY_DIR}/release.json`;
export const DELIVERY_FILES=[`${DELIVERY_DIR}/index.html`,`${DELIVERY_DIR}/boot.js`,`${DELIVERY_DIR}/visual.css`,DELIVERY_RELEASE];
export const DELIVERY_ENTRIES=['src/ui/software-delivery-app.js','src/runtime/software-delivery-worker.js','src/data/software-delivery-study.js'];
export const DELIVERY_MODULES=new Set([...DELIVERY_ENTRIES,'src/runtime/software-delivery-job.js','src/model/software-delivery-contract.js','src/model/software-delivery.js','src/model/software-delivery-verify.js','src/data/software-delivery-study.js','src/ui/software-delivery-view.js','src/ui/software-delivery-page.js','src/ui/software-delivery-player.js']);
export const DELIVERY_BOOT='import { startSoftwareDelivery } from "../../src/ui/software-delivery-app.js";\nimport { DELIVERY_STUDY } from "../../src/data/software-delivery-study.js";\nstartSoftwareDelivery({ manifest: DELIVERY_STUDY, createWorker: () => new Worker(new URL("../../src/runtime/software-delivery-worker.js", import.meta.url), { type: "module" }) });\n';
export const INTEGRATION_TEXT_PATHS=['city-explorer/releases/index.html','brand.mjs','brand.css','visitor.mjs','visitor-families.mjs','visitor.css','enhancement-motion.mjs','enhancement-media.mjs','enhancement-media.css','index.html','boot.js','_headers','integration.mjs','integration.css','publication.json','404.html','network-flows/fleet-day/index.html','network-flows/index.html','network-flows/hub.css','network-flows/ota-sharing/index.html','sitemap.xml','not-found.css','downloads/fleetlab-offline.sha256','downloads/verify-offline.txt'];
// Q6: the integrated text ceiling rises to 3,801,088 and the depot gets its own branch; every other cap is unchanged.
export const OWNER_LIMITS=Object.freeze({legacy_text_bytes:2621440,emitted_text_bytes:3801088,nf04_closure_bytes:524288,depot_route_local_bytes:524288,depot_closure_bytes:786432});
const CLOSURE_LIMITS={nf03:557056,depot:OWNER_LIMITS.depot_closure_bytes};
const LEGACY_ENTRIES=['src/ui/app.js','src/runtime/worker.js','src/ui/capacity-app.js'];
const LEGACY_ASSETS=['index.html','boot.js','styles.css','_headers','network-flows/capacity/index.html','network-flows/capacity/boot.js','network-flows/capacity/visual.css','network-flows/capacity/release.json'];
const NF03_ASSETS=['styles.css','network-flows/capacity/index.html','network-flows/capacity/boot.js','network-flows/capacity/visual.css'];
const MEDIA=new Set(MEDIA_LIMITS.keys());
const DELIVERY_SOURCE_ASSETS=['software-delivery/index.html','software-delivery/visual.css','tools/pack.mjs','tools/software-delivery-package.mjs','tools/release-sidecar.mjs','tools/site-shell.mjs','tools/check-dist.mjs','tools/media.mjs','tools/comment-strip.mjs'];
const fail=message=>{throw new Error(`ownership: ${message}`);};
const size=value=>Buffer.byteLength(value);
const canonical=value=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);
const hash=data=>createHash('sha256').update(data).digest('hex');
const fingerprint=data=>({bytes:size(data),sha256:hash(data)});
const sum=(files,paths)=>[...paths].reduce((value,path)=>value+size(files.get(path)),0);
export function routeModules(files,entries){
  const result=new Set(),pending=new Set();
  const visit=path=>{
    if(result.has(path))return;
    if(pending.has(path))fail(`import cycle: ${path}`);
    if(!files.has(path)||!path.startsWith('src/'))fail(`missing or external dependency: ${path}`);
    pending.add(path);
    const parsed=parseModule(String(files.get(path)),path);
    for(const item of [...parsed.imports,...parsed.exports])if(item.specifier){
      if(!item.specifier.startsWith('.'))fail(`nonlocal dependency: ${path}`);
      visit(posix.normalize(posix.join(posix.dirname(path),item.specifier)));
    }
    pending.delete(path);result.add(path);
  };
  for(const path of entries)visit(path);
  return result;
}
export function capacityScope(files){return new Set([...routeModules(files,['src/ui/capacity-app.js']),...NF03_ASSETS]);}
export function measureSiteOwnership(files){
  const legacyModules=routeModules(files,LEGACY_ENTRIES);
  const hasDelivery=[...files.keys()].some(path=>DELIVERY_FILES.includes(path)||DELIVERY_MODULES.has(path));
  const delivery=hasDelivery?routeModules(files,DELIVERY_ENTRIES):new Set();
  const hasOrder=[...files.keys()].some(path=>ORDER_FILES.includes(path)||ORDER_MODULES.has(path));
  const order=hasOrder?routeModules(files,ORDER_ENTRIES):new Set();
  const hasR1=files.has(R1_RELEASE),r1=hasR1?routeModules(files,R1_ENTRIES):new Set();
  const hasR3=files.has(R3_RELEASE),r3=hasR3?routeModules(files,R3_ENTRIES):new Set();
  const hasDepot=files.has(DEPOT_RELEASE),depot=hasDepot?routeModules(files,DEPOT_ENTRIES):new Set();
  const legacy=new Set([...legacyModules,...LEGACY_ASSETS].filter(path=>files.has(path)));
  // A dependency not in the newly declared NF04 inventory remains legacy-owned even when only NF04 imports it.
  for(const path of delivery)if(!DELIVERY_MODULES.has(path))legacy.add(path);
  for(const path of order)if(!ORDER_MODULES.has(path)&&!DELIVERY_MODULES.has(path))legacy.add(path);
  for(const path of r1)if(!R1_MODULES.has(path)&&!ORDER_MODULES.has(path)&&!DELIVERY_MODULES.has(path))legacy.add(path);
  for(const path of r3)if(!R3_MODULES.has(path)&&!R1_MODULES.has(path)&&!ORDER_MODULES.has(path)&&!DELIVERY_MODULES.has(path))legacy.add(path);
  // Depot dependencies are declared or already owned (shared leaves stay legacy); nothing falls through to legacy.
  for(const path of depot)if(!DEPOT_MODULES.has(path)&&!legacy.has(path)&&![DELIVERY_MODULES,ORDER_MODULES,R1_MODULES,R3_MODULES].some(set=>set.has(path)))fail(`undeclared depot dependency: ${path}`);
  const route=new Set(hasDelivery?[...delivery,...DELIVERY_FILES.filter(path=>files.has(path)),'_headers']:[]);
  const local=new Set([...route].filter(path=>!legacy.has(path)&&(DELIVERY_FILES.includes(path)||DELIVERY_MODULES.has(path))));
  const orderRoute=new Set(hasOrder?[...order,...ORDER_FILES.filter(path=>files.has(path)),'_headers']:[]);
  const orderLocal=new Set([...orderRoute].filter(path=>!legacy.has(path)&&!local.has(path)&&(ORDER_FILES.includes(path)||ORDER_MODULES.has(path))));
  const r1Route=new Set(hasR1?[...r1,...R1_FILES,'_headers']:[]),r1Local=new Set([...r1Route].filter(p=>!legacy.has(p)&&!local.has(p)&&!orderLocal.has(p)&&(R1_FILES.includes(p)||R1_MODULES.has(p))));
  const r3Route=new Set(hasR3?[...r3,...R3_FILES,'_headers']:[]),r3Local=new Set([...r3Route].filter(p=>!legacy.has(p)&&!local.has(p)&&!orderLocal.has(p)&&!r1Local.has(p)&&(R3_FILES.includes(p)||R3_MODULES.has(p))));
  const depotRoute=new Set(hasDepot?[...depot,...DEPOT_FILES,'_headers']:[]),depotLocal=new Set([...depotRoute].filter(p=>!legacy.has(p)&&(DEPOT_FILES.includes(p)||DEPOT_MODULES.has(p))));
  const owners={};
  for(const path of files.keys()){
    if(MEDIA.has(path)){owners[path]='teaching-media';continue;}
    if(legacy.has(path))owners[path]=delivery.has(path)?'legacy-shared':'legacy';
    else if(local.has(path))owners[path]='nf04';
    else if(orderLocal.has(path))owners[path]='delivery-order';
    else if(r1Local.has(path))owners[path]='rebalancing';
    else if(r3Local.has(path))owners[path]='dispatch';
    else if(depotLocal.has(path))owners[path]='depot-lab';
    else fail(`unknown emitted ownership: ${path}`);
  }
  const result={legacy_text_bytes:sum(files,legacy),nf04_route_local_bytes:sum(files,local),nf04_closure_bytes:sum(files,route),emitted_text_bytes:[...files].filter(([path])=>!MEDIA.has(path)).reduce((n,[,value])=>n+size(value),0),owners,nf04_paths:[...route].sort()};
  if(hasOrder){result.delivery_order_route_local_bytes=sum(files,orderLocal);result.delivery_order_closure_bytes=sum(files,orderRoute);result.delivery_order_paths=[...orderRoute].sort();if(result.delivery_order_closure_bytes>524288)fail('delivery order closure budget exceeded');}
  if(hasR1){result.r1_route_local_bytes=sum(files,r1Local);result.r1_closure_bytes=sum(files,r1Route);if(result.r1_closure_bytes>524288)fail('R1 closure budget exceeded');}
  if(hasR3){result.r3_route_local_bytes=sum(files,r3Local);result.r3_closure_bytes=sum(files,r3Route);if(result.r3_closure_bytes>524288)fail('R3 closure budget exceeded');}
  if(hasDepot){result.depot_route_local_bytes=sum(files,depotLocal);result.depot_closure_bytes=sum(files,depotRoute);result.depot_paths=[...depotRoute].sort();}
  for(const [key,limit]of Object.entries(OWNER_LIMITS))if(result[key]>limit)fail(`${key} budget exceeded: ${result[key]} > ${limit}`);
  return result;
}
export function measureIntegratedText(teaching,integrated){
  const paths=new Set([...teaching.keys()].filter(path=>!MEDIA.has(path)));
  for(const path of INTEGRATION_TEXT_PATHS)if(integrated.has(path))paths.add(path);
  for(const path of paths)if(!integrated.has(path))fail(`missing integrated teaching path: ${path}`);
  const emitted_text_bytes=sum(integrated,paths),integration_text_bytes=sum(integrated,INTEGRATION_TEXT_PATHS.filter(path=>integrated.has(path)));
  if(emitted_text_bytes>OWNER_LIMITS.emitted_text_bytes)fail(`aggregate emitted text budget exceeded: ${emitted_text_bytes} > ${OWNER_LIMITS.emitted_text_bytes}`);
  const result={emitted_text_bytes,integration_text_bytes};
  const closures=[
    ...(teaching.has(R3_RELEASE)?[['r3',new Set([...routeModules(teaching,R3_ENTRIES),...R3_FILES,'_headers'])]]:[]),
    ...(teaching.has(R1_RELEASE)?[['r1',new Set([...routeModules(teaching,R1_ENTRIES),...R1_FILES,'_headers'])]]:[]),
    ...(teaching.has(ORDER_RELEASE)?[["delivery_order",new Set([...routeModules(teaching,ORDER_ENTRIES),...ORDER_FILES,"_headers"])]]:[]),
    ...(teaching.has(DELIVERY_RELEASE)?[['nf04',new Set([...routeModules(teaching,DELIVERY_ENTRIES),...DELIVERY_FILES,'_headers'])]]:[]),
    ...(teaching.has('src/ui/capacity-app.js')?[['nf03',new Set([...capacityScope(teaching),'network-flows/capacity/release.json','_headers'])]]:[]),
    ...(teaching.has(DEPOT_RELEASE)?[['depot',new Set([...routeModules(teaching,DEPOT_ENTRIES),...DEPOT_FILES,'_headers'])]]:[]),
  ];
  for(const [id,closure]of closures){
    for(const path of ["brand.mjs","brand.css","visitor.mjs","visitor-families.mjs","visitor.css","enhancement-motion.mjs","enhancement-media.mjs","enhancement-media.css"])if(integrated.has(path))closure.add(path);
    const count=sum(integrated,closure);result[`${id}_closure_bytes`]=count;
    const limit=CLOSURE_LIMITS[id]??524288;
    if(count>limit)fail(`${id} final closure byte budget exceeded: ${count} > ${limit}`);
    if(id==='depot'){
      // Depot-owned text after hosted transforms (the page gains the shell); shared leaves keep their legacy owner.
      const legacy=routeModules(teaching,LEGACY_ENTRIES.filter(path=>teaching.has(path)));
      const local=sum(integrated,[...closure].filter(path=>!legacy.has(path)&&(DEPOT_FILES.includes(path)||DEPOT_MODULES.has(path))));
      result.depot_route_local_bytes=local;
      if(local>OWNER_LIMITS.depot_route_local_bytes)fail(`depot final route-local byte budget exceeded: ${local} > ${OWNER_LIMITS.depot_route_local_bytes}`);
    }
  }
  return result;
}
export function createSoftwareDeliverySidecar(files,source,source_files,page_source){
  const paths=[...routeModules(files,DELIVERY_ENTRIES),...DELIVERY_FILES.filter(path=>path!==DELIVERY_RELEASE),'_headers'];
  const payload={schema:'fleetlab.software-delivery-release/1.0.0',source,source_files,page_source,emitted_scope:'NF04_SOFTWARE_DELIVERY_ROUTE_CLOSURE_V1',emitted_files:Object.fromEntries(paths.filter(path=>path!=='_headers').sort().map(path=>[path,fingerprint(files.get(path))])),authenticity:'NOT_AUTHENTICATED',deployment_permission:'NONE',scope:'SYNTHETIC_TEACHING_ONLY'};
  return canonical({...payload,release_digest:hash(canonical(payload))})+'\n';
}
export function softwareDeliveryProblems(files,{sourceCommit=null}={}){
  if(![...files.keys()].some(path=>DELIVERY_FILES.includes(path)||DELIVERY_MODULES.has(path)))return [];
  try{
    const release=JSON.parse(files.get(DELIVERY_RELEASE)),{release_digest,...payload}=release;
    if(release.schema!=='fleetlab.software-delivery-release/1.0.0'||release.emitted_scope!=='NF04_SOFTWARE_DELIVERY_ROUTE_CLOSURE_V1'||release.authenticity!=='NOT_AUTHENTICATED'||release.deployment_permission!=='NONE'||release.scope!=='SYNTHETIC_TEACHING_ONLY'||hash(canonical(payload))!==release_digest)fail('NF04 sidecar schema, scope or digest mismatch');
    const expected=JSON.parse(createSoftwareDeliverySidecar(files,release.source,release.source_files,release.page_source));
    if(canonical(release)!==canonical(expected))fail('NF04 emitted inventory mismatch');
    const expectedSources=[...routeModules(files,DELIVERY_ENTRIES),...DELIVERY_SOURCE_ASSETS].sort();
    if(canonical(Object.keys(release.source_files??{}).sort())!==canonical(expectedSources))fail('NF04 source fingerprint inventory mismatch');
    for(const [path,record]of Object.entries(release.source_files)){
      if(canonical(Object.keys(record??{}).sort())!==canonical(['bytes','sha256'])||!Number.isSafeInteger(record.bytes)||record.bytes<0||!/^[a-f0-9]{64}$/.test(record.sha256))fail('NF04 source fingerprint malformed');
      const emitted=path==='software-delivery/visual.css'?`${DELIVERY_DIR}/visual.css`:path;
      if(files.has(emitted)&&canonical(record)!==canonical(fingerprint(files.get(emitted))))fail(`NF04 source fingerprint mismatch: ${path}`);
    }
    if(typeof release.page_source!=='string'||canonical(fingerprint(release.page_source))!==canonical(release.source_files['software-delivery/index.html'])||renderSitePage(release.page_source,'software-delivery/index.html',['./visual.css'])!==files.get(`${DELIVERY_DIR}/index.html`))fail('NF04 source page transform mismatch');
    const state=release.source;
    if(!state||canonical(Object.keys(state).sort())!==canonical(['source_commit','source_state','source_tree'])||!['SOURCE_COMMIT_UNAVAILABLE','MODIFIED_SOURCE','BOUND_FILES_MATCH_COMMIT'].includes(state.source_state)||(state.source_state==='SOURCE_COMMIT_UNAVAILABLE'?state.source_commit!==null||state.source_tree!==null:!/^[a-f0-9]{40}$/.test(state.source_commit)||!/^[a-f0-9]{40}$/.test(state.source_tree)))fail('NF04 source identity malformed');
    if(sourceCommit&&(state.source_commit!==sourceCommit||state.source_state!=="BOUND_FILES_MATCH_COMMIT"))fail("NF04 source commit mismatch");
    return [];
  }catch(error){return [error.message];}
}

// One lesson sequence in hub order, 01 to 05: [route, link text]. integrate-site.py reads this line as JSON.
export const LESSON_SEQUENCE=[["capacity","Better scheduling, more bandwidth, or more charging power?"],["software-delivery","One update, four vehicles"],["delivery-order","Who gets the depot link first?"],["rebalancing","Where should the empty cars go?"],["dispatch","Which car takes the next request?"]];
// Deterministic hosted-only Next links, applied after the generation's sidecars are checked. Lessons 01 to 04 link to
// the next lesson only when both releases exist; lesson 05's final navigation is page source (dispatch/index.html).
export function lessonNavigation(files){
 const result=new Map();
 for(let i=0;i<4;i++){
  const [route]=LESSON_SEQUENCE[i],[next,label]=LESSON_SEQUENCE[i+1],path=`network-flows/${route}/index.html`,end=i<3?'</body>':'</main>',source=files.get(path);
  if(!files.has(`network-flows/${next}/release.json`)||i&&!files.has(`network-flows/${route}/release.json`))continue;
  if(typeof source!=='string'||source.split(end).length!==2)fail(`${route} navigation source missing or ambiguous`);
  const link=`<a href="/network-flows/${next}/">${label}`;
  result.set(path,source.replace(end,()=>(i<3?`<nav class="${['fl-app','delivery-shell','order-shell'][i]}" aria-label="Next Network Flows lesson"><p>Next lesson: ${link}</a></p></nav>\n`:`<nav class="lesson-next" aria-label="Next Network Flows lesson"><span>CONTINUE THE QUESTION</span>${link} ↗</a><p>Inspect the next request and the car that can reach it.</p></nav>`)+end));
 }
 return result;
}
