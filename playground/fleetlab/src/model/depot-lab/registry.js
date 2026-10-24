// Registered depot lab terms (annex D1-11, C1.6): labels, definitions, formulas, provenance and evidence for every
// control, assumption, state, metric, reason and trust status. Text only; nothing is computed here.
import {REFERENCE_EFFORT,METRIC_VERSION} from './profiles.js';
import {FLOW_TRUST} from '../depot-flow-contract.js';
const F=Object.freeze;
const deep=v=>{if(v&&typeof v==='object'&&!Object.isFrozen(v)){F(v);for(const k of Object.keys(v))deep(v[k]);}return v;};
export const REGISTRY_VERSION='depot_registry_v1';
export const CATEGORIES=F(['OBSERVED','COMPUTED','GATE_DECISION','ASSUMPTION','NOT_AVAILABLE','AUTHENTICITY','RESIDUAL_RISK']);
export const AVAILABILITY_REASONS=F(['missing','not_modeled','incompatible','invalid','not_applicable']);
export const TERM_TYPES=F(['integer','rational','boolean','enum','state','collection','object','digest','none']);
export const PROVENANCE_ORIGINS=F(['default','user','imported','profile','contract','configuration','verified_run','verifier','session']);
export const TERM_FIELDS=F(['term_id','version','label_plain','label_technical','definition','prohibited_conflations','type','unit','exact_representation','display_rule','object','time','population','denominator','formula','source','availability_reason','evidence','companions','provenance','category','pointer','treatment','direction','value']);
// Annex D1-11, verbatim. The first string carries the only dash this module may contain.
export const HONESTY=F([
 'Simplified simulations for learning \u2014 not evidence about real-world safety. Nothing here approves deploying a vehicle or policy.',
 'NOT_EVIDENCE \u00b7 simulation only \u00b7 decision authority NONE',
 'An independent educational project by Bo-Huei Lin. Not affiliated with or endorsed by Waymo, Zoox, or their partners.',
]);
// An input carries its runtime origin (default, user or imported); a profile value rejects edits.
const pv=(kind,...origin)=>({kind,origin}),A='ASSUMPTION',C='COMPUTED';
const P={in:pv(A,'default','user','imported'),fixed:pv(A,'profile'),rule:pv(A,'contract'),cfg:pv(C,'configuration'),run:pv(C,'verified_run'),ver:pv(C,'verifier'),ses:pv(C,'session'),na:pv('NOT_AVAILABLE','contract')};
const REP={integer:'safe integer',rational:'reduced "p/q" string',boolean:'boolean',enum:'enum string',state:'enum string',collection:'JSON array sorted by ID',object:'JSON object',digest:'64 lowercase hex characters',none:'no value'};
const LIST='every member listed; exact values on inspection',WORD='plain label in Overview; exact value in Technical';
const SHOW={rational:'formatted; exact fraction on inspection',enum:WORD,state:WORD,collection:LIST,object:LIST,digest:'short prefix; full digest on inspection',none:'Not available: not modeled in this version'};
// Short override keys for the row tables below.
const KEY={t:'type',u:'unit',p:'pointer',c:'companions',n:'prohibited_conflations',s:'source',e:'evidence',o:'object',f:'formula',d:'display_rule',tm:'time',pop:'population',den:'denominator',dir:'direction',v:'value',pr:'provenance',cat:'category',tr:'treatment',ar:'availability_reason',ver:'version'};
const ex=o=>Object.fromEntries(Object.entries(o).map(([k,v])=>[KEY[k]??k,v]));
const rows=[];
// g(defaults, prefix, rows), row = [id suffix, plain label, definition, overrides]. `valued`: the suffix is the wire value;
// `techValue`: that value is the Technical label (else term_id); `pp`: pointer prefix ('' maps a.b to /a/b).
const g=(d,prefix,list)=>{d=ex(d);for(const [id,label_plain,definition,x={}] of list){
 const o=ex(x),r={...d,value:d.valued?id:null,...o,term_id:prefix+id,label_plain,definition};
 if(d.pp!=null&&!('pointer' in o))r.pointer=d.pp===''?'/'+r.term_id.replace('.','/'):d.pp+r.term_id.slice(r.term_id.indexOf('.')+1);
 r.label_technical=o.label_technical??(d.techValue?r.value:r.term_id);rows.push(r);}};
