// Share, import and export (A41): ordered gates with exact limits, zero model starts on refusal, rerun-and-verify
// reproduction, "Could not reproduce" on any digest mismatch, and the three honesty strings in every export.
import test from 'node:test';import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import * as codec from '../src/ui/depot-lab-share.js';
import {HONESTY,MAX_SHARE_CHARS,MAX_ENVELOPE_BYTES,encodeShare,decodeShare,decodeShareText,buildConfigurationExport,buildResultSummary,toBase64url,fromBase64url} from '../src/ui/depot-lab-share.js';
import {createDepotSession} from '../src/runtime/depot-lab-session.js';
import {runDepotJob} from '../src/runtime/depot-lab-job.js';
import {compareDepotRuns,VERIFICATION_SCHEMA} from '../src/model/depot-lab/compare.js';
import {preset,defaultScenario} from '../src/model/depot-lab/presets.js';
import {validateScenario} from '../src/model/depot-lab/schema.js';
import {scenarioDigest,workloadDigest,policyDigest,H} from '../src/model/depot-lab/identity.js';
import {jcs,utf8Length} from '../src/model/depot-lab/canonical.js';
import {ENGINE_VERSION,VERIFIER_VERSION,PROJECTION_VERSION,METRIC_VERSION} from '../src/model/depot-lab/profiles.js';
const valid=s=>validateScenario(s,{origin:'import'}).scenario;
const C=(id,direction,value)=>({id,direction,value});
const fake={
 createDepotRun:s=>({s}),
 stepDepotRun:c=>({done:true,ledger:{schema:'fleetlab.depot.ledger.v1',scenario_digest:scenarioDigest(c.s),records:[]},terminal_status:'COMPLETE',guard:null}),
 verifyDepotRun(s,ledger){const d=scenarioDigest(s);return {schema:VERIFICATION_SCHEMA,status:'VERIFIED',consistency:'INTERNALLY_CONSISTENT',primary_violation:null,
  digests:{scenario:d,workload:workloadDigest(s),policy:policyDigest(),run:H('fleetlab.test.run.v1',{scenario_digest:d,ledger})},versions:{engine:ENGINE_VERSION,verifier:VERIFIER_VERSION,projection:PROJECTION_VERSION,metric:METRIC_VERSION},
  trust:{authenticity:'NOT_AUTHENTICATED',authorization:'NOT_EVALUATED',deployment_permission:'NONE',evidence:'NOT_EVIDENCE'},ledger:{records:0,bytes:1,terminal_status:'COMPLETE',guard:null},
  projection:{version:PROJECTION_VERSION,metrics:{'release.on_time_count':s.site.ports.length,'visit.overdue_s':1},vector:{classes:[],components:[C('on_time_count','up',s.site.ports.length),C('overdue_seconds','down',1),C('observed_visit_seconds','down',1),C('unreleased_count','down',0),C('remaining_required_kWh','down',0),C('remaining_required_bytes','down',0)]}}};},
 compareDepotRuns,
};
function harness(options){
 const workers=[];
 const s=createDepotSession({workerFactory:()=>{const w={posted:[],postMessage(m){this.posted.push(m);},terminate(){}};workers.push(w);return w;},codec,...options});
 const runAndFinish=mode=>{s.run(mode);const w=workers.at(-1);w.onmessage({data:runDepotJob(w.posted[0],fake)});return s.get();};
 return {s,workers,runAndFinish};
}
const textOf=fragment=>new TextDecoder().decode(fromBase64url(fragment.slice('#share='.length)));
const remake=(text,f)=>{const e=JSON.parse(text);f(e);return jcs(e);};
const asFragment=text=>`#share=${toBase64url(new TextEncoder().encode(text))}`;
const flipFirst=d=>(d[0]==='0'?'1':'0')+d.slice(1);

test('the three honesty strings are the D1-11 strings, byte for byte, with one em dash and two middle dots',()=>{
 const annex=new URL('../../../docs/FLEETLAB_DEPOT_READINESS_FREEZE_CANDIDATE_2026-10-24.md',import.meta.url);
 if(existsSync(annex)){const quoted=readFileSync(annex,'utf8').split('\n').filter(l=>l.startsWith('> ')&&l.length>2).map(l=>l.slice(2));assert.deepEqual([...HONESTY],quoted.slice(0,3));}
 assert.equal([...HONESTY.join('')].filter(c=>c==='\u2014').length,1);assert.equal([...HONESTY.join('')].filter(c=>c==='\u2013').length,0);
 assert.ok(HONESTY[0].includes(' \u2014 not evidence'));assert.equal([...HONESTY[1]].filter(c=>c==='·').length,2);
});

