// Pair compatibility (A36), component-wise classification (A24, A29, A30, A35) and the comparison envelope.
import test from 'node:test';import assert from 'node:assert/strict';
import {checkPairCompatibility,checkRawPairCompatibility,classifyVector,compareDepotRuns,TREATMENT_POINTERS,VERIFICATION_SCHEMA,COMPARISON_SCHEMA} from '../src/model/depot-lab/compare.js';
import {preset,defaultScenario} from '../src/model/depot-lab/presets.js';
import {validateScenario} from '../src/model/depot-lab/schema.js';
import {scenarioDigest,workloadDigest,policyDigest,comparisonDigest,H} from '../src/model/depot-lab/identity.js';
import {jcs} from '../src/model/depot-lab/canonical.js';
import {REFERENCE_EFFORT,ENGINE_VERSION,VERIFIER_VERSION,PROJECTION_VERSION,METRIC_VERSION} from '../src/model/depot-lab/profiles.js';
import {runDepotJob} from '../src/runtime/depot-lab-job.js';
const MBPS=125000,clone=v=>JSON.parse(JSON.stringify(v));
const valid=s=>{const v=validateScenario(s,{origin:'import'});assert.ok(v.ok,JSON.stringify(v.issues));return v.scenario;};
const pair=(b,c)=>checkPairCompatibility(valid(b),valid(c));
const variant=(base,f)=>{const s=clone(base);f(s);return s;};
// Counts model starts through the real job with fake model functions.
function starts(b,c){
 let n=0;const ledger={records:[]};
 const reply=runDepotJob({type:'run',id:'r1',generation:1,arms:{baseline:jcs(b),candidate:jcs(c)}},{createDepotRun:s=>{n++;return {s};},stepDepotRun:()=>({done:true,ledger,terminal_status:'COMPLETE',guard:null}),verifyDepotRun:()=>null,compareDepotRuns:()=>null});
 return {n,reply};
}
const tally=results=>({compatible:results.filter(r=>r.compatible).length,rejected:results.filter(r=>!r.compatible).length});
const short=h=>{const s=defaultScenario();s.horizon_tick=h;s.arrival_window_tick=3600;s.visits=s.visits.filter(v=>v.arrival_tick<3600);for(const w of s.workers)w.availability=[{start_tick:0,end_tick:3600}];s.vendor.availability=[{start_tick:0,end_tick:3600}];return s;};

test('allowlist is exactly the C1.2 authoritative treatment paths',()=>{
 assert.deepEqual(TREATMENT_POINTERS,['/network/cache','/network/client_bytes_per_tick','/network/generation','/network/pool_bytes_per_tick','/network/wan_down_bytes_per_tick','/network/wan_up_bytes_per_tick','/services/maps','/services/software','/services/uploads','/site/garage_level','/site/lane_count','/site/ports','/site/positions','/site/supply_w','/workers']);
});

test('A36 pool 300 to 600 only: 1 field, 1 compatible / 0 rejected',()=>{
 const base=defaultScenario(),r=pair(base,variant(base,s=>{s.network.pool_bytes_per_tick=600*MBPS;}));
 assert.deepEqual(tally([r]),{compatible:1,rejected:0});
 assert.deepEqual(r.treatment,{intervention_count:1,fields:['/network/pool_bytes_per_tick'],leaves:[{pointer:'/network/pool_bytes_per_tick',old:37500000,new:75000000}]});
});

test('A36 WAN down 200 to 1,000 and up 100 to 1,000 bundle: 2 fields, 1 / 0',()=>{
 const base=defaultScenario(),r=pair(base,variant(base,s=>{s.network.wan_down_bytes_per_tick=1000*MBPS;s.network.wan_up_bytes_per_tick=1000*MBPS;}));
 assert.deepEqual(tally([r]),{compatible:1,rejected:0});
 assert.equal(r.treatment.intervention_count,1);
 assert.deepEqual(r.treatment.fields,['/network/wan_down_bytes_per_tick','/network/wan_up_bytes_per_tick']);
 assert.deepEqual(r.treatment.leaves,[{pointer:'/network/wan_down_bytes_per_tick',old:25000000,new:125000000},{pointer:'/network/wan_up_bytes_per_tick',old:12500000,new:125000000}]);
});

test('A36 supply 300 to 400, lanes 1 to 2, cache cold to off: 1 field each, 3 / 0',()=>{
 const base=defaultScenario();
 const rows=[[s=>{s.site.supply_w=400000;},'/site/supply_w'],[s=>{s.site.lane_count=2;},'/site/lane_count'],[s=>{s.network.cache.state='off';},'/network/cache']].map(([f,field])=>{const r=pair(base,variant(base,f));assert.deepEqual(r.treatment.fields,[field]);assert.equal(r.treatment.intervention_count,1);return r;});
 assert.deepEqual(tally(rows),{compatible:3,rejected:0});
});

