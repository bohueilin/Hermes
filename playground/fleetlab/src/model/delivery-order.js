import {normalizeOrderInput,normalizeOrder,orderDigest,ORDER_RECORD_SCHEMA,ORDER_POLICY_VERSION} from './delivery-order-contract.js';
export function runDeliveryOrder(raw,requestedOrder){
 const input=normalizeOrderInput(raw),order=normalizeOrder(requestedOrder,input),d=input.delivery;
 const upstream={start_ms:0,end_ms:d.artifact.size_bytes*1000/d.resources.wan.aggregate_Bps,bytes:d.artifact.size_bytes};
 let clock=upstream.end_ms;const rows=[];
 for(const id of order){
  const r=d.requests.find(r=>r.id===id),start=clock;
  clock+=d.artifact.size_bytes*1000/d.resources.local.aggregate_Bps;
  rows.push({id,receive_start_ms:start,receive_end_ms:clock,received_bytes:d.artifact.size_bytes,
   check_start_ms:clock,check_end_ms:clock+r.check_ms,activation_start_ms:clock+r.check_ms,
   ready_ms:clock+r.check_ms+r.activation_ms,deadline_ms:r.deadline_ms});
 }
 const vehicles=rows.sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0),late=vehicles.map(v=>Math.max(0,v.ready_ms-v.deadline_ms));
 const metrics={request_count:vehicles.length,on_time_count:late.filter(x=>x===0).length,missed_count:late.filter(x=>x>0).length,
  late_ms_total:late.reduce((a,b)=>a+b,0),max_late_ms:Math.max(...late),all_ready_ms:Math.max(...vehicles.map(v=>v.ready_ms)),wan_bytes:upstream.bytes,local_bytes:vehicles.length*d.artifact.size_bytes};
 const record={schema:ORDER_RECORD_SCHEMA,policy_version:ORDER_POLICY_VERSION,input,input_digest:orderDigest(input),order,fetch:upstream,vehicles,metrics};
 return {...record,record_digest:orderDigest(record)};
}
