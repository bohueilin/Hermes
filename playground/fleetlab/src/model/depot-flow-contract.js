// Bounded NF-01 contract. This validates inputs only; it contains no simulation or verifier logic.
export const FLOW_VERSIONS=Object.freeze({model:'depot-flow/1.0.0',policy:'depot-flow-rules/1.0.0',metrics:'depot-flow-metrics/1.0.0',record:'depot-flow-record/1.0.0',verifier:'depot-flow-verifier/1.0.0'});
export const FLOW_RULES=Object.freeze([
  Object.freeze({id:'nf_fifo',name:'First come, first served',description:'One upload at a time. Arrival order; A first when arrivals tie. A started upload is not interrupted.'}),
  Object.freeze({id:'nf_equal_uplink',name:'Equal uplink share',description:'Eligible uploads share the link equally. A finished upload releases its share immediately. Deadlines are not used.'}),
  Object.freeze({id:'nf_departure_deadline',name:'Departure deadline first',description:'One upload at a time, earliest departure deadline first. Arrival then ID break ties. No interruption.'}),
]);
export const FLOW_TRUST=Object.freeze({scope:'SIMULATION_ONLY',evidence_status:'NOT_EVIDENCE',authenticity:'NOT_AUTHENTICATED',authorization:'NOT_EVALUATED',decision_authority:'NONE',deployment_permission:'NONE'});
export function validateFlowScenario(s){
  const integer=(n,max,label)=>{if(!Number.isSafeInteger(n)||n<0||n>max)throw Error(`${label} must be a bounded nonnegative integer.`);};
  if(!s||!['nf01-two-vehicles/1','nf01-two-vehicles/2'].includes(s.fixture))throw Error('Unsupported fixture.');
  integer(s.horizon_s,86400,'Horizon');integer(s.uplink_bytes_s,1e9,'Uplink bytes/s');integer(s.charger_j_s,1e6,'Charger joules/s');
  if(!Array.isArray(s.vehicles)||s.vehicles.length!==2||s.vehicles.map(v=>v.id).join(',')!=='A,B')throw Error('NF-01 requires vehicles A and B in stable order.');
  // Reject altered prerequisites, including cycles, instead of silently executing a different graph.
  if(JSON.stringify(s.dependencies)!==JSON.stringify({upload:[],charge:[],post:['upload'],ready:['upload','charge','post']}))throw Error('Unsupported or cyclic task prerequisites.');
  for(const v of s.vehicles){
    if(v.arrival_s!==0)throw Error('NF-01 arrivals must be at zero.');
    integer(v.deadline_s,86400,'Deadline');integer(v.upload_bytes,1e12,'Useful bytes');integer(v.energy_j,1e10,'Energy joules');integer(v.post_s,86400,'Post-upload seconds');
  }
}
export function flowScenario({uplink_gbps=1,b_gb=7.5,charger_kw=60,fixture=2}={}){
  if(![1,0.5].includes(uplink_gbps)||![7.5,15,45].includes(b_gb)||![60,20].includes(charger_kw)||![1,2].includes(fixture))throw Error('Choose a supported lesson setting.');
  const energy=fixture===1?10:6;
  return {fixture:`nf01-two-vehicles/${fixture}`,horizon_s:300*Math.ceil(Math.max(15,(75+b_gb)/(7.5*uplink_gbps)+2,60*energy/charger_kw)/5),uplink_bytes_s:uplink_gbps*125e6,charger_j_s:charger_kw*1000,dependencies:{upload:[],charge:[],post:['upload'],ready:['upload','charge','post']},vehicles:[{id:'A',arrival_s:0,upload_bytes:75e9,energy_j:energy*36e5,post_s:120,deadline_s:900},{id:'B',arrival_s:0,upload_bytes:b_gb*1e9,energy_j:0,post_s:120,deadline_s:300}]};
}
