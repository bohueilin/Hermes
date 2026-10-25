// Independent identity tests (annex C1.2, C1.4; engineering note BD-02 to BD-04): length-framed, domain-separated
// SHA-256 over JCS bytes, five fixed domains, permutation invariance and typed references.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {frame,frameText,H,Htext,DIGEST,workloadDigest,policyDigest,scenarioDigest,runDigest,comparisonDigest,harnessScenarioDigest,computeIdentities,refs,SYNTHETIC,rawId} from '../src/model/depot-lab/identity.js';
import {POLICY_BODY,REFERENCE_EFFORT,ENGINE_VERSION,VERIFIER_VERSION,PROJECTION_VERSION,METRIC_VERSION,OBSERVATION_VERSION} from '../src/model/depot-lab/profiles.js';
import {validateScenario} from '../src/model/depot-lab/schema.js';
import {defaultScenario} from '../src/model/depot-lab/presets.js';
import {jcs} from '../src/model/depot-lab/canonical.js';

// Independent RFC 8785 text for the restricted domain and an independent frame/digest built from the C1.2 formula.
const esc=s=>{let o='"';for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);o+=c===0x22?'\\"':c===0x5c?'\\\\':c===8?'\\b':c===9?'\\t':c===10?'\\n':c===12?'\\f':c===13?'\\r':c<0x20?'\\u'+c.toString(16).padStart(4,'0'):s[i];}return o+'"';};
const u16=(a,b)=>{for(let i=0;i<Math.min(a.length,b.length);i++){const d=a.charCodeAt(i)-b.charCodeAt(i);if(d)return d;}return a.length-b.length;};
const J=v=>v===null?'null':typeof v==='boolean'?(v?'true':'false'):typeof v==='number'?v.toString(10):typeof v==='string'?esc(v):Array.isArray(v)?'['+v.map(J).join(',')+']':'{'+Object.keys(v).sort(u16).map(k=>esc(k)+':'+J(v[k])).join(',')+'}';
const myFrame=(d,x)=>{const j=Buffer.from(J(x),'utf8'),len=Buffer.alloc(8);len.writeBigUInt64BE(BigInt(j.length));return Buffer.concat([Buffer.from(d,'ascii'),Buffer.from([0]),len,j]);};
const myH=(d,x)=>createHash('sha256').update(myFrame(d,x)).digest('hex');
const valid=s=>{const r=validateScenario(JSON.stringify(s),{origin:'import'});assert.ok(r.ok,JSON.stringify(r.issues));return r.scenario;};
const REF=Object.freeze({intake:120,cabin:600,diagnosis:1200,mechanical_repair:3600,specialist_repair:5400,inspection:300,connect:120,unplug:120,move:120,check:60,activation:600,postcheck:60,acknowledgment:0});

