import test from 'node:test';
import assert from 'node:assert/strict';

const verifier = await import('../src/model/software-delivery-verify.js').catch(() => ({}));
const contract = await import('../src/model/software-delivery-contract.js').catch(() => ({}));

// Hand-derived 4-byte horizon fixture: receipts at 1s and 2s, zero work closes at H.
function horizonRecord() {
  const input = { schema: 'fleetlab.software-delivery-input/1.0.0', P_ms: 0, H_ms: 2000, quantum_ms: 1000,
    artifact: { id: 'update', version: '1', digest: '0'.repeat(64), size_bytes: 4, available_at_ms: 0 },
    requests: [{ id: 'A', arrival_ms: 0, deadline_ms: 2000, check_ms: 0, check_outcome: 'pass', activation_ms: 0 }],
    resources: { wan: { aggregate_Bps: 4, transfer_cap_Bps: 4 }, local: { aggregate_Bps: 4, transfer_cap_Bps: 4 } }, inventory: [] };
  const resource = (t_ms, name, active) => ({ t_ms, resource: name, cursor_in: `${name === 'wan' ? 'wan' : 'loc'}-A`, cursor_out: `${name === 'wan' ? 'wan' : 'loc'}-A`, budget_bytes: t_ms === 2000 ? 0 : 4,
    unused_bytes: t_ms === 2000 || active ? 0 : 4, eligible: active ? [{ id: `${name === 'wan' ? 'wan' : 'loc'}-A`, remaining_bytes: 4, cap_bytes: 4, grant_bytes: 4 }] : [] });
  const task = (t_ms, phase, type) => ({ t_ms, phase, owner_kind: 'request', request_id: 'A', type });
  const record = { schema: 'fleetlab.software-delivery-record/1.0.0', policy_version: 'capped-equal-share/1.0.0', input, input_digest: '', policy: 'repeated',
    universe: [{ id: 'loc-A', resource: 'local', owner_kind: 'request', request_id: 'A' }, { id: 'wan-A', resource: 'wan', owner_kind: 'request', request_id: 'A' }],
    boundaries: [0, 1000, 2000].map(t_ms => ({ t_ms, arrivals: t_ms ? [] : ['A'], source_available: true })),
    resources: [resource(0, 'wan', true), resource(0, 'local', false), resource(1000, 'wan', false), resource(1000, 'local', true), resource(2000, 'wan', false), resource(2000, 'local', false)],
    tasks: [task(1000, 1, 'wan_received'), task(2000, 1, 'local_received'), task(2000, 3, 'check_started'), task(2000, 3, 'check_passed'), task(2000, 3, 'activation_started'), task(2000, 3, 'activation_completed'), task(2000, 4, 'ready')],
    inventory: [], outcomes: [{ id: 'A', arrival_applied_ms: 0, wan_completed_ms: 1000, local_completed_ms: 2000, check_started_ms: 2000, check_completed_ms: 2000, activation_started_ms: 2000, ready_ms: 2000, failed_ms: null, deadline_ms: 2000, wan_bytes: 4, local_bytes: 4 }],
    metrics: { request_count: 1, on_time_count: 1, all_ready_ms: 2000, terminal_ms: 2000, wan_bytes: 4, local_bytes: 4, unique_artifact_bytes: 4, storage_provision_bytes: 4 } };
  record.input_digest = contract.deliveryDigest(input);
  record.record_digest = contract.deliveryDigest(record);
  return record;
}

test('verifier accepts independent horizon fixture and rejects a forged grant before the stale digest', () => {
  assert.equal(typeof verifier.verifyDelivery, 'function', 'independent verifier is implemented');
  const record = horizonRecord();
  assert.equal(verifier.verifyDelivery(record).ok, true);
  record.resources[0].eligible[0].grant_bytes = 3;
  const result = verifier.verifyDelivery(record);
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /grant/);
  assert.equal(result.metrics, null);
});

export { horizonRecord };

