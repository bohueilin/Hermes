// Independently derived from the Oct12 A1/A3 and Oct13 NF04-B contracts.
// Only schema validation and canonical identities cross the producer boundary.
import { DELIVERY_RECORD_SCHEMA, DELIVERY_POLICY_VERSION, normalizeDeliveryInput, canonicalDelivery, deliveryDigest } from './software-delivery-contract.js';

export const DELIVERY_VERIFIER_VERSION = 'fleetlab.software-delivery-verifier/1.0.0';

const RECORD_BYTES = 32 * 1024 * 1024;
const MAX_ENTRIES = 130000;
const TYPES = ['wan_received', 'local_received', 'check_started', 'check_passed', 'check_failed', 'activation_started', 'activation_completed', 'ready'];
const OUTCOME_KEYS = 'id arrival_applied_ms wan_completed_ms local_completed_ms check_started_ms check_completed_ms activation_started_ms ready_ms failed_ms deadline_ms wan_bytes local_bytes';
const METRIC_KEYS = 'request_count on_time_count all_ready_ms terminal_ms wan_bytes local_bytes unique_artifact_bytes storage_provision_bytes';

function refuse(message) { throw new Error(message); }
function integer(value, label, max = Number.MAX_SAFE_INTEGER) {
  if (!Number.isSafeInteger(value) || value < 0 || Object.is(value, -0) || value > max) refuse(`malformed-number: ${label}`);
}
function keys(value, expected, label) {
  if (!value || Array.isArray(value) || typeof value !== 'object') refuse(`malformed-object: ${label}`);
  const names = Object.keys(value).sort(), wanted = expected.split(' ').sort();
  if (names.length !== wanted.length || names.some((name, index) => name !== wanted[index])) refuse(`malformed-fields: ${label}`);
}
function list(value, limit, label, exact = null) {
  if (!Array.isArray(value) || value.length > limit || (exact !== null && value.length !== exact)) refuse(`record-bound: ${label}`);
}
function text(value, label, values) {
  if (typeof value !== 'string' || (values && !values.includes(value))) refuse(`malformed-value: ${label}`);
}
function digest(value, label) { if (typeof value !== 'string' || !/^[0-9a-f]{64}$/.test(value)) refuse(`malformed-digest: ${label}`); }

// Inspect descriptors before any value reads, JSON serialization, or replay.
// Bounds apply to hostile object graphs as well as records decoded from JSON.
function inspectData(root) {
  const seen = new WeakSet();
  let nodes = 0, chars = 0;
  function visit(value, depth) {
    if (++nodes > 1500000 || depth > 12) refuse('record-bound: object graph');
    if (value === null || typeof value === 'boolean') return;
    if (typeof value === 'number') { integer(value, 'record'); return; }
    if (typeof value === 'string') {
      chars += value.length;
      if (value.length > 256 || chars > RECORD_BYTES) refuse('record-bound: text');
      return;
    }
    if (typeof value !== 'object' || seen.has(value)) refuse('malformed-data: cycle or non-JSON value');
    seen.add(value);
    const array = Array.isArray(value), proto = Object.getPrototypeOf(value);
    if (array ? proto !== Array.prototype : proto !== Object.prototype && proto !== null) refuse('malformed-data: inherited fields');
    if (array && value.length > MAX_ENTRIES) refuse('record-bound: array length');
    const names = Reflect.ownKeys(value);
    if (names.length > MAX_ENTRIES + 1 || (!array && names.length > 32)) refuse('record-bound: fields');
    if (array && names.length !== value.length + 1) refuse('malformed-array: sparse or extra fields');
    for (const name of names) {
      if (typeof name !== 'string') refuse('malformed-data: symbol key');
      if (array && name === 'length') continue;
      if (array && (!/^(0|[1-9]\d*)$/.test(name) || Number(name) >= value.length)) refuse('malformed-array: extra field');
      const descriptor = Object.getOwnPropertyDescriptor(value, name);
      if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) refuse('malformed-data: accessor or hidden field');
      visit(descriptor.value, depth + 1);
    }
    seen.delete(value);
  }
  visit(root, 0);
}

