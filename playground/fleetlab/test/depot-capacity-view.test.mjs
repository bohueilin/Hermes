import assert from 'node:assert/strict';
import {test} from 'node:test';
import {runCapacityCell} from '../src/model/depot-capacity.js';
import {CAPACITY_STUDY} from '../src/data/depot-capacity-study.js';
const view=await import('../src/ui/depot-capacity-view.js').catch(()=>({}));
const runs=new Map();
const run=(regime,treatment,rule)=>{const key=`${regime}/${treatment}/${rule}`;if(!runs.has(key))runs.set(key,runCapacityCell({regime,treatment,rule,time_quantum_ms:1000}));return runs.get(key);};
const manifestCell=id=>CAPACITY_STUDY.cells.find(c=>c.cell_id===id);
const visit=(state,id)=>state.visits.find(v=>v.vehicle===id);

test('the four matched cases name their cells and the one field each changes',()=>{
  assert.equal(view.CAPACITY_PROJECTION,'depot-capacity-projection/1.1.0');
  const cases=view.caseCells('data_heavy','capacity_departure_deadline');
  assert.deepEqual(cases.map(c=>[c.case,c.label,c.cell_id]),[
    ['base','Base','data_heavy/base/capacity_equal_uplink/1000'],
    ['rule','Different rule','data_heavy/base/capacity_departure_deadline/1000'],
    ['bandwidth','More bandwidth','data_heavy/more_bandwidth/capacity_equal_uplink/1000'],
    ['power','More power','data_heavy/more_power/capacity_equal_uplink/1000'],
  ]);
  assert.deepEqual(cases.map(c=>c.changed),[
    'Reference: equal uplink share, 1 Gbps uplink, 60 kW site feed.',
    'Changed: upload rule, equal uplink share to departure deadline first.',
    'Changed: uplink, 1 Gbps to 2 Gbps.',
    'Changed: site feed, 60 kW to 120 kW.',
  ]);
  assert.equal(view.caseCells('mixed','capacity_shortest_upload')[1].changed,'Changed: upload rule, equal uplink share to shortest upload first.');
});

test('cards read the accepted manifest: counts, lateness and capacity used',()=>{
  const cards=view.cardsFor(CAPACITY_STUDY,'data_heavy','capacity_departure_deadline');
  assert.deepEqual(cards.map(c=>c.on_time),[3,3,9,3]);
  assert.deepEqual(cards.map(c=>c.missed),[9,9,3,9]);
  assert.deepEqual(cards.map(c=>c.lateness_text),['132.3 min','70 min','1.5 min','132.3 min']);
  assert.deepEqual(cards.map(c=>c.capacity_text),['Uplink 57% used · site feed not needed','Uplink 57% used · site feed not needed','Uplink 28% used · site feed not needed','Uplink 57% used · site feed not needed']);
  for(const card of cards){const m=manifestCell(view.caseCells('data_heavy','capacity_departure_deadline').find(c=>c.case===card.case).cell_id).metrics;
    assert.deepEqual([card.on_time,card.missed,card.late,card.unfinished_due],[m.on_time,m.missed,m.late,m.unfinished_due]);}
  assert.equal(view.cardsFor(CAPACITY_STUDY,'mixed','capacity_fifo')[3].capacity_text,'Uplink 57% used · site feed 22% used');
  const censored=structuredClone(CAPACITY_STUDY),cell=censored.cells.find(c=>c.cell_id==='mixed/base/capacity_equal_uplink/1000');
  Object.assign(cell.metrics,{final_lateness:false,lateness_s:null,lateness_lower_bound_s:7200,unfinished_due:2,pending:1});
  assert.equal(view.cardsFor(censored,'mixed','capacity_fifo')[0].lateness_text,'At least 120 min; 3 unfinished');
});

