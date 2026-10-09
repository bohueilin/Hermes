import assert from 'node:assert/strict';
import {test} from 'node:test';
import {installFakeDom} from './helpers/fake-dom.mjs';

async function harness(options={}) {
  const restore=installFakeDom();
  const frames=new Map(),renders=[],spoken=[];let id=0,reduced=false;
  const {createDepotFlowPlayer}=await import('../src/ui/depot-flow-player.js');
  const player=createDepotFlowPlayer({horizon_s:900,eventTimes:[0,60,120,180,240,300,360,600,660,720,780,900],moments:[0,180,300,360,600,720,780].map(time_s=>({time_s,caption:`At ${time_s}`})),scheduler:{request:fn=>{frames.set(++id,fn);return id;},cancel:key=>frames.delete(key)},reducedMotion:()=>reduced,render:s=>renders.push(s),announce:s=>spoken.push(s),eventSentence:t=>`Event at ${t}`,...options});
  return {player,frames,renders,spoken,setReduced(v){reduced=v;player.motionChanged();},tick(ts){const work=[...frames.values()];frames.clear();work.forEach(fn=>fn(ts));},close(){player.destroy();restore();}};
}

test('explicit play uses one linear loop, clamps gaps, and guided stops cannot be overshot',async()=>{
  const h=await harness();try{
    assert.equal(h.frames.size,0);assert.equal(h.player.getState().revealing,false);
    h.player.play();h.player.play();assert.equal(h.frames.size,1);
    h.tick(0);h.tick(1000);assert.equal(h.player.getState().time_s,5);
    h.player.seek(179);h.player.play();h.tick(2000);h.tick(2250);
    assert.equal(h.player.getState().time_s,180);assert.equal(h.player.getState().playing,false);assert.equal(h.frames.size,0);
    assert.equal(h.player.getState().label,'Continue');assert.match(h.spoken.at(-1),/Guided moment 2 of 7/);
  }finally{h.close();}
});

test('seeks are synchronous, resting frames stay zero, and reveal survives reverse seeks',async()=>{
  const h=await harness();try{
    h.player.seek(120);assert.equal(h.player.getState().revealing,false);
    h.player.play();h.player.seek(60);assert.equal(h.player.getState().time_s,60);assert.equal(h.player.getState().revealing,true);assert.equal(h.frames.size,0);
    h.player.previous();assert.equal(h.player.getState().time_s,0);
    h.player.next();assert.equal(h.player.getState().time_s,60);assert.equal(h.spoken.at(-1),'Event at 60');
    h.player.restart();assert.equal(h.player.getState().time_s,0);assert.equal(h.player.getState().revealing,true);assert.equal(h.frames.size,0);
    h.player.seek(9999);assert.equal(h.player.getState().time_s,900);assert.equal(h.player.getState().label,'Play from minute 0');
    h.player.play();assert.equal(h.player.getState().time_s,0);assert.equal(h.frames.size,1);
  }finally{h.close();}
});

test('reduced motion steps by exact event every second, pauses on preference changes and never auto-resumes',async()=>{
  const h=await harness();try{
    h.setReduced(true);h.player.play();assert.equal(h.player.getState().label,'Pause');h.tick(0);h.tick(999);
    assert.equal(h.player.getState().time_s,0);h.tick(1000);assert.equal(h.player.getState().time_s,60);assert.equal(h.spoken.at(-1),'Event at 60');
    h.tick(2000);assert.equal(h.player.getState().time_s,120);h.tick(3000);assert.equal(h.player.getState().time_s,180);assert.equal(h.frames.size,0);
    h.setReduced(false);assert.equal(h.frames.size,0);h.player.play();h.tick(4000);h.tick(4100);const t=h.player.getState().time_s;
    h.setReduced(true);assert.equal(h.player.getState().time_s,t);assert.equal(h.frames.size,0);assert.equal(h.player.getState().label,'Continue by event');
  }finally{h.close();}
});

test('hidden tab, route-style pause and destruction cancel work without restart or extra announcements',async()=>{
  const h=await harness();try{
    h.player.play();const spoken=h.spoken.length;Object.defineProperty(document,'hidden',{value:true,configurable:true});document.dispatchEvent(new Event('visibilitychange'));
    assert.equal(h.frames.size,0);assert.equal(h.spoken.length,spoken);h.player.play();assert.equal(h.frames.size,0);
    Object.defineProperty(document,'hidden',{value:false,configurable:true});document.dispatchEvent(new Event('visibilitychange'));assert.equal(h.frames.size,0);
    h.player.play();h.player.pause('route');assert.equal(h.frames.size,0);h.player.play();h.player.destroy();h.player.play();h.player.seek(120);assert.equal(h.frames.size,0);
  }finally{h.close();}
});

test('continuous motion changes only frame state until an event or minute, with exact fractional seeks',async()=>{
  const h=await harness({quantum_s:.25,eventTimes:[0,2.25,60,900],moments:[]});try{
    h.player.setSpeed(10);h.player.setGuided(false);h.player.play();h.tick(0);h.tick(100);
    assert.equal(h.renders.at(-1).time_s,1);assert.equal(h.renders.at(-1).textChanged,false);
    h.tick(225);assert.equal(h.renders.at(-1).time_s,2.25);assert.equal(h.renders.at(-1).textChanged,true);
    h.player.seek(.25);assert.equal(h.renders.at(-1).time_s,.25);assert.equal(h.renders.at(-1).textChanged,true);
    assert.throws(()=>h.player.setSpeed(1),/speed/i);assert.throws(()=>h.player.seek(NaN),/time/i);
  }finally{h.close();}
});
