// Depot inspector (note 13, 16): cursor, schematic, lists, inspector and events over real verified runs from the job,
// engine and independent verifier; replay gating under the four motion conditions; copy rules for the module.
import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {installFakeDom,serialize} from './helpers/fake-dom.mjs';
import {mountDepot,longestWaiting,PAGE_ROWS,REPLAY_MS,STEP_TICKS,REDUCED,ZONE_LIMIT,TRAIL_DEPTH} from '../src/ui/depot-lab-inspector.js';
import {createDepotSession} from '../src/runtime/depot-lab-session.js';
import {runDepotJob} from '../src/runtime/depot-lab-job.js';
import {createDepotRun,stepDepotRun} from '../src/model/depot-lab/engine.js';
import {compareDepotRuns} from '../src/model/depot-lab/compare.js';
import {verifyDepotRun} from '../src/model/depot-lab-verify/verify.js';
import {term} from '../src/model/depot-lab/registry.js';
import {hoursText,secondsText,percentText} from '../src/ui/depot-lab-format.js';
import {copyProblems,literalsOf} from '../tools/check-dist.mjs';
const MODEL={createDepotRun,stepDepotRun,verifyDepotRun,compareDepotRuns},REPLIES=new Map(),REGIONS=['cursor','schematic','inspector','vehicles','events'];
const SRC=readFileSync(new URL('../src/ui/depot-lab-inspector.js',import.meta.url),'utf8');
const EMPTY='The depot view appears after a verified run of the current setup.',ACCOUNTING='Shown first for time accounting only; a display convention, not a causal share.';
// The real job answers each distinct request once; a fresh session sends the same first request, so replies are reused.
function setup(preset='B',{mode='pair',observer=null}={}){
 const restore=installFakeDom(),{media}=restore.dom;
 if(observer)window.MutationObserver=observer;
 for(const id of REGIONS){const d=document.createElement('div');d.setAttribute('id',id);document.body.appendChild(d);}
 const workers=[];let view=null;
 const session=createDepotSession({workerFactory:()=>{const w={posted:[],postMessage(m){this.posted.push(m);},terminate(){}};workers.push(w);return w;},onChange:s=>view?.render(s),preset});
 view=mountDepot({doc:document,session});view.render(session.get());
 const by=id=>document.getElementById(id);
 const run=()=>{session.run(mode);const w=workers.at(-1),k=JSON.stringify(w.posted[0]);if(!REPLIES.has(k))REPLIES.set(k,runDepotJob(w.posted[0],MODEL));w.onmessage({data:REPLIES.get(k)});assert.equal(session.get().status,'verified');return session.get();};
 return {session,workers,media,by,run,render:s=>view.render(s),P:(a='baseline')=>session.get().result.envelopes[a].projection,cursor:()=>session.get().presentation.cursor,sel:()=>session.get().presentation.selection,close(){view.dispose();session.dispose();restore();}};
}
const buttons=root=>root.querySelectorAll('button');
const button=(root,text)=>{const b=buttons(root).find(n=>n.textContent===text);assert.ok(b,`button ${text}`);return b;};
const ticksOf=P=>[...new Set(P.events.map(e=>e[0]))].sort((a,b)=>a-b);
const covers=(a,b,t,H)=>a<=t&&(t<b||t===H&&b===H);
const input=(node,value)=>{node.value=String(value);node.dispatchEvent(new Event('input'));};
const key=(node,k)=>node.dispatchEvent(new KeyboardEvent('keydown',{key:k,bubbles:true,cancelable:true}));
const pos=g=>g.getAttribute('transform').match(/-?\d+/g).map(Number);
const vehicleButtons=x=>x.by('vehicles').querySelectorAll('ul button');
const isTech=n=>n.nodeType===1&&(n.getAttribute('class')??'').split(' ').includes('technical-only');
// Text a visitor reads in Overview: the page stylesheet hides `.technical-only` there.
const overview=n=>n.nodeType===3?n.textContent:isTech(n)?'':n.childNodes.map(overview).join('');
const unchanged=(x,before)=>{const s=x.session.get();assert.equal(x.workers.length,1,'no further worker');assert.equal(s.generation,before.generation);assert.equal(s.result,before.result);assert.equal(s.status,'verified');};

test('before a verified run every region shows only the empty note and nothing starts',()=>{
 const x=setup();
 try{
  for(const id of ['schematic','inspector','events'])assert.equal(x.by(id).textContent,EMPTY);
  assert.ok(buttons(x.by('cursor')).every(b=>b.hidden));assert.equal(x.by('cursor').querySelector('input').hidden,true);
  assert.equal(x.by('vehicles').querySelector('ul').hidden,true);assert.equal(vehicleButtons(x).length,0);
  assert.equal(x.workers.length,0);assert.equal(x.session.get().status,'draft');
 }finally{x.close();}
});

