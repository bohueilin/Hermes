// The frozen depot lab profile (contract C1.4, D12-01/02, C1.6). Owner-selected fictional teaching values, not
// calibration, workplace guidance or a claim about any operator. Changing any value here changes the policy digest.
const freeze=v=>{if(v&&typeof v==='object'){Object.freeze(v);for(const k of Object.keys(v))freeze(v[k]);}return v;};
export const ENGINE_VERSION='depot-lab-engine.1.0.0',VERIFIER_VERSION='depot-lab-verifier.1.0.0';
export const PROJECTION_VERSION='depot_projection_v1',METRIC_VERSION='depot_metrics_v1',OBSERVATION_VERSION='depot_observation_v1';
export const SCENARIO_SCHEMA='fleetlab.depot.scenario.v1',LEDGER_SCHEMA='fleetlab.depot.ledger.v1',MODEL_VERSION='depot_model_v1',PROFILE_VERSION='depot_contract_v1';
export const POLICY_ID='fcfs_eligible_fair_resources_v1',OVERLAP_PROFILE='serial_activation_connected_inspection_v1',REFERENCE_EFFORT_VERSION='practiced_reference_v1';
export const TEMPLATES=freeze(['admit','intake','to_garage','diagnosis','repair','vendor_departure','vendor_outbound','vendor_service','vendor_return','vendor_reentry','to_cleaning','cabin','map_download','map_check','software_download','software_check','to_charging','connect','charge','map_activation','map_postcheck','software_activation','software_postcheck','upload','acknowledgment','inspection','unplug','egress']);
export const TEMPLATE_RANK=freeze(Object.fromEntries(TEMPLATES.map((t,i)=>[t,i])));
export const OVERLAP_CLASSES=freeze(['MV','IN','CB','DG','RP','CN','CH','UP','DL','UL','CK','AC','PC','AK','FI','VT','VS']);
// D12-02 same-vehicle matrix in OVERLAP_CLASSES column order. Former P entries are X under Q1.
const ROWS={MV:'XXXXXXXXXXXXXXXXX',IN:'XXXXXXXXXXXXXXXXX',CB:'XXXXXXXXAAAXAAXXX',DG:'XXXXXXXXAAAXAAXXX',RP:'XXXXXXXXAAAXAAXXX',CN:'XXXXXXXXAAAXAAXXX',CH:'XXXXXXXXAAAXXAXXX',UP:'XXXXXXXXAAAXAAXXX',DL:'XXAAAAAAAAAAAAAXX',UL:'XXAAAAAAAAAAAAAXX',CK:'XXAAAAAAAAAAAAAXX',AC:'XXXXXXXXAAAXAAXXX',PC:'XXAAAAXAAAAAAAAXX',AK:'XXAAAAAAAAAAAAAXX',FI:'XXXXXXXXAAAXAAXXX',VT:'XXXXXXXXXXXXXXXXX',VS:'XXXXXXXXXXXXXXXXX'};
export const OVERLAP_MATRIX=freeze(OVERLAP_CLASSES.map(c=>ROWS[c].split('')));
const CLASS_INDEX=Object.fromEntries(OVERLAP_CLASSES.map((c,i)=>[c,i]));
export const overlapAllowed=(a,b)=>OVERLAP_MATRIX[CLASS_INDEX[a]][CLASS_INDEX[b]]==='A';
export const TEMPLATE_CLASS=freeze({admit:'MV',intake:'IN',to_garage:'MV',diagnosis:'DG',repair:'RP',vendor_departure:'MV',vendor_outbound:'VT',vendor_service:'VS',vendor_return:'VT',vendor_reentry:'MV',to_cleaning:'MV',cabin:'CB',map_download:'DL',map_check:'CK',software_download:'DL',software_check:'CK',to_charging:'MV',connect:'CN',charge:'CH',map_activation:'AC',map_postcheck:'PC',software_activation:'AC',software_postcheck:'PC',upload:'UL',acknowledgment:'AK',inspection:'FI',unplug:'UP',egress:'MV'});
export const MOVE_TEMPLATES=freeze(['admit','to_garage','vendor_departure','vendor_reentry','to_cleaning','to_charging','egress']);
export const ATTENDED_CLASSES=freeze(['intake','cabin','diagnosis','mechanical_repair','specialist_repair','inspection','connect','unplug','move']);
export const PROFICIENCY_LEVELS=freeze(['developing','practiced','advanced']);
export const PROFICIENCY=freeze({intake:[180,120,90],cabin:[900,600,480],diagnosis:[1680,1200,1020],mechanical_repair:[4800,3600,3300],specialist_repair:[7200,5400,4800],inspection:[420,300,240],connect:[180,120,105],unplug:[150,120,90],move:[120,120,120]});
export const proficiencyTicks=(cls,level)=>PROFICIENCY[cls][PROFICIENCY_LEVELS.indexOf(level)];
// Comparison-frozen common unit of remaining attended/lifecycle work (C1.6). Charge and transfers use mJ/bytes.
export const REFERENCE_EFFORT=freeze({acknowledgment:0,activation:600,cabin:600,check:60,connect:120,diagnosis:1200,inspection:300,intake:120,mechanical_repair:3600,move:120,postcheck:60,specialist_repair:5400,unplug:120});
export const VEHICLE_PROFILE=freeze({capacity_mj:216000000000,storage_capacity_bytes:50000000000,ac_cap_w:11000,dc_bands:[{from_soc_pct:0,until_soc_pct:60,cap_w:100000},{from_soc_pct:60,until_soc_pct:80,cap_w:60000},{from_soc_pct:80,until_soc_pct:100,cap_w:30000}],efficiency:'1/1',thermal_factor:'1/1'});
export const EXOGENOUS_RANK=freeze({shift_end:0,shift_start:1,arrival:2});
export const REASON_CODES=freeze(['PREREQUISITE','HELD_UNITS','ABSENT_INCOMPATIBLE_UNQUALIFIED','DIVISIBLE_CAPACITY_TIGHT','INSUFFICIENT_SHIFT','UNREACHABLE_SERVICE','DENIED_ENTITLEMENT','UNKNOWN_MANDATORY_STATE','SCHEDULED_WINDOW','FULL_STOCK_CACHE','STATIC_OUT_OF_SERVICE','OVERLAP_EXCLUSION','FINISHED_BUT_BLOCKED','DECLARED_RULE_DEFERRAL']);
// Q15 accounting order for the visit-level primary reason; a display convention, never a causal share.
export const REASON_ACCOUNTING_ORDER=freeze(['UNKNOWN_MANDATORY_STATE','ABSENT_INCOMPATIBLE_UNQUALIFIED','STATIC_OUT_OF_SERVICE','DENIED_ENTITLEMENT','UNREACHABLE_SERVICE','PREREQUISITE','SCHEDULED_WINDOW','INSUFFICIENT_SHIFT','OVERLAP_EXCLUSION','FULL_STOCK_CACHE','HELD_UNITS','DIVISIBLE_CAPACITY_TIGHT','FINISHED_BUT_BLOCKED','DECLARED_RULE_DEFERRAL']);
export const DATA_STATES=freeze(['received_provisional','object_complete','durable_acknowledged','reclaimed']);
export const ZONES=freeze(['waiting','charging','cleaning','garage']);
// The hashed fixed policy/profile body P (C1.4). Validation compares expanded content with this immutable body.
export const POLICY_BODY=freeze({
 id:POLICY_ID,
 rank:'ready_tick_then_template_rank_then_visit_id_then_task_id',
 admission:'arrival_tick_then_visit_id',
 worker:'lowest_eligible_id',
 position:'lowest_eligible_id',
 port:'DC_then_AC_then_id_never_decline_feasible_AC',
 divisible:'weight_1_max_min',
 observation:'current_truth_no_future_arrivals',
 ownership:'retain_origin_until_move_complete',
 overlap:OVERLAP_PROFILE,
 tick_seconds:1,
 credit:'floor_per_constant_allocation_interval_no_residual',
 efficiency:'1/1',
 thermal:'1/1',
 matrix:{classes:OVERLAP_CLASSES,rows:OVERLAP_CLASSES.map(c=>ROWS[c])},
 exogenous_ranks:EXOGENOUS_RANK,
 template_ranks:TEMPLATES,
});
const row=(task_class,level,proficiency,may_supervise=false)=>({task_class,level,proficiency,may_supervise,solo_duration_ticks:proficiencyTicks(task_class,proficiency)});
// Role templates (D12-01): listed classes independent/practiced and allowed to supervise; all others unqualified.
export const ROLE_TEMPLATES=freeze({cleaner:['cabin'],technician:['diagnosis','mechanical_repair'],mover:['move','connect','unplug'],lead:['intake','inspection']});
export function roleQualifications(role,overrides={}){
 const listed=new Set(ROLE_TEMPLATES[role]??[]);
 return ATTENDED_CLASSES.slice().sort().map(c=>{const o=overrides[c];if(o)return row(c,o.level,o.proficiency??'practiced',o.may_supervise??false);return listed.has(c)?row(c,'independent','practiced',true):row(c,'unqualified','practiced');});
}
