import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {installFakeDom} from '../../../playground/fleetlab/test/helpers/fake-dom.mjs';
import {mountStudio} from '../../../playground/fleetlab/src/ui/studio.js';
import {createInitialState,createStore} from '../../../playground/fleetlab/src/ui/store.js';
import {defaultScenario} from '../../../playground/fleetlab/src/model/schema.js';
import {mountCityEntry} from '../hosted/integration.mjs';
import {decorateVisitors} from '../hosted/visitor.mjs';

// Explore lists the five network-flows questions in the hub's 01 to 05 order, then the two depot-flow lessons.
const HUB=readFileSync(new URL('../hosted/network-hub.html',import.meta.url),'utf8');
const ROUTES=['/network-flows/capacity/','/network-flows/software-delivery/','/network-flows/delivery-order/','/network-flows/rebalancing/','/network-flows/dispatch/'];
const DEPOT_FLOW=['#/depot-flow-lab?lesson=two-vehicles','#/depot-flow-lab?lesson=crossed-priorities'];
const CARD05='Compare closest-first assignment with planned-together matching. Follow one car, then see why the best assignment now can lose later.';
const RELEASES=[['fleetlab-software-delivery','software-delivery'],['fleetlab-delivery-order','delivery-order'],['fleetlab-rebalancing','rebalancing'],['fleetlab-dispatch','dispatch']];
globalThis.MutationObserver??=class{observe(){}disconnect(){}};
const stops=()=>[.../<ol\b[^>]*\bclass="journey-strip"[^>]*>([\s\S]*?)<\/ol>/.exec(HUB)[1].matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/g)].map(m=>m[1]);

test('the hub numbers the five questions 01 to 05 in lesson order and card 05 compares closest-first with planned-together',()=>{
 const cards=stops();
 assert.deepEqual(cards.map(c=>/journey-number[^>]*>(\d+)</.exec(c)[1]),['01','02','03','04','05']);
 assert.deepEqual(cards.map(c=>/<h2><a href="([^"]+)"/.exec(c)[1]),ROUTES);
 assert.ok(cards[4].includes(`</h2><p>${CARD05}</p>`),'hub card 05 body');
 assert.equal(HUB.split(CARD05).length,2);
 assert.doesNotMatch(HUB,/greedy|joint matching/i);
});

test('Explore lists the network-flows questions 01 to 05, then the depot-flow lessons, with the hub card 05 sentence',()=>{
 const restore=installFakeDom();let studio;
 try{
  const root=document.createElement('div');document.body.appendChild(root);
  studio=mountStudio({root,store:createStore(createInitialState({presetId:'bay_teaching_map',scenario:defaultScenario()})),playback:{pause(){}},present:{open(){},close(){}}});
  for(const [name,route]of RELEASES){const m=document.createElement('meta');m.setAttribute('name',name);m.setAttribute('content',`/network-flows/${route}/release.json`);document.body.appendChild(m);}
  mountCityEntry();
  const list=document.querySelector('.network-question-list'),order=()=>[...list.children].map(card=>card.querySelector('a')?.getAttribute('href'));
  for(let i=0;i<2;i++){decorateVisitors(document);assert.deepEqual(order(),[...ROUTES,...DEPOT_FLOW]);}
  assert.ok([...list.children].every(card=>card.tagName.toLowerCase()==='article'));
  const dispatch=list.querySelector('a[href="/network-flows/dispatch/"]').closest('article');
  assert.equal(dispatch.querySelector('.network-description').textContent,CARD05);
  assert.ok(stops()[4].includes(`<p>${dispatch.querySelector('.network-description').textContent}</p>`),'catalog card 05 equals hub card 05');
  assert.doesNotMatch(list.textContent,/greedy|joint matching/i);
 }finally{studio?.destroy();restore();}
});
