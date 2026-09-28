/** Scale lab A, response reserve: one pooled support queue under an ordinary day and one area-wide event.
 * Counts only, no map. Page-only. Every rate is a teaching assumption. Simulation only, NOT_EVIDENCE, decision authority
 * NONE. The paired instrument is reached through scale-contract.js only. */
import {u32} from '../core/keyed.js';
import {freezeScale,scalePairSteps} from './scale-contract.js';
/** Fleet sizes of the ladder. Levers act at the middle one. */
export const FLEETS=Object.freeze([2000,6000,20000]);
/** Fixed teaching assumptions: agents per 1,000 vehicles, ordinary busy share, mean answer time, event start and length,
 * responder call share, the burst under capacity, the burst depth floor, the call target and the long stop threshold. */
export const RULE=Object.freeze({agents:1,busy:.65,answer_s:30,start_min:480,span_min:180,line:.01,absorbed:800,depth:4,target_s:30,long_s:120});
const DAY=86400,{agents:K,busy:B,answer_s:H,span_min:SPAN,line:LINE,absorbed:CALM}=RULE,[SMALL,TEST,LARGE]=FLEETS,pool=f=>f/1000*K,DELAYS=[15,60,120,180,240];
/** Closed form for c agents, a agents' worth of work and mean answer H: mean wait, and the share of stops (wait plus
 * answer) of x or longer when waiting requests are answered in turn at the drain rate theta. */
export function closedForm(c,a=c*B,theta=(c-a)/H){
  let b=1;for(let k=1;k<=c;k++)b=a*b/(k+a*b);
  const wait=b/(1-a/c*(1-b)),m=1/H;
  return {mean_wait_s:wait*H/(c-a),stop_share:x=>(1-wait)*Math.exp(-m*x)+wait*(theta*Math.exp(-m*x)-m*Math.exp(-theta*x))/(theta-m)};
}
/** Smallest pool whose closed-form ordinary wait does not pass the wait at the smallest fleet. */
export function leanPool(fleet){
  const a=pool(fleet)*B,target=closedForm(pool(SMALL)).mean_wait_s;
  let c=Math.floor(a)+1;while(closedForm(c,a).mean_wait_s>target)c++;
  return c;
}
/** Rates only, per 1,000 vehicles, from the event load in permille. `lean` is the same-ratio pool over the pool in use. */
export function rates(load,lean=1){
  const moved=(load/1000/B-1)/(1440/SPAN-1),W=load/1000*lean,off=B*lean*(1-moved),over=Math.max(0,W-1),cap=K/lean*60/H,peak=over*SPAN*cap,drain=over*SPAN/(1-off),answer=(1-LINE)*1440*K*B;
  return {load:W,moved,peak,drain,answer,stopped:peak*(SPAN+drain)/2+answer,depth:over*Math.sqrt(pool(SMALL)*60/H*SPAN/W),requests:K*B*3600/H};
}
/** Rates only for a lever arm at the tested fleet: stopped vehicle-minutes per 1,000 vehicles. The backlog runs through segments
 * of [minutes, net load]; a directive releases the waiting requests that were moved into the event and removes the later ones. */
export function leverRates(load,lever,size,d){
  const r=rates(load),W=r.load,c=K*60/H,o=B*(1-r.moved),f=1+size/pool(TEST);
  let q=0,a=0;const go=(...s)=>{for(const [t,x] of s){const e=q+x*c*t;a+=x<0&&e<0?q*q/-x/c/2:(q+e)/2*t;q=Math.max(0,e);}};
  go(...d<SPAN?[[d,W-1]]:[[SPAN,W-1],[d-SPAN,o-1]]);
  if(lever==='reserve')go(...d<SPAN?[[SPAN-d,W-f]]:[],[1e9,o-f]);
  else{const m=Math.min(q,Math.max(0,c*(W*SPAN-d)))*(1-o/W);q-=m;a-=(m+Math.max(0,SPAN-d)*(W-o)*c)*(1-LINE)*H/60;go([1e9,o-1]);}
  return a+r.answer;
}
const stream=s=>{let a=s>>>0;return()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};};
const draw=(r,mean)=>-Math.log(1-r())*mean;
/** Requests of one day at one fleet. Depends on seed and fleet only, never on staffing, event load or a lever. One keyed
 * draw per simulated minute seeds that minute's stream; each request takes five draws in a fixed order. */