test('A36 overlap profile serial to overlap: 0 / 1 and 0 run starts',()=>{
 const base=defaultScenario(),cand=variant(base,s=>{s.overlap_profile='overlap_activation_v1';});
 const r=checkRawPairCompatibility(base,cand);
 assert.deepEqual(tally([r]),{compatible:0,rejected:1});
 assert.deepEqual(r.issues.map(i=>[i.arm,i.code,i.path]),[['candidate','CONST','/overlap_profile']]);
 const {n,reply}=starts(base,cand);assert.equal(n,0);assert.equal(reply.type,'refused');assert.equal(reply.reason,'invalid_setup');
});

test('A36 B port plus rezoning bundle: 1 intervention, 2 authoritative fields, every leaf delta',()=>{
 const p=preset('B'),r=pair(p.baseline,p.candidate);
 assert.deepEqual(tally([r]),{compatible:1,rejected:0});
 assert.equal(r.treatment.intervention_count,1);
 assert.deepEqual(r.treatment.fields,['/site/ports','/site/positions']);
 assert.deepEqual(r.treatment.leaves,[
  {pointer:'/site/ports/DC03',old:null,new:{enabled:true,id:'DC03',kind:'DC',position_id:'P017',rating_w:150000}},
  {pointer:'/site/positions/P017/zone',old:'waiting',new:'charging'},
 ]);
 const {n,reply}=starts(p.baseline,p.candidate);assert.equal(n,2);assert.equal(reply.type,'result');
});

test('A36 any single undeclared non-treatment field: 0 / 1 and 0 starts',()=>{
 const base=defaultScenario();
 for(const f of [s=>{s.site.background_w=1000;},s=>{s.network.covered_zones=['charging','cleaning','garage'];},s=>{s.vendor.service_ticks=7201;},s=>{s.network.cache_read_bytes_per_tick=999*MBPS;}]){
  const cand=variant(base,f),r=pair(base,cand);
  assert.deepEqual(tally([r]),{compatible:0,rejected:1});assert.equal(r.issues.length,1);assert.equal(r.treatment,null);
  assert.equal(starts(base,cand).n,0);
 }
});

test('A36 six separate non-treatment rejections: 0 / 6, 1 field each, 0 starts per pair',()=>{
 const base=defaultScenario();
 const cases=[
  [short(3600),short(3601),'/horizon_tick',3600,3601],
  [base,variant(base,s=>{s.visits[0].arrival_tick=1;}),'/visits/01/arrival_tick',0,1],
  [base,variant(base,s=>{s.content_objects.find(o=>o.id==='sw-v2').size_bytes=2000000001;}),'/content_objects/sw-v2/size_bytes',2000000000,2000000001],
  [base,variant(base,s=>{s.visits[0].cabin_required=false;}),'/visits/01/cabin_required',true,false],
  [base,variant(base,s=>{s.requirements.energy.target_soc_pct=90;}),'/requirements/energy/target_soc_pct',80,90],
 ];
 const results=cases.map(([b,c,path,old,neu])=>{
  const r=checkRawPairCompatibility(b,c);
  assert.deepEqual(r.issues,[{code:'NON_TREATMENT_DIFFERENCE',path,value:neu,bound:old}]);
  const {n,reply}=starts(b,c);assert.equal(n,0);assert.equal(reply.reason,'incompatible');
  return r;
 });
 const policy=variant(base,s=>{s.policy_id='shortest_first_v1';}),pr=checkRawPairCompatibility(base,policy);
 assert.deepEqual(pr.issues.map(i=>[i.arm,i.code,i.path]),[['candidate','CONST','/policy_id']]);
 assert.equal(starts(base,policy).n,0);
 assert.deepEqual(tally([...results,pr]),{compatible:0,rejected:6});
});

test('A36 shared target 80 to 90 in both arms: compatible, both scenario digests change, same treatment',()=>{
 const p=preset('B'),at90=s=>variant(s,x=>{x.requirements.energy.target_soc_pct=90;});
 const r80=pair(p.baseline,p.candidate),r90=pair(at90(p.baseline),at90(p.candidate));
 assert.deepEqual(tally([r90]),{compatible:1,rejected:0});
 assert.deepEqual(r90.treatment,r80.treatment);
 assert.notEqual(scenarioDigest(valid(at90(p.baseline))),scenarioDigest(valid(p.baseline)));
 assert.notEqual(scenarioDigest(valid(at90(p.candidate))),scenarioDigest(valid(p.candidate)));
});

