import assert from 'node:assert/strict';
import {test} from 'node:test';
import {ROUTES,routeHref,parseRoute,followLink} from '../src/ui/routes.js';
import {simulationCatalog} from '../src/ui/simulation-catalog.js';
import {CHOOSER_PRESET_IDS} from '../src/ui/experiment.js';

test('all studio destinations have stable offline-compatible links',()=>{
  for(const page of Object.keys(ROUTES)) assert.deepEqual(parseRoute(routeHref({page})),{page});
  assert.equal(routeHref({page:'simulation'}),'#/fleet-day');
  assert.deepEqual(parseRoute(''),{page:'overview'});
  assert.deepEqual(parseRoute('#/street-lab'),{page:'streets'});
});
test('each catalog record is addressable without losing its stable identifier',()=>{
  const rows=simulationCatalog(); assert.equal(rows.length,56);
  for(const r of rows){
    const page=r.target==='operations'?'simulation':r.target==='streets'?'streets':CHOOSER_PRESET_IDS.includes(r.id)?'depots':'operations';
    assert.deepEqual(parseRoute(routeHref({page,lesson:r.id})),{page,lesson:r.id});
  }
});
test('unknown paths, parameters, duplicate or conflicting state never fall back silently',()=>{
  for(const hash of ['#/unknown','#/fleet-day/extra','#/fleet-day?foo=x','#/fleet-day?lesson=x&lesson=y','#/fleet-day?lesson=x&setup=abc','#/fleet-day?lesson=','#/fleet-day?lesson=%ZZ','#/fleet-day?setup='+ 'a'.repeat(33000)]) assert.throws(()=>parseRoute(hash),hash.slice(0,90));
});
test('native modified-click and middle-click behavior remains available',()=>{
  for(const options of [{ctrlKey:true},{metaKey:true},{shiftKey:true},{altKey:true},{button:1}]){
    let called=false;followLink({...options,preventDefault(){throw Error('intercepted');}},()=>{called=true;});assert.equal(called,false);
  }
  let called=false,prevented=false;followLink({button:0,preventDefault(){prevented=true;}},()=>{called=true;});assert.equal(called,true);assert.equal(prevented,true);
});
