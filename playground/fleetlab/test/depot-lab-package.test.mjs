// Depot lab packaging (reconciliation 7.2 Q6, 11.5 Tasks 6 and 10; engineering note BD-16, BD-17): explicit owner,
// complete module inventory, Q6 caps on their own branch, sidecar binding, copy coverage and the scoped dash exception.
import test from 'node:test';import assert from 'node:assert/strict';
import {readdirSync,readFileSync} from 'node:fs';import {join} from 'node:path';import {fileURLToPath} from 'node:url';
import {buildSite,buildHtml} from '../tools/pack.mjs';
import {DEPOT_DIR,DEPOT_PAGE,DEPOT_RELEASE,DEPOT_FILES,DEPOT_ENTRIES,DEPOT_MODULES,DEPOT_MODULE_PATH,DEPOT_BOOT,depotPackageProblems} from '../tools/depot-lab-package.mjs';
import {measureSiteOwnership,measureIntegratedText,routeModules,OWNER_LIMITS} from '../tools/software-delivery-package.mjs';
import {checkSite,copyProblems,labelsFromContracts,COPY_MODULES,DEPOT_HONESTY_SENTENCE} from '../tools/check-dist.mjs';
import {LIMITS} from '../tools/package-proof.mjs';
import {HONESTY} from '../src/model/depot-lab/registry.js';
const root=fileURLToPath(new URL('../',import.meta.url)),labels=labelsFromContracts(fileURLToPath(new URL('../../../',import.meta.url)));
const site=buildSite(root),SHARED=['src/core/canon.js','src/core/sha256.js','src/model/depot-flow-contract.js','src/ui/dom.js'];
const size=v=>Buffer.byteLength(v),sum=(files,paths)=>[...paths].reduce((n,p)=>n+size(files.get(p)),0);
const family=()=>{const out=[],list=(dir,keep)=>readdirSync(join(root,dir)).filter(keep).map(f=>`${dir}/${f}`);
 for(const d of ['src/model/depot-lab','src/model/depot-lab-verify'])out.push(...list(d,f=>f.endsWith('.js')));
 for(const d of ['src/runtime','src/ui'])out.push(...list(d,f=>/^depot-lab-.*\.js$/.test(f)));return out.sort();};

test('the depot route emits its page, pinned boot, stylesheet and a valid source sidecar at depot-readiness/',()=>{
 assert.equal(DEPOT_BOOT,'import { startDepotLab } from "../src/ui/depot-lab-app.js";\nstartDepotLab({ createWorker: () => new Worker(new URL("../src/runtime/depot-lab-worker.js", import.meta.url), { type: "module" }) });\n');
 assert.deepEqual(DEPOT_FILES,['depot-readiness/index.html','depot-readiness/boot.js','depot-readiness/visual.css','depot-readiness/release.json']);
 assert.equal(DEPOT_DIR,'depot-readiness');assert.equal(site.get(`${DEPOT_DIR}/boot.js`),DEPOT_BOOT);
 assert.equal(site.get(`${DEPOT_DIR}/visual.css`),readFileSync(join(root,'depot-lab/visual.css'),'utf8'));
 assert.ok(site.get(DEPOT_PAGE).includes('<link rel="stylesheet" href="./visual.css">')&&!site.get(DEPOT_PAGE).includes('styles.css'));
 const release=JSON.parse(site.get(DEPOT_RELEASE));
 assert.equal(release.schema,'fleetlab.depot-lab-release/1.0.0');assert.equal(release.emitted_scope,'DEPOT_LAB_ROUTE_CLOSURE_V1');
 assert.equal(release.page_source,readFileSync(join(root,'depot-lab/index.html'),'utf8'));
 assert.ok(['MODIFIED_SOURCE','BOUND_FILES_MATCH_COMMIT'].includes(release.source.source_state));
 assert.deepEqual(depotPackageProblems(site),[]);
 assert.ok(![...site.keys()].some(p=>p.startsWith('depot-lab/')),'the source folder is never emitted');
 const forged=new Map(site);forged.set('src/model/depot-lab/engine.js',site.get('src/model/depot-lab/engine.js')+'\n');
 assert.notDeepEqual(depotPackageProblems(forged),[]);
});

