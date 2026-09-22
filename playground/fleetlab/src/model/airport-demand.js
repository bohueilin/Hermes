/** Synthetic passenger realization and separately published preparation forecast. No live airport data. */
export const AIRPORT_VERSION='airport-demand-1.0.0';
export const defaultAirport=()=>({version:AIRPORT_VERSION,policy:'reactive',airport_id:'sfo',access_rule:'synthetic-access-2026-09-22',
  arrival_min:90,passenger_delay_min:10,spread_min:20,passengers:40,ride_conversion:.7,intake_end_min:180,pickup_target_min:10,pickup_dwell_min:2,
  staging_capacity:6,preparation_lead_min:30,forecast_published_min:30,forecast_expires_min:120,forecast_wave_min:100,forecast_count:28});
export function validateAirport(config){
  const a=config.airport,errors=[];
  if(!a||typeof a!=='object'||Array.isArray(a))return ['airport must be an object.'];
  if(a.version!==AIRPORT_VERSION)errors.push('Unsupported airport version.');
  if(a.airport_id!=='sfo'||!config.place_ids?.includes(a.airport_id))errors.push('Synthetic airport scenario requires the SFO anchor.');
  if(a.access_rule!=='synthetic-access-2026-09-22')errors.push('Only the fictional dated access rule is supported.');
  if(!['reactive','forecast'].includes(a.policy))errors.push('Unsupported airport policy.');
  for(const k of ['arrival_min','passenger_delay_min','spread_min','intake_end_min','pickup_target_min','pickup_dwell_min','preparation_lead_min','forecast_published_min','forecast_expires_min','forecast_wave_min'])if(!Number.isInteger(a[k])||a[k]<(['intake_end_min','pickup_target_min'].includes(k)?1:0)||a[k]>1440)errors.push(`${k} must be bounded integer minutes.`);
  for(const k of ['passengers','forecast_count','staging_capacity'])if(!Number.isInteger(a[k])||a[k]<0||a[k]>(k==='staging_capacity'?120:1000))errors.push(`${k} exceeds the bounded scenario range.`);
  if(!Number.isFinite(a.ride_conversion)||a.ride_conversion<0||a.ride_conversion>1)errors.push('ride_conversion must be between zero and one.');
  if(a.intake_end_min>Math.ceil(config.duration_hours*60))errors.push('Request intake must end by observation end.');
  if(a.forecast_expires_min<a.forecast_published_min||a.forecast_expires_min<a.forecast_wave_min)errors.push('Forecast validity must cover its publication and declared wave.');
  const demandBound=a.passengers+Math.ceil(config.requests_per_hour/60*config.peak_multiplier*1.12+1)*a.intake_end_min;
  if(demandBound*Math.ceil(config.duration_hours*60)>10000000)errors.push('Airport timeline exceeds 10,000,000 request-minute budget. Reduce demand or horizon.');
  if(Object.keys(a).some(k=>!Object.hasOwn(defaultAirport(),k)))errors.push('Unknown airport setting.');
  return errors;
}
function draw(seed,entity,channel){let v=(seed^Math.imul(entity+1,2654435761)^Math.imul(channel+1,2246822519))>>>0;v=Math.imul(v^(v>>>16),2246822507);v=Math.imul(v^(v>>>13),3266489909);return ((v^(v>>>16))>>>0)/4294967296;}
/** Keyed by passenger/channel; no scheduler and no forecast enters realized demand. */
export function generateAirportWave(config){
  const a=config.airport,wave=[];
  for(let i=0;i<a.passengers;i++)if(draw(config.seed,i,0)<a.ride_conversion){
    const minute=a.arrival_min+a.passenger_delay_min+Math.floor(draw(config.seed,i,1)*(a.spread_min+1));
    if(minute<a.intake_end_min)wave.push({id:`airport-request-${i+1}`,minute,destination_draw:draw(config.seed,i,2)});
  }
  return wave;
}
/** Receives published forecast only, never a request tape or realization config. */
export function forecastTarget(forecast,minute,lead,capacity){
  if(minute<forecast.published_min||minute>forecast.expires_min||minute<forecast.wave_min-lead)return 0;
  return Math.min(capacity,forecast.count);
}
/** All airport-origin requests; pickup is the arrival boundary before boarding/dwell. */
export function airportCohort(requests,airport,horizon,target){
  const selected=requests.filter(q=>q.pickup_node===airport),result={requests:selected.length,within_target:0,missed:0,pending:0};
  for(const q of selected){
    if(q.picked_up_minute!==null){if(q.picked_up_minute-q.created_minute<=target)result.within_target++;else result.missed++;}
    else if(q.status==='unserved'||q.created_minute+target<=horizon)result.missed++;
    else result.pending++;
  }
  return result;
}
