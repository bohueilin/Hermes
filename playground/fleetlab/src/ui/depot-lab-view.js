// Depot lab display builders (engineering note 13, 16, 18). Values come only from verified envelopes and the comparison;
// the view formats them and never recomputes a metric, relation or classification. Output never depends on the reading
// level: Technical shows the same nodes plus `.technical-only` detail that the page stylesheet hides in Overview.
import {el} from './dom.js';
import {term,TERMS} from '../model/depot-lab/registry.js';
import {FLOW_TRUST} from '../model/depot-flow-contract.js';
import {numberText,secondsText,minutesText,hoursText,kwhText,gbText,signedText} from './depot-lab-format.js';
export const NOT_AVAILABLE='Not available';
const ARMS=['baseline','candidate'],ARM={baseline:'Baseline',candidate:'Candidate'};
const STAGE={checking_setup:'checking setup',running_baseline:'running baseline',running_candidate:'running candidate',checking_results:'checking results'};
const plain=id=>term(id)?.label_plain??id;
const tech=(text,tag='span')=>el(tag,{class:'technical-only mono'},text);
const at=(m,k)=>m&&Object.hasOwn(m,k)?m[k]:undefined;
const visits=v=>`${numberText(v)} ${v===1?'visit':'visits'}`;
const plural=(n,w)=>`${n} ${w}${n===1?'':'s'}`;
// Only a result the session attached to the current draft is current; a stale one lives in history and never here.
export const current=s=>s.result?.envelopes?s.result:null;
export const arms=r=>ARMS.filter(a=>r.envelopes[a]);
const proj=(r,a)=>r.envelopes[a].projection;
const metricsOf=(r,a)=>proj(r,a).metrics??{};
// Censored unless the verified count says no visit is unreleased; a missing count stays censored.
const censored=m=>at(m,'release.unreleased_count')!==0;
export function table(caption,heads,rows){return el('div',{class:'table-scroll',role:'region',tabindex:'0','aria-label':caption},el('table',{},[el('caption',{},caption),el('thead',{},el('tr',{},heads.map(h=>el('th',{scope:'col'},h)))),el('tbody',{},rows)]));}
function consistency(s){
 const r=current(s);if(!r)return NOT_AVAILABLE;
 const v=arms(r).map(a=>r.envelopes[a].consistency);
 return v.includes('INVALID_EVIDENCE')?'INVALID_EVIDENCE':v.every(x=>x==='INTERNALLY_CONSISTENT')?'INTERNALLY_CONSISTENT':'NOT_AVAILABLE';
}
// The trust axes stay separate rows; internal consistency is never merged into an approval.
export function trustRows(s){
 return [['trust.scope',FLOW_TRUST.scope],...['authenticity','authorization','decision_authority','deployment_permission','evidence'].map(k=>[`trust.${k}`,term(`trust.${k}`).value]),['trust.consistency',consistency(s)]];
}
export const trustNodes=s=>trustRows(s).map(([id,v])=>el('div',{'data-term':id},[el('dt',{},plain(id)),el('dd',{},v)]));
const guardName=g=>typeof g==='string'?g:typeof g?.guard==='string'?g.guard:NOT_AVAILABLE;
function detail(s){
 const r=current(s),list=f=>r?arms(r).map(a=>f(r.envelopes[a],a)).filter(Boolean).join('; '):'';
 if(s.status==='invalid')return `Violation code: ${list((e,a)=>e.status==='INVALID'&&`${e.primary_violation?.code??NOT_AVAILABLE} (${a})`)}.`;
 if(s.status==='incomplete')return `Guard: ${list((e,a)=>e.status==='INCOMPLETE_RESOURCE_LIMIT'&&`${guardName(e.ledger.guard)} (${a})`)}.`;
 if((s.status==='refused'||s.status==='incompatible')&&s.refusal)return `Refusal code: ${s.refusal.code}.`;
 return '';
}
// Stale wording separates a run still finishing for an older draft from a shown result that became old.
const stateText=(s,t)=>s.status==='stale'?[s.history.length&&'This result belongs to an older draft.',s.pending&&'A run for an older draft is still finishing; its result will be kept as old.','Run again to update.'].filter(Boolean).join(' '):t.definition;
export function statusText(s){
 if(s.status==='running')return `Run in progress: ${STAGE[s.progress?.stage]??STAGE.checking_setup}. No result yet.`;
 const t=term(`run.state.${s.status}`);
 return [t?`${t.label_plain}. ${stateText(s,t)}`:s.status,detail(s)].filter(Boolean).join(' ');
}
const REFUSAL={NO_CANDIDATE:'This setup has no candidate. Run the baseline only, or choose a setup with a candidate.',INVALID_SETUP:'The setup does not pass validation, so nothing ran.',INCOMPATIBLE:'The two setups differ outside the treatment fields or in a shared requirement, so they are not compared.',WORKER_UNAVAILABLE:'The run could not start in this browser.',WORKER_STOPPED:'The run stopped before it finished. Nothing is shown.',
 TRANSPORT_LIMIT:'The shared link is longer than 32,768 characters, so nothing was opened.',SHARE_ENCODING:'The shared link is not a readable setup, so nothing was opened.',INCOMPLETE_RESOURCE_LIMIT:'The configuration is larger than 524,288 bytes, so it was refused before parsing.',SHARE_SHAPE:'The configuration is not a depot lab setup file, so nothing was opened.'};
