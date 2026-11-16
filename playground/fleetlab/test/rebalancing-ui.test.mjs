import {renderHeadlines} from '../src/ui/rebalancing-view.js';
import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {installFakeDom} from './helpers/fake-dom.mjs';import {startRebalancing} from '../src/ui/rebalancing-app.js';import {performR1Job} from '../src/runtime/rebalancing-job.js';
function setup(){const restore=installFakeDom();const html=readFileSync(new URL('../rebalancing/index.html',import.meta.url),'utf8');for(const m of html.matchAll(/<([a-z0-9]+)\b[^>]*\bid="([^"]+)"[^>]*>/g)){const n=document.createElement(m[1]);n.id=m[2];document.body.appendChild(n);}for(const[id,values]of Object.entries({'policy-arm':['reactive','forecast'],'move-from':['A','B','C','D'],'move-to':['A','B','C','D']}))for(const value of values){const o=document.createElement('option');o.value=value;o.textContent=value;document.getElementById(id).appendChild(o);}for(let i=0;i<6;i++){const b=document.createElement('button');b.setAttribute('data-chapter',i);document.body.appendChild(b);}const sent=[],worker={postMessage:m=>sent.push(m),terminate(){}};const app=startRebalancing({createWorker:()=>worker});const reply=()=>worker.onmessage({data:performR1Job(sent.at(-1))});reply();return{restore,app,sent,reply,by:id=>document.getElementById(id),close(){app.dispose();restore();}};}
test('UI edits and arm switching preserve accepted identities; all 52 ledger rows and 24 vehicles are shown',()=>{const x=setup();try{const digest=x.app.getSession().get().study[0].digest;assert.equal(x.by('ledger-table').querySelectorAll('tbody tr').length,52);assert.equal(document.querySelectorAll('[data-vehicle]').length,24);assert.match(x.by('paired-waits').textContent,/258/);x.by('policy-arm').value='forecast';x.by('policy-arm').dispatchEvent(new Event('change'));assert.equal(x.app.getSession().get().study[0].digest,digest);assert.equal(x.sent.length,1);document.querySelector('[data-chapter="5"]').click();x.by('move-from').value='A';x.by('move-to').value='C';x.by('move-count').value='2';x.by('add-move').click();assert.equal(x.app.getSession().get().manual.end,0);assert.equal(x.sent.length,1);x.by('apply-moves').click();assert.equal(x.app.getSession().get().manual.end,0);x.reply();assert.equal(x.app.getSession().get().manual.end,600);assert.equal(x.by('pending-moves').children.length,0);}finally{x.close();}});
test('reset at initial state clears pending moves even when accepted digest is unchanged',()=>{const x=setup();try{document.querySelector('[data-chapter="5"]').click();x.by('move-from').value='A';x.by('move-to').value='C';x.by('move-count').value='2';x.by('add-move').click();x.by('reset-manual').click();x.reply();assert.equal(x.by('pending-moves').children.length,0);}finally{x.close();}});
test('submitted pending batch cannot be removed while the checked response is in flight',()=>{const x=setup();try{document.querySelector('[data-chapter="5"]').click();x.by('move-from').value='A';x.by('move-to').value='C';x.by('move-count').value='2';x.by('add-move').click();x.by('apply-moves').click();const remove=document.querySelector('[data-remove]');assert.equal(remove.disabled,true);remove.click();assert.equal(x.by('pending-moves').children.length,1);x.reply();assert.equal(x.app.getSession().get().manual.decisions[0].moves[0].count,2);}finally{x.close();}});
test('empty-zone warning names actual projected supply before acceptance without forbidding it',()=>{const x=setup();try{document.querySelector('[data-chapter="5"]').click();x.by('move-from').value='A';x.by('move-to').value='C';x.by('move-count').value='8';x.by('add-move').click();assert.match(x.by('pending-warning')?.textContent||'',/A will have 0 ready vehicles/);assert.equal(x.app.getSession().get().manual.end,0);x.by('apply-moves').click();x.reply();assert.equal(x.app.getSession().get().manual.decisions[0].moves[0].count,8);}finally{x.close();}});
test('R1 caveat distinguishes complete policy comparison and shows a matched request example',()=>{const x=setup();try{assert.match(x.by('verdict').textContent,/information and reserve rules/);assert.match(x.by('verdict').textContent,/r-04-B-05.*60.*258/);}finally{x.close();}});
test('before a study arrives, the bench claims no recorded policy or minute (defect (c), D6)',()=>{const html=readFileSync(new URL('../rebalancing/index.html',import.meta.url),'utf8');assert.match(html,/id="map-heading">No result yet</);assert.match(html,/id="frame-label"><\//);});
test('recorded comparison labels hindsight and signs the observed gaps relative to Reactive',()=>{
 const x=setup();
 try{
  const html=readFileSync(new URL('../rebalancing/index.html',import.meta.url),'utf8');
  assert.match(html,/<option value="forecast">Forecast · hindsight oracle<\/option>/);
  const headline=x.by('headline'),gap=()=>headline.querySelector('#headline > p.note').textContent;
  assert.match(headline.querySelector('.forecast .eyebrow').textContent,/non-causal hindsight oracle.*next-interval arrivals by origin/);
  assert.match(headline.querySelector('.reactive .served').textContent,/137 \/ 163/);
  assert.match(headline.querySelector('.forecast .served').textContent,/151 \/ 163/);
  assert.match(gap(),/on this tape: \+14 pickups, -14 unserved, \+32\.8 empty km\. Both are heuristics with different reserve rules\./);
  assert.doesNotMatch(headline.textContent,/upper bound|optimal/i);
  assert.deepEqual(x.by('paired-waits').querySelectorAll('tbody tr')[1].querySelectorAll('td').slice(0,2).map(td=>td.textContent),['60 / 60 s','60 / 258 s']);

  // Swap just the metric vectors, retaining rule identities, to detect hardcoded gaps or an unsigned distance.
  const records=structuredClone(x.app.getSession().get().study);
  const reactive=records.find(r=>r.policy.id==='reactive'),forecast=records.find(r=>r.policy.id==='forecast');
  [reactive.metrics,forecast.metrics]=[forecast.metrics,reactive.metrics];
  renderHeadlines(document,records);
  assert.match(gap(),/-14 pickups, \+14 unserved, -32\.8 empty km/);
  forecast.metrics=reactive.metrics;
  renderHeadlines(document,records);
  assert.match(gap(),/0 pickups, 0 unserved, 0 empty km/);
 }finally{x.close();}
});
