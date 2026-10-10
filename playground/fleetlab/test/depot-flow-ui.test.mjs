import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {installFakeDom} from './helpers/fake-dom.mjs';
import {flowComparisonSteps} from '../src/model/depot-flow.js';
import {inspectState} from '../src/ui/depot-flow-view.js';
import * as reading from '../src/ui/depot-flow-reading.js';
const ui=await import('../src/ui/depot-flow-lab.js').catch(()=>({}));
const shape=node=>node.children.map(c=>[c.localName,...(c.getAttribute('class')?.split(' ')??[])].join('.'));
const rowsOf=node=>node.querySelectorAll('tr').map(tr=>tr.children.map(c=>c.textContent));
const seek=(lab,t)=>{const slider=lab.element.querySelector('input[type="range"]');slider.value=String(t);slider.dispatchEvent(new Event('input'));};
const follow=(lab,id)=>{const select=lab.element.querySelector('[aria-label="Vehicle to follow"]');select.value=id;select.dispatchEvent(new Event('change'));};
const board=lab=>lab.element.querySelector('[data-cursor-state] .flow-resource-board');
const holdings=lab=>Object.fromEntries(board(lab).children.map(a=>[a.getAttribute('data-rule'),a.querySelector('dl').children.map(c=>c.textContent)]));
const reasons=lab=>Object.fromEntries(board(lab).children.map(a=>[a.getAttribute('data-rule'),a.querySelector('p.flow-wait-reason')?.textContent]));
const state=(lab,rule,t)=>inspectState(lab.getState().result.arms.find(a=>a.record.rule===rule).record,t);
const visit=(lab,rule,id)=>lab.getState().result.arms.find(a=>a.record.rule===rule).verification.visits.find(v=>v.vehicle===id);
test('lesson has inputs before Run; a completed run shows all rules and readable checks',async()=>{
  assert.equal(typeof ui.createDepotFlowLab,'function');const restore=installFakeDom();
  try{const lab=ui.createDepotFlowLab({yieldPage:()=>Promise.resolve()});document.body.appendChild(lab.element);
    assert.match(lab.element.textContent,/Nothing has run yet/);assert.equal(lab.element.querySelector('[data-flow-outcomes]'),null);
    await lab.run();assert.equal(lab.getState().result.comparison_eligible,true);
    assert.ok(lab.element.querySelector('[data-flow-outcomes]'));assert.match(lab.element.textContent,/Vehicle A becomes ready 1 min later/);
    assert.ok(lab.element.querySelector('caption'));assert.match(lab.element.textContent,/Individual earliest readiness/);
    assert.equal(lab.element.querySelectorAll('input[type="range"]').length,1);lab.destroy();
  }finally{restore();}
});
test('new settings and cancellation retain explicitly old results, with partial diagnostics',async()=>{
  const restore=installFakeDom();let release;let block=false;
  try{const lab=ui.createDepotFlowLab({yieldPage:()=>block?new Promise(r=>release=r):Promise.resolve()});
    await lab.run();lab.setOptions({b_gb:15});assert.match(lab.element.textContent,/Result from previous setup/);assert.match(lab.element.textContent,/7.5 GB to 15 GB/);
    block=true;const pending=lab.run();release();await Promise.resolve();await Promise.resolve();lab.cancel();release();await pending;
    assert.equal(lab.getState().attempt.status,'cancelled');assert.equal(lab.getState().result.scenario.vehicles[1].upload_bytes,7.5e9);assert.match(lab.element.textContent,/No new comparison/);lab.destroy();
  }finally{restore();}
});
test('superseded callback, rejected verification and invalid input cannot publish new results',async()=>{
  const restore=installFakeDom();const queue=[];
  try{const lab=ui.createDepotFlowLab({yieldPage:()=>new Promise(r=>queue.push(r))});
    const first=lab.run();lab.setOptions({b_gb:45});queue.shift()();await first;assert.equal(lab.getState().result,null);
    lab.setOptions({b_gb:99});await lab.run();assert.equal(lab.getState().attempt.status,'invalid');lab.destroy();
    const bad=ui.createDepotFlowLab({yieldPage:()=>Promise.resolve(),steps:function*(o){const g=flowComparisonSteps(o);let n;do{n=g.next();if(!n.done)yield n.value;}while(!n.done);n.value.arms[0].verification.model_validity='INVALID';n.value.arms[0].verification.comparison_eligible=false;n.value.comparison_eligible=false;return n.value;}});
    await bad.run();assert.equal(bad.getState().result,null);assert.match(bad.element.textContent,/withheld/);bad.destroy();
  }finally{restore();}
});
test('cursor uses exact events and route departure cancels pending work',async()=>{
  const restore=installFakeDom();
  try{const lab=ui.createDepotFlowLab({yieldPage:()=>Promise.resolve()});await lab.run();
    const cursor=lab.element.querySelector('input[type="range"]');assert.equal(cursor.getAttribute('step'),'1');
    lab.element.querySelector('[data-next-event]').click();assert.match(lab.element.querySelector('[data-cursor-state]').textContent,/Minute 1/);
    assert.match(lab.exportJSON(),/NOT_AUTHENTICATED/);lab.pause();lab.destroy();
  }finally{restore();}
});

