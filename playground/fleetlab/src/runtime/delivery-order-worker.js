import {normalizeOrderInput,orderCanonical,orderDigest} from '../model/delivery-order-contract.js';
import {searchDeliveryOrders} from '../model/delivery-order-search.js';
import {verifyOrderStudy} from '../model/delivery-order-study-verify.js';
import {runDelivery} from '../model/software-delivery.js';
import {verifyDelivery} from '../model/software-delivery-verify.js';
import {deliveryDigest,canonicalDelivery} from '../model/software-delivery-contract.js';
export function checkPublishedOrder(study,entry){
 const v=verifyOrderStudy(study),input=normalizeOrderInput(entry.input);
 const same=(a,b)=>orderCanonical(a)===orderCanonical(b);
 if(!v.ok)throw Error(`Study rejected: ${v.errors.join('; ')}`);
 const best=study.records.find(r=>same(r.order,v.representative_order));
 if(input.delivery.quantum_ms!==1000||entry.input_digest!==orderDigest(input)||v.input_digest!==entry.input_digest||v.study_digest!==entry.study_digest||
  !same(v.best_orders,entry.best_orders)||!same(v.representative_order,entry.representative_order)||!same(best.metrics,entry.best_metrics)||!same(study.records[0].metrics,entry.fcfs_metrics))throw Error('Published study identity or metric mismatch.');
 return v;
}
export function reconstructOrderStudy(entry,progress=()=>{}){
 const started=performance.now();progress('Checking every permitted order');
 const input=normalizeOrderInput(entry.input);if(orderDigest(input)!==entry.input_digest)throw Error('Published input identity mismatch.');
 const study=searchDeliveryOrders(input),verification=checkPublishedOrder(study,entry);
 return {study,verification,compute_ms:Math.round(performance.now()-started)};
}
export function reconstructOrderEqualShare(entry){
 const input=normalizeOrderInput(entry.input),record=runDelivery(input.delivery,'cold'),verification=verifyDelivery(record);
 if(!verification.ok||entry.input_digest!==orderDigest(input)||entry.equal_share.input_digest!==deliveryDigest(input.delivery)||entry.equal_share.record_digest!==record.record_digest||canonicalDelivery(entry.equal_share.metrics)!==canonicalDelivery(verification.metrics))throw Error('Equal-share identity or metric mismatch.');
 return {record,verification};
}
if(typeof WorkerGlobalScope==='function'&&typeof self==='object'&&self instanceof WorkerGlobalScope){
 self.onmessage=event=>{const {token,entry,operation}=event.data;
  try{if(!['study','equal-share'].includes(operation))throw Error('Unsupported operation.');
   const result=operation==='equal-share'?reconstructOrderEqualShare(entry):reconstructOrderStudy(entry,phase=>self.postMessage({token,type:'progress',phase}));self.postMessage({token,type:'done',result});
  }catch(error){self.postMessage({token,type:'error',message:error.message});}
 };
}
