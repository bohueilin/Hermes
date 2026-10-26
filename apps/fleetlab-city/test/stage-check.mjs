// Step A stage check (spec section 4), a runner, not a test:
// node apps/fleetlab-city/test/stage-check.mjs --stage <build-release.py --out directory> --mode before|after
// Prints one JSON record and exits 1 unless every check passes.
import {readFileSync,realpathSync} from 'node:fs';
import {join} from 'node:path';
import {isDeepStrictEqual,parseArgs} from 'node:util';

export const INPUT_DIGESTS={legacy:'15b3d5611f733be5bac5fa390caa99a7cc8a64179d0d1ee9c9a7d3f7626b3529',city_base:'4fa335d226090aae63350a50f3af481d91df3f16d920ecacb22828d0b16c2550',
 city_source_offer:'1bf428531ba2d645054abae69b400e061d0bc742f912959a9e57f4d48e44e734',readback:'708659b40227369973cca941c69c098cb059c1dd2cc375d0d0203d56cd903d99'};
// Sidecars record the Node version string and the offer is gzipped by Node's own zlib, so the build runtime is part of every figure.
export const RUNTIME={node:'v22.23.4',python:'3.11.15'};
export const OFFLINE={bytes:2565111,sha256:'313fa3f1a94ed0c40b05858c38a1bc9d5d2facc3b1cdff998ec783a6c9f58fa1'};
// Section 3 stage bounds; both modes apply them.
export const BOUNDS={nf03_closure_bytes:541729,nf04_closure_bytes:225430,delivery_order_closure_bytes:229159,r1_closure_bytes:200443,r3_closure_bytes:156487,depot_closure_bytes:515519,
 emitted_text_bytes:3577477,integration_text_bytes:133152,integration_source_bytes:397274,source_offer_extracted_bytes:4104316,source_offer_compressed_bytes:1155879,
 package_metadata_bytes:45385,non_city_bytes:16203828};
export const ROUTE_LOCAL={min:418150,max:418159};
// BEFORE values at the base. The compressed offer embeds the commit, so only non-City minus the offer is exact across commits.
export const BEFORE={nf03_closure_bytes:537633,nf04_closure_bytes:221334,delivery_order_closure_bytes:225063,r1_closure_bytes:196347,r3_closure_bytes:152391,depot_closure_bytes:513471,
 depot_route_local_bytes:418159,emitted_text_bytes:3569285,integration_text_bytes:129056,hosted_artwork_bytes:7793265,source_offer_extracted_bytes:4079740,non_city_minus_offer_bytes:15039757};

// inputs, manifest and receipt are the parsed build-inputs.json, stage/review/integration-manifest.json and stage/site/downloads/teaching-package.json.
export function checkStage({inputs,manifest,receipt},mode){
 if(mode!=='before'&&mode!=='after')throw Error('mode must be before or after');
 const counts=receipt?.counts??{};
 const values={...manifest?.integrated_text,integration_source_bytes:receipt?.integration_source?.bytes,source_offer_extracted_bytes:counts.source_offer_extracted_bytes,
  source_offer_compressed_bytes:counts.source_offer_compressed_bytes,package_metadata_bytes:counts.package_metadata_bytes,non_city_bytes:manifest?.non_city_bytes};
 values.non_city_minus_offer_bytes=values.non_city_bytes-values.source_offer_compressed_bytes;
 const checks=[],add=(name,ok,actual,rule)=>checks.push({name,ok,actual,...rule}),int=Number.isSafeInteger;
 const digests={legacy:inputs?.inputs?.legacy?.inventory_sha256,city_base:inputs?.inputs?.city_base?.inventory_sha256,
  city_source_offer:inputs?.inputs?.city_source_offer?.inventory_sha256,readback:inputs?.legacy_readback_sha256};
 for(const [name,expected]of Object.entries(INPUT_DIGESTS))add(name+'_input_sha256',digests[name]===expected,digests[name],{expected});
 add('runtime',isDeepStrictEqual(inputs?.runtime,RUNTIME),inputs?.runtime,{expected:RUNTIME});
 const offline={bytes:manifest?.offline_download?.bytes,sha256:manifest?.offline_download?.sha256};
 add('offline_download',isDeepStrictEqual(offline,OFFLINE),offline,{expected:OFFLINE});
 for(const [name,max]of Object.entries(BOUNDS))add(name,int(values[name])&&values[name]<=max,values[name],{max});
 const local=values.depot_route_local_bytes;
 add('depot_route_local_bytes',int(local)&&local>=ROUTE_LOCAL.min&&local<=ROUTE_LOCAL.max,local,ROUTE_LOCAL);
 if(mode==='before')for(const [name,expected]of Object.entries(BEFORE))add(name,values[name]===expected,values[name],{expected});
 return {ok:checks.every(c=>c.ok),checks};
}

// Node realpaths the main module, so both sides are compared as real paths: a runner reached through a symlink must still run, not print nothing and exit 0.
const realArgv=()=>{try{return realpathSync(process.argv[1]);}catch{return null;}};
if(process.argv[1]&&realArgv()===realpathSync(import.meta.filename)){
 // A failure record never carries a local path: a read failure names the stage-relative file and its error code, and any other error with a code (parseArgs echoes the arguments) reports only the code.
 let record;
 try{
  const {values:{stage,mode}}=parseArgs({options:{stage:{type:'string'},mode:{type:'string'}}});
  if(!stage)throw Error('--stage is required');
  const read=path=>{try{return JSON.parse(readFileSync(join(stage,path),'utf8'));}catch(error){throw Error(`cannot read ${path}: ${error.code??error.name}`);}};
  const inputs=read('build-inputs.json'),manifest=read('stage/review/integration-manifest.json'),receipt=read('stage/site/downloads/teaching-package.json');
  // The runner's zlib is printed because compressed figures depend on it; the stage records only the build's Node version.
  record={mode,source_commit:inputs.source_commit,runner:{node:process.version,zlib:process.versions.zlib},...checkStage({inputs,manifest,receipt},mode)};
 }catch(error){record={ok:false,error:error.code??error.message};}
 console.log(JSON.stringify(record,null,2));
 process.exitCode=record.ok?0:1;
}
