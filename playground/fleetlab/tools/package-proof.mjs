import {BRAND_MEDIA,BRAND_TEXT,renderPage} from '../../../apps/fleetlab-city/hosted/site-transform.mjs';
import {ORDER_RELEASE,ORDER_FILES,ORDER_ENTRIES} from './delivery-order-package.mjs';
// B-lite is one deduplicated teaching build and one atomic integration, not a new engine.
// This proof binds bytes and source provenance; it does not authenticate their producer.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { constants, closeSync, fstatSync, lstatSync, mkdirSync, openSync,
  readSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { gzipSync } from "node:zlib";
import { buildHtml, buildSite, checkSitePath, findRepositoryRoot, moduleGraph } from "./pack.mjs";
import { checkSite, labelsFromContracts } from "./check-dist.mjs";
import { DELIVERY_RELEASE, DELIVERY_FILES, DELIVERY_ENTRIES, measureSiteOwnership, measureIntegratedText, lessonNavigation } from "./software-delivery-package.mjs";
import { MEDIA_LIMITS } from "./media.mjs";
import { CAPACITY_RELEASE_PATH, CAPACITY_VISUAL_PATH, releaseProblems } from "./release-sidecar.mjs";

export const RECEIPT_PATH = "downloads/teaching-package.json";
export const LIMITS = Object.freeze({ legacy_text_bytes: 2621440, raw_source_and_tools_bytes: 3145728,
  nf03_closure_bytes: 524288, nf04_closure_bytes: 524288, emitted_text_bytes: 3145728, package_metadata_bytes: 32768,
  source_offer_compressed_bytes: 4194304, source_offer_extracted_bytes: 4194304,
  teaching_text_plus_source_bytes: 7340032, teaching_generation_bytes: 14360576,
  offline_bytes: 2571440 });
const TOOL_ROOT = fileURLToPath(new URL("../", import.meta.url));
const COMMIT = /^[a-f0-9]{40}$/;
const CONTRACT = "src/hermes/fleet/contracts.py";
const INTEGRATION_ROOTS=["apps/fleetlab-city/hosted","apps/fleetlab-city/tools","apps/fleetlab-city/deploy"];
const BRAND_ROOT="apps/fleetlab-city/brand-media";
const INTEGRATION_DEPENDENCY="apps/fleetlab-city/citylib/public_notes.py";
export const SOURCE_BASELINE=Object.freeze({commit:"cf690bd7d974b8e057560a9a993374a83e4ec769",teaching_bytes:2765799,integration_bytes:188861,integration_inventory_sha256:"106b8113d1d17485423c9fbd2f2fef50a2fa317880c715925b7d30d7400d0e21"});
function captureIntegration(repository){
  const files=new Map();
  for(const root of INTEGRATION_ROOTS){
    regularDirectory(join(repository,root));
    for(const name of readdirSync(join(repository,root)).sort()){
      if(["node_modules","__pycache__"].includes(name))continue;
      const path=`${root}/${name}`;
      if(!/\.(?:mjs|py|json|css|html|md)$/.test(name))fail(`unknown integration source ownership: ${path}`);
      files.set(path,readRegular(repository,path,LIMITS.source_offer_extracted_bytes));
    }
  }
  files.set(INTEGRATION_DEPENDENCY,readRegular(repository,INTEGRATION_DEPENDENCY,LIMITS.source_offer_extracted_bytes));
  for(const [path,data] of files)if(!Buffer.from(data.toString("utf8")).equals(data))fail(`integration source is not valid UTF-8: ${path}`);
  return files;
}
const INTEGRATION_OWNED = new Set(["index.html", "boot.js", "_headers"]);
const fail = message => { throw new Error(`package-proof: ${message}`); };
const canonical = value => JSON.stringify(value, (_key, item) => item && typeof item === "object" && !Array.isArray(item)
  ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
const bytes = data => Buffer.byteLength(data);
const digest = data => createHash("sha256").update(data).digest("hex");
const fingerprint = data => ({ bytes: bytes(data), sha256: digest(data) });
const total = files => [...files.values()].reduce((sum, data) => sum + bytes(data), 0);
const textTotal = files => total(new Map([...files].filter(([path]) => !MEDIA_LIMITS.has(path))));
const safePath = path => typeof path === "string" && /^(?:[A-Za-z0-9_.-]+\/)*[A-Za-z0-9_.-]+$/.test(path)
  && !path.split("/").some(part => part === "." || part === "..");
const stable = (a, b) => ["dev", "ino", "size", "mtimeMs", "ctimeMs"].every(key => a[key] === b[key]);

function regularDirectory(path) {
  const stat = lstatSync(path);
  if (stat.isSymbolicLink() || !stat.isDirectory()) fail(`linked or non-directory path refused: ${path}`);
  return stat;
}

/** No-follow leaf reads, checked ancestors, bounded allocations, and before/after identity checks. */
function readRegular(root, path, maxBytes) {
  if (!safePath(path)) fail(`unsafe path: ${path}`);
  const ancestors = [];
  let directory = resolve(root);
  ancestors.push([directory, regularDirectory(directory)]);
  for (const part of path.split("/").slice(0, -1)) {
    directory = join(directory, part);
    ancestors.push([directory, regularDirectory(directory)]);
  }
  const file = join(root, path), before = lstatSync(file);
  if (before.isSymbolicLink() || !before.isFile()) fail(`linked or non-regular file refused: ${path}`);
  if (before.size > maxBytes) fail(`file byte limit exceeded: ${path}`);
  const fd = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const opened = fstatSync(fd);
    if (!opened.isFile() || !stable(before, opened)) fail(`file changed during capture: ${path}`);
    const buffer = Buffer.alloc(opened.size + 1);
    let count = 0, read;
    while (count < buffer.length && (read = readSync(fd, buffer, count, buffer.length - count, null)) > 0) count += read;
    if (count !== opened.size || !stable(opened, fstatSync(fd)) || !stable(before, lstatSync(file))) fail(`file changed during capture: ${path}`);
    const data = buffer.subarray(0, count);
    for (const [parent, state] of ancestors) if (!stable(state, regularDirectory(parent))) fail(`directory changed during capture: ${path}`);
    return data;
  } finally { closeSync(fd); }
}