test('cursor controls move only the presentation cursor: no worker, no new generation, the same result',()=>{
 const x=setup();
 try{
  const s0=x.run(),P=x.P(),H=P.horizon_tick,ticks=ticksOf(P),c=x.by('cursor'),range=c.querySelector('input[type="range"]');
  assert.equal(x.cursor(),null);assert.deepEqual([range.getAttribute('max'),range.value,range.getAttribute('aria-valuetext')],[String(H),'0','start of run']);
  assert.equal(button(c,'Previous event').getAttribute('aria-disabled'),'true');
  button(c,'Next event').click();assert.equal(x.cursor(),ticks.find(k=>k>0));
  button(c,'Next event').click();assert.equal(x.cursor(),ticks.filter(k=>k>0)[1]);
  button(c,'Previous event').click();assert.equal(x.cursor(),ticks.find(k=>k>0));
  const t=x.cursor();button(c,'+15 min').click();assert.equal(x.cursor(),t+STEP_TICKS);button(c,'-15 min').click();assert.equal(x.cursor(),t);
  input(range,21600);assert.equal(x.cursor(),21600);assert.equal(range.getAttribute('aria-valuetext'),`${hoursText(21600)} into the run`);
  assert.match(c.querySelector('.cursor-label').textContent,new RegExp(`tick 21600 of ${H}`));
  input(range,H);assert.equal(range.getAttribute('aria-valuetext'),'end of run');
  assert.equal(button(c,'Next event').getAttribute('aria-disabled'),String(!ticks.some(k=>k>H)));assert.equal(button(c,'+15 min').getAttribute('aria-disabled'),'true');
  button(c,'+15 min').click();assert.equal(x.cursor(),H,'the cursor never passes the end of run');
  unchanged(x,s0);
 }finally{x.close();}
});

test('schematic marks and the equivalent list match the verified intervals at a chosen tick; ports sit beside their position',()=>{
 const x=setup();
 try{
  const s0=x.run();
  for(const arm of ['baseline','candidate']){
   if(arm==='candidate'){button(x.by('cursor'),'Candidate').click();assert.deepEqual(['Baseline','Candidate'].map(n=>button(x.by('cursor'),n).getAttribute('aria-pressed')),['false','true']);}
   const P=x.P(arm),H=P.horizon_tick,ticks=ticksOf(P),t=ticks[ticks.length>>1];
   input(x.by('cursor').querySelector('input[type="range"]'),t);assert.equal(x.cursor(),t);
   const marks=x.by('schematic').querySelectorAll('g.mark');
   assert.equal(marks.length,P.resources.positions.length+P.resources.ports.length,arm);
   for(const g of marks){
    const id=g.getAttribute('data-resource'),list=id.startsWith('port:')?P.intervals.ports:P.intervals.positions;
    const iv=list.filter(r=>r[0]===id&&covers(r[1],r[2],t,H));assert.equal(iv.length,1,id);
    assert.deepEqual([g.getAttribute('data-occupant'),g.getAttribute('data-class')],[iv[0][3]??'',iv[0][4]],id);
    const kind=id.startsWith('port:')?'port':'position';
    assert.ok(g.getAttribute('aria-label').endsWith(`: ${iv[0][3]?`Vehicle ${iv[0][3].slice(6)}`:'empty'}, ${term(`${kind}.partition.${iv[0][4]}`).label_plain}`),id);
    assert.equal(g.querySelectorAll('text')[1].textContent,iv[0][3]?`V ${iv[0][3].slice(6)}`:'empty');
   }
   assert.ok(marks.some(g=>g.getAttribute('data-occupant')),'something is in the depot at the chosen tick');
   assert.deepEqual(x.by('schematic').querySelectorAll('ul.mark-list button').map(b=>b.textContent),marks.map(g=>g.getAttribute('aria-label')));
   for(const q of P.resources.ports){
    const i=marks.findIndex(g=>g.getAttribute('data-resource')===q.id),[px,py]=pos(marks[i-1]),[qx,qy]=pos(marks[i]);
    assert.deepEqual([marks[i-1].getAttribute('data-resource'),qx-px,qy-py],[q.position,80,0],q.id);
   }
   // Each class has its own word and glyph within a kind, so no class is told apart by colour alone.
   for(const kind of ['position','port']){
    const seen=new Map();
    for(const g of marks.filter(m=>m.getAttribute('data-resource').startsWith(kind+':'))){const p=g.querySelector('path'),sig=[g.querySelectorAll('text')[2].textContent,p.getAttribute('d')+p.getAttribute('fill')];const c=g.getAttribute('data-class');if(seen.has(c))assert.deepEqual(seen.get(c),sig);else seen.set(c,sig);}
    const words=[...seen.values()].map(v=>v[0]);assert.equal(new Set(words).size,words.length,kind);
   }
  }
  assert.equal(x.P('candidate').resources.ports.length,x.P().resources.ports.length+1);
  unchanged(x,s0);
 }finally{x.close();}
});

