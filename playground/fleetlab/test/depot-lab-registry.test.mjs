// Depot lab term registry (annex D1-11, C1.6; note 13, 17, 18): field shape, coverage, exact copy and copy rules.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {copyProblems,literalsOf,labelsFromContracts} from '../tools/check-dist.mjs';
import {TERMS,TERM_FIELDS,TERM_TYPES,CATEGORIES,AVAILABILITY_REASONS,PROVENANCE_ORIGINS,REGISTRY_VERSION,HONESTY,SOURCES,AUTHORITATIVE_POINTERS,term,termsByCategory} from '../src/model/depot-lab/registry.js';
import {METRIC_VERSION,REASON_CODES,DATA_STATES} from '../src/model/depot-lab/profiles.js';
import {FLOW_TRUST} from '../src/model/depot-flow-contract.js';

const SOURCE_TEXT=readFileSync(new URL('../src/model/depot-lab/registry.js',import.meta.url),'utf8');
const WHERE='src/model/depot-lab/registry.js string';
const LABELS=labelsFromContracts(fileURLToPath(new URL('../../../',import.meta.url)));
const enc=s=>[...new TextEncoder().encode(s)];
const strings=v=>typeof v==='string'?[v]:v&&typeof v==='object'?Object.values(v).flatMap(strings):[];
const nonEmpty=s=>typeof s==='string'&&s.length>0;
const nullOr=(v,ok)=>v===null||ok(v);
const LEDGER_KINDS=['ARRIVAL','SHIFT_CHANGE','WINDOW_OPEN','TASK_TRANSITION','RESOURCE_DELTA','ALLOCATION_DELTA','PROGRESS','CONTENT_TRANSITION','OBSERVATION','POLICY_DECISION','BLOCKAGE','HORIZON'];
const ids=prefix=>TERMS.filter(t=>t.term_id.startsWith(prefix)).map(t=>t.term_id.slice(prefix.length));

test('every row carries the complete D1-11 record shape with the right types',()=>{
 const required=['term_id','version','label_plain','label_technical','definition','prohibited_conflations','type','unit','exact_representation','display_rule','object','time','population','denominator','formula','source','availability_reason','evidence','companions','provenance','category'];
 for(const f of required)assert.ok(TERM_FIELDS.includes(f),f);
 assert.ok(TERMS.length>=200);
 for(const t of TERMS){
  const at=t.term_id;
  assert.deepEqual(Object.keys(t),[...TERM_FIELDS],at);
  assert.match(t.term_id,/^[A-Za-z0-9_.:]+$/,at);
  assert.ok([REGISTRY_VERSION,METRIC_VERSION].includes(t.version),at);
  for(const f of ['label_plain','label_technical','definition','exact_representation','display_rule','object','time','source'])assert.ok(nonEmpty(t[f]),`${at} ${f}`);
  for(const f of ['unit','population','denominator','formula'])assert.ok(nullOr(t[f],nonEmpty),`${at} ${f}`);
  for(const f of ['prohibited_conflations','evidence','companions'])assert.ok(Array.isArray(t[f])&&t[f].every(nonEmpty),`${at} ${f}`);
  assert.ok(TERM_TYPES.includes(t.type),at);
  assert.ok(nullOr(t.availability_reason,r=>AVAILABILITY_REASONS.includes(r)),at);
  assert.deepEqual(Object.keys(t.provenance),['kind','origin'],at);
  assert.ok(['ASSUMPTION','COMPUTED','NOT_AVAILABLE'].includes(t.provenance.kind),at);
  assert.ok(t.provenance.origin.length>0&&t.provenance.origin.every(o=>PROVENANCE_ORIGINS.includes(o)),at);
  assert.ok(CATEGORIES.includes(t.category),at);
  assert.ok(nullOr(t.pointer,p=>typeof p==='string'&&p.startsWith('/')),at);
  assert.ok([null,'family','diagnostic'].includes(t.treatment),at);
  assert.ok([null,'up','down'].includes(t.direction),at);
  assert.ok(nullOr(t.value,nonEmpty),at);
  for(const e of t.evidence)assert.ok(LEDGER_KINDS.includes(e)||/^(projection|envelope|comparison|session)\./.test(e),`${at} evidence ${e}`);
  for(const c of t.companions)assert.ok(term(c),`${at} companion ${c}`);
  assert.ok(Object.isFrozen(t)&&Object.isFrozen(t.provenance)&&Object.isFrozen(t.evidence),at);
 }
 assert.ok(Object.isFrozen(TERMS));
});

