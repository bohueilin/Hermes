// Domain-separated, length-framed SHA-256 digests and typed ledger references (contract C1.2, C1.4).
// A digest binds content for internal consistency; it is not producer authenticity.
import {jcs} from './canonical.js';
import {sha256} from '../../core/sha256.js';
import {POLICY_BODY,REFERENCE_EFFORT,REFERENCE_EFFORT_VERSION} from './profiles.js';
const encoder=new TextEncoder();
const hex=b=>{let s='';for(const x of b)s+=(x<16?'0':'')+x.toString(16);return s;};
export function frame(domain,value){
 const d=encoder.encode(domain),j=encoder.encode(jcs(value)),out=new Uint8Array(d.length+9+j.length);
 out.set(d,0);out[d.length]=0;let len=j.length;
 for(let k=7;k>=0;k--){out[d.length+1+k]=len%256;len=Math.floor(len/256);}
 out.set(j,d.length+9);return out;
}
export const H=(domain,value)=>hex(sha256(frame(domain,value)));
export const DIGEST=/^[0-9a-f]{64}$/;
export const workloadProjection=s=>({horizon_tick:s.horizon_tick,arrival_window_tick:s.arrival_window_tick,requirements:s.requirements,task_windows:s.task_windows,vehicle_profile:s.vehicle_profile,content_objects:s.content_objects,visits:s.visits});
export const workloadDigest=s=>H('fleetlab.depot.workload.v1',workloadProjection(s));
export const policyDigest=()=>H('fleetlab.depot.policy.v1',POLICY_BODY);
export function scenarioDigest(s){
 return H('fleetlab.depot.scenario.v1',{schema:s.schema,model_version:s.model_version,profile_version:s.profile_version,workload_digest:workloadDigest(s),policy_digest:policyDigest(),site:s.site,workers:s.workers,network:s.network,services:s.services,vendor:s.vendor,reference_effort_version:REFERENCE_EFFORT_VERSION,reference_effort:REFERENCE_EFFORT});
}
// Internal analytical/checkpoint harness runs can never share a public scenario identity (engineering note BD-02).
export const harnessScenarioDigest=(s,harness)=>H('fleetlab.depot.harness-scenario.v1',{public_scenario_digest:scenarioDigest(s),harness});
export function computeIdentities(s,harness=null){
 const workload_digest=workloadDigest(s),policy_digest=policyDigest();
 return {workload_digest,policy_digest,scenario_digest:harness?harnessScenarioDigest(s,harness):scenarioDigest(s)};
}
export const runDigest=({scenario_digest,engine_version,verifier_version,ledger})=>H('fleetlab.depot.run.v1',{scenario_digest,engine_version,verifier_version,ledger});
export const comparisonDigest=({baseline_run_digest,candidate_run_digest,treatment_deltas,common_reference_effort,metric_version,projection_version})=>H('fleetlab.depot.comparison.v1',{baseline_run_digest,candidate_run_digest,treatment_deltas,common_reference_effort,metric_version,projection_version});
// Typed references (C1.4 and engineering note BD-03). Raw public ids never contain a colon.
const pad=(x,w)=>String(x).padStart(w,'0');
export const refs=Object.freeze({
 visit:id=>`visit:${id}`,position:id=>`position:${id}`,port:id=>`port:${id}`,worker:id=>`worker:${id}`,object:id=>`object:${id}`,
 task:(v,t)=>`task:${v}:${t}`,flow:(v,t)=>`flow:${v}:${t}`,cacheTask:(o,step)=>`task:cache:${o}:${step}`,cacheFlow:o=>`flow:cache:${o}:fetch`,
 lane:k=>`lane:${pad(k,2)}`,client:v=>`client:${v}`,storage:v=>`storage:${v}`,logs:v=>`logs:${v}`,service:s=>`service:${s}`,zone:z=>`zone:${z}`,
 action:(t,m,o)=>`action:${pad(t,6)}:${pad(m,2)}:${pad(o,6)}`,group:(t,m,o)=>`group:${pad(t,6)}:${pad(m,2)}:${pad(o,6)}`,
 stableKey:(e,kind,g,c)=>`${pad(e,6)}:${kind}:${pad(g,2)}:${pad(c,5)}`,
});
export const SYNTHETIC=Object.freeze({site:'site:supply',wanDown:'network:wan_down',wanUp:'network:wan_up',pool:'network:pool',cacheRead:'cache:read',cache:'cache:depot',vendorBay:'vendor:bay:01',vendorWorker:'vendor:worker:01'});
export const rawId=ref=>ref.slice(ref.indexOf(':')+1);
