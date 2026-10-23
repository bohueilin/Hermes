// Runs the 72 planned NF-03 cells in order, verifies each, and builds the study manifest the viewer reads.
//
// Usage: node playground/fleetlab/tools/capacity-study.mjs [--write-module] [--records <dir>] [--benchmark <file>] [--quiet]
//   --write-module      writes src/data/depot-capacity-study.js from the manifest (only when all 72 cells are accepted)
//   --records <dir>     writes cell-<id>.json per cell: {cell, scenario, record, verification, digest}
//   --benchmark <file>  writes timings, record sizes and peak memory; these never enter the manifest
// Records and the benchmark follow the pack.mjs place rule: outside the repository or under dist/.
// Exit 0 when all 72 cells are accepted, 1 when the study stops at a failed cell, 2 on a usage error or a refused path.

import {lstatSync,mkdirSync,realpathSync,writeFileSync} from 'node:fs';
import {basename,dirname,join,relative,resolve,sep} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {findRepositoryRoot} from './pack.mjs';
import {CAPACITY_PROTOCOL,CAPACITY_REGIMES,CAPACITY_RULES,CAPACITY_TREATMENTS,CAPACITY_VERSIONS,STUDY_CELLS,STUDY_ID,STUDY_SCHEMA,cellId,studyStatus,workloadDigest} from '../src/model/depot-capacity-contract.js';
import {runCapacityCell} from '../src/model/depot-capacity.js';

const PLAYGROUND=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const MODULE_PATH='src/data/depot-capacity-study.js';
const PRIMARY_MS=CAPACITY_PROTOCOL.quanta_ms[0];
const USAGE='capacity-study.mjs [--write-module] [--records <dir>] [--benchmark <file>] [--quiet]';
const ms=value=>Math.round(value*10)/10;

/**
 * The manifest entry for one cell. A refinement cell keeps its digest and verification summary; its agreement with
 * the primary cell is in the refinement map. A primary cell adds the verifier metrics without ready_s, which its
 * compact per-visit rows carry.
 */
function manifestCell(cell,{verification,digest}){
  const entry={cell_id:cellId(cell),...cell,record_digest:digest,
    verification:{model_validity:verification.model_validity,comparison_eligible:verification.comparison_eligible,checks:verification.checks.length}};
  if(cell.time_quantum_ms!==PRIMARY_MS)return entry;
  const {ready_s:_readyS,...metrics}=verification.metrics??{};
  entry.metrics=verification.metrics?metrics:null;
  entry.visits=verification.visits?.map(({vehicle,ready_s,outcome,lateness_s,last_prerequisite})=>({vehicle,ready_s,outcome,lateness_s,last_prerequisite}))??null;
  return entry;
}

/** Whether the quarter-second repeat gives every vehicle the same ready time and outcome as its primary cell. */
function refinement(primaryVisits,refined){
  const differences=key=>primaryVisits.flatMap(p=>{
    const value=refined.visits.find(v=>v.vehicle===p.vehicle)?.[key]??null;
    return value===p[key]?[]:[{vehicle:p.vehicle,primary:p[key],refined:value}];
  });
  const ready_s_differences=differences('ready_s'),outcome_differences=differences('outcome');
  return {agrees:!ready_s_differences.length&&!outcome_differences.length,ready_s_differences,outcome_differences};
}

/**
 * Runs the planned cells sequentially and stops at the first one that is not VALID and comparison eligible; that cell
 * stays in the manifest and later cells are never run, so an incomplete study can never pass for a complete one.
 * Timings cover the whole cell: runCapacityCell simulates, verifies and digests in one call.
 */
export function runStudy({onCell=()=>{},runCell=runCapacityCell}={}){
  const started=performance.now(),cells=[],timings=[],refined={};let failed_cell=null;
  for(const [index,cell] of STUDY_CELLS.entries()){
    const before=performance.now(),result=runCell(cell),cell_ms=performance.now()-before,entry=manifestCell(cell,result);
    cells.push(entry);onCell({index,cell_id:entry.cell_id,cell,...result});
    // Canonical text is sorted-key JSON of plain data, so plain JSON text of the record has the same length.
    timings.push({cell_id:entry.cell_id,cell_ms:ms(cell_ms),record_bytes:Buffer.byteLength(JSON.stringify(result.record))});
    const {model_validity,comparison_eligible,checks}=result.verification;
    if(model_validity!=='VALID'||comparison_eligible!==true){failed_cell={cell_id:entry.cell_id,checks};break;}
    if(cell.time_quantum_ms!==PRIMARY_MS){
      const primaryId=cellId({...cell,time_quantum_ms:PRIMARY_MS});
      refined[primaryId]=refinement(cells.find(c=>c.cell_id===primaryId).visits,result.verification);
    }
  }
  const manifest={schema:STUDY_SCHEMA,study:STUDY_ID,versions:{...CAPACITY_VERSIONS},
    protocol:{...CAPACITY_PROTOCOL,regimes:CAPACITY_REGIMES,treatments:CAPACITY_TREATMENTS,rules:CAPACITY_RULES.map(r=>r.id)},
    workload_digest:workloadDigest(),source_commit:null,cells,refinement:refined};
  const {planned,accepted,complete}=studyStatus(manifest);
  manifest.status={planned,accepted,complete};
  const benchmark={node:process.version,platform:process.platform,arch:process.arch,cells:timings,wall_ms:ms(performance.now()-started),
    peak_rss_bytes:process.resourceUsage().maxRSS*1024,manifest_bytes:Buffer.byteLength(manifestModule(manifest))};
  return {manifest,benchmark,failed_cell};
}

