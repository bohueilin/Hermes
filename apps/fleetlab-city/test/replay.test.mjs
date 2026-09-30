import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resumeTime, estimateRevenue, eventDescription, pairLesson } from '../web/view-model.mjs';
test('replay restarts at first sample at the end, otherwise resumes the selected time', () => {
  assert.equal(resumeTime(28800, [[15], [28800]]), 15);
  assert.equal(resumeTime(9300, [[15], [28800]]), 9300);
  assert.equal(resumeTime(0, [[15], [28800]]), 15);
  assert.equal(resumeTime(20, []), null);
});
test('no revenue without all explicit fare inputs; completed passenger miles only', () => {
  const s = { completed: 2, completed_passenger_m: 1609.344, completed_passenger_s: 600, distance_m: 90000 };
  assert.equal(estimateRevenue(s, ['', '2', '0']), null);
  assert.equal(estimateRevenue(s, ['1', '-2', '0']), null);
  assert.equal(estimateRevenue(s, ['1', '2', '0.5']), 9);
  assert.equal(estimateRevenue(s, ['0', '0', '0']), 0);
  assert.equal(estimateRevenue(s, ['Infinity', '0', '0']), null);
});
test('state events explain queues, terminal event records the full horizon', () => {
  assert.match(eventDescription({ kind: 'state', after: 'queue_charge', site: 'A' }), /Waiting.*depot A/);
  assert.match(eventDescription({ kind: 'run_end', execution: 'COMPLETE' }), /Shift ended/);
});
test('pair lesson retains adverse differences and never claims general superiority', () => {
  const p = { baseline: {completed: 10, empty_km_per_completed: 5, wait_p90_s: 100}, candidate: {completed: 8, empty_km_per_completed: 6, wait_p90_s: 130} };
  const lesson = pairLesson(p);
  assert.match(lesson, /2 fewer/); assert.match(lesson, /more empty/); assert.match(lesson, /longer/);
});

test('inspecting a new pair replaces a still-pending replay before navigating', async () => {
  const { inspectRepeat, requestGate } = await import('../web/view-model.mjs');
  const gate = requestGate();
  let selected, visible, rendered;
  const pending = [], ordering = [];
  const actions = {
    select: seed => { selected = seed; ordering.push(`select:${seed}`); },
    load: () => { const seed=selected, ticket=gate.issue(); pending.push(() => { if(gate.current(ticket)) rendered=seed; }); ordering.push(`load:${seed}`); },
    show: () => { visible=true; ordering.push(`show:${selected}`); }
  };
  inspectRepeat(1001, actions);
  inspectRepeat(1002, actions);
  pending[1](); pending[0]();
  assert.equal(rendered,1002);
  assert.equal(selected,1002);
  assert.equal(visible,true);
  assert.deepEqual(ordering,['select:1001','load:1001','show:1001','select:1002','load:1002','show:1002']);
});
