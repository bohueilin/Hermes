/** Lab B of the Scale lab: weekly counts of one fleet, from delivered vehicles to vehicles in rider service. No map, no engine call.
 * Every input is a teaching assumption. Page-only: nothing reachable from the worker imports this file. */
import {u32} from '../core/keyed.js';
import {freezeScale,scalePairSteps,scaleJson} from './scale-contract.js';
const VERSION='scale-intake-1.0.0',SEEDS=Object.freeze(Array.from({length:12},(_,i)=>7001+i));
/** Fixed teaching assumptions: RATE vehicles a week for WEEKS weeks; a tranche of depot places every EVERY weeks, the first ready in week 1. */
const RATE=24,WEEKS=26,EVERY=4,H=104,PROCESS=2,LINE=1.25,CHECK=1.25,INTAKE=2.5,PASS=.95,REWORK=2,PACE=1.5,STALLS=12,STAFF=8,RELEASE=16,REMOVALS=12,RETURN=8,DECAY=.6,SPREAD=.25;
const MARGIN=.02,IDLE=13,HELD=2,MIN_ROOM=8,TARGET=.9,GOLDEN=.6180339887498949;
const FLEET=RATE*WEEKS,PLACES=RATE*EVERY,TRANCHES=Math.ceil(FLEET/PLACES)-1,INTEGRATE=Math.ceil(RATE*LINE),VALIDATE=Math.ceil(RATE*CHECK/PASS),INDUCT=Math.ceil(RATE*INTAKE);
const PLAN=RATE*(WEEKS*(WEEKS+1)/2+WEEKS*(H-PROCESS-WEEKS)),RISK=REMOVALS/1000;
const GATES=['integration','validation and rework','the release gate','depot induction','site power','ports','stalls','staff'];
const PRIMARY='in-service fraction of plan',RAIL_IDLE='idle weeks per ordered place',RAIL_HELD='weeks not in service per delivered vehicle';
const ARMS=[['middle','Order site power ahead for the middle of its lead range'],['end','Order site power ahead for the end of its lead range']];
const CONTROLS=Object.freeze([{key:'arm',label:'The other arm',options:ARMS},
  {key:'power',label:'Site power lead time, middle of its range',unit:'weeks',min:24,max:56,step:1},
  {key:'ports',label:'Ports lead time, middle of its range',unit:'weeks',min:16,max:28,step:1}]);
/** Whole numbers of a thousand or over, grouped as the page groups them. */
const group=n=>String(n).replace(/\B(?=(\d{3})+$)/g,',');
/** A range runs a quarter either side of its middle, in whole weeks. */
const range=m=>{const w=Math.round(m*SPREAD);return [m-w,m+w];};
/** Return time ladder: each week after the first is DECAY times as common. */
const LADDER=(()=>{let w=1,total=0;const p=[];for(let t=1;t<=RETURN;t++){p.push(w);total+=w;w*=DECAY;}return p.map(x=>x/total);})();
const MEAN_RETURN=LADDER.reduce((s,p,i)=>s+p*(i+1),0),STANDING=RISK*MEAN_RETURN/(1+RISK*(MEAN_RETURN-1));
const returnWeeks=u=>{let sum=0;for(let t=0;t<RETURN;t++){sum+=LADDER[t];if(u<sum)return t+1;}return RETURN;};
/** b to the whole power n by repeated squaring, so the result does not depend on the engine's own power routine. */
const power=(b,n)=>{let r=1;for(;n;n>>=1,b*=b)if(n&1)r*=b;return r;};
/** Count at quantile u of Binomial(n, p): one shared quantile gives one count, the same in both arms when n is the same. */
function binomial(n,p,u){
  if(n<=0||p<=0)return 0;
  let k=0,q=power(1-p,n),sum=q;const r=p/(1-p);
  while(u>sum&&k<n){q*=(n-k)/(k+1)*r;k++;sum+=q;}
  return k;
}
/** Sizing rules: everything the reader does not type, the governing ratio, and the refusal. Pure and cheap; never throws.
 * The governing ratio is the room over the tranche interval: the quantity the refusal tests and the gain follows. */
