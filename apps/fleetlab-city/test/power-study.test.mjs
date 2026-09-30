import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import * as vm from '../web/view-model.mjs';
import {clearFleetInsights,renderFleetInsights} from '../web/fleet-insights.mjs';
import {createFakeDom} from '../../../playground/fleetlab/test/helpers/fake-dom.mjs';
const recording={study:'sf-power-headroom-v1',seed:7302001,arm:'b-400',configuration:'b-400',source_run_digest:'bound',layout:'B',total_power_kw:400,sites:[{id:'B',power_kw:400}],energy:{initial_kwh:30,target_kwh:48},fleet_file:'data/fleet-power.json',vehicle_files:{'ev-001':'data/run-power.json'}};
const catalog={seeds:[1001],sites:[{id:'A'},{id:'B'}],studies:[{id:recording.study,seeds:[7302001,7302002],configurations:['b-400'],replay_seed:7302001,recordings:[recording]}]};
test('recording selection binds study, seed, configuration and B-only resources',()=>{
 assert.equal(typeof vm.recordingSelection,'function');
 assert.deepEqual(vm.recordingSelection(catalog,recording.study,7302001,'b-400','ev-001'),recording);
 assert.throws(()=>vm.recordingSelection(catalog,recording.study,7302002,'b-400','ev-001'),/not exported/);
 assert.throws(()=>vm.recordingSelection(catalog,recording.study,7302001,'a-400','ev-001'),/configuration/);
 assert.equal(vm.recordingSelection(catalog,'legacy',1001,'baseline','ev-001').sites[0].id,'A');
});
test('code aware constraint labels never reinterpret reachability as reserve',()=>{
 assert.equal(typeof vm.violationLabel,'function');
 assert.match(vm.violationLabel({hard_violations:4,violation_codes:{no_reachable_depot:4}}),/no_reachable_depot.*4/);
 assert.doesNotMatch(vm.violationLabel({hard_violations:4}),/Reserve/);
});
function replayHarness(){
 const source=readFileSync(new URL('../web/replay.mjs',import.meta.url),'utf8');
 const body=source.slice(source.indexOf('const $=' )).replace('export class Replay','class Replay');
 const dom=createFakeDom();
 const nodes=new Map();const $=id=>{if(!nodes.has(id))nodes.set(id,dom.document.createElement('div'));return nodes.get(id);};
 $('seed-select').value='1001';$('arm-select').value='baseline';$('vehicle-select').value='ev-001';
 const pending=[];const errors=[];
 const document={getElementById:$,createElement:tag=>dom.document.createElement(tag),addEventListener(){},hidden:false};
 const Replay=new Function('document','cancelAnimationFrame','clearFleetInsights','renderFleetInsights',...Object.keys(vm),`${body}; return Replay;`)(document,()=>{},(message,busy)=>clearFleetInsights(message,busy,document),(fleet,roster,trace)=>renderFleetInsights(fleet,roster,trace,document),...Object.values(vm));
 const replay=new Replay({catalog,comparison:{pairs:[]},readData:path=>new Promise((resolve,reject)=>pending.push({path,resolve,reject})),notice:e=>errors.push(e),isVisible:()=>true});
 replay.summary=()=>{};replay.history=()=>{};replay.draw=()=>{};replay.featured=()=>{};
 const sites=[];replay.map={setSites:s=>sites.push(s),setCar(){},setRoutes(){},fitRoute(){}};
 return {replay,pending,errors,$,sites};
}
test('actual replay loader suppresses slow prior response after study switch',async()=>{
 const h=replayHarness(); const old=h.replay.load();
 h.replay.study=recording.study;h.$('seed-select').value='7302001';h.$('arm-select').value='b-400';const next=h.replay.load();
 assert.equal(h.pending[2].path,'data/run-power.json');
 const trace={...recording,schema:'fleetlab.city-vehicle-view/1.1.0',vehicle:'ev-001',samples:[[15]],verification:'INTERNALLY_CONSISTENT'};
 h.pending[2].resolve(trace);h.pending[3].resolve(recording);await next;
 h.pending[0].resolve({...trace,study:undefined,seed:1001,arm:'baseline'});h.pending[1].resolve({seed:1001,arm:'baseline'});await old;
 assert.equal(h.replay.trace.study,recording.study);assert.deepEqual(h.sites.at(-1),[{id:'B',power_kw:400}]);assert.deepEqual(h.errors,[]);
});

