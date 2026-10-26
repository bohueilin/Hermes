import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {visibleCopy,copyProblems,DEPOT_HONESTY_SENTENCE} from '../../../playground/fleetlab/tools/check-dist.mjs';
import {STATIC_INTEGRATION_FILES,renderPage} from '../hosted/site-transform.mjs';

// check-dist never sees the hub; its copy rules apply here with exactly two allowances (Step A spec section 7).
const HUB=readFileSync(new URL('../hosted/network-hub.html',import.meta.url),'utf8');
const PAGE=Object.keys(STATIC_INTEGRATION_FILES).find(path=>STATIC_INTEGRATION_FILES[path]==='network-hub.html');
const BOUNDARY='Simplified simulations for learning — not evidence about real-world safety. Nothing here approves deploying a vehicle or policy.';
const FORECAST=/\bforecast\b/gi;
const META='<p class="meta"><strong>Compare:</strong> Reactive vs forecast repositioning</p>';
const copyOf=html=>visibleCopy(html).map(item=>({...item,where:`${PAGE} ${item.where}`}));
const key=item=>JSON.stringify([item.where,item.text]);

// Closed top-level items of the journey strip, with their offsets in the markup.
function cardsOf(markup){
 const strip=/<ol\b[^>]*\bclass="journey-strip"[^>]*>([\s\S]*?)<\/ol>/d.exec(markup);
 return strip?[...strip[1].matchAll(/<li\b[^>]*>[\s\S]*?<\/li>/g)].map(m=>({at:strip.indices[1][0]+m.index,text:m[0]})):[];
}
// Card 04 is the fourth item, numbered 04, linking to Rebalancing, with no nested or unclosed item; otherwise no card is allowed "forecast".
function card04(markup){
 const card=cardsOf(markup)[3];
 return card&&!/<li\b/.test(card.text.slice(1))&&/^04\b/.test(visibleCopy(card.text)[0]?.text??'')&&card.text.includes('href="/network-flows/rebalancing/"')?card:null;
}
function hubProblems(html){
 const markup=html.replace(/<!--[\s\S]*?-->/g,''),card=card04(markup);
 const outside=card?markup.slice(0,card.at)+'<li></li>'+markup.slice(card.at+card.text.length):markup;
 const items=[...copyOf(outside),...(card?copyOf(card.text).map(i=>({...i,card04:true})):[])];
 const boundary=i=>i.where===`${PAGE} text`&&i.text===DEPOT_HONESTY_SENTENCE;
 const dash=items.filter(boundary).length,forecast=items.filter(i=>i.card04).reduce((n,i)=>n+(i.text.match(FORECAST)??[]).length,0);
 // copyProblems also exempts check-dist's approved Round 6 dash sentences on any page, so the hub counts every dash itself.
 const dashes=items.reduce((n,i)=>n+(i.text.match(/[–—]/g)??[]).length,0);
 const problems=copyProblems(items.map(i=>boundary(i)?{...i,text:i.text.replace('—',',')}:i.card04?{...i,text:i.text.replace(FORECAST,'synthetic count')}:i));
 if(JSON.stringify(items.map(key).sort())!==JSON.stringify(copyOf(markup).map(key).sort()))problems.push('allowlist: splitting out card 04 changed the copy items');
 if(dash!==1)problems.push(`allowlist: the boundary sentence appears ${dash} times; exactly one is allowed`);
 if(dashes!==1)problems.push(`allowlist: the hub carries ${dashes} em or en dashes; only the boundary sentence one is allowed`);
 if(forecast>1)problems.push(`allowlist: card 04 uses "forecast" ${forecast} times; at most one is allowed`);
 return {problems,uses:{dash,dashes,forecast}};
}
// Controls start from the live hub without any card 04 "forecast" and edit by structure, so they survive copy changes.
const BASE=HUB.replace(FORECAST,'synthetic count');
const edit=(html,from,to)=>{assert.equal(html.split(from).length,2,`one anchor: ${from}`);return html.replace(from,()=>to);};
const before=(html,anchor,snippet)=>edit(html,anchor,snippet+anchor);
const inCard=(html,n,snippet)=>{const card=cardsOf(html)[n],end=card.at+card.text.length-5;return html.slice(0,end)+snippet+html.slice(end);};
const fails=(html,pattern)=>{const {problems}=hubProblems(html);assert.ok(problems.some(p=>pattern.test(p)),`expected ${pattern}, got ${JSON.stringify(problems)}`);};

