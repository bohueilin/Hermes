// Lab C of the Scale lab, the density ladder. The shell test holds every lab to the contract; this file holds the
// laws, the hand rule, the controls, the refusal region and the pinned reference values of this lab.
// Engine calls are counted from outside: the public engine clones its configuration exactly once per call.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {LAB} from '../src/model/scale-density.js';
import {freezeScale} from '../src/model/scale-contract.js';
import {BAY_AREA_PLACES,bayAreaRoute} from '../src/model/bay-area.js';
import {defaultBayAreaConfig,simulateBayAreaOperations} from '../src/model/bay-operations.js';
import {createScaleLab} from '../src/ui/scale-lab.js';
import {installFakeDom} from './helpers/fake-dom.mjs';

const PERF=process.env.FLEET_PLAYGROUND_PERF==='1';
const pins=JSON.parse(readFileSync(new URL('./scale-density.pins.json',import.meta.url),'utf8'));
const source=readFileSync(new URL('../src/model/scale-density.js',import.meta.url),'utf8');
const TRIP='completed trips per 100 car-hours in hours 5 to 8',PLANS=['capacity','sites','one'],RUNGS=[24,48,72,96,120];
const drain=g=>{let s;do{s=g.next();}while(!s.done);return s.value;};
const counted=fn=>{const real=globalThis.structuredClone,configs=[];globalThis.structuredClone=x=>{configs.push(x);return real(x);};try{return {value:fn(),configs};}finally{globalThis.structuredClone=real;}};
const close=(a,b,tol=1e-9)=>Math.abs(a-b)<=tol*Math.max(1,Math.abs(a),Math.abs(b));
const H3=/\b(predict(?:s|ed|ing|ion|ions|ive)?|forecast(?:s|ed|ing|er|ers)?|expected\s+traffic|live|real[\s-]?time|monitoring)\b/i;
const H6=/\b(wins?|winners?|beats|scores?|scoring|gauges?|grades?|leaderboards?|revenue|costs?)\b|better option|best configuration/i;
const HOUSE=/\b(should|prove[sn]?|guarantee\w*|safe|safety|monitor\w*)\b/i,DASH=/[–—]/,LINKS=/https?:/i;
const PLACES=new RegExp(BAY_AREA_PLACES.map(p=>p.id).join('|')+'|ojai|ipace|i-pace|jaguar','i');

// One press per comparison at the default, shared by the tests below.
const cache=new Map();
function press(plan,config={}){
  const key=JSON.stringify([plan,config]);
  if(!cache.has(key)){const d=LAB.derive({...LAB.defaults(),plan,...config});assert.equal(d.ok,true,key);cache.set(key,{...counted(()=>drain(LAB.steps(d.setup))),derived:d});}
  return cache.get(key);
}

// The hand rule, written again from the engine's stated rules so that the module is checked against a second copy.
const CELL=BAY_AREA_PLACES.slice(2,11),km=(a,b)=>bayAreaRoute(a.id,b.id).distance_km,mins=d=>Math.ceil(d/38*60);
function cellFacts(sitePlaces){
  const ends=CELL.map(()=>0),share=sitePlaces.map(()=>0);let trip=0,ride=0,leg=0,legMin=0;
  for(const a of CELL){const w=CELL.map(b=>b===a?0:1/(2+km(a,b))**1.5),all=w.reduce((x,y)=>x+y,0);CELL.forEach((b,j)=>{const p=w[j]/all/9;trip+=p*km(a,b);ride+=p*mins(km(a,b));ends[j]+=p;});}
  CELL.forEach((p,j)=>{const d=sitePlaces.map(s=>km(p,s)),near=Math.min(...d),tied=d.filter(x=>x===near).length;d.forEach((x,i)=>{if(x===near)share[i]+=ends[j]/tied;});leg+=ends[j]*near;legMin+=ends[j]*mins(near);});
  return {trip,ride,leg,legMin,busier:Math.max(...share)};
}
const engineSites=n=>simulateBayAreaOperations({...defaultBayAreaConfig(),place_ids:CELL.map(p=>p.id),depot_count:n,fleet_size:1,requests_per_hour:0,duration_hours:1/60},{capture:false}).locations.filter(l=>l.kind==='depot').map(l=>CELL.find(p=>p.id===l.place_id));
const visitKwh=(f,empty)=>.24*(2*(f.trip+empty)+f.leg),busyMin=(f,empty)=>2+f.ride+(f.legMin+8+6+6+1+visitKwh(f,empty)/50*60)/2;

