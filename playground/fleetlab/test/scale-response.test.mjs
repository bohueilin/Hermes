// Scale lab A, response reserve: the lab's own tests. The shell test (scale-lab.test.mjs) holds the contract, the page and the
// copy of the default setup; this file holds the laws, the controls, the refusal region, the deliberate faults and the pins.
// Synthetic teaching model. Nothing here is evidence about any fleet.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {LAB,FLEETS,RULE,closedForm,leanPool,rates,leverRates,buildTape,applyEvent,simulateDay,deriveResponse} from '../src/model/scale-response.js';
import {scaleJson} from '../src/model/scale-contract.js';
import {cellText,fillText} from '../src/ui/scale-lab.js';

const PINS=JSON.parse(readFileSync(new URL('./scale-response.pins.json',import.meta.url),'utf8'));
const drain=g=>{let s;do{s=g.next();}while(!s.done);return s.value;};
const press=(config={},seeds,engine)=>{const d=deriveResponse({...LAB.defaults(),...config},seeds);assert.equal(d.ok,true,JSON.stringify(config));return drain(engine?LAB.steps(d.setup,engine):LAB.steps(d.setup));};
// One press a setup on the declared seeds, shared by the tests that read what the page prints.
const kept=new Map(),once=(config={})=>{const k=JSON.stringify(config);if(!kept.has(k))kept.set(k,press(config));return kept.get(k);};
// What a visitor reads: every table cell, every note and the chart summary, through the view's own text functions.
const printed=r=>[...r.tables.flatMap(t=>t.rows.flat().map(c=>[cellText(c),t.caption.split('.')[0]])),...r.notes.map((n,i)=>[fillText(n),'note '+(i+1)]),[fillText(r.chart.summary),'chart summary']];
const LONG=/\.\d{6,}/;
const value=c=>Number.isFinite(c?.v)?c.v:c,rows=t=>t.rows.map(r=>r.map(value)),near=(a,b,rel=1e-9)=>Math.abs(a-b)<=rel*Math.max(1,Math.abs(a),Math.abs(b));
const NONE={lever:'none',size:0,delay:0},shipped={buildTape,applyEvent,simulateDay},DESIGN=Array.from({length:12},(_,i)=>1001+i);
// Retyped from test/teaching-frames.test.mjs, which exports nothing.
const H3=/\b(predict(?:s|ed|ing|ion|ions|ive)?|forecast(?:s|ed|ing|er|ers)?|expected\s+traffic|live|real[\s-]?time|monitoring)\b/i;
const H6=/\b(wins?|winners?|beats|scores?|scoring|gauges?|grades?|leaderboards?|revenue|costs?)\b|better option|best configuration/i;
const V=/\b(improved|regressed|unchanged|inconclusive|advance_to_next_test|run_more_experiments|no_recommendation|hold)\b|\breads? (lower|higher|no change)\b|\bguardrails? (within|regress)|\bis expected to\b|\bthe harm\b/i;
const D=/\b(lower|higher|unchanged|more|fewer|less|rises?|rising|falls?|falling|longer|shorter|slower|faster|increases?|increased|decreases?|decreased|grows?|drops?|up|down|above|below|better|worse)\b/i;
const HOUSE=/\b(should|prove[sn]?|guarantee\w*|safe|safety|monitor\w*)\b/i,ALWAYS=[H3,H6,HOUSE,/https?:/i,/[–—]/];

test('the queue formula, the lean pools and the rates-only arithmetic match their hand values',()=>{
  assert.ok(near(closedForm(2).mean_wait_s,2*.65**2/1.65*30/(2*.35)),'two agents by hand: 21.948 s');
  assert.ok(near(closedForm(1,.5).mean_wait_s,30),'one agent at half load waits one answer time');
  assert.deepEqual(FLEETS.map(leanPool),PINS.engine.lean_pools);
  assert.deepEqual(rates(1300),PINS.engine.rates_1300);assert.deepEqual(rates(1300,20/14),PINS.engine.rates_1300_lean_large);
  assert.ok(near(rates(1300).load,.65*(1-rates(1300).moved+rates(1300).moved*1440/180)),'event load is the work offered in the event over capacity');
  assert.ok(rates(1200).depth>=RULE.depth&&rates(1100).depth<RULE.depth);
});

