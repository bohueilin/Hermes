import test from 'node:test';
import assert from 'node:assert/strict';
import * as profiles from '../src/model/vehicle-profiles.js';
import * as bay from '../src/model/bay-operations.js';
test('vehicle profiles distinguish published seating from editable operational assumptions',()=>{
  assert.ok(profiles.VEHICLE_PROFILES?.ipace&&profiles.VEHICLE_PROFILES?.ojai);
  for(const p of Object.values(profiles.VEHICLE_PROFILES)) {
    assert.equal(p.published.max_riders,4);
    assert.equal(p.operational_status,'ILLUSTRATIVE_ASSUMPTIONS');
    assert.ok(p.sources.length>0);
  }
  assert.equal(profiles.VEHICLE_PROFILES.ipace.published.nominal_battery_kwh,90);
  assert.equal(profiles.VEHICLE_PROFILES.ojai.published.nominal_battery_kwh,null);
});
test('default profile edits never leak into a subsequent configuration',()=>{
  const a=bay.defaultBayAreaConfig(),b=bay.defaultBayAreaConfig();
  a.vehicle_profiles.ipace.battery_kwh=12;
  a.place_ids.pop();
  assert.equal(b.vehicle_profiles.ipace.battery_kwh,84);
  assert.equal(b.place_ids.length,18);
});
test('unknown profile keys and invalid physical/service inputs are rejected',()=>{
  const defaults=bay.defaultBayAreaConfig();
  for(const [key,value] of [['battery_kwh',0],['charge_limit_kw',0],['energy_kwh_per_km',-1],['boarding_minutes',-1],['cleaning_multiplier',Infinity],['software_multiplier',0],['upload_multiplier',NaN],['faster_brand',2]]) {
    const c=structuredClone(defaults);c.vehicle_profiles.ojai[key]=value;
    assert.ok(bay.validateBayAreaConfig(c).length>0,key);
  }
  for(const v of [null,[],{ipace:{}},{...defaults.vehicle_profiles,other:defaults.vehicle_profiles.ipace}]) {
    assert.ok(bay.validateBayAreaConfig({...defaults,vehicle_profiles:v}).length>0);
  }
});
