import {LESSON_FRAMES,NEXT_TEST,frameView,glossaryView,exactView,runLine,resultView} from './teaching-frames.js';
import {pairedProjection,teachingTools} from './teaching-projection.js';
import {displayText,setBusy} from './display-text.js';
import {modelHeader} from './model-identity.js';
import {renderVerdictReadout,thresholdText} from './experiment.js';
import {ladderChart} from './charts.js';
import {DIRECTIONS} from './labels.js';
import {nonzero,number,absent} from './format.js';
import {routeHref,followLink} from './routes.js';
import {runSliced,MAIN_SLICE_MS} from '../runtime/protocol.js';
import {SCALE_LABS} from './scale-labs.js';
import {readable} from '../model/scale-contract.js';
/** One generic view for every Scale lab. A lab descriptor owns its model, copy and numbers; this file owns none. */
import {el} from './dom.js';

/** Hands the page back between slices: scheduler.yield, else a message channel, else a zero-delay timer. */
export function yieldToPage(fn){
  const g=globalThis;
  if(typeof g.scheduler?.yield==='function'){g.scheduler.yield().then(fn);return;}
  if(typeof g.MessageChannel==='function'){const c=new g.MessageChannel();c.port1.onmessage=()=>{c.port1.close();fn();};c.port2.postMessage(0);return;}
  setTimeout(fn,0);
}
/** A cell is text, a number, `{v, d, u}` (value, decimals, unit words) or `{absent: reason}`. */
export function cellText(c){
  if(typeof c==='string')return displayText(c);
  if(typeof c==='number')return nonzero(c,Number.isInteger(c)?0:1);
  if(Number.isFinite(c?.v))return nonzero(c.v,c.d??0)+(c.u?' '+c.u:'');
  return absent(typeof c?.absent==='string'?c.absent:'no recorded value');
}
/** Text is a sentence or `{t, v}`: a template whose `{slot}` names are filled from cells. */
export const fillText=x=>typeof x==='string'?displayText(x):x.t.replace(/\{(\w+)\}/g,(_,k)=>cellText(x.v[k]));
const table=(caption,heads,rows)=>el('div',{class:'ops-table-wrap',tabindex:0,role:'region','aria-label':caption},el('table',{},[el('caption',{},caption),el('thead',{},el('tr',{},heads.map(h=>el('th',{scope:'col'},h)))),el('tbody',{},rows.map(r=>el('tr',{},r.map(c=>el('td',{},cellText(c))))))]));
const verdictOf=r=>({undecided:'the interval crosses the margin; test a larger step, as this page holds its paired seeds fixed',kind:'teaching',replications:r.replications,label:r.label,validity:r.validity,invalidityReason:null,invalidityDetail:null,outcome:r.analysis.outcome,recommendation:r.analysis.recommendation,primary:{...r.analysis.primary,direction:r.spec.primary.direction,equivalence_margin:r.spec.margin},deltas:[],guardrails:r.analysis.guardrail_statuses.map((g,i)=>({...g,direction:r.spec.guardrails[i].direction})),descriptives:r.analysis.descriptives,suppressed:[]});
/** The site's reading tools with next tests this page can honour: no rider, no car, and no seed set the reader cannot choose. */
const TOOLS={...teachingTools,more:'The interval crosses the margin at these paired seeds, so no direction is read.',next:{...NEXT_TEST,improved:'Move one input toward the edge of its range and run again, then read the measures no guardrail covered.',inconclusive:'Test a larger step of the same setting. This page holds its paired seeds fixed.',unchanged:'Check whether this change reached the limit that binds, then test the one that does.'}};
const tap=function*(steps,paint){try{for(;;){const s=steps.next();if(s.done)return s.value;if(s.value?.partial)paint(s.value.partial);yield s.value;}}finally{steps.return?.();}};