test('above the zone limit one zone is open at a time and the others keep counts (S200 baseline)',()=>{
 const x=setup('S200',{mode:'baseline'});
 try{
  x.run();const P=x.P(),H=P.horizon_tick,sw=x.by('schematic').querySelector('.zone-switch');
  assert.ok(P.resources.positions.length>ZONE_LIMIT);
  const occupied=z=>P.resources.positions.filter(p=>p.zone===z&&P.intervals.positions.some(r=>r[0]===p.id&&r[3]&&covers(r[1],r[2],0,H))).length;
  const zones=['waiting','garage','cleaning','charging'].filter(z=>P.resources.positions.some(p=>p.zone===z));
  assert.deepEqual(buttons(sw).map(b=>b.textContent),zones.map(z=>{const n=P.resources.positions.filter(p=>p.zone===z).length;return `${z[0].toUpperCase()+z.slice(1)}: ${n} position${n===1?'':'s'}, ${occupied(z)} occupied`;}));
  assert.equal(buttons(sw)[0].getAttribute('aria-pressed'),'true');
  assert.equal(x.by('schematic').querySelectorAll('g.mark').length,P.resources.positions.filter(p=>p.zone===zones[0]).length);
  const charging=buttons(sw).find(b=>b.textContent.startsWith('Charging'));charging.focus();charging.click();
  const marks=x.by('schematic').querySelectorAll('g.mark'),ids=new Set(marks.map(g=>g.getAttribute('data-resource')));
  assert.equal(marks.length,P.resources.positions.filter(p=>p.zone==='charging').length+P.resources.ports.length);
  for(const q of P.resources.ports)assert.ok(ids.has(q.id)&&ids.has(q.position),q.id);
  assert.equal(document.activeElement.getAttribute('data-key'),'zone:charging','focus stays on the pressed zone');
  assert.equal(x.workers.length,1);
 }finally{x.close();}
});

test('vehicle list: aria-pressed selection, search by ID, Enter picks a match and the inspector follows one selection',()=>{
 const x=setup();
 try{
  const s0=x.run(),P=x.P();
  assert.equal(vehicleButtons(x).length,P.visits.length);assert.equal(x.by('vehicles').querySelector('p.note').textContent,`${P.visits.length} vehicles`);
  let b=vehicleButtons(x).find(n=>n.textContent==='05');b.focus();b.click();
  assert.equal(x.sel(),'visit:05');assert.equal(document.activeElement.getAttribute('data-key'),'v:visit:05');
  assert.deepEqual(vehicleButtons(x).filter(n=>n.getAttribute('aria-pressed')==='true').map(n=>n.textContent),['05']);
  const insp=x.by('inspector'),v=P.visits.find(u=>u.id==='visit:05');
  assert.equal(insp.querySelector('h3').textContent,'Vehicle 05');
  assert.deepEqual(insp.querySelectorAll('.release-chain li').map(l=>l.textContent),[`Required work done: ${hoursText(v.work_complete_at)} into the run`,`Released from depot work: ${hoursText(v.released_at)} into the run (${secondsText(v.released_at)}) released_at ${v.released_at}`,'Eligible for a ride: not modeled in this version']);
  assert.equal(insp.querySelector('[data-due]').textContent,`Release-by status: On time. due_status ${v.due_status}; on_time true; overdue_s 0`);
  assert.ok(overview(insp).includes(`Release-by time: ${hoursText(v.due_tick)} into the run (${secondsText(v.due_tick)}).`),'exact release-by seconds in Overview');
  const tables=insp.querySelectorAll('table');
  assert.equal(tables[0].querySelector('caption').textContent,'Task timeline for Vehicle 05, times from the start of the run');assert.equal(tables[0].querySelectorAll('tbody tr').length,v.tasks.length);
  assert.equal(tables[1].querySelectorAll('tbody tr').length,v.location.length);
  const search=x.by('vehicles').querySelector('input[type="search"]');
  input(search,'2');const want=P.visits.filter(u=>u.id.slice(6).includes('2')).map(u=>u.id.slice(6));
  assert.deepEqual(vehicleButtons(x).map(n=>n.textContent),want);assert.equal(x.by('vehicles').querySelector('p.note').textContent,`${want.length} of ${P.visits.length} vehicles match`);
  key(search,'Enter');assert.equal(x.sel(),`visit:${want[0]}`);
  input(search,'Vehicle 12');key(search,'Enter');assert.equal(x.sel(),'visit:12');assert.equal(insp.querySelector('h3').textContent,'Vehicle 12');
  input(search,'');b=vehicleButtons(x).find(n=>n.textContent==='12');b.click();assert.equal(x.sel(),null,'pressing the selected vehicle again clears the selection');
  unchanged(x,s0);
 }finally{x.close();}
});

