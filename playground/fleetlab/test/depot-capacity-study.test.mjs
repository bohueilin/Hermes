import assert from 'node:assert/strict';
import {after,test} from 'node:test';
import {existsSync,mkdtempSync,readdirSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {copyProblems} from '../tools/check-dist.mjs';
import {sha256Hex} from '../src/core/sha256.js';
import {runCapacityCell} from '../src/model/depot-capacity.js';
import * as contract from '../src/model/depot-capacity-contract.js';
// Missing implementation is reported as a contract assertion during the first red run.
const tool=await import('../tools/capacity-study.mjs').catch(()=>({}));
const data=await import('../src/data/depot-capacity-study.js').catch(()=>({}));

const PLAYGROUND=fileURLToPath(new URL('../',import.meta.url));
const REPO=fileURLToPath(new URL('../../../',import.meta.url));
const MODULE_URL=new URL('../src/data/depot-capacity-study.js',import.meta.url);
const REGIMES=['data_heavy','energy_heavy','mixed'],TREATMENTS=['base','more_bandwidth','more_power'];
const RULES=['capacity_fifo','capacity_equal_uplink','capacity_departure_deadline','capacity_shortest_upload'];
const PLANNED=REGIMES.flatMap(regime=>TREATMENTS.flatMap(treatment=>RULES.flatMap(rule=>[1000,250].map(time_quantum_ms=>({regime,treatment,rule,time_quantum_ms})))));
const idOf=c=>`${c.regime}/${c.treatment}/${c.rule}/${c.time_quantum_ms}`;
const PRIMARY_IDS=PLANNED.filter(c=>c.time_quantum_ms===1000).map(idOf);
const fn=(module,name)=>{assert.equal(typeof module[name],'function',`${name} is required`);return module[name];};
const quiet={log:()=>{},error:()=>{}};

// The real study runs once, through main, so one run yields the records on disk, the benchmark and the manifest.
const scratch=mkdtempSync(join(tmpdir(),'nf03-study-'));
after(()=>rmSync(scratch,{recursive:true,force:true}));
let real=null;
function realStudy(){
  if(!real){
    let result=null;const started=performance.now();
    const code=fn(tool,'main')(['--records',join(scratch,'records'),'--benchmark',join(scratch,'benchmark.json'),'--quiet'],{...quiet,study:options=>(result=fn(tool,'runStudy')(options))});
    real={code,...result,seconds:(performance.now()-started)/1000};
  }
  return real;
}

test('STUDY_CELLS plans 72 cells in regime, treatment, rule and quantum order, and ids round-trip',()=>{
  assert.deepEqual(contract.STUDY_CELLS,PLANNED);
  assert.ok(Object.isFrozen(contract.STUDY_CELLS)&&contract.STUDY_CELLS.every(Object.isFrozen));
  const ids=contract.STUDY_CELLS.map(c=>fn(contract,'cellId')(c));
  assert.equal(new Set(ids).size,72);
  assert.deepEqual(ids.slice(0,3),['data_heavy/base/capacity_fifo/1000','data_heavy/base/capacity_fifo/250','data_heavy/base/capacity_equal_uplink/1000']);
  for(const [index,id] of ids.entries()){const [regime,treatment,rule,quantum]=id.split('/');assert.deepEqual({regime,treatment,rule,time_quantum_ms:Number(quantum)},PLANNED[index]);}
  assert.equal(contract.STUDY_ID,'nf03-schedule-versus-capacity/1');
  assert.equal(fn(contract,'workloadDigest')(),sha256Hex(contract.canonicalText({protocol:contract.CAPACITY_PROTOCOL,regimes:contract.CAPACITY_REGIMES,treatments:contract.CAPACITY_TREATMENTS,rules:RULES})));
});

test('the real study accepts all 72 cells and the quarter-second repeat agrees with every primary cell',t=>{
  const {code,manifest,failed_cell,seconds}=realStudy();
  t.diagnostic(`real 72-cell study through main, with records and benchmark: ${seconds.toFixed(1)} s`);
  assert.equal(code,0);assert.equal(failed_cell,null);
  assert.deepEqual(Object.keys(manifest),['schema','study','versions','protocol','workload_digest','source_commit','cells','refinement','status']);
  assert.equal(manifest.schema,'depot-capacity-study-manifest/1.0.0');assert.equal(manifest.study,contract.STUDY_ID);assert.equal(manifest.source_commit,null);
  assert.deepEqual(manifest.versions,contract.CAPACITY_VERSIONS);
  assert.deepEqual(manifest.protocol,{...contract.CAPACITY_PROTOCOL,regimes:contract.CAPACITY_REGIMES,treatments:contract.CAPACITY_TREATMENTS,rules:RULES});
  assert.equal(manifest.workload_digest,contract.workloadDigest());
  assert.deepEqual(manifest.status,{planned:72,accepted:72,complete:true});
  assert.deepEqual(contract.studyStatus(manifest),{planned:72,accepted:72,complete:true,missing:[],duplicated:[],rejected:[]});
  assert.deepEqual(manifest.cells.map(c=>c.cell_id),PLANNED.map(idOf));
  for(const [index,c] of manifest.cells.entries()){
    const primary=c.time_quantum_ms===1000;
    assert.deepEqual(Object.keys(c),['cell_id','regime','treatment','rule','time_quantum_ms','record_digest','verification','metrics',...(primary?['visits']:[])],c.cell_id);
    assert.deepEqual({regime:c.regime,treatment:c.treatment,rule:c.rule,time_quantum_ms:c.time_quantum_ms},PLANNED[index]);
    assert.match(c.record_digest,/^[0-9a-f]{64}$/);
    assert.deepEqual(Object.keys(c.verification),['model_validity','comparison_eligible','checks']);
    assert.equal(c.verification.model_validity,'VALID');assert.equal(c.verification.comparison_eligible,true);assert.ok(c.verification.checks>0);
    assert.equal(c.metrics.on_time+c.metrics.late,12,c.cell_id);assert.equal(c.metrics.final_lateness,true,c.cell_id);
    if(primary){
      assert.equal(c.visits.length,12);
      for(const v of c.visits)assert.deepEqual(Object.keys(v),['vehicle','ready_s','outcome','lateness_s','last_prerequisite']);
      assert.deepEqual(Object.fromEntries(c.visits.map(v=>[v.vehicle,v.ready_s])),c.metrics.ready_s);
    }
  }
  // Hand-derived in depot-capacity.test.mjs: first come, first served on data-heavy base work.
  assert.deepEqual(manifest.cells[0].metrics.ready_s,{A1:600,B1:660,C1:1020,D1:1140,A2:1620,B2:1680,C2:2040,D2:2160,A3:2640,B3:2700,C3:3060,D3:3180});
  assert.equal(manifest.cells[0].metrics.lateness_s,6300);
  assert.deepEqual(Object.keys(manifest.refinement),PRIMARY_IDS);
  for(const id of PRIMARY_IDS)assert.deepEqual(manifest.refinement[id],{agrees:true,ready_s_differences:[],outcome_differences:[]},id);
});

test('main writes one record per cell whose digest is the manifest digest, and a benchmark of the same run',()=>{
  const {manifest}=realStudy(),dir=join(scratch,'records');
  const names=manifest.cells.map(c=>`cell-${c.cell_id.replaceAll('/','-')}.json`);
  assert.deepEqual(readdirSync(dir).sort(),[...names].sort());
  const benchmark=JSON.parse(readFileSync(join(scratch,'benchmark.json'),'utf8'));
  assert.deepEqual(Object.keys(benchmark).sort(),['arch','cells','manifest_bytes','node','peak_rss_bytes','platform','wall_ms']);
  assert.deepEqual(benchmark.cells.map(c=>c.cell_id),manifest.cells.map(c=>c.cell_id));
  for(const c of benchmark.cells)assert.deepEqual(Object.keys(c),['cell_id','cell_ms','record_bytes']);
  assert.equal(benchmark.manifest_bytes,Buffer.byteLength(fn(tool,'manifestModule')(manifest)));
  assert.ok(benchmark.wall_ms>0&&benchmark.peak_rss_bytes>0);
  for(const [index,cell] of manifest.cells.entries()){
    const file=JSON.parse(readFileSync(join(dir,names[index]),'utf8'));
    assert.deepEqual(Object.keys(file),['cell','scenario','record','verification','digest']);
    assert.deepEqual(file.cell,PLANNED[index]);assert.equal(file.digest,cell.record_digest,cell.cell_id);
    assert.equal(file.verification.checks.length,cell.verification.checks);assert.deepEqual(file.verification.metrics,cell.metrics);
    // The stored digest is the digest of the stored record, and record_bytes is its canonical length, at both quanta.
    if(index<2){const text=contract.canonicalText(file.record);assert.equal(sha256Hex(text),cell.record_digest);assert.equal(benchmark.cells[index].record_bytes,Buffer.byteLength(text));}
  }
});

test('the committed manifest module is the exact text of the real run and imports as a frozen complete study',()=>{
  const {manifest}=realStudy();
  assert.ok(existsSync(MODULE_URL),'generate it with tools/capacity-study.mjs --write-module');
  const text=readFileSync(MODULE_URL,'utf8');
  assert.equal(text,fn(tool,'manifestModule')(manifest));
  assert.ok(text.startsWith('// Generated by tools/capacity-study.mjs --write-module; do not edit by hand.\nexport const CAPACITY_STUDY=Object.freeze(JSON.parse('));
  assert.doesNotMatch(text,/^\s*import\b/m);
  assert.ok(Object.isFrozen(data.CAPACITY_STUDY));
  assert.deepEqual(data.CAPACITY_STUDY,manifest);
  assert.equal(contract.studyStatus(data.CAPACITY_STUDY).complete,true);
});

test('studyStatus marks a removed, duplicated, invalid, mislabeled or stale manifest incomplete and names the cell',()=>{
  const id='mixed/more_power/capacity_shortest_upload/250';
  const status=change=>{const m=structuredClone(data.CAPACITY_STUDY);change(m);return fn(contract,'studyStatus')(m);};
  const at=m=>m.cells.findIndex(c=>c.cell_id===id);
  assert.deepEqual(status(m=>m.cells.splice(at(m),1)),{planned:72,accepted:71,complete:false,missing:[id],duplicated:[],rejected:[]});
  assert.deepEqual(status(m=>m.cells.push(structuredClone(m.cells[at(m)]))),{planned:72,accepted:71,complete:false,missing:[],duplicated:[id],rejected:[]});
  assert.deepEqual(status(m=>{m.cells[at(m)].verification.model_validity='INVALID';}),{planned:72,accepted:71,complete:false,missing:[],duplicated:[],rejected:[id]});
  assert.deepEqual(status(m=>{m.cells[at(m)].verification.comparison_eligible=false;}).rejected,[id]);
  assert.deepEqual(status(m=>{m.cells[at(m)].time_quantum_ms=1000;}).rejected,[id]);
  for(const stale of [m=>{m.workload_digest='0'.repeat(64);},m=>{m.schema='depot-capacity-study-manifest/0.9.0';},m=>{m.study='other';},m=>{m.versions.verifier='depot-capacity-verifier/0.9.0';}]){
    assert.deepEqual(status(stale),{planned:72,accepted:72,complete:false,missing:[],duplicated:[],rejected:[]});
  }
  assert.equal(contract.studyStatus(null).complete,false);
});

test('runStudy stops at the first failed cell and neither fills nor drops a cell',()=>{
  const failing='data_heavy/base/capacity_departure_deadline/1000',checks=[{name:'Required evidence',status:'FAIL',rule:'injected'}];
  const runCell=cell=>{const result=runCapacityCell(cell);return idOf(cell)===failing?{...result,verification:{...result.verification,model_validity:'INVALID',comparison_eligible:false,checks,metrics:null,visits:null}}:result;};
  let calls=0;const {manifest,failed_cell}=fn(tool,'runStudy')({runCell,onCell:()=>calls++});
  assert.equal(calls,5);
  assert.deepEqual(failed_cell,{cell_id:failing,checks});
  assert.deepEqual(manifest.cells.map(c=>c.cell_id),PLANNED.slice(0,5).map(idOf));
  assert.deepEqual(manifest.status,{planned:72,accepted:4,complete:false});
  assert.deepEqual(contract.studyStatus(manifest).rejected,[failing]);
  assert.deepEqual(Object.keys(manifest.refinement),['data_heavy/base/capacity_fifo/1000','data_heavy/base/capacity_equal_uplink/1000']);
});

test('main refuses records or a benchmark inside the repository outside dist before running anything',()=>{
  let ran=0;const study=()=>{ran++;throw Error('the study must not run');};
  const inside=join(PLAYGROUND,'capacity-records-refused'),main=fn(tool,'main');
  assert.equal(main(['--records',inside],{...quiet,study}),2);
  assert.equal(main(['--benchmark',join(inside,'benchmark.json')],{...quiet,study}),2);
  assert.equal(main(['--records',join(REPO,'dist')],{...quiet,study}),2);
  assert.equal(main(['--records'],{...quiet,study}),2);
  assert.equal(main(['--unknown'],{...quiet,study}),2);
  assert.equal(ran,0);assert.equal(existsSync(inside),false);
});

test('the study tool and the generated module carry no banned word and no em or en dash',()=>{
  for(const [where,url] of [['tools/capacity-study.mjs',new URL('../tools/capacity-study.mjs',import.meta.url)],['src/data/depot-capacity-study.js',MODULE_URL]]){
    assert.ok(existsSync(url),where);
    assert.deepEqual(copyProblems([{where,text:readFileSync(url,'utf8')}]),[],where);
  }
});
