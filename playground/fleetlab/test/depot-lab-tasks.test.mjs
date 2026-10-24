// Independent task-catalog tests (annex C1.4, C1.6, D1-09, D12-02 and the Q24 bypass): every edge is written out
// per route combination from the documents and compared with compileScenario, never re-derived by the same code.
import test from 'node:test';
import assert from 'node:assert/strict';
import {compileScenario,repairRoute,MAX_TASKS_PER_VISIT} from '../src/model/depot-lab/task-graph.js';
import {validateScenario} from '../src/model/depot-lab/schema.js';
import {OVERLAP_CLASSES,OVERLAP_MATRIX,overlapAllowed,TEMPLATES,TEMPLATE_RANK,TEMPLATE_CLASS,REFERENCE_EFFORT} from '../src/model/depot-lab/profiles.js';

const CLASSES=['intake','cabin','diagnosis','mechanical_repair','specialist_repair','inspection','connect','unplug','move'];
const PROF={intake:[180,120,90],cabin:[900,600,480],diagnosis:[1680,1200,1020],mechanical_repair:[4800,3600,3300],specialist_repair:[7200,5400,4800],inspection:[420,300,240],connect:[180,120,105],unplug:[150,120,90],move:[120,120,120]};
const row=(c,p='practiced')=>({task_class:c,level:'independent',proficiency:p,may_supervise:true,solo_duration_ticks:PROF[c][['developing','practiced','advanced'].indexOf(p)]});
const obj=(id,kind,size)=>({id,kind,size_bytes:size,check_ticks:60,activation_ticks:600,postcheck_ticks:60});
const ep=()=>({service_reachable:'reachable',entitlement:'valid'});
const visit=(id,o={})=>({id,arrival_tick:0,due_tick:21600,initial_soc_pct:20,fault:'none',cabin_required:true,installed_object_ids:['map1','sw1'],required_object_ids:['map1','sw2'],initial_log_bytes:5000000000,upload_required:false,task_windows:[],...o});
const base=(o={},level='basic')=>({
 schema:'fleetlab.depot.scenario.v1',model_version:'depot_model_v1',profile_version:'depot_contract_v1',policy_id:'fcfs_eligible_fair_resources_v1',
 overlap_profile:'serial_activation_connected_inspection_v1',reference_effort_version:'practiced_reference_v1',horizon_tick:43200,arrival_window_tick:21600,
 requirements:{energy:{target_soc_pct:80}},task_windows:{cabin_earliest_start_tick:0},
 vehicle_profile:{capacity_mj:216000000000,storage_capacity_bytes:50000000000,ac_cap_w:11000,dc_bands:[{from_soc_pct:0,until_soc_pct:60,cap_w:100000},{from_soc_pct:60,until_soc_pct:80,cap_w:60000},{from_soc_pct:80,until_soc_pct:100,cap_w:30000}],efficiency:'1/1',thermal_factor:'1/1'},
 site:{positions:[{id:'P1',zone:'waiting',enabled:true},{id:'P2',zone:'charging',enabled:true},{id:'P3',zone:'cleaning',enabled:true},{id:'P4',zone:'garage',enabled:true}],ports:[{id:'DC1',position_id:'P2',kind:'DC',rating_w:150000,enabled:true}],lane_count:1,supply_w:300000,background_w:0,garage_level:level},
 workers:[{id:'W1',qualifications:CLASSES.map(c=>row(c)),availability:[{start_tick:0,end_tick:43200}]}],
 network:{generation:'wifi6',pool_bytes_per_tick:37500000,client_bytes_per_tick:12500000,wan_down_bytes_per_tick:25000000,wan_up_bytes_per_tick:12500000,cache_read_bytes_per_tick:125000000,covered_zones:['charging','cleaning','garage','waiting'],cache:{state:'cold',capacity_bytes:20000000000,initial_object_ids:[]}},
 services:{maps:ep(),software:ep(),uploads:ep()},
 content_objects:[obj('map1','map',500000000),obj('map2','map',500000000),obj('sw1','software',2000000000),obj('sw2','software',2000000000)],
 visits:[visit('01',o)],
 vendor:{enabled:true,bay_count:1,worker_count:1,outbound_ticks:1800,service_ticks:7200,return_ticks:1800,traction_energy_mj:0,availability:[{start_tick:0,end_tick:43200}]},
});
const valid=s=>{const r=validateScenario(JSON.stringify(s),{origin:'import'});assert.ok(r.ok,JSON.stringify(r.issues));return r.scenario;};
const short=id=>id.startsWith('task:cache:')?id.slice(5):id.split(':')[2];
const plan=(s,vid='01')=>{const c=compileScenario(valid(s)),v=c.visits.find(x=>x.id===vid);
 return {c,v,by:Object.fromEntries(v.tasks.map(t=>[t.template,t])),edges:Object.fromEntries(v.tasks.map(t=>[t.template,t.prereqs.map(short).sort()]))};};
