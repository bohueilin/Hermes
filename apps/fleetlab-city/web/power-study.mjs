import {formatMetric as fmt, requestGate, stateLabels} from './view-model.mjs';
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
const paragraph=(host,text,cls)=>host.append(el('p',text,cls));
function table(host,label,heads,rows){
 const wrap=el('div',undefined,'table-wrap');wrap.tabIndex=0;wrap.setAttribute('role','region');wrap.setAttribute('aria-label',label);
 const t=el('table');t.append(el('caption',label));const head=el('thead'),hr=el('tr');
 for(const title of heads){const th=el('th',title);th.scope='col';hr.append(th);}head.append(hr);t.append(head);const body=el('tbody');
 for(const row of rows){const tr=el('tr');for(const value of row){const td=el('td');if(value?.nodeType)td.append(value);else td.textContent=value??'Not available';tr.append(td);}body.append(tr);}t.append(body);wrap.append(t);host.append(wrap);return body;
}
function section(host,kicker,title){const n=el('section',undefined,'panel');n.append(el('p',kicker,'eyebrow'),el('h3',title));host.append(n);return n;}
function exact(host,title,value){const d=el('details');d.append(el('summary',title));const pre=el('pre');pre.append(el('code',JSON.stringify(value,null,2)));d.append(pre);host.append(d);}
const interval=(value,unit)=>value?`${fmt(value.mean,3)} ${unit} · 95% interval ${fmt(value.low,3)} to ${fmt(value.high,3)}`:'Not available · at least one required population or denominator is missing';

export function validatePowerProjection(data,study){
 if(data?.schema!=='fleetlab.power-analysis/1.0.0'||data.projection_schema!=='fleetlab.power-view/1.0.0'||data.id!==study.id||data.protocol_digest!==study.protocol_digest||data.mode!=='evaluate'||data.scope!=='SIMULATION_ONLY'||data.decision_authority!=='NONE'||data.map_eligibility!=='BLOCKED_MAP_QUALIFICATION')throw new Error('Selected study summary identity is incompatible');
 const expected=new Set(study.seeds.flatMap(seed=>study.configurations.map(arm=>`${seed}/${arm}`)));
 if(!Array.isArray(data.arms)||data.arms.length!==expected.size)throw new Error('Study summary population is incomplete');
 for(const row of data.arms){if(!expected.delete(`${row.seed}/${row.arm}`))throw new Error('Duplicate or foreign study summary');}
 if(data.analysis_status!=='COMPLETE'||data.arms.some(r=>!r.eligible||r.verification!=='INTERNALLY_CONSISTENT'))throw new Error('Study is incomplete; no valid study summary can be displayed');
 return data;
}

// The actual asynchronous UI controller; invalidation occurs before either fetch.
export function createStudyController({catalog,readData,onSelect,onLegacy,onPower,onError}){
 const gate=requestGate();
 return {async choose(id){
   const ticket=gate.issue();const study=catalog.studies?.find(s=>s.id===id);
   onSelect(id,study);
   if(id==='legacy'){onLegacy();return;}
   try{
     if(!study)throw new Error('Requested study is unavailable');
     const data=await readData(study.analysis_file);
     if(!gate.current(ticket))return;
     onPower(validatePowerProjection(data,study),study);
   }catch(error){if(gate.current(ticket))onError(error);}
 }};
}

