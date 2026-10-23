import {SURFACE_FRAMES,frameView,runLine} from './teaching-frames.js';
export function decisionForConfig(c){return SURFACE_FRAMES[c.launch?'launch':c.airport?'airport':c.resources?'resources':c.charging?.policy==='deadline'?'deadlines':c.charging?'charging':c.readiness?'staffing':'day'];}
export const decisionView=d=>frameView(d,{title:d.id});
export const comparisonLearning=r=>runLine(SURFACE_FRAMES.charging,r.analysis?{...r.analysis,validity:r.validity,guardrails:r.analysis.guardrail_statuses,margin:r.spec?.margin}:r).line;