const reseal = record => {
  record.input_digest = contract.deliveryDigest(record.input);
  delete record.record_digest;
  record.record_digest = contract.deliveryDigest(record);
  return record;
};

test('untrusted records reject getters, symbols, inherited fields, sparse/decorated arrays and oversized shapes before replay', () => {
  let reads = 0;
  for (const mutate of [
    r => Object.defineProperty(r, 'metrics', { get() { reads++; throw Error('executed'); }, enumerable: true }),
    r => { r[Symbol('hidden')] = true; },
    r => Object.setPrototypeOf(r, { inherited: true }),
    r => { delete r.resources[1]; },
    r => { r.boundaries.extra = 'no'; },
    r => { r.resources = new Array(130001); },
    r => { r.universe[0].id = 'x'.repeat(33 * 1024 * 1024); },
    r => { r.input.H_ms = Number.MAX_SAFE_INTEGER; },
    r => { r.outcomes[0].wan_bytes = -0; },
    r => { r.tasks[0].t_ms = NaN; },
    r => { r.input.requests.push(r.input.requests[0]); },
    r => { r.input.inventory.push({ artifact_id: 'old' }); },
    r => { r.resources[0].eligible[0].extra = 1; },
  ]) {
    const record = horizonRecord(); mutate(record);
    const result = verifier.verifyDelivery(record);
    assert.equal(result.ok, false, result.errors.join(' '));
    assert.equal(result.metrics, null); assert.equal(result.input_digest, null); assert.equal(result.record_digest, null);
  }
  assert.equal(reads, 0);
});

test('mutation reasons discriminate ownership, eligibility, cursor, transition, metric and digest faults', () => {
  const cases = [
    [r => { r.universe[0].owner_kind = 'depot_cache'; }, /universe-owner/],
    [r => { r.resources[0].eligible[0].id = 'wan-unknown'; }, /eligibility/],
    [r => { r.resources[0].cursor_out = 'other'; }, /cursor-out/],
    [r => { r.resources[1].eligible.push({ id: 'loc-A', remaining_bytes: 4, cap_bytes: 4, grant_bytes: 0 }); }, /eligibility/],
    [r => { r.input.artifact.available_at_ms = 1000; }, /boundary/],
    [r => { r.outcomes[0].ready_ms = 1000; }, /outcomes/],
    [r => { r.tasks.at(-1).phase = 3; }, /tasks-transition/],
    [r => { r.metrics.on_time_count = 0; }, /metrics/],
    [r => { r.schema = 'fleetlab.software-delivery-record/2.0.0'; }, /unsupported-schema/],
    [r => { r.policy_version = 'bad'; }, /unsupported-version/],
    [r => { r.input_digest = 'f'.repeat(64); }, /input-digest/],
    [r => { r.record_digest = 'f'.repeat(64); }, /record-digest/],
    [r => { r.boundaries.at(-1).t_ms = 3000; }, /boundary/],
  ];
  for (const [mutate, reason] of cases) {
    const record = horizonRecord(); mutate(record);
    const result = verifier.verifyDelivery(record);
    assert.equal(result.ok, false); assert.match(result.errors.join(' '), reason);
  }
});

test('inclusive raw deadline is evaluated without rounding at the horizon', () => {
  const record = horizonRecord();
  record.input.requests[0].deadline_ms = 1999;
  record.outcomes[0].deadline_ms = 1999; record.metrics.on_time_count = 0;
  assert.equal(verifier.verifyDelivery(reseal(record)).ok, true);
});

async function produce(input, policy) {
  const { runDelivery } = await import('../src/model/software-delivery.js');
  const record = runDelivery(input, policy);
  const result = verifier.verifyDelivery(record);
  assert.equal(result.ok, true, result.errors.join(' '));
  return record;
}