test('control changes preserve keyboard focus and a named lesson restores its setup',()=>{
  const restore=installFakeDom();try{const lab=ui.createDepotFlowLab();document.body.appendChild(lab.element);
    const select=lab.element.querySelector('[aria-label="Vehicle B upload"]');select.focus();select.value='45';select.dispatchEvent(new Event('change'));
    assert.equal(document.activeElement,select);assert.equal(lab.getState().options.b_gb,45);
    lab.setLesson({id:'two-vehicles'});assert.equal(lab.getState().options.b_gb,7.5);lab.destroy();
  }finally{restore();}
});
test('result page names its place, offers one compare action and shows a readiness chain',async()=>{
  const restore=installFakeDom();
  try{const lab=ui.createDepotFlowLab({yieldPage:()=>Promise.resolve()});document.body.appendChild(lab.element);
    const crumbs=lab.element.querySelector('nav.flow-breadcrumb[aria-label="Breadcrumb"]');assert.ok(crumbs);
    assert.deepEqual(crumbs.querySelectorAll('a').map(a=>[a.textContent,a.getAttribute('href')]),[['Explore','#/catalog']]);
    const change=lab.element.querySelector('details.flow-change');assert.equal(change.querySelector('summary').textContent,'Change the setup');
    assert.ok(change.querySelector('[aria-label="Uplink capacity"]'),'the setup inputs sit under Change the setup');
    const kids=lab.element.querySelector('section.flow-hero').children;assert.ok(kids.indexOf(change)>kids.indexOf(lab.element.querySelector('[data-flow-run]').parentNode),'Run comes before the optional inputs');
    assert.equal(crumbs.querySelector('span[aria-current="page"]').textContent,'Two vehicles, one uplink');
    const runButton=lab.element.querySelector('[data-flow-run]');assert.equal(runButton.textContent,'Compare the three rules');
    assert.equal(runButton.parentNode.nextSibling.getAttribute('class'),'flow-run-help');assert.equal(lab.element.querySelector('p.flow-run-help').textContent,'Runs the same workload under each rule.');
    await lab.run();const before=JSON.stringify(lab.getState().result);
    const slider=lab.element.querySelector('input[type="range"]');slider.value='180';slider.dispatchEvent(new Event('input'));
    const readout=lab.element.querySelector('[data-cursor-state]');
    assert.equal(readout.querySelectorAll('.flow-chain[aria-label="Readiness chain"]').length,6);
    for(const chain of readout.querySelectorAll('.flow-chain')){const steps=chain.querySelectorAll('span');assert.deepEqual(steps.map(s=>s.textContent.split(':')[0]),['Battery','Upload','Local step','Ready']);for(const s of steps)assert.match(s.getAttribute('data-state'),/^(done|active|waiting|not-applicable)$/);}
    const states=(rule,id)=>readout.querySelector(`.flow-chain[data-rule="${rule}"][data-vehicle="${id}"]`).querySelectorAll('span').map(s=>s.getAttribute('data-state'));
    assert.deepEqual(states('nf_departure_deadline','B'),['not-applicable','done','done','done']);
    assert.deepEqual(states('nf_fifo','B'),['not-applicable','waiting','waiting','waiting']);
    assert.deepEqual(readout.querySelector('.flow-chain[data-rule="nf_fifo"][data-vehicle="B"]').querySelectorAll('span').map(s=>s.textContent),['Battery: already at target','Upload: waiting','Local step: waiting','Ready: waiting']);
    assert.equal(readout.querySelector('.flow-chain[data-rule="nf_departure_deadline"][data-vehicle="B"] span[data-state="done"]').textContent,'Upload: ✓ done');
    lab.element.querySelector('[data-next-event]').click();const live=lab.element.querySelector('[aria-live="polite"]');assert.notEqual(live.textContent,'');
    lab.pause();assert.equal(live.textContent,'');assert.equal(JSON.stringify(lab.getState().result),before);
    lab.element.querySelector('.flow-next button').click();assert.equal(change.open,true,'a suggested change shows the input it changed');
    assert.equal(lab.element.querySelector('details.flow-guess-detail').open,true,'the guess it focuses is visible');
    assert.equal(document.activeElement,lab.element.querySelector('[data-flow-guess]'));
    lab.setLesson({id:'crossed-priorities'});assert.equal(lab.element.querySelector('[data-flow-run]').textContent,'Compare the four rules');
    assert.equal(lab.element.querySelector('nav.flow-breadcrumb span[aria-current="page"]').textContent,'Four visits, crossed priorities');
    assert.equal(lab.element.querySelector('details.flow-change').hidden,true,'NF-02 has no setup inputs to change');lab.destroy();
  }finally{restore();}
});
test('on a phone the NF-02 board and chains follow the one selected rule',async()=>{
  const restore=installFakeDom(globalThis,{media:{'(max-width: 767.98px)':true}});
  try{const lab=ui.createDepotFlowLab({yieldPage:()=>Promise.resolve()});lab.setLesson({id:'crossed-priorities'});await lab.run();
    const chains=()=>lab.element.querySelectorAll('[data-cursor-state] .flow-chain').map(c=>c.getAttribute('data-rule'));
    assert.equal(chains().length,4,'one selected rule, never sixteen chains');assert.equal(board(lab).children.length,1);
    lab.element.querySelectorAll('.flow-rule-picker button')[1].click();
    assert.equal(chains().length,4);assert.ok(chains().every(r=>r==='cohort_equal_uplink'),chains().join());lab.destroy();
  }finally{restore();}
});
test('on a desktop the NF-02 board and chains show every rule until the view narrows',async()=>{
  const restore=installFakeDom();
  try{const lab=ui.createDepotFlowLab({yieldPage:()=>Promise.resolve()});lab.setLesson({id:'crossed-priorities'});await lab.run();
    assert.equal(board(lab).querySelectorAll('article').length,4);
    assert.equal(lab.element.querySelectorAll('[data-cursor-state] .flow-chain').length,16);
    restore.dom.media.set('(max-width: 767.98px)',true);
    assert.equal(board(lab).querySelectorAll('article').length,1);
    assert.equal(lab.element.querySelectorAll('[data-cursor-state] .flow-chain').length,4);lab.destroy();
  }finally{restore();}
});
test('confirmed at base, closed by the Task 3 pause clear: leaving the page clears lesson announcements, including the pause it causes',async()=>{
  const restore=installFakeDom();
  try{const lab=ui.createDepotFlowLab({yieldPage:()=>Promise.resolve()});document.body.appendChild(lab.element);
    const live=lab.element.querySelector('div.fl-sr-only[role="status"]');
    await lab.run();const result=JSON.stringify(lab.getState().result);
    lab.element.querySelector('[data-next-event]').click();assert.match(live.textContent,/^Minute 1\. /);
    lab.pause();assert.equal(live.textContent,'');
    lab.element.querySelectorAll('button').find(b=>b.textContent==='Play').click();assert.match(live.textContent,/^Playing from minute 1 /);
    lab.pause();assert.equal(live.textContent,'','a navigation pause leaves no "Paused at minute 1." behind');
    lab.element.querySelector('[data-next-event]').click();assert.notEqual(live.textContent,'');
    assert.equal(JSON.stringify(lab.getState().result),result);lab.destroy();
  }finally{restore();}
});

