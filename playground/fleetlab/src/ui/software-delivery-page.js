import {FLOW_TRUST} from '../model/depot-flow-contract.js';
import {DELIVERY_MANIFEST_SCHEMA,deliveryInput,deliveryDigest} from '../model/software-delivery-contract.js';
import {createDeliveryJob} from '../runtime/software-delivery-job.js';
import {createDeliveryPlayer} from './software-delivery-player.js';
import {createDeliveryProjection,deliveryChapters,deliveryCaption,ARM_NAMES,CASE_NAMES,seconds,gb,rate} from './software-delivery-view.js';

const text=(tag,attrs={},children=[])=>{
 const n=document.createElement(tag);for(const [k,v]of Object.entries(attrs)){if(k==='on'){for(const [event,fn]of Object.entries(v))n.addEventListener(event,fn);}else if(v!==null)n.setAttribute(k,String(v));}
 for(const child of [children].flat().filter(x=>x!==null&&x!==undefined))n.appendChild(typeof child==='string'?document.createTextNode(child):child);return n;
};
const button=(label,fn,attrs={})=>text('button',{type:'button',...attrs,on:{click:fn}},label);
const detail=(label,children)=>text('details',{},[text('summary',{},label),...children]);
const para=(s,cls='')=>text('p',{class:cls},s);
const titleFor=id=>`One update. ${id==='one'?'One vehicle':id==='two-arrivals'?'Two vehicles':'Four vehicles'}. Where is the wait?`;
const lesson=id=>({default:'Reuse removes repeated WAN work. Local delivery and the modeled checks still take time.',one:'One vehicle has no duplicate WAN work to remove. Both delivery policies finish at the same time.','slow-local':'The cache saves upstream work, but both policies miss the target. The slower local link dominates.','two-arrivals':'The fleet finishes earlier with the cache, but an individual vehicle becomes ready later. Local sharing reduces the on-time count.'})[id];
const immutable=value=>{const seen=new WeakSet();const visit=v=>{if(v&&typeof v==='object'&&!seen.has(v)){seen.add(v);Object.values(v).forEach(visit);Object.freeze(v);}return v;};return visit(value);};
const prettyPhase=s=>s.startsWith('generation')?'Reconstructing primary records':s.startsWith('verification')?'Independently checking the ledger':'Matching the published identities';