test('longest-waiting shortcut: the largest verified wait total, ties to the lowest ID, with its stated reason',()=>{
 assert.deepEqual(longestWaiting([{id:'visit:02',wait_seconds:{HELD_UNITS:5}},{id:'visit:01',wait_seconds:{HELD_UNITS:2,INSUFFICIENT_SHIFT:3}},{id:'visit:03',wait_seconds:{HELD_UNITS:4}}]),{id:'visit:01',seconds:5});
 assert.equal(longestWaiting([{id:'visit:01',wait_seconds:{}},{id:'visit:02',wait_seconds:{}}]),null);
 const x=setup();
 try{
  const s0=x.run(),P=x.P(),total=v=>Object.values(v.wait_seconds).reduce((a,b)=>a+b,0);
  const best=P.visits.reduce((a,v)=>total(v)>total(a)||total(v)===total(a)&&v.id<a.id?v:a);
  const short=x.by('vehicles').querySelector('[data-key="long"]');
  assert.equal(short.textContent,`Longest waiting: Vehicle ${best.id.slice(6)}, ${hoursText(total(best))} in total`);
  short.click();assert.equal(x.sel(),best.id);
  assert.equal(x.by('inspector').querySelector('.note').textContent,`Vehicle ${best.id.slice(6)} is selected because it has the longest total waiting time.`);
  vehicleButtons(x).find(n=>n.textContent==='01').click();assert.doesNotMatch(x.by('inspector').textContent,/longest total waiting time/);
  unchanged(x,s0);
 }finally{x.close();}
});

test('replay advances only the cursor through event ticks while motion is allowed, and stops on request',t=>{
 t.mock.timers.enable({apis:['setInterval']});
 const x=setup();
 try{
  const s0=x.run(),ticks=ticksOf(x.P()),c=x.by('cursor');
  document.documentElement.setAttribute('data-visitor-motion','running');
  button(c,'Replay events').click();assert.equal(x.cursor(),null,'pressing replay moves nothing by itself');
  for(let i=1;i<=3;i++){t.mock.timers.tick(REPLAY_MS);assert.equal(x.cursor(),ticks[i]);}
  button(c,'Stop replay').click();t.mock.timers.tick(REPLAY_MS*3);assert.equal(x.cursor(),ticks[3]);
  button(c,'Replay events').click();t.mock.timers.tick(REPLAY_MS);assert.equal(x.cursor(),ticks[4]);
  button(c,'Next event').click();t.mock.timers.tick(REPLAY_MS*2);assert.equal(x.cursor(),ticks[5],'a manual cursor move ends the replay');
  unchanged(x,s0);
 }finally{x.close();}
});

const BLOCKERS=[
 ['prefers-reduced-motion',x=>x.media.set(REDUCED,true),true],
 ['html[data-motion=reduce] seen by the observer',x=>{document.documentElement.setAttribute('data-motion','reduce');Observer.last.cb([]);},true],
 ['html[data-visitor-motion=paused] without an observer',()=>document.documentElement.setAttribute('data-visitor-motion','paused'),false],
 ['document.hidden',()=>{Object.defineProperty(document,'hidden',{value:true,configurable:true});document.dispatchEvent(new Event('visibilitychange'));},true],
];
class Observer{constructor(cb){this.cb=cb;Observer.last=this;}observe(node,opts){this.node=node;this.opts=opts;}disconnect(){this.off=true;}}
for(const [name,block,immediate] of BLOCKERS)test(`replay stops under ${name} and never starts a worker`,t=>{
 t.mock.timers.enable({apis:['setInterval']});
 const x=setup('B',{observer:name.includes('observer')?Observer:null});
 try{
  const s0=x.run(),ticks=ticksOf(x.P()),c=x.by('cursor');
  if(name.includes('observer'))assert.deepEqual([Observer.last.node,Observer.last.opts.attributeFilter],[document.documentElement,['data-motion','data-visitor-motion']]);
  button(c,'Replay events').click();t.mock.timers.tick(REPLAY_MS);assert.equal(x.cursor(),ticks[1]);
  block(x);
  if(immediate)assert.ok(button(c,'Replay events'),'stopped at once');
  t.mock.timers.tick(REPLAY_MS*3);assert.equal(x.cursor(),ticks[1],'the cursor does not move once motion is blocked');
  assert.ok(button(c,'Replay events'));assert.match(c.querySelector('p.note').textContent,/^Replay is off while reduced motion is requested/);
  button(c,'Replay events').click();assert.equal(button(c,'Replay events').getAttribute('aria-disabled'),'true');
  t.mock.timers.tick(REPLAY_MS*3);assert.equal(x.cursor(),ticks[1],'a blocked replay does not start');
  button(c,'Next event').click();assert.equal(x.cursor(),ticks[2],'stepping by hand still works');
  unchanged(x,s0);
 }finally{x.close();}
});

