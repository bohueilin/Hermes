/** Local setup interchange only: no result, authentication, persistence or execution authority. */
import {defaultBayAreaConfig, validateBayAreaConfig, BAY_OPERATIONS_VERSION} from '../model/bay-operations.js';
import {canonicalBayJson, freezeBayExperiment} from '../model/bay-experiment-contract.js';
import {bayAreaSourceJSON} from '../model/bay-area.js';
import {defaultReadiness, READINESS_VERSION, READINESS_METRICS_VERSION, REQUIRED_WORK_RULE} from '../model/depot-readiness.js';
import {defaultCharging, CHARGING_VERSION} from '../model/charging-allocation.js';
import {defaultResources, RESOURCES_VERSION} from '../model/resource-observations.js';
import {defaultAirport, AIRPORT_VERSION} from '../model/airport-demand.js';
import {BAY_SYSTEM_METRICS} from '../model/bay-systems.js';
import {createLaunchConfig, validateLaunchConfig} from '../model/launch-rehearsal.js';
import {LAUNCH_VERSION, REGION_VERSION, DEPOT_VERSION, COMMISSIONING_VERSION, LAUNCH_METRICS_VERSION} from '../model/launch-contract.js';
import {defaultStreetConfig} from '../model/street-simulation.js';
import {STREET_NETWORK} from '../model/street-network.js';
import {validateScenario, SCENARIO_VERSION} from '../model/schema.js';
import {MODEL_VERSION, SPEC_FORMAT_VERSION, validateDraft} from '../model/experiment.js';
import {METRICS_VERSION} from '../model/metrics.js';
import {PRESETS, PRESET_SEED_SET, presetById, seedSet} from '../model/presets.js';
import {sha256Hex} from '../core/sha256.js';
import {AUSTIN_REGION,regionReference} from '../model/region-package.js';
import {SITE_POWER_VERSION,SITE_POWER_METRICS} from '../model/site-power.js';

/** Encoded characters, before the route prefix. Large configurations fail explicitly; nothing is truncated. */
export const MAX_SETUP_LENGTH = 32768;
const MAX_SETUP_BYTES = 65536;
const SCHEMA = 'fleetlab-setup-v1';
const MAX_DEPTH = 16;
const MAX_NODES = 12000;
const MAX_ARRAY = 2048;
const MAX_STRING = 400;
const DANGEROUS = new Set(['__proto__', 'prototype', 'constructor']);
const MODELS = ['fleet-day', 'street-lab', 'launch-rehearsal', 'regional', 'regional-power'];
const extensionTemplates = {readiness:defaultReadiness(), charging:defaultCharging(), resources:defaultResources(), airport:defaultAirport()};
const extensionVersions = {readiness:READINESS_VERSION, charging:CHARGING_VERSION, resources:RESOURCES_VERSION, airport:AIRPORT_VERSION, launch:LAUNCH_VERSION};
const launchTemplates = [createLaunchConfig('peninsula'), createLaunchConfig('region_b')];
const privateTextFields = new Set(['label', 'owner', 'timezone']);
const syntheticText = Object.fromEntries([...privateTextFields].map(key => [key, new Set()]));
for (const template of launchTemplates) collectText(template.launch);
let bayMapDigest;

function collectText(value) {
  if (!value || typeof value !== 'object') return;
  for (const [key, item] of Object.entries(value)) {
    if (privateTextFields.has(key)) syntheticText[key].add(item);
    else if (typeof item === 'object') collectText(item);
  }
}
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const fail = message => { throw new RangeError(message); };

/** Detach without invoking getters/toJSON or silently losing undefined, sparse entries, symbols or -0. */
function checkedCopy(value) {
  let nodes = 0;
  function visit(item, depth) {
    if (depth > MAX_DEPTH) fail('Setup nesting depth exceeds the limit.');
    if (++nodes > MAX_NODES) fail('Setup value count exceeds the limit.');
    if (item === null || typeof item === 'boolean') return item;
    if (typeof item === 'string') {
      if (item.length > MAX_STRING) fail('Setup string length exceeds the limit.');
      return item;
    }
    if (typeof item === 'number') {
      if (!Number.isFinite(item) || Object.is(item, -0)) fail('Setup requires finite numbers without negative zero.');
      return item;
    }
    if (!item || typeof item !== 'object' || ![Object.prototype, Array.prototype, null].includes(Object.getPrototypeOf(item))) fail('Setup requires plain JSON data.');
    const array = Array.isArray(item);
    if (!array && Object.getPrototypeOf(item) === Array.prototype) fail('Setup requires plain JSON objects.');
    if (array && item.length > MAX_ARRAY) fail('Setup array size exceeds the limit.');
    const descriptors = Object.getOwnPropertyDescriptors(item), out = array ? [] : {};
    for (const key of Reflect.ownKeys(descriptors)) {
      if (typeof key !== 'string' || DANGEROUS.has(key)) fail('Setup contains a dangerous object key.');
      if (array && key === 'length') continue;
      const d = descriptors[key];
      if (!Object.hasOwn(d, 'value') || !d.enumerable) fail('Setup requires plain data properties; accessors are unsupported.');
      if (array && (!/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= item.length)) fail('Setup arrays cannot carry extra properties.');
      out[key] = visit(d.value, depth + 1);
    }
    if (array && Object.keys(out).length !== item.length) fail('Setup arrays cannot contain missing entries.');
    return out;
  }
  return visit(value, 0);
}