const sortE=e=>Object.fromEntries(Object.entries(e).map(([k,v])=>[k,v.slice().sort()]));
const edges=(o,level,mut)=>{const s=base(o,level);mut?.(s);return plan(s).edges;};

// D12-02 edges written out for each combination (prerequisites by template; cache:<object>:check is the depot task).
const CHARGE_SW={admit:[],intake:['admit'],to_cleaning:['intake'],cabin:['to_cleaning'],software_download:['cache:sw2:check','intake'],software_check:['software_download'],
 to_charging:['cabin'],connect:['to_charging'],charge:['connect'],software_activation:['charge','software_check'],software_postcheck:['software_activation'],
 upload:['intake'],acknowledgment:['upload'],inspection:['charge','software_postcheck'],unplug:['inspection'],egress:['inspection','unplug']};
const NOCHARGE_SW={admit:[],intake:['admit'],to_cleaning:['intake'],cabin:['to_cleaning'],software_download:['cache:sw2:check','intake'],software_check:['software_download'],
 software_activation:['software_check'],software_postcheck:['software_activation'],upload:['intake'],acknowledgment:['upload'],inspection:['cabin','software_postcheck'],egress:['inspection']};
const ONSITE={to_garage:['intake'],diagnosis:['to_garage'],repair:['diagnosis']};
const VENDOR={vendor_departure:['intake'],vendor_outbound:['vendor_departure'],vendor_service:['vendor_outbound'],vendor_return:['vendor_service'],vendor_reentry:['vendor_return']};
const MAP_CHARGE={map_download:['cache:map2:check','intake'],map_check:['map_download'],map_activation:['charge','map_check'],map_postcheck:['map_activation'],software_activation:['charge','map_postcheck','software_check'],inspection:['charge','map_postcheck','software_postcheck']};

