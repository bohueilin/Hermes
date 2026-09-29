// Shell tests of the Scale lab: the lab contract, the generic view, the route, the ladder chart and the copy rules.
// Every lab in SCALE_LABS is held to the same checks, so a lab engineer adds no case here.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {installFakeDom} from './helpers/fake-dom.mjs';
import {SCALE_LABS} from '../src/ui/scale-labs.js';
import {createScaleLab,yieldToPage,cellText,fillText} from '../src/ui/scale-lab.js';
import {ladderChart} from '../src/ui/charts.js';
import {scaleJson,freezeScale,scalePairSteps} from '../src/model/scale-contract.js';
import {parseRoute,routeHref} from '../src/ui/routes.js';
import {mountStudio} from '../src/ui/studio.js';
import {createStore,createInitialState} from '../src/ui/store.js';
import {defaultScenario} from '../src/model/schema.js';
import {moduleGraph} from '../tools/pack.mjs';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import {buildHtml} from '../tools/pack.mjs';
import {serialize} from './helpers/fake-dom.mjs';
import * as labels from '../src/ui/labels.js';
import * as format from '../src/ui/format.js';
import * as experiment from '../src/ui/experiment.js';
import {runLine,SURFACE_FRAMES,LESSON_FRAMES} from '../src/ui/teaching-frames.js';
import * as frames from '../src/ui/teaching-frames.js';
import {legacyText,VIEWS as LEGACY_VIEWS} from './helpers/legacy-text.mjs';
import {teachingTools} from '../src/ui/teaching-projection.js';
import {metricWords} from '../src/ui/charts.js';

const H3=/\b(predict(?:s|ed|ing|ion|ions|ive)?|forecast(?:s|ed|ing|er|ers)?|expected\s+traffic|live|real[\s-]?time|monitoring)\b/i;
const H6=/\b(wins?|winners?|beats|scores?|scoring|gauges?|grades?|leaderboards?|revenue|costs?)\b|better option|best configuration/i;
const V=/\b(improved|regressed|unchanged|inconclusive|advance_to_next_test|run_more_experiments|no_recommendation|hold)\b/i;
const DIRECTION=/\b(lower|higher|more|fewer|less|rises?|rising|falls?|falling|longer|shorter|slower|faster|increases?|increased|decreases?|decreased|grows?|drops?|up|down|above|below|better|worse)\b/i;
const HOUSE=/\b(should|prove[sn]?|guarantee\w*|safe|safety|monitor\w*)\b/i;
const LINKS=/https?:/i;
const DASH=/[–—]/;
const drain=g=>{let s;do{s=g.next();}while(!s.done);return s.value;};
// Text a reader meets without opening a disclosure. Declared directions are declarations, not claims about a result.
function visible(node){
  if(node.nodeType===3)return node.textContent;
  if(node.hidden||node.getAttribute?.('data-role')==='direction')return '';
  if(node.localName==='details'&&!node.hasAttribute('open'))return [...node.children].filter(c=>c.localName==='summary').map(c=>c.textContent).join(' ');
  return [...node.childNodes].map(visible).join(' ');
}
const all=node=>node.textContent;
// Text of a node outside the exact record, which keeps every double as it is.
const prose=n=>n.nodeType===3?n.textContent:n.localName==='pre'?'':[...n.childNodes].map(prose).join(' ');

test('every lab satisfies the contract the generic view relies on',()=>{
  assert.equal(SCALE_LABS.length,3);
  assert.equal(new Set(SCALE_LABS.map(l=>l.id)).size,3);
  for(const lab of SCALE_LABS){
    assert.ok(Object.isFrozen(lab),lab.id);
    assert.match(lab.id,/^[a-z]+(?:-[a-z]+)*$/);
    assert.deepEqual(parseRoute(routeHref({page:'scale',lesson:lab.id})),{page:'scale',lesson:lab.id});
    for(const key of ['version','title','short','geography','limits'])assert.ok(typeof lab[key]==='string'&&lab[key].length>0,`${lab.id} ${key}`);
    assert.equal(lab.frame.length,5);assert.ok(['decision','condition'].includes(lab.frame[4]));
    assert.ok(lab.seeds.length>=2&&lab.seeds.length<=40);
    assert.ok(lab.controls.length>=1&&lab.controls.length<=4,`${lab.id} shows at most four controls`);
    for(const c of lab.controls){assert.ok(c.key in lab.defaults(),c.key);assert.ok(c.label&&(Array.isArray(c.options)||Number.isFinite(c.min)&&Number.isFinite(c.max)));}
    assert.notEqual(lab.defaults(),lab.defaults(),'defaults returns a fresh object');
    const d=lab.derive(lab.defaults());assert.equal(d.ok,true,lab.id);
    assert.ok(d.rows.length>=2);for(const row of d.rows){assert.equal(row.length,3);assert.match(row[2],/^(You choose|Teaching assumption|Sizing rule|Governing ratio|Fleet day map)/,`${lab.id} ${row[0]} names its source`);}
    assert.ok(d.rows.some(row=>/^Governing ratio/.test(row[2])),`${lab.id} shows its governing ratio`);
    const spec=d.setup.main.spec;
    assert.deepEqual(spec.seeds,[...lab.seeds]);assert.equal(spec.lab,lab.id);assert.equal(spec.model_version,lab.version);
    for(const name of [spec.primary.name,...spec.guardrails.map(g=>g.metric)]){assert.match(name,/^[a-z][a-z0-9 ,-]*$/,`${name} is a plain phrase`);assert.doesNotMatch(name,/_s$/);}
    assert.ok(spec.guardrails.length>=1,`${lab.id} declares a guardrail`);
  }
});

test('a lab refuses a setup outside its readable region with a reason and never throws',()=>{
  for(const lab of SCALE_LABS){
    for(const c of lab.controls){
      const bad=lab.derive({...lab.defaults(),[c.key]:c.options?'not-an-option':c.max+1000});
      assert.equal(bad.ok,false,`${lab.id} ${c.key}`);assert.ok(bad.reason.length>10);assert.doesNotMatch(bad.reason,/undefined|NaN/);
      assert.equal(lab.derive({...lab.defaults(),[c.key]:NaN}).ok,false);
    }
  }
});

test('results are reproducible, carry their provenance and come from the one paired instrument',()=>{
  for(const lab of SCALE_LABS){
    const run=()=>drain(lab.steps(lab.derive(lab.defaults()).setup)),a=run(),b=run();
    assert.equal(scaleJson(JSON.parse(JSON.stringify(a))),scaleJson(JSON.parse(JSON.stringify(b))),lab.id);
    assert.equal(a.evidence_status,'NOT_EVIDENCE');assert.equal(a.decision_authority,'NONE');assert.equal(a.lab,lab.id);
    assert.equal(a.validity,'VALID');assert.match(a.label,/^scale-spec:[0-9a-f]{8}$/);
    assert.deepEqual(Object.keys(a.analysis).sort(),['descriptives','guardrail_regressions','guardrail_results','guardrail_statuses','invalidity_detail','invalidity_reason','outcome','primary','recommendation','validity']);
    assert.equal(a.per_seed.length,lab.seeds.length);
    for(const c of a.controls??[]){assert.ok(c.title);if(c.spec.control==='null'){assert.ok(c.analysis.primary.paired_deltas.every(d=>d===0),`${lab.id} null control is exactly zero`);assert.equal(c.analysis.outcome,'UNCHANGED');assert.equal(c.analysis.recommendation,'NO_RECOMMENDATION');}}
    if(a.chart){assert.ok(a.chart.categories.length>=2);for(const s of a.chart.series)assert.equal(s.values.length,a.chart.categories.length);}
  }
});

test('the shared contract fails closed: a changed spec, an absent primary and a replay mismatch give no recommendation',()=>{
  const frozen=freezeScale({lab:'x',version:'v',change:'c',baseline:{a:0},candidate:{a:1},seeds:[1,2,3],primary:{name:'wait fraction',direction:'lower_is_better',equivalence_margin:.1},guardrails:[{metric:'queue',direction:'lower_is_better',max_harm:0}]});
  assert.throws(()=>drain(scalePairSteps({...frozen,digest:'0'.repeat(64)},function*(){return {};})),/digest/);
  const absent=drain(scalePairSteps(frozen,function*(){return {'wait fraction':NaN,queue:1};}));
  assert.equal(absent.validity,'INVALID_EXPERIMENT');assert.equal(absent.analysis.recommendation,'NO_RECOMMENDATION');
  let n=0;const drift=drain(scalePairSteps(frozen,function*(){return {'wait fraction':n++,queue:1};}));
  assert.equal(drift.analysis.invalidity_reason,'REPLICATION_MISMATCH');
  const gap=drain(scalePairSteps(frozen,function*(arm){return {'wait fraction':arm.a,queue:undefined};}));
  assert.equal(gap.validity,'INVALID_EXPERIMENT');assert.equal(gap.analysis,null);assert.match(gap.reason,/required measure was not available/);
  for(const bad of [{seeds:[1,1]},{seeds:[]},{resamples:10},{primary:{name:'m',direction:'lower_is_better',equivalence_margin:0}}])assert.throws(()=>freezeScale({lab:'x',version:'v',change:'c',baseline:{},candidate:{},seeds:[1,2],primary:{name:'m',direction:'lower_is_better',equivalence_margin:1},...bad}),RangeError);
});

