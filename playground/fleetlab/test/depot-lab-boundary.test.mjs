// Import boundaries and source rules for the independent verifier (engineering note 1, rules 1 to 3; reconciliation 11.5
// Task 5): the verifier never reaches the engine, the engine never reaches the verifier, and depot UI modules reach
// neither. Source rules: no clock, randomness, page globals, storage or network; visitor-copy literals; byte budget.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync,readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join,resolve,relative,sep} from 'node:path';
import {parseModule,maskSource} from '../tools/pack.mjs';
const SRC=fileURLToPath(new URL('../src/',import.meta.url)),VERIFY=join(SRC,'model','depot-lab-verify'),LAB=join(SRC,'model','depot-lab');
const ENGINE=['state','policy','allocation','engine','ledger'].map(n=>join(LAB,`${n}.js`));
const CONTRACT=['rational','units','canonical','identity','profiles','schema','task-graph','presets','registry','compare'].map(n=>join(LAB,`${n}.js`));
const js=dir=>readdirSync(dir).filter(f=>f.endsWith('.js')).map(f=>join(dir,f)).sort();
const name=f=>relative(SRC,f).split(sep).join('/');
const importsOf=f=>parseModule(readFileSync(f,'utf8'),name(f)).imports.map(i=>resolve(dirname(f),i.specifier));
function closure(roots){const seen=new Set(),stack=[...roots];while(stack.length){const f=stack.pop();if(seen.has(f))continue;seen.add(f);stack.push(...importsOf(f));}return seen;}
const VFILES=js(VERIFY);
test('the verifier files exist and import only each other and the contract modules',()=>{
 assert.deepEqual(VFILES.map(name),['allocation-check','blockage','metrics','policy-check','reconstruct','verify'].map(n=>`model/depot-lab-verify/${n}.js`));
 for(const f of VFILES)for(const t of importsOf(f))assert.ok(VFILES.includes(t)||CONTRACT.includes(t),`${name(f)} imports ${name(t)}`);
});
test('the verifier never reaches an engine, runtime or UI file, even transitively',()=>{
 const reach=[...closure(VFILES)].map(name);
 for(const f of ENGINE)assert.ok(!reach.includes(name(f)),`verifier reaches ${name(f)}`);
 assert.deepEqual(reach.filter(f=>f.startsWith('runtime/')||f.startsWith('ui/')),[]);
});
test('the engine imports nothing from the verifier',()=>{
 for(const f of ENGINE)assert.ok(![...closure([f])].some(x=>x.startsWith(VERIFY+sep)),`${name(f)} reaches the verifier`);
});
test('depot UI modules reach no engine, verifier, policy or allocation file',()=>{
 const ui=js(join(SRC,'ui')).filter(f=>/depot-lab-[^/]*\.js$/.test(f));
 assert.ok(ui.length>0);
 for(const f of ui){const reach=[...closure([f])];for(const x of reach)assert.ok(!ENGINE.includes(x)&&!x.startsWith(VERIFY+sep),`${name(f)} reaches ${name(x)}`);}
});
test('verifier source: model rules, module forms and the 131,072-byte budget',()=>{
 let bytes=0;
 for(const f of VFILES){
  const src=readFileSync(f,'utf8'),code=maskSource(src);bytes+=Buffer.byteLength(src);
  for(const [re,what]of [[/\bMath\s*\.\s*random\b/,'Math.random'],[/\bDate\b/,'Date'],[/\bperformance\b/,'performance'],[/\b(?:setTimeout|setInterval|setImmediate|queueMicrotask|requestAnimationFrame)\b/,'timer'],[/\b(?:window|document|globalThis|localStorage|sessionStorage|indexedDB|fetch)\b/,'global'],[/\bcrypto\s*\.\s*subtle\b/,'crypto.subtle'],[/\b(?:innerHTML|outerHTML|insertAdjacentHTML|eval)\b|\bnew\s+Function\b/,'markup or eval'],[/\bexport\s+default\b|\bimport\s*\(|\bimport\s*\.\s*meta\b/,'module form']])
   assert.ok(!re.test(code),`${name(f)} uses ${what}`);
  const parsed=parseModule(src,name(f));assert.ok(parsed.imports.every(i=>i.kind==='named'),`${name(f)} uses named imports only`);
 }
 assert.ok(bytes<131072,`verifier is ${bytes} bytes`);
});
test('verifier string literals pass the visitor-copy scan',()=>{
 const banned=/[–—]|\b(?:predict\w*|forecast\w*|live|real-?time|monitoring)\b|expected traffic/i;
 for(const f of VFILES){const src=readFileSync(f,'utf8'),lits=[];maskSource(src,{literals:lits});for(const [a,b]of lits)assert.ok(!banned.test(src.slice(a,b)),`${name(f)}: ${src.slice(a,b)}`);}
});