test('actual replay loader keeps the latest fleet aggregate and clears it on current failure',async()=>{
 for(const staleFailure of [false,true]){
  const h=replayHarness();
  h.replay.catalog={...catalog,seeds:[1001,1002],vehicles:[{id:'ev-001'}]};
  const trace=seed=>({schema:'fleetlab.city-vehicle-view/1.1.0',seed,arm:'baseline',vehicle:'ev-001',samples:[[15]],elapsed_s:3600,verification:'INTERNALLY_CONSISTENT'});
  const fleet=(seed,completed)=>({seed,arm:'baseline',vehicles:[{vehicle:'ev-001',completed,distance_m:100,empty_m:25,queue_s:900,final_state:'queue_charge'}]});
  const old=h.replay.load();h.$('seed-select').value='1002';const current=h.replay.load();
  h.pending[2].resolve(trace(1002));h.pending[3].resolve(fleet(1002,9));await current;
  assert.equal(h.$('fleet-metrics').querySelector('strong').textContent,'9');
  staleFailure?h.pending[0].reject(new Error('stale')):h.pending[0].resolve(trace(1001));h.pending[1].resolve(fleet(1001,4));await old;
  assert.match(h.$('fleet-context').textContent,/seed 1002/);
  assert.equal(h.$('fleet-metrics').querySelector('strong').textContent,'9');
  h.$('seed-select').value='1001';const failed=h.replay.load();
  assert.equal(h.$('fleet-metrics').textContent,'');
  h.pending[4].reject(new Error('current network error'));h.pending[5].resolve(fleet(1001,4));await failed;
  assert.equal(h.$('fleet-metrics').textContent,'');assert.equal(h.$('fleet-charts').textContent,'');
  assert.match(h.$('fleet-context').textContent,/unavailable/);
 }
});
test('actual replay loader rejects wrong configuration identity and unavailable seed',async()=>{
 const h=replayHarness();h.replay.study=recording.study;h.$('seed-select').value='7302001';h.$('arm-select').value='b-400';const next=h.replay.load();
 h.pending[0].resolve({...recording,schema:'fleetlab.city-vehicle-view/1.1.0',configuration:'a-400',vehicle:'ev-001',samples:[[15]],verification:'INTERNALLY_CONSISTENT'});h.pending[1].resolve(recording);await next;
 assert.equal(h.replay.trace,null);assert.match(h.errors[0],/incompatible/);
 h.$('seed-select').value='7302002';await h.replay.load();assert.equal(h.pending.length,2);assert.match(h.errors.at(-1),/not exported/);
});
test('study UI controller exists for deferred asynchronous study selection',()=>{
 assert.ok(existsSync(new URL('../web/power-study.mjs',import.meta.url)));
});

test('actual study controller suppresses deferred results and failures after returning to original study',async()=>{
 const {createStudyController}=await import('../web/power-study.mjs');
 for(const failure of [false,true]){
  let resolve,reject;const calls=[];
  const controller=createStudyController({catalog,readData:()=>new Promise((r,j)=>{resolve=r;reject=j;}),onSelect:id=>calls.push(id),onLegacy:()=>calls.push('original rendered'),onPower:()=>calls.push('stale rendered'),onError:()=>calls.push('stale error')});
  const prior=controller.choose(recording.study);await controller.choose('legacy');
  failure?reject(new Error('slow error')):resolve({wrong:'old response'});await prior;
  assert.deepEqual(calls,[recording.study,'legacy','original rendered']);
 }
});
test('actual replay loader rejects wrong fleet study, wrong B resources and stale failure',async()=>{
 for(const variant of ['fleet','sites','state']){
  const h=replayHarness();h.replay.study=recording.study;h.$('seed-select').value='7302001';h.$('arm-select').value='b-400';const next=h.replay.load();
  const trace={...recording,schema:'fleetlab.city-vehicle-view/1.1.0',vehicle:'ev-001',samples:[[15]],verification:'INTERNALLY_CONSISTENT'};
  if(variant==='sites')trace.sites=[{id:'A',power_kw:400}];
  if(variant==='state')trace.verification='INVALID';
  h.pending[0].resolve(trace);h.pending[1].resolve(variant==='fleet'?{...recording,study:'other'}:recording);await next;
  assert.equal(h.replay.trace,null);assert.equal(h.errors.length,1);
 }
 const h=replayHarness();const old=h.replay.load();h.replay.study=recording.study;h.$('seed-select').value='7302002';h.$('arm-select').value='b-400';await h.replay.load();
 const errors=[...h.errors];h.pending[0].reject(new Error('stale'));h.pending[1].resolve({});await old;assert.deepEqual(h.errors,errors);
});