test('yielding prefers scheduler.yield, then a message channel, then a timer',async()=>{
  const saved={scheduler:globalThis.scheduler,MessageChannel:globalThis.MessageChannel,setTimeout:globalThis.setTimeout};
  const used=[];
  try{
    globalThis.scheduler={yield:()=>{used.push('scheduler');return Promise.resolve();}};
    await new Promise(done=>yieldToPage(done));
    globalThis.scheduler=undefined;
    globalThis.MessageChannel=class{constructor(){const self=this;this.port1={close(){used.push('closed');},onmessage:null};this.port2={postMessage(){used.push('channel');queueMicrotask(()=>self.port1.onmessage());}};}};
    await new Promise(done=>yieldToPage(done));
    globalThis.MessageChannel=undefined;
    globalThis.setTimeout=(fn,ms)=>{used.push('timer '+ms);return saved.setTimeout(fn,0);};
    await new Promise(done=>yieldToPage(done));
  }finally{Object.assign(globalThis,saved);}
  assert.deepEqual(used,['scheduler','channel','closed','timer 0']);
});

test('cells and filled sentences never show an absent value as zero or blank',()=>{
  assert.equal(cellText({v:1234.5,d:1,u:'min'}),'1,234.5 min');
  assert.equal(cellText({v:0.00004,d:2}),'0.000040');assert.equal(cellText({v:.09638108345766845,d:0}),'0.096');assert.equal(cellText(-1.8189894035458565e-12),'-0.000000000002');assert.equal(cellText({v:1234567.04,d:1}),'1,234,567.0');assert.equal(cellText(12),'12');assert.equal(cellText({v:-0,d:1}),'0.0');
  assert.equal(cellText({absent:'this rung has not run yet'}),'not available: this rung has not run yet');
  assert.equal(cellText(undefined),'not available: no recorded value');
  assert.equal(fillText({t:'{a} of {b}',v:{a:{v:3,d:0},b:{absent:'no request'}}}),'3 of not available: no request');
});

function mount(){const restore=installFakeDom(),view=createScaleLab();document.body.appendChild(view.element);return {view,close(){view.destroy();restore();}};}
// The category labels a ladder draws in a box of `width` px: the drawing a browser asks for through its resize observer.
function labelsAt(categories,width){
  const observers=[],had=globalThis.ResizeObserver;
  globalThis.ResizeObserver=class{constructor(callback){this.callback=callback;observers.push(this);}observe(){}unobserve(){}disconnect(){}};
  try{
    const box=ladderChart({title:'t',chips:[{kind:'across',count:2}],summary:'Across 2 paired seeds: x.',limits:['l'],axisUnit:'u',categoryLabel:'c',gapLabel:'g',categories,series:[{id:'a',label:'A',mark:'line',values:categories.map((_,i)=>i)}],text:String,tick:String}).node.querySelector('[data-view="chart"]');
    observers.at(-1).callback([{target:box,contentRect:{width}}]);
    return [...box.querySelectorAll('svg [data-role="category"]')].map(n=>n.textContent);
  }finally{if(had===undefined)delete globalThis.ResizeObserver;else globalThis.ResizeObserver=had;}
}

test('before a run the page states no result, no verdict word and no direction, for every lab',()=>{
  const x=mount();try{
    for(const lab of SCALE_LABS){
      x.view.setLesson(lab);
      assert.equal(x.view.getState().result,null);
      x.view.element.querySelector('.scale-setup').setAttribute('open','');
      const text=visible(x.view.element);
      for(const re of [H3,H6,V,DIRECTION,HOUSE,LINKS,DASH]){const m=re.exec(text);assert.ok(!m,m?`${lab.id}: "${m[0]}" in ...${text.slice(Math.max(0,m.index-60),m.index+60)}`:'');}
      assert.match(text,/not available: nothing has run yet/);
      assert.match(text,/Every input on this page is a teaching assumption unless its source row says otherwise\. No value is a measurement of any fleet\./);
      assert.deepEqual([...x.view.element.querySelectorAll('summary')].map(s=>s.textContent).filter(t=>t==='Exact values'),[],'before a run no disclosure is titled Exact values: the record is the only one');
      assert.equal(x.view.element.querySelector('.scale-setup caption').textContent,'Inputs and where each comes from. A sizing rule works on teaching assumptions');
      const thesis=[...x.view.element.querySelectorAll('p')].find(p=>/^Three labs, one question: /.test(p.textContent)),nodes=[...x.view.element.querySelectorAll('*')];
      assert.ok(thesis&&nodes.indexOf(thesis)<nodes.indexOf(x.view.element.querySelector('h1')),'the thesis line sits above the heading');
      assert.equal(x.view.element.querySelectorAll('button.studio-button-primary').filter(b=>!b.disabled).length,1);
      assert.equal(x.view.element.querySelector('h1').textContent,lab.title);
      assert.equal(x.view.element.querySelectorAll('.scale-chooser a').filter(a=>a.getAttribute('aria-current')==='page').length,1);
      let words=0,counting=false;const run0=x.view.element.querySelector('button.studio-button-primary');
      for(const e of x.view.element.querySelectorAll('h1,h2,h3,h4,h5,h6,p,li,dt,dd,button')){if(e.localName==='h1')counting=true;if(e===run0)break;if(!counting||e.hidden||e.closest('details')||e.closest('table'))continue;words+=e.textContent.trim().split(/\s+/).filter(Boolean).length;}
      assert.ok(words>0&&words<=130,`${lab.id}: ${words} words from the heading to Run`);
      for(const key of ['title','short','limits'])for(const re of [H3,H6,V,DIRECTION,HOUSE,LINKS,DASH])assert.doesNotMatch(lab[key],re,`${lab.id} ${key}`);
      assert.ok(lab.unknowns.length>=3&&lab.unknowns.length<=6);
      const order=[...x.view.element.querySelectorAll('*')],frame=x.view.element.querySelector('.teaching-frame'),run=x.view.element.querySelector('button.studio-button-primary');
      assert.ok(order.indexOf(frame)<order.indexOf(run)&&order.indexOf(run)<order.indexOf(x.view.element.querySelector('.scale-setup')));
      x.view.element.querySelector('.scale-setup').removeAttribute('open');
    }
  }finally{x.close();}
});

test('Run records one result with provenance, a generated line, the verdict, a chart with its table and closed exact values',async()=>{
  const x=mount();try{
    for(const lab of SCALE_LABS){
      x.view.setLesson(lab);
      const r=await x.view.run(),root=x.view.element;
      assert.equal(x.view.getState().result,r);assert.equal(x.view.getState().busy,false);
      assert.match(root.querySelector('.result-provenance').textContent,/NOT_EVIDENCE; simulation-only; decision authority NONE\.$/);
      const line=root.querySelector('.teaching-run-line').textContent;assert.ok(line.length<=240,line);assert.doesNotMatch(line,/NaN|undefined|_/);
      assert.ok(root.querySelector('.fl-readout [data-gate="recommendation"]'),'the gate chain comes from the existing verdict builder');
      assert.match(root.querySelector('.fl-readout').textContent,/Teaching run, not a decision record/);
      const figure=root.querySelector('figure.fl-chart');assert.equal(figure.getAttribute('data-chart'),'scale_ladder');
      assert.equal(figure.querySelectorAll('[data-axis="measure"]').length,1);assert.ok(figure.querySelector('[data-role="summary"]').textContent.endsWith('.'));
      assert.ok(figure.querySelectorAll('[data-view="table"] tbody tr').length>=2);
      for(const d of root.querySelectorAll('.scale-result details'))assert.equal(d.hasAttribute('open'),false);
      const parts=[...root.querySelector('.scale-result').querySelectorAll('*')],at=s=>parts.indexOf(root.querySelector(s));
      assert.ok(at('.result-provenance')<at('.teaching-run-line')&&at('.teaching-run-line')<at('.fl-readout')&&at('.fl-readout')<at('figure.fl-chart')&&at('figure.fl-chart')<at('.teaching-exact'),'provenance, reading, verdict, chart, exact values');
      const set=[...root.querySelectorAll('.scale-result h3')].find(h=>h.textContent==='Set by the inputs, not found by the run');
      assert.ok(set&&at('.fl-readout')<parts.indexOf(set)&&parts.indexOf(set)<at('figure.fl-chart'),`${lab.id}: what follows from the inputs is read under the verdict, before the chart and the tables`);
      assert.equal(set.parentNode.querySelectorAll('li').length,r.notes.length);
      assert.doesNotMatch(root.querySelector('.teaching-result').textContent,/seed set|Add paired seeds|Run more paired seeds|rider draw|cars riders needed/,`${lab.id}: the next test is one this page can honour`);
      const stray=node=>[...node.childNodes].some(n=>n.nodeType===3?/^(null|undefined)$/.test(n.textContent.trim()):stray(n));
      assert.equal(stray(root),false,`${lab.id}: an absent part must add no node, a browser prints null as text`);
      assert.equal(root.querySelector('.scale-run progress').hidden,true);
      assert.equal(document.activeElement,root.querySelector('.scale-result h2'));
      assert.equal(root.querySelector('[role="status"]').textContent,'Recorded. Read the result, then the declared test behind it.');
      for(const re of [H3,H6,HOUSE,LINKS,DASH]){const m=re.exec(all(root));assert.ok(!m,m?`${lab.id}: ${m[0]}`:'');}
      assert.equal(root.querySelectorAll('button.studio-button-primary').filter(b=>!b.disabled).length,1);
      // C5, C7, C10: no strip is drawn on this page, so the readout names no side of a picture and states the interval as printed.
      const primary=root.querySelector('.fl-readout [data-section="primary"]'),field=f=>primary.querySelector(`[data-field="primary.${f}"]`).textContent;
      assert.equal(root.querySelector('.fl-readout svg'),null,'no strip is drawn in the readout');
      assert.doesNotMatch(primary.textContent,/\b(left|right)\b|baseline minus candidate|per seed|of the band/,`${lab.id}: with no strip drawn the readout names no side of a picture`);
      assert.equal(primary.querySelector('[data-role="delta-caption"]').textContent,` · ${labels.DIRECTIONS[r.spec.primary.direction]}`,`${lab.id}: the caption names the declared direction only`);
      assert.equal(primary.querySelector('[data-role="outcome-sentence"]').textContent,labels.verdictStripSummary({count:r.replications,metric:field('metric'),low:field('ci_low'),high:field('ci_high'),outcome:r.analysis.outcome}),`${lab.id}: the sentence states the interval as printed`);
      assert.equal(primary.querySelector('.fl-sr-only'),null,`${lab.id}: the sentence is not read twice`);
      // M16, M18: no raw double on the page outside the exact record.
      assert.doesNotMatch(prose(root.querySelector('.scale-result')),/\d\.\d{13,}/,`${lab.id}: a number prints at most 12 decimals`);
      // M8 on the shipped labs: labels stay inside the 12 characters the thinning rule is held to, and a ladder of three
      // rungs or fewer names every rung at the drawing width of a phone.
      assert.ok(r.chart.categories.every(c=>c.length<=12),`${lab.id}: a category label of more than 12 characters: ${r.chart.categories.join('; ')}`);
      if(r.chart.categories.length<=5)assert.deepEqual(labelsAt(r.chart.categories,296),r.chart.categories,`${lab.id}: every rung is named at a drawing width of 296 px`);
    }
    assert.ok(SCALE_LABS.some(l=>l.derive(l.defaults()).setup.main.spec.primary.direction==='higher_is_better'),'a shipped lab declares a measure where higher is better');
  }finally{x.close();}
});