/** Closed inventories include empty/foreign directories and symlinks as errors, never ignored entries. */
export function captureTree(root, { maxBytes = LIMITS.teaching_generation_bytes, maxFiles = 1024,
  maxFileBytes = LIMITS.source_offer_extracted_bytes, maxDepth = 12 } = {}) {
  const files = new Map();
  let used = 0, entries = 0;
  const walk = (directory, prefix = "", depth = 0) => {
    if (depth > maxDepth) fail("directory depth limit exceeded");
    const before = regularDirectory(directory);
    const names = readdirSync(directory).sort();
    if (!names.length && prefix) fail(`unexpected empty directory: ${prefix}`);
    for (const name of names) {
      const path = prefix + name;
      if (++entries > maxFiles * (maxDepth + 1) || !safePath(path)) fail("file inventory count or path limit exceeded");
      const stat = lstatSync(join(directory, name));
      if (stat.isSymbolicLink()) fail(`linked entry refused: ${path}`);
      if (stat.isDirectory()) walk(join(directory, name), `${path}/`, depth + 1);
      else {
        if (files.size >= maxFiles) fail("file count limit exceeded");
        const data = readRegular(root, path, Math.min(maxFileBytes, maxBytes - used));
        used += data.length;
        files.set(path, data);
      }
    }
    if (!stable(before, regularDirectory(directory)) || canonical(names) !== canonical(readdirSync(directory).sort())) fail("directory changed during capture");
  };
  walk(resolve(root));
  return files;
}

function assertEqual(actual, expected, label) {
  if (canonical([...actual.keys()].sort()) !== canonical([...expected.keys()].sort())) fail(`${label} inventory mismatch (missing or unexpected file)`);
  for (const [path, data] of expected) if (!Buffer.from(actual.get(path)).equals(Buffer.from(data))) fail(`${label} differs from reproduced bytes: ${path}`);
}