test('frame = UTF8(domain) || 0x00 || 8-byte big-endian length || JCS bytes',()=>{
 assert.deepEqual([...frame('d',{b:1,a:'é'})],[0x64,0,0,0,0,0,0,0,0,16,...Buffer.from('{"a":"é","b":1}','utf8')]);
 const big={s:'x'.repeat(300)},f=frame('fleetlab.depot.workload.v1',big),d=26;
 assert.equal(f[d],0);assert.deepEqual([...f.subarray(d+1,d+9)],[0,0,0,0,0,0,0x01,0x34]);assert.equal(f.length,d+9+308);
 assert.deepEqual(Buffer.from(f),myFrame('fleetlab.depot.workload.v1',big));
 assert.deepEqual(Buffer.from(frame('x',[])),Buffer.from([0x78,0,0,0,0,0,0,0,0,2,0x5b,0x5d]));
});
test('H is lowercase hex SHA-256 of the frame; domain and length framing both change the digest',()=>{
 for(const v of [null,0,[],{},{a:[1,'\u{1F600}']},'x'.repeat(70000)]){const h=H('fleetlab.depot.run.v1',v);assert.match(h,/^[0-9a-f]{64}$/);assert.equal(h,myH('fleetlab.depot.run.v1',v));}
 assert.notEqual(H('fleetlab.depot.run.v1',{a:1}),H('fleetlab.depot.run.v2',{a:1}));
 assert.notEqual(H('a',{}),createHash('sha256').update('a{}').digest('hex'));// no unframed concatenation
 assert.ok(DIGEST.test('0'.repeat(64)));assert.equal(DIGEST.test('A'.repeat(64)),false);assert.equal(DIGEST.test('0'.repeat(63)),false);
});
test('Htext frames text that is already JCS: byte-identical to H over the value (NP-4, AF-02)',()=>{
 const L={records:[{a:'\u{1F600}',b:[1,2]}],z:null,y:'x'.repeat(70000)};
 for(const v of [null,[],{b:1,a:'é'},L]){const t=jcs(v);assert.equal(t,J(v));assert.deepEqual([...frameText('fleetlab.depot.ledger-prefix.v1',t)],[...frame('fleetlab.depot.ledger-prefix.v1',v)]);assert.equal(Htext('fleetlab.depot.ledger-prefix.v1',t),H('fleetlab.depot.ledger-prefix.v1',v));}
 assert.equal(Htext('d','{}'),myH('d',{}));
});
test('the five digests use the fixed C1.2 domains and compositions',()=>{
 const s=valid(defaultScenario());
 const W={horizon_tick:s.horizon_tick,arrival_window_tick:s.arrival_window_tick,requirements:s.requirements,task_windows:s.task_windows,vehicle_profile:s.vehicle_profile,content_objects:s.content_objects,visits:s.visits};
 const wd=myH('fleetlab.depot.workload.v1',W),pd=myH('fleetlab.depot.policy.v1',POLICY_BODY);
 assert.equal(workloadDigest(s),wd);assert.equal(policyDigest(),pd);
 const sd=myH('fleetlab.depot.scenario.v1',{schema:s.schema,model_version:s.model_version,profile_version:s.profile_version,workload_digest:wd,policy_digest:pd,site:s.site,workers:s.workers,network:s.network,services:s.services,vendor:s.vendor,reference_effort_version:'practiced_reference_v1',reference_effort:REF});
 assert.equal(scenarioDigest(s),sd);assert.deepEqual({...REFERENCE_EFFORT},{...REF});
 const ledger={schema:'fleetlab.depot.ledger.v1',scenario_digest:sd,workload_digest:wd,policy_digest:pd,engine_version:ENGINE_VERSION,verifier_version:VERIFIER_VERSION,terminal_status:'COMPLETE',records:[]};
 const run={scenario_digest:sd,engine_version:ENGINE_VERSION,verifier_version:VERIFIER_VERSION,ledger};
 assert.equal(runDigest(run),myH('fleetlab.depot.run.v1',run));
 const cmp={baseline_run_digest:'a'.repeat(64),candidate_run_digest:'b'.repeat(64),treatment_deltas:[{pointer:'/site/ports',old:[],new:[]}],common_reference_effort:REF,metric_version:'depot_metrics_v1',projection_version:'depot_projection_v1'};
 assert.equal(comparisonDigest(cmp),myH('fleetlab.depot.comparison.v1',cmp));
 assert.notEqual(comparisonDigest(cmp),comparisonDigest({...cmp,baseline_run_digest:cmp.candidate_run_digest,candidate_run_digest:cmp.baseline_run_digest}),'arm order is significant');
 const harness={initial:{'01':{position:'P018',completed:['admit']}}};
 assert.equal(harnessScenarioDigest(s,harness),myH('fleetlab.depot.harness-scenario.v1',{public_scenario_digest:sd,harness}));
 assert.notEqual(harnessScenarioDigest(s,harness),sd);
 assert.deepEqual(computeIdentities(s),{workload_digest:wd,policy_digest:pd,scenario_digest:sd});assert.equal(computeIdentities(s,harness).scenario_digest,harnessScenarioDigest(s,harness));
 for(const d of [wd,pd,sd])assert.match(d,/^[0-9a-f]{64}$/);
 assert.equal(new Set([wd,pd,sd]).size,3);
});
test('the hashed policy body P carries the C1.4 rules, the D12-02 matrix, exogenous ranks 0/1/2 and the 28 ranked templates',()=>{
 const P=POLICY_BODY;
 assert.deepEqual([P.id,P.rank,P.admission,P.worker,P.position,P.port,P.divisible,P.observation,P.ownership,P.overlap,P.tick_seconds,P.credit,P.efficiency,P.thermal],
  ['fcfs_eligible_fair_resources_v1','ready_tick_then_template_rank_then_visit_id_then_task_id','arrival_tick_then_visit_id','lowest_eligible_id','lowest_eligible_id','DC_then_AC_then_id_never_decline_feasible_AC','weight_1_max_min','current_truth_no_future_arrivals','retain_origin_until_move_complete','serial_activation_connected_inspection_v1',1,'floor_per_constant_allocation_interval_no_residual','1/1','1/1']);
 assert.deepEqual({...P.exogenous_ranks},{shift_end:0,shift_start:1,arrival:2});
 assert.deepEqual([...P.template_ranks],['admit','intake','to_garage','diagnosis','repair','vendor_departure','vendor_outbound','vendor_service','vendor_return','vendor_reentry','to_cleaning','cabin','map_download','map_check','software_download','software_check','to_charging','connect','charge','map_activation','map_postcheck','software_activation','software_postcheck','upload','acknowledgment','inspection','unplug','egress']);
 assert.deepEqual([...P.matrix.classes],['MV','IN','CB','DG','RP','CN','CH','UP','DL','UL','CK','AC','PC','AK','FI','VT','VS']);
 const D12={MV:'XXXXXXXXXXXXXXXXX',IN:'XXXXXXXXXXXXXXXXX',CB:'XXXXXXXXAAAXAAXXX',DG:'XXXXXXXXAAAXAAXXX',RP:'XXXXXXXXAAAXAAXXX',CN:'XXXXXXXXAAAXAAXXX',CH:'XXXXXXXXAAAXXAXXX',UP:'XXXXXXXXAAAXAAXXX',DL:'XXAAAAAAAAAAAAAXX',UL:'XXAAAAAAAAAAAAAXX',CK:'XXAAAAAAAAAAAAAXX',AC:'XXXXXXXXAAAXAAXXX',PC:'XXAAAAXAAAAAAAAXX',AK:'XXAAAAAAAAAAAAAXX',FI:'XXXXXXXXAAAXAAXXX',VT:'XXXXXXXXXXXXXXXXX',VS:'XXXXXXXXXXXXXXXXX'};
 assert.deepEqual([...P.matrix.rows],P.matrix.classes.map(c=>D12[c]));
 assert.ok(Object.isFrozen(P)&&Object.isFrozen(P.matrix.rows));assert.equal(policyDigest(),policyDigest());
});
test('BD-04 version constants are pinned',()=>{
 assert.deepEqual([ENGINE_VERSION,VERIFIER_VERSION,PROJECTION_VERSION,METRIC_VERSION,OBSERVATION_VERSION],['depot-lab-engine.1.0.0','depot-lab-verifier.1.0.0','depot_projection_v1','depot_metrics_v1','depot_observation_v1']);
 for(const v of [ENGINE_VERSION,VERIFIER_VERSION])assert.match(v,/^[A-Za-z0-9._+-]{1,96}$/);
});
test('permuting ID-keyed collections, set-valued arrays, rows, intervals and object members leaves every digest unchanged',()=>{
 const a=defaultScenario(),b=defaultScenario();
 b.site.positions.reverse();b.site.ports.reverse();b.workers.reverse();b.content_objects.reverse();b.visits.reverse();b.network.covered_zones.reverse();
 for(const w of b.workers){w.qualifications.reverse();w.availability=[{start_tick:21600,end_tick:43200},{start_tick:0,end_tick:21600}];}
 for(const w of a.workers)w.availability=[{start_tick:0,end_tick:21600},{start_tick:21600,end_tick:43200}];
 for(const v of b.visits){v.installed_object_ids.reverse();v.required_object_ids.reverse();}
 const shuffled=JSON.parse(JSON.stringify(b,(k,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).reverse()):v));
 const sa=valid(a),sb=valid(shuffled);
 assert.equal(workloadDigest(sa),workloadDigest(sb));assert.equal(scenarioDigest(sa),scenarioDigest(sb));assert.deepEqual(sa,sb);
 const one=defaultScenario();for(const w of one.workers)w.availability=[{start_tick:0,end_tick:43200}];
 assert.notEqual(scenarioDigest(valid(one)),scenarioDigest(sa),'declared intervals are identity; adjacency is merged only in the derived union');
});
test('reordering semantically ordered arrays (DC bands) is a constant violation, never normalized away',()=>{
 const s=defaultScenario();s.vehicle_profile.dc_bands.reverse();
 const r=validateScenario(JSON.stringify(s),{origin:'import'});assert.equal(r.ok,false);assert.ok(r.issues.some(i=>i.path==='/vehicle_profile'));
});
test('editing the shared target SOC changes workload and scenario digests but not the policy digest',()=>{
 const base=valid(defaultScenario()),seen=new Set([scenarioDigest(base)]);
 for(const S of [20,60,79,81,90,100]){
  const s=defaultScenario();s.requirements.energy.target_soc_pct=S;const v=valid(s);
  assert.notEqual(workloadDigest(v),workloadDigest(base),`target ${S}`);assert.notEqual(scenarioDigest(v),scenarioDigest(base));assert.equal(policyDigest(),policyDigest());seen.add(scenarioDigest(v));
 }
 assert.equal(seen.size,7);
 const back=defaultScenario();back.requirements.energy.target_soc_pct=90;back.requirements.energy.target_soc_pct=80;assert.equal(scenarioDigest(valid(back)),scenarioDigest(base));
 const supply=defaultScenario();supply.site.supply_w=299999;const v=valid(supply);
 assert.equal(workloadDigest(v),workloadDigest(base),'site inputs are not workload');assert.notEqual(scenarioDigest(v),scenarioDigest(base));
 const arrival=defaultScenario();arrival.visits[3].arrival_tick+=1;assert.notEqual(workloadDigest(valid(arrival)),workloadDigest(base));
});
test('typed references use the C1.4 and BD-03 spellings, padding and disjoint namespaces',()=>{
 assert.deepEqual([refs.visit('01'),refs.position('01'),refs.port('DC01'),refs.worker('01'),refs.object('sw-v2'),refs.task('01','map_postcheck'),refs.flow('01','charge'),refs.cacheTask('sw-v2','fetch'),refs.cacheTask('sw-v2','check'),refs.cacheFlow('sw-v2')],
  ['visit:01','position:01','port:DC01','worker:01','object:sw-v2','task:01:map_postcheck','flow:01:charge','task:cache:sw-v2:fetch','task:cache:sw-v2:check','flow:cache:sw-v2:fetch']);
 assert.deepEqual([refs.lane(1),refs.lane(20),refs.client('7'),refs.storage('7'),refs.logs('7'),refs.service('maps'),refs.zone('garage')],['lane:01','lane:20','client:7','storage:7','logs:7','service:maps','zone:garage']);
 assert.equal(refs.action(5,1,12),'action:000005:01:000012');assert.equal(refs.group(172800,64,0),'group:172800:64:000000');assert.equal(refs.stableKey(3,'PROGRESS',2,0),'000003:PROGRESS:02:00000');
 assert.deepEqual({...SYNTHETIC},{site:'site:supply',wanDown:'network:wan_down',wanUp:'network:wan_up',pool:'network:pool',cacheRead:'cache:read',cache:'cache:depot',vendorBay:'vendor:bay:01',vendorWorker:'vendor:worker:01'});
 assert.notEqual(refs.worker('01'),refs.position('01'));assert.equal(rawId(refs.task('01','cabin')),'01:cabin');assert.equal(rawId(refs.visit('A-1')),'A-1');
 const longest=['task:'+'x'.repeat(32)+':software_activation','flow:cache:'+'x'.repeat(32)+':fetch','task:cache:'+'x'.repeat(32)+':check'];
 assert.deepEqual([refs.task('x'.repeat(32),'software_activation'),refs.cacheFlow('x'.repeat(32)),refs.cacheTask('x'.repeat(32),'check')],longest);
 for(const id of [...longest,refs.action(172800,64,99999),refs.lane(20),refs.visit('01')])assert.match(id,/^[A-Za-z][A-Za-z0-9:_-]{0,95}$/,id);
});