test('A36 presentation-only difference: compatible, 0 fields, simulation digest difference 0',()=>{
 const base=defaultScenario(),r=pair(base,clone(base));
 assert.deepEqual(tally([r]),{compatible:1,rejected:0});
 assert.deepEqual(r.treatment,{intervention_count:0,fields:[],leaves:[]});
 assert.equal(scenarioDigest(valid(base)),scenarioDigest(valid(clone(base))));
});

test('worker collection edits stay one field with every member leaf, keyed by id',()=>{
 const p=preset('TN'),r=pair(p.baseline,p.candidate);
 assert.deepEqual(r.treatment.fields,['/workers']);
 assert.deepEqual(r.treatment.leaves,[{pointer:'/workers/C02/qualifications/cabin/level',old:'unqualified',new:'supervised_only'}]);
 const two=pair(p.baseline,variant(p.candidate,s=>{s.workers.find(w=>w.id==='C01').availability=[{start_tick:0,end_tick:21600}];}));
 assert.deepEqual(two.treatment.fields,['/workers']);assert.equal(two.treatment.leaves.length,2);
 const removed=pair(p.baseline,variant(p.baseline,s=>{s.site.positions=s.site.positions.filter(x=>x.id!=='P005');}));
 assert.deepEqual(removed.treatment.leaves,[{pointer:'/site/positions/P005',old:{enabled:true,id:'P005',zone:'waiting'},new:null}]);
});

// Vectors in presentation order; reference classes use exact "p/q" seconds.
const V=(on,over,obs,unrel,classes,kwh,bytes)=>[
 {id:'on_time_count',direction:'up',value:on},{id:'overdue_seconds',direction:'down',value:over},{id:'observed_visit_seconds',direction:'down',value:obs},{id:'unreleased_count',direction:'down',value:unrel},
 ...Object.entries(classes).map(([c,v])=>({id:`remaining_reference_seconds:${c}`,direction:'down',value:v})),
 {id:'remaining_required_kWh',direction:'down',value:kwh},{id:'remaining_required_bytes',direction:'down',value:bytes}];

test('A29 hand vectors classify as mixed: remaining work worsens while the first four improve',()=>{
 const r=classifyVector(V(1,4200,51000,2,{analytic_attended:'2100/1'},0,0),V(2,0,45600,1,{analytic_attended:'42900/1'},0,0));
 assert.equal(r.classification,'mixed');
 assert.deepEqual(r.components.map(c=>[c.id,c.delta,c.relation]),[['on_time_count',1,'better'],['overdue_seconds',-4200,'better'],['observed_visit_seconds',-5400,'better'],['unreleased_count',-1,'better'],['remaining_reference_seconds:analytic_attended','40800/1','worse'],['remaining_required_kWh',0,'equal'],['remaining_required_bytes',0,'equal']]);
});

test('A24 one port to two ports classifies as worse, never a benefit; its reverse is an improvement',()=>{
 const zero={connect:'0/1',inspection:'0/1',move:'0/1',unplug:'0/1'},one=V(1,1740,5580,0,zero,0,0),two=V(0,2220,6180,0,zero,0,0);
 assert.equal(classifyVector(one,two).classification,'worse');
 assert.equal(classifyVector(two,one).classification,'improvement');
});

test('A35 Wi-Fi generation identity is a tie; A30 primary to secondary display vectors are worse',()=>{
 const arm=()=>V(1,0,1300,0,{check:'0/1',activation:'0/1',postcheck:'0/1',inspection:'0/1',move:'0/1'},0,0),r=classifyVector(arm(),arm());
 assert.equal(r.classification,'tie');assert.ok(r.components.every(c=>c.relation==='equal'&&(c.delta===0||c.delta==='0/1')));
 assert.equal(classifyVector(V(2,1,3600,0,{},0,0),V(0,6,3606,0,{},0,0)).classification,'worse');
});

test('missing, unknown or misdirected components give NOT_AVAILABLE, never a partial verdict',()=>{
 const a=V(1,0,10,0,{cabin:'600/1'},0,0);
 assert.equal(classifyVector(a,V(1,0,10,0,{cabin:null},0,0)).classification,'NOT_AVAILABLE');
 assert.equal(classifyVector(a,V(1,0,10,0,{},0,0)).classification,'NOT_AVAILABLE');
 assert.equal(classifyVector(a,a.filter(c=>c.id!=='remaining_required_bytes')).classification,'NOT_AVAILABLE');
 assert.equal(classifyVector(a,a.map(c=>c.id==='overdue_seconds'?{...c,direction:'up'}:c)).classification,'NOT_AVAILABLE');
 assert.equal(classifyVector(a,[...a,{id:'winner_score',direction:'up',value:1}]).classification,'NOT_AVAILABLE');
 assert.equal(classifyVector(a,a.map(c=>c.id==='overdue_seconds'?{...c,value:0.5}:c)).classification,'NOT_AVAILABLE');
 assert.equal(classifyVector(a,a.map(c=>c.id==='remaining_reference_seconds:cabin'?{...c,value:'6/8'}:c)).classification,'NOT_AVAILABLE');
});