/** Each route counts its full shared graph; aggregate storage deduplicates paths, never equal contents. */
export function measureRouteClosures(playground, files, routes) {
  const physical = new Map();
  const measured = routes.map(route => {
    const paths = new Set(route.supporting);
    for (const entry of route.entries) for (const record of moduleGraph(join(playground, entry), join(playground, "src")).order) {
      if (!files.has(record.label) || !Buffer.from(files.get(record.label)).equals(Buffer.from(record.src))) fail(`route source mismatch: ${record.label}`);
      paths.add(record.label);
    }
    let size = 0;
    for (const path of paths) {
      if (!files.has(path)) fail(`missing route closure input: ${path}`);
      size += bytes(files.get(path));
      physical.set(path, files.get(path));
    }
    return { id: route.id, route: route.route, paths: [...paths].sort(), bytes: size };
  });
  return { routes: measured, physical_bytes: total(physical) };
}

function git(root, args, encoding = "utf8") {
  return execFileSync("git", ["-C", root, ...args], { encoding, stdio: ["ignore", "pipe", "pipe"], maxBuffer: 8 * 1024 * 1024 });
}

function captureSource(playground) {
  regularDirectory(playground);
  const inputs = new Map();
  for (const directory of ["src", "tools"]) for (const [path, data] of captureTree(join(playground, directory), { maxBytes: LIMITS.raw_source_and_tools_bytes })) {
    if (!(directory === "src" ? path.endsWith(".js") : path.endsWith(".mjs"))) fail(`unexpected source file: ${directory}/${path}`);
    inputs.set(`${directory}/${path}`, data);
  }
  for (const path of ["index.html", "styles.css", "capacity/index.html", "capacity/visual.css"]) inputs.set(path, readRegular(playground, path, LIMITS.raw_source_and_tools_bytes));
  try {
    regularDirectory(join(playground,"software-delivery"));
    for(const path of ["software-delivery/index.html","software-delivery/visual.css"])inputs.set(path,readRegular(playground,path,LIMITS.raw_source_and_tools_bytes));
  } catch(error) { if(error.code!=="ENOENT")throw error; }
  try {
    regularDirectory(join(playground,"delivery-order"));
    for(const path of ["delivery-order/index.html","delivery-order/visual.css"])inputs.set(path,readRegular(playground,path,LIMITS.raw_source_and_tools_bytes));
  } catch(error) { if(error.code!=="ENOENT")throw error; }
  const media = captureTree(join(playground, "media"), { maxBytes: 5 * 1024 * 1024 });
  for (const [path, data] of media) inputs.set(`media/${path}`, data);
  if (canonical([...media.keys()].map(path => `media/${path}`).sort()) !== canonical([...MEDIA_LIMITS.keys()].sort())) fail("media inventory mismatch");
  const tools = new Map([...inputs].filter(([path]) => path.startsWith("tools/")).map(([path, data]) => [path.slice(6), data]));
  assertEqual(tools, captureTree(join(TOOL_ROOT, "tools"), { maxBytes: LIMITS.raw_source_and_tools_bytes }), "executing tool");
  const repository = findRepositoryRoot(playground);
  if (!repository) fail("source repository is required for validation policy provenance");
  const contracts = readRegular(repository, CONTRACT, LIMITS.raw_source_and_tools_bytes);
  const license = readRegular(repository, "LICENSE", LIMITS.raw_source_and_tools_bytes);
  const labels = labelsFromContracts(repository);
  if (!labels?.length) fail("validation label policy is unavailable");
  const artwork=captureTree(join(repository,BRAND_ROOT),{maxBytes:2*1024*1024,maxFiles:3});
  const expectedArtwork=new Map(Object.values(BRAND_MEDIA).map(r=>[r.source.split('/').at(-1),r]));
  if(canonical([...artwork.keys()].sort())!==canonical([...expectedArtwork.keys()].sort()))fail('hosted artwork inventory mismatch');
  for(const [name,data] of artwork){const r=expectedArtwork.get(name);if(bytes(data)!==r.bytes||digest(data)!==r.sha256)fail('hosted artwork fingerprint mismatch');}
  return { inputs, repository, contracts, license, labels, integration:captureIntegration(repository),artwork };
}

