import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {colour,isWarm,readSources,scanSources,snapshot,format} from './colour-scan.mjs';

// Owner rule: amber and terracotta never mark a new interactive state or warning. Every warm use at the
// Step A base is grandfathered in the baseline; the test fails only on additions, and removals are logged.
// Limitation: a script key is only 'file | literal' and identifiers are not followed, so a new state that reuses
// an existing warm constant adds no literal and passes, and a count freed by a removal can be reused in that file.
const baselineText=readFileSync(new URL('./fixtures/warm-colour-baseline.json',import.meta.url),'utf8');
const baseline=JSON.parse(baselineText);
const sources=readSources();
const STYLESHEETS=['apps/fleetlab-city/hosted/brand.css','apps/fleetlab-city/hosted/enhancement-media.css','apps/fleetlab-city/hosted/integration.css','apps/fleetlab-city/hosted/map-sources.css','apps/fleetlab-city/hosted/network-hub.css','apps/fleetlab-city/hosted/not-found.css','apps/fleetlab-city/hosted/visitor.css',
 ...['capacity','delivery-order','depot-lab','dispatch','rebalancing','software-delivery'].map(lesson=>`playground/fleetlab/${lesson}/visual.css`),'playground/fleetlab/styles.css'];

// Multiset difference against a reference snapshot; an addition lists every position of its key.
function changes(scan,reference){
 const now=snapshot(scan),added=[],removed=[];
 for(const kind of ['literals','tokens']){
  const was=reference[kind];
  for(const [key,n] of Object.entries(now[kind]))if(n>(was[key]??0))added.push(`${key} +${n-(was[key]??0)} at ${scan[kind].filter(h=>h.key===key).map(h=>h.at).join(', ')}`);
  for(const [key,n] of Object.entries(was))if(n>(now[kind][key]??0))removed.push(`${key} -${n-(now[kind][key]??0)}`);
 }
 return {added,removed};
}
// Controls scan small in-memory sources, so they hold whatever the shipped files later become.
const scanOf=files=>scanSources(Object.entries(files));
const delta=(before,after)=>changes(scanOf(after),snapshot(scanOf(before)));

test('the colour lock reads every shipped network-flows stylesheet, page and script',t=>{
 const files=[...sources.keys()],pages=files.filter(f=>f.endsWith('.html')),scripts=files.filter(f=>/\.m?js$/.test(f));
 assert.deepEqual(files.filter(f=>f.endsWith('.css')),STYLESHEETS);
 for(const page of ['playground/fleetlab/index.html','apps/fleetlab-city/hosted/network-hub.html',...STYLESHEETS.filter(f=>f.endsWith('/visual.css')).map(f=>f.replace('visual.css','index.html'))])assert.ok(pages.includes(page),page);
 assert.ok(scripts.includes('apps/fleetlab-city/hosted/visitor.mjs')&&scripts.includes('playground/fleetlab/src/ui/iso.js'));
 t.diagnostic(`${STYLESHEETS.length} stylesheets, ${pages.length} pages, ${scripts.length} scripts`);
});

test('no warm colour or warm-token use is added beyond the grandfathered baseline',t=>{
 assert.equal(baselineText,format(baseline),'the baseline is sorted and canonical (node test/colour-scan.mjs prints it)');
 const scan=scanSources(sources),{added,removed}=changes(scan,baseline),warm=scan.literals.filter(h=>h.warm);
 for(const line of removed)t.diagnostic('removed since the baseline: '+line);
 assert.deepEqual(added,[],'amber and terracotta must not mark a new state or warning; added:\n'+added.join('\n'));
 t.diagnostic(`${scan.literals.length} colour literals; ${warm.length} warm hits (${new Set(warm.map(h=>h.key.split(' | ').at(-1))).size} distinct) in ${new Set(warm.map(h=>h.at.split(':')[0])).size} files; ${scan.tokens.length} warm-token uses`);
});