test('the reading states each change against Base without ranking, and is withheld when it cannot be trusted',()=>{
  assert.equal(view.readingSentence(CAPACITY_STUDY,'data_heavy','capacity_departure_deadline'),
    'Under the data-heavy workload, departure deadline first leaves on-time readiness at 3 of 12 with 62.3 fewer late minutes; more bandwidth takes on-time readiness from 3 to 9 of 12; more site power changes nothing.');
  assert.equal(view.readingSentence(CAPACITY_STUDY,'energy_heavy','capacity_fifo'),
    'Under the energy-heavy workload, first come, first served changes nothing; more bandwidth changes nothing; more site power takes on-time readiness from 6 to 9 of 12.');
  // Fewer vehicles on time but fewer late minutes is a trade-off, so both directions are stated.
  assert.match(view.readingSentence(CAPACITY_STUDY,'mixed','capacity_departure_deadline'),/departure deadline first takes on-time readiness from 3 to 1 of 12, but with 46\.6 fewer late minutes;/);
  assert.equal(view.withheldReason(CAPACITY_STUDY,'data_heavy','capacity_departure_deadline'),null);
  const disagree=structuredClone(CAPACITY_STUDY);disagree.refinement['data_heavy/more_power/capacity_equal_uplink/1000'].agrees=false;
  assert.equal(view.readingSentence(disagree,'data_heavy','capacity_departure_deadline'),null);
  assert.equal(view.withheldReason(disagree,'data_heavy','capacity_departure_deadline'),'Reading withheld: the quarter-second repeat disagrees for this workload.');
  assert.match(view.readingSentence(disagree,'energy_heavy','capacity_departure_deadline'),/^Under the energy-heavy workload/,'another workload keeps its reading');
  const censored=structuredClone(CAPACITY_STUDY);censored.cells.find(c=>c.cell_id==='data_heavy/base/capacity_departure_deadline/1000').metrics.final_lateness=false;
  assert.equal(view.readingSentence(censored,'data_heavy','capacity_departure_deadline'),null);
  assert.equal(view.withheldReason(censored,'data_heavy','capacity_departure_deadline'),'Reading withheld: an unfinished visit leaves total lateness censored.');
});

test('inspection folds energy-heavy first come, first served at minutes 0, 4 and 12',()=>{
  const {record}=run('energy_heavy','base','capacity_fifo');
  const zero=view.inspectCapacity(record,0);
  assert.equal(zero.time_s,0);
  assert.deepEqual(zero.uplink,{holders:[{id:'A1',rate_bytes_s:125000000}],capacity_bytes_s:125000000});
  assert.deepEqual(zero.ports,[{port:1,vehicle:'A1',rate_j_s:30000},{port:2,vehicle:'B1',rate_j_s:30000}]);
  assert.deepEqual(zero.site,{used_j_s:60000,capacity_j_s:60000});
  assert.equal(visit(zero,'B1').wait_reason,'Vehicle B1 waits for the uplink, held by Vehicle A1 under first come, first served.');
  assert.equal(visit(zero,'D1').wait_reason,'Vehicle D1 waits for the uplink, held by Vehicle A1 under first come, first served.');
  assert.deepEqual(visit(zero,'D1').tasks,{upload:'waiting',charge:'waiting',post:'waiting'});
  assert.deepEqual(visit(zero,'A1').tasks,{upload:'active',charge:'active',post:'waiting'});
  assert.equal(visit(zero,'A1').wait_reason,'Vehicle A1 is uploading at 1 Gbps; charging and the local step remain.');
  assert.equal(visit(zero,'C1').wait_reason,'Vehicle C1 waits for the uplink, held by Vehicle A1 under first come, first served.');
  assert.equal(visit(zero,'A2').present,false);assert.equal(visit(zero,'A2').wait_reason,'Vehicle A2 arrives at minute 10.');
  const four=view.inspectCapacity(record,240);
  assert.deepEqual(four.uplink.holders,[]);
  assert.deepEqual(four.ports,[{port:1,vehicle:'A1',rate_j_s:30000},{port:2,vehicle:'C1',rate_j_s:30000}]);
  assert.equal(visit(four,'B1').wait_reason,'Vehicle B1 is ready since minute 4.');
  assert.deepEqual([visit(four,'B1').ready,visit(four,'B1').ready_s,visit(four,'B1').outcome],[true,240,'on_time']);
  assert.equal(visit(four,'D1').wait_reason,'Vehicle D1 waits for a charging port; ports held by Vehicle A1 and Vehicle C1.');
  assert.equal(visit(four,'D1').outcome,'pending');assert.equal(visit(view.inspectCapacity(record,360),'D1').outcome,'unfinished_due');
  assert.equal(visit(four,'A1').wait_reason,'Vehicle A1 is charging at 30 kW; nothing else remains.');
  assert.deepEqual([visit(four,'A1').upload_bytes,visit(four,'A1').upload_total,visit(four,'A1').energy_j,visit(four,'A1').energy_total,visit(four,'A1').post_s],[6e9,6e9,7200000,21600000,120]);
  const twelve=view.inspectCapacity(record,720);
  assert.deepEqual(twelve.ports,[{port:1,vehicle:'D1',rate_j_s:30000},{port:2,vehicle:'A2',rate_j_s:30000}]);
  assert.equal(visit(twelve,'A1').wait_reason,'Vehicle A1 is ready since minute 12.');
  assert.equal(visit(twelve,'A2').wait_reason,'Vehicle A2 is charging at 30 kW; the local step is running.');
  assert.equal(visit(twelve,'B3').wait_reason,'Vehicle B3 arrives at minute 20.');
  // Clamped to the record, where no slot holds a resource.
  const end=view.inspectCapacity(record,1e9);
  assert.equal(end.time_s,5400);assert.deepEqual(end.ports.map(p=>p.vehicle),[null,null]);
  assert.ok(end.visits.every(v=>v.ready));
});