function size(config){
  if(!ARMS.some(a=>a[0]===config?.arm))return {reason:'the other arm must be one of the two listed arms'};
  for(const c of CONTROLS.slice(1))if(!Number.isInteger(config[c.key])||config[c.key]<c.min||config[c.key]>c.max)return {reason:`${c.label.toLowerCase()} must be a whole number from ${c.min} to ${c.max}`};
  const {arm,power,ports}=config,ratio=power/ports,room=power-ports,mids=[power,ports,STALLS,STAFF],ranges=mids.map(range);
  if(room<MIN_ROOM)return {reason:`site power (${power}) and ports, the next gate (${ports}), leave ${room} weeks of room, ${(room/EVERY).toFixed(2)} tranche intervals. The lab reads from ${(MIN_ROOM/EVERY).toFixed(1)}: set site power to ${ports+MIN_ROOM} weeks or past it, or ports to ${power-MIN_ROOM} or before it`};
  return {arm,mids,ranges,release:range(RELEASE),mid:RELEASE,ratio,room,ahead:arm==='end'?ranges[0][1]-ports:room};
}
/** Every draw of one seed, made without reference to any arm. Quantiles are kept as whole numbers so two tapes compare exactly. */
function tapeOf(s,seed){
  const whole=(...k)=>u32('scale-intake',seed,...k),pick=([a,b],x)=>a+Math.floor((x+.5)/4294967296*(b-a+1));
  const tape={seed,release:pick(s.release,whole('release')),lead:s.ranges.map((r,i)=>Array.from({length:TRANCHES},(_,k)=>pick(r,whole('lead',i,k)))),rework:[],remove:[],turn:[]};
  for(let t=1;t<=H;t++)for(const k of ['rework','remove','turn'])tape[k].push(whole(k,t));
  return tape;
}
const unit=x=>(x+.5)/4294967296;
/** One run of one arm on one tape. No keyed draw is made here, so no draw can depend on the arm. `bend` is a test-only seam. */
function simulate(arm,tape,bend){
  const rate=RATE*arm.pace,last=Math.ceil(FLEET/rate);
  const arrival=tape.lead.map((row,i)=>row.map((lead,k)=>1+k*EVERY+(i?lead:(arm.open?0:lead)-arm.ahead)));
  const ready=arrival[0].map((_,k)=>Math.max(...arrival.map(a=>a[k]))),holder=ready.map((w,k)=>arrival.findIndex(a=>a[k]===w));
  const rework=new Array(H+REWORK+1).fill(0),back=new Array(H+RETURN+1).fill(0),held=new Array(GATES.length).fill(0),rows=[];
  let qInt=0,qVal=0,pipe=0,qRel=0,qDoor=0,S=0,R=0,delivered=0,integrated=0,validated=0,released=0,accepted=0;
  let sumS=0,sumR=0,sumD=0,sumIn=0,idle=arrival[0].reduce((n,w)=>n+PLACES*Math.max(0,1-w),0),reach=null,stock=null,violation=null;
  for(let t=1;t<=H;t++){
    qVal+=rework[t];pipe-=rework[t];
    const K=PLACES*(1+ready.filter(w=>w<=t).length),Ks=PLACES*(1+arrival[0].filter(w=>w<=t).length);
    S+=back[t];R-=back[t];
    const out=binomial(S,RISK,unit(bend?.(arm,t)??tape.remove[t-1])),turn=unit(tape.turn[t-1]);
    for(let i=0;i<out;i++)back[t+returnWeeks((turn+i*GOLDEN)%1)]++;
    S-=out;R+=out;
    const i=Math.min(qInt,INTEGRATE);qInt-=i;integrated+=i;
    const v=Math.min(qVal,VALIDATE),f=binomial(v,1-PASS,unit(tape.rework[t-1]));
    qVal+=i-v;validated+=v-f;qRel+=v-f;rework[t+REWORK]+=f;pipe+=f;
    if(t===tape.release)stock=qRel;
    if(t>=tape.release){released+=qRel;qDoor+=qRel;qRel=0;}
    const free=K-S-R,a=Math.max(0,Math.min(qDoor,INDUCT,free));qDoor-=a;accepted+=a;S+=a;
    const del=t<last?rate:t===last?FLEET-rate*(last-1):0;
    qInt+=del;delivered+=del;
    held[0]+=qInt-del;held[1]+=qVal-i+pipe;held[2]+=qRel;
    if(qDoor>0){const k=ready.reduce((best,w,j)=>w>t&&(best<0||w<ready[best])?j:best,-1);held[free-a>0||k<0?3:4+holder[k]]+=qDoor;}
    sumS+=S;sumR+=R;sumD+=delivered;sumIn+=del+i;idle+=Ks-Math.max(PLACES,S+R);
    if(reach===null&&S>=TARGET*FLEET)reach=t;
    if(violation===null&&!(delivered===qInt+qVal+pipe+qRel+qDoor+S+R&&delivered>=integrated&&integrated>=validated&&validated>=released&&released>=accepted&&accepted===S+R&&S>=0&&R>=0&&S+R<=K&&K<=Ks))violation=`week ${t}: the stage counts do not sum to delivered, are out of order or pass depot capacity`;
    rows.push([delivered,integrated,validated,released,accepted,S,R]);
  }
  return {tape,violation,rows,held,sumS,sumR,sumD,sumIn,idle,reach,stock};
}
/** Whole-run metric map of one run. All three exist in every run; the shared contract leaves out any value that is not finite. */
const metrics=r=>({[PRIMARY]:r.sumS/PLAN,[RAIL_IDLE]:r.idle/(TRANCHES*PLACES),[RAIL_HELD]:(r.sumD-r.sumS)/FLEET});
const CONTROL={id:'control',ahead:0,pace:1,open:false};
function derive(config){
  const s=size(config);if(s.reason)return {ok:false,reason:s.reason};
  const other={...CONTROL,id:s.arm,ahead:s.ahead},open={...CONTROL,id:'open',open:true};
  const declare=(baseline,candidate,change,control=null,held=false)=>freezeScale({lab:'fleet-intake',version:VERSION,control,change,baseline,candidate,seeds:SEEDS,descriptives:[held?RAIL_IDLE:RAIL_HELD],
    primary:{name:PRIMARY,direction:'higher_is_better',equivalence_margin:MARGIN},
    guardrails:[held?{metric:RAIL_HELD,direction:'lower_is_better',max_harm:HELD}:{metric:RAIL_IDLE,direction:'lower_is_better',max_harm:IDLE}]});
  const weeks=(r,u)=>({v:r[0],d:0,u:`to ${r[1]}${u}`}),typed='You choose the middle. Teaching assumption: the range runs a quarter either side';
  return {ok:true,setup:{...s,other,
    main:declare(CONTROL,other,`Order week of site power: with the delivery calendar in the control arm, ${s.ahead} weeks ahead of it in the other arm.`),
    checks:[declare(CONTROL,{...CONTROL,id:'null'},'Null control: both arms order with the delivery calendar.','null'),
      declare(open,{...open,id:'open-ahead',ahead:s.room},`Non-binding order control: site power is given a lead time of 0 weeks in both arms, then ordered ${s.room} weeks ahead in one.`,'non-binding'),
      declare(CONTROL,{...CONTROL,id:'pace',pace:PACE},`Non-binding deliveries control: ${RATE} vehicles a week in one arm and ${RATE*PACE} in the other. Line rates and order weeks stay as they are.`,'non-binding',true)]},
  rows:[
    ['Deliveries',{v:RATE,d:0,u:`vehicles a week for ${WEEKS} weeks, ${FLEET} in all`},'Teaching assumption'],
    ...GATES.slice(4).map((g,i)=>[`Lead time of ${g}`,weeks(s.ranges[i],' weeks'),i<2?typed:'Teaching assumption']),
    ['Release gate opens, week',weeks(s.release,''),'Teaching assumption'],
    ['Unscheduled removals',`${REMOVALS} per 1,000 vehicles in rider service a week; back after 1 to ${RETURN} weeks, ${MEAN_RETURN.toFixed(1)} on average`,'Teaching assumption'],
    ['Integration, validation and depot induction',`${INTEGRATE}, ${VALIDATE} and ${INDUCT} vehicles a week; ${PASS} pass validation first time; rework takes ${REWORK} weeks`,'Teaching assumption'],
    ['Depot tranche',{v:PLACES,d:0,u:`places; 1 tranche ready in week 1, ${TRANCHES} on order, one every ${EVERY} weeks`},'Sizing rule: the deliveries of one tranche interval'],
    ['Room over the tranche interval',{v:s.room/EVERY,d:2,u:`with ${s.room} weeks of room`},`Governing ratio: weeks between the slowest depot resource and the next gate, over the weeks between tranches. The lab reads from ${(MIN_ROOM/EVERY).toFixed(1)}. Site power over ports is ${s.ratio.toFixed(2)}`],
    ['Order ahead in the other arm',{v:s.ahead,d:0,u:'weeks'},`Sizing rule: ${s.arm==='end'?'the end of the lead range minus the next gate':'the room, the middle lead time minus the next gate'}`],
    ['Plan',{v:PLAN,d:0,u:`vehicle-weeks over ${H} weeks`},`Teaching assumption: a planned vehicle counts from ${PROCESS} weeks after its delivery week. The plan has no gate and no removal`],
    ['Allowances',`${IDLE} idle weeks per ordered place for an order arm; ${HELD} weeks not in service per delivered vehicle for the deliveries control; margin ${MARGIN} of plan, ${group(Math.round(MARGIN*PLAN))} vehicle-weeks`,'Teaching assumption: rules of this lab, not standards'],
  ]};
}
const mean=(list,f)=>list.reduce((n,x)=>n+f(x),0)/list.length;
/** One press. Order: the three controls, the paired test, hand checks. A control that moves stops the press before any arm is read. */
function* steps(setup,hooks={}){
  const s=setup,runs={},n=SEEDS.length;
  const pair=function*(frozen,label){
    const {baseline,candidate,control}=frozen.spec;
    return yield* scalePairSteps(frozen,function*(arm,seed){
      yield;
      const r=simulate(arm,(hooks.tape??tapeOf)(s,seed,arm),hooks.bend),a=runs[baseline.id]?.[seed],whole=x=>scaleJson({...x,tape:0});
      const why=r.violation??(arm!==candidate?0:scaleJson(a.tape)!==scaleJson(r.tape)?'the two arms did not share their draws':control&&(control==='null'?whole(a)!==whole(r):a.sumS!==r.sumS)?`the ${label.toLowerCase()} moved`:0);
      if(why)throw new RangeError(`Seed ${seed}, ${why}. No arm can be read.`);
      (runs[arm.id]??={})[seed]=r;return metrics(r);
    },label);
  };
  const controls=[];for(const [i,title] of ['Null control, both arms order with the delivery calendar, declared to read zero on every measure','Non-binding order control, site power with a lead time of 0 weeks in both arms, declared to read zero on the main measure',`Non-binding deliveries control, deliveries ${PACE} times as fast while vehicles wait at the depot door, declared to read zero on the main measure`].entries())controls.push({...yield* pair(s.checks[i],title.split(',')[0]),title});
  const main=yield* pair(s.main,'Paired runs'),bad=[...controls,main].find(x=>x.validity!=='VALID');
  if(bad)return bad;
  const all=id=>SEEDS.map(seed=>runs[id][seed]),arms=['control',s.arm],label=`Site power ordered ${s.ahead} weeks ahead`,heads=['Control',label];
  // Hand check of the primary effect: the same two arms with every range collapsed to its middle, on the same horizon and plan.
  let flat=0;for(const [i,seed] of SEEDS.entries()){yield {done:i,total:n,label:'Hand checks'};const tape={...tapeOf(s,seed),release:s.mid,lead:s.mids.map(m=>new Array(TRANCHES).fill(m))};flat+=(simulate(s.other,tape).sumS-simulate(CONTROL,tape).sumS)/PLAN/n;}
  const hand=s.room*(FLEET-PLACES)*(1-STANDING)/PLAN;
  // The dose curve: five order weeks on the tapes of the paired seeds. The first is the control and the third and fourth are the two arms.
  const doses=[0,Math.round(s.room/2),s.room,s.ranges[0][1]-s.mids[1],s.mids[0]].map(ahead=>({ahead,gain:0,idle:0}));
  for(const [i,seed] of SEEDS.entries()){yield {done:i,total:n,label:'Order weeks'};const tape=tapeOf(s,seed),c=runs.control[seed];for(const d of doses){const r=simulate({...CONTROL,ahead:d.ahead},tape);d.gain+=(r.sumS-c.sumS)/PLAN/n;d.idle+=(r.idle-c.idle)/TRANCHES/PLACES/n;}}
  const checks=[
    ['Gain of the other arm at the middle of every range, fraction of plan',`${s.room} weeks of room x (${FLEET} planned vehicles - ${PLACES} places ready in week 1) x (1 - ${STANDING.toFixed(4)} out of service) / ${group(PLAN)} plan vehicle-weeks`,hand,flat,main.analysis.primary.mean_delta,.02*hand,4,'2 percent of the hand value'],
    ['Stock at the release gate in its opening week, vehicles',`${RATE} a week x (release week as drawn - ${PROCESS} process weeks), mean of seeds`,mean(all('control'),r=>RATE*(r.tape.release-PROCESS)),mean(all('control'),r=>r.stock),null,RATE,1,'one week of deliveries']];
  const at=(id,c)=>({v:mean(all(id),r=>r.rows[WEEKS-1][c]),d:0}),sum=(id,f)=>({v:mean(all(id),f),d:0}),first=runs.control[SEEDS[0]],second=runs[s.arm][SEEDS[0]];
  const door=id=>{const h=GATES.map((_,g)=>g<3?-1:mean(all(id),r=>r.held[g]));return GATES[h.indexOf(Math.max(...h))];};
  const weeks=[];for(let t=2;t<=H;t+=2)weeks.push(t);
  return {...main,
    controls,
    chart:{title:'One fleet by week: delivered, and in rider service under both arms',category:'Week',axis:{d:0,u:'vehicles'},categories:weeks.map(String),seed:SEEDS[0],
      series:[{id:'delivered',label:'Delivered',mark:'line',values:weeks.map(t=>first.rows[t-1][0])},{id:'control',label:'In rider service, control',mark:'line',values:weeks.map(t=>first.rows[t-1][5])},{id:'other',label:`In rider service, ${label.toLowerCase()}`,mark:'line',values:weeks.map(t=>second.rows[t-1][5])}],
      summary:{t:'This replay: at the end of week {w}, {d} vehicles are delivered and {c} are in rider service under the control. At the end of week {y}, {e} are in rider service under the control and {a} in the other arm.',v:{w:WEEKS,d:first.rows[WEEKS-1][0],c:first.rows[WEEKS-1][5],y:2*WEEKS,e:first.rows[2*WEEKS-1][5],a:second.rows[2*WEEKS-1][5]}}},
    tables:[
      {caption:`One fleet, several counts: end of week ${WEEKS}, the last delivery week of the control, mean of ${n} paired seeds.`,heads:['Count','Which vehicles are in it',...heads],
        rows:[...[['Delivered','Handed over, at any stage'],['Integrated','Through the integration line'],['Validated','Passed validation, first time or after rework'],['Released','Let through the release gate'],['Accepted at a depot','Given a depot place'],['In rider service','Accepted and not removed'],['Out of service','Removed and not yet back; keeps its place']].map((row,c)=>[...row,...arms.map(id=>at(id,c))]),
          ['First week at 90 percent',`The first week with ${Math.ceil(TARGET*FLEET)} vehicles in rider service`,...arms.map(id=>{const w=all(id).map(r=>r.reach);return w.includes(null)?{absent:'target not reached within the horizon on one or more seeds'}:{v:mean(w,x=>x),d:1};})]]},
      {caption:`The gate that binds. Where delivered vehicle-weeks went over ${H} weeks, mean of ${n} paired seeds. Waiting is stock past the ${PROCESS} process weeks. Most depot door waiting: ${door('control')} under the control; ${door(s.arm)} in the other arm. The rows sum to the total.`,heads:['Vehicle-weeks',...heads],
        rows:[...GATES.map((g,k)=>[`Waiting: ${g}`,...arms.map(id=>sum(id,r=>r.held[k]))]),['Inside the process weeks',...arms.map(id=>sum(id,r=>r.sumIn))],['Out of service',...arms.map(id=>sum(id,r=>r.sumR))],['In rider service',...arms.map(id=>sum(id,r=>r.sumS))],['Total: delivered vehicle-weeks',...arms.map(id=>sum(id,r=>r.sumD))]]},
      {caption:`Lead-time mismatch. Weeks ahead, gain and idle weeks: site power ordered 0 to ${s.mids[0]} weeks ahead, mean of ${n} paired seeds. The allowance is ${IDLE} idle weeks per ordered place.`,heads:['Weeks ahead','Gain, fraction of plan','Idle weeks per ordered place, past the control','Against the allowance'],
        rows:doses.map(d=>[{v:d.ahead,d:0},{v:d.gain,d:4},{v:d.idle,d:2},d.idle>IDLE?'past it':'inside it'])},
      {caption:'The gain and the release stock by hand: arithmetic a reader can repeat beside the simulated value. A check outside its tolerance is reported and does not void the run.',heads:['Check','Rule','By hand','Simulated','Simulated, ranges as drawn','Tolerance','Reading'],
        rows:checks.map(([check,rule,by,sim,drawn,limit,d,words])=>[check,rule,{v:by,d},{v:sim,d},drawn===null?{absent:'this check has one simulated value'}:{v:drawn,d},words,Math.abs(sim-by)<=limit?'inside the tolerance':'outside the tolerance'])},
    ],
    notes:NOTES};
}
const NOTES=Object.freeze([
  'The slowest depot resource, the next gate, the weeks ahead, the horizon and the plan follow from the setup.',
  'In every setup sampled inside the accepted region an order arm read as a gain beyond the margin. A run adds the size of the gain, its interval, the idle weeks and where the waiting goes.',
  'At the middle of every range the gain is arithmetic on inputs, as the first hand check shows. Spread takes some away: a tranche that lands late loses service and one that lands early gains none.',
  'Whether an order arm stays inside the idle allowance follows from its weeks ahead and from the allowance, a rule of this lab. The first arm stayed inside it in every setup sampled; the second went past it in about half. The weeks ahead table shows where any allowance would cut the curve.',
  'The control orders with the delivery calendar. Every gain follows from how late that is, so the control is a reference line, not a practice.',
  'The deliveries control reads the same in every accepted setup: rider service is as it was while vehicles wait at the depot door, and the added waiting is arithmetic on the delivery plan. Line rates stay, so the extra vehicles wait at integration.',
  'The release stock follows from the delivery rate and the release week. Both arms share the release gate, so it hardly moves the paired change.',
  'The plan has no gate and no removal, so no arm reaches it. The vehicle-weeks table shows what the rest is made of.']);
