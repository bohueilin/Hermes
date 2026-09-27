import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync,existsSync} from 'node:fs';
import {simulationCatalog,createSimulationCatalog} from '../src/ui/simulation-catalog.js';
import {installFakeDom} from './helpers/fake-dom.mjs';
const path=new URL('../src/ui/teaching-frames.js',import.meta.url);
const H3=/\b(predict(?:s|ed|ing|ion|ions|ive)?|forecast(?:s|ed|ing|er|ers)?|expected\s+traffic|live|real[\s-]?time|monitoring)\b/i;
const H6=/\b(wins?|winners?|beats|scores?|scoring|gauges?|grades?|leaderboards?|revenue|costs?)\b|better option|best configuration/i;
const V=/\b(improved|regressed|unchanged|inconclusive|advance_to_next_test|run_more_experiments|no_recommendation|hold)\b|\breads? (lower|higher|no change)\b|\bguardrails? (within|regress)|\bas OPS-\d\d shows\b|\bis expected to\b|\bthe harm\b/i;
const D=/\b(lower|higher|unchanged|more|fewer|less|rises?|rising|falls?|falling|longer|shorter|slower|faster|increases?|increased|decreases?|decreased|grows?|drops?|up|down|above|below|better|worse)\b/i;
const house=/\b(should|prove[sn]?|guarantee\w*|safe|safety|monitor\w*)\b/i;
async function module(){assert.ok(existsSync(path),'page-only teaching frames must exist');return import(path);}
test('all lessons render their own purpose, mechanics and direction-free learning rather than a raw engine axis',async()=>{
 const m=await module();assert.deepEqual(Object.keys(m.LESSON_FRAMES).sort(),simulationCatalog().map(r=>r.id).sort());
 const seen=new Set();for(const [id,f]of Object.entries(m.LESSON_FRAMES)){
  for(const [key,max]of [['what_why',160],['how',220],['look_for',240],['ops_takeaway',240]]){assert.ok(f[key]?.length,id+' '+key);assert.ok(f[key].length<=max,id+' '+key+' cap');for(const re of [H3,H6,V,house,/[\u2013\u2014]/])assert.doesNotMatch(f[key],re,id+' '+key);}
  assert.ok(f.look_for.length+f.ops_takeaway.length<=240,id+' combined cap');
  for(const key of ['look_for','ops_takeaway']){assert.doesNotMatch(f[key],D,id);assert.doesNotMatch(f[key].replace(/(?:SF|SJ|EB)-\d|\d\d:\d\d|p90|(?:OPS|UC)-\d+[a-z]?|L\d[a-z]?/g,''),/\d/,id);}
  assert.match(f.ops_takeaway,/^An ops team would (test|check|measure|compare|log|size|map|write|give)\b/);assert.doesNotMatch(f.ops_takeaway,/\bmust\b|shows that/i);
  const key=f.look_for+f.ops_takeaway;assert.ok(!seen.has(key),id+' distinct learning');seen.add(key);
 }
 const restore=installFakeDom();try{const catalog=createSimulationCatalog();assert.equal(catalog.element.querySelectorAll('.teaching-frame').length,59);for(const r of simulationCatalog()){const card=catalog.element.querySelector(`[data-simulation="${r.id}"]`);assert.equal(card.querySelectorAll('[data-part]').length,3);const text=card.textContent.replace(r.id,'');assert.doesNotMatch(text,/parameter:|policy:|\b(SUP|DEP|RD|DEM|POL|RID)-\d|\b[a-z]+_[a-z_]+\b|\b[a-z]+\.[a-z_]+\d*_s\b|1 guardrails/);}}finally{restore();}
});
test('a replay uses the actual request partition and never fills absence with zero',async()=>{const m=await module();assert.equal(m.runLine(m.SURFACE_FRAMES.day,{type:'replay',seed:42,metrics:{completed_trips:95,total_requests:284,unserved_requests:176,pending_requests:4,in_progress_trips:9}}).line,'95 of 284 requests completed in this replay; 176 unserved, 4 waiting and 9 in progress at the end. Seed 42, one replay.');assert.match(m.runLine(m.SURFACE_FRAMES.day,{type:'replay',seed:42,metrics:{}}).line,/not available/);});
test('lesson arrival keeps lesson identity and clears unrelated replay results',async()=>{const {mountStudio}=await import('../src/ui/studio.js');const {createStore,createInitialState}=await import('../src/ui/store.js');const {defaultScenario}=await import('../src/model/schema.js');const {routeHref}=await import('../src/ui/routes.js');const {CHOOSER_PRESET_IDS}=await import('../src/ui/experiment.js');const restore=installFakeDom();const root=document.createElement('div');root.id='fleetlab-root';const strip=document.createElement('div');strip.id='fleetlab-teaching-strip';root.appendChild(strip);document.body.appendChild(root);const {start}=await import('../src/ui/app.js');const app=start({createWorker:()=>null,studio:true}),store=app.store,studio=app.studio;try{for(const r of simulationCatalog()){const page=r.target==='scale'?'scale':r.target==='operations'?'simulation':r.target==='streets'?'streets':CHOOSER_PRESET_IDS.includes(r.id)?'depots':'operations';studio.applyRoute(routeHref({page,lesson:r.id}));const frame=[...studio.element.querySelectorAll('.teaching-frame')].find(n=>n.getAttribute('data-frame')===r.id&&!n.closest('.catalog-card'));assert.ok(frame,r.id+" "+studio.element.textContent.slice(-2000));assert.equal(frame.querySelector('.teaching-title').textContent,r.title,r.id);const area=r.target==='scale'?studio.scale.element:r.id==='region-launch'?studio.operations.launchPanel.element:r.target==='operations'?studio.operations.element:r.target==='streets'?studio.streets.element:studio.element.querySelector('.studio-workspace');const button=[...area.querySelectorAll('button')].find(b=>r.target==='scale'?b.textContent==='Run the paired test':r.id==='region-launch'?b.textContent==='Rehearse commissioning delay':r.target==='operations'?b.textContent.startsWith('Run fleet day'):r.target==='streets'?b.textContent.startsWith('Run street scenario'):b.textContent===(page==='depots'?'Freeze and run':'Run window'));assert.ok(button,r.id+' run control');const all=[...studio.element.querySelectorAll('*')];assert.ok(all.indexOf(frame)<all.indexOf(button),r.id+' frame precedes run');if(r.target==='operations'&&r.id!=='region-launch')assert.equal(studio.operations.element.querySelector('[aria-label="Start with a situation"]').value,'lesson');}studio.applyRoute('#/fleet-day?lesson=cleaning');await studio.operations.run();studio.applyRoute('#/fleet-day?lesson=weather-day');assert.equal(studio.operations.getState().result,null);studio.operations.setConfig({fleet_size:25});assert.match(studio.operations.element.querySelector('.teaching-frame').textContent,/Setup changed from this lesson/);}finally{app.destroy();restore();}});

