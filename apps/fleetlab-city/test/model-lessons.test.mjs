import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createFakeDom, FakeEvent} from '../../../playground/fleetlab/test/helpers/fake-dom.mjs';

const root=fileURLToPath(new URL('../../../',import.meta.url));
const python=process.env.FLEETLAB_PYTHON || `${root}build/fleetlab-city/venv/bin/python`;
const fixture=()=>JSON.parse(execFileSync(existsSync(python)?python:'python3',['-c',
  "import sys,json;sys.path.insert(0,'apps/fleetlab-city');from citylib.model_lessons_v1 import build_model_lessons;print(json.dumps(build_model_lessons()))"],{cwd:root,encoding:'utf8'}));
const moduleUrl=new URL('../web/model-lessons.mjs',import.meta.url);
const api=existsSync(moduleUrl)?await import(moduleUrl):{};
const harness=()=>{const dom=createFakeDom();return {dom,host:dom.document.createElement('div')};};

test('twelve core-generated cases pass presentation validation without changing inputs',()=>{
  assert.equal(typeof api.validateModelLessons,'function');
  const data=fixture(),before=JSON.stringify(data);
  assert.equal(api.validateModelLessons(data),data);
  assert.equal(JSON.stringify(data),before);
});
test('malformed, duplicated, incomplete, unsafe-link and unverified projections fail closed',()=>{
  assert.equal(typeof api.validateModelLessons,'function');
  for(const variant of ['schema','duplicate','missing','number','verification','link','permission']){
    const data=fixture();
    if(variant==='schema')data.schema='other';
    if(variant==='duplicate')data.station_cases[1]=data.station_cases[0];
    if(variant==='missing')data.station_cases.pop();
    if(variant==='number')data.station_cases[0].result.charging_hours=null;
    if(variant==='verification')data.verification='UNVERIFIED';
    if(variant==='link')data.source_references[0].url='javascript:alert(1)';
    if(variant==='permission')data.direction_cases[2].result.options[1].availability='COMPUTED';
    assert.throws(()=>api.validateModelLessons(data),/model lessons/i,variant);
  }
});
test('accessible selectors inspect site-limited and port-limited stored outputs',()=>{
  assert.equal(typeof api.mountModelLessons,'function');
  const {host}=harness();const cleanup=api.mountModelLessons(host,fixture());
  assert.match(host.textContent,/11\.25 kW/);
  const site=host.querySelector('[data-model-site]');
  const acceptance=host.querySelector('[data-model-acceptance]');
  assert.ok(site.getAttribute('aria-label'));assert.ok(acceptance.getAttribute('aria-label'));
  site.value='800';acceptance.value='80';site.dispatchEvent(new FakeEvent('change'));
  assert.match(host.querySelector('[data-model-station-result]').textContent,/45 kW/);
  assert.match(host.querySelector('[data-model-station-result]').textContent,/Port grid limit/);
  assert.match(host.querySelector('[data-model-station-result]').textContent,/28 kWh/);
  cleanup();assert.equal(host.textContent,'');
});
test('direction fixture shows allowed conventional reverse and forbidden bidirectional reverse',()=>{
  const {host}=harness();api.mountModelLessons(host,fixture());
  const select=host.querySelector('[data-model-direction]');
  select.value='reverse-permitted';select.dispatchEvent(new FakeEvent('change'));
  assert.match(host.querySelector('[data-model-direction-result]').textContent,/4 s supplied dwell/);
  select.value='reverse-forbidden';select.dispatchEvent(new FakeEvent('change'));
  assert.match(host.querySelector('[data-model-direction-result]').textContent,/Not available · exit not permitted/);
  assert.doesNotMatch(host.querySelector('[data-model-direction-result]').textContent,/4 s supplied dwell/);
  assert.match(host.textContent,/Body heading stays 90°/);
});
test('unavailable quantities remain unavailable and artifact text is never interpreted as HTML',()=>{
  const {host}=harness(),data=fixture();
  const result=data.station_cases[0].result;
  result.availability='NOT_AVAILABLE';result.missing_fields=['battery_kwh_per_km'];
  result.inputs.battery_kwh_per_km=null;
  for(const key of Object.keys(result))if(typeof result[key]==='number')result[key]=null;
  result.bottlenecks=[];
  data.title='<img src=x onerror=alert(1)>';
  api.mountModelLessons(host,data);
  assert.equal(host.querySelector('img'),null);
  assert.match(host.querySelector('[data-model-station-result]').textContent,/Not available/);
  assert.doesNotMatch(host.querySelector('[data-model-station-result]').textContent,/0 kWh/);
});
test('invalid replacement removes stale computed results',()=>{
  const {host}=harness();api.mountModelLessons(host,fixture());
  assert.throws(()=>api.mountModelLessons(host,{schema:'wrong'}),/model lessons/i);
  assert.equal(host.querySelector('[data-model-station-result]'),null);
  assert.match(host.textContent,/Not available/);
});
for(const [field,value] of [
  ['schema','unsupported'],
  ['availability','NOT_AVAILABLE'],
  ['missing_fields',['vehicle_length_m']],
  ['missing_fields',null],
  ['static_footprint_fits',false],
  ['static_footprint_fits',null],
]){
  test(`direction aggregate ${field}=${JSON.stringify(value)} cannot display permitted exits`,()=>{
    const {host}=harness(),data=fixture();
    api.mountModelLessons(host,data);
    assert.match(host.querySelector('[data-model-direction-result]').textContent,/12 s supplied dwell/);
    data.direction_cases[0].result[field]=value;
    assert.throws(()=>api.mountModelLessons(host,data),/model lessons/i);
    assert.equal(host.querySelector('[data-model-direction-result]'),null);
    assert.doesNotMatch(host.textContent,/supplied dwell/);
    assert.match(host.textContent,/Not available/);
  });
}
