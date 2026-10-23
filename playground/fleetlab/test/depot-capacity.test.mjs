import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as contract from '../src/model/depot-capacity-contract.js';
import {capacityCellSteps,runCapacityCell,simulateCapacity} from '../src/model/depot-capacity.js';
import {verifyCapacity} from '../src/model/depot-capacity-verify.js';
import {FLOW_TRUST as NF01_TRUST} from '../src/model/depot-flow-contract.js';

const REGIMES=['data_heavy','energy_heavy','mixed'],TREATMENTS=['base','more_bandwidth','more_power'];
const RULES=['capacity_fifo','capacity_equal_uplink','capacity_departure_deadline','capacity_shortest_upload'];
const IDS=['A1','B1','C1','D1','A2','B2','C2','D2','A3','B3','C3','D3'];
const sum=values=>values.reduce((a,b)=>a+b,0);
const visit=(verification,id)=>verification.visits.find(v=>v.vehicle===id);

// The 36 primary records are simulated once and shared; 250 ms records are built and dropped one at a time.
const primary=new Map();
function cell(regime,treatment,rule){
  const id=`${regime}/${treatment}/${rule}/1000`;
  if(!primary.has(id)){const record=simulateCapacity(contract.capacityScenario({regime,treatment}),rule);primary.set(id,{id,record,verification:verifyCapacity(record)});}
  return primary.get(id);
}
const allCells=()=>REGIMES.flatMap(regime=>TREATMENTS.flatMap(treatment=>RULES.map(rule=>cell(regime,treatment,rule))));

test('contract exports frozen versions, rules, regimes, treatments and protocol',()=>{
  assert.deepEqual(contract.CAPACITY_VERSIONS,{study:'depot-capacity-study/1.0.0',model:'depot-capacity/1.0.0',policy:'depot-capacity-rules/1.0.0',metrics:'depot-capacity-metrics/1.0.0',record:'depot-capacity-record/1.0.0',verifier:'depot-capacity-verifier/1.0.0'});
  assert.deepEqual(contract.CAPACITY_RULES.map(r=>[r.id,r.name]),[['capacity_fifo','First come, first served'],['capacity_equal_uplink','Equal uplink share'],['capacity_departure_deadline','Departure deadline first'],['capacity_shortest_upload','Shortest upload first']]);
  assert.ok(contract.CAPACITY_RULES.every(r=>typeof r.description==='string'&&r.description.length>0));
  assert.deepEqual(Object.fromEntries(Object.entries(contract.CAPACITY_REGIMES).map(([id,r])=>[id,r.name])),{data_heavy:'Data-heavy',energy_heavy:'Energy-heavy',mixed:'Mixed'});
  assert.equal(contract.CAPACITY_REGIMES.data_heavy.question,'Can more site power help when energy is already satisfied?');
  assert.equal(contract.CAPACITY_REGIMES.energy_heavy.question,'Does faster upload change readiness when energy work remains?');
  assert.equal(contract.CAPACITY_REGIMES.mixed.question,'How does the limiting prerequisite change across vehicles and arrival waves?');
  assert.deepEqual(contract.CAPACITY_TREATMENTS,{
    base:{name:'Base',uplink_bytes_s:125000000,site_power_j_s:60000,changed:null},
    more_bandwidth:{name:'More bandwidth',uplink_bytes_s:250000000,site_power_j_s:60000,changed:'uplink_bytes_s'},
    more_power:{name:'More power',uplink_bytes_s:125000000,site_power_j_s:120000,changed:'site_power_j_s'},
  });
  assert.deepEqual(contract.CAPACITY_PROTOCOL,{fixture:'nf03-twelve-visits/1',horizon_s:5400,waves:[0,600,1200],profiles:['A','B','C','D'],deadline_offset_s:{A:600,B:900,C:1320,D:360},post_s:120,charge_ports:2,port_cap_j_s:60000,vehicle_uplink_cap_bytes_s:250000000,quanta_ms:[1000,250]});
  assert.deepEqual(contract.FLOW_TRUST,NF01_TRUST);
  for(const value of [contract.CAPACITY_VERSIONS,contract.CAPACITY_RULES,contract.CAPACITY_RULES[0],contract.CAPACITY_REGIMES.mixed.energy_j,contract.CAPACITY_TREATMENTS.base,contract.CAPACITY_PROTOCOL.deadline_offset_s,contract.CAPACITY_PROTOCOL.waves])assert.ok(Object.isFrozen(value));
});

