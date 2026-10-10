import assert from 'node:assert/strict';
import {test} from 'node:test';
import {installFakeDom} from '../../../playground/fleetlab/test/helpers/fake-dom.mjs';
import {mountStudio} from '../../../playground/fleetlab/src/ui/studio.js';
import {createInitialState,createStore} from '../../../playground/fleetlab/src/ui/store.js';
import {defaultScenario} from '../../../playground/fleetlab/src/model/schema.js';
import {mountCityEntry} from '../hosted/integration.mjs';

// The fake DOM has no MutationObserver; record each observer so a test can deliver a rebuild by hand.
const observers=[];
globalThis.MutationObserver=class{constructor(callback){this.callback=callback;}observe(target,options){observers.push({target,options,callback:this.callback});}};
const mount=()=>{
 const root=document.createElement('div');document.body.appendChild(root);
 return mountStudio({root,store:createStore(createInitialState({presetId:'bay_teaching_map',scenario:defaultScenario()})),playback:{pause(){}},present:{open(){},close(){}}});
};

test('hosted entries preserve mounted lessons and film, and native links need no city runtime',()=>{
 const restore=installFakeDom();
 let studio;
 try {
  studio=mount();
  const nav=document.getElementById('studio-navigation');
  const originalLinks=[...nav.children];
  const film=document.querySelector('.welcome-visual');
  const filmContent=film.textContent;
  const originalLessons=[...document.querySelectorAll('.catalog-card')];
  assert.equal(originalLessons.length,61);
  mountCityEntry();mountCityEntry();
  assert.deepEqual([...nav.children],originalLinks,'the header keeps its three destinations');
  const city=document.querySelectorAll('.lab-links a[href="/city-explorer/"]');
  assert.equal(city.length,1);
  assert.equal(city[0].textContent,'City Explorer');
  assert.equal(city[0].getAttribute('target'),null);
  assert.equal(document.querySelector('.welcome-visual'),film);
  assert.equal(film.textContent,filmContent);
  assert.deepEqual([...document.querySelectorAll('.catalog-card')],originalLessons);
  assert.equal(document.querySelectorAll('.city-entry-feature').length,1);
  assert.equal(document.querySelectorAll('.city-entry-catalog').length,1);
  const feature=document.querySelector('.studio-overview .city-entry-feature');
  assert.ok(feature);
  assert.deepEqual(feature.querySelectorAll('a.city-entry-action').map(a=>a.getAttribute('href')),['/city-explorer/#compare','/city-explorer/#replay','/city-explorer/#limits']);
  assert.ok(document.querySelector('.simulation-catalog .city-entry-catalog'));
  const contact=document.querySelector('.studio-footer .owner-contact');
  assert.ok(contact,'owner contact is discoverable at the bottom of Overview');
  assert.equal(contact.querySelector('a').getAttribute('href'),'mailto:bohueilin@gmail.com');
  assert.equal(contact.querySelector('a').textContent,'bohueilin@gmail.com');
  assert.equal(document.querySelectorAll('.owner-contact').length,1);
  const trust=document.querySelector('.welcome-boundary .hosted-trust-legend');
  assert.ok(trust,'the plain-language trust legend is attached to the actual welcome boundary');
  assert.equal(document.querySelectorAll('.hosted-trust-legend').length,1);
  const offline=document.querySelector('.offline-edition a');
  assert.equal(offline.getAttribute('href'),'/downloads/fleetlab-offline');
  assert.equal(offline.getAttribute('download'),'fleetlab-offline.html');
 } finally {studio?.destroy();restore();}
});

test('the capacity study joins the depot flow chooser and Explore once, and survives a lesson change',()=>{
 const restore=installFakeDom();
 let studio;
 try {
  studio=mount();
  const lessons=['#/depot-flow-lab?lesson=two-vehicles','#/depot-flow-lab?lesson=crossed-priorities'];
  const assertChooser=()=>{
   const links=document.querySelectorAll('#capacity-entry');
   assert.equal(links.length,1);
   const chooser=document.querySelector('.flow-hero nav.lab-chooser[aria-label="Depot flow lessons"]');
   assert.equal(links[0].parentNode,chooser);
   assert.deepEqual(chooser.querySelectorAll('a').map(a=>a.getAttribute('href')),[...lessons,'/network-flows/capacity/'],'the two lessons stay first');
   assert.equal(links[0].textContent,'Scheduling or capacity?');
   assert.equal(links[0].getAttribute('class'),'studio-button');
   assert.equal(links[0].getAttribute('target'),null);
  };
  mountCityEntry();mountCityEntry();
  assertChooser();
  const catalogs=document.querySelectorAll('.capacity-entry-catalog');
  assert.equal(catalogs.length,1);
  assert.equal(document.querySelector('.city-entry-catalog').nextSibling,catalogs[0]);
  assert.equal(catalogs[0].getAttribute('aria-labelledby'),'capacity-catalog-title');
  assert.equal(catalogs[0].querySelector('p.city-entry-eyebrow').textContent,'RECORDED CAPACITY STUDY');
  assert.equal(catalogs[0].querySelector('h2#capacity-catalog-title').textContent,'Better scheduling, more bandwidth, or more charging power?');
  assert.equal(catalogs[0].querySelector('p:not(.city-entry-eyebrow)').textContent,'Twelve invented depot visits share one upload link, two charging ports and one site feed. Four scheduling rules and two capacity changes serve the same work; compare who is ready on time.');
  const action=catalogs[0].querySelectorAll('a.city-entry-action');
  assert.deepEqual(action.map(a=>[a.getAttribute('href'),a.textContent]),[['/network-flows/capacity/','Open the capacity study  ↗']]);
  const hero=document.querySelector('.flow-hero');
  const watching=observers.filter(o=>o.target===hero);
  assert.deepEqual(watching.map(o=>o.options),[{childList:true}]);
  // Every lesson change rebuilds the hero, chooser included; the observer restores the hosted link.
  studio.applyRoute(lessons[1]);
  assert.equal(document.querySelectorAll('#capacity-entry').length,0);
  watching[0].callback([]);
  assertChooser();
 } finally {studio?.destroy();restore();}
});
