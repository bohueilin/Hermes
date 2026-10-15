// Explicit hosted-only owner for the approved four-zone rebalancing lesson.
export const R1_DIR='network-flows/rebalancing';
export const R1_RELEASE=`${R1_DIR}/release.json`;
export const R1_FILES=[`${R1_DIR}/index.html`,`${R1_DIR}/boot.js`,`${R1_DIR}/visual.css`,R1_RELEASE];
export const R1_ENTRIES=['src/ui/rebalancing-app.js','src/runtime/rebalancing-worker.js','src/model/rebalancing-study.js'];
export const R1_MODULES=new Set([...R1_ENTRIES,'src/model/rebalancing-contract.js','src/model/rebalancing.js','src/model/rebalancing-verify.js','src/runtime/rebalancing-job.js','src/runtime/rebalancing-session.js','src/ui/rebalancing-view.js','src/ui/rebalancing-concept.js']);
export const R1_BOOT='import { startRebalancing } from "../../src/ui/rebalancing-app.js";\nstartRebalancing({ createWorker: () => new Worker(new URL("../../src/runtime/rebalancing-worker.js", import.meta.url), { type: "module" }) });\n';
import {createHash} from "node:crypto";
import {routeModules} from "./software-delivery-package.mjs";
import {renderSitePage} from "./site-shell.mjs";
export const R1_SOURCE_ASSETS=['rebalancing/index.html', 'rebalancing/visual.css', 'tools/pack.mjs', 'tools/rebalancing-package.mjs', 'tools/software-delivery-package.mjs', 'tools/release-sidecar.mjs', 'tools/site-shell.mjs', 'tools/check-dist.mjs', 'tools/media.mjs', 'tools/comment-strip.mjs'];
const canonical=v=>JSON.stringify(v,(_k,x)=>x&&typeof x==="object"&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
const hash=v=>createHash("sha256").update(v).digest("hex");
const fingerprint=v=>({bytes:Buffer.byteLength(v),sha256:hash(v)});
const fail=m=>{throw Error(`rebalancing package: ${m}`);};
export function createR1Sidecar(files,source,source_files,page_source){
  const paths=[...routeModules(files,R1_ENTRIES),...R1_FILES.filter(path=>path!==R1_RELEASE),'_headers'];
  const payload={schema:'fleetlab.rebalancing-release/1.0.0',source,source_files,page_source,emitted_scope:'R1_REBALANCING_ROUTE_CLOSURE_V1',emitted_files:Object.fromEntries(paths.filter(path=>path!=='_headers').sort().map(path=>[path,fingerprint(files.get(path))])),authenticity:'NOT_AUTHENTICATED',deployment_permission:'NONE',scope:'SYNTHETIC_TEACHING_ONLY'};
  return canonical({...payload,release_digest:hash(canonical(payload))})+'\n';
}
export function r1PackageProblems(files,{sourceCommit=null}={}){
  if(![...files.keys()].some(path=>R1_FILES.includes(path)||R1_MODULES.has(path)))return [];
  try{
    const release=JSON.parse(files.get(R1_RELEASE)),{release_digest,...payload}=release;
    if(release.schema!=='fleetlab.rebalancing-release/1.0.0'||release.emitted_scope!=='R1_REBALANCING_ROUTE_CLOSURE_V1'||release.authenticity!=='NOT_AUTHENTICATED'||release.deployment_permission!=='NONE'||release.scope!=='SYNTHETIC_TEACHING_ONLY'||hash(canonical(payload))!==release_digest)fail('Rebalancing sidecar schema, scope or digest mismatch');
    const expected=JSON.parse(createR1Sidecar(files,release.source,release.source_files,release.page_source));
    if(canonical(release)!==canonical(expected))fail('Rebalancing emitted inventory mismatch');
    const expectedSources=[...routeModules(files,R1_ENTRIES),...R1_SOURCE_ASSETS].sort();
    if(canonical(Object.keys(release.source_files??{}).sort())!==canonical(expectedSources))fail('Rebalancing source fingerprint inventory mismatch');
    for(const [path,record]of Object.entries(release.source_files)){
      if(canonical(Object.keys(record??{}).sort())!==canonical(['bytes','sha256'])||!Number.isSafeInteger(record.bytes)||record.bytes<0||!/^[a-f0-9]{64}$/.test(record.sha256))fail('Rebalancing source fingerprint malformed');
      const emitted=path==='rebalancing/visual.css'?`${R1_DIR}/visual.css`:path;
      if(files.has(emitted)&&canonical(record)!==canonical(fingerprint(files.get(emitted))))fail(`Rebalancing source fingerprint mismatch: ${path}`);
    }
    if(typeof release.page_source!=='string'||canonical(fingerprint(release.page_source))!==canonical(release.source_files['rebalancing/index.html'])||renderSitePage(release.page_source,'rebalancing/index.html',['./visual.css'])!==files.get(`${R1_DIR}/index.html`))fail('Rebalancing source page transform mismatch');
    const state=release.source;
    if(!state||canonical(Object.keys(state).sort())!==canonical(['source_commit','source_state','source_tree'])||!['SOURCE_COMMIT_UNAVAILABLE','MODIFIED_SOURCE','BOUND_FILES_MATCH_COMMIT'].includes(state.source_state)||(state.source_state==='SOURCE_COMMIT_UNAVAILABLE'?state.source_commit!==null||state.source_tree!==null:!/^[a-f0-9]{40}$/.test(state.source_commit)||!/^[a-f0-9]{40}$/.test(state.source_tree)))fail('Rebalancing source identity malformed');
    if(sourceCommit&&(state.source_commit!==sourceCommit||state.source_state!=="BOUND_FILES_MATCH_COMMIT"))fail("Rebalancing source commit mismatch");
    return [];
  }catch(error){return [error.message];}
}
