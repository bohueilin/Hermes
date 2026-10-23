import assert from 'node:assert/strict';
import {test} from 'node:test';
import {installFakeDom} from './helpers/fake-dom.mjs';
import * as ops from '../src/ui/operations-lab.js';
import {simulateBayAreaOperations,defaultBayAreaConfig} from '../src/model/bay-operations.js';
test('outcome bar uses the full request partition from the real run, not illustrative counts',()=>{
 const restore=installFakeDom();try{
  const run=simulateBayAreaOperations({...defaultBayAreaConfig(),duration_hours:1,fleet_size:4,requests_per_hour:30});
  const node=ops.requestOutcomes(run.metrics),segments=node.querySelectorAll('[data-request-count]');
  assert.equal(segments.length,4);
  const counts=segments.map(n=>Number(n.getAttribute('data-request-count')));
  assert.deepEqual(counts,['completed_trips','unserved_requests','pending_requests','in_progress_trips'].map(k=>run.metrics[k]));
  assert.equal(counts.reduce((a,b)=>a+b,0),run.metrics.total_requests);
  assert.match(node.textContent,/pickup|boarding/);assert.match(node.textContent,/assignment/);
 }finally{restore();}
});
test('missing, invalid and zero outcome totals are not drawn as successful service',()=>{
 const restore=installFakeDom();try{
  assert.equal(ops.requestOutcomes().querySelectorAll('[data-request-count]').length,0);
  const zero={completed_trips:0,unserved_requests:0,pending_requests:0,in_progress_trips:0,total_requests:0};
  assert.match(ops.requestOutcomes(zero).textContent,/No requests/);
  assert.match(ops.requestOutcomes({...zero,total_requests:1}).textContent,/unavailable/i);
  assert.match(ops.requestOutcomes(zero,true).textContent,/previous settings/);
 }finally{restore();}
});