test('the frozen twelve-visit workload is the only scenario each regime, treatment and quantum accepts',()=>{
  const s=contract.capacityScenario({regime:'data_heavy',treatment:'base'});
  assert.equal(s.fixture,'nf03-twelve-visits/1');assert.equal(s.horizon_s,5400);assert.equal(s.time_quantum_ms,1000);
  assert.equal(s.uplink_bytes_s,125e6);assert.equal(s.vehicle_uplink_cap_bytes_s,250e6);assert.equal(s.charge_ports,2);assert.equal(s.port_cap_j_s,60000);assert.equal(s.site_power_j_s,60000);
  assert.deepEqual(s.dependencies,{upload:[],charge:[],post:['upload'],ready:['upload','charge','post']});
  assert.deepEqual(s.vehicles.map(v=>v.id),IDS);
  assert.deepEqual(s.vehicles.map(v=>v.wave),[1,1,1,1,2,2,2,2,3,3,3,3]);
  assert.deepEqual(s.vehicles.map(v=>v.arrival_s),[0,0,0,0,600,600,600,600,1200,1200,1200,1200]);
  assert.deepEqual(s.vehicles.map(v=>v.deadline_s),[600,900,1320,360,1200,1500,1920,960,1800,2100,2520,1560]);
  assert.deepEqual(s.vehicles.map(v=>v.upload_bytes),[60e9,7.5e9,45e9,15e9,60e9,7.5e9,45e9,15e9,60e9,7.5e9,45e9,15e9]);
  assert.deepEqual(s.vehicles.map(v=>v.post_s),Array(12).fill(120));
  assert.deepEqual(Object.keys(s.vehicles[0]).sort(),['arrival_s','deadline_s','energy_j','id','post_s','upload_bytes','wave']);
  const total=(regime,key)=>sum(contract.capacityScenario({regime,treatment:'base'}).vehicles.map(v=>v[key]));
  assert.equal(total('data_heavy','upload_bytes'),382.5e9);assert.equal(total('mixed','upload_bytes'),382.5e9);assert.equal(total('energy_heavy','upload_bytes'),38.25e9);
  assert.equal(total('energy_heavy','energy_j'),140400000);assert.equal(total('mixed','energy_j'),140400000);assert.equal(total('data_heavy','energy_j'),0);
  assert.equal(total('mixed','energy_j')/3.6e6,39);
  for(const quantum of [1000,250])contract.validateCapacityScenario(contract.capacityScenario({regime:'mixed',treatment:'more_power',time_quantum_ms:quantum}));
  const frozen=/Scenario differs from the frozen NF-03 workload/,choose=/Choose a frozen NF-03 regime, treatment and quantum\./;
  for(const [mutate,message] of [
    [x=>x.vehicles[1].upload_bytes+=1,frozen],
    [x=>x.vehicles.push({...x.vehicles[11],id:'E3'}),/bounded dense data array/],
    [x=>x.vehicles[3].deadline_s=361,frozen],
    [x=>x.time_quantum_ms=500,choose],
    [x=>x.regime='unknown',choose],
    [x=>x.extra=1,/own-property key/],
    // Canonical text renders -0 as 0, so -0 must be refused wherever the frozen workload holds 0.
    [x=>x.vehicles[0].arrival_s=-0,/other than -0/],
    [x=>x.vehicles[0].energy_j=-0,/other than -0/],
  ]){
    const changed=contract.capacityScenario({regime:'data_heavy',treatment:'base'});mutate(changed);
    assert.throws(()=>contract.validateCapacityScenario(changed),message);
    assert.throws(()=>simulateCapacity(changed,'capacity_fifo'),message);
  }
  assert.throws(()=>contract.capacityScenario({regime:'data_heavy',treatment:'base',time_quantum_ms:500}),choose);
  assert.throws(()=>contract.capacityScenario({regime:'unknown',treatment:'base'}),choose);
  assert.throws(()=>contract.capacityScenario({regime:'constructor',treatment:'base'}),choose);
  assert.throws(()=>contract.capacityScenario({regime:'data_heavy',treatment:'base',extra:1}),/own-property key/);
});

test('the engine refuses a rule outside the four NF-03 rules',()=>{
  assert.throws(()=>simulateCapacity(contract.capacityScenario({regime:'data_heavy',treatment:'base'}),'cohort_fifo'),/Unknown NF-03 rule/);
});

test('data-heavy base reproduces the hand-derived wave-1 schedules for first come and departure deadline',()=>{
  const fifo=cell('data_heavy','base','capacity_fifo'),deadline=cell('data_heavy','base','capacity_departure_deadline');
  for(const c of [fifo,deadline]){assert.equal(c.verification.model_validity,'VALID');assert.equal(c.verification.comparison_eligible,true);}
  const wave1=(c,field)=>Object.fromEntries(c.verification.visits.filter(v=>v.wave===1).map(v=>[v.vehicle,v[field]]));
  const uploads=r=>Object.fromEntries(r.events.filter(e=>e.task==='upload'&&e.vehicle.endsWith('1')).map(e=>[e.vehicle,e.time_s]));
  // First come: A1 0 to 480 s, B1 480 to 540, C1 540 to 900, D1 900 to 1,020; each ready 120 s after its upload.
  assert.deepEqual(uploads(fifo.record),{A1:480,B1:540,C1:900,D1:1020});
  assert.deepEqual(wave1(fifo,'ready_s'),{A1:600,B1:660,C1:1020,D1:1140});
  assert.deepEqual(wave1(fifo,'outcome'),{A1:'on_time',B1:'on_time',C1:'on_time',D1:'late'});
  assert.deepEqual(wave1(fifo,'lateness_s'),{A1:0,B1:0,C1:0,D1:780});
  // Later waves queue behind wave 1 in arrival order: A2 1,020 to 1,500, B2, C2, D2, then A3 2,040 to 2,520, B3, C3, D3.
  assert.deepEqual(fifo.verification.metrics.ready_s,{A1:600,B1:660,C1:1020,D1:1140,A2:1620,B2:1680,C2:2040,D2:2160,A3:2640,B3:2700,C3:3060,D3:3180});
  assert.equal(fifo.verification.metrics.on_time,3);assert.equal(fifo.verification.metrics.late,9);assert.equal(fifo.verification.metrics.lateness_s,6300);
  // Deadline first: D1 0 to 120, A1 120 to 600. Wave 2 arrives at 600, so B1 (900) runs 600 to 660,
  // D2 (960) 660 to 780, A2 (1,200) 780 to 1,260, and C1 (1,320) only 1,260 to 1,620.
  assert.deepEqual(uploads(deadline.record),{A1:600,B1:660,C1:1620,D1:120});
  assert.deepEqual(wave1(deadline,'ready_s'),{A1:720,B1:780,C1:1740,D1:240});
  assert.deepEqual(wave1(deadline,'outcome'),{A1:'late',B1:'on_time',C1:'late',D1:'on_time'});
  assert.deepEqual(wave1(deadline,'lateness_s'),{A1:120,B1:0,C1:420,D1:0});
});

