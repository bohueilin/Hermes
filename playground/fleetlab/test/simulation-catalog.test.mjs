import assert from 'node:assert/strict';
import {test} from 'node:test';
import { PRESETS } from '../src/model/presets.js';
import { STREET_PRESETS } from '../src/model/street-simulation.js';
import { simulationCatalog, createSimulationCatalog, OPERATIONAL_LESSONS } from '../src/ui/simulation-catalog.js';
import { installFakeDom } from './helpers/fake-dom.mjs';

test('catalog includes every registered regional preset and every operational lesson once',()=>{
  const rows=simulationCatalog();
  assert.equal(rows.length,PRESETS.length+OPERATIONAL_LESSONS.length+STREET_PRESETS.length);
  assert.equal(new Set(rows.map(x=>x.id)).size,rows.length);
  assert.deepEqual(rows.filter(x=>x.model==='Four-area experiments').map(x=>x.id),PRESETS.map(x=>x.id));
  assert.deepEqual(rows.filter(x=>x.model==='Street lab').map(x=>x.hotspot),STREET_PRESETS.map(x=>x.id));
  for(const r of rows)for(const key of ['question','controls','outputs','lesson','limits'])assert.ok(r[key].length>0,`${r.id}: ${key}`);
});

test('search filters and an operational lesson launches its actual setup',()=>{
  const restore=installFakeDom();
  try{
    let patch=null;const catalog=createSimulationCatalog({onOperations:p=>{patch=p;}});
    const search=catalog.element.querySelector('input');search.value='Software-update';search.dispatchEvent(new Event('input'));
    assert.equal(catalog.element.querySelectorAll('[data-simulation]').length,1);
    catalog.element.querySelector('[data-simulation="software"]').querySelector('a').click();
    assert.equal(patch.software_every_visits,1);
  }finally{restore();}
});

test('multi-depot changes retain readable depot ids and values',()=>{
  const change=simulationCatalog().find(r=>r.id==='UC-10').controls;
  assert.doesNotMatch(change,/\[object Object\]/);
  assert.match(change,/SF-1/);assert.match(change,/SJ-1/);
});

test('new decision lessons launch their versioned scenarios without mutating shared templates',()=>{
  const restore=installFakeDom();try{
    let patch;const catalog=createSimulationCatalog({onOperations:p=>{patch=p;}});
    for(const [id,key] of [['staffing-readiness','readiness'],['power-redistribution','charging'],['deadline-charging','charging'],['resource-freshness','resources'],['airport-preparation','airport']]){
      const card=catalog.element.querySelector(`[data-simulation="${id}"]`);assert.ok(card,id);card.querySelector('a').click();assert.ok(patch[key]?.version,id);
      patch[key].version='tampered';card.querySelector('a').click();assert.notEqual(patch[key].version,'tampered');
    }
    catalog.element.querySelector('[data-simulation="region-launch"]').querySelector('a').click();assert.equal(patch.launch_rehearsal,'region_b');
  }finally{restore();}
});