test('ids are unique and lookups are exact',()=>{
 assert.equal(new Set(TERMS.map(t=>t.term_id)).size,TERMS.length);
 assert.equal(term('no.such.term'),null);
 assert.equal(term('requirement.energy.target_soc_pct'),TERMS.find(t=>t.term_id==='requirement.energy.target_soc_pct'));
 const by=termsByCategory();
 assert.deepEqual(Object.keys(by),[...CATEGORIES]);
 assert.equal(Object.values(by).reduce((n,a)=>n+a.length,0),TERMS.length);
 for(const [c,list] of Object.entries(by))for(const t of list)assert.equal(t.category,c);
});

test('evidence categories and provenance stay consistent; this model has no observed rows',()=>{
 assert.deepEqual([...CATEGORIES],['OBSERVED','COMPUTED','GATE_DECISION','ASSUMPTION','NOT_AVAILABLE','AUTHENTICITY','RESIDUAL_RISK']);
 assert.deepEqual([...AVAILABILITY_REASONS],['missing','not_modeled','incompatible','invalid','not_applicable']);
 assert.equal(termsByCategory().OBSERVED.length,0);
 for(const t of TERMS){
  if(t.category==='ASSUMPTION')assert.equal(t.provenance.kind,'ASSUMPTION',t.term_id);
  if(t.category==='COMPUTED')assert.equal(t.provenance.kind,'COMPUTED',t.term_id);
  assert.equal(t.provenance.kind==='NOT_AVAILABLE',t.availability_reason!==null,t.term_id);
  if(t.category==='NOT_AVAILABLE')assert.notEqual(t.availability_reason,null,t.term_id);
 }
});

test('the shared target SOC row is exact',()=>{
 const t=term('requirement.energy.target_soc_pct');
 assert.equal(t.label_plain,'Target battery SOC for depot release (default 80%)');
 assert.equal(t.label_technical,'requirement.energy.target_soc_pct');
 assert.equal(t.pointer,'/requirements/energy/target_soc_pct');
 assert.equal(t.type,'integer');assert.equal(t.unit,'%');
 assert.equal(t.category,'ASSUMPTION');
 assert.deepEqual(t.provenance,{kind:'ASSUMPTION',origin:['default','user','imported']});
 assert.match(t.formula,/20 to 100, default 80/);
 assert.match(t.formula,/2,160,000,000/);
 assert.equal(t.object,'scenario');assert.equal(t.treatment,null);
 for(const p of ['dispatch authorization','mission eligibility','road-safety readiness'])assert.ok(t.prohibited_conflations.some(x=>x.includes(p)),p);
 for(const c of ['visit.initial_soc_pct','vehicle.pack_capacity_mj','energy.required_charge_mj','charge.acceptance_band','requirement.shared_across_arms'])assert.ok(t.companions.includes(c),c);
 assert.match(t.definition,/not that a fleet mission was assigned or approved/);
});

test('C1.2 authoritative treatment paths are registered in table order',()=>{
 const family=['/site/positions','/site/ports','/site/garage_level','/services/maps','/services/software','/services/uploads','/network/generation','/network/pool_bytes_per_tick','/network/client_bytes_per_tick','/workers'];
 const diagnostic=['/site/supply_w','/network/wan_down_bytes_per_tick','/network/wan_up_bytes_per_tick','/site/lane_count','/network/cache'];
 assert.deepEqual([...AUTHORITATIVE_POINTERS],[...family,...diagnostic]);
 for(const p of family)assert.equal(TERMS.find(t=>t.pointer===p).treatment,'family',p);
 for(const p of diagnostic)assert.equal(TERMS.find(t=>t.pointer===p).treatment,'diagnostic',p);
 for(const t of TERMS.filter(x=>x.treatment))assert.equal(t.category,'ASSUMPTION');
 for(const p of ['/policy_id','/overlap_profile','/reference_effort_version','/vehicle_profile','/horizon_tick','/arrival_window_tick','/task_windows/cabin_earliest_start_tick','/site/background_w','/network/covered_zones','/content_objects','/vendor/traction_energy_mj'])assert.ok(TERMS.some(t=>t.pointer===p&&t.treatment===null),p);
 for(const id of ['profile.policy','profile.overlap','profile.reference_effort','vehicle.profile'])assert.deepEqual(term(id).provenance,{kind:'ASSUMPTION',origin:['profile']},id);
});