function sourceIdentity(playground, captured, sourceCommit) {
  if (!COMMIT.test(sourceCommit ?? "")) fail("release requires an existing full source commit ID");
  let commit, tree;
  try {
    commit = git(captured.repository, ["rev-parse", `${sourceCommit}^{commit}`]).trim();
    tree = git(captured.repository, ["rev-parse", `${sourceCommit}^{tree}`]).trim();
  } catch { fail("source commit is unavailable"); }
  if (commit !== sourceCommit) fail("source commit identity mismatch");
  const inputs = new Map([...captured.inputs].map(([path, data]) => [relative(captured.repository, join(playground, path)).split(sep).join("/"), data]));
  for(const [path,data] of captured.integration)inputs.set(path,data);
  for(const [name,data] of captured.artwork)inputs.set(`${BRAND_ROOT}/${name}`,data);
  inputs.set(CONTRACT, captured.contracts);
  inputs.set("LICENSE", captured.license);
  const prefix = relative(captured.repository, playground).split(sep).join("/");
  const committedPaths = git(captured.repository, ["ls-tree", "-r", "-z", "--name-only", sourceCommit, "--",
    ...["src", "tools", "media", "capacity", "software-delivery", "delivery-order", "index.html", "styles.css"].map(path => `${prefix}/${path}`), CONTRACT, "LICENSE", ...INTEGRATION_ROOTS, INTEGRATION_DEPENDENCY, BRAND_ROOT])
    .split("\0").filter(Boolean).sort();
  if (canonical(committedPaths) !== canonical([...inputs.keys()].sort())) fail("source commit input inventory mismatch");
  for (const [path, data] of inputs) {
    let original;
    try { original = git(captured.repository, ["show", `${sourceCommit}:${path}`], null); }
    catch { fail(`source commit lacks input: ${path}`); }
    if (!original.equals(data)) fail(`source differs from requested commit: ${path}`);
  }
  return { commit, tree, state: "BOUND_FILES_MATCH_COMMIT" };
}

function writeMap(root, files) {
  for (const [path, data] of files) {
    if (!safePath(path)) fail("unsafe output path");
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), data, { flag: "wx" });
  }
}


function prepare(playground, sourceCommit, development) {
  playground = resolve(playground);
  const captured = captureSource(playground);
  const identity = development ? { commit: null, tree: null, state: "DEVELOPMENT_MEASUREMENT_NOT_RELEASE_BOUND" }
    : sourceIdentity(playground, captured, sourceCommit);
  const site = buildSite(playground, development ? {} : { sourceCommit });
  const offline = Buffer.from(buildHtml(playground));
  const problems = [...checkSite(site, { requiredLabels: captured.labels }),
    ...releaseProblems(site, { playground, ...(development ? {} : { sourceCommit }) })];
  if (problems.length) fail(problems.join("; "));
  const current = captureSource(playground);
  assertEqual(current.inputs, captured.inputs, "source capture");
  assertEqual(current.integration,captured.integration,"integration source capture");
  assertEqual(current.artwork,captured.artwork,"hosted artwork capture");
  if (!current.contracts.equals(captured.contracts)) fail("validation policy changed during capture");
  if (!current.license.equals(captured.license)) fail("license changed during capture");
  return { playground, captured, identity, site, offline };
}

/** JSON offers carry data only, with independent compressed and extracted byte limits. */
export function createSourceArchive(value) {
  const raw = Buffer.from(canonical(value) + "\n");
  if (raw.length > LIMITS.source_offer_extracted_bytes) fail("source offer extracted byte budget exceeded");
  const archive = gzipSync(raw, { level: 9 });
  if (archive.length > LIMITS.source_offer_compressed_bytes) fail("source offer compressed byte budget exceeded");
  return { raw, archive };
}

