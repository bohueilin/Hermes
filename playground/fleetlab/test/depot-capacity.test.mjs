import assert from 'node:assert/strict';
import {test} from 'node:test';
// Missing implementation is reported as a contract assertion during the first red run.
const contract=await import('../src/model/depot-capacity-contract.js').catch(()=>({}));
const model=await import('../src/model/depot-capacity.js').catch(()=>({}));
const verifier=await import('../src/model/depot-capacity-verify.js').catch(()=>({}));
const flowContract=await import('../src/model/depot-flow-contract.js');

const REGIMES=['data_heavy','energy_heavy','mixed'],TREATMENTS=['base','more_bandwidth','more_power'];
const RULES=['capacity_fifo','capacity_equal_uplink','capacity_departure_deadline','capacity_shortest_upload'];
const IDS=['A1','B1','C1','D1','A2','B2','C2','D2','A3','B3','C3','D3'];
const scenario=options=>{assert.equal(typeof contract.capacityScenario,'function','NF-03 contract is required');return contract.capacityScenario(options);};
const run=(s,rule,runtime)=>{assert.equal(typeof model.simulateCapacity,'function','NF-03 engine is required');return model.simulateCapacity(s,rule,runtime);};
const verify=r=>{assert.equal(typeof verifier.verifyCapacity,'function','Independent NF-03 verifier is required');return verifier.verifyCapacity(r);};
const sum=values=>values.reduce((a,b)=>a+b,0);
const visit=(verification,id)=>verification.visits.find(v=>v.vehicle===id);

// The 36 primary records are simulated once and shared; 250 ms records are built and dropped one at a time.
const primary=new Map();
function cell(regime,treatment,rule){
  const id=`${regime}/${treatment}/${rule}/1000`;
  if(!primary.has(id)){const record=run(scenario({regime,treatment}),rule);primary.set(id,{id,record,verification:verify(record)});}
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
  assert.deepEqual(contract.FLOW_TRUST,flowContract.FLOW_TRUST);
  for(const value of [contract.CAPACITY_VERSIONS,contract.CAPACITY_RULES,contract.CAPACITY_RULES[0],contract.CAPACITY_REGIMES.mixed.energy_j,contract.CAPACITY_TREATMENTS.base,contract.CAPACITY_PROTOCOL.deadline_offset_s,contract.CAPACITY_PROTOCOL.waves])assert.ok(Object.isFrozen(value));
});

