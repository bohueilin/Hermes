import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {runFlowComparison,flowScenario,simulateFlow} from '../src/model/depot-flow.js';
import {verifyFlow} from '../src/model/depot-flow-verify.js';
import {inspectAt,tasksAt} from './helpers/depot-flow-oracle.mjs';
const view=await import('../src/ui/depot-flow-view.js').catch(()=>({}));
const result=(options={},run_id=1)=>({...runFlowComparison(options),run_id});
const vehicle=(state,id)=>state.vehicles.find(v=>v.vehicle===id);
const requireView=()=>assert.equal(typeof view.inspectState,'function','the pure projection is required');
const allOptions=()=>[0.5,1].flatMap(uplink_gbps=>[7.5,15,45].flatMap(b_gb=>[20,60].map(charger_kw=>({uplink_gbps,b_gb,charger_kw}))));

test('literal minutes 3, 5 and 11 explain only the current prerequisites and holders',()=>{
  requireView();const r=result(),[fifo,equal,deadline]=r.arms;
  assert.equal(vehicle(view.inspectState(fifo.record,180),'B').text.upload,'0 of 7.5 GB · Waiting for uplink · held by A');
  assert.equal(vehicle(view.inspectState(equal.record,180),'B').text.post,'Running · 1 min of 2 min');
  assert.equal(vehicle(view.inspectState(deadline.record,180),'B').text.readiness,'Ready in this model since minute 3');
  assert.equal(vehicle(view.inspectState(fifo.record,300),'B').text.readiness,'Not ready · waits for upload, post-upload step · deadline reached');
  const a=vehicle(view.inspectState(fifo.record,660),'A');
  assert.equal(a.text.post,'Running · 1 min of 2 min');assert.equal(a.text.readiness,'Not ready · waits for post-upload step');
  const eq=vehicle(view.inspectState(equal.record,660),'A');
  assert.equal(eq.text.upload,'Upload finished at minute 11');assert.equal(eq.text.post,'Running · 0 min of 2 min');
  assert.equal(eq.tasks.post.completed_s,null);assert.equal(eq.ready_s,null);
  assert.equal(vehicle(view.inspectState(equal.record,180),'B').text.energy,'Already at target on arrival');
});

test('all 36 arms match independent interval arithmetic and event folds at every whole and half second',()=>{
  requireView();
  for(const options of allOptions())for(const {record,verification} of result(options).arms){
    let before=null;
    for(let t=0;t<=record.scenario.horizon_s;t+=0.5){
      const actual=view.inspectState(record,t),oracle=inspectAt(record,t),tasks=tasksAt(record,t),current=record.intervals.find(i=>i.start_s<=t&&t<i.end_s);
      assert.equal(actual.time_s,t);assert.equal(actual.interval_id,current?.id??null);
      assert.deepEqual(actual.upload_holders,Object.entries(current?.upload??{}).filter(([,n])=>n>0).map(([id])=>id));
      for(const [j,a] of actual.vehicles.entries()){
        assert.deepEqual({vehicle:a.vehicle,upload_bytes:a.upload_bytes,energy_j:a.energy_j,ready_s:a.ready_s},oracle[j]);
        for(const task of ['upload','charge','post'])assert.equal(a.tasks[task].completed_s,tasks[a.vehicle][task]);
        assert.equal(a.ready,tasks[a.vehicle].ready!==null);assert.equal(a.upload_rate_bytes_s,current?.upload[a.vehicle]??0);
        assert.equal(a.charge_rate_j_s,current?.charge[a.vehicle]??0);
        const v=record.scenario.vehicles[j];assert.ok(a.upload_bytes<=v.upload_bytes&&a.energy_j<=v.energy_j);
        if(before){assert.ok(a.upload_bytes>=before.vehicles[j].upload_bytes);assert.ok(a.energy_j>=before.vehicles[j].energy_j);if(before.vehicles[j].ready)assert.equal(a.ready,true);}
        assert.ok(!a.ready||a.waiting_for.length===0);
      }
      before=actual;
    }
    for(const actual of before.vehicles){const v=verification.visits.find(x=>x.vehicle===actual.vehicle);assert.equal(actual.upload_bytes,v.upload_bytes);assert.equal(actual.energy_j,v.energy_j);assert.equal(actual.ready_s,v.ready_s);}
  }
});

