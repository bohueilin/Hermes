// NF-03 recorded comparison viewer. The cards read the accepted study manifest; Load reconstructs four cells and
// accepts each only when it matches the manifest. Nothing here runs a custom setup or changes a record.
import {el} from './dom.js';
import {createDepotFlowPlayer} from './depot-flow-player.js';
import {createLiveRegion} from './a11y.js';
import {setBusy} from './display-text.js';
import {modelHeader,NON_AFFILIATION} from './model-identity.js';
import {capacityCellSteps} from '../model/depot-capacity.js';
import {CAPACITY_PROTOCOL,CAPACITY_REGIMES,CAPACITY_RULES,CAPACITY_TREATMENTS,CAPACITY_VERSIONS,FLOW_TRUST,capacityScenario,studyStatus} from '../model/depot-capacity-contract.js';
import {CAPACITY_PROJECTION,caseCells,cardsFor,readingSentence,withheldReason,inspectCapacity,allocationSpans,firstAllocationDifference,firstReadinessDifference,exampleVisits,verifiedCell,ruleName,join,minute,gbps,kw} from './depot-capacity-view.js';

// Copied from depot-flow-reading.js, which another stream owns.
const table=(caption,heads,rows,attrs={})=>el('div',{class:'flow-table',tabindex:0,role:'region','aria-label':caption,...attrs},el('table',{},[el('caption',{},caption),el('thead',{},el('tr',{},heads.map(h=>el('th',{scope:'col'},h)))),el('tbody',{},rows.map(row=>el('tr',{},row.map((c,i)=>el(i===0?'th':'td',i===0?{scope:'row'}:{},c)))))]));
const detail=(title,children)=>el('details',{},[el('summary',{},title),...children]);
const button=(text,fn,attrs={})=>el('button',{type:'button',class:'studio-button',on:{click:fn},...attrs},text);
const svg=(tag,attrs={},text)=>{const n=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,String(v));if(text!==undefined)n.textContent=String(text);return n;};

const P=CAPACITY_PROTOCOL,T=CAPACITY_TREATMENTS,VISITS=P.waves.length*P.profiles.length,HORIZON_MIN=minute(P.horizon_s);
const ALT_RULES=CAPACITY_RULES.filter(r=>r.id!=='capacity_equal_uplink');
const CASES=[['rule','Different rule'],['bandwidth','More bandwidth'],['power','More power']];
const caseLabel=c=>c==='base'?'Base':CASES.find(x=>x[0]===c)[1];
const lower=text=>text.toLowerCase();
const vehicles=ids=>join(ids.map(id=>`Vehicle ${id}`));
const OUTCOME={on_time:'on time',late:'late',unfinished_due:'unfinished, target passed',pending:'unfinished, target ahead'};
const CHAIN_WORDS={done:'✓ done',active:'in progress',waiting:'waiting','not-applicable':'already at target','not-arrived':'not arrived'};
const EVENT_WORDS=[['arrival',null,'arrives','arrive'],['complete','upload','finishes uploading','finish uploading'],['complete','charge','reaches the battery target','reach the battery target'],['complete','post','finishes the local step','finish the local step'],['ready',null,'is ready','are ready'],['deadline',null,'reaches its departure target','reach their departure targets']];

function header(){
  const link=(text,href)=>el('a',{href,class:'studio-button'},text);
  return el('header',{class:'studio-header'},[
    el('div',{class:'studio-brand'},[el('a',{href:'/#/overview',class:'studio-monogram','aria-label':'FleetLab home'},'F'),el('div',{},[el('strong',{},'FleetLab'),el('span',{},'by Hermes')])]),
    el('nav',{id:'studio-navigation','aria-label':'Main navigation'},[link('Home','/#/overview'),link('Explore','/#/catalog'),link('About & limits','/#/approach')]),
  ]);
}

