// Depot view at one shared cursor tick (note 13, 16): cursor, schematic, lists, inspector and events read the verified projection only.
import {el,setAttr,setText,svgElement} from './dom.js';
import {term} from '../model/depot-lab/registry.js';
import {numberText,secondsText,hoursText,kwhText,gbText,kwText,percentText} from './depot-lab-format.js';
export const PAGE_ROWS=20,ZONE_LIMIT=48,TRAIL_DEPTH=4,REPLAY_MS=900,STEP_TICKS=900,REDUCED='(prefers-reduced-motion: reduce)';
const ZONES=['waiting','garage','cleaning','charging'],ARMS=['baseline','candidate'];
const DENOM=[['installed','Installed: every configured unit for the whole run'],['enabled','Enabled: units switched on'],['eligible','Eligible: time a unit could actually be used']];
const ACCOUNTING='Shown first for time accounting only; a display convention, not a causal share.';
const BLOCKED='Replay is off while reduced motion is requested, visual motion is paused or the page is hidden. Step with Next event instead.';
const EMPTY='The depot view appears after a verified run of the current setup.';
const CHANGE={START:'Started',COMPLETE:'Finished',PAUSE:'Paused',RESUME:'Resumed',CANCEL:'Cancelled'};
const G={ring:['M1 5a4 4 0 1 0 8 0a4 4 0 1 0-8 0',0],dot:['M1 5a4 4 0 1 0 8 0a4 4 0 1 0-8 0',1],box:['M1 1h8v8H1z',1],hollow:['M1 1h8v8H1z',0],tri:['M5 1l4 8H1z',1],tri0:['M5 1l4 8H1z',0],dia:['M5 0l5 5-5 5-5-5z',1],arrow:['M1 1l4 4-4 4M5 1l4 4-4 4',0],half:['M5 1a4 4 0 0 1 0 8z',1],cross:['M1 1l8 8M9 1L1 9',0]};
// Mark word and glyph per partition class: shape and text carry the class, never colour alone. Key order keeps both
// D1-08 partition orders (positions and ports), so partition rows list in contract order.
const MARK={unavailable:['Off','cross'],free:['Free','ring'],inbound_exit_handling:['Handling','arrow'],zone_native_service_active:['Work','dot'],retained_other_work:['Other work','half'],unconnected_position_blocked:['Blocked','hollow'],reserved_inbound_connect:['Connect','arrow'],connected_drawing:['Charging','dot'],connected_zero_draw:['No draw','tri0'],at_target_lifecycle_running:['Content','half'],at_target_waiting:['Waiting','box'],inspection:['Inspect','dia'],finished_but_blocked:['Done, held','tri'],waiting_no_progress:['Waiting','box'],unplug_handling:['Unplug','arrow']},ORDER=Object.keys(MARK);
const short=id=>{const s=String(id);return s.slice(s.indexOf(':')+1);};
const veh=id=>`Vehicle ${short(id)}`;
const lab=(id,f=id)=>term(id)?.label_plain??f;
const tech=(t,tag='span')=>el(tag,{class:'technical-only mono'},t);
const step=t=>String(t).replace(/_/g,' ');
const cap=s=>s.charAt(0).toUpperCase()+s.slice(1);
const count=(n,w)=>`${numberText(n)} ${w}${n===1?'':'s'}`;
// Half-open [from, to); at H the interval that closes at H is the one in force.
const hit=(a,b,t,H)=>a<=t&&(t<b||t===H&&b===H&&a<b);
const find=(list,t,H)=>list?.find(x=>hit(x[0],x[1],t,H))??null;
const btn=(text,fn,attrs={})=>el('button',{type:'button',...attrs,on:{click:fn}},text);
// Columns listed in `num` hold times or amounts and do not wrap.
const table=(caption,heads,rows,num=[])=>el('div',{class:'table-scroll',role:'region',tabindex:'0','aria-label':caption},el('table',{},[el('caption',{},caption),el('thead',{},el('tr',{},heads.map(h=>el('th',{scope:'col'},h)))),el('tbody',{},rows.map(r=>el('tr',{},r.map((c,i)=>el(i?'td':'th',{scope:i?null:'row',class:num.includes(i)?'num':null},c)))))]));
const taskName=id=>{const p=String(id).split(':');return p[1]==='cache'?`depot cache ${step(p[3])} of ${p[2]}`:step(p.slice(2).join(':'));};
const when=(t,H)=>t===0?'start of run':t===H?'end of run':`${hoursText(t)} into the run`;
const at=(t,H)=>[t===H?'End of run':hoursText(t),tech(` ${t} s`)];
const place=l=>l.startsWith('position:')?`Position ${short(l)}`:lab(`visit.location.${l}`,l);
const holders=v=>[...new Set(v.frontier_at_h.reasons.flatMap(r=>r.holder_visit_ids))].sort();
// A lower bound under a minute keeps exact seconds, never "at least < 1 min".
const least=x=>`at least ${x>0&&x<60?secondsText(x):hoursText(x)}`;
// Release-by status from the verified on_time, due_status and overdue_s (exact tick comparisons made by the verifier).
const dueStatus=v=>{const o=v.overdue_s,r=v.released_at;return v.due_tick===null?'No release-by time':v.on_time?'On time':v.due_status==='not_yet_due'?(r===null?'Not released by end of run; due after end of run, so not late yet':'Released before its release-by time, which falls after the end of run'):r===null?`Not released by end of run; ${o?`late by ${least(o)}`:'not on time'}`:`Late by ${hoursText(o)} (${secondsText(o)})`;};
const amount=r=>[r.unit==='mJ'?kwhText(r.value):r.unit==='bytes'?gbText(r.value):hoursText(r.value),tech(` ${r.value} ${r.unit}`)];
// Largest total of the verified per-reason waiting seconds; ties go to the lowest visit id; null when nobody waited.
export function longestWaiting(visits){
 let best=null;
 for(const v of visits){const s=Object.values(v.wait_seconds??{}).reduce((a,b)=>a+b,0);if(s>0&&(!best||s>best.seconds||s===best.seconds&&v.id<best.id))best={id:v.id,seconds:s};}
 return best;
}
const IDX=new WeakMap();
function index(P){
 let x=IDX.get(P);if(x)return x;
 const group=list=>{const m=new Map();for(const [r,...rest] of list){if(!m.has(r))m.set(r,[]);m.get(r).push(rest);}return m;},rank=z=>(ZONES.indexOf(z)+1)||9;
 x={H:P.horizon_tick,visits:new Map(P.visits.map(v=>[v.id,v])),pos:new Map(P.resources.positions.map(p=>[p.id,p])),ports:new Map(P.resources.ports.map(p=>[p.id,p])),portAt:new Map(P.resources.ports.map(p=>[p.position,p])),
  ivPos:group(P.intervals.positions),ivPort:group(P.intervals.ports),ticks:[...new Set(P.events.map(e=>e[0]))].sort((a,b)=>a-b),
  zones:[...new Set(P.resources.positions.map(p=>p.zone))].sort((a,b)=>rank(a)-rank(b)||(a<b?-1:1)),longest:longestWaiting(P.visits)};
 IDX.set(P,x);return x;
}
// mountDepot renders #cursor, #schematic, #inspector, #vehicles and #events; the cursor and selection live in the session.
export function mountDepot({doc,session}){
 const by=id=>doc.getElementById(id),box={c:by('cursor'),s:by('schematic'),i:by('inspector'),v:by('vehicles'),e:by('events')};
 const win=doc.defaultView,html=doc.documentElement,media=win?.matchMedia?.(REDUCED)??null;
 let cur=null,X=null,P=null,arm='baseline',t=0,sel=null,why=null,trail={id:null,n:1},zone=null,pages={},ver=0,last=null,timer=null,note='',mo=null;
 const bump=()=>{ver++;paint();};
 // A missing motion attribute counts as running; any of the four conditions blocks replay.
 const blocked=()=>!!media?.matches||html.getAttribute('data-motion')==='reduce'||html.getAttribute('data-visitor-motion')==='paused'||doc.hidden===true;
 const halt=msg=>{if(timer!==null){clearInterval(timer);timer=null;}if(msg!==undefined)note=msg;};
 const prevTick=()=>X?.ticks.findLast(k=>k<t)??null,nextTick=()=>X?.ticks.find(k=>k>t)??null;
 const goto=v=>{halt('');if(X&&v!==null)session.setPresentation({cursor:Math.max(0,Math.min(X.H,Math.trunc(Number(v))||0))});};
 const choose=(id,reason=null,toggle=false)=>{why=reason?id:null;ver++;session.setPresentation({selection:toggle&&sel===id?null:id});};
 // Replay moves only the presentation cursor across recorded event ticks; it never runs or advances the model.
 const advance=()=>{if(blocked()){halt(BLOCKED);return bump();}const n=nextTick();if(n===null){halt('Replay reached the last event.');return bump();}session.setPresentation({cursor:n});};
 const replay=()=>{
  if(timer!==null){halt('Replay stopped.');return bump();}
  if(blocked()){note=BLOCKED;return bump();}
  if(nextTick()===null){note='No later event to replay; move the cursor back first.';return bump();}
  note='Replay steps through recorded events and never runs the model.';timer=setInterval(advance,REPLAY_MS);bump();
 };
 const armBox=el('div',{class:'arm-switch',role:'group','aria-label':'Setup shown in the depot view'});
 const prev=btn('Previous event',()=>goto(prevTick())),back=btn('-15 min',()=>goto(t-STEP_TICKS),{'aria-label':'Back 15 minutes'}),fwd=btn('+15 min',()=>goto(t+STEP_TICKS),{'aria-label':'Forward 15 minutes'}),next=btn('Next event',()=>goto(nextTick())),play=btn('Replay events',replay);
 const range=el('input',{type:'range',min:'0',step:'1','aria-label':'Time cursor',on:{input:()=>goto(range.value)}});
 const clock=el('p',{class:'cursor-label'}),cnote=el('p',{class:'note'}),controls=[armBox,prev,back,range,fwd,next,play,clock,cnote];
 const search=el('input',{type:'search',autocomplete:'off',spellcheck:'false',on:{input:()=>bump(),keydown:e=>{if(e.key!=='Enter')return;e.preventDefault();const m=matches(),f=m.find(v=>short(v.id)===query())??m[0];if(f)choose(f.id);}}});
 const longBtn=btn('',()=>{if(X?.longest)choose(X.longest.id,'longest');},{'data-key':'long'}),vcount=el('p',{class:'note'}),vlist=el('ul',{class:'vehicle-list',role:'list','aria-label':'Vehicles'});
 const vparts=[el('p',{},longBtn),el('label',{},['Find a vehicle by ID',search]),vcount,vlist],empty=()=>el('p',{class:'empty'},EMPTY),cempty=empty(),vempty=empty();
 box.c.replaceChildren(cempty,...controls);box.v.replaceChildren(vempty,...vparts);
 const query=()=>search.value.trim().toLowerCase().replace(/^(?:vehicle|visit)?[\s:]*/,'');
 const matches=()=>{const q=query();return P?P.visits.filter(v=>!q||short(v.id).toLowerCase().includes(q)):[];};
 // Rebuilds a region and returns focus to the control with the same data-key.
 const keep=(node,nodes)=>{const a=doc.activeElement,k=a&&a!==doc.body&&node.contains(a)?a.getAttribute('data-key'):null;node.replaceChildren(...nodes.filter(Boolean));if(k)node.querySelector(`[data-key="${k}"]`)?.focus();};
 const off=(b,v)=>setAttr(b,'aria-disabled',String(v));
 const paintCursor=()=>{
  const pair=!!cur?.result?.envelopes?.candidate?.projection;
  armBox.hidden=!pair;keep(armBox,pair?ARMS.map(a=>btn(cap(a),()=>{arm=a;bump();},{'aria-pressed':String(arm===a),'data-key':`arm:${a}`})):[]);
  setAttr(range,'max',X.H);range.value=String(t);setAttr(range,'aria-valuetext',when(t,X.H));
  off(prev,prevTick()===null);off(next,nextTick()===null);off(back,t===0);off(fwd,t===X.H);
  setText(play,timer!==null?'Stop replay':'Replay events');off(play,timer===null&&blocked());
  clock.replaceChildren(el('span',{},`Cursor: ${when(t,X.H)}, ${arm} setup.`),tech(` tick ${t} of ${X.H}`));setText(cnote,note);
 };
 const watch=()=>{if(timer!==null&&blocked()){halt(BLOCKED);bump();}else if(X)paintCursor();};
 const markText=(r,kind,o)=>`${kind==='port'?`Port ${short(r.id)} at position ${short(r.position)}`:`Position ${short(r.id)}, ${r.zone}`}: ${o?.[2]?veh(o[2]):'empty'}, ${o?lab(`${kind}.partition.${o[3]}`):'Not available'}`;
 const mark=(r,kind,x,y)=>{
  const o=find((kind==='port'?X.ivPort:X.ivPos).get(r.id),t,X.H),c=o?.[3]??'',v=o?.[2]??null,[word,g]=MARK[c]??['Not available','hollow'],[d,fill]=G[g];
  const n=svgElement('g',{class:'mark',transform:`translate(${x} ${y})`,role:'img','aria-label':markText(r,kind,o),'data-resource':r.id,'data-occupant':v??'','data-class':c});
  for(const k of [svgElement('rect',{class:`slot${v?' held':''}${r.enabled?'':' off'}${sel===r.id||v!==null&&v===sel?' selected':''}`,width:76,height:56,rx:6,'stroke-dasharray':c==='free'?'4 3':null},undefined,1),
   svgElement('text',{x:6,y:15},short(r.id)),svgElement('text',{x:6,y:31},v?`V ${short(v)}`:'empty'),svgElement('text',{x:6,y:47},word),
   svgElement('path',{d,transform:'translate(62 5)',fill:fill?'#0b3b2e':'none',stroke:'#0b3b2e','stroke-width':1.5})])n.appendChild(k);
  n.addEventListener('click',()=>choose(r.id,null,true));
  return n;
 };
 const item=(r,kind)=>el('li',{},btn(markText(r,kind,find((kind==='port'?X.ivPort:X.ivPos).get(r.id),t,X.H)),()=>choose(r.id,null,true),{'aria-pressed':String(sel===r.id),'data-key':`l:${r.id}`}));
 // Every zone is drawn up to ZONE_LIMIT positions; above it one zone is open at a time and the others show counts.
 const schematic=()=>{
  const W=560,many=P.resources.positions.length>ZONE_LIMIT,open=many?(X.zones.includes(zone)?zone:X.zones[0]):null,lists=[];
  const inZone=z=>P.resources.positions.filter(p=>p.zone===z);
  const head=z=>{const ps=inZone(z);return `${cap(z)}: ${count(ps.length,'position')}, ${numberText(ps.filter(p=>find(X.ivPos.get(p.id),t,X.H)?.[2]).length)} occupied`;};
  const svg=svgElement('svg',{role:'group','aria-label':`Depot schematic, ${arm} setup, ${when(t,X.H)}`});let y=0;
  for(const z of X.zones){
   if(open&&z!==open)continue;
   const ps=inZone(z),cw=ps.some(p=>X.portAt.has(p.id))?160:80,cols=W/cw|0,items=[];
   svg.appendChild(svgElement('text',{x:4,y:y+16},head(z)));y+=24;
   ps.forEach((p,i)=>{const x=i%cols*cw,yy=y+(i/cols|0)*62,q=X.portAt.get(p.id);svg.appendChild(mark(p,'position',x,yy));items.push(item(p,'position'));if(q){svg.appendChild(mark(q,'port',x+80,yy));items.push(item(q,'port'));}});
   y+=Math.ceil(ps.length/cols)*62+8;
   lists.push(el('h4',{},head(z)),el('ul',{class:'mark-list',role:'list','aria-label':`${cap(z)} positions and ports`},items));
  }
  setAttr(svg,'viewBox',`0 0 ${W} ${y}`);
  return [many&&el('div',{class:'zone-switch',role:'group','aria-label':'Zone shown'},X.zones.map(z=>btn(head(z),()=>{zone=z;bump();},{'aria-pressed':String(z===open),'data-key':`zone:${z}`}))),svg,...lists];
 };
 const levels=(v,max)=>{const seen=new Set([v.id]),out=[];let row=[v];while(out.length<max){const nx=[];for(const u of row)for(const h of holders(u))if(!seen.has(h)&&X.visits.has(h)){seen.add(h);nx.push(X.visits.get(h));}if(!nx.length)break;out.push(nx);row=nx;}return out;};
 // Holder trail at H: depth 1 first, one more level per press, stopping at TRAIL_DEPTH, a terminal holder or a repeated vehicle.
 const trailNode=v=>{
  const depth=trail.id===v.id?trail.n:1,all=levels(v,TRAIL_DEPTH+1),shown=all.slice(0,depth),rank=new Map([[v.id,0]]);
  shown.forEach((L,i)=>L.forEach(u=>rank.set(u.id,i+1)));
  const line=(u,k)=>{const hs=holders(u),f=u.frontier_at_h;return hs.length?`${veh(u.id)}: ${taskName(f.task)} waits (${f.reasons.map(r=>lab('reason.'+r.code)).join(', ')}); held by ${hs.map(h=>veh(h)+(rank.get(h)<=k?' (already listed)':'')).join(', ')}.`:`${veh(u.id)}: not waiting on another vehicle at end of run (terminal holder).`;};
  const more=depth<TRAIL_DEPTH&&all.length>depth;
  return el('div',{class:'trail'},[el('h4',{},'Holder trail at end of run'),
   el('ol',{},shown.map((L,i)=>el('li',{},[el('span',{},`Level ${numberText(i+1)}`),el('ul',{},L.map(u=>el('li',{},[el('span',{},line(u,i+1)),' ',btn(`Inspect ${veh(u.id)}`,()=>choose(u.id),{'data-key':`tr:${u.id}`})])))]))),
   more?btn('Show the next holder level',()=>{trail={id:v.id,n:depth+1};bump();},{'data-key':'deeper'}):el('p',{class:'note'},all.length>TRAIL_DEPTH&&depth===TRAIL_DEPTH?`The trail stops at the declared depth of ${numberText(TRAIL_DEPTH)} levels.`:'The trail ends at a terminal holder or a repeated vehicle.'),
   ...P.blockage.filter(b=>b.member_visit_ids.includes(v.id)).map(b=>el('p',{},[`${lab('blockage.'+b.classification)}: ${b.member_visit_ids.map(veh).join(', ')} waiting on ${b.held_resource_ids.map(short).join(', ')}${b.terminal_holder_id?`; lowest direct holder ${veh(b.terminal_holder_id)}, which may itself be waiting`:''}.`,tech(` ${b.classification}`)]))]);
 };
 const vehicle=v=>{
  const H=X.H,w=find(v.waits,t,H),loc=find(v.location,t,H),f=v.frontier_at_h,rem=v.remaining,refs=Object.entries(rem.reference),waits=Object.entries(v.wait_seconds),until=x=>x===null?'not by end of run':when(x,H);
  // A30: exact seconds always follow the release-by and release times, in both reading levels.
  const d=v.due_tick,r=v.released_at,ex=x=>x===null?'':` (${secondsText(x)})`;
  return [el('h3',{},veh(v.id)),
   why===v.id&&X.longest?.id===v.id&&el('p',{class:'note'},`${veh(v.id)} is selected because it has the longest total waiting time.`),
   el('p',{},[`State at end of run: ${lab('visit.state.'+v.state_at_h)}. Arrived: ${when(v.arrival_tick,H)}. Release-by time: ${d===null?'none':when(d,H)+ex(d)}.`,tech(` state_at_h ${v.state_at_h}; route ${v.route}; terminal_zone ${v.terminal_zone}; arrival_tick ${v.arrival_tick}; due_tick ${d}`)]),
   el('ol',{class:'release-chain'},[el('li',{},`Required work done: ${until(v.work_complete_at)}`),el('li',{},[`Released from depot work: ${until(r)}${ex(r)}`,tech(` released_at ${r}`)]),el('li',{},'Eligible for a ride: not modeled in this version')]),
   el('p',{'data-due':v.due_status},['Release-by status: ',el('strong',{},dueStatus(v)),'.',tech(` due_status ${v.due_status}; on_time ${v.on_time}; overdue_s ${v.overdue_s}`)]),
   el('h4',{},'At the cursor'),el('p',{},`Where: ${loc?place(loc[2]):'not yet arrived'}.`),
   w?el('p',{'data-wait':w[2]},['Waiting: ',el('strong',{},lab('reason.'+w[2])),` from ${when(w[0],H)} to ${when(w[1],H)}. `,el('span',{class:'note'},ACCOUNTING),tech(` ${w[2]} [${w[0]}, ${w[1]})`)])
    :el('p',{},t<v.arrival_tick?'Not waiting: not yet arrived.':v.released_at!==null&&t>=v.released_at?'Not waiting: released from depot work.':'Not waiting: required work is progressing.'),
   t===H?el('div',{class:'frontier'},[el('p',{},f.task?`Frontier step at end of run: ${taskName(f.task)}. Full reason set:`:'No frontier step at end of run.'),f.reasons.length?el('ul',{},f.reasons.map(r=>el('li',{'data-reason':r.code},[el('strong',{},lab('reason.'+r.code)),r.resource_ids.length?`; units: ${r.resource_ids.map(short).join(', ')}`:'',r.holder_visit_ids.length?`; held by ${r.holder_visit_ids.map(veh).join(', ')}`:'',tech(` ${r.code}`)]))):null])
    :el('p',{class:'note'},['The full reason set and its holders are recorded at the end of the run. ',btn('Show end of run',()=>goto(H),{'data-key':'to-h'})]),
   holders(v).length?trailNode(v):null,
   v.active_at_h.length?table('Started but could not finish by end of run',['Step','Class','Started','Remaining','Status',lab('active_at_h.minimum_duration_exceeded_time_left_at_start')],v.active_at_h.map(a=>{const m=a.minimum_duration_exceeded_time_left_at_start;return [step(a.template),a.cls,at(a.start,H),amount(a.remaining),'Started but could not finish by end of run',[m===null?'Not available':`${m?'Yes':'No'}; ${least(a.lower_bound_ticks)} needed`,tech(` minimum_duration_exceeded_time_left_at_start ${m}; lower_bound_ticks ${a.lower_bound_ticks}`)]];}),[2,3]):null,
   el('h4',{},'Remaining required work at end of run'),
   refs.length||rem.energy_mj||rem.bytes?el('ul',{},[...refs.map(([c,q])=>el('li',{},[`${lab('remaining_reference_seconds:'+c,c)}: ${secondsText(q)} of reference work`,tech(` ${c} ${q}`)])),rem.energy_mj?el('li',{},[`${lab('remaining_required_kWh')}: ${kwhText(rem.energy_mj)}`,tech(` ${rem.energy_mj} mJ`)]):null,rem.bytes?el('li',{},[`${lab('remaining_required_bytes')}: ${gbText(rem.bytes)}`,tech(` ${rem.bytes} bytes`)]):null]):el('p',{},'None.'),
   waits.length?el('div',{},[el('h4',{},lab('wait.reason_seconds')),el('p',{class:'note'},ACCOUNTING),el('ul',{},waits.map(([c,s])=>el('li',{},[`${lab('reason.'+c)}: ${hoursText(s)}`,tech(` ${c} ${s} s`)])))]):null,
   table(`Task timeline for ${veh(v.id)}, times from the start of the run`,['Step','Required','State at end of run','Start','End','Workers','Position','Port'],v.tasks.map(k=>[step(k.template),k.mandatory?'Required':'Optional',lab('task.state.'+k.state_at_h),k.start===null?'Not started':at(k.start,H),k.end===null?'Not finished':at(k.end,H),k.workers.map(short).join(', ')||'None',k.position?short(k.position):'None',k.port?short(k.port):'None']),[3,4]),
   table(`Location history for ${veh(v.id)}, times from the start of the run`,['From','To','Where'],v.location.map(([a,b,l])=>[at(a,H),at(b,H),place(l)]),[0,1]),
   el('p',{},[`Energy: ${kwhText(v.energy.initial_mj)} at arrival, ${kwhText(v.energy.target_mj)} target, ${kwhText(v.energy.credited_mj)} delivered.`,tech(` initial_mj ${v.energy.initial_mj}; target_mj ${v.energy.target_mj}; credited_mj ${v.energy.credited_mj}`)]),
   v.data.length?table(`Data for ${veh(v.id)}`,['Object','Direction','Required','Size','Received','State at end of run'],v.data.map(d=>[d.object.startsWith('logs:')?'Log backlog':short(d.object),d.direction==='down'?'Download':'Upload',d.mandatory?'Required':'Optional',gbText(d.bytes),[gbText(d.credited),tech(` ${d.credited} bytes`)],d.state?lab('data.state.'+d.state):'No bytes yet']),[3,4]):null];
 };
 const share=f=>{try{return percentText(f);}catch{return String(f);}};
 // Class totals over [0, H) from the verifier (C1.6): one share per named denominator; a zero denominator is not applicable.
 const totals=kind=>{
  const S=P.resources.owned_summary?.[`${kind}s`],all=`all ${kind}s`;
  if(!S)return [el('p',{},`Owned or reserved share across ${all}: Not available.`)];
  return [el('p',{},[`Across ${all} in this setup: owned or reserved for ${hoursText(S.owned_unit_ticks)} of unit time over the run.`,tech(` owned_unit_ticks ${S.owned_unit_ticks}`)]),
   table(`Owned or reserved share across ${all}, by denominator`,['Denominator','Unit time','Share'],DENOM.map(([k,name])=>{const f=S.fraction[k];return [name,[hoursText(S[`${k}_unit_ticks`]),tech(` ${k}_unit_ticks ${S[`${k}_unit_ticks`]}`)],[f===null?'Not applicable':share(f),tech(` fraction.${k} ${f}`)]];}),[1,2])];
 };
 const resName=id=>X.ports.has(id)?`Port ${short(id)}`:`Position ${short(id)}`;
 const resource=id=>{
  const port=X.ports.get(id)??null,r=port??X.pos.get(id),kind=port?'port':'position',pp=port?null:X.portAt.get(id),o=find((port?X.ivPort:X.ivPos).get(id),t,X.H);
  // Out of service comes from the verified partition (unavailable for all of H, so owned_fraction is null), never from
  // the unit's own flag alone: a port is also out of service while its position is.
  const oos=r.partition.unavailable===X.H||r.owned_fraction===null,why=oos?port&&r.enabled?`; out of service because position ${short(port.position)} is out of service`:'; out of service':'';
  return [el('h3',{},resName(id)),
   el('p',{},port?`${port.kind} port rated ${kwText(port.rating_w)} at position ${short(port.position)}${why}.`:`${cap(r.zone)} position${pp?` with port ${short(pp.id)}`:''}${why}.`),
   el('p',{},[`${lab('resource.occupancy_now')}: ${o?.[2]?veh(o[2]):'nobody'}; ${o?lab(`${kind}.partition.${o[3]}`):'Not available'}.`,o&&tech(` ${o[3]} [${o[0]}, ${o[1]})`)]),
   table(`Time by class over the whole run, out of ${hoursText(X.H)} for this ${kind}`,['Class','Time'],Object.entries(r.partition).sort((a,b)=>(ORDER.indexOf(a[0])>>>0)-(ORDER.indexOf(b[0])>>>0)).map(([c,s])=>[[lab(`${kind}.partition.${c}`),tech(` ${c}`)],[`${hoursText(s)} of ${hoursText(X.H)}`,tech(` ${s} of ${X.H} s`)]]),[1]),
   !port&&el('p',{},[`${lab('position.port_released_position_held_s')}: ${hoursText(r.port_released_position_held_s)}.`,tech(` port_released_position_held_s ${r.port_released_position_held_s}`)]),
   // The share is the verifier's owned_fraction; an out-of-service unit has no available time, so it is not applicable.
   el('p',{},[`${lab('resource.owned_fraction')}: ${oos?'Not applicable, out of service':r.owned_fraction===undefined?'Not available':share(r.owned_fraction)}${oos?'':`; held ${hoursText(r.owned_ticks)}`}.`,tech(` owned_fraction ${r.owned_fraction??null}; owned_ticks ${r.owned_ticks}`)]),...totals(kind)];
 };
 const inspect=()=>!sel?[el('p',{class:'empty'},'Choose a vehicle from the list, or a position or port on the schematic, to inspect it.')]:X.visits.has(sel)?vehicle(X.visits.get(sel)):X.pos.has(sel)||X.ports.has(sel)?resource(sel):[el('p',{class:'empty'},`${short(sel)} is not part of the ${arm} setup.`)];
 // Events filtered by the selection, split around the cursor; each part pages PAGE_ROWS rows, earlier events open on their last page.
 const events=()=>{
  let list=P.events,title='All events';
  if(X.visits.has(sel)){list=list.filter(e=>e[1]===sel);title=`Events for ${veh(sel)}`;}
  else if(X.pos.has(sel)||X.ports.has(sel)){const k=new Set(P.visits.flatMap(v=>v.tasks.filter(x=>x.position===sel||x.port===sel).map(x=>`${v.id} ${x.template}`)));list=list.filter(e=>k.has(`${e[1]} ${e[2]}`));title=`Events at ${resName(sel)}`;}
  const parts=[['before','Before the cursor',list.filter(e=>e[0]<t)],['at','At the cursor',list.filter(e=>e[0]===t)],['after','After the cursor',list.filter(e=>e[0]>t)]];
  return [el('h3',{},title),el('p',{},`${count(list.length,'event')} in total: ${numberText(parts[0][2].length)} before the cursor, ${numberText(parts[1][2].length)} at it, ${numberText(parts[2][2].length)} after it.`),...parts.map(([k,name,rows])=>{
   const n=Math.max(1,Math.ceil(rows.length/PAGE_ROWS)),i=Math.max(0,Math.min(n-1,pages[k]??(k==='before'?n-1:0))),go=j=>{pages={...pages,[k]:j};bump();};
   return el('section',{'data-part':k},[el('h4',{},`${name}: ${count(rows.length,'event')}`),rows.length?table(name,['Time','Vehicle','Step','Change'],rows.slice(i*PAGE_ROWS,(i+1)*PAGE_ROWS).map(e=>[at(e[0],X.H),e[1]?veh(e[1]):'Depot cache',step(e[2]),[CHANGE[e[3]]??e[3],tech(` ${e[3]}`)]]),[0]):el('p',{class:'empty'},'None.'),
    n>1&&el('p',{class:'pager'},[btn('Previous page',()=>{if(i>0)go(i-1);},{'aria-disabled':String(i===0),'data-key':`pg:${k}:p`}),el('span',{},`Page ${numberText(i+1)} of ${numberText(n)}`),btn('Next page',()=>{if(i<n-1)go(i+1);},{'aria-disabled':String(i===n-1),'data-key':`pg:${k}:n`})])]);
  })];
 };
 const paintVehicles=()=>{
  const L=X.longest,m=matches(),n=P.visits.length;
  setText(longBtn,L?`Longest waiting: ${veh(L.id)}, ${hoursText(L.seconds)} in total`:'Longest waiting: no vehicle waited in this run');off(longBtn,!L);
  setText(vcount,query()?`${numberText(m.length)} of ${count(n,'vehicle')} match`:count(n,'vehicle'));
  keep(vlist,m.map(v=>{const l=find(v.location,t,X.H);return el('li',{},btn(short(v.id),()=>choose(v.id,null,true),{'aria-pressed':String(sel===v.id),'aria-label':`${veh(v.id)}: ${l?place(l[2]):'not yet arrived'}`,'data-key':`v:${v.id}`}));}));
 };
 // Only a verified result attached to the current draft is drawn; nothing here depends on the reading level.
 const paint=()=>{
  const r=cur?.status==='verified'&&cur.result?.envelopes?cur.result:null;
  if(arm==='candidate'&&!r?.envelopes.candidate?.projection)arm='baseline';
  const p=r?.envelopes[arm]?.projection??null;
  if(p!==P){halt('');P=p;X=p&&index(p);pages={};}
  t=X?Math.min(X.H,cur.presentation.cursor??0):0;sel=cur?.presentation.selection??null;
  if(last&&(last[1]!==t||last[2]!==sel))pages={};
  const sig=[P,t,sel,ver,arm];if(last&&sig.every((x,i)=>x===last[i]))return;last=sig;
  for(const n of [...controls,...vparts])n.hidden=!X;cempty.hidden=!!X;vempty.hidden=!!X;
  if(!X){for(const k of ['s','i','e'])box[k].replaceChildren(empty());vlist.replaceChildren();return;}
  paintCursor();keep(box.s,schematic());keep(box.i,inspect());keep(box.e,events());paintVehicles();
 };
 media?.addEventListener?.('change',watch);doc.addEventListener('visibilitychange',watch);
 if(typeof win?.MutationObserver==='function'){mo=new win.MutationObserver(watch);mo.observe(html,{attributes:true,attributeFilter:['data-motion','data-visitor-motion']});}
 return {render(s){cur=s;paint();},dispose(){halt();media?.removeEventListener?.('change',watch);doc.removeEventListener('visibilitychange',watch);mo?.disconnect();}};
}
