// Step A byte bounds, Playground rows (docs/FLEETLAB_NETWORK_FLOWS_STEP_A_SPEC_2026-10-25.md section 3). Baselines were
// measured at b15055c under the official Node 22.23.4. Upper bounds only: uncommitted or git-less trees read low, and the
// Node version string and its zlib shift some figures, so every message names the runtime.
import {after,test} from 'node:test';import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';
import {mkdirSync,mkdtempSync,realpathSync,rmSync,writeFileSync} from 'node:fs';import {tmpdir} from 'node:os';import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';import {gunzipSync} from 'node:zlib';
import {buildSite,buildHtml} from '../tools/pack.mjs';
import {measureSiteOwnership} from '../tools/software-delivery-package.mjs';
import {buildPackageProof,measurePackageProof,RECEIPT_PATH} from '../tools/package-proof.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),site=buildSite(root),runtime=`Node ${process.version}, zlib ${process.versions.zlib}`;
// One temp site and offline edition, shared by the development measurement and the release build.
const scratch=realpathSync(mkdtempSync(join(tmpdir(),'fleetlab-stepa-'))),inputs={site:join(scratch,'site'),playground:root,offline:join(scratch,'offline.html')};
after(()=>rmSync(scratch,{recursive:true,force:true}));
for(const [p,d]of site){mkdirSync(dirname(join(inputs.site,p)),{recursive:true});writeFileSync(join(inputs.site,p),d);}
writeFileSync(inputs.offline,buildHtml(root));
let memo;
// One development-mode measurement shared by every receipt row (the package-proof.test.mjs:72-80 pattern).
const proof=()=>memo??=(()=>{const result=measurePackageProof(inputs),{counts,integration_source}=result.receipt;
 console.log('stepa-playground-counts',JSON.stringify({legacy_text_bytes:counts.legacy_text_bytes,raw_source_and_tools_bytes:counts.raw_source_and_tools_bytes,
  source_offer_extracted_bytes:counts.source_offer_extracted_bytes,source_offer_compressed_bytes:counts.source_offer_compressed_bytes,
  package_metadata_bytes:counts.package_metadata_bytes,integration_source_bytes:integration_source.bytes,node:process.version,zlib:process.versions.zlib}));
 return result;})();
// The extracted offer and the receipt as bytes, each checked against the count the receipt reports for it.
const sizes=({receipt,files})=>{const raw=gunzipSync(files.get(receipt.source_offer.path)),meta=files.get(RECEIPT_PATH);
 assert.equal(raw.length,receipt.counts.source_offer_extracted_bytes);assert.equal(meta.length,receipt.counts.package_metadata_bytes);
 return {offer:JSON.parse(raw),raw:raw.length,meta:meta.length};};

test('legacy text stays within 2,048 B of its Step A baseline',()=>{
 const v=measureSiteOwnership(site).legacy_text_bytes;
 assert.ok(v<=2605087+2048,`legacy text ${v} > ${2605087+2048} (baseline 2605087; ${runtime})`);
});

const ROWS=[['raw source and tools',r=>r.counts.raw_source_and_tools_bytes,3553269,16384],
 ['development source offer, extracted',r=>r.counts.source_offer_extracted_bytes,4079681,24576],
 ['development source offer, compressed',r=>r.counts.source_offer_compressed_bytes,1147629,8192],
 ['development package metadata',r=>r.counts.package_metadata_bytes,44302,1024],
 ['integration source',r=>r.integration_source.bytes,389082,8192]];
for(const [name,read,base,room]of ROWS)test(`${name} stays within ${room.toLocaleString('en-US')} B of its Step A baseline`,()=>{
 const v=read(proof().receipt);
 assert.ok(v<=base+room,`${name} ${v} > ${base+room} (baseline ${base}; ${runtime})`);
});

test('the development offer and receipt carry the development source identity',()=>{
 const dev={commit:null,tree:null,state:'DEVELOPMENT_MEASUREMENT_NOT_RELEASE_BOUND'};
 assert.deepEqual(proof().receipt.source,dev);assert.deepEqual(sizes(proof()).offer.source,dev);
});

// The stage release bounds are these development bounds plus 59 B. A real release build at HEAD, on the same site, must
// therefore exceed the development extracted offer and receipt by exactly 59 B, and its offer may differ only in its
// source identity. Release mode refuses bound files that differ from HEAD, so an uncommitted local tree skips; CI never does.
const REFUSED=/source (?:commit input inventory mismatch|commit lacks input|differs from requested commit)|bound source files differ from the requested source commit/;
test('a release build at HEAD adds exactly 59 B to the development offer and receipt',t=>{
 let release;
 try{release=buildPackageProof({...inputs,sourceCommit:execFileSync('git',['-C',root,'rev-parse','HEAD'],{encoding:'utf8'}).trim()});}
 catch(e){if(process.env.CI||!REFUSED.test(e.message))throw e;return t.skip(`uncommitted bound files, which release mode refuses: ${e.message}`);}
 const dev=sizes(proof()),rel=sizes(release);
 assert.equal(rel.raw-dev.raw,59,`release extracted offer ${rel.raw} vs development ${dev.raw} (${runtime})`);
 assert.equal(rel.meta-dev.meta,59,`release receipt ${rel.meta} vs development ${dev.meta} (${runtime})`);
 const keys=v=>Object.keys(v).sort();assert.deepEqual(keys(rel.offer),keys(dev.offer));
 assert.deepEqual(keys(rel.offer).filter(k=>JSON.stringify(rel.offer[k])!==JSON.stringify(dev.offer[k])),['source']);
});
