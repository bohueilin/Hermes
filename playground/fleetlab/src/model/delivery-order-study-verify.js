// Coverage is proven by Lehmer ranks, independently of recursive producer enumeration.
import {normalizeOrderInput,orderCanonical,orderDigest,orderFields,ORDER_STUDY_SCHEMA,ORDER_POLICY_VERSION} from './delivery-order-contract.js';
import {verifyOrderRecord} from './delivery-order-verify.js';
export const ORDER_STUDY_VERIFIER_VERSION='fleetlab.delivery-order-study-verifier/1.0.0';
export function verifyOrderStudy(raw){
 let expected=0,verified=0;
 try{
  const s=JSON.parse(orderCanonical(raw));
  orderFields(s,['schema','domain','policy_version','quantum_ms','input','input_digest','records','best_orders','representative_order','study_digest'],'study');
  const input=normalizeOrderInput(s.input),inputText=orderCanonical(input),digest=orderDigest(input),eq=(a,b)=>orderCanonical(a)===orderCanonical(b);
  const require=(v,msg)=>{if(!v)throw Error(msg);};
  require(s.schema===ORDER_STUDY_SCHEMA&&s.domain===input.domain&&s.policy_version===ORDER_POLICY_VERSION&&s.quantum_ms===input.delivery.quantum_ms,'study-version-domain-quantum');
  require(inputText===orderCanonical(s.input)&&s.input_digest===digest,'study-input-identity');
  const ids=input.delivery.requests.map(r=>r.id),factorial=[1,1,2,6,24];expected=factorial[ids.length];
  require(Array.isArray(s.records)&&s.records.length===expected,'incomplete-coverage');
  let bestMiss=Infinity,bestLate=Infinity;const bestOrders=[];
  for(let i=0;i<expected;i++){
   const r=s.records[i];
   require(r.input_digest===digest&&orderCanonical(r.input)===inputText&&r.policy_version===s.policy_version&&r.input.domain===s.domain&&r.input.delivery.quantum_ms===s.quantum_ms,'candidate-workload-binding');
   const checked=verifyOrderRecord(r);require(checked.ok,`candidate-rejected:${i}:${checked.errors.join(';')}`);
   const remaining=[...ids];let rank=0;
   for(const id of r.order){const at=remaining.indexOf(id);require(at>=0,'permutation-id');rank+=at*factorial[remaining.length-1];remaining.splice(at,1);}
   require(rank===i,'coverage-or-canonical-order');verified++;
   const m=checked.metrics;
   if(m.missed_count<bestMiss||(m.missed_count===bestMiss&&m.late_ms_total<bestLate)){bestMiss=m.missed_count;bestLate=m.late_ms_total;bestOrders.length=0;bestOrders.push(r.order);}
   else if(m.missed_count===bestMiss&&m.late_ms_total===bestLate)bestOrders.push(r.order);
  }
  require(eq(s.best_orders,bestOrders)&&eq(s.representative_order,bestOrders[0]),'optimum-or-tie-completeness');
  const {study_digest,...body}=s;require(study_digest===orderDigest(body),'study-digest');
  return {ok:true,errors:[],coverage:{expected,verified,complete:true},best_orders:bestOrders,representative_order:bestOrders[0],input_digest:digest,study_digest};
 }catch(error){return {ok:false,errors:[error.message],coverage:{expected,verified,complete:false},best_orders:null,representative_order:null,input_digest:null,study_digest:null};}
}
