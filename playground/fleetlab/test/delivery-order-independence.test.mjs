import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {resolve,dirname} from 'node:path';
test('independent verifier closures cannot import scheduling, search, data or presentation',()=>{
 const seen=new Set();function walk(path){if(seen.has(path))return;seen.add(path);const text=readFileSync(path,'utf8');
  for(const match of text.matchAll(/(?:from\s*|import\s*\()\s*['"]([^'"]+)['"]/g)){
   const next=resolve(dirname(path),match[1]);assert.ok(!/\/(?:ui|data|runtime)\//.test(next));assert.ok(!/\/(?:delivery-order(?:-search)?|software-delivery)\.js$/.test(next));walk(next);}}
 for(const name of ['delivery-order-verify','delivery-order-study-verify'])walk(resolve(`playground/fleetlab/src/model/${name}.js`));
});
