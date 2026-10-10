// Presentation clock only. No model execution, record mutation, layout reads or control rebuilding.
const SPEEDS = [10, 20, 40];
const browserScheduler = () => ({request: fn => globalThis.requestAnimationFrame(fn), cancel: id => globalThis.cancelAnimationFrame(id)});

/** render receives frame state; textChanged limits prose updates to seeks, events, minutes and stops.
 * pause(reason) is silent for lifecycle reasons; motionChanged() receives app preference notifications.
 * The injectable scheduler is {request(callback), cancel(id)}, using millisecond timestamps.
 */
export function createDepotFlowPlayer({horizon_s, eventTimes = [], moments = [], quantum_s = 1,
  scheduler = browserScheduler(), reducedMotion = () => false, render = () => {}, announce = () => {},
  eventSentence = time => `Minute ${time / 60}.`, visibilityTarget = globalThis.document} = {}) {
  if (!Number.isFinite(horizon_s) || horizon_s <= 0 || ![1, .25].includes(quantum_s)) throw new RangeError('Invalid playback horizon or time step.');
  const times = [...new Set([0, ...eventTimes, horizon_s])].sort((a,b) => a-b);
  if (times.some(t => !Number.isFinite(t) || t < 0 || t > horizon_s)) throw new RangeError('Invalid event time.');
  const stops = moments.slice().sort((a,b) => a.time_s-b.time_s);
  if (stops.some((m,i) => !Number.isFinite(m.time_s) || m.time_s < 0 || m.time_s > horizon_s || (i && m.time_s === stops[i-1].time_s))) throw new RangeError('Invalid guided moment.');
  let time=0, sampled=0, playing=false, revealing=false, speed=20, guided=true, reduced=Boolean(reducedMotion());
  let frame=null, last=null, destroyed=false, reason='initial', moment=null;
  const label=()=>playing?'Pause':sampled===horizon_s?'Play from minute 0':reduced?'Next event':(revealing&&sampled>0?'Continue':'Play');
  const getState=()=>({time_s:sampled,playing,speed,guided,revealing,reduced,label:label(),reason,moment});
  const emit=(why,textChanged=true)=>{reason=why;render({...getState(),textChanged});};
  const cancel=()=>{if(frame!==null)scheduler.cancel(frame);frame=null;last=null;};
  const stop=()=>{playing=false;cancel();};
  const schedule=()=>{if(!destroyed&&playing&&frame===null)frame=scheduler.request(tick);};
  const at=t=>{time=t;sampled=Math.min(horizon_s,Math.floor((t+1e-9)/quantum_s)*quantum_s);};
  const pause=(why='pause')=>{if(destroyed)return;const was=playing;stop();moment=null;emit(why);if(was&&why==='pause')announce(`Paused at minute ${Math.floor(sampled/60)}${sampled%60?`, ${sampled%60} seconds`:''}.`);};
  function motionChanged(){
    if(destroyed)return;
    const value=Boolean(reducedMotion());if(value===reduced)return;
    reduced=value;pause('motion');
  }
  function tick(timestamp){
    frame=null;if(destroyed||!playing)return;
    if(visibilityTarget?.hidden){pause('hidden');return;}
    if(Boolean(reducedMotion())!==reduced){motionChanged();return;}
    if(last===null){last=timestamp;schedule();return;}
    const delta=Math.max(0,timestamp-last);last=timestamp;
    const before=sampled;
    const nextMoment=guided?stops.find(m=>m.time_s>time):null;
    const limit=nextMoment?.time_s??horizon_s;
    at(Math.min(time+Math.min(delta,250)*speed/1000,limit,horizon_s));
    const end=time>=horizon_s,hit=nextMoment&&time===nextMoment.time_s;
    if(end||hit)stop();
    moment=hit?nextMoment:null;
    if(sampled!==before||end||hit)emit(end?'end':hit?'guided':'frame',Boolean(end||hit||Math.floor(before/60)!==Math.floor(sampled/60)||times.some(t=>t>before&&t<=sampled)));
    if(end)announce(`End of the recorded run at minute ${horizon_s/60}. Final results are in the End-of-run outcomes table.`);
    else if(hit)announce(`Guided moment ${stops.indexOf(nextMoment)+1} of ${stops.length}. ${nextMoment.caption}`);
    schedule();
  }
  /** Under reduced motion, Play steps once to the next event instead of starting a clock. */
  function play(){
    if(destroyed||playing||visibilityTarget?.hidden)return;
    reduced=Boolean(reducedMotion());
    if(reduced){revealing=true;if(sampled>=horizon_s)seek(0,{announce:true});else next();return;}
    if(sampled>=horizon_s)at(0);
    revealing=true;playing=true;moment=null;last=null;emit('play');
    announce(guided?`Playing from minute ${sampled/60} at ${speed} times speed. Stops at ${stops.filter(m=>m.time_s>sampled).length} guided moments.`:`Playing to minute ${horizon_s/60} without stopping.`);
    schedule();
  }
  function seek(t,{announce: speak=false}={}){
    if(destroyed)return;if(!Number.isFinite(t))throw new RangeError('Invalid playback time.');
    stop();at(Math.max(0,Math.min(horizon_s,t)));moment=stops.find(m=>m.time_s===sampled)??null;emit('seek');if(speak)announce(eventSentence(sampled));
  }
  const next=()=>seek(times.find(t=>t>sampled)??horizon_s,{announce:true});
  const visibility=()=>{if(visibilityTarget?.hidden)pause('hidden');};
  visibilityTarget?.addEventListener('visibilitychange',visibility);
  return {getState,play,pause,seek,motionChanged,next,
    previous(){seek([...times].reverse().find(t=>t<sampled)??0,{announce:true});},
    restart(){if(destroyed)return;revealing=true;seek(0);},
    setSpeed(value){if(!SPEEDS.includes(value))throw new RangeError('Playback speed must be 10, 20 or 40.');if(destroyed)return;speed=value;emit('speed',false);},
    setGuided(value){if(destroyed)return;guided=Boolean(value);emit('guided-mode',false);},
    destroy(){if(destroyed)return;stop();destroyed=true;visibilityTarget?.removeEventListener('visibilitychange',visibility);},
  };
}