function assemble({ playground, captured, identity, site, offline }) {
  const sourceFiles = new Map([...captured.inputs].filter(([path]) => !MEDIA_LIMITS.has(path)));
  const media = [...MEDIA_LIMITS.keys()].sort().map(path => ({ path, ...fingerprint(captured.inputs.get(path)), owner: "teaching-media", retrieval_path: `/${path}` }));
  const originalFiles = Object.fromEntries([...sourceFiles].map(([path, data]) => {
    const text = data.toString("utf8");
    if (!Buffer.from(text).equals(data)) fail(`source is not valid UTF-8: ${path}`);
    return [path, text];
  }));
  const { raw: archiveRaw, archive } = createSourceArchive({ schema: "fleetlab.teaching-source/1.1.0", source: identity,
    files: originalFiles, integration:{owner:"existing-hosted-integration-source",media:BRAND_MEDIA,files:Object.fromEntries([...captured.integration].map(([path,data])=>[path,data.toString("utf8")])),reproduction:"Restore these repository-relative files at the source commit. integrate-site.py imports prepare-launch.py and citylib/public_notes.py. Other City source/data remain in the separately published City source offer; no teaching source was transferred to this owner."}, validation: { repository_path: CONTRACT, contracts_source: captured.contracts.toString("utf8"), required_labels: captured.labels }, media,
    license: { repository_path: "LICENSE", text: captured.license.toString("utf8") },
    reproduction: { runtime: process.version,
      commands: ["git init <restored-source>", "node <restored-source>/tools/pack.mjs --site <output-directory> --playground <restored-source>", "node <restored-source>/tools/pack.mjs --out <offline.html> --playground <restored-source>"],
      output_guard: "Use output paths outside restored-source. git init supplies the CLI output guard only, makes no commit and restores no original provenance. The exported buildSite/buildHtml functions need no Git repository.",
      notice: "Keep license.text as LICENSE beside the restored original files.",
      media: "Restore each separately served media path only after verifying its byte length and SHA-256.",
      comparison: "All hosted payload files and offline HTML reproduce exactly. A source archive without Git does not reproduce commit-bound release.json provenance; verify payload separately, then use the original Git commit to reproduce the exact sidecar and package." } });
  const archivePath = `network-flows/sources/${digest(archive)}.json.gz`;
  const measured = measureRouteClosures(playground, site, [
    { id: "legacy", route: "/", entries: ["src/ui/app.js", "src/runtime/worker.js"],
      supporting: ["index.html", "boot.js", "styles.css", "_headers", CAPACITY_RELEASE_PATH, ...MEDIA_LIMITS.keys()] },
    ...(site.has(DELIVERY_RELEASE)?[{id:"nf04",route:"/network-flows/software-delivery/",entries:DELIVERY_ENTRIES,supporting:[...DELIVERY_FILES,"_headers"]}]:[]),
    ...(site.has(ORDER_RELEASE)?[{id:"delivery_order",route:"/network-flows/delivery-order/",entries:ORDER_ENTRIES,supporting:[...ORDER_FILES,"_headers"]}]:[]),
    { id: "nf03", route: "/network-flows/capacity/", entries: ["src/ui/capacity-app.js"],
      supporting: ["network-flows/capacity/index.html", "network-flows/capacity/boot.js", "styles.css", CAPACITY_VISUAL_PATH, "_headers", CAPACITY_RELEASE_PATH] },
  ]);
  const owned=measureSiteOwnership(site);
  const release = JSON.parse(site.get(CAPACITY_RELEASE_PATH));
  const sourceInventory = Object.fromEntries([...sourceFiles].map(([path, data]) => [path, fingerprint(data)]));
  const receipt = { schema: "fleetlab.teaching-package/2.0.0", topology: "ONE_DEDUPLICATED_BUILD_ONE_ATOMIC_RELEASE", source: identity,
    authenticity: "NOT_AUTHENTICATED", scope: "SYNTHETIC_TEACHING_ONLY", deployment_permission: "NONE",
    capacity_release: { path: CAPACITY_RELEASE_PATH, ...fingerprint(site.get(CAPACITY_RELEASE_PATH)), release_digest: release.release_digest },
    integration_source:{owner:"existing-hosted-integration-source",hosted_artwork_bytes:total(captured.artwork),inside_teaching_3mib_gate:false,bytes:total(captured.integration),
      baseline:{source_commit:SOURCE_BASELINE.commit,bytes:SOURCE_BASELINE.integration_bytes,inventory_sha256:SOURCE_BASELINE.integration_inventory_sha256},
      delta_bytes:total(captured.integration)-SOURCE_BASELINE.integration_bytes,
      inventory_sha256:digest(canonical(Object.fromEntries([...captured.integration].map(([path,data])=>[path,fingerprint(data)])))),
      binding:"Every listed original is commit-bound and included in source-offer integration.files; teaching originals retain the unchanged 3 MiB gate."},
    source_offer: { path: archivePath, ...fingerprint(archive), extracted_sha256: digest(archiveRaw),
      original_inventory_sha256: digest(canonical(sourceInventory)), owner: "teaching-original-source-and-tools" },
    validation_policy: { repository_path: CONTRACT, ...fingerprint(captured.contracts) },
    license: { repository_path: "LICENSE", ...fingerprint(captured.license) },
    offline: { path: "downloads/fleetlab-offline.html", ...fingerprint(offline), owner: "complete-offline-edition", reserved_bytes: 50000 }, media,
    emitted_files: Object.fromEntries([...site].map(([path, data]) => [path, { ...fingerprint(data), owner: owned.owners[path] }])),
    routes: measured.routes,
    ownership: { receipt: { path: RECEIPT_PATH, owner: "package-metadata", self_hash: "External integration inventory hashes this receipt; own byte size is included by fixed point." },
      stable_pointer: RECEIPT_PATH, current_immutable: [archivePath], retained_prior_files: [],
      retention: "This package adds one source offer. City files and retained generations belong to the integration inventory; count every physical path there, even byte-identical copies. Use the immutable deployment hostname for generation reproduction; stable-alias readback checks release-time bytes, not a browser session spanning a switch.",
      original_source_scope: "Every src/*.js module, every tools/*.mjs tool, original page/CSS inputs, validation policy and LICENSE; media pinned separately. Full original inventory and text are in the source offer.",
      generation_count_scope: "teaching_generation_bytes is the teaching-input-generation subtotal, before integration. Transformed root growth, integration scripts/styles/publication/404/headers and retained/City bytes are counted by the outer integration inventory and final teaching-generation gate." },
    discovery: {owner:"hosted-integration",offline_action:false,meaning:"Discovery is injected only into the complete accepted hosted generation; final transforms are counted by the integrated aggregate gate."},
    counts: { legacy_text_bytes: owned.legacy_text_bytes, nf04_route_local_bytes:owned.nf04_route_local_bytes, nf04_closure_bytes:owned.nf04_closure_bytes, ...(site.has(ORDER_RELEASE)?{delivery_order_route_local_bytes:owned.delivery_order_route_local_bytes,delivery_order_closure_bytes:owned.delivery_order_closure_bytes}:{}), integration_text_bytes:0, raw_source_and_tools_bytes: total(sourceFiles) + captured.contracts.length + captured.license.length,
      net_original_source_growth_bytes:total(sourceFiles)+captured.contracts.length+captured.license.length-SOURCE_BASELINE.teaching_bytes+total(captured.integration)-SOURCE_BASELINE.integration_bytes,
      raw_module_bytes: total(new Map([...sourceFiles].filter(([path]) => path.startsWith("src/")))),
      raw_tool_bytes: total(new Map([...sourceFiles].filter(([path]) => path.startsWith("tools/")))),
      raw_original_file_count: sourceFiles.size + 2, hosted_file_count: site.size,
      nf03_closure_bytes: measured.routes.find(route => route.id === "nf03").bytes,
      unique_route_physical_bytes: measured.physical_bytes, media_bytes: media.reduce((sum, item) => sum + item.bytes, 0),
      offline_bytes: offline.length, source_offer_compressed_bytes: archive.length, source_offer_extracted_bytes: archiveRaw.length,
      package_metadata_bytes: 0, emitted_text_bytes: 0, teaching_text_plus_source_bytes: 0, teaching_generation_bytes: 0 },
    working_targets:{net_original_source_growth_bytes:307200,nf04_route_local_bytes:327680},
    limits: LIMITS, remaining: {}, meaning: "Current source/artifact byte consistency and budget measurements, not independent authenticity, production validation or permission. NF04, when present, is independently owned and counted; final integrated totals are checked again after hosted transforms." };
  let receiptBytes;
  for (let iteration = 0; iteration < 20; iteration += 1) {
    const count = receipt.counts;
    count.emitted_text_bytes = owned.emitted_text_bytes + count.package_metadata_bytes;
    count.teaching_text_plus_source_bytes = count.emitted_text_bytes + count.source_offer_compressed_bytes;
    count.teaching_generation_bytes = count.teaching_text_plus_source_bytes + count.media_bytes + count.offline_bytes;
    receipt.remaining = Object.fromEntries(Object.entries(LIMITS).map(([key, limit]) => [key, limit - count[key]]));
    receiptBytes = Buffer.from(canonical(receipt) + "\n");
    if (count.package_metadata_bytes === receiptBytes.length) break;
    count.package_metadata_bytes = receiptBytes.length;
    if (iteration === 19) fail("receipt size did not converge");
  }
  for (const [key, limit] of Object.entries(LIMITS)) if (receipt.counts[key] > limit) fail(`${key} budget exceeded: ${receipt.counts[key]} > ${limit}`);
  return { receipt, files: new Map([[RECEIPT_PATH, receiptBytes], [archivePath, archive]]) };
}

