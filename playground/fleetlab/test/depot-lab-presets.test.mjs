// Independent preset tests (annex D12-01, D12-04 table and CB tables, C1.2 treatment pointers). Every expected
// number is transcribed from the controlling documents; the CB values are recomputed from compiled catalogs.
import test from 'node:test';
import assert from 'node:assert/strict';
import {preset,PRESET_IDS,presetCatalog} from '../src/model/depot-lab/presets.js';
import {validateScenario} from '../src/model/depot-lab/schema.js';
import {compileScenario} from '../src/model/depot-lab/task-graph.js';
import {jcs} from '../src/model/depot-lab/canonical.js';
import {Q,formatRational} from '../src/model/depot-lab/rational.js';
import {uncontendedChargeTicks} from '../src/model/depot-lab/units.js';

const GB=1000000000,MBPS=125000,H=43200;
const BANDS=[{from_soc_pct:0,until_soc_pct:60,cap_w:100000},{from_soc_pct:60,until_soc_pct:80,cap_w:60000},{from_soc_pct:80,until_soc_pct:100,cap_w:30000}];
const valid=s=>{const r=validateScenario(jcs(s),{origin:'import'});assert.ok(r.ok,JSON.stringify(r.issues.slice(0,3)));return r.scenario;};
const cache=new Map();
const arms=id=>{if(!cache.has(id)){const p=preset(id);cache.set(id,[valid(p.baseline),p.candidate?valid(p.candidate):null]);}return cache.get(id);};
const both=(id,f)=>arms(id).forEach((s,i)=>{if(s)f(s,i);});
const pick=(v,i)=>Array.isArray(v)&&Array.isArray(v[0])?v[Math.min(i,v.length-1)]:v;// one row means both arms
const ROLE={cabin:'cleaner','diagnosis,mechanical_repair':'technician','connect,move,unplug':'mover','inspection,intake':'lead'};
const roleOf=w=>ROLE[w.qualifications.filter(q=>q.level==='independent').map(q=>q.task_class).sort().join(',')]??'none';
const dur=(s,cls)=>{const w=s.workers.find(x=>x.qualifications.some(q=>q.task_class===cls&&q.level==='independent'));return w?w.qualifications.find(q=>q.task_class===cls).solo_duration_ticks:null;};
const ZONES=['waiting','charging','cleaning','garage'];
const zoneCounts=s=>ZONES.map(z=>s.site.positions.filter(p=>p.zone===z).length);
const pad=(n,w)=>String(n).padStart(w,'0');

test('the fourteen named configurations exist in D12-04 order; only S200 has no candidate arm',()=>{
 assert.deepEqual([...PRESET_IDS],['B','P','PS','D','DR','M','T2','S200','W','G','GN','TP','TN','ST']);
 assert.deepEqual(presetCatalog().map(p=>[p.id,p.pair]),PRESET_IDS.map(id=>[id,id!=='S200']));
 for(const id of PRESET_IDS){const p=preset(id);assert.equal(p.id,id);assert.equal(typeof p.title,'string');assert.equal(!!p.candidate,id!=='S200');}
 assert.throws(()=>preset('X'));
});
test('every arm of every preset validates on the import path, compiles, keeps H 43,200 and the default 80% target',()=>{
 for(const id of PRESET_IDS)both(id,s=>{
  assert.equal(s.horizon_tick,H,id);assert.equal(s.requirements.energy.target_soc_pct,80,id);
  const c=compileScenario(s);assert.equal(c.visits.length,s.visits.length);for(const v of c.visits)assert.ok(v.tasks.length<=32,id);
 });
 const a=preset('B'),b=preset('B');a.baseline.site.positions[0].zone='garage';assert.notEqual(jcs(a.baseline),jcs(b.baseline),'each call returns fresh objects');
});

