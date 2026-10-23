import {performDispatchJob} from './dispatch-job.js';
self.addEventListener('message',({data})=>{try{self.postMessage(performDispatchJob(data));}catch(error){self.postMessage({id:data?.id,type:'error',error:String(error.message||error)});}});
