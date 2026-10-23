import {verifyOrderStudy} from '../model/delivery-order-study-verify.js';
import {orderCanonical} from '../model/delivery-order-contract.js';
import {verifyDelivery} from '../model/software-delivery-verify.js';
export function createOrderJob({createWorker,onProgress=()=>{},timeoutMs=15000}){
 let serial=0,active=null;
 const cancel=()=>{if(!active)return;const a=active;active=null;clearTimeout(a.timer);a.worker.terminate();a.reject(Error('Computation cancelled.'));};
 return {cancel,run(entry,operation='study'){cancel();const token=++serial;
  return new Promise((resolve,reject)=>{
   let worker;try{worker=createWorker();}catch(e){reject(e);return;}
   const finish=(error,result)=>{if(active?.token!==token)return;clearTimeout(active.timer);active=null;worker.terminate();if(error)reject(error);else resolve(result);};
   active={token,worker,reject,timer:setTimeout(()=>finish(Error('Computation timed out.')),timeoutMs)};
   worker.onerror=()=>finish(Error('The lesson worker could not finish. Try again.'));
   worker.onmessage=event=>{const m=event.data;if(active?.token!==token||m?.token!==token)return;
    if(m.type==='progress')onProgress(m.phase);else if(m.type==='error')finish(Error(m.message));
    else if(m.type==='done'){try{
     const result=m.result,v=operation==='study'?verifyOrderStudy(result.study):verifyDelivery(result.record),same=(a,b)=>orderCanonical(a)===orderCanonical(b);
     if(!v.ok)throw Error(`Returned record rejected: ${v.errors.join('; ')}`);
     if(operation==='study'){
      if(v.study_digest!==entry.study_digest||v.input_digest!==entry.input_digest||!same(result.study.input,entry.input)||!same(v.best_orders,entry.best_orders))throw Error('Returned study identity mismatch.');
     }else if(v.input_digest!==entry.equal_share.input_digest||v.record_digest!==entry.equal_share.record_digest)throw Error('Returned equal-share identity mismatch.');
     finish(null,{...result,verification:v});
    }catch(error){finish(error);}}
   };
   try{worker.postMessage({token,entry,operation});}catch(error){finish(error);}
  });
 }};
}
