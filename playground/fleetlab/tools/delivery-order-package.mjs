// Declared owner of the bounded companion. Existing modules keep their physical owner.
export const ORDER_DIR='network-flows/delivery-order';
export const ORDER_RELEASE=`${ORDER_DIR}/release.json`;
export const ORDER_FILES=[`${ORDER_DIR}/index.html`,`${ORDER_DIR}/boot.js`,`${ORDER_DIR}/visual.css`,ORDER_RELEASE];
export const ORDER_ENTRIES=['src/ui/delivery-order-app.js','src/runtime/delivery-order-worker.js','src/data/delivery-order-study.js'];
export const ORDER_MODULES=new Set([...ORDER_ENTRIES,
 'src/model/delivery-order-contract.js','src/model/delivery-order.js','src/model/delivery-order-verify.js',
 'src/model/delivery-order-search.js','src/model/delivery-order-study-verify.js','src/runtime/delivery-order-job.js',
 'src/ui/delivery-order-page.js','src/ui/delivery-order-view.js','src/ui/delivery-order-player.js']);
export const ORDER_BOOT='import { startDeliveryOrder } from "../../src/ui/delivery-order-app.js";\nimport { ORDER_STUDY } from "../../src/data/delivery-order-study.js";\nstartDeliveryOrder({ manifest: ORDER_STUDY, createWorker: () => new Worker(new URL("../../src/runtime/delivery-order-worker.js", import.meta.url), { type: "module" }) });\n';

import {createHash} from "node:crypto";
import {routeModules} from "./software-delivery-package.mjs";
import {renderSitePage} from "./site-shell.mjs";
export const ORDER_SOURCE_ASSETS=['delivery-order/index.html', 'delivery-order/visual.css', 'tools/pack.mjs', 'tools/delivery-order-package.mjs', 'tools/software-delivery-package.mjs', 'tools/release-sidecar.mjs', 'tools/site-shell.mjs', 'tools/check-dist.mjs', 'tools/media.mjs', 'tools/comment-strip.mjs'];
const canonical=v=>JSON.stringify(v,(_k,x)=>x&&typeof x==="object"&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
const hash=v=>createHash("sha256").update(v).digest("hex");
const fingerprint=v=>({bytes:Buffer.byteLength(v),sha256:hash(v)});
const fail=m=>{throw Error(`delivery-order package: ${m}`);};
export function createOrderSidecar(files,source,source_files,page_source){
  const paths=[...routeModules(files,ORDER_ENTRIES),...ORDER_FILES.filter(path=>path!==ORDER_RELEASE),'_headers'];
  const payload={schema:'fleetlab.delivery-order-release/1.0.0',source,source_files,page_source,emitted_scope:'DELIVERY_ORDER_ROUTE_CLOSURE_V1',emitted_files:Object.fromEntries(paths.filter(path=>path!=='_headers').sort().map(path=>[path,fingerprint(files.get(path))])),authenticity:'NOT_AUTHENTICATED',deployment_permission:'NONE',scope:'SYNTHETIC_TEACHING_ONLY'};
  return canonical({...payload,release_digest:hash(canonical(payload))})+'\n';
}
export function orderPackageProblems(files,{sourceCommit=null}={}){
  if(![...files.keys()].some(path=>ORDER_FILES.includes(path)||ORDER_MODULES.has(path)))return [];
  try{
    const release=JSON.parse(files.get(ORDER_RELEASE)),{release_digest,...payload}=release;
    if(release.schema!=='fleetlab.delivery-order-release/1.0.0'||release.emitted_scope!=='DELIVERY_ORDER_ROUTE_CLOSURE_V1'||release.authenticity!=='NOT_AUTHENTICATED'||release.deployment_permission!=='NONE'||release.scope!=='SYNTHETIC_TEACHING_ONLY'||hash(canonical(payload))!==release_digest)fail('Delivery order sidecar schema, scope or digest mismatch');
    const expected=JSON.parse(createOrderSidecar(files,release.source,release.source_files,release.page_source));
    if(canonical(release)!==canonical(expected))fail('Delivery order emitted inventory mismatch');
    const expectedSources=[...routeModules(files,ORDER_ENTRIES),...ORDER_SOURCE_ASSETS].sort();
    if(canonical(Object.keys(release.source_files??{}).sort())!==canonical(expectedSources))fail('Delivery order source fingerprint inventory mismatch');
    for(const [path,record]of Object.entries(release.source_files)){
      if(canonical(Object.keys(record??{}).sort())!==canonical(['bytes','sha256'])||!Number.isSafeInteger(record.bytes)||record.bytes<0||!/^[a-f0-9]{64}$/.test(record.sha256))fail('Delivery order source fingerprint malformed');
      const emitted=path==='delivery-order/visual.css'?`${ORDER_DIR}/visual.css`:path;
      if(files.has(emitted)&&canonical(record)!==canonical(fingerprint(files.get(emitted))))fail(`Delivery order source fingerprint mismatch: ${path}`);
    }
    if(typeof release.page_source!=='string'||canonical(fingerprint(release.page_source))!==canonical(release.source_files['delivery-order/index.html'])||renderSitePage(release.page_source,'delivery-order/index.html',['./visual.css'])!==files.get(`${ORDER_DIR}/index.html`))fail('Delivery order source page transform mismatch');
    const state=release.source;
    if(!state||canonical(Object.keys(state).sort())!==canonical(['source_commit','source_state','source_tree'])||!['SOURCE_COMMIT_UNAVAILABLE','MODIFIED_SOURCE','BOUND_FILES_MATCH_COMMIT'].includes(state.source_state)||(state.source_state==='SOURCE_COMMIT_UNAVAILABLE'?state.source_commit!==null||state.source_tree!==null:!/^[a-f0-9]{40}$/.test(state.source_commit)||!/^[a-f0-9]{40}$/.test(state.source_tree)))fail('Delivery order source identity malformed');
    if(sourceCommit&&(state.source_commit!==sourceCommit||state.source_state!=="BOUND_FILES_MATCH_COMMIT"))fail("Delivery order source commit mismatch");
    return [];
  }catch(error){return [error.message];}
}
