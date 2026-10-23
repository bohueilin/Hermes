/** Exogenous battery-side capacity, never grid energy or a policy lookahead input. */
export const SITE_POWER_VERSION='site-power-profile-1.0.0';
export const SITE_POWER_METRICS='site-power-metrics-1.0.0';
const object=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
const exact=(v,keys)=>object(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
export function validateSitePower(c){
  const p=c.site_power_profile,errors=[];
  if(!exact(p,['version','condition_id','site_id','segments']))return ['Site power requires exactly version, condition_id, site_id and segments.'];
  if(p.version!==SITE_POWER_VERSION)errors.push('Unsupported site power version.');
  if(typeof p.condition_id!=='string'||! /^[a-zA-Z0-9_-]{1,80}$/.test(p.condition_id))errors.push('Invalid power condition identity.');
  if(!Array.from({length:Math.min(6,c.depot_count||0)},(_,i)=>`depot-${i+1}`).includes(p.site_id))errors.push('Unknown power profile site.');
  if(!c.charging||c.launch)errors.push('Site power requires charging and does not support launch rehearsal.');
  if(!Array.isArray(p.segments)||p.segments.length<1||p.segments.length>48)return [...errors,'Use 1–48 contiguous power segments.'];
  let end=0;
  for(const s of p.segments){
    if(!exact(s,['start_minute','end_minute','fraction'])||!Number.isInteger(s.start_minute)||s.start_minute!==end||!Number.isInteger(s.end_minute)||s.end_minute<=s.start_minute||!Number.isFinite(s.fraction)||s.fraction<0||s.fraction>1){errors.push('Power segments require contiguous increasing integer minutes and fractions from 0 to 1.');break;}
    end=s.end_minute;
  }
  if(end!==Math.ceil(c.duration_hours*60))errors.push('Power segments must cover the entire observation window exactly.');
  return errors;
}
/** Validated tape is private to the environment. Policies receive only the returned scalar. */
export function currentSitePower(c,site,minute,nominal){
  const p=c.site_power_profile;
  if(!p||p.site_id!==site)return nominal;
  const segment=p.segments.find(s=>s.start_minute<=minute&&minute<s.end_minute);
  // H has no interval; retaining the last cap labels the terminal observation without delivering energy.
  return nominal*(segment??p.segments.at(-1)).fraction;
}
