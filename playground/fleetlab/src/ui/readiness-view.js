/** Projection of recorded Bay work orders and comparisons. No scheduling or metric production. */
import {el} from './dom.js';
const fmt=v=>v===null||v===undefined?'Not available':Number(v).toLocaleString('en-US',{maximumFractionDigits:2});
const cell=v=>v===null||v===undefined?'Not available':typeof v==='number'?el('span',{title:String(v)},fmt(v)):String(v);
const table=(headings,rows)=>el('div',{class:'ops-table-wrap',tabindex:0,'aria-label':headings.join(', ')},el('table',{},[
  el('thead',{},el('tr',{},headings.map(h=>el('th',{scope:'col'},h)))),el('tbody',{},rows.map(row=>el('tr',{},row.map(v=>el('td',{},cell(v))))))]));
const exact=value=>el('details',{},[el('summary',{},'Exact recorded values and submitted settings'),el('pre',{},JSON.stringify(value,null,2))]);
export const blockerText=code=>({WORKER_UNAVAILABLE:'No qualified cleaning worker is free',BAY_UNAVAILABLE:'No cleaning bay is free',BAY_AND_WORKER_UNAVAILABLE:'Both cleaning bays and workers are occupied',POLICY_DEFERRED:'The policy is withholding required cleaning',OTHER_RESOURCE:'Waiting for another stage resource',INBOUND_TRAVEL:'Vehicle is still traveling to its depot'}[code]??code)+(code?' ('+code+')':'');
const checkText=check=>`${check.name}: ${check.status}${check.threshold===undefined?'':` · observed ${fmt(check.value)} ${check.unit}; limit ${check.operator} ${check.threshold} ${check.unit}`}`;

export function readinessResultView(result){
  const r=result.readiness,m=r.metrics;
  return el('section',{},[el('h2',{},'What prevented depot readiness?'),el('p',{},`${result.version} · ${r.metric_version} · NOT_EVIDENCE · simulation-only · decision authority NONE`),
    el('p',{},`Simulator state: ${r.validity}. Policy checks are separate from simulator validity.`),
    table(['Readiness measure','Recorded value'],[
      ['Visits ready by observation end / all started visits',`${m.ready_by_deadline} / ${m.deadline_visits}`],
      ['Unfinished visits / inbound visits',`${m.unfinished_visits} / ${m.inbound_visits}`],
      ['Unfinished required tasks',m.unfinished_tasks],['Oldest unfinished task age (min)',m.oldest_unfinished_task_age_min],
      ['Queue time, all on-site visits (task-min)',m.queue_observed_min],['Active work, all on-site visits (task-min)',m.active_observed_min],
      ['Completed-only visit mean: on-site / queue / active (min)',[m.completed_visit_mean_onsite_min,m.completed_visit_mean_queue_min,m.completed_visit_mean_active_min].map(fmt).join(' / ')],
    ]),
    el('h3',{},'Where queued time went'),table(['Exclusive blocker','Queued task-minutes'],Object.entries(m.blocked_minutes).map(([k,v])=>[blockerText(k),v])),
    el('h3',{},'Named checks'),el('ul',{},r.checks.map(check=>el('li',{},checkText(check)))),
    el('details',{},[el('summary',{},'Work-order ledger at observation end'),table(['Visit','Task','Required','State','Queued at','Started at','Finished at','Queue min','Active min'],
      result.visits.flatMap(v=>v.work_order.map(t=>[v.id,t.stage,t.required?'Yes':'Not applicable',t.status,...[t.queued_minute,t.started_minute,t.completed_minute].map(x=>x===null?'Not available':x),t.queue_minutes,t.active_minutes]))),
      el('p',{},'Times are elapsed minutes from run start. Not-reached tasks remain required; no completion is inferred from a vehicle location.')]),
    el('ul',{},r.limitations.map(s=>el('li',{},s))),exact({model_version:result.version,config:result.config,readiness:r,visits:result.visits}),
  ]);
}

export function readinessComparisonView(comparison){
  const invalid=comparison.arms.slice(1).find(a=>a.available&&!a.comparison.comparable);
  if(invalid)return el('p',{},`Comparison unavailable: ${invalid.comparison.reason}`);
  return el('section',{},[el('h3',{},'Test one resource at a time'),el('p',{},comparison.question),
    el('p',{},`One seed (${comparison.seed_set.join(', ')}), ${comparison.horizon_minutes} minutes. Descriptive only; no confidence interval, winner or recommendation. NOT_EVIDENCE.`),
    ...comparison.arms.slice(1).map(a=>el('p',{},`${a.label}: ${a.from} → ${a.to}. ${a.available?'All other inputs and the required-work rule held fixed against baseline.':'Not available: '+a.reason}`)),
    table(['Measure','Baseline','Extra worker','Extra bay'],[
      ['Trips completed / all requests',...comparison.arms.map(a=>a.result?`${a.result.metrics.completed_trips} / ${a.result.metrics.total_requests}`:'Not available')],
      ...[['Unserved requests','unserved_requests'],['Still waiting','pending_requests'],['Assigned / boarding / trip','in_progress_trips'],['Unfinished visits','censored_visits'],['Terminal energy (kWh)','final_energy_kwh']].map(([label,key])=>[label,...comparison.arms.map(a=>a.result?.metrics[key]??null)]),
      ...[['Unfinished required tasks','unfinished_tasks'],['Oldest unfinished task age (min)','oldest_unfinished_task_age_min'],['All-visit queue (task-min)','queue_observed_min'],['All-visit active (task-min)','active_observed_min'],['Completed-only mean on-site (min)','completed_visit_mean_onsite_min']].map(([label,key])=>[label,...comparison.arms.map(a=>a.result?.readiness.metrics[key]??null)]),
      ['Ready by end / started visits',...comparison.arms.map(a=>a.result?`${a.result.readiness.metrics.ready_by_deadline} / ${a.result.readiness.metrics.deadline_visits}`:'Not available')],
      ['Completed-trip delta vs baseline','Reference',...comparison.arms.slice(1).map(a=>a.comparison.deltas?.completed_trips??null)],
    ]),
    ...comparison.arms.filter(a=>a.available).map(a=>el('details',{},[el('summary',{},`${a.id}: checks and blocked time`),el('ul',{},a.result.readiness.checks.map(c=>el('li',{},checkText(c)))),table(['Exclusive blocker','Queued task-minutes'],Object.entries(a.result.readiness.metrics.blocked_minutes).map(([k,v])=>[blockerText(k),v]))])),
    el('p',{},'Completed service includes every request created before the horizon in its denominator, including late unfinished demand. This is not a pickup SLA. Queue, active time and work mix can change as consequences of availability and dispatch. A resource addition can leave outcomes unchanged or worse; inspect checks and unfinished work before interpreting the trade-off.'),
    el('a',{class:'studio-button',download:'fleetlab-readiness-NOT_EVIDENCE.json',href:'data:application/json;charset=utf-8,'+encodeURIComponent(JSON.stringify(comparison,null,2))},'Download exact comparison JSON'),
    exact(comparison),
  ]);
}