function heldFixed(regime){
  const s=capacityScenario({regime,treatment:'base'}),gb=b=>`${b/1e9} GB`,kwh=j=>j?`${j/3.6e6} kWh`:'Already at target';
  return [
    table(`Twelve visits · ${CAPACITY_REGIMES[regime].name} workload`,['Vehicle','Wave','Arrives','Upload','Energy','Due'],s.vehicles.map(v=>[v.id,v.wave,`Minute ${minute(v.arrival_s)}`,gb(v.upload_bytes),kwh(v.energy_j),`Minute ${minute(v.deadline_s)}`])),
    table('Shared resources',['Resource','Value'],[
      ['Uplink',`${gbps(T.base.uplink_bytes_s)} shared; ${gbps(T.more_bandwidth.uplink_bytes_s)} with more bandwidth`],['Charging ports',P.charge_ports],['Port cap',`${kw(P.port_cap_j_s)} per port`],
      ['Site feed',`${kw(T.base.site_power_j_s)} shared by occupied ports; ${kw(T.more_power.site_power_j_s)} with more power`],['Per-vehicle upload cap',gbps(P.vehicle_uplink_cap_bytes_s)],
      ['Local step',`${minute(P.post_s)} min after the upload, using no shared resource`],['Observation',`${HORIZON_MIN} min in one-second slots`]]),
    el('ul',{class:'capacity-rules'},CAPACITY_RULES.map(r=>el('li',{},[el('strong',{},r.name),`: ${r.description}`]))),
    el('p',{class:'flow-run-help'},'GB and kWh are decimal units. Every rule and capacity change serves exactly this work.'),
  ];
}

function cardView(card,loaded){
  const value=text=>card.available?text:'Not available';
  return el('article',{class:'capacity-card','data-case':card.case,'data-loaded':String(loaded)},[
    el('p',{class:'capacity-card-meta'},loaded?'Loaded and matched':'From the accepted study'),
    el('h3',{},card.label),el('p',{class:'capacity-changed'},card.changed),
    el('dl',{},[el('dt',{},'Ready on time'),el('dd',{},value(`${card.on_time} of ${VISITS}`)),el('dt',{},'Missed targets'),el('dd',{},value(`${card.missed} (late ${card.late}, unfinished ${card.unfinished_due})`)),
      el('dt',{},'Total lateness'),el('dd',{},card.lateness_text),el('dt',{},'Capacity used'),el('dd',{},card.capacity_text)]),
  ]);
}

// Twelve lanes: upload as solid bars sized by link share, charging as thin bars sized by port share, the local step
// pale, a ready tick and a dashed departure target. The cursor and the veil over unrevealed time move with playback.
// A share bar is never drawn under MIN_BAR px, so a quarter of the uplink stays visible; larger shares scale above it.
const MIN_BAR=4;
function timeline(label,record,regime){
  const s=record.scenario,W=960,L=56,R=16,LANE=28,TOP=8,x=t=>L+(W-L-R)*t/s.horizon_s,bottom=TOP+LANE*s.vehicles.length,H=bottom+34;
  const spans=allocationSpans(record),lanes=new Map();
  const ready=spans.map(v=>`${v.vehicle} ${v.ready_s===null?'not ready':minute(v.ready_s)}`).join(', ');
  const root=svg('svg',{viewBox:`0 0 ${W} ${H}`,width:760,height:Math.round(760*H/W),role:'img','aria-label':`${label} timeline, ${CAPACITY_REGIMES[regime].name} workload: upload, charging and the local step for ${s.vehicles.length} visits over ${HORIZON_MIN} minutes. Ready at minute: ${ready}.`});
  spans.forEach((v,i)=>{
    const y=TOP+i*LANE,bar=(t0,t1,attrs)=>root.appendChild(svg('rect',{x:x(t0),width:Math.max(.5,x(t1)-x(t0)),...attrs}));
    lanes.set(v.vehicle,root.appendChild(svg('rect',{x:0,y,width:W,height:LANE,class:'cap-lane'})));
    root.appendChild(svg('text',{x:8,y:y+18,class:'cap-label'},v.vehicle));
    if(v.post)bar(v.post.t0,v.post.t1,{y:y+4,height:14,class:'cap-post'});
    for(const u of v.upload){const h=Math.max(MIN_BAR,14*u.fraction);bar(u.t0,u.t1,{y:y+18-h,height:h,class:'cap-upload'});}
    for(const c of v.charge)bar(c.t0,c.t1,{y:y+20,height:Math.max(MIN_BAR,6*c.fraction),class:'cap-charge'});
    if(v.ready_s!==null)root.appendChild(svg('line',{x1:x(v.ready_s),x2:x(v.ready_s),y1:y+2,y2:y+26,class:'cap-ready'}));
    root.appendChild(svg('line',{x1:x(v.deadline_s),x2:x(v.deadline_s),y1:y+1,y2:y+27,class:'cap-deadline'}));
    root.appendChild(svg('line',{x1:L,x2:W-R,y1:y+LANE,y2:y+LANE,class:'cap-rule'}));
  });
  for(let m=0;m<=HORIZON_MIN;m+=10)root.append(svg('line',{x1:x(m*60),x2:x(m*60),y1:bottom,y2:bottom+5,class:'cap-rule'}),svg('text',{x:x(m*60),y:bottom+20,'text-anchor':'middle',class:'cap-label'},m));
  root.appendChild(svg('text',{x:8,y:bottom+20,class:'cap-label'},'Minute'));
  const veil=root.appendChild(svg('rect',{x:L,y:0,width:0,height:bottom,class:'cap-veil',visibility:'hidden'}));
  const cursor=root.appendChild(svg('line',{x1:L,x2:L,y1:0,y2:bottom,class:'cap-cursor'}));
  const figure=el('figure',{class:'capacity-timeline'},[el('figcaption',{},[el('strong',{},`${label}. `),'Solid dark bars: upload, height shows the share of the uplink. Thin accent bars: charging, height shows the share of one port. Pale bars: the local step. Short solid tick: ready. Dashed line: departure target. Accent line: the inspected time.']),el('div',{class:'capacity-figure-scroll'},root)]);
  return {figure,
    setCursor(t,revealing){cursor.setAttribute('x1',x(t));cursor.setAttribute('x2',x(t));veil.setAttribute('x',x(t));veil.setAttribute('width',W-R-x(t));veil.setAttribute('visibility',revealing?'visible':'hidden');},
    select(id){for(const [vehicle,lane] of lanes)lane.setAttribute('class',vehicle===id?'cap-lane cap-lane-selected':'cap-lane');}};
}

