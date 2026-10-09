// NF-02 input/schema contract only. Its slot arithmetic is separate from NF-01.
import {FLOW_RULES,FLOW_TRUST} from './depot-flow-contract.js';
export {FLOW_TRUST};
export const COHORT_VERSIONS=Object.freeze({model:'depot-cohort/1.0.0',policy:'depot-cohort-rules/1.0.0',metrics:'depot-cohort-metrics/1.0.0',record:'depot-cohort-record/1.0.0',verifier:'depot-cohort-verifier/1.0.0'});
export const COHORT_RULES=Object.freeze([
  Object.freeze({id:'cohort_fifo',name:FLOW_RULES[0].name,description:'One upload at a time in arrival then ID order. A started upload is not interrupted.'}),
  Object.freeze({id:'cohort_equal_uplink',name:FLOW_RULES[1].name,description:'Eligible uploads share each slot equally, with rotating remainder bytes. Finished uploads leave the next slot’s ring.'}),
  Object.freeze({id:'cohort_departure_deadline',name:FLOW_RULES[2].name,description:'One upload at a time, earliest departure first. Arrival then ID break ties. No interruption.'}),
  Object.freeze({id:'cohort_shortest_upload',name:'Shortest upload first',description:'One upload at a time, smallest known exact upload first. Arrival then ID break ties. No interruption.'}),
]);

// Reject hidden, accessor, symbol and inherited fields before reading an allocation or record.
export function cohortObject(value,keys,exact=true){
  if(!value||typeof value!=='object'||![Object.prototype,null].includes(Object.getPrototypeOf(value)))throw Error('Expected a plain data object.');
  const own=Reflect.ownKeys(value);
  if((exact&&own.length!==keys.length)||own.some(k=>typeof k!=='string'||!keys.includes(k)||!Object.getOwnPropertyDescriptor(value,k).enumerable||!Object.hasOwn(Object.getOwnPropertyDescriptor(value,k),'value')))throw Error('Unexpected or missing own-property key.');
}
export function cohortArray(value,max){
  if(!Array.isArray(value)||value.length>max||Reflect.ownKeys(value).length!==value.length+1||!Array.from({length:value.length},(_,i)=>{const d=Object.getOwnPropertyDescriptor(value,i);return d&&d.enumerable&&Object.hasOwn(d,'value');}).every(Boolean))throw Error('Expected a bounded dense data array.');
}
export function validateCohortScenario(s){
  cohortObject(s,['fixture','horizon_s','time_quantum_ms','uplink_bytes_s','charger_j_s','dependencies','vehicles']);
  if(s.fixture!=='nf02-four-visits/1'||![1000,250].includes(s.time_quantum_ms))throw Error('Unsupported NF-02 fixture or quantum.');
  const integer=(n,max,label)=>{if(!Number.isSafeInteger(n)||n<0||n>max)throw Error(`${label} must be a bounded nonnegative integer.`);};
  const seconds=(n,max,label)=>{if(!Number.isFinite(n)||n<0||n>max||!Number.isSafeInteger(n*1000/s.time_quantum_ms))throw Error(`${label} must lie on a bounded slot boundary.`);};
  seconds(s.horizon_s,1500,'Horizon');integer(s.uplink_bytes_s,1e9,'Useful bytes/s');
  if(!Number.isSafeInteger(s.uplink_bytes_s*s.time_quantum_ms/1000)||s.charger_j_s!==0)throw Error('NF-02 requires integer slot bytes and already charged visits.');
  cohortObject(s.dependencies,['upload','charge','post','ready']);
  for(const [key,expected] of Object.entries({upload:[],charge:[],post:['upload'],ready:['upload','charge','post']})){
    cohortArray(s.dependencies[key],3);if(JSON.stringify(s.dependencies[key])!==JSON.stringify(expected))throw Error('Unsupported or cyclic prerequisites.');
  }
  cohortArray(s.vehicles,4);
  if(s.vehicles.length!==4)throw Error('NF-02 requires four visits.');
  for(const [index,v] of s.vehicles.entries()){
    cohortObject(v,['id','arrival_s','upload_bytes','energy_j','post_s','deadline_s']);
    if(v.id!==['A','B','C','D'][index]||v.arrival_s!==0||v.energy_j!==0)throw Error('NF-02 requires stable A/B/C/D IDs arriving already charged at zero.');
    integer(v.upload_bytes,1e12,'Useful bytes');seconds(v.post_s,86400,'Post seconds');seconds(v.deadline_s,86400,'Deadline');
  }
}
export function cohortScenario(options={}){
  cohortObject(options,['time_quantum_ms'],false);
  const {time_quantum_ms=1000}=options;
  const s={fixture:'nf02-four-visits/1',horizon_s:1500,time_quantum_ms,uplink_bytes_s:125e6,charger_j_s:0,dependencies:{upload:[],charge:[],post:['upload'],ready:['upload','charge','post']},vehicles:[['A',60e9,600],['B',7.5e9,900],['C',45e9,1320],['D',15e9,360]].map(([id,upload_bytes,deadline_s])=>({id,arrival_s:0,upload_bytes,energy_j:0,post_s:120,deadline_s}))};
  validateCohortScenario(s);return s;
}