test('projection remains independent of the NF01 verifier and accepts quarter-second four-vehicle records',()=>{
  requireView();
  const record={rule:'cohort',end_s:0.5,scenario:{horizon_s:0.5,vehicles:['A','B','C','D'].map(id=>({id,arrival_s:0,deadline_s:0.5,upload_bytes:10,energy_j:0,post_s:1}))},intervals:[{id:0,start_s:0,end_s:0.25,upload:{A:4},charge:{}},{id:1,start_s:0.25,end_s:0.5,upload:{B:4},charge:{}}],events:['A','B','C','D'].flatMap((id,i)=>[{seq:i*2,time_s:0,type:'arrival',vehicle:id,task:null},{seq:i*2+1,time_s:0,type:'complete',vehicle:id,task:'charge'}])};
  const state=view.inspectState(record,0.375);assert.equal(state.vehicles.length,4);assert.equal(vehicle(state,'A').upload_bytes,1);assert.equal(vehicle(state,'B').upload_bytes,0.5);assert.deepEqual(state.upload_holders,['B']);
  assert.equal(view.inspectState(record,0.5).interval_id,null);
});

test('guided moments use verified boundaries across every setting and literal golden lists',()=>{
  requireView();
  for(const [options,times] of [[{},[0,180,300,360,600,720,780]],[{b_gb:45},[0,300,360,480,600,720,900,1080]],[{charger_kw:20},[0,180,300,600,900,1080]]]){
    const r=result(options,8),moments=view.guidedMoments(r);assert.deepEqual(moments.map(m=>m.time_s),times);
    for(const m of moments){assert.equal(m.run_id,8);assert.ok(m.caption.startsWith(`Minute ${m.time_s/60}.`));assert.ok(m.label.startsWith(`Minute ${m.time_s/60}`));}
  }
  for(const options of allOptions()){const moments=view.guidedMoments(result(options));assert.ok(moments.length>=6&&moments.length<=8);}
});

test('event sentences group actual events and deadline outcomes without future readiness',()=>{
  requireView();const r=result();
  for(const [time_s,want] of [
    [0,'Minute 0. All three rules: both vehicles arrive. Vehicle B battery already at target.'],
    [240,'Minute 4. Equal uplink share: Vehicle B ready.'],
    [300,'Minute 5. Vehicle B departure deadline. First come, first served: not ready, deadline missed. Equal uplink share: ready at minute 4, on time. Departure deadline first: ready at minute 3, on time.'],
    [360,'Minute 6. All three rules: Vehicle A battery at target.'],
    [660,'Minute 11. First come, first served: Vehicle B upload complete. Equal uplink share: Vehicle A upload complete. Departure deadline first: Vehicle A upload complete.'],
    [61,'Minute 1.0166666666666666. No recorded events at this minute.']])assert.equal(view.eventSentence(r,time_s),want);
});

test('forged accepted flags, completion tables and service intervals cannot enter explanation functions',()=>{
  requireView();
  for(const mutate of [r=>r.arms[0].record.intervals[0].upload.A++,r=>r.arms[0].verification.visits[0].ready_s=1,r=>r.arms[0].verification.metrics.on_time=2,r=>r.comparison_eligible=false,r=>r.scenario.vehicles[0].upload_bytes=2]){
    const r=result();mutate(r);for(const name of ['guidedMoments','eventSentence','outcomeHeadline'])assert.throws(()=>view[name](r,0),/verified|eligible|valid|match/i);
  }
});

test('all explanations and inspection preserve scientific record and export bytes',()=>{
  requireView();for(const options of [{},{b_gb:45}]){const r=result(options),before=JSON.stringify(r);view.guidedMoments(r);view.eventSentence(r,300);view.inspectState(r.arms[0].record,61.5);view.outcomeHeadline(r);assert.equal(JSON.stringify(r),before);assert.equal(r.versions.projection,undefined);}
});