// ---------- inventories (D12-01 register and D12-04 overrides) ----------
const INVENTORY={// zones [waiting, charging, cleaning, garage] and [AC, DC] port counts per arm
 B:{zones:[[17,4,2,1],[16,5,2,1]],ports:[[2,2],[2,3]]},P:{zones:[[17,4,2,1]],ports:[[0,2],[0,3]]},PS:{zones:[[17,4,2,1]],ports:[[0,2],[0,3]]},
 D:{zones:[[17,4,2,1]],ports:[[2,2]]},DR:{zones:[[17,4,2,1]],ports:[[2,2]]},M:{zones:[[17,4,2,1]],ports:[[2,2]]},T2:{zones:[[16,4,2,2]],ports:[[2,2]]},
 S200:{zones:[[180,12,4,4]],ports:[[0,12]]},W:{zones:[[17,4,2,1],[24,4,2,1]],ports:[[2,2]]},G:{zones:[[17,4,2,1]],ports:[[2,2]]},GN:{zones:[[17,4,2,1]],ports:[[2,2]]},
 TP:{zones:[[15,4,4,1]],ports:[[2,2]]},TN:{zones:[[15,4,4,1]],ports:[[2,2]]},ST:{zones:[[17,4,2,1]],ports:[[2,2]]},
};
test('zone inventories, totals, port kinds, ratings and port positions',()=>{
 for(const id of PRESET_IDS)both(id,(s,i)=>{
  const z=pick(INVENTORY[id].zones,i),[ac,dc]=pick(INVENTORY[id].ports,i);
  assert.deepEqual(zoneCounts(s),z,`${id} arm ${i}`);assert.equal(s.site.positions.length,z.reduce((a,b)=>a+b,0));
  assert.ok(s.site.positions.every(p=>p.enabled),id);
  assert.equal(s.site.ports.filter(p=>p.kind==='AC').length,ac,id);assert.equal(s.site.ports.filter(p=>p.kind==='DC').length,dc,id);
  for(const p of s.site.ports){assert.equal(p.rating_w,p.kind==='DC'?150000:11000,id);assert.ok(p.enabled);assert.equal(s.site.positions.find(x=>x.id===p.position_id).zone,'charging',`${id} ${p.id}`);}
  assert.equal(new Set(s.site.ports.map(p=>p.position_id)).size,s.site.ports.length,id);
 });
 assert.equal(arms('S200')[0].site.positions.length,200);assert.deepEqual(arms('W').map(s=>s.site.positions.length),[24,31]);
 const [pb,pc]=arms('P'),portless=s=>s.site.positions.filter(p=>p.zone==='charging'&&!s.site.ports.some(q=>q.position_id===p.id)).length;
 assert.deepEqual([portless(pb),portless(pc)],[2,1],'P: four charging positions, two portless; the pair adds a DC port on an existing one');
 assert.deepEqual(arms('PS').map(portless),[2,1]);
});
const ARRIVALS={B:'spread',P:'power',PS:'power',D:'bunched',DR:'bunched',M:'spread',T2:'t2',S200:'s200',W:'bunched',G:'spread',GN:'spread',TP:'bunched',TN:'bunched',ST:'spread'};
const WINDOW={B:21600,P:1440,PS:1440,D:1,DR:1,M:21600,T2:21600,S200:12000,W:1,G:21600,GN:21600,TP:1,TN:1,ST:21600};
const MECH={B:[8,16,24],P:[8,16,24],PS:[8,16,24],D:[8,16,24],DR:[8,16,24],M:[8,16,24],T2:[1,2,8,16,24],W:[],G:[8,16,24],GN:[8,16,24],TP:[],TN:[],ST:[8,16,24]};
const SOC80=new Set(['D','DR','W','TP','TN']),UPLOAD=new Set(['D','DR','W']);
test('visit tapes: ids, arrivals, dues, faults, SOC, cabin, uploads and logs',()=>{
 for(const id of PRESET_IDS)both(id,s=>{
  const n=id==='S200'?200:24,w=id==='S200'?3:2;
  assert.equal(s.arrival_window_tick,WINDOW[id],id);assert.deepEqual(s.visits.map(v=>v.id),Array.from({length:n},(_,i)=>pad(i+1,w)),id);
  s.visits.forEach((v,i)=>{
   const k=i+1,kind=ARRIVALS[id];
   const arrival=kind==='spread'?900*i:kind==='power'||kind==='s200'?60*i:kind==='bunched'?0:k<=2?0:900*i;
   const due=kind==='power'||kind==='bunched'?21600:arrival+21600;
   assert.equal(v.arrival_tick,arrival,`${id} ${v.id}`);assert.equal(v.due_tick,due,`${id} ${v.id}`);
   const mech=id==='S200'?k%8===0:MECH[id].includes(k);assert.equal(v.fault,mech?'mechanical':'none',`${id} ${v.id}`);
   assert.equal(v.initial_soc_pct,SOC80.has(id)?80:20,id);assert.equal(v.cabin_required,true);assert.equal(v.upload_required,UPLOAD.has(id),id);
   assert.equal(v.initial_log_bytes,5*GB);assert.deepEqual(v.task_windows,[]);
  });
 });
 assert.equal(arms('S200')[0].visits.at(-1).due_tick,33540);assert.equal(arms('S200')[0].visits.filter(v=>v.fault==='mechanical').length,25);
 assert.equal(arms('T2')[0].visits.filter(v=>v.fault==='mechanical').length,5);
});
test('content: required 2 GB software, a valid installed 0.5 GB map, a 2 GB rollback copy; M requires a new 0.5 GB map',()=>{
 for(const id of PRESET_IDS)both(id,s=>{
  const o=new Map(s.content_objects.map(x=>[x.id,x]));
  for(const v of s.visits){
   const inst=v.installed_object_ids.map(x=>o.get(x)),req=v.required_object_ids.map(x=>o.get(x));
   assert.deepEqual(inst.map(x=>[x.kind,x.size_bytes]).sort(),[['map',GB/2],['software',2*GB]],id);
   const sw=req.find(x=>x.kind==='software'),map=req.find(x=>x.kind==='map');
   assert.equal(sw.size_bytes,2*GB);assert.equal(v.installed_object_ids.includes(sw.id),false,id);
   assert.equal(map.size_bytes,GB/2);assert.equal(v.installed_object_ids.includes(map.id),id!=='M',id);
  }
  for(const x of s.content_objects)assert.deepEqual([x.check_ticks,x.activation_ticks,x.postcheck_ticks],[60,600,60]);
 });
});
const NET={// Mbps: [wan down, wan up, pool per arm, client, cache read], cache state
 D:[200,50,[300,600],100,1000,'off'],DR:[1000,1000,[300,600],100,1000,'off'],W:[200,50,[300,300],100,1000,'off'],S200:[1000,500,[2000],100,1000,'cold'],
};
test('site, network, services and vendor follow D12-01 unless a preset overrides them',()=>{
 for(const id of PRESET_IDS)both(id,(s,i)=>{
  const [down,up,pool,client,read,state]=NET[id]??[200,100,[300],100,1000,'cold'];
  assert.deepEqual([s.network.wan_down_bytes_per_tick,s.network.wan_up_bytes_per_tick,s.network.pool_bytes_per_tick,s.network.client_bytes_per_tick,s.network.cache_read_bytes_per_tick],[down*MBPS,up*MBPS,pool[Math.min(i,pool.length-1)]*MBPS,client*MBPS,read*MBPS],id);
  assert.deepEqual(s.network.covered_zones,['charging','cleaning','garage','waiting']);assert.equal(s.network.cache.state,state,id);assert.deepEqual(s.network.cache.initial_object_ids,[]);
  if(state==='cold')assert.equal(s.network.cache.capacity_bytes,20*GB);
  assert.equal(s.site.lane_count,id==='S200'?3:1);assert.equal(s.site.supply_w,id==='P'?100000:id==='S200'?1000000:300000,id);assert.equal(s.site.background_w,0);
  assert.equal(s.site.garage_level,i===1&&id==='G'?'none':i===1&&id==='GN'?'specialist':'basic',id);
  const maps=i===1&&id==='M'?'unreachable':'reachable';
  assert.deepEqual(s.services,{maps:{service_reachable:maps,entitlement:'valid'},software:{service_reachable:'reachable',entitlement:'valid'},uploads:{service_reachable:'reachable',entitlement:'valid'}},id);
  assert.deepEqual(s.vendor,{enabled:true,bay_count:1,worker_count:1,outbound_ticks:1800,service_ticks:7200,return_ticks:1800,traction_energy_mj:0,availability:[{start_tick:0,end_tick:H}]},id);
  assert.equal(s.task_windows.cabin_earliest_start_tick,id==='W'?3600:0,id);
 });
});
const ROSTER={S200:{cleaner:4,technician:4,mover:6,lead:4}};
test('workers: D12-01 roles C01/T01/M01/L01 independent and practiced on listed tasks, shifts [0, H); S200 6/4/4/4',()=>{
 const listed={cleaner:['cabin'],technician:['diagnosis','mechanical_repair'],mover:['move','connect','unplug'],lead:['intake','inspection']};
 for(const id of PRESET_IDS)both(id,(s,i)=>{
  const counts={cleaner:0,technician:0,mover:0,lead:0,none:0};
  for(const w of s.workers){
   counts[roleOf(w)]++;assert.deepEqual(w.availability,[{start_tick:0,end_tick:H}],id);
   const role=roleOf(w);if(role==='none')continue;
   for(const q of w.qualifications){const on=listed[role].includes(q.task_class);
    if(on){assert.equal(q.may_supervise,true);if(!(id==='TP'&&i===1))assert.equal(q.proficiency,'practiced');}
    else assert.deepEqual([q.level,q.may_supervise],['unqualified',false],`${id} ${w.id} ${q.task_class}`);}
  }
  const want=ROSTER[id]??{cleaner:1,technician:(id==='T2'||id==='ST')&&i===1?2:1,mover:1,lead:1};
  assert.deepEqual(counts,{...want,none:id==='TN'?1:0},`${id} arm ${i}`);
  if(!ROSTER[id])for(const [x,r]of [['C01','cleaner'],['T01','technician'],['M01','mover'],['L01','lead']])assert.equal(roleOf(s.workers.find(w=>w.id===x)),r,id);
 });
 const lead=arms('B')[0].workers.find(w=>w.id==='L01');assert.deepEqual(['intake','inspection'].map(c=>lead.qualifications.find(q=>q.task_class===c).solo_duration_ticks),[120,300]);
});

