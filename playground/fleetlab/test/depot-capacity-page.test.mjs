import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {installFakeDom} from './helpers/fake-dom.mjs';
import {capacityCellSteps,runCapacityCell} from '../src/model/depot-capacity.js';
import {CAPACITY_STUDY} from '../src/data/depot-capacity-study.js';
import {allocationSpans,exampleVisits} from '../src/ui/depot-capacity-view.js';
import {copyProblems,literalsOf} from '../tools/check-dist.mjs';
const page=await import('../src/ui/depot-capacity-page.js').catch(()=>({}));
const app=await import('../src/ui/capacity-app.js').catch(()=>({}));
const quick={yieldPage:()=>Promise.resolve()};
const text=node=>node.textContent;
const cards=element=>element.querySelectorAll('article.capacity-card');
const change=(select,value)=>{select.value=value;select.dispatchEvent(new Event('change'));};
const visitRows=element=>element.querySelector('.capacity-visits').querySelectorAll('tbody tr');
const create=(options={})=>{assert.equal(typeof page.createCapacityPage,'function','the page module is required');const p=page.createCapacityPage({manifest:CAPACITY_STUDY,...quick,...options});document.body.appendChild(p.element);return p;};
const clean=element=>assert.doesNotMatch(element.textContent,/\bnull\b|undefined|NaN/);

test('before Load: header, place, manifest cards and a hidden inspector',()=>{
  const restore=installFakeDom();
  try{const p=create(),e=p.element;
    assert.equal(e.querySelector('a.studio-monogram').getAttribute('href'),'/#/overview');assert.equal(e.querySelector('a.studio-monogram').getAttribute('aria-label'),'FleetLab home');
    assert.deepEqual(e.querySelector('nav#studio-navigation[aria-label="Main navigation"]').querySelectorAll('a').map(a=>[text(a),a.getAttribute('href')]),[['Home','/#/overview'],['Explore','/#/catalog'],['About & limits','/#/approach']]);
    const crumbs=e.querySelector('main.depot-capacity nav.flow-breadcrumb[aria-label="Breadcrumb"]');
    assert.equal(crumbs.querySelector('a').getAttribute('href'),'/#/catalog');assert.equal(text(crumbs.querySelector('[aria-current="page"]')),'Scheduling or capacity?');
    assert.equal(text(e.querySelector('h1')),'Better scheduling, more bandwidth, or more charging power?');
    assert.equal(text(e.querySelector('p.eyebrow')),'RECORDED SYNTHETIC STUDY · 12 VEHICLES · 90-MINUTE OBSERVATION');
    assert.equal(text(e.querySelector('.capacity-status')),'No comparison loaded.');
    assert.equal(e.querySelector('.capacity-inspect').hidden,true);
    assert.deepEqual(e.querySelectorAll('.capacity-chips button').map(b=>[text(b),b.getAttribute('aria-pressed')]),[['Data-heavy','true'],['Energy-heavy','false'],['Mixed','false']]);
    assert.equal(e.querySelector('select[aria-label="Different rule"]').value,'capacity_departure_deadline');
    assert.equal(e.querySelector('select[aria-label="Different rule"]').querySelectorAll('option').length,3);
    assert.deepEqual(cards(e).map(c=>[c.getAttribute('data-case'),c.getAttribute('data-loaded')]),[['base','false'],['rule','false'],['bandwidth','false'],['power','false']]);
    assert.match(text(cards(e)[2]),/Ready on time9 of 12/);assert.match(text(cards(e)[1]),/Total lateness70 min/);
    assert.match(text(e.querySelector('.capacity-reading')),/more site power changes nothing/);
    assert.equal(e.querySelector('details.capacity-fixed').querySelectorAll('table')[0].querySelectorAll('tbody tr').length,12);
    assert.equal(e.querySelector('.capacity-table').querySelectorAll('tbody tr').length,36);
    assert.equal(e.querySelectorAll('.capacity-map [data-modeled="false"]').length,5);
    clean(e);p.destroy();
  }finally{restore();}
});