const IN={pr:P.in,cat:A},FIX={pr:P.fixed,cat:A,d:'fixed in this version; edits are rejected'},RUN={pr:P.run,cat:C};
const VISIT={o:'visit',tm:'at H',pop:'all arrivals (a_i < H)'};
const TURN=['return to service','ride or mission eligibility','road readiness','deployment permission'];
const NOWIN=['a scalar score or winner','lexicographic priority'],PEOPLE="a real person's productivity";
const SEC='exact seconds; a positive value under 60 s shows "< 1 min", never "0 min"',MBPS='Mbps = bytes per tick / 125,000',KWH='kWh = mJ / 3,600,000,000, exact; never compare rounded values',GB='GB = bytes / 1,000,000,000, exact';
const PV='projection.visits[].',PR='projection.resources.';
const BPT={t:'integer',u:'bytes/tick',d:MBPS,o:'network'};
// C1.2 authoritative treatment paths in table order: seven-family fields, then owner-approved diagnostic fields.
const sv={maps:'map',software:'software',uploads:'upload'};
g({...IN,t:'collection',d:'every leaf change from baseline, with exact old and new values',o:'site',s:'C1.2',tr:'family',pp:''},'',[
 ['site.positions','Work positions by zone','Each position with its zone and enabled state; 1 to 200. Zones are authoritative; the total is derived.',{c:['site.position_total'],n:['fleet size','physical layout'],s:'C1.2; D1-08; P08'}],
 ['site.ports','Charging ports','AC or DC ports with a rating, enabled state and one reachable charging position; at most 20. A port adds no position.',{c:['site.supply_w','vehicle.dc_bands'],s:'C1.2; D1-08; P01'}],
 ['site.garage_level','On-site repair capability','none, basic or specialist: repair capability only, with no added staff, faults or positions.',{t:'enum',c:['visit.route'],s:'C1.2; D1-09; P07'}],
 ...Object.keys(sv).map(s=>['services.'+s,`Simulated ${sv[s]} service access`,`Reachable or not, and permission valid, denied or unknown; static. No real service is contacted.`,{t:'object',o:'service endpoint',c:['service.reachable','service.entitlement'],n:['an outage timeline'],s:'C1.2; D1-10; N08, N12'}]),
 ['network.generation','Wi-Fi generation label','wifi6 or wifi7, a label only: it changes no assumed capacity.',{t:'enum',o:'network',c:['deferred.wifi_6e'],n:['usable 6 GHz spectrum or permission','measured throughput'],s:'C1.2; D1-10; N04, N06'}],
 ['network.pool_bytes_per_tick','Shared radio capacity (assumed)','Useful bytes per second shared by all transfers in one radio domain; not a link rate.',{...BPT,s:'C1.2; N03'}],
 ['network.client_bytes_per_tick','Per-vehicle radio cap (assumed)','Most useful bytes per second one vehicle moves over the radio.',{...BPT,s:'C1.2; N05'}],
 ['workers.roster','Workers, qualifications and shifts','Per worker: one row per attended task class plus availability; additions copy a role template.',{p:'/workers',o:'workforce',c:['worker.supervised_pair'],n:[PEOPLE],s:'C1.2; D1-09; P05'}],
 ['site.supply_w','Site charging supply','Grid power for charging; usable capacity is supply minus background load.',{t:'integer',u:'W',tr:'diagnostic',c:['charge.peak_site_draw_w'],s:'C1.2; P02'}],
 ['network.wan_down_bytes_per_tick','Internet link down','Useful bytes per second into the depot, shared by downloads and cache fetches.',{...BPT,tr:'diagnostic'}],
 ['network.wan_up_bytes_per_tick','Internet link up','Useful bytes per second to the upload service.',{...BPT,tr:'diagnostic'}],
 ['site.lane_count','Movement lanes','0 to 20; each move holds a lane and a mover. Zero is a deliberate unavailable resource.',{t:'integer',u:'lanes',tr:'diagnostic'}],
 ['network.cache','Depot content cache','off, cold or warm; one whole-object fetch per object, served after its check, never evicted.',{t:'object',o:'network',tr:'diagnostic',s:'C1.2; D1-10; N10'}],
]);
// Shared requirements and tape, identical in both setups.
g(IN,'requirement.energy.',[['target_soc_pct','Target battery SOC for depot release (default 80%)','Integer percent of the fixed 60 kWh pack each visit must hold before final inspection, shared by both setups. A modeled release at 80% means this depot visit is complete, not that a fleet mission was assigned or approved.',{n:['customer dispatch authorization','passenger ride or mission eligibility','road-safety readiness'],t:'integer',u:'%',d:'shortcuts 60, 80, 90, 100 and integer input 20 to 100 at every width',o:'scenario',pop:'every visit in both setups',f:'20 to 100, default 80; target_mj = target_soc_pct x 2,160,000,000',s:'D1-11; C1.6; D1-03',e:['projection.target_soc_pct'],c:['visit.initial_soc_pct','vehicle.pack_capacity_mj','energy.required_charge_mj','charge.acceptance_band','requirement.shared_across_arms'],p:'/requirements/energy/target_soc_pct'}]]);
g({...IN,o:'scenario',t:'integer',u:'tick',s:'C1.3; D12-01'},'',[
 ['scenario.horizon_tick','End of run (H)','Last tick; work unfinished at H is reported, never dropped.',{p:'/horizon_tick',e:['projection.horizon_tick']}],
 ['scenario.arrival_window_tick','Arrival window (A)','Every arrival falls in [0, A), A at most H.',{p:'/arrival_window_tick',e:['projection.arrival_window_tick']}],
 ['task_windows.cabin_earliest_start_tick','Earliest cabin start','Shared earliest start for cabin work and its cleaning move; not a scheduler choice.',{p:'/task_windows/cabin_earliest_start_tick',s:'D1-04'}],
]);
g({...IN,o:'visit',s:'C1.3; D12-01',pp:'/visits/*/'},'visit.',[
 ['arrival_tick','Arrival time','When the visit joins the outside queue; one visit per vehicle.',{t:'integer',u:'tick',e:['ARRIVAL']}],
 ['due_tick','Release-by time','Optional tick for an on-time release; null means none. It may fall after H.',{t:'integer',u:'tick',c:['visit.on_time']}],
 ['initial_soc_pct','Battery SOC at arrival','At or above the target there is no charging work.',{t:'integer',u:'%'}],
 ['fault','Known repair need','none, mechanical or specialist_electrical; with the garage level it fixes the route.',{t:'enum',s:'D1-09; P06'}],
 ['cabin_required','Cabin reset required','Whether a cabin reset in a cleaning position is needed.',{t:'boolean',s:'D12-01; P11'}],
 ['installed_object_ids','Content already installed','Valid objects at arrival; old copies stay through H.',{t:'collection'}],
 ['required_object_ids','Content required','Must be locally complete before inspection; an installed match is satisfied.',{t:'collection',s:'D1-10; N01'}],
 ['initial_log_bytes','Log backlog at arrival','Log bytes held in storage until acknowledged and reclaimed.',{t:'integer',u:'bytes',d:GB}],
 ['upload_required','Log upload required','True: upload and acknowledgment gate inspection. False: optional, never holding release.',{t:'boolean'}],
 ['task_windows','Per-visit earliest starts','Earliest start tick per task template; absent means 0.',{t:'collection'}],
]);
g({...IN,s:'C1.3; D12-01',pp:''},'',[
 ['site.background_w','Background site load','Constant non-charging load, at most supply.',{t:'integer',u:'W',o:'site'}],
 ['network.cache_read_bytes_per_tick','Cache read capacity','Useful bytes per second the cache serves in total.',BPT],
 ['network.covered_zones','Zones with data coverage','Zones where a stationary vehicle can transfer data; none off site.',{t:'collection',o:'network'}],
 ['content.objects','Content objects','Up to four map or software objects of fixed size.',{t:'collection',o:'content object',p:'/content_objects'}],
 ['vendor.enabled','Vendor repair path','When disabled, routed visits wait.',{t:'boolean',o:'vendor'}],
 ['vendor.bay_count','Vendor bay','0 or 1, outside depot denominators.',{t:'integer',u:'bays',o:'vendor'}],
 ['vendor.worker_count','Vendor worker','0 or 1, outside depot denominators.',{t:'integer',u:'workers',o:'vendor'}],
 ['vendor.times','Vendor travel and service times','Fixed outbound, service (with diagnosis) and return seconds; no depot position held while away.',{t:'object',u:'s',o:'vendor',p:'/vendor'}],
 ['vendor.availability','Vendor availability','A service must fit inside one interval.',{t:'collection',o:'vendor'}],
]);
g({...IN,o:'worker',s:'D1-09; D12-01',pp:'/workers/*/qualifications/*/'},'worker.',[
 ['qualification','Task qualification','Per task class: unqualified, supervised_only or independent; simulator roles, not credentials.',{t:'enum',p:'/workers/*/qualifications/*/level',s:'D1-09; P07'}],
 ['proficiency','Task proficiency','developing, practiced or advanced; selects the solo duration, such as cabin 900, 600 or 480 s.',{t:'enum',n:[PEOPLE]}],
 ['may_supervise','May supervise','An independent worker allowed to supervise that class.',{t:'boolean'}],
 ['solo_duration_ticks','Solo task duration','Equals the proficiency table value; moves take 120 s.',{t:'integer',u:'s'}],
 ['availability','Shift availability','Nonoverlapping intervals in [0, H); no task crosses a break; no overtime.',{t:'collection',p:'/workers/*/availability'}],
]);
g({...FIX,o:'scenario',s:'C1.4'},'',[
 ['profile.policy','Fixed scheduling rule','fcfs_eligible_fair_resources_v1: earliest ready tick, task rank, visit, task ID; lowest eligible IDs; DC before AC, never declining feasible AC; weight-1 max-min sharing.',{t:'enum',p:'/policy_id',c:['deferred.policy_comparison'],n:['an optimal schedule'],s:'C1.4; D1-05'}],
 ['profile.information','What the scheduler can see','Current truth only; no future arrival, fault or report.',{t:'object',s:'D1-05'}],
 ['profile.overlap','Same-vehicle overlap rules','serial_activation_connected_inspection_v1: activation after charging, connected inspection. Not workplace-safety guidance.',{t:'enum',p:'/overlap_profile',n:['workplace safety guidance'],s:'D12-02'}],
 ['profile.ownership','Position holding during moves','A move holds its origin until done and reserves its destination at start.',{t:'enum',o:'position',s:'D1-08'}],
 ['profile.numeric_rules','Exact time and units','1-s ticks, integer mJ and bytes, exact rates, floor credit per interval with no residual.',{t:'object',s:'D1-04'}],
 ['profile.reference_effort','Common reference work',`practiced_reference_v1, both setups, seconds: ${Object.entries(REFERENCE_EFFORT).map(([k,v])=>k.replace('_',' ')+' '+v).join(', ')}.`,{t:'object',u:'s',p:'/reference_effort_version',n:["either setup's own service time"],s:'C1.6'}],
 ['profile.versions','Model and contract versions','fleetlab.depot.scenario.v1, depot_model_v1, depot_contract_v1.',{t:'enum',p:'/model_version',s:'C1.3'}],
 ['content.lifecycle_ticks','Check and activation times','Unattended check 60 s, activation 600 s, postcheck 60 s; cache check 60 s.',{t:'integer',u:'s',o:'content object',p:'/content_objects/*/activation_ticks',s:'C1.3'}],
 ['vendor.traction_energy_mj','Vendor transport energy','Fixed at 0 mJ.',{t:'integer',u:'mJ',o:'vendor',p:'/vendor/traction_energy_mj',s:'D1-09'}],
 ['worker.role_template','Role template','cleaner, technician, mover or lead: listed classes independent and practiced, others unqualified.',{t:'enum',o:'worker',s:'D12-01'}],
 ['worker.supervised_pair','Supervised pair','Longer solo duration, two tokens. A supervised pair uses 2 people for 1 task and adds no simultaneous capacity.',{t:'object',o:'worker',pr:P.rule,n:['added task capacity'],s:'D1-09'}],
 ['requirement.shared_across_arms','Shared requirement notice','Target SOC, tape, windows and non-treatment inputs match in both setups; a one-arm change is refused.',{t:'boolean',o:'pair',pr:P.rule,c:['comparison.compatibility'],s:'D1-03'}],
]);
g({...FIX,o:'vehicle',s:'D1-04',pp:'/vehicle_profile/'},'vehicle.',[
 ['profile','Fixed vehicle profile','One fictional vehicle type: 60 kWh, 50 GB, 11 kW AC, three DC bands, efficiency 1.',{t:'object',p:'/vehicle_profile',s:'C1.3; P03'}],
 ['pack_capacity_mj','Battery pack (fixed 60 kWh)','216,000,000,000 mJ; 1% SOC is exactly 2,160,000,000 mJ.',{t:'integer',u:'mJ',d:KWH,p:'/vehicle_profile/capacity_mj'}],
 ['dc_bands','DC acceptance bands','100 kW below 60% SOC, 60 kW to 80%, 30 kW to 100%; an exact edge takes the higher band.',{t:'collection',u:'W',s:'D1-04; P03'}],
 ['ac_cap_w','AC acceptance cap','11 kW at every SOC.',{t:'integer',u:'W'}],
 ['storage_capacity_bytes','Vehicle storage (fixed 50 GB)','Per-vehicle stock for logs, content and reservations; never pooled. No depot buffer.',{t:'integer',u:'bytes',d:GB,s:'D1-10'}],
 ['efficiency_thermal','Efficiency and thermal factor','Both 1/1: meter draw equals battery credit.',{t:'rational',p:'/vehicle_profile/efficiency'}],
]);
// Deferred depth: Not available, never an inert control.
g({t:'none',o:'scenario',s:'D1-01',pr:P.na,cat:'NOT_AVAILABLE',ar:'not_modeled'},'deferred.',[
 ['wifi_6e','Wi-Fi 6E','Not modeled; a 6E or 7 label establishes no usable 6 GHz spectrum or permission.',{s:'D1-10; N06'}],
 ['mlo','Multi-link operation','Not modeled; gains depend on compatible AP and client modes.',{s:'D1-01; N05'}],
 ['ap_count','Access point count','Not modeled: one radio domain, one assumed pool.'],
 ['status_reporting','Operator status reports','Report content and age are Not available; no status control exists.'],
 ['dynamic_faults','Faults and outages during the run','No injected faults, outages or recovery; settings are static.'],
 ['retries','Start failure and retry','No start or check failure, retry or rollback; a fabricated completion still fails verification.'],
 ['supply_variation','Varying supply and battery physics','No time-varying supply, overload or thermal physics.'],
 ['geometry','Geometry and automated handling','No distances, layout or automated moves.'],
 ['work_depth','Parts, handover and rework','No parts, revealed faults, handover, preemption, random durations or rework.'],
 ['storage_depth','Eviction, streaming and storage lessons','No eviction, streaming or storage-pressure experiments.'],
 ['mission_eligibility','Ride or mission eligibility','Not modeled; release ends the modeled depot visit.',{n:['released means available for a ride'],s:'D1-08'}],
 ['exit_adapter','Released on site and exit time','Reserved for a future fleet adapter.',{s:'D1-08'}],
 ['policy_comparison','Policy comparison','One fixed rule; comparison and search are later stages.'],
 ['cost','Cost','No price, labor cost or other money value.'],
 ['statistics','Distributions and replicates','No percentile, replicate set or confidence interval.'],
 ['calibration','Calibrated profiles','No calibrated or observed profile and no import for one; all values are fictional teaching assumptions.',{s:'D1-11; O05'}],
]);
// Verifier-reconstructed partitions (note 10.4); one unit's classes sum to H seconds.
const PART={...RUN,t:'integer',u:'s',d:'seconds with the unit window as denominator',tm:'[0, H)',den:'H per installed unit',s:'D1-08; note 10.4',valued:true,n:['physical stationary dwell']};
g({...PART,o:'port',pop:'installed ports',e:[PR+'ports[].partition','RESOURCE_DELTA','ALLOCATION_DELTA']},'port.partition.',[
 ['unavailable','Out of service','Statically disabled.'],
 ['free','Free','Unreserved, its position clear.'],
 ['unconnected_position_blocked','Free but position blocked','Its only position is held by another visit.'],
 ['reserved_inbound_connect','Reserved: inbound or connecting','Reserved by an inbound move or in the attended connect.'],
 ['connected_drawing','Connected, drawing','Below target with a positive rate.'],
 ['connected_zero_draw','Connected, zero draw','Below target with a zero rate.'],
 ['at_target_lifecycle_running','At target, content work running','Charged and connected while required content work progresses.'],
 ['at_target_waiting','At target, waiting','Charged and connected, waiting for other work or inspection.'],
 ['inspection','Inspection','Final inspection while connected.'],
 ['unplug_handling','Unplugging','The attended unplug; it frees the port, not the position.'],
]);
g({...PART,o:'position',pop:'installed positions',e:[PR+'positions[].partition','RESOURCE_DELTA']},'position.partition.',[
 ['unavailable','Out of service','Statically disabled.'],
 ['free','Free','Not owned or reserved.'],
 ['inbound_exit_handling','Inbound or exit handling','Reserved inbound or for connect, or held during an outbound move or unplug.'],
 ['zone_native_service_active','Zone work in progress','Intake, cabin, positive-rate charge, or diagnosis or repair in its own zone.'],
 ['retained_other_work','Held while other work progresses','Another required task of the occupant progresses, such as an upload.'],
 ['inspection','Inspection','Final inspection of the occupant.'],
 ['finished_but_blocked','Work done, exit blocked','Inspection complete; release has not started or waits.'],
 ['waiting_no_progress','Waiting, no progress','Occupied with no required work progressing.'],
]);
g({...RUN,t:'integer',u:'s',o:'position',tm:'[0, H)',s:'D1-08'},'position.',[
 ['port_released_position_held_s','Port free, position still held',"Seconds after unplug while the port's only position stays held.",{e:[PR+'positions[].port_released_position_held_s']}],
]);
g({...RUN,...VISIT,t:'state',d:'one per arrival by precedence offsite, moving, servicing, work done, queued, waiting',s:'D1-08',e:[PV+'state_at_h'],valued:true},'visit.state.',[
 ['released','Released','Lane egress with a mover completed by H.',{n:['available for a ride']}],
 ['offsite','Off site','On the vendor path.'],
 ['moving','Moving','In an attended move.'],
 ['servicing','Servicing','Some required task progresses, even slowly.'],
 ['work_complete_not_released','Work done, not released','Inspected; unplug or egress unfinished.'],
 ['queued_outside','Queued outside','Arrived, not admitted.'],
 ['blocked_waiting','Waiting, no progress','In the depot, no required work progressing.'],
]);
g({...RUN,...VISIT,t:'state',d:'separate from the primary state',s:'D1-08; C1.6',e:[PV+'due_status'],valued:true},'visit.due_status.',[
 ['past_due','Due time passed by end of run','Due at or before H; on_time tells whether release beat it.'],
 ['not_yet_due','Due after end of run','Adds zero observed overdue, which is not a success.'],
 ['no_due','No due time','No due time is set.'],
]);
g({...RUN,...VISIT,tm:'intervals over [0, H)',t:'state',s:'D1-08',e:[PV+'location'],valued:true},'visit.location.',[
 ['outside','Outside queue','Waiting outside for admission.'],
 ['moving','Moving','In a move; origin and destination may both be owned.'],
 ['position','At a depot position','At the named position.',{v:null}],
 ['offsite','Off site','On vendor travel or service, holding no depot position.'],
 ['released','Released outside','Left by egress.'],
]);
g({...RUN,t:'state',o:'content object or log',tm:'at H',d:'each quantity separately; never summed with transfer counters',s:'D1-10',e:['CONTENT_TRANSITION',PV+'data'],valued:true,n:['committed']},'data.state.',[
 ['received_provisional','Received, provisional','Partial bytes so far; partial upload bytes are not acknowledged, reclaimable or release-satisfying.'],
 ['object_complete','Object complete','Every byte arrived; check, activation and postcheck may remain.'],
 ['durable_acknowledged','Durably acknowledged','Last upload byte acknowledged, instantly in this model.',{s:'D1-10; N11'}],
 ['reclaimed','Reclaimed','Acknowledged log bytes freed from storage.'],
]);
g({...RUN,t:'state',o:'task',tm:'any tick',s:'C1.5',e:['TASK_TRANSITION'],valued:true},'task.state.',[
 ['UNREADY','Not ready','A prerequisite is incomplete.'],
 ['READY','Ready','Starts when the fixed rule finds it feasible.'],
 ['RUNNING','Running','In progress.'],
 ['PAUSED','Paused','A transfer paused by a conflicting start; bytes kept.'],
 ['COMPLETE','Complete','Finished exactly once.'],
 ['CANCELLED','Cancelled','Optional upload cut off at egress; bytes kept.'],
]);
g({...RUN,t:'state',o:'worker',tm:'any tick',s:'D1-09',e:['SHIFT_CHANGE','RESOURCE_DELTA'],valued:true},'worker.state.',[
 ['free','Free','Available and unheld.'],
 ['busy','Busy','Held by attended work; a supervised pair holds two.'],
 ['unavailable','Off shift','Outside every availability interval.'],
]);
g({...RUN,t:'state',o:'content object',tm:'any tick',s:'D1-10; N07',e:['CONTENT_TRANSITION'],valued:true,n:['authenticated software']},'content.stage.',[
 ['RESERVED','Storage reserved','Whole-object space reserved before transfer.'],
 ['CHECK_COMPLETE','Simulated check complete',"A cache check permits serving, never a vehicle's own check."],
 ['ACTIVATION_COMPLETE','Activation complete','One activation per vehicle at a time, after charging.'],
 ['POSTCHECK_COMPLETE','Locally complete','Postcheck done; the content is locally complete.'],
]);
g({...IN,t:'enum',o:'service endpoint',s:'D1-10',pp:'/services/*/'},'service.',[
 ['reachable','Service reachable','Unreachable makes new transfers and activations wait.',{p:'/services/*/service_reachable'}],
 ['entitlement','Service permission','valid, denied or unknown; unknown fails closed. Installed content stays satisfied.'],
]);
g({...RUN,t:'state',o:'visit set',tm:'at H',s:'C3; note 8.8',e:['BLOCKAGE'],valued:true},'blockage.',[
 ['STALL','Stall with a named next event','Never in a public run: nothing follows H.'],
 ['TERMINAL_BLOCKAGE_BEFORE_H','Blocked behind a holder','Waits on units another visit holds, no progress before H.'],
 ['DEADLOCK_DECLARED','Deadlock (closed certificate)','Shown only with a verified closed certificate; others continue.',{n:['a cycle alone']}],
]);
g({...RUN,t:'boolean',o:'task',tm:'at H',s:'D1-08',e:[PV+'active_at_h']},'active_at_h.',[
 ['could_not_finish','Started but could not finish by H','Class, start and exact remainder shown; not proof of a policy error.'],
 ['minimum_duration_exceeded_time_left_at_start','Could not finish even alone','Its known minimum duration exceeded H minus start; lower bound shown, else Not available.'],
]);
g({...RUN,...VISIT,t:'boolean',s:'D1-08',e:[PV+'tasks']},'component.',[
 ['mechanical','Repair done','Diagnosis and repair complete, on site or by vendor.'],
 ['cabin','Cabin reset done','Cabin reset complete.'],
 ['energy','Energy target reached','Alone it does not complete the visit.'],
 ['content','Required content locally complete','Bytes, check, activation and postcheck done.'],
 ['upload','Required upload acknowledged','Optional uploads never gate.'],
]);
g({...RUN,...VISIT,s:'D1-08; note 13'},'',[
 ['visit.work_complete_at','Required work done at','Final inspection after every required component; null if not by H.',{t:'integer',u:'tick',e:[PV+'work_complete_at']}],
 ['visit.released_at','Released from depot work at','Completed lane egress with a mover; null if not by H.',{t:'integer',u:'tick',e:[PV+'released_at'],c:['deferred.mission_eligibility'],n:TURN}],
 ['visit.censored','Still in depot at H','Observed time is then a lower bound.',{t:'boolean',e:[PV+'censored']}],
 ['visit.stationary_dwell_s','Time at depot positions by zone','Seconds at a depot position in each zone, from the location intervals; moves are excluded.',{t:'object',u:'s',tm:'[0, H)',e:[PV+'dwell_by_zone'],n:['position ownership time']}],
 ['visit.on_time','Released by its due time','Null with no due time at or before H.',{t:'boolean',e:[PV+'on_time']}],
 ['visit.route','Repair route','none, onsite or vendor, fixed before diagnosis.',{t:'enum',e:[PV+'route']}],
 ['visit.terminal_zone','Final zone','Where final inspection happens.',{t:'enum',e:[PV+'terminal_zone']}],
 ['visit.frontier_task','Frontier task','First unfinished required task with complete prerequisites; drives wait accounting.',{t:'state',e:[PV+'frontier_at_h'],s:'D1-12'}],
 ['task.mandatory','Required step','Optional uploads never gate release.',{t:'boolean',o:'task',e:[PV+'tasks']}],
 ['energy.initial_mj','Energy at arrival','initial_soc_pct x 2,160,000,000 mJ.',{t:'integer',u:'mJ',pr:P.cfg,e:[PV+'energy']}],
 ['energy.target_mj','Target energy','target_soc_pct x 2,160,000,000 mJ.',{t:'integer',u:'mJ',pr:P.cfg,e:[PV+'energy']}],
 ['energy.required_charge_mj','Required charging energy','Zero bypasses charging.',{t:'integer',u:'mJ',pr:P.cfg,f:'max(0, target_mj - initial_mj)',e:[PV+'energy']}],
 ['charge.acceptance_band','Active acceptance band','DC band at the current energy, or the AC cap.',{t:'state',o:'vehicle',tm:'any tick',e:['ALLOCATION_DELTA'],s:'D1-04'}],
]);
g({...RUN,o:'flow',tm:'per allocation interval',s:'C2.1',e:['ALLOCATION_DELTA','PROGRESS']},'flow.',[
 ['rate','Allocated rate','Exact max-min share in mJ or bytes per tick.',{t:'rational',u:'per tick'}],
 ['tight_resource_ids','Limiting resources','Path resources left with zero residual, plus the flow at its own cap.',{t:'collection',d:'Overview: reached its limit in this run; Technical: constraint active (tight)',n:['a cause without a paired relaxation']}],
 ['quantization_slack','Quantization slack','Left uncredited by the floor at a reallocation; not a loss.',{t:'rational'}],
 ['undrawn_final_tick','Final-tick undrawn allocation','Allocated but undrawn at a target or band edge; not a loss.',{t:'rational'}],
]);
g({...RUN,t:'integer',u:'s',tm:'[0, H)',s:'C1.6; note 13'},'',[
 ['resource.owned_fraction','Owned or reserved share of time','Held unit-ticks over installed available unit-ticks; enabled and eligible denominators shown separately; zero is Not applicable.',{t:'rational',u:null,o:'resource',den:'installed available unit-ticks',e:[PR+'ports[].owned_ticks',PR+'positions[].owned_ticks'],n:['efficiency']}],
 ['resource.occupancy_now','Occupied at the cursor','Units held at the selected tick, separate from windowed shares.',{t:'state',u:null,o:'resource',tm:'cursor tick',e:['projection.intervals']}],
 ['worker.available_s','Worker available time','Availability in [0, H).',{o:'worker',e:[PR+'workers[].available_s']}],
 ['worker.busy_s','Worker busy time','Holding attended work; a pair counts for both.',{o:'worker',e:[PR+'workers[].busy_s']}],
 ['lane.busy_s','Lane busy time','Held by a move.',{o:'lane',e:[PR+'lanes[].busy_s']}],
 ['vendor.busy_s','Vendor busy time','Vendor bay and worker held.',{o:'vendor',e:[PR+'vendor']}],
 ['charge.tight_s','Site supply at its limit','Usable site supply fully allocated.',{o:'site',e:[PR+'site.tight_s']}],
 ['network.tight_s','Network at its limit','Per network resource, fully allocated.',{t:'object',o:'network',e:[PR+'network.tight_s']}],
]);
// Projection metric keys (note 18) with C1.6 formulas; e_i = min(r_i, H) if released, else H.
const DUEPOP='due population (a_i < H, d_i <= H)';
g({...RUN,...VISIT,ver:METRIC_VERSION,t:'integer',u:'visits',tm:'[0, H]',s:'C1.6; note 18',e:['projection.metrics']},'',[
 ['release.on_time_count','Released by their release-by time','Due-population visits with a verified release at or before due.',{d:'"{a} of {d} due by end"; zero due count is Not applicable',pop:DUEPOP,den:'release.due_count',f:'count(r_i <= d_i)',c:['release.due_count','release.unfinished_due_count']}],
 ['release.due_count','Visits due by end of run','Arrivals due at or before H.',{pop:DUEPOP,f:'count(d_i <= H)'}],
 ['release.unfinished_due_count','Due visits not released','Due-population visits unreleased at H.',{pop:DUEPOP,f:'count(r_i absent)'}],
 ['release.released_count','Released visits','Verified release by H.',{f:'count(r_i <= H)'}],
 ['release.unreleased_count','Unfinished visits','No verified release by H.',{f:'count(r_i absent)'}],
 ['visit.work_complete_count','Visits with required work done','Inspection completed by H.',{f:'count(work_complete_at <= H)'}],
 ['visit.censored_count','Visits still in the depot system at H','Observed time cut off at H.',{f:'count(r_i absent)'}],
 ['visit.overdue_s','Late time through end of run','Seconds past due by release or H, summed over all arrivals; due after H adds zero, not a success.',{u:'s',d:SEC,f:'sum of max(0, e_i - d_i)'}],
 ['visit.turnaround_observed_s','Time in depot system (observed)','From arrival in the modeled depot queue to modeled depot release, censored at H, summed over all arrivals.',{u:'s',d:'censored totals read "at least"',f:'sum of (e_i - a_i)',c:['visit.censored_count'],n:TURN}],
 ['work.remaining_reference_seconds','Remaining work (reference seconds)','Unfinished required work by class in common reference seconds.',{t:'object',u:'s',d:'one "p/q" per class; never summed',f:'sum reference_effort x unfinished fraction',n:['real future completion time']}],
 ['energy.remaining_required_mj','Remaining required energy','Energy still needed to reach target.',{u:'mJ',d:KWH,f:'sum max(0, target_mj - current_mj)'}],
 ['data.remaining_required_bytes','Remaining required data','Owed to mandatory transfers; unchecked complete content adds zero bytes but keeps its reference seconds.',{u:'bytes',d:GB,f:'sum max(0, target - credited unique bytes)'}],
 ['data.optional_unfinished_bytes','Unfinished optional uploads','Optional upload bytes not acknowledged, including those that left with a vehicle.',{u:'bytes',d:GB,f:'sum of unacknowledged optional bytes'}],
 ['charge.energy_credited_mj','Energy delivered','Clipped per-interval credits, per visit and total.',{u:'mJ',d:KWH,f:'sum of interval credits'}],
 ['charge.peak_site_draw_w','Peak site charging draw','Largest total charging rate over any allocation interval.',{t:'rational',u:'W',o:'site',pop:null,f:'max of sum(charge rates) / 1000',c:['site.supply_w','site.background_w']}],
 ['network.useful_bytes_down','Useful data delivered down','Credited bytes into vehicles and the cache, by unique copy.',{u:'bytes',d:GB,o:'network',pop:null,f:'sum of download and fetch credits'}],
 ['network.useful_bytes_up','Useful data delivered up','Credited upload bytes by unique transfer.',{u:'bytes',d:GB,o:'network',pop:null,f:'sum of upload credits'}],
 ['resource.attention_fraction','Worker attention used','Busy over available attended worker-seconds; null with none available.',{t:'rational',u:null,o:'worker',pop:'installed workers',den:'available worker-ticks',f:'busy / available worker-ticks',n:[PEOPLE]}],
 ['wait.reason_seconds','Waiting time by reason','Nonservice seconds by frontier primary reason; servicing never counts.',{t:'object',u:'s',d:SEC,f:'per code: union of intervals',c:['reason.primary']}],
]);
// Comparison vector V (D1-11): presentation order only; one scalar component per reference class.
const classes=Object.keys(REFERENCE_EFFORT).filter(c=>REFERENCE_EFFORT[c]>0).sort();
g({...RUN,o:'pair',tm:'[0, H]',pop:'all arrivals (a_i < H)',ver:METRIC_VERSION,s:'D1-11; C1.6',e:['projection.vector'],n:NOWIN,d:'with every companion in both views',dir:'down',t:'integer'},'',[
 ['on_time_count','On-time releases','Equals release.on_time_count; higher is better.',{u:'visits',dir:'up',c:['release.on_time_count']}],
 ['overdue_seconds','Late seconds','Equals the visit.overdue_s total.',{u:'s',d:SEC,c:['visit.overdue_s']}],
 ['observed_visit_seconds','Observed visit seconds','Equals the visit.turnaround_observed_s total.',{u:'s',c:['visit.turnaround_observed_s'],n:[...NOWIN,...TURN]}],
 ['unreleased_count','Unfinished visits','Equals release.unreleased_count.',{u:'visits',c:['release.unreleased_count']}],
 ...classes.map(c=>['remaining_reference_seconds:'+c,'Remaining '+c.replace('_',' ')+' work',`Equals work.remaining_reference_seconds for ${c}; never added to another class.`,{t:'rational',u:'s',c:['work.remaining_reference_seconds']}]),
 ['remaining_required_kWh','Remaining required energy','Equals energy.remaining_required_mj in exact mJ, shown in kWh.',{u:'mJ',d:KWH,c:['energy.remaining_required_mj']}],
 ['remaining_required_bytes','Remaining required data','Equals data.remaining_required_bytes.',{u:'bytes',c:['data.remaining_required_bytes']}],
]);
// The fourteen closed reasons (D1-12, note 8.5); deadlock is an annotation, never a fifteenth reason.
g({...RUN,t:'state',o:'task',tm:'per interval',s:'D1-12; note 8.5',e:['POLICY_DECISION',PV+'waits'],valued:true,n:['a causal share of delay']},'reason.',[
 ['PREREQUISITE','Waiting for earlier work','An earlier required step has not finished.'],
 ['HELD_UNITS','Needed unit in use','Every usable worker, lane, position, port or vendor unit is held by other work.'],
 ['ABSENT_INCOMPATIBLE_UNQUALIFIED','Missing or unqualified resource','No installed, compatible, covered or qualified option, as in: free position; work cannot start, no qualified technician.'],
 ['DIVISIBLE_CAPACITY_TIGHT','Shared capacity at zero share','A required flow gets zero rate; slower positive service is servicing.'],
 ['INSUFFICIENT_SHIFT','Shift does not fit','A free worker or the vendor is off shift, or the step would not fit one shift.'],
 ['UNREACHABLE_SERVICE','Service unreachable','The new transfer or activation waits.'],
 ['DENIED_ENTITLEMENT','Service permission denied','The new transfer, serve or activation is blocked.'],
 ['UNKNOWN_MANDATORY_STATE','Required permission unknown','New starts fail closed.'],
 ['SCHEDULED_WINDOW','Not yet allowed to start','The declared earliest start has not arrived.'],
 ['FULL_STOCK_CACHE','Storage or cache full','Cannot reserve the whole object yet; nothing is evicted.'],
 ['STATIC_OUT_OF_SERVICE','Out of service','Candidates exist but are statically disabled.'],
 ['OVERLAP_EXCLUSION','Conflicts with work in progress','A running task on the vehicle cannot overlap this one.'],
 ['FINISHED_BUT_BLOCKED','Work done, release blocked','Inspection done; unplug or exit waits.'],
 ['DECLARED_RULE_DEFERRAL','Deferred by a declared rule','Unused in this version.'],
 ['primary','Shown first for time accounting','A display convention, not a causal share: unknown or absent, out of service, denied, unreachable, prerequisite, window, shift or overlap, full, held, tight or finished, deferral.',{v:null,o:'visit'}],
]);
// Run and trust states; the trust axes are never merged.
g({t:'state',o:'run',tm:'current session',s:'note 16; C1.5',pr:P.ses,cat:'GATE_DECISION',e:['envelope.status'],valued:true},'run.state.',[
 ['draft','Draft, not run','Choose a setup and run the model. No result yet; a pending result is not zero.'],
 ['running','Running','Checking setup, running baseline, running candidate, checking results.'],
 ['cancelled','Cancelled, no result','Stopped; no partial result is shown.'],
 ['incomplete','Incomplete: resource limit','A written guard stopped the run; the prefix is not a result.'],
 ['stale','From an older draft','This result belongs to an older draft. Run again to update.'],
 ['invalid','Invalid evidence','Verification failed; results are withheld and the violation code is shown.'],
 ['verified','Internally consistent','The independent verifier found the run internally consistent; not authenticated or authorized.',{n:['accepted','trusted','approved']}],
 ['could_not_reproduce','Could not reproduce',"Rerun digest differs from the one in the shared link or configuration file; the sender's result is not shown."],
 ['refused','Refused before running','An input gate failed; no model run started.'],
 ['incompatible','Not comparable','Differs outside treatment paths or in a shared requirement; no comparison.'],
 ['failed','Run failed','The run stopped before it finished; no result is shown.'],
]);
g({t:'enum',o:'run',s:'note 10.5; D1-11',e:['envelope.trust'],techValue:true,pr:P.rule,cat:'RESIDUAL_RISK'},'trust.',[
 ['consistency','Internal consistency','INTERNALLY_CONSISTENT, INVALID_EVIDENCE (results quarantined) or NOT_AVAILABLE.',{v:null,label_technical:'trust.consistency',pr:P.ver,cat:'GATE_DECISION',n:['authenticity','approval']}],
 ['authenticity','Authenticity','Digests bind content; nothing proves who produced it.',{v:'NOT_AUTHENTICATED',pr:P.na,ar:'not_modeled',cat:'AUTHENTICITY'}],
 ['authorization','Authorization','No authorization of any vehicle, policy or release is evaluated.',{v:'NOT_EVALUATED',pr:P.na,ar:'not_modeled',cat:'NOT_AVAILABLE'}],
 ['deployment_permission','Deployment permission','Nothing here approves deploying a vehicle or policy.',{v:'NONE'}],
 ['decision_authority','Decision authority','Results decide nothing.',{v:'NONE'}],
 ['evidence','Evidence status','Not evidence about real-world safety.',{v:'NOT_EVIDENCE'}],
 ['scope','Scope','Simulation only, with fictional inputs.',{v:FLOW_TRUST.scope}],
]);
g({...RUN,t:'digest',o:'run',s:'C1.2',e:['envelope.digests'],n:['producer authenticity'],pr:P.cfg},'identity.',[
 ['scenario_digest','Scenario digest','SHA-256 over the canonical scenario projection.'],
 ['workload_digest','Workload digest','SHA-256 over tape, requirements and content.'],
 ['policy_digest','Policy digest','SHA-256 over the fixed policy body.'],
 ['run_digest','Run digest','Binds scenario digest, versions and ledger.',{pr:P.ver}],
 ['comparison_digest','Comparison digest','Binds both run digests, deltas and versions.',{pr:P.ver}],
]);
g({...RUN,o:'pair',tm:'[0, H]',s:'C1.6; note 11',e:['comparison.components'],n:NOWIN},'comparison.',[
 ['classification','Comparison classification','Component-wise over V for two verified, compatible runs.',{t:'enum',ver:METRIC_VERSION,f:'improvement: all weakly better, one strictly; worse: converse; tie: all equal; mixed: opposing; NOT_AVAILABLE: any component missing, invalid or incompatible'}],
 ['relation','Component relation','better, worse or equal, compared exactly.',{t:'enum'}],
 ['delta','Component difference','Candidate minus baseline, exact.',{t:'rational'}],
]);
g({...RUN,t:'state',o:'pair',tm:'[0, H]',s:'C1.6',e:['comparison.classification'],valued:true,n:NOWIN},'comparison.classification.',[
 ['improvement','Improvement','All components equal or better, one strictly.'],
 ['worse','Worse','All components equal or worse, one strictly.'],
 ['tie','Tie','All components exactly equal.'],
 ['mixed','Mixed','No winner is named, because the measures disagree.'],
 ['NOT_AVAILABLE','Not available','A component is missing, invalid or incompatible.'],
]);
g({...RUN,pr:P.cfg,t:'integer',o:'pair',s:'D1-08; C1.2',e:['comparison.treatment']},'',[
 ['comparison.compatibility','Pair compatibility','Checked before any run: same workload, policy, reference work, versions and non-treatment inputs.',{t:'boolean',cat:'GATE_DECISION'}],
 ['treatment.intervention_count','Interventions','Declared interventions in the pair.',{u:'interventions'}],
 ['treatment.field_count','Authoritative fields changed','A port plus one rezoned position reads 1 intervention, 2 authoritative fields; never one-variable evidence.',{u:'fields',c:['treatment.leaves']}],
 ['treatment.leaves','Every changed value','Each leaf change with exact old and new values.',{t:'collection'}],
 ['session.differences_from_baseline','Differences from baseline','Authoritative fields where the drafts differ.',{pr:P.ses,u:'fields',e:['session.draft']}],
 ['session.edits_since_last_run','Edits since last run','Any edit marks the shown result stale.',{pr:P.ses,u:'edits',e:['session.draft']}],
 ['site.position_total','Total positions (derived)','All zones, 1 to 200; work spaces, not fleet size.',{o:'site',u:'positions',e:[]}],
]);
const BASE={version:REGISTRY_VERSION,prohibited_conflations:[],unit:null,time:'whole run',population:null,denominator:null,formula:null,availability_reason:null,evidence:[],companions:[],pointer:null,treatment:null,direction:null,value:null};
export const TERMS=F(rows.map(r=>{const o={...BASE,...r};o.exact_representation??=REP[o.type];o.display_rule??=SHOW[o.type]??'exact value with its unit';return deep(Object.fromEntries(TERM_FIELDS.map(k=>[k,o[k]])));}));
const BY_ID=new Map(TERMS.map(t=>[t.term_id,t]));
if(BY_ID.size!==TERMS.length)throw new Error('duplicate registry term id');
export const AUTHORITATIVE_POINTERS=F(TERMS.filter(t=>t.treatment).map(t=>t.pointer));
// Null for an unregistered id; the caller shows Not available, never a guess.
export function term(id){return BY_ID.get(id)??null;}
export function termsByCategory(){return F(Object.fromEntries(CATEGORIES.map(c=>[c,F(TERMS.filter(t=>t.category===c))])));}
// Technical source list (research ledger 2026-10-23): plain citations. Each supports a public mechanism only; no
// citation turns a fictional default into observed operations.
export const SOURCES=deep([
 ['P01','DOE AFDC, Electric Vehicle Charging Stations, undated','One port serves one vehicle; AC ranges are context, not a fleet specification.'],
 ['P02','DOE FEMP, Smart Charge Management Implementation for Federal Fleets, undated','Supports a shared site limit; names no best charging policy.'],
 ['P03','BMW and NHTSA, SIB 61 25 23, no or slow DC charging, 2023-10-25','Separate AC and DC acceptance; no maker thresholds; taper is not a fault.'],
 ['P04','NREL, Electric Medium- and Heavy-Duty Vehicle Charging Infrastructure Attributes and Development, report 91571, November 2024','Planning structure only; no truck or bus ratios.'],
 ['P05','DOE AFDC, Electric Vehicles for Fleets, undated','Staffing is separate from equipment count; no vehicles-per-worker figure.'],
 ['P06','DOE AFDC, Maintenance and Safety of Electric Vehicles, undated','No invented fault rates; maintenance is not zero.'],
 ['P07','ASE, Electrified Propulsion Vehicles High-Voltage Electrical Safety Standards, version 2.1, 2025-01-14','Simulator roles are not credentials; no hazardous procedure.'],
 ['P08','ITDP, BRT Planning Guide, depot design layout, undated','Distinct depot functions only; bus ratios are not defaults.'],
 ['P10','Waymo and Uber, partnership expansion announcement, 2024-09-13','Service ownership only; not a staffing or performance measure.'],
 ['P11','U.S. EPA, Vehicle maintenance and washing, February 2023','Washing needs more than a spare worker; no compliance claim.'],
 ['P12','Joint Office and INL, Ensuring a Reliable Charging Experience, webinar, 2023-06-08','No calibrated failure distribution follows.'],
 ['N01','Waymo, Driver Handbook: mapping, 2020-09-21','Map identity only; no sizes, deadlines or transfer rates.'],
 ['N02','Waymo, Senior Software Engineer, Telematics, undated public posting','Work categories only; not a topology, API, protocol or configuration.','recruiting material; work categories only'],
 ['N03','Cisco, IEEE 802.11ax white paper, updated 2020-04-03','A vendor source, not a measured depot.'],
 ['N04','Cisco, Wi-Fi 7 design guide, updated 2025-04-08','Generations are capability profiles; link rates are not throughput.'],
 ['N05','Cisco, MLO: packets to performance, 2025-02-17','Its laboratory gains are not assumptions here.'],
 ['N06','Ofcom, Automated Frequency Coordination, 2026-07-20','UK-specific context only; no permission for a US installation follows.','UK spectrum context only'],
 ['N07','Uptane, Standard 2.1.0, 2023-06-06','Simulated checks only; not compliance or authenticated evidence.'],
 ['N08','IETF, RFC 9019, Informational, April 2021','Reachability, integrity and permission stay distinct.'],
 ['N10','Microsoft, Disconnected device updates and Connected Cache, preview, 2023-04-14','No direct access is not a fully offline depot.'],
 ['N11','Microsoft, IoT Edge offline capabilities, updated 2026-03-02','Local state and acknowledgment stay separate; not a chosen backend.'],
 ['N12','Waymo Help, Ride interruptions, undated','Depot connectivity is not a remote-driving setting.'],
 ['O05','NIST, On Methods of Uncertainty Quantification in Computational Modeling and Simulation, 2026-10-05','Scoped credibility claims only; no conformance claim.'],
 ['U01','W3C WAI, Tabs pattern, undated','The pattern alone does not establish accessibility conformance.'],
].map(([id,citation,limitation,tag=null])=>({id,citation,label:'Public mechanism',limitation,tag})));