test('shortest upload: a wave-3 arrival at an upload release joins the choice at that boundary',()=>{
  // Hand-derived at 125,000,000 bytes/s, where an A upload takes 480 s, B 60 s, C 360 s and D 120 s.
  // Wave 1: B1 0 to 60, D1 60 to 180, C1 180 to 540, A1 540 to 1,020 (wave 2 arrives at 600; A1 is not interrupted).
  // Wave 2: B2 1,020 to 1,080, D2 1,080 to 1,200. The 1,200 s boundary closes D2's upload and then registers wave 3,
  // so the next holder comes from A2, C2, A3, B3, C3 and D3: B3 (7.5 GB), not C2 (45 GB). Then D3, C2 (ties C3 on
  // bytes, arrived first), C3, A2 and A3. Energy is zero in this regime, so more site power changes nothing.
  for(const treatment of ['base','more_power']){
    const {record,verification}=cell('data_heavy',treatment,'capacity_shortest_upload');
    assert.equal(verification.model_validity,'VALID',treatment);
    const slot=k=>{const i=record.intervals[k];return [i.start_s,i.grant_bytes,i.upload,i.unused_bytes];};
    assert.deepEqual(slot(1199),[1199,{D2:125000000},{D2:125000000},{}],treatment);
    assert.deepEqual(slot(1200),[1200,{B3:125000000},{B3:125000000},{}],treatment);
    // Boundary order at 1,200 s: completions (B2's local step, then D2's upload), arrivals with their zero-energy charge, readiness, deadlines.
    assert.deepEqual(record.events.filter(e=>e.time_s===1200).map(e=>[e.type,e.vehicle,e.task]),[
      ['complete','B2','post'],['complete','D2','upload'],
      ['arrival','A3',null],['complete','A3','charge'],['arrival','B3',null],['complete','B3','charge'],
      ['arrival','C3',null],['complete','C3','charge'],['arrival','D3',null],['complete','D3','charge'],
      ['ready','B2',null],['deadline','A2',null],
    ],treatment);
    const uploads=Object.fromEntries(record.events.filter(e=>e.task==='upload').map(e=>[e.vehicle,e.time_s]));
    assert.deepEqual(uploads,{B1:60,D1:180,C1:540,A1:1020,B2:1080,D2:1200,B3:1260,D3:1380,C2:1740,C3:2100,A2:2580,A3:3060},treatment);
  }
});

test('two ports share the 60 kW site feed at 30 kW each and hand over at the release boundary',()=>{
  const {record,verification}=cell('energy_heavy','base','capacity_fifo');
  assert.equal(verification.model_validity,'VALID');
  const slot=t=>{const i=record.intervals[t];assert.equal(i.start_s,t);return {ports:i.ports,charge:i.charge,grant_j:i.grant_j,unused_j:i.unused_j};};
  const shared={charge:{A1:30000,B1:30000},grant_j:{A1:30000,B1:30000},unused_j:{}};
  assert.deepEqual(slot(0),{ports:{A1:1,B1:2},...shared});
  assert.deepEqual(slot(239),{ports:{A1:1,B1:2},...shared});
  // B1 reaches 7,200,000 J at 240 s; C1 takes port 2 and A1 stays at 30 kW because two ports still share 60 kW.
  assert.deepEqual(slot(240),{ports:{A1:1,C1:2},charge:{A1:30000,C1:30000},grant_j:{A1:30000,C1:30000},unused_j:{}});
  assert.equal(visit(verification,'B1').tasks.charge,240);
  // A1 (21.6 MJ) and C1 (14.4 MJ from 240 s) both finish at 720 s; D1 then takes port 1 and A2 port 2.
  assert.deepEqual(slot(719).ports,{A1:1,C1:2});
  assert.deepEqual(slot(720).ports,{D1:1,A2:2});
  assert.deepEqual([visit(verification,'A1').tasks.charge,visit(verification,'C1').tasks.charge,visit(verification,'D1').tasks.charge],[720,720,840]);
  // Every visit reaches its energy target: 12 visits, 140.4 MJ in total (39 kWh).
  assert.equal(verification.metrics.utilization.site_j_served,140400000);
});

