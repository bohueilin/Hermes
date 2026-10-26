// Ledger mutation helpers for the depot lab negative tests (annex C4): apply one semantic mutation, then renumber seq,
// group ordinals, stable keys, chunk metadata, action ids and observation references and rebind the digest chain, so
// that only the intended invariant breaks.
import {H as digest,refs} from '../../src/model/depot-lab/identity.js';
export const clone=v=>JSON.parse(JSON.stringify(v));
let fresh=0;
// A new standalone record; renumber() assigns its seq, ordinal, keys and group.
export const record=(tick,phase,kind,payload)=>({seq:-1,tick,microstep:phase<=1?0:1,phase,class_rank:kind==='ARRIVAL'?2:kind==='SHIFT_CHANGE'?(payload.available?1:0):0,stable_key:'',group_id:`group:new:${++fresh}`,chunk_index:0,chunk_count:1,kind,payload});
export function renumber(ledger,{chunks=true,rechain=true}={}){
 const recs=ledger.records,groups=[];
 for(const r of recs){const g=groups[groups.length-1];if(g&&g.id===r.group_id&&g.kind===r.kind)g.recs.push(r);else groups.push({id:r.group_id,kind:r.kind,recs:[r]});}
 const ord=new Map(),actions=new Map();
 for(const g of groups){
  const r0=g.recs[0],tm=`${r0.tick}/${r0.microstep}`,o=ord.has(tm)?ord.get(tm)+1:0;ord.set(tm,o);
  const first=r0.kind==='POLICY_DECISION'||r0.kind==='TASK_TRANSITION'&&r0.phase===2&&r0.payload.transition==='START';
  if(first&&!actions.has(r0.payload.action_id))actions.set(r0.payload.action_id,refs.action(r0.tick,r0.microstep,o));
  g.recs.forEach((r,i)=>{if(chunks){r.chunk_index=i;r.chunk_count=g.recs.length;}r.group_id=refs.group(r.tick,r.microstep,o);r.stable_key=refs.stableKey(o,r.kind,0,r.chunk_index);});
 }
 const old=new Map(recs.map(r=>[r,r.seq]));recs.forEach((r,i)=>{r.seq=i;});
 const remap=new Map();for(const g of groups)if(g.kind==='OBSERVATION'){const l=g.recs[g.recs.length-1];remap.set(old.get(l),l.seq);}
 for(const r of recs){
  const p=r.payload;
  if(p.action_id!==undefined&&actions.has(p.action_id))p.action_id=actions.get(p.action_id);
  if(p.observation_seq!==undefined&&p.observation_seq!==null&&remap.has(p.observation_seq))p.observation_seq=remap.get(p.observation_seq);
  if(p.base_observation_seq!==undefined&&p.base_observation_seq!==null&&remap.has(p.base_observation_seq))p.base_observation_seq=remap.get(p.base_observation_seq);
 }
 if(rechain){
  let prev=null,last=null;
  for(const g of groups){
   if(g.kind==='OBSERVATION'){const d=digest('fleetlab.depot.observation-state.v1',{previous:prev,facts:g.recs.flatMap(r=>r.payload.facts)});for(const r of g.recs){r.payload.state_digest=d;r.payload.base_observation_seq=last;}prev=d;last=g.recs[g.recs.length-1].seq;}
   if(g.kind==='HORIZON'){const cat=k=>g.recs.flatMap(r=>r.payload[k]),d=digest('fleetlab.depot.horizon-state.v1',{observation:prev,released:cat('released_visit_ids'),unreleased:cat('unreleased_visit_ids')});for(const r of g.recs)r.payload.derived_state_digest=d;}
  }
  // Decisions and phase-4 transitions reference the last complete observation before them.
  let ref=null;for(const r of recs){if(r.kind==='OBSERVATION'&&r.chunk_index===r.chunk_count-1)ref=r.seq;else if(r.kind==='POLICY_DECISION'||r.kind==='TASK_TRANSITION'&&r.phase===4)r.payload.observation_seq=ref;}
 }
 return ledger;
}
export const at=(ledger,pred)=>{const i=ledger.records.findIndex(pred);if(i<0)throw new Error('mutation target not found');return i;};
export const where=(ledger,pred)=>ledger.records[at(ledger,pred)];
export const remove=(ledger,pred)=>{ledger.records.splice(at(ledger,pred),1);return ledger;};
export const insertAfter=(ledger,pred,...rs)=>{ledger.records.splice(at(ledger,pred)+1,0,...rs);return ledger;};
export const insertBefore=(ledger,pred,...rs)=>{ledger.records.splice(at(ledger,pred),0,...rs);return ledger;};
export const task=(id,transition)=>r=>r.kind==='TASK_TRANSITION'&&r.payload.task_id===id&&(!transition||r.payload.transition===transition);
export const decision=id=>r=>r.kind==='POLICY_DECISION'&&r.payload.task_id===id;
export const deltaOf=action=>r=>r.kind==='RESOURCE_DELTA'&&r.payload.action_id===action;
