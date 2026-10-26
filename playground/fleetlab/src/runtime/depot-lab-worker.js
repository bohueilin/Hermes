// Depot lab worker entry (engineering note §14). Binds only inside a worker scope; one run per fresh worker, and the
// job shape-checks every inbound message before reading a field. Cancel is the page terminating this worker.
import {runDepotJob} from './depot-lab-job.js';
import {createDepotRun,stepDepotRun} from '../model/depot-lab/engine.js';
import {verifyDepotRun} from '../model/depot-lab-verify/verify.js';
import {compareDepotRuns} from '../model/depot-lab/compare.js';
export const DEPOT_MODEL=Object.freeze({createDepotRun,stepDepotRun,verifyDepotRun,compareDepotRuns});
if(typeof WorkerGlobalScope==='function'&&typeof self==='object'&&self instanceof WorkerGlobalScope){
 let used=false;
 self.onmessage=event=>{
  if(used){self.postMessage({type:'refused',id:null,generation:null,reason:'worker_already_used',issues:[]});return;}
  used=true;
  self.postMessage(runDepotJob(event?.data,{...DEPOT_MODEL,onProgress:message=>self.postMessage(message)}));
 };
}