test('port admission at a release boundary follows arrival then ID among queued visits',()=>{
  for(const treatment of ['base','more_power']){
    const {record}=cell('energy_heavy',treatment,'capacity_fifo');
    const arrival=Object.fromEntries(record.scenario.vehicles.map(v=>[v.id,v.arrival_s]));
    const charged=Object.fromEntries(record.events.filter(e=>e.task==='charge').map(e=>[e.vehicle,e.time_s]));
    const precedes=(a,b)=>arrival[a]<arrival[b]||(arrival[a]===arrival[b]&&a<b);
    let admissions=0;
    for(const [k,i] of record.intervals.entries()){
      const admitted=Object.keys(i.ports).filter(id=>k===0||!Object.hasOwn(record.intervals[k-1].ports,id));
      const waiting=IDS.filter(id=>arrival[id]<=i.start_s&&!Object.hasOwn(i.ports,id)&&(charged[id]??Infinity)>i.start_s);
      for(const a of admitted)for(const w of waiting)assert.ok(precedes(a,w),`${treatment}: ${a} admitted ahead of ${w} at ${i.start_s} s`);
      assert.ok(Object.keys(i.ports).length===2||waiting.length===0,`${treatment}: a port idles while ${waiting} wait at ${i.start_s} s`);
      admissions+=admitted.length;
    }
    assert.equal(admissions,12,treatment);
  }
  // In base the earliest release at or after the wave-2 arrival is 720 s: D1 (arrived at 0) outranks A2, which outranks B2.
  const {record}=cell('energy_heavy','base','capacity_fifo');
  const k=record.intervals.findIndex((i,k)=>i.start_s>=600&&Object.keys(record.intervals[k-1].ports).some(id=>!Object.hasOwn(i.ports,id)));
  assert.equal(record.intervals[k].start_s,720);
  assert.deepEqual(record.intervals[k].ports,{D1:1,A2:2});
  assert.deepEqual(record.intervals[840].ports,{B2:1,A2:2});
});

test('readiness exactly at the departure target counts as on time',()=>{
  const {record,verification}=cell('data_heavy','base','capacity_fifo');
  const a1=visit(verification,'A1');
  assert.deepEqual([a1.ready_s,a1.deadline_s,a1.outcome,a1.lateness_s,a1.lateness_lower_bound_s],[600,600,'on_time',0,0]);
  assert.deepEqual(a1.tasks,{upload:480,charge:0,post:600});
  assert.deepEqual(a1.last_prerequisite,['post']);
  // Boundary order at 600 s: completions, then arrivals (with their zero-energy charge), then readiness, then deadlines.
  assert.deepEqual(record.events.filter(e=>e.time_s===600).map(e=>[e.type,e.vehicle,e.task]),[
    ['complete','A1','post'],
    ['arrival','A2',null],['complete','A2','charge'],['arrival','B2',null],['complete','B2','charge'],
    ['arrival','C2',null],['complete','C2','charge'],['arrival','D2',null],['complete','D2','charge'],
    ['ready','A1',null],['deadline','A1',null],
  ]);
});

test('zero energy completes charge at arrival and never takes a port',()=>{
  for(const rule of RULES){
    const {record,verification}=cell('data_heavy','base',rule);
    for(const v of verification.visits)assert.equal(v.tasks.charge,v.arrival_s,`${rule} ${v.vehicle}`);
    assert.ok(record.intervals.every(i=>Object.keys(i.ports).length===0&&Object.keys(i.charge).length===0&&Object.keys(i.grant_j).length===0),rule);
    assert.equal(verification.metrics.utilization.port_slots_used,0);
  }
});

// Verified [on time, total lateness s] per regime and treatment, rules in RULES order. Data-heavy base first come and
// departure deadline are derived by hand above; the rest pin this engine version so any change shows up as a diff.
const OUTCOMES={
  'data_heavy/base':[[3,6300],[3,7938],[3,4200],[8,3780]],'data_heavy/more_bandwidth':[[9,810],[9,90],[12,0],[9,90]],'data_heavy/more_power':[[3,6300],[3,7938],[3,4200],[8,3780]],
  'energy_heavy/base':[[6,2700],[6,2700],[6,2700],[6,2700]],'energy_heavy/more_bandwidth':[[6,2700],[6,2700],[6,2700],[6,2700]],'energy_heavy/more_power':[[9,180],[9,180],[9,180],[9,180]],
  'mixed/base':[[2,6420],[3,8556],[1,5760],[6,5280]],'mixed/more_bandwidth':[[6,2700],[6,2700],[6,2700],[6,2700]],'mixed/more_power':[[3,6300],[3,7938],[1,4320],[6,3900]],
};

