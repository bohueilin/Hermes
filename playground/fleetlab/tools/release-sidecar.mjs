// Hosted build provenance. The scientific manifest is input, never rewritten.
// Digests bind bytes to this declaration; they do not authenticate the producer.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstatSync, readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { renderSitePage } from "./site-shell.mjs";

export const CAPACITY_RELEASE_PATH = "network-flows/capacity/release.json";
export const CAPACITY_VISUAL_PATH = "network-flows/capacity/visual.css";
const STUDY = "src/data/depot-capacity-study.js";
const PROJECTION = "src/ui/depot-capacity-view.js";
const SCHEMA = "fleetlab.capacity-release/1.0.0";
const PACK_VERSION = "fleetlab-site-pack/2.0.0";
const BUILD_TOOLS = ["tools/pack.mjs","tools/check-dist.mjs","tools/release-sidecar.mjs","tools/site-shell.mjs","tools/media.mjs","tools/comment-strip.mjs"];
const SHA = /^[a-f0-9]{64}$/;
const COMMIT = /^[a-f0-9]{40}$/;
const INTEGRATION_OWNED = new Set(["index.html","boot.js","_headers"]);
const RELEASE_KEYS = ["schema","source_commit","source_tree","source_state","source_files","emitted_files",
  "study","study_schema","scientific_source_commit","workload_digest","versions","accepted_records","build",
  "authenticity","source_scope","emitted_scope","meaning","capacity_page_source","release_digest"].sort();
const fail = message => { throw new Error(`provenance: ${message}`); };
const sha256 = data => createHash("sha256").update(data).digest("hex");
const record = data => ({bytes:Buffer.byteLength(data),sha256:sha256(data)});
const canonical = value => JSON.stringify(value, (_key, item) => item && typeof item === "object" && !Array.isArray(item)
  ? Object.fromEntries(Object.keys(item).sort().map(key => [key,item[key]])) : item);
const same = (a,b) => canonical(a) === canonical(b);

function studyIdentity(files) {
  const text = files.get(STUDY);
  const match = typeof text === "string" && /^\/\/[^\n]*\nexport const CAPACITY_STUDY=Object\.freeze\((\{[^]*\})\);\s*$/.exec(text);
  if (!match) fail("study module is not the declared JSON manifest");
  const manifest = JSON.parse(match[1]);
  if (!SHA.test(manifest.workload_digest) || !manifest.status?.complete || !Array.isArray(manifest.cells)) fail("study identity unavailable");
  const accepted = {};
  for (const cell of manifest.cells) {
    if (!SHA.test(cell.record_digest) || cell.verification?.model_validity !== "VALID" || cell.verification?.comparison_eligible !== true || Object.hasOwn(accepted,cell.cell_id)) fail("study records are not uniquely accepted");
    accepted[cell.cell_id] = cell.record_digest;
  }
  if (manifest.status.accepted !== manifest.cells.length || manifest.status.planned !== manifest.cells.length) fail("study acceptance count mismatch");
  const projection = /export const CAPACITY_PROJECTION_VERSION\s*=\s*['"]([^'"]+)['"]/.exec(files.get(PROJECTION) ?? "")?.[1];
  if (!projection) fail("projection version unavailable");
  return {study:manifest.study,study_schema:manifest.schema,scientific_source_commit:manifest.source_commit,
    workload_digest:manifest.workload_digest,versions:{...manifest.versions,projection},accepted_records:accepted};
}

function sourceName(path) {
  if (path === "network-flows/capacity/index.html") return "capacity/index.html";
  if (path === CAPACITY_VISUAL_PATH) return "capacity/visual.css";
  if (path === CAPACITY_RELEASE_PATH || path === "boot.js" || path === "_headers" || path === "network-flows/capacity/boot.js") return null;
  return path;
}

function regularRead(root,path) {
  if (!/^(?:[A-Za-z0-9_.-]+\/)*[A-Za-z0-9_.-]+$/.test(path) || path.split("/").some(p => p === "." || p === "..")) fail("unsafe source path");
  let current=root;
  for (const part of path.split("/")) {
    current=join(current,part);
    if (lstatSync(current).isSymbolicLink()) fail(`linked source refused: ${path}`);
  }
  if (!lstatSync(current).isFile()) fail(`regular source required: ${path}`);
  return readFileSync(current);
}

function sourceFiles(playground,files) {
  const result={};
  for (const path of [...files.keys()].sort()) {
    const source=sourceName(path);
    if (source) result[source]=record(regularRead(playground,source));
  }
  for (const path of BUILD_TOOLS) result[path]=record(regularRead(playground,path));
  return result;
}

