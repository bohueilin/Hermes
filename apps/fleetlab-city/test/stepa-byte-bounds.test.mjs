import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {ARTWORK_GROUPS,BRAND_MEDIA,BRAND_TEXT,STATIC_INTEGRATION_FILES,renderPage} from '../hosted/site-transform.mjs';
import {RECEIPT_PATH,measurePackageProof} from '../../../playground/fleetlab/tools/package-proof.mjs';
import {INTEGRATION_TEXT_PATHS,measureIntegratedText} from '../../../playground/fleetlab/tools/software-delivery-package.mjs';
import {buildSite,buildHtml} from '../../../playground/fleetlab/tools/pack.mjs';
import {integratedRootFiles,verifyIntegrationAssets} from '../deploy/integration-assets.mjs';
import {fingerprint,writeFiles} from './stage-fixture.mjs';

// Step A bounds (docs/FLEETLAB_NETWORK_FLOWS_STEP_A_SPEC_2026-10-25.md section 3): BEFORE value at b15055c plus headroom.
// Unit text sits 1,859 B under the stage: publication.json (1,800 B) is stage-only and the release receipt is 59 B longer.
// Uncommitted bound files read 9 B low per sidecar; only depot-owned text, which must stay unchanged, has a floor. nf03 stays enhancement-packaging's gate.
const BOUNDS={nf04_closure_bytes:221334+4096,delivery_order_closure_bytes:225063+4096,r1_closure_bytes:196347+4096,r3_closure_bytes:152391+4096,depot_closure_bytes:513471+2048,depot_route_local_bytes:[418159-9,418159],emitted_text_bytes:3577477-1859,integration_text_bytes:133152-1800,brand_text_bytes:73889+2048};
const within=(key,value)=>{const bound=BOUNDS[key];return Array.isArray(bound)?value>=bound[0]&&value<=bound[1]:value<=bound;};
const bound=key=>JSON.stringify(BOUNDS[key]??'enhancement-packaging.test.mjs');
const report=(key,value,claim=`outside ${bound(key)}`)=>`${key} ${value} ${claim} (node ${process.version})`;

const playground=fileURLToPath(new URL('../../../playground/fleetlab/',import.meta.url));
const hosted=name=>readFileSync(new URL('../hosted/'+name,import.meta.url));
const page=name=>renderPage(hosted(name).toString(),{analytics:true});
const source='network-flows/sources/'+'0'.repeat(64)+'.json.gz',rollback='city-explorer/releases/0000000000000000';
function build(){
 const teaching=buildSite(playground),offline=buildHtml(playground),offlineHash=fingerprint(offline).sha256;
 // The extended map: the enhancement-packaging pattern plus the 12 integration files built as integration-assets.mjs:88-121 does.
 const integrated=new Map([...teaching,...integratedRootFiles(teaching,{branded:true,rollback,source})]);
 for(const name of [...BRAND_TEXT,'integration.mjs','integration.css','not-found.css'])integrated.set(name,hosted(name));
 integrated.set('404.html',page('404.html'));
 integrated.set('network-flows/fleet-day/index.html',page('fleet-day-redirect.html'));
 for(const [path,name]of Object.entries(STATIC_INTEGRATION_FILES))integrated.set(path,path.endsWith('.html')?page(name):hosted(name));
 integrated.set('city-explorer/releases/index.html',hosted('city-releases-redirect.html'));
 integrated.set('downloads/fleetlab-offline.sha256',`${offlineHash}  fleetlab-offline.html\n`);
 integrated.set('downloads/verify-offline.txt',
  'FleetLab offline edition — download verification\n\n'+
  `SHA-256: ${offlineHash}\n`+
  'macOS/Linux: shasum -a 256 fleetlab-offline.html\n'+
  'Windows PowerShell: Get-FileHash .\\fleetlab-offline.html -Algorithm SHA256\n\n'+
  'Compare the full digest before opening. This detects corruption against this website\'s '+
  'published copy, not independent authenticity. The offline file excludes City Explorer.\n');
 const dir=mkdtempSync(join(tmpdir(),'stepa-byte-bounds-'));
 let proof;
 try{writeFiles(join(dir,'site'),teaching);writeFileSync(join(dir,'offline.html'),offline);proof=measurePackageProof({site:join(dir,'site'),playground,offline:join(dir,'offline.html')});}
 finally{rmSync(dir,{recursive:true,force:true});}
 // The development receipt counts only when it is in both maps (package-proof.mjs:404-406).
 const receipt=proof.files.get(RECEIPT_PATH),unitTeaching=new Map([...teaching,[RECEIPT_PATH,receipt]]);
 integrated.set(RECEIPT_PATH,receipt);
 const measure=map=>({...measureIntegratedText(unitTeaching,map),brand_text_bytes:BRAND_TEXT.reduce((n,name)=>n+Buffer.byteLength(map.get(name)),0)});
 const counts=measure(integrated);
 console.log('stepa-byte-bounds',JSON.stringify(counts));
 return {offline,offlineHash,integrated,proof,measure,counts};
}
// Built once, on first use, and only by the measuring tests: a build failure is reported by each of them, and the
// artwork test, which never builds, still names the file whose bytes or SHA-256 moved.
let built;
const setup=()=>{
 if(!built)try{built={value:build()};}catch(error){built={error};}
 if('error' in built)throw built.error;
 return built.value;
};
const resized=(path,delta)=>{const {integrated,measure}=setup(),copy=new Map(integrated),data=Buffer.from(copy.get(path));copy.set(path,delta<0?data.subarray(0,data.length+delta):Buffer.concat([data,Buffer.alloc(delta,32)]));return measure(copy);};
// Each bound admits its exact ceiling (and floor) and rejects one byte beyond it, grown or shrunk in one file of the measured set.
function bites(key,path){
 const {counts}=setup(),[low,high]=Array.isArray(BOUNDS[key])?BOUNDS[key]:[null,BOUNDS[key]];
 for(const [edge,step,name]of [[high,1,'upper bound'],...low===null?[]:[[low,-1,'floor']]]){
  const at=resized(path,edge-counts[key])[key],past=resized(path,edge-counts[key]+step)[key];
  assert.ok(within(key,at)&&!within(key,past),report(key,counts[key],`${name} does not bite through ${path}: ${at} and ${past} against ${bound(key)}`));
 }
}

