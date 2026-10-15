import {R3_MODULES} from '../tools/dispatch-package.mjs';
import {R1_MODULES} from '../tools/rebalancing-package.mjs';
import {ORDER_MODULES} from '../tools/delivery-order-package.mjs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {cpSync,mkdirSync,mkdtempSync,readFileSync,readdirSync,rmSync,writeFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {after,test} from 'node:test';
import {buildSite,buildHtml} from '../tools/pack.mjs';
import {checkSite,labelsFromContracts} from '../tools/check-dist.mjs';
import {measurePackageProof} from '../tools/package-proof.mjs';
import {releaseProblems} from '../tools/release-sidecar.mjs';
import * as provenance from '../tools/release-sidecar.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)), repository=fileURLToPath(new URL('../../../',import.meta.url));
const scratch=mkdtempSync(join(tmpdir(),'fleetlab-nf04-package-'));
after(()=>rmSync(scratch,{recursive:true,force:true}));
const tool=await import('../tools/software-delivery-package.mjs').catch(error=>{if(error.code==='ERR_MODULE_NOT_FOUND')return {};throw error;});
const write=(root,path,text)=>{mkdirSync(dirname(join(root,path)),{recursive:true});writeFileSync(join(root,path),text);};
const labels=labelsFromContracts(repository);

test('the generated boot injects the independently packaged study into the app',()=>{
  const files=buildSite(root),study='src/data/software-delivery-study.js';
  assert.ok(tool.DELIVERY_ENTRIES.includes(study),'study must remain an explicit dependency when UI cannot import data');
  assert.ok(files.has(study),'injected manifest is emitted');
  assert.match(files.get('network-flows/software-delivery/boot.js'),/import \{ DELIVERY_STUDY \} from "\.\.\/\.\.\/src\/data\/software-delivery-study\.js";/);
  assert.match(files.get('network-flows/software-delivery/boot.js'),/manifest: DELIVERY_STUDY/);
  assert.ok(JSON.parse(files.get(tool.DELIVERY_RELEASE)).emitted_files[study]);
});

test('historical 2621323-byte legacy generation plus 118 bytes fails without using sidecar recovery',()=>{
  assert.equal(typeof tool.measureSiteOwnership,'function','owner gate is not implemented');
  const files=buildSite(root), measured=tool.measureSiteOwnership(files);
  files.set('styles.css',files.get('styles.css')+' '.repeat(2621323-measured.legacy_text_bytes+118));
  assert.throws(()=>tool.measureSiteOwnership(files),/legacy.*2621441.*2621440/);
});