test('preloaded recording populates a replay map on first navigation',()=>{
 const source=readFileSync(new URL('../web/replay.mjs',import.meta.url),'utf8');
 const show=source.slice(source.indexOf('  show(){'),source.indexOf('  pause(){'));
 const observed={};const CityMap=class{resize(){} setSites(s){observed.sites=s;}setRoutes(r){observed.routes=r;}fitRoute(){}};
 const replay={trace:{...recording,routes:{features:[]}},time:15,draw:t=>observed.time=t,load(){throw new Error('should keep loaded selection');}};
 const method=new Function('CityMap','$','location',`return ({${show}}).show;`)(CityMap,()=>({}),{search:''});method.call(replay);
 assert.deepEqual(observed.sites,recording.sites);assert.equal(observed.time,15);
});

test('power projection rejects duplicate rows, wrong protocol and partial blocks',async()=>{
 const {validatePowerProjection}=await import('../web/power-study.mjs');
 const study={...catalog.studies[0],protocol_digest:'p'};
 const data={schema:'fleetlab.power-analysis/1.0.0',projection_schema:'fleetlab.power-view/1.0.0',id:study.id,protocol_digest:'p',mode:'evaluate',scope:'SIMULATION_ONLY',decision_authority:'NONE',map_eligibility:'BLOCKED_MAP_QUALIFICATION',analysis_status:'COMPLETE',arms:study.seeds.map(seed=>({seed,arm:'b-400',eligible:true,verification:'INTERNALLY_CONSISTENT'}))};
 assert.equal(validatePowerProjection(data,study),data);
 assert.throws(()=>validatePowerProjection({...data,protocol_digest:'wrong'},study),/identity/);
 assert.throws(()=>validatePowerProjection({...data,arms:[data.arms[0],data.arms[0]]},study),/Duplicate/);
 assert.throws(()=>validatePowerProjection({...data,arms:[data.arms[0]]},study),/incomplete/);
 assert.throws(()=>validatePowerProjection({...data,analysis_status:'INCOMPLETE'},study),/incomplete/);
});