test('the typed assumptions equal the engine defaults, and the hand rule matches the road table and the engine site places',()=>{
  const c=defaultBayAreaConfig(),car=Object.values(c.vehicle_profiles)[0];
  assert.deepEqual([c.cleaning_minutes,c.software_minutes,c.software_every_visits,c.upload_minutes,c.road_speed_kph,c.patience_minutes,c.reserve_soc_pct,c.traffic_multiplier,c.weather],[8,12,2,6,38,12,15,1,'clear']);
  assert.deepEqual([car.battery_kwh,car.energy_kwh_per_km,car.boarding_minutes,car.cleaning_multiplier,car.software_multiplier,car.upload_multiplier],[84,.24,2,1,1,1]);assert.ok(car.charge_limit_kw>=50);
  assert.equal(CELL.length,9);assert.ok(!CELL.some(p=>p.kind==='airport'),'no airport place in the cell');
  const two=cellFacts(engineSites(2));
  assert.ok(close(two.trip,pins.hand.trip_km)&&close(two.ride,pins.hand.ride_min)&&close(two.leg,pins.hand.leg_km)&&close(two.legMin,pins.hand.leg_min)&&close(two.busier,pins.hand.busier));
  for(const [street,depot] of [[.68,.5],[.64,.4],[.72,.6],[.66,.55]]){
    const q=street*60/busyMin(two,two.trip),visits=24*q/2*two.busier,kw=Math.ceil(visits*visitKwh(two,two.trip)/depot/10)*10,bays=[8,6,6].map(m=>Math.max(1,Math.ceil(visits*m/60/depot)));
    const loadOf=(n,sites,m)=>{const f=cellFacts(engineSites(sites)),v=n*q/2*f.busier/m;return Math.max(v*visitKwh(f,two.trip)/kw,...[8,6,6].map((x,i)=>v*x/60/bays[i]));};
    for(const [plan,sites,m] of [['capacity',2,5],['sites',5,2],['one',1,10]]){
      const d=LAB.derive({plan,street,depot}),tested=loadOf(120,sites,m);
      if(!d.ok){assert.ok(Number(tested.toFixed(2))>.9,`${plan} ${street} ${depot} is refused only past the ceiling`);assert.match(d.reason,new RegExp(tested.toFixed(2).replace('.','\\.')));continue;}
      assert.ok(Number(tested.toFixed(2))<=.9);assert.ok(close(d.rows[3][1].v,q),'requests per car-hour');assert.ok(close(street,q*busyMin(two,two.trip)/60),'street load is requests times busy hours');
      assert.equal(d.rows[4][1],`${kw} kW, ${Math.max(2,Math.ceil(kw/50))}, ${bays.join(', ')}`);assert.ok(close(d.rows[6][1].v,tested),'tested plan load by hand');
      assert.equal(d.rows[5][1],RUNGS.map(n=>loadOf(n,2,plan==='capacity'?1:n/24).toFixed(2)).join(', '));
    }
  }
});

