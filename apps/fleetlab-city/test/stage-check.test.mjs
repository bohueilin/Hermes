import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync,symlinkSync} from 'node:fs';
import {join,dirname,basename} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {checkStage,INPUT_DIGESTS,RUNTIME,OFFLINE_BEFORE,OFFLINE_AFTER,BOUNDS,ROUTE_LOCAL,BEFORE} from './stage-check.mjs';

// Spec sections 3 and 4, restated so that a changed ceiling or baseline in the runner fails here.
const SPEC_BOUNDS={nf03_closure_bytes:541729,nf04_closure_bytes:225430,delivery_order_closure_bytes:229159,r1_closure_bytes:200443,r3_closure_bytes:156487,depot_closure_bytes:515519,
 emitted_text_bytes:3577477,integration_text_bytes:133152,integration_source_bytes:397274,source_offer_extracted_bytes:4104316,source_offer_compressed_bytes:1155879,
 package_metadata_bytes:45385,non_city_bytes:16203828};
const SPEC_BEFORE={nf03_closure_bytes:537633,nf04_closure_bytes:221334,delivery_order_closure_bytes:225063,r1_closure_bytes:196347,r3_closure_bytes:152391,depot_closure_bytes:513471,
 depot_route_local_bytes:418159,emitted_text_bytes:3569285,integration_text_bytes:129056,hosted_artwork_bytes:7793265,source_offer_extracted_bytes:4079740,non_city_minus_offer_bytes:15039757};
const DIGEST_PREFIXES={legacy:'15b3d561',city_base:'4fa335d2',city_source_offer:'1bf42853',readback:'708659b4'};
const OFFLINE_SHA='313fa3f1a94ed0c40b05858c38a1bc9d5d2facc3b1cdff998ec783a6c9f58fa1';
const OFFLINE_AFTER_PAIR={bytes:2566962,sha256:'e49c0aba90eb35c342094ddbe9f0db07850eb8c080439e7c18c170637efb6bdd'};
const LEGACY='15b3d5611f733be5bac5fa390caa99a7cc8a64179d0d1ee9c9a7d3f7626b3529';

// A synthetic stage holding the BEFORE values, shaped like the three records build-release.py writes.
function stage(changes={},offline={bytes:2565111,sha256:OFFLINE_SHA}){
 const s={inputs:{source_commit:'0'.repeat(40),runtime:{node:'v22.23.4',python:'3.11.15'},legacy_readback_sha256:'708659b40227369973cca941c69c098cb059c1dd2cc375d0d0203d56cd903d99',
  inputs:{legacy:{file_count:99,inventory_sha256:LEGACY},city_base:{file_count:2,inventory_sha256:'4fa335d226090aae63350a50f3af481d91df3f16d920ecacb22828d0b16c2550'},
   city_source_offer:{file_count:3,inventory_sha256:'1bf428531ba2d645054abae69b400e061d0bc742f912959a9e57f4d48e44e734'}}},
  manifest:{non_city_bytes:16187445,offline_download:{bytes:offline.bytes,path:'downloads/fleetlab-offline.html',sha256:offline.sha256},
   integrated_text:{nf03_closure_bytes:537633,nf04_closure_bytes:221334,delivery_order_closure_bytes:225063,r1_closure_bytes:196347,r3_closure_bytes:152391,depot_closure_bytes:513471,
    depot_route_local_bytes:418159,emitted_text_bytes:3569285,integration_text_bytes:129056,hosted_artwork_bytes:7793265}},
  receipt:{integration_source:{bytes:389082},counts:{source_offer_extracted_bytes:4079740,source_offer_compressed_bytes:1147688,package_metadata_bytes:44361}}};
 const where=name=>name in s.manifest.integrated_text?[s.manifest.integrated_text,name]:name==='non_city_bytes'?[s.manifest,name]
  :name==='integration_source_bytes'?[s.receipt.integration_source,'bytes']:[s.receipt.counts,name];
 for(const [name,value]of Object.entries(changes)){const [record,key]=where(name);record[key]=value;}
 return s;
}
const failed=(s,mode)=>checkStage(s,mode).checks.filter(c=>!c.ok).map(c=>c.name);
const AFTER_CHECKS=['legacy_input_sha256','city_base_input_sha256','city_source_offer_input_sha256','readback_input_sha256','runtime','offline_download',...Object.keys(SPEC_BOUNDS),'depot_route_local_bytes'];