test('Cancel stops the press, records nothing and returns focus to Run; leaving the page does the same',async()=>{
  const x=mount();try{
    const root=x.view.element,[run,cancel]=root.querySelectorAll('.scale-run button');
    run.focus();const pending=x.view.run();
    assert.equal(cancel.hidden,false);assert.equal(run.getAttribute('aria-disabled'),'true');assert.equal(run.disabled,false,'the focused button keeps focus');
    cancel.focus();cancel.click();
    assert.equal(await pending,undefined);
    assert.equal(x.view.getState().result,null);assert.equal(cancel.hidden,true);assert.equal(document.activeElement,run);
    assert.equal(root.querySelector('[role="status"]').textContent,'Canceled. No result was recorded from this press.');
    const again=x.view.run();x.view.pause();assert.equal(await again,undefined);assert.equal(x.view.getState().result,null);
  }finally{x.close();}
});

test('a lab that throws records nothing, says so in the alert region and keeps the previous result',async()=>{
  const restore=installFakeDom();let fail=false;
  const lab={...SCALE_LABS[0],steps:function*(setup){if(fail){yield {done:0,total:1,label:'Paired runs'};throw new RangeError('A cohort went below zero.');}return yield* SCALE_LABS[0].steps(setup);}};
  const view=createScaleLab({labs:[lab]});document.body.appendChild(view.element);
  try{
    const first=await view.run();assert.ok(first);assert.ok(JSON.stringify(first).length<=65536,'the recorded result stays small enough to show as exact values');
    fail=true;assert.equal(await view.run(),undefined);
    const alert=view.element.querySelector('[role="alert"]');assert.equal(alert.hidden,false);assert.equal(alert.textContent,'The lab could not run: A cohort went below zero.');
    assert.equal(view.getState().result,first);assert.equal(view.getState().busy,false);
    assert.equal(view.element.querySelector('.scale-run button').getAttribute('aria-disabled'),'false');
    assert.equal(view.element.querySelector('[role="status"]').textContent,'No result was recorded from this press.');
  }finally{view.destroy();restore();}
});

test('a long run hands the page back between slices, reports progress and stops its own generator when canceled',async()=>{
  const restore=installFakeDom();let closed=false,steps=0;
  const lab={...SCALE_LABS[0],steps:function*(){try{for(let i=0;i<1e9;i++){steps++;yield {done:i%50,total:50,label:'Paired runs'};}}finally{closed=true;}}};
  const view=createScaleLab({labs:[lab]});document.body.appendChild(view.element);
  try{
    const pending=view.run();
    await new Promise(done=>setTimeout(done,40));
    assert.ok(steps>10,'the generator advanced while the test waited');
    assert.match(view.element.querySelector('[role="status"]').textContent,/^Paired runs: \d+ of 50\.$/);
    assert.equal(view.element.querySelector('.scale-run progress').hidden,false);
    assert.match(view.element.querySelector('.scale-result').textContent,/^Result\s*Computing\. NOT_EVIDENCE; simulation-only; decision authority NONE\. Nothing is recorded until this press ends\.$/);
    view.cancel();assert.equal(await pending,undefined);assert.equal(closed,true);
    const after=steps;await new Promise(done=>setTimeout(done,20));assert.equal(steps,after,'nothing runs after Cancel');
  }finally{view.destroy();restore();}
});

test('a refused setup disables Run in words, and a changed setup marks the last result as from the previous setup',async()=>{
  const x=mount();try{
    const root=x.view.element,lab=SCALE_LABS.find(l=>l.controls.some(c=>!c.options)),control=lab.controls.find(c=>!c.options);
    x.view.setLesson(lab);await x.view.run();
    const input=root.querySelector(`[aria-label="${control.label}"]`);
    input.value=String(control.max+50);input.dispatchEvent(new Event('change'));
    assert.match(root.querySelector('[role="alert"]').textContent,/^Not available: outside what this lab can read: /);
    assert.equal(root.querySelector('.scale-run button').getAttribute('aria-disabled'),'true');
    assert.equal(await x.view.run(),undefined);
    assert.match(root.querySelector('.scale-result').textContent,/This result used the previous setup/);
    assert.match(root.querySelector('.teaching-frame').textContent,/Setup changed from this lesson/);
    input.value=String(control.max);input.dispatchEvent(new Event('change'));
    assert.equal(root.querySelector('[role="alert"]').hidden,true);assert.equal(root.querySelector('.scale-run button').getAttribute('aria-disabled'),'false');
  }finally{x.close();}
});

test('the route opens a lab without running it, refuses a lesson of another page and hides with the other views',()=>{
  const restore=installFakeDom(),root=document.createElement('div');document.body.appendChild(root);
  const studio=mountStudio({root,store:createStore(createInitialState({presetId:'bay_teaching_map',scenario:defaultScenario()})),playback:{pause(){}},present:{open(){},close(){}}});
  try{
    studio.applyRoute('#/scale-lab');assert.equal(studio.element.getAttribute('data-page'),'scale');assert.equal(studio.scale.getState().lab,SCALE_LABS[0].id);
    assert.match(document.title,/^Scale lab · FleetLab/);
    for(const lab of SCALE_LABS){studio.applyRoute(`#/scale-lab?lesson=${lab.id}`);assert.equal(studio.scale.getState().lab,lab.id);assert.equal(studio.scale.getState().result,null);assert.equal(document.title,`${lab.title} · FleetLab by Hermes`);}
    assert.equal(studio.element.querySelectorAll('.studio-header nav a').length,6);
    studio.applyRoute('#/scale-lab?lesson=fleet-day');assert.equal(studio.element.getAttribute('data-page'),'error');assert.equal(studio.scale.element.hidden,true);
    studio.applyRoute('#/fleet-day?lesson=response-reserve');assert.equal(studio.element.getAttribute('data-page'),'error');
    for(const hash of ['#/scale-lab?lesson=missing','#/scale-lab?foo=1']){studio.applyRoute(hash);assert.equal(studio.element.getAttribute('data-page'),'error',hash);}
    studio.applyRoute('#/scale-lab?setup=abc');assert.equal(studio.element.getAttribute('data-page'),'error','a shared setup is refused on this route');
    studio.navigate('overview');studio.applyRoute('#/scale-lab?lesson=fleet-intake');assert.equal(document.activeElement,studio.scale.heading,'the heading keeps focus when the lesson replaces the frame');
    for(const text of [studio.element.querySelector('.decision-grid').children[3].textContent,studio.operations.element.querySelector('.ops-intro').lastChild.textContent,studio.element.querySelector('.catalog-models').children[3].textContent])for(const re of [H3,H6,V,DIRECTION,HOUSE,LINKS,DASH])assert.doesNotMatch(text,re,text);
    studio.navigate('simulation');assert.equal(studio.scale.element.hidden,true);
    const link=[...studio.operations.element.querySelectorAll('.ops-intro a')].find(a=>a.getAttribute('href')==='#/scale-lab');assert.ok(link);assert.equal(link.getAttribute('class'),null,'an ordinary link, not a button');
    assert.ok([...studio.element.querySelectorAll('.decision-card a')].some(a=>a.getAttribute('href')==='#/scale-lab'));
    assert.ok([...studio.element.querySelectorAll('.catalog-start a')].some(a=>a.getAttribute('href')==='#/scale-lab?lesson=density-ladder'));
    studio.navigate('catalog');const filter=studio.element.querySelector('[aria-label="Simulation model"]');filter.value='Scale lab';filter.dispatchEvent(new Event('change'));
    assert.equal(studio.element.querySelectorAll('[data-simulation]').length,3);
  }finally{studio.destroy();restore();}
});

