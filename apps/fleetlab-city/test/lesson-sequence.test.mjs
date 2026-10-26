import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {LESSON_SEQUENCE,lessonNavigation} from '../../../playground/fleetlab/tools/software-delivery-package.mjs';
import {buildSite} from '../../../playground/fleetlab/tools/pack.mjs';

// One lesson sequence, 01 to 05, read by both generators and followed by the hub, the five lesson labels and every
// lesson link. The depot experiment stays outside the five.
const repo=fileURLToPath(new URL('../../../',import.meta.url));
const read=path=>readFileSync(repo+path,'utf8');
const ROUTES=['capacity','software-delivery','delivery-order','rebalancing','dispatch'];
const LABELS={capacity:'playground/fleetlab/src/ui/depot-capacity-page.js','software-delivery':'playground/fleetlab/src/ui/software-delivery-page.js','delivery-order':'playground/fleetlab/src/ui/delivery-order-page.js',rebalancing:'playground/fleetlab/rebalancing/index.html',dispatch:'playground/fleetlab/dispatch/index.html'};
const CALLER=['network-flows/capacity/index.html','network-flows/software-delivery/release.json','network-flows/software-delivery/index.html','network-flows/delivery-order/release.json','network-flows/delivery-order/index.html','network-flows/rebalancing/release.json','network-flows/rebalancing/index.html','network-flows/dispatch/release.json','network-flows/dispatch/index.html'];
const META=['Base vs one change: different rule, more bandwidth, or more power','Repeated download vs cold shared cache (one depot copy)','First come vs your order (or best of 24)','Reactive vs forecast repositioning','Closest-first vs planned together'];
const HUB='apps/fleetlab-city/hosted/network-hub.html';
let site;const built=()=>site??=buildSite(repo+'playground/fleetlab/');

test('the hub strip and the five lesson labels follow the one sequence',()=>{
 assert.deepEqual(LESSON_SEQUENCE.map(([route])=>route),ROUTES);
 const strip=read(HUB).split('</ol>')[0];
 assert.deepEqual([...strip.matchAll(/<span class="journey-number" aria-hidden="true">(\d\d)<\/span>[\s\S]*?href="\/network-flows\/([a-z-]+)\/"/g)].map(m=>[m[1],m[2]]),ROUTES.map((route,i)=>[`0${i+1}`,route]));
 for(const [i,route]of ROUTES.entries())assert.deepEqual(read(LABELS[route]).match(/lesson \d+ of \d+/gi),[`LESSON ${i+1} OF 5`],route);
 for(const path of [...Object.values(LABELS),'playground/fleetlab/depot-lab/index.html',HUB])assert.doesNotMatch(read(path),/lesson 6|capstone/i,path);
 assert.doesNotMatch(read(LABELS['software-delivery']),/'04 \//,'the Software Delivery "04 /" is gone');
 assert.doesNotMatch(read(LABELS.capacity),/Depot readiness & data/,'the Capacity breadcrumb no longer names the Explore collection');
});

test('each hub card carries one plain Compare line between its body and its topic',()=>{
 const cards=[...read(HUB).split('</ol>')[0].matchAll(/<li class="journey-stop">([\s\S]*?)<\/li>/g)].map(m=>m[1]);
 assert.equal(cards.length,5);
 for(const [i,card]of cards.entries()){
  assert.equal(card.split('class="meta"').length,2,ROUTES[i]);
  assert.ok(card.includes(`</p><p class="meta"><strong>Compare:</strong> ${META[i]}</p><span class="journey-topic">`),ROUTES[i]);
 }
 assert.equal(read(HUB).split('class="meta"').length,6);
});

test('hosted Next links run 01 to 05 without a skip, Rebalancing keeps its Previous and lesson 05 ends the sequence',()=>{
 const nav=lessonNavigation(built());
 assert.deepEqual([...nav.keys()],ROUTES.slice(0,4).map(route=>`network-flows/${route}/index.html`));
 for(const [i,route]of ROUTES.slice(0,4).entries()){
  const page=nav.get(`network-flows/${route}/index.html`);
  assert.equal((page.match(/aria-label="Next Network Flows lesson"/g)??[]).length,1,route);
  assert.ok(page.includes(`<a href="/network-flows/${ROUTES[i+1]}/">${LESSON_SEQUENCE[i+1][1]}`),route);
 }
 const r1=nav.get('network-flows/rebalancing/index.html');
 assert.equal((r1.match(/href="\/network-flows\/delivery-order\/"/g)??[]).length,1);
 assert.ok(r1.includes(`Previous lesson: <a href="/network-flows/delivery-order/">${LESSON_SEQUENCE[2][1]}</a>`));
 assert.ok(r1.indexOf('Previous lesson:')<r1.indexOf('aria-label="Next Network Flows lesson"'));
 assert.equal(nav.has('network-flows/dispatch/index.html'),false,'lesson 05 navigation is page source');
 const dispatch=built().get('network-flows/dispatch/index.html');
 assert.ok(dispatch.includes(`<nav class="onward" aria-label="Continue learning"><span>Previous lesson: <a href="/network-flows/rebalancing/">${LESSON_SEQUENCE[3][1]}</a></span><a href="/network-flows/">Back to hub</a><span>Deeper experiment, outside the five questions: <a href="/depot-readiness/">What holds a car in the depot?</a></span></nav>`));
 assert.ok(read(HUB).includes('<p class="hub-deeper">Deeper experiment, outside the five questions: <a href="/depot-readiness/">What holds a car in the depot?'),'the Dispatch depot link reuses the live hub wording');
 assert.doesNotMatch(dispatch,/href="\/network-flows\/delivery-order\/"/,'no unlabelled loop back to lesson 03');
});

test('integrate-site.py reads the same sequence line, receives both new pages and writes the same pages',()=>{
 const tool=repo+'apps/fleetlab-city/tools/integrate-site.py';
 const caller=read('apps/fleetlab-city/tools/integrate-site.py').match(/onward = lesson_navigation\(\{[\s\S]*?\}\)/)[0];
 assert.deepEqual([...caller.matchAll(/"(network-flows\/[^"]+)"/g)].map(m=>m[1]),CALLER);
 const files=Object.fromEntries(CALLER.map(path=>[path,String(built().get(path))]));
 const [sequence,pages]=JSON.parse(execFileSync('python3',['-B','-c',"import json,runpy,sys; ns=runpy.run_path(sys.argv[1]); files=json.load(sys.stdin); print(json.dumps([ns['lesson_sequence'](),ns['lesson_navigation'](files)]))",tool],{input:JSON.stringify(files),encoding:'utf8',maxBuffer:8*1024*1024}));
 assert.deepEqual(sequence,LESSON_SEQUENCE);
 assert.deepEqual(pages,Object.fromEntries(lessonNavigation(new Map(Object.entries(files)))));
});