test('warm is alpha above 0, chroma at least 0.06 and hue in [12°, 60°); other colour functions throw',()=>{
 for(const literal of ['hsl(30 60% 40%)','hsla(30,60%,40%,.5)','#b18347','#B18347','#d98e77','#fff1ae','#fbf8eb','hsl(12 100% 50%)','hsl(59.9 100% 50%)','hsl(30 6% 50%)','rgb(177 131 71 / 1%)','#b1834701','orange'])assert.equal(isWarm(literal),true,literal);
 for(const literal of ['#c0392b','#762d1f','hsl(11.9 100% 50%)','hsl(60 100% 50%)','hsl(30 5.9% 50%)','#f1ede2','#b1834700','rgba(177,131,71,0)','white','#166653'])assert.equal(isWarm(literal),false,literal);
 assert.equal(colour('#c0392b').hue.toFixed(1),'5.6');
 for(const literal of ['color-mix(in srgb, #b18347 50%, white)','oklch(70% 0.1 60)','oklab(70% 0.1 0.1)','lab(50% 20 40)','lch(50% 40 60)','hwb(30 20% 30%)','color(srgb 0.7 0.5 0.3)','rgb(var(--r) 0 0)','hsl(0.1turn 60% 40%)'])assert.throws(()=>isWarm(literal),/unclassified colour/,literal);
});