test('the frozen twelve-visit workload is the only scenario each regime, treatment and quantum accepts',()=>{
  const s=scenario({regime:'data_heavy',treatment:'base'});
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
  const total=(regime,key)=>sum(scenario({regime,treatment:'base'}).vehicles.map(v=>v[key]));
  assert.equal(total('data_heavy','upload_bytes'),382.5e9);assert.equal(total('mixed','upload_bytes'),382.5e9);assert.equal(total('energy_heavy','upload_bytes'),38.25e9);
  assert.equal(total('energy_heavy','energy_j'),140400000);assert.equal(total('mixed','energy_j'),140400000);assert.equal(total('data_heavy','energy_j'),0);
  assert.equal(total('mixed','energy_j')/3.6e6,39);
  for(const quantum of [1000,250])contract.validateCapacityScenario(scenario({regime:'mixed',treatment:'more_power',time_quantum_ms:quantum}));
  for(const mutate of [
    x=>x.vehicles[1].upload_bytes+=1,
    x=>x.vehicles.push({...x.vehicles[11],id:'E3'}),
    x=>x.vehicles[3].deadline_s=361,
    x=>x.time_quantum_ms=500,
    x=>x.regime='unknown',
    x=>x.extra=1,
  ]){
    const changed=scenario({regime:'data_heavy',treatment:'base'});mutate(changed);
    assert.throws(()=>contract.validateCapacityScenario(changed));
    assert.throws(()=>run(changed,'capacity_fifo'));
  }
  assert.throws(()=>scenario({regime:'data_heavy',treatment:'base',time_quantum_ms:500}));
  assert.throws(()=>scenario({regime:'unknown',treatment:'base'}));
  assert.throws(()=>scenario({regime:'constructor',treatment:'base'}));
  assert.throws(()=>scenario({regime:'data_heavy',treatment:'base',extra:1}));
  assert.throws(()=>run(scenario({regime:'data_heavy',treatment:'base'}),'cohort_fifo'));
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

test('two ports share the 60 kW site feed at 30 kW each and hand over at the release boundary',()=>{
  const {record,verification}=cell('energy_heavy','base','capacity_fifo');
  assert.equal(verification.model_validity,'VALID');
  const slot=t=>{const i=record.intervals[t];assert.equal(i.start_s,t);return {ports:i.ports,charge:i.charge,power:i.power,power_unused:i.power_unused};};
  const shared={charge:{A1:30000,B1:30000},power:{A1:30000,B1:30000},power_unused:{}};
  assert.deepEqual(slot(0),{ports:{A1:1,B1:2},...shared});
  assert.deepEqual(slot(239),{ports:{A1:1,B1:2},...shared});
  // B1 reaches 7,200,000 J at 240 s; C1 takes port 2 and A1 stays at 30 kW because two ports still share 60 kW.
  assert.deepEqual(slot(240),{ports:{A1:1,C1:2},charge:{A1:30000,C1:30000},power:{A1:30000,C1:30000},power_unused:{}});
  assert.equal(visit(verification,'B1').tasks.charge,240);
  // A1 (21.6 MJ) and C1 (14.4 MJ from 240 s) both finish at 720 s; D1 then takes port 1 and A2 port 2.
  assert.deepEqual(slot(719).ports,{A1:1,C1:2});
  assert.deepEqual(slot(720).ports,{D1:1,A2:2});
  assert.deepEqual([visit(verification,'A1').tasks.charge,visit(verification,'C1').tasks.charge,visit(verification,'D1').tasks.charge],[720,720,840]);
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
    assert.ok(record.intervals.every(i=>Object.keys(i.ports).length===0&&Object.keys(i.charge).length===0&&Object.keys(i.power).length===0),rule);
    assert.equal(verification.metrics.utilization.port_slots_used,0);
  }
});

test('all 36 primary cells conserve work and respect arrivals, dependencies, ports and capacity',()=>{
  for(const {id,record,verification} of allCells()){
    const s=record.scenario,q=s.time_quantum_ms/1000;
    assert.equal(verification.model_validity,'VALID',id);assert.equal(verification.comparison_eligible,true,id);
    assert.equal(record.execution_status,'completed',id);assert.equal(record.end_s,5400,id);assert.equal(record.intervals.length,5400,id);
    for(const [key,field] of [['upload_bytes','upload'],['energy_j','charge']]){
      for(const v of s.vehicles){
        assert.equal(record.totals[key][v.id],sum(record.intervals.map(i=>(i[field][v.id]??0)*q)),`${id} ${v.id} ${key}`);
        assert.equal(record.totals[key][v.id],v[key],`${id} ${v.id} finishes its ${key}`);
      }
    }
    const arrival=Object.fromEntries(s.vehicles.map(v=>[v.id,v.arrival_s]));
    for(const i of record.intervals){
      for(const field of ['grants','upload','ports','power'])for(const vehicle of Object.keys(i[field]))assert.ok(arrival[vehicle]<=i.start_s,`${id} ${field} to ${vehicle} before arrival at ${i.start_s}`);
      const ports=Object.values(i.ports);
      assert.ok(ports.length<=2&&new Set(ports).size===ports.length&&ports.every(p=>p===1||p===2),`${id} ports at ${i.start_s}`);
      assert.ok(sum(Object.values(i.power))<=s.site_power_j_s*q&&sum(Object.values(i.charge))*q<=s.site_power_j_s*q,`${id} site feed at ${i.start_s}`);
      assert.ok(Object.values(i.power).every(j=>j<=s.port_cap_j_s*q),`${id} port cap at ${i.start_s}`);
      assert.ok(sum(Object.values(i.grants))<=s.uplink_bytes_s*q&&sum(Object.values(i.upload))*q<=s.uplink_bytes_s*q,`${id} uplink at ${i.start_s}`);
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
    assert.equal(m.lateness_s,sum(verification.visits.map(v=>v.lateness_s)),id);assert.equal(m.lateness_s,m.lateness_lower_bound_s,id);
    const u=m.utilization;
    assert.equal(u.uplink_bytes_served,sum(Object.values(record.totals.upload_bytes)),id);assert.equal(u.uplink_bytes_available,s.uplink_bytes_s*5400,id);
    assert.equal(u.site_j_served,sum(Object.values(record.totals.energy_j)),id);assert.equal(u.site_j_available,s.site_power_j_s*5400,id);
    assert.equal(u.port_slots_used,sum(record.intervals.map(i=>Object.keys(i.ports).length)),id);assert.equal(u.port_slots_available,2*5400,id);
  }
});

test('policies see only arrived visits and their upload work; upload rules never read energy',()=>{
  const observations=[];
  const s=scenario({regime:'mixed',treatment:'base'});
  const r=run(s,'capacity_fifo',{propose:o=>{observations.push(o);return o.eligible.length?{[o.eligible[0].id]:o.slot_bytes}:{};}});
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
  assert.equal(verify(r).comparison_eligible,true);
  for(const rule of RULES){
    const data=cell('data_heavy','base',rule).record,mixed=cell('mixed','base',rule).record;
    for(const [k,i] of data.intervals.entries()){
      assert.deepEqual(mixed.intervals[k].grants,i.grants,`${rule} grants at ${k}`);
      assert.deepEqual(mixed.intervals[k].upload,i.upload,`${rule} upload at ${k}`);
    }
  }
});

test('treatments change exactly the one declared capacity field',()=>{
  for(const regime of REGIMES){
    const base=scenario({regime,treatment:'base'});
    for(const treatment of ['more_bandwidth','more_power']){
      const other=scenario({regime,treatment});
      const changed=Object.keys(base).filter(key=>contract.canonicalText(base[key])!==contract.canonicalText(other[key]));
      assert.deepEqual(changed,['treatment',contract.CAPACITY_TREATMENTS[treatment].changed],`${regime} ${treatment}`);
    }
  }
});

test('negative controls: site power cannot help data-heavy work and bandwidth cannot change charging',()=>{
  for(const rule of RULES){
    const base=cell('data_heavy','base',rule).record,power=cell('data_heavy','more_power',rule).record;
    assert.deepEqual(power.events,base.events,rule);
    for(const [k,i] of base.intervals.entries())for(const field of ['upload','grants','charge','ports'])assert.deepEqual(power.intervals[k][field],i[field],`${rule} ${field} at ${k}`);
    assert.deepEqual(Object.keys(base.scenario).filter(key=>base.scenario[key]!==power.scenario[key]&&typeof base.scenario[key]!=='object'),['treatment','site_power_j_s']);
    const energyBase=cell('energy_heavy','base',rule).record,bandwidth=cell('energy_heavy','more_bandwidth',rule).record;
    for(const [k,i] of energyBase.intervals.entries())for(const field of ['charge','power','ports'])assert.deepEqual(bandwidth.intervals[k][field],i[field],`${rule} energy ${field} at ${k}`);
  }
});

test('250 ms refinement agrees with every 1,000 ms cell on ready times and outcomes',()=>{
  const disagreements=[];
  for(const {id,record,verification} of allCells()){
    const {regime,treatment}=record.scenario,fine=run(scenario({regime,treatment,time_quantum_ms:250}),record.rule),check=verify(fine);
    assert.equal(check.model_validity,'VALID',`${id} at 250 ms`);assert.equal(check.comparison_eligible,true,`${id} at 250 ms`);
    for(const v of verification.visits){
      const f=visit(check,v.vehicle);
      if(f.ready_s!==v.ready_s||f.outcome!==v.outcome)disagreements.push(`${id} ${v.vehicle}: ${v.ready_s} ${v.outcome} versus ${f.ready_s} ${f.outcome}`);
    }
  }
  assert.deepEqual(disagreements,[]);
});

test('a final grant larger than the remaining upload records the unused bytes and never reuses them in the slot',()=>{
  const r=run(scenario({regime:'data_heavy',treatment:'base'}),'capacity_fifo',{propose:o=>o.eligible.length?{[o.eligible[0].id]:7e7}:{}});
  // 60e9 bytes at 70,000,000 per slot: 857 full slots, then 10,000,000 useful bytes and 60,000,000 unused in slot 857.
  const i=r.intervals[857];
  assert.deepEqual([i.grants,i.upload,i.unused],[{A1:7e7},{A1:1e7},{A1:6e7}]);
  assert.equal(r.events.find(e=>e.vehicle==='A1'&&e.task==='upload').time_s,858);
  assert.equal(r.totals.upload_bytes.A1,60e9);
  // Holding back part of every slot is not first come, first served, so the trace cannot claim that rule.
  const v=verify(r);assert.equal(v.model_validity,'INVALID');assert.match(v.checks.at(-1).rule,/declared rule/);
});

test('A1 and D1 cannot both be on time in any data-heavy or mixed base cell',()=>{
  for(const regime of ['data_heavy','mixed'])for(const rule of RULES){
    const {verification}=cell(regime,'base',rule);
    assert.ok(['A1','D1'].some(id=>visit(verification,id).outcome!=='on_time'),`${regime} ${rule}`);
  }
});

test('the verifier rejects forged grants, ports, events, totals, workload, rule and power without mutation',()=>{
  const data=cell('data_heavy','base','capacity_equal_uplink').record,energy=cell('energy_heavy','base','capacity_equal_uplink').record;
  assert.equal(verify(data).model_validity,'VALID');assert.equal(verify(energy).model_validity,'VALID');
  const offByOne=data.intervals.findIndex(i=>{const n=Object.values(i.grants);return Math.max(...n)-Math.min(...n)===1;});
  assert.ok(offByOne>=0,'some slot rotates a remainder byte');
  const swapRemainder=r=>{
    const i=r.intervals[offByOne],ids=Object.keys(i.grants),high=ids.find(id=>i.grants[id]===Math.max(...Object.values(i.grants))),low=ids.find(id=>i.grants[id]===Math.min(...Object.values(i.grants)));
    for(const field of ['grants','upload'])[i[field][high],i[field][low]]=[i[field][low],i[field][high]];
  };
  const portMutations=[
    r=>{const i=r.intervals.find(x=>Object.keys(x.ports).length===2)??r.intervals[0];const [first]=Object.keys(i.ports);for(const id of ['A1','B1'])i.ports[id]=i.ports[first]??1;},
    r=>{const i=r.intervals.find(x=>Object.keys(x.power).length)??r.intervals[0];const id=Object.keys(i.power)[0]??'A1';i.power[id]=r.scenario.port_cap_j_s+1;},
  ];
  const dataMutations=[
    r=>{const i=r.intervals[0];i.grants.B1=r.scenario.uplink_bytes_s;},
    r=>{r.events.find(e=>e.type==='complete'&&e.task==='post').time_s-=1;},
    r=>{r.totals.upload_bytes.A1+=1;},
    r=>{r.scenario.vehicles[0].upload_bytes=6e9;},
    r=>{r.rule='capacity_fifo';},
    swapRemainder,
    ...portMutations,
  ];
  for(const [original,mutations] of [[data,dataMutations],[energy,portMutations]]){
    const before=JSON.stringify(original);
    for(const [index,mutate] of mutations.entries()){
      const forged=structuredClone(original);mutate(forged);const v=verify(forged);
      assert.equal(v.model_validity,'INVALID',`mutation ${index} on ${original.scenario.regime}`);assert.equal(v.comparison_eligible,false);assert.equal(v.metrics,null);assert.equal(v.visits,null);
      assert.equal(v.checks.at(-1).name,'Required evidence');assert.equal(v.checks.at(-1).status,'FAIL');
    }
    assert.equal(JSON.stringify(original),before);
  }
});

test('invalid policy grants end the run at their boundary with one diagnostic and no comparison eligibility',()=>{
  const cases=[
    ['base',()=>({A1:-1}),/./],
    ['base',()=>({A2:1}),/./],
    ['base',()=>({A1:62500001,B1:62500000}),/slot/i],
    ['more_bandwidth',()=>({A1:250000001}),/cap/i],
    ['base',()=>({}),/progress/i],
    ['base',()=>{throw Error('broken');},/broken/],
  ];
  for(const at of [0,3])for(const [treatment,bad,message] of cases){
    const r=run(scenario({regime:'data_heavy',treatment}),'capacity_fifo',{propose:o=>o.time_s>=at?bad():{[o.eligible[0].id]:o.slot_bytes}}),v=verify(r);
    assert.equal(r.policy_status,'policy_error');assert.equal(r.execution_status,'failed');assert.equal(r.end_s,at);assert.equal(r.intervals.length,at);
    assert.equal(r.diagnostics.length,1);assert.equal(r.diagnostics[0].code,'POLICY_ERROR');assert.equal(r.diagnostics[0].time_s,at);assert.match(r.diagnostics[0].message,message);
    assert.equal(v.model_validity,'VALID');assert.equal(v.comparison_eligible,false);
    assert.equal(v.metrics.pending,12-r.events.filter(e=>e.type==='ready').length);
  }
});

test('canonical text and record digest are deterministic and refuse non-data values',()=>{
  assert.equal(contract.canonicalText({b:1,a:[1,{d:2,c:3}]}),'{"a":[1,{"c":3,"d":2}],"b":1}');
  assert.equal(contract.canonicalText(0.25),'0.25');
  assert.equal(contract.canonicalText([null,true,'x']),'[null,true,"x"]');
  class Box{constructor(){this.a=1;}}
  for(const bad of [NaN,Infinity,-Infinity,undefined,{a:undefined},[undefined],()=>1,{f(){}},Symbol('s'),new Box(),new Map(),10n])assert.throws(()=>contract.canonicalText(bad),String(bad?.constructor?.name??typeof bad));
  const s=scenario({regime:'data_heavy',treatment:'base'});
  const first=contract.recordDigest(run(s,'capacity_fifo')),second=contract.recordDigest(run(s,'capacity_fifo'));
  assert.match(first,/^[0-9a-f]{64}$/);assert.equal(first,second);
  assert.notEqual(contract.recordDigest(run(s,'capacity_shortest_upload')),first);
});

test('cell runner verifies and digests one cell; cell steps yield per cell and stop on cancel',()=>{
  assert.equal(typeof model.runCapacityCell,'function');
  const result=model.runCapacityCell({regime:'mixed',treatment:'more_bandwidth',rule:'capacity_shortest_upload'});
  assert.equal(result.scenario.treatment,'more_bandwidth');assert.equal(result.record.scenario.treatment,'more_bandwidth');assert.equal(result.record.rule,'capacity_shortest_upload');
  assert.equal(result.verification.model_validity,'VALID');assert.equal(result.verification.comparison_eligible,true);
  assert.equal(result.digest,contract.recordDigest(result.record));
  const cells=[{regime:'data_heavy',treatment:'base',rule:'capacity_fifo'},{regime:'energy_heavy',treatment:'base',rule:'capacity_fifo'},{regime:'mixed',treatment:'base',rule:'capacity_fifo'}];
  let cancelled=false;const steps=model.capacityCellSteps(cells,{shouldCancel:()=>cancelled});const yielded=[];let next;
  while(!(next=steps.next()).done){yielded.push(next.value);cancelled=true;}
  assert.equal(yielded.length,1);assert.equal(next.value.length,1);
  assert.deepEqual(Object.keys(yielded[0]).sort(),['cell','digest','index','record','scenario','verification']);
  assert.equal(yielded[0].index,0);assert.equal(yielded[0].cell,cells[0]);assert.equal(yielded[0].verification.comparison_eligible,true);
  assert.deepEqual([...model.capacityCellSteps(cells.slice(0,2))].map(x=>[x.index,x.record.scenario.regime]),[[0,'data_heavy'],[1,'energy_heavy']]);
  // A run cancelled inside a cell keeps its verified prefix and is never comparison eligible.
  let calls=0;const r=run(scenario({regime:'mixed',treatment:'base'}),'capacity_fifo',{shouldCancel:()=>calls++===5});
  const v=verify(r);assert.equal(r.execution_status,'cancelled');assert.equal(r.end_s,5);assert.equal(v.model_validity,'VALID');assert.equal(v.comparison_eligible,false);
});