test('DEPOT_MODULES is exactly the depot family in the route closure and on disk; shared leaves keep the legacy owner',()=>{
 const closure=[...routeModules(site,DEPOT_ENTRIES)];
 assert.deepEqual(closure.filter(p=>DEPOT_MODULE_PATH.test(p)).sort(),[...DEPOT_MODULES].sort());
 assert.deepEqual(family(),[...DEPOT_MODULES].sort(),'every depot module file is declared');
 assert.deepEqual(closure.filter(p=>!DEPOT_MODULES.has(p)).sort(),SHARED);
 const {owners}=measureSiteOwnership(site);
 for(const p of [...DEPOT_MODULES,...DEPOT_FILES])assert.equal(owners[p],'depot-lab',p);
 for(const p of SHARED)assert.match(owners[p],/^legacy(?:-shared)?$/,p);
 for(const p of ['src/model/depot-readiness.js','src/ui/readiness-view.js','src/model/depot-flow.js'])assert.ok(!DEPOT_MODULE_PATH.test(p),p);
});

test('an undeclared depot dependency fails closed instead of falling through to legacy',()=>{
 const files=new Map(site),app='src/ui/depot-lab-app.js',extra='src/ui/depot-lab-undeclared.js';
 files.set(extra,'export const x = 1;\n');files.set(app,`import {x} from './depot-lab-undeclared.js';\n${site.get(app)}`);
 assert.throws(()=>measureSiteOwnership(files),/undeclared depot dependency: src\/ui\/depot-lab-undeclared\.js/);
 const loose=new Map(site);loose.set(extra,'export const x = 1;\n');
 assert.throws(()=>measureSiteOwnership(loose),/unknown emitted ownership/);
});

test('Q6 limits are written exactly and the generic 524,288 branches are unchanged',()=>{
 assert.deepEqual(OWNER_LIMITS,{legacy_text_bytes:2621440,emitted_text_bytes:3801088,nf04_closure_bytes:524288,depot_route_local_bytes:524288,depot_closure_bytes:786432});
 for(const [k,v]of Object.entries({raw_source_and_tools_bytes:3940352,emitted_text_bytes:3801088,package_metadata_bytes:57344,source_offer_extracted_bytes:5242880,source_offer_compressed_bytes:4194304,teaching_generation_bytes:17825792,legacy_text_bytes:2621440,nf03_closure_bytes:557056,nf04_closure_bytes:524288,depot_route_local_bytes:524288,depot_closure_bytes:786432,offline_bytes:2571440}))assert.equal(LIMITS[k],v,k);
 const m=measureSiteOwnership(site);
 assert.ok(m.legacy_text_bytes<=2605087+4096,`legacy ${m.legacy_text_bytes}`);
 assert.ok(m.depot_route_local_bytes<=524288&&m.depot_closure_bytes<=786432);
 assert.equal(m.depot_closure_bytes,sum(site,new Set([...routeModules(site,DEPOT_ENTRIES),...DEPOT_FILES,'_headers'])));
 const css=`${DEPOT_DIR}/visual.css`,pad=n=>{const f=new Map(site);f.set(css,site.get(css)+' '.repeat(n));return f;};
 assert.equal(measureSiteOwnership(pad(524288-m.depot_route_local_bytes)).depot_route_local_bytes,524288);
 assert.throws(()=>measureSiteOwnership(pad(524289-m.depot_route_local_bytes)),/depot_route_local_bytes budget exceeded: 524289 > 524288/);
 const r3=new Map(site),r3css='network-flows/dispatch/visual.css';r3.set(r3css,site.get(r3css)+' '.repeat(524289-m.r3_closure_bytes));
 assert.throws(()=>measureSiteOwnership(r3),/R3 closure budget exceeded/);
});