test('independent replay matches all public analytical anchors at both supported quanta', async () => {
  const expected = {
    default: { repeated: [666000, 0, 48000000000, 48000000000], cold: [378000, 4, 12000000000, 48000000000] },
    one: { repeated: [234000, 1, 12000000000, 12000000000], cold: [234000, 1, 12000000000, 12000000000] },
    'slow-local': { repeated: [2010000, 0, 48000000000, 48000000000], cold: [1722000, 0, 12000000000, 48000000000] },
    'two-arrivals': { repeated: [334000, 1, 24000000000, 24000000000], cold: [282000, 0, 12000000000, 24000000000] },
  };
  for (const quantum of [1000, 250]) for (const [preset, arms] of Object.entries(expected)) for (const [policy, want] of Object.entries(arms)) {
    const record = await produce(contract.deliveryInput(preset, quantum), policy);
    assert.deepEqual(['all_ready_ms', 'on_time_count', 'wan_bytes', 'local_bytes'].map(key => record.metrics[key]), want, `${preset}/${policy}/${quantum}`);
    if (preset === 'two-arrivals') assert.deepEqual(record.outcomes.map(row => row.ready_ms), policy === 'repeated' ? [234000, 334000] : [278000, 282000]);
  }
});

test('tie fixture preserves ASCII residual allocation and request permutation identity', async () => {
  const input = contract.deliveryInput();
  input.requests = ['A', 'A0', 'B'].map(id => ({ ...input.requests[0], id, deadline_ms: 520000 }));
  input.artifact.size_bytes = 11958333334;
  const record = await produce(input, 'repeated');
  assert.deepEqual(record.outcomes.map(row => [row.wan_completed_ms, row.local_completed_ms, row.ready_ms]), [[287000, 429000, 519000], [288000, 431000, 521000], [288000, 431000, 521000]]);
  assert.equal(record.metrics.on_time_count, 1);
  input.requests.reverse();
  assert.equal((await produce(input, 'repeated')).record_digest, record.record_digest);
  const permuted = structuredClone(record);
  permuted.resources.forEach(row => row.eligible.reverse());
  assert.equal(verifier.verifyDelivery(permuted).ok, true);
  const { record_digest, ...body } = permuted;
  assert.equal(contract.deliveryDigest(body), record_digest);
});

test('maximum-size records retain censored requests and full work through H at both quanta', async () => {
  for (const quantum of [1000, 250]) for (const policy of ['repeated', 'cold']) {
    const input = contract.deliveryInput('default', quantum); input.artifact.size_bytes = 64000000000;
    const record = await produce(input, policy);
    assert.equal(record.metrics.on_time_count, 0);
    if (policy === 'cold') {
      assert.equal(record.metrics.all_ready_ms, 1626000);
      assert.equal(record.metrics.local_bytes, 256000000000);
      assert.deepEqual(record.outcomes.map(row => row.local_completed_ms), [1536000, 1536000, 1536000, 1536000]);
    } else {
      assert.equal(record.metrics.all_ready_ms, null); assert.equal(record.metrics.terminal_ms, 2400000);
      assert.equal(record.metrics.local_bytes, 88000000000);
      assert.deepEqual(record.outcomes.map(row => [row.wan_completed_ms, row.local_bytes, row.check_started_ms]), Array(4).fill([2048000, 22000000000, null]));
    }
  }
});

test('quantized prerequisites accumulate and change the raw deadline outcome', async () => {
  for (const quantum of [1000, 250]) for (const policy of ['repeated', 'cold']) {
    const input = contract.deliveryInput('one', quantum); input.artifact.size_bytes = 12000000001;
    Object.assign(input.requests[0], { arrival_ms: 100, check_ms: 60001, deadline_ms: 236000 });
    const record = await produce(input, policy), row = record.outcomes[0];
    assert.deepEqual([row.arrival_applied_ms, row.local_completed_ms, row.check_completed_ms, row.ready_ms, record.metrics.on_time_count], quantum === 1000 ? [1000, 147000, 208000, 238000, 0] : [250, 144750, 205000, 235000, 1]);
  }
});