function keys(value, required, optional = [], path = 'setup') {
  if (!object(value)) fail(`${path} must be an object.`);
  for (const key of Object.keys(value)) if (!required.includes(key) && !optional.includes(key)) fail(`Unknown ${path} field: ${key}.`);
  for (const key of required) if (!Object.hasOwn(value, key)) fail(`Missing ${path} field: ${key}.`);
}

/** Shape checking complements producers that intentionally allow optional extension fields or rejected actions. */
function shape(value, template, path) {
  if (Array.isArray(template)) {
    if (!Array.isArray(value)) fail(`${path} must be an array.`);
    value.forEach((item, index) => shape(item, template[0] ?? '', `${path}[${index}]`));
  } else if (object(template)) {
    keys(value, Object.keys(template), [], path);
    for (const key of Object.keys(template)) shape(value[key], template[key], `${path}.${key}`);
  } else if (typeof value !== typeof template || value === null) fail(`Invalid ${path} value type.`);
}

function producerIssues(errors) {
  if (errors.length) fail(`Invalid setup: ${errors.map(e => typeof e === 'string' ? e : e.what).join(' ')}`);
}

function launchPrivacy(value) {
  if (!value || typeof value !== 'object') return;
  for (const [key, item] of Object.entries(value)) {
    if (privateTextFields.has(key) && !syntheticText[key].has(item)) fail(`Custom ${key} text cannot be shared in a link. Use the supplied synthetic text to protect private details.`);
    if (typeof item === 'object') launchPrivacy(item);
  }
}

function validateBay(config, launch, regionalPower=false) {
  const base = defaultBayAreaConfig();
  keys(config, [...Object.keys(base), ...(launch ? ['launch'] : []), ...(regionalPower?['region','site_power_profile','readiness','charging','resources']:[])], Object.keys(extensionTemplates), 'config');
  for (const key of Object.keys(base)) shape(config[key], base[key], `config.${key}`);
  for (const [key, template] of Object.entries(extensionTemplates)) if (Object.hasOwn(config, key)) shape(config[key], template, `config.${key}`);
  if(regionalPower)shape(config.region,regionReference(),'config.region');
  if (launch) {
    shape(config.launch, launchTemplates[0].launch, 'config.launch');
    launchPrivacy(config.launch);
    if (!launchTemplates.some(t => t.launch.region.id === config.launch.region.id)) fail('Custom region identity cannot be shared; choose a supplied synthetic template.');
    const validation = validateLaunchConfig(config);
    producerIssues(validation.checks.filter(c => c.status === 'FAIL').map(c => c.detail));
    // The model keeps malformed mock actions as rejected records; a shared setup requires explicit valid action syntax.
    for (const event of config.launch.events) {
      if (event.version !== COMMISSIONING_VERSION || event.action !== 'commission') fail('Unsupported commissioning version or action.');
      for (const key of ['id','depot_id','resource_id','task_id']) if (!/^[a-zA-Z0-9:_-]{1,100}$/.test(event[key])) fail(`Invalid commissioning ${key}.`);
      if (!Number.isInteger(event.sequence) || event.sequence < 1 || event.sequence > 10000 || !Number.isInteger(event.effective_minute) || event.effective_minute < 0 || event.effective_minute > 2880) fail('Invalid commissioning event sequence or minute.');
    }
  } else producerIssues(validateBayAreaConfig(config));
}