test('default captions follow observed states, name affected rules, and keep the last result fixed',()=>{
  requireView();assert.deepEqual(view.guidedMoments(result()).map(m=>m.caption),[
    'Minute 0. Same work, link and charger under every rule. First come, first served gives the whole 1 Gbps link to Vehicle A; equal uplink share gives each vehicle 0.5 Gbps; departure deadline first gives the whole link to Vehicle B.',
    'Minute 3. Departure deadline first makes Vehicle B ready; its post-upload step finished last. Equal uplink share: Vehicle B is in its post-upload step. First come, first served: Vehicle B is waiting for the link, held by Vehicle A.',
    "Minute 5. Vehicle B's departure deadline. Equal uplink share and departure deadline first meet it. First come, first served: Vehicle B is waiting for the link, held by Vehicle A.",
    'Minute 6. Vehicle A reaches its battery target under every rule; the upload rule does not change charging here. Vehicle A is still not ready. Upload received by Vehicle A: first come, first served 45 of 75 GB; equal uplink share 37.5 of 75 GB; departure deadline first 37.5 of 75 GB.',
    "Minute 10. First come, first served starts Vehicle B's upload, 5 minutes after B's departure deadline; under that rule Vehicle A has all 75 GB and its charge but is not ready until its 2-minute post-upload step ends. Equal uplink share and departure deadline first: Vehicle A has 67.5 of 75 GB.",
    'Minute 12. First come, first served makes Vehicle A ready; its post-upload step finished last. Equal uplink share and departure deadline first: Vehicle A is in its post-upload step.',
    'Minute 13. Every vehicle is ready under every rule. Final result, unchanged through minute 15: first come, first served 1 of 2 on time, 8 late minutes; equal uplink share 2 of 2; departure deadline first 2 of 2.',
  ]);
  assert.equal(view.guidedMoments(result({b_gb:45})).find(m=>m.time_s===300).caption,"Minute 5. Vehicle B's departure deadline. Vehicle B is not ready under any rule; its earliest possible time is minute 8, even with the whole uplink to itself.");
});

test('headlines group actual on-time counts and separate the late-minute tradeoff',()=>{
  requireView();
  for(const [options,want] of [
    [{},'Equal uplink share and departure deadline first get both vehicles ready on time; first come, first served gets 1 of 2.'],
    [{b_gb:45},'First come, first served gets 1 of 2 vehicles ready on time; equal uplink share and departure deadline first get none, but departure deadline first adds the fewest late minutes (6).'],
    [{b_gb:45,uplink_gbps:0.5},'No rule gets a vehicle ready on time; departure deadline first adds the fewest late minutes (28).'],
  ])assert.equal(view.outcomeHeadline(result(options)),want);
});

test('one-change comparisons count six ready cells and explain maximum and unchanged outcomes',()=>{
  assert.equal(typeof view.comparePrevious,'function');const base=result({},1);
  const large=view.comparePrevious(base,result({b_gb:45},2));
  assert.equal(large.previous_run_id,1);assert.equal(large.changed_key,'b_gb');assert.equal(large.unchanged_count,1);assert.equal(large.changed_count,5);
  assert.equal(large.counts,'On time: first come, first served 1 to 1 of 2; equal uplink share 2 to 0 of 2; departure deadline first 2 to 0 of 2. Total late minutes: 8 to 13; 0 to 12; 0 to 6.');
  assert.equal(large.summary,'1 of 6 ready times is unchanged. Largest change: 10 min later, for equal uplink share: Vehicle B.');
  const power=view.comparePrevious(base,result({charger_kw:20},2));
  assert.equal(power.counts,'On time: first come, first served 1 to 0 of 2; equal uplink share 2 to 1 of 2; departure deadline first 2 to 1 of 2. Total late minutes: 8 to 11; 0 to 3; 0 to 3.');
  assert.equal(power.summary,'3 of 6 ready times are unchanged. Largest change: 6 min later, for first come, first served: Vehicle A.');
  assert.equal(view.comparePrevious(result({uplink_gbps:0.5,charger_kw:20},1),result({uplink_gbps:0.5},2)).summary,'No ready time, on-time count or late-minute total changed. At these settings, a 20 kW and a 60 kW charger give the same results under all three rules.');
  assert.equal(view.comparePrevious(base,result({uplink_gbps:0.5},2)).summary,'0 of 6 ready times are unchanged. Largest change: 11 min later, for 3 ready times (first come, first served: Vehicle B; equal uplink share: Vehicle A; departure deadline first: Vehicle A).');
  assert.equal(view.comparePrevious(base,result({b_gb:45,charger_kw:20},2)),null);
  assert.equal(view.comparePrevious(null,base),null);
  const invalid=result();invalid.arms[0].record.intervals[0].upload.A++;assert.equal(view.comparePrevious(base,invalid),null);
});