test('notebook renders the whole summary population with text-safe content and no fare edits',async()=>{
 const {renderPowerStudy}=await import('../web/power-study.mjs');
 class Node {
  constructor(tag){this.tag=tag;this.children=[];this.nodeType=1;this.textContent='';this._value=undefined;}
  append(...nodes){this.children.push(...nodes);}
  replaceChildren(...nodes){this.children=nodes;}
  setAttribute(){}
  set value(v){this._value=String(v);}
  get value(){return this._value??(this.tag==='select'?this.children[0]?.value:'');}
 }
 const prior=globalThis.document;globalThis.document={createElement:tag=>new Node(tag)};
 try {
  // Structural fixture only: no browser evidence or SF scientific claim is produced.
  const source={"arms":[{"arm":"a-200","diagnostics":{"boarded_wait":{"n":2,"p50_s":14.5,"p90_s":14.9,"population":"conditional on boarding under this treatment"},"empty_km_per_created_request":0.0,"reachability":{"definition":"immobile means zero recorded distance; not proof of route unreachability","immobile_vehicle_count":0,"immobile_vehicle_ids":[],"request_ids":[],"stranded_at_horizon":0,"unreachable_requests":0},"request_states":{"assigned":0,"completed":2,"in_progress":0,"not_created":0,"unserved":0,"waiting":0},"sites":{"A":{"allocated_energy_kwh":0.0,"available_capacity_kwh":6.666666666666667,"charge_ends":0,"charge_starts":0,"charged_kwh":0.0,"final_charge_queue":0,"final_turnaround_queue":0,"id":"A","mean_unused_kw":200.0,"mean_used_kw":0.0,"node":"a","peak_allocated_kw":0.0,"port_kw":50,"ports":8,"power_kw":200,"slots":4,"unused_capacity_kwh":6.666666666666667}},"state_minutes":{"boarding":0.3333333333333333,"idle":2.8,"passenger":0.8333333333333334,"pickup":0.03333333333333333},"state_minutes_by_site":{"UNASSIGNED":{"boarding":0.3333333333333333,"idle":2.8,"passenger":0.8333333333333334,"pickup":0.03333333333333333}},"violations":[],"zones":{"UNASSIGNED":{"completed":0,"created":0,"states":{}},"toy":{"completed":2,"created":2,"states":{"completed":2}}}},"eligible":true,"findings":[],"input_digest":"7e41386c69e3be70e78896a883a65d53341d9c98b6df41da934b4d7de4d1b448","layout":"A","metrics":{"assigned_not_boarded":0,"boarded_count":2,"charged_kwh":0.0,"completed":2,"completion_fraction":1.0,"created":2,"empty_km":0.0,"empty_km_per_completed":0.0,"hard_violations":0,"in_progress":0,"queue_vehicle_minutes":0.0,"schema":"fleetlab.city-metrics/1.0.0","site_peak_kw":{"A":0.0},"unavailable":{},"unserved":0,"wait_p50_s":14.5,"wait_p90_s":14.9,"waiting":0,"zones":{"toy":{"completed":2,"created":2}}},"run_digest":"ba64b6b00f9c8614b03e0c009793662e0e7f9b0a76f3cbec5e8de1802afe1688","seed":1,"total_power_kw":200,"verification":"INTERNALLY_CONSISTENT","violations":[]}],"cells":[{"arm":"a-200","available_seeds":4,"completed":5,"created":8,"expected_seeds":4},{"arm":"ab-200","available_seeds":4,"completed":5,"created":8,"expected_seeds":4},{"arm":"b-200","available_seeds":4,"completed":5,"created":8,"expected_seeds":4},{"arm":"a-400","available_seeds":4,"completed":5,"created":8,"expected_seeds":4},{"arm":"ab-400","available_seeds":4,"completed":5,"created":8,"expected_seeds":4},{"arm":"b-400","available_seeds":4,"completed":5,"created":8,"expected_seeds":4}],"secondary":[],"zones":[{"arm":"a-200","completed":0,"created":0,"uncertainty":"Descriptive pooled counts; no simultaneous or map/model uncertainty coverage","zone":"UNASSIGNED"},{"arm":"a-200","completed":5,"created":8,"uncertainty":"Descriptive pooled counts; no simultaneous or map/model uncertainty coverage","zone":"toy"},{"arm":"ab-200","completed":0,"created":0,"uncertainty":"Descriptive pooled counts; no simultaneous or map/model uncertainty coverage","zone":"UNASSIGNED"},{"arm":"ab-200","completed":5,"created":8,"uncertainty":"Descriptive pooled counts; no simultaneous or map/model uncertainty coverage","zone":"toy"},{"arm":"b-200","completed":0,"created":0,"uncertainty":"Descriptive pooled counts; no simultaneous or map/model uncertainty coverage","zone":"UNASSIGNED"},{"arm":"b-200","completed":5,"created":8,"uncertainty":"Descriptive pooled counts; no simultaneous or map/model uncertainty coverage","zone":"toy"},{"arm":"a-400","completed":0,"created":0,"uncertainty":"Descriptive pooled counts; no simultaneous or map/model uncertainty coverage","zone":"UNASSIGNED"},{"arm":"a-400","completed":5,"created":8,"uncertainty":"Descriptive pooled counts; no simultaneous or map/model uncertainty coverage","zone":"toy"},{"arm":"ab-400","completed":0,"created":0,"uncertainty":"Descriptive pooled counts; no simultaneous or map/model uncertainty coverage","zone":"UNASSIGNED"},{"arm":"ab-400","completed":5,"created":8,"uncertainty":"Descriptive pooled counts; no simultaneous or map/model uncertainty coverage","zone":"toy"},{"arm":"b-400","completed":0,"created":0,"uncertainty":"Descriptive pooled counts; no simultaneous or map/model uncertainty coverage","zone":"UNASSIGNED"},{"arm":"b-400","completed":5,"created":8,"uncertainty":"Descriptive pooled counts; no simultaneous or map/model uncertainty coverage","zone":"toy"}]};
  const arms=['a-200','ab-200','b-200','a-400','ab-400','b-400'];const seeds=Array.from({length:24},(_,i)=>10+i);
  const data={...source,arms:seeds.flatMap(seed=>arms.map(arm=>({...source.arms[0],seed,arm}))),primary:null};
  data.arms[0].diagnostics=structuredClone(data.arms[0].diagnostics);data.arms[0].diagnostics.reachability.definition='<img src=x onerror=alert(1)>';
  const host=new Node('div');renderPowerStudy(host,data,{seeds,configurations:arms,recordings:[],replay_seed:10},()=>{});
  const walk=n=>[n,...n.children.flatMap(walk)];const nodes=walk(host);
  const ledger=nodes.find(n=>n.tag==='table'&&n.children[0].textContent==='Every scheduled power-study arm');
  assert.equal(ledger.children.find(n=>n.tag==='tbody').children.length,144);
  assert.ok(nodes.some(n=>String(n.textContent).includes('Primary unavailable')));
  assert.ok(nodes.some(n=>String(n.textContent).includes('<img src=x')));
  assert.equal(nodes.filter(n=>n.tag==='img').length,0);
  assert.equal(nodes.filter(n=>n.tag==='input').length,0);
 }finally{globalThis.document=prior;}
});