function inspectRecord(record) {
  inspectData(record);
  keys(record, 'schema policy_version input input_digest policy universe boundaries resources tasks inventory outcomes metrics record_digest', 'record');
  if (record.schema !== DELIVERY_RECORD_SCHEMA) refuse('unsupported-schema: record');
  if (record.policy_version !== DELIVERY_POLICY_VERSION) refuse('unsupported-version: policy');
  text(record.policy, 'policy', ['repeated', 'cold']);
  digest(record.input_digest, 'input_digest'); digest(record.record_digest, 'record_digest');
  const input = normalizeDeliveryInput(record.input);
  if (canonicalDelivery(input) !== canonicalDelivery(record.input)) refuse('noncanonical-input: request order');
  const count = input.H_ms / input.quantum_ms + 1;
  list(record.boundaries, 9601, 'boundaries', count);
  list(record.resources, 19202, 'resources', count * 2);
  list(record.universe, 8, 'universe'); list(record.tasks, 64, 'tasks');
  list(record.inventory, 1, 'inventory'); list(record.outcomes, 4, 'outcomes', input.requests.length);
  let entries = record.boundaries.length + record.resources.length + record.tasks.length + record.inventory.length;
  for (const row of record.universe) {
    keys(row, 'id resource owner_kind request_id', 'universe');
    text(row.id, 'transfer ID'); text(row.resource, 'resource', ['wan', 'local']);
    text(row.owner_kind, 'owner', ['request', 'depot_cache']);
    if (row.request_id !== null) text(row.request_id, 'request ID');
  }
  for (const row of record.boundaries) {
    keys(row, 't_ms arrivals source_available', 'boundary'); integer(row.t_ms, 'boundary', input.H_ms);
    list(row.arrivals, 4, 'arrivals'); row.arrivals.forEach(id => text(id, 'arrival ID'));
    if (typeof row.source_available !== 'boolean') refuse('malformed-value: source availability');
  }
  for (const row of record.resources) {
    keys(row, 't_ms resource cursor_in cursor_out budget_bytes unused_bytes eligible', 'resource');
    integer(row.t_ms, 'resource boundary', input.H_ms); text(row.resource, 'resource', ['wan', 'local']);
    text(row.cursor_in, 'cursor_in'); text(row.cursor_out, 'cursor_out');
    integer(row.budget_bytes, 'budget'); integer(row.unused_bytes, 'unused'); list(row.eligible, 4, 'eligible');
    entries += row.eligible.length;
    for (const flow of row.eligible) {
      keys(flow, 'id remaining_bytes cap_bytes grant_bytes', 'eligible transfer'); text(flow.id, 'transfer ID');
      for (const field of ['remaining_bytes', 'cap_bytes', 'grant_bytes']) integer(flow[field], field);
    }
  }
  for (const row of record.tasks) {
    keys(row, 't_ms phase owner_kind request_id type', 'task'); integer(row.t_ms, 'task time', input.H_ms);
    integer(row.phase, 'phase', 5); text(row.owner_kind, 'task owner', ['request', 'depot_cache']);
    if (row.request_id !== null) text(row.request_id, 'task request'); text(row.type, 'task type', TYPES);
  }
  for (const row of record.inventory) {
    keys(row, 't_ms type artifact_id', 'inventory'); integer(row.t_ms, 'inventory time', input.H_ms);
    text(row.type, 'inventory type', ['commit']); text(row.artifact_id, 'artifact ID');
  }
  for (const row of record.outcomes) {
    keys(row, OUTCOME_KEYS, 'outcome'); text(row.id, 'outcome ID');
    for (const name of OUTCOME_KEYS.split(' ').slice(1)) {
      if (row[name] === null && !['deadline_ms', 'wan_bytes', 'local_bytes'].includes(name)) continue;
      integer(row[name], name, name.endsWith('_ms') ? input.H_ms : Number.MAX_SAFE_INTEGER);
    }
  }
  keys(record.metrics, METRIC_KEYS, 'metrics');
  for (const name of METRIC_KEYS.split(' ')) {
    if (name === 'all_ready_ms' && record.metrics[name] === null) continue;
    integer(record.metrics[name], name);
  }
  if (entries > MAX_ENTRIES) refuse('record-bound: entries');
  if (new TextEncoder().encode(JSON.stringify(record)).byteLength > RECORD_BYTES) refuse('record-bound: serialized bytes');
  return input;
}