test('a baseline-only share round-trips; the pair B share exceeds the transport limit and offers export instead',()=>{
 const base=valid(defaultScenario()),r=encodeShare({arms:{baseline:base,candidate:null}});
 assert.ok(r.ok);assert.ok(r.length<=MAX_SHARE_CHARS);assert.ok(r.fragment.startsWith('#share='));
 const d=decodeShare(r.fragment);assert.ok(d.ok);assert.equal(d.digests.baseline,scenarioDigest(base));assert.equal(d.arms.candidate,null);
 const p=preset('B'),pair={arms:{baseline:valid(p.baseline),candidate:valid(p.candidate)}},big=encodeShare(pair);
 assert.equal(big.ok,false);assert.equal(big.code,'SHARE_TOO_LARGE');assert.equal(big.offer,'export');assert.ok(big.issues[0].value>MAX_SHARE_CHARS);
 const file=buildConfigurationExport(pair);assert.ok(file.ok);assert.equal(file.filename,'fleetlab-depot-configuration.json');
 const back=decodeShareText(file.text);assert.ok(back.ok);assert.equal(back.digests.candidate,scenarioDigest(pair.arms.candidate));assert.equal(back.compatibility.treatment.fields.length,2);
});

test('transport gate: 32,768 base64url characters pass to the next gate, 32,769 are refused first',()=>{
 for(const prefix of ['','#share=']){
  const ok=decodeShare(prefix+'A'.repeat(32768));assert.equal(ok.ok,false);assert.notEqual(ok.gate,'transport');assert.equal(ok.gate,'parse');
  const no=decodeShare(prefix+'A'.repeat(32769));assert.equal(no.gate,'transport');assert.equal(no.code,'TRANSPORT_LIMIT');assert.deepEqual(no.issues[0],{code:'TRANSPORT_LIMIT',path:'',value:32769,bound:32768});
 }
 for(const bad of ['AA==','A+B/','AAAAA','AB'])assert.equal(decodeShare(bad).gate,'transport',bad);
});

test('size gate: 524,288 decoded bytes pass the size gate only; 524,289 refuse before parsing (ASCII and multibyte)',()=>{
 const at=decodeShareText(' '.repeat(524288));assert.equal(at.gate,'parse');
 const padded=decodeShareText(`{${' '.repeat(524286)}}`);assert.equal(padded.gate,'shape');
 const over=decodeShareText(' '.repeat(524289));assert.equal(over.gate,'size');assert.equal(over.code,'INCOMPLETE_RESOURCE_LIMIT');assert.equal(over.issues[0].value,524289);
 assert.equal(decodeShareText(`{"a":1,"a":2}${' '.repeat(524276)}`).gate,'size');
 const three=`"${'€'.repeat(174762)}"`;assert.equal(utf8Length(three),524288);assert.equal(three.length,174764);
 assert.equal(decodeShareText(three).gate,'parse');
 const three1=decodeShareText(`${three} `);assert.equal(three1.gate,'size');assert.equal(three1.issues[0].value,524289);
 const four=`"${'\u{1f600}'.repeat(131071)}"  `;assert.equal(utf8Length(four),524288);assert.equal(four.length,262146);
 assert.equal(decodeShareText(four).gate,'parse');assert.equal(decodeShareText(`${four} `).gate,'size');
 assert.equal(MAX_ENVELOPE_BYTES,524288);
});

test('the whole pair envelope, not each arm, is held to 524,288 bytes',()=>{
 const s=valid(preset('S200').baseline),file=buildConfigurationExport({arms:{baseline:s,candidate:s}});
 assert.ok(file.ok);const arm=utf8Length(jcs(s));assert.ok(arm<MAX_ENVELOPE_BYTES/2);
 const pad=n=>`{${' '.repeat(n-file.bytes)}${file.text.slice(1)}`;
 const fits=decodeShareText(pad(524288));assert.ok(fits.ok);assert.equal(fits.bytes,524288);
 const over=decodeShareText(pad(524289));assert.equal(over.gate,'size');
});

test('parse, shape, scenario and compatibility gates refuse in order with zero model starts',()=>{
 const base=valid(defaultScenario()),good=buildConfigurationExport({arms:{baseline:base,candidate:null}}).text;
 const cases=[
  ['parse',good.replace('{"arms":','{"arms":{},"arms":')],
  ['parse',good.replace('"cursor":null','"cursor":1.5')],
  ['shape',remake(good,e=>{e.extra=1;})],
  ['shape',remake(good,e=>{e.schema='fleetlab.depot.share.v2';})],
  ['shape',remake(good,e=>{e.honesty[2]=e.honesty[2].replace('Bo-Huei Lin','someone');})],
  ['shape',remake(good,e=>{e.honesty.pop();})],
  ['shape',remake(good,e=>{e.presentation.reading_level='expert';})],
  ['shape',remake(good,e=>{e.presentation.narration='trusted';})],
  ['shape',remake(good,e=>{e.expected.baseline_run_digest='ABC';})],
  ['shape',remake(good,e=>{e.expected.candidate_run_digest='0'.repeat(64);})],
  ['scenario',remake(good,e=>{e.arms.baseline.profile_version='depot_contract_v0';})],
  ['scenario',remake(good,e=>{delete e.arms.baseline.requirements.energy.target_soc_pct;})],
  ['scenario',remake(good,e=>{e.arms.baseline.requirement=e.arms.baseline.requirements;})],
  ['compatibility',remake(good,e=>{e.arms.candidate={...e.arms.baseline,horizon_tick:43201};})],
  ['compatibility',remake(good,e=>{e.arms.candidate=JSON.parse(JSON.stringify(e.arms.baseline));e.arms.candidate.requirements.energy.target_soc_pct=90;})],
 ];
 const h=harness(),g=h.s.get().generation;
 for(const [gate,text] of cases){
  const r=decodeShareText(text);assert.equal(r.ok,false);assert.equal(r.gate,gate,text.slice(0,60));
  assert.equal(h.s.importText(text).gate,gate);assert.equal(h.s.get().refusal.gate,gate);
  if(utf8Length(text)<24000){assert.equal(h.s.openFragment(asFragment(text)).gate,gate);}
 }
 h.s.openFragment('#share='+'A'.repeat(32769));h.s.importText(' '.repeat(524289));
 assert.equal(h.workers.length,0);assert.equal(h.s.get().generation,g);assert.equal(h.s.get().status,'draft');
});