// [name, modeled, x, y, width, height]: a logical turnaround map, not a site plan.
const STAGES=[['Arrive and park',true,16,20,120,460],['Bay link',false,166,102,140,56],['Depot network',false,330,102,140,56],['Uplink to the cloud',true,494,102,140,56],['Cloud ingestion',false,494,14,140,50],['Local step',true,658,102,140,56],
  ['Site feed',true,166,326,140,48],['Port 1',true,330,212,140,48],['Port 2',true,330,280,140,48],['Battery',true,494,242,140,56],['Software download',false,330,410,140,56],['Cleaning',false,494,410,140,56],['Departure target',true,824,20,120,460]];
function depotMap(){
  const names=modeled=>STAGES.filter(s=>s[1]===modeled).map(s=>s[0]).join(', ');
  const root=svg('svg',{viewBox:'0 0 960 500',width:760,height:396,role:'img','aria-label':`Logical map of a depot turnaround. Modeled: ${names(true)}. Not modeled: ${names(false)}.`});
  const defs=root.appendChild(svg('defs')),marker=defs.appendChild(svg('marker',{id:'capacity-arrow',viewBox:'0 0 8 8',refX:8,refY:4,markerWidth:8,markerHeight:8,orient:'auto'}));
  marker.appendChild(svg('path',{d:'M0,0 L8,4 L0,8 z',class:'cap-arrow'}));
  const arrow=(x1,y1,x2,y2,extra='')=>root.appendChild(svg('line',{x1,y1,x2,y2,class:`cap-flow${extra}`,'marker-end':'url(#capacity-arrow)'}));
  for(const [a,b] of [[136,166],[306,330],[470,494],[634,658],[798,824]])arrow(a,130,b,130);
  arrow(564,102,564,64);arrow(136,270,330,270,' cap-flow-dashed');arrow(470,270,494,270);arrow(634,270,824,270);arrow(306,342,330,304);arrow(290,326,330,236);
  for(const [a,b] of [[136,330],[470,494],[634,824]])arrow(a,438,b,438);
  for(const [text,y] of [['Data path',92],['Energy path',204],['Other turnaround work',402]])root.appendChild(svg('text',{x:166,y,class:'cap-map-lane'},text));
  root.appendChild(svg('text',{x:150,y:290,class:'cap-map-lane'},'connection, not modeled'));
  for(const [name,modeled,x,y,w,h] of STAGES){
    const g=root.appendChild(svg('g',{'data-modeled':String(modeled)}));
    g.append(svg('rect',{x,y,width:w,height:h,rx:10}),svg('text',{x:x+w/2,y:y+h/2-2,'text-anchor':'middle',class:'cap-map-name'},name),svg('text',{x:x+w/2,y:y+h/2+15,'text-anchor':'middle',class:'cap-map-tag'},modeled?'modeled':'not modeled'));
  }
  const needs=[['Bay link','measured per-bay useful link rate'],['Cloud ingestion','acknowledgment and retry times'],['Battery','vehicle acceptance curves and taper'],['Software download','object sizes and cache state'],['Cleaning','staffing and bay availability'],['Connection','arrival-to-connect delay']];
  return el('section',{class:'capacity-map','aria-labelledby':'capacity-map-title'},[el('h2',{id:'capacity-map-title'},'Where this model sits in a real depot'),
    el('figure',{},[el('div',{class:'capacity-figure-scroll'},root),el('figcaption',{},'Solid outline: carried by this model. Dashed outline: not modeled. Lines show the order in which a visit\'s work moves toward departure.')]),
    el('h3',{},'Not modeled, and what a real study would need'),el('dl',{},needs.flatMap(([k,v])=>[el('dt',{},k),el('dd',{},v)]))]);
}

