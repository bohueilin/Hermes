import test from 'node:test';
import assert from 'node:assert/strict';
import { computeEstimate, validateEstimate } from '../google-routes.mjs';
const now = Date.parse('2026-09-19T12:00:00Z');
const input = () => ({origin:{latitude:37.7749,longitude:-122.4194},destination:{latitude:37.3382,longitude:-121.8863},departureTime:'2026-09-19T13:00:00.000Z',trafficModel:'BEST_GUESS'});
const response = (data) => new Response(JSON.stringify(data));
test('sends only allowed Routes fields and preserves exact durations with no key in result', async () => {
  let request;
  const result = await computeEstimate(input(), {apiKey:'TEST_SECRET',now:()=>now,fetchImpl:async (url, options)=>{ request={url,options}; return response({routes:[{duration:'1234.567s',staticDuration:'1100s',distanceMeters:48000}]}); }});
  assert.equal(request.url,'https://routes.googleapis.com/directions/v2:computeRoutes');
  assert.equal(request.options.headers['X-Goog-Api-Key'],'TEST_SECRET');
  assert.equal(request.options.redirect,'error');
  assert.equal(request.options.headers['X-Goog-FieldMask'],'routes.duration,routes.staticDuration,routes.distanceMeters,fallbackInfo');
  assert.deepEqual(JSON.parse(request.options.body),{origin:{location:{latLng:input().origin}},destination:{location:{latLng:input().destination}},departureTime:input().departureTime,travelMode:'DRIVE',routingPreference:'TRAFFIC_AWARE_OPTIMAL',trafficModel:'BEST_GUESS',computeAlternativeRoutes:false});
  assert.equal(result.duration,'1234.567s');
  assert.equal(result.durationSeconds,1234.567);
  assert.equal(result.staticDurationSeconds,1100);
  assert.equal(result.state,'connected');
  assert.ok(!JSON.stringify(result).includes('TEST_SECRET'));
});
test('rejects unknown request fields, invalid coordinates, unsupported models and time outside future seven days', () => {
  for(const value of [null,[],{...input(),url:'https://evil.test'}, {...input(),origin:{latitude:91,longitude:1}}, {...input(),origin:{latitude:'37',longitude:1}}, {...input(),origin:{...input().origin,extra:1}}, {...input(),trafficModel:'X'}, {...input(),departureTime:'now'}, {...input(),departureTime:'2026-09-19T11:00:00Z'}, {...input(),departureTime:'2026-09-27T12:00:00Z'}]) assert.throws(()=>validateEstimate(value,now),/invalid/i);
  assert.equal(validateEstimate({...input(),departureTime:'2026-09-26T12:00:00.000Z'},now).departureTime,'2026-09-26T12:00:00.000Z');
});
test('unconfigured key does not call provider',async()=>{
  await assert.rejects(computeEstimate(input(),{apiKey:'',now:()=>now,fetchImpl:()=>assert.fail('network call')}), {code:'UNCONFIGURED'});
});
test('provider failures and thrown messages are redacted with no retry',async()=>{
  let calls=0;
  for(const fetchImpl of [async()=>{calls++;return new Response('TEST_SECRET provider error',{status:403});},async()=>{calls++;throw Error('TEST_SECRET');}]) {
    await assert.rejects(computeEstimate(input(),{apiKey:'TEST_SECRET',now:()=>now,fetchImpl}), error=>error.code==='PROVIDER_ERROR' && !error.message.includes('TEST_SECRET') && !error.cause);
  }
  assert.equal(calls,2);
});
test('missing, malformed, excessive and fallback estimates fail closed',async()=>{
  for(const data of [{},{routes:[]},{routes:[{duration:'12s'}]},{routes:[{duration:'NaNs',staticDuration:'12s',distanceMeters:1}]},{routes:[{duration:'-1s',staticDuration:'12s',distanceMeters:1}]},{routes:[{duration:'12s',staticDuration:'12s',distanceMeters:-1}]},{routes:[{duration:'12s',staticDuration:'12s',distanceMeters:1}],fallbackInfo:{routingMode:'FALLBACK_TRAFFIC_UNAWARE'}},{routes:[{duration:'999999999999999999999s',staticDuration:'12s',distanceMeters:1}]}]) {
    await assert.rejects(computeEstimate(input(),{apiKey:'mock',now:()=>now,fetchImpl:async()=>response(data)}),{code:'INVALID_PROVIDER_RESPONSE'});
  }
  await assert.rejects(computeEstimate(input(),{apiKey:'mock',now:()=>now,fetchImpl:async()=>new Response('x'.repeat(65537))}),{code:'INVALID_PROVIDER_RESPONSE'});
});
