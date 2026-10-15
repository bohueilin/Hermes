import {createHash} from "node:crypto";
import {routeModules} from "./software-delivery-package.mjs";
import {renderSitePage} from "./site-shell.mjs";
const canonical=v=>JSON.stringify(v,(_k,x)=>x&&typeof x==="object"&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
const hash=v=>createHash("sha256").update(v).digest("hex");
const fingerprint=v=>({bytes:Buffer.byteLength(v),sha256:hash(v)});

// Route ownership is explicit at each caller; only identical byte/provenance checks are shared.
export function hostedRoutePackage({name,dir,releasePath,routeFiles,entries,modules,sourceAssets,schema,scope}){
const fail=m=>{throw Error(`${name} package: ${m}`);};
function create(files,source,source_files,page_source){
  const paths=[...routeModules(files,entries),...routeFiles.filter(path=>path!==releasePath),'_headers'];
  const payload={schema:schema,source,source_files,page_source,emitted_scope:scope,emitted_files:Object.fromEntries(paths.filter(path=>path!=='_headers').sort().map(path=>[path,fingerprint(files.get(path))])),authenticity:'NOT_AUTHENTICATED',deployment_permission:'NONE',scope:'SYNTHETIC_TEACHING_ONLY'};
  return canonical({...payload,release_digest:hash(canonical(payload))})+'\n';
}
function problems(files,{sourceCommit=null}={}){
  if(![...files.keys()].some(path=>routeFiles.includes(path)||modules.has(path)))return [];
  try{
    const release=JSON.parse(files.get(releasePath)),{release_digest,...payload}=release;
    if(release.schema!==schema||release.emitted_scope!==scope||release.authenticity!=='NOT_AUTHENTICATED'||release.deployment_permission!=='NONE'||release.scope!=='SYNTHETIC_TEACHING_ONLY'||hash(canonical(payload))!==release_digest)fail('Route sidecar schema, scope or digest mismatch');
    const expected=JSON.parse(create(files,release.source,release.source_files,release.page_source));
    if(canonical(release)!==canonical(expected))fail('Route emitted inventory mismatch');
    const expectedSources=[...routeModules(files,entries),...sourceAssets].sort();
    if(canonical(Object.keys(release.source_files??{}).sort())!==canonical(expectedSources))fail('Route source fingerprint inventory mismatch');
    for(const [path,record]of Object.entries(release.source_files)){
      if(canonical(Object.keys(record??{}).sort())!==canonical(['bytes','sha256'])||!Number.isSafeInteger(record.bytes)||record.bytes<0||!/^[a-f0-9]{64}$/.test(record.sha256))fail('Route source fingerprint malformed');
      const emitted=path===`${name}/visual.css`?`${dir}/visual.css`:path;
      if(files.has(emitted)&&canonical(record)!==canonical(fingerprint(files.get(emitted))))fail(`Route source fingerprint mismatch: ${path}`);
    }
    if(typeof release.page_source!=='string'||canonical(fingerprint(release.page_source))!==canonical(release.source_files[`${name}/index.html`])||renderSitePage(release.page_source,`${name}/index.html`,['./visual.css'])!==files.get(`${dir}/index.html`))fail('Route source page transform mismatch');
    const state=release.source;
    if(!state||canonical(Object.keys(state).sort())!==canonical(['source_commit','source_state','source_tree'])||!['SOURCE_COMMIT_UNAVAILABLE','MODIFIED_SOURCE','BOUND_FILES_MATCH_COMMIT'].includes(state.source_state)||(state.source_state==='SOURCE_COMMIT_UNAVAILABLE'?state.source_commit!==null||state.source_tree!==null:!/^[a-f0-9]{40}$/.test(state.source_commit)||!/^[a-f0-9]{40}$/.test(state.source_tree)))fail('Route source identity malformed');
    if(sourceCommit&&(state.source_commit!==sourceCommit||state.source_state!=="BOUND_FILES_MATCH_COMMIT"))fail("Route source commit mismatch");
    return [];
  }catch(error){return [error.message];}
}

return {create,problems};
}