test('all 36 primary cells conserve work and respect arrivals, dependencies, ports and capacity',()=>{
  for(const {id,record,verification} of allCells()){
    const s=record.scenario,q=s.time_quantum_ms/1000;
    assert.equal(verification.model_validity,'VALID',id);assert.equal(verification.comparison_eligible,true,id);
    assert.equal(record.execution_status,'completed',id);assert.equal(record.end_s,5400,id);assert.equal(record.intervals.length,5400,id);
    // upload and charge are useful rates per second; grant_bytes, unused_bytes, grant_j and unused_j are amounts per slot.
    assert.deepEqual(Object.keys(record.intervals[0]),['id','start_s','end_s','upload','grant_bytes','unused_bytes','charge','grant_j','unused_j','ports'],id);
    for(const [key,field] of [['upload_bytes','upload'],['energy_j','charge']]){
      for(const v of s.vehicles){
        assert.equal(record.totals[key][v.id],sum(record.intervals.map(i=>(i[field][v.id]??0)*q)),`${id} ${v.id} ${key}`);
        assert.equal(record.totals[key][v.id],v[key],`${id} ${v.id} finishes its ${key}`);
      }
    }
    const arrival=Object.fromEntries(s.vehicles.map(v=>[v.id,v.arrival_s]));
    for(const i of record.intervals){
      for(const field of ['grant_bytes','upload','ports','grant_j'])for(const vehicle of Object.keys(i[field]))assert.ok(arrival[vehicle]<=i.start_s,`${id} ${field} to ${vehicle} before arrival at ${i.start_s}`);
      const ports=Object.values(i.ports);
      assert.ok(ports.length<=2&&new Set(ports).size===ports.length&&ports.every(p=>p===1||p===2),`${id} ports at ${i.start_s}`);
      assert.ok(sum(Object.values(i.grant_j))<=s.site_power_j_s*q&&sum(Object.values(i.charge))*q<=s.site_power_j_s*q,`${id} site feed at ${i.start_s}`);
      assert.ok(Object.values(i.grant_j).every(j=>j<=s.port_cap_j_s*q),`${id} port cap at ${i.start_s}`);
      assert.ok(sum(Object.values(i.grant_bytes))<=s.uplink_bytes_s*q&&sum(Object.values(i.upload))*q<=s.uplink_bytes_s*q,`${id} uplink at ${i.start_s}`);
    }
    const done=Object.fromEntries(record.events.filter(e=>e.type==='complete').map(e=>[`${e.vehicle}/${e.task}`,e]));
    for(const ready of record.events.filter(e=>e.type==='ready')){
      const tasks=['upload','charge','post'].map(task=>done[`${ready.vehicle}/${task}`]);
      assert.ok(tasks.every(e=>e&&e.seq<ready.seq),`${id} ${ready.vehicle} ready before its prerequisites`);
      assert.equal(ready.time_s,Math.max(...tasks.map(e=>e.time_s)),`${id} ${ready.vehicle} ready time`);
      assert.equal(done[`${ready.vehicle}/post`].time_s-done[`${ready.vehicle}/upload`].time_s,120,`${id} ${ready.vehicle} local step follows upload`);
    }
    const m=verification.metrics;
    assert.equal(m.pending,0,id);assert.equal(m.unfinished_due,0,id);assert.equal(m.final_lateness,true,id);
    assert.equal(m.on_time+m.late,12,id);assert.equal(m.missed,m.late,id);
    assert.deepEqual([m.on_time,m.lateness_s],OUTCOMES[`${s.regime}/${s.treatment}`][RULES.indexOf(record.rule)],id);assert.equal(m.lateness_s,m.lateness_lower_bound_s,id);
    const u=m.utilization;
    assert.equal(u.uplink_bytes_served,sum(Object.values(record.totals.upload_bytes)),id);assert.equal(u.uplink_bytes_available,s.uplink_bytes_s*5400,id);
    assert.equal(u.site_j_served,sum(Object.values(record.totals.energy_j)),id);assert.equal(u.site_j_available,s.site_power_j_s*5400,id);
    assert.equal(u.port_slots_used,sum(record.intervals.map(i=>Object.keys(i.ports).length)),id);assert.equal(u.port_slots_available,2*5400,id);
  }
});

test('policies see only arrived visits and their upload work; upload rules never read energy',()=>{
  const observations=[];
  const s=contract.capacityScenario({regime:'mixed',treatment:'base'});
  const r=simulateCapacity(s,'capacity_fifo',{propose:o=>{observations.push(o);return o.eligible.length?{[o.eligible[0].id]:o.slot_bytes}:{};}});
  assert.equal(r.execution_status,'completed');assert.equal(observations.length,5400);
  for(const o of observations){
    assert.ok(Object.isFrozen(o)&&Object.isFrozen(o.eligible)&&o.eligible.every(Object.isFrozen));
    assert.deepEqual(Object.keys(o).sort(),['eligible','slot_bytes','slot_index','time_quantum_ms','time_s','uplink_bytes_s','vehicle_cap_bytes']);
    for(const e of o.eligible)assert.deepEqual(Object.keys(e).sort(),['arrival_s','deadline_s','id','remaining_bytes']);
    const ids=o.eligible.map(e=>e.id);
    if(o.time_s<600)assert.ok(!ids.some(id=>id.endsWith('2')),`wave 2 visible at ${o.time_s}`);
    if(o.time_s<1200)assert.ok(!ids.some(id=>id.endsWith('3')),`wave 3 visible at ${o.time_s}`);
  }
  assert.ok(observations.some(o=>o.eligible.some(e=>e.id==='A3')));
  // The first-eligible proposal is exactly first come, first served, so the record verifies as that rule.
  assert.equal(verifyCapacity(r).comparison_eligible,true);
  for(const rule of RULES){
    const data=cell('data_heavy','base',rule).record,mixed=cell('mixed','base',rule).record;
    for(const [k,i] of data.intervals.entries()){
      assert.deepEqual(mixed.intervals[k].grant_bytes,i.grant_bytes,`${rule} grants at ${k}`);
      assert.deepEqual(mixed.intervals[k].upload,i.upload,`${rule} upload at ${k}`);
    }
  }
});