export function createDeliveryPage({manifest,createWorker,runPair=null,cancelPair=()=>{},reducedMotion=()=>false}={}){
 if(manifest?.schema!==DELIVERY_MANIFEST_SCHEMA||Object.keys(CASE_NAMES).some(id=>!manifest.cases?.[id]||manifest.cases[id].input_digest!==deliveryDigest(deliveryInput(id))))throw Error('The published study manifest is unavailable or incompatible.');
 let pending='default',accepted=null,player=null,chapters=[],serial=0,loading=false,destroyed=false,arm='repeated',visible=true,pauseIntent=false,lastAnnouncement='';
 const job=runPair?null:createDeliveryJob({createWorker,onProgress:phase=>{status.textContent=prettyPhase(phase)+'.';}});
 const run=runPair??(e=>job.run(e)),stop=()=>{job?.cancel();cancelPair();};
 const element=text('div',{class:'delivery-shell'}),announce=text('p',{class:'delivery-sr',role:'status','aria-atomic':'true'});
 const h1=text('h1',{},titleFor(pending)),lead=para('Compare four separate downloads with one reusable depot copy. Can all four vehicles be ready by the 480-second target?','delivery-lead');
 const status=para('Published study summary. Watch to reconstruct and check the primary records.','delivery-status');status.setAttribute('role','status');
 const setupStatus=para('Selected: Four vehicles, one update.','delivery-setup-status');
 const watch=button('Watch comparison',()=>load(),{class:'delivery-primary'}),cancel=button('Cancel computation',()=>cancelLoad()),pendingPause=button('Pause pending playback',()=>{pauseIntent=!pauseIntent;pendingPause.textContent=pauseIntent?'Enable playback after loading':'Pause pending playback';});cancel.hidden=true;pendingPause.hidden=true;
 const presets=Object.keys(CASE_NAMES).map(id=>button(CASE_NAMES[id],()=>selectPreset(id),{'data-preset':id,'aria-pressed':String(id===pending)}));
 const setup=detail('Test the limits',[
  para('Keep the comparison fair, then challenge the default lesson. Choosing a case waits for your next explicit comparison.'),text('div',{class:'delivery-presets'},presets),setupStatus,
 ]);
 const summaryHeading=text('h2',{},'Published study summary'),summaryCards=text('div',{class:'delivery-outcomes'}),ledgers=para('', 'delivery-ledgers'),provision=para('', 'delivery-fine');
 const summary=text('section',{class:'delivery-summary','aria-label':'Whole-run outcomes for both delivery policies'},[summaryHeading,para('Whole-run outcomes stay fixed while the clock moves.','delivery-fine'),summaryCards,ledgers,provision]);
 const clock=text('strong',{class:'delivery-clock'},'0 s'),clockLabel=para('Exact simulated time','delivery-eyebrow');
 const clockGroup=text('div',{class:'delivery-clock-group'},[text('div',{},[clockLabel,clock]),text('span',{class:'delivery-window'},'Observation window: 2,400 s')]);
 const captionTitle=text('h2',{},'Follow the work'),caption=para(''),jump=para('','delivery-jump');
 const guidePause=button('Pause guide',()=>player?.state().playing?player.pause():player?.resume()),guideReplay=button('Replay guide',()=>player?.replay());
 const chapterButtons=text('div',{class:'delivery-chapters','aria-label':'Guide chapters'});
 const guide=text('section',{class:'delivery-guide','aria-label':'Guided explanation'},[text('div',{class:'delivery-guide-top'},[para('A 40-second guide · held snapshots','delivery-eyebrow'),text('div',{class:'delivery-controls'},[guidePause,guideReplay])]),captionTitle,caption,jump,chapterButtons]);
 const vehicle=text('select',{'aria-label':'Selected vehicle',on:{change:()=>player?.inspect(player.state().time_ms,vehicle.value)}});
 const armButtons=Object.entries(ARM_NAMES).map(([id,name])=>button(name,()=>{arm=id;player?.setArm(id);},{'aria-pressed':String(id===arm),'data-arm-switch':id}));
 const arms=text('div',{class:'delivery-arms'}),armNodes=new Map();
 const pickers=text('div',{class:'delivery-pickers'},[text('div',{class:'delivery-arm-switch',role:'group','aria-label':'Visible delivery arm on phone'},armButtons),text('label',{},[text('span',{},'Selected vehicle'),vehicle])]);
 const currentLabel=text('div',{class:'delivery-current-heading'},[text('h2',{},'At this time'),para('Cumulative bytes include work through the clock. Rate bars describe the next interval.','delivery-fine')]);
 const inspector=text('section',{class:'delivery-inspection','aria-label':'Accepted record inspection'},[pickers,currentLabel,arms]);inspector.hidden=true;guide.hidden=true;clockGroup.hidden=true;
 const range=text('input',{type:'range',min:'0',max:'2400000',step:'1000',value:'0','aria-label':'Inspect full observation window',on:{input:()=>player?.inspect(Number(range.value))}});
 const eventSelect=text('select',{'aria-label':'Go to recorded event',on:{change:()=>{const e=events[Number(eventSelect.value)];if(e){player.inspect(e.t_ms);announce.textContent=`${e.label}. Raw time ${seconds(e.raw_ms)}; applied boundary ${seconds(e.t_ms)}.`;}}}});
 let events=[];
 const eventStep=direction=>{if(!player)return;const t=player.state().time_ms,list=[...new Set(events.map(e=>e.t_ms))].sort((a,b)=>a-b);const next=direction>0?list.find(x=>x>t):list.filter(x=>x<t).at(-1);if(next!==undefined)player.inspect(next);};
 const timelinePlay=button('Play timeline · 30×',()=>player?.state().playing&&player.state().mode==='timeline'?player.pause():player?.timelinePlay());
 const timeline=text('details',{class:'delivery-timeline'},[text('summary',{},'Inspect full timeline'),para('Continuous playback is separate from the guide. It stops at the last terminal event, or the observation end if work is unfinished. Seeking remains available through 2,400 s.'),text('div',{class:'delivery-controls'},[timelinePlay,button('Replay timeline from 0',()=>player?.timelineReplay()),button('Previous event',()=>eventStep(-1)),button('Next event',()=>eventStep(1))]),range,text('label',{},[text('span',{},'Recorded event (raw and applied time)'),eventSelect])]);timeline.hidden=true;
 const evidenceContent=text('div'),evidence=detail('Records, refinement and what “checked” means',[evidenceContent]);
 const bench=text('section',{class:'delivery-bench','aria-label':'Software-delivery comparison bench'},[text('div',{class:'delivery-presentation'},[guide,clockGroup,summary]),inspector,timeline]);
 element.appendChild(text('header',{class:'delivery-header'},[text('a',{href:'/#/overview',class:'delivery-brand','aria-label':'FleetLab home'},[text('span',{class:'delivery-monogram'},'F'),text('strong',{},'FleetLab')]),text('nav',{'aria-label':'Main navigation'},[['Home','/#/overview'],['Explore','/#/catalog'],['About & limits','/#/approach']].map(([label,href])=>text('a',{href},label)))]));
 element.appendChild(text('main',{},[text('nav',{class:'delivery-breadcrumb','aria-label':'Breadcrumb'},[text('a',{href:'/#/catalog'},'Explore'),text('span',{},' / Network Flows / Software delivery')]),
  text('section',{class:'delivery-hero'},[para('04 / NETWORK FLOWS · SYNTHETIC RESOURCE MODEL','delivery-eyebrow'),h1,lead,
   para('Same artifact, arrivals, useful link rates, checks and activation. Only delivery policy changes.','delivery-fixed'),
   text('div',{class:'delivery-actions'},[watch,cancel,pendingPause]),status,
   para('Synthetic model. Readiness here does not establish driving safety or permission to deploy.','delivery-scope'),setup]),bench,
  text('section',{class:'delivery-lessons'},[text('h2',{},'From a simple mechanism to a better question'),
   text('div',{class:'delivery-learning-grid'},[
    text('article',{},[para('ENGINEERING','delivery-eyebrow'),text('h3',{},'Which work can be reused?'),para('WAN means the wide-area link bringing the artifact into the depot. A completed shared copy can remove repeated upstream transfers. Local delivery remains.')]),
    text('article',{},[para('FLEET OPERATIONS','delivery-eyebrow'),text('h3',{},'Who waits longer?'),para('Fleet completion and individual deadlines can disagree. Try Two arrivals, competing deadlines, then inspect V1 under both policies.')]),
    text('article',{},[para('DEPOT PARTNERSHIPS','delivery-eyebrow'),text('h3',{},'What should we measure first?'),para('Measure artifact and delta sizes, arrivals, useful link throughput, device caps, actual validation and activation times, eligibility rules and target priorities.')]),
   ])]),
  detail('Assumptions, limits and trust states',[
   para('The target is invented. Counts depend on that target, equal sharing and whole-file forwarding. Energy is already available. Checks and activation are declared delays; this site does not install or validate real software.'),
   para('This model omits streaming, multicast, delta updates, retries, packet overhead, real signing and installation checks, calibrated device performance, safety assurance and deployment authority. Storage is sufficient declared provision, not measured occupancy, contention, cost or facility sizing.'),
   para('Changing only the default deadline does not change the WAN-byte or completion-time difference. Other arrival patterns, rates or policies can. This is a mechanism comparison, not a fleet optimizer.'),
   text('dl',{class:'delivery-trust'},[['Scope',FLOW_TRUST.scope],['Evidence status','NOT_EVIDENCE'],['Authenticity','NOT_AUTHENTICATED'],['Authorization','NOT_EVALUATED'],['Decision authority','NONE'],['Deployment permission','NONE']].flatMap(([k,v])=>[text('dt',{},k),text('dd',{},v)])),
   para('Loaded records checked means consistency with this declared model under a separate tested verifier. It does not establish independent authenticity, calibration, operator endorsement or real-world safety. Human comprehension and physical-device qualification are separate open checks.'),
  ]),evidence,announce]));
 element.appendChild(text('footer',{class:'delivery-footer'},[text('a',{href:'/network-flows/capacity/'},'Previous lesson: Scheduling or capacity?'),text('a',{href:'/downloads/teaching-package.json'},'Teaching source & build receipt'),text('a',{href:'mailto:bohueilin@gmail.com'},'Bo-Huei Lin · bohueilin@gmail.com')]));

 function renderedCase(){return accepted?.id??pending;}
 function renderSummary(){
  const id=renderedCase(),entry=manifest.cases[id],results=accepted?Object.fromEntries(Object.entries(accepted.projections).map(([k,p])=>[k,p.metrics])):Object.fromEntries(Object.entries(entry.primary).map(([k,v])=>[k,v.metrics]));
  h1.textContent=titleFor(id);const input=entry.input,n=input.requests.length,target=input.requests[0].deadline_ms;
  lead.textContent=`Compare ${n===1?'one separate download':`${n} separate downloads`} with one reusable depot copy. Can ${n===1?'the vehicle':`all ${n} vehicles`} be ready by the ${seconds(target)} target?`;
  summaryHeading.textContent=accepted?'Loaded records checked':'Published study summary';
  summaryCards.replaceChildren(...Object.entries(ARM_NAMES).map(([policy,name])=>{const m=results[policy];return text('article',{class:`delivery-outcome ${policy}`},[text('h3',{},name),text('dl',{},[
   text('dt',{},`Ready by ${seconds(target)}`),text('dd',{class:'delivery-outcome-count'},`${m.on_time_count}/${m.request_count}`),text('dt',{},'All ready'),text('dd',{},seconds(m.all_ready_ms)),text('dt',{},'WAN delivered'),text('dd',{},gb(m.wan_bytes)),
  ])]);}));
  ledgers.textContent=`Local delivery: ${gb(results.repeated.local_bytes)} / ${gb(results.cold.local_bytes)} (repeated / cache). One unique required ${gb(input.artifact.size_bytes)} artifact in both arms.`;
  provision.textContent=`Declared depot storage provision: ${gb(results.repeated.storage_provision_bytes)} repeated / ${gb(results.cold.storage_provision_bytes)} cache. This is an input assumption, not measured occupancy.`;
  const ref=entry.refinement;
  evidenceContent.replaceChildren(para(accepted?'Both primary records were reconstructed, independently checked, and matched to the published record digests and verifier-derived metrics before acceptance.':'These summaries were generated and independently verified at build time. Watch comparison checks the primary pair in this browser.'),
   para('Browser quantum: 1,000 ms. Refinement quantum: 250 ms, generated and independently verified at build time; not reconstructed by this browser.'),
   ...(accepted?.timing?[para(`Browser reconstruction, verification and identity checks: ${accepted.timing.compute_ms.toFixed(1)} ms. Asset loading, transfer to the page and drawing are excluded.`,'delivery-compute')]:[]),
   para(`Common primary input digest: ${entry.input_digest}`,'delivery-digest'),
   ...Object.entries(ARM_NAMES).flatMap(([policy,name])=>[para(`${name} primary: ${entry.primary[policy].record_digest}`,'delivery-digest'),para(`${name} refinement: ${ref?.arms?.[policy]?.record_digest??'Unavailable'}`,'delivery-digest')]),
   para(`Refinement differences: ${JSON.stringify(ref?.differences??'Unavailable')}`,'delivery-digest'));
 }
 function renderPending(){
  for(const b of presets)b.setAttribute('aria-pressed',String(b.getAttribute('data-preset')===pending));
  setupStatus.textContent=`Selected for the next comparison: ${CASE_NAMES[pending]}. ${accepted&&accepted.id!==pending?`Previous setup: ${CASE_NAMES[accepted.id]} remains below.`:'Choose Compare to apply a different case.'}`;
  watch.textContent=accepted||pending!=='default'?'Compare this case':'Watch comparison';
 }
 function selectPreset(id){if(!Object.hasOwn(CASE_NAMES,id))return;serial++;stop();loading=false;cancel.hidden=true;pendingPause.hidden=true;player?.pause();pending=id;renderPending();if(!accepted)renderSummary();status.textContent=accepted?`Previous setup: ${CASE_NAMES[accepted.id]}. The selected case is waiting for Compare this case.`:'Published study summary. This case has not been reconstructed in your browser.';}
 function cancelLoad(){serial++;stop();loading=false;pauseIntent=false;cancel.hidden=true;pendingPause.hidden=true;status.textContent=accepted?`Computation cancelled. Previous setup: ${CASE_NAMES[accepted.id]}.`:'Computation cancelled. Published summary remains available.';}
 function armView(policy){
  const heading=text('h3',{},ARM_NAMES[policy]),source=para('Repository · one required artifact','delivery-source'),depot=para(policy==='cold'?'One reusable depot copy':'Separate transit buffers','delivery-depot'),interval=para('','delivery-fine'),meters={};
  const meter=resource=>{const label=text('strong',{},resource==='wan'?'WAN into depot':'Local delivery to vehicles'),value=text('span'),fill=text('span',{class:'delivery-rate-fill'}),mark=text('span',{class:'delivery-capacity-mark'}),capacity=para('','delivery-fine');meters[resource]={value,fill,mark,capacity};return text('div',{class:'delivery-meter'},[text('div',{class:'delivery-meter-label'},[label,value]),text('div',{class:'delivery-rate-track','aria-hidden':'true'},[fill,mark]),capacity]);};
  const cars=text('div',{class:'delivery-vehicles'},accepted.projections[policy].input.requests.map(r=>button([text('span',{class:'delivery-car','aria-hidden':'true'}),text('strong',{},r.id),text('span',{'data-car-state':r.id},'Waiting')],()=>player.inspect(player.state().time_ms,r.id),{'data-vehicle':r.id,'aria-label':`Select vehicle ${r.id}`})));
  const why=text('h4',{},'Why this state?'),headline=text('strong',{class:'delivery-state-headline'}),cause=para(''),target=para('','delivery-target'),chain=text('ol',{class:'delivery-chain'}),own=para('','delivery-own'),exact=text('div');
  const node=text('article',{class:`delivery-arm ${policy}`,'data-mobile-visible':String(policy===arm)},[heading,text('div',{class:'delivery-state-intro'},[why,headline]),source,meter('wan'),depot,meter('local'),cars,interval,text('section',{class:'delivery-why'},[cause,target,chain,own,detail('Exact quantities and prerequisites',[exact])])]);
  return {node,update(s){
   node.setAttribute('data-mobile-visible',String(policy===player.state().arm));node.setAttribute('data-flow',String(player.state().active&&!reducedMotion()));
   const scale=accepted.projections[policy].scale_Bps;
   for(const resource of ['wan','local']){const m=meters[resource],v=s.shared[`${resource}_rate_Bps`],cap=s.limits[resource].aggregate_Bps;m.value.textContent=rate(v);m.fill.style.width=`${scale?100*v/scale:0}%`;m.mark.style.left=`${scale?100*cap/scale:0}%`;m.capacity.textContent=`Capacity mark: ${rate(cap)}. Common scale: ${rate(scale)}.`;}
   source.textContent=`Repository · ${gb(s.artifact_bytes)} unique artifact`;
   depot.textContent=policy==='cold'?`Reusable depot copy · ${gb(s.wan_bytes)} received`:`Separate transit buffers · ${gb(s.wan_bytes)} received`;
   for(const b of cars.children){const id=b.getAttribute('data-vehicle'),x=accepted.projections[policy].at(s.t_ms,id);b.setAttribute('aria-pressed',String(id===s.id));b.setAttribute('data-state',x.state);b.querySelector('[data-car-state]').textContent=x.state.replaceAll('-',' ');}
   interval.textContent=s.interval;headline.textContent=`${s.id}: ${s.headline}`;cause.textContent=s.cause;target.textContent=s.target;
   chain.replaceChildren(...Object.entries(s.chain).map(([name,value])=>text('li',{'data-state':value},`${name==='check'?'Modeled check':name}: ${value}`)));
   own.textContent=`Selected ${s.id}: WAN ${rate(s.own.wan_rate_Bps)} · local ${rate(s.own.local_rate_Bps)}. Local receipt ${gb(s.own.local_bytes)} of ${gb(s.artifact_bytes)}.`;
   exact.replaceChildren(para(`Own useful bytes: WAN ${s.own.wan_bytes}; local ${s.own.local_bytes}. Shared useful bytes: WAN ${s.wan_bytes}; local ${s.local_bytes}.`),
    para(`Own useful B/s: WAN ${s.own.wan_rate_Bps}; local ${s.own.local_rate_Bps}. Shared useful B/s: WAN ${s.shared.wan_rate_Bps}; local ${s.shared.local_rate_Bps}.`),
    para(`Caps B/s: WAN ${s.limits.wan.transfer_cap_Bps}; local ${s.limits.local.transfer_cap_Bps}. Check declared / rounded: ${seconds(s.tasks.check_declared_ms)} / ${seconds(s.tasks.check_quantized_ms)}. Activation declared / rounded: ${seconds(s.tasks.activation_declared_ms)} / ${seconds(s.tasks.activation_quantized_ms)}.`),
    para(`Raw target: ${seconds(s.deadline_ms)}. ${s.interval}. Whole-file receipt precedes modeled check, then activation, then readiness.`));
  }};
 }
 function renderTime(){if(!accepted||!player)return;const s=player.state();arm=s.arm;clock.textContent=seconds(s.time_ms);range.value=String(s.time_ms);vehicle.value=s.vehicle;
  for(const b of armButtons)b.setAttribute('aria-pressed',String(b.getAttribute('data-arm-switch')===s.arm));
  for(const [policy,node]of armNodes)node.update(accepted.projections[policy].at(s.time_ms,s.vehicle));
  guidePause.textContent=s.playing?'Pause guide':'Resume guide';timelinePlay.textContent=s.playing&&s.mode==='timeline'?'Pause timeline':'Play timeline · 30×';
  const chapter=chapters[s.chapter];
  if(chapter&&s.mode==='guide'){captionTitle.textContent=chapter.title;caption.textContent=deliveryCaption(accepted,chapter);jump.textContent=`Jump to t=${seconds(chapter.t_ms)} · chapter ${s.chapter+1}/${chapters.length}. ${s.ended?'Guide ended.':s.playing?'Held snapshot; narration pacing is not model time.':'Paused. Resume restores this chapter’s time and vehicle.'}`;
   if(s.chapter===4)jump.textContent+=' The target is invented; counts depend on equal sharing and whole-file forwarding.';
  }else{captionTitle.textContent='Inspect the accepted comparison';caption.textContent=lesson(accepted.id);jump.textContent=`Static inspection at ${seconds(s.time_ms)}. ${chapters.length?'Resume guide restores its authored time and vehicle.':'Use the timeline and event controls to follow this case.'}`;}
  for(const [index,b]of [...chapterButtons.children].entries())b.setAttribute('aria-pressed',String(index===s.chapter&&s.mode==='guide'));
  const key=`${s.mode}:${s.chapter}:${s.ended}`;if(key!==lastAnnouncement){lastAnnouncement=key;announce.textContent=`${captionTitle.textContent}. ${caption.textContent}`;}
 }
 async function load(){
  const token=++serial,id=pending;stop();player?.pause();pauseIntent=false;loading=true;cancel.hidden=false;pendingPause.hidden=false;pendingPause.textContent='Pause pending playback';status.textContent='Reconstructing the primary pair. The earlier accepted setup stays attached to its own results.';
  try{
   const result=await run(manifest.cases[id]);if(destroyed||token!==serial)return;
   const pair={id,entry:manifest.cases[id],...result,projections:Object.fromEntries(Object.entries(result.records).map(([k,r])=>[k,createDeliveryProjection(r)]))};
   accepted=immutable(pair);chapters=deliveryChapters(pair);const endpoint=Math.max(...Object.values(pair.projections).map(p=>p.metrics.terminal_ms));
   player=createDeliveryPlayer({chapters,endpoint_ms:endpoint,H_ms:pair.entry.input.H_ms,quantum_ms:1000,vehicle:pair.entry.input.requests[0].id,arm,onChange:renderTime});
   vehicle.replaceChildren(...pair.entry.input.requests.map(r=>text('option',{value:r.id},r.id)));
   armNodes.clear();for(const policy of ['repeated','cold'])armNodes.set(policy,armView(policy));arms.replaceChildren(...[...armNodes.values()].map(x=>x.node));
   chapterButtons.replaceChildren(...chapters.map((c,i)=>button(String(i+1),()=>player.chapter(i),{'aria-label':`${i+1}. ${c.title}`,'aria-pressed':String(i===0),title:c.title})));
   events=Object.values(pair.projections).flatMap(p=>p.events.map(e=>({...e,label:`${ARM_NAMES[p.record.policy]} · ${e.label}`}))).sort((a,b)=>a.t_ms-b.t_ms);
   eventSelect.replaceChildren(...events.map((e,i)=>text('option',{value:String(i)},`${e.label} · ${seconds(e.raw_ms)}${e.raw_ms!==e.t_ms?` → applied ${seconds(e.t_ms)}`:''}`)));
   inspector.hidden=false;guide.hidden=false;guidePause.hidden=chapters.length===0;guideReplay.hidden=chapters.length===0;guide.querySelector('.delivery-eyebrow').textContent=chapters.length?'A 40-second guide · held snapshots':'Counterexample · static explanation and inspection';clockGroup.hidden=false;timeline.hidden=false;range.max=String(pair.entry.input.H_ms);
   renderSummary();renderPending();bench.scrollIntoView?.({behavior:reducedMotion()?'instant':'smooth',block:'start'});player.visible(visible);player.preference(reducedMotion());player.watch();if(pauseIntent)player.pause();renderTime();status.textContent=`Loaded records checked: ${CASE_NAMES[id]}. Both primary records match the published identities and metrics.`;
  }catch(error){if(token!==serial||destroyed)return;status.textContent=`Comparison not accepted: ${error.message}${accepted?` Previous setup: ${CASE_NAMES[accepted.id]}.`:' Published summary remains available.'}`;announce.textContent=status.textContent;}
  finally{if(token===serial){loading=false;cancel.hidden=true;pendingPause.hidden=true;}}
 }
 renderSummary();renderPending();
 return {element,bench,load,cancel:cancelLoad,selectPreset,player:()=>player,
  getState:()=>({pending,accepted,chapters,loading}),
  visibilityChanged(value){visible=value;player?.visible(value);},preferenceChanged(){player?.preference(reducedMotion());if(reducedMotion())pauseIntent=true;},historyRestore(){player?.historyRestore();},advance(dt){player?.advance(dt);},
  destroy(){destroyed=true;serial++;stop();player?.pause();},
 };
}
