// Physical owners are explicit. Reachability adds obligations, never removes legacy ownership.
import {ORDER_FILES,ORDER_ENTRIES,ORDER_MODULES,ORDER_RELEASE} from './delivery-order-package.mjs';
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
export const INTEGRATION_TEXT_PATHS=['index.html','boot.js','_headers','integration.mjs','integration.css','publication.json','404.html','not-found.css','downloads/fleetlab-offline.sha256','downloads/verify-offline.txt'];
export const OWNER_LIMITS=Object.freeze({legacy_text_bytes:2621440,emitted_text_bytes:3145728,nf04_closure_bytes:524288});
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
  const legacyModules=routeModules(files,['src/ui/app.js','src/runtime/worker.js','src/ui/capacity-app.js']);
  const hasDelivery=[...files.keys()].some(path=>DELIVERY_FILES.includes(path)||DELIVERY_MODULES.has(path));
  const delivery=hasDelivery?routeModules(files,DELIVERY_ENTRIES):new Set();
  const hasOrder=[...files.keys()].some(path=>ORDER_FILES.includes(path)||ORDER_MODULES.has(path));
  const order=hasOrder?routeModules(files,ORDER_ENTRIES):new Set();
  const legacy=new Set([...legacyModules,...LEGACY_ASSETS].filter(path=>files.has(path)));
  // A dependency not in the newly declared NF04 inventory remains legacy-owned even when only NF04 imports it.
  for(const path of delivery)if(!DELIVERY_MODULES.has(path))legacy.add(path);
  for(const path of order)if(!ORDER_MODULES.has(path)&&!DELIVERY_MODULES.has(path))legacy.add(path);
  const route=new Set(hasDelivery?[...delivery,...DELIVERY_FILES.filter(path=>files.has(path)),'_headers']:[]);
  const local=new Set([...route].filter(path=>!legacy.has(path)&&(DELIVERY_FILES.includes(path)||DELIVERY_MODULES.has(path))));
  const orderRoute=new Set(hasOrder?[...order,...ORDER_FILES.filter(path=>files.has(path)),'_headers']:[]);
  const orderLocal=new Set([...orderRoute].filter(path=>!legacy.has(path)&&!local.has(path)&&(ORDER_FILES.includes(path)||ORDER_MODULES.has(path))));
  const owners={};
  for(const path of files.keys()){
    if(MEDIA.has(path)){owners[path]='teaching-media';continue;}
    if(legacy.has(path))owners[path]=delivery.has(path)?'legacy-shared':'legacy';
    else if(local.has(path))owners[path]='nf04';
    else if(orderLocal.has(path))owners[path]='delivery-order';
    else fail(`unknown emitted ownership: ${path}`);
  }
  const result={legacy_text_bytes:sum(files,legacy),nf04_route_local_bytes:sum(files,local),nf04_closure_bytes:sum(files,route),emitted_text_bytes:[...files].filter(([path])=>!MEDIA.has(path)).reduce((n,[,value])=>n+size(value),0),owners,nf04_paths:[...route].sort()};
  if(hasOrder){result.delivery_order_route_local_bytes=sum(files,orderLocal);result.delivery_order_closure_bytes=sum(files,orderRoute);result.delivery_order_paths=[...orderRoute].sort();if(result.delivery_order_closure_bytes>524288)fail('delivery order closure budget exceeded');}
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
    ...(teaching.has(ORDER_RELEASE)?[["delivery_order",new Set([...routeModules(teaching,ORDER_ENTRIES),...ORDER_FILES,"_headers"])]]:[]),
    ...(teaching.has(DELIVERY_RELEASE)?[['nf04',new Set([...routeModules(teaching,DELIVERY_ENTRIES),...DELIVERY_FILES,'_headers'])]]:[]),
    ...(teaching.has('src/ui/capacity-app.js')?[['nf03',new Set([...capacityScope(teaching),'network-flows/capacity/release.json','_headers'])]]:[]),
  ];
  for(const [id,closure]of closures){
    const count=sum(integrated,closure);result[`${id}_closure_bytes`]=count;
    if(count>524288)fail(`${id} final closure byte budget exceeded: ${count} > 524288`);
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

// Deterministic hosted-only links, applied after the generation's sidecars are checked.
export function lessonNavigation(files){
 const result=new Map(),path='network-flows/capacity/index.html';
 if(files.has(DELIVERY_RELEASE)){
  const source=files.get(path);
  if(typeof source!=='string'||source.split('</body>').length!==2)fail('capacity navigation source missing or ambiguous');
  result.set(path,source.replace('</body>','<nav class="fl-app" aria-label="Next Network Flows lesson"><p>Next lesson: <a href="/network-flows/software-delivery/">One update, four vehicles</a></p></nav>\n</body>'));
 }
 if(files.has(ORDER_RELEASE)){
  const path=`${DELIVERY_DIR}/index.html`,source=files.get(path);
  if(typeof source!=='string'||source.split('</body>').length!==2)fail('delivery navigation source missing or ambiguous');
  result.set(path,source.replace('</body>','<nav class="delivery-shell" aria-label="Next Network Flows lesson"><p>Next lesson: <a href="/network-flows/delivery-order/">Who gets the depot link first?</a></p></nav>\n</body>'));
 }
 return result;
}
