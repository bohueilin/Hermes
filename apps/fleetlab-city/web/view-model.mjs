export function formatMetric(value, digits = 1) {
  return typeof value === 'number' && Number.isFinite(value)
    ? new Intl.NumberFormat('en-US', { maximumFractionDigits: digits }).format(value)
    : 'Not available';
}
export function safeDataPath(path) {
  if (typeof path !== 'string' || !/^data\/[a-zA-Z0-9_-]+(?:\.geo)?\.json$/.test(path)) {
    throw new Error('Unsupported data path');
  }
  return path;
}
export function sampleAt(samples, time, interval = 15) {
  let lo = 0, hi = samples.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (samples[mid][0] <= time) lo = mid + 1; else hi = mid; }
  const sample = samples[lo - 1];
  if (!sample) return { status: 'unavailable', sample: null };
  if (time - sample[0] > interval || (samples[lo] && samples[lo][0] - sample[0] > interval && time > sample[0])) {
    return { status: 'gap', sample: null };
  }
  return { status: 'recorded', sample };
}
export function validateCatalog(data) {
  if (data?.schema !== 'fleetlab.city-view/1.0.0') throw new Error('Unsupported city viewer schema');
  if (!Number.isInteger(data?.coverage?.candidate_count) || data.coverage.candidate_count < 0) throw new Error('Invalid source inventory');
  if (data.scope !== 'SIMULATION_ONLY' || data.decision_authority !== 'NONE') throw new Error('Unsupported authority declaration');
  if (!Array.isArray(data.vehicles) || !Array.isArray(data.sites) || !data.files) throw new Error('Incomplete city catalogue');
  for (const path of Object.keys(data.files)) safeDataPath(path);
  return data;
}
export function comparisonRows(comparison) {
  if (['INCOMPATIBLE', 'INVALID'].includes(comparison?.eligibility)) return [];
  return comparison?.pairs ?? [];
}
export function clockLabel(seconds) {
  const minute = Math.floor(seconds / 60) + 7 * 60;
  return `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
}

export function requestGate() {
  let revision = 0;
  return { issue: () => ++revision, current: (ticket) => ticket === revision };
}

export const METRES_PER_MILE = 1609.344;
export function durationLabel(seconds) {
  const mins = Math.floor(seconds / 60);
  return `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, '0')}m`;
}
export function resumeTime(time, samples) {
  if (!samples.length) return null;
  return time >= samples.at(-1)[0] ? samples[0][0] : Math.max(time, samples[0][0]);
}
export function estimateRevenue(summary, fares) {
  if (fares.length !== 3 || fares.some(f => String(f).trim() === '' || !Number.isFinite(Number(f)) || Number(f) < 0)) return null;
  const [base, mile, minute] = fares.map(Number);
  const result = summary.completed * base + summary.completed_passenger_m / METRES_PER_MILE * mile + summary.completed_passenger_s / 60 * minute;
  return Number.isFinite(result) ? result : null;
}
export const stateLabels = { idle: 'Available', pickup: 'Driving to pickup', boarding: 'Passenger boarding', passenger: 'Passenger on board', returning: 'Returning to depot', queue_turnaround: 'Waiting for turnaround', turnaround: 'Generic turnaround', queue_charge: 'Waiting for a charging port', charging: 'Charging', stranded: 'Stranded' };
export function eventDescription(e) {
  const site = e.site ? ` · depot ${e.site}` : '';
  if (e.kind === 'state') return (stateLabels[e.after] ?? e.after) + site;
  const names = { initial: 'Shift begins', assigned: 'Pickup assigned', boarded: 'Passenger picked up', completed: 'Passenger dropped off · trip completed', leg_start: `Route started · ${stateLabels[e.purpose] ?? e.purpose}`, leg_end: 'Route arrived', turnaround_start: 'Turnaround starts', turnaround_end: 'Turnaround ends', charge_start: 'Charging starts', charge_end: 'Charging ends', run_end: e.execution === 'INCOMPLETE' ? 'Recording stopped early' : 'Shift ended · no later operation recorded' };
  return (names[e.kind] ?? e.kind.replaceAll('_', ' ')) + site + (e.request ? ` · ${e.request}` : '');
}
export function pairLesson(p) {
  const b = p.baseline, c = p.candidate, trips = c.completed - b.completed;
  const empty = c.empty_km_per_completed - b.empty_km_per_completed;
  const wait = c.wait_p90_s - b.wait_p90_s;
  return `Two depots completed ${Math.abs(trips)} ${trips < 0 ? 'fewer' : trips > 0 ? 'more' : 'additional'} trips, with ${formatMetric(Math.abs(empty) / METRES_PER_MILE * 1000, 2)} ${empty > 0 ? 'more' : 'less'} empty miles per completed trip and a ${formatMetric(Math.abs(wait), 1)}-second ${wait > 0 ? 'longer' : 'shorter'} p90 boarded wait. This is one repeat; use all twelve and the stress cases for the broader trade-off.`;
}

// Issue a new selection even if an older replay is still loading. Navigation alone
// is insufficient because the replay view intentionally avoids duplicate loads.
export function inspectRepeat(seed, { select, load, show }) {
  select(seed);
  load();
  show();
}

export function violationLabel(row) {
  const codes = Object.entries(row.violation_codes ?? {});
  return codes.length ? codes.map(([code,n])=>`${code}: ${n}`).join(' · ') : row.hard_violations ? `${row.hard_violations} hard violations · codes unavailable in this older catalogue` : 'No recorded hard violation';
}
export function recordingSelection(catalog, study, seed, arm, vehicle) {
  if (!study || study === 'legacy') {
    if(!catalog.seeds.includes(seed)||!['baseline','candidate'].includes(arm)) throw new Error('Unknown legacy seed or configuration');
    return {study:'legacy',seed,arm,layout:arm==='baseline'?'A':'AB',sites:catalog.sites.filter(s=>arm==='candidate'||s.id==='A'),fleet_file:`data/fleet-${seed}-${arm}.json`,vehicle_files:{[vehicle]:`data/run-${seed}-${arm}-${vehicle}.json`}};
  }
  const studies=catalog.studies?.filter(s=>s.id===study)??[];
  if(studies.length!==1)throw new Error('Unknown or duplicate selected study identity');
  const selected=studies[0];
  if(!selected.seeds.includes(seed)||!selected.configurations.includes(arm))throw new Error('Unknown study, seed or configuration');
  if(!Number.isInteger(selected.replay_seed)||selected.replay_seed!==selected.seeds[0])throw new Error('Incompatible predetermined replay scope');
  const identities=new Set();
  for(const entry of selected.recordings){
    const identity=`${entry.seed}/${entry.configuration}`;
    if(entry.study!==study||entry.seed!==selected.replay_seed||entry.arm!==entry.configuration||!selected.configurations.includes(entry.configuration))throw new Error('Catalogue recording is incompatible with selected study, configuration or replay scope');
    if(identities.has(identity))throw new Error('Duplicate catalogue recording identity');
    identities.add(identity);
  }
  const record=selected.recordings.find(r=>r.seed===seed&&r.configuration===arm);
  if(seed!==selected.replay_seed||!record||!record.vehicle_files[vehicle])throw new Error(`Replay not exported for seed ${seed}, configuration ${arm}. Summaries remain available; only the predetermined first evaluation seed has replay`);
  return record;
}
export function validateRecording(data, fleet, record, vehicle) {
  if(data.schema!=='fleetlab.city-vehicle-view/1.1.0'||data.seed!==record.seed||data.arm!==record.arm||data.vehicle!==vehicle||data.verification!=='INTERNALLY_CONSISTENT'||!Array.isArray(data.samples)||!data.samples.length||data.samples.length>4000)throw new Error('Selected trace is incompatible or unverified');
  if(fleet.seed!==record.seed||fleet.arm!==record.arm)throw new Error('Selected vehicle inventory is incompatible');
  if(record.study!=='legacy'){
    for(const item of [data,fleet])if(item.study!==record.study||item.configuration!==record.configuration||item.source_run_digest!==record.source_run_digest)throw new Error('Selected study recording identity is incompatible');
    if(JSON.stringify(data.sites)!==JSON.stringify(record.sites)||data.layout!==record.layout||data.total_power_kw!==record.total_power_kw||JSON.stringify(data.energy)!==JSON.stringify(record.energy))throw new Error('Selected configuration resources are incompatible');
  }
}
