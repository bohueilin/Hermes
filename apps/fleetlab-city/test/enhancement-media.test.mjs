import {test} from 'node:test';
import assert from 'node:assert/strict';
import {installFakeDom} from '../../../playground/fleetlab/test/helpers/fake-dom.mjs';
import {decorateVisitors} from '../hosted/visitor.mjs';

function element(tag,attrs={},children=[]){
 const n=document.createElement(tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);
 for(const c of [children].flat())n.appendChild(typeof c==='string'?document.createTextNode(c):c);return n;
}
function fixture(run){
 const restore=installFakeDom(),prior=globalThis.MutationObserver,changes=[];
 globalThis.MutationObserver=class{constructor(fn){changes.push(fn);}observe(){}disconnect(){}};
 try{run(changes);}finally{globalThis.MutationObserver=prior;restore();}
}
test('People band follows the concept film and precedes the existing Home destination cards',()=>fixture(()=>{
 const start=element('section',{class:'start-points'},element('h2',{},'Where would you like to explore next?'));
 const film=element('section',{class:'studio-film-hero'},[start,element('div',{class:'welcome-visual'}),element('div',{class:'film-caption'},'Original qualification')]);
 const home=element('main',{class:'studio-overview'},film);document.body.appendChild(home);
 decorateVisitors(document);decorateVisitors(document);
 const band=document.getElementById('enhancement-people');assert.ok(band,'People band must be present');
 assert.equal(film.nextSibling,band);assert.equal(band.nextSibling,start);
 assert.equal(band.querySelector('h2').textContent,'The people between rides.');
 assert.equal(band.querySelector('img').getAttribute('alt'),'Clay illustration of four depot workers — a lead with a tablet, a technician, a cleaner resetting a cabin, and a remote operator — around a row of white autonomous pods.');
 assert.equal(band.querySelector('figcaption').textContent,'Concept illustration · not simulation output');
 assert.equal(band.querySelector('video').getAttribute('src'),null);
 assert.match(band.querySelector('video').getAttribute('data-concept-src'),/FL-V3/);
 assert.equal(home.querySelectorAll('#enhancement-people').length,1);
 assert.equal(film.querySelector('.film-caption').textContent,'Original qualification');
}));
test('About artwork sits with the existing named users without replacing their claims',()=>fixture(()=>{
 const people=element('div',{class:'people-grid'},element('article',{},'Named user and existing limits'));
 const section=element('section',{class:'approach-section'},[element('h2',{},'Different users. A shared operating picture.'),people]);
 document.body.appendChild(element('main',{class:'studio-approach'},section));decorateVisitors(document);
 assert.ok(section.querySelector('img[src="/enhancement-media/FL-A1-people-between-rides.webp"]'));
 assert.equal(section.querySelector('.people-grid'),people);assert.equal(people.textContent,'Named user and existing limits');
}));
test('Fleet day uses the approved still after its title and never includes held V1',()=>fixture(()=>{
 const title=element('h1',{},'Fleet day'),frame=element('section',{class:'teaching-frame'},[title,element('p',{},'Not calibrated.')]);
 const teaching=element('div',{class:'ops-teaching'},frame),intro=element('section',{class:'ops-intro'},teaching);
 document.body.appendChild(element('main',{class:'operations-lab'},intro));decorateVisitors(document);
 const hero=frame.querySelector('#enhancement-fleet-day');assert.ok(hero);assert.equal(title.nextSibling,hero);
 assert.equal(hero.querySelector('img').getAttribute('src'),'/enhancement-media/FL-A2-one-fleet-day-panorama.webp');
 assert.equal(hero.querySelector('video'),null);
 assert.equal(hero.querySelector('.enhancement-caption').textContent,'One fleet day: out at dawn, queued by midday, charging by night. Your run will write its own version.');
 assert.ok(frame.textContent.includes('Not calibrated.'));
}));
test('notebook illustration carries its exact qualification immediately below the question',()=>fixture(()=>{
 const heading=element('div',{class:'section-heading'},element('h2',{},'More locations. The same resources.'));
 const table=element('table',{},'Frozen paired results');const study=element('div',{id:'legacy-study'},[heading,table]);document.body.appendChild(study);
 decorateVisitors(document);const art=study.querySelector('#enhancement-notebook');assert.ok(art);assert.equal(heading.nextSibling,art);
 assert.equal(art.querySelector('.enhancement-caption').textContent,'Same city, same streets. Left: one depot, long empty loops. Right: a second depot — the cars stay closer to the riders. The table below is what the model actually found.');
 assert.equal(art.querySelector('.enhancement-fence').textContent,"Concept illustration · the study's streets are real; this picture is not the study");assert.equal(table.textContent,'Frozen paired results');
}));
test('capacity uses A4 without duplicating the old fallback or disturbing its schematic',()=>fixture(()=>{
 const preview=element('div',{class:'capacity-preview-slot'},'Existing resource schematic');
 const hero=element('section',{class:'capacity-hero'},[element('div',{class:'capacity-intro'},element('h1',{},'Capacity question')),preview]);document.body.appendChild(hero);
 decorateVisitors(document);decorateVisitors(document);
 assert.equal(hero.querySelectorAll('img[src="/enhancement-media/FL-A4-capacity-hero.webp"]').length,1);
 assert.equal(hero.querySelector('img[src="/diagrams/D-01-depot-scenario.webp"]'),null);
 assert.equal(hero.querySelector('.capacity-preview-slot'),preview);assert.equal(preview.textContent,'Existing resource schematic');
}));
test('V2 sits beside the original deadhead figure with full static teaching and no eager source',()=>fixture(()=>{
 const original=element('section',{'data-explainer-kind':'deadhead',class:'methodology-explainer'},[element('h3',{},'The distance without a rider'),element('p',{class:'explainer-equivalent'},'Existing numeric qualification')]);
 const hero=element('section',{class:'r1-hero'},original);document.body.appendChild(hero);decorateVisitors(document);
 const layout=hero.querySelector('.enhancement-deadhead-layout');assert.ok(layout);assert.equal(layout.querySelector('.methodology-explainer'),original);
 assert.equal(original.querySelector('.explainer-equivalent').textContent,'Existing numeric qualification');
 const figure=layout.querySelector('[data-concept-media]');assert.ok(figure);assert.equal(figure.querySelector('video').getAttribute('src'),null);
 assert.equal(figure.querySelector('.enhancement-caption').textContent,'Some loops carry a rider. Some carry nobody — same street, same cost. Rebalancing is the art of shrinking the empty loops.');
 assert.equal(figure.querySelector('.enhancement-fence').textContent,'Concept animation · not simulation output');
}));