export function buildTape(fleet,seed){
  const rate=pool(fleet)*B/H,size=Math.ceil(rate*DAY+8*Math.sqrt(rate*DAY)+64),t=new Float64Array(size),h=new Float64Array(size),u=new Float64Array(size),v=new Float64Array(size),line=new Uint8Array(size);
  let n=0;
  for(let m=0;m<1440;m++){
    const r=stream(u32('response-reserve',seed,fleet,'minute',m));
    for(let x=m*60+draw(r,1/rate);x<(m+1)*60&&n<size;x+=draw(r,1/rate)){t[n]=x;h[n]=draw(r,H);line[n]=r()<LINE?1:0;u[n]=r();v[n]=r();n++;}
  }
  return {n,t,h,u,v,line,moved:new Uint8Array(n),end:null,fleet};
}
/** Same requests, classes, answers and count: a share is re-timed into the event, so timing changes and work does not. */
export function applyEvent(tape,load){
  const share=rates(load).moved,a=RULE.start_min*60,w=SPAN*60,kept=[],went=[],n=tape.n,when=i=>a+tape.v[i]*w;
  for(let i=0;i<n;i++)(tape.u[i]<share?went:kept).push(i);
  went.sort((x,y)=>when(x)-when(y)||x-y);
  const out={n,t:new Float64Array(n),h:new Float64Array(n),line:new Uint8Array(n),moved:new Uint8Array(n),end:a+w,fleet:tape.fleet};
  for(let i=0,j=0,k=0;k<n;k++){
    const take=j>=went.length||i<kept.length&&tape.t[kept[i]]<=when(went[j]),s=take?kept[i++]:went[j++];
    out.t[k]=take?tape.t[s]:when(s);out.h[k]=tape.h[s];out.line[k]=tape.line[s];out.moved[k]=take?0:1;
  }
  return out;
}
/** One simulated day. `arm`: {lever:'none'|'reserve'|'directive'|'shared', size, delay}. Responder calls are answered
 * first unless the line is shared; no answer in progress is interrupted. The loop runs past midnight until every request
 * of the day is answered or released. `broken` names the first broken invariant, or is null. */