test('deferred depth is registered as not modeled, never as a control',()=>{
 for(const id of ['wifi_6e','mlo','ap_count','status_reporting','dynamic_faults','retries','mission_eligibility','policy_comparison']){
  const t=term('deferred.'+id);
  assert.ok(t,id);
  assert.equal(t.category,'NOT_AVAILABLE');assert.equal(t.availability_reason,'not_modeled');
  assert.equal(t.type,'none');assert.equal(t.pointer,null);assert.equal(t.treatment,null);
 }
});

test('every note-18 metric key and vector component id resolves',()=>{
 const metrics=['requirement.energy.target_soc_pct','release.on_time_count','release.due_count','release.unfinished_due_count','release.released_count','release.unreleased_count','visit.work_complete_count','visit.censored_count','visit.overdue_s','visit.turnaround_observed_s','work.remaining_reference_seconds','energy.remaining_required_mj','data.remaining_required_bytes','data.optional_unfinished_bytes','charge.energy_credited_mj','charge.peak_site_draw_w','network.useful_bytes_down','network.useful_bytes_up','resource.attention_fraction','wait.reason_seconds'];
 for(const id of metrics){assert.ok(term(id),id);if(id!=='requirement.energy.target_soc_pct')assert.equal(term(id).version,METRIC_VERSION,id);}
 assert.equal(METRIC_VERSION,'depot_metrics_v1');
 for(const id of ['charge.peak_site_draw_w','resource.attention_fraction'])assert.equal(term(id).type,'rational',id);
 assert.equal(term('work.remaining_reference_seconds').type,'object');
 // C1.6 practiced_reference_v1 classes with positive reference effort, sorted by class id.
 const classes=['activation','cabin','check','connect','diagnosis','inspection','intake','mechanical_repair','move','postcheck','specialist_repair','unplug'];
 const vector=[['on_time_count','up'],['overdue_seconds','down'],['observed_visit_seconds','down'],['unreleased_count','down'],...classes.map(c=>['remaining_reference_seconds:'+c,'down']),['remaining_required_kWh','down'],['remaining_required_bytes','down']];
 const registered=TERMS.filter(t=>t.direction!==null);
 assert.deepEqual(registered.map(t=>[t.term_id,t.direction]),vector);
 for(const t of registered){assert.equal(t.version,METRIC_VERSION);assert.ok(t.companions.length>0,t.term_id);}
 assert.equal(term('remaining_required_kWh').unit,'mJ');
 assert.equal(term('remaining_reference_seconds:cabin').type,'rational');
});

test('the fourteen reason codes resolve with plain explanations',()=>{
 const codes=['PREREQUISITE','HELD_UNITS','ABSENT_INCOMPATIBLE_UNQUALIFIED','DIVISIBLE_CAPACITY_TIGHT','INSUFFICIENT_SHIFT','UNREACHABLE_SERVICE','DENIED_ENTITLEMENT','UNKNOWN_MANDATORY_STATE','SCHEDULED_WINDOW','FULL_STOCK_CACHE','STATIC_OUT_OF_SERVICE','OVERLAP_EXCLUSION','FINISHED_BUT_BLOCKED','DECLARED_RULE_DEFERRAL'];
 assert.deepEqual([...REASON_CODES],codes);
 assert.deepEqual(TERMS.filter(t=>t.term_id.startsWith('reason.')&&t.value!==null).map(t=>t.value),codes);
 for(const c of codes){const t=term('reason.'+c);assert.equal(t.value,c);assert.equal(t.category,'COMPUTED');assert.ok(t.label_plain!==c&&t.definition.length>10,c);assert.ok(t.prohibited_conflations.includes('a causal share of delay'),c);}
 assert.match(term('reason.primary').definition,/not a causal share/);
});