function validateStreet(config) {
  shape(config, defaultStreetConfig(), 'config');
  // Mirrors the current unexported street producer validator. Tests also check recorded producer/network versions.
  const ranges = {fleet_size:[1,60],requests_per_hour:[0,120],background_per_hour:[0,2400],duration_minutes:[10,180],start_hour:[0,23],capacity_loss_pct:[0,95],incident_start_minutes:[0,180],incident_end_minutes:[0,180],boarding_seconds:[10,300],curb_bays:[1,8],turnaround_minutes:[0,30],sfo_share_pct:[0,100],east_bay_share_pct:[0,100],seed:[0,4294967295]};
  for (const [key,[min,max]] of Object.entries(ranges)) if (!Number.isInteger(config[key]) || config[key] < min || config[key] > max) fail(`Invalid Street ${key}.`);
  if (config.sfo_share_pct + config.east_bay_share_pct > 100 || config.incident_end_minutes < config.incident_start_minutes || !['free-flow','queue-aware'].includes(config.policy) || !['clear','rain'].includes(config.weather) || !STREET_NETWORK.hotspots.some(h => h.id === config.hotspot)) fail('Invalid Street scenario settings.');
}

function scenario(value) {
  const validation = validateScenario(value);
  producerIssues(validation.errors);
  if (!PRESETS.some(p => p.scenario.name === value.name)) fail('Custom scenario names cannot be shared in a link.');
}

function validateRegional(config) {
  keys(config, ['scenario','mode','presetId','draft'], [], 'config');
  const preset = presetById(config.presetId);
  if (!['sandbox','learn','experiment'].includes(config.mode) || !preset) fail('Unsupported regional mode or preset.');
  if (config.mode === 'learn' && (!preset.learnCase || !Array.isArray(preset.moments) || !preset.moments.length)) fail('The selected preset has no Learn case.');
  if (config.mode === 'experiment' && config.draft === null) fail('Regional experiments require a complete draft.');
  if (config.mode !== 'experiment' && config.draft !== null) fail('A regional draft requires experiment mode.');
  scenario(config.scenario);
  const d = config.draft;
  if (d === null) return;
  keys(d, ['question','baselineScenario','baselineSource','axis','axisSource','primary','guardrails','seedCount','seedSet','resamples'], [], 'draft');
  if (!PRESETS.some(p => p.experiment?.question === d.question)) fail('Custom experiment question text cannot be shared in a link; use a supplied question.');
  scenario(d.baselineScenario);
  if (d.baselineSource !== null) {
    keys(d.baselineSource, ['presetId'], [], 'baselineSource');
    if (!presetById(d.baselineSource.presetId)) fail('Unsupported baseline source preset.');
  }
  if (![null,'learn','preset','sandbox','user'].includes(d.axisSource)) fail('Unsupported axis source.');
  if (!Number.isInteger(d.seedCount) || d.seedCount < 10 || d.seedCount > 100 || !Number.isInteger(d.seedSet) || d.seedSet < 1 || d.seedSet > 1000000) fail('Invalid regional seed count or set.');
  // Producer validation permits omitted scope/direction for editing. Interchange requires both explicitly;
  // otherwise losing a scoped population can silently turn an experiment into a global comparison.
  keys(d.primary, ['metric','scope','direction'], ['margin_units','margin_text'], 'primary');
  if (!Array.isArray(d.guardrails)) fail('Regional guardrails must be an array.');
  for (const ref of d.guardrails) keys(ref, ['metric','scope','direction'], ['max_harm_units','max_harm_text'], 'guardrail');
  const validation = validateDraft({question:d.question, scenario:d.baselineScenario, axis:d.axis, primary:d.primary, guardrails:d.guardrails, seed_set:d.seedSet, seeds:seedSet(d.seedSet,d.seedCount), resamples:d.resamples});
  producerIssues(validation.errors);
}