// ---------- treatments: every pair differs only on its declared authoritative pointers (C1.2) ----------
const AUTH=['/site/positions','/site/ports','/site/garage_level','/services/maps','/services/software','/services/uploads','/network/generation','/network/pool_bytes_per_tick','/network/client_bytes_per_tick','/workers','/site/supply_w','/network/wan_down_bytes_per_tick','/network/wan_up_bytes_per_tick','/site/lane_count','/network/cache'];
const DECLARED={B:['/site/positions','/site/ports'],P:['/site/ports'],PS:['/site/ports'],D:['/network/pool_bytes_per_tick'],DR:['/network/pool_bytes_per_tick'],M:['/services/maps'],T2:['/workers'],W:['/site/positions'],G:['/site/garage_level'],GN:['/site/garage_level'],TP:['/workers'],TN:['/workers'],ST:['/workers']};
const getP=(s,p)=>p.split('/').slice(1).reduce((o,k)=>o[k],s);
const mask=s=>{const c=JSON.parse(jcs(s));for(const p of AUTH){const k=p.split('/').slice(1);k.slice(0,-1).reduce((o,x)=>o[x],c)[k.at(-1)]=null;}return jcs(c);};
test('each pair changes exactly its declared authoritative fields and nothing else',()=>{
 for(const [id,want]of Object.entries(DECLARED)){
  const [b,c]=arms(id);assert.equal(mask(b),mask(c),`${id}: an undeclared field differs`);
  assert.deepEqual(AUTH.filter(p=>jcs(getP(b,p))!==jcs(getP(c,p))),want,id);
 }
});
test('treatment detail: rezoned DC port, added DC port, flex waiting, identical technician, proficiency rows, pool, maps, garage',()=>{
 const byId=a=>new Map(a.map(x=>[x.id,x]));
 {const [b,c]=arms('B'),pb=byId(b.site.positions),moved=c.site.positions.filter(p=>pb.get(p.id).zone!==p.zone);
  assert.deepEqual(c.site.positions.map(p=>p.id),b.site.positions.map(p=>p.id),'B keeps the same 24 positions');
  assert.deepEqual(moved.map(p=>[pb.get(p.id).zone,p.zone]),[['waiting','charging']]);
  const added=c.site.ports.filter(p=>!b.site.ports.some(q=>q.id===p.id));assert.equal(added.length,1);assert.deepEqual([added[0].kind,added[0].position_id],['DC',moved[0].id]);
  assert.deepEqual(c.site.ports.filter(p=>p!==added[0]),b.site.ports);}
 for(const id of ['P','PS']){const [b,c]=arms(id),added=c.site.ports.filter(p=>!b.site.ports.some(q=>q.id===p.id));
  assert.equal(added.length,1);assert.equal(added[0].kind,'DC');assert.ok(b.site.positions.some(p=>p.id===added[0].position_id&&p.zone==='charging'));assert.equal(b.site.ports.some(p=>p.position_id===added[0].position_id),false);}
 {const [b,c]=arms('W'),extra=c.site.positions.filter(p=>!b.site.positions.some(q=>q.id===p.id));
  assert.equal(extra.length,7);assert.ok(extra.every(p=>p.zone==='waiting'&&p.enabled));for(const p of b.site.positions)assert.deepEqual(c.site.positions.find(q=>q.id===p.id),p);}
 for(const id of ['T2','ST']){const [b,c]=arms(id),extra=c.workers.filter(w=>!b.workers.some(x=>x.id===w.id));
  assert.equal(extra.length,1);const t01=b.workers.find(w=>w.id==='T01');assert.deepEqual([extra[0].qualifications,extra[0].availability],[t01.qualifications,t01.availability],`${id}: identical second technician`);}
 const cabin=(s,w)=>s.workers.find(x=>x.id===w).qualifications.find(q=>q.task_class==='cabin');
 {const [b,c]=arms('TP');assert.deepEqual([cabin(b,'C01').solo_duration_ticks,cabin(c,'C01').solo_duration_ticks],[600,480]);assert.deepEqual([cabin(c,'C01').level,cabin(c,'C01').proficiency],['independent','advanced']);
  assert.deepEqual(c.workers.find(w=>w.id==='C01').qualifications.filter(q=>q.task_class!=='cabin'),b.workers.find(w=>w.id==='C01').qualifications.filter(q=>q.task_class!=='cabin'));}
 {const [b,c]=arms('TN');assert.deepEqual([cabin(b,'C01').level,cabin(b,'C01').solo_duration_ticks],['independent',600]);
  assert.deepEqual([cabin(b,'C02').level,cabin(b,'C02').proficiency,cabin(b,'C02').solo_duration_ticks],['unqualified','advanced',480]);
  assert.deepEqual([cabin(c,'C02').level,cabin(c,'C02').proficiency,cabin(c,'C02').solo_duration_ticks,cabin(c,'C02').may_supervise],['supervised_only','advanced',480,false]);}
 for(const id of ['D','DR'])assert.deepEqual(arms(id).map(s=>s.network.pool_bytes_per_tick),[300*MBPS,600*MBPS]);
 assert.deepEqual(arms('M').map(s=>s.services.maps),[{service_reachable:'reachable',entitlement:'valid'},{service_reachable:'unreachable',entitlement:'valid'}]);
 assert.deepEqual(arms('G').map(s=>s.site.garage_level),['basic','none']);assert.deepEqual(arms('GN').map(s=>s.site.garage_level),['basic','specialist']);
});

