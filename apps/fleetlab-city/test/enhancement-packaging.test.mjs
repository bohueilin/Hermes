import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {ARTWORK_GROUPS,BRAND_MEDIA,BRAND_TEXT,renderPage} from '../hosted/site-transform.mjs';
import {LIMITS,captureTree} from '../../../playground/fleetlab/tools/package-proof.mjs';
import {measureIntegratedText,OWNER_LIMITS} from '../../../playground/fleetlab/tools/software-delivery-package.mjs';

test('approved enhancement artwork has its own bounded inventory and holds V1 outside the package',()=>{
 const group=ARTWORK_GROUPS.find(g=>g.root==='apps/fleetlab-city/enhancement-media');
 assert.deepEqual(group,{root:'apps/fleetlab-city/enhancement-media',maxBytes:4194304,maxFiles:8});
 const files=Object.entries(BRAND_MEDIA).filter(([name])=>name.startsWith('enhancement-media/'));
 assert.equal(files.length,7);assert.equal(files.reduce((n,[,r])=>n+r.bytes,0),2685422);
 assert.ok(files.every(([name])=>!name.includes('FL-V1')));
 for(const [name,record]of files){
  assert.equal(record.source,'apps/fleetlab-city/'+name);
  const data=readFileSync(new URL('../../../'+record.source,import.meta.url));
  assert.equal(data.length,record.bytes);assert.equal(createHash('sha256').update(data).digest('hex'),record.sha256);
  if(name.endsWith('.mp4'))assert.ok(data.length<=1200000);
 }
 const root=mkdtempSync(join(tmpdir(),'enhancement-boundary-'));
 try{
  for(let n=0;n<8;n++)writeFileSync(join(root,String(n)),Buffer.alloc(n===0?4194304:0));
  assert.equal(captureTree(root,group).size,8);
  writeFileSync(join(root,'8'),'');assert.throws(()=>captureTree(root,group),/file.*limit|file.*budget/i);rmSync(join(root,'8'));
  writeFileSync(join(root,'0'),Buffer.alloc(4194305));assert.throws(()=>captureTree(root,group),/byte.*limit|byte.*budget/i);
 }finally{rmSync(root,{recursive:true,force:true});}
});

test('only the approved aggregate and capacity ceilings change, while all presentation dependencies count',()=>{
 assert.deepEqual(LIMITS,{legacy_text_bytes:2621440,raw_source_and_tools_bytes:3153920,nf03_closure_bytes:557056,nf04_closure_bytes:524288,emitted_text_bytes:3145728,package_metadata_bytes:40960,source_offer_compressed_bytes:4194304,source_offer_extracted_bytes:4194304,teaching_text_plus_source_bytes:7340032,teaching_generation_bytes:17825792,offline_bytes:2571440});
 assert.equal(OWNER_LIMITS.nf04_closure_bytes,524288);
 const additions=['enhancement-motion.mjs','enhancement-media.mjs','enhancement-media.css'];
 for(const name of additions)assert.ok(BRAND_TEXT.includes(name));
 const teaching=new Map([['src/ui/capacity-app.js','export const a=1;'],['styles.css',''],['_headers',''],...['index.html','boot.js','visual.css','release.json'].map(n=>['network-flows/capacity/'+n,''])]);
 const final=new Map([...teaching,...additions.map(n=>[n,'12345'])]);
 const start=measureIntegratedText(teaching,final);
 for(const name of additions){const copy=new Map(final);copy.set(name,'');assert.equal(start.nf03_closure_bytes-measureIntegratedText(teaching,copy).nf03_closure_bytes,5);}
 final.set('enhancement-media.css',' '.repeat(557056-start.nf03_closure_bytes+5));
 assert.equal(measureIntegratedText(teaching,final).nf03_closure_bytes,557056);
 final.set('enhancement-media.css',final.get('enhancement-media.css')+' ');
 assert.throws(()=>measureIntegratedText(teaching,final),/nf03.*budget/i);
});

test('approved share images use exact scoped illustration alt text and remain idempotent',()=>{
 const a2='Clay panorama of the same vehicle depot at dawn, midday and night, with white autonomous pods leaving, queueing and charging.';
 const a3='Clay diptych of the same city twice: with one depot and long looping routes, and with two depots and shorter local routes.';
 for(const [title,name,alt]of [['FleetLab | Test fleet decisions in simulation','FL-A2-one-fleet-day-panorama.webp',a2],['Fleet day · FleetLab','FL-A2-one-fleet-day-panorama.webp',a2],['City explorer · FleetLab','FL-A3-second-depot-diptych.webp',a3]]){
  const html=renderPage(`<html><head><title>${title}</title></head><body>Honesty framing</body></html>`);
  for(const [attribute,key,value]of [['property','og:image','https://fleetlab.pages.dev/enhancement-media/'+name],['name','twitter:image','https://fleetlab.pages.dev/enhancement-media/'+name],['property','og:image:alt',alt],['name','twitter:image:alt',alt],['name','twitter:card','summary_large_image']])assert.ok(html.includes(`<meta ${attribute}="${key}" content="${value}">`));
  assert.equal(renderPage(html),html);assert.ok(html.includes('Honesty framing'));
 }
});