test('the ladder chart keeps the chart rules: one measure axis, a table twin, stated limits and named gaps',()=>{
  const restore=installFakeDom();try{
    const chart=ladderChart({title:'Wait by rung',chips:[{kind:'across',count:12}],summary:'Across 12 paired seeds: 2 of 3 rungs have run.',limits:['Invented demand.','One model.'],axisUnit:'min',categoryLabel:'Fleet size',gapLabel:'hatched: not available',
      categories:['24 cars','48 cars','72 cars'],series:[{id:'a',label:'Wait',mark:'line',values:[4,3,{absent:'this rung has not run yet'}]},{id:'b',label:'Queue',mark:'bar',values:[1,2,3]}],text:v=>`${v} min`,tick:t=>String(t)});
    const node=chart.node;assert.equal(node.getAttribute('class'),'fl-chart');assert.equal(chart.chartId,'scale_ladder');assert.equal(chart.setCursor(0),false);
    assert.equal(node.querySelectorAll('[data-axis="measure"]').length,1);assert.equal(node.querySelectorAll('[data-axis="time"]').length,0);
    assert.deepEqual([...node.querySelectorAll('.fl-limits-chip li')].map(n=>n.textContent),['Invented demand.','One model.']);
    const gap=node.querySelector('[data-role="absent"]');assert.equal(gap.getAttribute('aria-label'),'not available: this rung has not run yet');assert.equal(gap.getAttribute('tabindex'),'0');
    assert.equal(node.querySelectorAll('[data-role="legend"] li').length,3);
    assert.deepEqual([...node.querySelectorAll('[data-view="table"] tbody tr')].map(tr=>[...tr.children].map(c=>c.textContent)),[['24 cars','4 min','1 min'],['48 cars','3 min','2 min'],['72 cars','not available: this rung has not run yet','3 min']]);
    for(const n of node.querySelectorAll('*')){assert.equal(n.hasAttribute('stroke-dasharray'),false);const style=n.getAttribute('style')??'';assert.ok(!/#[0-9a-f]{3,8}\b|rgb|hsl|var\(--(pass|cond|hold|invalid)/i.test(style),style);for(const a of ['fill','stroke']){const v=n.getAttribute(a);if(v!==null)assert.match(v,/^(currentColor|none|url\(#fl-hatch-\d+\))$/);}}
    chart.showTable(true);assert.equal(node.querySelector('[data-view="chart"]').hidden,true);
    const weeks=ladderChart({title:'t',chips:[{kind:'replay',seed:1}],summary:'This replay: x.',limits:['l'],axisUnit:'vehicles',categoryLabel:'Week',gapLabel:'g',categories:Array.from({length:52},(_,i)=>String(i+1)),series:[{id:'a',label:'A',mark:'line',values:Array.from({length:52},(_,i)=>i)}],text:String,tick:String});
    const labels=weeks.node.querySelectorAll('[data-role="category"]');assert.ok(labels.length>=6&&labels.length<=13,`week labels are thinned: ${labels.length}`);
    for(const bad of [{categories:['one']},{series:[]},{limits:[]},{series:[{id:'a',label:'A',mark:'bar',values:[1]}]},{series:[{id:'a',label:'A',mark:'bar',values:[1,null,2]}]}])assert.throws(()=>ladderChart({title:'t',chips:[{kind:'replay',seed:1}],summary:'s.',limits:['l'],axisUnit:'u',categoryLabel:'c',gapLabel:'g',categories:['a','b','c'],series:[{id:'a',label:'A',mark:'bar',values:[1,2,3]}],text:String,tick:String,...bad}));
  }finally{restore();}
});

test('every class the view sets is defined and listed in the stylesheet header, and none of them moves',()=>{
  const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8'),source=readFileSync(new URL('../src/ui/scale-lab.js',import.meta.url),'utf8');
  const classes=new Set([...source.matchAll(/class:'([^']+)'/g)].flatMap(m=>m[1].split(' ')).filter(c=>c.startsWith('scale-')));
  const header=css.slice(0,css.indexOf('*/')),rules=css.slice(css.indexOf('*/'));
  assert.ok(classes.size>=5,[...classes].join(','));
  for(const name of classes){assert.match(rules,new RegExp(`\\.${name}(?![\\w-])`),`styles.css defines .${name}`);assert.match(header,new RegExp(`\\.${name}(?![\\w-])`),`the header lists .${name}`);}
  for(const block of rules.matchAll(/([^{}]*\.scale-[^{}]*)\{([^}]*)\}/g))assert.doesNotMatch(block[2],/transition|animation|will-change/,block[1].trim());
  assert.doesNotMatch(source,/#[0-9a-f]{3,8}\b/i,'colours come from the stylesheet tokens');
});

test('the labs are page-only and the packed copy scan covers them',async()=>{
  const root=fileURLToPath(new URL('../',import.meta.url)),labs=/src\/(model|ui)\/scale-/;
  const worker=moduleGraph(`${root}src/runtime/worker.js`,`${root}src`).order.map(m=>m.label);
  assert.ok(worker.length>10);assert.ok(!worker.some(name=>labs.test(name)),'no Scale lab module is reachable from the worker');
  const page=moduleGraph(`${root}src/ui/app.js`,`${root}src`).order.map(m=>m.label).filter(name=>labs.test(name));
  const checker=readFileSync(new URL('../tools/check-dist.mjs',import.meta.url),'utf8');
  assert.ok(page.length>=5);
  for(const name of page)assert.ok(checker.includes(`"${name}"`),`${name} is in COPY_MODULES`);
});

// Amendments after integration and review: the contract rules, the reading rules, then copy, order and page structure.
test('a shipped control that does not read as declared voids the press: no verdict, no recommendation, and the reason names the control',async()=>{
  const {readable}=await import('../src/model/scale-contract.js');
  for(const other of SCALE_LABS){const r=drain(other.steps(other.derive(other.defaults()).setup));assert.equal(readable(r),r,`${other.id}: a press whose controls read as declared is returned as it is`);}
  // A press built on the shared contract alone: a main test and three controls that read as declared.
  const lab=SCALE_LABS[0],declare=(control,candidate)=>freezeScale({lab:lab.id,version:lab.version,change:'c',control,baseline:{a:0},candidate:{a:candidate},seeds:[1,2,3,4,5,6],primary:{name:'wait fraction',direction:'lower_is_better',equivalence_margin:.1},guardrails:[{metric:'queue fraction',direction:'lower_is_better',max_harm:.05}]});
  const pair=frozen=>drain(scalePairSteps(frozen,function*(arm,seed){return {'wait fraction':.5-arm.a*.3+seed%3*.01,'queue fraction':.2};}));
  const good={...pair(declare(null,1)),controls:[{...pair(declare('null',0)),title:'Null control, both arms alike'},{...pair(declare('non-binding',0)),as_declared:true,title:'Ample pool control, a pool with room'},{...pair(declare('guardrail',0)),as_declared:true,title:'Guardrail control, one shared line'}],chart:{},tables:[],notes:['n']};
  assert.equal(good.validity,'VALID');assert.equal(good.analysis.outcome,'IMPROVED');assert.equal(readable(good),good);
  // One paired difference of one guardrail moves by a billionth in the null control: the margin would pass it, the exact rule does not.
  const bump=c=>({...c,analysis:{...c.analysis,guardrail_results:c.analysis.guardrail_results.map(g=>({...g,paired_deltas:g.paired_deltas.map((d,j)=>j===3?1e-9:d)}))}});
  const cases=[['null control',good.controls.map(c=>c.spec.control==='null'?bump(c):c)],['ample pool control',good.controls.map((c,i)=>i===1?{...c,as_declared:false}:c)],['guardrail control',good.controls.map((c,i)=>i===2?{...c,validity:'INVALID_EXPERIMENT'}:c)]];
  for(const [name,controls] of cases){
    const r=readable({...good,controls});
    assert.equal(r.validity,'INVALID_EXPERIMENT',name);assert.equal(r.analysis,null);assert.equal(r.reason,`the ${name} did not read as declared, so there is no comparison`);
    for(const k of ['controls','chart','tables','notes'])assert.equal(k in r,false,`${name}: a press that cannot be read carries no ${k}`);
    assert.equal(r.evidence_status,'NOT_EVIDENCE');assert.equal(r.decision_authority,'NONE');assert.equal(r.label,good.label);assert.deepEqual(r.per_seed,good.per_seed);
    for(const re of [H3,H6,HOUSE,LINKS,DASH])assert.doesNotMatch(r.reason,re);
  }
  const restore=installFakeDom();
  try{
    const fake={...lab,steps:function*(){yield {done:0,total:1,label:'Paired runs'};return {...good,controls:cases[0][1]};}};
    const view=createScaleLab({labs:[fake]});document.body.appendChild(view.element);
    const r=await view.run(),root=view.element;
    assert.equal(r.validity,'INVALID_EXPERIMENT');assert.equal(view.getState().result,r,'the record is the voided one');
    assert.equal(root.querySelector('.fl-readout'),null,'no verdict readout');assert.equal(root.querySelector('figure.fl-chart'),null,'no chart');
    assert.equal(root.querySelector('.teaching-run-line').textContent,'Invalid run: the null control did not read as declared, so there is no comparison. No result can be read.');
    assert.doesNotMatch(root.querySelector('.scale-result').textContent,/Advance to the next|ADVANCE_TO_NEXT_TEST|Improved beyond|Controls run with this test/);
    assert.match(root.querySelector('.result-provenance').textContent,/NOT_EVIDENCE; simulation-only; decision authority NONE\.$/);
    assert.equal(root.querySelector('[role="status"]').textContent,'Recorded as invalid. This press has no reading.');
  }finally{restore();}
});

test('a number never reads as equal to, or across, the threshold it is judged against',async()=>{
  const {metricValueText}=await import('../src/ui/experiment.js');
  const rows=[['idle weeks per ordered place',13.04,[13],'+13.04'],['idle weeks per ordered place',12.96,[13],'+12.96'],['in-service fraction of plan',.02004,[-.02,.02],'+0.02004'],['in-service fraction of plan',.1847,[-.02,.02],'+0.185'],['x',13.0000000000001,[13],'+13.000000000001'],['x',5,[5],'+5.0'],['x',-2.96,[-3,3],'-2.96'],['x',-1800.0000000000002,[-1800,1800],'-1,800.000000000001'],['wait.p90_s',-1800.0000000000002,[-1800,1800],'-1,800.000000000001 s'],
    ['late responder call fraction',.00003417167851284857,[.05],'+0.000034'],['completed trips per 100 car-hours in hours 5 to 8',.04166666666666572,[-3,3],'+0.042'],['x',-.04166666666666572,[],'-0.042'],['x',1.8189894035458565e-12,[],'+0.000000000002'],['x',-3e-14,[],'-0.000000000001'],['in-service fraction of plan',.000049,[.00005],'+0.000049'],['x',0,[0],'0.0'],['x',12345.04,[12345],'+12,345.04'],['x',5.04,[NaN,undefined,null,Infinity],'+5.0'],['x',-0,[-3,3],'0.0']];
  for(const [name,value,against,text] of rows){assert.equal(metricValueText(name,value,{withSign:true,against}),text);}
  const restore=installFakeDom();
  try{
    const lab=SCALE_LABS[0],frozen=lab.derive(lab.defaults()).setup.main,m=frozen.spec.margin;
    const fake={...lab,id:lab.id,steps:function*(){return yield* scalePairSteps(frozen,function*(arm,seed){yield;return {...Object.fromEntries(frozen.spec.guardrails.map(g=>[g.metric,.001])),[frozen.spec.primary.name]:arm===frozen.spec.baseline?0:(m-.002)+seed%2*1e-9};});}};
    const view=createScaleLab({labs:[fake]});document.body.appendChild(view.element);
    const r=await view.run(),line=view.element.querySelector('.teaching-run-line').textContent;
    assert.equal(r.validity,'VALID');
    const low=Number(line.match(/95% interval ([-+]?[\d,.]+)/)[1].replace(/[,+]/g,''));
    assert.ok(Math.abs(low)<m,`the printed bound ${low} stays inside the margin ${m}: ${line}`);assert.match(line,/^Within the margin/);
    assert.doesNotMatch(view.element.textContent,/rider draw|cars riders needed/);
    // A result that is not decided: the reading line, the next test and the gate chain name no seed the reader cannot add.
    const wide={...lab,steps:function*(){return yield* scalePairSteps(frozen,function*(arm,seed){yield;return {...Object.fromEntries(frozen.spec.guardrails.map(g=>[g.metric,.001])),[frozen.spec.primary.name]:arm===frozen.spec.baseline?0:seed%2?3*m:-m};});}};
    const open=createScaleLab({labs:[wide]});document.body.appendChild(open.element);
    const u=await open.run(),text=open.element.querySelector('.scale-result').textContent;
    assert.equal(u.analysis.outcome,'INCONCLUSIVE');assert.doesNotMatch(text,/more paired seeds|Add paired seeds|seed set/i);
    assert.match(text,/ No direction is read\./);assert.match(text,/test a larger step, as this page holds its paired seeds fixed/);
  }finally{restore();}
});

test('every refusal a reader can reach or type prints in the absence form inside 240 characters',()=>{
  const restore=installFakeDom();
  try{
    for(const lab of SCALE_LABS){
      const view=createScaleLab({labs:[lab]}),alert=view.element.querySelector('[role="alert"]');document.body.appendChild(view.element);
      const axes=lab.controls.map(c=>c.options?[...c.options.map(o=>o[0]),'other']:[...Array.from({length:Math.round((c.max-c.min)/c.step)+5},(_,i)=>Number((c.min+(i-2)*c.step).toFixed(6))),NaN]);
      let refused=0;
      const walk=(i,config)=>{
        if(i<axes.length){for(const v of axes[i])walk(i+1,{...config,[lab.controls[i].key]:v});return;}
        const d=lab.derive(config);if(d.ok)return;
        refused++;const shown=`Not available: outside what this lab can read: ${d.reason}.`;
        assert.ok(shown.length<=240,`${lab.id} ${shown.length}: ${shown}`);
        for(const p of [H3,H6,V,DIRECTION,HOUSE,LINKS,DASH])assert.doesNotMatch(shown,p,`${lab.id}: ${shown}`);
        assert.doesNotMatch(d.reason,/undefined|NaN|null|_/);
      };
      walk(0,{});assert.ok(refused>0,`${lab.id} refuses a typed value outside its ranges`);
      const c=lab.controls[0],input=view.element.querySelector(`[aria-label="${c.label}"]`);
      input.value=c.options?'':String(c.max+50*c.step);input.dispatchEvent(new Event('change'));
      assert.match(alert.textContent,/^Not available: outside what this lab can read: .{11,}\.$/);
      view.destroy();
    }
  }finally{restore();}
});

test('the declared test says before any run that the interval label is nominal at its seed count',()=>{
  const restore=installFakeDom();
  try{
    for(const lab of SCALE_LABS){
      const view=createScaleLab({labs:[lab]});document.body.appendChild(view.element);
      const setup=view.element.querySelector('.scale-setup');
      assert.match(setup.textContent,/The 95% interval is a bootstrap label, nominal at this seed count\./,lab.id);
      assert.match(setup.textContent,new RegExp(`Paired seeds ${lab.seeds.join(', ')}\\.`),lab.id);
      view.destroy();
    }
  }finally{restore();}
});

test('the packed page presses Run for every lab and records what the native module records (FLEET_PLAYGROUND_PERF=1)',{skip:process.env.FLEET_PLAYGROUND_PERF!=='1'&&'set FLEET_PLAYGROUND_PERF=1'},async()=>{
  // The Fleet day engine clones its configuration, so the packed page needs structuredClone, as every browser gives it.
  const context=vm.createContext({console,performance,setTimeout,clearTimeout,URL,URLSearchParams,Blob,structuredClone}),uninstall=installFakeDom(context),document=uninstall.dom.document;
  const shell=document.createElement('div'),strip=document.createElement('div');shell.id='fleetlab-root';strip.id='fleetlab-teaching-strip';shell.append(strip);document.body.append(shell);
  context.Worker=class{constructor(){queueMicrotask(()=>this.onmessage?.({data:{type:'ready'}}));}postMessage(){}terminate(){}};
  const app=new vm.Script(/<script>\n([\s\S]*)\n<\/script>/.exec(buildHtml(fileURLToPath(new URL('../',import.meta.url))))[1]).runInContext(context);
  await app.host.ready;
  try{
    for(const lab of SCALE_LABS){
      app.studio.applyRoute(`#/scale-lab?lesson=${lab.id}`);
      assert.equal(app.studio.element.getAttribute('data-page'),'scale');assert.equal(app.studio.scale.getState().lab,lab.id);
      const packed=await app.studio.scale.run(),native=drain(lab.steps(lab.derive(lab.defaults()).setup)),root=app.studio.scale.element;
      assert.ok(packed,`${lab.id}: ${root.querySelector('[role="alert"]').textContent}`);assert.equal(packed.validity,'VALID');
      assert.equal(scaleJson(JSON.parse(JSON.stringify(packed))),scaleJson(JSON.parse(JSON.stringify(native))),`${lab.id}: the packed record equals the native record`);
      assert.ok(root.querySelector('.fl-readout')&&root.querySelector('figure.fl-chart'));assert.equal(root.querySelector('[role="alert"]').hidden,true);
    }
  }finally{app.destroy();uninstall();}
});

test('every press stays inside its run budget and names its controls from the allowed set',()=>{
  for(const lab of SCALE_LABS){
    const setup=lab.derive(lab.defaults()).setup,r=drain(lab.steps(setup));
    if(r.work)assert.ok(Number.isInteger(r.work.engine_runs)&&r.work.engine_runs>=1&&r.work.engine_runs<=120,`${lab.id} engine runs`);
    if(lab.id==='density-ladder')assert.ok(r.work,'a lab on the Fleet day engine reports its engine runs');
    assert.equal(r.spec.control,null,`${lab.id} main comparison is not a control`);
    assert.ok(r.controls.some(c=>c.spec.control==='null'),`${lab.id} ships a null control`);
    for(const c of r.controls){assert.ok(['null','non-binding','guardrail'].includes(c.spec.control),`${lab.id} ${c.spec.control}`);assert.equal(c.validity,'VALID');assert.ok(c.analysis.guardrail_statuses.every(g=>g.status!=='NOT_EVALUABLE'));}
    assert.ok(r.analysis.guardrail_statuses.every(g=>g.status!=='NOT_EVALUABLE'),`${lab.id} no valid record holds a guardrail that was not evaluated`);
  }
});

// Fixes after the independent review. Each case names the finding it holds.
// A lab whose press is built on the shared contract alone, under the declared test of a shipped lab. `delta` is candidate
// minus baseline of the primary by seed, `harm` the harm of every guardrail, both in the unit of the measure.
const shaped=(lab,{delta=()=>0,harm=0,extra={}}={})=>({...lab,steps:function*(setup){
  const spec=setup.main.spec;
  return {...(yield* scalePairSteps(setup.main,function*(arm,seed){yield;const tested=arm!==spec.baseline;return {[spec.primary.name]:tested?delta(seed,spec):0,...Object.fromEntries(spec.guardrails.map(g=>[g.metric,tested?(g.direction==='lower_is_better'?1:-1)*harm*(g.max_harm||1):0]))};})),...extra};
}});
const shown=async lab=>{const view=createScaleLab({labs:[lab]});document.body.appendChild(view.element);const r=await view.run();return {view,r,root:view.element};};

// Text of the pages that existed before the Scale lab, pinned once from the two interface modules as they were before it.
// The inputs and the way each text is taken are in test/helpers/legacy-text.mjs; the pins file names where it came from.
const LEGACY=JSON.parse(readFileSync(new URL('./scale-lab.legacy-text.pins.json',import.meta.url),'utf8'));

test('C8: pages that existed before the Scale lab print what they printed before it, on every surface',()=>{
  const restore=installFakeDom();
  try{
    const now=legacyText(experiment,frames);
    assert.ok(Object.keys(LEGACY.texts).length>=900);assert.deepEqual(Object.keys(now.texts),Object.keys(LEGACY.texts));
    for(const [key,[value,minutes]] of Object.entries(LEGACY.texts)){assert.equal(now.texts[key][0],value,`metricValueText ${key}`);assert.equal(now.texts[key][1],minutes,`valueWithMinutes ${key}`);}
    assert.equal(now.views.length,LEGACY.views.length);
    now.views.forEach((view,i)=>{
      const was=LEGACY.views[i];assert.equal(view.name,was.name);
      assert.deepEqual(view.lines,was.lines,`runLine ${view.name}`);
      assert.deepEqual(view.readouts,was.readouts,`readout ${view.name}: regenerate the old text to see the difference`);
      assert.equal(view.card,was.card,`card ${view.name}: regenerate the old text to see the difference`);
    });
    // A readout that says it is plotted is the readout of before, whatever else it is given.
    const strip=()=>{const n=document.createElement('figure');n.setAttribute('data-role','strip');return n;};
    for(const view of LEGACY_VIEWS.filter(v=>v.primary))assert.equal(serialize(experiment.renderVerdictReadout(view,{strip:strip(),plotted:true})),serialize(experiment.renderVerdictReadout(view,{strip:strip()})));
    // The card names one number once: its rows, its reading line and its hidden summary agree, as they did.
    const card=experiment.renderVerdictCard(LEGACY_VIEWS[0]);
    assert.equal(card.querySelector('[data-field="primary.ci_high"]').textContent,'-30.0 s');assert.match(card.querySelector('.teaching-run-line').textContent,/to -30\.0 s; margin 30 s/);assert.match(card.querySelector('[data-section="primary"] .fl-sr-only').textContent,/to -30\.0 s, so the outcome is IMPROVED\.$/);
  }finally{restore();}
});

test('contract 2: sided numbers keep their side, stay short and are asked for; the Scale lab asks',async()=>{
  const {metricValueText,valueWithMinutes}=experiment;
  // A deterministic sweep: values near and far from thresholds, tiny and large, of every unit family.
  let seed=20260927;const rand=()=>(seed=(seed*1664525+1013904223)>>>0)/2**32;
  for(let i=0;i<4000;i++){
    const t=[0,.01,.02,.05,3,13,30,861.558,1800,12345][i%10],d=[0,1e-13,1e-9,4e-7,.0004,.04,.3,7][i%8]*(rand()<.5?-1:1)*rand(),value=i%3?t+d:d*1e3,against=i%2?[-t,t]:[t],name=['x','in-service fraction of plan','wait.p90_s'][i%3];
    const text=metricValueText(name,value,{withSign:true,against}),shown=Number(text.replace(/[,+]| s$/g,''));
    assert.match(text,/^[-+]?\d{1,3}(,\d{3})*\.\d{1,12}( s)?$/,`${value} prints grouped, in plain decimals, with at most 12 of them: ${text}`);
    for(const x of against)assert.equal(Math.sign(shown-x)||0,Math.sign(value-x)||0,`${value} against ${x} reads ${text}`);
    assert.equal(shown===0,value===0,`${value} reads ${text}`);
    assert.equal(text.startsWith('-'),value<0);assert.equal(text.startsWith('+'),value>0);
  }
  // Away from every threshold a sided number is the number the site always printed, ties of the rounding included.
  let same=0;
  for(let i=0;i<3000;i++){
    const value=(i%4?Math.round((rand()-.5)*2e6)/[8,16,1000,7][i%4]:(rand()-.5)*10**(i%9-3)),name=['x','in-service fraction of plan','wait.p90_s'][i%3],plain=metricValueText(name,value,{withSign:i%2===0});
    if(/[1-9]/.test(format.number(value,i%3===1?3:1))||value===0){same++;assert.equal(metricValueText(name,value,{withSign:i%2===0,against:[]}),plain,`${value}`);}
  }
  assert.ok(same>2500,String(same));
  assert.equal(valueWithMinutes('wait.p90_s',-1799.98,{withSign:true,against:[-1800,1800]}),'-1,799.98 s (-29.9997 min)','the minutes keep the side the seconds keep');
  assert.equal(valueWithMinutes('in-service fraction of plan',.02004,{withSign:true,against:[-.02,.02]}),'+0.02004');
  const restore=installFakeDom();
  try{
    // The Scale view opts in: a harm and an interval end within half a display unit of their thresholds.
    const lab=SCALE_LABS.find(l=>l.id==='fleet-intake'),{root,r}=await shown(shaped(lab,{delta:(s,spec)=>spec.margin+.00004+s%2*1e-9,harm:1.003}));
    assert.equal(r.analysis.outcome,'IMPROVED');
    const harm=root.querySelector('.fl-readout [data-field="harm"]').textContent,low=root.querySelector('.fl-readout [data-field="primary.ci_low"]').textContent;
    assert.equal(harm,'+13.04');assert.equal(low,'+0.02004');
    assert.ok(root.querySelector('.teaching-run-line').textContent.includes(`95% interval ${low} to `),'the reading line and the readout print one text');
    assert.ok(root.querySelector('.fl-readout [data-role="outcome-sentence"]').textContent.includes(`runs from ${low} to `),'the outcome sentence prints the same text');
  }finally{restore();}
});

test('C6: a three-line ladder gives every series its own legend swatch and its own drawing, with no dash and no colour alone',()=>{
  const restore=installFakeDom();try{
    const node=ladderChart({title:'t',chips:[{kind:'replay',seed:1}],summary:'This replay: x.',limits:['l'],axisUnit:'vehicles',categoryLabel:'Week',gapLabel:'g',categories:['1','2','3'],series:['a','b','c'].map((id,k)=>({id,label:id,mark:'line',values:[k,k+1,k+2]})),text:String,tick:String}).node;
    const items=[...node.querySelectorAll('[data-role="legend"] li')],shape=n=>`${n.localName}|${n.getAttribute('class')}|${n.getAttribute('style')}`;
    assert.deepEqual(items.map(li=>li.getAttribute('data-swatch')),['line','line-ring','line-square']);
    const swatches=items.map(li=>[...li.querySelectorAll('svg *')].map(shape).join(';'));
    assert.equal(new Set(swatches).size,3,swatches.join(' / '));
    assert.deepEqual([...items[2].querySelectorAll('svg *')].map(n=>n.localName),['line','rect'],'the third swatch is a line with a square marker');
    const drawn=['a','b','c'].map(id=>[...new Set([...node.querySelectorAll(`[data-role="marks"] [data-series="${id}"]`)].map(shape))].join(';'));
    assert.equal(new Set(drawn).size,3,drawn.join(' / '));
    assert.deepEqual([...node.querySelectorAll('[data-series="c"][data-role="point"]')].map(n=>n.localName),['rect','rect','rect'],'the third line has square points');
    assert.deepEqual([...node.querySelectorAll('[data-series="a"][data-role="point"]')].map(n=>n.localName),['circle','circle','circle']);
    // Shape, not ink: with every colour taken out of the legend the first and the third swatch still differ.
    const bare=items.map(li=>[...li.querySelectorAll('svg *')].map(n=>n.localName).join(';'));assert.equal(new Set(bare).size,3,`every pair of swatches differs by shape: ${bare.join(' / ')}`);
    const ring=[...node.querySelectorAll('[data-series="b"][data-role="point"]')];assert.equal(ring.length,3);for(const n of ring){assert.equal(n.localName,'circle');assert.match(n.getAttribute('style'),/fill: var\(--panel\); stroke: var\(--muted\)/,'the second line has hollow points, the first has filled ones');}
    for(const n of node.querySelectorAll('*')){assert.equal(n.hasAttribute('stroke-dasharray'),false);assert.doesNotMatch(n.getAttribute('style')??'',/dash|#[0-9a-f]{3,8}\b|rgb|hsl/i);}
  }finally{restore();}
});

test('C12: a ladder draws every bar before every line and point, and keeps legend order, mark style and table order',()=>{
  const restore=installFakeDom();try{
    const chart=ladderChart({title:'t',chips:[{kind:'across',count:2}],summary:'Across 2 paired seeds: x.',limits:['l'],axisUnit:'u',categoryLabel:'c',gapLabel:'g',categories:['a','b','c'],
      series:[{id:'one',label:'One',mark:'line',values:[1,2,3]},{id:'two',label:'Two',mark:'line',values:[3,2,{absent:'this rung has not run yet'}]},{id:'bars',label:'Bars',mark:'bar',values:[2,4,6]}],text:String,tick:String});
    const marks=[...chart.node.querySelector('[data-role="marks"]').children].filter(n=>n.getAttribute('data-series')),bar=n=>n.localName==='rect'&&n.getAttribute('data-role')===null;
    assert.equal(marks.filter(bar).length,3);
    assert.ok(marks.findLastIndex(bar)<marks.findIndex(n=>!bar(n)),`a bar is drawn after a line or point: ${marks.map(n=>n.getAttribute('data-series')).join(' ')}`);
    assert.deepEqual([...chart.node.querySelectorAll('[data-role="legend"] li')].map(n=>n.textContent),['One','Two','Bars','g'],'the legend keeps the given order');
    assert.deepEqual([...chart.node.querySelectorAll('[data-role="legend"] li')].map(n=>n.getAttribute('data-swatch')),['line','line-ring','bar-hollow','hatch']);
    assert.equal(marks.find(bar).getAttribute('style'),'fill: var(--panel); stroke: var(--ink); stroke-width: 1px','the third series keeps the third mark');
    assert.deepEqual([...chart.node.querySelectorAll('[data-view="table"] thead th')].map(n=>n.textContent),['c','One','Two','Bars']);
    assert.deepEqual([...chart.node.querySelectorAll('[data-view="table"] tbody tr')].map(tr=>[...tr.children].map(c=>c.textContent)),[['a','1','3','2'],['b','2','2','4'],['c','3','not available: this rung has not run yet','6']]);
  }finally{restore();}
});

test('M8: category labels of up to 12 characters never overlap at a drawing width of 339 px, and thin no points of a short ladder',()=>{
  const restore=installFakeDom(),observers=[];
  globalThis.ResizeObserver=class{constructor(callback){this.callback=callback;this.targets=[];observers.push(this);}observe(target){this.targets.push(target);}unobserve(){}disconnect(){}};
  try{
    // The label class is 12 px; a character is taken as at most 0.6 em wide.
    const WIDE=.6*12,css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
    assert.match(css,/\.fl-small-label \{[^}]*font-size: 12px/);
    for(const [count,label] of [[5,i=>`${24*(i+1)} cars, 5s`],[5,i=>`${24*(i+1)} cars`],[3,()=>'123456789012'],[2,()=>'twelve chars'],[9,()=>'twelve chars'],[24,()=>'twelve chars'],[60,()=>'twelve chars'],[52,i=>String(i+1)]]){
      const categories=Array.from({length:count},(_,i)=>label(i));assert.ok(categories.every(c=>c.length<=12));
      const chart=ladderChart({title:'t',chips:[{kind:'across',count:2}],summary:'Across 2 paired seeds: x.',limits:['l'],axisUnit:'u',categoryLabel:'c',gapLabel:'g',categories,series:[{id:'a',label:'A',mark:'line',values:categories.map((_,i)=>i)}],text:String,tick:String});
      const box=chart.node.querySelector('[data-view="chart"]');observers.at(-1).callback([{target:box,contentRect:{width:339}}]);
      const plot=box.querySelector('svg'),width=Number(plot.getAttribute('data-draw-width')),at=[...plot.querySelectorAll('[data-role="category"]')].map(n=>({x:Number(n.getAttribute('x')),w:n.textContent.length*WIDE,text:n.textContent}));
      assert.equal(width,336);assert.ok(at.length>=2||count*12*WIDE>width,`${count} labels: ${at.length} drawn`);assert.equal(at[0].text,categories[0]);
      for(let i=1;i<at.length;i++)assert.ok(at[i].x-at[i-1].x>=(at[i].w+at[i-1].w)/2,`${count} labels of ${categories[0].length} characters: "${at[i-1].text}" at ${at[i-1].x} and "${at[i].text}" at ${at[i].x} overlap`);
      for(const a of at)assert.ok(a.x-a.w/2>=0&&a.x+a.w/2<=width+16,`"${a.text}" stays inside the drawing and its right margin of 16 px`);
      if(count===5)assert.equal(plot.querySelectorAll('[data-role="point"]').length,5,'a rung keeps its point when its label is thinned');
    }
  }finally{delete globalThis.ResizeObserver;restore();}
});

test('C13: the verdict readout cannot widen the Scale lab page',()=>{
  const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8'),rules=css.slice(css.indexOf('*/'));
  assert.match(rules,/\.scale-lab \.fl-readout\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/,'its table scrolls inside .fl-scroll');
  assert.match(rules,/\n\.fl-readout \{ display: grid; gap: 8px; \}/,'the shared readout of the other pages stays as it is');
});

test('C9: a lab that reads the road map shows the map credit on the page in every state, and a lab that does not shows none',async()=>{
  const restore=installFakeDom();
  try{
    const credit='Road distances in this lab come from the frozen Fleet day road table. Distances only; no service in those places is described.',href='https://www.openstreetmap.org/copyright';
    assert.ok(credit.length<=160);
    const base=SCALE_LABS.find(l=>l.controls.some(c=>!c.options)),control=base.controls.find(c=>!c.options);
    const mapped={...shaped(base,{delta:(s,spec)=>5*spec.margin*(spec.primary.direction==='lower_is_better'?-1:1)+s%2}),map:true,credit},plain={...SCALE_LABS.find(l=>l!==base),map:undefined,credit:undefined},worded={...plain,id:SCALE_LABS.find(l=>l!==base&&l.id!==plain.id).id,credit:'Every distance in this lab is invented.'};
    const view=createScaleLab({labs:[mapped,plain,worded]}),root=view.element;document.body.appendChild(root);
    const link=()=>[...root.querySelectorAll('a')].find(a=>a.getAttribute('href')===href);
    const held=when=>{
      const a=link();assert.ok(a,`${when}: the credit links the copyright page`);
      assert.equal(a.textContent,'© OpenStreetMap contributors');assert.equal(a.getAttribute('target'),'_blank');assert.equal(a.getAttribute('rel'),'noopener noreferrer');
      assert.equal(a.parentNode.textContent,`© OpenStreetMap contributors · ODbL. ${credit}`,when);
      assert.equal(a.closest('details'),null,`${when}: outside every disclosure`);assert.ok(visible(root).includes(credit),`${when}: visible with every disclosure closed`);
    };
    held('before a run');
    for(const re of [H3,H6,V,DIRECTION,HOUSE,LINKS,DASH])assert.doesNotMatch(link().parentNode.textContent,re,'the credit follows the copy rules of text shown before a run');
    const pending=view.run();held('while a press computes');await pending;assert.ok(view.getState().result);held('after a run');
    const input=root.querySelector(`[aria-label="${control.label}"]`);
    input.value=String(control.max+50);input.dispatchEvent(new Event('change'));
    assert.equal(root.querySelector('[role="alert"]').hidden,false);assert.equal(root.querySelectorAll('.scale-setup table').length,0,'the refusal empties the inputs table');
    assert.match(root.querySelector('.scale-result').textContent,/This result used the previous setup/);held('while a setup is refused, beside a stale result');
    input.value=String(control.min);input.dispatchEvent(new Event('change'));assert.equal(view.getState().stale,true);held('beside a stale result');
    view.setLesson(plain);assert.equal(link(),undefined);assert.doesNotMatch(visible(root),/OpenStreetMap|ODbL|Road distances in this lab/);
    view.setLesson(worded);assert.equal(link(),undefined);assert.ok(visible(root).includes('Every distance in this lab is invented.'));assert.doesNotMatch(visible(root),/OpenStreetMap|ODbL/);
    view.setLesson(mapped);held('on the way back');
    view.destroy();
    for(const lab of SCALE_LABS){assert.ok(lab.credit===undefined||typeof lab.credit==='string'&&lab.credit.length<=160&&lab.credit.endsWith('.'),`${lab.id} credit`);if(lab.credit)for(const re of [H3,H6,V,DIRECTION,HOUSE,LINKS,DASH])assert.doesNotMatch(lab.credit,re);}
  }finally{restore();}
});

test('M10, M24, M19: every reading line fits 240 characters with its interval, and every next test is one the page can honour',async()=>{
  const restore=installFakeDom();
  try{
    let undecided=0,held=0;const long=[],cut=[],next=[],sides=[];
    for(const lab of SCALE_LABS){
      const up=lab.derive(lab.defaults()).setup.main.spec.primary.direction==='higher_is_better'?1:-1;
      // Numbers as wide as the widest a shipped press prints: thousands with a decimal.
      const wide=(s,spec)=>12345.6*(spec.margin<1?1e-4:1),cases={IMPROVED:{delta:(s,spec)=>up*(wide(s,spec)+s%2)},REGRESSED:{delta:(s,spec)=>-up*(wide(s,spec)+s%2)},UNCHANGED:{delta:(s,spec)=>(s%2-.5)*spec.margin/4},INCONCLUSIVE:{delta:(s,spec)=>spec.margin+(s%2?1:-1)*wide(s,spec)}};
      for(const [outcome,press] of Object.entries(cases))for(const harm of [0,1.5]){
        const {r,root,view}=await shown(shaped(lab,{...press,harm})),line=root.querySelector('.teaching-run-line').textContent,step=root.querySelector('.teaching-result h4').nextSibling.textContent,name=`${lab.id} ${outcome} ${r.analysis.recommendation}`;
        assert.equal(r.analysis.outcome,outcome,name);assert.equal(r.analysis.guardrail_regressions.length>0,harm>0,name);
        if(outcome==='INCONCLUSIVE')undecided++;if(r.analysis.recommendation==='HOLD')held++;
        if(line.length>240)long.push(`${name}: ${line.length} characters: ${line}`);
        if(!/\(95% interval [-+]?[\d,.]+ to [-+]?[\d,.]+; margin [\d,.]+\)\./.test(line)||/Exact values/.test(line))cut.push(`${name}: ${line}`);
        if(/Relieve|both declared|as its own change|Fix the invalid|seed set|another rider|rider draw|Keep the current setting/i.test(step)||step.length>160||!step.endsWith('.'))next.push(`${name}: ${step}`);
        if(/\b(left|right)\b|of the band/.test(root.querySelector('.fl-readout [data-section="primary"]').textContent))sides.push(name);
        assert.doesNotMatch(line,/NaN|undefined|_/,name);
        for(const re of [H3,H6,HOUSE,LINKS,DASH])assert.doesNotMatch(`${line} ${step}`,re,name);
        view.destroy();
      }
    }
    assert.equal(undecided,2*SCALE_LABS.length);assert.ok(held>=4*SCALE_LABS.length);
    assert.deepEqual(long,[],'a reading line is over 240 characters');assert.deepEqual(cut,[],'a reading line lost its interval');
    assert.deepEqual(next,[],'a next test names what the page cannot offer');assert.deepEqual(sides,[],'a readout names a side of a picture that is not drawn');
    // A press that cannot be read names a next step the page offers.
    const {root}=await shown(shaped(SCALE_LABS[0],{extra:{validity:'INVALID_EXPERIMENT',reason:'a required measure was not available in a run, so there is no comparison',analysis:null}}));
    assert.doesNotMatch(root.querySelector('.teaching-result').textContent,/Fix the invalid run/);
  }finally{restore();}
});

test('M10, M24: a sided reading line that is still too long drops its guardrail sentence and keeps its interval',()=>{
  // Every number within a billionth of a threshold, so each prints at its longest, under the longest shipped measure name.
  const names=SCALE_LABS.flatMap(l=>{const spec=l.derive(l.defaults()).setup.main.spec;return [spec.primary.name,...spec.guardrails.map(g=>g.metric)];}),metric=names.reduce((a,b)=>b.length>a.length?b:a);
  assert.ok(metric.length>=42);
  const r={validity:'VALID',outcome:'INCONCLUSIVE',recommendation:'RUN_MORE_EXPERIMENTS',primary:{metric,mean_delta:861.5580000004,ci_low:-861.5579999996,ci_high:12345.6000004,equivalence_margin:861.558},guardrails:[{metric:names[0],status:'WITHIN'}]},frame=LESSON_FRAMES[SCALE_LABS[0].id];
  const sided=runLine(frame,r,{...teachingTools,sided:true}).line,plain=runLine(frame,r,teachingTools).line;
  assert.ok(sided.length<=240,`${sided.length}: ${sided}`);
  const kept=/ \+861\.5580000004 \(95% interval -861\.5579999996 to \+12,345\.60*; margin 861\.558\)\./;
  assert.match(sided,kept);assert.doesNotMatch(sided,/guardrail|Exact values/);
  assert.match(sided,/ Run more paired seeds before reading a direction\.$/);
  assert.match(plain,/; interval and margin under Exact values\. Every guardrail stayed within its allowance\./,'a page that did not ask keeps the line it had');
  const harmed=runLine(frame,{...r,recommendation:'HOLD',guardrails:[{metric:names[0],status:'REGRESSED'}]},{...teachingTools,sided:true}).line;
  assert.ok(harmed.length<=240,harmed);assert.match(harmed,kept);assert.match(harmed,/allowance/,'a harmed guardrail stays named while the line has room');
});

test('M11: a control changed back to the value the result used does not mark the result as from another setup',async()=>{
  const restore=installFakeDom();
  try{
    const base=SCALE_LABS.find(l=>l.controls.some(c=>!c.options)),control=base.controls.find(c=>!c.options),{view,root}=await shown(shaped(base,{delta:(s,spec)=>s%2*spec.margin}));
    const input=root.querySelector(`[aria-label="${control.label}"]`),status=root.querySelector('[role="status"]'),used=input.value,set=v=>{input.value=String(v);input.dispatchEvent(new Event('change'));};
    const other=[control.min,control.max].find(v=>String(v)!==String(used)&&base.derive({...base.defaults(),[control.key]:v}).ok);
    set(other);assert.equal(view.getState().stale,true);assert.match(root.querySelector('.scale-result').textContent,/This result used the previous setup/);assert.match(status.textContent,/^Setup changed\./);
    set(used);assert.equal(view.getState().stale,false,'the setup on the page is the one the result used');
    assert.doesNotMatch(root.querySelector('.scale-result').textContent,/previous setup/);assert.equal(status.textContent,'Recorded. Read the result, then the declared test behind it.');
    set(control.max+50);assert.equal(view.getState().stale,true,'a refused setup is another setup');set(used);assert.equal(view.getState().stale,false);
  }finally{restore();}
});

test('M12, M13: one meter per press that only rises, and a press that is no longer the current job says nothing',async()=>{
  const restore=installFakeDom();
  try{
    const seen=[],phases=[['Ladder runs',6],['Paired runs',4],['Paired bootstrap',1],['Replay control',4],['Control with room',4]];let meter=null,status=null,stop=false;
    const slow={...SCALE_LABS[0],steps:function*(setup){for(const [label,total] of phases)for(let done=0;done<=total;done++){yield {done,total,label};seen.push([meter.value,status.textContent]);}if(stop)for(;;)yield {done:0,total:1,label:'Later runs'};return yield* shaped(SCALE_LABS[0],{delta:(s,spec)=>s%2*spec.margin}).steps(setup);}};
    const view=createScaleLab({labs:[slow,SCALE_LABS[1]]}),root=view.element;document.body.appendChild(root);
    meter=root.querySelector('.scale-run progress');status=root.querySelector('[role="status"]');const cancel=root.querySelectorAll('.scale-run button')[1];
    assert.ok(await view.run());
    const values=seen.map(s=>Number(s[0]));
    assert.equal(values.length,24);assert.deepEqual(seen.map(s=>s[1]).filter((t,i,a)=>t!==a[i-1]).slice(0,8),['Ladder runs: 0 of 6.','Ladder runs: 1 of 6.','Ladder runs: 2 of 6.','Ladder runs: 3 of 6.','Ladder runs: 4 of 6.','Ladder runs: 5 of 6.','Ladder runs: 6 of 6.','Paired runs: 0 of 4.'],'the status names the phase');
    for(let i=1;i<values.length;i++)assert.ok(values[i]>=values[i-1],`the meter fell from ${values[i-1]} to ${values[i]} at "${seen[i][1]}"`);
    assert.ok(values[0]===0&&values.at(-1)<1&&values.at(-1)>values[0]&&new Set(values).size>=19,'it rises through every phase and is full only when the press ends');
    // A lab switch during a press: the new lab shows its own idle state, and the old press reports nothing more.
    stop=true;seen.length=0;const pending=view.run();
    await new Promise(done=>setTimeout(done,30));assert.ok(seen.length>0);assert.equal(cancel.hidden,false);
    view.setLesson(SCALE_LABS[1]);
    const idle='Nothing has run yet. Press Run the paired test.',rest=()=>{assert.equal(status.textContent,idle);assert.equal(cancel.hidden,true);assert.equal(meter.hidden,true);assert.equal(view.getState().busy,false);assert.equal(root.querySelector('.scale-run button').getAttribute('aria-disabled'),'false');assert.equal(root.querySelector('figure.fl-chart'),null);};
    rest();assert.equal(await pending,undefined);rest();
    await new Promise(done=>setTimeout(done,20));rest();assert.equal(view.getState().lab,SCALE_LABS[1].id);assert.equal(view.getState().result,null);
    view.destroy();
  }finally{restore();}
});

test('M25: an error thrown while a recorded result is rendered reaches the alert region in words and records nothing',async()=>{
  const restore=installFakeDom();
  try{
    let broken=false;const good=shaped(SCALE_LABS[0],{delta:(s,spec)=>s%2*spec.margin}),lab={...good,steps:function*(setup){const r=yield* good.steps(setup);return broken?{...r,tables:[{caption:'A table',heads:['A'],rows:[[{absent:' '}]]}]}:r;}};
    const view=createScaleLab({labs:[lab]}),root=view.element,alert=root.querySelector('[role="alert"]'),status=root.querySelector('[role="status"]');document.body.appendChild(root);
    const first=await view.run();assert.ok(first);assert.equal(alert.hidden,true);
    broken=true;assert.equal(await view.run(),undefined,'a record that cannot be shown is not handed out');
    assert.equal(alert.hidden,false);assert.match(alert.textContent,/^The lab could not show its result: .{10,}/);assert.doesNotMatch(alert.textContent,/undefined|\[object/);
    assert.equal(status.textContent,'No result was recorded from this press.');
    assert.equal(view.getState().result,first,'the previous result stays');assert.equal(view.getState().busy,false);
    assert.ok(root.querySelector('.fl-readout')&&root.querySelector('.teaching-exact'),'the previous result is shown whole');
    const rest=()=>{assert.equal(root.querySelector('.scale-run progress').hidden,true);assert.equal(root.querySelectorAll('.scale-run button')[1].hidden,true);assert.equal(root.querySelector('.scale-run button').getAttribute('aria-disabled'),'false');assert.equal(view.getState().busy,false);};rest();
    // A record that cannot be read at all, and a lab that hands back nothing, fail the same way.
    const odd=value=>{const v=createScaleLab({labs:[{...good,steps:function*(){yield {done:0,total:1,label:'Paired runs'};return value;}}]});document.body.appendChild(v.element);return v;};
    for(const value of [undefined,null,{controls:[{}]},{validity:'VALID'}]){const v=odd(value);assert.equal(await v.run(),undefined);const a=v.element.querySelector('[role="alert"]');assert.equal(a.hidden,false,String(value));assert.match(a.textContent,/^The lab could not show its result: .{5,}/);assert.equal(v.getState().busy,false);assert.equal(v.getState().result,null);assert.equal(v.element.querySelector('[role="status"]').textContent,'No result was recorded from this press.');assert.equal(v.element.querySelectorAll('.scale-run button')[1].hidden,true);v.destroy();}
    view.destroy();
  }finally{restore();}
});

test('result tables expose a named keyboard scroll region on narrow screens',async()=>{
 const restore=installFakeDom();
 const view=createScaleLab({labs:[SCALE_LABS[1]]});
 document.body.appendChild(view.element);
 try{
  await view.run();
  const regions=view.element.querySelectorAll('.scale-result .fl-scroll');
  assert.ok(regions.length>0);
  for(const region of regions){
   assert.equal(region.getAttribute('tabindex'),'0','every result table can receive keyboard focus');
   assert.equal(region.getAttribute('role'),'region');
   assert.ok(region.getAttribute('aria-label'));
  }
 }finally{view.destroy();restore();}
});
