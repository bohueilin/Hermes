import assert from 'node:assert/strict';
import {test} from 'node:test';
import { PRESETS } from '../src/model/presets.js';
import { STREET_PRESETS } from '../src/model/street-simulation.js';
import { simulationCatalog, createSimulationCatalog, OPERATIONAL_LESSONS } from '../src/ui/simulation-catalog.js';
import { installFakeDom } from './helpers/fake-dom.mjs';

test('featured Network Flows questions precede the complete searchable library',()=>{
 const restore=installFakeDom();try{
  let opened=null;const {element}=createSimulationCatalog({onLesson:r=>{opened=r.id;}});
  const feature=element.querySelector('.network-flows-feature');assert.ok(feature);
  assert.ok(element.children.indexOf(feature)<element.children.indexOf(element.querySelector('.catalog-search')));
  assert.equal(feature.querySelectorAll('a').length,2);
  feature.querySelector('a[href="#/depot-flow-lab?lesson=two-vehicles"]').click();assert.equal(opened,'two-vehicles');
  assert.equal(element.querySelectorAll('.catalog-card').length,61);
  assert.match(feature.textContent,/Synthetic interactive models/);
 }finally{restore();}
});

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

test('Explore leads with search, compact topic buttons and compact cards',()=>{
  const restore=installFakeDom();
  try{
    const records=simulationCatalog(),root=createSimulationCatalog().element;
    const shown=()=>root.querySelectorAll('.catalog-card').map(card=>card.getAttribute('data-simulation'));
    assert.equal(root.querySelector('h1').textContent,'What would you like to understand?');
    assert.equal(root.querySelector('.catalog-intro .hero-lede').textContent,'Every lesson answers one fleet question with a small synthetic model.');
    assert.equal(root.querySelector('select[aria-label="Topic"]'),null,'topics are buttons, not a select');
    assert.equal(root.querySelector('.catalog-collections'),null,'no separate topic cards');
    const group=root.querySelector('div.catalog-topics[role="group"][aria-label="Topic"]');assert.ok(group,'a labelled topic group');
    const chips=group.querySelectorAll('button.studio-button'),questions=root.querySelector('p.catalog-topic-questions');
    assert.deepEqual(chips.map(b=>b.textContent),['All topics','Depot readiness & data','Fleet service & capacity','Streets & cities']);
    const pressed=()=>chips.filter(b=>b.getAttribute('aria-pressed')==='true').map(b=>b.textContent);
    assert.ok(chips.every(b=>['true','false'].includes(b.getAttribute('aria-pressed'))));
    assert.deepEqual(pressed(),['All topics']);assert.equal(questions.hidden,true);
    const topics=[
      ['Depot readiness & data',21,'Why can a charged vehicle still wait? Which upload goes first? Would another bay or worker help?'],
      ['Fleet service & capacity',31,'Can the fleet meet demand? What changes as a fleet grows? Does a policy help across repeats?'],
      ['Streets & cities',9,'Where do queues form? Can one block tie up the fleet?'],
    ];
    const seen=[];
    for(const [name,count,text] of topics){
      chips.find(b=>b.textContent===name).click();
      assert.equal(root.querySelector('p.catalog-count').textContent,`${count} of 61 lessons`,name);
      assert.equal(shown().length,count,name);seen.push(...shown());
      assert.deepEqual(pressed(),[name]);
      assert.deepEqual(chips.filter(b=>b.classList.contains('is-selected')).map(b=>b.textContent),[name],'the pressed topic is also marked for its ink fill');
      assert.equal(questions.hidden,false);assert.equal(questions.textContent,text);
    }
    assert.deepEqual(seen.slice().sort(),records.map(r=>r.id).sort(),'every lesson belongs to exactly one topic');
    for(const r of records.filter(r=>r.id.startsWith('street-'))){chips[3].click();assert.ok(shown().includes(r.id),r.id);}
    chips[0].click();
    assert.deepEqual(pressed(),['All topics']);assert.equal(questions.hidden,true);
    assert.equal(root.querySelector('p.catalog-count').textContent,'61 of 61 lessons');
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
  }finally{restore();}
});

test('Explore order: featured questions, search, topics, lab links, then count and cards',()=>{
  const restore=installFakeDom();
  try{
    const shape=root=>root.children.map(n=>[n.localName,...(n.getAttribute('class')?.split(' ')??[])].join('.'));
    const tail=['h2.fl-sr-only','div.catalog-count-row','div.catalog-grid','p','p','section.catalog-outside'];
    assert.deepEqual(shape(createSimulationCatalog().element),['section.catalog-intro','section.network-flows-feature','h2.catalog-library-title','div.catalog-search','div.catalog-topics','p.catalog-topic-questions',...tail]);
    const labLinks=document.createElement('nav');labLinks.setAttribute('class','lab-links');
    const root=createSimulationCatalog({labLinks}).element;document.body.appendChild(root);
    assert.equal(root.tagName.toLowerCase(),'main');assert.ok(root.classList.contains('simulation-catalog'));
    assert.deepEqual(shape(root),['section.catalog-intro','section.network-flows-feature','h2.catalog-library-title','div.catalog-search','div.catalog-topics','p.catalog-topic-questions','p.eyebrow.catalog-jump','nav.lab-links',...tail]);
    assert.equal(root.querySelector('h2.fl-sr-only').textContent,'All lessons','the results have their own heading');
    const fields=root.querySelector('.catalog-search');
    assert.deepEqual(shape(fields),['label','label'],'the search row holds only the search field and the model filter');
    for(const [name,selector] of [['Search lessons','input[type="search"]'],['Simulation model','select']]){
      const field=fields.querySelector(`${selector}[aria-label="${name}"]`);
      assert.ok(field,name);assert.equal(field.closest('label').querySelector('span').textContent,name,name);
    }
    const row=root.querySelector('.catalog-count-row');
    assert.deepEqual(shape(row),['p.catalog-count','button.studio-button']);assert.equal(row.children[1].textContent,'Clear filters');
    for(const card of root.querySelectorAll('.catalog-card'))assert.equal(card.querySelector('h2'),null,'a lesson title never inverts the card outline');
    const search=root.querySelector('[aria-label="Search lessons"]'),model=root.querySelector('[aria-label="Simulation model"]');
    const chips=root.querySelectorAll('.catalog-topics button'),count=root.querySelector('p.catalog-count');
    search.value='charging';search.dispatchEvent(new Event('input'));
    chips[1].click();model.value='Fleet day';model.dispatchEvent(new Event('change'));
    assert.notEqual(count.textContent,'61 of 61 lessons');
    row.children[1].click();
    assert.equal(count.textContent,'61 of 61 lessons');assert.equal(search.value,'');assert.equal(model.value,'All labs');
    assert.deepEqual(chips.filter(b=>b.getAttribute('aria-pressed')==='true').map(b=>b.textContent),['All topics']);
    assert.equal(root.querySelector('.catalog-topic-questions').hidden,true);
    assert.equal(document.activeElement,search,'Clear filters returns focus to the search field');
    search.value='no such lesson';search.dispatchEvent(new Event('input'));
    assert.equal(count.textContent,'0 of 61 lessons');
    assert.match(root.querySelector('.catalog-grid').textContent,/^No lesson matches\./);
    assert.equal(root.querySelector('.catalog-grid button'),null,'the count row Clear filters serves the empty state');
    row.children[1].click();assert.equal(count.textContent,'61 of 61 lessons');
  }finally{restore();}
});
