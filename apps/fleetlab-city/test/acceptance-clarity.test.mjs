import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as model from '../web/view-model.mjs';

const trace = site => ({elapsed_s:60, interval_s:15, summary:{final_state:'idle'},
  intervals:[{start:0,end:29,state:'turnaround',site},{start:29,end:60,state:'queue_charge',site}],
  samples:[[15,1,2,0,'turnaround',19],[30,1,2,0,'queue_charge',19],[45,1,2,0,'queue_charge',19],[60,1,2,0,'idle',19]]});

test('cursor state follows exact activity boundary while pose and energy stay sampled',()=>{
  assert.equal(typeof model.replayMoment,'function');
  for(const site of ['A','B']) {
    const t=trace(site), before=JSON.stringify(t);
    for(const [time,state,sampled] of [[28.999,'turnaround',15],[29,'queue_charge',15],[29.001,'queue_charge',15],[30,'queue_charge',30],[60,'idle',60],[28,'turnaround',15]]) {
      const m=model.replayMoment(t,time);
      assert.equal(m.state,state); assert.equal(m.position.sample[0],sampled);
      assert.equal(m.position.sample[1],1); if(time!==60) assert.equal(m.interval.site,site);
    }
    assert.equal(JSON.stringify(t),before,'reading the cursor cannot change shift totals or trace');
  }
});

test('a state change at recording end cannot inherit the previous interval or depot',()=>{
  const t=trace('A');
  const end=model.replayMoment(t,60);
  assert.equal(end.state,'idle');
  assert.equal(end.interval,null);
  assert.equal(end.site,null);
  assert.match(end.context,/at recording end.*07:01:00/i);
  assert.doesNotMatch(end.context,/activity interval/i);
  t.summary={final_state:'charging',final_site:'B'};
  const depotEnd=model.replayMoment(t,60);
  assert.equal(depotEnd.site,'B');
  assert.equal(depotEnd.interval,null);
  assert.match(model.replayMoment(t,29).context,/07:00:29–07:01:00/);
});

test('missing position and recording gaps do not substitute a pose or interval',()=>{
  assert.equal(typeof model.replayMoment,'function');
  const t=trace('A');
  assert.equal(model.replayMoment(t,0).position.status,'unavailable');
  t.samples.splice(1,1);
  assert.equal(model.replayMoment(t,29).position.status,'gap');
  assert.equal(model.replayMoment(t,29).position.sample,null);
  t.intervals=[];
  assert.equal(model.replayMoment(t,29).state,null);
  assert.equal(model.replayMoment(t,61).state,null);
});

const comparison = (low=.70,mean=1.11,high=1.55) => ({schema:'fleetlab.city-comparison/1.0.0', eligibility:'BLOCKED_MAP_QUALIFICATION',outcome:'INCOMPLETE',primary_pp:{low,mean,high,n:12}});
test('practical context uses the existing v1 margin without turning it into a map verdict',()=>{
  assert.equal(typeof model.completionContext,'function');
  const c=comparison(), before=JSON.stringify(c), result=model.completionContext(c);
  assert.equal(result.threshold,2); assert.equal(result.primary.mean,1.11);
  assert.match(result.headline,/Below the \+2 pp practical margin/);
  assert.match(result.text,/entire paired interval.*below/i);
  assert.match(result.text,/map qualification.*separate/i);
  assert.equal(JSON.stringify(c),before);
  assert.match(model.completionContext(comparison(1.9,2,2.1)).text,/crosses|includes/i);
  assert.match(model.completionContext(comparison(1.9,2,2.1)).headline,/includes or crosses/i);
  assert.match(model.completionContext(comparison(2,2.1,2.2)).text,/crosses|includes/i);
  assert.match(model.completionContext(comparison(2.01,2.1,2.2)).text,/above/i);
  assert.match(model.completionContext(comparison(2.01,2.1,2.2)).headline,/Above/);
  assert.match(model.completionContext(comparison(-2,-1,-.5)).text,/below/i);
});

test('missing, malformed, unknown-version or incompatible results cannot acquire a plausible result or margin',()=>{
  assert.equal(typeof model.completionContext,'function');
  for(const c of [null,{}, {...comparison(),schema:'other'}, {...comparison(),eligibility:'INCOMPATIBLE'}, {...comparison(),outcome:'INVALID'}, {...comparison(),primary_pp:null},comparison(null,1,2),comparison(2,1,0),comparison(1,Infinity,2)]) {
    const result=model.completionContext(c);
    assert.equal(result.primary,null); assert.equal(result.threshold,null); assert.match(result.text,/unavailable/i);
    assert.match(result.headline,/unavailable/i);
  }
});
