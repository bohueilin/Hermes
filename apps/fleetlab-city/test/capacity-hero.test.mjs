import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {installFakeDom,serialize} from '../../../playground/fleetlab/test/helpers/fake-dom.mjs';
import {decorateVisitors} from '../hosted/visitor.mjs';

const D01='/diagrams/D-01-depot-scenario.webp',FLA4='/enhancement-media/FL-A4-capacity-hero.webp',WIDE='(min-width:768px)';
function element(tag,attrs={},children=[]){
 const n=document.createElement(tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);
 for(const c of [children].flat())n.appendChild(typeof c==='string'?document.createTextNode(c):c);return n;
}
function fixture(run,media={}){
 const restore=installFakeDom(globalThis,{media}),prior=globalThis.MutationObserver,changes=[];
 globalThis.MutationObserver=class{constructor(fn){changes.push(fn);}observe(){}disconnect(){}};
 try{run(changes);}finally{globalThis.MutationObserver=prior;restore();}
}
const capacityHero=()=>element('section',{class:'capacity-hero'},[element('div',{class:'capacity-intro'},element('h1',{},'Capacity question')),element('div',{class:'capacity-preview-slot'},'Existing resource schematic')]);

// Sync: the page renders before the hosted layer runs (boot.js precedes brand.mjs). Late: the hero arrives after the first
// decorate, so the concept-media observer (created first) inserts FL-A4 before the design observer re-runs decorateVisitors.
for(const order of ['sync','late'])test(`capacity never builds the D-01 decoy and FL-A4 never carries the hero shimmer (${order})`,()=>fixture(changes=>{
 const made=[],create=document.createElement.bind(document);document.createElement=tag=>{const n=create(tag);made.push(n);return n;};
 let hero;if(order==='sync'){hero=capacityHero();document.body.appendChild(hero);}
 decorateVisitors(document);
 if(order==='late'){hero=capacityHero();document.body.appendChild(hero);for(const fn of [...changes])fn([{addedNodes:[hero]}]);decorateVisitors(document);}
 assert.deepEqual(made.filter(n=>n.getAttribute?.('src')===D01).length,0,'an img with the D-01 src starts a fetch even if removed at once');
 assert.equal(hero.querySelectorAll(`img[src="${FLA4}"]`).length,1);
 assert.equal(document.getElementById('enhancement-capacity').getAttribute('class'),'enhancement-media');
 assert.equal(hero.querySelectorAll('.visitor-ambient-art').length,0);assert.equal(hero.hasAttribute('data-ambient-ready'),false);
}));

test('FL-A4 is eager at high priority only where capacity/visual.css lays the hero out in two columns',()=>{
 const css=readFileSync(new URL('../../../playground/fleetlab/capacity/visual.css',import.meta.url),'utf8');
 const at=css.indexOf('@media (max-width:767.98px){'),block=css.slice(at,css.indexOf('\n}\n',at));
 assert.ok(at>0&&block.includes('\n.capacity-hero{grid-template-columns:minmax(0,1fr);'),'the hero stacks below 768 px, the complement of the priority query');
 assert.ok(block.includes('\n.capacity-hero::after{grid-area:2/1}\n'),'the placeholder follows the art into the stacked row');
 const a2=[];
 for(const [wide,loading,fetchpriority] of [[true,'eager','high'],[false,'lazy',null]])fixture(()=>{
  const hero=capacityHero();document.body.appendChild(hero);
  const title=element('h1',{},'Fleet day'),frame=element('section',{class:'teaching-frame'},[title]);
  document.body.appendChild(element('main',{class:'operations-lab'},element('section',{class:'ops-intro'},element('div',{class:'ops-teaching'},frame))));
  decorateVisitors(document);
  const img=hero.querySelector(`img[src="${FLA4}"]`);
  assert.deepEqual(['loading','fetchpriority','decoding','width','height'].map(k=>img.getAttribute(k)),[loading,fetchpriority,'async','2048','1152'],`wide ${wide}`);
  a2.push(serialize(document.getElementById('enhancement-fleet-day')));
 },{[WIDE]:wide});
 assert.equal(a2[0],a2[1],'A2 is identical at every width');assert.match(a2[0],/loading="lazy" decoding="async"><\/div>/);
});

test('the Capacity tint lives only in capacity/visual.css, above the hosted .enhancement-visual specificity',()=>{
 const visual=readFileSync(new URL('../../../playground/fleetlab/capacity/visual.css',import.meta.url),'utf8');
 const media=readFileSync(new URL('../hosted/enhancement-media.css',import.meta.url),'utf8');
 assert.equal(visual.split('\n').filter(l=>l.startsWith('.capacity-hero .enhancement-visual{')).length,1);
 const tint=visual.match(/^\.capacity-hero \.enhancement-visual\{background:(#[0-9a-f]{6})\}$/m)?.[1];assert.ok(tint);
 // The pre-injection placeholder reserves the same 16:9 box in the same tint, and gives way once FL-A4 is in the hero.
 assert.ok(visual.includes(`\n.capacity-hero::after{content:"";grid-area:1/2;aspect-ratio:16/9;border-radius:18px;background:${tint}}\n`));
 assert.ok(visual.includes('\n.capacity-hero:has(>#enhancement-capacity)::after{content:none}\n'));
 assert.ok(media.includes('.enhancement-visual{position:relative;overflow:hidden;border-radius:18px;background:#e9e8dc}'));
 assert.doesNotMatch(media,/capacity-hero \.enhancement-visual|#enhancement-capacity/);
});