export function simulateDay(tape,agents,arm){
  const {n,t,h,line,moved,end}=tape,at=(RULE.start_min+arm.delay)*60,R=arm.lever==='reserve'?at:Infinity,D=arm.lever==='directive'?at:Infinity,shared=arm.lever==='shared';
  const started=new Float64Array(n).fill(NaN),ends=[],last=[-1,-1];
  let staff=agents,next=0,vh=0,lh=0,joined=false,directed=false,work=0,late=0,calls=0,waiting=0,peak=0,clear=null,order=0;
  const serve=(i,now)=>{const k=shared?0:line[i];if(t[i]<last[k])order++;last[k]=t[i];started[i]=now;ends.push(now+h[i]);if(now<DAY)work+=Math.min(DAY,now+h[i])-now;};
  for(;;){
    let tc=Infinity,first=0;for(let i=0;i<ends.length;i++)if(ends[i]<tc){tc=ends[i];first=i;}
    const now=Math.min(next<n?t[next]:Infinity,tc,joined?Infinity:R,directed?Infinity:D);
    if(now===Infinity)break;
    if(now===tc){ends[first]=ends.at(-1);ends.pop();}
    else if(!joined&&now===R){joined=true;staff+=arm.size;}
    else if(!directed&&now===D){directed=true;for(let i=vh;i<next;i++)if(moved[i]&&!line[i])waiting--;}
    else{if(line[next])calls++;else if(!(directed&&moved[next])&&++waiting>peak)peak=waiting;next++;}
    while(ends.length<staff){
      while(vh<next&&(line[vh]||directed&&moved[vh]))vh++;
      while(lh<next&&!line[lh])lh++;
      const V=vh<next,L=lh<next;if(!V&&!L)break;
      if(L&&(!shared||!V||lh<vh)){if(now-t[lh]>RULE.target_s)late++;serve(lh++,now);}else{waiting--;serve(vh++,now);}
    }
    if(clear===null&&end!==null&&now>=end&&waiting===0)clear=(now-end)/60;
  }
  let answered=0,wait=0,stopped=0,long=0,gone=0,vehicles=0;
  for(let i=0;i<n;i++){
    const s=started[i];if(s===s){answered++;wait+=s-t[i];}
    if(line[i])continue;
    vehicles++;const stop=s===s?s+h[i]-t[i]:Math.max(0,D-t[i]);if(s!==s)gone++;
    stopped+=stop;if(stop>=RULE.long_s)long++;
  }
  const per=1000/tape.fleet,busy=work/(agents*DAY+(joined&&R<DAY?arm.size*(DAY-R):0));
  return {vehicles,calls,stopped:stopped/60*per,late:calls?late/calls:null,long:long*per,long_share:vehicles?100*long/vehicles:null,peak:peak*per,clear,wait_s:answered?wait/answered:null,busy,
    broken:n!==vehicles+calls?'class partition':n!==answered+gone?'request partition':!(busy>=0&&busy<=1+1e-9)?'busy share range':order?'answer order':null};
}
const ID='response-reserve',VERSION='scale-response-1.0.0',SEEDS=Object.freeze(Array.from({length:12},(_,i)=>3001+i)),SIZES=[1,2,3,4,5,6],A='Teaching assumption',S='Sizing rule: ',V=' per 1,000 vehicles';
const P='stopped vehicle-minutes'+V,G='late responder call fraction',LEVERS=[['reserve','Reserve staff join the pool'],['directive','A directive removes the ask']],group=f=>f/1000+',000',T=group(TEST),L=group(LARGE),up=s=>s[0].toUpperCase()+s.slice(1);
const n=(v,d=0,u)=>Number.isFinite(v)?{v,d,u}:{absent:'no value in some run'};
const arm=(fleet,load,lever='none',size=0,delay=0,agents=pool(fleet))=>({fleet,agents,load,lever,size,delay}),key=a=>[a.fleet,a.agents,a.load,a.lever,a.size,a.delay,''].join('|');
/** Pure and cheap. `seeds` is a test seam; the page always uses the declared seeds. */
export function deriveResponse(config,seeds=SEEDS){
  const load=Math.round(config?.load*1000),lever=LEVERS.find(l=>l[0]===config?.lever),delay=config?.delay,r=rates(load),no=reason=>({ok:false,reason});
  if(!(load<=1600&&r.depth>=RULE.depth))return no('event load is read from a burst depth of 4 at the smallest fleet, near 1.17 times capacity, to 1.6 times capacity. Short of that depth chance hides the event, and past 1.6 no shape was checked');
  if(!lever)return no('choose one of the two listed levers');
  if(!(Number.isInteger(delay)&&delay>=15&&delay<=240))return no('a lever lands 15 to 240 whole minutes after the event starts');
  const size=Math.ceil(pool(TEST)*(load-1000)/1000),margin=x=>Math.round(x*50)/1000,base=arm(TEST,load),reserve=arm(TEST,load,'reserve',size,delay),calm=arm(LARGE,CALM);
  const declare=(control,change,baseline,candidate,m=r.stopped)=>freezeScale({lab:ID,version:VERSION,control,change,baseline,candidate,seeds,primary:{name:P,direction:'lower_is_better',equivalence_margin:margin(m)},guardrails:[{metric:G,direction:'lower_is_better',max_harm:.05}]});
  return {ok:true,setup:{load,delay,size,word:lever[1],
    main:lever[0]==='reserve'?declare(null,`Reserve staff join the pool: 0 to ${size} agents, ${delay} min after the event starts.`,base,reserve):declare(null,`A directive removes the ask of every request moved into the event, from ${delay} min after the event starts.`,base,arm(TEST,load,'directive',0,delay)),
    nullCheck:declare('null','None. A reserve of zero agents joins the pool.',base,{...reserve,size:0}),
    ample:declare('non-binding','Reserve staff join a pool that can absorb the burst.',calm,{...calm,lever:'reserve',size,delay},r.answer*(1+closedForm(pool(LARGE)).mean_wait_s/H)),
    guard:declare('guardrail','Responder calls wait in turn with vehicle requests on one shared line.',base,arm(TEST,load,'shared'))},rows:[
    ['Event load',n(load/1000,2,'x capacity'),'Governing ratio. You choose it: work offered to the pool inside the event over what the pool can answer.'],
    ['Lever',lever[1],'You choose'],
    ['Lever lands after',n(delay,0,'min'),'You choose. How soon a lever can act is a teaching assumption.'],
    ['Reserve staff',n(size,0,'agents'),`${S}the smallest reserve that brings event load to capacity at ${T} vehicles`],
    ['Share of requests moved into the event, %',n(r.moved*100,1),S+'follows from event load, busy share and event length'],
    ['Burst depth',n(r.depth,1),S+'rates-only backlog at the smallest fleet over the chance spread of its event requests. The lab reads 4 and over.'],
    ['Requests reaching the pool',n(r.requests,0,'per 1,000 vehicle-hours'),S+'agents times busy share over answer time'],
    ['Pools',`${FLEETS.map(pool).join(', ')} agents at ${FLEETS.map(group).join(', ')} vehicles. Levers act at ${T}.`,A+'. Pools are set small so that an ordinary wait can be read, not as an estimate of any staffing ratio.'],
    ['Agent busy share on an ordinary day, %',n(B*100),A+', the staffing rule at every fleet size'],
    ['Mean answer time',n(H,0,'s'),A],
    ['Requests',`Each one stops its vehicle until the answer ends. ${LINE*100}% are responder calls, made to the same pool by a first responder, answered first, with the same answer time.`,A],
    ['Event',`${SPAN} min from minute ${RULE.start_min} of the day`,A],
    ['Responder call target and long stop',`${RULE.target_s} s and ${RULE.long_s} s`,A],
    ['Lean pool','The smallest pool whose ordinary wait by the queue formula does not pass the wait at the smallest fleet',A],
    ['Margin and allowance','5% of the rates-only value of the day a comparison starts from, and 0.05 on the change in '+G,A],
    ['Controls',`A reserve of zero agents. Reserve staff on a burst at 0.8 of capacity at ${L} vehicles. One shared line, where responder calls wait in turn.`,A],
  ]};
}
const CONTROLS=[['nullCheck','Null control','a reserve of zero agents, declared to leave every paired difference at zero',a=>a.outcome==='UNCHANGED'&&[a.primary,...a.guardrail_results].every(m=>m.paired_deltas.every(d=>d===0))],
  ['ample','Ample pool control','reserve staff where the pool can absorb the burst, declared to stay inside its margin',a=>a.outcome==='UNCHANGED'&&a.recommendation==='NO_RECOMMENDATION'],
  ['guard','Guardrail control','one shared line, declared to stay inside the margin and to be stopped by the guardrail',a=>a.outcome==='UNCHANGED'&&a.recommendation==='HOLD']];
