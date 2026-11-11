import {test} from 'node:test';
import assert from 'node:assert/strict';
import {installFakeDom} from '../../../playground/fleetlab/test/helpers/fake-dom.mjs';
import {GLOSSARY,glossaryView} from '../../../playground/fleetlab/src/ui/teaching-frames.js';
import {decorateVisitors,syncRouteImages} from '../hosted/visitor.mjs';
test('all glossary definitions appear once under four useful categories',()=>{const restore=installFakeDom();try{const view=glossaryView();assert.deepEqual([...view.querySelectorAll('h3')].map(n=>n.textContent),['Time & queues','Space & routing','Experiments & seeds','Verdicts & limits']);assert.equal(view.querySelectorAll('p').length,24);for(const definition of Object.values(GLOSSARY))assert.equal([...view.querySelectorAll('p')].filter(n=>n.textContent===definition).length,1);}finally{restore();}});
test('a shown route\'s hero fetches eagerly and decoration is idempotent',()=>{const restore=installFakeDom();try{const hero=document.createElement('section');hero.className='street-intro';document.body.appendChild(hero);decorateVisitors(document);decorateVisitors(document);assert.equal(hero.querySelectorAll('.visitor-hero-art').length,1);const img=hero.querySelector('img');assert.equal(img.getAttribute('loading'),'eager');assert.equal(img.getAttribute('fetchpriority'),'high');assert.equal(img.getAttribute('width'),'1600');}finally{restore();}});
test('a hidden route fetches no image until it opens, then its hero loads eagerly at high priority',()=>{const restore=installFakeDom();try{const route=document.createElement('main');route.hidden=true;const hero=document.createElement('section');hero.className='street-intro';route.appendChild(hero);document.body.appendChild(route);decorateVisitors(document);const img=hero.querySelector('img');assert.equal(img.getAttribute('loading'),'lazy');assert.equal(img.getAttribute('fetchpriority'),'high');route.hidden=false;syncRouteImages(document);assert.equal(img.getAttribute('loading'),'eager');assert.equal(img.hasAttribute('data-eager'),false);}finally{restore();}});
import {mountStudio} from '../../../playground/fleetlab/src/ui/studio.js';
import {createInitialState,createStore} from '../../../playground/fleetlab/src/ui/store.js';
import {defaultScenario} from '../../../playground/fleetlab/src/model/schema.js';
import {mountCityEntry} from '../hosted/integration.mjs';
import {decorateDesign} from '../hosted/brand.mjs';
// WebKit takes the lazy-load decision when src is set, so a later loading="lazy" cannot stop the fetch.
test('every image built for a hidden studio route is lazy before its src is set',()=>{
 const restore=installFakeDom(),set=Element.prototype.setAttribute,atSrc=new Map(),prior=globalThis.MutationObserver;let studio;
 Element.prototype.setAttribute=function(name,value){if(this.tagName==='IMG'&&name==='src')atSrc.set(this,this.getAttribute('loading'));return set.call(this,name,value);};
 globalThis.MutationObserver=class{observe(){}disconnect(){}};
 try{
  const root=document.createElement('div');document.body.appendChild(root);
  studio=mountStudio({root,store:createStore(createInitialState({presetId:'bay_teaching_map',scenario:defaultScenario()})),playback:{pause(){}},present:{open(){},close(){}}});
  studio.applyRoute('#/approach');mountCityEntry();decorateDesign(document);
  const hidden=[...atSrc].filter(([img])=>img.closest('[hidden]'));
  assert.ok(hidden.length>=20,`${hidden.length} hidden-route images`);
  for(const [img,loading] of hidden)assert.equal(loading,'lazy',img.getAttribute('src'));
  const hero=document.querySelector('.approach-intro .visitor-hero-art img');
  assert.deepEqual([hero.getAttribute('loading'),hero.getAttribute('fetchpriority')],['eager','high']);
 }finally{studio?.destroy();Element.prototype.setAttribute=set;globalThis.MutationObserver=prior;restore();}
});
import {createStreetLab} from '../../../playground/fleetlab/src/ui/street-lab.js';
import {STREET_NETWORK} from '../../../playground/fleetlab/src/model/street-network.js';
test('Street shows a human request label and retains the actual identifiers in details',async()=>{const restore=installFakeDom();let lab;try{lab=createStreetLab();document.body.appendChild(lab.element);const intro=lab.element.querySelector('.street-intro'),items=[...intro.children];assert.ok(items.indexOf(intro.querySelector('button'))<items.indexOf(intro.querySelector('.street-model-class')));assert.match(intro.querySelector('.street-model-class').textContent,/mesoscopic.*not lane-level/);lab.setConfig({duration_minutes:10,background_per_hour:0});await lab.run();let found=false;for(let time=0;time<=600;time+=5){lab.seek(time);const car=lab.getState().run.frames[Math.floor(time/5)]?.vehicles[0];if(car?.request_id){const detail=lab.element.querySelector('.street-vehicle-detail');assert.match(detail.textContent,/Rider request/);const raw=detail.querySelector('.street-raw-identifiers');assert.ok(raw);assert.ok(raw.textContent.includes(car.request_id));if(car.route_id)assert.ok(raw.textContent.includes(car.route_id));found=true;break;}}assert.ok(found,'probe sees an assigned rider');const buttons=lab.element.querySelectorAll('.street-queue-list button');if(buttons.length){buttons[0].click();const raw=lab.element.querySelector('.street-block-detail .street-raw-identifiers');assert.ok(STREET_NETWORK.edges.some(edge=>raw.textContent.includes(edge.id)));}}finally{lab?.destroy();restore();}});
test('tour keeps its exact three destinations, five-minute outcomes and finish after repeat decoration',()=>{const restore=installFakeDom();try{const home=document.createElement('main');home.className='studio-overview';document.body.appendChild(home);decorateVisitors(document);decorateVisitors(document);const tours=home.querySelectorAll('.visitor-tour');assert.equal(tours.length,1);const tour=tours[0];assert.equal(tour.querySelector('h2').textContent,'The 15-minute tour');assert.deepEqual([...tour.querySelectorAll('a')].map(n=>n.getAttribute('href')),['/#/walkthrough','/network-flows/dispatch/','/city-explorer/#compare']);for(const item of tour.querySelectorAll('li')){assert.match(item.textContent,/5 min/);assert.match(item.textContent,/You leave knowing/);}assert.match(tour.textContent,/3-minute starter/);assert.match(tour.textContent,/Monday/);assert.equal(home.querySelectorAll('.visitor-outside-model').length,1);}finally{restore();}});