function fromInputs({ site, playground, offline, sourceCommit }, development) {
  const prepared = prepare(playground, sourceCommit, development);
  assertEqual(captureTree(site), prepared.site, "teaching site");
  const actualOffline = readRegular(dirname(resolve(offline)), relative(dirname(resolve(offline)), resolve(offline)), LIMITS.offline_bytes);
  if (!actualOffline.equals(prepared.offline)) fail("offline differs from reproduced bytes");
  return assemble(prepared);
}

/** Development accounting is deliberately not accepted by either production checker or the CLI. */
export function measurePackageProof(options) { return fromInputs(options, true); }
export function buildPackageProof(options) { return fromInputs(options, false); }
export function checkPackageProof({ packageDir, ...options }) {
  const expected = buildPackageProof(options);
  assertEqual(captureTree(packageDir, { maxBytes: LIMITS.package_metadata_bytes + LIMITS.source_offer_compressed_bytes, maxFiles: 2 }), expected.files, "package");
  return expected;
}

/** Integration owns three root files; all other teaching bytes, the offline edition and source offer stay exact. */
export function checkIntegratedPackage({ site, playground, sourceCommit }) {
  const prepared = prepare(playground, sourceCommit, false), expected = assemble(prepared);
  const publication = JSON.parse(readRegular(site, "publication.json", LIMITS.package_metadata_bytes));
  const branded=publication.hosted_presentation==='fleetlab.hosted-presentation/1.0.0';
  const onward=lessonNavigation(prepared.site);
  if(branded)for(const [path,data] of prepared.site)if(path.endsWith('.html'))onward.set(path,renderPage(String(onward.get(path)??data),{analytics:true}));
  // The outer integration verifier inventories City and retained releases. Read only owned teaching paths here.
  for (const [path, data] of [...prepared.site, ...expected.files, ["downloads/fleetlab-offline.html", prepared.offline]]) {
    if (INTEGRATION_OWNED.has(path)) continue;
    if (!readRegular(site, path, bytes(onward.get(path)??data)).equals(Buffer.from(onward.get(path)??data))) fail(`integrated package differs from reproduced bytes: ${path}`);
  }
  const offers = new Map([...captureTree(join(site, "network-flows/sources"), { maxBytes: LIMITS.source_offer_compressed_bytes, maxFiles: 2 })]
    .map(([path, data]) => [`network-flows/sources/${path}`, data]));
  assertEqual(offers, new Map([[expected.receipt.source_offer.path, expected.files.get(expected.receipt.source_offer.path)]]), "integrated source offer");
  const integrated=new Map([...prepared.site,...onward]);
  if(branded){
    for(const path of BRAND_TEXT){const data=readRegular(site,path,LIMITS.emitted_text_bytes);if(!data.equals(prepared.captured.integration.get(`apps/fleetlab-city/hosted/${path}`)))fail('hosted brand source mismatch');integrated.set(path,data);}
    for(const [path,r] of Object.entries(BRAND_MEDIA))if(!readRegular(site,path,r.bytes).equals(prepared.captured.artwork.get(r.source.split('/').at(-1))))fail('hosted artwork bytes differ');
  }
  for(const path of ["index.html","boot.js","_headers","integration.mjs","integration.css","not-found.css","publication.json","404.html","downloads/fleetlab-offline.sha256","downloads/verify-offline.txt"]) {
    try { integrated.set(path,readRegular(site,path,LIMITS.emitted_text_bytes)); }
    catch(error) { if(error.code!=="ENOENT")throw error; }
  }
  integrated.set(RECEIPT_PATH,expected.files.get(RECEIPT_PATH));
  const finalTeaching=new Map([...prepared.site,[RECEIPT_PATH,expected.files.get(RECEIPT_PATH)]]);
  const integratedCounts=measureIntegratedText(finalTeaching,integrated);
  const pointer = { path: RECEIPT_PATH, ...fingerprint(expected.files.get(RECEIPT_PATH)) };
  if (publication.source_commit !== sourceCommit || canonical(publication.teaching_package) !== canonical(pointer)) fail("publication teaching package pointer mismatch");
  return {...expected,integrated_counts:integratedCounts};
}

