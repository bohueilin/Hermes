import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import { measureSiteOwnership, lessonNavigation } from "../tools/software-delivery-package.mjs";
import { buildHtml, buildSite } from "../tools/pack.mjs";

const source = fileURLToPath(new URL("../", import.meta.url));
const scratch = realpathSync(mkdtempSync(join(tmpdir(), "fleetlab-package-test-")));
after(() => rmSync(scratch, { recursive: true, force: true }));
const tool = await import("../tools/package-proof.mjs").catch(error => {
  if (error.code === "ERR_MODULE_NOT_FOUND") return {};
  throw error;
});
const writeMap = (root, files) => {
  for (const [path, data] of files) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), data);
  }
};
const canonical = value => JSON.stringify(value, (_key, item) => item && typeof item === "object" && !Array.isArray(item)
  ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
const hash = data => createHash("sha256").update(data).digest("hex");

test("a highly compressed offer cannot hide an excessive extracted JSON size", () => {
  assert.equal(typeof tool.createSourceArchive, "function", "independent archive limits are not implemented");
  const sample = { source: "shared source", media: [] };
  const first = tool.createSourceArchive(sample), second = tool.createSourceArchive(sample);
  assert.deepEqual(first.archive, second.archive);
  assert.deepEqual(gunzipSync(first.archive), first.raw);
  assert.throws(() => tool.createSourceArchive({ source: "\\".repeat(2200000) }), /extracted.*budget/i);
});

test("shared dependencies count in every closure and duplicate physical paths count separately", () => {
  assert.equal(typeof tool.measureRouteClosures, "function", "closure accounting is not implemented");
  const root = join(scratch, "tiny");
  const files = new Map([
    ["src/shared.js", "export const x = 1;\n"],
    ["src/a.js", "import {x} from './shared.js';\nexport const a = x;\n"],
    ["src/b.js", "import {x} from './shared.js';\nexport const b = x;\n"],
    ["a.html", "a"], ["b.html", "b"], ["a.css", "same"], ["b.css", "same"],
  ]);
  writeMap(root, files);
  const result = tool.measureRouteClosures(root, files, [
    { id: "a", route: "/a/", entries: ["src/a.js"], supporting: ["a.html", "a.css"] },
    { id: "b", route: "/b/", entries: ["src/b.js"], supporting: ["b.html", "b.css"] },
  ]);
  assert.deepEqual(result.routes.map(route => route.paths.includes("src/shared.js")), [true, true]);
  assert.equal(result.routes[0].bytes, Buffer.byteLength(files.get("src/a.js")) + Buffer.byteLength(files.get("src/shared.js")) + 5);
  assert.equal(result.physical_bytes, [...files.values()].reduce((sum, bytes) => sum + Buffer.byteLength(bytes), 0));
  assert.equal(result.routes.reduce((sum, route) => sum + route.bytes, 0) - result.physical_bytes, Buffer.byteLength(files.get("src/shared.js")));
});

test("bounded snapshots reject linked, excessive and unexpected directory entries", () => {
  assert.equal(typeof tool.captureTree, "function", "bounded no-follow capture is not implemented");
  const root = join(scratch, "capture");
  writeMap(root, new Map([["x.txt", "1234"]]));
  assert.throws(() => tool.captureTree(root, { maxBytes: 3 }), /limit|budget/i);
  symlinkSync(join(root, "x.txt"), join(root, "linked"));
  assert.throws(() => tool.captureTree(root), /link/i);
  rmSync(join(root, "linked"));
  mkdirSync(join(root, "empty"));
  assert.throws(() => tool.captureTree(root), /empty|unexpected/i);
});

test("real current source proof preserves legacy bytes, counts its metadata and pins original inputs", () => {
  assert.equal(typeof tool.measurePackageProof, "function", "package measurement is not implemented");
  const files = buildSite(source);
  const site = join(scratch, "site");
  writeMap(site, files);
  const offline = join(scratch, "offline.html");
  writeFileSync(offline, buildHtml(source));
  const result = tool.measurePackageProof({ site, playground: source, offline });
  const { receipt } = result;
  assert.equal(receipt.source.state, "DEVELOPMENT_MEASUREMENT_NOT_RELEASE_BOUND");
  assert.equal(receipt.counts.legacy_text_bytes,measureSiteOwnership(files).legacy_text_bytes);
  assert.equal(receipt.counts.emitted_text_bytes, measureSiteOwnership(files).emitted_text_bytes + result.files.get(tool.RECEIPT_PATH).length);
  assert.ok(receipt.counts.raw_source_and_tools_bytes <= 3145728);
  assert.ok(receipt.counts.offline_bytes <= 2571440);
  assert.ok(receipt.routes.find(route => route.id === "nf03").bytes <= 524288);
  assert.equal(result.files.size, 2);
  const archive = result.files.get(receipt.source_offer.path);
  assert.equal(createHash("sha256").update(archive).digest("hex"), receipt.source_offer.sha256);
  const raw = gunzipSync(archive);
  const offer = JSON.parse(raw);
  assert.equal(raw.length, receipt.counts.source_offer_extracted_bytes);
  assert.equal(archive.length, receipt.counts.source_offer_compressed_bytes);
  assert.equal(receipt.integration_source.baseline.bytes,188861);
  assert.equal(offer.integration.files["apps/fleetlab-city/hosted/integration.mjs"],readFileSync(fileURLToPath(new URL("../../../apps/fleetlab-city/hosted/integration.mjs",import.meta.url)),"utf8"));
  assert.equal(receipt.counts.net_original_source_growth_bytes,receipt.counts.raw_source_and_tools_bytes-2765799+receipt.integration_source.bytes-188861);
  assert.equal(offer.files["index.html"], readFileSync(join(source, "index.html"), "utf8"));
  assert.equal(offer.files["tools/package-proof.mjs"], readFileSync(join(source, "tools/package-proof.mjs"), "utf8"));
  assert.equal(offer.license.text, readFileSync(fileURLToPath(new URL("../../../LICENSE", import.meta.url)), "utf8"));
  assert.deepEqual(offer.media, receipt.media);
  assert.equal(receipt.discovery.owner,"hosted-integration");
  assert.equal(receipt.discovery.offline_action,false);
  const restored = join(scratch, "restored");
  writeMap(restored, new Map(Object.entries(offer.files)));
  for (const item of offer.media) {
    mkdirSync(dirname(join(restored, item.path)), { recursive: true });
    cpSync(join(source, item.path), join(restored, item.path));
  }
  assert.equal(buildHtml(restored), readFileSync(offline, "utf8"));
  const rebuilt = buildSite(restored);
  for (const [path, data] of files) if (!["network-flows/capacity/release.json","network-flows/software-delivery/release.json","network-flows/delivery-order/release.json","network-flows/rebalancing/release.json"].includes(path)) assert.deepEqual(rebuilt.get(path), data, path);
  assert.equal(JSON.parse(rebuilt.get("network-flows/capacity/release.json")).source_state, "SOURCE_COMMIT_UNAVAILABLE");
  execFileSync("git", ["-C", restored, "init", "-q"]);
  execFileSync(process.execPath, [join(restored, "tools/pack.mjs"), "--out", join(scratch, "restored-cli.html"), "--playground", restored]);
  assert.equal(readFileSync(join(scratch, "restored-cli.html"), "utf8"), readFileSync(offline, "utf8"));
  assert.deepEqual(tool.measurePackageProof({ site, playground: source, offline }).files, result.files);
});

test("development measurement rejects altered site, offline bytes, extras and resealed root HTML", () => {
  assert.equal(typeof tool.measurePackageProof, "function", "package validation is not implemented");
  const site = join(scratch, "negative-site");
  const files = buildSite(source);
  writeMap(site, files);
  const offline = join(scratch, "negative-offline.html");
  writeFileSync(offline, buildHtml(source));
  const options = { site, playground: source, offline };
  writeFileSync(join(site, "index.html"), files.get("index.html").replace("</body>", "<p>Changed</p></body>"));
  assert.throws(() => tool.measurePackageProof(options), /reproduc|differ|mismatch/i);
  writeFileSync(join(site, "index.html"), files.get("index.html"));
  writeFileSync(join(site, "extra.txt"), "extra");
  assert.throws(() => tool.measurePackageProof(options), /inventory|extra|unexpected/i);
  rmSync(join(site, "extra.txt"));
  const shared = "src/ui/dom.js", changed = `${files.get(shared)}\n`;
  const release = JSON.parse(files.get("network-flows/capacity/release.json"));
  release.emitted_files[shared] = release.source_files[shared] = { bytes: Buffer.byteLength(changed), sha256: hash(changed) };
  const { release_digest, ...payload } = release;
  writeFileSync(join(site, shared), changed);
  writeFileSync(join(site, "network-flows/capacity/release.json"), canonical({ ...payload, release_digest: hash(canonical(payload)) }) + "\n");
  assert.throws(() => tool.measurePackageProof(options), /reproduc|differ|mismatch/i);
  writeMap(site, files);
  writeFileSync(offline, `${buildHtml(source)}\n`);
  assert.throws(() => tool.measurePackageProof(options), /offline.*(?:reproduc|differ|mismatch)/i);
});

test("release package binds every source and its executing proof tool to the exact commit", () => {
  assert.equal(typeof tool.buildPackageProof, "function", "release binding is not implemented");
  const root = join(scratch, "repository");
  const playground = join(root, "playground/fleetlab");
  for (const path of ["src", "tools", "media", "capacity", "software-delivery", "delivery-order", "rebalancing", "styles.css", "index.html"].filter(path=>existsSync(join(source,path)))) cpSync(join(source, path), join(playground, path), { recursive: true });
  for(const name of ["hosted","tools","deploy"]){
    const base=fileURLToPath(new URL(`../../../apps/fleetlab-city/${name}`,import.meta.url));
    for(const path of readdirSync(base).filter(path=>/\.(?:mjs|py|json|css|html|md)$/.test(path))){
      const target=join(root,"apps/fleetlab-city",name,path);mkdirSync(dirname(target),{recursive:true});cpSync(join(base,path),target);
    }
  }
  cpSync(fileURLToPath(new URL("../../../apps/fleetlab-city/brand-media",import.meta.url)),join(root,"apps/fleetlab-city/brand-media"),{recursive:true});
  cpSync(fileURLToPath(new URL("../../../apps/fleetlab-city/tile-media",import.meta.url)),join(root,"apps/fleetlab-city/tile-media"),{recursive:true});
  cpSync(fileURLToPath(new URL("../../../apps/fleetlab-city/rebalancing-media",import.meta.url)),join(root,"apps/fleetlab-city/rebalancing-media"),{recursive:true});
  const dependency=join(root,"apps/fleetlab-city/citylib/public_notes.py");mkdirSync(dirname(dependency),{recursive:true});cpSync(fileURLToPath(new URL("../../../apps/fleetlab-city/citylib/public_notes.py",import.meta.url)),dependency);
  mkdirSync(join(root, "src/hermes/fleet"), { recursive: true });
  cpSync(fileURLToPath(new URL("../../../src/hermes/fleet/contracts.py", import.meta.url)), join(root, "src/hermes/fleet/contracts.py"));
  cpSync(fileURLToPath(new URL("../../../LICENSE", import.meta.url)), join(root, "LICENSE"));
  const git = (...args) => execFileSync("git", ["-C", root, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  git("init", "-q"); git("add", "playground", "src", "LICENSE", "apps");
  git("-c", "user.name=Package test", "-c", "user.email=package@example.invalid", "commit", "-qm", "source fixture");
  const sourceCommit = git("rev-parse", "HEAD");
  const site = join(scratch, "bound-site");
  writeMap(site, buildSite(playground, { sourceCommit }));
  const offline = join(scratch, "bound-offline.html");
  writeFileSync(offline, buildHtml(playground));
  const options = { site, playground, offline, sourceCommit };
  const result = tool.buildPackageProof(options);
  const packageDir = join(scratch, "package");
  writeMap(packageDir, result.files);
  assert.equal(result.receipt.source.state, "BOUND_FILES_MATCH_COMMIT");
  assert.doesNotThrow(() => tool.checkPackageProof({ ...options, packageDir }));
  const integrated = join(scratch, "integrated");
  const publication = { source_commit: sourceCommit, teaching_package: {
    path: tool.RECEIPT_PATH, bytes: result.files.get(tool.RECEIPT_PATH).length,
    sha256: createHash("sha256").update(result.files.get(tool.RECEIPT_PATH)).digest("hex"),
  } };
  writeMap(integrated, new Map([...buildSite(playground, { sourceCommit }), ...result.files,
    ["downloads/fleetlab-offline.html", readFileSync(offline)], ["publication.json", JSON.stringify(publication)], ["city-explorer/unrelated", "City inventory is checked by the outer verifier"]]));
  writeMap(integrated,lessonNavigation(buildSite(playground,{sourceCommit})));
  writeFileSync(join(integrated, "index.html"), "integration owns root HTML");
  assert.doesNotThrow(() => tool.checkIntegratedPackage({ site: integrated, playground, sourceCommit }));
  const onwardPath=join(integrated,'network-flows/capacity/index.html'),onward=readFileSync(onwardPath);
  writeFileSync(onwardPath,Buffer.concat([onward,Buffer.from('unlisted mutation')]));
  assert.throws(()=>tool.checkIntegratedPackage({site:integrated,playground,sourceCommit}),/integrated package|exceeds|limit|size/);
  writeFileSync(onwardPath,onward);
  publication.teaching_package.sha256 = "0".repeat(64);
  writeFileSync(join(integrated, "publication.json"), JSON.stringify(publication));
  assert.throws(() => tool.checkIntegratedPackage({ site: integrated, playground, sourceCommit }), /pointer|publication/i);
  const receiptFile = join(packageDir, tool.RECEIPT_PATH);
  for (const mutate of [
    value => { value.routes[0].bytes -= 1; },
    value => { value.routes[1].paths.pop(); },
    value => { value.emitted_files["src/ui/dom.js"].owner = "excluded"; },
  ]) {
    const altered = structuredClone(result.receipt);
    mutate(altered);
    writeFileSync(receiptFile, JSON.stringify(altered));
    assert.throws(() => tool.checkPackageProof({ ...options, packageDir }), /package.*(?:differ|mismatch)/i);
  }
  writeMap(packageDir, result.files);
  writeFileSync(join(packageDir, "extra"), "x");
  assert.throws(() => tool.checkPackageProof({ ...options, packageDir }), /inventory|unexpected|extra|count limit/i);
  rmSync(join(packageDir, "extra"));
  const archive = join(packageDir, result.receipt.source_offer.path);
  writeFileSync(archive, "mutated archive");
  assert.throws(() => tool.checkPackageProof({ ...options, packageDir }), /package.*(?:differ|mismatch)/i);
  rmSync(archive);
  assert.throws(() => tool.checkPackageProof({ ...options, packageDir }), /empty|inventory|missing/i);
  assert.throws(() => tool.buildPackageProof({ ...options, sourceCommit: "0".repeat(40) }), /commit/i);
  writeFileSync(join(root, "unrelated.txt"), "Same payloads, distinct release identity\n");
  git("add", "unrelated.txt");
  git("-c", "user.name=Package test", "-c", "user.email=package@example.invalid", "commit", "-qm", "second release fixture");
  assert.throws(() => tool.buildPackageProof({ ...options, sourceCommit: git("rev-parse", "HEAD") }), /site.*(?:reproduc|differ|mismatch)/i);
  writeFileSync(join(playground, "tools/package-proof.mjs"), `${readFileSync(join(source, "tools/package-proof.mjs"), "utf8")}\n`);
  assert.throws(() => tool.buildPackageProof(options), /executing|commit|tool/i);
  rmSync(join(playground, "tools/package-proof.mjs"));
  assert.throws(() => tool.buildPackageProof(options), /tool|inventory/i);
});

test("a source checkout cannot omit the executing package-proof tool from its binding", () => {
  const root = join(scratch, "omitted-tool"), playground = join(root, "playground/fleetlab");
  for (const path of ["src", "tools", "media", "capacity", "software-delivery", "delivery-order", "rebalancing", "styles.css", "index.html"].filter(path=>existsSync(join(source,path)))) cpSync(join(source, path), join(playground, path), { recursive: true });
  mkdirSync(join(root, ".git"));
  for(const name of ["hosted","tools","deploy"]){
    const base=fileURLToPath(new URL(`../../../apps/fleetlab-city/${name}`,import.meta.url));
    for(const path of readdirSync(base).filter(path=>/\.(?:mjs|py|json|css|html|md)$/.test(path))){
      const target=join(root,"apps/fleetlab-city",name,path);mkdirSync(dirname(target),{recursive:true});cpSync(join(base,path),target);
    }
  }
  cpSync(fileURLToPath(new URL("../../../apps/fleetlab-city/brand-media",import.meta.url)),join(root,"apps/fleetlab-city/brand-media"),{recursive:true});
  cpSync(fileURLToPath(new URL("../../../apps/fleetlab-city/tile-media",import.meta.url)),join(root,"apps/fleetlab-city/tile-media"),{recursive:true});
  cpSync(fileURLToPath(new URL("../../../apps/fleetlab-city/rebalancing-media",import.meta.url)),join(root,"apps/fleetlab-city/rebalancing-media"),{recursive:true});
  const dependency=join(root,"apps/fleetlab-city/citylib/public_notes.py");mkdirSync(dirname(dependency),{recursive:true});cpSync(fileURLToPath(new URL("../../../apps/fleetlab-city/citylib/public_notes.py",import.meta.url)),dependency);
  mkdirSync(join(root, "src/hermes/fleet"), { recursive: true });
  cpSync(fileURLToPath(new URL("../../../src/hermes/fleet/contracts.py", import.meta.url)), join(root, "src/hermes/fleet/contracts.py"));
  cpSync(fileURLToPath(new URL("../../../LICENSE", import.meta.url)), join(root, "LICENSE"));
  const site = join(scratch, "omitted-site"), offline = join(scratch, "omitted-offline.html");
  writeMap(site, buildSite(playground));
  writeFileSync(offline, buildHtml(playground));
  rmSync(join(playground, "tools/package-proof.mjs"));
  assert.throws(() => tool.measurePackageProof({ site, playground, offline }), /tool.*inventory|executing/i);
});