test('a zero or -0 grant is recorded as no grant, so a policy that spells out zeros still verifies as its rule',()=>{
  const propose=o=>{
    const grants=Object.fromEntries(o.eligible.map(e=>[e.id,0]));
    if(o.eligible.length>1)grants[o.eligible[1].id]=-0;
    if(o.eligible.length)grants[o.eligible[0].id]=o.slot_bytes;
    return grants;
  };
  const r=simulateCapacity(contract.capacityScenario({regime:'data_heavy',treatment:'base'}),'capacity_fifo',{propose});
  assert.deepEqual(r.intervals[0].grant_bytes,{A1:125000000});
  assert.ok(r.intervals.every(i=>Object.values(i.grant_bytes).every(n=>n>0)));
  const v=verifyCapacity(r);assert.equal(v.model_validity,'VALID');assert.equal(v.comparison_eligible,true);
  assert.equal(contract.recordDigest(r),contract.recordDigest(cell('data_heavy','base','capacity_fifo').record));
});

test('treatments change exactly the one declared capacity field',()=>{
  for(const regime of REGIMES){
    const base=contract.capacityScenario({regime,treatment:'base'});
    for(const treatment of ['more_bandwidth','more_power']){
      const other=contract.capacityScenario({regime,treatment});
      const changed=Object.keys(base).filter(key=>contract.canonicalText(base[key])!==contract.canonicalText(other[key]));
      assert.deepEqual(changed,['treatment',contract.CAPACITY_TREATMENTS[treatment].changed],`${regime} ${treatment}`);
    }
  }
});

test('negative controls: site power cannot help data-heavy work and bandwidth cannot change charging',()=>{
  for(const rule of RULES){
    const base=cell('data_heavy','base',rule).record,power=cell('data_heavy','more_power',rule).record;
    assert.deepEqual(power.events,base.events,rule);
    for(const [k,i] of base.intervals.entries())for(const field of ['upload','grant_bytes','charge','ports'])assert.deepEqual(power.intervals[k][field],i[field],`${rule} ${field} at ${k}`);
    assert.deepEqual(Object.keys(base.scenario).filter(key=>base.scenario[key]!==power.scenario[key]&&typeof base.scenario[key]!=='object'),['treatment','site_power_j_s']);
    const energyBase=cell('energy_heavy','base',rule).record,bandwidth=cell('energy_heavy','more_bandwidth',rule).record;
    for(const [k,i] of energyBase.intervals.entries())for(const field of ['charge','grant_j','ports'])assert.deepEqual(bandwidth.intervals[k][field],i[field],`${rule} energy ${field} at ${k}`);
  }
});

test('250 ms refinement agrees with every 1,000 ms cell on ready times and outcomes',()=>{
  const disagreements=[];
  for(const {id,record,verification} of allCells()){
    const {regime,treatment}=record.scenario,fine=simulateCapacity(contract.capacityScenario({regime,treatment,time_quantum_ms:250}),record.rule),check=verifyCapacity(fine);
    assert.equal(check.model_validity,'VALID',`${id} at 250 ms`);assert.equal(check.comparison_eligible,true,`${id} at 250 ms`);
    for(const v of verification.visits){
      const f=visit(check,v.vehicle);
      if(f.ready_s!==v.ready_s||f.outcome!==v.outcome)disagreements.push(`${id} ${v.vehicle}: ${v.ready_s} ${v.outcome} versus ${f.ready_s} ${f.outcome}`);
    }
  }
  assert.deepEqual(disagreements,[]);
});

test('a final grant larger than the remaining upload records the unused bytes and never reuses them in the slot',()=>{
  const r=simulateCapacity(contract.capacityScenario({regime:'data_heavy',treatment:'base'}),'capacity_fifo',{propose:o=>o.eligible.length?{[o.eligible[0].id]:7e7}:{}});
  // 60e9 bytes at 70,000,000 per slot: 857 full slots, then 10,000,000 useful bytes and 60,000,000 unused in slot 857.
  const i=r.intervals[857];
  assert.deepEqual([i.grant_bytes,i.upload,i.unused_bytes],[{A1:7e7},{A1:1e7},{A1:6e7}]);
  assert.equal(r.events.find(e=>e.vehicle==='A1'&&e.task==='upload').time_s,858);
  assert.equal(r.totals.upload_bytes.A1,60e9);
  // Holding back part of every slot is not first come, first served, so the trace cannot claim that rule.
  const v=verifyCapacity(r);assert.equal(v.model_validity,'INVALID');
  assert.match(v.checks.at(-1).rule,/^slot 0 grant_bytes: grants do not implement the declared rule; first difference at A1\.$/);
});