test('inspection names the local step and partly finished prerequisites',()=>{
  const {record}=run('energy_heavy','base','capacity_fifo');
  assert.equal(visit(view.inspectCapacity(record,100),'A1').wait_reason,'Vehicle A1 is charging at 30 kW; the local step is running.');
  const data=run('data_heavy','base','capacity_fifo').record;
  assert.equal(visit(view.inspectCapacity(data,540),'A1').wait_reason,'Vehicle A1 is in its local step; ready at minute 10.');
  assert.equal(visit(view.inspectCapacity(data,0),'A1').wait_reason,'Vehicle A1 is uploading at 1 Gbps; the local step remains.');
  assert.deepEqual(visit(view.inspectCapacity(data,0),'A1').tasks,{upload:'active',charge:'not-applicable',post:'waiting'});
  assert.equal(visit(view.inspectCapacity(data,0),'B1').wait_reason,'Vehicle B1 waits for the uplink, held by Vehicle A1 under first come, first served.');
  // A vehicle on the uplink without a port lists the local step first and charging, which waits, last.
  const mixed=run('mixed','base','capacity_equal_uplink').record;
  const c1=visit(view.inspectCapacity(mixed,0),'C1');
  assert.deepEqual(c1.tasks,{upload:'active',charge:'waiting',post:'waiting'});
  assert.equal(c1.wait_reason,'Vehicle C1 is uploading at 0.25 Gbps; the local step and charging remain.');
});

test('allocation spans merge contiguous slots, including the rotating whole-byte remainder of equal share',()=>{
  const fifo=view.allocationSpans(run('data_heavy','base','capacity_fifo').record);
  const a1=fifo.find(v=>v.vehicle==='A1');
  assert.deepEqual(a1.upload,[{t0:0,t1:480,fraction:1}]);
  assert.deepEqual(a1.charge,[]);assert.deepEqual(a1.post,{t0:480,t1:600});
  assert.deepEqual([a1.ready_s,a1.deadline_s,a1.arrival_s],[600,600,0]);
  const equal=view.allocationSpans(run('data_heavy','base','capacity_equal_uplink').record);
  for(const v of equal){
    for(const [a,b] of v.upload.slice(0,-1).map((s,i)=>[s,v.upload[i+1]]))assert.ok(a.t1<=b.t0);
    assert.ok(v.upload.length<20,`${v.vehicle} has ${v.upload.length} spans`);
  }
  assert.deepEqual(equal.find(v=>v.vehicle==='A1').upload[0],{t0:0,t1:240,fraction:0.25});
  const energy=view.allocationSpans(run('energy_heavy','base','capacity_fifo').record);
  assert.deepEqual(energy.find(v=>v.vehicle==='B1').charge,[{t0:0,t1:240,fraction:0.5}]);
});

test('first allocation and readiness differences, and example visits, compare two cells',()=>{
  const equal=run('data_heavy','base','capacity_equal_uplink'),deadline=run('data_heavy','base','capacity_departure_deadline');
  const bandwidth=run('data_heavy','more_bandwidth','capacity_equal_uplink'),power=run('data_heavy','more_power','capacity_equal_uplink');
  assert.deepEqual(view.firstAllocationDifference(equal.record,deadline.record),{time_s:0,vehicle:'A1',base:'uploading at 0.25 Gbps',other:'idle'});
  assert.deepEqual(view.firstAllocationDifference(equal.record,bandwidth.record),{time_s:0,vehicle:'A1',base:'uploading at 0.25 Gbps',other:'uploading at 0.5 Gbps'});
  assert.equal(view.firstAllocationDifference(equal.record,power.record),null);
  const energy=run('energy_heavy','base','capacity_equal_uplink'),energyPower=run('energy_heavy','more_power','capacity_equal_uplink');
  assert.deepEqual(view.firstAllocationDifference(energy.record,energyPower.record),{time_s:0,vehicle:'A1',base:'uploading at 0.25 Gbps and charging at 30 kW',other:'uploading at 0.25 Gbps and charging at 60 kW'});

  assert.deepEqual(view.firstReadinessDifference(equal.verification,bandwidth.verification),{vehicle:'B1',base_ready_s:360,other_ready_s:240});
  assert.equal(view.firstReadinessDifference(equal.verification,power.verification),null);

  const better=view.exampleVisits(equal.verification,bandwidth.verification);
  assert.equal(better.selected,'C1');assert.equal(better.improving.length,12);assert.deepEqual([better.regressing,better.unchanged,better.note],[[],[],null]);
  const mixed=view.exampleVisits(equal.verification,deadline.verification);
  assert.equal(mixed.selected,'D1');
  assert.deepEqual(mixed.improving,['A1','D1','A2','D2','A3','D3']);
  assert.deepEqual(mixed.regressing,['B1','C1','B2','C2','B3','C3']);
  const same=view.exampleVisits(equal.verification,power.verification);
  assert.deepEqual(same,{selected:null,improving:[],regressing:[],unchanged:['A1','B1','C1','D1','A2','B2','C2','D2','A3','B3','C3','D3'],note:'No readiness difference between these two cells.'});
});

