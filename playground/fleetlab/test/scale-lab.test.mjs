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
  assert.equal(cellText({v:0.00004,d:2}),'0.00004');
  assert.equal(cellText({absent:'this rung has not run yet'}),'not available: this rung has not run yet');
  assert.equal(cellText(undefined),'not available: no recorded value');
  assert.equal(fillText({t:'{a} of {b}',v:{a:{v:3,d:0},b:{absent:'no request'}}}),'3 of not available: no request');
});

function mount(){const restore=installFakeDom(),view=createScaleLab();document.body.appendChild(view.element);return {view,close(){view.destroy();restore();}};}

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
    }
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
  const rows=[['idle weeks per ordered place',13.04,[13],'+13.04'],['idle weeks per ordered place',12.96,[13],'+12.96'],['in-service fraction of plan',.02004,[-.02,.02],'+0.02004'],['in-service fraction of plan',.1847,[-.02,.02],'+0.185'],['x',13.0000000000001,[13],'+13.0000000000001'],['x',5,[5],'+5.0'],['x',-2.96,[-3,3],'-2.96']];
  for(const [name,value,against,text] of rows){assert.equal(metricValueText(name,value,{withSign:true,against}),text);assert.equal(metricValueText(name,value,{withSign:true,against:[]}),metricValueText(name,value,{withSign:true}),'no threshold, no change');}
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
    assert.match(text,/The interval crosses the margin at these paired seeds, so no direction is read\./);assert.match(text,/test a larger step, as this page holds its paired seeds fixed/);
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
