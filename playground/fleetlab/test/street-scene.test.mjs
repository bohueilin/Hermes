import test from 'node:test';
import assert from 'node:assert/strict';
import {streetVehiclePosition,createStreetScene} from '../src/ui/street-scene.js';
import {installFakeDom} from './helpers/fake-dom.mjs';
const network={nodes:[{id:'a',x:0,y:0}],edges:[{id:'one',name:'First Street',points:[[0,0],[1,0],[1,1]]}],anchors:[{id:'fidi',node:'a',label:'FiDi',x:0,y:0}],hotspots:[{id:'first',label:'First Street',x:.5,y:0,edge_ids:['one']}]};
test('replay follows recorded bends and never interpolates across a changed road or leg',()=>{
 const car={node:'a',edge_id:'one',route_id:'r',progress:.25};
 assert.deepEqual(streetVehiclePosition(network,car,{...car,progress:.75},.5),{x:1,y:0,heading:0});
 assert.deepEqual(streetVehiclePosition(network,car,{...car,edge_id:'other',progress:.75},.5),{x:.5,y:0,heading:0});
 assert.deepEqual(streetVehiclePosition(network,car,{...car,progress:.25},.9),{x:.5,y:0,heading:0});
});
test('a road crossing the viewport stays visible when both stored endpoints lie outside it',()=>{
 const restore=installFakeDom();let scene;try{
  scene=createStreetScene({network:{...network,edges:[{...network.edges[0],points:[[-10,0],[10,0]]}]},createRenderer:()=>null});
  assert.equal(scene.element.querySelectorAll('polyline').length,1);
 }finally{scene?.destroy();restore();}
});
test('flat fallback keeps road names and selectable focus when WebGL is unavailable',()=>{
 const restore=installFakeDom();let scene;try{
  scene=createStreetScene({network,createRenderer:()=>null});document.body.appendChild(scene.element);
  scene.focus('first');scene.render(null,null,null,0,null);
  assert.match(scene.element.textContent,/First Street/);assert.match(scene.element.textContent,/Flat/);
  assert.equal(scene.getCamera().target[0],.5);
 }finally{scene?.destroy();restore();}
});
