// Independent fixed-position proof. Never imports producer, search or presentation.
import {normalizeOrderInput,normalizeOrder,orderCanonical,orderDigest,orderFields,ORDER_LIMITS,ORDER_RECORD_SCHEMA,ORDER_POLICY_VERSION} from './delivery-order-contract.js';
export const ORDER_VERIFIER_VERSION='fleetlab.delivery-order-verifier/1.0.0';
export function verifyOrderRecord(raw){
 try{
  const r=JSON.parse(orderCanonical(raw,ORDER_LIMITS.record));
  orderFields(r,['schema','policy_version','input','input_digest','order','fetch','vehicles','metrics','record_digest'],'record');
  const input=normalizeOrderInput(r.input),order=normalizeOrder(r.order,input),eq=(a,b)=>orderCanonical(a)===orderCanonical(b);
  const require=(v,reason)=>{if(!v)throw Error(reason);};
  require(r.schema===ORDER_RECORD_SCHEMA&&r.policy_version===ORDER_POLICY_VERSION,'record-version');
  require(eq(input,r.input)&&r.input_digest===orderDigest(input),'normalized-input-identity');
  require(eq(r.fetch,{start_ms:0,end_ms:96000,bytes:12000000000}),'fetch-prerequisite');
  require(Array.isArray(r.vehicles)&&r.vehicles.length===order.length,'vehicle-denominator');
  let lateTotal=0,maxLate=0,onTime=0;
  for(let i=0;i<input.delivery.requests.length;i++){
   const req=input.delivery.requests[i],position=order.indexOf(req.id),end=144000+position*48000,ready=end+90000;
   const expected={id:req.id,receive_start_ms:96000+position*48000,receive_end_ms:end,received_bytes:12000000000,
    check_start_ms:end,check_end_ms:end+60000,activation_start_ms:end+60000,ready_ms:ready,deadline_ms:req.deadline_ms};
   require(eq(r.vehicles[i],expected),`interval-capacity-or-prerequisite:${req.id}`);
   const lateness=Math.max(0,ready-req.deadline_ms);lateTotal+=lateness;maxLate=Math.max(maxLate,lateness);if(!lateness)onTime++;
  }
  const n=order.length,metrics={request_count:n,on_time_count:onTime,missed_count:n-onTime,late_ms_total:lateTotal,max_late_ms:maxLate,all_ready_ms:186000+48000*n,wan_bytes:12000000000,local_bytes:n*12000000000};
  require(eq(r.metrics,metrics),'record-metrics');
  const {record_digest,...payload}=r;require(record_digest===orderDigest(payload),'record-digest');
  return {ok:true,errors:[],metrics,input_digest:r.input_digest,record_digest};
 }catch(error){return {ok:false,errors:[error.message],metrics:null,input_digest:null,record_digest:null};}
}
