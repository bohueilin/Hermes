// NF-03 input contract only: frozen workload, rules and canonical digest text. No scheduling or verifier logic.
import {FLOW_TRUST} from './depot-flow-contract.js';
import {COHORT_RULES,cohortObject,cohortArray} from './depot-cohort-contract.js';
import {sha256Hex} from '../core/sha256.js';
export {FLOW_TRUST,cohortObject,cohortArray};

const deepFreeze=x=>{if(x&&typeof x==='object'){Object.values(x).forEach(deepFreeze);Object.freeze(x);}return x;};

export const CAPACITY_VERSIONS=Object.freeze({study:'depot-capacity-study/1.0.0',model:'depot-capacity/1.0.0',policy:'depot-capacity-rules/1.0.0',metrics:'depot-capacity-metrics/1.0.0',record:'depot-capacity-record/1.0.0',verifier:'depot-capacity-verifier/1.0.0'});
export const CAPACITY_RULES=deepFreeze([
  {id:'capacity_fifo',name:COHORT_RULES[0].name,description:'One upload at a time in arrival then ID order. A started upload is not interrupted.'},
  {id:'capacity_equal_uplink',name:COHORT_RULES[1].name,description:'Arrived uploads share each slot equally, with whole remainder bytes rotating over them in arrival then ID order.'},
  {id:'capacity_departure_deadline',name:COHORT_RULES[2].name,description:'One upload at a time, earliest departure first among arrived visits. Arrival then ID break ties. No interruption.'},
  {id:'capacity_shortest_upload',name:COHORT_RULES[3].name,description:'One upload at a time, smallest remaining known upload first among arrived visits. Arrival then ID break ties. No interruption.'},
]);
export const CAPACITY_REGIMES=deepFreeze({
  data_heavy:{name:'Data-heavy',question:'Can more site power help when energy is already satisfied?',upload_bytes:{A:60e9,B:7.5e9,C:45e9,D:15e9},energy_j:{A:0,B:0,C:0,D:0}},
  energy_heavy:{name:'Energy-heavy',question:'Does faster upload change readiness when energy work remains?',upload_bytes:{A:6e9,B:0.75e9,C:4.5e9,D:1.5e9},energy_j:{A:21600000,B:7200000,C:14400000,D:3600000}},
  mixed:{name:'Mixed',question:'How does the limiting prerequisite change across vehicles and arrival waves?',upload_bytes:{A:60e9,B:7.5e9,C:45e9,D:15e9},energy_j:{A:21600000,B:7200000,C:14400000,D:3600000}},
});
export const CAPACITY_TREATMENTS=deepFreeze({
  base:{name:'Base',uplink_bytes_s:125000000,site_power_j_s:60000,changed:null},
  more_bandwidth:{name:'More bandwidth',uplink_bytes_s:250000000,site_power_j_s:60000,changed:'uplink_bytes_s'},
  more_power:{name:'More power',uplink_bytes_s:125000000,site_power_j_s:120000,changed:'site_power_j_s'},
});
export const CAPACITY_PROTOCOL=deepFreeze({fixture:'nf03-twelve-visits/1',horizon_s:5400,waves:[0,600,1200],profiles:['A','B','C','D'],deadline_offset_s:{A:600,B:900,C:1320,D:360},post_s:120,charge_ports:2,port_cap_j_s:60000,vehicle_uplink_cap_bytes_s:250000000,quanta_ms:[1000,250]});

const SCENARIO_KEYS=['fixture','regime','treatment','horizon_s','time_quantum_ms','uplink_bytes_s','vehicle_uplink_cap_bytes_s','charge_ports','port_cap_j_s','site_power_j_s','dependencies','vehicles'];
const VEHICLE_KEYS=['id','wave','arrival_s','upload_bytes','energy_j','post_s','deadline_s'];

export function capacityScenario(options){
  cohortObject(options,['regime','treatment','time_quantum_ms'],false);
  const {regime,treatment,time_quantum_ms=1000}=options,P=CAPACITY_PROTOCOL;
  if(!Object.hasOwn(CAPACITY_REGIMES,regime)||!Object.hasOwn(CAPACITY_TREATMENTS,treatment)||!P.quanta_ms.includes(time_quantum_ms))throw Error('Choose a frozen NF-03 regime, treatment and quantum.');
  const R=CAPACITY_REGIMES[regime],T=CAPACITY_TREATMENTS[treatment],q=time_quantum_ms/1000;
  // Every per-slot grant must be whole bytes or joules for every port occupancy, so no rounding enters the ledger.
  const perSlot=[T.uplink_bytes_s*q,P.vehicle_uplink_cap_bytes_s*q,P.port_cap_j_s*q,...Array.from({length:P.charge_ports},(_,n)=>T.site_power_j_s*q/(n+1))];
  if(!perSlot.every(Number.isSafeInteger))throw Error('NF-03 slot grants must be whole bytes and joules.');
  return {
    fixture:P.fixture,regime,treatment,horizon_s:P.horizon_s,time_quantum_ms,
    uplink_bytes_s:T.uplink_bytes_s,vehicle_uplink_cap_bytes_s:P.vehicle_uplink_cap_bytes_s,charge_ports:P.charge_ports,port_cap_j_s:P.port_cap_j_s,site_power_j_s:T.site_power_j_s,
    dependencies:{upload:[],charge:[],post:['upload'],ready:['upload','charge','post']},
    vehicles:P.waves.flatMap((arrival_s,index)=>P.profiles.map(p=>({id:`${p}${index+1}`,wave:index+1,arrival_s,upload_bytes:R.upload_bytes[p],energy_j:R.energy_j[p],post_s:P.post_s,deadline_s:arrival_s+P.deadline_offset_s[p]}))),
  };
}