test('a tape depends on seed and fleet only, and the event moves requests without changing the work of the day',()=>{
  const t=buildTape(6000,3001),again=buildTape(6000,3001),pin=PINS.engine.tape_6000_seed_3001;
  assert.deepEqual([t.n,t.t[0],t.h[0],t.t[t.n-1]],[pin.n,pin.first_t,pin.first_h,pin.last_t]);
  assert.deepEqual(Array.from(t.t.slice(0,t.n)),Array.from(again.t.slice(0,again.n)));
  for(const load of [800,1200,1300,1600]){
    const e=applyEvent(t,load),sum=x=>Array.from(x).reduce((s,v)=>s+v,0),from=RULE.start_min*60,to=from+RULE.span_min*60;
    assert.equal(e.n,t.n);assert.equal(sum(e.line),sum(t.line.slice(0,t.n)),'same responder calls');assert.ok(near(sum(e.h),sum(t.h.slice(0,t.n)),1e-12),'same answer time');
    for(let i=1;i<e.n;i++)assert.ok(e.t[i]>=e.t[i-1],'sorted');
    for(let i=0;i<e.n;i++)if(e.moved[i])assert.ok(e.t[i]>=from&&e.t[i]<=to,'moved requests sit inside the event');
    assert.ok(Math.abs(sum(e.moved)/e.n-rates(load).moved)<.02);
  }
  assert.equal(applyEvent(t,1300).moved.reduce((s,v)=>s+v,0),PINS.engine.event_6000_seed_3001.moved);
  assert.deepEqual(simulateDay(applyEvent(t,1300),6,NONE),PINS.engine.day_no_lever_6000_seed_3001);
});

test('lever semantics: zero reserve changes nothing, reserve never adds stopped minutes, a directive releases only moved vehicle requests',()=>{
  for(const seed of [3001,3002,3003]){
    const e=applyEvent(buildTape(6000,seed),1300),none=simulateDay(e,6,NONE);
    assert.equal(none.broken,null);
    assert.deepEqual(simulateDay(e,6,{lever:'reserve',size:0,delay:45}),none);
    let last=none.stopped;for(const size of [1,2,3,4,5,6]){const d=simulateDay(e,6,{lever:'reserve',size,delay:45});assert.equal(d.broken,null);assert.ok(d.stopped<=last+1e-9,`reserve of ${size}`);last=d.stopped;}
    const early=simulateDay(e,6,{lever:'directive',size:0,delay:0}),late=simulateDay(e,6,{lever:'directive',size:0,delay:900});
    assert.equal(early.broken,null);assert.equal(early.vehicles,none.vehicles);assert.ok(early.stopped<none.stopped);
    assert.deepEqual(late,none,'a directive after the day has cleared equals no lever');
    const shared=simulateDay(e,6,{lever:'shared',size:0,delay:0});assert.equal(shared.broken,null);assert.ok(shared.late>none.late);
    const plain=simulateDay(buildTape(6000,seed),6,NONE);assert.equal(plain.vehicles,none.vehicles);assert.equal(plain.calls,none.calls);assert.equal(plain.clear,null);
  }
});

test('the readable region: every setting of the page grid is accepted, and each bound refuses with its reason',()=>{
  let accepted=0;for(const load of [1.2,1.3,1.4,1.5,1.6])for(const lever of ['reserve','directive'])for(let delay=15;delay<=240;delay+=15)if(deriveResponse({load,lever,delay}).ok)accepted++;
  assert.equal(accepted,160);
  for(const [config,reason] of [[{load:1.16},/burst depth of 4/],[{load:1.61},/burst depth of 4/],[{load:NaN},/burst depth of 4/],[{load:'wide'},/burst depth of 4/],[{lever:'both'},/two listed levers/],[{lever:undefined},/two listed levers/],[{delay:14},/15 to 240 whole minutes/],[{delay:241},/15 to 240 whole minutes/],[{delay:45.5},/15 to 240 whole minutes/],[{delay:null},/15 to 240 whole minutes/]]){
    const d=deriveResponse({...LAB.defaults(),...config});assert.equal(d.ok,false,JSON.stringify(config));assert.match(d.reason,reason);assert.doesNotMatch(d.reason,/undefined|NaN/);
  }
  assert.equal(deriveResponse(null).ok,false);assert.equal(deriveResponse({load:1.17,lever:'reserve',delay:45}).ok,true,'the floor is the burst depth, not the first step of the control');
  assert.deepEqual([1.2,1.3,1.4,1.5,1.6].map(load=>deriveResponse({...LAB.defaults(),load}).setup.size),[2,2,3,3,4],'reserve by rule');
});