test('the depot closure cap counts shared leaves at the teaching stage and brand text at the integrated stage',()=>{
 const tiny=(big)=>new Map([['src/ui/app.js',"import {b} from '../core/big.js';\nexport const a=b;\n"],['src/runtime/worker.js','export const w=1;\n'],['src/ui/capacity-app.js','export const c=1;\n'],
  ['src/core/big.js','export const b=1;\n'+' '.repeat(big)],['src/ui/depot-lab-app.js',"import {b} from '../core/big.js';\nexport const d=b;\n"],['src/runtime/depot-lab-worker.js','export const v=1;\n'],
  ...DEPOT_FILES.map(p=>[p,'x']),['_headers','h']]);
 const base=measureSiteOwnership(tiny(0)),fill=786432-base.depot_closure_bytes;
 const at=measureSiteOwnership(tiny(fill));assert.equal(at.depot_closure_bytes,786432);assert.equal(at.owners['src/core/big.js'],'legacy');
 assert.throws(()=>measureSiteOwnership(tiny(fill+1)),/depot_closure_bytes budget exceeded: 786433 > 786432/);
 const only=new Map([...site].filter(([p])=>new Set([...routeModules(site,DEPOT_ENTRIES),...DEPOT_FILES,'_headers']).has(p)));
 const before=measureIntegratedText(only,only).depot_closure_bytes,brand=new Map(only);brand.set('brand.css',' '.repeat(786432-before));
 assert.equal(measureIntegratedText(only,brand).depot_closure_bytes,786432);
 assert.equal(measureIntegratedText(only,brand).depot_route_local_bytes,measureSiteOwnership(site).depot_route_local_bytes);
 brand.set('brand.css',brand.get('brand.css')+' ');
 assert.throws(()=>measureIntegratedText(only,brand),/depot final closure byte budget exceeded: 786433 > 786432/);
});

test('check-dist covers every depot module, the page, the boot and the stylesheet',()=>{
 assert.deepEqual(checkSite(site,{requiredLabels:labels}),[]);
 for(const p of family())assert.ok(COPY_MODULES.includes(p),`${p} is scanned as copy`);
 const has=(files,re)=>checkSite(files,{requiredLabels:labels}).some(p=>re.test(p));
 const extra=new Map(site);extra.set('src/model/depot-lab/unlisted.js','export const u = 1;\n');
 assert.ok(has(extra,/^copy coverage: src\/model\/depot-lab\/unlisted\.js$/));
 const boot=new Map(site);boot.set(`${DEPOT_DIR}/boot.js`,DEPOT_BOOT.replace('depot-lab-worker','worker'));
 assert.ok(has(boot,/^boot: depot-readiness\/boot\.js differs/));
 const css=new Map(site);css.set(`${DEPOT_DIR}/visual.css`,'@import "x.css";\n');
 assert.ok(has(css,/^forbidden token in depot-readiness\/visual\.css: @import/));
 const page=new Map(site);page.set(DEPOT_PAGE,site.get(DEPOT_PAGE).replace('</body>','<script type="module" src="./other.js"></script></body>'));
 assert.ok(has(page,/^depot-readiness\/index\.html: expected exactly one module script/));
 const missing=new Map(site);missing.delete(`${DEPOT_DIR}/visual.css`);
 assert.ok(has(missing,/^file: depot-readiness\/visual\.css is missing$/));
});

test('only the exact first honesty sentence keeps its dash, only in depot lab copy and the depot page',()=>{
 assert.equal(DEPOT_HONESTY_SENTENCE,HONESTY[0]);assert.ok(/—/.test(HONESTY[0]));
 const dash=(where,text)=>copyProblems([{where,text}]).some(p=>p.startsWith('dash:'));
 for(const where of ['src/model/depot-lab/registry.js string','src/model/depot-lab-verify/verify.js string','src/runtime/depot-lab-session.js string','src/ui/depot-lab-share.js string','depot-readiness/index.html text','depot-readiness/index.html aria-label'])assert.equal(dash(where,HONESTY[0]),false,where);
 for(const where of ['src/ui/depot-flow-view.js string','src/model/depot-readiness.js string','src/ui/labels.js string','network-flows/dispatch/index.html text','text','src/ui/depot-labx.js string'])assert.equal(dash(where,HONESTY[0]),true,where);
 for(const text of ['Wait — then run.',HONESTY[0].replace('—','–'),`${HONESTY[0]} Then – more.`,HONESTY[0].replace('learning','study')])assert.equal(dash('src/ui/depot-lab-view.js string',text),true,text);
 assert.deepEqual(copyProblems([{where:'src/ui/depot-lab-view.js string',text:HONESTY[2]},{where:'depot-readiness/index.html text',text:HONESTY[2]}]),[]);
 assert.ok(copyProblems([{where:'src/ui/depot-flow-view.js string',text:HONESTY[2]}]).some(p=>p.startsWith('affiliation copy')));
});

test('the offline edition reaches no depot module',()=>{
 const html=buildHtml(root);
 for(const p of DEPOT_MODULES)assert.ok(!html.includes(`// fleetlab-module: ${p}\n`),p);
});