// Hygiene first on every level, so no accessor or inherited field is read; then the scenario must be the frozen one.
export function validateCapacityScenario(s){
  cohortObject(s,SCENARIO_KEYS);
  cohortObject(s.dependencies,['upload','charge','post','ready']);
  for(const key of ['upload','charge','post','ready'])cohortArray(s.dependencies[key],3);
  cohortArray(s.vehicles,12);
  for(const v of s.vehicles)cohortObject(v,VEHICLE_KEYS);
  if(canonicalText(s)!==canonicalText(capacityScenario({regime:s.regime,treatment:s.treatment,time_quantum_ms:s.time_quantum_ms})))throw Error('Scenario differs from the frozen NF-03 workload for its regime, treatment and quantum.');
}

/** Sorted-key JSON text of plain data; anything a digest could render ambiguously is refused. */
export function canonicalText(value){
  if(value===null||typeof value==='boolean'||typeof value==='string')return JSON.stringify(value);
  if(typeof value==='number'){if(!Number.isFinite(value))throw Error('Canonical text accepts finite numbers only.');return JSON.stringify(value);}
  if(Array.isArray(value))return `[${Array.from(value,item=>canonicalText(item)).join(',')}]`;
  if(value&&typeof value==='object'&&[Object.prototype,null].includes(Object.getPrototypeOf(value))&&Reflect.ownKeys(value).length===Object.keys(value).length){
    return `{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonicalText(value[key])}`).join(',')}}`;
  }
  throw Error('Canonical text accepts plain data only.');
}
export const recordDigest=record=>sha256Hex(canonicalText(record));

// The 72-cell study plan and the rule a study manifest must meet before a comparison may read it.
export const STUDY_ID='nf03-schedule-versus-capacity/1';
export const STUDY_SCHEMA='depot-capacity-study-manifest/1.0.0';
export const cellId=({regime,treatment,rule,time_quantum_ms})=>`${regime}/${treatment}/${rule}/${time_quantum_ms}`;
export const STUDY_CELLS=deepFreeze(Object.keys(CAPACITY_REGIMES).flatMap(regime=>Object.keys(CAPACITY_TREATMENTS).flatMap(treatment=>
  CAPACITY_RULES.flatMap(({id:rule})=>CAPACITY_PROTOCOL.quanta_ms.map(time_quantum_ms=>({regime,treatment,rule,time_quantum_ms}))))));
export const workloadDigest=()=>sha256Hex(canonicalText({protocol:CAPACITY_PROTOCOL,regimes:CAPACITY_REGIMES,treatments:CAPACITY_TREATMENTS,rules:CAPACITY_RULES.map(r=>r.id)}));

/** A cell is accepted when it is planned, present once, labelled by its own fields, VALID and comparison eligible.
 * A manifest written under another schema, study, version set or workload is never complete. */
export function studyStatus(manifest){
  const planned=STUDY_CELLS.map(cellId),cells=Array.isArray(manifest?.cells)?manifest.cells:[];
  const ids=cells.map(c=>c?.cell_id),seen=id=>ids.filter(x=>x===id).length;
  const good=c=>planned.includes(c?.cell_id)&&c.cell_id===cellId(c)&&c.verification?.model_validity==='VALID'&&c.verification?.comparison_eligible===true;
  const missing=planned.filter(id=>!seen(id)),duplicated=planned.filter(id=>seen(id)>1);
  const rejected=[...new Set(cells.filter(c=>!good(c)).map(c=>c?.cell_id))];
  const accepted=planned.filter(id=>seen(id)===1&&!rejected.includes(id)).length;
  let current=false;
  try{current=manifest.schema===STUDY_SCHEMA&&manifest.study===STUDY_ID&&canonicalText(manifest.versions)===canonicalText(CAPACITY_VERSIONS)&&manifest.workload_digest===workloadDigest();}catch{/* A malformed manifest is simply not current. */}
  return {planned:planned.length,accepted,complete:current&&accepted===planned.length&&!missing.length&&!duplicated.length&&!rejected.length,missing,duplicated,rejected};
}
