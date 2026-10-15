import {performR1Job} from './rebalancing-job.js';
self.addEventListener('message',({data})=>{try{self.postMessage(performR1Job(data));}catch(error){self.postMessage({id:data?.id,type:'error',error:String(error.message||error)});}});
