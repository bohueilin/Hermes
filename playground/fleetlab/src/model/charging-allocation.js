/** Battery-side kW; unit efficiency, no auxiliaries/taper. Pure proposals, then feasibility checks. */
export const CHARGING_VERSION='depot-charging-1.0.0';
export const defaultCharging=()=>({version:CHARGING_VERSION,policy:'equal_share',deadline_budget_min:45,deadline_spread_min:45,starvation_min:60});
export function validateCharging(c){
  if(!c||typeof c!=='object'||Array.isArray(c))return ['charging must be an object.'];
  const errors=[];
  if(c.version!==CHARGING_VERSION)errors.push('Unsupported charging version.');
  if(!['equal_share','redistribute','deadline','overcommit'].includes(c.policy))errors.push('Unknown charging policy.');
  for(const k of ['deadline_budget_min','deadline_spread_min','starvation_min'])if(!Number.isInteger(c[k])||c[k]<(k==='deadline_spread_min'?0:1)||c[k]>1440)errors.push(`${k} must be a bounded integer minute value.`);
  if(Object.keys(c).some(k=>!Object.hasOwn(defaultCharging(),k)))errors.push('Unknown charging setting.');
  return errors;
}
const cap=j=>Math.min(j.cap_kw,Math.max(0,j.needed_kwh)*60);
/** Stable FIFO unless deadline mode; once aged, oldest queued job has priority. */
export function chargingOrder(jobs,policy,minute,starvation){
  return [...jobs].sort((a,b)=>{
    if(policy==='deadline'){
      const agedA=minute-a.queued_minute>=starvation,agedB=minute-b.queued_minute>=starvation;
      if(agedA!==agedB)return agedA?-1:1;
      if(!agedA&&a.deadline_minute!==b.deadline_minute)return a.deadline_minute-b.deadline_minute;
    }
    return a.queued_minute-b.queued_minute||a.id.localeCompare(b.id,'en');
  });
}
export function allocateChargingPower(jobs,siteKw,policy,minute,starvation){
  const power=Object.fromEntries(jobs.map(j=>[j.id,0]));
  if(!jobs.length||siteKw===0)return power;
  if(policy==='overcommit')return Object.fromEntries(jobs.map(j=>[j.id,siteKw*2]));
  if(policy==='equal_share')return Object.fromEntries(jobs.map(j=>[j.id,Math.min(cap(j),siteKw/jobs.length)]));
  if(policy==='deadline'){
    let remaining=siteKw;
    for(const j of chargingOrder(jobs,policy,minute,starvation)){power[j.id]=Math.min(cap(j),remaining);remaining-=power[j.id];}
    return power;
  }
  if(policy!=='redistribute')throw new RangeError('Unsupported allocation policy.');
  let remaining=siteKw,open=jobs.filter(j=>cap(j)>0);
  while(open.length&&remaining>1e-10){
    const share=remaining/open.length,capped=open.filter(j=>cap(j)-power[j.id]<=share);
    if(!capped.length){for(const j of open)power[j.id]+=share;break;}
    for(const j of capped){const amount=cap(j)-power[j.id];power[j.id]+=amount;remaining-=amount;}
    const ids=new Set(capped.map(j=>j.id));open=open.filter(j=>!ids.has(j.id));
  }
  return power;
}
/** Null means feasible; missing values never become zero. */
export function checkPowerProposal(jobs,siteKw,power){
  if(Object.keys(power).length!==jobs.length||jobs.some(j=>!Object.hasOwn(power,j.id)))return 'POWER_POPULATION';
  const values=Object.values(power);
  if(values.some(v=>!Number.isFinite(v)))return 'NONFINITE_POWER';
  if(values.some(v=>v<0))return 'NEGATIVE_POWER';
  if(values.reduce((a,b)=>a+b,0)>siteKw+1e-8)return 'SITE_POWER_LIMIT';
  if(jobs.some(j=>power[j.id]>cap(j)+1e-8))return 'VEHICLE_POWER_LIMIT';
  return null;
}