export function errorText(s){
 const r=s.refusal;if(!r)return null;
 if(r.code==='FAILED')return `The run failed while ${STAGE[r.issues[0]?.path]??STAGE.checking_setup}. Nothing is shown.`;
 const i=r.issues?.[0];
 return [REFUSAL[r.code]??`Refused: ${r.code}.`,i?`First issue: ${i.code}${i.path?` at ${i.path}`:''}${i.arm?` (${i.arm})`:''}.`:''].filter(Boolean).join(' ');
}
const CARD={could_not_reproduce:'irreproducible'};
function card(s){
 const t=term(`run.state.${s.status}`),r=current(s),lines=[];
 if(r)for(const a of arms(r)){
  const e=r.envelopes[a],v=e.primary_violation;
  if(e.status==='INVALID')lines.push(el('p',{},[`${ARM[a]}: violation ${v?.code??NOT_AVAILABLE}. Results are withheld.`,tech(` Record ${v?.seq??NOT_AVAILABLE}, tick ${v?.tick??NOT_AVAILABLE}.`)]));
  else if(e.status==='INCOMPLETE_RESOURCE_LIMIT')lines.push(el('p',{},`${ARM[a]}: stopped by guard ${guardName(e.ledger.guard)}. The prefix is not a result.`));
  else if(e.status==='CANCELLED')lines.push(el('p',{},`${ARM[a]}: cancelled.`));
 }
 if(s.status==='could_not_reproduce'&&s.result)for(const a of ARMS){const want=s.result.expected?.[`${a}_run_digest`];if(want)lines.push(tech(`${ARM[a]}: shared run digest ${want}; rerun digest ${s.result.observed?.[`${a}_run_digest`]??NOT_AVAILABLE}.`,'p'));}
 return el('div',{class:'state-card','data-state':CARD[s.status]??s.status},[el('h3',{},t?t.label_plain:s.status),el('p',{},t?stateText(s,t):NOT_AVAILABLE),...lines]);
}
// A censored lower bound reads "at least"; under a minute it keeps exact seconds, never "0 min".
const least=(v,m)=>{const x=minutesText(v);return censored(m)?`at least ${x[0]==='<'?secondsText(v):x}`:x;};
// Headline tiles (registry C1.6 rows): main display text, optional companion text and the exact machine values.
const TILES=[
 ['release.on_time_count',m=>{const [a,d,u]=['on_time_count','due_count','unfinished_due_count'].map(k=>at(m,`release.${k}`));if([a,d,u].includes(undefined))return null;return d===0?['Not applicable','no visit is due by the end of the run','release.due_count 0']:[`${numberText(a)} of ${numberText(d)} due by end`,`${visits(u)} due and not released`,`release.on_time_count ${a}; release.due_count ${d}; release.unfinished_due_count ${u}`];}],
 ['visit.overdue_s',m=>{const v=at(m,'visit.overdue_s');return v===undefined?null:[least(v,m),censored(m)?'(more may follow)':null,`${v} s`];}],
 ['visit.turnaround_observed_s',m=>{const v=at(m,'visit.turnaround_observed_s'),c=censored(m);return v===undefined?null:[`${c?'at least ':''}${hoursText(v)}`,c?'(more may follow)':null,`${v} s`];}],
 ['release.unreleased_count',m=>{const v=at(m,'release.unreleased_count');return v===undefined?null:[visits(v),null,`${v} visits`];}],
];
const tiles=r=>el('div',{class:'tiles'},TILES.map(([id,f])=>el('article',{'data-term':id},[el('h3',{},plain(id)),tech(id,'p'),...arms(r).map(a=>{const x=f(metricsOf(r,a));return el('p',{'data-arm':a},x?[`${ARM[a]}: `,el('strong',{},x[0]),x[1]&&` ${x[1]}`,tech(` ${x[2]}`)]:`${ARM[a]}: ${NOT_AVAILABLE}`);})])));
// Display format and exact unit per vector component (note 18); time components stay in exact seconds.
const KIND=id=>id==='remaining_required_kWh'?[kwhText,'mJ']:id==='remaining_required_bytes'?[gbText,'bytes']:id==='on_time_count'||id==='unreleased_count'?[numberText,'visits']:[secondsText,'s'];
const LOWER=new Set(['overdue_seconds','observed_visit_seconds']);
const cell=(v,fmt,unit,pre='')=>el('td',{class:'num'},v===null||v===undefined?NOT_AVAILABLE:[pre+fmt(v),tech(` ${v} ${unit}`)]);
function classification(r,pair){
 if(!pair)return el('p',{class:'classification'},'No comparison: this run has a baseline only.');
 const c=r.comparison,t=term(`comparison.classification.${c.classification}`);
 return el('p',{class:'classification','data-classification':c.classification},[`${plain('comparison.classification')}: `,el('strong',{},t?.label_plain??c.classification),` ${t?.definition??''}`,tech(` ${c.classification}`)]);
}
function vector(r){
 const cols=arms(r),pair=cols.length===2,cens=Object.fromEntries(cols.map(a=>[a,censored(metricsOf(r,a))]));
 const rows=pair?r.comparison.components:(proj(r,'baseline').vector?.components??[]).map(x=>({id:x.id,direction:x.direction,baseline:x.value}));
 const body=rows.map(x=>{
  const [fmt,unit]=KIND(x.id),pre=a=>LOWER.has(x.id)&&cens[a]?'at least ':'';
  return el('tr',{'data-component':x.id},[el('th',{scope:'row'},[plain(x.id),tech(` ${x.id} (${unit})`)]),el('td',{},x.direction==='up'?'↑ higher is better':'↓ lower is better'),
   ...cols.map(a=>cell(x[a],fmt,unit,pre(a))),...(pair?[cell(x.delta,v=>signedText(v,fmt),unit),el('td',{class:x.relation?`mark ${x.relation}`:null},x.relation??NOT_AVAILABLE)]:[])]);
 });
 const note=`${plain('work.remaining_reference_seconds')}: ${term('work.remaining_reference_seconds').definition} ${plain('profile.reference_effort')}: ${term('profile.reference_effort').definition} Never added across classes, and not a completion time.`;
 return [classification(r,pair),table('Every comparison component, in presentation order',['Component','Direction',...cols.map(a=>ARM[a]),...(pair?['Change','Relation']:[])],body),el('p',{class:'note'},note)];
}
// Companions (C1.6, D1-08): both unreleased partitions, work still open and active-at-H rows, counted from the
// verified per-visit states; the visit ids and exact values stay inspectable in Technical.
const STATES=['offsite','moving','servicing','work_complete_not_released','queued_outside','blocked_waiting'],DUE=['past_due','not_yet_due','no_due'];
const row=(id,cells)=>el('tr',{'data-term':id},[el('th',{scope:'row'},[plain(id),tech(` ${id}`)]),...cells]);
const val=(text,exact)=>el('td',{class:'num'},[text,exact===undefined?null:tech(` ${exact}`)]);
const flag=x=>x===null?NOT_AVAILABLE:x?'yes':'no';
function companions(r){
 const cols=arms(r),heads=['',...cols.map(a=>ARM[a])],open=a=>proj(r,a).visits.filter(v=>v.state_at_h!=='released');
 const count=list=>val(String(list.length),list.length?list.map(v=>v.id).join(' '):undefined);
 const part=(caption,prefix,key,list)=>table(caption,heads,list.map(k=>row(prefix+k,cols.map(a=>count(open(a).filter(v=>v[key]===k))))));
 const active=a=>proj(r,a).visits.flatMap(v=>v.active_at_h.map(x=>({...x,visit:v.id})));
 const metric=(id,fmt,exact)=>row(id,cols.map(a=>{const v=at(metricsOf(r,a),id);return v==null?val(NOT_AVAILABLE):val(fmt(v),exact(v));}));
 const work=v=>{const left=Object.entries(v).filter(([,x])=>x!=='0/1');return left.length?left.map(([c,x])=>`${c.replace('_',' ')} ${secondsText(x)}`).join('; '):'none';};
 const rows=[metric('work.remaining_reference_seconds',work,v=>JSON.stringify(v)),metric('energy.remaining_required_mj',kwhText,v=>`${v} mJ`),...['data.remaining_required_bytes','data.optional_unfinished_bytes'].map(id=>metric(id,gbText,v=>`${v} bytes`)),
  row('active_at_h.could_not_finish',cols.map(a=>{const x=active(a);return val(String(x.length),x.length?x.map(y=>`${y.visit} ${y.template} (${y.cls}) from tick ${y.start}, ${y.remaining.value} ${y.remaining.unit} left`).join('; '):undefined);})),
  row('active_at_h.minimum_duration_exceeded_time_left_at_start',cols.map(a=>{const x=active(a),k=x.filter(y=>y.minimum_duration_exceeded_time_left_at_start===null).length;return val(`${x.filter(y=>y.minimum_duration_exceeded_time_left_at_start).length}${k?`; ${k} ${NOT_AVAILABLE}`:''}`,x.length?x.map(y=>`${y.visit}: ${flag(y.minimum_duration_exceeded_time_left_at_start)}, lower bound ${y.lower_bound_ticks??NOT_AVAILABLE} ticks`).join('; '):undefined);}))];
 return [part('Unfinished visits at end of run, by primary state','visit.state.','state_at_h',STATES),part('Unfinished visits at end of run, by due status','visit.due_status.','due_status',DUE),table('Work still open at end of run',heads,rows)];
}
// Treatment disclosure (Q8): every authoritative field and leaf, exact old and new values.
const FIELD=p=>TERMS.find(t=>t.treatment&&(p===t.pointer||p.startsWith(t.pointer+'/')));
const shown=v=>v===null?'none':typeof v==='object'?JSON.stringify(v):String(v);
const BUNDLED="A bundled intervention cannot identify a single component's effect.";
const bundled=t=>t.fields.length>1||t.leaves.length>1;
function treatment(r){
 const t=r.comparison?.treatment;if(!t)return [];
 const leaf=l=>{const f=FIELD(l.pointer),rest=f?l.pointer.slice(f.pointer.length+1).replaceAll('/',' '):'';return el('li',{},[`${f?.label_plain??l.pointer}${rest?`, ${rest}`:''}: ${shown(l.old)} to ${shown(l.new)}`,tech(` ${l.pointer}`)]);};
 return [el('h3',{},'What the candidate changes'),el('p',{},[`${plural(t.intervention_count,'intervention')} · ${plural(t.fields.length,'authoritative field')}: ${t.fields.map(p=>FIELD(p)?.label_plain??p).join(', ')}. ${term('requirement.shared_across_arms').definition}`,tech(` ${t.fields.join(' ')}`)]),el('ul',{class:'leaves'},t.leaves.map(leaf)),bundled(t)&&el('p',{},BUNDLED)].filter(Boolean);
}
// What changed, what got worse, what remains uncertain: built only from component relations and companions.
function narrative(r){
 const c=r.comparison,n=c.components.length,by=rel=>c.components.filter(x=>x.relation===rel),names=xs=>xs.map(x=>`${plain(x.id)} ${signedText(x.delta,KIND(x.id)[0])}`).join('; ');
 const better=by('better'),worse=by('worse'),equal=by('equal'),act=arms(r).reduce((k,a)=>k+proj(r,a).visits.reduce((j,v)=>j+v.active_at_h.length,0),0);
 const list=[(better.length||worse.length)&&'Each difference changed this outcome in this model under this declared paired workload.',equal.length&&`${equal.length} of ${n} components ${equal.length===1?'is':'are'} exactly equal.`,
  arms(r).some(a=>censored(metricsOf(r,a)))&&'Late seconds and observed visit seconds are lower bounds while visits stay unfinished.',act&&`${plural(act,'started task')} could not finish by end of run; their remaining work is counted, not finished.`,bundled(c.treatment)&&BUNDLED,term('deferred.statistics').definition];
 return [el('h3',{},'What changed'),el('p',{},better.length?`Better in the candidate, ${better.length} of ${n}: ${names(better)}.`:'No component is better in the candidate.'),
  el('h3',{},'What got worse'),el('p',{},worse.length?`Worse in the candidate, ${worse.length} of ${n}: ${names(worse)}.`:'No component is worse in the candidate.'),
  el('h3',{},'What remains uncertain'),el('ul',{},list.filter(Boolean).map(x=>el('li',{},x)))];
}
// A verified current result shows tiles, the full vector and every companion; every other state shows only its card.
export function outcomeNodes(s){
 const r=current(s);
 if(s.status!=='verified'||!r)return [card(s)];
 const pair=arms(r).length===2&&r.comparison.classification!=='NOT_AVAILABLE';
 return [card(s),el('h3',{},'Headline outcomes'),tiles(r),el('h3',{},'Every component, side by side'),...vector(r),...treatment(r),el('h3',{},'What is still open at end of run'),...companions(r),...(pair?narrative(r):[])];
}
