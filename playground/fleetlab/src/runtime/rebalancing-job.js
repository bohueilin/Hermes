import {defaultInput,hash,canonical} from '../model/rebalancing-contract.js';
import {runRebalancing} from '../model/rebalancing.js';
import {verifyRebalancing,verifyRebalancingStudy} from '../model/rebalancing-verify.js';
import {R1_STUDY} from '../model/rebalancing-study.js';
export function checkedStudy(records){
 const check=verifyRebalancingStudy(records);if(!check.ok)throw Error(check.errors.join('; '));
 if(hash(defaultInput())!==R1_STUDY.inputDigest)throw Error('Recorded input identity differs');
 for(const r of records){const p=R1_STUDY.records[r.policy.id];if(r.digest!==p.digest||r.eventsDigest!==p.eventsDigest||canonical(r.metrics)!==canonical(p.metrics))throw Error('Recorded study expectations differ');}return records;
}
export function performR1Job(message){
 if(!Number.isSafeInteger(message.id)||message.id<1)throw Error('Invalid request identity');
 const input=defaultInput();
 if(message.type==='study'){const records=checkedStudy(['reactive','forecast'].map(p=>runRebalancing(input,p))),manual=runRebalancing(input,'manual',{end:0});if(!verifyRebalancing(manual).ok)throw Error('Initial manual record rejected');return {id:message.id,type:'study',records,manual};}
 if(message.type==='manual'){const record=runRebalancing(input,'manual',{end:message.end,decisions:message.decisions}),check=verifyRebalancing(record);if(!check.ok)throw Error(check.errors.join('; '));return {id:message.id,type:'manual',record};}
 throw Error('Unsupported R1 request');
}
