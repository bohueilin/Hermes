import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {installFakeDom} from '../../../playground/fleetlab/test/helpers/fake-dom.mjs';
const url=new URL('../web/temporal-candidate.mjs',import.meta.url);
const api=existsSync(url)?await import(url):{};
const fixture=()=>({
 schema:'fleetlab.temporal-view/1.0.0',scope:'SIMULATION_ONLY',decision_authority:'NONE',
 candidate:{pack:'a'.repeat(64),graph:'b'.repeat(64)},
 report:{schema:'fleetlab.temporal-map-candidate/1.0.0',status:'HOLD',candidate_graph_digest:'b'.repeat(64),
  timed_turn_count:175,timed_access_count:32,after:{unsupported_fraction:.00987}},
 engineering:{scope:'ONE_ENGINEERING_CASE',pack_digest:'b'.repeat(64),run_digest:'c'.repeat(64),fleet_size:100,request_count:1200,duration_s:28800,
  recommendation_eligible:false,verification_state:'INTERNALLY_CONSISTENT',finding_count:0,
  execution:{status:'COMPLETE',elapsed_s:1300,peak_rss_bytes:2169552896},
  verification:{status:'COMPLETE',valid:true,elapsed_s:107,peak_rss_bytes:2060730368}},
 review:{qualification:'HOLD',obligation_count:2160,human_samples:{segments:0,od:0}},
});
test('temporal view keeps engineering verification separate from map acceptance',()=>{
 assert.equal(typeof api.validateTemporalView,'function');
 const data=fixture();assert.equal(api.validateTemporalView(data,{candidate_bundle_digest:'a'.repeat(64)}),data);
 assert.equal(data.review.qualification,'HOLD');assert.equal(data.engineering.recommendation_eligible,false);
});
test('foreign graph, fabricated completion, permission and malformed quantities are rejected',()=>{
 assert.equal(typeof api.validateTemporalView,'function');
 for(const change of [d=>d.engineering.pack_digest='f'.repeat(64),d=>d.report.status='PASS',
 d=>d.engineering.verification.valid=false,d=>d.engineering.execution.status='NOT_RUN',
 d=>d.engineering.recommendation_eligible=true,d=>d.engineering.fleet_size=null,
 d=>d.review.human_samples.od=-1,d=>d.decision_authority='DEPLOY',d=>delete d.engineering.run_digest]){
  const d=fixture();change(d);assert.throws(()=>api.validateTemporalView(d,{candidate_bundle_digest:'a'.repeat(64)}));
 }
 assert.throws(()=>api.validateTemporalView(fixture(),{candidate_bundle_digest:'c'.repeat(64)}));
});
test('complete sources link resolves to shared hosted offer from a versioned viewer',()=>{
 const restore=installFakeDom();
 try{
  const host=document.createElement('section');document.body.append(host);
  api.mountTemporalProgress(host,fixture());
  const link=[...host.querySelectorAll('a')].find(a=>a.textContent==='Complete map sources ↗');
  assert.equal(new URL(link.href,'https://fleetlab.pages.dev/city-explorer/releases/abc/').pathname,'/city-explorer/sources/');
 }finally{restore();}
});
