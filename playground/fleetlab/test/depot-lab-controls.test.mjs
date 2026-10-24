// Depot lab setup controls (engineering note 13, 16, 19; annex C1.2, Q8, Q24) over the real session with a fake worker
// that counts starts: every family edit reaches the intended draft path and arm, shared requirements reach both arms,
// refusals keep the draft and carry an associated message, and no control interaction ever starts a run.
import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {installFakeDom} from './helpers/fake-dom.mjs';
import {mountSetup} from '../src/ui/depot-lab-controls.js';
import {createDepotSession} from '../src/runtime/depot-lab-session.js';
import {preset,presetCatalog,PRESET_IDS,worker} from '../src/model/depot-lab/presets.js';
import {copyProblems,literalsOf} from '../tools/check-dist.mjs';
const SOURCE=readFileSync(new URL('../src/ui/depot-lab-controls.js',import.meta.url),'utf8');
const J=v=>JSON.stringify(v);
function setup(id='B'){
 const restore=installFakeDom();
 for(const [tag,key] of [['div','questions'],['select','preset'],['p','preset-regime'],['div','counters'],['div','setup']]){const n=document.createElement(tag);n.setAttribute('id',key);document.body.appendChild(n);}
 let starts=0,ui=null;
 const session=createDepotSession({workerFactory:()=>{starts++;return {postMessage(){},terminate(){}};},onChange:s=>ui?.render(s),preset:id});
 ui=mountSetup({doc:document,session});
 const by=k=>document.getElementById(k),text=k=>by(k).textContent,draft=()=>session.get().draft;
 const card=k=>document.querySelector(`section[aria-labelledby="dlc-${k}"]`);
 // The control a label names, optionally inside one container (a card or a fieldset).
 const control=(label,root=document)=>{const l=root.querySelectorAll('label').find(x=>x.textContent===label);assert.ok(l,`label ${label}`);return by(l.getAttribute('for'));};
 const fire=(n,type='change')=>n.dispatchEvent(new Event(type,{bubbles:true}));
 const commit=(label,value,root)=>{const n=control(label,root);n.value=String(value);fire(n);return n;};
 const tickBox=(label,on,root)=>{const n=control(label,root);n.checked=on;fire(n);return n;};
 const press=(label,root=document)=>{const b=root.querySelectorAll('button').find(x=>x.textContent===label);assert.ok(b,`button ${label}`);b.click();return b;};
 const both=k=>{const r=card(k).querySelectorAll('input[type="radio"]').find(x=>x.value==='both');r.checked=true;fire(r);};
 const message=n=>by(n.getAttribute('aria-describedby'))?.textContent??'';
 return {session,ui,starts:()=>starts,restore,by,text,draft,card,control,commit,tickBox,press,both,message,fire};
}
const run=(id,fn)=>{const x=setup(id);try{fn(x);assert.equal(x.starts(),0,'no worker was created');}finally{x.session.dispose();x.restore();}};
const zone=(a,z)=>a.site.positions.filter(p=>p.zone===z).length;