test('the default press and four more setups reproduce their pins on the declared seeds',()=>{
  assert.deepEqual([...LAB.seeds],PINS.seeds);assert.equal(LAB.version,PINS.model_version);
  for(const pin of PINS.setups){
    const r=press(pin.config),again=press(pin.config);
    assert.equal(scaleJson(JSON.parse(JSON.stringify(r))),scaleJson(JSON.parse(JSON.stringify(again))),pin.name);
    for(const [got,want] of [[r,pin.main],...r.controls.map((c,i)=>[c,pin.controls[i]])]){
      assert.equal(got.label,want.label,pin.name);assert.equal(got.analysis.outcome,want.outcome);assert.equal(got.analysis.recommendation,want.recommendation);assert.equal(got.spec.margin,want.margin);
      const p=got.analysis.primary;assert.equal(p.baseline_mean,want.baseline_mean);assert.equal(p.candidate_mean,want.candidate_mean);assert.equal(p.mean_delta,want.mean_delta);
      assert.ok(near(p.ci_low,want.ci_low)&&near(p.ci_high,want.ci_high),pin.name+' interval');
      assert.equal(got.analysis.guardrail_statuses[0].status,want.guardrail_status);assert.equal(got.analysis.guardrail_statuses[0].harm,want.guardrail_harm);
    }
    assert.deepEqual(r.controls.map(c=>[c.spec.control,c.as_declared]),[['null',true],['non-binding',true],['guardrail',true]]);
    assert.deepEqual(r.chart.series.map(s=>({id:s.id,values:s.values})),pin.chart);
    assert.deepEqual(rows(r.tables[0]),pin.arms);assert.deepEqual(rows(r.tables[1]),pin.ladder);assert.deepEqual(rows(r.tables[2]),pin.reserve_sizes);assert.deepEqual(rows(r.tables[3]),pin.landing);assert.deepEqual(rows(r.tables[4]),pin.checks);
    assert.equal(r.tables[4].rows.length,6);assert.ok(r.tables[4].rows.every(w=>w[4]==='inside tolerance'));
    assert.deepEqual(r.tables.map(t=>t.caption.split('.')[0]).slice(1,4),['Pooling and a correlated event','Capacity near saturation','Landing in time'],'a law topic heads each caption that carries a law');
    assert.deepEqual([r.notes[0].v.x.v,r.notes[0].v.y.v],pin.rates_only,'the rates-only value of the tested arm and of the change');
    assert.ok(JSON.stringify(r).length<=65536);
  }
});

test('the laws read on the declared seeds and on seeds that took no part in the design',()=>{
  for(const seeds of [undefined,Array.from({length:12},(_,i)=>4001+i)])for(const config of [{},{lever:'directive',delay:180},{load:1.6,delay:120}]){
    const r=press(config,seeds),ladder=rows(r.tables[1]),sizes=rows(r.tables[2]).map(w=>w[2]),name=JSON.stringify(config);
    assert.ok(ladder[0][2]>ladder[1][2]&&ladder[1][2]>ladder[2][2]&&ladder[0][2]-ladder[2][2]>=1,'pooling: the ordinary wait steps with pool size '+name);
    assert.ok(ladder[2][4]>=.8*ladder[0][4],'burst: the event day at the largest fleet keeps at least 0.8 of the smallest '+name);
    assert.ok(ladder[2][8]<=ladder[0][8]/3,'falsifier: a burst under capacity is absorbed by the large pool '+name);
    assert.ok(ladder[2][13]>=2*ladder[2][4],'lean pool '+name);
    assert.deepEqual(ladder.map(w=>w[9]),FLEETS.map(f=>Math.ceil(f/1000*(r.spec.baseline.load-1000)/1000)),'the reserve by rule scales with the fleet, not with its root '+name);
    assert.deepEqual(ladder.map(w=>+w[11].toFixed(2)),[.65,.78,.93],'the lean pool is busier on an ordinary day as the fleet scales');
    // Landing in time: no lever first, then five landing times. A later landing never reads under an earlier one, and no lever is the ceiling.
    const landing=rows(r.tables[3]);assert.deepEqual(landing.map(w=>w[0]),['No lever',15,60,120,180,240]);
    for(const j of [1,3])for(let i=1;i<6;i++){assert.ok(landing[i][j]<=landing[0][j]+1e-9,name);if(i>1)assert.ok(landing[i][j]>=landing[i-1][j],`a later lever leaves more stopped minutes ${name}`);assert.ok(landing[i][j+1]<=landing[i][j]*1.05&&landing[i][j+1]>=landing[i][j]*.7,`rates only against simulated, row ${i} ${name}`);}
    assert.ok(sizes.every((v,i)=>i===0||v<=sizes[i-1]+1e-9)&&sizes[0]-sizes[1]>=3*(sizes[5]-sizes[6]),'saturation: the first agent against the last '+name);
    assert.equal(r.analysis.outcome,'IMPROVED',name);assert.ok(-r.analysis.primary.mean_delta>=.1*r.analysis.primary.baseline_mean);
    assert.deepEqual(r.controls.map(c=>c.as_declared),[true,true,true],name);
  }
  for(const config of [{load:1.2,delay:240},{load:1.2,lever:'directive',delay:240}])assert.notEqual(press(config).analysis.outcome,'IMPROVED','a late lever '+JSON.stringify(config));
});