test('Load reconstructs four matched cells and opens the comparison at the selected visit',async()=>{
  const restore=installFakeDom();
  try{const p=create(),e=p.element;await p.load();
    assert.equal(text(e.querySelector('.capacity-status')),'Comparison loaded: Data-heavy workload. Four cells reconstructed and matched to the accepted study.');
    assert.deepEqual(cards(e).map(c=>c.getAttribute('data-loaded')),['true','true','true','true']);
    assert.match(text(cards(e)[0]),/Loaded/);
    assert.equal(e.querySelector('.capacity-inspect').hidden,false);
    const state=p.getState(),{base,rule}=state.comparison.cells;
    assert.deepEqual([state.comparison.regime,state.comparison.altRule],['data_heavy','capacity_departure_deadline']);
    assert.equal(state.vehicle,exampleVisits(base.verification,rule.verification).selected);
    assert.equal(e.querySelector('select[aria-label="Vehicle"]').value,state.vehicle);
    assert.equal(text(e.querySelector('.capacity-first-difference')),'First allocation difference: minute 0, Vehicle A1: Base uploading at 0.25 Gbps; Different rule idle. First readiness difference: Vehicle D1, Base minute 9, Different rule minute 4.');
    assert.equal(visitRows(e).length,12);
    const boards=e.querySelectorAll('.capacity-board article.capacity-board-case');
    assert.deepEqual(boards.map(b=>b.getAttribute('data-case')),['base','rule']);
    assert.match(text(boards[0]),/Uplink: Vehicle A1, Vehicle B1, Vehicle C1 and Vehicle D1 · 0.25 Gbps each/);
    assert.match(text(boards[1]),/Uplink: Vehicle D1 · 1 Gbps/);
    assert.equal(boards[0].querySelectorAll('.flow-chain span').map(s=>s.textContent.split(':')[0]).join(),'Battery,Upload,Local step,Ready');
    assert.equal(text(e.querySelector('.flow-clock')),'Minute 0 of 90');
    e.querySelector('[data-next-event]').click();
    assert.equal(text(e.querySelector('.flow-clock')),'Minute 2 of 90');
    assert.match(text(e.querySelector('.fl-sr-only')),/^Minute 2\. Different rule: Vehicle D1 finishes uploading\.$/);
    assert.equal(e.querySelectorAll('figure.capacity-timeline').length,2);
    assert.equal(e.querySelectorAll('figure.capacity-timeline svg[role="img"]').length,2);
    assert.equal(e.querySelectorAll('.capacity-table details').length,4);
    clean(e);p.destroy();
  }finally{restore();}
});

test('timeline marks show duration, while exact rates remain inspectable',async()=>{
  const restore=installFakeDom();
  try{const p=create(),e=p.element;await p.load();
    const figure=e.querySelector('figure.capacity-timeline'),bars=figure.querySelectorAll('rect.cap-upload');
    assert.ok(bars.length>0);assert.equal(new Set(bars.map(b=>b.getAttribute('height'))).size,1);
    assert.match(text(figure.querySelector('figcaption')),/duration.*not rate/i);
    assert.match(text(e.querySelector('.capacity-inspect')),/Average rate/);
    p.destroy();
  }finally{restore();}
});