test('guided questions, all fourteen named setups and an equal Build your own card render idle',()=>run('B',x=>{
 const q=x.text('questions'),cat=presetCatalog();
 for(const s of ['What work is required before this vehicle can leave the depot?','Which resources are occupied, available, incompatible or missing?','Would more space, power, skills or network capacity change the outcome?','How does a local depot decision affect riders, empty travel and the rest of the fleet?','What trade-off did a scheduling policy make, and how strong is the evidence for it?','Not available in this version: no fleet model is included.','Build your own'])assert.ok(q.includes(s),s);
 assert.ok(q.includes(x.draft().baseline.policy_id));
 const buttons=x.by('questions').querySelectorAll('button').map(b=>b.textContent);
 for(const p of cat)assert.ok(buttons.includes(p.title),`question button ${p.id}`);
 const third=x.by('questions').querySelectorAll('section')[2].querySelectorAll('button').map(b=>b.textContent);
 assert.deepEqual(third,['P','PS','D','DR','W','G','GN','TP','TN','ST'].map(id=>cat.find(p=>p.id===id).title));
 for(const b of x.by('questions').querySelectorAll('li button'))assert.match(x.by(b.getAttribute('aria-describedby')).textContent,/^Declared regime: /);
 const options=x.by('preset').querySelectorAll('option').filter(o=>o.value!=='');
 assert.deepEqual(options.map(o=>o.value),PRESET_IDS);assert.equal(options.length,14);
 assert.deepEqual(options.map(o=>o.textContent),cat.map(p=>p.title));
 assert.equal(x.by('preset').value,'B');
 assert.ok(x.text('preset-regime').includes(cat[0].regime));
 assert.equal(x.session.get().status,'draft');
 for(const k of ['space','energy','garage','services','data','staff','training','work'])assert.ok(x.card(k),k);
 assert.ok(x.by('setup').querySelectorAll('.technical-only').length>20);
}));

test('counters and the bundle disclosure for the Power-slack baseline read 1 intervention · 2 authoritative fields',()=>run('B',x=>{
 const c=x.text('counters'),t=x.session.get().compatibility.treatment;
 assert.match(c,/Differences from baseline: 2/);assert.match(c,/Edits since last run: 0/);
 assert.ok(c.includes('1 intervention · 2 authoritative fields'));
 const items=x.by('counters').querySelectorAll('li');
 assert.equal(items.length,t.leaves.length);
 assert.ok(items.some(li=>li.textContent.startsWith('Charging ports, DC03: added')));
 assert.ok(items.some(li=>li.textContent.startsWith('Work positions by zone, P017 zone: waiting to charging')));
 x.press('Build your own setup');
 assert.match(x.text('counters'),/Differences from baseline: 0/);assert.ok(x.text('counters').includes('0 interventions · 0 authoritative fields'));
 assert.match(x.text('counters'),/Edits since last run: 2/);
}));

test('the named-setup select, question buttons and Build your own only load drafts',()=>run('B',x=>{
 const sel=x.by('preset');sel.value='P';x.fire(sel);
 assert.equal(x.session.get().preset,'P');assert.equal(J(x.draft()),J({baseline:preset('P').baseline,candidate:preset('P').candidate}));
 x.press(presetCatalog().find(p=>p.id==='TP').title);
 assert.equal(x.session.get().preset,'TP');assert.equal(sel.value,'TP');
 x.commit('Site charging supply, in kW (diagnostic field)',250,x.card('energy'));
 assert.match(x.text('preset-regime'),/Edited since loading/);
 x.press('Build your own setup');
 const d=x.draft();assert.equal(J(d.baseline),J(preset('B').baseline));assert.equal(J(d.candidate),J(d.baseline));
 assert.equal(sel.value,'');assert.match(x.text('preset-regime'),/^Your own setup/);
 assert.equal(x.session.get().status,'draft');
}));

test('the shared target SOC updates both arms from shortcuts and numeric entry and refuses 19, 101 and fractions',()=>run('B',x=>{
 const label='Target battery SOC for depot release (default 80%)',soc=a=>a.requirements.energy.target_soc_pct;
 const q=v=>x.by('setup').querySelectorAll('.shortcuts button').find(b=>b.textContent===`${v}%`);
 assert.equal(q(80).getAttribute('aria-pressed'),'true');
 x.press('90%');assert.deepEqual([soc(x.draft().baseline),soc(x.draft().candidate)],[90,90]);
 assert.equal(q(90).getAttribute('aria-pressed'),'true');assert.equal(q(80).getAttribute('aria-pressed'),'false');
 const input=x.commit(label,55);assert.deepEqual([soc(x.draft().baseline),soc(x.draft().candidate)],[55,55]);
 assert.equal(input.getAttribute('min'),'20');assert.equal(input.getAttribute('max'),'100');
 // (55 - 20)% of the 60-kWh pack is 21 kWh for each of the 24 default visits (D12-01).
 assert.ok(x.text('setup').includes('Required charging energy: 21 kWh per visit, 504 kWh in total'));
 assert.ok(x.text('setup').includes('Applies to: both setups'));
 const gen=x.session.get().generation;
 for(const bad of ['19','101','80.5','']){
  x.commit(label,bad);
  assert.equal(x.session.get().generation,gen,bad);assert.equal(soc(x.draft().candidate),55);
  assert.equal(input.getAttribute('aria-invalid'),'true');assert.equal(x.message(input),'Enter a whole number from 20 to 100.');
 }
 x.commit(label,100);assert.equal(input.getAttribute('aria-invalid'),null);assert.equal(soc(x.draft().baseline),100);
 assert.ok(x.session.get().compatibility.compatible);
}));