/** One press. `engine` is a test seam for the deliberate fault tests; the page always uses the shipped functions. */
function* steps(setup,engine={buildTape,applyEvent,simulateDay}){
  const {load,delay,size,main:{spec}}=setup,seeds=spec.seeds,base=spec.baseline,lead=spec.candidate,days=new Map(),r=rates(load);
  let held={},broken=null,done=0;
  const tapeOf=(a,seed,fresh)=>{
    if(fresh||held.fleet!==a.fleet||held.seed!==seed)held={fleet:a.fleet,seed,plain:engine.buildTape(a.fleet,seed),events:{}};
    return a.load?held.events[a.load]??=engine.applyEvent(held.plain,a.load):held.plain;
  };
  const run=(a,seed,fresh=false)=>{
    const k=key(a)+seed;if(!fresh&&days.has(k))return days.get(k);
    const day=engine.simulateDay(tapeOf(a,seed,fresh),a.agents,a);broken??=day.broken;if(!fresh)days.set(k,day);
    return day;
  };
  const lean=f=>arm(f,load,'none',0,0,leanPool(f)),of=(a,f)=>seeds.map(s=>days.get(key(a)+s)?.[f]),mean=x=>x.every(Number.isFinite)?x.reduce((s,v)=>s+v,0)/x.length:NaN,avg=(a,f='stopped')=>mean(of(a,f));
  const sorted=a=>of(a,'stopped').sort((x,y)=>x-y),sized=s=>arm(TEST,load,'reserve',s,delay),late=d=>[arm(TEST,load,'reserve',size,d),arm(TEST,load,'directive',0,d)];
  const plan=[[base,lean(TEST)],[lead,sized(0),setup.guard.spec.candidate,arm(TEST,0),arm(TEST,CALM),...SIZES.map(sized),...DELAYS.flatMap(late)],[arm(SMALL,load),arm(SMALL,0),arm(SMALL,CALM)],[arm(LARGE,load),lean(LARGE),arm(LARGE,0),arm(LARGE,CALM),setup.ample.spec.candidate]];
  const total=seeds.length*new Set(plan.flat().map(key)).size,rung=a=>days.has(key(arm(a.fleet,load))+seeds.at(-1))?n(avg(a)):{absent:'this rung has not run yet'};
  const chart=()=>{const one=FLEETS.map(f=>rung(arm(f,load)));
    return {title:'Event day by fleet size, one staffing ratio',category:'Fleet size',axis:{d:0,u:'vehicle-min'+V},categories:FLEETS.map(f=>group(f)+' vehicles'),series:[{id:'ratio',label:'Event day',mark:'bar',values:one.map(c=>c.v??c)},{id:'rates',label:'Rates only',mark:'line',values:FLEETS.map(()=>r.stopped)}],
      summary:{t:'Across {n} paired seeds: event day {a}, {b} and {c} with one staffing ratio, and {h} by rates only at every size. The lean pool is in the table.',v:{n:n(seeds.length),h:n(r.stopped),a:one[0],b:one[1],c:one[2]}}};};
  for(const arms of plan){
    for(const seed of seeds)for(const a of arms)if(!days.has(key(a)+seed)){
      if(held.fleet!==a.fleet||held.seed!==seed){tapeOf(a,seed);yield;}
      run(a,seed);yield {done:++done,total,label:'Simulated days'};
    }
    yield {done,total,label:'Simulated days',partial:{chart:chart()}};
  }
  for(const f of FLEETS)for(const s of seeds){const o=days.get(key(arm(f,0))+s),e=days.get(key(arm(f,load))+s);if(o.vehicles!==e.vehicles||o.calls!==e.calls)broken??='equal request count';}
  const pair=function*(frozen,label){let calls=0;return yield* scalePairSteps(frozen,function*(a,seed){yield;const d=run(a,seed,calls++===2);return broken?{}:{[P]:d.stopped,[G]:d.late};},label);};
  const result=yield* pair(setup.main,'Paired runs'),controls=[];
  if(broken)return {...result,reason:`a simulated day broke the ${broken} check, so the instrument was handed no reading`};
  for(const [id,name,what,test] of CONTROLS){const c=yield* pair(setup[id],name),ok=c.validity==='VALID'&&test(c.analysis);controls.push({...c,as_declared:ok,title:`${name}, ${what}. ${ok?'Read as declared':'Not read as declared, so check the model before reading a lever'}`});}
  const row=(label,a)=>[label,n(avg(a)),n(avg(a,'long')),n(avg(a,'peak'),1),n(avg(a,'clear')),n(avg(a,'late'),3)];
  const check=(label,f,unit,d,calc,field,rule,a=arm(f,0))=>{const x=of(a,field),m=mean(x),tol=rule(Math.sqrt(x.reduce((s,v)=>s+(v-m)**2,0)/(x.length-1)/x.length),calc);
    return [`${label} at ${group(f)} vehicles`,n(calc,d,unit),n(m,d,unit),n(tol/calc*100),Math.abs(m-calc)<=tol?'inside tolerance':'outside tolerance'];};
  const calc=leverRates(load,lead.lever,size,delay);
  return {...result,controls,chart:chart(),notes:[
    {t:`By rates only the tested arm reads {x} and the change {y}. ${lead.lever==='reserve'?'The reserve is sized to bring event load to capacity':'A directive removes the ask at its source'}, so the direction of the main result follows from the inputs. The run adds chance, the ordinary wait and the ${G}.`,v:{x:n(calc),y:n(calc-r.stopped)}},
    'Agents are busy the same share of an ordinary day at every fleet size: the staffing rule sets it.',
    'Ordinary and event days carry the same requests, responder calls and answer times. The event changes timing only.',
    'The event takes the same share of requests at every fleet size and the rates-only value holds no fleet size, so the event-day ladder with one staffing ratio follows from the inputs. Fleet size still changes the chance part of the backlog.',
    'The lean pool is a second staffing rule. Its event load follows from the agents it leaves out. Its backlog can run past midnight, and the day is read until its last request is answered.',
    {t:'The lever lands at minute {m} of the day, {p}% through a congested period of {c} by rates only. By rates only the last request moved into the event is answered {l} after the event starts, so a directive after that has little or nothing left to remove. The delay is an input, so added paired seeds would not change when the lever lands.',
      v:{m:n(RULE.start_min+delay),p:n(delay/(SPAN+r.drain)*100),c:n(SPAN+r.drain,0,'min'),l:n(SPAN*r.load,0,'min')}},
    {t:'What a vehicle does after a directive releases it: {x}.',v:{x:{absent:'this model has no reading of what a vehicle does after release'}}},
    'The guardrail control is stopped because responder calls wait in turn with the backlog. How far follows from the assumed share of responder calls.',
    'The ample pool control flags a lever side effect past 5% of the ordinary-day value and nothing short of it.'],
  tables:[
    {caption:`Arms at ${T} vehicles, means over the paired seeds. The guardrail allows 0.05 on the change in ${G} against the no-lever day. The fraction itself is a level.`,
      heads:['Arm',up(P),'Stops of at least two minutes'+V,'Most vehicles waiting at once'+V,'Minutes to clear after the event',up(G)],rows:[row('No lever',base),row(setup.word,lead),row('One shared line',setup.guard.spec.candidate)]},
    {caption:`Pooling and a correlated event. Ordinary and event day by fleet size, means over the paired seeds. Event-day columns are ${P}.`,heads:['Vehicles','Agents','Ordinary wait','By the queue formula','Event day','Second lowest seed','Second highest seed','Rates only','Added by a burst at 0.8 of capacity','Reserve by rule, agents','Lean pool','Lean pool busy share on an ordinary day','Lean pool event load','Lean pool event day'],
      rows:FLEETS.map(f=>{const e=arm(f,load),o=arm(f,0),l=lean(f);return [n(f),n(pool(f)),n(avg(o,'wait_s'),2,'s'),n(closedForm(pool(f)).mean_wait_s,2,'s'),n(avg(e)),n(sorted(e)[1]),n(sorted(e).at(-2)),n(r.stopped),n(avg(arm(f,CALM))-avg(o),1),n(Math.ceil(pool(f)*(load-1000)/1000)),n(l.agents,0,'agents'),n(pool(f)*B/l.agents,2),n(rates(load,pool(f)/l.agents).load,2,'x capacity'),n(avg(l))];})},
    {caption:`Capacity near saturation. Reserve size at ${T} vehicles, landing after ${delay} min`,heads:['Reserve agents','Event load once they arrive',up(P)],rows:[0,...SIZES].map(s=>[n(s),n(load/1000*pool(TEST)/(pool(TEST)+s),2,'x capacity'),n(avg(s?sized(s):base))])},
    {caption:`Landing in time. ${up(P)} at ${T} vehicles by landing time, means over the paired seeds`,heads:['Lever lands after',LEVERS[0][1],'By rates only',LEVERS[1][1],'By rates only'],rows:[['No lever',...[0,0].flatMap(()=>[n(avg(base)),n(r.stopped)])],...DELAYS.map(d=>[n(d,0,'min'),...late(d).flatMap(a=>[n(avg(a)),n(leverRates(load,a.lever,size,d))])])]},
    {caption:'Cross-check against the queue formula and rates-only arithmetic. It checks the arithmetic, not any fleet.',heads:['Check','Calculated','Simulated','Tolerance, % of calculated','This press'],rows:[
      ...FLEETS.map(f=>check('Mean wait on an ordinary day, queue formula,',f,'s',2,closedForm(pool(f)).mean_wait_s,'wait_s',(se,v)=>Math.max(4*se,.1*v,.05))),
      check('Stops of at least two minutes on an ordinary day, % of stops, queue formula,',TEST,'',2,100*closedForm(pool(TEST),pool(TEST)*B,pool(TEST)*(1-B)*(1-B*LINE)/H).stop_share(RULE.long_s),'long_share',(se,v)=>Math.max(4*se,.1*v)),
      check('Most vehicles waiting at once on the event day, rates only,',TEST,V.slice(1),1,r.peak,'peak',(se,v)=>.2*v,base),
      check('Minutes to clear after the event, rates only,',TEST,'min',1,r.drain,'clear',(se,v)=>.2*v,base)]}]};
}
export const LAB=Object.freeze({id:ID,version:VERSION,short:'Response reserve',title:'Response reserve for an area-wide event',geography:'Fictional market, counts only, no map',seeds:SEEDS,
  frame:['A support pool staffed for ordinary days meets one area-wide event: many vehicles ask for help at once and stay stopped until answered.',
    'Counts, not cars. One pool, one staffing rule, three fleet sizes. The event moves a share of the same requests into three hours. One lever is read against no lever. Every rate is a teaching assumption.',
    'Compare ordinary and event days across fleet sizes, the lever against no lever, and each control against its declared reading.',
    'An ops team would size reserve staff and lever delay against event load in its own request records.','decision'],
  limits:'Invented request rates, answer times and staffing; one invented event; no vehicle behavior, traffic, field crews, shifts or skill tiers.',
  unknowns:['Any real request rate, answer time, staffing ratio or call volume, or how often a vehicle asks for help. Here every request stops its vehicle.',
    'Any past event. This event is invented and takes the same share of requests at every fleet size.',
    'Whether a staffing ratio or reserve is adequate, whether a lever works in practice, or how soon a directive can be written, approved and sent. Reserve size and delay are inputs.',
    'What a vehicle does while it waits or after release, whether proceeding under a directive was right, what a late responder call leads to, or traffic. A stopped vehicle here blocks nothing.',
    'Field crews, shifts, breaks, sites, skill tiers, a wrong answer by an agent, or time of day. Requests arrive at a flat rate outside the event.',
    'The position of any curve, or confidence about a real fleet. How vehicles reach rider service and what a depot can take are the subjects of the fleet intake and density ladder labs.'],
  controls:[{key:'load',label:'Event load',unit:'x capacity',min:1.2,max:1.6,step:.1},{key:'lever',label:'Lever',options:LEVERS},{key:'delay',label:'Lever lands after',unit:'min',min:15,max:240,step:15}],
  defaults:()=>({load:1.3,lever:'reserve',delay:45}),derive:deriveResponse,steps});