test('A1 and D1 cannot both be on time in any data-heavy or mixed base cell',()=>{
  for(const regime of ['data_heavy','mixed'])for(const rule of RULES){
    const {verification}=cell(regime,'base',rule);
    assert.ok(['A1','D1'].some(id=>visit(verification,id).outcome!=='on_time'),`${regime} ${rule}`);
  }
});

test('the verifier rejects forged grants, ports, events, totals, workload, rule, power, zero entries and -0, naming where',()=>{
  const fifo=cell('data_heavy','base','capacity_fifo').record,data=cell('data_heavy','base','capacity_equal_uplink').record,energy=cell('energy_heavy','base','capacity_equal_uplink').record;
  for(const r of [fifo,data,energy])assert.equal(verifyCapacity(r).model_validity,'VALID');
  // Equal share, slot 240: B1 has finished, so A1, C1 and D1 share 125,000,000 bytes; 240 mod 3 = 0, so the two
  // remainder bytes go to A1 and C1 (41,666,667 each) and D1 gets 41,666,666. Swapping A1 and D1 breaks the rotation.
  const swapRemainder=r=>{const i=r.intervals[240];for(const field of ['grant_bytes','upload'])[i[field].A1,i[field].D1]=[i[field].D1,i[field].A1];};
  const probes=[
    [fifo,r=>{r.intervals[0].grant_bytes.B1=0;},/^slot 0 grant_bytes: grants do not implement the declared rule; first difference at B1\.$/],
    [fifo,r=>{r.intervals[0].grant_bytes.B1=-0;},/^slot 0 grant_bytes: grants do not implement the declared rule; first difference at B1\.$/],
    [fifo,r=>{r.intervals[0].upload.B1=0;},/^slot 0 upload: useful upload differs from reconstruction; first difference at B1\.$/],
    [data,r=>{r.intervals[0].grant_bytes.B1=r.scenario.uplink_bytes_s;},/^slot 0 grant_bytes: grants exceed the link or the per-vehicle cap\.$/],
    [data,r=>{r.rule='capacity_fifo';},/^slot 0 grant_bytes: grants do not implement the declared rule; first difference at A1\.$/],
    [data,swapRemainder,/^slot 240 grant_bytes: grants do not implement the declared rule; first difference at A1\.$/],
    [data,r=>{r.intervals[0].unused_bytes.A1=0;},/^slot 0 unused_bytes: unused bytes differ from reconstruction; first difference at A1\.$/],
    [data,r=>{r.intervals[0].unused_bytes.A1=-0;},/^slot 0 unused_bytes: unused bytes differ from reconstruction; first difference at A1\.$/],
    [data,r=>{r.intervals[0].start_s=-0;},/^slot 0: noncontiguous slot boundary\.$/],
    [data,r=>{r.events.find(e=>e.type==='complete'&&e.task==='post').time_s-=1;},/^events: inventory or order differs from reconstruction at seq \d+\.$/],
    [data,r=>{r.events[0].time_s=-0;},/^events: inventory or order differs from reconstruction at seq 0\.$/],
    [data,r=>{r.totals.upload_bytes.A1+=1;},/^totals: A1 differs from the integrated useful service\.$/],
    [data,r=>{r.totals.energy_j.A1=-0;},/^totals: A1 differs from the integrated useful service\.$/],
    [data,r=>{r.scenario.vehicles[0].upload_bytes=6e9;},/^record: Scenario differs from the frozen NF-03 workload/],
    // Slot 0 of energy-heavy: A1 holds port 1 and B1 port 2, each at 30,000 J, all of it useful.
    [energy,r=>{r.intervals[0].ports.B1=1;},/^slot 0 ports: a port serves two visits or does not exist\.$/],
    [energy,r=>{r.intervals[0].grant_j.A1=r.scenario.port_cap_j_s+1;},/^slot 0 grant_j: power differs from min\(port cap, site feed \/ occupied ports\); first difference at A1\.$/],
    [energy,r=>{r.intervals[0].unused_j.A1=0;},/^slot 0 unused_j: unused energy differs from reconstruction; first difference at A1\.$/],
    [energy,r=>{r.intervals[240].charge.D1=-0;},/^slot 240 charge: useful charge differs from reconstruction; first difference at D1\.$/],
  ];
  const before=[fifo,data,energy].map(r=>JSON.stringify(r));
  for(const [index,[original,mutate,message]] of probes.entries()){
    const forged=structuredClone(original);mutate(forged);const v=verifyCapacity(forged);
    assert.equal(v.model_validity,'INVALID',`probe ${index}`);assert.equal(v.comparison_eligible,false);assert.equal(v.metrics,null);assert.equal(v.visits,null);
    assert.equal(v.checks.at(-1).name,'Required evidence');assert.equal(v.checks.at(-1).status,'FAIL');
    assert.match(v.checks.at(-1).rule,message,`probe ${index}`);
  }
  assert.deepEqual([fifo,data,energy].map(r=>JSON.stringify(r)),before);
});

