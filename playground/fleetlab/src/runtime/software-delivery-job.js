// One owned worker per job. Cancellation terminates synchronous generation, replay or hashing.
export function createDeliveryJob({createWorker,onProgress=()=>{}}){
 let serial=0,active=null;
 const cancel=()=>{if(!active)return;const job=active;active=null;job.worker.terminate();job.reject(Error('Computation cancelled.'));};
 return {cancel,run(entry){cancel();const token=++serial;
  return new Promise((resolve,reject)=>{
   let worker;try{worker=createWorker();}catch(error){reject(error);return;}
   active={worker,reject,token};
   const finish=(error,result)=>{if(active?.token!==token)return;active=null;worker.terminate();if(error)reject(error);else resolve(result);};
   worker.onmessage=event=>{const m=event.data;if(active?.token!==token||m?.token!==token)return;
    if(m.type==='progress')onProgress(m.phase);else if(m.type==='done')finish(null,m.result);else if(m.type==='error')finish(Error(m.message));
   };
   worker.onerror=()=>finish(Error('The comparison worker could not finish. Try Watch comparison again.'));
   worker.postMessage({token,entry});
  });
 }};
}