test('suggestions change exactly one setting, follow the seven-step teaching path, and alternate after a seen setup',()=>{
  assert.equal(typeof view.nextSuggestion,'function');
  let options={uplink_gbps:1,b_gb:7.5,charger_kw:60};
  for(const [key,value,kind] of [['b_gb',15,'K3'],['b_gb',45,'K1'],['charger_kw',20,'K2'],['b_gb',7.5,'K4'],['uplink_gbps',0.5,'K4'],['charger_kw',60,'K2'],['uplink_gbps',1,'K1']]){
    const next=view.nextSuggestion(options);assert.equal(next.key,key);assert.equal(next.value,value);assert.equal(next.kind,kind);assert.equal(Object.keys(options).filter(k=>options[k]!==next.options[k]).length,1);options=next.options;
  }
  assert.deepEqual(options,{uplink_gbps:1,b_gb:7.5,charger_kw:60});
  const first=view.nextSuggestion(options);assert.equal(first.question,'With Vehicle B at 15 GB, will equal uplink share get both vehicles ready on time?');assert.equal(first.button,'Set Vehicle B upload to 15 GB');
  const alt=view.nextSuggestion(options,[first.options]);assert.equal(alt.key,'charger_kw');assert.equal(alt.value,20);
  assert.deepEqual(view.nextSuggestion(options,[first.options,alt.options]),first);
  for(const options of allOptions())for(const seen of [[],[view.nextSuggestion(options).options]]){
    const next=view.nextSuggestion(options,seen);assert.equal(Object.keys(options).filter(k=>options[k]!==next.options[k]).length,1);
    assert.doesNotMatch(next.question,/ready at|will miss [12]|fewest.* is /i);
  }
});

test('caption cache invalidates after a record mutation',()=>{
  const r=result();view.guidedMoments(r);r.arms[0].record.intervals[0].upload.A++;assert.throws(()=>view.eventSentence(r,0),/verified|match/i);
});

test('four distinct arithmetic/event/grant mutants are caught by independent anchors',async()=>{
  const url=new URL('../src/ui/depot-flow-view.js',import.meta.url),source=await readFile(url,'utf8');
  const mutants=[
    ['same-time events','e.time_s<=time_s','e.time_s<time_s',m=>assert.equal(vehicle(m.inspectState(result().arms[2].record,180),'B').ready_s,180)],
    ['partial current service','const elapsed=Math.max(0,Math.min(time_s,interval.end_s)-interval.start_s);','const elapsed=interval.end_s>time_s?0:interval.end_s-interval.start_s;',m=>assert.equal(vehicle(m.inspectState(result().arms[0].record,61),'A').upload_bytes,7625000000)],
    ['prior interval grant','i.start_s<=time_s&&time_s<i.end_s','i.start_s<time_s&&time_s<=i.end_s',m=>assert.deepEqual(m.inspectState(result().arms[0].record,600).upload_holders,['B'])],
    ['rounded partial service','const elapsed=Math.max(0,Math.min(time_s,interval.end_s)-interval.start_s);','const elapsed=Math.round(Math.max(0,Math.min(time_s,interval.end_s)-interval.start_s));',m=>assert.equal(vehicle(m.inspectState(result().arms[0].record,61.5),'A').upload_bytes,7687500000)],
  ];
  for(const [name,from,to,check] of mutants){assert.ok(source.includes(from),`${name}: mutation target exists`);const code=source.replace(from,to).replace(/from '([^']+)'/g,(_,path)=>`from '${new URL(path,url).href}'`);const m=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}#${encodeURIComponent(name)}`);assert.throws(()=>check(m),assert.AssertionError,`${name} must be killed`);}
});