function studyTable(manifest){
  const primary=manifest.cells.filter(c=>c.time_quantum_ms===P.quanta_ms[0]&&c.metrics);
  const repeat=id=>manifest.refinement?.[id]?(manifest.refinement[id].agrees?'agrees':'differs'):'Not available';
  const lateness=m=>m.final_lateness?`${minute(m.lateness_s)} min`:`At least ${minute(m.lateness_lower_bound_s)} min`;
  return table('All primary cells of the accepted study, one-second slots',['Workload','Capacity','Rule','Ready on time','Missed','Total lateness','Quarter-second repeat','Record digest'],
    primary.map(c=>[CAPACITY_REGIMES[c.regime].name,T[c.treatment].name,ruleName(c.rule),`${c.metrics.on_time} of ${VISITS}`,c.metrics.missed,lateness(c.metrics),repeat(c.cell_id),c.record_digest.slice(0,8)]));
}

export function createCapacityPage({manifest,reducedMotion=()=>false,yieldPage=()=>new Promise(r=>setTimeout(r,0)),steps=capacityCellSteps}={}){
  let regime='data_heavy',altRule='capacity_departure_deadline',comparison=null,contrast='rule',vehicle=null,examples=null,job=null,destroyed=false,player=null,timelines=[];
  const complete=studyStatus(manifest);
  const status=el('p',{class:'capacity-status',role:'status'}),question=el('p',{class:'capacity-question'}),fixedBody=el('div'),grid=el('div',{class:'capacity-grid'}),reading=el('p',{class:'capacity-reading'});
  const chips=Object.entries(CAPACITY_REGIMES).map(([id,r])=>button(r.name,()=>{regime=id;refreshSelection();},{'aria-pressed':'false','data-regime':id}));
  const ruleSelect=el('select',{'aria-label':'Different rule',on:{change:()=>{altRule=ruleSelect.value;refreshSelection();}}},ALT_RULES.map(r=>el('option',{value:r.id},r.name)));
  ruleSelect.value=altRule;
  const loadButton=button('Load comparison',()=>load(),{class:'studio-button studio-button-primary','data-capacity-load':''});
  const inspectNote=el('p',{class:'capacity-inspect-note'}),firstDifference=el('p',{class:'capacity-first-difference'}),visitTable=el('div',{class:'capacity-visits'}),exampleNote=el('p',{class:'capacity-example-note'});
  const contrastSelect=el('select',{'aria-label':'Case to compare',on:{change:()=>{contrast=contrastSelect.value;showContrast();}}},CASES.map(([value,text])=>el('option',{value},text)));
  const vehicleSelect=el('select',{'aria-label':'Vehicle',on:{change:()=>selectVehicle(vehicleSelect.value)}},capacityScenario({regime:'data_heavy',treatment:'base'}).vehicles.map(v=>el('option',{value:v.id},`Vehicle ${v.id}`)));
  const exampleButtons=[['improving','Improving'],['regressing','Regressing'],['unchanged','Unchanged']].map(([key,word])=>button(`${word} example`,()=>{const ids=examples?.[key]??[];if(ids.length)selectVehicle(ids[(ids.indexOf(vehicle)+1)%ids.length]);},{'data-example':key}));
  const play=button('Play',()=>{player.getState().playing?player.pause():player.play();},{'data-capacity-play':''}),restart=button('Restart',()=>player.restart());
  // Under reduced motion the player's play() is the one-event step that also starts the reveal; Play itself is hidden.
  const previous=button('Previous event',()=>{if(player.getState().time_s>0)player.previous();}),next=button('Next event',()=>{const s=player.getState();if(s.time_s<P.horizon_s)s.reduced?player.play():player.next();},{'data-next-event':''});
  const clock=el('p',{class:'flow-clock'}),caption=el('p',{class:'flow-caption'}),board=el('div',{class:'capacity-board'}),figures=el('div',{class:'capacity-timelines'}),spansBox=el('div');
  const slider=el('input',{type:'range',min:0,max:P.horizon_s,step:1,value:0,'aria-label':'Inspect time across the two cells',on:{input:()=>player.seek(Number(slider.value)),change:()=>announce(eventSentence(player.getState().time_s)),keydown:event=>{
    if(event.ctrlKey||event.metaKey||event.altKey)return;const d={ArrowLeft:-60,ArrowDown:-60,ArrowRight:60,ArrowUp:60,PageDown:-300,PageUp:300}[event.key];
    if(d!==undefined){event.preventDefault();player.seek(player.getState().time_s+d);announce(eventSentence(player.getState().time_s));}}}});
  const inspect=el('section',{class:'capacity-inspect','aria-label':'Which vehicles changed, and why?',hidden:true},[
    el('h2',{},'Which vehicles changed, and why?'),inspectNote,el('label',{class:'capacity-picker'},[el('span',{},'Compare Base with'),contrastSelect]),
    el('div',{class:'capacity-examples',role:'group','aria-label':'Example visits'},exampleButtons),exampleNote,el('label',{class:'capacity-picker'},[el('span',{},'Vehicle'),vehicleSelect]),
    firstDifference,visitTable,el('div',{class:'flow-actions'},[play,restart,previous,next]),clock,slider,caption,board,figures,spansBox]);
  const loadedDetails=el('div',{class:'capacity-records'});
  const main=el('main',{class:'depot-capacity'},[
    el('nav',{class:'flow-breadcrumb','aria-label':'Breadcrumb'},[el('a',{href:'/#/catalog'},'Explore'),el('span',{'aria-hidden':'true'},'/'),el('span',{},'Depot readiness & data'),el('span',{'aria-hidden':'true'},'/'),el('span',{'aria-current':'page'},'Scheduling or capacity?')]),
    el('p',{class:'eyebrow'},`RECORDED SYNTHETIC STUDY · ${VISITS} VEHICLES · ${HORIZON_MIN}-MINUTE OBSERVATION`),
    el('h1',{},'Better scheduling, more bandwidth, or more charging power?'),
    el('p',{class:'flow-lede'},'Twelve invented depot visits in three waves share one upload link, two charging ports and one site feed. Four scheduling rules and two capacity changes serve exactly the same work. Load a workload to compare them.'),
    el('p',{class:'flow-boundary'},'Constructed teaching study: visits, workloads, capacities and deadlines are invented for this lesson, not measurements of a real depot. Loading selects accepted recorded cells; nothing here runs a custom setup.'),
    el('section',{class:'capacity-controls','aria-label':'Choose a comparison'},[el('div',{class:'capacity-chips',role:'group','aria-label':'Workload'},chips),question,
      el('label',{class:'capacity-picker'},[el('span',{},'Different rule'),ruleSelect]),el('div',{class:'flow-actions'},[loadButton]),
      el('p',{class:'flow-run-help'},'Selects four accepted cells of the recorded study and reconstructs them for inspection.'),status,
      el('details',{class:'capacity-fixed'},[el('summary',{},'What is held fixed?'),fixedBody])]),
    el('section',{class:'capacity-cards','aria-label':'Matched comparison'},[el('h2',{},'Four matched cases'),grid,reading]),
    inspect,depotMap(),
    el('section',{class:'capacity-table','aria-labelledby':'capacity-table-title'},[el('h2',{id:'capacity-table-title'},'Full study'),
      el('p',{},'Every workload, capacity and rule at one-second slots. Each cell was repeated with quarter-second slots; the repeat agrees when every visit keeps its ready time and outcome.'),studyTable(manifest),loadedDetails]),
    el('section',{class:'capacity-limits','aria-labelledby':'capacity-limits-title'},[el('h2',{id:'capacity-limits-title'},'Model and limits'),modelHeader('Depot capacity model','Constructed depot visits',CAPACITY_VERSIONS.model).element,
      el('dl',{class:'flow-versions'},[...Object.entries(CAPACITY_VERSIONS).flatMap(([k,v])=>[el('dt',{},k[0].toUpperCase()+k.slice(1)),el('dd',{},v)]),el('dt',{},'Presentation projection'),el('dd',{},CAPACITY_PROJECTION)]),
      el('p',{},`Scope: ${FLOW_TRUST.scope}. Evidence status: ${FLOW_TRUST.evidence_status}. Authenticity: ${FLOW_TRUST.authenticity}. Authorization: ${FLOW_TRUST.authorization}. Decision authority: ${FLOW_TRUST.decision_authority}. Deployment permission: ${FLOW_TRUST.deployment_permission}.`),
      el('p',{},'No Wi-Fi contention, retries, cloud ingestion, charge taper, thermal limits, auxiliary load, software download, finite storage, failures, route motion, cleaning staffing or real control. Readiness is a necessary input to service planning; it does not measure trips, rider wait, revenue, driving quality or safety.'),
      el('p',{},NON_AFFILIATION)]),
    el('section',{class:'capacity-question','aria-labelledby':'capacity-question-title'},[el('h2',{id:'capacity-question-title'},'What would we have to measure at a real depot before using this result?'),
      el('ul',{},['Arrival and work-size distributions: when vehicles arrive, and how much each must upload and charge.','Target definitions: which ready time counts as on time for each departure.','Useful link rates: what each bay link and the site uplink carry after overhead and retries.','Vehicle power acceptance: how fast each vehicle takes energy across its charge.','Connection behavior: the delay between parking and being plugged in and linked.','Resource availability: how often ports, links and the site feed are out of service.'].map(t=>el('li',{},t)))]),
  ]);
  const element=el('div',{class:'fleet-studio capacity-page','data-page':'capacity'},[header(),main]);
  const live=createLiveRegion(element);
  const announce=text=>{if(live.node.textContent!==text)live.announce(text);};

  const regimeName=id=>CAPACITY_REGIMES[id].name;
  const loadedText=()=>`Comparison loaded: ${regimeName(comparison.regime)} workload. Four cells reconstructed and matched to the accepted study.`;
  function selectionStatus(){
    if(!complete.complete)return `Study incomplete: ${complete.accepted} of ${complete.planned} cells accepted.`;
    if(!comparison)return 'No comparison loaded.';
    if(comparison.regime!==regime)return `Showing the ${regimeName(comparison.regime)} comparison; load to compare the ${regimeName(regime)} workload.`;
    if(comparison.altRule!==altRule)return `Showing the ${regimeName(comparison.regime)} comparison with ${lower(ruleName(comparison.altRule))}; load to compare ${lower(ruleName(altRule))}.`;
    return loadedText();
  }
  function refreshSelection(){
    chips.forEach(b=>b.setAttribute('aria-pressed',String(b.getAttribute('data-regime')===regime)));
    question.textContent=CAPACITY_REGIMES[regime].question;fixedBody.replaceChildren(...heldFixed(regime));
    const matched=comparison?.regime===regime&&comparison.altRule===altRule;
    grid.replaceChildren(...cardsFor(manifest,regime,altRule).map(card=>cardView(card,matched)));
    reading.textContent=readingSentence(manifest,regime,altRule)??withheldReason(manifest,regime,altRule);
    if(!job)status.textContent=selectionStatus();
  }

  function eventWords(record,t){
    const at=record.events.filter(e=>e.time_s===t&&!(e.type==='complete'&&e.task==='charge'&&record.scenario.vehicles.find(v=>v.id===e.vehicle).energy_j===0));
    return EVENT_WORDS.map(([type,task,one,many])=>{const ids=at.filter(e=>e.type===type&&e.task===task).map(e=>e.vehicle);return ids.length?`${vehicles(ids)} ${ids.length>1?many:one}`:null;}).filter(Boolean).join('; ');
  }
  function eventSentence(t){
    const [a,b]=[comparison.cells.base,comparison.cells[contrast]].map(c=>eventWords(c.record,t)),prefix=`Minute ${minute(t)}. `;
    if(!a&&!b)return prefix+'No recorded events at this time.';
    if(a===b)return prefix+`Both cells: ${a}.`;
    return prefix+[['Base',a],[caseLabel(contrast),b]].filter(([,w])=>w).map(([n,w])=>`${n}: ${w}.`).join(' ');
  }
  function chain(label,x){
    const at=s=>x.present||s==='not-applicable'?s:'not-arrived',word=s=>at(s==='complete'?'done':s);
    const steps=[['Battery',word(x.tasks.charge)],['Upload',word(x.tasks.upload)],['Local step',word(x.tasks.post)],['Ready',word(x.ready?'done':'waiting')]];
    return el('div',{class:'flow-chain',role:'group','aria-label':'Readiness chain','data-vehicle':x.vehicle},[el('strong',{},`${label} · Vehicle ${x.vehicle}`),...steps.map(([n,s])=>el('span',{'data-state':s},`${n}: ${CHAIN_WORDS[s]}`))]);
  }
  function boardCase(c,state){
    const x=state.visits.find(v=>v.vehicle===vehicle),h=state.uplink.holders,rates=[...new Set(h.map(v=>gbps(v.rate_bytes_s)))];
    const uplink=!h.length?'Idle':rates.length===1?`${vehicles(h.map(v=>v.id))} · ${rates[0]}${h.length>1?' each':''}`:join(h.map(v=>`Vehicle ${v.id} ${gbps(v.rate_bytes_s)}`));
    const port=p=>p.vehicle?`Vehicle ${p.vehicle} · ${kw(p.rate_j_s)}`:'Free';
    return el('article',{class:'capacity-board-case','data-case':c},[el('h3',{},caseLabel(c)),
      el('dl',{},[['Uplink',uplink],['Port 1',port(state.ports[0])],['Port 2',port(state.ports[1])],['Site feed',`${state.site.used_j_s/1000} of ${state.site.capacity_j_s/1000} kW`]].flatMap(([k,v])=>[el('dt',{},k),el('dd',{},v)])),
      chain(caseLabel(c),x),el('p',{class:'flow-wait-reason'},x.wait_reason)]);
  }
  function renderMoment(t){
    clock.textContent=`Minute ${minute(t)} of ${HORIZON_MIN}`;slider.setAttribute('aria-valuetext',clock.textContent);
    const states=['base',contrast].map(c=>[c,inspectCapacity(comparison.cells[c].record,t)]);
    board.replaceChildren(...states.map(([c,state])=>boardCase(c,state)));
    caption.textContent=states.map(([c,state])=>`${caseLabel(c)}: ${state.visits.find(v=>v.vehicle===vehicle).wait_reason}`).join(' ');
  }
  function render(s){
    play.hidden=s.reduced;play.textContent=s.label;slider.value=String(s.time_s);
    previous.setAttribute('aria-disabled',String(s.time_s===0));next.setAttribute('aria-disabled',String(s.time_s===P.horizon_s));
    for(const line of timelines)line.setCursor(s.time_s,s.revealing);
    if(s.textChanged)renderMoment(s.time_s);
  }
  function selectVehicle(id){
    vehicle=id;vehicleSelect.value=id;for(const line of timelines)line.select(id);
    if(player)renderMoment(player.getState().time_s);
  }
  function showContrast(){
    const time=player?.getState().time_s??0;player?.destroy();player=null;
    const base=comparison.cells.base,other=comparison.cells[contrast],label=caseLabel(contrast);
    examples=exampleVisits(base.verification,other.verification);
    exampleButtons.forEach(b=>{const key=b.getAttribute('data-example'),word=key[0].toUpperCase()+key.slice(1),n=examples[key].length;b.textContent=n?`${word} example`:`${word}: none`;b.setAttribute('aria-disabled',String(!n));});
    exampleNote.textContent=examples.note??`${examples.improving.length} improving, ${examples.regressing.length} regressing and ${examples.unchanged.length} unchanged visits.`;
    const alloc=firstAllocationDifference(base.record,other.record),ready=firstReadinessDifference(base.verification,other.verification),at=s=>s===null?'not ready':`minute ${minute(s)}`;
    firstDifference.textContent=[alloc?`First allocation difference: minute ${minute(alloc.time_s)}, Vehicle ${alloc.vehicle}: Base ${alloc.base}; ${label} ${alloc.other}.`:'No allocation difference.',
      ready?`First readiness difference: Vehicle ${ready.vehicle}, Base ${at(ready.base_ready_s)}, ${label} ${at(ready.other_ready_s)}.`:'No readiness difference.'].join(' ');
    const readyText=v=>v.ready_s===null?'Not ready':`Minute ${minute(v.ready_s)} · ${OUTCOME[v.outcome]}`;
    visitTable.replaceChildren(table(`Base versus ${lower(label)} · every visit`,['Vehicle','Due',`Base ready`,`${label} ready`,'Change','Class'],base.verification.visits.map(a=>{
      const b=other.verification.visits.find(v=>v.vehicle===a.vehicle),d=b.ready_s-a.ready_s;
      const cls=examples.improving.includes(a.vehicle)?'Improving':examples.regressing.includes(a.vehicle)?'Regressing':'Unchanged';
      return [`Vehicle ${a.vehicle}`,`Minute ${minute(a.deadline_s)}`,readyText(a),readyText(b),a.ready_s===null||b.ready_s===null?'Unavailable':`${d>0?'+':''}${minute(d)} min`,cls];
    })));
    timelines=[['Base',base],[label,other]].map(([name,c])=>timeline(name,c.record,comparison.regime));
    figures.replaceChildren(...timelines.map(line=>line.figure));
    const spanRows=[['Base',base],[label,other]].flatMap(([name,c])=>allocationSpans(c.record).flatMap(v=>[
      ...v.upload.map(u=>[`${name} · Vehicle ${v.vehicle}`,'Upload',`${minute(u.t0)} to ${minute(u.t1)} min`,gbps(u.fraction*c.record.scenario.uplink_bytes_s)]),
      ...v.charge.map(u=>[`${name} · Vehicle ${v.vehicle}`,'Charging',`${minute(u.t0)} to ${minute(u.t1)} min`,kw(u.fraction*c.record.scenario.port_cap_j_s)]),
      ...(v.post?[[`${name} · Vehicle ${v.vehicle}`,'Local step',`${minute(v.post.t0)} to ${minute(v.post.t1)} min`,'No shared resource']]:[])]));
    spansBox.replaceChildren(detail('Spans as a table',[table('Merged service spans for the two cells',['Cell and vehicle','Work','Minutes','Average rate'],spanRows)]));
    const eventTimes=[...new Set([base,other].flatMap(c=>c.record.events.map(e=>e.time_s)))];
    selectVehicle(examples.selected??vehicle??base.verification.visits[0].vehicle);
    player=createDepotFlowPlayer({horizon_s:P.horizon_s,eventTimes,moments:[],quantum_s:1,reducedMotion,render,announce,eventSentence});
    player.seek(time);
  }
  function showComparison(){
    const rule=lower(ruleName(comparison.altRule));
    inspectNote.textContent=`Loaded comparison: ${regimeName(comparison.regime)} workload, with ${rule} as the different rule.`;
    inspect.hidden=false;showContrast();
    loadedDetails.replaceChildren(...['base','rule','bandwidth','power'].map(c=>{const cell=comparison.cells[c];return detail(`Exact record · ${cell.cell_id}`,[
      el('p',{},`Record digest: ${cell.digest}`),
      button('Download this cell as JSON',()=>{const url=URL.createObjectURL(new Blob([JSON.stringify({cell_id:cell.cell_id,digest:cell.digest,record:cell.record,verification:cell.verification},null,2)],{type:'application/json'}));const a=el('a',{href:url,download:`fleetlab-capacity-${cell.cell_id.replaceAll('/','-')}.json`});a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}),
      el('pre',{class:'capacity-checks'},JSON.stringify(cell.verification.checks,null,2))]);}));
  }

  async function load(){
    if(job||destroyed||!complete.complete)return;
    const token={cancelled:false},chosen={regime,altRule},wanted=caseCells(regime,altRule),cells={};let failure=null;
    job=token;setBusy(loadButton,true);
    const iterator=steps(wanted.map(c=>c.cell),{shouldCancel:()=>token.cancelled});
    try{
      for(const [n,c] of wanted.entries()){
        status.textContent=`Reconstructing ${c.label}: cell ${n+1} of ${wanted.length}.`;
        await yieldPage();
        if(destroyed||token.cancelled)return;
        try{const step=iterator.next();if(step.done)throw Error('no record was reconstructed');cells[c.case]=verifiedCell(step.value,manifest.cells.find(m=>m.cell_id===c.cell_id));}
        catch(error){failure=`Cell ${c.cell_id}: ${String(error?.message??error).replace(/\.$/,'')}.`;break;}
      }
    }finally{iterator.return?.();if(job===token)job=null;if(!destroyed)setBusy(loadButton,false);}
    if(failure){status.textContent=`${failure} ${comparison?'Previous comparison retained.':'No comparison loaded.'}`;return;}
    comparison=Object.freeze({...chosen,cells:Object.freeze(cells)});
    // The status line is itself a polite status region, so the result is spoken once.
    refreshSelection();showComparison();
  }

  refreshSelection();
  if(!complete.complete)setBusy(loadButton,false,true);
  return {element,load,
    getState:()=>({regime,altRule,contrast,vehicle,comparison,time_s:player?.getState().time_s??0,loading:job!==null,status:status.textContent}),
    pause(){player?.pause();live.node.textContent='';},
    motionChanged(){player?.motionChanged();},
    destroy(){destroyed=true;if(job)job.cancelled=true;player?.destroy();player=null;live.node.textContent='';},
  };
}