test('derive is pure: it never runs the engine, and it refuses every setup outside the readable region in words',()=>{
  const {value,configs}=counted(()=>{
    const out=[];
    for(const plan of PLANS)for(let s=60;s<=76;s+=2)for(let d=30;d<=70;d+=5)out.push([plan,s/100,d/100,LAB.derive({plan,street:s/100,depot:d/100})]);
    for(const nothing of [null,undefined,'',7])out.push(['bad',0,0,LAB.derive(nothing)]);
    for(const bad of [{plan:'x'},{plan:undefined},{street:NaN},{street:''},{street:'0.68'},{street:null},{depot:undefined},{depot:Infinity}])out.push(['bad',0,0,LAB.derive({...LAB.defaults(),...bad})]);
    return out;
  });
  assert.equal(configs.length,0,'no engine call in derive');
  for(const [plan,street,depot,d] of value){
    const inBand=plan!=='bad'&&street>=.64&&street<=.72&&depot>=.4&&depot<=.6;
    if(!inBand||!d.ok){assert.equal(d.ok,false,`${plan} ${street} ${depot}`);assert.ok(d.reason.length>10);assert.doesNotMatch(d.reason,/NaN|undefined|null|_|Infinity/);assert.doesNotMatch(d.reason,/^[A-Z]/,'a fragment that continues the sentence of the view');for(const re of [H3,H6,HOUSE,DASH,LINKS])assert.doesNotMatch(d.reason,re);}
    if(inBand&&plan!=='sites')assert.equal(d.ok,true,`${plan} ${street} ${depot} is inside the region`);
    if(inBand&&plan==='sites'&&!d.ok)assert.match(d.reason,/^by hand the busier site of the tested plan would stand at (0\.9[1-9]|1\.\d\d) of its capacity/);
    if(d.ok){assert.ok(Number(d.rows[6][1].v.toFixed(2))<=.9);assert.notEqual(LAB.derive({plan,street,depot}).rows,d.rows);}
  }
  assert.equal(LAB.derive({plan:'sites',street:.68,depot:.6}).ok,false,'a refusal a reader can reach');
  assert.equal(LAB.derive({plan:'sites',street:.68,depot:.55}).ok,true);
});

test('opening the lab, arriving by lesson and changing an input run the engine zero times',()=>{
  const restore=installFakeDom();
  try{
    const {configs}=counted(()=>{
      const view=createScaleLab();document.body.appendChild(view.element);view.setLesson(LAB);
      for(const label of ['Street load at the first rung','Depot load at the first rung']){const input=view.element.querySelector(`[aria-label="${label}"]`);for(const v of ['0.7','0.9','','0.66']){input.value=v;input.dispatchEvent(new Event('change'));}}
      const select=view.element.querySelector('[aria-label="Comparison"]');for(const v of ['sites','one','capacity']){select.value=v;select.dispatchEvent(new Event('change'));}
      assert.equal(view.getState().result,null);view.destroy();
    });
    assert.equal(configs.length,0);
  }finally{restore();}
});

test('one press stays inside the run budget, records every engine call and changes only the declared fields',()=>{
  const base=defaultBayAreaConfig(),declared=['place_ids','ojai_share_pct','peak_multiplier','start_hour','duration_hours','initial_soc_pct','charge_target_pct','trips_between_visits','fleet_size','requests_per_hour','depot_count','charger_kw','site_power_kw','chargers','cleaning_bays','software_bays','upload_bays','seed'];
  for(const plan of PLANS){
    const {value:r,configs}=press(plan);
    assert.equal(r.work.engine_runs,configs.length,`${plan}: the recorded count is the counted count`);assert.equal(configs.length,pins.presses[`${plan}|0.68|0.5`].engine_runs);
    assert.ok(configs.length<=120);assert.ok(JSON.stringify(r).length<=65536);
    for(const c of configs){
      assert.equal(c.duration_hours,8);assert.equal(c.start_hour,19);assert.equal(c.peak_multiplier,1);assert.equal(c.place_ids.length,9);assert.ok(c.requests_per_hour<=240);
      for(const k of Object.keys(base))if(!declared.includes(k))assert.deepEqual(c[k],base[k],`${k} stays at the Fleet day default`);
      assert.deepEqual(Object.keys(c).sort(),Object.keys(base).sort(),'no extension key');
    }
    // Equal total capacity at every rung: a siting plan holds what the in-step depot holds, in whole units.
    const unit=configs.find(c=>c.fleet_size===24),total=c=>['site_power_kw','chargers','cleaning_bays','software_bays','upload_bays'].map(k=>c[k]*c.depot_count);
    if(plan!=='capacity')for(const c of configs.filter(c=>c.site_power_kw/unit.site_power_kw<2*c.fleet_size/24))assert.deepEqual(total(c),total(unit).map(x=>x*c.fleet_size/24),`${plan} at ${c.fleet_size} cars`);
    if(plan==='sites')assert.deepEqual([...new Set(configs.filter(c=>c.depot_count!==2||c.fleet_size<72).map(c=>`${c.fleet_size}:${c.depot_count}`))].sort(),['120:5','24:2','48:2','72:3','96:4']);
  }
  assert.match(source,/capture:false/);assert.doesNotMatch(source,/capture:true|Math\.random|Date\.|performance\./);
});

