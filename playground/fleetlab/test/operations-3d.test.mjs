import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createOperations3D, bayVehiclePosition} from '../src/ui/operations-3d.js';
import {installFakeDom} from './helpers/fake-dom.mjs';
const places=[{id:'a',label:'City A',x:0,y:0,kind:'city',road_anchor:{x:1,y:0}},{id:'b',label:'Airport B',x:10,y:10,kind:'airport'}];
const run={locations:places,routes:{ab:{points:[[1,0],[10,0],[10,10]]}}};
test('Bay movement follows recorded sourced route length and parked cars use road anchors',()=>{
 const car={id:'c',from:'a',to:'b',route_id:'ab',progress:0,node:'a'};
 assert.deepEqual(bayVehiclePosition(run,car,{...car,progress:1},.5),{x:10,y:.5,heading:Math.PI/2});
 assert.deepEqual(bayVehiclePosition(run,{node:'a'},null,0),{x:1,y:0,heading:0});
});
test('WebGL failure exposes a named flat fallback with all places and selectable recorded cars',()=>{
 const restore=installFakeDom();try{
  let selected;const view=createOperations3D({places,createRenderer:()=>null,onSelect:id=>selected=id});
  assert.match(view.element.textContent,/WebGL unavailable/);
  assert.equal(view.element.querySelectorAll('[data-place-id]').length,2);
  view.render(run,{vehicles:[{id:'car-1',state:'available',vehicle_type:'ojai',node:'a'}]},null,0,'car-1');
  view.element.querySelector('[data-car-id="car-1"]').dispatchEvent(new Event('click'));
  assert.equal(selected,'car-1');view.focus('b');assert.deepEqual(view.getCamera().target,[10,10,0]);view.destroy();
 }finally{restore();}
});
test('camera controls redraw 3D without changing recorded car state',()=>{
 const restore=installFakeDom();try{
  let draws=0,destroyed=false;const view=createOperations3D({places,createRenderer:()=>({draw(mesh){assert.ok(mesh.length);draws++;},destroy(){destroyed=true;}})});
  const frame={vehicles:[{id:'car-1',state:'passenger_trip',vehicle_type:'ojai',from:'a',to:'b',route_id:'ab',progress:.5}]};
  const before=JSON.stringify(frame);view.render(run,frame,null,0,'car-1');view.focus('a');
  const button=[...view.element.querySelectorAll('button')].find(n=>n.textContent==='Rotate ↷');button.click();
  assert.equal(JSON.stringify(frame),before);assert.ok(draws>=4);assert.ok(view.getCamera().yaw>0);view.destroy();assert.ok(destroyed);
 }finally{restore();}
});

test('stationary cars receive distinct display slots while moving paths and records stay exact',async()=>{
 const {layoutBayVehicles}=await import('../src/ui/operations-3d.js');
 const frame={vehicles:[...Array.from({length:12},(_,i)=>({id:`car-${i}`,state:'available',node:'a'})),{id:'moving',from:'a',to:'b',route_id:'ab',progress:.5}]};
 const before=JSON.stringify(frame),layout=layoutBayVehicles(run,frame,null,0,.1);
 assert.equal(new Set(frame.vehicles.slice(0,12).map(c=>`${layout.get(c.id).x},${layout.get(c.id).y}`)).size,12);
 assert.deepEqual(layout.get('moving'),bayVehiclePosition(run,frame.vehicles.at(-1),null,0));assert.equal(JSON.stringify(frame),before);
});