test('the hub passes the check-dist copy rules with only the boundary dash and one card 04 forecast allowed',()=>{
 assert.equal(PAGE,'network-flows/index.html');
 assert.equal(DEPOT_HONESTY_SENTENCE,BOUNDARY);
 const cards=cardsOf(HUB);
 assert.equal(cards.length,5);assert.deepEqual(card04(HUB),cards[3]);
 const {problems,uses}=hubProblems(HUB);
 assert.deepEqual(problems,[]);
 assert.equal(uses.dash,1);assert.equal(uses.dashes,1);assert.ok(uses.forecast<=1,`forecast ${uses.forecast}`);
 // Both allowances are load-bearing: check-dist gives the published path no scope exemption.
 for(const [text,rule]of [[BOUNDARY,/^dash: /],['Reactive vs forecast repositioning',/^banned word: "forecast" /]]){
  const found=copyProblems([{where:`${PAGE} text`,text}]);
  assert.equal(found.length,1);assert.match(found[0],rule);
 }
 assert.equal(copyProblems(copyOf(HUB)).length,1+uses.forecast);
 assert.deepEqual(hubProblems(renderPage(HUB,{analytics:true})).problems,[],'as published');
 console.log('hub-copy',JSON.stringify({items:copyOf(HUB).length,...uses}));
});

test('a second dash anywhere on the hub fails',()=>{
 assert.deepEqual(hubProblems(BASE).problems,[]);
 fails(before(BASE,'</main>','<p>One more — dash.</p>'),/^dash: /);
 fails(inCard(BASE,3,'<p>Reactive – planned</p>'),/^dash: /);
 fails(before(BASE,'</footer>','<a href="/">Back &mdash; home</a>'),/^dash: /);
 fails(before(BASE,'</main>',`<p>${BOUNDARY}</p>`),/appears 2 times/);
 fails(before(BASE,'</main>',`<p title="${BOUNDARY}">Limits</p>`),/^dash: .*title attribute/);
 fails(edit(BASE,BOUNDARY,BOUNDARY.replace('real-world safety.','real-world safety — at all.')),/^dash: /);
 fails(edit(BASE,BOUNDARY,BOUNDARY.replace('—',',')),/appears 0 times/);
 // check-dist's Round 6 exemptions do not reach the hub.
 const round6='The difference is the change — everything else was identical.';
 assert.deepEqual(copyProblems([{where:`${PAGE} text`,text:round6}]),[]);
 fails(before(BASE,'</main>',`<p>${round6}</p>`),/carries 2 em or en dashes/);
 fails(before(BASE,'</aside>',`<p title="${round6}">Limits</p>`),/carries 2 em or en dashes/);
});

test('forecast is allowed once inside card 04 only',()=>{
 const once=hubProblems(inCard(BASE,3,META));
 assert.deepEqual(once.problems,[]);assert.equal(once.uses.forecast,1);
 for(const n of [0,1,2,4])fails(inCard(BASE,n,META),/^banned word: "forecast" /);
 for(const anchor of ['</h1>','</ol>','</aside>','</footer>'])fails(before(BASE,anchor,' forecast '),/^banned word: "forecast" /);
 fails(inCard(BASE,3,META+META),/uses "forecast" 2 times/);
 fails(inCard(BASE,3,META.replace('forecast','forecasts')),/^banned word: "forecasts" /);
 fails(inCard(BASE,3,META.replace('Reactive','Live')),/^banned word: "Live" /);
 // A reorder or an unclosed card 04 removes the allowance instead of moving or widening it.
 const [,,,r1,r3]=cardsOf(BASE);
 const swapped=BASE.slice(0,r1.at)+r3.text+BASE.slice(r1.at+r1.text.length,r3.at)+r1.text+BASE.slice(r3.at+r3.text.length);
 assert.equal(cardsOf(swapped)[4].text,r1.text);
 fails(inCard(swapped,4,META),/^banned word: "forecast" /);
 const merged=inCard(BASE,4,META),end=r1.at+r1.text.length-5;
 assert.equal(merged.slice(end,end+5),'</li>');
 fails(merged.slice(0,end)+merged.slice(end+5),/^banned word: "forecast" /);
});