test('the runner pins the spec section 3 bounds and the section 4 BEFORE values',()=>{
 assert.deepEqual(BOUNDS,SPEC_BOUNDS);assert.deepEqual(BEFORE,SPEC_BEFORE);assert.deepEqual(ROUTE_LOCAL,{min:418150,max:418159});
 assert.deepEqual(OFFLINE_BEFORE,{bytes:2565111,sha256:OFFLINE_SHA});assert.deepEqual(OFFLINE_AFTER,OFFLINE_AFTER_PAIR);assert.deepEqual(RUNTIME,{node:'v22.23.4',python:'3.11.15'});
 assert.equal(SPEC_BEFORE.non_city_minus_offer_bytes,16187445-1147688);
 for(const [name,prefix]of Object.entries(DIGEST_PREFIXES))assert.match(INPUT_DIGESTS[name],new RegExp(`^${prefix}[0-9a-f]{56}$`),name);
});

test('a BEFORE stage passes before mode and an AFTER stage passes after mode, and before adds the exact pins to the after bounds',()=>{
 const after=checkStage(stage({},OFFLINE_AFTER_PAIR),'after'),before=checkStage(stage(),'before');
 assert.equal(after.ok,true);assert.equal(before.ok,true);
 assert.deepEqual(failed(stage(),'after'),['offline_download']);assert.deepEqual(failed(stage({},OFFLINE_AFTER_PAIR),'before'),['offline_download']);
 assert.deepEqual(after.checks.map(c=>c.name),AFTER_CHECKS);
 assert.deepEqual(before.checks.map(c=>c.name),[...AFTER_CHECKS,...Object.keys(SPEC_BEFORE)]);
 assert.ok(before.checks.every(c=>c.ok&&'actual'in c));
 assert.throws(()=>checkStage(stage(),'AFTER'),/mode must be before or after/);
});

test('every bound admits its ceiling and rejects one byte more, in both modes',()=>{
 for(const [name,max]of Object.entries(SPEC_BOUNDS)){
  assert.deepEqual(failed(stage({[name]:max},OFFLINE_AFTER_PAIR),'after'),[],name);
  assert.deepEqual(failed(stage({[name]:max+1},OFFLINE_AFTER_PAIR),'after'),[name],name);
  assert.ok(failed(stage({[name]:max+1}),'before').includes(name),name);
 }
 assert.deepEqual(failed(stage({depot_route_local_bytes:418150},OFFLINE_AFTER_PAIR),'after'),[]);
 for(const value of [418149,418160])assert.deepEqual(failed(stage({depot_route_local_bytes:value},OFFLINE_AFTER_PAIR),'after'),['depot_route_local_bytes']);
});

test('before mode requires each BEFORE value exactly, while after mode accepts the smaller value',()=>{
 for(const name of Object.keys(SPEC_BEFORE).filter(n=>n!=='non_city_minus_offer_bytes')){
  const before=stage({[name]:SPEC_BEFORE[name]-1}),after=stage({[name]:SPEC_BEFORE[name]-1},OFFLINE_AFTER_PAIR);
  assert.deepEqual(failed(before,'before'),[name],name);assert.deepEqual(failed(after,'after'),[],name);
 }
});

test('non-City is compared net of the commit-dependent compressed offer',()=>{
 assert.deepEqual(failed(stage({source_offer_compressed_bytes:1147687,non_city_bytes:16187444}),'before'),[]);
 assert.deepEqual(failed(stage({source_offer_compressed_bytes:1147689}),'before'),['non_city_minus_offer_bytes']);
 assert.deepEqual(failed(stage({non_city_bytes:16187446}),'before'),['non_city_minus_offer_bytes']);
 assert.deepEqual(failed(stage({source_offer_compressed_bytes:1147689},OFFLINE_AFTER_PAIR),'after'),[]);
});

test('inputs, runtime and the offline edition must match exactly in both modes',()=>{
 for(const mode of ['before','after']){
  const pair=mode==='before'?{bytes:2565111,sha256:OFFLINE_SHA}:OFFLINE_AFTER_PAIR;
  const s=stage({},pair);s.inputs.inputs.legacy.inventory_sha256=LEGACY.slice(0,8)+'0'.repeat(56);
  assert.deepEqual(failed(s,mode),['legacy_input_sha256']);
  delete s.inputs.legacy_readback_sha256;assert.deepEqual(failed(s,mode),['legacy_input_sha256','readback_input_sha256']);
  for(const [key,value]of [['node','v22.22.0'],['python','3.11.9']]){const runtime=stage({},pair);runtime.inputs.runtime[key]=value;assert.deepEqual(failed(runtime,mode),['runtime'],key);}
  const offline=stage({},pair);offline.manifest.offline_download.sha256='0'.repeat(64);assert.deepEqual(failed(offline,mode),['offline_download']);
  offline.manifest.offline_download={bytes:pair.bytes+1,sha256:pair.sha256};assert.deepEqual(failed(offline,mode),['offline_download']);
 }
});