export function renderPowerStudy(host,data,study,inspect){
 host.replaceChildren();
 const question=section(host,'POWER HEADROOM / FROZEN SF V1','Does more charging power change the value of a second depot?');
 paragraph(question,'A second location can shorten return travel and split local queues. This study asks whether that location effect changes when total charging power rises from 200 to 400 kW.');
 const controls=el('div',undefined,'study-controls-grid');
 for(const [title,copy] of [['Fixed in every configuration','100 generic EVs · 1,200 created requests · 8 × 50 kW ports · 4 turnaround slots · 07:00–15:00 · 30 kWh initial energy · 48 kWh charging target'],['Changed deliberately','Depot layout A, A+B or B; total site power 200 or 400 kW. A+B splits ports, power and slots equally.'],[`Paired across ${study.seeds.length} seeds`,`${study.seeds[0]}–${study.seeds.at(-1)}. Within each seed every configuration uses the same full input tape and the same immutable SF v1 graph.`]]){
  const card=el('article');card.append(el('h4',title),el('p',copy));controls.append(card);
 }question.append(controls);
 const result=section(host,'PRIMARY RESULT / DESCRIPTIVE','The location effect, at two power levels.');
 const p=data.primary;
 const labels={MATERIAL_POSITIVE:'More power increased the A+B versus A effect beyond the practical band.',MATERIAL_NEGATIVE:'More power reduced the A+B versus A effect beyond the practical band.',BOUNDED_SMALL:'The interval stays within the fixed ±1 percentage-point band.',UNRESOLVED:'The interval does not settle the practical size of this interaction.'};
 result.append(el('p',p?labels[p.classification]??p.classification:'Primary unavailable. Every scheduled block is required.','study-result'));
 result.append(el('p',interval(p,'percentage points'),'study-estimate'));
 paragraph(result,'Seedwise (AB400 − A400) − (AB200 − A200), using completed / all 1,200 created requests. A positive interaction is not itself a claim that A+B is better. B-only is secondary and never replaces the A reference.');
 paragraph(result,p?`${p.method}. n = ${p.n}; zero excluded: ${p.zero_excluded?'yes':'no'}. Classification uses exact values; displayed estimates are rounded.`:'Missing or invalid blocks are retained; no seed is dropped or substituted.');
 paragraph(result,'City recommendation withheld · BLOCKED_MAP_QUALIFICATION · SIMULATION_ONLY · NOT_AUTHENTICATED · decision authority NONE.','study-boundary');
 const thresholds=el('details');thresholds.append(el('summary','Read the exact decision thresholds'));
 paragraph(thresholds,'MATERIAL_POSITIVE: lower bound > +1 pp. MATERIAL_NEGATIVE: upper bound < −1 pp. BOUNDED_SMALL: lower ≥ −1 and upper ≤ +1 pp. Otherwise UNRESOLVED. Exclusion of zero is reported separately. The paired-t interval describes seed variability under this model, not map/model error or real-world safety.');result.append(thresholds);exact(result,'Exact primary estimate and seedwise interactions',p);
 const cells=section(host,'SIX CONFIGURATIONS / SAME PORT AND SLOT TOTALS','Read the service outcomes alongside the resources.');
 table(cells,'All configuration totals across the frozen seed population',['Configuration','Recorded sites and resources','Completed / created','Available seeds'],data.cells.map(cell=>{
  const rec=study.recordings.find(r=>r.configuration===cell.arm);
  return [cell.arm,rec?rec.sites.map(s=>`${s.id}: ${s.ports} ports × ${s.port_kw} kW · ${s.power_kw} kW site limit · ${s.slots} slots`).join(' / '):'Resources not available',`${cell.completed} / ${cell.created}`,`${cell.available_seeds} / ${cell.expected_seeds}`];
 }));
 paragraph(cells,'Counts retain the fixed created-request denominator. A lower conditional wait can coincide with fewer people boarding or completing a trip. No configuration winner score is computed.');
 const secondary=section(host,'SECONDARY DIAGNOSTICS','Keep service, empty travel and passenger wait together.');
 table(secondary,'Secondary paired contrasts; each candidate minus its A reference',['Contrast','Completion change','Empty distance / completed trip','Boarded wait p90 change'],data.secondary.map(s=>[`${s.candidate} − ${s.reference}`,interval(s.completion_delta_pp,'pp'),interval(s.empty_per_completed_change_percent,'%'),interval(s.boarded_wait_p90_delta_s,'s')]));
 paragraph(secondary,'Boarded wait is conditional on boarding under each configuration. Common-completed wait compares only requests completed in both arms; that population is treatment-dependent too. Null means unavailable, never zero. Historical guardrails are descriptive: empty-distance change ≤ +10%, boarded p90 change ≤ +60 s, zone completion change ≥ −5 pp with minimum n = 30. They do not provide simultaneous coverage or map qualification.');
 for(const s of data.secondary)exact(secondary,`${s.candidate} vs ${s.reference}: exact intervals, matched populations and historical thresholds`,s);
 const mechanisms=section(host,'ONE RECORDED ARM AT A TIME','Where did the fleet’s time and energy go?');
 paragraph(mechanisms,`Inspect every summary here. Detailed vehicle replay is fixed in advance to all six configurations of seed ${study.replay_seed}; other seeds have summaries only.`);
 const picker=el('div',undefined,'replay-controls');const seedLabel=el('label','Seed'),seedSelect=el('select');seedSelect.setAttribute('aria-label','Mechanism seed');
 for(const seed of study.seeds){const o=el('option',String(seed));o.value=seed;seedSelect.append(o);}seedLabel.append(seedSelect);
 const armLabel=el('label','Configuration'),armSelect=el('select');armSelect.setAttribute('aria-label','Mechanism configuration');for(const arm of study.configurations){const o=el('option',arm);o.value=arm;armSelect.append(o);}armLabel.append(armSelect);picker.append(seedLabel,armLabel);mechanisms.append(picker);
 const detail=el('div');mechanisms.append(detail);
 function drawDetail(){
  detail.replaceChildren();const row=data.arms.find(r=>r.seed===Number(seedSelect.value)&&r.arm===armSelect.value);
  if(!row?.diagnostics){paragraph(detail,`Not available · ${row?.error??'No verified diagnostics'}`);return;}
  const d=row.diagnostics;const button=el('button','Open this selection in Replay ↗','secondary');button.onclick=()=>inspect(row.seed,row.arm);detail.append(button);
  paragraph(detail,row.seed===study.replay_seed?'Vehicle replay is available for this seed.':'Summary only. Replay is not exported for this seed; opening Replay will explain this without substituting another run.','small');
  table(detail,'Fleet resource time for the selected seed and configuration',['State','Vehicle-minutes'],Object.entries(d.state_minutes).map(([state,n])=>[stateLabels[state]??state,fmt(n,2)]));
  paragraph(detail,'Vehicle-minutes sum time across the fleet. Site-associated time follows recorded state/site associations; traveling-state associations are not physical occupancy.');
  table(detail,'Site queues and charging for the selected arm',['Site','Resources','Charge queue / turnaround queue at horizon','Charge queue / turnaround queue vehicle-minutes','Delivered energy','Unused declared capacity'],Object.values(d.sites).map(s=>[s.id,`${s.ports} ports × ${s.port_kw} kW · ${s.power_kw} kW site · ${s.slots} slots`,`${s.final_charge_queue} / ${s.final_turnaround_queue}`,`${fmt(d.state_minutes_by_site[s.id]?.queue_charge??0,2)} / ${fmt(d.state_minutes_by_site[s.id]?.queue_turnaround??0,2)}`,`${fmt(s.charged_kwh,2)} kWh`,`${fmt(s.unused_capacity_kwh,2)} kWh`]));
  paragraph(detail,'Unused declared capacity is site power × horizon minus delivered energy. It does not establish that vehicles could reach or use that capacity. Allocated power and delivered energy differ when charging clips at the target.');
  table(detail,'Request states; retain the whole created population',['State','Requests'],Object.entries(d.request_states).map(([state,n])=>[state,n]));
  paragraph(detail,`Conditional boarded wait: n = ${d.boarded_wait.n}; p50 ${fmt(d.boarded_wait.p50_s,2)} s; p90 ${fmt(d.boarded_wait.p90_s,2)} s. Empty km / created request: ${fmt(d.empty_km_per_created_request,4)}. Stranded at horizon: ${d.reachability.stranded_at_horizon}. ${d.reachability.definition}.`);
  table(detail,'Zone service for this seed, including UNASSIGNED',['Zone','Completed / created','Request states'],Object.entries(d.zones).map(([zone,z])=>[zone,`${z.completed} / ${z.created}`,JSON.stringify(z.states)]));
  exact(detail,'Exact values, verification, violations, state/site time and provenance',row);
 }seedSelect.onchange=drawDetail;armSelect.onchange=drawDetail;drawDetail();
 const population=section(host,'COMPLETE FROZEN POPULATION','All 144 arm summaries remain inspectable.');
 paragraph(population,'Expand the full ledger for every seed/configuration, including verification and failures. This table is not filtered by outcome.');
 const ledger=el('details');ledger.append(el('summary',`Inspect all ${data.arms.length} arm summaries`));
 table(ledger,'Every scheduled power-study arm',['Seed','Configuration','Verification','Completed / created','Empty km / created','Boarded wait n / p90 seconds','Violations / failure','Inspect'],data.arms.map(r=>{
  const b=el('button','Inspect');b.onclick=()=>{seedSelect.value=r.seed;armSelect.value=r.arm;drawDetail();mechanisms.scrollIntoView({block:'start'});};
  return [r.seed,r.arm,r.verification,r.metrics?`${r.metrics.completed} / ${r.metrics.created}`:'Not available',fmt(r.diagnostics?.empty_km_per_created_request,4),r.diagnostics?`${r.diagnostics.boarded_wait.n} / ${fmt(r.diagnostics.boarded_wait.p90_s,2)}`:'Not available',r.error??(r.violations?.length?JSON.stringify(r.violations):'No recorded hard violation'),b];
 }));population.append(ledger);
 const zones=el('details');zones.append(el('summary','Inspect pooled zone counts across all seeds'));
 table(zones,'Pooled zone counts; descriptive only',['Configuration','Zone','Completed / created','Interpretation'],data.zones.map(z=>[z.arm,z.zone,`${z.completed} / ${z.created}`,z.uncertainty]));population.append(zones);
 exact(population,'Protocol, run-set and per-arm digest identities',{protocol_digest:data.protocol_digest,run_set_digest:data.run_set_digest,run_set:data.run_set,reasons:data.reasons});
 paragraph(population,'Method correction · 29 Sep 2026: lower initial energy in the original study recorded two no_reachable_depot violations per arm, not reserve_breach. Its lower-demand sensitivity is one seed (−1.5 pp), not a general outcome. The 60 kWh nominal capacity field is unused by the engine; recorded energy and the 48 kWh charging target drive the display. Historical scientific files are unchanged.','small');
}