test('space: zone inventory, the total lever from 1 to 200 and refusals that never rezone',()=>run('B',x=>{
 const sp=x.card('space'),base=J(x.draft().baseline);
 x.commit('Work positions by zone: waiting',17,sp);
 assert.equal(zone(x.draft().candidate,'waiting'),17);assert.ok(x.draft().candidate.site.positions.some(p=>p.id==='P025'&&p.zone==='waiting'));
 assert.equal(J(x.draft().baseline),base);
 const total=x.commit('Total positions (derived)',200,sp);
 assert.equal(x.draft().candidate.site.positions.length,200);assert.equal(zone(x.draft().candidate,'waiting'),192);assert.equal(zone(x.draft().candidate,'charging'),5);
 x.commit('Total positions (derived)',1,sp);
 assert.equal(x.draft().candidate.site.positions.length,200);assert.match(x.message(total),/^Only 192 waiting positions can be removed/);
 x.commit('Total positions (derived)',24,sp);assert.equal(zone(x.draft().candidate,'waiting'),16);
 const charging=x.commit('Work positions by zone: charging',0,sp);
 assert.equal(zone(x.draft().candidate,'charging'),5);assert.match(x.message(charging),/^Only 0 charging positions have no charging port/);
 x.tickBox('P001 (waiting) enabled',false,sp);
 assert.equal(x.draft().candidate.site.positions.find(p=>p.id==='P001').enabled,false);assert.equal(J(x.draft().baseline),base);
 for(const id of x.draft().candidate.site.ports.map(p=>p.id))x.press(`Remove ${id}`,x.card('energy'));
 assert.equal(x.draft().candidate.site.ports.length,0);
 for(const z of ['garage','cleaning','charging'])x.commit(`Work positions by zone: ${z}`,0,sp);
 x.commit('Total positions (derived)',1,sp);
 assert.equal(x.draft().candidate.site.positions.length,1);assert.equal(x.draft().candidate.site.positions[0].zone,'waiting');
 assert.equal(J(x.draft().baseline),base);
}));

test('AC/DC: ports, ratings, enabled state and the site supply follow the card arm choice',()=>run('B',x=>{
 const en=x.card('energy'),base=J(x.draft().baseline);
 x.press('Add DC port',en);assert.match(en.textContent,/Every charging position already has a port/);
 x.commit('Work positions by zone: charging',6,x.card('space'));
 x.press('Add DC port',en);
 const added=x.draft().candidate.site.ports.find(p=>p.id==='DC04');
 assert.deepEqual(added,{id:'DC04',position_id:'P025',kind:'DC',rating_w:150000,enabled:true});
 x.commit('DC04 rating, in kW',50,en);assert.equal(x.draft().candidate.site.ports.find(p=>p.id==='DC04').rating_w,50000);
 x.tickBox('DC04 enabled',false,en);assert.equal(x.draft().candidate.site.ports.find(p=>p.id==='DC04').enabled,false);
 x.commit('Site charging supply, in kW (diagnostic field)',120,en);assert.equal(x.draft().candidate.site.supply_w,120000);
 assert.equal(J(x.draft().baseline),base);assert.ok(en.textContent.includes('Applies to: candidate only'));
 x.both('energy');assert.ok(en.textContent.includes('Applies to: both setups'));
 x.commit('Site charging supply, in kW (diagnostic field)',200,en);
 assert.deepEqual([x.draft().baseline.site.supply_w,x.draft().candidate.site.supply_w],[200000,200000]);
}));