// ---------- configuration bounds recomputed from compiled catalogs (D12-04 CB tables) ----------
const stats=s=>{
 const c=compileScenario(s),tasks=c.visits.flatMap(v=>v.tasks),count=t=>tasks.filter(x=>x.template===t).length;
 const N=c.visits.length,Qn=c.visits.filter(v=>v.charge).length,R=c.visits.filter(v=>v.route==='onsite').length,V=c.visits.filter(v=>v.route==='vendor').length;
 const lanes=120*tasks.filter(t=>t.cls==='MV').length,cab=dur(s,'cabin');
 const hold=v=>120+dur(s,'connect')+Number(uncontendedChargeTicks(v.visit.initial_soc_pct,s.requirements.energy.target_soc_pct,BANDS,150000))+v.tasks.filter(t=>/_(activation|postcheck)$/.test(t.template)).reduce((a,t)=>a+t.timed,0)+dur(s,'inspection')+dur(s,'unplug');
 const holds=c.visits.filter(v=>v.charge).map(hold),port=holds.reduce((a,b)=>a+b,0);
 return {c,tasks,N,Q:Qn,R,V,holds,
  people:[lanes,lanes+count('connect')*dur(s,'connect')+count('unplug')*dur(s,'unplug'),count('cabin')*cab,count('intake')*dur(s,'intake')+count('inspection')*dur(s,'inspection'),count('diagnosis')*(dur(s,'diagnosis')??0)+count('repair')*(dur(s,'mechanical_repair')??0)],
  positions:[count('cabin')*(240+cab)+300*c.visits.filter(v=>v.terminalZone==='cleaning').length,R*(120+1200+3600+120),360*N+240*V],
  port,charging:port+120*Qn,energy:c.visits.reduce((a,v)=>a+v.need_mj,0n),cleaningTerminal:c.visits.filter(v=>v.terminalZone==='cleaning').length};
};
const PEOPLE={// lanes, movers, cleaners, leads, technicians demand in seconds; one row means both arms
 B:[11880,17640,14400,10080,14400],P:[11880,17640,14400,10080,14400],PS:[11880,17640,14400,10080,14400],D:[9000,9000,14400,10080,14400],DR:[9000,9000,14400,10080,14400],
 M:[11880,17640,14400,10080,14400],T2:[12120,17880,14400,10080,24000],S200:[99000,147000,120000,84000,120000],W:[8640,8640,14400,10080,0],
 G:[[11880,17640,14400,10080,14400],[12240,18000,14400,10080,0]],GN:[11880,17640,14400,10080,14400],TP:[[8640,8640,14400,10080,0],[8640,8640,11520,10080,0]],TN:[8640,8640,14400,10080,0],ST:[11880,17640,14400,10080,14400],
};
const POSITIONS={// minimum cleaning, garage and waiting position-seconds
 B:[20160,15120,8640],P:[20160,15120,8640],PS:[20160,15120,8640],D:[27360,15120,8640],DR:[27360,15120,8640],M:[20160,15120,8640],T2:[20160,25200,8640],
 S200:[168000,126000,72000],W:[27360,0,8640],G:[[20160,15120,8640],[20160,0,9360]],GN:[20160,15120,8640],TP:[[27360,0,8640],[24480,0,8640]],TN:[27360,0,8640],ST:[20160,15120,8640],
};
const PORT={B:[69696,72576],P:[69696,72576],PS:[69696,72576],M:[85536,88416],T2:[69696,72576],S200:[580800,604800],G:[69696,72576],GN:[69696,72576],ST:[69696,72576]};// DC reference port-s and charging position-s
const ENERGY={B:864,P:864,PS:864,M:864,T2:864,G:864,GN:864,ST:864,S200:7200};
test('CB lanes and worker attention demand: lane-s 120(3N+Q+R+2V), mover-s +240Q, cleaner Nc, lead 420N, technician 4,800R',()=>{
 for(const id of PRESET_IDS)both(id,(s,i)=>{const t=stats(s);assert.deepEqual(t.people,pick(PEOPLE[id],i),`${id} arm ${i}`);assert.equal(t.people[0],120*(3*t.N+t.Q+t.R+2*t.V));});
});
test('CB position minima: cleaning N(120+c+120)+300(N-Q), garage 5,040R, waiting 360N+240V',()=>{
 for(const id of PRESET_IDS)both(id,(s,i)=>{const t=stats(s);assert.deepEqual(t.positions,pick(POSITIONS[id],i),`${id} arm ${i}`);assert.equal(t.cleaningTerminal,t.N-t.Q,id);});
});
test('CB ports and site power: 2,904 s DC reference hold (3,564 with a required map), demand, charging-position minima and energy',()=>{
 for(const id of PRESET_IDS)both(id,(s,i)=>{
  const t=stats(s);if(id==='M'&&i===1)return;// unreachable map: no finite completed hold sequence
  const [port,charging]=PORT[id]??[0,0];assert.equal(t.port,port,id);assert.equal(t.charging,charging,id);
  assert.ok(t.holds.every(h=>h===(id==='M'?3564:2904)),id);assert.equal(t.energy,BigInt(ENERGY[id]??0)*3600000000n,id);
 });
 assert.equal(13102-2904,10198,'each AC session adds 10,198 port-s');
});
test('CB zero-start session ceilings from port inventories: B 16 to 23 / 34 to 48, P 0 / 28 to 42, M 14 / 30, S200 48 / 168 and 156 physical',()=>{
 const ceil=(s,dcHold,acHold)=>[s.arrival_window_tick,H].map(T=>s.site.ports.reduce((a,p)=>a+Math.floor(T/(p.kind==='DC'?dcHold:acHold)),0));
 const ac=Number(uncontendedChargeTicks(20,80,BANDS,11000,11000))+1320;assert.equal(ac,13102);
 const want={B:[[16,34],[23,48]],P:[[0,28],[0,42]],PS:[[0,28],[0,42]],T2:[[16,34]],G:[[16,34]],GN:[[16,34]],ST:[[16,34]],S200:[[48,168]]};
 for(const [id,rows]of Object.entries(want))both(id,(s,i)=>assert.deepEqual(ceil(s,2904,ac),pick(rows,i),`${id} arm ${i}`));
 assert.deepEqual(ceil(arms('M')[0],3564,ac+660),[14,30]);
 const setup=120+120+120+600;assert.equal(setup,960);assert.equal(12*Math.floor((H-setup)/(2904+120)),156);assert.equal(200*2904,580800);assert.equal(12*H,518400);
});
test('CB site energy envelopes and acceptance sums are exact',()=>{
 const env=s=>[s.arrival_window_tick,H].map(T=>formatRational(Q(BigInt(s.site.supply_w)*BigInt(T),3600000n)));
 const want={B:['1800/1','3600/1'],P:['40/1','1200/1'],PS:['120/1','3600/1'],D:['1/12','3600/1'],S200:['10000/3','12000/1'],M:['1800/1','3600/1']};
 for(const [id,w]of Object.entries(want))both(id,s=>assert.deepEqual(env(s),w,id));
 const accept=s=>s.site.ports.reduce((a,p)=>a+Math.min(p.rating_w,p.kind==='DC'?100000:11000),0)/1000;
 assert.deepEqual(arms('B').map(accept),[222,322]);assert.deepEqual(arms('PS').map(accept),[200,300]);assert.equal(accept(arms('S200')[0]),1200);
});
const DEMAND={// decimal GB: [WAN down required, WAN up required, WAN up optional, pool required, pool optional, client required, client optional, cache read]
 'Standard-24':['2','0','120','48','120','2','5','48'],'Required-data-24':['48','120','0','168','0','7','0','0'],'Required-map-24':['5/2','0','120','60','120','5/2','5','60'],'Standard-200':['2','0','1000','400','1000','2','5','400'],
};
const PROFILE={B:'Standard-24',T2:'Standard-24',G:'Standard-24',GN:'Standard-24',ST:'Standard-24',P:'Standard-24',PS:'Standard-24',D:'Required-data-24',DR:'Required-data-24',M:'Required-map-24',S200:'Standard-200',W:'Required-data-24',TP:'Standard-24',TN:'Standard-24'};
test('CB network demand profiles from compiled data tasks (single cold fetch, cache-served copies, uploads)',()=>{
 const g=b=>{const r=formatRational(Q(BigInt(b),BigInt(GB)));return r.endsWith('/1')?r.slice(0,-2):r;};
 for(const id of PRESET_IDS)both(id,s=>{
  const {c,tasks}=stats(s),data=tasks.filter(t=>t.kind==='data'),sum=f=>data.filter(f).reduce((a,t)=>a+t.data.bytes,0);
  const down=t=>t.data.direction==='down',up=t=>t.data.direction==='up';
  const fetch=c.cacheTasks.filter(t=>t.data).reduce((a,t)=>a+t.data.bytes,0);
  const v0=c.visits[0].tasks.filter(t=>t.kind==='data'),vs=f=>v0.filter(f).reduce((a,t)=>a+t.data.bytes,0);
  const got=[fetch+sum(t=>down(t)&&!t.data.cacheRoute),sum(t=>up(t)&&t.mandatory),sum(t=>up(t)&&!t.mandatory),sum(t=>down(t)||up(t)&&t.mandatory),sum(t=>up(t)&&!t.mandatory),vs(t=>down(t)||t.mandatory),vs(t=>!t.mandatory),sum(t=>down(t)&&t.data.cacheRoute)].map(g);
  assert.deepEqual(got,DEMAND[PROFILE[id]],id);
  assert.ok(data.every(t=>t.mandatory===(down(t)||UPLOAD.has(id))),id);
 });
});
const CAPACITY={// decimal GB over [A, H]: WAN down, WAN up, pool per arm, client, cache read (null when the cache is off)
 'Default-window':[['540','1080'],['270','540'],[['810','1620']],['270','540'],['2700','5400']],
 'Power-window':[['36','1080'],['18','540'],[['54','1620']],['18','540'],['180','5400']],
 'WAN-limited':[['1/40','1080'],['1/160','270'],[['3/80','1620'],['3/40','3240']],['1/80','540'],null],
 'Radio-case':[['1/8','5400'],['1/8','5400'],[['3/80','1620'],['3/40','3240']],['1/80','540'],null],
 'Scale-window':[['1500','5400'],['750','2700'],[['3000','10800']],['150','540'],['1500','5400']],
 'Bunched-training':[['1/40','1080'],['1/80','540'],[['3/80','1620']],['1/80','540'],['1/8','5400']],
};
const CAP_OF={B:'Default-window',T2:'Default-window',G:'Default-window',GN:'Default-window',ST:'Default-window',M:'Default-window',P:'Power-window',PS:'Power-window',D:'WAN-limited',W:'WAN-limited',DR:'Radio-case',S200:'Scale-window',TP:'Bunched-training',TN:'Bunched-training'};
test('CB two-window network capacities follow from preset rates (W keeps the left pool in both arms)',()=>{
 const g=(rate,T)=>{const r=formatRational(Q(BigInt(rate)*BigInt(T),BigInt(GB)));return r.endsWith('/1')?r.slice(0,-2):r;};
 for(const id of PRESET_IDS)both(id,(s,i)=>{
  const [down,up,pool,client,read]=CAPACITY[CAP_OF[id]],n=s.network,win=r=>[g(r,s.arrival_window_tick),g(r,H)];
  assert.deepEqual(win(n.wan_down_bytes_per_tick),down,id);assert.deepEqual(win(n.wan_up_bytes_per_tick),up,id);
  assert.deepEqual(win(n.pool_bytes_per_tick),pool[id==='W'?0:Math.min(i,pool.length-1)],`${id} arm ${i}`);assert.deepEqual(win(n.client_bytes_per_tick),client,id);
  if(read)assert.deepEqual(win(n.cache_read_bytes_per_tick),read,id);else assert.equal(n.cache.state,'off',id);
 });
});
test('CB stock bounds: 9.5 GB declared per-vehicle residency (10 GB in M) against 50 GB; cache stock 2 / 2.5 / 0 against 20 GB',()=>{
 for(const id of PRESET_IDS)both(id,s=>{
  const {c}=stats(s),o=new Map(s.content_objects.map(x=>[x.id,x]));
  for(const v of c.visits){const res=v.visit.installed_object_ids.reduce((a,x)=>a+o.get(x).size_bytes,0)+v.visit.initial_log_bytes+v.tasks.filter(t=>t.kind==='data'&&t.data.direction==='down').reduce((a,t)=>a+t.data.bytes,0);
   assert.equal(res,id==='M'?10*GB:9.5*GB,id);assert.ok(res<=s.vehicle_profile.storage_capacity_bytes);}
  const stock=c.cacheTasks.filter(t=>t.data).reduce((a,t)=>a+t.data.bytes,0);
  assert.equal(stock,UPLOAD.has(id)?0:id==='M'?2.5*GB:2*GB,id);if(stock)assert.ok(stock<=s.network.cache.capacity_bytes);
 });
});
test('G vendor arm: three 7,200 s services and 10,800 transit seconds; GN adds no specialist task; W holds every cabin until 3,600',()=>{
 const g=stats(arms('G')[1]),svc=g.tasks.filter(t=>t.template==='vendor_service'),transit=g.tasks.filter(t=>t.kind==='transit');
 assert.equal(svc.length,3);assert.equal(svc.reduce((a,t)=>a+t.timed,0),21600);assert.equal(transit.reduce((a,t)=>a+t.timed,0),10800);
 for(const v of g.c.visits.filter(v=>v.route==='vendor'))assert.equal(v.tasks.filter(t=>t.kind==='transit'||t.kind==='vendor').reduce((a,t)=>a+t.timed,0),10800);
 assert.equal(stats(arms('G')[0]).V,0);
 const [gb,gc]=arms('GN').map(s=>stats(s).tasks.map(t=>[t.id,t.attention]));assert.deepEqual(gb,gc,'GN is a structural null');
 for(const s of arms('W'))for(const v of stats(s).c.visits)for(const t of v.tasks.filter(t=>t.template==='cabin'||t.template==='to_cleaning'))assert.equal(t.earliestStart,3600);
 for(const s of arms('W'))assert.equal(stats(s).Q,0);
});