export function mountStudies({catalog,readData,replay,show,notice}){
 const $=id=>document.getElementById(id);const selectors=[$('study-select'),$('replay-study-select')];
 const count=1+(catalog.studies?.length??0);
 $('study-help').textContent=count===1?(catalog.power_status_file?'The menu includes the original twelve-pair study. The stopped power study is reported separately below, with no paired estimate.':'Only the original twelve-pair depot study is included in this package. No power-study evaluation is included. Notebook and Replay show that recorded study.'):`${count} recorded studies are included, with separate frozen protocols. Selection changes the notebook and Replay together.`;
 for(const select of selectors){select.replaceChildren();for(const entry of [{id:'legacy',label:'Original depot study · twelve pairs'},...(catalog.studies??[])]){const o=el('option',entry.label);o.value=entry.id;select.append(o);}}
 function controls(id,study){
  replay.pause();replay.gate.issue();replay.trace=null;replay.loading=false;replay.study=id;
  for(const select of selectors)select.value=id;
  const seeds=study?.seeds??catalog.seeds;const arms=study?.configurations??['baseline','candidate'];
  $('seed-select').replaceChildren(...seeds.map(seed=>{const o=el('option',String(seed));o.value=seed;return o;}));
  $('arm-select').replaceChildren(...arms.map(arm=>{const o=el('option',arm==='baseline'?'A · 200 kW':arm==='candidate'?'A+B · 200 kW':arm.toUpperCase());o.value=arm;return o;}));
  $('legacy-study').hidden=id!=='legacy';$('power-study').hidden=id==='legacy';$('power-study').replaceChildren(el('p','Loading the selected frozen study…'));
  $('replay-study-context').textContent=study?`Six configurations across 24 paired seeds. Same 100 EVs and 1,200 requests per seed. Vehicle replay: seed ${study.replay_seed} only; all six configurations. Other seeds retain complete summaries.`:'Twelve paired repeats, seeds 1001–1012. Same 100 EVs and 1,200 requests per seed; depot A versus A+B at 200 kW total.';
  replay.load();
 }
 const controller=createStudyController({catalog,readData,onSelect:controls,onLegacy:()=>{},onPower:(data,study)=>renderPowerStudy($('power-study'),data,study,(seed,arm)=>{
  $('seed-select').value=seed;$('arm-select').value=arm;replay.load();show('replay');
 }),onError:error=>{$('power-study').replaceChildren(el('p',`${error.message}. No substitute study was loaded.`,'fatal'));notice(error.message,true);}});
 for(const select of selectors)select.addEventListener('change',()=>controller.choose(select.value));
 controller.choose('legacy');return controller;
}
