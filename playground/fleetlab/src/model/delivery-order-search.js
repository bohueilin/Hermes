import {normalizeOrderInput,orderDigest,ORDER_STUDY_SCHEMA,ORDER_POLICY_VERSION} from './delivery-order-contract.js';
import {runDeliveryOrder} from './delivery-order.js';
export function searchDeliveryOrders(raw){
 const input=normalizeOrderInput(raw),records=[];
 function visit(prefix,remaining){if(!remaining.length){records.push(runDeliveryOrder(input,prefix));return;}
  remaining.forEach((id,i)=>visit([...prefix,id],remaining.filter((_,j)=>j!==i)));}
 visit([],input.delivery.requests.map(r=>r.id));
 let best=null,best_orders=[];
 for(const r of records){const m=r.metrics;
  if(!best||m.missed_count<best.missed_count||(m.missed_count===best.missed_count&&m.late_ms_total<best.late_ms_total)){best=m;best_orders=[r.order];}
  else if(m.missed_count===best.missed_count&&m.late_ms_total===best.late_ms_total)best_orders.push(r.order);}
 const study={schema:ORDER_STUDY_SCHEMA,domain:input.domain,policy_version:ORDER_POLICY_VERSION,quantum_ms:input.delivery.quantum_ms,
  input,input_digest:orderDigest(input),records,best_orders,representative_order:best_orders[0]};
 return {...study,study_digest:orderDigest(study)};
}