test('same-time completion precedes deadline assessment in the projection',()=>{
  const s=flowScenario();s.vehicles[1].deadline_s=780;const record=simulateFlow(s,'nf_fifo');assert.equal(verifyFlow(record).model_validity,'VALID');assert.equal(vehicle(view.inspectState(record,780),'B').outcome,'on_time');
});

test('cohort explanations use the separate verifier and retain unrelated events at a deadline',async()=>{
  const {runCohortComparison}=await import('../src/model/depot-cohort.js');
  const r={...runCohortComparison(),run_id:12};
  assert.match(view.eventSentence(r,0),/All four rules:/);
  const atSix=view.eventSentence(r,360);assert.match(atSix,/Vehicle D departure deadline/);assert.match(atSix,/Equal uplink share: Vehicle B ready/);
  const moments=view.guidedMoments(r);assert.equal(moments[0].time_s,0);assert.equal(moments.at(-1).time_s,1140);assert.ok(moments.every(m=>m.run_id===12));
  assert.ok(moments.every(m=>!m.caption.includes('All three rules')));
  assert.match(view.outcomeHeadline(r),/vehicles ready on time/);
  r.arms[0].record.intervals[0].upload.A++;assert.throws(()=>view.guidedMoments(r),/verified|match/i);
});

test('published 658e901 default and 45 GB exports retain every scientific field byte-for-byte',async()=>{
  const encoded=JSON.parse(await readFile(new URL('./helpers/depot-flow-published.json',import.meta.url),'utf8'));
  const fixtures=JSON.parse(Buffer.from(encoded.payload_base64,encoded.encoding).toString('utf8'));
  for(const {options,result:published} of fixtures.cases){const current=result(options);assert.equal(JSON.stringify(current),JSON.stringify(published));view.guidedMoments(current);view.outcomeHeadline(current);assert.equal(JSON.stringify(current),JSON.stringify(published));}
});

test('non-default captions explain charging waits',()=>{
  const power=view.guidedMoments(result({charger_kw:20}));
  assert.match(power.find(m=>m.time_s===900).caption,/Vehicle A is still charging and not ready/);
});
test('merged moment captions retain simultaneous first readiness',()=>{
  const coincident=view.guidedMoments(result({uplink_gbps:0.5,b_gb:15}));
  assert.match(coincident.find(m=>m.time_s===360).caption,/Departure deadline first makes Vehicle B ready/);
});

test('common events collapse even when one rule has an additional event',()=>{
  assert.equal(view.eventSentence(result({b_gb:15}),360),'Minute 6. All three rules: Vehicle A battery at target. Equal uplink share: Vehicle B ready.');
});

test('unfinished horizon is labelled end of run and never last vehicle ready',()=>{
  const scenario=flowScenario();scenario.horizon_s=200;
  const arms=['nf_fifo','nf_equal_uplink','nf_departure_deadline'].map(rule=>{const record=simulateFlow(scenario,rule);return {record,verification:verifyFlow(record)};});
  const r={...result(),scenario,arms};const last=view.guidedMoments(r).at(-1);
  assert.equal(last.time_s,200);assert.match(last.label,/End of run/);assert.doesNotMatch(last.label,/Last vehicle ready/);assert.match(last.caption,/End of run/);assert.doesNotMatch(last.caption,/Every vehicle is ready under every rule/);
});