function versionsFor(model, config) {
  if (model === 'street-lab') return {producer:'street-lab-v1',network:STREET_NETWORK.version};
  // The app currently runs five sandbox replications. A parity test binds this schema-owned count to its public constant.
  if (model === 'regional') return {producer:MODEL_VERSION,scenario:SCENARIO_VERSION,metrics:METRICS_VERSION,spec:SPEC_FORMAT_VERSION,sandbox_seed_set:PRESET_SEED_SET,sandbox_replications:5};
  if (model === 'regional-power') return {producer:[BAY_OPERATIONS_VERSION,...['readiness','charging','resources'].map(k=>config[k].version),config.region.version,SITE_POWER_VERSION].join('+'),map:AUSTIN_REGION.graph_digest,region_sources:AUSTIN_REGION.provenance.version,
    readiness_metrics:READINESS_METRICS_VERSION,required_work:REQUIRED_WORK_RULE,system_metrics:BAY_SYSTEM_METRICS,site_power_metrics:SITE_POWER_METRICS};
  if (bayMapDigest === undefined) bayMapDigest = sha256Hex(bayAreaSourceJSON());
  const extensions = Object.keys(extensionVersions).filter(key => Object.hasOwn(config, key));
  const versions = {producer:[BAY_OPERATIONS_VERSION,...extensions.map(key => extensionVersions[key])].join('+'),map:bayMapDigest};
  if (config.readiness) Object.assign(versions,{readiness_metrics:READINESS_METRICS_VERSION,required_work:REQUIRED_WORK_RULE});
  if (['charging','resources','airport'].some(key => config[key])) versions.system_metrics = BAY_SYSTEM_METRICS;
  if (model === 'launch-rehearsal') Object.assign(versions,{region:REGION_VERSION,depot:DEPOT_VERSION,commissioning:COMMISSIONING_VERSION,launch_metrics:LAUNCH_METRICS_VERSION});
  return versions;
}

function validateInputs(model, config, options) {
  if (!MODELS.includes(model)) fail('Unsupported setup model.');
  if (!object(options)) fail('Setup options must be an object.');
  if (model === 'fleet-day'||model === 'regional-power') {
    validateBay(config, false, model === 'regional-power');
    if(model==='regional-power'&&options.treatment!=='charging_deadlines')fail('Regional power compares redistribution with deadline charging.');
    if (Object.keys(options).length) {
      keys(options, ['treatment','seeds','tuning_seeds','margin','resamples','null_treatment'], [], 'options');
      freezeBayExperiment(config, options);
    }
  } else if (model === 'launch-rehearsal') {
    validateBay(config, true);
    keys(options, ['delay'], [], 'options');
    if (!Number.isInteger(options.delay) || options.delay < 0 || options.delay > 1440) fail('Commissioning delay must be an integer from 0 to 1440 minutes.');
  } else {
    keys(options, [], [], 'options');
    if (model === 'street-lab') validateStreet(config);
    else validateRegional(config);
  }
}

function setupBytes(envelope) {
  const bytes = new TextEncoder().encode(canonicalBayJson(envelope));
  if (bytes.length > MAX_SETUP_BYTES) fail('Setup exceeds the 64 KiB configuration export size limit.');
  return bytes;
}

function payloadOf(envelope) {
  const bytes = setupBytes(envelope);
  if (Math.ceil(bytes.length * 4 / 3) > MAX_SETUP_LENGTH) fail('Setup exceeds the link size limit; reduce the configuration before sharing.');
  return btoa(Array.from(bytes, value => String.fromCharCode(value)).join('')).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}

function validatedEnvelope(value) {
  const envelope = checkedCopy(value);
  keys(envelope, ['schema','model','versions','config','options']);
  if (envelope.schema !== SCHEMA) fail('Unsupported setup schema version.');
  validateInputs(envelope.model,envelope.config,envelope.options);
  if (canonicalBayJson(envelope.versions) !== canonicalBayJson(versionsFor(envelope.model,envelope.config))) fail('Unsupported setup producer or data versions.');
  return envelope;
}

/** Build from complete effective settings. Versions are producer-derived and cannot be supplied by callers. */
export function createSetup(input) {
  const detached = checkedCopy(input);
  keys(detached, ['model','config'], ['options']);
  const {model,config,options={}} = detached;
  validateInputs(model,config,options);
  const envelope = {schema:SCHEMA,model,versions:versionsFor(model,config),config,options};
  setupBytes(envelope);
  return envelope;
}

export function encodeSetup(envelope) {
  return payloadOf(validatedEnvelope(envelope));
}

/** Only canonical links produced by this codec are accepted; duplicate JSON keys and alternate encodings fail. */
export function decodeSetup(payload) {
  if (typeof payload !== 'string' || payload.length === 0 || payload.length > MAX_SETUP_LENGTH || !/^[A-Za-z0-9_-]+$/.test(payload) || payload.length % 4 === 1) fail('Invalid setup payload or link size limit exceeded.');
  let value;
  try {
    const binary = atob(payload.replace(/-/g,'+').replace(/_/g,'/'));
    const json = new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(binary, character => character.charCodeAt(0)));
    value = JSON.parse(json);
  } catch { fail('Malformed setup JSON or encoding.'); }
  const envelope = validatedEnvelope(value);
  if (payloadOf(envelope) !== payload) fail('Setup payload must use canonical JSON and encoding.');
  return envelope;
}