test('the software delivery, delivery order, rebalancing, dispatch and depot closures stay inside their Step A bounds',()=>{
 const {counts}=setup();
 for(const key of ['nf04_closure_bytes','delivery_order_closure_bytes','r1_closure_bytes','r3_closure_bytes','depot_closure_bytes','depot_route_local_bytes'])assert.ok(within(key,counts[key]),report(key,counts[key]));
 for(const [key,dir]of [['nf04','network-flows/software-delivery'],['delivery_order','network-flows/delivery-order'],['r1','network-flows/rebalancing'],['r3','network-flows/dispatch'],['depot','depot-readiness']])bites(`${key}_closure_bytes`,`${dir}/visual.css`);
 bites('depot_route_local_bytes','depot-readiness/visual.css');
});

test('unit emitted and integration text, with the development receipt, stay inside the stage bounds less the stage-only bytes',()=>{
 const {offline,offlineHash,integrated,proof,counts}=setup();
 assert.equal(proof.receipt.source.state,'DEVELOPMENT_MEASUREMENT_NOT_RELEASE_BOUND');
 assert.deepEqual(INTEGRATION_TEXT_PATHS.filter(path=>!integrated.has(path)),['publication.json']);
 // The upload verifier rebuilds every integration file and fails on any byte it does not reproduce; a zero-byte
 // publication.json record satisfies its inventory, so its own sums must equal the unit measure.
 const files=Object.fromEntries([...integrated].map(([path,data])=>[path,fingerprint(data)]));
 for(const [path,r]of Object.entries(BRAND_MEDIA))files[path]={bytes:r.bytes,sha256:r.sha256};
 Object.assign(files,{'downloads/fleetlab-offline.html':fingerprint(offline),[source]:fingerprint(proof.files.get(proof.receipt.source_offer.path)),'publication.json':fingerprint('')});
 const selection={hosted_presentation:'fleetlab.hosted-presentation/1.0.0',rollback:{path:rollback},offline_sha256:offlineHash};
 const verified=verifyIntegrationAssets(fileURLToPath(new URL('../../../',import.meta.url)),null,files,{[RECEIPT_PATH]:files[RECEIPT_PATH],[source]:files[source]},selection);
 const keys=['emitted_text_bytes','integration_text_bytes'],unit=Object.fromEntries(keys.map(key=>[key,counts[key]]));
 assert.deepEqual(verified,unit,`verifyIntegrationAssets ${JSON.stringify(verified)} is not the unit measure ${JSON.stringify(unit)} (bounds ${keys.map(bound).join(', ')}; node ${process.version})`);
 for(const key of keys)assert.ok(within(key,counts[key]),report(key,counts[key]));
 bites('emitted_text_bytes',RECEIPT_PATH);bites('integration_text_bytes','network-flows/hub.css');
});