function equal(actual, expected, label) {
  if (canonicalDelivery(actual) !== canonicalDelivery(expected)) refuse(`mismatch-${label}`);
}

// This water-filling replay is private to the verifier. It shares no runnable
// allocator or eligibility code with the producer.
function verifyAllocation(ids, cursor, budget, flows) {
  const awards = flows.map(() => 0), ceilings = flows.map(flow => Math.min(flow.remaining_bytes, flow.cap_bytes));
  let balance = budget, next = ids.indexOf(cursor);
  while (balance > 0) {
    const live = [];
    for (let i = 0; i < flows.length; i++) if (awards[i] < ceilings[i]) live.push(i);
    if (!live.length) break;
    const share = Math.floor(balance / live.length);
    if (share > 0) {
      const increments = live.map(i => Math.min(share, ceilings[i] - awards[i]));
      live.forEach((i, j) => { awards[i] += increments[j]; balance -= increments[j]; });
    } else {
      let selected = -1;
      for (let offset = 0; offset < ids.length; offset++) {
        const candidate = (next + offset) % ids.length;
        const index = flows.findIndex(flow => flow.id === ids[candidate]);
        if (live.includes(index)) { selected = index; next = (candidate + 1) % ids.length; break; }
      }
      if (selected < 0) refuse('replay-error: residual selection');
      awards[selected] += 1; balance -= 1;
    }
  }
  return { awards, unused: balance, cursor: ids[next] };
}