// Synthetic VERIFIED envelopes in the note 10.5 shape; the comparison never reads anything but these fields.
function envelope(scenario,vector,{status='VERIFIED',run=null}={}){
 const s=valid(scenario),d=scenarioDigest(s);
 return {schema:VERIFICATION_SCHEMA,status,consistency:status==='VERIFIED'?'INTERNALLY_CONSISTENT':'INVALID_EVIDENCE',primary_violation:null,
  digests:{scenario:d,workload:workloadDigest(s),policy:policyDigest(),run:run??H('fleetlab.test.run.v1',{d})},
  versions:{engine:ENGINE_VERSION,verifier:VERIFIER_VERSION,projection:PROJECTION_VERSION,metric:METRIC_VERSION},
  trust:{authenticity:'NOT_AUTHENTICATED',authorization:'NOT_EVALUATED',deployment_permission:'NONE',evidence:'NOT_EVIDENCE'},
  ledger:{records:1,bytes:2,terminal_status:'COMPLETE',guard:null},projection:status==='VERIFIED'?{version:PROJECTION_VERSION,vector}:null};
}
const vec=(classes,components)=>({classes,components});

test('compareDepotRuns binds the comparison digest and expands absent classes to exact zero',()=>{
 const p=preset('G'),t=pair(p.baseline,p.candidate).treatment;
 const b=envelope(p.baseline,vec(['diagnosis','mechanical_repair'],V(20,100,9000,4,{diagnosis:'0/1',mechanical_repair:'3600/1'},0,0))),c=envelope(p.candidate,vec(['diagnosis'],V(20,100,9000,4,{diagnosis:'1200/1'},0,0)));
 const r=compareDepotRuns(b,c,t);
 assert.equal(r.schema,COMPARISON_SCHEMA);assert.equal(r.classification,'mixed');assert.ok(Object.isFrozen(r.components));
 assert.deepEqual(r.components.filter(x=>x.id.startsWith('remaining_reference')).map(x=>[x.id,x.baseline,x.candidate,x.delta]),[['remaining_reference_seconds:diagnosis','0/1','1200/1','1200/1'],['remaining_reference_seconds:mechanical_repair','3600/1','0/1','-3600/1']]);
 assert.equal(r.digest,comparisonDigest({baseline_run_digest:b.digests.run,candidate_run_digest:c.digests.run,treatment_deltas:t.leaves,common_reference_effort:REFERENCE_EFFORT,metric_version:'depot_metrics_v1',projection_version:'depot_projection_v1'}));
 const swapped=compareDepotRuns(c,b,pair(p.candidate,p.baseline).treatment);assert.notEqual(swapped.digest,r.digest);
});

test('compareDepotRuns accepts only VERIFIED, mutually compatible envelopes with a consistent treatment',()=>{
 const p=preset('B'),t=pair(p.baseline,p.candidate).treatment,v=vec([],V(1,0,1,0,{},0,0));
 const b=envelope(p.baseline,v),c=envelope(p.candidate,v);
 assert.equal(compareDepotRuns(b,c,t).classification,'tie');
 const refused=(x,y,tr,code)=>{const r=compareDepotRuns(x,y,tr);assert.equal(r.classification,'NOT_AVAILABLE');assert.equal(r.digest,null);assert.deepEqual(r.components,[]);assert.equal(r.issues[0].code,code);};
 refused(b,envelope(p.candidate,null,{status:'INVALID'}),t,'NOT_VERIFIED');
 refused(b,{...c,versions:{...c.versions,metric:'depot_metrics_v0'}},t,'VERSION_MISMATCH');
 refused(b,envelope(variant(p.candidate,s=>{s.requirements.energy.target_soc_pct=90;}),v),t,'INCOMPATIBLE');
 refused(b,c,{intervention_count:0,fields:[],leaves:[]},'TREATMENT_MISMATCH');
 refused(b,c,{...t,fields:['/visits']},'TREATMENT_INVALID');
 refused(b,c,null,'TREATMENT_INVALID');
});