test('states, run states, trust states and comparison values are complete',()=>{
 assert.deepEqual(ids('port.partition.'),['unavailable','free','unconnected_position_blocked','reserved_inbound_connect','connected_drawing','connected_zero_draw','at_target_lifecycle_running','at_target_waiting','inspection','unplug_handling']);
 assert.deepEqual(ids('position.partition.'),['unavailable','free','inbound_exit_handling','zone_native_service_active','retained_other_work','inspection','finished_but_blocked','waiting_no_progress']);
 assert.ok(term('position.port_released_position_held_s'));
 assert.deepEqual(ids('visit.state.').sort(),['blocked_waiting','moving','offsite','queued_outside','released','servicing','work_complete_not_released']);
 assert.deepEqual(ids('visit.due_status.'),['past_due','not_yet_due','no_due']);
 assert.deepEqual(ids('data.state.'),['received_provisional','object_complete','durable_acknowledged','reclaimed']);
 assert.deepEqual(ids('data.state.'),[...DATA_STATES]);
 for(const s of DATA_STATES)assert.ok(term('data.state.'+s).prohibited_conflations.includes('committed'));
 assert.deepEqual(ids('task.state.'),['UNREADY','READY','RUNNING','PAUSED','COMPLETE','CANCELLED']);
 assert.deepEqual(ids('blockage.'),['STALL','TERMINAL_BLOCKAGE_BEFORE_H','DEADLOCK_DECLARED']);
 for(const p of ['worker.state.','content.stage.','visit.location.','component.','active_at_h.'])assert.ok(ids(p).length>=2,p);
 assert.equal(term('active_at_h.could_not_finish').label_plain,'Started but could not finish by H');
 assert.deepEqual(ids('run.state.'),['draft','running','cancelled','incomplete','stale','invalid','verified','could_not_reproduce','refused','incompatible','failed']);
 assert.equal(term('run.state.could_not_reproduce').label_plain,'Could not reproduce');
 for(const b of ['accepted','trusted','approved'])assert.ok(term('run.state.verified').prohibited_conflations.includes(b));
 for(const t of TERMS.filter(x=>x.term_id.startsWith('run.state.')))assert.equal(t.category,'GATE_DECISION');
 const trust=Object.fromEntries(['authenticity','authorization','deployment_permission','evidence','scope'].map(k=>[k,term('trust.'+k)]));
 assert.equal(trust.authenticity.value,'NOT_AUTHENTICATED');assert.equal(trust.authenticity.category,'AUTHENTICITY');
 assert.equal(trust.authorization.value,'NOT_EVALUATED');
 assert.equal(trust.deployment_permission.value,'NONE');
 assert.equal(trust.evidence.value,'NOT_EVIDENCE');
 assert.equal(trust.scope.value,FLOW_TRUST.scope);assert.equal(trust.scope.label_technical,FLOW_TRUST.scope);
 assert.ok(LABELS.includes(trust.scope.value),'scope label comes from the label tuple via FLOW_TRUST');
 for(const k of ['authenticity','authorization','deployment_permission','evidence','scope'])assert.equal(trust[k].label_technical,trust[k].value,k);
 assert.equal(term('trust.consistency').category,'GATE_DECISION');
 assert.deepEqual(ids('comparison.classification.'),['improvement','worse','tie','mixed','NOT_AVAILABLE']);
});

test('turnaround and release rows carry the required prohibited conflations',()=>{
 for(const id of ['visit.turnaround_observed_s','observed_visit_seconds','visit.released_at'])
  for(const p of ['return to service','ride or mission eligibility','road readiness','deployment permission'])assert.ok(term(id).prohibited_conflations.includes(p),`${id}: ${p}`);
 assert.match(term('visit.turnaround_observed_s').definition,/modeled depot queue to modeled depot release/);
 assert.match(term('worker.supervised_pair').definition,/A supervised pair uses 2 people for 1 task and adds no simultaneous capacity/);
 assert.ok(term('profile.overlap').prohibited_conflations.includes('workplace safety guidance'));
});

