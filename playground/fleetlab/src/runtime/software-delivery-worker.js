import {normalizeDeliveryInput,canonicalDelivery,deliveryDigest} from '../model/software-delivery-contract.js';
import {runDelivery} from '../model/software-delivery.js';
import {verifyDelivery} from '../model/software-delivery-verify.js';

/** Primary quantum only. No record is accepted on generation alone. */
export function reconstructDeliveryPair(entry,progress=()=>{}){
 const started=performance.now();
 const input=normalizeDeliveryInput(entry.input);
 if(input.quantum_ms!==1000||entry.input_digest!==deliveryDigest(input))throw Error('Published input identity mismatch.');
 const records={},verification={};
 for(const policy of ['repeated','cold']){
  progress(`generation: ${policy}`);const record=runDelivery(input,policy);
  progress(`verification: ${policy}`);const checked=verifyDelivery(record);
  if(!checked.ok)throw Error(`Record rejected (${policy}): ${checked.errors.join('; ')}`);
  progress(`hashing: ${policy}`);
  const published=entry.primary?.[policy];
  if(!published||checked.input_digest!==entry.input_digest||checked.record_digest!==published.record_digest)throw Error(`Published record digest mismatch (${policy}).`);
  if(canonicalDelivery(checked.metrics)!==canonicalDelivery(published.metrics))throw Error(`Published metric mismatch (${policy}).`);
  records[policy]=record;verification[policy]=checked;
 }
 return {records,verification,timing:{compute_ms:performance.now()-started}};
}
if(typeof WorkerGlobalScope==='function'&&typeof self==='object'&&self instanceof WorkerGlobalScope){
 self.onmessage=event=>{const {token,entry}=event.data;
  try{const result=reconstructDeliveryPair(entry,phase=>self.postMessage({token,type:'progress',phase}));self.postMessage({token,type:'done',result});}
  catch(error){self.postMessage({token,type:'error',message:error.message});}
 };
}
