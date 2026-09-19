import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createOperationsMap, vehiclePosition } from '../src/ui/operations-map.js';
import { installFakeDom } from './helpers/fake-dom.mjs';

test('movement interpolates the recorded leg and stays on the street path', () => {
  const locations=[{id:'a',x:10,y:20},{id:'b',x:90,y:80}];
  const car={id:'car-1',from:'a',to:'b',progress:0.25,node:null};
  const next={...car,progress:0.75};
  const p=vehiclePosition(car,next,0.5,locations);
  assert.equal(p.x,80); assert.equal(p.y,20);
  assert.deepEqual(vehiclePosition({...car,from:null,to:null,node:'a'},null,0,locations),{x:10,y:20,angle:0});
});

test('every displayed car corresponds to a recorded vehicle and selection reports its id', () => {
  const restore=installFakeDom();
  try {
    let selected=null;
    const map=createOperationsMap(id=>{selected=id;});
    const run={locations:[{id:'a',label:'District A',x:10,y:20,kind:'zone'},{id:'d',label:'Depot 1',x:70,y:80,kind:'depot'}]};
    const frame={minute:0,clock_minute:420,vehicles:[{id:'car-1',state:'available',node:'a',from:null,to:null,soc_kwh:40}],depot_queues:[]};
    map.render(run,frame,null,0,'car-1');
    assert.equal(map.element.querySelectorAll('[data-car-id]').length,1);
    const car=map.element.querySelector('[data-car-id="car-1"]'); car.dispatchEvent(new Event('click'));
    assert.equal(selected,'car-1');
    assert.match(car.getAttribute('aria-label'),/car-1/);
    map.render(run,{...frame,vehicles:[]},null,0,null);
    assert.equal(map.element.querySelectorAll('[data-car-id]').length,0);
  } finally {restore();}
});