export function main(argv, { cwd = process.cwd(), log = console.log, error = console.error } = {}) {
  const options = {};
  try {
    for (let index = 0; index < argv.length; index += 2) {
      const name = argv[index];
      if (!["--site", "--playground", "--offline", "--source-commit", "--out", "--check", "--check-integrated"].includes(name)
        || Object.hasOwn(options, name) || !argv[index + 1] || argv[index + 1].startsWith("--")) fail("invalid or duplicate argument");
      options[name] = argv[index + 1];
    }
    const mode = ["--out", "--check", "--check-integrated"].filter(name => options[name]);
    if (mode.length !== 1 || !options["--playground"] || !COMMIT.test(options["--source-commit"] ?? "")
      || (mode[0] !== "--check-integrated" && (!options["--site"] || !options["--offline"]))
      || (mode[0] === "--check-integrated" && (options["--site"] || options["--offline"]))) fail("usage: --site DIR --playground DIR --offline FILE --source-commit SHA (--out DIR | --check DIR), or --check-integrated DIR --playground DIR --source-commit SHA");
    const args = { playground: resolve(cwd, options["--playground"]), sourceCommit: options["--source-commit"] };
    if (mode[0] === "--check-integrated") {
      checkIntegratedPackage({ ...args, site: resolve(cwd, options["--check-integrated"]) });
    } else {
      Object.assign(args, { site: resolve(cwd, options["--site"]), offline: resolve(cwd, options["--offline"]) });
      if (mode[0] === "--check") checkPackageProof({ ...args, packageDir: resolve(cwd, options["--check"]) });
      else {
        const expected = buildPackageProof(args);
        const output = resolve(cwd, options["--out"]);
        const rule = checkSitePath(output, findRepositoryRoot(args.playground), expected.files);
        if (!rule.ok) fail(rule.reason);
        // Only a new directory is written; no partial overwrite or stale package is accepted.
        mkdirSync(dirname(rule.path), { recursive: true });
        mkdirSync(rule.path);
        writeMap(rule.path, expected.files);
      }
    }
    log("package-proof: source, teaching bytes, offline, package inventory and budgets agree");
    return 0;
  } catch (problem) { error(problem.message); return 1; }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main(process.argv.slice(2));