function git(root,args) {
  return execFileSync("git",["-C",root,...args],{encoding:"utf8",stdio:["ignore","pipe","pipe"],maxBuffer:16*1024*1024}).trim();
}

function sourceIdentity(playground,inputs,sourceCommit) {
  let root,head,tree;
  try {
    root=git(playground,["rev-parse","--show-toplevel"]);
    head=git(root,["rev-parse","HEAD"]);
    if (sourceCommit && (!COMMIT.test(sourceCommit) || git(root,["rev-parse",`${sourceCommit}^{commit}`]) !== sourceCommit)) fail("source commit must be an existing full commit ID");
    head=sourceCommit ?? head;
    tree=git(root,["rev-parse",`${head}^{tree}`]);
  } catch (error) {
    if (sourceCommit) fail("source commit is unavailable or invalid");
    return {source_commit:null,source_tree:null,source_state:"SOURCE_COMMIT_UNAVAILABLE"};
  }
  let matches=true;
  for (const [path,expected] of Object.entries(inputs)) {
    const repoPath=relative(root,join(playground,path)).split(sep).join("/");
    try {
      const data=execFileSync("git",["-C",root,"show",`${head}:${repoPath}`],{stdio:["ignore","pipe","pipe"],maxBuffer:16*1024*1024});
      if (!same(record(data),expected)) matches=false;
    } catch { matches=false; }
  }
  if (sourceCommit && !matches) fail("bound source files differ from the requested source commit");
  return {source_commit:head,source_tree:tree,source_state:matches?"BOUND_FILES_MATCH_COMMIT":"MODIFIED_SOURCE"};
}

export function createReleaseSidecar(playground,files,{sourceCommit=null,capturedSources=new Map()}={}) {
  const source_files=sourceFiles(playground,files);
  const capacity_page_source=regularRead(playground,"capacity/index.html").toString("utf8");
  if (!same(record(capacity_page_source),source_files["capacity/index.html"]) ||
    renderSitePage(capacity_page_source,"capacity/index.html",["../../styles.css","./visual.css"])!==files.get("network-flows/capacity/index.html")) fail("capacity page differs from the reviewed source transform");
  const toolSource=fileURLToPath(new URL("../",import.meta.url));
  for(const path of BUILD_TOOLS) if(!same(source_files[path],record(regularRead(toolSource,path)))) fail(`executing build tool differs from bound source: ${path}`);
  for (const [path,data] of capturedSources) if (!same(record(data),source_files[path])) fail(`source changed during capture: ${path}`);
  const emitted_files=Object.fromEntries([...files].filter(([path])=>path!==CAPACITY_RELEASE_PATH && !INTEGRATION_OWNED.has(path)).sort(([a],[b])=>a.localeCompare(b)).map(([path,data])=>[path,record(data)]));
  const release={schema:SCHEMA,...sourceIdentity(playground,source_files,sourceCommit),source_files,emitted_files,capacity_page_source,
    ...studyIdentity(files),build:{tool:PACK_VERSION,node:process.version},authenticity:"NOT_AUTHENTICATED",
    source_scope:"Listed source files only; no claim that the entire worktree is clean.",
    emitted_scope:"Teaching payload; integration-owned root index.html, boot.js and _headers are excluded.",
    meaning:"Byte consistency with declared source and accepted study identities; not independent authenticity or operational authority."};
  // Capture must agree with the already emitted modules; reread source pages too before returning.
  for (const [path,data] of files) {
    const source=sourceName(path);
    if (source && !path.endsWith("index.html") && !same(record(data),source_files[source])) fail(`source changed during capture: ${source}`);
  }
  if (!same(source_files,sourceFiles(playground,files))) fail("source changed during capture");
  return canonical({...release,release_digest:sha256(canonical(release))})+"\n";
}

