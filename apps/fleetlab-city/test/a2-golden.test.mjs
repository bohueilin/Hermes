import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {installFakeDom,serialize} from '../../../playground/fleetlab/test/helpers/fake-dom.mjs';
import {decorateVisitors} from '../hosted/visitor.mjs';
import {BRAND_MEDIA} from '../hosted/site-transform.mjs';

const sha=b=>createHash('sha256').update(b).digest('hex');
function element(tag,attrs={},children=[]){
 const n=document.createElement(tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);
 for(const c of [children].flat())n.appendChild(typeof c==='string'?document.createTextNode(c):c);return n;
}
function fixture(run){
 const restore=installFakeDom(),prior=globalThis.MutationObserver,changes=[];
 globalThis.MutationObserver=class{constructor(fn){changes.push(fn);}observe(){}disconnect(){}};
 try{run(changes);}finally{globalThis.MutationObserver=prior;restore();}
}
// Step A golden (spec section 5): the shipped Fleet day figure, byte for byte.
const A2='<figure id="enhancement-fleet-day" class="enhancement-media"><div class="enhancement-visual"><img src="/enhancement-media/FL-A2-one-fleet-day-panorama.webp" alt="Clay panorama of the same vehicle depot at dawn, midday and night, with white autonomous pods leaving, queueing and charging." width="2352" height="1008" loading="lazy" decoding="async"></div>'
 +'<figcaption><p class="enhancement-fence">Concept illustration · not simulation output</p><p class="enhancement-caption">One fleet day: out at dawn, queued by midday, charging by night. Your run will write its own version.</p></figcaption></figure>';

test('A2 Fleet day figure matches its 602-byte golden, follows the title, and decorates once',()=>fixture(()=>{
 const title=element('h1',{},'Fleet day'),frame=element('section',{class:'teaching-frame'},[title,element('p',{},'Not calibrated.')]);
 const teaching=element('div',{class:'ops-teaching'},frame),intro=element('section',{class:'ops-intro'},teaching);
 document.body.appendChild(element('main',{class:'operations-lab'},intro));decorateVisitors(document);
 const hero=frame.querySelector('#enhancement-fleet-day');assert.ok(hero);
 const figure=serialize(hero);assert.equal(figure,A2);
 assert.equal(Buffer.byteLength(figure),602);assert.equal(sha(figure),'aa3a9cd27182bc1a5d68c63cb5061280864502febd6c74c1a7cc141e289029ea');
 assert.equal(title.nextSibling,hero);assert.equal(hero.querySelector('video'),null);
 // Whole frame pinned, so held V1 cannot sit beside the figure either.
 const once=serialize(frame),image=hero.querySelector('img');assert.equal(once,'<section class="teaching-frame"><h1>Fleet day</h1>'+A2+'<p>Not calibrated.</p></section>');
 assert.equal(frame.querySelector('video'),null);decorateVisitors(document);
 assert.equal(document.querySelectorAll('#enhancement-fleet-day').length,1);assert.equal(serialize(frame),once);
 // Node identity, not just equal markup: a rebuilt figure or image would restart the lazy load.
 assert.ok(frame.querySelector('#enhancement-fleet-day')===hero,'second decorate must keep the same figure node');
 assert.ok(hero.querySelector('img')===image,'second decorate must keep the same image node');
}));

test('A2 stylesheet and the FL-A2 still are pinned whole',()=>{
 const css=readFileSync(new URL('../hosted/enhancement-media.css',import.meta.url));
 assert.equal(css.length,3057);assert.equal(sha(css),'9e5c35ae84eca53c2210e6a2841412dfe98e3dfaaf4bf01dde1f3c987434c1b4');
 const record=BRAND_MEDIA['enhancement-media/FL-A2-one-fleet-day-panorama.webp'];
 assert.deepEqual(record,{bytes:431948,sha256:'e5299c6fd31c5521b2f36d1a519c5f67abc1c3bae64b66fe5d6a4267f96a7522',source:'apps/fleetlab-city/enhancement-media/FL-A2-one-fleet-day-panorama.webp'});
 const data=readFileSync(new URL('../../../'+record.source,import.meta.url));
 assert.equal(data.length,431948);assert.equal(sha(data),'e5299c6fd31c5521b2f36d1a519c5f67abc1c3bae64b66fe5d6a4267f96a7522');
});