/** Compact JSON as a plain object literal, with no timestamp or machine detail, so the same study always produces the same bytes. */
export function manifestModule(manifest){
  return `// Generated by tools/capacity-study.mjs --write-module; do not edit by hand.\nexport const CAPACITY_STUDY=Object.freeze(${JSON.stringify(manifest)});\n`;
}

/** Whether `path` names an entry; a dangling symbolic link counts, so resolving it fails instead of skipping it. */
function entryExists(path){
  try{lstatSync(path);return true;}catch(error){if(error.code==='ENOENT'||error.code==='ENOTDIR')return false;throw error;}
}

/**
 * The pack.mjs place rule, which pack keeps private: resolve the longest existing prefix of `path` to its real
 * spelling, then accept only a path outside the repository or strictly under `<repo>/dist/`. Returns it, or null.
 */
function allowedPlace(path,repoRoot){
  const rest=[];let dir=resolve(path);
  while(!entryExists(dir)&&dirname(dir)!==dir){rest.unshift(basename(dir));dir=dirname(dir);}
  let target;
  try{target=join(realpathSync.native(dir),...rest);}catch{return null;}
  const inside=relative(realpathSync.native(repoRoot),target).split(sep);
  return inside[0]==='..'||(inside[0]==='dist'&&inside.length>1)?target:null;
}

/** Command-line entry; returns the exit status. `study` is injectable so a test can read the manifest of the run it drives. */
export function main(argv,{cwd=process.cwd(),log=console.log,error=console.error,study=runStudy}={}){
  const options={module:false,records:null,benchmark:null,quiet:false};
  for(let i=0;i<argv.length;i++){
    if(argv[i]==='--write-module')options.module=true;
    else if(argv[i]==='--quiet')options.quiet=true;
    else if((argv[i]==='--records'||argv[i]==='--benchmark')&&i+1<argv.length)options[argv[i].slice(2)]=resolve(cwd,argv[++i]);
    else{error(`capacity-study: usage: ${USAGE}`);return 2;}
  }
  const repoRoot=findRepositoryRoot(PLAYGROUND);
  for(const key of ['records','benchmark']){
    if(options[key]===null)continue;
    const place=allowedPlace(options[key],repoRoot),entry=place!==null&&entryExists(place)?lstatSync(place):null;
    if(place===null||(entry&&!(key==='records'?entry.isDirectory():entry.isFile()))){
      error(`capacity-study: refusing ${options[key]}: write outside the repository or under dist/, to a ${key==='records'?'folder':'regular file'}.`);
      return 2;
    }
    options[key]=place;
  }
  if(options.records)mkdirSync(options.records,{recursive:true});
  const {manifest,benchmark,failed_cell}=study({onCell:({cell_id,cell,scenario,record,verification,digest})=>{
    if(options.records)writeFileSync(join(options.records,`cell-${cell_id.replaceAll('/','-')}.json`),JSON.stringify({cell,scenario,record,verification,digest}));
    if(!options.quiet)log(`capacity-study: ${cell_id} ${verification.model_validity}${verification.comparison_eligible?'':', not comparison eligible'}`);
  }});
  if(failed_cell){
    error(`capacity-study: stopped at ${failed_cell.cell_id} (${manifest.status.accepted} of ${manifest.status.planned} accepted): ${failed_cell.checks.at(-1)?.rule??'no checks recorded'}`);
    return 1;
  }
  const text=manifestModule(manifest);
  if(options.module)writeFileSync(join(PLAYGROUND,MODULE_PATH),text);
  if(options.benchmark){mkdirSync(dirname(options.benchmark),{recursive:true});writeFileSync(options.benchmark,`${JSON.stringify(benchmark,null,2)}\n`);}
  log(`capacity-study: ${manifest.status.accepted} of ${manifest.status.planned} cells accepted, all refinements agree: ${Object.values(manifest.refinement).every(r=>r.agrees)}; manifest module ${Buffer.byteLength(text)} bytes; ${(benchmark.wall_ms/1000).toFixed(1)} s`);
  return 0;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  process.exitCode=main(process.argv.slice(2));
}
