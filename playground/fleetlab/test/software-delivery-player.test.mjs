import {test} from 'node:test';
import assert from 'node:assert/strict';
const mod=await import('../src/ui/software-delivery-player.js').catch(()=>({}));
const create=()=>{assert.equal(typeof mod.createDeliveryPlayer,'function');return mod.createDeliveryPlayer({chapters:[{t_ms:0,vehicle:'V1',hold_ms:6000},{t_ms:96000,vehicle:'V2',hold_ms:7000}],endpoint_ms:666000,H_ms:2400000,quantum_ms:1000});};
test('held chapters skip model time; manual pause persists and resume restores authored selection',()=>{
 const p=create();p.watch();p.advance(5999);assert.equal(p.state().time_ms,0);p.advance(1);assert.equal(p.state().time_ms,96000);
 p.inspect(150500,'V1');assert.equal(p.state().time_ms,150000);assert.equal(p.state().mode,'inspection');p.resume();assert.equal(p.state().time_ms,96000);assert.equal(p.state().vehicle,'V2');
 p.pause();p.visible(false);p.visible(true);p.advance(10000);assert.equal(p.state().playing,false);
});
test('arm is persistent view state, never authored state; chapters pause, guide ends once',()=>{
 const p=create();p.setArm('cold');p.watch();p.chapter(1);assert.equal(p.state().playing,false);assert.equal(p.state().arm,'cold');p.resume();p.advance(7000);assert.equal(p.state().ended,true);p.visible(false);p.visible(true);p.advance(100);assert.equal(p.state().playing,false);assert.equal(p.state().arm,'cold');
 p.replay();assert.equal(p.state().time_ms,0);assert.equal(p.state().arm,'cold');
});
test('visibility suppresses elapsed catch-up and preference changes never restart motion',()=>{
 const p=create();p.watch();p.advance(2000);p.visible(false);p.advance(900000);p.visible(true);p.advance(3000);assert.equal(p.state().chapter,0);p.advance(1000);assert.equal(p.state().chapter,1);
 p.preference(true);p.preference(false);p.advance(10000);assert.equal(p.state().playing,false);
 p.historyRestore();assert.equal(p.state().playing,false);
});
test('full timeline is separate, finite, boundary floored and does not rewind a seek past endpoint',()=>{
 const p=create();p.inspect(0,'V1');p.timelinePlay();p.advance(22200);assert.equal(p.state().time_ms,666000);assert.equal(p.state().playing,false);
 p.inspect(1000100);p.timelinePlay();assert.equal(p.state().playing,false);assert.equal(p.state().time_ms,1000000);
 p.timelineReplay();assert.equal(p.state().time_ms,0);p.advance(1000);assert.equal(p.state().time_ms,30000);
});