test('charge, no repair, cold cache, optional upload: every D12-02 edge',()=>{
 const p=plan(base());assert.deepEqual(p.edges,sortE(CHARGE_SW));
 const [f,k]=p.c.cacheTasks;assert.deepEqual([f.id,k.id],['task:cache:sw2:fetch','task:cache:sw2:check']);
 assert.deepEqual([f.prereqs,f.anyPrereqs,k.prereqs],[[],['task:01:intake'],['task:cache:sw2:fetch']]);
 assert.equal(p.v.terminalZone,'charging');assert.equal(p.v.route,'none');
});
test('no charge (initial SOC at target): the energy prerequisite is satisfied at intake',()=>{
 const p=plan(base({initial_soc_pct:80}));assert.deepEqual(p.edges,sortE(NOCHARGE_SW));assert.equal(p.v.terminalZone,'cleaning');assert.equal(p.v.charge,null);
});
test('repair on site and through the vendor, with and without cabin and charge',()=>{
 const mech={fault:'mechanical'};
 assert.deepEqual(edges(mech,'basic'),sortE({...CHARGE_SW,...ONSITE,to_cleaning:['repair']}));
 assert.deepEqual(edges(mech,'none'),sortE({...CHARGE_SW,...VENDOR,to_cleaning:['vendor_reentry']}));
 assert.deepEqual(edges({...mech,initial_soc_pct:80},'basic'),sortE({...NOCHARGE_SW,...ONSITE,to_cleaning:['repair']}));
 const noCabin=({to_cleaning,cabin,...rest})=>rest;
 assert.deepEqual(edges({...mech,cabin_required:false},'basic'),sortE({...noCabin(CHARGE_SW),...ONSITE,to_charging:['repair']}));
 assert.deepEqual(edges({...mech,cabin_required:false,initial_soc_pct:80},'basic'),sortE({...noCabin(NOCHARGE_SW),...ONSITE,inspection:['repair','software_postcheck']}));
 assert.deepEqual(edges({...mech,cabin_required:false,initial_soc_pct:80},'none'),sortE({...noCabin(NOCHARGE_SW),...VENDOR,inspection:['software_postcheck','vendor_reentry']}));
 assert.deepEqual(edges({cabin_required:false,initial_soc_pct:80}),sortE({...noCabin(NOCHARGE_SW),inspection:['intake','software_postcheck']}));
 const zone=(o,l)=>plan(base(o,l)).v.terminalZone;
 assert.deepEqual([zone({...mech,cabin_required:false,initial_soc_pct:80},'basic'),zone({...mech,cabin_required:false,initial_soc_pct:80},'none'),zone({cabin_required:false,initial_soc_pct:80}),zone({...mech,cabin_required:false},'basic')],['garage','waiting','waiting','charging']);
 const v=plan(base(mech,'none'));assert.equal(v.by.diagnosis,undefined);assert.equal(v.by.repair,undefined);assert.equal(v.by.to_garage,undefined);
 const off=base(mech,'none');off.vendor.enabled=false;assert.deepEqual(plan(off).edges,v.edges,'a disabled vendor still emits the vendor route, which waits');
});
test('map refresh: map lifecycle, map postcheck before software activation, both after charge',()=>{
 const p=plan(base({required_object_ids:['map2','sw2']}));
 assert.deepEqual(p.edges,sortE({...CHARGE_SW,...MAP_CHARGE}));
 assert.deepEqual(p.c.cacheTasks.map(t=>t.id),['task:cache:map2:fetch','task:cache:map2:check','task:cache:sw2:fetch','task:cache:sw2:check']);
 const n=plan(base({required_object_ids:['map2','sw2'],initial_soc_pct:80}));
 assert.deepEqual([n.edges.map_activation,n.edges.software_activation,n.edges.inspection],[['map_check'],['map_postcheck','software_check'],['cabin','map_postcheck','software_postcheck']]);
 const only=plan(base({required_object_ids:['map2'],installed_object_ids:['map1','sw1']}));
 assert.deepEqual([only.edges.map_activation,only.edges.inspection,only.by.software_activation],[['charge','map_check'],['charge','map_postcheck'],undefined]);
});
test('uploads: a mandatory acknowledgment gates inspection; an optional one gates nothing; no logs means no upload',()=>{
 const m=plan(base({upload_required:true}));
 assert.deepEqual(m.edges,sortE({...CHARGE_SW,inspection:['acknowledgment','charge','software_postcheck']}));assert.deepEqual([m.by.upload.mandatory,m.by.acknowledgment.mandatory],[true,true]);
 const o=plan(base());assert.deepEqual([o.by.upload.mandatory,o.by.acknowledgment.mandatory],[false,false]);
 assert.deepEqual(Object.values(o.edges).flat().filter(x=>x==='upload'||x==='acknowledgment'),['upload']);// only acknowledgment depends on the upload
 const none=plan(base({initial_log_bytes:0}));assert.equal(none.by.upload,undefined);assert.equal(none.by.acknowledgment,undefined);
 assert.deepEqual(m.by.upload.data,{object:'logs:01',kind:'logs',direction:'up',bytes:5000000000,endpoint:'uploads',cacheRoute:false});
});
test('cache: warm serves without depot tasks, off downloads directly, cold fetches once per object for every visit',()=>{
 const warm=base();warm.network.cache={state:'warm',capacity_bytes:20000000000,initial_object_ids:['sw2']};
 const w=plan(warm);assert.deepEqual(w.edges.software_download,['intake']);assert.equal(w.c.cacheTasks.length,0);assert.equal(w.by.software_download.data.cacheRoute,true);
 const off=base();off.network.cache={state:'off',capacity_bytes:0,initial_object_ids:[]};
 const f=plan(off);assert.deepEqual(f.edges.software_download,['intake']);assert.equal(f.c.cacheTasks.length,0);assert.equal(f.by.software_download.data.cacheRoute,false);
 const two=base();two.visits.push(visit('02',{arrival_tick:900}),visit('03',{required_object_ids:['map1'],initial_soc_pct:80}));
 const c=compileScenario(valid(two));assert.deepEqual(c.cacheTasks.map(t=>t.id),['task:cache:sw2:fetch','task:cache:sw2:check']);
 assert.deepEqual(c.cacheTasks[0].anyPrereqs,['task:01:intake','task:02:intake']);
 const fetch=c.cacheTasks[0],check=c.cacheTasks[1];
 assert.deepEqual([fetch.kind,fetch.cls,fetch.rank,fetch.visit,fetch.data.bytes,fetch.data.cacheRoute],['data','DL',TEMPLATE_RANK.software_download,null,2000000000,false]);
 assert.deepEqual([check.kind,check.cls,check.rank,check.timed,check.prereqs],['timed','CK',TEMPLATE_RANK.software_check,60,['task:cache:sw2:fetch']]);
 assert.ok(c.visits.every(v=>v.tasks.every(t=>!t.id.startsWith('task:cache:'))),'cache tasks are counted apart from the 32 visit tasks');
});
test('a zero-byte required object omits its download (BD-05) and checks after intake',()=>{
 const s=base();s.content_objects[3].size_bytes=0;const p=plan(s);
 assert.equal(p.by.software_download,undefined);assert.deepEqual(p.edges.software_check,['intake']);assert.equal(p.c.cacheTasks.length,0);
});
test('task windows: effective cabin start = max(global, visit cabin window); the cleaning move waits for it; others apply to their own template',()=>{
 const at=(g,w)=>{const s=base({task_windows:w});s.task_windows.cabin_earliest_start_tick=g;const p=plan(s);return Object.fromEntries(p.v.tasks.map(t=>[t.template,t.earliestStart]));};
 const a=at(3600,[]);assert.deepEqual([a.to_cleaning,a.cabin],[3600,3600]);assert.ok(Object.entries(a).every(([k,v])=>k==='cabin'||k==='to_cleaning'||v===0));
 const b=at(3600,[{task_template:'cabin',earliest_start_tick:5000}]);assert.deepEqual([b.to_cleaning,b.cabin],[5000,5000]);
 const c=at(3600,[{task_template:'cabin',earliest_start_tick:100}]);assert.deepEqual([c.to_cleaning,c.cabin],[3600,3600]);
 const d=at(0,[{task_template:'software_download',earliest_start_tick:700},{task_template:'egress',earliest_start_tick:9000}]);
 assert.deepEqual([d.software_download,d.egress,d.software_check,d.cabin,d.to_cleaning],[700,9000,0,0,0]);
 const e=at(3600,[{task_template:'to_cleaning',earliest_start_tick:4000}]);assert.equal(e.to_cleaning,4000);
});
test('the Q24 bypass removes exactly to_charging, connect, charge and unplug, and nothing else',()=>{
 const variants=[{},{fault:'mechanical'},{required_object_ids:['map2','sw2']},{upload_required:true},{cabin_required:false},{fault:'specialist_electrical'}];
 for(const o of variants)for(const level of ['basic','none','specialist']){
  const charged=Object.keys(edges({...o,initial_soc_pct:20},level)),gone=new Set(['to_charging','connect','charge','unplug']);
  for(const soc of [80,81,100]){const free=Object.keys(edges({...o,initial_soc_pct:soc},level));
   assert.deepEqual(charged.filter(t=>!free.includes(t)).sort(),[...gone].sort(),JSON.stringify([o,level,soc]));assert.ok(free.every(t=>charged.includes(t)));}
  assert.ok(Object.keys(edges({...o,initial_soc_pct:79},level)).includes('charge'));
 }
 const t90=base({initial_soc_pct:80});t90.requirements.energy.target_soc_pct=90;const p=plan(t90);
 assert.deepEqual(p.by.charge.charge,{initial_mj:172800000000n,target_mj:194400000000n,need_mj:21600000000n});assert.equal(p.v.terminalZone,'charging');assert.deepEqual(p.edges.inspection,['charge','software_postcheck']);
});
test('catalog bounds: at most one task per template, typed ids, rank order and at most 32 tasks (largest catalog 25)',()=>{
 assert.equal(MAX_TASKS_PER_VISIT,32);
 const big=plan(base({fault:'mechanical',required_object_ids:['map2','sw2'],upload_required:true},'none'));
 assert.equal(big.v.tasks.length,25);assert.equal(new Set(big.v.tasks.map(t=>t.template)).size,25);
 assert.equal(plan(base({fault:'mechanical',required_object_ids:['map2','sw2'],upload_required:true},'basic')).v.tasks.length,23);
 for(const t of big.v.tasks){assert.equal(t.id,`task:01:${t.template}`);assert.ok(t.id.length<=96);assert.equal(t.visit,'01');}
 assert.deepEqual(big.v.tasks.map(t=>t.rank),big.v.tasks.map(t=>TEMPLATE_RANK[t.template]).sort((a,b)=>a-b));
 const p=plan(base());for(const t of p.v.tasks)for(const q of t.prereqs)if(!q.startsWith('task:cache:'))assert.ok(TEMPLATE_RANK[short(q)]<t.rank,`${q} before ${t.id}`);
});
test('templates, ranks, classes, kinds, move destinations and attention follow C1.4 and the engineering note',()=>{
 const ORDER=['admit','intake','to_garage','diagnosis','repair','vendor_departure','vendor_outbound','vendor_service','vendor_return','vendor_reentry','to_cleaning','cabin','map_download','map_check','software_download','software_check','to_charging','connect','charge','map_activation','map_postcheck','software_activation','software_postcheck','upload','acknowledgment','inspection','unplug','egress'];
 assert.deepEqual([...TEMPLATES],ORDER);ORDER.forEach((t,i)=>assert.equal(TEMPLATE_RANK[t],i));
 const CLS={admit:'MV',intake:'IN',to_garage:'MV',diagnosis:'DG',repair:'RP',vendor_departure:'MV',vendor_outbound:'VT',vendor_service:'VS',vendor_return:'VT',vendor_reentry:'MV',to_cleaning:'MV',cabin:'CB',map_download:'DL',map_check:'CK',software_download:'DL',software_check:'CK',to_charging:'MV',connect:'CN',charge:'CH',map_activation:'AC',map_postcheck:'PC',software_activation:'AC',software_postcheck:'PC',upload:'UL',acknowledgment:'AK',inspection:'FI',unplug:'UP',egress:'MV'};
 assert.deepEqual({...TEMPLATE_CLASS},CLS);
 const KIND={admit:'move',intake:'attended',to_garage:'move',diagnosis:'attended',repair:'attended',vendor_departure:'move',vendor_outbound:'transit',vendor_service:'vendor',vendor_return:'transit',vendor_reentry:'move',to_cleaning:'move',cabin:'attended',map_download:'data',map_check:'timed',software_download:'data',software_check:'timed',to_charging:'move',connect:'attended',charge:'charge',map_activation:'timed',map_postcheck:'timed',software_activation:'timed',software_postcheck:'timed',upload:'data',acknowledgment:'zero',inspection:'attended',unplug:'attended',egress:'move'};
 const TO={admit:'waiting',to_garage:'garage',vendor_departure:'outside',vendor_reentry:'waiting',to_cleaning:'cleaning',to_charging:'charging',egress:'outside'};
 const ATT={intake:'intake',cabin:'cabin',diagnosis:'diagnosis',repair:'mechanical_repair',inspection:'inspection',connect:'connect',unplug:'unplug'};
 const TIMED={vendor_outbound:1800,vendor_service:7200,vendor_return:1800,map_check:60,software_check:60,map_activation:600,software_activation:600,map_postcheck:60,software_postcheck:60};
 const all=[...plan(base({fault:'mechanical',required_object_ids:['map2','sw2'],upload_required:true},'none')).v.tasks,...['to_garage','diagnosis','repair'].map(t=>plan(base({fault:'mechanical'},'basic')).by[t])];
 assert.equal(new Set(all.map(t=>t.template)).size,28);
 for(const t of all){
  assert.equal(t.cls,CLS[t.template]);assert.equal(t.kind,KIND[t.template],t.template);assert.equal(t.mandatory,true);
  assert.equal(t.move?.to??null,TO[t.template]??null,t.template);assert.equal(t.attention,TO[t.template]?'move':ATT[t.template]??null,t.template);
  assert.equal(t.timed,TIMED[t.template]??null,t.template);
 }
 assert.equal(all.find(t=>t.template==='to_charging').move.withPort,true);
 const sd=plan(base({required_object_ids:['map2','sw2']})).by;
 assert.deepEqual(sd.software_download.data,{object:'sw2',kind:'software',direction:'down',bytes:2000000000,endpoint:'software',cacheRoute:true});
 assert.deepEqual([sd.map_download.data.endpoint,sd.map_activation.endpoint,sd.software_activation.endpoint],['maps','maps','software']);
 assert.deepEqual(sd.charge.charge,{initial_mj:43200000000n,target_mj:172800000000n,need_mj:129600000000n});
});
test('D12-02 overlap matrix: transcribed table, symmetric, CH x AC and CH x PC disallowed both ways, one activation at a time',()=>{
 const T=['MV','IN','CB','DG','RP','CN','CH','UP','DL','UL','CK','AC','PC','AK','FI','VT','VS'];
 const ROWS=['XXXXXXXXXXXXXXXXX','XXXXXXXXXXXXXXXXX','XXXXXXXXAAAXAAXXX','XXXXXXXXAAAXAAXXX','XXXXXXXXAAAXAAXXX','XXXXXXXXAAAXAAXXX','XXXXXXXXAAAXXAXXX','XXXXXXXXAAAXAAXXX','XXAAAAAAAAAAAAAXX','XXAAAAAAAAAAAAAXX','XXAAAAAAAAAAAAAXX','XXXXXXXXAAAXAAXXX','XXAAAAXAAAAAAAAXX','XXAAAAAAAAAAAAAXX','XXXXXXXXAAAXAAXXX','XXXXXXXXXXXXXXXXX','XXXXXXXXXXXXXXXXX'];
 assert.deepEqual([...OVERLAP_CLASSES],T);assert.deepEqual(OVERLAP_MATRIX.map(r=>r.join('')),ROWS);
 for(const a of T)for(const b of T){assert.equal(overlapAllowed(a,b),overlapAllowed(b,a),`${a}x${b}`);assert.equal(overlapAllowed(a,b),ROWS[T.indexOf(a)][T.indexOf(b)]==='A');}
 for(const [a,b]of [['CH','AC'],['AC','CH'],['CH','PC'],['PC','CH'],['AC','AC'],['AC','MV'],['AC','CB'],['AC','FI'],['CH','CH'],['FI','FI'],['VT','DL'],['VS','UL']])assert.equal(overlapAllowed(a,b),false,`${a}x${b}`);
 for(const [a,b]of [['AC','UL'],['AC','DL'],['PC','UL'],['CH','DL'],['CH','AK'],['FI','UL'],['DL','DL']])assert.equal(overlapAllowed(a,b),true,`${a}x${b}`);
 for(const c of ['MV','IN','VT','VS'])assert.ok(T.every(b=>!overlapAllowed(c,b)),c);
});
test('repairRoute matches D1-09 for all nine fault and garage-level combinations, and the catalog follows it',()=>{
 const want={none:{none:'none',basic:'none',specialist:'none'},mechanical:{none:'vendor',basic:'onsite',specialist:'onsite'},specialist_electrical:{none:'vendor',basic:'vendor',specialist:'onsite'}};
 for(const [fault,levels]of Object.entries(want))for(const [level,route]of Object.entries(levels)){
  assert.equal(repairRoute(fault,level),route,`${fault}+${level}`);
  const p=plan(base({fault},level));assert.equal(p.v.route,route);
  assert.equal(!!p.by.diagnosis,route==='onsite');assert.equal(!!p.by.vendor_service,route==='vendor');
  if(route==='onsite')assert.equal(p.by.repair.attention,fault==='mechanical'?'mechanical_repair':'specialist_repair');
 }
});
test('reference effort is the C1.6 practiced_reference_v1 table, independent of proficiency and repair location',()=>{
 assert.deepEqual({...REFERENCE_EFFORT},{intake:120,cabin:600,diagnosis:1200,mechanical_repair:3600,specialist_repair:5400,inspection:300,connect:120,unplug:120,move:120,check:60,activation:600,postcheck:60,acknowledgment:0});
 const REF={admit:[['move',120]],intake:[['intake',120]],to_garage:[['move',120]],diagnosis:[['diagnosis',1200]],repair:[['mechanical_repair',3600]],vendor_departure:[['move',120]],vendor_outbound:[],vendor_service:[['diagnosis',1200],['mechanical_repair',3600]],vendor_return:[],vendor_reentry:[['move',120]],to_cleaning:[['move',120]],cabin:[['cabin',600]],map_download:[],map_check:[['check',60]],software_download:[],software_check:[['check',60]],to_charging:[['move',120]],connect:[['connect',120]],charge:[],map_activation:[['activation',600]],map_postcheck:[['postcheck',60]],software_activation:[['activation',600]],software_postcheck:[['postcheck',60]],upload:[],acknowledgment:[],inspection:[['inspection',300]],unplug:[['unplug',120]],egress:[['move',120]]};
 const refOf=(o,l,mut)=>{const s=base(o,l);mut?.(s);return Object.fromEntries(plan(s).v.tasks.map(t=>[t.template,t.reference.map(([c,n])=>[c,n])]));};
 const vendor=refOf({fault:'mechanical',required_object_ids:['map2','sw2'],upload_required:true},'none'),onsite=refOf({fault:'mechanical'},'basic');
 for(const [t,r]of Object.entries(vendor))assert.deepEqual(r,REF[t],t);for(const t of ['to_garage','diagnosis','repair'])assert.deepEqual(onsite[t],REF[t],t);
 const repairWork=r=>Object.values(r).flat().filter(([c])=>c==='diagnosis'||c.endsWith('_repair')).reduce((a,[,n])=>a+n,0);
 assert.equal(repairWork(vendor),4800);assert.equal(repairWork(onsite),4800);
 assert.equal(repairWork(refOf({fault:'specialist_electrical'},'basic')),6600);assert.equal(repairWork(refOf({fault:'specialist_electrical'},'specialist')),6600);
 const fast=refOf({},'basic',s=>{s.workers[0].qualifications=CLASSES.map(c=>row(c,'advanced'));});
 assert.deepEqual(fast,refOf({},'basic'),'a faster arm keeps the common reference unit');
 const cacheRef=compileScenario(valid(base())).cacheTasks.map(t=>t.reference);assert.deepEqual(cacheRef,[[],[]],'depot cache checks never impersonate a vehicle check');
});
