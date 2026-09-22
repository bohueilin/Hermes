import test from 'node:test';import assert from 'node:assert/strict';
import {defaultAirport,validateAirport,generateAirportWave,forecastTarget,airportCohort} from '../src/model/airport-demand.js';
const config=patch=>({seed:42,duration_hours:4,place_ids:['sfo','san-bruno','millbrae'],airport:{...defaultAirport(),...patch}});
test('airport realization is keyed and policy/forecast changes cannot change the external wave',()=>{
  const a=config({}),b=config({policy:'forecast',forecast_count:1,forecast_wave_min:20});
  assert.deepEqual(generateAirportWave(a),generateAirportWave(b));assert.deepEqual(generateAirportWave(a),generateAirportWave(a));
  assert.ok(generateAirportWave(a).length>0);
  assert.ok(generateAirportWave(a).every(q=>q.minute>=a.airport.arrival_min+a.airport.passenger_delay_min&&q.minute<a.airport.intake_end_min));
});
test('planner sees only published, unexpired forecast and cannot inspect realized future requests',()=>{
  const f={published_min:20,expires_min:100,wave_min:70,count:12};
  assert.equal(forecastTarget(f,19,60,4),0);assert.equal(forecastTarget(f,30,30,4),0);
  assert.equal(forecastTarget(f,40,30,4),4);assert.equal(forecastTarget(f,101,30,4),0);
});
test('pickup cohort includes known failures and unobservable outcomes explicitly',()=>{
  const requests=[{pickup_node:'sfo',created_minute:0,picked_up_minute:5,status:'in_progress'},
    {pickup_node:'sfo',created_minute:0,picked_up_minute:12,status:'completed'},
    {pickup_node:'sfo',created_minute:18,picked_up_minute:null,status:'waiting'},
    {pickup_node:'sfo',created_minute:18,picked_up_minute:null,status:'unserved'},
    {pickup_node:'sfo',created_minute:20,picked_up_minute:null,status:'waiting'}];
  assert.deepEqual(airportCohort(requests,'sfo',20,10),{requests:5,within_target:1,missed:2,pending:2});
});
test('airport validation rejects missing geography, future formats and invalid cohorts',()=>{
  assert.deepEqual(validateAirport(config({})),[]);
  for(const patch of [{version:'unknown'},{ride_conversion:2},{staging_capacity:-1},{intake_end_min:241},{forecast_expires_min:0},{policy:'oracle'}])assert.ok(validateAirport(config(patch)).length);
  const c=config({});c.place_ids=['san-bruno','millbrae'];assert.ok(validateAirport(c).length);
});