test('deliberate faults: each is caught by the flag named for it',()=>{
  const scaled=(t,f)=>({...t,h:t.h.map(f)});
  const copies=(tape,load)=>{const e=applyEvent(tape,load),all=[...Array.from({length:tape.n},(_,i)=>({t:tape.t[i],h:tape.h[i],line:tape.line[i],moved:0})),...Array.from({length:e.n},(_,i)=>i).filter(i=>e.moved[i]).map(i=>({t:e.t[i],h:e.h[i],line:e.line[i],moved:1}))].sort((a,b)=>a.t-b.t);
    return {n:all.length,t:Float64Array.from(all,x=>x.t),h:Float64Array.from(all,x=>x.h),line:Uint8Array.from(all,x=>x.line),moved:Uint8Array.from(all,x=>x.moved),end:e.end,fleet:tape.fleet};};
  const swapped=(tape,load)=>{const e=applyEvent(tape,load);let i=1000;while(e.line[i]||e.line[i+1])i++;[e.t[i],e.t[i+1]]=[e.t[i+1],e.t[i]];return e;};
  const outside=r=>r.tables[4].rows.filter(w=>w[4]!=='inside tolerance').length;
  const clean=press({},DESIGN);assert.equal(clean.validity,'VALID');assert.deepEqual(clean.controls.map(c=>c.as_declared),[true,true,true]);assert.equal(outside(clean),0);
  const shifted=press({},DESIGN,{...shipped,simulateDay:(t,a,arm)=>simulateDay(arm.lever==='reserve'?scaled(t,(v,i,h)=>h[(i+1)%t.n]):t,a,arm)});
  assert.deepEqual(shifted.controls.map(c=>c.as_declared),[false,true,true],'a zero-size lever that shifts the draws: null control');
  const quick=press({},DESIGN,{...shipped,simulateDay:(t,a,arm)=>simulateDay(arm.lever==='reserve'&&arm.size?scaled(t,v=>v*a/(a+arm.size)):t,a,arm)});
  assert.equal(quick.controls[1].as_declared,false,'reserve agents that also shorten answers: ample pool control');assert.equal(quick.controls[1].analysis.outcome,'IMPROVED');
  assert.match(quick.controls[1].title,/Not read as declared/);
  const copied=press({},DESIGN,{...shipped,applyEvent:copies});
  assert.equal(copied.validity,'INVALID_EXPERIMENT');assert.match(copied.reason,/equal request count/);assert.equal(copied.controls,undefined,'no comparison is read');
  const order=press({},DESIGN,{...shipped,applyEvent:swapped});assert.equal(order.validity,'INVALID_EXPERIMENT');assert.match(order.reason,/answer order/);
  const busy=press({},DESIGN,{...shipped,buildTape:(f,s)=>({...buildTape(Math.round(f*1.1),s),fleet:f})});assert.equal(outside(busy),6,'request rate 10% high: every row of the cross-check');
  const narrow=press({},DESIGN,{...shipped,buildTape:(f,s)=>scaled(buildTape(f,s),v=>30+(v-30)/2)});assert.equal(outside(narrow),4,'answer time with half the spread');
  const short=press({},DESIGN,{...shipped,buildTape:(f,s)=>scaled(buildTape(f,s),v=>v*.9)});assert.equal(outside(short),6,'answer time 10% short');
  const idle=press({},DESIGN,{...shipped,simulateDay:(t,a,arm)=>simulateDay(t,a,arm.lever==='shared'?{...arm,lever:'none'}:arm)});
  assert.deepEqual(idle.controls.map(c=>c.as_declared),[true,true,false],'a shared line that changes nothing: guardrail control');
  // Detection limit of the ample pool control: a side effect under 5% of the ordinary-day value is not flagged.
  const faint=press({},DESIGN,{...shipped,simulateDay:(t,a,arm)=>simulateDay(arm.lever==='reserve'&&arm.size?scaled(t,v=>v*.97):t,a,arm)});assert.equal(faint.controls[1].as_declared,true);
});