test('events: filtered by selection with counts, split around the cursor and paged 20 rows at a time',()=>{
 const x=setup();
 try{
  const s0=x.run(),P=x.P(),ev=x.by('events'),part=k=>ev.querySelector(`section[data-part="${k}"]`),rows=k=>part(k).querySelectorAll('tbody tr');
  const steps=k=>rows(k).map(r=>r.querySelectorAll('td')[1].textContent);
  assert.equal(ev.querySelector('h3').textContent,'All events');
  const at0=P.events.filter(e=>e[0]===0),after=P.events.filter(e=>e[0]>0);
  assert.equal(ev.querySelector('p').textContent,`${P.events.length} events in total: 0 before the cursor, ${at0.length} at it, ${after.length} after it.`);
  assert.equal(rows('after').length,PAGE_ROWS);assert.deepEqual(steps('after'),after.slice(0,PAGE_ROWS).map(e=>e[2].replace(/_/g,' ')));
  const pages=Math.ceil(after.length/PAGE_ROWS);assert.equal(part('after').querySelector('.pager span').textContent,`Page 1 of ${pages}`);
  button(part('after'),'Next page').click();assert.deepEqual(steps('after'),after.slice(PAGE_ROWS,2*PAGE_ROWS).map(e=>e[2].replace(/_/g,' ')));
  assert.equal(part('after').querySelector('.pager span').textContent,`Page 2 of ${pages}`);
  const t=ticksOf(P)[200];input(x.by('cursor').querySelector('input[type="range"]'),t);
  const before=P.events.filter(e=>e[0]<t),last=Math.ceil(before.length/PAGE_ROWS);
  assert.equal(part('before').querySelector('.pager span').textContent,`Page ${last} of ${last}`,'earlier events open next to the cursor');
  assert.deepEqual(steps('before'),before.slice((last-1)*PAGE_ROWS).map(e=>e[2].replace(/_/g,' ')));
  assert.equal(rows('at').length,P.events.filter(e=>e[0]===t).length);assert.equal(part('after').querySelector('.pager span').textContent.startsWith('Page 1 of'),true,'moving the cursor resets paging');
  vehicleButtons(x).find(n=>n.textContent==='05').click();
  const mine=P.events.filter(e=>e[1]==='visit:05');
  assert.equal(ev.querySelector('h3').textContent,'Events for Vehicle 05');assert.match(ev.querySelector('p').textContent,new RegExp(`^${mine.length} events in total: ${mine.filter(e=>e[0]<t).length} before`));
  assert.ok([...rows('before'),...rows('at'),...rows('after')].every(r=>r.querySelectorAll('td')[0].textContent==='Vehicle 05'));
  x.by('schematic').querySelectorAll('ul.mark-list button').find(n=>n.textContent.startsWith('Port DC01 ')).click();assert.equal(x.sel(),'port:DC01');
  const keys=new Set(P.visits.flatMap(v=>v.tasks.filter(k=>k.position==='port:DC01'||k.port==='port:DC01').map(k=>`${v.id} ${k.template}`)));
  assert.equal(ev.querySelector('h3').textContent,'Events at Port DC01');assert.match(ev.querySelector('p').textContent,new RegExp(`^${P.events.filter(e=>keys.has(`${e[1]} ${e[2]}`)).length} events in total`));
  const insp=x.by('inspector'),port=P.resources.ports.find(q=>q.id==='port:DC01');
  assert.equal(insp.querySelector('h3').textContent,'Port DC01');
  // Rows follow the D1-08 port partition order of the contract.
  const ORDER=['unavailable','free','unconnected_position_blocked','reserved_inbound_connect','connected_drawing','connected_zero_draw','at_target_lifecycle_running','at_target_waiting','inspection','unplug_handling'];
  assert.deepEqual(Object.keys(port.partition).sort(),[...ORDER].sort());
  const classRows=insp.querySelectorAll('table').find(t=>t.querySelector('caption').textContent===`Time by class over the whole run, out of ${hoursText(P.horizon_tick)} for this port`).querySelectorAll('tbody tr');
  assert.deepEqual(classRows.map(r=>r.querySelector('th').textContent),ORDER.map(c=>`${term(`port.partition.${c}`).label_plain} ${c}`));
  assert.deepEqual(classRows.map(r=>r.querySelector('td .technical-only').textContent),ORDER.map(c=>` ${port.partition[c]} of ${P.horizon_tick} s`));
  unchanged(x,s0);
 }finally{x.close();}
});