test('on a phone the capacity title steps down to 34 px',()=>{
  const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8').replace(/\s+/g,' ');
  const block=css.slice(css.indexOf('/* NF-03 capacity viewer'));
  assert.match(block,/@media \(max-width:767\.98px\) \{[^@]*\.depot-capacity h1 ?\{ ?font-size:34px;? ?\}/);
});

test('switching the compared case rebuilds the table, boards and examples',async()=>{
  const restore=installFakeDom();
  try{const p=create(),e=p.element;await p.load();
    change(e.querySelector('select[aria-label="Case to compare"]'),'bandwidth');
    assert.equal(p.getState().vehicle,'D1','the selected visit remains the same across arms');
    assert.match(text(e.querySelector('.capacity-visits')),/More bandwidth ready/);
    assert.equal(visitRows(e).filter(r=>/Improving/.test(text(r))).length,12);
    assert.equal(text(e.querySelectorAll('.capacity-board article')[1].querySelector('h3')),'More bandwidth');
    assert.deepEqual(e.querySelectorAll('.capacity-examples button').map(text),['Improving example','Regressing: none','Unchanged: none']);
    assert.equal(e.querySelectorAll('.capacity-examples button')[1].getAttribute('aria-disabled'),'true');
    change(e.querySelector('select[aria-label="Case to compare"]'),'power');
    assert.equal(text(e.querySelector('.capacity-first-difference')),'No allocation difference. No readiness difference.');
    assert.match(text(e.querySelector('.capacity-inspect')),/No readiness difference between these two cells\./);
    change(e.querySelector('select[aria-label="Case to compare"]'),'rule');
    e.querySelector('.capacity-examples button').click();
    assert.equal(p.getState().vehicle,'A2','the improving example cycles from the selected visit, D1, to the next improving one');
    change(e.querySelector('select[aria-label="Vehicle"]'),'B3');
    assert.match(text(e.querySelector('.flow-caption')),/Vehicle B3 arrives at minute 20\./);
    const slider=e.querySelector('input[type="range"][aria-label="Inspect time across the two cells"]');
    slider.value='1500';slider.dispatchEvent(new Event('input'));
    assert.equal(text(e.querySelector('.flow-clock')),'Minute 25 of 90');
    clean(e);p.destroy();
  }finally{restore();}
});

test('a changed selection after Load keeps the loaded comparison and says so',async()=>{
  const restore=installFakeDom();
  try{const p=create(),e=p.element;await p.load();const loaded=p.getState().comparison;
    e.querySelectorAll('.capacity-chips button')[1].click();
    assert.equal(text(e.querySelector('.capacity-status')),'Previous setup: Data-heavy workload, departure deadline first. Load to compare the pending setup.');
    assert.equal(e.querySelectorAll('.capacity-chips button')[1].getAttribute('aria-pressed'),'true');
    assert.equal(text(e.querySelector('.capacity-question')),'Does faster upload change readiness when energy work remains?');
    assert.deepEqual(cards(e).map(c=>c.getAttribute('data-loaded')),['true','true','true','true']);
    assert.match(text(e.querySelector('.capacity-result-setup')),/Previous setup: Data-heavy/);
    assert.equal(p.getState().comparison,loaded);assert.equal(e.querySelector('.capacity-inspect').hidden,false);
    e.querySelectorAll('.capacity-chips button')[0].click();
    change(e.querySelector('select[aria-label="Different rule"]'),'capacity_fifo');
    assert.equal(text(e.querySelector('.capacity-status')),'Previous setup: Data-heavy workload, departure deadline first. Load to compare the pending setup.');
    change(e.querySelector('select[aria-label="Different rule"]'),'capacity_departure_deadline');
    assert.match(text(e.querySelector('.capacity-status')),/^Comparison loaded: Data-heavy/);
    p.destroy();
  }finally{restore();}
});

test('a reconstructed record that differs from the accepted study is refused and the previous comparison retained',async()=>{
  const restore=installFakeDom();
  try{let corrupt=false;
    const steps=function*(cells,runtime){for(const value of capacityCellSteps(cells,runtime)){if(corrupt&&value.cell.treatment==='more_power')value.record.events[0].time_s+=1;yield value;}};
    const p=create({steps}),e=p.element;
    corrupt=true;await p.load();
    assert.equal(text(e.querySelector('.capacity-status')),'Cell data_heavy/more_power/capacity_equal_uplink/1000: digest differs from the accepted study. No comparison loaded.');
    assert.equal(p.getState().comparison,null);assert.equal(e.querySelector('.capacity-inspect').hidden,true);
    corrupt=false;await p.load();const loaded=p.getState().comparison;assert.ok(loaded);
    change(e.querySelector('select[aria-label="Different rule"]'),'capacity_shortest_upload');
    corrupt=true;await p.load();
    assert.equal(text(e.querySelector('.capacity-status')),'Cell data_heavy/more_power/capacity_equal_uplink/1000: digest differs from the accepted study. Previous comparison retained.');
    assert.equal(p.getState().comparison,loaded);assert.equal(loaded.altRule,'capacity_departure_deadline');
    assert.equal(e.querySelector('[data-capacity-load]').disabled,false);
    p.destroy();
  }finally{restore();}
});

test('an incomplete study makes Load unavailable',async()=>{
  const restore=installFakeDom();
  try{let calls=0;const manifest={...CAPACITY_STUDY,cells:CAPACITY_STUDY.cells.slice(1)};
    const p=create({manifest,steps:function*(cells){calls++;yield* capacityCellSteps(cells);}}),e=p.element;
    assert.equal(text(e.querySelector('.capacity-status')),'Study incomplete: 71 of 72 cells accepted.');
    const load=e.querySelector('[data-capacity-load]');assert.equal(load.disabled,true);assert.equal(load.getAttribute('aria-disabled'),'true');
    await p.load();assert.equal(calls,0);assert.equal(p.getState().comparison,null);
    assert.equal(text(e.querySelector('.capacity-status')),'Study incomplete: 71 of 72 cells accepted.');
    clean(e);p.destroy();
  }finally{restore();}
});

test('reduced motion hides Play and steps by event; motion changes reach the page',async()=>{
  const restore=installFakeDom();
  try{let reduced=true;const p=create({reducedMotion:()=>reduced}),e=p.element;await p.load();
    const play=e.querySelector('.capacity-inspect .flow-actions [data-capacity-play]');
    assert.equal(play.hidden,true);
    assert.equal(e.querySelector('.cap-veil').getAttribute('visibility'),'hidden','nothing is revealed before the first step');
    e.querySelector('[data-next-event]').click();assert.equal(text(e.querySelector('.flow-clock')),'Minute 2 of 90');
    assert.equal(e.querySelector('.cap-veil').getAttribute('visibility'),'visible','stepping by event reveals the timeline up to the cursor');
    assert.equal(e.querySelectorAll('.capacity-inspect .flow-actions button').filter(b=>!b.hidden&&text(b)==='Next event').length,1,'one visible stepping control');
    reduced=false;p.motionChanged();assert.equal(play.hidden,false);
    p.destroy();
  }finally{restore();}
});

test('every control is reachable by keyboard and the copy has no dashes or banned words',async()=>{
  const restore=installFakeDom();
  try{const p=create(),e=p.element;await p.load();
    for(const node of e.querySelectorAll('button, select, input, summary, a'))assert.notEqual(node.getAttribute('tabindex'),'-1',node.localName);
    for(const node of e.querySelectorAll('[tabindex="-1"]'))assert.match(node.localName,/^h[1-6]$/);
    for(const details of e.querySelectorAll('details'))assert.ok(details.querySelector('summary'));
    for(const select of e.querySelectorAll('select'))assert.ok(select.getAttribute('aria-label'));
    p.destroy();
  }finally{restore();}
  for(const path of ['src/ui/capacity-app.js','src/ui/depot-capacity-view.js','src/ui/depot-capacity-page.js']){
    const source=readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
    assert.deepEqual(copyProblems(literalsOf(source).map(t=>({where:`${path} string`,text:t}))),[],path);
  }
});

test('destroy leaves no document listener and a later Load does nothing',async()=>{
  const restore=installFakeDom();
  try{const counts=new Map(),add=document.addEventListener.bind(document),remove=document.removeEventListener.bind(document);
    document.addEventListener=(type,...rest)=>{counts.set(type,(counts.get(type)??0)+1);return add(type,...rest);};
    document.removeEventListener=(type,...rest)=>{counts.set(type,(counts.get(type)??0)-1);return remove(type,...rest);};
    let calls=0;const p=create({steps:function*(cells,runtime){calls++;yield* capacityCellSteps(cells,runtime);}});
    await p.load();change(p.element.querySelector('select[aria-label="Case to compare"]'),'power');
    const status=text(p.element.querySelector('.capacity-status'));p.pause();p.destroy();
    assert.deepEqual([...counts.values()].filter(n=>n!==0),[]);
    await p.load();assert.equal(calls,1);assert.equal(text(p.element.querySelector('.capacity-status')),status);
  }finally{restore();}
});

test('startCapacity mounts the page, names the document and follows the reduced-motion setting',async()=>{
  const restore=installFakeDom();
  try{assert.equal(typeof app.startCapacity,'function');
    const root=document.createElement('div');root.setAttribute('id','capacity-root');document.body.appendChild(root);
    const p=app.startCapacity({doc:document});
    assert.equal(root.firstChild,p.element);assert.equal(document.title,'Scheduling or capacity? | FleetLab');
    await p.load();const play=p.element.querySelectorAll('.capacity-inspect .flow-actions button').find(b=>/^Play/.test(text(b)));
    assert.equal(play.hidden,false);
    restore.dom.media.set('(prefers-reduced-motion: reduce)',true);assert.equal(play.hidden,true);
    p.destroy();
  }finally{restore();}
});

test('the per-cell refusal reason comes from an independent check, not the supplied flags',async()=>{
  const restore=installFakeDom();
  try{const steps=function*(cells){for(const cell of cells){const value={index:0,cell,...runCapacityCell(cell)};if(cell.rule==='capacity_departure_deadline'){value.verification.model_validity='INVALID';}yield value;}};
    const p=create({steps}),e=p.element;await p.load();
    assert.equal(text(e.querySelector('.capacity-status')),'Cell data_heavy/base/capacity_departure_deadline/1000: verification did not pass. No comparison loaded.');
    p.destroy();
  }finally{restore();}
});


test('a setup edit pauses accepted replay and keeps all displayed results bound to the previous setup',async()=>{
  const restore=installFakeDom();
  try{const p=create(),e=p.element;await p.load();const accepted=p.getState().comparison;
    e.querySelector('[data-capacity-play]').click();assert.equal(restore.dom.frames.pending,1);
    e.querySelector('[data-regime="energy_heavy"]').click();
    assert.equal(restore.dom.frames.pending,0,'editing must pause replay');
    assert.equal(p.getState().comparison,accepted);
    assert.match(text(e.querySelector('.capacity-inspect-note')),/Previous setup: Data-heavy/);
    assert.match(text(e.querySelector('.capacity-reading')),/data-heavy workload/);
    assert.match(text(e.querySelector('.capacity-result-setup')),/Previous setup/);
    assert.match(text(e.querySelector('.capacity-preview')),/Energy-heavy/);
    p.destroy();
  }finally{restore();}
});

test('a superseded load cannot replace a newer accepted setup or clear its loading state',async()=>{
  const restore=installFakeDom();
  try{let hold=false,release;
    const p=create({yieldPage:()=>hold?(hold=false,new Promise(resolve=>{release=resolve;})):Promise.resolve()}),e=p.element;
    await p.load();hold=true;const stale=p.load();
    e.querySelector('[data-regime="energy_heavy"]').click();
    await p.load();const newest=p.getState().comparison;
    assert.equal(newest.regime,'energy_heavy');
    release();await stale;
    assert.equal(p.getState().comparison,newest);assert.equal(p.getState().loading,false);
    assert.match(text(e.querySelector('.capacity-status')),/Comparison loaded: Energy-heavy/);
    p.destroy();
  }finally{restore();}
});

test('playback, scrub, selected visit, resize and arm changes never reconstruct or mutate accepted cells',async()=>{
  const restore=installFakeDom();
  try{let calls=0;const p=create({steps:function*(cells,runtime){calls++;yield* capacityCellSteps(cells,runtime);}}),e=p.element;
    await p.load();const accepted=p.getState().comparison,before=JSON.stringify(accepted);
    const slider=e.querySelector('input[type="range"]');slider.value='240';slider.dispatchEvent(new Event('input'));
    change(e.querySelector('select[aria-label="Vehicle"]'),'B1');
    change(e.querySelector('select[aria-label="Case to compare"]'),'bandwidth');
    assert.equal(p.getState().time_s,240);assert.equal(p.getState().vehicle,'B1');
    window.dispatchEvent(new Event('resize'));
    e.querySelector('[data-capacity-play]').click();restore.dom.frames.flush(0);restore.dom.frames.flush(250);p.pause();
    assert.equal(calls,1);assert.equal(JSON.stringify(accepted),before);
    assert.deepEqual(e.querySelectorAll('.capacity-board-case').map(b=>b.getAttribute('data-time')),['245','245']);
    assert.ok(e.querySelectorAll('[data-link-moving="true"]').length===0);
    p.destroy();
  }finally{restore();}
});

test('hidden, reduced motion and route departure stop active bench links without automatic resume',async()=>{
  const restore=installFakeDom();
  try{let reduced=false;const p=create({reducedMotion:()=>reduced}),e=p.element;await p.load();
    const play=e.querySelector('[data-capacity-play]');play.click();
    assert.ok(e.querySelectorAll('[data-link-moving="true"]').length>0);
    document.hidden=true;document.dispatchEvent(new Event('visibilitychange'));
    assert.equal(e.querySelectorAll('[data-link-moving="true"]').length,0);assert.equal(restore.dom.frames.pending,0);
    document.hidden=false;document.dispatchEvent(new Event('visibilitychange'));assert.equal(restore.dom.frames.pending,0);
    play.click();reduced=true;p.motionChanged();assert.equal(restore.dom.frames.pending,0);
    assert.equal(e.querySelectorAll('[data-link-moving="true"]').length,0);
    reduced=false;p.motionChanged();assert.equal(restore.dom.frames.pending,0);
    play.click();window.dispatchEvent(new Event('pagehide'));assert.equal(restore.dom.frames.pending,0);
    p.destroy();
  }finally{restore();}
});

test('mobile arm switching and resizing preserve the accepted clock, vehicle and paired final summaries',async()=>{
  const restore=installFakeDom();
  try{let calls=0;const p=create({steps:function*(cells,runtime){calls++;yield* capacityCellSteps(cells,runtime);}}),e=p.element;
    const jump=e.querySelector('[data-view-comparison]');assert.ok(jump);assert.equal(jump.hidden,true);
    await p.load();assert.equal(jump.hidden,false);assert.equal(jump.getAttribute('href'),'#capacity-comparison');assert.ok(e.querySelector('#capacity-comparison'));
    const accepted=p.getState().comparison,before=JSON.stringify(accepted),slider=e.querySelector('input[type="range"]');
    slider.value='240';slider.dispatchEvent(new Event('input'));change(e.querySelector('select[aria-label="Vehicle"]'),'B1');
    const controls=e.querySelector('.capacity-mobile-arms'),buttons=controls.querySelectorAll('button');
    assert.deepEqual(buttons.map(b=>b.getAttribute('aria-pressed')),['true','false']);
    buttons[1].click();
    assert.deepEqual(buttons.map(b=>b.getAttribute('aria-pressed')),['false','true']);
    assert.deepEqual(e.querySelectorAll('.capacity-board-case').map(a=>a.getAttribute('data-mobile-visible')),['false','true']);
    assert.equal(p.getState().time_s,240);assert.equal(p.getState().vehicle,'B1');
    window.dispatchEvent(new Event('resize'));
    assert.equal(p.getState().time_s,240);assert.equal(p.getState().vehicle,'B1');
    assert.equal(e.querySelector('.capacity-board-case[data-case="rule"]').getAttribute('data-mobile-visible'),'true');
    assert.match(text(e.querySelector('.capacity-pair-summary')),/Base.*3 of 12 on time.*Vehicle B1.*minute 6.*Different rule.*3 of 12 on time.*Vehicle B1.*minute 13/);
    change(e.querySelector('select[aria-label="Case to compare"]'),'power');
    assert.equal(e.querySelector('.capacity-board-case[data-case="power"]').getAttribute('data-mobile-visible'),'true','comparison selection follows the newly viewed treatment');
    assert.equal(p.getState().time_s,240);assert.equal(p.getState().vehicle,'B1');
    assert.equal(calls,1);assert.equal(JSON.stringify(accepted),before);p.destroy();
  }finally{restore();}
});

test('mobile bench CSS shows one arm while the desktop default keeps both',()=>{
  const css=readFileSync(new URL('../capacity/visual.css',import.meta.url),'utf8').replace(/\s+/g,' ');
  const phone=css.slice(css.indexOf('@media (max-width:767.98px)'));
  assert.match(phone,/\.capacity-page \.capacity-board-case\[data-mobile-visible=false\] ?\{ ?display:none;? ?\}/);
  assert.match(css,/\.capacity-mobile-arms ?\{[^}]*display:none/);
});

test('leaving while a load waits clears its reconstruction status before a cached page can return',async()=>{
  const restore=installFakeDom();
  try{let release;const p=create({yieldPage:()=>new Promise(resolve=>{release=resolve;})}),e=p.element;
    const loading=p.load();assert.match(text(e.querySelector('.capacity-status')),/^Reconstructing/);
    window.dispatchEvent(new Event('pagehide'));
    assert.equal(p.getState().loading,false);assert.match(text(e.querySelector('.capacity-status')),/^Load cancelled\. No comparison loaded\./);
    release();await loading;
    assert.equal(p.getState().comparison,null);assert.doesNotMatch(text(e.querySelector('.capacity-status')),/Reconstructing/);p.destroy();
  }finally{restore();}
});


test('cached-page cancellation retains and identifies the previous accepted setup',async()=>{
  const restore=installFakeDom();
  try{let hold=false,release;const p=create({yieldPage:()=>hold?new Promise(resolve=>{release=resolve;}):Promise.resolve()}),e=p.element;
    await p.load();const accepted=p.getState().comparison;e.querySelector('[data-regime="energy_heavy"]').click();hold=true;
    const loading=p.load();window.dispatchEvent(new Event('pagehide'));
    assert.equal(p.getState().loading,false);assert.equal(p.getState().comparison,accepted);
    assert.match(text(e.querySelector('.capacity-status')),/^Load cancelled\. Previous setup: Data-heavy/);
    assert.match(text(e.querySelector('.capacity-inspect-note')),/^Previous setup: Data-heavy/);
    release();await loading;assert.equal(p.getState().comparison,accepted);
    assert.doesNotMatch(text(e.querySelector('.capacity-status')),/Reconstructing/);p.destroy();
  }finally{restore();}
});