test('one press builds each tape once per rung, replays the first seed from a fresh tape, and yields between days',()=>{
  let tapes=0,days=0;const d=deriveResponse(LAB.defaults()),g=LAB.steps(d.setup,{...shipped,buildTape:(f,s)=>{tapes++;return buildTape(f,s);},simulateDay:(t,a,arm)=>{days++;return simulateDay(t,a,arm);}});
  let first=null,steps=0,labels=new Set(),s;while(!(s=g.next()).done){steps++;if(s.value?.label)labels.add(s.value.label);if(first===null&&s.value?.partial)first=days;}
  assert.equal(days,12*30+4,'30 days a seed and four replays');assert.equal(tapes,12*4+4,'one tape a seed for each of four passes, and four fresh tapes for the replays');
  assert.equal(first,24,'the first painted rung follows 24 days');assert.ok(steps>days);
  assert.deepEqual([...labels],['Simulated days','Paired runs','Paired bootstrap','Null control','Ample pool control','Guardrail control']);
});

test('copy: every string the lab can show keeps the copy rules, before and after a run',()=>{
  const before=new Set([LAB.title,LAB.short,LAB.limits,LAB.geography,...LAB.frame.slice(0,4),...LAB.controls.flatMap(c=>[c.label,c.unit??'',...(c.options??[]).map(o=>o[1])])]);
  for(const load of [1.2,1.3,1.4,1.5,1.6])for(const lever of ['reserve','directive'])for(let delay=15;delay<=240;delay+=15){const d=deriveResponse({load,lever,delay});before.add(d.setup.main.spec.change);
    for(const r of d.rows){assert.match(r[2],/^(You choose|Teaching assumption|Sizing rule|Governing ratio)/);for(const s of [r[0],typeof r[1]==='string'?r[1]:r[1].u??'',r[2]])before.add(s);}}
  for(const bad of [{load:1},{load:1.334},{lever:'x'},{delay:1}])before.add(deriveResponse({...LAB.defaults(),...bad}).reason);
  for(const s of before)for(const re of [...ALWAYS,V,D])assert.doesNotMatch(s,re,s);
  const r=press(),after=[...LAB.unknowns,...r.notes.map(n=>typeof n==='string'?n:n.t),...r.controls.map(c=>c.title),...r.tables.flatMap(t=>[t.caption,...t.heads,...t.rows.flat().filter(c=>typeof c==='string')]),r.chart.title,r.chart.summary.t,...r.chart.series.map(s=>s.label)];
  for(const s of after)for(const re of ALWAYS)assert.doesNotMatch(s,re,s);
  assert.ok(LAB.frame[0].length<=160&&LAB.frame[1].length<=220&&LAB.frame[2].length+LAB.frame[3].length<=240);
  assert.ok(LAB.frame.slice(0,4).join(' ').split(/\s+/).length<=100,'the frame leaves room for 130 words from the heading to Run');
  assert.ok(r.notes.some(n=>n.v?.x?.absent),'what a vehicle does after release is absent, with its reason');
});

