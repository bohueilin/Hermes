import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';

// The hosted prose floor sets 16 px/1.6 on studio paragraphs. The depot flow lab and the capacity page size their own
// definition, help, status, wait-reason and question lines and their lede, so the floor leaves them alone and no
// hosted rule overrides the lab's lede; otherwise the lab's Compare button falls below a phone's first screen.
const css=readFileSync(new URL('../hosted/integration.css',import.meta.url),'utf8');
const floor=/^\.fleet-studio p((?::not\([^()]*\))+)\{font-size:16px;line-height:1\.6\}$/m.exec(css);

test('the hosted prose floor excludes the lab and capacity lines that set their own size',()=>{
 assert.ok(floor,'the .fleet-studio p prose floor rule is present');
 const excluded=[...floor[1].matchAll(/:not\(([^()]*)\)/g)].map(m=>m[1]);
 for(const name of ['.flow-lede','.flow-definition','.flow-run-help','.flow-status','.flow-wait-reason','.capacity-status','.capacity-question'])assert.ok(excluded.includes(name),name);
});

test('no hosted rule overrides the depot flow lab lede',()=>{
 assert.doesNotMatch(css,/\.flow-lede\s*[,{]/);
 assert.doesNotMatch(css,/\.depot-flow-lab\s+\.flow-lede/);
});