test('garage, services and Wi-Fi edits reach their own paths in the candidate only',()=>run('B',x=>{
 const base=J(x.draft().baseline),c=()=>x.draft().candidate;
 x.commit('On-site repair capability','none',x.card('garage'));assert.equal(c().site.garage_level,'none');
 assert.ok(x.card('garage').textContent.includes('It does not remove faults from the work.'));
 assert.match(x.card('garage').textContent,/Specialist adds zero eligible tasks/);
 const maps=x.card('services').querySelectorAll('fieldset').find(f=>f.querySelector('legend').textContent==='Simulated map service access');
 x.commit('Service reachable','unreachable',maps);
 assert.deepEqual(c().services.maps,{service_reachable:'unreachable',entitlement:'valid'});
 x.commit('Service permission','denied',maps);
 assert.deepEqual(c().services.maps,{service_reachable:'unreachable',entitlement:'denied'});
 assert.deepEqual(c().services.uploads,{service_reachable:'reachable',entitlement:'valid'});
 const data=x.card('data');
 x.commit('Wi-Fi generation label','wifi7',data);
 assert.equal(c().network.generation,'wifi7');assert.equal(c().network.pool_bytes_per_tick,300*125000);
 assert.match(data.textContent,/Changing the generation alone changes no assumed capacity here/);
 x.commit('Shared radio capacity (assumed), in Mbps',600,data);assert.equal(c().network.pool_bytes_per_tick,600*125000);
 x.commit('Internet link down, in Mbps (diagnostic field)',1000,data);assert.equal(c().network.wan_down_bytes_per_tick,1000*125000);
 x.commit('Depot content cache (diagnostic field)','warm',data);
 assert.deepEqual(c().network.cache,{state:'warm',capacity_bytes:20000000000,initial_object_ids:['map-v1','sw-v2']});
 for(const s of ['Wi-Fi 6E','Multi-link operation','Access point count','Not available: not modeled in this version.','does not establish usable spectrum, equipment support or permission'])assert.ok(data.textContent.includes(s),s);
 assert.equal(J(x.draft().baseline),base);
 // A schema issue appears next to the control it belongs to: warm objects must fit the cache.
 x.commit('Cache capacity, in GB (diagnostic field)',0,data);
 assert.match(data.textContent,/Candidate setup check: CACHE_CAPACITY at \/network\/cache\/initial_object_ids/);
}));

test('staffing and training: role templates, separate qualification and proficiency, durations from the table',()=>run('B',x=>{
 x.press('Build your own setup');
 x.press('Add technician',x.card('staff'));
 assert.equal(J(x.draft().candidate.workers),J(preset('ST').candidate.workers));
 assert.equal(J(x.draft().baseline.workers),J(preset('ST').baseline.workers));
 x.press('Remove T02',x.card('staff'));assert.equal(J(x.draft().candidate),J(x.draft().baseline));
 const tr=x.card('training'),cabin=()=>x.draft().candidate.workers.find(w=>w.id==='C01').qualifications.find(r=>r.task_class==='cabin');
 assert.match(tr.textContent,/A supervised task uses 2 people for 1 task and adds no simultaneous capacity/);
 x.commit('C01 Cabin reset: Task proficiency','advanced',tr);
 assert.deepEqual(cabin(),worker('C01','cleaner',{cabin:{level:'independent',proficiency:'advanced',may_supervise:true}}).qualifications.find(r=>r.task_class==='cabin'));
 assert.equal(cabin().solo_duration_ticks,480);
 x.commit('C01 Cabin reset: Task qualification','supervised_only',tr);
 assert.deepEqual(cabin(),{task_class:'cabin',level:'supervised_only',proficiency:'advanced',may_supervise:false,solo_duration_ticks:480});
 assert.ok(x.session.get().checks.candidate.ok);
 assert.equal(x.draft().baseline.workers.find(w=>w.id==='C01').qualifications.find(r=>r.task_class==='cabin').solo_duration_ticks,600);
}));