test('rates only for a lever arm: hand values, identities, and the simulated change over the page grid',()=>{
  const near4=(a,b)=>Math.abs(a-b)<=1e-6*Math.max(1,Math.abs(b));
  // By hand at event load 1.3, a reserve of 2 after 45 min: the backlog grows at 0.6 a minute for 45 min, holds a rise of 2 * (1.3 - 4 / 3)
  // to the end of the event, then drains at 2 * (4 / 3 - 0.65 * 6 / 7).
  const o=.65*6/7,q1=.6*45,q2=q1+2*(1.3-4/3)*135,hand=q1*45/2+(q1+q2)/2*135+q2*q2/(2*(4/3-o))/2+926.64;
  assert.ok(near4(leverRates(1300,'reserve',2,45),hand),`${leverRates(1300,'reserve',2,45)} against ${hand}`);
  for(const load of [1200,1300,1400,1500,1600])for(const d of [15,45,180,240]){
    assert.ok(near4(leverRates(load,'reserve',0,d),rates(load).stopped),'a reserve of zero is no lever');
    assert.ok(leverRates(load,'directive',0,d)<=rates(load).stopped+1e-9);
  }
  assert.ok(near4(leverRates(1200,'directive',0,240),rates(1200).stopped),'a directive after the last moved request has been answered is no lever');
  if(process.env.FLEET_PLAYGROUND_PERF!=='1')return;
  const mean=x=>x.reduce((s,v)=>s+v,0)/x.length;let read=0;
  for(const load of [1200,1300,1400,1500,1600]){
    const tapes=LAB.seeds.map(s=>applyEvent(buildTape(6000,s),load)),day=arm=>mean(tapes.map(t=>simulateDay(t,6,arm).stopped)),base=day(NONE),margin=rates(load).stopped*.05,size=Math.ceil(6*(load-1000)/1000);
    for(const lever of ['reserve','directive'])for(let delay=15;delay<=240;delay+=15){
      const sim=day({lever,size:lever==='reserve'?size:0,delay})-base,calc=leverRates(load,lever,size,delay)-rates(load).stopped;
      assert.ok(sim<=1e-9&&calc<=1e-9,'no lever adds stopped minutes');
      if(-sim>margin){read++;assert.ok(calc/sim>=.7&&calc/sim<=1.05,`${load} ${lever} ${delay}: ${calc} against ${sim}`);}
    }
  }
  assert.equal(read,154,'settings of the page grid whose simulated change passes the margin');
});

test('C1: a queue that is empty when the event ends clears in 0 min, and no early directive prints a long decimal',()=>{
  const day=(seed,arm)=>simulateDay(applyEvent(buildTape(6000,seed),1300),6,arm),early={lever:'directive',size:0,delay:15};
  for(const seed of [3001,3008])assert.equal(day(seed,early).clear,0,`seed ${seed}: nothing waits at the instant the event ends`);
  assert.equal(day(3006,early).clear,0.31592848337847196,'seed 3006: vehicles wait when the event ends, so the day keeps its reading');
  assert.equal(day(3001,NONE).clear,PINS.engine.day_no_lever_6000_seed_3001.clear,'a day with a backlog at the end of the event keeps its reading');
  for(const config of [{lever:'directive',delay:15},{lever:'directive',delay:45},{load:1.6,lever:'directive',delay:120},{load:1.2,lever:'directive',delay:135}]){
    const r=once(config),name=JSON.stringify(config);
    for(const [text,where] of printed(r))assert.doesNotMatch(text,LONG,`${name} ${where}`);
    for(const t of r.tables)for(const c of t.rows.flat())if(Number.isFinite(c?.v)&&c.v&&Math.abs(c.v)<.5/10**c.d)assert.equal(c.v,+c.v.toPrecision(2),`${name}: a value under half a unit of its last decimal is handed over at two significant digits`);
    const load=r.spec.baseline.load,days=LAB.seeds.map(s=>simulateDay(applyEvent(buildTape(6000,s),load),6,r.spec.candidate).clear),mean=days.reduce((s,v)=>s+v,0)/12;
    assert.ok(days.filter(v=>v===0).length>=6&&mean<.5,name+': most days are empty when the event ends');
    assert.equal(r.tables[0].rows[1][4].v,+mean.toPrecision(2),name+': the cell is the mean of the days, the empty ones as 0');assert.match(cellText(r.tables[0].rows[1][4]),/^0\.\d{2,3}$/);
  }
  assert.deepEqual(LAB.seeds.map(s=>day(s,early).clear).filter(v=>v),[0.31592848337847196],'at the default load one day of twelve has vehicles waiting when the event ends');
});

