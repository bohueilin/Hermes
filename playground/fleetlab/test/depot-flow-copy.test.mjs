import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync,readdirSync} from 'node:fs';
import {COPY_MODULES,copyProblems,literalsOf} from '../tools/check-dist.mjs';
test('all depot lesson modules are guarded, including inserted banned language',()=>{
 for(const dir of ['ui','model'])for(const name of readdirSync(new URL(`../src/${dir}/`,import.meta.url)).filter(n=>/^depot-(flow|cohort).*\.js$/.test(n))){const path=`src/${dir}/${name}`,where=`${path} string`;assert.ok(COPY_MODULES.includes(path),path);const source=readFileSync(new URL(`../${path}`,import.meta.url),'utf8');assert.deepEqual(copyProblems(literalsOf(source).map(text=>({where,text}))),[],path);for(const text of ['predictions','live','unseen—dash','Waymo hiring portfolio'])assert.ok(copyProblems([{where,text}]).length,text);}
});