test('the three honesty strings are byte-exact',()=>{
 const em=String.fromCodePoint(0x2014),dot=String.fromCodePoint(0xb7);
 const expected=[
  `Simplified simulations for learning ${em} not evidence about real-world safety. Nothing here approves deploying a vehicle or policy.`,
  `NOT_EVIDENCE ${dot} simulation only ${dot} decision authority NONE`,
  'An independent educational project by Bo-Huei Lin. Not affiliated with or endorsed by Waymo, Zoox, or their partners.',
 ];
 assert.equal(HONESTY.length,3);assert.ok(Object.isFrozen(HONESTY));
 HONESTY.forEach((s,i)=>assert.deepEqual(enc(s),enc(expected[i]),`honesty ${i}`));
 assert.equal(enc(HONESTY[0]).filter(b=>b===0xe2).length,1);
});

test('copy rules: no banned word, no dash except the one honesty dash, no URL, no label tuple',()=>{
 assert.equal(LABELS.length,5);
 // The scanner itself still fires on a dash and on an assembled banned word.
 assert.equal(copyProblems([{where:WHERE,text:'a '+String.fromCodePoint(0x2013)+' b'}]).length,1);
 assert.equal(copyProblems([{where:WHERE,text:'a '+'li'+'ve'+' value'}]).length,1);
 const literals=literalsOf(SOURCE_TEXT);
 assert.ok(literals.length>500);
 const flagged=literals.filter(text=>copyProblems([{where:WHERE,text}]).length>0);
 // The only dash is the exact first honesty sentence, permitted solely inside the depot-lab copy scope (note 17).
 assert.deepEqual(flagged,[]);
 assert.deepEqual(copyProblems([{where:WHERE,text:HONESTY[0]}]),[]);
 assert.match(copyProblems([{where:'src/ui/studio.js string',text:HONESTY[0]}])[0],/^dash: /);
 assert.equal(copyProblems([{where:WHERE,text:HONESTY[0]+' '+String.fromCodePoint(0x2014)}]).length,1);
 const runtime=[...TERMS.flatMap(strings),...SOURCES.flatMap(strings),HONESTY[1],HONESTY[2]];
 assert.deepEqual(copyProblems(runtime.map(text=>({where:WHERE,text}))),[]);
 const url=/https?:|www\.|:\/\/|\/\/|\.(com|org|gov|net|io|uk)\b/i;
 for(const s of [...literals,...runtime])assert.doesNotMatch(s,url,s);
 const scope=term('trust.scope');
 for(const s of literals)for(const l of LABELS)assert.ok(!s.includes(l),'label tuple literal in registry source');
 for(const t of TERMS)for(const s of strings({...t,value:t===scope?null:t.value,label_technical:t===scope?'':t.label_technical}))for(const l of LABELS)assert.ok(!s.includes(l),t.term_id);
 for(const s of SOURCES.flatMap(strings))for(const l of LABELS)assert.ok(!s.includes(l));
 assert.doesNotMatch(SOURCE_TEXT,/\/Users\/|\/private\/tmp|scratchpad/);
});

test('the Technical source list is plain text with research labels and limits',()=>{
 assert.ok(SOURCES.length>=20&&Object.isFrozen(SOURCES));
 assert.equal(new Set(SOURCES.map(s=>s.id)).size,SOURCES.length);
 for(const s of SOURCES){
  assert.deepEqual(Object.keys(s),['id','citation','label','limitation','tag']);
  assert.match(s.id,/^[PNOU][0-9]{2}$/);
  assert.ok(['Public mechanism','Design inference','Teaching assumption','Calibration required'].includes(s.label),s.id);
  assert.ok(nonEmpty(s.citation)&&nonEmpty(s.limitation),s.id);
  assert.ok(nullOr(s.tag,nonEmpty),s.id);
  for(const x of strings(s))assert.doesNotMatch(x,/\b(audience|reviewer|reviewed by|intended for|prepared for)\b/i,s.id);
 }
 const by=Object.fromEntries(SOURCES.map(s=>[s.id,s]));
 assert.equal(by.N02.tag,'recruiting material; work categories only');
 assert.equal(by.N06.tag,'UK spectrum context only');
 assert.match(by.N06.limitation,/UK-specific context only/);
 assert.equal(SOURCES.filter(s=>s.tag!==null).length,2);
 for(const t of TERMS)for(const id of t.source.match(/\b[PNOU][0-9]{2}\b/g)??[])assert.ok(by[id],`${t.term_id} cites ${id}`);
});
