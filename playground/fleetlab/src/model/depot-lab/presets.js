// The owner-decided default register (D12-01) and the fourteen named configurations (D12-04). Inputs only:
// no observed result, outcome or score is stored here. Every value is a fictional teaching assumption.
import {SCENARIO_SCHEMA,MODEL_VERSION,PROFILE_VERSION,POLICY_ID,OVERLAP_PROFILE,REFERENCE_EFFORT_VERSION,VEHICLE_PROFILE,roleQualifications} from './profiles.js';
export const DEFAULT_H=43200,MBPS=125000,GB=1000000000;
const clone=v=>JSON.parse(JSON.stringify(v));
const pad=(n,w)=>String(n).padStart(w,'0');
export function positionInventory(spec,start=1){let n=start-1;const out=[];for(const [zone,count]of spec)for(let i=0;i<count;i++)out.push({id:`P${pad(++n,3)}`,zone,enabled:true});return out;}
export const worker=(id,role,overrides={},H=DEFAULT_H)=>({id,qualifications:roleQualifications(role,overrides),availability:[{start_tick:0,end_tick:H}]});
export const port=(id,position_id,kind)=>({id,position_id,kind,rating_w:kind==='DC'?150000:11000,enabled:true});
export const CONTENT_OBJECTS=Object.freeze([
 {id:'map-v1',kind:'map',size_bytes:GB/2,check_ticks:60,activation_ticks:600,postcheck_ticks:60},
 {id:'map-v2',kind:'map',size_bytes:GB/2,check_ticks:60,activation_ticks:600,postcheck_ticks:60},
 {id:'sw-v1',kind:'software',size_bytes:2*GB,check_ticks:60,activation_ticks:600,postcheck_ticks:60},
 {id:'sw-v2',kind:'software',size_bytes:2*GB,check_ticks:60,activation_ticks:600,postcheck_ticks:60},
]);
export function visit(id,arrival,{due=arrival+21600,soc=20,fault='none',cabin=true,required=['map-v1','sw-v2'],logs=5*GB,uploadRequired=false,windows=[]}={}){
 return {id,arrival_tick:arrival,due_tick:due,initial_soc_pct:soc,fault,cabin_required:cabin,installed_object_ids:['map-v1','sw-v1'],required_object_ids:required,initial_log_bytes:logs,upload_required:uploadRequired,task_windows:windows};
}
const endpoint=()=>({service_reachable:'reachable',entitlement:'valid'});
// D12-01 default register: 24 visits every 900 s over a 6-h arrival window, 6-h drain, target SOC 80%.
export function defaultScenario(){
 return {
  schema:SCENARIO_SCHEMA,model_version:MODEL_VERSION,profile_version:PROFILE_VERSION,policy_id:POLICY_ID,overlap_profile:OVERLAP_PROFILE,reference_effort_version:REFERENCE_EFFORT_VERSION,
  horizon_tick:DEFAULT_H,arrival_window_tick:21600,
  requirements:{energy:{target_soc_pct:80}},task_windows:{cabin_earliest_start_tick:0},
  vehicle_profile:clone(VEHICLE_PROFILE),
  site:{positions:positionInventory([['waiting',17],['charging',4],['cleaning',2],['garage',1]]),ports:[port('AC01','P020','AC'),port('AC02','P021','AC'),port('DC01','P018','DC'),port('DC02','P019','DC')],lane_count:1,supply_w:300000,background_w:0,garage_level:'basic'},
  workers:[worker('C01','cleaner'),worker('L01','lead'),worker('M01','mover'),worker('T01','technician')],
  network:{generation:'wifi6',pool_bytes_per_tick:300*MBPS,client_bytes_per_tick:100*MBPS,wan_down_bytes_per_tick:200*MBPS,wan_up_bytes_per_tick:100*MBPS,cache_read_bytes_per_tick:1000*MBPS,covered_zones:['charging','cleaning','garage','waiting'],cache:{state:'cold',capacity_bytes:20*GB,initial_object_ids:[]}},
  services:{maps:endpoint(),software:endpoint(),uploads:endpoint()},
  content_objects:clone(CONTENT_OBJECTS),
  visits:Array.from({length:24},(_,i)=>visit(pad(i+1,2),900*i,{fault:[8,16,24].includes(i+1)?'mechanical':'none'})),
  vendor:{enabled:true,bay_count:1,worker_count:1,outbound_ticks:1800,service_ticks:7200,return_ticks:1800,traction_energy_mj:0,availability:[{start_tick:0,end_tick:DEFAULT_H}]},
 };
}
const bunched=(s,{soc=80,uploadRequired=true,faults=[8,16,24]}={})=>{s.arrival_window_tick=1;s.visits=s.visits.map((v,i)=>visit(v.id,0,{due:21600,soc,fault:faults.includes(i+1)?'mechanical':'none',uploadRequired}));};
const dataPressure=(s,{down,up,faults})=>{bunched(s,{faults});s.network.cache={state:'off',capacity_bytes:0,initial_object_ids:[]};s.network.wan_down_bytes_per_tick=down*MBPS;s.network.wan_up_bytes_per_tick=up*MBPS;};
const powerPressure=(s,supplyKw)=>{s.arrival_window_tick=1440;s.visits=s.visits.map((v,i)=>visit(v.id,60*i,{due:21600,fault:v.fault}));s.site.supply_w=supplyKw*1000;s.site.ports=[port('DC01','P018','DC'),port('DC02','P019','DC')];};
const trainingTape=s=>{bunched(s,{uploadRequired:false,faults:[]});s.site.positions=positionInventory([['waiting',15],['charging',4],['cleaning',4],['garage',1]]);s.site.ports=[port('AC01','P018','AC'),port('AC02','P019','AC'),port('DC01','P016','DC'),port('DC02','P017','DC')];};
const withWorker=(s,w)=>{s.workers=[...s.workers,w].sort((a,b)=>a.id<b.id?-1:1);};
// Each preset: id, title, declared regime (configuration reasoning only), baseline and optional candidate.
const DEFINITIONS=[
 ['B','Power-slack baseline','Port-bound during arrivals; power slack; mover near saturation. The candidate adds one DC port and rezones one waiting position to charging: 1 intervention, 2 authoritative fields.',s=>s,s=>{s.site.positions.find(p=>p.id==='P017').zone='charging';s.site.ports.push(port('DC03','P017','DC'));}],
 ['P','Power-pressure','Port holding plus DC taper under a 100 kW site limit; two of four charging positions have no port. The candidate adds one DC port on an existing position. The sign of the change remains open.',s=>powerPressure(s,100),s=>{s.site.ports.push(port('DC03','P020','DC'));}],
 ['PS','Power-pressure / supply-relaxation companion','Same tape and port treatment as Power-pressure, with a 300 kW site in both setups. Holding, worker and deadline limits remain.',s=>powerPressure(s,300),s=>{s.site.ports.push(port('DC03','P020','DC'));}],
 ['D','Data-pressure / WAN-limited identity','All 24 arrive together at 80% SOC with required 5 GB uploads and no cache; WAN down/up 200/50 Mbps. Doubling the radio pool cannot change useful capacity while total WAN is below either pool.',s=>dataPressure(s,{down:200,up:50,faults:[8,16,24]}),s=>{s.network.pool_bytes_per_tick=600*MBPS;}],
 ['DR','Data-radio-pressure candidate','The Data-pressure tape with WAN 1,000/1,000 Mbps in both setups; the radio pool doubles from 300 to 600 Mbps.',s=>dataPressure(s,{down:1000,up:1000,faults:[8,16,24]}),s=>{s.network.pool_bytes_per_tick=600*MBPS;}],
 ['M','Required-map-refresh variant','Every visit also needs the new 0.5 GB map before software activation. The candidate makes the map service unreachable, so required content cannot complete while other work may progress.',s=>{s.visits=s.visits.map(v=>({...v,required_object_ids:['map-v2','sw-v2']}));},s=>{s.services.maps.service_reachable='unreachable';}],
 ['T2','Two-bay/one-technician','Two garage positions and five mechanical visits (01, 02, 08, 16, 24; 01 and 02 arrive together). The candidate adds a second identical technician.',s=>{s.site.positions=positionInventory([['waiting',16],['charging',4],['cleaning',2],['garage',2]]);s.site.ports=[port('AC01','P019','AC'),port('AC02','P020','AC'),port('DC01','P017','DC'),port('DC02','P018','DC')];s.visits=s.visits.map(v=>[1,2,8,16,24].includes(Number(v.id))?visit(v.id,v.id==='02'?0:v.arrival_tick,{fault:'mechanical'}):v);},s=>withWorker(s,worker('T02','technician'))],
 ['S200','Scale-stress 200 (port-limited by design)','200 visits every 60 s with 12 DC ports. 168 is the loose connector ceiling and 156 the physical-release ceiling; neither is an outcome. Baseline only.',s=>{
  s.arrival_window_tick=12000;s.visits=Array.from({length:200},(_,i)=>visit(pad(i+1,3),60*i,{fault:(i+1)%8===0?'mechanical':'none'}));
  s.site.positions=positionInventory([['waiting',180],['charging',12],['cleaning',4],['garage',4]]);s.site.ports=Array.from({length:12},(_,i)=>port(`DC${pad(i+1,2)}`,`P${pad(181+i,3)}`,'DC'));
  s.site.lane_count=3;s.site.supply_w=1000000;
  s.workers=[...[1,2,3,4].map(i=>worker(`C${pad(i,2)}`,'cleaner')),...[1,2,3,4].map(i=>worker(`L${pad(i,2)}`,'lead')),...[1,2,3,4,5,6].map(i=>worker(`M${pad(i,2)}`,'mover')),...[1,2,3,4].map(i=>worker(`T${pad(i,2)}`,'technician'))];
  s.network.wan_down_bytes_per_tick=1000*MBPS;s.network.wan_up_bytes_per_tick=500*MBPS;s.network.pool_bytes_per_tick=2000*MBPS;
 },null],
 ['W','Spaces / bunched waiting-flex','All 24 arrive together at 80% SOC with required uploads, no repairs, no cache and a pool fixed at 300 Mbps; cabin work may not start before 3,600 s in both setups. The candidate adds seven waiting positions (24 to 31).',s=>{dataPressure(s,{down:200,up:50,faults:[]});s.task_windows.cabin_earliest_start_tick=3600;},s=>{s.site.positions.push(...positionInventory([['waiting',7]],25));}],
 ['G','Garage / basic-to-none','Mechanical visits 08, 16 and 24 with the finite vendor path. The candidate removes on-site repair capability; the garage position stays installed.',s=>s,s=>{s.site.garage_level='none';}],
 ['GN','Garage / specialist structural null','No specialist fault and no specialist-qualified worker exist, so basic to specialist makes zero additional tasks eligible. Not a positive garage case.',s=>s,s=>{s.site.garage_level='specialist';}],
 ['TP','Training / cabin proficiency','All 24 arrive together at 80% SOC with four cleaning positions. The candidate makes the cleaner advanced at cabin work (600 s to 480 s).',trainingTape,s=>{s.workers=s.workers.map(w=>w.id==='C01'?worker('C01','cleaner',{cabin:{level:'independent',proficiency:'advanced',may_supervise:true}}):w);}],
 ['TN','Training / supervised structural null','The Training tape with a second, advanced cleaner who is unqualified in the baseline and supervised only in the candidate. A supervised pair uses 2 people for 1 task and adds no simultaneous capacity.',s=>{trainingTape(s);withWorker(s,worker('C02','cleaner',{cabin:{level:'unqualified',proficiency:'advanced'}}));},s=>{s.workers=s.workers.map(w=>w.id==='C02'?worker('C02','cleaner',{cabin:{level:'supervised_only',proficiency:'advanced'}}):w);}],
 ['ST','Staffing / single-bay counterexample A07','A second identical technician with still one garage bay: one bay permits one attended mechanical task, so no repair parallelism is created.',s=>s,s=>withWorker(s,worker('T02','technician'))],
];
export const PRESET_IDS=Object.freeze(DEFINITIONS.map(d=>d[0]));
export function preset(id){
 const d=DEFINITIONS.find(x=>x[0]===id);if(!d)throw new RangeError(`Unknown preset ${id}`);
 const [,title,regime,shape,treat]=d;
 const baseline=defaultScenario();shape(baseline);
 let candidate=null;if(treat){candidate=clone(baseline);treat(candidate);}
 return {id,title,regime,baseline,candidate};
}
export const presetCatalog=()=>DEFINITIONS.map(([id,title,regime,,treat])=>({id,title,regime,pair:!!treat}));