export const LAB=Object.freeze({id:'fleet-intake',version:VERSION,short:'Fleet intake',title:'From delivered to in service',geography:'Fictional market, weekly counts, no map',seeds:SEEDS,
  frame:['A delivered vehicle is not yet a vehicle in rider service. Which gate keeps vehicles waiting, and when is the slowest depot resource ordered?',
    'Weekly counts, not cars on a map. Vehicles pass integration, validation, a release gate and depot intake, where places open in tranches. The lesson arm orders the slowest depot resource ahead of the control.',
    'Read the counts of one fleet in one week, then the gate where vehicles waited under each arm.',
    'An ops team would map every gate from delivery to rider service against its lead time and write the order week for the slowest one.','decision'],
  limits:'Invented delivery plan, gate times, lead times and removal rate; one fleet and one market as counts by week; no vehicle, site or grid is modelled.',
  unknowns:['Whether any operating fleet has a gap between delivered vehicles and vehicles in rider service, or why. A model that can make a gap has not found its cause.',
    'Any lead time, release date, stage time, pass share, removal rate or repair time of any fleet, depot, utility or regulator. Each one here is a teaching assumption, and the release week says nothing about any approval.',
    'Which gate binds in any market, or when to order anywhere. Site power is the slowest depot resource here because the setup says so, and each lead time is drawn on its own, evenly across its range.',
    'What validation tests. It is a duration and a pass share, and says nothing about driving behavior.',
    'A bridge such as temporary power, a tranche that opens in part, or a repair shop with a limit. A tranche opens only when all four resources have arrived, and repairs never queue.',
    'Money, kilowatts, staff rosters, a second market or a second vehicle platform. A place is a count, and idle capacity is counted in weeks. What a depot past its capacity does inside one day is the subject of the density ladder lab.'],
  controls:CONTROLS,defaults:()=>({arm:'middle',power:48,ports:24}),derive,steps});
/** Exported for the lab's own tests only. */
export const INTERNALS=Object.freeze({size,tapeOf,simulate,STANDING,PLAN});