test('inspector at the end of run: active-at-H rows, remaining work, the full reason set, the holder trail and its blockage record (M pair)',()=>{
 const x=setup('M');
 try{
  const s0=x.run(),B=x.P(),C=x.P('candidate'),H=B.horizon_tick,insp=x.by('inspector');
  const late=B.visits.find(v=>v.active_at_h.length);vehicleButtons(x).find(n=>n.textContent===late.id.slice(6)).click();
  assert.match(insp.textContent,/The full reason set and its holders are recorded at the end of the run\./);
  button(insp,'Show end of run').click();assert.equal(x.cursor(),H);
  const a=late.active_at_h[0],row=insp.querySelectorAll('table').find(t=>t.querySelector('caption').textContent==='Started but could not finish by end of run').querySelector('tbody tr');
  assert.equal(row.querySelector('th').textContent,a.template.replace(/_/g,' '));
  assert.equal(row.querySelectorAll('td')[3].textContent,'Started but could not finish by end of run');
  assert.equal(row.querySelectorAll('td')[4].textContent,`${a.minimum_duration_exceeded_time_left_at_start?'Yes':'No'}; at least ${hoursText(a.lower_bound_ticks)} needed minimum_duration_exceeded_time_left_at_start ${a.minimum_duration_exceeded_time_left_at_start}; lower_bound_ticks ${a.lower_bound_ticks}`);
  for(const [c,q] of Object.entries(late.remaining.reference))assert.match(insp.textContent,new RegExp(`${term('remaining_reference_seconds:'+c).label_plain}: [0-9,]+ s of reference work`));
  button(x.by('cursor'),'Candidate').click();assert.equal(x.cursor(),H,'both setups share one cursor');
  const held=C.visits.find(v=>v.id==='visit:07');vehicleButtons(x).find(n=>n.textContent==='07').click();
  assert.deepEqual(insp.querySelectorAll('.frontier li').map(l=>l.getAttribute('data-reason')),held.frontier_at_h.reasons.map(r=>r.code));
  const w=held.waits.find(v=>v[1]===H);assert.equal(insp.querySelector('[data-wait]').getAttribute('data-wait'),w[2]);assert.ok(insp.querySelector('[data-wait]').textContent.includes(ACCOUNTING));
  const level=()=>(insp.querySelector('.trail ol')?.children??[]).map(li=>li.querySelectorAll('ul button').map(b=>b.textContent.slice(16)));
  const holdersOf=id=>[...new Set(C.visits.find(v=>v.id===id).frontier_at_h.reasons.flatMap(r=>r.holder_visit_ids))].sort().map(h=>h.slice(6));
  assert.deepEqual(level(),[holdersOf('visit:07')]);
  button(insp,'Show the next holder level').click();
  const first=holdersOf('visit:07'),second=[...new Set(first.flatMap(h=>holdersOf(`visit:${h}`)))].filter(h=>h!=='07'&&!first.includes(h)).sort();
  assert.deepEqual(level(),[holdersOf('visit:07'),second]);
  if(second.every(h=>holdersOf(`visit:${h}`).length===0)){assert.equal(buttons(insp).filter(b=>b.textContent==='Show the next holder level').length,0);assert.match(insp.querySelector('.trail').textContent,/terminal holder or a repeated vehicle/);}
  assert.ok(level().length<=TRAIL_DEPTH);
  const block=C.blockage.find(b=>b.member_visit_ids.includes('visit:07'));
  assert.ok(insp.querySelector('.trail').textContent.includes(`${term('blockage.'+block.classification).label_plain}: Vehicle 07 waiting on ${block.held_resource_ids.map(r=>r.slice(r.indexOf(':')+1)).join(', ')}; terminal holder Vehicle ${block.terminal_holder_id.slice(6)}.`));
  button(insp,`Inspect Vehicle ${holdersOf('visit:07')[0]}`).click();assert.equal(x.sel(),`visit:${holdersOf('visit:07')[0]}`);assert.equal(level().length,1,'a new selection starts at depth 1');
  unchanged(x,s0);
 }finally{x.close();}
});

// A30 per vehicle (COPY-03, CA-NEW-02): release vehicle 23 of B at 42,908 s against release-by times 1 s later, equal,
// 1 s earlier and further away; release P vehicle 13 at 25,439 s against 25,440, 25,439 and 25,438 (the A30 1,199,
// 1,200 and 1,201 against 1,200 pattern); P vehicle 24 stays unreleased past due. The status comes from the verified
// on_time, due_status and overdue_s; exact seconds always follow the release-by and release times, and a late release
// carries its exact lateness, in both reading levels.
test('release-by status per vehicle in both reading levels, with exact seconds beside every release-by and release time',()=>{
 const cases=[['B','visit:23',23107,'Late by < 1 min (1 s)'],['B','visit:23',23108,'On time'],['B','visit:23',23109,'On time'],['B','visit:23',23200,'On time'],['B','visit:23',null,'Late by 25 min (1,508 s)'],
  ['B','visit:23',23500,'Released before its release-by time, which falls after the end of run'],['P','visit:24',null,'Not released by end of run; late by at least 6 h'],['P','visit:24',41790,'Not released by end of run; late by at least 30 s'],
  ['P','visit:13',24720,'On time'],['P','visit:13',24719,'On time'],['P','visit:13',24718,'Late by < 1 min (1 s)']];
 for(const [id,visit,off,status] of cases){
  const x=setup(id,{mode:'baseline'});
  try{
   if(off!==null)x.session.edit(a=>{for(const v of a.visits)v.due_tick=v.arrival_tick+off;},{scope:'both'});
   const s0=x.run(),v=x.P().visits.find(u=>u.id===visit),H=x.P().horizon_tick;
   if(id==='B'&&visit==='visit:23')assert.equal(v.released_at,42908,'the release does not depend on the release-by time');
   if(visit==='visit:13')assert.deepEqual([v.released_at,v.due_tick],[25439,720+off],'A30 primary pattern');
   x.session.setPresentation({selection:visit});
   const insp=x.by('inspector'),line=insp.querySelector('[data-due]'),seen=overview(insp);
   for(let n=line;n;n=n.parentNode)assert.ok(!isTech(n),'the status is in the normal flow of both reading levels');
   assert.equal(overview(line),`Release-by status: ${status}.`,`${id} ${off}`);
   assert.match(line.textContent,new RegExp(` due_status ${v.due_status}; on_time ${v.on_time}; overdue_s ${v.overdue_s}$`));
   const at=k=>`${k===H?'end of run':`${hoursText(k)} into the run`} (${secondsText(k)})`;
   assert.ok(seen.includes(`Release-by time: ${at(v.due_tick)}.`),`${id} ${off} exact release-by ${v.due_tick}`);
   if(v.released_at!==null)assert.ok(seen.includes(`Released from depot work: ${at(v.released_at)}`),`${id} ${off} exact release ${v.released_at}`);
   x.session.setPresentation({reading_level:'technical'});assert.equal(overview(insp.querySelector('[data-due]')),`Release-by status: ${status}.`);assert.equal(overview(insp),seen,'the same text in both reading levels');
   unchanged(x,s0);
  }finally{x.close();}
 }
});

