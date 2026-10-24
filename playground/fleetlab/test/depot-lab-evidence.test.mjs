// Depot lab evidence access (note 13, 16; D1-11): the registry-driven All assumptions table with draft values per arm,
// deferred depth as not modeled, the plain-text Technical source list and the Technical run evidence of the session.
import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {installFakeDom} from './helpers/fake-dom.mjs';
import {startDepotLab} from '../src/ui/depot-lab-app.js';
import {runDepotJob} from '../src/runtime/depot-lab-job.js';
import {createDepotRun,stepDepotRun} from '../src/model/depot-lab/engine.js';
import {compareDepotRuns} from '../src/model/depot-lab/compare.js';
import {termsByCategory,SOURCES,HONESTY} from '../src/model/depot-lab/registry.js';
import {copyProblems,literalsOf} from '../tools/check-dist.mjs';
const real=await import('../src/model/depot-lab-verify/verify.js').catch(()=>null);
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const PAGE=read('../depot-lab/index.html'),SOURCE=read('../src/ui/depot-lab-evidence.js');
const ENT={amp:'&',lt:'<',gt:'>',quot:'"'},decode=t=>t.replace(/&(amp|lt|gt|quot);/g,(_,k)=>ENT[k]);
function buildPage(){
 const body=PAGE.slice(PAGE.indexOf('>',PAGE.indexOf('<body'))+1,PAGE.indexOf('</body>'));let node=document.body;
 for(const m of body.matchAll(/<(\/?)([a-z0-9]+)((?:\s+[a-z-]+(?:="[^"]*")?)*)\s*>|([^<]+)/g)){
  if(m[4]!==undefined){node.appendChild(document.createTextNode(decode(m[4])));continue;}
  if(m[1]){node=node.parentNode;continue;}
  const e=document.createElement(m[2]);for(const a of m[3].matchAll(/([a-z-]+)(?:="([^"]*)")?/g))e.setAttribute(a[1],decode(a[2]??''));
  node.appendChild(e);node=e;
 }
}
function setup(verify){
 const restore=installFakeDom();buildPage();
 const workers=[],app=startDepotLab({createWorker:()=>{const w={posted:[],postMessage(m){this.posted.push(m);},terminate(){}};workers.push(w);return w;},io:{later:()=>{}}});
 const finish=()=>{const w=workers.at(-1);w.onmessage({data:runDepotJob(w.posted[0],{createDepotRun,stepDepotRun,verifyDepotRun:verify,compareDepotRuns})});};
 const by=id=>document.getElementById(id);
 return {s:app.session,workers,by,finish,close(){app.dispose();restore();}};
}
const isTech=n=>n.nodeType===1&&(n.getAttribute('class')??'').split(' ').includes('technical-only');
const overview=n=>n.nodeType===3?n.textContent:isTech(n)?'':n.childNodes.map(overview).join('');
const exact=n=>n.querySelector('.technical-only')?.textContent.trim()??overview(n);
const row=(x,id)=>x.by('assumptions').querySelector(`tr[data-term="${id}"]`);
const vals=(x,id)=>row(x,id).querySelectorAll('td').map(td=>overview(td));
const evidence=x=>Object.fromEntries(x.by('technical-evidence').querySelectorAll('dl div').map(d=>[d.querySelector('dt').textContent,d.querySelector('dd').textContent]));
const change=(select,value)=>{select.value=value;select.dispatchEvent(new Event('change'));};
const LISTED=[...termsByCategory().ASSUMPTION,...termsByCategory().NOT_AVAILABLE.filter(t=>t.term_id.startsWith('deferred.'))];

test('All assumptions lists every registered assumption and every deferred depth row, with draft values per arm',()=>{
 const x=setup(real?.verifyDepotRun);
 try{
  const table=x.by('assumptions').querySelector('table'),d=x.s.get().draft;
  assert.equal(x.by('assumptions-details').querySelector('summary').textContent,'All assumptions');
  assert.equal(table.querySelector('caption').textContent,`All assumptions, ${LISTED.length} rows, with the current draft value`);
  assert.deepEqual(table.querySelectorAll('thead th').map(th=>th.textContent),['Assumption','Baseline','Candidate']);
  assert.deepEqual(table.querySelectorAll('tbody tr').map(tr=>tr.getAttribute('data-term')),LISTED.map(t=>t.term_id));
  for(const t of LISTED){
   const th=row(x,t.term_id).querySelector('th');assert.ok(overview(th).startsWith(`${t.label_plain} ${t.definition}`),t.term_id);
   assert.ok(th.querySelector('.technical-only').textContent.includes(t.term_id),t.term_id);
   if(t.category==='NOT_AVAILABLE')assert.deepEqual(vals(x,t.term_id),['Not modeled in this version','Not modeled in this version'],t.term_id);
   else if(!t.pointer)assert.deepEqual(vals(x,t.term_id),['Fixed rule','Fixed rule'],t.term_id);
  }
  assert.equal(termsByCategory().ASSUMPTION.length+16,LISTED.length);
  assert.deepEqual(vals(x,'requirement.energy.target_soc_pct'),['80 %','80 %']);
  assert.deepEqual(vals(x,'site.garage_level'),['basic','basic']);assert.deepEqual(vals(x,'site.lane_count'),['1 lane','1 lane']);
  // Preset B: the candidate adds one DC port (4 to 5 ports) on the same 24 positions; exact JSON stays in Technical.
  const ports=row(x,'site.ports').querySelectorAll('td');
  assert.deepEqual(ports.map(overview),['4 entries','5 entries']);
  assert.deepEqual(ports.map(exact),[JSON.stringify(d.baseline.site.ports),JSON.stringify(d.candidate.site.ports)]);
  assert.deepEqual(vals(x,'visit.arrival_tick'),['24 values, 24 different','24 values, 24 different']);
  assert.equal(exact(row(x,'visit.arrival_tick').querySelector('td')),d.baseline.visits.map(v=>v.arrival_tick.toLocaleString('en-US')+' tick').join(', '));
  assert.deepEqual(vals(x,'visit.initial_soc_pct'),['all 20 % (24)','all 20 % (24)']);
  assert.deepEqual(vals(x,'service.entitlement'),['all valid (3)','all valid (3)']);
  assert.equal(x.workers.length,0);
 }finally{x.close();}
});

test('edits update the table without a run; a tab change keeps its nodes; a baseline-only setup shows one column',()=>{
 const x=setup();
 try{
  x.s.edit(s=>{s.requirements.energy.target_soc_pct=90;},{scope:'both'});
  assert.deepEqual(vals(x,'requirement.energy.target_soc_pct'),['90 %','90 %']);
  x.s.edit(s=>{s.site.garage_level='none';},{scope:'candidate'});
  assert.deepEqual(vals(x,'site.garage_level'),['basic','none']);
  const node=x.by('assumptions').firstChild;x.by('tab-technical').click();assert.equal(x.by('assumptions').firstChild,node);
  change(x.by('preset'),'S200');
  assert.deepEqual(x.by('assumptions').querySelectorAll('thead th').map(th=>th.textContent),['Assumption','Baseline']);
  assert.deepEqual(vals(x,'visit.arrival_tick'),['200 values, 200 different']);
  x.s.edit(s=>{delete s.site.lane_count;},{scope:'both'});assert.deepEqual(vals(x,'site.lane_count'),['Not available']);
  assert.equal(x.workers.length,0);
 }finally{x.close();}
});

test('Technical evidence before a run: draft digests only, no result, and the plain-text source list',()=>{
 const x=setup();
 try{
  const ev=evidence(x),st=x.s.get();
  assert.ok(isTech(x.by('technical-evidence')),'the whole block is Technical');
  assert.deepEqual(ev,{'Baseline draft scenario digest':st.digests.baseline,'Candidate draft scenario digest':st.digests.candidate,'Current result':'Not available'});
  const items=x.by('technical-evidence').querySelectorAll('ul.sources li');
  assert.deepEqual(items.map(li=>li.getAttribute('data-source')),SOURCES.map(s=>s.id));
  for(const [i,s] of SOURCES.entries())assert.equal(items[i].textContent,`${s.id} · ${s.label} · ${s.citation}. Limitation: ${s.limitation}${s.tag?` Tag: ${s.tag}.`:''}`);
  assert.match(items.find(li=>li.getAttribute('data-source')==='N02').textContent,/Tag: recruiting material; work categories only\.$/);
  assert.match(items.find(li=>li.getAttribute('data-source')==='N06').textContent,/UK-specific context only.* Tag: UK spectrum context only\.$/);
  for(const li of items)assert.doesNotMatch(li.textContent,/https?:|www\.|:\/\/|\.(com|org|gov|net|io|uk)\b/i);
 }finally{x.close();}
});

test('Technical evidence for a verified pair: status, violation, digests, versions, ledger counts and trust per arm',{skip:!real&&'verify.js is not built'},()=>{
 const x=setup(real.verifyDepotRun);
 try{
  x.by('run-pair').click();x.finish();const st=x.s.get();assert.equal(st.status,'verified');
  const ev=evidence(x);
  for(const [a,A] of [['baseline','Baseline'],['candidate','Candidate']]){
   const e=st.result.envelopes[a];
   assert.equal(ev[`${A} verification status`],'VERIFIED; INTERNALLY_CONSISTENT');assert.equal(ev[`${A} primary violation`],'none');
   for(const k of ['scenario','workload','policy','run'])assert.equal(ev[`${A} ${k} digest`],e.digests[k]);
   assert.equal(ev[`${A} versions`],`${e.versions.engine}; ${e.versions.verifier}; ${e.versions.projection}; ${e.versions.metric}`);
   assert.equal(ev[`${A} ledger`],`${e.ledger.records} records; ${e.ledger.bytes} bytes; COMPLETE`);
   assert.equal(ev[`${A} trust`],'authenticity NOT_AUTHENTICATED; authorization NOT_EVALUATED; deployment_permission NONE; evidence NOT_EVIDENCE');
  }
  assert.equal(ev.Comparison,`${st.result.comparison.classification}; digest ${st.result.comparison.digest}`);
  x.s.edit(s=>{s.requirements.energy.target_soc_pct=90;},{scope:'both'});
  assert.equal(evidence(x)['Current result'],'Not available','a stale result leaves the evidence block');
 }finally{x.close();}
});

test('Technical evidence for invalid evidence names the status and the primary violation, with no run digest',{skip:!real&&'verify.js is not built'},()=>{
 const bad=(s,l)=>{const e=real.verifyDepotRun(s,l);return s.site.ports.length===5?{...e,status:'INVALID',consistency:'INVALID_EVIDENCE',primary_violation:{code:'PROGRESS_MISMATCH',seq:41,tick:900,detail:'test'},digests:{...e.digests,run:null},projection:null}:e;};
 const x=setup(bad);
 try{
  x.by('run-pair').click();x.finish();assert.equal(x.s.get().status,'invalid');
  const ev=evidence(x);
  assert.equal(ev['Candidate verification status'],'INVALID; INVALID_EVIDENCE');assert.equal(ev['Candidate primary violation'],'PROGRESS_MISMATCH at record 41, tick 900');
  assert.equal(ev['Candidate run digest'],'Not available');assert.equal(ev['Baseline verification status'],'VERIFIED; INTERNALLY_CONSISTENT');
 }finally{x.close();}
});

test('evidence module copy and boundary rules',()=>{
 assert.deepEqual(copyProblems(literalsOf(SOURCE).map(text=>({where:'src/ui/depot-lab-evidence.js string',text}))),[]);
 assert.ok(!literalsOf(SOURCE).some(l=>HONESTY.some(h=>l.includes(h.slice(0,24)))));
 assert.doesNotMatch(SOURCE,/aria-live|innerHTML|outerHTML|insertAdjacentHTML|\beval\b|new Function|localStorage|sessionStorage|indexedDB|import\.meta|import\(|\bfetch\b|https?:/);
 assert.deepEqual([...SOURCE.matchAll(/from '([^']+)'/g)].map(m=>m[1]),['./dom.js','../model/depot-lab/registry.js','./depot-lab-format.js','./depot-lab-view.js']);
 assert.match(SOURCE,/^export function mountEvidence\(\{doc\}\)\{$/m);
});