test('only a reconstructed cell that matches the accepted study is returned, frozen',()=>{
  const id='data_heavy/base/capacity_fifo/1000',fresh=()=>({cell:{regime:'data_heavy',treatment:'base',rule:'capacity_fifo',time_quantum_ms:1000},...structuredClone(run('data_heavy','base','capacity_fifo'))});
  const accepted=view.verifiedCell(fresh(),manifestCell(id));
  assert.ok(Object.isFrozen(accepted.record.intervals[0].upload));assert.equal(accepted.digest,manifestCell(id).record_digest);
  const tampered=fresh();tampered.record.events[3].time_s+=1;
  assert.throws(()=>view.verifiedCell(tampered,manifestCell(id)),/digest differs from the accepted study/);
  const wrongDigest=fresh();wrongDigest.digest='0'.repeat(64);
  assert.throws(()=>view.verifiedCell(wrongDigest,manifestCell(id)),/digest differs from the accepted study/);
  const altered=structuredClone(manifestCell(id));altered.metrics.on_time+=1;
  assert.throws(()=>view.verifiedCell(fresh(),altered),/metrics differ from the accepted study/);
  const invalid=fresh();invalid.verification.model_validity='INVALID';
  assert.throws(()=>view.verifiedCell(invalid,manifestCell(id)),/verification did not pass/);
  const ineligible=fresh();ineligible.verification.comparison_eligible=false;
  assert.throws(()=>view.verifiedCell(ineligible,manifestCell(id)),/verification did not pass/);
  assert.throws(()=>view.verifiedCell(fresh(),undefined),/not in the accepted study/);
});


test('bench projection keeps common physical rate scales and exact quantities for compared arms',()=>{
  assert.equal(typeof view.capacityBenchProjection,'function');
  const cases=view.caseCells('energy_heavy','capacity_departure_deadline');
  const cells=Object.fromEntries(cases.map(c=>[c.case,view.verifiedCell({cell:c.cell,...run(c.cell.regime,c.cell.treatment,c.cell.rule)},manifestCell(c.cell_id))]));
  const comparison={cells};
  const p=view.capacityBenchProjection(comparison,'power',0,'A1');
  assert.equal(p.available,true);assert.equal(p.time_s,0);
  assert.deepEqual(p.scales,{upload_bytes_s:250000000,energy_j_s:120000});
  assert.deepEqual(p.arms.map(a=>[a.upload.used,a.upload.fraction,a.energy.used,a.energy.fraction]),[[125000000,.5,60000,.5],[125000000,.5,120000,1]]);
  assert.deepEqual(p.arms.map(a=>a.selected.upload_rate_bytes_s),[31250000,31250000]);
  assert.deepEqual(p.arms.map(a=>a.selected.charge_rate_j_s),[30000,60000]);
  const blocked=view.capacityBenchProjection(comparison,'power',240,'D1').arms[0].selected;
  assert.equal(blocked.wait_reason,'Vehicle D1 waits for a charging port; ports held by Vehicle A1 and Vehicle C1.');
  assert.equal(blocked.upload_bytes,1500000000);assert.equal(blocked.energy_j,0);
  assert.ok(Object.isFrozen(p.arms[0].selected));
});

test('bench projection withholds unavailable or invalid accepted cells',()=>{
  assert.equal(typeof view.capacityBenchProjection,'function');
  for(const comparison of [null,{cells:{}},{cells:{base:{verification:{model_validity:'INVALID'}}}}]){
    const p=view.capacityBenchProjection(comparison,'rule',0,'A1');
    assert.equal(p.available,false);assert.equal(p.arms.length,0);assert.match(p.reason,/not available/i);
  }
});