test('the default press reproduces its pinned reference values, twice',()=>{
  for(const plan of PLANS){
    const pin=pins.presses[`${plan}|0.68|0.5`],r=press(plan).value;
    if(plan==='capacity')assert.equal(JSON.stringify(drain(LAB.steps(press(plan).derived.setup))),JSON.stringify(r),'two presses, one record');
    assert.equal(r.validity,'VALID');assert.equal(r.label,pin.main.label);assert.equal(r.analysis.outcome,pin.main.outcome);assert.equal(r.analysis.recommendation,pin.main.recommendation);
    for(const k of ['baseline_mean','candidate_mean','mean_delta','ci_low','ci_high'])assert.ok(close(r.analysis.primary[k],pin.main[k]),`${plan} ${k}`);
    r.analysis.guardrail_statuses.forEach((g,i)=>{assert.ok(close(g.harm,pin.main.harms[i]));assert.equal(g.status,pin.main.statuses[i]);});
    r.per_seed.forEach((s,i)=>{assert.equal(s.seed,pin.per_seed[i].seed);assert.ok(close(s.baseline[TRIP],pin.per_seed[i].baseline)&&close(s.candidate[TRIP],pin.per_seed[i].candidate));});
    r.tables[0].rows.forEach((row,i)=>row.slice(1).forEach((c,j)=>assert.ok(close(c.v,pin.by_rung[i][j]),`${plan} rung ${i} column ${j}`)));
    r.chart.series.forEach((s,i)=>s.values.forEach((v,j)=>assert.ok(close(v,pin.chart[i][j]))));
  }
});

test('the laws read on the default press: density, diminishing returns, car time moving to the depot, siting',()=>{
  const c=press('capacity').value,rows=c.tables[0].rows.map(r=>r.slice(1).map(x=>x.v)),[drive0,drive1,queue]=c.chart.series.map(s=>s.values);
  const km=rows.map(r=>r[1]);
  assert.ok(km[4]<=.8*km[0],'in step, pickups at 120 cars are at most four fifths of the first rung');
  assert.ok(km[0]-km[2]>km[2]-km[4],'most of the gain arrives early');
  // The depot load by hand of the control sits beside trips per car: it is the input row, and trips fall once it passes 1.
  assert.equal(rows.map(r=>r[2].toFixed(2)).join(', '),press('capacity').derived.rows[5][1]);assert.deepEqual(rows.map(r=>r[2].toFixed(2)),['0.47','0.95','1.42','1.90','2.37']);
  rows.forEach((r,i)=>{if(r[2]>1)assert.ok(r[6]-r[5]>3&&r[5]<rows[i-1][5],`past its capacity by hand the fixed depot serves fewer trips per car at rung ${i}`);});assert.equal(rows[0][5],rows[0][6],'one depot at the first rung');
  assert.ok(Math.max(...km.slice(1))-Math.min(...km.slice(1))<.1*(km[0]-km[1]),'in step the pickup distance holds from the second rung');
  assert.ok(drive0[0]>queue[0]&&queue[4]>drive0[4]&&queue[4]>=.1,'with the depot fixed, car time moves from pickup driving to the depot queue');
  assert.ok(rows[4][0]>rows[0][0],'with the depot fixed, pickups lengthen');assert.ok(rows[4][5]<rows[0][5]-3,'and trips per car fall');
  assert.ok(Math.abs(rows[4][6]-rows[0][6])<6,'in step, trips per car hold: the dividend is not added trips');
  assert.equal(c.analysis.outcome,'IMPROVED');assert.equal(c.analysis.guardrail_regressions.length,0);assert.ok(c.analysis.primary.ci_low>3.6,'not pinned near the margin');
  const s=press('sites').value,o=press('one').value;
  assert.equal(s.analysis.outcome,'UNCHANGED');assert.equal(s.analysis.guardrail_regressions.length,0);assert.ok(s.tables[0].rows[4][2].v<.6*s.tables[0].rows[4][1].v,'same capacity in five sites: closer pickups, trips within the margin');
  for(const r of [s,o]){assert.ok(r.tables[0].rows.every(row=>Math.abs(row[3].v-.5)<.06),'a comparison against the in-step depot holds the depot load by hand at every rung');assert.match(r.notes[0].t,/^At 120 cars pickups read \{a\} in the control plan and \{b\} in the tested plan\. /);assert.equal(r.notes[0].v.a.v,r.tables[0].rows[4][1].v);assert.equal(r.notes[0].v.b.v,r.tables[0].rows[4][2].v);}
  assert.match(s.notes[0].t,/the primary measure cannot register a closer pickup\.$/);assert.doesNotMatch(o.notes[0].t,/cannot register/,'with one site the primary does register the change');
  assert.deepEqual([c,s,o].map(r=>r.controls.map(k=>k.as_declared)),[[undefined,true],[undefined,true],[undefined,true]],'the non-binding control carries its declared reading');
  assert.equal(o.analysis.recommendation,'HOLD');assert.ok(o.analysis.guardrail_regressions.length>=2,'one site: guardrails hold the change');
  for(const r of [c,s,o]){const [by,sim,ratio]=r.tables[1].rows[0].map(x=>x.v);assert.ok(close(ratio,sim/by)&&ratio>=.95&&ratio<=1.05,'busy minutes per trip by hand');}
  for(const r of [s,o])assert.ok(r.analysis.primary.candidate_mean<r.analysis.primary.baseline_mean+3,'judged against the in-step depot a plan cannot read improved');
});

