// NF-03 accepted-record presentation; no execution or scientific schema changes.
import {exampleVisits,firstAllocationDifference,minute} from './depot-capacity-view.js';
const names={rule:'Different rule',bandwidth:'More bandwidth',power:'More power'};
const ready=v=>v.ready_s===null?'unfinished':`ready at minute ${minute(v.ready_s)}`;

export function capacityGuideShots(comparison){
  const cells=comparison.cells,base=cells.base;
  if(Object.values(cells).some(c=>c.verification?.model_validity!=='VALID'||!c.verification.comparison_eligible))return [];
  const examples=Object.fromEntries(Object.keys(names).map(k=>[k,exampleVisits(base.verification,cells[k].verification)]));
  const paired=(k,id)=>[base,cells[k]].map(c=>c.verification.visits.find(v=>v.vehicle===id));
  const pick=(k,kind)=>{const ids=examples[k][kind];return ids.find(id=>{const [a,b]=paired(k,id);return a.outcome!==b.outcome;})??ids[0];};
  const fallback=base.verification.visits[0].vehicle;
  const shot=(chapter,contrast,id,kind,duration_s,time_s)=>{
    const [a,b]=paired(contrast,id);
    return Object.freeze({chapter,contrast,vehicle:id,kind,duration_s,time_s:time_s??Math.min(a.ready_s??Infinity,b.ready_s??Infinity,base.record.end_s),
      caption:`${kind==='negative-control'?'Negative control':kind==='regressing'?'Regressing example':kind==='improving'?'Improving example':kind==='unchanged'?'Unchanged example':'Shared constraint'}: Vehicle ${id}. Base ${ready(a)}; ${names[contrast]} ${ready(b)}.${kind==='regressing'&&a.ready_s!==null&&b.ready_s!==null?` ${minute(b.ready_s-a.ready_s)} min later.`:''}`,
});
  };
  const allocation=firstAllocationDifference(base.record,cells.rule.record),ruleId=pick('rule','improving')??pick('rule','unchanged')??fallback;
  // Editorial choice: a capacity change with an on-time improvement.
  const capacity=['bandwidth','power'].find(k=>cells[k].verification.metrics.on_time>base.verification.metrics.on_time)??'bandwidth';
  const capacityId=pick(capacity,'improving')??pick(capacity,'unchanged')??fallback;
  const regress=pick('rule','regressing'),negative=['power','bandwidth'].find(k=>examples[k].unchanged.length===base.verification.visits.length);
  const finalCase=negative??(capacity==='bandwidth'?'power':'bandwidth'),finalId=pick(finalCase,'unchanged')??fallback;
  return Object.freeze([
    shot('Constraint','rule',allocation?.vehicle??fallback,'constraint',6,allocation?.time_s??base.record.events[0].time_s),
    shot('Constraint','rule',ruleId,examples.rule.improving.includes(ruleId)?'improving':'unchanged',7),
    shot('Consequence',capacity,capacityId,examples[capacity].improving.includes(capacityId)?'improving':'unchanged',7),
    shot('Consequence',capacity,capacityId,examples[capacity].improving.includes(capacityId)?'improving':'unchanged',7,Math.max(...paired(capacity,capacityId).map(v=>v.ready_s??base.record.end_s))),
    shot('Trade-off','rule',regress??ruleId,regress?'regressing':'unchanged',7),
    shot('Trade-off',finalCase,finalId,negative?'negative-control':'unchanged',6),
  ]);
}

/** Accepted useful service, full-horizon denominator and active intervals. */
export function capacityActivity(record,kind){
  const intervals=[];let used=0,active_s=0;
  for(const slot of record.intervals){const rate=Object.values(slot[kind]).reduce((a,b)=>a+b,0),dt=slot.end_s-slot.start_s;used+=rate*dt;
    if(rate>0){active_s+=dt;const last=intervals.at(-1);if(last?.end_s===slot.start_s)last.end_s=slot.end_s;else intervals.push({start_s:slot.start_s,end_s:slot.end_s});}}
  const capacity=kind==='upload'?record.scenario.uplink_bytes_s:record.scenario.site_power_j_s;
  return {used,available:capacity*record.scenario.horizon_s,active_s,intervals};
}

/** Generation-bound frames; intent remains separate from eligibility. */
export function createCapacityGuide({visible=()=>false,reducedMotion=()=>false,dataSaving=()=>false,render=()=>{},present=()=>{},scheduler={request:cb=>requestAnimationFrame(cb),cancel:id=>cancelAnimationFrame(id)}}={}){
  let generation=0,frameGeneration=0,plan=[],index=-1,elapsed=0,intent=false,state='idle',playing=false,frame=null,last=null,destroyed=false;
  const restricted=()=>Boolean(reducedMotion()||dataSaving());
  const getState=()=>({state,playing,elapsed_s:elapsed,shot:plan[index]??null,index,reduced:Boolean(reducedMotion()),restricted:restricted()});
  const emit=()=>render(getState());
  const stop=()=>{playing=false;last=null;frameGeneration++;if(frame!==null)scheduler.cancel(frame);frame=null;};
  const display=()=>{if(plan[index])present(plan[index]);emit();};
  const pause=(reason='userPaused')=>{if(destroyed)return;intent=false;stop();state=reason;emit();};
  function schedule(){if(playing&&frame===null){const token=frameGeneration;frame=scheduler.request(t=>{if(token===frameGeneration)tick(t);});}}
  function refresh(){
    if(destroyed)return;
    if(restricted()){if(intent||playing){intent=false;stop();state='preferencePaused';emit();}return;}
    if(!intent||!plan.length)return;
    if(!visible()){if(state!=='visibilityPaused'){stop();state='visibilityPaused';emit();}return;}
    if(!playing){playing=true;last=null;state='playing';emit();schedule();}
  }
  function tick(timestamp){
    frame=null;if(destroyed||!playing)return;refresh();if(!playing)return;
    if(last===null){last=timestamp;schedule();return;}
    elapsed+=Math.min(250,Math.max(0,timestamp-last))/1000;last=timestamp;
    const end=plan.reduce((n,s)=>n+s.duration_s,0);let sum=0,next=plan.length-1;
    for(let i=0;i<plan.length;i++){sum+=plan[i].duration_s;if(elapsed<sum){next=i;break;}}
    if(next!==index){index=next;display();}
    if(elapsed>=end){elapsed=end;intent=false;stop();state='ended';emit();}else schedule();
  }
  return {getState,refresh,pause,
    request(){if(destroyed)return null;stop();generation++;plan=[];index=-1;elapsed=0;intent=!restricted();state='loading';emit();return generation;},
    accept(shots,token){if(destroyed||token!==generation||!shots.length)return;plan=shots;index=0;elapsed=0;state=intent?'ready':restricted()?'preferencePaused':'userPaused';display();refresh();},
    resume(){if(destroyed||!plan.length)return;if(state==='ended'){elapsed=0;index=0;}display();intent=true;refresh();},
    chapter(name){if(destroyed||!plan.length)return;pause();index=plan.findIndex(s=>s.chapter===name);if(index<0)index=0;elapsed=plan.slice(0,index).reduce((n,s)=>n+s.duration_s,0);display();},
    next(){if(destroyed||!plan.length)return;pause();index=Math.min(index+1,plan.length-1);elapsed=plan.slice(0,index).reduce((n,s)=>n+s.duration_s,0);display();},
    destroy(){if(destroyed)return;stop();intent=false;generation++;destroyed=true;},
  };
}