test('failed check does not affect transfers or start activation and terminal endpoint stays finite', async () => {
  for (const policy of ['repeated', 'cold']) {
    const input = contract.deliveryInput(); input.requests[3].check_outcome = 'fail';
    const record = await produce(input, policy), v4 = record.outcomes[3];
    assert.equal(v4.failed_ms, policy === 'cold' ? 348000 : 636000);
    assert.equal(v4.activation_started_ms, null); assert.equal(v4.ready_ms, null);
    assert.equal(record.metrics.all_ready_ms, null); assert.equal(record.metrics.terminal_ms, policy === 'cold' ? 378000 : 666000);
    assert.equal(record.metrics.on_time_count, policy === 'cold' ? 3 : 0);
  }
});

test('delayed and off-boundary source availability forbid premature WAN grants', async () => {
  for (const available of [50000, 50100]) for (const policy of ['repeated', 'cold']) {
    const input = contract.deliveryInput(); input.artifact.available_at_ms = available;
    const record = await produce(input, policy);
    assert.equal(record.metrics.all_ready_ms, (policy === 'cold' ? 428000 : 716000) + (available === 50100 ? 1000 : 0));
    assert.equal(record.resources.filter(row => row.resource === 'wan' && row.t_ms < available).flatMap(row => row.eligible).length, 0);
  }
});

test('zero caps and capacities never fabricate progress and positive activation cannot begin at H', async () => {
  for (const [aggregate, cap] of [[4, 0], [0, 4], [0, 0]]) for (const policy of ['repeated', 'cold']) {
    const input = horizonRecord().input; input.resources.wan = { aggregate_Bps: aggregate, transfer_cap_Bps: cap };
    const record = await produce(input, policy);
    assert.equal(record.metrics.wan_bytes, 0); assert.equal(record.metrics.all_ready_ms, null);
    assert.equal(record.resources[0].eligible[0].cap_bytes, cap);
  }
  const input = horizonRecord().input; input.requests[0].activation_ms = 1;
  const record = await produce(input, 'repeated');
  assert.equal(record.outcomes[0].activation_started_ms, null); assert.equal(record.metrics.all_ready_ms, null);
});

test('one-byte object has different readiness and deadline outcome at different quanta', async () => {
  for (const quantum of [1000, 250]) {
    const input = horizonRecord().input; input.quantum_ms = quantum; input.artifact.size_bytes = 1; input.requests[0].deadline_ms = 1000;
    const record = await produce(input, 'cold');
    assert.equal(record.metrics.all_ready_ms, quantum === 1000 ? 2000 : 500);
    assert.equal(record.metrics.on_time_count, quantum === 1000 ? 0 : 1);
  }
});

test('residual-heavy stress preserves every interval grant and persistent cursor at full horizon', async () => {
  for (const quantum of [1000, 250]) for (const policy of ['repeated', 'cold']) {
    const input = contract.deliveryInput('default', quantum); input.artifact.size_bytes = 64000000000;
    input.resources.wan.aggregate_Bps = quantum === 1000 ? 4 : 12;
    if (quantum === 1000) input.requests.pop();
    const record = await produce(input, policy);
    assert.equal(record.metrics.wan_bytes, quantum === 1000 ? 9600 : 28800);
    assert.equal(record.metrics.local_bytes, 0); assert.equal(record.metrics.all_ready_ms, null);
    if (policy === 'repeated') assert.deepEqual(record.outcomes.map(row => row.wan_bytes), quantum === 1000 ? [3200, 3200, 3200] : [7200, 7200, 7200, 7200]);
    const forged = structuredClone(record), row = forged.resources[0];
    row.cursor_out = row.cursor_in;
    if (policy === 'repeated') { assert.equal(verifier.verifyDelivery(forged).ok, false); assert.match(verifier.verifyDelivery(forged).errors.join(' '), /cursor/); }
  }
});