test('the null control is a replay by the engine and the non-binding control stays within the margin',()=>{
  for(const plan of PLANS){
    const [replay,spare]=press(plan).value.controls;
    assert.equal(replay.spec.control,'null');assert.deepEqual(replay.spec.baseline,replay.spec.candidate);
    assert.ok(replay.analysis.primary.paired_deltas.every(d=>d===0));assert.ok(replay.analysis.guardrail_statuses.every(g=>g.harm===0&&g.status==='WITHIN'));
    assert.equal(replay.analysis.outcome,'UNCHANGED');assert.equal(replay.analysis.recommendation,'NO_RECOMMENDATION');
    assert.equal(spare.spec.control,'non-binding');assert.equal(spare.analysis.outcome,'UNCHANGED');assert.equal(spare.analysis.guardrail_regressions.length,0);
    assert.ok(Math.max(Math.abs(spare.analysis.primary.ci_low),Math.abs(spare.analysis.primary.ci_high))<2.4);
  }
  // The null arm and every replay run the engine: 90 ladder runs, 1 replay, 10 + 1 for the null control, 10 + 1 for the control with room.
  assert.deepEqual(PLANS.map(p=>press(p).configs.length),[113,103,113]);
  const {configs}=press('capacity'),top=configs.filter(c=>c.fleet_size===120&&c.site_power_kw===configs[0].site_power_kw);
  assert.equal(top.length,10+1+10+1,'the fixed depot at 120 cars: ladder, replay of the main test, null arm, replay of the null control');
});

test('swapping the arms flips the sign of the change and turns improved into worse',()=>{
  const d=LAB.derive(LAB.defaults()),s=d.setup.main.spec,swapped=freezeScale({lab:s.lab,version:s.model_version,change:s.change,baseline:s.candidate,candidate:s.baseline,seeds:s.seeds,primary:s.primary,guardrails:s.guardrails,resamples:s.resamples});
  const r=drain(LAB.steps({...d.setup,main:swapped})),pin=pins.presses['capacity|0.68|0.5'].main;
  assert.ok(close(r.analysis.primary.mean_delta,-pin.mean_delta));assert.equal(r.analysis.outcome,'REGRESSED');assert.equal(r.analysis.recommendation,'HOLD');
});