test('A41: opening a share never runs; the rerun matches, and a mutated digest gives Could not reproduce',()=>{
 const a=harness();a.runAndFinish('baseline');assert.equal(a.s.get().status,'verified');
 const share=a.s.shareFragment();assert.ok(share.ok);const text=textOf(share.fragment),claim=JSON.parse(text).expected;
 assert.equal(claim.baseline_run_digest,a.s.get().result.envelopes.baseline.digests.run);
 const b=harness();b.s.openFragment(share.fragment);assert.equal(b.workers.length,0);assert.equal(b.s.get().status,'draft');
 assert.equal(b.runAndFinish('baseline').status,'verified');
 const mutated=asFragment(remake(text,e=>{e.expected.baseline_run_digest=flipFirst(e.expected.baseline_run_digest);}));
 const c=harness();c.s.openFragment(mutated);assert.equal(c.workers.length,0);
 const st=c.runAndFinish('baseline');assert.equal(st.status,'could_not_reproduce');
 assert.equal(st.result.envelopes,undefined);assert.equal(st.result.comparison,undefined);
 const summary=buildResultSummary(st);assert.match(summary,/Could not reproduce/);assert.doesNotMatch(summary,/Exact metrics/);
 const moved=asFragment(remake(text,e=>{e.arms.baseline.network.pool_bytes_per_tick+=125000;}));
 const d=harness();d.s.openFragment(moved);assert.equal(d.runAndFinish('baseline').status,'could_not_reproduce');
});

test('A41 pair through the configuration file: both digests must match; a candidate mutation cannot reproduce',()=>{
 const a=harness({preset:'B'});assert.equal(a.runAndFinish('pair').status,'verified');
 const file=a.s.exportText();assert.ok(file.ok);const e=JSON.parse(file.text);
 assert.ok(e.expected.baseline_run_digest&&e.expected.candidate_run_digest);
 const b=harness();b.s.importText(file.text);assert.equal(b.workers.length,0);assert.equal(b.runAndFinish('pair').status,'verified');
 const c=harness();c.s.importText(remake(file.text,x=>{x.expected.candidate_run_digest=flipFirst(x.expected.candidate_run_digest);}));
 assert.equal(c.runAndFinish('pair').status,'could_not_reproduce');
});

test('presentation-only differences leave both simulation digests unchanged',()=>{
 const p=preset('B'),arms={baseline:valid(p.baseline),candidate:valid(p.candidate)};
 const one=decodeShareText(buildConfigurationExport({arms,presentation:{reading_level:'overview'}}).text),two=decodeShareText(buildConfigurationExport({arms,presentation:{reading_level:'technical',cursor:3600,selection:'port:DC03',preset:'B'}}).text);
 assert.ok(one.ok&&two.ok);assert.deepEqual(one.digests,two.digests);assert.notDeepEqual(one.presentation,two.presentation);
});

test('every export and summary carries the three honesty strings verbatim; only a verified summary has metrics',()=>{
 const a=harness({preset:'B'});const st=a.runAndFinish('pair'),file=a.s.exportText(),summary=buildResultSummary(st);
 for(const s of HONESTY){assert.ok(file.text.includes(s));assert.ok(summary.includes(s));assert.ok(buildResultSummary({status:'invalid',result:null}).includes(s));}
 assert.match(summary,/Exact metrics, baseline:\n {2}release\.on_time_count: 4/);
 assert.match(summary,/Treatment: 1 intervention · 2 authoritative fields/);
 assert.ok(summary.includes(`Run digest, candidate: ${st.result.envelopes.candidate.digests.run}`));
 assert.ok(summary.includes(`Comparison digest: ${st.result.comparison.digest}`));
 assert.doesNotMatch(buildResultSummary({status:'stale',result:null}),/Exact metrics/);
 assert.doesNotMatch(summary.replace(HONESTY[0],''),/[\u2013\u2014]/);
});