test('300000-byte scratch NF04-only module has a valid emitted build path without increasing legacy',()=>{
  const source=join(scratch,'source');cpSync(root,source,{recursive:true});
  for(const path of [...tool.DELIVERY_MODULES,...ORDER_MODULES,...R1_MODULES,...R3_MODULES])rmSync(join(source,path),{force:true});
  rmSync(join(source,'rebalancing'),{recursive:true,force:true});
  rmSync(join(source,'dispatch'),{recursive:true,force:true});
  rmSync(join(source,'delivery-order'),{recursive:true,force:true});
  rmSync(join(source,'software-delivery'),{recursive:true,force:true});
  // A scratch repository holds copied validation and integration originals, never modified production sources.
  mkdirSync(join(scratch,'.git'));
  for(const path of ['src/hermes/fleet/contracts.py','LICENSE','apps/fleetlab-city/citylib/public_notes.py'])write(scratch,path,readFileSync(join(repository,path)));
  for(const name of ['hosted','tools','deploy']){
    const base=join(repository,'apps/fleetlab-city',name);
    for(const file of readdirSync(base).filter(path=>/\.(?:mjs|py|json|css|html|md)$/.test(path)))write(scratch,`apps/fleetlab-city/${name}/${file}`,readFileSync(join(base,file)));
  }
  cpSync(join(repository,'apps/fleetlab-city/brand-media'),join(scratch,'apps/fleetlab-city/brand-media'),{recursive:true});
  cpSync(join(repository,'apps/fleetlab-city/tile-media'),join(scratch,'apps/fleetlab-city/tile-media'),{recursive:true});
  cpSync(join(repository,'apps/fleetlab-city/rebalancing-media'),join(scratch,'apps/fleetlab-city/rebalancing-media'),{recursive:true});
  const before=buildSite(source), offline=buildHtml(source);
  const prefix='export function startSoftwareDelivery() {}\n';
  write(source,'src/ui/software-delivery-app.js',prefix+' '.repeat(300000-prefix.length));
  write(source,'src/runtime/software-delivery-worker.js','export const ready = true;\n');
  write(source,'src/data/software-delivery-study.js','export const DELIVERY_STUDY = {};\n');
  write(source,'software-delivery/index.html','<!doctype html><html><head><title>Software delivery</title></head><body><main>One update. Four vehicles.</main></body></html>');
  write(source,'software-delivery/visual.css','body { color: #123; }\n');
  const files=buildSite(source);
  assert.ok(files.has('network-flows/software-delivery/index.html'),'new route was omitted');
  assert.equal(typeof tool.measureSiteOwnership,'function','owner gate is not implemented');
  const base=tool.measureSiteOwnership(before), expanded=tool.measureSiteOwnership(files);
  assert.equal(expanded.legacy_text_bytes,base.legacy_text_bytes);
  assert.ok(expanded.nf04_route_local_bytes>=300000);
  assert.ok(expanded.nf04_closure_bytes<524288);
  assert.equal(buildHtml(source),offline);
  assert.deepEqual(checkSite(files,{requiredLabels:labels}),[]);
  const site=join(scratch,'site');for(const [path,data]of files)write(site,path,data);
  const offlinePath=join(scratch,'offline.html');writeFileSync(offlinePath,offline);
  const proof=measurePackageProof({site,playground:source,offline:offlinePath});
  assert.equal(proof.receipt.counts.legacy_text_bytes,base.legacy_text_bytes);
  assert.ok(proof.receipt.counts.raw_source_and_tools_bytes<=3145728);
  assert.ok(proof.receipt.counts.source_offer_extracted_bytes<=4194304);
  assert.equal(proof.receipt.routes.find(route=>route.id==='nf04').bytes,expanded.nf04_closure_bytes);
  console.log('scratch-package-counters',JSON.stringify(proof.receipt.counts));
  const integrationSource=join(scratch,'apps/fleetlab-city/hosted/integration.mjs'),originalIntegration=readFileSync(integrationSource);
  writeFileSync(integrationSource,Buffer.from([255]));
  assert.throws(()=>measurePackageProof({site,playground:source,offline:offlinePath}),/UTF-8/);
  writeFileSync(integrationSource,originalIntegration);
  const deliveryPath='network-flows/software-delivery/release.json';
  const deliveryOriginal=files.get(deliveryPath),forged=JSON.parse(deliveryOriginal);
  for(const path of ['tools/media.mjs','tools/comment-strip.mjs','tools/check-dist.mjs'])assert.ok(forged.source_files[path],`missing build dependency ${path}`);
  forged.source_files['src/ui/software-delivery-app.js'].sha256='0'.repeat(64);
  const {release_digest,...payload}=forged;
  const canonical=value=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);
  files.set(deliveryPath,canonical({...payload,release_digest:createHash('sha256').update(canonical(payload)).digest('hex')}));
  assert.ok(tool.softwareDeliveryProblems(files).some(problem=>/source fingerprint/.test(problem)),'resealed source fingerprint must reject');
  files.set(deliveryPath,deliveryOriginal);
  assert.equal(typeof provenance.deliverySourceProblems,'function','NF04 checkout source validation is missing');
  assert.deepEqual(provenance.deliverySourceProblems(files,{playground:source}),[]);
  const toolForgery=JSON.parse(deliveryOriginal);toolForgery.source_files['tools/pack.mjs'].sha256='0'.repeat(64);
  delete toolForgery.release_digest;
  files.set(deliveryPath,canonical({...toolForgery,release_digest:createHash('sha256').update(canonical(toolForgery)).digest('hex')}));
  assert.ok(provenance.deliverySourceProblems(files,{playground:source}).some(problem=>/reviewed source fingerprint/.test(problem)));
  files.set(deliveryPath,deliveryOriginal);
  const release=JSON.parse(files.get('network-flows/capacity/release.json'));
  assert.equal(release.schema,'fleetlab.capacity-release/2.0.0');
  assert.equal(release.emitted_scope,'NF03_CAPACITY_ROUTE_CLOSURE_V1');
  assert.ok(Object.keys(release.emitted_files).every(path=>!path.includes('software-delivery')));
  assert.deepEqual(releaseProblems(files),[]);
  release.emitted_scope='WHOLE_SITE';
  files.set('network-flows/capacity/release.json',JSON.stringify(release));
  assert.ok(releaseProblems(files).length>0);
});

