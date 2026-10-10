import assert from 'node:assert/strict';
import {test} from 'node:test';
import {installFakeDom} from './helpers/fake-dom.mjs';
import {capacityCellSteps} from '../src/model/depot-capacity.js';
import {CAPACITY_STUDY} from '../src/data/depot-capacity-study.js';
import {caseCells,verifiedCell,capacityBenchProjection} from '../src/ui/depot-capacity-view.js';
const api=await import('../src/ui/depot-capacity-guided.js').catch(()=>({}));
const comparison=regime=>{const wanted=caseCells(regime,'capacity_departure_deadline'),values=[...capacityCellSteps(wanted.map(c=>c.cell))];return {regime,cells:Object.fromEntries(wanted.map((c,i)=>[c.case,verifiedCell(values[i],CAPACITY_STUDY.cells.find(m=>m.cell_id===c.cell_id))]))};};
const data=comparison('data_heavy');
function shots(c=data){assert.equal(typeof api.capacityGuideShots,'function','record-derived guided chapters exist');return api.capacityGuideShots(c);}
function controller(options={}){assert.equal(typeof api.createCapacityGuide,'function','the guided intent controller exists');return api.createCapacityGuide({visible:()=>true,...options});}

test('chapters show accepted improving, regressing and negative-control snapshots in 40 seconds',()=>{
  const plan=shots();assert.equal(plan.reduce((sum,s)=>sum+s.duration_s,0),40);
  assert.deepEqual([...new Set(plan.map(s=>s.chapter))],['Constraint','Consequence','Trade-off']);
  assert.ok(plan.some(s=>s.kind==='improving'));assert.ok(plan.some(s=>s.kind==='regressing'));assert.ok(plan.some(s=>s.kind==='negative-control'&&s.contrast==='power'));
  for(const s of plan){assert.ok(['base',s.contrast].some(k=>data.cells[k].record.events.some(e=>e.time_s===s.time_s)),'cut is an accepted event boundary');const p=capacityBenchProjection(data,s.contrast,s.time_s,s.vehicle);assert.equal(p.available,true);assert.ok(p.arms.every(a=>a.time_s===s.time_s&&a.selected.vehicle===s.vehicle));}
  const improving=plan.find(s=>s.kind==='improving'&&s.contrast==='rule');assert.equal(improving.vehicle,'D1');assert.equal(improving.time_s,240);
  const regressing=plan.find(s=>s.kind==='regressing');assert.equal(regressing.vehicle,'B2');assert.equal(regressing.time_s,1080);
});

test('Energy-heavy chapters show power improvement and bandwidth as a negative control',()=>{
  const plan=shots(comparison('energy_heavy'));assert.ok(plan.some(s=>s.kind==='improving'&&s.contrast==='power'));
  assert.ok(plan.some(s=>s.kind==='negative-control'&&s.contrast==='bandwidth'));assert.ok(!plan.some(s=>s.kind==='regressing'),'no invented regression');
});

test('accepted interval accounting keeps exact full-horizon denominator and busy periods separate',()=>{
  assert.equal(typeof api.capacityActivity,'function');const a=api.capacityActivity(data.cells.base.record,'upload');
  assert.equal(a.used,382500000000);assert.equal(a.available,675000000000);assert.equal(a.active_s,3060);assert.deepEqual(a.intervals,[{start_s:0,end_s:3060}]);
  assert.equal(api.capacityActivity(data.cells.bandwidth.record,'upload').available,1350000000000);
  assert.deepEqual(api.capacityActivity(data.cells.base.record,'charge').intervals,[]);
});

test('Watch waits for acceptance and visibility, then starts without a second action',()=>{
  const restore=installFakeDom();try{let visible=false;const g=controller({visible:()=>visible});const token=g.request();assert.equal(g.getState().state,'loading');assert.equal(restore.dom.frames.pending,0);
    g.accept(shots(),token);assert.equal(g.getState().playing,false);visible=true;g.refresh();assert.equal(g.getState().playing,true);assert.equal(restore.dom.frames.pending,1);g.destroy();
  }finally{restore();}
});

test('manual Pause during loading and after visibility pause cannot be undone by late acceptance or visibility',()=>{
  const restore=installFakeDom();try{let visible=true;const g=controller({visible:()=>visible});const token=g.request();g.pause();g.accept(shots(),token);g.refresh();assert.equal(g.getState().playing,false);
    g.resume();assert.equal(g.getState().playing,true);visible=false;g.refresh();assert.equal(g.getState().state,'visibilityPaused');g.pause();visible=true;g.refresh();assert.equal(g.getState().playing,false);g.destroy();
  }finally{restore();}
});

test('automatic pauses resume from their playhead, while end, preference and route latches do not',()=>{
  const restore=installFakeDom();try{let visible=true,reduced=false;const g=controller({visible:()=>visible,reducedMotion:()=>reduced});g.accept(shots(),g.request());
    restore.dom.frames.flush(0);restore.dom.frames.flush(250);const elapsed=g.getState().elapsed_s;visible=false;g.refresh();assert.equal(restore.dom.frames.pending,0);visible=true;g.refresh();restore.dom.frames.flush(100000);assert.equal(g.getState().elapsed_s,elapsed);
    reduced=true;g.refresh();reduced=false;g.refresh();assert.equal(g.getState().playing,false);g.resume();g.pause('route');g.refresh();assert.equal(g.getState().playing,false);
    g.resume();for(let t=100250;t<=141000;t+=250)restore.dom.frames.flush(t);assert.equal(g.getState().state,'ended');assert.equal(restore.dom.frames.pending,0);g.refresh();assert.equal(g.getState().state,'ended');g.destroy();
  }finally{restore();}
});

test('superseded and destroyed requests cannot revive a guide; reduced motion retains static chapters',()=>{
  const restore=installFakeDom();try{const g=controller({reducedMotion:()=>true});const old=g.request(),current=g.request();g.accept(shots(),old);assert.equal(g.getState().shot,null);g.accept(shots(),current);assert.equal(g.getState().playing,false);g.chapter('Trade-off');assert.equal(g.getState().shot.chapter,'Trade-off');assert.equal(restore.dom.frames.pending,0);g.destroy();g.accept(shots(),current);g.resume();assert.equal(restore.dom.frames.pending,0);
  }finally{restore();}
});

test('data-saving preference cancels active intent and cannot resume it on preference return',()=>{
  const restore=installFakeDom();try{let saving=false;const g=controller({dataSaving:()=>saving});g.accept(shots(),g.request());assert.equal(g.getState().playing,true);saving=true;g.refresh();assert.equal(g.getState().playing,false);saving=false;g.refresh();assert.equal(g.getState().playing,false);g.destroy();
  }finally{restore();}
});

test('a frame delivered after cancellation cannot advance a later guide instance',()=>{
  let next=0;const pending=new Map(),scheduler={request:cb=>{pending.set(++next,cb);return next;},cancel:()=>{}};
  const g=controller({scheduler});g.accept(shots(),g.request());const old=pending.get(1);g.pause();g.resume();old(100000);assert.equal(g.getState().elapsed_s,0);assert.equal(pending.size,2,'stale frame must not schedule another loop');g.destroy();
});