// ARITH-07 (UI part): the ownership share is the verifier's owned_fraction; an out-of-service unit shows Not applicable,
// never "0 min of 12 h".
test('resource ownership uses the projection share and shows an out-of-service port as not applicable',()=>{
 const x=setup('B',{mode:'baseline'});
 try{
  x.session.edit(a=>{a.site.ports.find(p=>p.id==='AC01').enabled=false;},{scope:'both'});
  const s0=x.run(),P=x.P(),insp=x.by('inspector'),label=term('resource.owned_fraction').label_plain;
  const owned=()=>insp.querySelectorAll('p').find(p=>p.textContent.startsWith(label));
  x.session.setPresentation({selection:'port:AC01'});
  assert.equal(overview(owned()),`${label}: Not applicable, out of service.`);assert.doesNotMatch(insp.textContent,/Owned or reserved: .* of /);
  for(const q of P.resources.ports.filter(p=>p.enabled)){
   x.session.setPresentation({selection:q.id});
   const share=!Object.hasOwn(q,'owned_fraction')?'Not available':q.owned_fraction===null?'Not applicable':percentText(q.owned_fraction);
   assert.equal(overview(owned()),`${label}: ${share}; held ${hoursText(q.owned_ticks)}.`,q.id);
   assert.ok(owned().textContent.endsWith(` owned_fraction ${q.owned_fraction??null}; owned_ticks ${q.owned_ticks}`),q.id);
  }
  unchanged(x,s0);
 }finally{x.close();}
});

// ARITH-07-N1: out of service is read from the verified partition, so a port that is itself enabled but stands on a
// disabled position reads out of service, with the reason, in its header and in its share line.
test('a port on an out-of-service position reads out of service with the reason, never a bare Not applicable',()=>{
 const x=setup('B',{mode:'baseline'});
 try{
  x.session.edit(a=>{a.site.positions.find(p=>p.id==='P020').enabled=false;},{scope:'both'});
  const s0=x.run(),P=x.P(),insp=x.by('inspector'),label=term('resource.owned_fraction').label_plain;
  const ac=P.resources.ports.find(p=>p.id==='port:AC01');assert.deepEqual([ac.position,ac.enabled,ac.owned_fraction,ac.partition.unavailable],['position:P020',true,null,P.horizon_tick]);
  const owned=()=>overview(insp.querySelectorAll('p').find(p=>p.textContent.startsWith(label)));
  x.session.setPresentation({selection:'port:AC01'});
  assert.equal(insp.querySelectorAll('p')[0].textContent,'AC port rated 11 kW at position P020; out of service because position P020 is out of service.');
  assert.equal(owned(),`${label}: Not applicable, out of service.`);
  x.session.setPresentation({selection:'position:P020'});
  assert.match(insp.querySelectorAll('p')[0].textContent,/^Charging position with port AC01; out of service\.$/);assert.equal(owned(),`${label}: Not applicable, out of service.`);
  x.session.setPresentation({selection:'port:DC01'});assert.doesNotMatch(insp.querySelectorAll('p')[0].textContent,/out of service/);
  unchanged(x,s0);
 }finally{x.close();}
});

