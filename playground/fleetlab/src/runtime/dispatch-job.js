import {fixture} from '../model/dispatch-contract.js';
import {runDispatch} from '../model/dispatch.js';
import {verifyDispatch,verifyStudy} from '../model/dispatch-verify.js';
export function performDispatchJob(m){
 if(!Number.isSafeInteger(m.id)||m.id<1)throw Error('Invalid job identity');const input=fixture(m.fixture);
 if(m.type==='study'){const records=['greedy','joint'].map(p=>runDispatch(input,p)),manual=runDispatch(input,'manual',{end:0});if(!verifyStudy(records,input).ok||!verifyDispatch(manual).ok)throw Error('Study reconstruction rejected');return {id:m.id,type:m.type,fixture:m.fixture,records,manual};}
 if(m.type==='manual'){const record=runDispatch(input,'manual',{end:m.end,decisions:m.decisions}),check=verifyDispatch(record);if(!check.ok)throw Error(check.errors.join('; '));return {id:m.id,type:m.type,fixture:m.fixture,record};}throw Error('Unknown job');
}