test('workload: 1 and 200 vehicles, spacing, release-by offset, horizon and cabin window update both arms',()=>run('B',x=>{
 const w=x.card('work'),arms=()=>[x.draft().baseline,x.draft().candidate];
 const vehicles=x.commit('Vehicles in the workload, one visit each',200,w);
 assert.equal(x.draft().baseline.visits.length,24);assert.match(x.message(vehicles),/^The last arrival would be at 179,100 s/);
 x.commit('Arrival spacing between visits, in seconds',60,w);
 for(const a of arms())assert.deepEqual(a.visits.map(v=>v.arrival_tick),Array.from({length:24},(_,i)=>60*i));
 x.commit('Vehicles in the workload, one visit each',200,w);
 for(const a of arms()){assert.equal(a.visits.length,200);assert.equal(a.visits[199].id,'200');assert.equal(a.visits[199].arrival_tick,11940);assert.equal(a.visits[199].due_tick,11940+21600);}
 assert.ok(x.session.get().checks.baseline.ok&&x.session.get().checks.candidate.ok);
 x.commit('Vehicles in the workload, one visit each',1,w);for(const a of arms())assert.equal(a.visits.length,1);
 x.commit('Release-by time: offset after arrival, in seconds',3600,w);for(const a of arms())assert.equal(a.visits[0].due_tick,3600);
 x.commit('End of run (H), in seconds',50000,w);for(const a of arms()){assert.equal(a.horizon_tick,50000);assert.ok(a.workers.every(k=>k.availability.at(-1).end_tick===50000));}
 x.commit('Earliest cabin start, in seconds',3600,w);for(const a of arms())assert.equal(a.task_windows.cabin_earliest_start_tick,3600);
 x.commit('Movement lanes (diagnostic field)',2,w);assert.deepEqual(arms().map(a=>a.site.lane_count),[1,2]);
 assert.ok(x.session.get().compatibility.compatible);assert.match(x.text('counters'),/Differences from baseline: 3/);
 for(const s of ['fcfs_eligible_fair_resources_v1','serial_activation_connected_inspection_v1','practiced_reference_v1'])assert.ok(w.textContent.includes(s),s);
}));

test('edits keep each control node and its focus; removing a row moves focus to a stable control',()=>run('B',x=>{
 const sp=x.card('space'),en=x.card('energy'),input=x.control('Work positions by zone: waiting',sp);
 input.focus();input.value='18';x.fire(input);
 assert.equal(zone(x.draft().candidate,'waiting'),18);assert.equal(document.activeElement,input);assert.equal(x.control('Work positions by zone: waiting',sp),input);
 const rating=x.control('DC01 rating, in kW',en);rating.focus();rating.value='100';x.fire(rating);
 assert.equal(x.draft().candidate.site.ports.find(p=>p.id==='DC01').rating_w,100000);assert.equal(document.activeElement,rating);assert.equal(x.control('DC01 rating, in kW',en),rating);
 x.press('Remove DC03',en);
 assert.equal(x.draft().candidate.site.ports.some(p=>p.id==='DC03'),false);assert.equal(document.activeElement.getAttribute('aria-label'),'Charging position for a new port');
}));

test('the controls module source passes the visitor-copy scan',()=>{
 assert.deepEqual(copyProblems(literalsOf(SOURCE).map(text=>({where:'src/ui/depot-lab-controls.js string',text}))),[]);
 assert.doesNotMatch(SOURCE,/aria-live|innerHTML|localStorage|\.run\(/);
});