test('actual replay loader rejects mutually consistent foreign records and payloads under the selected study',async()=>{
 for(const variant of ['foreign-study','foreign-arm','wrong-replay-seed','duplicate-record','duplicate-study']){
  const h=replayHarness();const changed=structuredClone(catalog);const selected=changed.studies[0];
  if(variant==='foreign-study')selected.recordings[0].study='foreign-study';
  if(variant==='foreign-arm')selected.recordings[0].arm='a-400';
  if(variant==='wrong-replay-seed')selected.recordings[0].seed=7302002;
  if(variant==='duplicate-record')selected.recordings.push(structuredClone(selected.recordings[0]));
  if(variant==='duplicate-study')changed.studies.push(structuredClone(selected));
  const record=selected.recordings[0];h.replay.catalog=changed;h.replay.study=recording.study;
  h.$('seed-select').value=String(record.seed);h.$('arm-select').value='b-400';
  const load=h.replay.load();
  if(h.pending.length){
   h.pending[0].resolve({...record,schema:'fleetlab.city-vehicle-view/1.1.0',vehicle:'ev-001',samples:[[15]],verification:'INTERNALLY_CONSISTENT'});
   h.pending[1].resolve(record);
  }
  await load;
  assert.equal(h.replay.trace,null,variant);
  assert.equal(h.pending.length,0,`${variant} must fail before any fetch`);
  assert.equal(h.errors.length,1,variant);
 }
});

test('actual study mounting describes only the studies present in the catalogue',async()=>{
 const {mountStudies}=await import('../web/power-study.mjs');
 const prior=globalThis.document;
 for(const extras of [undefined,[],catalog.studies]){
  const nodes=new Map();const node=()=>({children:[],textContent:'',append(...items){this.children.push(...items);},replaceChildren(...items){this.children=items;},addEventListener(){}});
  const $=id=>{if(!nodes.has(id))nodes.set(id,node());return nodes.get(id);};
  globalThis.document={getElementById:$,createElement:node};
  try{
   mountStudies({catalog:{...catalog,studies:extras},readData:()=>{throw new Error('must not fetch another study');},replay:{pause(){},gate:vm.requestGate(),load(){}},show(){},notice(){}});
   assert.equal($('study-select').children.length,1+(extras?.length??0));
   assert.equal($('replay-study-select').children.length,1+(extras?.length??0));
   if(extras?.length)assert.match($('study-help').textContent,/2 recorded studies/);
   else{
    assert.match($('study-help').textContent,/Only the original twelve-pair depot study/);
    assert.match($('study-help').textContent,/No power-study evaluation is included/);
    assert.equal($('power-study').hidden,true);
   }
   assert.match($('replay-study-context').textContent,/Twelve paired repeats/);
  }finally{globalThis.document=prior;}
 }
});
