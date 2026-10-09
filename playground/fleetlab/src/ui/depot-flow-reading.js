import {el} from './dom.js';
import {FLOW_RULES} from '../model/depot-flow-contract.js';
import {COHORT_RULES} from '../model/depot-cohort-contract.js';
export const minute=s=>s===null||s===undefined?'Not observed':`${Number((s/60).toFixed(4))} min`;
export const outcomeLabel={on_time:'On time',late:'Late',unfinished_due:'Unfinished · deadline reached',pending:'Unfinished · deadline pending'};
export const ruleName=id=>[...FLOW_RULES,...COHORT_RULES].find(r=>r.id===id)?.name??id;
export const table=(caption,heads,rows,attrs={})=>el('div',{class:'flow-table',tabindex:0,role:'region','aria-label':caption,...attrs},el('table',{},[el('caption',{},caption),el('thead',{},el('tr',{},heads.map(h=>el('th',{scope:'col'},h)))),el('tbody',{},rows.map(row=>el('tr',{},row.map((c,i)=>el(i===0?'th':'td',i===0?{scope:'row'}:{},c)))))]));
export const detail=(title,children)=>el('details',{},[el('summary',{},title),...children]);
export const button=(text,fn,attrs={})=>el('button',{type:'button',class:'studio-button',on:{click:fn},...attrs},text);
export const FLOW_GLOSSARY=Object.freeze({
 uplink:'Uplink: the shared connection that carries uploaded bytes away from this depot.',
 useful:'Useful bytes: the data accepted toward an upload. This model has no protocol overhead or retries.',
 readiness:'Readiness: upload, energy target and the post-upload step are all complete.',
 deadline:'Departure deadline: the latest modeled ready time counted as on time; equality is on time.',
 late:'Late minutes: time past a departure deadline. An unfinished visit contributes at least its delay so far.',
 sharing:'Equal sharing: each eligible upload gets an equal link share, with deterministic rounding of whole bytes.',
 dependency:'Dependency: a task that must finish before another can start. The local step depends on upload.',
 bound:'Lower bound: an ideal limit. Fitting an individual bound does not prove all vehicles can meet their deadlines together.',
 horizon:'Horizon: the observation end set before the run. Pending work is reported, never silently dropped.',
 authority:'NOT_EVIDENCE: a constructed teaching run, without authentication or authority to change an operation.',
});
export function outcomesView(result,previous){
 const ids=result.scenario.vehicles.map(v=>v.id),changes=previous?.changes??[];
 const fields=a=>{const m=a.verification.metrics;return [`${m.on_time} of ${ids.length}`,String(m.late),`${m.unfinished_due} / ${m.pending}`,`${m.final_lateness?'':'At least '}${minute(m.lateness_lower_bound_s)}`,...a.verification.visits.map(v=>{const was=changes.find(c=>c.rule===a.record.rule&&c.vehicle===v.vehicle);return `${minute(v.ready_s)} · ${outcomeLabel[v.outcome]}${was?` (was ${minute(was.previous_ready_s)})`:''}`;})];};
 const heads=['On time','Late','Unfinished / pending','Late minutes',...ids.map(id=>`Vehicle ${id} ready`)];
 return el('section',{'aria-label':'End-of-run outcomes','data-flow-outcomes':''},[el('h3',{},'End-of-run outcomes'),table('Completed comparison · whole observation period',['Upload rule',...heads],result.arms.map(a=>[ruleName(a.record.rule),...fields(a)]),{class:'flow-table flow-outcomes-wide'}),el('div',{class:'flow-outcomes-phone'},result.arms.map(a=>el('article',{},[el('h4',{},ruleName(a.record.rule)),el('dl',{},fields(a).flatMap((v,i)=>[el('dt',{},heads[i]),el('dd',{},v)]))])))]);
}
export function boundView(result){
 const b=result.shared_bound;
 if(b){const required=b.required_bytes/1e9,available=b.available_bytes/1e9,shortfall=Math.max(0,required-available),pair=b.vehicles.join(' and '),deadline=result.arms.find(a=>a.record.rule==='cohort_departure_deadline');const attained=b.jointly_impossible&&deadline?.verification.metrics.final_lateness&&deadline.verification.metrics.lateness_lower_bound_s===b.minimum_lateness_s;const bar=el('div',{class:'flow-capacity-bar','aria-hidden':'true'},[el('span',{},`${available} GB available`),el('span',{},`${shortfall} GB short`)]);bar.firstChild.style.width=`${Math.min(100,100*available/required)}%`;
 return el('section',{class:'flow-bound','aria-label':'Shared capacity bound'},[el('h3',{},'Can both urgent visits leave on time?'),el('p',{},`${pair} need ${required} GB uploaded by minute ${b.upload_by_s/60}, leaving time for their local steps. The link can carry ${available} GB by then. ${b.jointly_impossible?'Their combined work cannot fit.':'This bound does not rule out meeting both deadlines; it does not establish a feasible joint schedule.'}`),table(`Shared link requirement by minute ${b.upload_by_s/60}`,['Work','Required','Available'],[[pair,`${required} GB`,`${available} GB`]]),bar,b.jointly_impossible?el('p',{},`${Object.entries(b.last_vehicle_lateness_s).map(([id,t])=>`If ${id} finishes this pair last, at least ${minute(t)} of lateness remains`).join('; ')}. ${attained?`Departure deadline first reaches the ${minute(b.minimum_lateness_s)} bound in this fixture. `:''}This is a bound for these visits, not a general scheduling guarantee.`):null]);}
 return el('section',{class:'flow-bound'},[el('h3',{},'Individual earliest readiness'),el('div',{class:'flow-bounds'},result.bounds.map(b=>el('article',{},[el('h4',{},`Vehicle ${b.vehicle}`),el('p',{},`Earliest ${minute(b.earliest_s)} · deadline ${minute(b.deadline_s)}`),el('p',{},b.individually_impossible?'Impossible even with the full link and charger alone.':'Individual bound fits; joint feasibility is not established.')]))),detail('How the lower bound is calculated',[el('p',{},'From arrival, take the later of energy divided by full charger power, or upload divided by full uplink plus the local step. Competition can only add delay.')])]);
}
export function checksView(result){return detail('Named checks · independently reconstructed',[
 el('p',{},'These checks reconstruct accepted work, capacity, task order and completion times. They check internal model consistency; they do not authenticate a record or grant operational authority.'),
 ...result.arms.map(a=>{const groups=new Map();for(const c of a.verification.checks){const key=c.name.replace(/^Interval \d+\s*[·:–-]?\s*/i,'');const g=groups.get(key)??{count:0,status:c.status,rule:c.rule};g.count++;if(c.status!=='PASS')g.status=c.status;groups.set(key,g);}return detail(`${ruleName(a.record.rule)} · model checks`,[table(`${ruleName(a.record.rule)} recorded model checks`,['Check','Count','Status','Exact rule'],[...groups].map(([k,g])=>[k,g.count,g.status,String(g.rule).replace(/\b\d{4,}\b/g,n=>Number(n).toLocaleString('en-US'))]))]);}),
]);}
export function eventLedger(result){return table('Exact event ledger across upload rules',['Rule','Time','Vehicle','Event','Sequence'],result.arms.flatMap(a=>a.record.events.map(e=>[ruleName(a.record.rule),minute(e.time_s),e.vehicle??'All',`${e.type}${e.task?` · ${e.task}`:''}`,e.seq])));}
export function tradeoffText(result){
 const base=result.arms[0];return result.arms.slice(1).map(a=>{const delta=a.verification.visits.map(v=>{const before=base.verification.visits.find(b=>b.vehicle===v.vehicle);if(v.ready_s===null||before.ready_s===null)return `Vehicle ${v.vehicle}: ready-time change unavailable`;const d=v.ready_s-before.ready_s;return d===0?`Vehicle ${v.vehicle}: unchanged`:`Vehicle ${v.vehicle} becomes ready ${minute(Math.abs(d))} ${d>0?'later':'earlier'}`;}).join('; ');return `${ruleName(a.record.rule)} versus first come: ${delta}.`;});
}
export function guessQuestion(suggestion,cohort=false){
 if(suggestion){const {kind,rule,question}=suggestion;const choices=kind==='K1'?[...FLOW_RULES.map(r=>[r.id,r.name]),['tie','A tie']]:kind==='K2'?[['0','None'],['1','One or two'],['3','Three or more']]:kind==='K3'?[['yes','Yes'],['no','No']]:[['A','Vehicle A'],['B','Vehicle B'],['A,B','Both vehicles'],['none','Neither vehicle']];return {kind,rule,question,choices};}
 return {kind:'first',rule:cohort?'cohort_fifo':'nf_fifo',question:'First come, first served: who will miss their departure deadline?',choices:cohort?[['A','Vehicle A'],['B','Vehicle B'],['C','Vehicle C'],['D','Vehicle D'],['none','No vehicle']]:[['A','Vehicle A'],['B','Vehicle B'],['A,B','Both vehicles'],['none','Neither vehicle']]};
}
export function guessFeedback(guess,result,previous){
 if(!guess?.value)return null;
 const arm=result.arms.find(a=>a.record.rule===guess.rule)??result.arms[0];let actual,explanation='';
 if(guess.kind==='K1'){const counts=result.arms.map(a=>a.verification.metrics.late+a.verification.metrics.unfinished_due),min=Math.min(...counts),winners=result.arms.filter((a,i)=>counts[i]===min);actual=winners.length>1?'A tie':ruleName(winners[0].record.rule);explanation=`Fewest missed departures: ${min}. Read late minutes too.`;}
 else if(guess.kind==='K2'){actual=previous?String(previous.changed_count):'Comparison unavailable';explanation='Counted ready times across both vehicles and all three rules.';}
 else if(guess.kind==='K3'){actual=arm.verification.metrics.on_time===2?'Yes':'No';explanation=`${ruleName(arm.record.rule)} meets ${arm.verification.metrics.on_time} of 2 departure deadlines.`;}
 else {const missed=arm.verification.visits.filter(v=>['late','unfinished_due'].includes(v.outcome));actual=missed.length?missed.map(v=>`Vehicle ${v.vehicle}`).join(' and '):'Neither vehicle';explanation=missed.map(v=>{const charge=v.tasks.charge??0,post=v.tasks.post??0;return charge>post?`Vehicle ${v.vehicle} is held by charging until ${minute(charge)}.`:`Vehicle ${v.vehicle} needs upload completion and its local step through ${minute(post)}.`;}).join(' ');}
 return `Your guess: ${guess.label}. Observed answer: ${actual}. ${explanation}`;
}
