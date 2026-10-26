import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,statSync,mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {ARTWORK_GROUPS,BRAND_MEDIA} from '../hosted/site-transform.mjs';
import {MEDIA_LIMITS} from '../../../playground/fleetlab/tools/media.mjs';

// Two candidate stills stay on caveat until they are re-rendered (Step A spec section 8). Only their hashes live here:
// neither file is in the repository. This catches byte-identical placement only; a re-encode is a design-review matter.
const KNOWN_CAVEAT=[
 {name:'NF26v3-empty-rebalancing-map.webp',bytes:183778,sha256:'d29d59f589d906114286bc0fef1b58b6e1ed71901d038946305714e8fa539b33'},
 {name:'NF26v3-shared-depot-copy.webp',bytes:129956,sha256:'9196915e76a3cd7e3b9a3a684ae98ea4f648d55324ef29d14656460357211b3e'},
];
const REPO=fileURLToPath(new URL('../../../',import.meta.url));
const PLAYGROUND_MEDIA='playground/fleetlab/media';
const HEX=/^[0-9a-f]{64}$/;
const sha=data=>createHash('sha256').update(data).digest('hex');
const filesUnder=(base,root)=>readdirSync(join(base,root),{recursive:true}).map(name=>join(root,name)).filter(name=>statSync(join(base,name)).isFile()).sort();
const hashed=(base,root)=>filesUnder(base,root).map(name=>({name,sha256:sha(readFileSync(join(base,name)))}));
const hits=(records,caveats=KNOWN_CAVEAT)=>records.filter(r=>caveats.some(c=>c.sha256===r.sha256)).map(r=>r.name);

test('the KNOWN_CAVEAT fixture holds two distinct, well-formed hashes',()=>{
 assert.equal(KNOWN_CAVEAT.length,2);
 for(const c of KNOWN_CAVEAT){
  assert.deepEqual(Object.keys(c),['name','bytes','sha256']);
  assert.match(c.name,/^NF26v3-[a-z-]+\.webp$/);assert.ok(Number.isInteger(c.bytes)&&c.bytes>0,c.name);assert.match(c.sha256,HEX,c.name);
 }
 assert.equal(new Set(KNOWN_CAVEAT.map(c=>c.name)).size,2);assert.equal(new Set(KNOWN_CAVEAT.map(c=>c.sha256)).size,2);
});

test('no artwork record and no artwork or media file carries a KNOWN_CAVEAT still',()=>{
 const records=Object.entries(BRAND_MEDIA).map(([name,r])=>({name,sha256:r.sha256}));
 assert.ok(records.length>0);for(const r of records)assert.match(r.sha256,HEX,r.name);
 assert.deepEqual(hits(records),[]);
 for(const path of MEDIA_LIMITS.keys())assert.ok(path.startsWith('media/'),path);
 const roots=[...ARTWORK_GROUPS.map(g=>g.root),PLAYGROUND_MEDIA],files=roots.flatMap(root=>hashed(REPO,root));
 const scanned=new Set(files.map(f=>f.name));
 for(const root of roots)assert.ok(files.some(f=>f.name.startsWith(root+'/')),`${root} is empty`);
 for(const r of Object.values(BRAND_MEDIA))assert.ok(scanned.has(r.source),`${r.source} was not scanned`);
 for(const path of MEDIA_LIMITS.keys())assert.ok(scanned.has('playground/fleetlab/'+path),`${path} was not scanned`);
 assert.deepEqual(hits(files),[]);
 console.log('known-caveat',JSON.stringify({records:records.length,roots:roots.length,files:files.length}));
});

test('the caveat scan finds a byte-identical copy at any depth, and only that',()=>{
 const base=mkdtempSync(join(tmpdir(),'known-caveat-'));
 try{
  mkdirSync(join(base,'media/nested'),{recursive:true});
  writeFileSync(join(base,'media/nested/renamed.webp'),'candidate still');writeFileSync(join(base,'media/reencoded.webp'),'candidate still!');
  const caveat=[{name:'candidate.webp',bytes:15,sha256:sha('candidate still')}];
  assert.deepEqual(hits(hashed(base,'media'),caveat),['media/nested/renamed.webp']);
  assert.deepEqual(hits([{name:'record',sha256:KNOWN_CAVEAT[1].sha256}]),['record']);
 }finally{rmSync(base,{recursive:true,force:true});}
});