/** Artifact-only validation always works offline; optional source validation also checks the reviewed checkout. */
export function releaseProblems(files,{playground=null,sourceCommit=null}={}) {
  const problems=[];
  try {
    const raw=files.get(CAPACITY_RELEASE_PATH);
    if (typeof raw !== "string") fail("release sidecar missing");
    const release=JSON.parse(raw),{release_digest,...payload}=release;
    if (!same(Object.keys(release).sort(),RELEASE_KEYS)) fail("release sidecar has missing or unexpected fields");
    if (release.schema!==SCHEMA || !SHA.test(release_digest) || sha256(canonical(payload))!==release_digest) fail("release sidecar digest or schema mismatch");
    if (release.authenticity!=="NOT_AUTHENTICATED" || !same(Object.keys(release.build ?? {}).sort(),["node","tool"]) || release.build?.tool!==PACK_VERSION || !/^v\d+\.\d+\.\d+$/.test(release.build?.node)) fail("release tool or trust state mismatch");
    const state=release.source_state;
    if (state === "SOURCE_COMMIT_UNAVAILABLE" ? release.source_commit!==null || release.source_tree!==null
      : !["BOUND_FILES_MATCH_COMMIT","MODIFIED_SOURCE"].includes(state) || !COMMIT.test(release.source_commit) || !COMMIT.test(release.source_tree)) fail("source identity malformed");
    const emitted=Object.fromEntries([...files].filter(([path])=>path!==CAPACITY_RELEASE_PATH && !INTEGRATION_OWNED.has(path)).map(([path,data])=>[path,record(data)]));
    if (!same(emitted,release.emitted_files)) fail("emitted file inventory or digest mismatch");
    for (const [key,value] of Object.entries(studyIdentity(files))) if (!same(release[key],value)) fail(`study ${key} mismatch`);
    const expectedSources=[...[...files.keys()].map(sourceName).filter(Boolean),...BUILD_TOOLS].sort();
    if (!same(expectedSources,Object.keys(release.source_files ?? {}).sort())) fail("source file inventory mismatch");
    if (typeof release.capacity_page_source!=="string" ||
      !same(record(release.capacity_page_source),release.source_files["capacity/index.html"]) ||
      renderSitePage(release.capacity_page_source,"capacity/index.html",["../../styles.css","./visual.css"])!==files.get("network-flows/capacity/index.html")) fail("capacity page differs from the bound source transform");
    for (const [path,expected] of Object.entries(release.source_files)) {
      if (!same(Object.keys(expected ?? {}).sort(),["bytes","sha256"]) || !SHA.test(expected?.sha256) || !Number.isSafeInteger(expected.bytes) || expected.bytes<0) fail("source fingerprint malformed");
      const emittedPath=path==="capacity/visual.css"?CAPACITY_VISUAL_PATH:path;
      if (!path.endsWith("index.html") && !BUILD_TOOLS.includes(path) && !same(expected,emitted[emittedPath])) fail(`source fingerprint mismatch: ${path}`);
    }
    if (playground) {
      const captured=sourceFiles(playground,files);
      if (!same(captured,release.source_files)) fail("reviewed source fingerprints mismatch");
      const identity=sourceIdentity(playground,captured,sourceCommit);
      if (sourceCommit && (release.source_commit!==sourceCommit || release.source_tree!==identity.source_tree || state!=="BOUND_FILES_MATCH_COMMIT")) fail("release source commit mismatch");
    } else if (sourceCommit) fail("source verification requires a checkout");
  } catch(error) { problems.push(error.message.startsWith("provenance:")?error.message:`provenance: malformed sidecar (${error.message})`); }
  return problems;
}

// The City integration tool uses the same validator, including no-follow reads and exact inventory checks.
if (process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  try {
    const args=process.argv.slice(2),options={};
    for(let i=0;i<args.length;i+=2) {
      if (!["--check","--playground","--source-commit"].includes(args[i]) || !args[i+1]) fail("usage: --check <site> --playground <source> [--source-commit <full-id>]");
      options[args[i]]=args[i+1];
    }
    if (!options["--check"] || !options["--playground"]) fail("site and source required");
    const root=resolve(options["--check"]),files=new Map();
    function walk(dir,prefix="") {
      if (lstatSync(dir).isSymbolicLink()) fail("linked site directory");
      for(const item of readdirSync(dir,{withFileTypes:true})) {
        const path=prefix+item.name;
        if(item.isDirectory()) walk(join(dir,item.name),`${path}/`);
        else {const data=regularRead(root,path);files.set(path,/\.(?:js|mjs|css|html|json)$/.test(path)||path==="_headers"?data.toString("utf8"):data);}
      }
    }
    walk(root);
    const problems=releaseProblems(files,{playground:resolve(options["--playground"]),sourceCommit:options["--source-commit"]});
    if(problems.length) fail(problems.join("; "));
    console.log("provenance: release sidecar, source fingerprints and emitted inventory agree");
  } catch(error) {console.error(error.message);process.exitCode=1;}
}
