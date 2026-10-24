// Bounded ledger writer (contract C1.5, C2.3; engineering note 8.2, 8.9). One event is atomic: every group of it is
// chunked, measured and guard-checked before any record is kept, so a refusal leaves only the last complete prefix.
import {utf8Length} from './canonical.js';
import {refs} from './identity.js';
export const GUARDS=Object.freeze({maxRecords:100000,maxRecordBytes:16384,maxLedgerBytes:33554432,maxChunkEntries:64});
export class GuardStop extends Error{
 constructor(guard,detail){super(`INCOMPLETE_RESOURCE_LIMIT: ${guard}`);this.code='INCOMPLETE_RESOURCE_LIMIT';this.guard=guard;this.detail=detail;}
}
// Test-only overrides may lower a guard, never raise it.
export function guardLimits(over){
 const g={...GUARDS};
 for(const [k,v]of Object.entries(over??{})){if(!(k in GUARDS)||!Number.isSafeInteger(v)||v<1||v>GUARDS[k])throw new RangeError(`guard override ${k} may only lower the limit`);g[k]=v;}
 return g;
}
// Every record and payload is built with keys in sorted order, so this text equals JCS on the ledger domain (tested).
const text=JSON.stringify,LONGEST='INCOMPLETE_RESOURCE_LIMIT';
export const one=(ev,kind,payload)=>{ev.groups.push({kind,payload});};
export const vec=(ev,kind,rows,make)=>{ev.groups.push({kind,rows,make});};
export function createWriter(header,guards){
 const head=status=>({engine_version:header.engine_version,policy_digest:header.policy_digest,records:[],scenario_digest:header.scenario_digest,schema:header.schema,terminal_status:status,verifier_version:header.verifier_version,workload_digest:header.workload_digest});
 const w={guards,records:[],sum:0,tick:-1,micro:-1,ev:0,grp:0};
 w.reserve=utf8Length(text(head(LONGEST)));
 // Ordinal the next committed group at (tick, microstep) receives; suppressed work consumes none. The stable key orders
// KIND before the group ordinal, so each group carries its own event ordinal (and group ordinal 00) to keep the key
// strictly increasing in processing order.
 w.ordinal=(tick,micro)=>tick===w.tick&&micro===w.micro?w.ev:0;
 w.event=(tick,micro,phase,rank=0)=>({tick,micro,phase,rank,groups:[]});
 w.commit=ev=>commit(w,ev);
 w.ledger=status=>{const h=head(status);h.records=w.records;return h;};
 w.bytes=status=>utf8Length(text(head(status)))+w.sum+Math.max(0,w.records.length-1);
 return w;
}
function commit(w,ev){
 if(!ev.groups.length)return null;
 if(ev.tick!==w.tick||ev.micro!==w.micro){w.tick=ev.tick;w.micro=ev.micro;w.ev=0;w.grp=0;}
 const g=w.guards,recs=[];let seq=w.records.length,add=0;
 ev.groups.forEach((gr,gi)=>{
  const gid=refs.group(ev.tick,ev.micro,w.grp+gi),parts=gr.rows?chunks(w,ev,gr,gid):[gr.payload];
  parts.forEach((payload,ci)=>recs.push({chunk_count:parts.length,chunk_index:ci,class_rank:ev.rank,group_id:gid,kind:gr.kind,microstep:ev.micro,payload,phase:ev.phase,seq:seq++,stable_key:refs.stableKey(w.ev+gi,gr.kind,0,ci),tick:ev.tick}));
 });
 for(const r of recs){const n=utf8Length(text(r));if(n>g.maxRecordBytes)throw new GuardStop('RECORD_BYTES',{kind:r.kind,bytes:n,bound:g.maxRecordBytes});add+=n;}
 const count=w.records.length+recs.length,bytes=w.reserve+w.sum+add+count-1;
 if(count>g.maxRecords)throw new GuardStop('RECORD_COUNT',{records:count,bound:g.maxRecords});
 if(bytes>g.maxLedgerBytes)throw new GuardStop('LEDGER_BYTES',{bytes,bound:g.maxLedgerBytes});
 for(const r of recs)w.records.push(r);
 w.sum+=add;w.ev+=ev.groups.length;w.grp+=ev.groups.length;
 return {first:recs[0].seq,last:recs[recs.length-1].seq};
}
// Vector groups: at most maxChunkEntries rows per chunk and fewer when the record guard requires it. Sizes are measured
// with maximal-width chunk/seq fields, so a measured chunk never grows past the guard once its real fields are known.
function chunks(w,ev,gr,gid){
 const g=w.guards,arrays=gr.rows,n=Math.max(0,...arrays.map(a=>a.length));
 if(!n)return [gr.make(arrays.map(()=>[]))];
 const sz=arrays.map(a=>a.map(x=>utf8Length(text(x))));
 const base=utf8Length(text({chunk_count:100000,chunk_index:99999,class_rank:ev.rank,group_id:gid,kind:gr.kind,microstep:ev.micro,payload:gr.make(arrays.map(()=>[])),phase:ev.phase,seq:99999,stable_key:refs.stableKey(w.ev,gr.kind,0,0),tick:ev.tick}));
 const parts=[];let s=0;
 while(s<n){
  let e=s,size=base;
  while(e<n&&e-s<g.maxChunkEntries){
   let more=0;for(let k=0;k<arrays.length;k++)if(e<arrays[k].length)more+=sz[k][e]+(e>s?1:0);
   if(size+more>g.maxRecordBytes){if(e===s)throw new GuardStop('RECORD_BYTES',{kind:gr.kind,bytes:size+more,bound:g.maxRecordBytes});break;}
   size+=more;e++;
  }
  parts.push(gr.make(arrays.map(a=>a.slice(s,e))));s=e;
 }
 return parts;
}