test('missing or malformed evidence fails its checks instead of passing or throwing',()=>{
 assert.deepEqual(failed(stage({nf03_closure_bytes:undefined},OFFLINE_AFTER_PAIR),'after'),['nf03_closure_bytes']);
 assert.deepEqual(failed(stage({emitted_text_bytes:'3569285'}),'before'),['emitted_text_bytes','emitted_text_bytes']);
 assert.deepEqual(failed(stage({package_metadata_bytes:null},OFFLINE_AFTER_PAIR),'after'),['package_metadata_bytes']);
 // A fractional byte count under its ceiling or inside the route-local range is still not a byte count.
 assert.deepEqual(failed(stage({nf03_closure_bytes:537633.5},OFFLINE_AFTER_PAIR),'after'),['nf03_closure_bytes']);
 assert.deepEqual(failed(stage({depot_route_local_bytes:418155.5},OFFLINE_AFTER_PAIR),'after'),['depot_route_local_bytes']);
 const empty=checkStage({inputs:null,manifest:{},receipt:undefined},'before');
 assert.equal(empty.ok,false);assert.equal(empty.checks.length,AFTER_CHECKS.length+Object.keys(SPEC_BEFORE).length);assert.ok(empty.checks.every(c=>!c.ok));
});

test('the command reads a stage directory, prints one JSON record and exits non-zero on failure',()=>{
 const root=mkdtempSync(join(tmpdir(),'fleetlab-stage-check-')),script=fileURLToPath(new URL('./stage-check.mjs',import.meta.url));
 // The runner is also reached through a symlinked directory, as a worktree under the symlinked macOS /tmp is.
 const linked=join(root,'link',basename(script));
 try{
  symlinkSync(dirname(script),join(root,'link'),'dir');
  const write=s=>{for(const [path,record]of [['build-inputs.json',s.inputs],['stage/review/integration-manifest.json',s.manifest],['stage/site/downloads/teaching-package.json',s.receipt]]){
   mkdirSync(dirname(join(root,path)),{recursive:true});writeFileSync(join(root,path),JSON.stringify(record));
  }};
  const run=(runner,...args)=>{const r=spawnSync(process.execPath,[runner,...args],{encoding:'utf8'});return {status:r.status,stdout:r.stdout,record:JSON.parse(r.stdout)};};
  for(const runner of [script,linked])for(const mode of ['before','after']){
   write(stage({},mode==='after'?OFFLINE_AFTER_PAIR:undefined));
   const {status,record}=run(runner,'--stage',root,'--mode',mode);
   assert.equal(status,0,runner);assert.equal(record.ok,true);assert.equal(record.mode,mode);assert.equal(record.source_commit,'0'.repeat(40));
   assert.deepEqual(record.runner,{node:process.version,zlib:process.versions.zlib});
  }
  write(stage({r3_closure_bytes:156488},OFFLINE_AFTER_PAIR));
  for(const runner of [script,linked]){
   const {status,record}=run(runner,'--stage',root,'--mode','after');
   assert.equal(status,1,runner);assert.equal(record.ok,false);assert.deepEqual(record.checks.filter(c=>!c.ok).map(c=>c.name),['r3_closure_bytes']);
  }
  // A failure record names the stage-relative file or the error code, and never the local path it was given.
  const failures=[[['--mode','before'],'--stage is required'],[['--stage',root,'--mode','later'],'mode must be before or after'],
   [['--stage',join(root,'absent'),'--mode','after'],'cannot read build-inputs.json: ENOENT'],[['--stage',root,'--mode','after','--force'],'ERR_PARSE_ARGS_UNKNOWN_OPTION'],
   [[root,'--mode','after'],'ERR_PARSE_ARGS_UNEXPECTED_POSITIONAL'],[['--stage',root,'--mode','after'],'cannot read stage/site/downloads/teaching-package.json: SyntaxError']];
  for(const [args,error]of failures){
   if(error.includes('SyntaxError'))writeFileSync(join(root,'stage/site/downloads/teaching-package.json'),`{"stage":"${root}"`);
   const failure=run(script,...args);
   assert.equal(failure.status,1,args.join(' '));assert.deepEqual(failure.record,{ok:false,error});assert.ok(!failure.stdout.includes(root),args.join(' '));
  }
 }finally{rmSync(root,{recursive:true,force:true});}
});