test('invalid policy grants end the run at their boundary with one diagnostic and no comparison eligibility',()=>{
  const cases=[
    ['base',()=>({A1:-1}),/nonnegative integer bytes/],
    ['base',()=>({A2:1}),/^A grant names A2, which has no arrived upload work\.$/],
    ['base',()=>({A1:62500001,B1:62500000}),/slot/i],
    ['more_bandwidth',()=>({A1:250000001}),/cap/i],
    ['base',()=>({}),/progress/i],
    ['base',()=>{throw Error('broken');},/broken/],
  ];
  for(const at of [0,3])for(const [treatment,bad,message] of cases){
    const r=simulateCapacity(contract.capacityScenario({regime:'data_heavy',treatment}),'capacity_fifo',{propose:o=>o.time_s>=at?bad():{[o.eligible[0].id]:o.slot_bytes}}),v=verifyCapacity(r);
    assert.equal(r.policy_status,'policy_error');assert.equal(r.execution_status,'failed');assert.equal(r.end_s,at);assert.equal(r.intervals.length,at);
    assert.equal(r.diagnostics.length,1);assert.equal(r.diagnostics[0].code,'POLICY_ERROR');assert.equal(r.diagnostics[0].time_s,at);assert.match(r.diagnostics[0].message,message);
    assert.equal(v.model_validity,'VALID');assert.equal(v.comparison_eligible,false);
    // Data-heavy uploads take at least 60 s, so no visit is ready by 3 s and no deadline has passed.
    assert.equal(v.metrics.pending,12);
  }
});

test('canonical text and record digest are deterministic and refuse non-data values',()=>{
  assert.equal(contract.canonicalText({b:1,a:[1,{d:2,c:3}]}),'{"a":[1,{"c":3,"d":2}],"b":1}');
  assert.equal(contract.canonicalText(0.25),'0.25');
  assert.equal(contract.canonicalText([null,true,'x']),'[null,true,"x"]');
  class Box{constructor(){this.a=1;}}
  for(const bad of [NaN,Infinity,-Infinity,-0,{a:-0},undefined,{a:undefined},[undefined],[1,,3],()=>1,{f(){}},Symbol('s'),new Box(),new Map(),10n])assert.throws(()=>contract.canonicalText(bad),String(bad?.constructor?.name??typeof bad));
  // An array's extra own property would be silently dropped, and an accessor would run code while being read.
  let reads=0;const getter={enumerable:true,get(){reads++;return 1;}};
  for(const bad of [Object.assign([1,2],{extra:3}),Object.defineProperty({},'a',getter),Object.defineProperty([0],'0',getter),Object.setPrototypeOf([1],Object.create(Array.prototype))]){
    assert.throws(()=>contract.canonicalText(bad),/plain data/);
  }
  assert.equal(reads,0);
  const s=contract.capacityScenario({regime:'data_heavy',treatment:'base'});
  const first=contract.recordDigest(simulateCapacity(s,'capacity_fifo')),second=contract.recordDigest(simulateCapacity(s,'capacity_fifo'));
  assert.match(first,/^[0-9a-f]{64}$/);assert.equal(first,second);
  assert.notEqual(contract.recordDigest(simulateCapacity(s,'capacity_shortest_upload')),first);
});

test('the cell runner simulates, verifies and digests one cell',()=>{
  const result=runCapacityCell({regime:'mixed',treatment:'more_bandwidth',rule:'capacity_shortest_upload'});
  assert.deepEqual(Object.keys(result),['scenario','record','verification','digest']);
  assert.equal(result.scenario.treatment,'more_bandwidth');assert.equal(result.record.scenario.treatment,'more_bandwidth');assert.equal(result.record.rule,'capacity_shortest_upload');
  assert.equal(result.verification.model_validity,'VALID');assert.equal(result.verification.comparison_eligible,true);
  assert.equal(result.digest,contract.recordDigest(result.record));
});

test('cell steps yield one verified cell at a time in order and stop between cells on cancel',()=>{
  const cells=[{regime:'data_heavy',treatment:'base',rule:'capacity_fifo'},{regime:'energy_heavy',treatment:'base',rule:'capacity_fifo'},{regime:'mixed',treatment:'base',rule:'capacity_fifo'}];
  let cancelled=false;const yielded=[];
  for(const step of capacityCellSteps(cells,{shouldCancel:()=>cancelled})){yielded.push(step);cancelled=true;}
  assert.equal(yielded.length,1);
  assert.deepEqual(Object.keys(yielded[0]).sort(),['cell','digest','index','record','scenario','verification']);
  assert.equal(yielded[0].index,0);assert.equal(yielded[0].cell,cells[0]);assert.equal(yielded[0].verification.comparison_eligible,true);
  assert.deepEqual([...capacityCellSteps(cells.slice(0,2))].map(x=>[x.index,x.record.scenario.regime]),[[0,'data_heavy'],[1,'energy_heavy']]);
});

test('a run cancelled inside a cell keeps its verified prefix and is never comparison eligible',()=>{
  let calls=0;const r=simulateCapacity(contract.capacityScenario({regime:'mixed',treatment:'base'}),'capacity_fifo',{shouldCancel:()=>calls++===5});
  const v=verifyCapacity(r);
  assert.equal(r.execution_status,'cancelled');assert.equal(r.end_s,5);assert.equal(r.intervals.length,5);
  assert.equal(v.model_validity,'VALID');assert.equal(v.comparison_eligible,false);
});