export function createScaleLab({labs=SCALE_LABS,hrefFor=id=>routeHref({page:'scale',lesson:id}),onLab=null}={}){
  let lab=labs[0],config=lab.defaults(),setup=null,result=null,stale=false,job=null,destroyed=false;
  const heading=el('h1',{class:'teaching-title',tabindex:-1}),frameSlot=el('div'),identitySlot=el('div');
  const links=labs.map(l=>el('a',{href:hrefFor(l.id),'data-lab':l.id,on:{click:e=>followLink(e,()=>onLab?onLab(l.id):setLesson(l))}},l.short));
  const status=el('p',{class:'ops-status',role:'status'}),error=el('p',{class:'ops-error',role:'alert',hidden:true});
  const runButton=el('button',{type:'button',class:'studio-button studio-button-primary',on:{click:()=>run()}},'Run the paired test');
  const cancelButton=el('button',{type:'button',class:'studio-button',hidden:true,on:{click:()=>cancel()}},'Cancel');
  const meter=el('progress',{max:1,value:0,hidden:true,'aria-label':'Progress of this press'});
  const fields=el('div',{class:'ops-fields'}),derived=el('div'),resultHeading=el('h2',{tabindex:-1},'Result'),reading=el('div'),chartSlot=el('div',{class:'scale-chart'}),records=el('div'),unknowns=el('ul');
  const element=el('main',{class:'scale-lab'},[
    el('section',{class:'ops-intro'},[el('p',{class:'eyebrow'},'SCALE LAB / WHAT CHANGES AS A FLEET SCALES'),el('nav',{class:'scale-chooser','aria-label':'Scale lab lessons'},links),frameSlot,el('details',{},[el('summary',{},'Exact values'),identitySlot]),
      el('div',{class:'ops-run-line scale-run'},[runButton,cancelButton,meter,status]),error,
      el('p',{class:'ops-status'},'Every input on this page is a teaching assumption. No value is a measurement of any fleet.')]),
    el('details',{class:'scale-setup'},[el('summary',{},'Change the setup and read the declared test'),fields,derived]),
    el('section',{class:'scale-result'},[resultHeading,reading,chartSlot,records]),
    el('details',{class:'teaching-limits'},[el('summary',{},'What this model cannot know'),unknowns]),glossaryView(),
  ]);
  const idle=()=>result?stale?'Setup changed. The result shown used the previous setup. Run again to replace it.':result.validity!=='VALID'?'Recorded as invalid. This press has no reading.':'Recorded. Read the result, then the declared test behind it.':'Nothing has run yet. Press Run the paired test.';
  function refresh(){
    const focused=document.activeElement===heading,derivation=lab.derive(config);
    setup=derivation.ok?derivation.setup:null;
    heading.textContent=lab.title;unknowns.replaceChildren(...lab.unknowns.map(text=>el('li',{},displayText(text))));
    frameSlot.replaceChildren(frameView(LESSON_FRAMES[lab.id],{titleNode:heading,seeds:lab.seeds.length,limits:lab.limits,edited:JSON.stringify(config)!==JSON.stringify(lab.defaults())}));
    identitySlot.replaceChildren(modelHeader(lab.short,lab.geography,result?.version??lab.version).element);
    for(const a of links){if(a.getAttribute('data-lab')===lab.id)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');}
    error.hidden=derivation.ok;error.textContent=derivation.ok?'':`Not available: outside what this lab can read: ${displayText(derivation.reason)}.`;
    const spec=setup?.main.spec;
    derived.replaceChildren(...(derivation.ok?[table('Inputs and where each comes from',['Input','Value','Source'],derivation.rows),
      el('p',{},`Changed setting: ${displayText(spec.change)} All other inputs stay the same in both arms.`),
      el('h3',{},'Declared test, set before the run'),el('ul',{},[['Primary',spec.primary.name,spec.primary.direction,'margin',spec.margin],...spec.guardrails.map(g=>['Guardrail',g.metric,g.direction,'allowance',g.max_harm])].map(([role,name,direction,word,limit])=>el('li',{},[`${role}: ${name}, `,el('span',{'data-role':'direction'},DIRECTIONS[direction]),`, ${word} ${thresholdText(name,limit)}.`]))),
      el('p',{},`Paired seeds ${spec.seeds.join(', ')}. ${number(spec.resamples,0)} bootstrap resamples. The 95% interval is a bootstrap label, nominal at this seed count. A harmed guardrail cannot be bought back by the primary measure.`)]:[]));
    setBusy(runButton,!!job,!derivation.ok);if(!job)status.textContent=idle();
    if(focused)heading.focus({preventScroll:true});
  }
  function renderControls(){
    fields.replaceChildren(...lab.controls.map(c=>{
      const read=()=>{const raw=input.value;config={...config,[c.key]:c.options?c.options.find(o=>String(o[0])===raw)?.[0]:raw===''?NaN:Number(raw)};changed();};
      const input=c.options?el('select',{'aria-label':c.label,on:{change:read}},c.options.map(([value,label])=>el('option',{value,selected:value===config[c.key]},label))):el('input',{type:'number',min:c.min,max:c.max,step:c.step,value:config[c.key],'aria-label':c.label,on:{change:read}});
      return el('label',{class:'ops-field'},[el('span',{},c.label),el('span',{class:'ops-input-unit'},[input,el('small',{},c.unit??'')])]);
    }));
  }
  function changed(){if(job)job.cancelled=true;stale=!!result;refresh();renderResult();}
  function chartOf(data,count){
    return ladderChart({title:displayText(data.title),chips:[data.seed===undefined?{kind:'across',count}:{kind:'replay',seed:data.seed}],summary:fillText(data.summary),limits:[lab.limits,'Every input is a teaching assumption, so the shape is a property of this model.'],
      axisUnit:data.axis.u,categoryLabel:data.category,gapLabel:'hatched: not available, the table gives the reason',categories:data.categories,series:data.series,text:v=>cellText({...data.axis,v}),tick:(t,d)=>number(t,d)}).node;
  }
  function renderResult(){
    const r=result,frame=LESSON_FRAMES[lab.id];
    if(!r){chartSlot.replaceChildren();records.replaceChildren();reading.replaceChildren(el('p',{},absent('nothing has run yet')));return;}
    chartSlot.replaceChildren(...(r.chart?[chartOf(r.chart,r.replications)]:[]));
    reading.replaceChildren(...[
      el('p',{class:'result-provenance'},`Scale lab model ${r.version}. ${r.label}. Paired seeds ${r.spec.seeds.join(', ')}. NOT_EVIDENCE; simulation-only; decision authority NONE.`),
      stale?el('p',{class:'teaching-edited'},'Setup changed after this run. This result used the previous setup.'):null,
      resultView(frame,pairedProjection(r),TOOLS),
      r.validity==='VALID'&&r.analysis?renderVerdictReadout(verdictOf(r)):null,
      r.controls?.length?el('section',{},[el('h3',{},'Controls run with this test'),...r.controls.map(c=>el('p',{},[el('strong',{},displayText(c.title)+': '),runLine(frame,pairedProjection(c),TOOLS).line]))]):null,
    ].filter(Boolean));
    records.replaceChildren(...[
      ...(r.tables??[]).map(t=>table(t.caption,t.heads,t.rows)),
      r.notes?.length?el('section',{},[el('h3',{},'Set by the inputs, not found by the run'),el('ul',{},r.notes.map(n=>el('li',{},fillText(n))))]):null,
      exactView(r),
    ].filter(Boolean));
  }
  async function run(){
    if(job||destroyed||!setup)return;
    const mine=job={cancelled:false},submitted=setup,before=JSON.stringify(config);
    error.hidden=true;setBusy(runButton,true);cancelButton.hidden=false;meter.hidden=false;meter.value=0;status.textContent='Computing the paired test.';
    chartSlot.replaceChildren();records.replaceChildren();reading.replaceChildren(el('p',{class:'result-provenance'},'Computing. NOT_EVIDENCE; simulation-only; decision authority NONE. Nothing is recorded until this press ends.'));
    try{
      const r=await runSliced(tap(lab.steps(submitted),p=>{if(p.chart&&job===mine)chartSlot.replaceChildren(chartOf(p.chart,submitted.main.spec.seeds.length));}),mine,{now:()=>performance.now(),schedule:yieldToPage,budgetMs:MAIN_SLICE_MS,onProgress:p=>{meter.value=p.total?p.done/p.total:0;status.textContent=`${displayText(p.label)}: ${p.done} of ${p.total}.`;}});
      if(destroyed||job!==mine)return;
      result=readable(r);stale=JSON.stringify(config)!==before;job=null;refresh();renderResult();
      resultHeading.focus({preventScroll:true});resultHeading.scrollIntoView?.({block:'start',behavior:'instant'});
      return result;
    }catch(e){
      if(destroyed||job!==mine)return;
      job=null;renderResult();
      if(e?.name==='AbortError')status.textContent='Canceled. No result was recorded from this press.';
      else{error.hidden=false;error.textContent=`The lab could not run: ${displayText(e.message)}`;status.textContent='No result was recorded from this press.';}
    }finally{
      if(!destroyed&&job===null){const held=document.activeElement===cancelButton;cancelButton.hidden=true;meter.hidden=true;setBusy(runButton,false,!setup);if(held)runButton.focus();}
    }
  }
  function cancel(){if(job)job.cancelled=true;}
  function setLesson(record){
    const next=labs.find(l=>l.id===record.id);if(!next)throw new RangeError('This Scale lab lesson is not available.');
    cancel();lab=next;config=lab.defaults();result=null;stale=false;renderControls();refresh();renderResult();
  }
  renderControls();refresh();renderResult();
  return {element,heading,run,cancel,setLesson,pause:cancel,getState:()=>({lab:lab.id,config:{...config},result,stale,busy:!!job}),destroy(){destroyed=true;cancel();}};
}
