// Depot lab page (note 13 to 16): idle entry, manual-activation reading tabs, preset loading, every run state as text,
// the verified outcome with every companion, share, export and import over the real session, job and engine.
import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {installFakeDom,serialize} from './helpers/fake-dom.mjs';
import {startDepotLab} from '../src/ui/depot-lab-app.js';
import {runDepotJob} from '../src/runtime/depot-lab-job.js';
import {createDepotRun,stepDepotRun} from '../src/model/depot-lab/engine.js';
import {compareDepotRuns,VERIFICATION_SCHEMA} from '../src/model/depot-lab/compare.js';
import {scenarioDigest,workloadDigest,policyDigest,H} from '../src/model/depot-lab/identity.js';
import {jcs} from '../src/model/depot-lab/canonical.js';
import {ENGINE_VERSION,VERIFIER_VERSION,PROJECTION_VERSION,METRIC_VERSION} from '../src/model/depot-lab/profiles.js';
import {presetCatalog,preset} from '../src/model/depot-lab/presets.js';
import {validateScenario} from '../src/model/depot-lab/schema.js';
import {HONESTY,term} from '../src/model/depot-lab/registry.js';
import {FLOW_TRUST} from '../src/model/depot-flow-contract.js';
import {buildConfigurationExport,encodeShare,decodeShare,fromBase64url} from '../src/ui/depot-lab-share.js';
import {minutesText,secondsText,signedText,kwhText,numberText} from '../src/ui/depot-lab-format.js';
import {copyProblems,literalsOf} from '../tools/check-dist.mjs';
const real=await import('../src/model/depot-lab-verify/verify.js').catch(()=>null);
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const PAGE=read('../depot-lab/index.html'),SOURCES=['../src/ui/depot-lab-app.js','../src/ui/depot-lab-view.js','../src/ui/depot-lab-evidence.js'];
const ENT={amp:'&',lt:'<',gt:'>',quot:'"'},decode=t=>t.replace(/&(amp|lt|gt|quot);/g,(_,k)=>ENT[k]);
// Builds the page body with its real nesting from the source page markup (plain tags, quoted attributes only).
function buildPage(){
 const body=PAGE.slice(PAGE.indexOf('>',PAGE.indexOf('<body'))+1,PAGE.indexOf('</body>'));let node=document.body;
 for(const m of body.matchAll(/<(\/?)([a-z0-9]+)((?:\s+[a-z-]+(?:="[^"]*")?)*)\s*>|([^<]+)/g)){
  if(m[4]!==undefined){node.appendChild(document.createTextNode(decode(m[4])));continue;}
  if(m[1]){node=node.parentNode;continue;}
  const e=document.createElement(m[2]);for(const a of m[3].matchAll(/([a-z-]+)(?:="([^"]*)")?/g))e.setAttribute(a[1],decode(a[2]??''));
  node.appendChild(e);node=e;
 }
}
// Envelope stand-in in the note 10.5 shape with a note 13 projection. Its numbers are arbitrary test fixtures keyed to
// the port count (preset B: 4 baseline ports, 5 candidate ports), never model outcomes; the UI must show exactly these.
const FIX=[
 {on:20,unfinished:1,unreleased:1,over:6,observed:400000,insp:'300/1',mj:2160000000,bytes:500000000},
 {on:21,unfinished:0,unreleased:0,over:0,observed:401000,insp:'0/1',mj:0,bytes:0},
];
function fixtureVerify({invalid=null,incomplete=null}={}){
 return (s,ledger)=>{
  const d=scenarioDigest(s),arm=s.site.ports.length===5?'candidate':'baseline',f=FIX[arm==='candidate'?1:0];
  const base={schema:VERIFICATION_SCHEMA,digests:{scenario:d,workload:workloadDigest(s),policy:policyDigest(),run:H('fleetlab.test.run.v1',{scenario:d,records:ledger.records.length})},
   versions:{engine:ENGINE_VERSION,verifier:VERIFIER_VERSION,projection:PROJECTION_VERSION,metric:METRIC_VERSION},
   trust:{authenticity:'NOT_AUTHENTICATED',authorization:'NOT_EVALUATED',deployment_permission:'NONE',evidence:'NOT_EVIDENCE'},
   ledger:{records:ledger.records.length,bytes:jcs(ledger).length,terminal_status:'COMPLETE',guard:null}};
  if(invalid===arm)return {...base,status:'INVALID',consistency:'INVALID_EVIDENCE',primary_violation:{code:'PROGRESS_MISMATCH',seq:41,tick:900,detail:'fixture'},digests:{...base.digests,run:null},projection:null};
  if(incomplete===arm)return {...base,status:'INCOMPLETE_RESOURCE_LIMIT',consistency:'NOT_AVAILABLE',primary_violation:null,digests:{...base.digests,run:null},ledger:{...base.ledger,terminal_status:'INCOMPLETE_RESOURCE_LIMIT',guard:{guard:'RECORD_COUNT',detail:{bound:1}}},projection:null};
  const metrics={'requirement.energy.target_soc_pct':s.requirements.energy.target_soc_pct,'release.on_time_count':f.on,'release.due_count':24,'release.unfinished_due_count':f.unfinished,'release.released_count':24-f.unreleased,'release.unreleased_count':f.unreleased,
   'visit.work_complete_count':24,'visit.censored_count':f.unreleased,'visit.overdue_s':f.over,'visit.turnaround_observed_s':f.observed,'work.remaining_reference_seconds':{inspection:f.insp},'energy.remaining_required_mj':f.mj,
   'data.remaining_required_bytes':f.bytes,'data.optional_unfinished_bytes':0,'charge.energy_credited_mj':0,'charge.peak_site_draw_w':'0/1','network.useful_bytes_down':0,'network.useful_bytes_up':0,'resource.attention_fraction':null,'wait.reason_seconds':{}};
  const components=[['on_time_count','up',f.on],['overdue_seconds','down',f.over],['observed_visit_seconds','down',f.observed],['unreleased_count','down',f.unreleased],['remaining_reference_seconds:inspection','down',f.insp],['remaining_required_kWh','down',f.mj],['remaining_required_bytes','down',f.bytes]].map(([id,direction,value])=>({id,direction,value}));
  return {...base,status:'VERIFIED',consistency:'INTERNALLY_CONSISTENT',primary_violation:null,projection:{version:PROJECTION_VERSION,horizon_tick:s.horizon_tick,arrival_window_tick:s.arrival_window_tick,target_soc_pct:s.requirements.energy.target_soc_pct,
   visits:[],resources:{ports:[],positions:[],workers:[],lanes:[],vendor:{bay_busy_s:0,worker_busy_s:0},site:{supply_w:s.site.supply_w,peak_draw_w:'0/1',energy_credited_mj:0,tight_s:0},network:{useful_bytes_down:0,useful_bytes_up:0,tight_s:{}}},
   intervals:{positions:[],ports:[]},events:[],metrics,vector:{classes:['inspection'],components},blockage:[]}};
 };
}
// Injected browser surfaces: Blob, object URLs, the delayed revoke, clipboard and the page address.
function fakeIo({clipboard=true,location={href:'/depot-readiness/',hash:''}}={}){
 const t={blobs:[],urls:[],revoked:[],later:[],copied:[]};
 class FakeBlob{constructor(parts,o){this.text=parts.join('');this.type=o?.type;t.blobs.push(this);}}
 t.io={Blob:FakeBlob,URL:{createObjectURL:b=>{t.urls.push(b);return `blob:fake-${t.urls.length}`;},revokeObjectURL:u=>t.revoked.push(u)},later:(f,ms)=>t.later.push([f,ms]),location,
  clipboard:{writeText:async text=>{if(!clipboard)throw Error('Denied');t.copied.push(text);}}};
 return t;
}
function setup(verify=fixtureVerify(),opts={}){
 const restore=installFakeDom();buildPage();
 const anchors=[],make=document.createElement.bind(document);
 document.createElement=(tag,...rest)=>{const e=make(tag,...rest);if(tag==='a'){anchors.push(e);e.addEventListener('click',()=>{e.clicked=true;});}return e;};
 const workers=[],createWorker=()=>{const w={posted:[],terminated:false,postMessage(m){this.posted.push(m);},terminate(){this.terminated=true;}};workers.push(w);return w;};
 const fx=fakeIo(opts),app=startDepotLab({createWorker,io:fx.io}),model={createDepotRun,stepDepotRun,verifyDepotRun:verify,compareDepotRuns};
 const deliver=(w,data)=>w.onmessage({data});
 const answer=(w=workers.at(-1))=>{const progress=[];const reply=runDepotJob(w.posted[0],{...model,onProgress:m=>progress.push(m)});return {reply,progress};};
 const finish=(w=workers.at(-1))=>{const {reply,progress}=answer(w);for(const m of progress)deliver(w,m);deliver(w,reply);return reply;};
 const by=id=>document.getElementById(id),btn=text=>by('share').querySelectorAll('button').find(b=>b.textContent===text);
 return {app,s:app.session,workers,by,btn,fx,anchors,deliver,answer,finish,close(){app.dispose();restore();}};
}
const key=(node,k)=>node.dispatchEvent(new KeyboardEvent('keydown',{key:k,bubbles:true,cancelable:true}));
const change=(select,value)=>{select.value=value;select.dispatchEvent(new Event('change'));};
const isTech=n=>n.nodeType===1&&(n.getAttribute('class')??'').split(' ').includes('technical-only');
// Text a visitor reads in Overview: the page stylesheet hides `.technical-only` there (asserted below).
const overview=n=>n.nodeType===3?n.textContent:isTech(n)?'':n.childNodes.map(overview).join('');
const rows=x=>x.by('trust').querySelectorAll('div').map(d=>[d.querySelector('dt').textContent,d.querySelector('dd').textContent]);
const cells=tr=>tr.childNodes.map(c=>overview(c).trim());
const tabState=x=>['overview','technical'].map(l=>[x.by(`tab-${l}`).getAttribute('aria-selected'),x.by(`tab-${l}`).getAttribute('tabindex')]);
const label=id=>term(id).label_plain;
const flush=async()=>{for(let i=0;i<4;i++)await Promise.resolve();};
const vectorRows=x=>x.by('outcome').querySelectorAll('tbody tr[data-component]');
const caption=(x,c)=>x.by('outcome').querySelectorAll('table').find(t=>t.querySelector('caption').textContent===c);
const termRow=(t,id)=>cells(t.querySelector(`tr[data-term="${id}"]`)).slice(1);
const after=(x,h)=>{const hs=x.by('outcome').querySelectorAll('h3'),i=hs.findIndex(n=>n.textContent===h);return hs[i].nextSibling;};
const runPreset=(x,id)=>{change(x.by('preset'),id);x.by('run-pair').click();x.finish();const st=x.s.get();assert.equal(st.status,'verified',x.by('status').textContent);return st;};
const OLD='A run for an older draft is still finishing; its result will be kept as old.';

test('page entry: trust states, verbatim honesty strings, the hosted-only line, an idle draft and no worker',()=>{
 const x=setup();
 try{
  assert.equal(x.workers.length,0);assert.equal(x.s.get().status,'draft');assert.equal(x.s.get().preset,'B');
  assert.deepEqual(rows(x),[[label('trust.scope'),FLOW_TRUST.scope],[label('trust.authenticity'),'NOT_AUTHENTICATED'],[label('trust.authorization'),'NOT_EVALUATED'],[label('trust.decision_authority'),'NONE'],[label('trust.deployment_permission'),'NONE'],[label('trust.evidence'),'NOT_EVIDENCE'],[label('trust.consistency'),'Not available']]);
  assert.deepEqual(document.querySelectorAll('.honesty p').map(p=>p.textContent),[...HONESTY]);
  for(const h of HONESTY)assert.ok(PAGE.includes(h),'the page carries each honesty string byte for byte');
  const hosted=document.querySelector('.hosted');assert.equal(hosted.textContent,'This lab is hosted online only and is not part of the offline edition. Nothing runs until you press Run.');
  for(let n=hosted;n;n=n.parentNode)assert.ok(!isTech(n),'the hosted-only line is visible in both reading levels');
  assert.match(x.by('status').textContent,/^Draft, not run\. Choose a setup and run the model\./);
  assert.equal(x.by('outcome').querySelector('.state-card').getAttribute('data-state'),'draft');
  assert.equal(x.by('outcome').querySelectorAll('.tiles, table').length,0);assert.doesNotMatch(overview(x.by('outcome')),/\d/);
  assert.deepEqual([x.by('cancel').hidden,x.by('error').hidden,x.by('progress').hidden],[true,true,true]);
  assert.equal(document.documentElement.getAttribute('data-level'),'overview');assert.equal(x.by('lab-panel').getAttribute('aria-labelledby'),'tab-overview');
  for(const c of ['Differences from baseline: 2','Edits since last run: 0','1 intervention · 2 authoritative fields'])assert.ok(x.by('counters').textContent.includes(c),c);
  assert.equal(x.btn('Export result summary').getAttribute('aria-disabled'),'true');assert.equal(x.by('share-status').textContent,'');
 }finally{x.close();}
});

test('preset selection loads all fourteen configurations with their declared regime and never runs; tabs never touch the draft',()=>{
 const x=setup(),catalog=presetCatalog(),select=x.by('preset');
 try{
  assert.equal(select.querySelectorAll('option').filter(o=>o.getAttribute('value')).length,14);
  assert.deepEqual(select.querySelectorAll('option').filter(o=>o.getAttribute('value')).map(o=>[o.value,o.textContent]),catalog.map(p=>[p.id,p.title]));
  for(const p of catalog){
   change(select,p.id);const st=x.s.get();
   assert.equal(st.preset,p.id);assert.equal(st.draft.candidate===null,!p.pair,p.id);assert.equal(st.status,'draft');
   assert.ok(x.by('preset-regime').textContent.includes(p.regime),p.id);
  }
  change(select,'S200');assert.match(x.by('counters').textContent,/Differences from baseline: no candidate/);
  change(select,'D');const before=x.s.get();
  x.by('tab-technical').click();const after=x.s.get();
  assert.equal(after.presentation.reading_level,'technical');
  assert.deepEqual([after.generation,after.draft,after.presentation.cursor,after.presentation.selection,after.edits_since_run],[before.generation,before.draft,before.presentation.cursor,before.presentation.selection,before.edits_since_run]);
  x.by('tab-overview').click();assert.equal(x.s.get().generation,before.generation);
  assert.equal(x.workers.length,0);
 }finally{x.close();}
});

test('reading tabs: arrows, Home and End move focus only; Enter and Space activate with aria-selected, roving tabindex and the panel label',()=>{
 const x=setup(),[o,t]=[x.by('tab-overview'),x.by('tab-technical')],g=x.s.get().generation;
 try{
  o.focus();key(o,'ArrowRight');assert.equal(document.activeElement,t);assert.deepEqual(tabState(x),[['true','0'],['false','-1']]);
  key(t,'Enter');assert.deepEqual(tabState(x),[['false','-1'],['true','0']]);
  assert.equal(x.by('lab-panel').getAttribute('aria-labelledby'),'tab-technical');assert.equal(document.documentElement.getAttribute('data-level'),'technical');
  key(t,'ArrowRight');assert.equal(document.activeElement,o);key(o,'ArrowLeft');assert.equal(document.activeElement,t);
  key(t,'Home');assert.equal(document.activeElement,o);key(o,'End');assert.equal(document.activeElement,t);
  assert.equal(x.s.get().presentation.reading_level,'technical');
  key(t,'Home');key(o,' ');assert.deepEqual(tabState(x),[['true','0'],['false','-1']]);assert.equal(document.documentElement.getAttribute('data-level'),'overview');
  assert.equal(x.s.get().generation,g);assert.equal(x.workers.length,0);
 }finally{x.close();}
});

test('a verified pair: staged progress, tiles with censoring, the full component table and companions, identical in both reading levels',()=>{
 const x=setup();
 try{
  x.by('run-pair').click();assert.equal(x.workers.length,1);
  assert.equal(x.by('status').textContent,'Run in progress: checking setup. No result yet.');
  assert.deepEqual([x.by('cancel').hidden,x.by('progress').hidden,x.by('run-pair').getAttribute('aria-disabled')],[false,false,'true']);
  x.by('run-pair').click();assert.equal(x.workers.length,1,'a second press while running starts nothing');
  const w=x.workers[0],{reply,progress}=x.answer(w);
  x.deliver(w,progress.find(m=>m.stage==='running_baseline'));
  assert.equal(x.by('status').textContent,'Run in progress: running baseline. No result yet.');assert.doesNotMatch(overview(x.by('outcome')),/\d/);
  x.deliver(w,reply);const st=x.s.get();assert.equal(st.status,'verified');
  assert.match(x.by('status').textContent,/^Internally consistent\. .*not authenticated or authorized\.$/);
  assert.equal(rows(x)[6][1],'INTERNALLY_CONSISTENT');assert.equal(x.by('cancel').hidden,true);
  const tile=id=>x.by('outcome').querySelector(`article[data-term="${id}"]`).querySelectorAll('p[data-arm]').map(p=>overview(p).trim());
  assert.deepEqual(tile('release.on_time_count'),['Baseline: 20 of 24 due by end 1 visit due and not released','Candidate: 21 of 24 due by end 0 visits due and not released']);
  // One baseline visit is unreleased, so its late time is a lower bound; under a minute it keeps exact seconds.
  assert.deepEqual(tile('visit.overdue_s'),['Baseline: at least 6 s (more may follow)','Candidate: 0 min']);
  assert.deepEqual(tile('visit.turnaround_observed_s'),['Baseline: at least 111 h 6 min (more may follow)','Candidate: 111 h 23 min']);
  assert.deepEqual(tile('release.unreleased_count'),['Baseline: 1 visit','Candidate: 0 visits']);
  const body=vectorRows(x);
  assert.deepEqual(body.map(r=>r.getAttribute('data-component')),st.result.comparison.components.map(c=>c.id));
  assert.deepEqual(body.map(cells),[
   ['On-time releases','↑ higher is better','20','21','+1','better'],
   ['Late seconds','↓ lower is better','at least 6 s','0 s','-6 s','better'],
   ['Observed visit seconds','↓ lower is better','at least 400,000 s','401,000 s','+1,000 s','worse'],
   ['Unfinished visits','↓ lower is better','1','0','-1','better'],
   ['Remaining inspection work','↓ lower is better','300 s','0 s','-300 s','better'],
   ['Remaining required energy','↓ lower is better','0.6 kWh','0 kWh','-0.6 kWh','better'],
   ['Remaining required data','↓ lower is better','0.5 GB','0 GB','-0.5 GB','better'],
  ]);
  const cls=x.by('outcome').querySelector('[data-classification]');
  assert.equal(cls.getAttribute('data-classification'),'mixed');assert.equal(cls.querySelector('strong').textContent,'Mixed');
  assert.match(overview(cls),/No winner is named, because the measures disagree\./);
  assert.match(overview(x.by('outcome')),/Common reference work: practiced_reference_v1, both setups, seconds: .*Never added across classes, and not a completion time\./);
  const work=caption(x,'Work still open at end of run');
  assert.deepEqual(termRow(work,'work.remaining_reference_seconds'),['inspection 300 s','none']);
  assert.deepEqual(termRow(work,'energy.remaining_required_mj'),['0.6 kWh','0 kWh']);
  assert.deepEqual(termRow(work,'data.remaining_required_bytes'),['0.5 GB','0 GB']);
  // Technical adds term ids, exact units and values beside the same display values; evidence holds the digests.
  const extra=[x.by('outcome'),x.by('technical-evidence')].flatMap(n=>n.querySelectorAll('.technical-only').map(n=>n.textContent)).join('|')+serialize(x.by('technical-evidence'));
  for(const s of ['remaining_required_kWh (mJ)',' 2160000000 mJ',' 400000 s','visit.overdue_s',' {"inspection":"300/1"}',st.result.envelopes.baseline.digests.run,st.result.envelopes.candidate.digests.run,st.result.comparison.digest,ENGINE_VERSION,`${st.result.envelopes.baseline.ledger.records} records`])assert.ok(extra.includes(s),s);
  assert.match(read('../depot-lab/visual.css'),/\[data-level=overview\] \.technical-only\{display:none\}/);
  const nodes=x.by('outcome').childNodes,text=serialize(x.by('outcome'));
  x.by('tab-technical').click();
  assert.equal(document.documentElement.getAttribute('data-level'),'technical');
  assert.deepEqual(x.by('outcome').childNodes,nodes,'a tab change keeps the same result nodes');assert.equal(serialize(x.by('outcome')),text);
  assert.equal(x.workers.length,1);assert.equal(x.s.get().result,st.result);
 }finally{x.close();}
});

test('a verified baseline-only run shows one arm, its own vector and no comparison word or narrative',()=>{
 const x=setup();
 try{
  x.by('run-baseline').click();assert.equal(x.workers[0].posted[0].arms.candidate,null);x.finish();assert.equal(x.s.get().status,'verified');
  const out=x.by('outcome');
  assert.deepEqual(out.querySelectorAll('article').map(a=>a.querySelectorAll('p[data-arm]').map(p=>p.getAttribute('data-arm'))),[['baseline'],['baseline'],['baseline'],['baseline']]);
  assert.deepEqual(out.querySelectorAll('table')[0].querySelectorAll('thead th').map(th=>th.textContent),['Component','Direction','Baseline']);
  assert.deepEqual(vectorRows(x).map(cells).slice(0,3),[['On-time releases','↑ higher is better','20'],['Late seconds','↓ lower is better','at least 6 s'],['Observed visit seconds','↓ lower is better','at least 400,000 s']]);
  assert.equal(vectorRows(x).length,7);
  assert.equal(out.querySelector('.classification').textContent,'No comparison: this run has a baseline only.');assert.equal(out.querySelectorAll('[data-classification]').length,0);
  const heads=out.querySelectorAll('h3').map(h=>h.textContent);
  for(const h of ['What the candidate changes','What changed','What got worse','What remains uncertain'])assert.ok(!heads.includes(h),h);
  assert.deepEqual(caption(x,'Unfinished visits at end of run, by primary state').querySelectorAll('thead th').map(th=>th.textContent),['','Baseline']);
 }finally{x.close();}
});

test('stale: a run still finishing for an older draft is worded apart from a shown result that became old',()=>{
 const x=setup();
 try{
  x.by('run-pair').click();const w0=x.workers[0],{reply:r0}=x.answer(w0);
  x.s.edit(s=>{s.requirements.energy.target_soc_pct=90;},{scope:'both'});
  assert.equal(x.s.get().status,'stale');assert.equal(x.s.get().history.length,0);assert.equal(x.by('cancel').hidden,false);
  assert.equal(x.by('status').textContent,`From an older draft. ${OLD} Run again to update.`);
  assert.equal(overview(x.by('outcome').querySelector('.state-card p')),`${OLD} Run again to update.`);
  x.deliver(w0,r0);assert.equal(x.s.get().history.length,1);assert.equal(x.by('cancel').hidden,true);
  assert.equal(x.by('status').textContent,'From an older draft. This result belongs to an older draft. Run again to update.');
  assert.equal(x.by('outcome').querySelectorAll('.tiles, table, .technical-only').length,0);assert.doesNotMatch(x.by('outcome').textContent,/\d/);
  x.s.edit(s=>{s.requirements.energy.target_soc_pct=80;},{scope:'both'});x.by('run-pair').click();x.finish();assert.equal(x.s.get().status,'verified');
  x.s.edit(s=>{s.requirements.energy.target_soc_pct=90;},{scope:'both'});
  assert.equal(x.s.get().status,'stale');assert.equal(x.s.get().history.length,2);
  assert.equal(x.by('status').textContent,'From an older draft. This result belongs to an older draft. Run again to update.');
  assert.equal(x.by('outcome').querySelector('.state-card').getAttribute('data-state'),'stale');
  assert.equal(x.by('outcome').querySelectorAll('.tiles, table, .technical-only').length,0);assert.doesNotMatch(x.by('outcome').textContent,/\d/);
  assert.equal(rows(x)[6][1],'Not available');assert.match(x.by('counters').textContent,/Edits since last run: 1/);
  // A pending run for an older draft plus an old shown result: both sentences, and the late reply stays old.
  x.by('run-pair').click();const w=x.workers[2],{reply}=x.answer(w);
  x.s.edit(s=>{s.requirements.energy.target_soc_pct=80;},{scope:'both'});
  assert.equal(x.by('status').textContent,`From an older draft. This result belongs to an older draft. ${OLD} Run again to update.`);
  x.deliver(w,reply);assert.equal(x.s.get().status,'stale');assert.equal(x.by('outcome').querySelectorAll('.tiles, table').length,0);
  assert.equal(x.workers.length,3);
 }finally{x.close();}
});

test('invalid evidence withholds every number and names the violation code',()=>{
 const x=setup(fixtureVerify({invalid:'candidate'}));
 try{
  x.by('run-pair').click();x.finish();assert.equal(x.s.get().status,'invalid');
  assert.equal(x.by('status').textContent,'Invalid evidence. Verification failed; results are withheld and the violation code is shown. Violation code: PROGRESS_MISMATCH (candidate).');
  const out=x.by('outcome');
  assert.equal(out.querySelector('.state-card').getAttribute('data-state'),'invalid');assert.equal(out.querySelectorAll('.tiles, table, [data-classification]').length,0);
  assert.doesNotMatch(overview(out),/\d/);assert.match(overview(out),/Candidate: violation PROGRESS_MISMATCH\. Results are withheld\./);
  assert.match(out.querySelector('.technical-only').textContent,/Record 41, tick 900\./);
  assert.equal(rows(x)[6][1],'INVALID_EVIDENCE');
  x.btn('Export result summary').click();assert.equal(x.fx.blobs.length,0);assert.equal(x.by('share-status').textContent,'Only a verified result has a summary to export.');
 }finally{x.close();}
});

test('incomplete, cancelled, refused, incompatible, failed and could-not-reproduce states are text without numbers',()=>{
 let x=setup(fixtureVerify({incomplete:'baseline'}));
 const quiet=()=>{assert.equal(x.by('outcome').querySelectorAll('.tiles, table').length,0);assert.doesNotMatch(overview(x.by('outcome')),/\d/);};
 try{
  x.by('run-baseline').click();x.finish();assert.equal(x.s.get().status,'incomplete');
  assert.match(x.by('status').textContent,/^Incomplete: resource limit\. .* Guard: RECORD_COUNT \(baseline\)\.$/);quiet();
  assert.match(overview(x.by('outcome')),/Baseline: stopped by guard RECORD_COUNT\./);
 }finally{x.close();}
 x=setup();
 try{
  x.by('run-pair').click();const w=x.workers[0];x.deliver(w,x.answer(w).progress[1]);
  x.by('cancel').click();assert.ok(w.terminated);assert.equal(x.s.get().status,'cancelled');
  assert.match(x.by('status').textContent,/^Cancelled, no result\./);assert.equal(x.by('cancel').hidden,true);assert.equal(document.activeElement,x.by('run-pair'));quiet();
  change(x.by('preset'),'S200');x.by('run-pair').click();assert.equal(x.workers.length,1);
  assert.match(x.by('status').textContent,/^Refused before running\. .* Refusal code: NO_CANDIDATE\.$/);
  assert.equal(x.by('error').hidden,false);assert.match(x.by('error').textContent,/This setup has no candidate/);quiet();
  change(x.by('preset'),'B');assert.equal(x.by('error').hidden,true);
  x.s.edit(s=>{s.requirements.energy.target_soc_pct=90;},{scope:'candidate'});x.by('run-pair').click();
  assert.match(x.by('status').textContent,/^Not comparable\. .* Refusal code: INCOMPATIBLE\.$/);assert.match(x.by('error').textContent,/at \/requirements\/energy\/target_soc_pct/);
  assert.equal(x.workers.length,1);quiet();
  x.by('run-baseline').click();x.workers[1].onerror();assert.equal(x.s.get().status,'failed');
  assert.equal(x.by('status').textContent,`${label('run.state.failed')}. ${term('run.state.failed').definition}`);
  assert.equal(x.by('status').textContent,'Run failed. The run stopped before it finished; no result is shown.');
  assert.equal(x.by('outcome').querySelector('.state-card h3').textContent,'Run failed');assert.match(x.by('error').textContent,/stopped before it finished/);quiet();
  const exp=buildConfigurationExport({arms:{baseline:x.s.get().checks.baseline.scenario,candidate:null},expected:{baseline_run_digest:'0'.repeat(64)}});
  assert.ok(exp.ok);x.s.importText(exp.text);assert.equal(x.workers.length,2,'import never runs');
  x.by('run-baseline').click();x.finish();assert.equal(x.s.get().status,'could_not_reproduce');
  assert.match(x.by('status').textContent,/^Could not reproduce\. Rerun digest differs from the one in the shared link or configuration file;/);assert.equal(x.by('outcome').querySelector('.state-card').getAttribute('data-state'),'irreproducible');
  quiet();assert.match(x.by('outcome').querySelector('.technical-only').textContent,new RegExp(`shared run digest ${'0'.repeat(64)}`));
 }finally{x.close();}
});

test('export configuration: an unattached download anchor over a Blob with the canonical envelope, the honesty strings and a delayed revoke',()=>{
 const x=setup();
 try{
  x.btn('Export configuration').click();
  const [b]=x.fx.blobs,e=JSON.parse(b.text);assert.equal(x.fx.blobs.length,1);assert.equal(b.type,'application/json');
  assert.equal(e.schema,'fleetlab.depot.share.v1');assert.deepEqual(e.honesty,[...HONESTY]);
  assert.equal(b.text,jcs(e),'the file is canonical JSON');
  assert.deepEqual(e.arms,JSON.parse(JSON.stringify({baseline:x.s.get().checks.baseline.scenario,candidate:x.s.get().checks.candidate.scenario})));
  assert.deepEqual(e.expected,{baseline_run_digest:null,candidate_run_digest:null},'no result before a verified run');
  const [a]=x.anchors;assert.equal(x.anchors.length,1);
  assert.deepEqual([a.getAttribute('href'),a.getAttribute('download'),a.clicked,a.parentNode],['blob:fake-1','fleetlab-depot-configuration.json',true,null]);
  assert.equal(x.fx.later.length,1);assert.equal(x.fx.later[0][1],1000);assert.deepEqual(x.fx.revoked,[]);
  x.fx.later[0][0]();assert.deepEqual(x.fx.revoked,['blob:fake-1']);
  assert.match(x.by('share-status').textContent,/^Saved fleetlab-depot-configuration\.json, [\d,]+ bytes\. Opening it later loads this setup and runs nothing\.$/);
  assert.equal(x.workers.length,0);
 }finally{x.close();}
});

test('share setup link: a pair link is refused with the export offer; a baseline-only link is copied and carries the honesty strings',async()=>{
 const x=setup();
 try{
  x.btn('Share setup link').click();await flush();
  assert.match(x.by('share-status').textContent,/^No link: this setup needs [\d,]+ characters and links hold at most 32,768\. Export the configuration as a file instead\.$/);
  assert.equal(document.activeElement,x.btn('Export configuration'));assert.deepEqual(x.fx.copied,[]);
  x.s.edit(()=>null,{scope:'candidate'});assert.equal(x.s.get().draft.candidate,null);
  x.btn('Share setup link').click();await flush();
  const [link]=x.fx.copied;assert.ok(link.startsWith('/depot-readiness/#share='),link.slice(0,40));
  const fragment=link.slice(link.indexOf('#')),r=decodeShare(fragment);
  assert.ok(r.ok);assert.equal(r.arms.candidate,null);assert.equal(r.digests.baseline,x.s.get().digests.baseline);
  const env=JSON.parse(new TextDecoder().decode(fromBase64url(fragment.slice('#share='.length))));assert.deepEqual(env.honesty,[...HONESTY]);
  assert.equal(x.by('share-status').textContent,'Setup link copied. Opening it loads this setup and runs nothing.');
  assert.equal(x.workers.length,0);
 }finally{x.close();}
});

test('copy summary: clipboard text and the selectable fallback both end with the three honesty strings; the summary export needs a verified result',async()=>{
 let x=setup();
 try{
  x.btn('Copy summary').click();await flush();
  assert.equal(x.fx.copied.length,1);assert.ok(x.fx.copied[0].endsWith(HONESTY.join('\n')));assert.match(x.fx.copied[0],/Status: draft/);
  assert.equal(x.by('share-status').textContent,'Summary copied with the three honesty statements.');
  x.btn('Export result summary').click();assert.equal(x.fx.blobs.length,0);
  x.by('run-pair').click();x.finish();assert.equal(x.s.get().status,'verified');assert.equal(x.btn('Export result summary').getAttribute('aria-disabled'),'false');
  x.btn('Export result summary').click();
  const [b]=x.fx.blobs;assert.equal(b.type,'text/plain');assert.match(b.text,/^FleetLab depot lab run summary\nStatus: verified\n/);assert.ok(b.text.endsWith(HONESTY.join('\n')));
  assert.equal(x.anchors.at(-1).getAttribute('download'),'fleetlab-depot-result-summary.txt');assert.equal(x.anchors.at(-1).clicked,true);
  assert.equal(x.by('share-status').textContent,'Saved fleetlab-depot-result-summary.txt.');
 }finally{x.close();}
 x=setup(fixtureVerify(),{clipboard:false});
 try{
  x.by('run-pair').click();x.finish();
  x.btn('Copy summary').click();await flush();
  const box=x.by('share').querySelector('textarea[readonly]');
  assert.equal(box.hidden,false);assert.equal(document.activeElement,box);assert.equal(box.getAttribute('aria-label'),'The summary to copy');
  assert.match(box.value,/Status: verified/);for(const h of HONESTY)assert.ok(box.value.includes(h));assert.ok(box.value.endsWith(HONESTY.join('\n')));
  assert.equal(x.by('share-status').textContent,'Select and copy the summary below. Automatic clipboard access is unavailable.');
 }finally{x.close();}
});

test('import: paste and file gates refuse oversize input before reading or parsing; a valid configuration imports and never runs',async()=>{
 const x=setup(),paste=x.by('import-text'),file=x.by('share').querySelector('input[type="file"]'),go=()=>x.btn('Import setup').click();
 const give=f=>{Object.defineProperty(file,'files',{value:[f],configurable:true});file.dispatchEvent(new Event('change'));};
 try{
  const text=x.s.exportText().text,before=x.s.get();
  for(const big of ['x'.repeat(524289),'€'.repeat(174763)]){
   paste.value=big;go();assert.equal(x.s.get(),before,'the session never saw the text');
   assert.equal(x.by('share-status').textContent,'Refused before parsing: larger than 524,288 bytes. Nothing changed and nothing ran.');
  }
  let reads=0;give({size:524289,text:async()=>{reads++;return text;}});await flush();
  assert.equal(reads,0,'an oversize file is never read');assert.equal(x.s.get(),before);assert.match(x.by('share-status').textContent,/^Refused before parsing/);
  paste.value='{"a":1,"a":2}';go();assert.equal(x.s.get().generation,before.generation);
  assert.match(x.by('share-status').textContent,/^Import refused: [A-Z_]+\. The current setup is unchanged and nothing ran\.$/);assert.equal(x.by('error').hidden,false);
  x.s.edit(s=>{s.site.garage_level='none';},{scope:'candidate'});const edited=x.s.get().generation;
  give({size:Buffer.byteLength(text),text:async()=>{reads++;return text;}});await flush();
  assert.equal(reads,1);assert.equal(x.s.get().generation,edited+1);assert.equal(x.s.get().draft.candidate.site.garage_level,'basic');
  assert.equal(x.by('share-status').textContent,'Imported the configuration. Nothing has run. Press Run to rerun and verify this setup here.');
  paste.value=text;go();assert.equal(x.s.get().generation,edited+2);assert.equal(x.s.get().status,'draft');
  assert.equal(x.workers.length,0);
 }finally{x.close();}
});

test('a #share= address opens the setup on page load and never runs; a refused link changes nothing',()=>{
 const base=validateScenario(preset('B').baseline,{origin:'editor'}).scenario;
 const enc=encodeShare({arms:{baseline:base,candidate:null},presentation:{reading_level:'technical',preset:null,cursor:null,selection:null}});assert.ok(enc.ok);
 let x=setup(fixtureVerify(),{location:{href:`/depot-readiness/${enc.fragment}`,hash:enc.fragment}});
 try{
  const st=x.s.get();
  assert.equal(x.workers.length,0);assert.equal(st.status,'draft');assert.equal(st.draft.candidate,null);assert.equal(st.digests.baseline,scenarioDigest(base));
  assert.equal(document.documentElement.getAttribute('data-level'),'technical');
  assert.equal(x.by('share-status').textContent,'Opened a shared setup. Nothing has run. Press Run to rerun and verify this setup here.');
  x.by('run-baseline').click();assert.equal(x.workers.length,1);x.finish();assert.equal(x.s.get().status,'verified');
 }finally{x.close();}
 x=setup(fixtureVerify(),{location:{href:'/depot-readiness/',hash:'#share='+'A'.repeat(40000)}});
 try{
  assert.equal(x.workers.length,0);assert.equal(x.s.get().preset,'B');assert.equal(x.s.get().generation,1);
  assert.match(x.by('error').textContent,/^The shared link is longer than 32,768 characters, so nothing was opened\./);
  assert.equal(x.by('share-status').textContent,'The shared link was refused: TRANSPORT_LIMIT. Nothing ran; a configuration file can be imported instead.');
 }finally{x.close();}
});

test('copy and boundary rules for the page modules',()=>{
 const allowed=new Set(['../runtime/depot-lab-session.js','./depot-lab-share.js','../model/depot-lab/presets.js','./dom.js','./depot-lab-view.js','./depot-lab-evidence.js','../model/depot-lab/registry.js','../model/depot-flow-contract.js','./depot-lab-format.js','./depot-lab-controls.js','./depot-lab-inspector.js']);
 for(const p of SOURCES){
  const src=read(p),where=`${p.slice(3)} string`;
  assert.deepEqual(copyProblems(literalsOf(src).map(text=>({where,text}))),[],p);
  assert.ok(!src.includes('—')&&!src.includes('\\u2014')&&!literalsOf(src).some(l=>l.includes(HONESTY[0].slice(0,30))),`${p} imports the honesty strings, never retypes them`);
  assert.doesNotMatch(src,/aria-live|innerHTML|outerHTML|insertAdjacentHTML|\beval\b|new Function|localStorage|sessionStorage|indexedDB|document\.cookie|import\.meta|import\(|\bfetch\b|\bcost/i,p);
  for(const m of src.matchAll(/from '([^']+)'/g))assert.ok(allowed.has(m[1]),`${p} imports ${m[1]}`);
 }
});

test('with the independent verifier: the B pair discloses its bundled treatment and both reading levels share one outcome',{skip:!real&&'verify.js is not built'},()=>{
 const x=setup(real.verifyDepotRun);
 try{
  x.by('run-pair').click();x.finish();const st=x.s.get(),c=st.result.comparison;assert.equal(st.status,'verified',x.by('status').textContent);
  assert.equal(vectorRows(x).length,c.components.length);
  assert.equal(overview(after(x,'What the candidate changes')).trim(),`1 intervention · 2 authoritative fields: Charging ports, Work positions by zone. ${term('requirement.shared_across_arms').definition}`);
  assert.deepEqual(x.by('outcome').querySelectorAll('ul.leaves li').map(li=>overview(li)),['Charging ports, DC03: none to {"enabled":true,"id":"DC03","kind":"DC","position_id":"P017","rating_w":150000}','Work positions by zone, P017 zone: waiting to charging']);
  const text=overview(x.by('outcome')),bundled="A bundled intervention cannot identify a single component's effect.";
  assert.equal(text.split(bundled).length-1,2,'beside the treatment and under what remains uncertain');
  assert.doesNotMatch(text,/at least|lower bounds/,'no visit is unreleased in either arm');
  for(const k of ['offsite','moving','servicing','work_complete_not_released','queued_outside','blocked_waiting'])assert.deepEqual(termRow(caption(x,'Unfinished visits at end of run, by primary state'),`visit.state.${k}`),['0','0'],k);
  const t=serialize(x.by('outcome'));x.by('tab-technical').click();assert.equal(serialize(x.by('outcome')),t);
  assert.equal(x.workers.length,1);
 }finally{x.close();}
});

test('with the independent verifier: P keeps one unfinished visit per arm, so late and observed time read "at least"',{skip:!real&&'verify.js is not built'},()=>{
 const x=setup(real.verifyDepotRun);
 try{
  const st=runPreset(x,'P'),m=a=>st.result.envelopes[a].projection.metrics;
  const tile=x.by('outcome').querySelector('article[data-term="visit.overdue_s"]').querySelectorAll('p[data-arm]').map(p=>overview(p).trim());
  assert.deepEqual(tile,['baseline','candidate'].map(a=>`${a[0].toUpperCase()+a.slice(1)}: at least ${minutesText(m(a)['visit.overdue_s'])} (more may follow)`));
  const late=vectorRows(x).find(r=>r.getAttribute('data-component')==='overdue_seconds');
  assert.deepEqual(cells(late).slice(2,4),['baseline','candidate'].map(a=>`at least ${secondsText(m(a)['visit.overdue_s'])}`));
  const prim=caption(x,'Unfinished visits at end of run, by primary state'),due=caption(x,'Unfinished visits at end of run, by due status');
  // Real verified projection: the one unreleased visit in each arm waits with no progress and is past due.
  assert.deepEqual(termRow(prim,'visit.state.blocked_waiting'),['1','1']);assert.deepEqual(termRow(due,'visit.due_status.past_due'),['1','1']);
  for(const a of [0,1]){const n=k=>Number(termRow(prim,`visit.state.${k}`)[a]);assert.equal(['offsite','moving','servicing','work_complete_not_released','queued_outside','blocked_waiting'].reduce((s,k)=>s+n(k),0),m(['baseline','candidate'][a])['release.unreleased_count']);}
  const work=caption(x,'Work still open at end of run');
  assert.deepEqual(termRow(work,'work.remaining_reference_seconds'),['activation 600 s; cabin 600 s; connect 120 s; inspection 300 s; mechanical repair 3,600 s; move 360 s; postcheck 60 s; unplug 120 s','inspection 300 s; move 120 s; unplug 120 s']);
  assert.deepEqual(termRow(work,'energy.remaining_required_mj'),[kwhText(m('baseline')['energy.remaining_required_mj']),'0 kWh']);
  assert.match(serialize(work),new RegExp(` ${m('baseline')['energy.remaining_required_mj']} mJ`));
  assert.match(overview(after(x,'What remains uncertain')),/Late seconds and observed visit seconds are lower bounds while visits stay unfinished\./);
 }finally{x.close();}
});

test('with the independent verifier: M is worse, with active-at-end rows; G is mixed and names no winner in either view',{skip:!real&&'verify.js is not built'},()=>{
 const x=setup(real.verifyDepotRun);
 try{
  let st=runPreset(x,'M'),c=st.result.comparison;assert.equal(c.classification,'worse');
  const work=caption(x,'Work still open at end of run');
  // Real verified projection: two baseline charges are still running at H and could not have finished even alone.
  assert.deepEqual(termRow(work,'active_at_h.could_not_finish'),['2','0']);
  assert.deepEqual(termRow(work,'active_at_h.minimum_duration_exceeded_time_left_at_start'),['2','0']);
  assert.match(serialize(work.querySelector('tr[data-term="active_at_h.could_not_finish"]')),/charge \(CH\) from tick \d+, \d+ mJ left/);
  assert.deepEqual(termRow(caption(x,'Unfinished visits at end of run, by primary state'),'visit.state.servicing'),['2','0']);
  assert.deepEqual(termRow(caption(x,'Unfinished visits at end of run, by primary state'),'visit.state.blocked_waiting'),['0','24']);
  const worse=c.components.filter(y=>y.relation==='worse'),equal=c.components.filter(y=>y.relation==='equal');
  assert.equal(overview(after(x,'What changed')),'No component is better in the candidate.');
  assert.ok(overview(after(x,'What got worse')).startsWith(`Worse in the candidate, ${worse.length} of ${c.components.length}: On-time releases ${signedText(worse[0].delta,numberText)}; `));
  const unsure=after(x,'What remains uncertain').querySelectorAll('li').map(overview);
  assert.deepEqual(unsure.slice(0,4),['Each difference changed this outcome in this model under this declared paired workload.',`${equal.length} of ${c.components.length} components ${equal.length===1?'is':'are'} exactly equal.`,'Late seconds and observed visit seconds are lower bounds while visits stay unfinished.','2 started tasks could not finish by end of run; their remaining work is counted, not finished.']);
  assert.equal(unsure.at(-1),term('deferred.statistics').definition);assert.ok(!unsure.some(u=>/bundled/.test(u)),'one field and one leaf is not a bundle');
  st=runPreset(x,'G');c=st.result.comparison;assert.equal(c.classification,'mixed');
  const text=overview(x.by('outcome'));
  assert.match(text,/Comparison classification: Mixed No winner is named, because the measures disagree\./);
  assert.match(overview(after(x,'What changed')),/^Better in the candidate, 1 of \d+: On-time releases \+1\.$/);
  assert.match(overview(after(x,'What got worse')),/^Worse in the candidate, 2 of \d+: Late seconds \+[\d,]+ s; Observed visit seconds \+[\d,]+ s\.$/);
  assert.doesNotMatch(text,/\bwins?\b|\bbest\b|\boptimal\b|\bwinner\b(?! is named)/i);
  const t=serialize(x.by('outcome'));x.by('tab-technical').click();assert.equal(serialize(x.by('outcome')),t);assert.match(overview(x.by('outcome')),/No winner is named, because the measures disagree\./);
  assert.equal(x.workers.length,2);
 }finally{x.close();}
});