test('C2, C11: a directive that lands after the last moved request is answered reads the no-lever value itself',()=>{
  for(let load=1161;load<=1600;load++)for(let d=15;d<=240;d++){
    const c=leverRates(load,'directive',0,d)-rates(load).stopped;
    assert.ok(c===0||c<=-.5,`${load} ${d}: the rates-only change ${c} is zero or a change that can be read`);
    if(d>=load*.18+1e-9)assert.equal(c,0,`${load} ${d}: nothing is left to remove`);
  }
  for(const load of [1200,1300,1400,1500,1600])for(let d=15;d<=240;d+=15){const c=leverRates(load,'reserve',Math.ceil(6*(load-1000)/1000),d)-rates(load).stopped;assert.ok(c<=-.5,`reserve ${load} ${d}: ${c}`);}
  for(const config of [{load:1.2,lever:'directive',delay:225},{load:1.25,lever:'directive',delay:240}]){
    const r=once(config),name=JSON.stringify(config);
    assert.equal(r.notes[0].v.y.v,0,`${name}: the note would print ${r.notes[0].v.y.v}`);assert.equal(r.notes[0].v.x.v,rates(config.load*1000).stopped);
    for(const [text,where] of printed(r))assert.doesNotMatch(text,LONG,`${name} ${where}`);
    assert.equal(r.tables[3].rows[5][4].v,r.tables[3].rows[0][4].v,name+': landing after 240 min by rates only equals no lever');
  }
});

test('M1: the inputs say that a directive leaves responder calls in the pool, as the model does',()=>{
  for(const lever of ['reserve','directive'])assert.match(deriveResponse({...LAB.defaults(),lever}).rows.find(r=>r[0]==='Requests')[1],/A directive removes vehicle requests only\. Responder calls stay in the pool\./);
  for(const seed of [3001,3002]){
    const e=applyEvent(buildTape(6000,seed),1300),none=simulateDay(e,6,NONE),d=simulateDay(e,6,{lever:'directive',size:0,delay:15}),moved=Array.from(e.moved).filter((m,i)=>m&&e.line[i]).length;
    assert.ok(moved>0,'the event moved responder calls');assert.equal(d.calls,none.calls);assert.equal(d.broken,null,'every responder call is answered, the moved ones too: a call that is never answered breaks the request partition');
  }
});

test('M2: an event load off a step of 0.01 is refused with its reason, and no printed load reads as capacity when it is not',()=>{
  for(const load of [1.334,1.166,1.167,1.169,1.2001,1.3301,1.596,1.604]){const d=deriveResponse({...LAB.defaults(),load});assert.equal(d.ok,false,String(load));assert.match(d.reason,/steps of 0\.01/,String(load));assert.doesNotMatch(d.reason,/undefined|NaN/);}
  for(const load of [1.161,1.164,1.606])assert.match(deriveResponse({...LAB.defaults(),load}).reason,/burst depth of 4/,String(load));
  for(const load of [1.17,1.25,1.33,1.34,1.6]){
    const d=deriveResponse({...LAB.defaults(),load});assert.equal(d.ok,true,String(load));assert.equal(d.setup.load,Math.round(load*1000));
    assert.equal(cellText(d.rows[0][1]),load.toFixed(2)+' x capacity','the load shown is the load used');assert.equal(d.setup.size,Math.ceil(6*(d.setup.load-1000)/1000));
  }
  for(const load of [1.17,1.34,1.5]){
    const r=once({load}),size=deriveResponse({...LAB.defaults(),load}).setup.size;
    for(const [agents,after] of r.tables[2].rows){
      const shown=parseFloat(cellText(after));
      assert.equal(Math.sign(shown-1),Math.sign(after.v-1),`${load}, reserve of ${agents.v}: ${after.v} is printed as ${cellText(after)}`);
      assert.equal(after.v<=1,agents.v>=size,'the reserve by rule is the smallest that brings event load to capacity');
    }
  }
});

