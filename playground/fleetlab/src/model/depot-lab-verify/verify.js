// Independent verification of a depot lab run (D1-06, C1.5, note 10): envelope binding, record shape, order and chunk
// groups, then an independent semantic replay. Only VERIFIED carries the immutable projection; INVALID quarantines it.
// Verification establishes internal consistency only, never authenticity, authorization or deployment permission.
import {jcs,utf8Length,deepFreeze} from '../depot-lab/canonical.js';
import {computeIdentities,runDigest,refs} from '../depot-lab/identity.js';
import {validateScenario} from '../depot-lab/schema.js';
import {parseRational} from '../depot-lab/rational.js';
import {ENGINE_VERSION,VERIFIER_VERSION,PROJECTION_VERSION,METRIC_VERSION,LEDGER_SCHEMA,REASON_CODES} from '../depot-lab/profiles.js';
import {buildModel,replay,Violation} from './reconstruct.js';
import {createRecorder} from './metrics.js';
export const VERIFICATION_SCHEMA='fleetlab.depot.verification.v1';
export const LEDGER_LIMITS=Object.freeze({records:100000,recordBytes:16384,ledgerBytes:33554432,entries:64});
const ID=/^[A-Za-z][A-Za-z0-9:_-]{0,95}$/,KEY=/^[A-Za-z0-9:_-]{1,160}$/,DIG=/^[0-9a-f]{64}$/,VER=/^[A-Za-z0-9._+-]{1,96}$/,RAT=/^(0|[1-9][0-9]{0,255})\/[1-9][0-9]{0,255}$/,VAL=/^[A-Za-z0-9:_-]{1,96}$/;
const RECORD=['seq','tick','microstep','phase','class_rank','stable_key','group_id','chunk_index','chunk_count','kind','payload'];
const HEADER=['schema','scenario_digest','workload_digest','policy_digest','engine_version','verifier_version','terminal_status','records'];
const FIELDS=['arrived','arrival_tick','due_tick','mandatory','size_bytes','location_id','position_owner_task_id','resource_owner_task_id','worker_available','task_state','prerequisite_ready_tick','energy_mj','remaining_bytes','content_state','endpoint_reachable','entitlement','first_eligible_task_id','minimum_remaining_ticks'];
const CONTENT=['RESERVED','RECEIVED_PROVISIONAL','OBJECT_COMPLETE','CHECK_COMPLETE','ACTIVATION_COMPLETE','POSTCHECK_COMPLETE','DURABLE_ACKNOWLEDGED','RECLAIMED'];
const plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const obj=(v,k)=>plain(v)&&Object.keys(v).length===k.length&&k.every(x=>Object.hasOwn(v,x));
const int=(v,lo,hi)=>Number.isSafeInteger(v)&&v>=lo&&v<=hi;
const id=v=>typeof v==='string'&&v.length<=96&&ID.test(v),ids=v=>Array.isArray(v)&&v.length<=64&&v.every(id)&&new Set(v).size===v.length;
const tick=v=>int(v,0,172800),uint=v=>int(v,0,9007199254740991),seqOr=v=>v===null||int(v,0,99999);
const rat=v=>typeof v==='string'&&v.length<=513&&RAT.test(v),list=(v,lo,hi,f)=>Array.isArray(v)&&v.length>=lo&&v.length<=hi&&v.every(f);
const PAYLOAD={
 ARRIVAL:p=>obj(p,['visit_id'])&&id(p.visit_id),
 SHIFT_CHANGE:p=>obj(p,['worker_id','available'])&&id(p.worker_id)&&typeof p.available==='boolean',
 WINDOW_OPEN:p=>obj(p,['task_id'])&&id(p.task_id),
 TASK_TRANSITION:p=>obj(p,['task_id','transition','action_id','observation_seq'])&&id(p.task_id)&&['START','COMPLETE','PAUSE','RESUME','CANCEL'].includes(p.transition)&&id(p.action_id)&&seqOr(p.observation_seq),
 RESOURCE_DELTA:p=>obj(p,['action_id','changes'])&&id(p.action_id)&&list(p.changes,1,32,c=>obj(c,['resource_id','owner_task_id','change'])&&id(c.resource_id)&&id(c.owner_task_id)&&['RESERVE','ACQUIRE','RELEASE'].includes(c.change)),
 ALLOCATION_DELTA:p=>obj(p,['changes'])&&list(p.changes,1,64,c=>obj(c,['flow_id','rate','unit','resource_path','tight_resource_ids'])&&id(c.flow_id)&&rat(c.rate)&&['mJ_per_tick','bytes_per_tick'].includes(c.unit)&&ids(c.resource_path)&&ids(c.tight_resource_ids)),
 PROGRESS:p=>obj(p,['changes'])&&list(p.changes,1,64,c=>obj(c,['flow_id','from_tick','to_tick','allocation_anchor_tick','anchor_credited_before','anchor_credited_after','credited','quantization_slack','undrawn_final_tick'])&&id(c.flow_id)&&tick(c.from_tick)&&tick(c.to_tick)&&tick(c.allocation_anchor_tick)&&uint(c.anchor_credited_before)&&uint(c.anchor_credited_after)&&uint(c.credited)&&rat(c.quantization_slack)&&rat(c.undrawn_final_tick)),
 CONTENT_TRANSITION:p=>obj(p,['owner_id','object_id','transition','bytes'])&&id(p.owner_id)&&id(p.object_id)&&CONTENT.includes(p.transition)&&uint(p.bytes),
 OBSERVATION:p=>obj(p,['base_observation_seq','facts','state_digest'])&&seqOr(p.base_observation_seq)&&list(p.facts,0,64,f=>obj(f,['entity_id','field','value'])&&id(f.entity_id)&&FIELDS.includes(f.field)&&(f.value===null||typeof f.value==='boolean'||uint(f.value)||typeof f.value==='string'&&VAL.test(f.value)))&&typeof p.state_digest==='string'&&DIG.test(p.state_digest),
 POLICY_DECISION:p=>obj(p,['action_id','task_id','observation_seq','accepted','reasons','blockage_group_id'])&&id(p.action_id)&&id(p.task_id)&&int(p.observation_seq,0,99999)&&typeof p.accepted==='boolean'&&list(p.reasons,0,14,r=>obj(r,['code','resource_ids','holder_visit_ids'])&&REASON_CODES.includes(r.code)&&ids(r.resource_ids)&&ids(r.holder_visit_ids))&&(p.blockage_group_id===null||id(p.blockage_group_id)),
 BLOCKAGE:p=>obj(p,['classification','member_visit_ids','held_resource_ids','unmet_alternatives','enabling_event_seq','enabling_event_key','next_tick','terminal_holder_id'])&&['STALL','TERMINAL_BLOCKAGE_BEFORE_H','DEADLOCK_DECLARED'].includes(p.classification)&&ids(p.member_visit_ids)&&ids(p.held_resource_ids)&&list(p.unmet_alternatives,0,64,a=>obj(a,['visit_id','task_id','all_required_resources','blocking_holder_visit_ids'])&&id(a.visit_id)&&id(a.task_id)&&ids(a.all_required_resources)&&ids(a.blocking_holder_visit_ids))&&seqOr(p.enabling_event_seq)&&(p.enabling_event_key===null||typeof p.enabling_event_key==='string'&&KEY.test(p.enabling_event_key))&&(p.next_tick===null||tick(p.next_tick))&&(p.terminal_holder_id===null||id(p.terminal_holder_id)),
 HORIZON:p=>obj(p,['arrived_visit_ids','released_visit_ids','unreleased_visit_ids','derived_state_digest'])&&ids(p.arrived_visit_ids)&&ids(p.released_visit_ids)&&ids(p.unreleased_visit_ids)&&typeof p.derived_state_digest==='string'&&DIG.test(p.derived_state_digest),
};
const shape=r=>obj(r,RECORD)&&int(r.seq,0,99999)&&tick(r.tick)&&int(r.microstep,0,64)&&int(r.phase,0,6)&&int(r.class_rank,0,31)&&typeof r.stable_key==='string'&&KEY.test(r.stable_key)&&id(r.group_id)&&int(r.chunk_index,0,99999)&&int(r.chunk_count,1,100000)&&Object.hasOwn(PAYLOAD,r.kind)&&PAYLOAD[r.kind](r.payload);
const PHASE_KINDS=[['PROGRESS','TASK_TRANSITION','RESOURCE_DELTA','CONTENT_TRANSITION'],['SHIFT_CHANGE','ARRIVAL'],['WINDOW_OPEN','TASK_TRANSITION','CONTENT_TRANSITION'],['OBSERVATION'],['POLICY_DECISION','TASK_TRANSITION','RESOURCE_DELTA','CONTENT_TRANSITION'],['PROGRESS','ALLOCATION_DELTA'],['PROGRESS','CONTENT_TRANSITION','BLOCKAGE','HORIZON']];
const CHUNKED=new Set(['OBSERVATION','PROGRESS','ALLOCATION_DELTA','POLICY_DECISION','BLOCKAGE','HORIZON']);
const same=(a,b,keys)=>keys.every(k=>a[k]===b[k]);
// Parallel-slice reassembly (BD-E12): vector slices concatenate in chunk order, scalars and parallel entries repeat.
function merge(kind,a,b){
 if(kind==='OBSERVATION'){if(!same(a,b,['base_observation_seq','state_digest']))return false;a.facts.push(...b.facts);}
 else if(kind==='PROGRESS'||kind==='ALLOCATION_DELTA')a.changes.push(...b.changes);
 else if(kind==='HORIZON'){if(a.derived_state_digest!==b.derived_state_digest)return false;for(const k of ['arrived_visit_ids','released_visit_ids','unreleased_visit_ids'])a[k].push(...b[k]);}
 else if(kind==='POLICY_DECISION'){if(!same(a,b,['action_id','task_id','observation_seq','accepted','blockage_group_id'])||a.reasons.length!==b.reasons.length)return false;for(let i=0;i<a.reasons.length;i++){if(a.reasons[i].code!==b.reasons[i].code)return false;a.reasons[i].resource_ids.push(...b.reasons[i].resource_ids);a.reasons[i].holder_visit_ids.push(...b.reasons[i].holder_visit_ids);}}
 else{if(!same(a,b,['classification','enabling_event_seq','enabling_event_key','next_tick','terminal_holder_id'])||a.unmet_alternatives.length!==b.unmet_alternatives.length)return false;a.member_visit_ids.push(...b.member_visit_ids);a.held_resource_ids.push(...b.held_resource_ids);for(let i=0;i<a.unmet_alternatives.length;i++){const x=a.unmet_alternatives[i],y=b.unmet_alternatives[i];if(!same(x,y,['visit_id','task_id']))return false;x.all_required_resources.push(...y.all_required_resources);x.blocking_holder_visit_ids.push(...y.blocking_holder_visit_ids);}}
 return true;
}
// Per record, in order: shape, seq, key order, chunk group, size, canonical rationals (note 10.2).
function structure(records){
 const groups=[],lastOrd=new Map();let prev=null,cur=null;
 const fail=(code,detail,r)=>{throw new Violation(code,detail,{seq:Number.isSafeInteger(r?.seq)?r.seq:null,tick:Number.isSafeInteger(r?.tick)?r.tick:null});};
 records.forEach((r,i)=>{
  if(!shape(r))fail('RECORD_SCHEMA_INVALID',`record ${i}`,r);
  if(r.seq!==i)fail('SEQ_INVALID',`record ${i} carries seq ${r.seq}`,r);
  const k=[r.tick,r.microstep,r.phase,r.class_rank];
  if(prev){const d=k.map((x,j)=>x-prev[j]).find(x=>x!==0);if(d<0||d===undefined&&!(r.stable_key>prev[4]))fail('RECORD_ORDER_INVALID',`key of record ${i}`,r);}
  prev=[...k,r.stable_key];
  const m=/^(\d{6}):([A-Z_]+):(\d{2}):(\d{5})$/.exec(r.stable_key),ord=m?Number(m[1]):-1,tm=`${r.tick}/${r.microstep}`;
  const rank=r.kind==='ARRIVAL'?2:r.kind==='SHIFT_CHANGE'?(r.payload.available?1:0):0;
  if(!m||m[2]!==r.kind||m[3]!=='00'||r.microstep!==(r.phase<=1?0:1)||r.class_rank!==rank||!PHASE_KINDS[r.phase].includes(r.kind)||r.group_id!==refs.group(r.tick,r.microstep,ord))fail('RECORD_ORDER_INVALID',`stable key or group of record ${i}`,r);
  if(Number(m[4])!==r.chunk_index)fail('CHUNK_GROUP_INVALID',`chunk index of record ${i}`,r);
  if(r.chunk_index===0){
   if(cur)fail('CHUNK_GROUP_INVALID',`group ${cur.id} is missing chunks`,r);
   if(ord!==(lastOrd.has(tm)?lastOrd.get(tm)+1:0))fail('RECORD_ORDER_INVALID',`group ordinal of record ${i}`,r);
   if(r.chunk_count>1&&!CHUNKED.has(r.kind))fail('CHUNK_GROUP_INVALID',`${r.kind} cannot be chunked`,r);
   lastOrd.set(tm,ord);cur={id:r.group_id,kind:r.kind,tick:r.tick,ms:r.microstep,phase:r.phase,ord,seq:i,last:i,n:r.chunk_count,p:JSON.parse(JSON.stringify(r.payload))};
  }else if(!cur||cur.id!==r.group_id||cur.kind!==r.kind||cur.n!==r.chunk_count||r.chunk_index!==i-cur.seq||!merge(r.kind,cur.p,r.payload))fail('CHUNK_GROUP_INVALID',`chunk ${r.chunk_index} of ${r.group_id}`,r);
  if(utf8Length(jcs(r))>LEDGER_LIMITS.recordBytes)fail('RECORD_SIZE_LIMIT',`record ${i} exceeds 16,384 bytes`,r);
  const rats=r.kind==='ALLOCATION_DELTA'?r.payload.changes.map(c=>c.rate):r.kind==='PROGRESS'?r.payload.changes.flatMap(c=>[c.quantization_slack,c.undrawn_final_tick]):[];
  if(rats.some(x=>parseRational(x)===null))fail('NONCANONICAL_RATIONAL',`record ${i}`,r);
  cur.last=i;if(r.chunk_index===r.chunk_count-1){groups.push(cur);cur=null;}
 });
 if(cur)fail('CHUNK_GROUP_INVALID',`group ${cur.id} is missing chunks`,records[records.length-1]);
 return groups;
}
// verifyDepotRun(scenario, ledger, {harness}) -> VerificationEnvelope (note 10.5). The harness binds a separate digest.
export function verifyDepotRun(scenario,ledger,{harness=null}={}){
 const versions={engine:ENGINE_VERSION,verifier:VERIFIER_VERSION,projection:PROJECTION_VERSION,metric:METRIC_VERSION};
 const digests={scenario:null,workload:null,policy:null,run:null},info={records:null,bytes:null,terminal_status:null,guard:null};
 const env=(status,primary_violation=null,projection=null)=>deepFreeze({schema:VERIFICATION_SCHEMA,status,consistency:status==='VERIFIED'?'INTERNALLY_CONSISTENT':status==='INVALID'?'INVALID_EVIDENCE':'NOT_AVAILABLE',primary_violation,digests,versions,
  trust:{authenticity:'NOT_AUTHENTICATED',authorization:'NOT_EVALUATED',deployment_permission:'NONE',evidence:'NOT_EVIDENCE'},ledger:info,projection});
 const invalid=(code,detail,at=null)=>env('INVALID',{code,seq:at?.seq??null,tick:at?.tick??null,detail:String(detail).slice(0,240)});
 const v=validateScenario(scenario,{origin:'import'});if(!v.ok)return invalid('ENVELOPE_INVALID','the scenario does not validate');
 let M;try{M=buildModel(v.scenario,harness);}catch{return invalid('ENVELOPE_INVALID','the harness does not compile');}
 const ids=computeIdentities(v.scenario,harness);Object.assign(digests,{scenario:ids.scenario_digest,workload:ids.workload_digest,policy:ids.policy_digest});
 if(!obj(ledger,HEADER)||!Array.isArray(ledger.records))return invalid('ENVELOPE_INVALID','ledger header shape');
 let text;try{text=jcs(ledger);}catch{return invalid('ENVELOPE_INVALID','the ledger is not canonical plain data');}
 Object.assign(info,{records:ledger.records.length,bytes:utf8Length(text),terminal_status:ledger.terminal_status});
 if(ledger.schema!==LEDGER_SCHEMA||!['scenario_digest','workload_digest','policy_digest'].every(k=>typeof ledger[k]==='string'&&DIG.test(ledger[k]))||!['engine_version','verifier_version'].every(k=>typeof ledger[k]==='string'&&VER.test(ledger[k]))||!['COMPLETE','INCOMPLETE_RESOURCE_LIMIT','CANCELLED'].includes(ledger.terminal_status))return invalid('ENVELOPE_INVALID','ledger header values');
 if(info.records>LEDGER_LIMITS.records||info.bytes>LEDGER_LIMITS.ledgerBytes)return invalid('RECORD_SIZE_LIMIT','ledger exceeds its record or byte guard');
 if(ledger.scenario_digest!==ids.scenario_digest||ledger.workload_digest!==ids.workload_digest||ledger.policy_digest!==ids.policy_digest)return invalid('BINDING_MISMATCH','header digests do not bind this scenario');
 if(ledger.engine_version!==ENGINE_VERSION||ledger.verifier_version!==VERIFIER_VERSION)return invalid('VERSION_MISMATCH','engine or verifier version');
 try{
  const groups=structure(ledger.records);
  if(ledger.terminal_status!=='COMPLETE')return groups.some(g=>g.kind==='HORIZON')?invalid('TERMINAL_STATUS_MISMATCH','an incomplete ledger carries horizon accounting'):env(ledger.terminal_status);
  const rec=createRecorder(M),S=replay(M,groups,rec);
  digests.run=runDigest({scenario_digest:ids.scenario_digest,engine_version:ENGINE_VERSION,verifier_version:VERIFIER_VERSION,ledger});
  return env('VERIFIED',null,rec.project(S));
 }catch(e){
  if(e instanceof Violation)return invalid(e.code,e.detail,e.at);
  // An exact intermediate beyond the bounded-arithmetic guard is an explicit resource limit, never a rounded check.
  if(e?.reason==='RATIONAL_GUARD'){info.guard={guard:'RATIONAL_GUARD',detail:String(e.detail).slice(0,240)};return env('INCOMPLETE_RESOURCE_LIMIT');}
  throw e;
 }
}
