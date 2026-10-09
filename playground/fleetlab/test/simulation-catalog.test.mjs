import assert from 'node:assert/strict';
import {test} from 'node:test';
import { PRESETS } from '../src/model/presets.js';
import { STREET_PRESETS } from '../src/model/street-simulation.js';
import { simulationCatalog, createSimulationCatalog, OPERATIONAL_LESSONS } from '../src/ui/simulation-catalog.js';
import { installFakeDom } from './helpers/fake-dom.mjs';

test('catalog includes every registered regional preset and every operational lesson once',()=>{
  const rows=simulationCatalog();
  assert.equal(rows.length,PRESETS.length+OPERATIONAL_LESSONS.length+STREET_PRESETS.length+5);
  assert.equal(new Set(rows.map(x=>x.id)).size,rows.length);
  assert.deepEqual(rows.filter(x=>x.model==='Four-area experiments').map(x=>x.id),PRESETS.map(x=>x.id));
  assert.deepEqual(rows.filter(x=>x.model==='Street lab').map(x=>x.hotspot),STREET_PRESETS.map(x=>x.id));
  for(const r of rows)for(const key of ['what_why','how','look_for','ops_takeaway','limits'])assert.ok(r.frame[key].length>0,`${r.id}: ${key}`);
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

test('Explore leads with search, three topics and compact cards',()=>{
  const restore=installFakeDom();
  try{
    const records=simulationCatalog(),root=createSimulationCatalog().element;
    const shown=()=>root.querySelectorAll('.catalog-card').map(card=>card.getAttribute('data-simulation'));
    const family=(...names)=>records.filter(r=>names.includes(r.frame.family)).map(r=>r.id);
    assert.equal(root.querySelector('h1').textContent,'What would you like to understand?');
    const topic=root.querySelector('[aria-label="Topic"]');
    assert.deepEqual(topic.querySelectorAll('option').map(o=>o.textContent),['All topics','Depot readiness & data','Fleet service & capacity','Streets & cities']);
    const pick=name=>{topic.value=name;topic.dispatchEvent(new Event('change'));};
    pick('Streets & cities');
    assert.deepEqual(shown(),family('Roads and streets'));
    for(const r of records.filter(r=>r.id.startsWith('street-')))assert.ok(shown().includes(r.id),r.id);
    pick('Depot readiness & data');
    assert.deepEqual(shown(),family('Depot work and capacity','Energy and charging'));
    pick('All topics');
    assert.deepEqual(shown(),records.map(r=>r.id),'every lesson renders exactly once');
    for(const card of root.querySelectorAll('.catalog-card')){
      const record=records.find(r=>r.id===card.getAttribute('data-simulation'));
      const parts=card.children.filter(n=>n.getAttribute('class')!=='catalog-card-id');
      assert.deepEqual(parts.map(n=>[n.localName,n.getAttribute('class')].filter(Boolean).join('.')),['h3','p.catalog-outcome','p.catalog-meta','a.studio-button','details'],record.id);
      assert.equal(parts[0].textContent,record.frame.what_why);
      assert.equal(parts[1].textContent,record.frame.look_for);
      assert.match(parts[2].textContent,/^Run a model · About \d+ min · /);
      assert.equal(parts[3].textContent,'Open lesson  →');
      assert.equal(card.querySelector('a'),parts[3],'the first link is the lesson link');
      assert.equal(parts[4].querySelector('summary').textContent,'More about this lesson');
    }
    const collections=root.querySelector('.catalog-collections').children;
    assert.deepEqual(collections.map(n=>n.localName),['article','article','article']);
    assert.deepEqual(collections.map(n=>n.querySelector('h2').textContent),['Depot readiness & data','Fleet service & capacity','Streets & cities']);
    collections[2].querySelector('button').click();
    assert.equal(topic.value,'Streets & cities');assert.deepEqual(shown(),family('Roads and streets'));
    const search=root.querySelector('[aria-label="Search lessons"]');search.value='no such lesson';search.dispatchEvent(new Event('input'));
    assert.equal(shown().length,0);assert.match(root.querySelector('.catalog-grid').textContent,/^No lesson matches\./);
    root.querySelector('.catalog-grid button').click();
    assert.equal(search.value,'');assert.equal(topic.value,'All topics');assert.equal(shown().length,records.length);
  }finally{restore();}
});

test('Explore keeps its labelled controls next to the results and keeps focus when filtering',()=>{
  const restore=installFakeDom();
  try{
    const root=createSimulationCatalog().element;document.body.appendChild(root);
    const order=root.children.map(n=>n.getAttribute('class')??n.localName);
    assert.deepEqual(order.slice(0,3),['catalog-intro','catalog-search','catalog-collections']);
    const grid=order.indexOf('catalog-grid');
    assert.equal(order[grid-1],'catalog-count','the count sits directly above the cards it counts');
    assert.equal(root.children[grid-2].textContent,'All lessons','the results have their own heading');
    for(const [name,control] of [['Search lessons','input'],['Topic','select'],['Simulation model','select']]){
      const field=root.querySelector(`.catalog-search [aria-label="${name}"]`);
      assert.equal(field.localName,control);assert.equal(field.closest('label').querySelector('span').textContent,name,name);
    }
    for(const card of root.querySelectorAll('.catalog-card'))assert.equal(card.querySelector('h2'),null,'a lesson title never inverts the card outline');
    const collections=root.querySelector('.catalog-collections'),topic=root.querySelector('[aria-label="Topic"]');
    assert.equal(collections.hidden,false);
    collections.querySelector('button').click();
    assert.equal(collections.hidden,true,'topic cards step aside while a filter is active');
    assert.equal(document.activeElement,topic,'focus moves to the filter that changed');
    const search=root.querySelector('[aria-label="Search lessons"]');search.value='no such lesson';search.dispatchEvent(new Event('input'));
    root.querySelector('.catalog-grid button').click();
    assert.equal(collections.hidden,false);assert.notEqual(document.activeElement,document.body);
  }finally{restore();}
});