test('a defect in the engine gives an invalid record with no analysis and no recommendation',()=>{
  const setup=LAB.derive(LAB.defaults()).setup,real=simulateBayAreaOperations;
  const defects={
    'external demand differs between the arms, so the runs cannot be paired':(c,o)=>{const r=real(c,o);return c.site_power_kw>200?{...r,demand_signature:'00000000'}:r;},
    'car time, requests or energy did not reconcile in a run':(c,o)=>{const r=real(c,o);return {...r,metrics:{...r.metrics,energy_balance_error_kwh:c.fleet_size===72?.5:0}};},
    'a required measure was not available in a run, so there is no comparison':(c,o)=>{const r=real(c,o);return c.fleet_size===120?{...r,requests:r.requests.filter(q=>q.created_minute<240)}:r;},
  };
  for(const [reason,engine] of Object.entries(defects)){
    const r=drain(LAB.steps(setup,engine));
    assert.equal(r.validity,'INVALID_EXPERIMENT',reason);assert.equal(r.reason,reason);assert.equal(r.analysis,null);assert.equal(r.controls,undefined);assert.equal(r.evidence_status,'NOT_EVIDENCE');assert.equal(r.decision_authority,'NONE');
  }
  for(const plan of PLANS)for(const r of [press(plan).value,...press(plan).value.controls])assert.ok(r.analysis.guardrail_statuses.every(g=>g.status!=='NOT_EVALUABLE'),'no valid record holds a guardrail that could not be evaluated');
});

test('car time by activity equals the replay frames, minute by minute, in the measured hours',()=>{
  const {value:r,configs}=press('capacity'),first=configs.filter(c=>c.fleet_size===24),sums={available:0,pickup:0,queued:0};
  assert.equal(first.length,10);
  for(const c of first){const frames=simulateBayAreaOperations(c,{capture:true}).frames;for(const f of frames)if(f.minute>=240&&f.minute<480)for(const v of f.vehicles){if(v.state==='available')sums.available++;else if(v.state==='pickup')sums.pickup++;else if(v.state.startsWith('queued_'))sums.queued++;}}
  const all=10*24*240;
  assert.ok(close(r.tables[0].rows[0][4].v,sums.available/all),'idle');assert.ok(close(r.chart.series[0].values[0],sums.pickup/all),'pickup driving');assert.ok(close(r.chart.series[2].values[0],sums.queued/all),'depot queue');
});