test('controls: a new warm focus ring, state or token use fails; red, comments, selectors and reformats do not',()=>{
 const sheet=':root{--amber:#765a24}\n.state{color:#166653}\n',warning='.action-error{background:#f8e7df;border:1px solid #dcb9a7}';
 assert.deepEqual(delta({'a.css':sheet},{'a.css':sheet+'.new-control:focus-visible{outline:2px solid #b18347}'}).added,['a.css | .new-control:focus-visible | outline | #b18347 +1 at a.css:3:46']);
 assert.deepEqual(delta({'a.css':sheet},{'a.css':sheet+'@media (min-width:1px){.new-control{border-color:hsl(30 60% 40%)}}'}).added,['a.css | @media (min-width:1px) | .new-control | border-color | hsl(30 60% 40%) +1 at a.css:3:50']);
 assert.deepEqual(delta({'a.css':sheet},{'a.css':sheet+'.new-control{outline:2px solid orange}'}).added,['a.css | .new-control | outline | orange +1 at a.css:3:32']);
 assert.deepEqual(delta({'a.css':sheet},{'a.css':sheet+".new-select{background-image:url(\"data:image/svg+xml,%3Csvg%3E%3Cpath fill='%23b18347'/%3E%3C/svg%3E\")}"}).added,['a.css | .new-select | background-image | #b18347 +1 at a.css:3:77']);
 const list='.state-card[data-state=invalid],.state-card[data-state=incomplete]>b{border-color:#8a5a33}';
 assert.deepEqual(delta({'a.css':sheet+list},{'a.css':sheet+list.replace(',',' ,\n ').replace('>',' > ')}),{added:[],removed:[]});
 assert.deepEqual(delta({'a.css':sheet},{'a.css':sheet+'.new-control{color:#c0392b/* was #b18347 */}#fab{border:0}'}),{added:[],removed:[]});
 assert.deepEqual(delta({'a.css':sheet},{'a.css':sheet+'.delivery-target.is-late{color:var(--amber)}'}).added,['a.css | .delivery-target.is-late | color | var(--amber) +1 at a.css:3:32']);
 assert.deepEqual(delta({'a.css':sheet+warning},{'a.css':sheet+warning.replace('.action-error','.action-error,.new-warning')}),{
  added:['a.css | .action-error,.new-warning | background | #f8e7df +1 at a.css:3:39','a.css | .action-error,.new-warning | border | #dcb9a7 +1 at a.css:3:64'],
  removed:['a.css | .action-error | background | #f8e7df -1','a.css | .action-error | border | #dcb9a7 -1']});
 assert.deepEqual(delta({'a.css':sheet+warning},{'a.css':sheet}).added,[]);
 assert.throws(()=>scanOf({'a.css':'.x{color:color-mix(in srgb,#b18347 50%,white)}'}),/^Error: unclassified colour color-mix\(in srgb,#b18347 50%,white\) at a\.css:1:10$/);
});

test('controls: warm markup attributes, style blocks and script literals are tracked too, and script keys ratchet',()=>{
 const tokens={'a.css':':root{--cond:#935f00;--car-empty:#eb6834}'};
 assert.deepEqual(delta({...tokens,'p.html':'<body></body>'},{...tokens,'p.html':'<body><p style="border-left:3px solid #b18347">x</p><svg><rect fill="orange"/></svg><style>.late{color:var(--cond)}</style><script type="module">const c="#d59a42";</script></body>'}).added,
  ['p.html | #d59a42 +1 at p.html:1:155','p.html | <p style> | border-left | #b18347 +1 at p.html:1:39','p.html | <rect> | fill | orange +1 at p.html:1:70','p.html | <style> | .late | color | var(--cond) +1 at p.html:1:104']);
 assert.deepEqual(delta({...tokens,'s.js':"const fill='#d59a42';\n"},{...tokens,'s.js':"const fill='#d59a42';\nconst late='#d59a42',warning='var(--cond)',token='--car-empty',style=`border:1px solid tan`,tone='goldenrod';\n"}).added,
  ['s.js | #d59a42 +1 at s.js:1:13, s.js:2:13','s.js | tan +1 at s.js:2:88','s.js | goldenrod +1 at s.js:2:99','s.js | var(--cond) +1 at s.js:2:31','s.js | --car-empty +1 at s.js:2:51']);
 assert.deepEqual(delta({'p.html':'<body></body>'},{'p.html':'<body><p style="border:1px solid tan">x</p><svg><rect fill=orange /></svg><p style=color:#b18347>x</p><svg><rect data-note="a>b" fill="#b18347"/><rect><animate attributeName="fill" values="#fff;#b18347"/></rect></svg><table bgcolor="#b18347"></table><button onfocus="this.style.outline=\'2px solid orange\'" onblur="f(&quot;#d59a42&quot;)">x</button></body>'}).added,
  ['p.html | <p style> | border | tan +1 at p.html:1:34','p.html | <rect> | fill | orange +1 at p.html:1:60','p.html | <p style> | color | #b18347 +1 at p.html:1:90','p.html | <rect> | fill | #b18347 +1 at p.html:1:136','p.html | <animate> | values | #b18347 +1 at p.html:1:195','p.html | <table> | bgcolor | #b18347 +1 at p.html:1:234','p.html | <button> | onfocus | orange +1 at p.html:1:298','p.html | <button> | onblur | #d59a42 +1 at p.html:1:323']);
 assert.deepEqual(delta({'s.js':''},{'s.js':"el.style.outline='2px solid orange';el.style.boxShadow='0 0 0 3px goldenrod';\nel.style.cssText='text-shadow:0 0 2px tan';el.style.cssText='background-image:linear-gradient(peru,white)';\nel.style.cssText='border-image:linear-gradient(chocolate,white) 1;column-rule:1px solid sienna;scrollbar-color:sandybrown white';\n"}).added,
  ['s.js | orange +1 at s.js:1:29','s.js | goldenrod +1 at s.js:1:67','s.js | tan +1 at s.js:2:39','s.js | peru +1 at s.js:2:95','s.js | chocolate +1 at s.js:3:48','s.js | sienna +1 at s.js:3:89','s.js | sandybrown +1 at s.js:3:112']);
 assert.deepEqual(delta({'s.js':''},{'s.js':"const note='Pick the orange route',tone='white';\n"}),{added:[],removed:[]});
 // Removals, script keys included, are reported and never fail.
 assert.deepEqual(delta({'s.js':"const a='#d59a42',b='#d59a42';",'a.css':'.x{color:#d59a42}'},{'s.js':"const a='#d59a42';",'a.css':''}),{added:[],removed:['s.js | #d59a42 -1','a.css | .x | color | #d59a42 -1']});
 assert.throws(()=>scanOf({'s.js':'const shade=r=>`rgba(${r},0,0,1)`;'}),/unclassified colour rgba\(/);
});
