import { CityMap } from './city-map.mjs';
import { Replay } from './replay.mjs';
import { mountStudies } from './power-study.mjs';
import { mountVehicleConcepts } from './vehicle-concepts.mjs';
import { mountQualification } from './qualification.mjs';
import { mountModelLessons } from './model-lessons.mjs';
import { renderStoppedStudy } from './study-status.mjs';
import { mountQualificationProgress } from './qualification-progress.mjs';
import { cityView, formatMetric as fmt, safeDataPath, validateCatalog, completionContext, comparisonRows, pairLesson, inspectRepeat, requestGate, violationLabel } from './view-model.mjs';
const $ = id => document.getElementById(id);
let catalog, roads, geometry, comparison, map, replay, mask = 'support', currentView = 'welcome', atlasVersion = 'recorded', studies;
const notices = $('load-state');
const atlasGate = requestGate();
const modelTitle = ['Which constraint\nsets the pace?', 'Explore charging bottlenecks and direction choices in small, explicit teaching models. These are separate from the recorded SF fleet studies.'];
const titles = { welcome: ['Better questions.\nBetter fleet decisions.', 'A simulation notebook for curious builders and operators.\nExplore San Francisco, compare recorded depot experiments, and follow the evidence.'], atlas: ['A city’s worth\nof possibilities.', 'Explore the roads behind a recorded fleet experiment.\nFollow the result all the way to a single vehicle.'], compare: ['One question.\nEvery result.', 'Choose a recorded depot study and inspect its frozen results.\nKeep the trade-offs, uncertainty and gaps in view.'], replay: ['Every trip. Every wait.\nThe whole working day.', 'See how depot choices change a vehicle’s shift.\nFollow the service, the queues and the energy behind the result.'], limits: ['Context is part\nof the result.', 'Inspect the source, assumptions and qualification gaps.\nA clear boundary makes the experiment more useful.'] };
function element(tag, text, className) { const e = document.createElement(tag); if (text !== undefined) e.textContent = text; if (className) e.className = className; return e; }
titles.models = modelTitle;
function notice(text, error = false) { notices.textContent = text; notices.hidden = !text; notices.setAttribute('role', error ? 'alert' : 'status'); }
function show(view, focus = true) {
  view = cityView(view);
  currentView = view; replay?.pause();
  document.body.dataset.view = view;
  for (const e of document.querySelectorAll('.view')) e.hidden = e.id !== `${view}-view`;
  for (const b of document.querySelectorAll('.tabs button')) { if (b.dataset.view === view) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); }
  $('page-title').replaceChildren(...titles[view][0].split('\n').flatMap((line, i) => i ? [element('br'), document.createTextNode(line)] : [document.createTextNode(line)]));
  $('page-description').textContent = titles[view][1];
  if (focus) { $('page-title').focus({ preventScroll: true }); $('page-title').scrollIntoView({block:'start',behavior:'instant'}); }
  if (view === 'atlas') map?.resize();
  if (view === 'replay') replay?.show();
  history.replaceState(null, '', `#${view}`);
}
async function readData(path) {
  safeDataPath(path); const expected = catalog.files[path];
  if (!expected) throw new Error('Data file is absent from this snapshot');
  const response = await fetch(new URL(path, location.href), { cache: 'no-cache' });
  if (!response.ok) throw new Error(`Recorded file unavailable (${response.status})`);
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength !== expected.bytes || bytes.byteLength > 26 * 1024 * 1024) throw new Error('Recorded file size mismatch');
  const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(x => x.toString(16).padStart(2, '0')).join('');
  if (hash !== expected.sha256) throw new Error('Recorded file digest mismatch');
  return JSON.parse(new TextDecoder().decode(bytes));
}
function factList(target, facts) {
  target.replaceChildren();
  for (const [name, value] of facts) { const row = element('div'); row.append(element('dt', name), element('dd', value)); target.append(row); }
}
function summary() {
  const c = catalog.coverage;
  $('road-count').textContent = fmt(c.candidate_count, 0);
  $('snapshot-date').textContent = `OSM snapshot · ${catalog.source.osm_base?.slice(0, 10) ?? 'Date unavailable'}`;
  factList($('coverage-list'), [['Supported', fmt(c.dispositions.included, 0)], ['Excluded, with reason', fmt(c.dispositions.excluded, 0)], ['Unsupported', fmt(c.dispositions.unsupported, 0)], ['Accounted for', c.accounting_complete ? '100% of source IDs' : 'Incomplete']]);
  $('coverage-summary').textContent = `${fmt(100 * c.unsupported_fraction, 2)}% of eligible road length is unsupported. Some road classes exceed the 5% limit, and district coverage has gaps.`;
  factList($('source-facts'), [['OSM date', catalog.source.osm_base?.slice(0, 10) ?? 'Unavailable'], ['Municipal boundary', 'OSM relation 111968'], ['District layer', 'DataSF · 2022'], ['Licenses', 'ODbL 1.0 / CC0 1.0'], ['Source accounting', c.accounting_complete ? 'Complete for snapshot' : 'Incomplete'], ['Pack identity', catalog.pack_digest.slice(0, 16) + '…']]);
  const table = element('table'); const head = element('thead'); const hr = element('tr');
  for (const name of ['Check', 'Status', 'Interpretation']) hr.append(element('th', name)); head.append(hr); table.append(head);
  const body = element('tbody');
  const rows = [['Source-ID accounting', c.accounting_complete ? 'PASS' : 'FAIL', `${fmt(c.candidate_count)} captured records`], ['Overall unsupported length', c.unsupported_fraction <= .02 ? 'PASS' : 'FAIL', `${fmt(c.unsupported_fraction * 100, 3)}% / 2% limit`], ['Road-class support', 'FAIL', 'Primary, trunk and living-street classes exceed 5%'], ['Official district coverage', c.district_coverage_available ? 'PASS' : 'INCOMPLETE', 'Municipal roads outside trimmed district polygons remain UNASSIGNED'], ['Coordinate round trip', c.coordinate_roundtrip.pass ? 'PASS' : 'FAIL', 'Transformation check only; not source positional accuracy'], ['Source sample', 'AUTOMATED', '200 stratified source-ID checks; human semantic review remains open'], ['Semantic map inspection', 'NOT_RUN', 'Independent inspection is still required'], ['Formative participant study', 'NOT_RUN', 'Technical device checks are separate from participant evidence'], ['Operational authority', 'NONE', 'Public learning study; no authority to deploy vehicles or policies']];
  for (const row of rows) { const tr = element('tr'); row.forEach(t => tr.append(element('td', t))); body.append(tr); }
  table.append(body); $('qualification-ledger').replaceChildren(table);
  for (const seed of catalog.seeds) { const o = element('option', `Repeat ${String(catalog.seeds.indexOf(seed)+1).padStart(2,'0')} · seed ${seed}`); o.value = seed; $('seed-select').append(o); }
  for (const v of catalog.vehicles) { const o = element('option', v.id); o.value = v.id; $('vehicle-select').append(o); }
}
function displayComparison() {
  const statuses = { INCOMPLETE: 'City recommendation withheld', INVALID: 'Invalid run — inspect diagnostics', INCOMPATIBLE: 'These runs are incompatible', SUPPORTED_WITHIN_MODEL: 'Supported within this model', NO_SUPPORTED_IMPROVEMENT: 'No supported improvement', INCONCLUSIVE: 'The result is inconclusive', GUARDRAIL_HARMED: 'A guardrail shows harm', GUARDRAIL_INCONCLUSIVE: 'A guardrail is inconclusive', ZONE_HARM_VETO: 'A zone outcome blocks support', INSUFFICIENT_ZONE_DATA: 'More zone evidence is needed' };
  $('outcome').textContent = statuses[comparison.outcome] ?? comparison.outcome;
  $('outcome-reason').textContent = comparison.reason;
  const practical = completionContext(comparison);
  const metrics = [['Completion change', practical.primary, 'percentage points'], ['Empty distance / completed trip', comparison.empty_change_percent, '% relative change'], ['Boarded wait p90', comparison.wait_p90_delta_s, 'seconds']];
  $('result-metrics').replaceChildren();
  for (const [label, value, unit] of metrics) { const card = element('article', undefined, 'metric-tile'); card.append(element('h4', label), element('strong', value ? `${value.mean > 0 ? '+' : ''}${fmt(value.mean, 2)}` : 'Not available'), element('p', unit)); if(label==='Completion change')card.append(element('p',practical.headline,'practical-headline')); card.append(element('p', value ? `95% paired interval: ${fmt(value.low, 2)} to ${fmt(value.high, 2)}. Diagnostic; map qualification is incomplete.` : 'Population or comparison is unavailable.')); if(label==='Completion change')card.append(element('p',practical.text,'practical-context')); $('result-metrics').append(card); }
  $('sensitivity-rows').replaceChildren();
  for (const c of catalog.sensitivities ?? []) {
    const row = element('tr');
    for (const value of [c.name.replaceAll('-', ' '), `${c.baseline.completed} / ${c.baseline.created}`, `${c.candidate.completed} / ${c.candidate.created}`, c.valid ? 'Internally consistent' : 'Invalid', violationLabel(c)]) row.append(element('td', value));
    $('sensitivity-rows').append(row);
  }
  $('pair-rows').replaceChildren();
  for (const p of comparisonRows(comparison)) {
    const row = element('tr'); const delta = 100 * (p.candidate.completion_fraction - p.baseline.completion_fraction);
    for (const value of [`${String(catalog.seeds.indexOf(p.seed)+1).padStart(2,'0')} / ${p.seed}`, `${p.baseline.completed} / ${p.baseline.created}`, `${p.candidate.completed} / ${p.candidate.created}`, `${delta >= 0 ? '+' : ''}${fmt(delta, 2)} pp`]) row.append(element('td', value));
    const lesson = element('td', pairLesson(p), 'pair-lesson'); row.append(lesson);
    const cell = element('td'); const button = element('button', 'Inspect pair ↗'); button.addEventListener('click', () => { studies.choose('legacy'); inspectRepeat(p.seed, { select: seed => { $('seed-select').value = seed; }, load: () => replay.load(), show: () => { show('replay', false); replay.revealSelection(); } }); }); cell.append(button); row.append(cell); $('pair-rows').append(row);
  }
}
async function changeMask(next) {
  const ticket = atlasGate.issue();
  $('map-version-note').textContent = atlasVersion==='temporal'?'Viewing the time-aware candidate. This atlas does not evaluate live access. Notebook and replay remain on SF v1.':atlasVersion==='candidate'?'Viewing SF v2 candidate map only. Notebook and replay remain on SF v1.':'Viewing the recorded SF v1 map. Candidate changes are not applied to recorded results.';
  try {
    if (atlasVersion !== 'recorded') { map.setMask(next); mask = next; for (const b of document.querySelectorAll('[data-mask]')) b.setAttribute('aria-pressed', String(b.dataset.mask === next)); return; }
    if (next === 'source' && !roads.fullSource) { const loaded = await readData('data/source-roads.geo.json'); if(!atlasGate.current(ticket))return; roads=loaded; roads.fullSource = true; map.setRoads(roads); }
    mask = next; map.setMask(next); map.setScenario(next === 'scenario' ? catalog.scenario_points : []);
    for (const b of document.querySelectorAll('[data-mask]')) b.setAttribute('aria-pressed', String(b.dataset.mask === next));
  } catch (error) { if(atlasGate.current(ticket))notice(`${error.message}. The requested layer is unavailable.`, true); }
}
document.querySelector('.brand').addEventListener('click', () => show('welcome'));
window.addEventListener('hashchange', () => {
  const view = cityView(location.hash.slice(1));
  if (view !== currentView) show(view, false);
});
for (const button of document.querySelectorAll('button[data-view]')) button.addEventListener('click', () => show(button.dataset.view));
$('coverage-details').addEventListener('click', () => show('limits'));
for (const b of document.querySelectorAll('[data-mask]')) b.addEventListener('click', () => changeMask(b.dataset.mask));
$('fit-map').onclick=()=>map?.fit();
$('flat-toggle').onclick=()=>{map?.useFlat();$('flat-toggle').textContent='Flat map active';};
$('atlas-arm').onchange=()=>map?.setSites(catalog.sites.filter(s=>$('atlas-arm').value==='candidate'||s.id==='A'));
$('export-spec').addEventListener('click', async () => { try { const selected=catalog.studies?.find(s=>s.id===$('study-select').value); const data = await readData(selected?.protocol_file??'data/scenario.json'); const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })); const a = element('a'); a.href = url; a.download = 'fleetlab-sf-depots-v1.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); } catch (e) { notice(e.message, true); } });
mountVehicleConcepts($('vehicle-concepts'));
show(cityView(location.hash.slice(1)), false);
try {
  const response = await fetch('./data/catalog.json', { cache: 'no-cache' });
  if (!response.ok) throw new Error('City catalogue is unavailable');
  catalog = validateCatalog(await response.json()); summary();
  [roads, geometry, comparison] = await Promise.all([readData('data/routing-roads.geo.json'), readData('data/geometry.json'), readData('data/comparison.json')]);
  displayComparison();
  map = new CityMap($('map'),roads,geometry,{flat:new URLSearchParams(location.search).get('renderer')==='flat',onInspect:t=>$('map-hint').textContent=t});
  map.setSites(catalog.sites);
  replay = new Replay({catalog,roads,geometry,comparison,readData,notice,isVisible:()=>currentView==='replay'});
  studies = mountStudies({catalog,readData,replay,show,notice});
  if(!catalog.temporal_candidate)readData('data/sf-review-envelope.json').then(data=>mountQualificationProgress($('qualification-progress'),data)).catch(error=>{
    $('qualification-progress').textContent=`SF review status unavailable: ${error.message}`;
  });
  if(catalog.power_status_file)readData(catalog.power_status_file).then(data=>renderStoppedStudy($('stopped-study'),data)).catch(error=>{
    $('stopped-study').hidden=false;$('stopped-study').textContent=`Stopped-study status unavailable: ${error.message}`;
  });
  readData('data/model-lessons.json').then(data=>mountModelLessons($('model-lessons'),data)).catch(error=>{
    $('model-lessons').replaceChildren(element('p',`Model lessons unavailable: ${error.message}`,'notice'));
  });
  mountQualification({readData,notice,atlasGate,temporalSelection:catalog.temporal_candidate,setVersion:(version,nextRoads,coverage)=>{
    atlasVersion=version; if(version==='recorded')roads=nextRoads; map.setRoads(nextRoads); map.setMask('support'); mask='support';
    map.setRoutes({type:'FeatureCollection',features:[]}); map.setScenario([]);
    map.setSites(version!=='recorded'?[]:catalog.sites.filter(s=>$('atlas-arm').value==='candidate'||s.id==='A'));
    $('atlas-arm').disabled=version!=='recorded';
    for(const b of document.querySelectorAll('[data-mask]')) {b.disabled=version!=='recorded'&&b.dataset.mask==='scenario';b.setAttribute('aria-pressed',String(b.dataset.mask==='support'));}
    $('atlas-pack-name').textContent=version==='temporal'?'TIME-AWARE CANDIDATE / SF V3':version==='candidate'?'CANDIDATE MAP / SF V2':'RECORDED CITY PACK / SF V1';
    const c=coverage??catalog.coverage;
    factList($('coverage-list'),[['Supported',fmt(c.dispositions.included,0)],['Excluded, with reason',fmt(c.dispositions.excluded,0)],['Unsupported',fmt(c.dispositions.unsupported,0)],['Accounted for','100% of source IDs']]);
    $('coverage-summary').textContent=version==='temporal'?`${fmt(c.unsupported_fraction*100,2)}% unsupported. All road classes meet the 5% source budget. District scope and independent review remain open.`:version==='candidate'?`${fmt(c.unsupported_fraction*100,2)}% unsupported. Trunk and living-street classes still exceed 5%. District and semantic review remain open.`:`${fmt(c.unsupported_fraction*100,2)}% unsupported. Primary, trunk and living-street classes exceed 5%. District review remains open.`;
    $('map-hint').textContent=version==='temporal'?'Time-aware source network. Click a road to inspect its source classification. Green does not mean access is permitted at every time.':version==='candidate'?'Candidate map only. Click a road to inspect its current classification.':'Recorded SF v1 map. Fictional depot markers reflect the selected configuration.';
  },showGap:gap=>{
    const lines=gap.geometry.type==='MultiLineString'?gap.geometry.coordinates:[gap.geometry.coordinates];
    map.setRoutes({type:'FeatureCollection',features:lines.map(coordinates=>({type:'Feature',geometry:{type:'LineString',coordinates},properties:{purpose:'returning'}}))});map.fitRoute();$('map-hint').textContent=`Amber overlay: ${gap.name}, ${gap.gap_length_m.toFixed(1)} m outside the official district polygons. UNASSIGNED. The same retained geography applies to all map versions.`;
    $('map').scrollIntoView({block:'center',behavior:'instant'});
  }}).catch(e=>{$('candidate-intro').textContent='Candidate qualification data unavailable. Recorded experiment remains inspectable.';notice(e.message,true);});
  notice('Simulation study: source accounting is complete; routing and district qualification remain open. Results are diagnostic, with no city recommendation.');
  show(cityView(location.hash.slice(1)), false);
} catch (error) { notice(`${error.message}. This snapshot could not be loaded safely.`, true); $('map').replaceChildren(element('p', 'The selected city data is unavailable. No alternate city or snapshot has been substituted.', 'fatal')); }