// ARITH-07 residual (C1.6): the per-class ownership summary names the installed, enabled and eligible denominators;
// Overview shows a truncated percentage, Technical inspection the exact p/q; a zero denominator is Not applicable and
// a projection without the summary says Not available. The summary numbers below are hand-built test fixtures.
test('the per-class ownership summary shows each denominator, exact on inspection, and Not available when absent',()=>{
 const x=setup('B',{mode:'baseline'});
 try{
  const s0=x.run(),P=x.P(),e=s0.result.envelopes.baseline;
  const S={ports:{installed_unit_ticks:172800,enabled_unit_ticks:129600,eligible_unit_ticks:129600,owned_unit_ticks:64801,fraction:{installed:'64801/172800',enabled:'64801/129600',eligible:'64801/129600'}},
   positions:{installed_unit_ticks:86400,enabled_unit_ticks:0,eligible_unit_ticks:0,owned_unit_ticks:0,fraction:{installed:'0/1',enabled:null,eligible:null}}};
  const {owned_summary:_,...bare}=P.resources,state=resources=>({...x.session.get(),result:{...s0.result,envelopes:{...s0.result.envelopes,baseline:{...e,projection:{...P,resources}}}}});
  const insp=x.by('inspector'),table=kind=>insp.querySelectorAll('table').find(t=>t.querySelector('caption').textContent===`Owned or reserved share across all ${kind}s, by denominator`);
  x.session.setPresentation({selection:'port:DC01'});x.render(state({...bare,owned_summary:S}));
  const rows=table('port').querySelectorAll('tbody tr');
  assert.deepEqual(rows.map(r=>r.childNodes.map(c=>overview(c))),[['Installed: every configured unit for the whole run','48 h','37.5…%'],['Enabled: units switched on','36 h','50.0…%'],['Eligible: time a unit could actually be used','36 h','50.0…%']]);
  assert.deepEqual(rows.map(r=>r.querySelectorAll('.technical-only').map(n=>n.textContent)),[[' installed_unit_ticks 172800',' fraction.installed 64801/172800'],[' enabled_unit_ticks 129600',' fraction.enabled 64801/129600'],[' eligible_unit_ticks 129600',' fraction.eligible 64801/129600']]);
  const held=insp.querySelectorAll('p').find(p=>p.textContent.startsWith('Across all ports'));
  assert.equal(overview(held),'Across all ports in this setup: owned or reserved for 18 h of unit time over the run.');assert.ok(held.textContent.endsWith(' owned_unit_ticks 64801'));
  x.session.setPresentation({selection:'position:P001'});x.render(state({...bare,owned_summary:S}));
  assert.deepEqual(table('position').querySelectorAll('tbody tr').map(r=>overview(r.childNodes[2])),['0%','Not applicable','Not applicable']);
  x.render(state(bare));
  assert.equal(table('position'),undefined);assert.ok(insp.querySelectorAll('p').some(p=>p.textContent==='Owned or reserved share across all positions: Not available.'));
  assert.equal(x.workers.length,1);assert.equal(x.session.get().result,s0.result);
 }finally{x.close();}
});

// COPY-05: M re-spaced to 950 s with the run ending 10 s after vehicle 24's downloads start leaves a 40-tick lower bound.
test('a lower bound under a minute reads in exact seconds, never "at least < 1 min"',()=>{
 const x=setup('M',{mode:'baseline'});
 try{
  x.session.edit(a=>{const t0=a.visits[0].arrival_tick;a.visits.forEach((v,i)=>{const at=t0+i*950;if(v.due_tick!==null)v.due_tick+=at-v.arrival_tick;v.arrival_tick=at;});a.arrival_window_tick=Math.max(a.arrival_window_tick,...a.visits.map(v=>v.arrival_tick+1));
   const fit=l=>l.forEach(i=>{if(i.end_tick===a.horizon_tick)i.end_tick=22252;});a.workers.forEach(w=>fit(w.availability));fit(a.vendor.availability);a.horizon_tick=22252;},{scope:'both'});
  const s0=x.run(),v=x.P().visits.find(u=>u.id==='visit:24');assert.equal(v.active_at_h.find(a=>a.template==='map_download').lower_bound_ticks,40);
  x.session.setPresentation({selection:'visit:24'});
  const rows=x.by('inspector').querySelectorAll('table').find(t=>t.querySelector('caption').textContent==='Started but could not finish by end of run').querySelectorAll('tbody tr');
  assert.deepEqual(rows.map(r=>overview(r.querySelectorAll('td')[4])),v.active_at_h.map(a=>`Yes; at least ${a.lower_bound_ticks<60?`${a.lower_bound_ticks} s`:hoursText(a.lower_bound_ticks)} needed`));
  assert.ok(rows.some(r=>overview(r).includes('at least 40 s needed')));assert.doesNotMatch(x.by('inspector').textContent,/at least < 1 min/);
  unchanged(x,s0);
 }finally{x.close();}
});

test('both reading levels render the same nodes; Technical-only detail carries exact values',()=>{
 const x=setup();
 try{
  x.run();vehicleButtons(x).find(n=>n.textContent==='03').click();input(x.by('cursor').querySelector('input[type="range"]'),ticksOf(x.P())[100]);
  const text=()=>REGIONS.map(id=>serialize(x.by(id))).join('');const before=text();
  x.session.setPresentation({reading_level:'technical'});assert.equal(text(),before);
  x.session.setPresentation({reading_level:'overview'});assert.equal(text(),before);
  assert.ok(x.by('inspector').querySelectorAll('.technical-only').length>0);
 }finally{x.close();}
});

test('copy and boundary rules for the inspector module',()=>{
 assert.deepEqual(copyProblems(literalsOf(SRC).map(text=>({where:'src/ui/depot-lab-inspector.js string',text}))),[]);
 assert.doesNotMatch(SRC,/aria-live|innerHTML|outerHTML|insertAdjacentHTML|\beval\b|new Function|localStorage|sessionStorage|indexedDB|document\.cookie|import\.meta|import\(|\.setAttribute\(/);
 assert.ok(literalsOf(SRC).every(s=>!/\bcosts?\b/i.test(s)),'holding time, never cost');
 const allowed=new Set(['./dom.js','../model/depot-lab/registry.js','./depot-lab-format.js']);
 for(const m of SRC.matchAll(/from '([^']+)'/g))assert.ok(allowed.has(m[1]),m[1]);
 assert.ok(SRC.includes(ACCOUNTING));assert.ok(!/[–—]/.test(SRC));
});
