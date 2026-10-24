// Scenario and harness builders for the depot lab analytical cases (annex D1-13, C2.1, C4) and ledger readers that
// derive task intervals, ownership intervals, credits and decisions from records alone.
import {validateScenario} from '../../src/model/depot-lab/schema.js';
import {createDepotRun,stepDepotRun} from '../../src/model/depot-lab/engine.js';
import {SCENARIO_SCHEMA,MODEL_VERSION,PROFILE_VERSION,POLICY_ID,OVERLAP_PROFILE,REFERENCE_EFFORT_VERSION,VEHICLE_PROFILE,ATTENDED_CLASSES,proficiencyTicks} from '../../src/model/depot-lab/profiles.js';
export const MBPS=125000,GB=1000000000;
const clone=v=>JSON.parse(JSON.stringify(v));
// Qualification rows: `independent` lists classes at practiced level (may supervise); `extra` overrides single classes.
export function worker(id,independent=[],{availability=null,extra={},H=3600}={}){
 const qualifications=ATTENDED_CLASSES.slice().sort().map(c=>{
  const o=extra[c]??(independent.includes(c)?{level:'independent',proficiency:'practiced',may_supervise:true}:{level:'unqualified',proficiency:'practiced',may_supervise:false});
  return {task_class:c,level:o.level,proficiency:o.proficiency,may_supervise:o.may_supervise??false,solo_duration_ticks:proficiencyTicks(c,o.proficiency)};
 });
 return {id,qualifications,availability:availability??[{start_tick:0,end_tick:H}]};
}
export const LEAD=['intake','inspection'],MOVER=['move','connect','unplug'],ALL=[...ATTENDED_CLASSES];
export const position=(id,zone,enabled=true)=>({id,zone,enabled});
export const port=(id,position_id,kind='DC',rating_w=kind==='DC'?150000:11000,enabled=true)=>({id,position_id,kind,rating_w,enabled});
export const object=(id,kind,size_bytes)=>({id,kind,size_bytes,check_ticks:60,activation_ticks:600,postcheck_ticks:60});
export function visit(id,{arrival=0,due=null,soc=80,fault='none',cabin=false,installed=[],required=[],logs=0,uploadRequired=false,windows=[]}={}){
 return {id,arrival_tick:arrival,due_tick:due,initial_soc_pct:soc,fault,cabin_required:cabin,installed_object_ids:installed,required_object_ids:required,initial_log_bytes:logs,upload_required:uploadRequired,task_windows:windows};
}
const endpoint=(service_reachable='reachable',entitlement='valid')=>({service_reachable,entitlement});
// A complete public scenario; unspecified inputs are the stated analytical defaults (shifts cover H, endpoints valid).
export function scenario({H=3600,A=1,target=80,cabinWindow=0,positions,ports=[],lanes=1,supply=300000,background=0,garage='basic',workers,network={},services={},objects=[],visits,vendor={}}){
 const raw={
  schema:SCENARIO_SCHEMA,model_version:MODEL_VERSION,profile_version:PROFILE_VERSION,policy_id:POLICY_ID,overlap_profile:OVERLAP_PROFILE,reference_effort_version:REFERENCE_EFFORT_VERSION,
  horizon_tick:H,arrival_window_tick:A,requirements:{energy:{target_soc_pct:target}},task_windows:{cabin_earliest_start_tick:cabinWindow},vehicle_profile:clone(VEHICLE_PROFILE),
  site:{positions,ports,lane_count:lanes,supply_w:supply,background_w:background,garage_level:garage},workers,
  network:{generation:'wifi6',pool_bytes_per_tick:300*MBPS,client_bytes_per_tick:100*MBPS,wan_down_bytes_per_tick:200*MBPS,wan_up_bytes_per_tick:100*MBPS,cache_read_bytes_per_tick:1000*MBPS,covered_zones:['charging','cleaning','garage','waiting'],cache:{state:'off',capacity_bytes:0,initial_object_ids:[]},...network},
  services:{maps:endpoint(),software:endpoint(),uploads:endpoint(),...services},
  content_objects:objects,visits,
  vendor:{enabled:true,bay_count:1,worker_count:1,outbound_ticks:1800,service_ticks:7200,return_ticks:1800,traction_energy_mj:0,availability:[{start_tick:0,end_tick:H}],...vendor},
 };
 const v=validateScenario(raw,{origin:'import'});
 if(!v.ok)throw new Error('analytical scenario invalid: '+JSON.stringify(v.issues));
 return v.scenario;
}
export const ENDPOINT=endpoint;
export const FLAT_100KW={...clone(VEHICLE_PROFILE),dc_bands:[{from_soc_pct:0,until_soc_pct:100,cap_w:100000}]};
export function run(s,options={}){const R=createDepotRun(s,options);let r;do r=stepDepotRun(R,{maxTicks:options.maxTicks??Infinity});while(!r.done);return r;}
// ----- analytical cases -----
// A21: one vehicle, one DC port, one all-rounder worker, SOC 20 to target through the three-band profile.
export const a21=({target=80,soc=20,H=3600}={})=>scenario({H,target,positions:[position('C1','charging'),position('W1','waiting')],ports:[port('DC1','C1')],workers:[worker('X01',ALL,{H})],visits:[visit('V1',{due:H,soc})]});
// A22: both cars in waiting positions with intake done; flat 100 kW, site 100 kW; one mover and one lead.
export function a22(first='A'){
 const need={A:30,B:15},soc=id=>80-need[id===first?'A':'B']*100/60;
 const s=scenario({positions:[position('C1','charging'),position('W1','waiting'),position('W2','waiting')],ports:[port('DC1','C1')],supply:100000,workers:[worker('L01',LEAD),worker('M01',MOVER)],visits:[visit('A',{due:3600,soc:soc('A')}),visit('B',{due:3600,soc:soc('B')})]});
 return {s,harness:{vehicle_profile:FLAT_100KW,initial:{A:{position:'W1',completed:['admit','intake']},B:{position:'W2',completed:['admit','intake']}}}};
}
// A23: two ports, both cars connected at 0; A needs 30 kWh, B 15 kWh.
export function a23(){
 const s=scenario({positions:[position('C1','charging'),position('C2','charging')],ports:[port('DC1','C1'),port('DC2','C2')],supply:100000,workers:[worker('L01',LEAD),worker('M01',MOVER)],visits:[visit('A',{due:3600,soc:30}),visit('B',{due:3600,soc:55})]});
 const done=['admit','intake','to_charging','connect'];
 return {s,harness:{vehicle_profile:FLAT_100KW,initial:{A:{position:'C1',completed:done,connected_port:'DC1'},B:{position:'C2',completed:done,connected_port:'DC2'}}}};
}
// A24: two charge-capable positions, one or two ports; each car needs 30 kWh; H 4,800, due 1,980.
export function a24(ports=1){
 const s=scenario({H:4800,positions:[position('C1','charging'),position('C2','charging'),position('W1','waiting'),position('W2','waiting')],ports:ports===1?[port('DC1','C1')]:[port('DC1','C1'),port('DC2','C2')],supply:100000,workers:[worker('L01',LEAD,{H:4800}),worker('M01',MOVER,{H:4800})],visits:[visit('A',{due:1980,soc:30}),visit('B',{due:1980,soc:30})]});
 return {s,harness:{vehicle_profile:FLAT_100KW,initial:{A:{position:'W1',completed:['admit','intake']},B:{position:'W2',completed:['admit','intake']}}}};
}
// A35: one stationary intake-complete vehicle, one required 2-GB software object, cache off.
export function a35(generation='wifi6',services={}){
 const s=scenario({H:1800,services,positions:[position('W1','waiting')],workers:[worker('L01',LEAD,{H:1800}),worker('M01',MOVER,{H:1800})],network:{generation},objects:[object('sw-old','software',2*GB),object('sw-new','software',2*GB)],visits:[visit('V1',{due:1800,installed:['sw-old'],required:['sw-new']})]});
 return {s,harness:{initial:{V1:{position:'W1',completed:['admit','intake']}}}};
}
// A37: two arrivals at 0 with identical inbound moves; one mover, one lane, H 240.
export const a37=()=>scenario({H:240,positions:[position('P001','waiting'),position('P002','waiting')],workers:[worker('M01',['move'],{H:240})],visits:[visit('V001',{due:240}),visit('V002',{due:240})]});
// A38: bytes already received at 0; local check, activation and postcheck still required.
export function a38(services={}){
 const {s}=a35('wifi6',services);
 return {s,harness:{initial:{V1:{position:'W1',completed:['admit','intake'],content:{'sw-new':'object_complete'}}}}};
}
// A39: terminal cleaning position, cold cache of 1 GB or 2 GB, required 2-GB software object.
export function a39(capacity){
 const s=scenario({H:1800,positions:[position('K1','cleaning')],workers:[worker('L01',LEAD,{H:1800}),worker('M01',MOVER,{H:1800})],network:{cache:{state:'cold',capacity_bytes:capacity,initial_object_ids:[]}},objects:[object('sw-old','software',2*GB),object('sw-new','software',2*GB)],visits:[visit('V1',{due:1800,cabin:true,installed:['sw-old'],required:['sw-new']})]});
 return {s,harness:{initial:{V1:{position:'K1',completed:['admit','intake','to_cleaning','cabin']}}}};
}
// Anchor oracle (C2.1): tiny pool shared by 1-byte downloads; `variant` 'unrelated' adds a shift start at 1,
// 'change' opens a third download window at 1.
export function anchorCase(variant,H=20){
 const n=variant==='change'?3:2,ids=Array.from({length:n},(_,i)=>`V${i+1}`);
 const workers=[worker('L01',LEAD,{H})];
 if(variant==='unrelated')workers.push(worker('L02',LEAD,{H,availability:[{start_tick:1,end_tick:H}]}));
 const s=scenario({H,positions:ids.map(id=>position(`W${id}`,'waiting')),workers,network:{pool_bytes_per_tick:1,client_bytes_per_tick:1,wan_down_bytes_per_tick:1},objects:[object('o-new','software',1)],
  visits:ids.map((id,i)=>visit(id,{required:['o-new'],windows:i===2?[{task_template:'software_download',earliest_start_tick:1}]:[]}))});
 return {s,harness:{initial:Object.fromEntries(ids.map(id=>[id,{position:`W${id}`,completed:['admit','intake']}]))}};
}
// Two waiting vehicles with intake done and one AC plus one DC port; the AC id sorts first.
export function acDc(){
 const s=scenario({H:20000,positions:[position('C1','charging'),position('C2','charging'),position('W1','waiting'),position('W2','waiting')],ports:[port('AC01','C1','AC'),port('DC01','C2','DC')],workers:[worker('L01',LEAD,{H:20000}),worker('M01',MOVER,{H:20000})],visits:[visit('A',{soc:20}),visit('B',{soc:20})]});
 return {s,harness:{initial:{A:{position:'W1',completed:['admit','intake']},B:{position:'W2',completed:['admit','intake']}}}};
}
// One vehicle in a waiting position with intake done: optional or mandatory logs, optional cabin route and window.
export function uploadCase({logs=20*GB,uploadRequired=false,cabin=true,cabinWindow=100,H=3600,required=[],installed=[],objects=[],services={},availability=null}={}){
 const s=scenario({H,cabinWindow,services,objects,positions:[position('K1','cleaning'),position('W1','waiting')],workers:[worker('C01',['cabin'],{H}),worker('L01',LEAD,{H,availability}),worker('M01',MOVER,{H})],visits:[visit('V1',{cabin,logs,uploadRequired,required,installed})]});
 return {s,harness:{initial:{V1:{position:'W1',completed:['admit','intake']}}}};
}
// ----- ledger readers -----
export const T=(v,template)=>`task:${v}:${template}`;
export const of=(recs,kind)=>recs.filter(r=>r.kind===kind);
export const transitions=(recs,task)=>of(recs,'TASK_TRANSITION').filter(r=>r.payload.task_id===task).map(r=>[r.payload.transition,r.tick]);
export const startTick=(recs,task)=>transitions(recs,task).find(x=>x[0]==='START')?.[1]??null;
export const completeTick=(recs,task)=>transitions(recs,task).find(x=>x[0]==='COMPLETE')?.[1]??null;
export const interval=(recs,task)=>[startTick(recs,task),completeTick(recs,task)];
export const starts=(recs,template)=>of(recs,'TASK_TRANSITION').filter(r=>r.payload.transition==='START'&&r.payload.task_id.endsWith(':'+template));
// Ownership intervals [from, to, owner) of one unit from RESOURCE_DELTA records; harness-held units start at null and
// an unreleased unit ends at null.
export function ownership(recs,resource){
 const out=[];let open=null;
 for(const r of of(recs,'RESOURCE_DELTA'))for(const c of r.payload.changes){
  if(c.resource_id!==resource)continue;
  if(c.change==='RELEASE'){out.push([open?open.from:null,r.tick,open?open.owner:c.owner_task_id]);open=null;}else if(!open)open={from:r.tick,owner:c.owner_task_id};
 }
 if(open)out.push([open.from,null,open.owner]);
 return out;
}
export const changesOf=(recs,resource)=>of(recs,'RESOURCE_DELTA').flatMap(r=>r.payload.changes.filter(c=>c.resource_id===resource).map(c=>[c.change,r.tick,c.owner_task_id]));
export const progressOf=(recs,flow)=>of(recs,'PROGRESS').flatMap(r=>r.payload.changes.filter(c=>c.flow_id===flow).map(c=>({...c,phase:r.phase,tick:r.tick})));
export const allocationsOf=(recs,flow)=>of(recs,'ALLOCATION_DELTA').flatMap(r=>r.payload.changes.filter(c=>c.flow_id===flow).map(c=>({...c,tick:r.tick})));
export const decisionsOf=(recs,task)=>of(recs,'POLICY_DECISION').filter(r=>r.payload.task_id===task).map(r=>({...r.payload,tick:r.tick}));
export const contentOf=(recs,pred=()=>true)=>of(recs,'CONTENT_TRANSITION').map(r=>({...r.payload,tick:r.tick})).filter(pred);
export const horizon=recs=>{const h=of(recs,'HORIZON'),cat=k=>h.flatMap(r=>r.payload[k]);return {arrived:cat('arrived_visit_ids'),released:cat('released_visit_ids'),unreleased:cat('unreleased_visit_ids')};};
export const busySeconds=(recs,resource)=>ownership(recs,resource).reduce((n,[a,b])=>n+(b-(a??0)),0);
export const releaseTick=(recs,v)=>completeTick(recs,T(v,'egress'));