test('first screen puts the question, setup table and Compare before the explanations',()=>{
  const restore=installFakeDom();
  try{const lab=ui.createDepotFlowLab();document.body.appendChild(lab.element);
    const hero=lab.element.querySelector('section.flow-hero');
    assert.deepEqual(shape(hero),['nav.flow-breadcrumb','p.eyebrow','nav.lab-chooser','h1','p.flow-lede','p.flow-definition','div.flow-table','div.flow-actions','p.flow-run-help','p.flow-status','details.flow-change']);
    assert.ok(hero.querySelector('div.flow-table > table.flow-setup-table'));
    assert.deepEqual(hero.querySelector('div.flow-actions').children.map(b=>b.textContent),['Compare the three rules','Cancel']);
    assert.deepEqual(shape(lab.element),['section.flow-hero','details.flow-rules','details.flow-guess-detail','div.teaching-chips','p.flow-boundary','section.flow-output','section.flow-method','div.fl-sr-only']);
    for(const old of ['.flow-setup','.flow-input-board','.flow-workbench'])assert.ok(!lab.element.querySelector(old),old);
    const rules=lab.element.querySelector('details.flow-rules');assert.equal(rules.querySelector('summary').textContent,'How the three rules work');
    assert.deepEqual(rules.querySelectorAll('article h2').map(h=>h.textContent),['First come, first served','Equal uplink share','Departure deadline first']);
    assert.match(rules.querySelector('p').textContent,/^Both arrive at minute 0\. One charge port;/);
    const guess=lab.element.querySelector('details.flow-guess-detail');assert.equal(guess.querySelector('summary').textContent,'Optional guess');assert.ok(guess.querySelector('label.flow-guess [data-flow-guess]'));
    const order=lab.element.querySelectorAll('*');assert.ok(order.indexOf(lab.element.querySelector('[data-flow-run]'))<order.indexOf(rules),'Compare comes before the rule explanations');
    assert.equal(lab.element.querySelector('details.flow-change').hidden,false);lab.destroy();
  }finally{restore();}
});
test('two-vehicle question, lede and setup table read the current scenario',()=>{
  const restore=installFakeDom();
  try{const lab=ui.createDepotFlowLab();const text=s=>lab.element.querySelector(s).textContent;
    assert.equal(text('h1'),'Why can a charged vehicle still wait?');
    assert.equal(text('p.flow-lede'),'Two vehicles share a 1 Gbps upload link. B is already charged and due sooner; A needs charging and a larger upload. Both require two minutes of work after upload.');
    assert.equal(text('p.flow-definition'),'Ready means all three prerequisites are complete: battery at target, upload done, two-minute local step done. Invented workload; no real depot data.');
    const setup=lab.element.querySelector('table.flow-setup-table');assert.equal(setup.querySelector('caption').textContent,'Setup · observe through minute 15');
    assert.deepEqual(rowsOf(setup),[['Vehicle','Due','Upload','Energy','After upload'],['A','minute 15','75 GB','6 kWh','2 min local step'],['B','minute 5','7.5 GB','Already at target','2 min local step']]);
    lab.setOptions({b_gb:45});
    assert.equal(text('p.flow-lede'),'Two vehicles share a 1 Gbps upload link. B is already charged and due sooner, with a 45 GB upload; A needs charging and a 75 GB upload. Both require two minutes of work after upload.');
    assert.deepEqual(rowsOf(lab.element.querySelector('table.flow-setup-table'))[2],['B','minute 5','45 GB','Already at target','2 min local step']);
    lab.setOptions({b_gb:7.5,uplink_gbps:0.5});assert.match(text('p.flow-lede'),/^Two vehicles share a 0\.5 Gbps upload link\. /);lab.destroy();
  }finally{restore();}
});
test('four-visit question, lede and setup table read the cohort scenario',()=>{
  const restore=installFakeDom();
  try{const lab=ui.createDepotFlowLab();lab.setLesson({id:'crossed-priorities'});const text=s=>lab.element.querySelector(s).textContent;
    assert.equal(text('h1'),'Who should upload next?');
    assert.equal(text('p.flow-lede'),'Four visits arrive together, already charged, and share one 1 Gbps link. Two are urgent and two are large; size and urgency do not line up.');
    const setup=lab.element.querySelector('table.flow-setup-table');assert.equal(setup.querySelector('caption').textContent,'Setup · all batteries at target · 2 min local step after upload · observe through minute 25');
    assert.deepEqual(rowsOf(setup),[['Vehicle','Due','Upload'],['A','minute 10','60 GB'],['B','minute 15','7.5 GB'],['C','minute 22','45 GB'],['D','minute 6','15 GB']]);
    const rules=lab.element.querySelector('details.flow-rules');assert.equal(rules.querySelector('summary').textContent,'How the four rules work');
    assert.equal(rules.querySelectorAll('article').length,4);assert.equal(rules.querySelector('table caption').textContent,'Size and urgency are different');
    assert.equal(lab.element.querySelector('details.flow-change').hidden,true);lab.destroy();
  }finally{restore();}
});
test('after a comparison the reading leads, the trace follows and reference material closes the page',async()=>{
  const restore=installFakeDom();
  try{const lab=ui.createDepotFlowLab({yieldPage:()=>Promise.resolve()});await lab.run();const output=()=>lab.element.querySelector('section.flow-output').children;
    let out=output();
    assert.deepEqual(shape(lab.element.querySelector('section.flow-output')),['h2','p.flow-result-note','section.flow-reading','section','section.flow-trace','section.flow-next','details','details','details','details']);
    assert.ok(out[0].hasAttribute('data-flow-heading'));assert.equal(out[2].querySelector('h3').textContent,'Who became ready earlier or later?');assert.ok(out[3].hasAttribute('data-flow-outcomes'));
    assert.deepEqual(out.slice(6).map(d=>d.querySelector('summary').textContent),['Capacity bound','Vehicle task histories','Named checks · independently reconstructed','Exact event ledger and export']);
    lab.setOptions({b_gb:15});out=output();assert.deepEqual(shape(lab.element.querySelector('section.flow-output')).slice(0,3),['h2','p.flow-stale','p.flow-result-note']);
    await lab.run();out=output();assert.deepEqual(out.slice(2,4).map(s=>s.querySelector('h3').textContent),['What changed from the previous run?','Who became ready earlier or later?']);lab.destroy();
  }finally{restore();}
});
test('resource board names who holds the uplink and the charger under each rule',async()=>{
  const restore=installFakeDom();
  try{const lab=ui.createDepotFlowLab({yieldPage:()=>Promise.resolve()});await lab.run();seek(lab,180);
    const readout=lab.element.querySelector('[data-cursor-state]');assert.ok(board(lab)&&readout.firstChild===board(lab),'the board leads the time readout');
    assert.deepEqual(board(lab).children.map(a=>a.querySelector('h4').textContent),['First come, first served','Equal uplink share','Departure deadline first']);
    assert.deepEqual(['nf_fifo','nf_equal_uplink','nf_departure_deadline'].map(r=>state(lab,r,180).upload_holders),[['A'],['A'],['A']],'B finished uploading by 120 s under equal share and by 60 s under deadline priority');
    assert.equal(visit(lab,'nf_fifo','A').tasks.charge,360);
    const held=(uplink,charger)=>['Uplink',uplink,'Charger',charger];
    assert.deepEqual(holdings(lab),{nf_fifo:held('Vehicle A · full link','Vehicle A · 60 kW'),nf_equal_uplink:held('Vehicle A · full link','Vehicle A · 60 kW'),nf_departure_deadline:held('Vehicle A · full link','Vehicle A · 60 kW')});
    seek(lab,60);assert.deepEqual(state(lab,'nf_equal_uplink',60).vehicles.map(v=>v.upload_rate_bytes_s),[62.5e6,62.5e6]);
    assert.equal(holdings(lab).nf_equal_uplink[1],'Vehicle A and Vehicle B · 0.5 Gbps each');
    seek(lab,900);assert.deepEqual(Object.values(holdings(lab)),Array(3).fill(held('Idle','Idle')));lab.destroy();
  }finally{restore();}
});
test('following a vehicle explains what holds it back under each rule',async()=>{
  const restore=installFakeDom();
  try{const lab=ui.createDepotFlowLab({yieldPage:()=>Promise.resolve()});await lab.run();seek(lab,180);follow(lab,'B');
    assert.equal(visit(lab,'nf_departure_deadline','B').ready_s,180);
    assert.deepEqual([visit(lab,'nf_equal_uplink','B').tasks.upload,visit(lab,'nf_equal_uplink','B').ready_s],[120,240]);
    assert.deepEqual(reasons(lab),{
      nf_fifo:'Vehicle B waits for the uplink, held by Vehicle A under first come, first served.',
      nf_equal_uplink:'Vehicle B is in its local step; ready at minute 4.',
      nf_departure_deadline:'Vehicle B is ready since minute 3.'});
    assert.equal(lab.element.querySelectorAll('[data-cursor-state] .flow-chain').length,3,'chains follow the same vehicle');lab.destroy();
  }finally{restore();}
});
test('a slow charger shows uploading, waiting and charging reasons for Vehicle A',async()=>{
  const restore=installFakeDom();
  try{const lab=ui.createDepotFlowLab({yieldPage:()=>Promise.resolve()});lab.setOptions({charger_kw:20});await lab.run();follow(lab,'A');
    seek(lab,30);assert.deepEqual(state(lab,'nf_departure_deadline',30).upload_holders,['B']);
    assert.deepEqual(reasons(lab),{
      nf_fifo:'Vehicle A is uploading at 1 Gbps; local step and charging remain.',
      nf_equal_uplink:'Vehicle A is uploading at 0.5 Gbps; local step and charging remain.',
      nf_departure_deadline:'Vehicle A waits for the uplink, held by Vehicle B under departure deadline first.'});
    seek(lab,750);assert.deepEqual(['nf_fifo','nf_equal_uplink'].map(r=>state(lab,r,750).vehicles[0].tasks.post.state),['complete','active']);
    assert.deepEqual(reasons(lab),{
      nf_fifo:'Vehicle A is charging at 20 kW; nothing else remains.',
      nf_equal_uplink:'Vehicle A is charging at 20 kW; the local step remains.',
      nf_departure_deadline:'Vehicle A is charging at 20 kW; the local step remains.'});lab.destroy();
  }finally{restore();}
});
test('wait reasons stay accurate for resource states the lessons never reach',()=>{
  assert.equal(typeof reading.waitReason,'function');
  const row=(upload,charge,post)=>({vehicle:'B',ready:false,ready_s:null,waiting_for:[],upload_rate_bytes_s:0,charge_rate_j_s:0,tasks:{upload:{state:upload},charge:{state:charge},post:{state:post}}});
  assert.equal(reading.waitReason({rule:'nf_fifo',upload_holders:[],charge_holders:[]},row('waiting','complete','waiting')),'Vehicle B waits for the uplink; no capacity is available.');
  assert.equal(reading.waitReason({rule:'nf_fifo',upload_holders:[],charge_holders:['A']},row('complete','waiting','complete')),'Vehicle B waits for the charger, held by Vehicle A.');
});
test('reduced motion steps by event without speed or guided-pause controls',async()=>{
  const restore=installFakeDom();let reduced=true;
  try{const lab=ui.createDepotFlowLab({yieldPage:()=>Promise.resolve(),reducedMotion:()=>reduced});await lab.run();
    const label=text=>lab.element.querySelectorAll('.flow-trace label').find(l=>l.textContent.includes(text));
    assert.deepEqual([label('Speed').hidden,label('Pause at guided moments').hidden],[true,true]);
    assert.equal(lab.element.querySelector('.flow-clock').textContent,'Minute 0 of 15 · Reduced motion: step by event');
    reduced=false;lab.motionChanged();assert.deepEqual([label('Speed').hidden,label('Pause at guided moments').hidden],[false,false]);
    assert.equal(lab.element.querySelector('.flow-clock').textContent,'Minute 0 of 15');lab.destroy();
  }finally{restore();}
});
test('method section points to the next lesson on the hosted site',()=>{
  const restore=installFakeDom();
  try{const lab=ui.createDepotFlowLab();const next='A recorded twelve-vehicle study, Scheduling or capacity?, continues these lessons on the hosted FleetLab site; the offline edition does not include it.';
    assert.ok(lab.element.querySelector('section.flow-method').textContent.includes(next));
    lab.setLesson({id:'crossed-priorities'});assert.ok(lab.element.querySelector('section.flow-method').textContent.includes(next));lab.destroy();
  }finally{restore();}
});
test('on a desktop the lesson hero puts the question left and the setup and Compare right, by selector only',()=>{
  const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8'),start=css.indexOf('@media (min-width:1000px) {\n  .flow-hero'),block=css.slice(start,css.indexOf('\n}',start));
  assert.match(block,/\.flow-hero \{ display:grid; grid-template-columns:minmax\(0,1\.05fr\) minmax\(0,\.95fr\); column-gap:40px; align-items:start;/);
  const placed=Object.fromEntries([...block.matchAll(/([^{}]+)\{ grid-column:([^;]+); \}/g)].flatMap(([,selectors,column])=>selectors.split(',').map(x=>[x.trim().replace('.flow-hero > ',''),column])));
  assert.deepEqual(placed,{'.flow-breadcrumb':'1/-1','.eyebrow':'1/-1','.lab-chooser':'1/-1',h1:'1','.flow-lede':'1','.flow-definition':'1','.flow-table':'2','.flow-actions':'2','.flow-run-help':'2','.flow-status':'2','.flow-change':'2'});
  assert.doesNotMatch(block,/(^|[;\s])order\s*:/);
});
