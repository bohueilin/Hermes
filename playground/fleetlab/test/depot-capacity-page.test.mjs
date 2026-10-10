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
    assert.match(text(boards[0]),/UplinkVehicle A1, Vehicle B1, Vehicle C1 and Vehicle D1 · 0.25 Gbps each/);
    assert.match(text(boards[1]),/UplinkVehicle D1 · 1 Gbps/);
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

test('timeline share bars keep a 4 px floor so a quarter share stays visible, and grow with the share above it',async()=>{
  const restore=installFakeDom();
  try{const p=create(),e=p.element;
    const bars=(cls,kind)=>{
      const figure=e.querySelectorAll('figure.capacity-timeline')[0],spans=allocationSpans(p.getState().comparison.cells.base.record);
      const heights=figure.querySelectorAll(`rect.${cls}`).map(r=>Number(r.getAttribute('height'))),shares=spans.flatMap(v=>v[kind]).map(s=>s.fraction);
      assert.equal(heights.length,shares.length,cls);assert.ok(heights.length>0,cls);
      assert.ok(heights.every(h=>h>=4),`${cls} heights ${heights}`);
      const order=shares.map((f,i)=>[f,heights[i]]).sort((a,b)=>a[0]-b[0]);
      for(let i=1;i<order.length;i+=1)assert.ok(order[i][1]>=order[i-1][1],`${cls} height follows the share`);
      return {shares,heights};
    };
    await p.load();
    const upload=bars('cap-upload','upload');
    const quarter=upload.shares.findIndex(f=>Math.abs(f-.25)<1e-9),full=upload.shares.findIndex(f=>Math.abs(f-1)<1e-9);
    assert.ok(quarter>=0&&full>=0,'the data-heavy base holds a quarter-share and a full-share upload span');
    assert.ok(upload.heights[quarter]>=4,'a quarter share renders at least 4 px tall');
    assert.ok(upload.heights[full]>upload.heights[quarter],'a full share is taller than a quarter share');
    e.querySelectorAll('.capacity-chips button')[1].click();await p.load();
    assert.equal(p.getState().comparison.regime,'energy_heavy');
    const charge=bars('cap-charge','charge');
    assert.ok(new Set(charge.shares).size>1&&new Set(charge.heights).size>1,'charging shares differ and so do their heights');
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
    assert.equal(p.getState().vehicle,'C1');
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
    assert.equal(text(e.querySelector('.capacity-status')),'Showing the Data-heavy comparison; load to compare the Energy-heavy workload.');
    assert.equal(e.querySelectorAll('.capacity-chips button')[1].getAttribute('aria-pressed'),'true');
    assert.equal(text(e.querySelector('.capacity-question')),'Does faster upload change readiness when energy work remains?');
    assert.deepEqual(cards(e).map(c=>c.getAttribute('data-loaded')),['false','false','false','false']);
    assert.equal(p.getState().comparison,loaded);assert.equal(e.querySelector('.capacity-inspect').hidden,false);
    e.querySelectorAll('.capacity-chips button')[0].click();
    change(e.querySelector('select[aria-label="Different rule"]'),'capacity_fifo');
    assert.equal(text(e.querySelector('.capacity-status')),'Showing the Data-heavy comparison with departure deadline first; load to compare first come, first served.');
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