test('the hosted brand text keeps its eight files, matches the Python integrator and shares its headroom with every closure',()=>{
 const names=['brand.mjs','brand.css','visitor.mjs','visitor-families.mjs','visitor.css','enhancement-motion.mjs','enhancement-media.mjs','enhancement-media.css'];
 assert.deepEqual(BRAND_TEXT,names);
 const python=text=>{const tuples=[...text.matchAll(/^TEXT = \(([^)]*)\)/gm)];assert.equal(tuples.length,1,'one Python TEXT tuple');return [...tuples[0][1].matchAll(/"([^"]+)"/g)].map(m=>m[1]);};
 const integrator=readFileSync(new URL('../tools/hosted-brand.py',import.meta.url),'utf8');
 assert.deepEqual(python(integrator),names);
 assert.notDeepEqual(python(integrator.replace('"visitor.css",','')),names);
 const {counts}=setup();
 assert.ok(within('brand_text_bytes',counts.brand_text_bytes),report('brand_text_bytes',counts.brand_text_bytes));
 bites('brand_text_bytes','brand.css');
 // software-delivery-package.mjs:109 adds every brand byte to all six closures; depot-owned text excludes it.
 const grown=resized('brand.css',1);
 for(const key of Object.keys(counts)){const step=key==='depot_route_local_bytes'?0:1;assert.equal(grown[key]-counts[key],step,report(key,counts[key],`moved ${grown[key]-counts[key]} B, not ${step} B, for one brand.css byte (bound ${bound(key)})`));}
});

test('the hosted artwork inventory is exact: five groups, 41 records, 7,793,265 B, every file bound by bytes and SHA-256',()=>{
 assert.deepEqual(ARTWORK_GROUPS,[{root:'apps/fleetlab-city/diagram-media',maxBytes:524288,maxFiles:4},{root:'apps/fleetlab-city/rebalancing-media',maxBytes:2097152,maxFiles:4},{root:'apps/fleetlab-city/brand-media',maxBytes:2097152,maxFiles:7},{root:'apps/fleetlab-city/tile-media',maxBytes:2097152,maxFiles:19},{root:'apps/fleetlab-city/enhancement-media',maxBytes:4194304,maxFiles:8}]);
 const summary=media=>{
  const records=Object.values(media),groups=Object.fromEntries(ARTWORK_GROUPS.map(g=>{const own=records.filter(r=>r.source.startsWith(g.root+'/'));return [g.root.split('/').at(-1).replace('-media',''),[own.length,own.reduce((n,r)=>n+r.bytes,0)]];}));
  const inventory=createHash('sha256').update(JSON.stringify(Object.entries(media).sort(([a],[b])=>a<b?-1:1).map(([name,r])=>[name,r.source,r.bytes,r.sha256]))).digest('hex');
  return {records:records.length,bytes:records.reduce((n,r)=>n+r.bytes,0),groups,inventory};
 };
 const expected={records:41,bytes:7793265,groups:{diagram:[4,510436],rebalancing:[4,1983799],brand:[7,623114],tile:[19,1990494],enhancement:[7,2685422]},inventory:'bcd79b1535cf12f0b3e8c6f42d3563109a1c5e34bdd5245276da2abf9de0f7e9'};
 assert.deepEqual(summary(BRAND_MEDIA),expected);
 for(const [name,r]of Object.entries(BRAND_MEDIA)){const disk=fingerprint(readFileSync(new URL('../../../'+r.source,import.meta.url))),record={bytes:r.bytes,sha256:r.sha256};assert.deepEqual(disk,record,`${name}: ${r.source} is ${JSON.stringify(disk)} on disk, ${JSON.stringify(record)} in its record`);}
 // A same-size re-encode moves only the record digest.
 const [first]=Object.keys(BRAND_MEDIA),swapped=summary({...BRAND_MEDIA,[first]:{...BRAND_MEDIA[first],sha256:'0'.repeat(64)}});
 assert.notEqual(swapped.inventory,expected.inventory);assert.deepEqual({...swapped,inventory:expected.inventory},expected);
});