test('the record and the module name no place, car model or operator, and the generated copy keeps the word rules',()=>{
  for(const literal of source.match(/'[^'\n]*'|`[^`]*`/g))assert.doesNotMatch(literal,PLACES,literal);
  for(const plan of PLANS){
    const r=press(plan).value,text=JSON.stringify(r);
    assert.doesNotMatch(text,PLACES);assert.doesNotMatch(text,/place_ids|vehicle_profiles|road_speed_kph/,'no engine configuration in the record');
    assert.deepEqual(Object.keys(r.spec.baseline).sort(),['depot','fleet','rule','street']);
    for(const re of [H3,H6,HOUSE,DASH,LINKS])assert.doesNotMatch(text,re);
    assert.ok(r.notes.length>=3);assert.match(r.chart.summary.t,/^Across \{n\} paired seeds: /);assert.match(r.chart.title,/hours 5 to 8/);assert.match(r.spec.primary.name,/hours 5 to 8/);
    assert.ok(r.chart.categories.every((c,i)=>c.startsWith(`${RUNGS[i]} cars`)));
    if(plan==='sites')assert.deepEqual(r.chart.categories.slice(2),['72 cars, 3 sites tested','96 cars, 4 sites tested','120 cars, 5 sites tested']);
  }
  assert.match(LAB.limits,/another window length gives another size of effect/);assert.match(LAB.limits,/road distances are those of the Fleet day map/);assert.match(LAB.limits,/no fleet, depot or service in those places is described\.$/);
  assert.doesNotMatch(LAB.limits+LAB.unknowns.join(' '),/real (fleet|depot|place)/,'the lab does not say that nothing here is real: its road distances are');
  const road=LAB.derive(LAB.defaults()).rows.filter(row=>/^Fleet day map/.test(row[2]));assert.equal(road.length,1);assert.equal(road[0][0],'Road distances');assert.match(road[0][2],/real region/);
});

test('the reader grid reproduces its pins, and the refused corner stays refused (FLEET_PLAYGROUND_PERF=1)',{skip:!PERF&&'set FLEET_PLAYGROUND_PERF=1'},()=>{
  for(const [key,pin] of Object.entries(pins.presses)){
    const [plan,street,depot]=key.split('|'),d=LAB.derive({plan,street:Number(street),depot:Number(depot)});
    if(pin.refused){assert.equal(d.ok,false);assert.equal(d.reason,pin.refused);continue;}
    const r=press(plan,{street:Number(street),depot:Number(depot)}).value;
    if(!pin.near_margin)assert.equal(r.analysis.outcome,pin.main.outcome,key);assert.equal(r.analysis.recommendation,pin.main.recommendation,key);assert.ok(close(r.analysis.primary.mean_delta,pin.main.mean_delta),key);assert.ok(close(r.analysis.primary.ci_low,pin.main.ci_low)&&close(r.analysis.primary.ci_high,pin.main.ci_high),key);
    assert.ok(r.controls[0].analysis.primary.paired_deltas.every(x=>x===0));assert.equal(r.controls[1].analysis.outcome,'UNCHANGED');
  }
});

test('shape robustness on pinned setups with seeds the design never tuned on (FLEET_PLAYGROUND_PERF=1)',{skip:!PERF&&'set FLEET_PLAYGROUND_PERF=1'},()=>{
  for(const s of pins.shape){
    const d=LAB.derive({plan:'capacity',street:s.street,depot:s.depot});assert.equal(d.ok,true);
    const m=d.setup.main.spec,seeds=Array.from({length:10},(_,i)=>s.set*1000+i+1),arm=(a,control,b=a)=>freezeScale({lab:m.lab,version:m.model_version,change:m.change,control,baseline:{...m.baseline,rule:a},candidate:{...m.baseline,rule:b},seeds,primary:m.primary,guardrails:m.guardrails});
    const r=drain(LAB.steps({...d.setup,main:arm('fixed',null,'step'),replay:arm('fixed','null'),spare:arm('step','non-binding','spare')})),rows=r.tables[0].rows.map(x=>x.slice(1).map(c=>c.v)),[drive,,queue]=r.chart.series.map(x=>x.values);
    const seen={A:rows[4][1]<=.8*rows[0][1],B:rows[0][1]-rows[2][1]>rows[2][1]-rows[4][1],C:drive[0]>queue[0]&&queue[4]>drive[4]&&queue[4]>=.1,D:r.analysis.outcome==='IMPROVED'&&!r.analysis.guardrail_regressions.length,
      E:r.controls[0].analysis.primary.paired_deltas.every(x=>x===0),F:r.controls[1].analysis.outcome==='UNCHANGED'&&!r.controls[1].analysis.guardrail_regressions.length};
    assert.deepEqual(seen,s.seen,`street ${s.street} depot ${s.depot} seed set ${s.set}`);
  }
  assert.equal(pins.shape.filter(s=>!Object.values(s.seen).every(Boolean)).length,1,'one known miss is pinned as a miss');
});

test('timing on the reference laptop: first chart and whole press (FLEET_PLAYGROUND_PERF=1)',{skip:!PERF&&'set FLEET_PLAYGROUND_PERF=1'},()=>{
  const setup=LAB.derive(LAB.defaults()).setup;drain(LAB.steps(setup));
  const g=LAB.steps(setup),t0=performance.now();let first=null,s;
  while(!(s=g.next()).done)if(first===null&&s.value?.partial)first=performance.now()-t0;
  // One engine run is one block, so no block limit is asserted here.
  assert.ok(first<=1000,`first chart after ${first} ms`);assert.ok(performance.now()-t0<=3000,'one press inside 3 s');
});