import {LESSON_FRAMES,CASEBOOK_READINGS,runLine,casebookReading} from '../src/ui/teaching-frames.js';
import {verdictView} from '../src/ui/experiment.js';
import {teachingTools} from '../src/ui/teaching-projection.js';
import {freezeSpec,runExperimentSpec,thresholdValue} from '../src/model/experiment.js';
import {presetById,seedSet} from '../src/model/presets.js';
const pins=JSON.parse(readFileSync(new URL('./ops-cases.pins.json',import.meta.url),'utf8')).cases;
function pinnedView(id,k){const p=pins[id].measured['set'+k],spec=presetById(id).experiment;return {validity:'VALID',label:p.label,outcome:p.outcome,recommendation:p.recommendation,primary:{metric:p.primary,mean_delta:p.mean_delta_exact,ci_low:p.ci_exact[0],ci_high:p.ci_exact[1],equivalence_margin:thresholdValue(spec.primary.metric,spec.primary.margin_units)},guardrails:p.guardrails.map(g=>({...g,harm:g.harm_exact})),descriptives:p.descriptives.map(d=>({metric:d.metric,baseline_mean:d.baseline,candidate_mean:d.candidate}))};}
test('all sixty pinned casebook results give bounded run lines and readings gated by their exact label and verdict',()=>{
 for(const id of Object.keys(pins))for(let k=1;k<=3;k++){
  const f=LESSON_FRAMES[id],r=pinnedView(id,k),line=runLine(f,r,teachingTools);
  assert.ok(line.line.length<=240,id+' '+k+' '+line.line.length+' '+line.line);assert.ok(line.next);assert.doesNotMatch(line.line,/NaN|undefined|IMPROVED|REGRESSED|HOLD/);
  const reading=casebookReading(f,r,teachingTools);assert.ok(reading,id+' '+k+' reading');assert.ok(reading.length<=240);
  for(const patch of [{label:'edited'},{validity:'INVALID_EXPERIMENT'},{outcome:'different'},{recommendation:'different'}])assert.equal(casebookReading(f,{...r,...patch},teachingTools),null);
  if(/\{(?:primary|g\d|[bc]\.)/.test(CASEBOOK_READINGS[id].template))assert.equal(casebookReading(f,{...r,primary:null,guardrails:[],descriptives:[]},teachingTools),null);
 }
});
test('casebook descriptive slots come from each exact recorded runtime verdict for OPS-08 and OPS-19',()=>{
 for(const id of ['OPS-08','OPS-19'])for(let k=1;k<=3;k++){
  const spec=structuredClone(presetById(id).experiment);Object.assign(spec,{seed_set:k,seeds:seedSet(k,spec.seeds.length)});const frozen=freezeSpec(spec),payload=runExperimentSpec(frozen.spec),view=verdictView(payload,frozen);
  assert.equal(view.label,pins[id].measured['set'+k].label);assert.ok(casebookReading(LESSON_FRAMES[id],view,teachingTools),id+' '+k);const metric=id==='OPS-08'?'depot.diversions':'depot.bay_wait_p90_s',actual=view.descriptives.find(d=>d.metric===metric),pinned=pins[id].measured['set'+k].descriptives.find(d=>d.metric===metric),scale=metric.endsWith('_s')?10:1e6;assert.ok(actual&&pinned);assert.equal(Math.round(actual.baseline_mean*scale)/scale,pinned.baseline);assert.equal(Math.round(actual.candidate_mean*scale)/scale,pinned.candidate);if(id==='OPS-08')assert.ok(actual.candidate_mean<actual.baseline_mean);else assert.ok(Math.abs(actual.candidate_mean-actual.baseline_mean)<60,'cleaning bay wait moves under one minute');
  for(const slot of CASEBOOK_READINGS[id].template.matchAll(/\{([bc])\.([^:}]+):[^}]+\}/g)){const d=view.descriptives.find(d=>d.metric===slot[2]);assert.ok(Number.isFinite(d?.[slot[1]==='b'?'baseline_mean':'candidate_mean']),slot[0]);}
 }
});
test('held primary, unavailable guardrail, invalid run and tiny nonzero values retain distinct evidence',()=>{
 const r=pinnedView('OPS-01',1),f=LESSON_FRAMES['OPS-01'];
 assert.match(runLine(f,{...r,outcome:'REGRESSED',guardrails:[],recommendation:'HOLD'},teachingTools).line,/Held because the main result regressed/);
 assert.match(runLine(f,{...r,outcome:'INCONCLUSIVE',recommendation:'RUN_MORE_EXPERIMENTS',guardrails:[{metric:r.primary.metric,status:'NOT_EVALUABLE',reason:'no riders'}]},teachingTools).line,/not available: no riders/);
 assert.match(runLine(f,{validity:'INVALID_EXPERIMENT',reason:'missing record'},teachingTools).line,/Invalid run: missing record/);
 const small={...r,primary:{...r.primary,mean_delta:0.000001}};assert.match(runLine(f,small,teachingTools).line,/0\.000001/);
});
test('surface keys, glossary caps and grounding cover the complete teaching contract',async()=>{const m=await module(),g=JSON.parse(readFileSync(new URL('./teaching-frames.grounding.json',import.meta.url),'utf8'));assert.equal(Object.keys(m.SURFACE_FRAMES).length,21);assert.equal(Object.keys(m.GLOSSARY).length,20);for(const [id,f]of Object.entries({...m.LESSON_FRAMES,...m.SURFACE_FRAMES})){assert.ok(g[id],id);for(const [k,max]of [['what_why',160],['how',220]])assert.ok(f[k].length<=max,id+' '+k);for(const k of ['what_why','how','look_for','ops_takeaway'])for(const re of [H3,H6,V,/[\u2013\u2014]/])assert.doesNotMatch(f[k],re,id+' '+k);}for(const text of Object.values(m.GLOSSARY))assert.ok(text.length<=160);});
test('exact recorded tables are an operable accessible disclosure and retain their precise values',async()=>{const {exactDisclosure}=await module(),restore=installFakeDom();try{const p=document.createElement('p');p.textContent='1.23456789';const view=exactDisclosure([p]),b=view.querySelector('button');document.body.appendChild(view);const body=view.querySelector('div');assert.equal(body.hidden,true);assert.equal(b.getAttribute('aria-controls'),body.id);b.focus();b.click();assert.equal(body.hidden,false);assert.equal(b.getAttribute('aria-expanded'),'true');assert.equal(document.activeElement,b);b.click();assert.equal(body.hidden,true);assert.equal(body.textContent,'1.23456789');}finally{restore();}});
test('paired time margins and intervals preserve their side of the actual threshold',()=>{
 for(const [margin,low,high]of [[90,91,110],[60,60.1,62],[60,-62,-60.1]]){
  const r={validity:'VALID',outcome:'REGRESSED',recommendation:'HOLD',guardrails:[],primary:{metric:'wait.p90_s',mean_delta:low,ci_low:low,ci_high:high,equivalence_margin:margin}},line=runLine(LESSON_FRAMES['OPS-01'],r,teachingTools).line;
  assert.match(line,/Held/);assert.doesNotMatch(line,/margin 2 min|interval \+1\.0 min to \+1\.0 min/);assert.match(line,margin===90?/margin 1\.5 min/:/margin 1\.0 min/);assert.match(line,new RegExp(String(low).replace('.','\\.')+' s'));
 }
});
test('regional and launch lesson edits disclose changed setup and refresh actual seed evidence',async()=>{
 const restore=installFakeDom();try{const root=document.createElement('div');root.id='fleetlab-root';const strip=document.createElement('div');strip.id='fleetlab-teaching-strip';root.appendChild(strip);document.body.appendChild(root);const {start}=await import('../src/ui/app.js');const app=start({createWorker:()=>null,studio:true});try{
  app.studio.applyRoute('#/experiments?lesson=OPS-07');app.store.dispatch({type:'experiment/draft',patch:{seedCount:5}});const frame=app.studio.element.querySelector('.workspace-intro .teaching-frame');assert.match(frame.textContent,/Paired test, 5 seeds/);assert.match(frame.textContent,/Setup changed from this lesson/);
  app.studio.applyRoute('#/fleet-day?lesson=region-launch');const panel=app.studio.operations.launchPanel;assert.doesNotMatch(panel.element.querySelector('.teaching-frame').textContent,/Setup changed/);panel.chooseTemplate('peninsula');assert.match(panel.element.querySelector('.teaching-frame').textContent,/Setup changed from this lesson/);
 }finally{app.destroy();}}finally{restore();}
});