test('unknown emitted ownership fails closed; declared shared imports remain legacy counted',()=>{
  assert.equal(typeof tool.measureSiteOwnership,'function','owner gate is not implemented');
  const files=buildSite(root);files.set('src/ui/unknown-owner.js','export const unknown = 1;');
  assert.throws(()=>tool.measureSiteOwnership(files),/unknown.*owner|ownership/);
});

test('a newly shared NF04 dependency is charged to legacy and removed from route-local ownership',()=>{
  const files=buildSite(root);
  const path='src/model/software-delivery-contract.js';
  assert.ok(files.has(path),'the production NF04 route must include its contract');
  const before=tool.measureSiteOwnership(files),added="import {DELIVERY_INPUT_SCHEMA} from '../model/software-delivery-contract.js';\n";
  files.set('src/ui/app.js',added+files.get('src/ui/app.js'));
  const after=tool.measureSiteOwnership(files);
  assert.equal(after.owners[path],'legacy-shared');
  assert.equal(after.legacy_text_bytes,before.legacy_text_bytes+Buffer.byteLength(files.get(path))+Buffer.byteLength(added));
  assert.equal(after.nf04_route_local_bytes,before.nf04_route_local_bytes-Buffer.byteLength(files.get(path)));
});

test('integration text remains a subset of capped final aggregate',()=>{
  assert.equal(typeof tool.measureIntegratedText,'function','final aggregate gate is not implemented');
  const teaching=new Map([['index.html','abc'],['boot.js','abc'],['_headers','abc'],['src/a.js','abc']]);
  const final=new Map([...teaching,['integration.mjs','1234567'],['integration.css','12'],['publication.json','123'],['404.html','1']]);
  final.set('index.html','12345');
  const measured=tool.measureIntegratedText(teaching,final);
  assert.equal(measured.integration_text_bytes,24);
  assert.equal(measured.emitted_text_bytes,27);
  final.set('integration.mjs',' '.repeat(3145728));
  assert.throws(()=>tool.measureIntegratedText(teaching,final),/aggregate|emitted.*budget/);
});

test('final transformed headers remain inside each complete route closure cap',()=>{
  const teaching=buildSite(root),final=new Map(teaching);
  const closure=new Set([...tool.capacityScope(teaching),'network-flows/capacity/release.json','_headers']);
  const bytes=[...closure].reduce((total,path)=>total+Buffer.byteLength(teaching.get(path)),0);
  final.set('_headers',final.get('_headers')+' '.repeat(524289-bytes));
  assert.throws(()=>tool.measureIntegratedText(teaching,final),/nf03.*closure.*budget/);
  // Isolate the NF04 closure guard from the independently capped aggregate.
  const nf04Only=new Map([...teaching].filter(([path])=>!ORDER_MODULES.has(path)&&!path.startsWith('network-flows/delivery-order/')&&!R1_MODULES.has(path)&&!path.startsWith('network-flows/rebalancing/')&&!R3_MODULES.has(path)&&!path.startsWith('network-flows/dispatch/')));
  const nf04=tool.measureSiteOwnership(nf04Only).nf04_closure_bytes;
  final.set('_headers',teaching.get('_headers')+' '.repeat(524289-nf04));
  assert.throws(()=>tool.measureIntegratedText(nf04Only,final),/closure.*budget/);
});

test('hosted onward navigation is conditional and preserves the original teaching pages',async()=>{
 const {lessonNavigation}=await import('../tools/software-delivery-package.mjs');
 assert.equal(typeof lessonNavigation,'function');
 const teaching=new Map([['network-flows/capacity/index.html','<body>capacity</body>']]);
 assert.equal(lessonNavigation(teaching).size,0);
 teaching.set('network-flows/software-delivery/release.json','present');
 const onward=lessonNavigation(teaching);
 assert.match(onward.get('network-flows/capacity/index.html'),/Next lesson.*software-delivery/);
 assert.equal(teaching.get('network-flows/capacity/index.html'),'<body>capacity</body>');
 assert.equal(onward.size,1);
});
