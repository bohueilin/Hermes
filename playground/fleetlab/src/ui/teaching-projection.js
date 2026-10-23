import {metricWords} from './charts.js';
import {metricValueText,thresholdText} from './experiment.js';
import * as format from './format.js';
import {resultView,SURFACE_FRAMES} from './teaching-frames.js';
const names={completion_fraction:'completed share of requests',terminal_energy_kwh:'stored energy at the end',unfinished_visits:'unfinished visits',max_request_wait_min:'maximum rider wait',rejected_actions:'rejected actions',airport_within_target_fraction:'airport pickups within target',non_airport_completion_fraction:'non airport completed share'};
export const teachingTools={words:k=>names[k]??metricWords(k),number:format.number,signed:format.signed,nonzero:format.nonzero,metricValue:metricValueText,threshold:thresholdText};
export function pairedProjection(r){return {...r.analysis,validity:r.validity,reason:r.reason,primary:r.analysis?{...r.analysis.primary,equivalence_margin:r.spec?.margin}:null,guardrails:r.analysis?.guardrail_statuses??[],descriptive:r.descriptive};}
export const teachingResult=(key,r)=>resultView(typeof key==='string'?SURFACE_FRAMES[key]:key,r,teachingTools);