test('M17: the first note claims a direction from the inputs only on a press that read one',()=>{
  const claim=/so the direction of the main result follows from the inputs/,none=/The main result reads no reduction past the margin, so no direction is said to follow from the inputs\./;
  for(const [config,outcome] of [[{},'IMPROVED'],[{lever:'directive',delay:15},'IMPROVED'],[{delay:240},'INCONCLUSIVE'],[{load:1.2,lever:'directive',delay:225},'UNCHANGED']]){
    const r=once(config),text=fillText(r.notes[0]);
    assert.equal(r.analysis.outcome,outcome,JSON.stringify(config));
    assert.match(text,outcome==='IMPROVED'?claim:none,text);assert.doesNotMatch(text,outcome==='IMPROVED'?none:claim,text);
    assert.match(text,/The run adds chance, the ordinary wait and the late responder call fraction\.$/);
    for(const re of ALWAYS)assert.doesNotMatch(text,re,text);
  }
});

test('M20: every number of the chart summary, the first note and the burst column is named by unit and fleet size',()=>{
  const r=once(),unit='stopped vehicle-minutes per 1,000 vehicles';
  assert.equal(fillText(r.chart.summary),`Across 12 paired seeds, in ${unit}: event day 18,908, 17,738 and 17,032 at 2,000, 6,000 and 20,000 vehicles with one staffing ratio, and 17,231 by rates only at every size. The lean pool is in the table.`);
  assert.match(fillText(r.notes[0]),/^By rates only at 6,000 vehicles, in stopped vehicle-minutes per 1,000 vehicles, the tested arm reads 4,676 and the change -12,555\. /);
  assert.ok(r.tables[1].caption.endsWith(`Event-day columns, the two seed columns, rates only and the burst column are ${unit}.`),r.tables[1].caption);
  assert.equal(r.tables[1].heads[8],'Added by a burst at 0.8 of capacity');
});

test('M22: a chart painted while the press computes carries a whole sentence of its own',()=>{
  const g=LAB.steps(deriveResponse(LAB.defaults()).setup),seen=[];let s;
  while(!(s=g.next()).done)if(s.value?.partial)seen.push(s.value.partial.chart);
  assert.deepEqual(seen.map(c=>fillText(c.summary)),[1,1,2,3].map(k=>`Computing across 12 paired seeds: event day has run at ${k} of 3 fleet sizes.`));
  assert.deepEqual(seen.map(c=>c.series[0].values.map(v=>Number.isFinite(v))),[[false,true,false],[false,true,false],[true,true,false],[true,true,true]],'the bars still show each fleet size as it ends');
  for(const c of seen)for(const re of [...ALWAYS,/not available|table/])assert.doesNotMatch(fillText(c.summary),re);
  assert.match(fillText(s.value.chart.summary),/^Across 12 paired seeds, .* The lean pool is in the table\.$/,'the recorded chart keeps the full sentence');
});

test('M8: chart categories are the fleet sizes as short numbers, and the category head names their unit',()=>{
  // The view thins labels by the widest one. At 14 and 15 characters a phone kept two of three and dropped the tested fleet size.
  const d=deriveResponse(LAB.defaults()),g=LAB.steps(d.setup);let s,first=null;
  while(!(s=g.next()).done)first??=s.value?.partial?.chart;
  for(const c of [first,s.value.chart]){
    assert.deepEqual(c.categories,['2,000','6,000','20,000']);assert.ok(c.categories.every(x=>x.length<=8));
    assert.equal(c.category,'Fleet size, vehicles','the table twin names the unit the labels leave out');
    for(const re of [...ALWAYS,V,D])assert.doesNotMatch(c.category,re);
  }
});

test('timing on the reference laptop',{skip:process.env.FLEET_PLAYGROUND_PERF!=='1'},()=>{
  for(let i=0;i<3;i++)press();
  const d=deriveResponse(LAB.defaults()),g=LAB.steps(d.setup),t0=performance.now();let last=t0,longest=0,first=null,s;
  while(!(s=g.next()).done){const now=performance.now();longest=Math.max(longest,now-last);last=now;if(first===null&&s.value?.partial)first=now-t0;}
  assert.ok(first<=1000,`first painted rung after ${first} ms`);assert.ok(performance.now()-t0<=3000);assert.ok(longest<=8,`longest block ${longest} ms`);
});

test('M1: the declared change of a directive says what the model does, vehicle requests only',()=>{
  const d=LAB.derive({load:1.3,lever:'directive',delay:45});assert.equal(d.ok,true);
  assert.equal(d.setup.main.spec.change,'A directive removes the ask of every vehicle request moved into the event, from 45 min after the event starts.');
});
