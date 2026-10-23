import test from 'node:test';
import assert from 'node:assert/strict';
import {allocateChargingPower,checkPowerProposal,chargingOrder,defaultCharging,validateCharging} from '../src/model/charging-allocation.js';
const jobs=[{id:'a',cap_kw:10,needed_kwh:20,queued_minute:0,deadline_minute:30},{id:'b',cap_kw:100,needed_kwh:20,queued_minute:1,deadline_minute:20}];
test('redistribution recovers acceptance-limited equal shares without exceeding site power',()=>{
  assert.deepEqual(allocateChargingPower(jobs,80,'equal_share',10,60),{a:10,b:40});
  assert.deepEqual(allocateChargingPower(jobs,80,'redistribute',10,60),{a:10,b:70});
  for(const policy of ['equal_share','redistribute','deadline'])assert.equal(checkPowerProposal(jobs,80,allocateChargingPower(jobs,80,policy,10,60)),null);
});
test('target energy, empty jobs and zero capacity do not create energy',()=>{
  assert.deepEqual(allocateChargingPower([],80,'redistribute',0,60),{});
  assert.deepEqual(allocateChargingPower([{...jobs[0],needed_kwh:.01}],80,'redistribute',0,60),{a:.6});
  assert.deepEqual(allocateChargingPower(jobs,0,'deadline',0,60),{a:0,b:0});
});
test('deadline allocation and aged-job protection are separate from FIFO',()=>{
  assert.deepEqual(chargingOrder(jobs,'equal_share',10,60).map(j=>j.id),['a','b']);
  assert.deepEqual(chargingOrder(jobs,'deadline',10,60).map(j=>j.id),['b','a']);
  assert.deepEqual(chargingOrder(jobs,'deadline',60,60).map(j=>j.id),['a','b']);
  assert.deepEqual(allocateChargingPower(jobs,80,'deadline',10,60),{a:0,b:80});
});
test('bad power proposals are rejected for named reasons before energy mutation',()=>{
  assert.equal(checkPowerProposal(jobs,80,{a:10,b:80}),'SITE_POWER_LIMIT');
  assert.equal(checkPowerProposal(jobs,80,{a:11,b:1}),'VEHICLE_POWER_LIMIT');
  assert.equal(checkPowerProposal(jobs,80,{a:NaN,b:1}),'NONFINITE_POWER');
  assert.equal(checkPowerProposal(jobs,80,{a:-1,b:1}),'NEGATIVE_POWER');
  assert.equal(checkPowerProposal(jobs,80,{a:1}),'POWER_POPULATION');
});
test('charging extension validates version, controls and finite positive budgets',()=>{
  assert.deepEqual(validateCharging(defaultCharging()),[]);
  for(const patch of [{version:'future'},{policy:'unknown'},{deadline_budget_min:0},{starvation_min:Infinity},{extra:1}])assert.ok(validateCharging({...defaultCharging(),...patch}).length);
});