function replay(record, input) {
  const size = input.artifact.size_bytes, quantum = input.quantum_ms, horizon = input.H_ms;
  const repeated = record.policy === 'repeated';
  const states = input.requests.map(request => ({ request, arrived: false, wan: 0, local: 0, activationCompleted: null,
    outcome: { id: request.id, arrival_applied_ms: null, wan_completed_ms: null, local_completed_ms: null,
      check_started_ms: null, check_completed_ms: null, activation_started_ms: null, ready_ms: null,
      failed_ms: null, deadline_ms: request.deadline_ms, wan_bytes: 0, local_bytes: 0 } }));
  const universe = states.flatMap(state => [{ id: `loc-${state.request.id}`, resource: 'local', owner_kind: 'request', request_id: state.request.id },
    ...(repeated ? [{ id: `wan-${state.request.id}`, resource: 'wan', owner_kind: 'request', request_id: state.request.id }] : [])]);
  if (!repeated) universe.push({ id: 'depot-fetch', resource: 'wan', owner_kind: 'depot_cache', request_id: null });
  universe.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  equal(record.universe, universe, 'universe-owner');
  const ids = { wan: universe.filter(flow => flow.resource === 'wan').map(flow => flow.id), local: universe.filter(flow => flow.resource === 'local').map(flow => flow.id) };
  const cursors = { wan: ids.wan[0], local: ids.local[0] }, tasks = [], inventory = [];
  let depotBytes = 0, depotComplete = null, wanTotal = 0, localTotal = 0;
  const rounded = ms => Math.ceil(ms / quantum) * quantum;
  function event(t_ms, phase, type, state = null) {
    tasks.push({ t_ms, phase, owner_kind: state ? 'request' : 'depot_cache', request_id: state ? state.request.id : null, type });
  }
  for (let t = 0, boundaryIndex = 0; t <= horizon; t += quantum, boundaryIndex++) {
    if (!repeated && depotBytes === size && depotComplete === null) {
      depotComplete = t; event(t, 1, 'wan_received'); inventory.push({ t_ms: t, type: 'commit', artifact_id: input.artifact.id });
    }
    const arrivals = [];
    for (const state of states) {
      const result = state.outcome, request = state.request;
      if (repeated && state.wan === size && result.wan_completed_ms === null) { result.wan_completed_ms = t; event(t, 1, 'wan_received', state); }
      if (state.local === size && result.local_completed_ms === null) { result.local_completed_ms = t; event(t, 1, 'local_received', state); }
      if (result.check_started_ms !== null && result.check_completed_ms === null && t === result.check_started_ms + rounded(request.check_ms)) {
        result.check_completed_ms = t;
        if (request.check_outcome === 'fail') { result.failed_ms = t; event(t, 1, 'check_failed', state); }
        else event(t, 1, 'check_passed', state);
      }
      if (result.activation_started_ms !== null && state.activationCompleted === null && t === result.activation_started_ms + rounded(request.activation_ms)) {
        state.activationCompleted = t; event(t, 1, 'activation_completed', state);
      }
      if (!state.arrived && request.arrival_ms <= t) { state.arrived = true; result.arrival_applied_ms = t; arrivals.push(request.id); }
      if (result.local_completed_ms !== null && result.check_started_ms === null && request.check_ms === 0) {
        result.check_started_ms = t; result.check_completed_ms = t; event(t, 3, 'check_started', state);
        if (request.check_outcome === 'fail') { result.failed_ms = t; event(t, 3, 'check_failed', state); }
        else event(t, 3, 'check_passed', state);
      }
      if (result.check_completed_ms !== null && result.failed_ms === null && result.activation_started_ms === null && request.activation_ms === 0) {
        result.activation_started_ms = t; state.activationCompleted = t;
        event(t, 3, 'activation_started', state); event(t, 3, 'activation_completed', state);
      }
      if (state.activationCompleted !== null && result.ready_ms === null) { result.ready_ms = t; event(t, 4, 'ready', state); }
      if (t < horizon) {
        if (result.local_completed_ms !== null && result.check_started_ms === null && request.check_ms > 0) { result.check_started_ms = t; event(t, 5, 'check_started', state); }
        if (result.check_completed_ms !== null && result.failed_ms === null && result.activation_started_ms === null && request.activation_ms > 0) { result.activation_started_ms = t; event(t, 5, 'activation_started', state); }
      }
    }
    equal(record.boundaries[boundaryIndex], { t_ms: t, arrivals, source_available: input.artifact.available_at_ms <= t }, `boundary-${t}`);
    // Freeze both eligibility sets before either resource's grant is applied.
    const pending = [];
    for (const resource of ['wan', 'local']) {
      const setting = input.resources[resource], capacity = t < horizon ? setting.aggregate_Bps * quantum / 1000 : 0;
      const flows = [], owners = [];
      if (t < horizon) {
        if (resource === 'wan' && !repeated && depotComplete === null && input.artifact.available_at_ms <= t && states.some(state => state.arrived)) {
          flows.push({ id: 'depot-fetch', remaining_bytes: size - depotBytes, cap_bytes: setting.transfer_cap_Bps * quantum / 1000 }); owners.push(null);
        } else {
          for (const state of states) {
            const eligible = resource === 'wan'
              ? repeated && state.arrived && input.artifact.available_at_ms <= t && state.outcome.wan_completed_ms === null
              : state.arrived && state.outcome.local_completed_ms === null && (repeated ? state.outcome.wan_completed_ms !== null : depotComplete !== null);
            if (!eligible) continue;
            flows.push({ id: `${resource === 'wan' ? 'wan' : 'loc'}-${state.request.id}`, remaining_bytes: size - state[resource], cap_bytes: setting.transfer_cap_Bps * quantum / 1000 }); owners.push(state);
          }
        }
      }
      const actual = record.resources[boundaryIndex * 2 + (resource === 'wan' ? 0 : 1)], location = `${resource}-${t}`;
      if (actual.t_ms !== t || actual.resource !== resource) refuse(`mismatch-resource-order-${location}`);
      if (actual.cursor_in !== cursors[resource]) refuse(`mismatch-cursor-in-${location}`);
      if (actual.budget_bytes !== capacity) refuse(`mismatch-budget-${location}`);
      const eligibleRows = [...actual.eligible].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
      equal(eligibleRows.map(flow => flow.id), flows.map(flow => flow.id), `eligibility-${location}`);
      const expected = verifyAllocation(ids[resource], cursors[resource], capacity, flows);
      for (let index = 0; index < flows.length; index++) {
        const declared = eligibleRows[index], flow = flows[index];
        if (declared.remaining_bytes !== flow.remaining_bytes) refuse(`mismatch-remaining-${location}-${flow.id}`);
        if (declared.cap_bytes !== flow.cap_bytes) refuse(`mismatch-cap-${location}-${flow.id}`);
        if (declared.grant_bytes !== expected.awards[index]) refuse(`mismatch-grant-${location}-${flow.id}`);
        pending.push({ resource, state: owners[index], bytes: expected.awards[index] });
      }
      if (actual.cursor_out !== expected.cursor) refuse(`mismatch-cursor-out-${location}`);
      if (actual.unused_bytes !== expected.unused) refuse(`mismatch-unused-${location}`);
      cursors[resource] = expected.cursor;
    }
    for (const grant of pending) {
      if (grant.state) grant.state[grant.resource] += grant.bytes; else depotBytes += grant.bytes;
      if (grant.resource === 'wan') wanTotal += grant.bytes; else localTotal += grant.bytes;
    }
  }
  const ownerKey = row => row.owner_kind === 'depot_cache' ? '' : row.request_id;
  tasks.sort((a, b) => a.t_ms - b.t_ms || a.phase - b.phase || (ownerKey(a) < ownerKey(b) ? -1 : ownerKey(a) > ownerKey(b) ? 1 : 0) || TYPES.indexOf(a.type) - TYPES.indexOf(b.type));
  equal(record.tasks, tasks, 'tasks-transition-order'); equal(record.inventory, inventory, 'inventory');
  const outcomes = states.map(state => ({ ...state.outcome, wan_bytes: state.wan, local_bytes: state.local }));
  equal(record.outcomes, outcomes, 'outcomes');
  const ready = outcomes.filter(result => result.ready_ms !== null), terminal = outcomes.map(result => result.ready_ms ?? result.failed_ms);
  const metrics = { request_count: states.length, on_time_count: ready.filter(result => result.ready_ms <= result.deadline_ms).length,
    all_ready_ms: ready.length === states.length ? Math.max(...ready.map(result => result.ready_ms)) : null,
    terminal_ms: terminal.every(time => time !== null) ? Math.max(...terminal) : horizon,
    wan_bytes: wanTotal, local_bytes: localTotal, unique_artifact_bytes: size, storage_provision_bytes: repeated ? states.length * size : size };
  equal(record.metrics, metrics, 'metrics');
  return metrics;
}

export function verifyDelivery(record) {
  try {
    const input = inspectRecord(record), metrics = replay(record, input);
    const inputDigest = deliveryDigest(input);
    if (record.input_digest !== inputDigest) refuse('mismatch-input-digest');
    const { record_digest: statedDigest, ...body } = record;
    const recordDigest = deliveryDigest(body);
    if (statedDigest !== recordDigest) refuse('mismatch-record-digest');
    return { ok: true, errors: [], metrics, record_digest: recordDigest, input_digest: inputDigest };
  } catch (error) {
    return { ok: false, errors: [error instanceof Error ? error.message : 'malformed-record'], metrics: null, record_digest: null, input_digest: null };
  }
}
