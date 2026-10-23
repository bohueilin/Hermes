import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,rmSync,symlinkSync,renameSync,cpSync} from 'node:fs';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {stageFixture,writeFiles,fingerprint,inventory} from './stage-fixture.mjs';
import {verifyStage} from '../deploy/stage-guard.mjs';
import {cityEntryFiles} from '../deploy/city-evidence.mjs';
import {renderPage} from '../hosted/site-transform.mjs';

test('City source evidence rejects resealed entry, switch, offers and extra paths',()=>{
 const f=stageFixture();
 try{
  assert.ok(verifyStage(f.site,f.commit,f.source)>0);
  const generated=join(f.root,'entry');
  execFileSync('python3',['-B','-c',"import runpy,sys; from pathlib import Path; p=Path(sys.argv[2]); p.mkdir(); runpy.run_path(sys.argv[1])['make_entry'](p,sys.argv[3])",join(f.source,'apps/fleetlab-city/tools/prepare-launch.py'),generated,'0123456789abcdef']);
  for(const [path,data] of cityEntryFiles('0123456789abcdef',{branded:false}))assert.equal(readFileSync(join(generated,path.split('/').at(-1)),'utf8'),data);
  assert.throws(()=>cityEntryFiles('../invalid'),/entry generation/);
  const paths=['city-explorer/index.html',`city-explorer/switch-${f.selection.current.path.split('/').at(-1)}.mjs`,
   'city-explorer/sources/index.html','city-explorer/sources/manifest.json','city-explorer/sources/database.tar.gz'];
  for(const path of paths){
   const full=join(f.site,path),original=readFileSync(full);
   writeFileSync(full,Buffer.concat([original,Buffer.from('\nresealed change')]));f.seal();
   assert.throws(()=>verifyStage(f.site,f.commit,f.source),/City.*(?:differ|inventory|source)/i,path);
   writeFileSync(full,original);
  }
  for(const path of ['city-explorer/extra.mjs','city-explorer/switch-0000000000000000.mjs',
   'city-explorer/releases/0000000000000000/index.html','city-explorer/sources/extra.txt']){
   writeFiles(f.site,[[path,'unexpected']]);f.seal();
   assert.throws(()=>verifyStage(f.site,f.commit,f.source),/City.*inventory/i,path);
   rmSync(join(f.site,path));
  }
  const offer=JSON.parse(readFileSync(join(f.offer,'manifest.json'))),rawIndex='<html><head></head><body>Replacement source offer</body></html>',archive='replacement archive';
  offer.files['index.html']=fingerprint(rawIndex);offer.files['database.tar.gz']=fingerprint(archive);
  writeFiles(f.review,[['inputs/city-source-offer-manifest.json',JSON.stringify(offer)],['inputs/city-source-offer-index.html',rawIndex]]);
  const served=renderPage(rawIndex,{analytics:true});
  writeFiles(f.site,[['city-explorer/sources/index.html',served],['city-explorer/sources/database.tar.gz',archive],
   ['city-explorer/sources/manifest.json',JSON.stringify({...offer,files:{...offer.files,'index.html':fingerprint(served)}})]]);f.seal();
  assert.throws(()=>verifyStage(f.site,f.commit,f.source),/City approved source offer/i,'a mutually consistent replacement source offer cannot approve itself');
 }finally{f.cleanup();}
});

test('City review inputs require pinned original bytes and regular fixed paths',()=>{
 const f=stageFixture();
 try{
  for(const name of ['city-base-release.json','city-source-offer-manifest.json','city-source-offer-index.html']){
   const path=join(f.review,'inputs',name),original=readFileSync(path);
   writeFileSync(path,Buffer.concat([original,Buffer.from(' ')]));
   assert.throws(()=>verifyStage(f.site,f.commit,f.source),/City.*(?:approved|source|index)/i,name);
   writeFileSync(path,original);
   const outside=join(f.root,name);renameSync(path,outside);symlinkSync(outside,path);
   assert.throws(()=>verifyStage(f.site,f.commit,f.source),/City.*regular/i,name);
   rmSync(path);renameSync(outside,path);
   rmSync(path);assert.throws(()=>verifyStage(f.site,f.commit,f.source),/ENOENT|City.*input/i,name);writeFileSync(path,original);
  }
  const inputs=join(f.review,'inputs'),outsideInputs=join(f.root,'retained-inputs');
  renameSync(inputs,outsideInputs);symlinkSync(outsideInputs,inputs);
  assert.throws(()=>verifyStage(f.site,f.commit,f.source),/City.*regular/i);
  rmSync(inputs);renameSync(outsideInputs,inputs);
  const pins=join(f.source,'apps/fleetlab-city/deploy/approved-inputs.json'),original=readFileSync(pins),value=JSON.parse(original);
  for(const mutation of [{...value,extra:true},{...value,schema:'other'},
   {...value,base_release:{...value.base_release,sha256:'A'.repeat(64)}},
   ...[null,42,{},[]].map(sha256=>({...value,base_release:{...value.base_release,sha256}})),
   {...value,source_offer_manifest:{...value.source_offer_manifest,path:'elsewhere'}}]){
   writeFileSync(pins,JSON.stringify(mutation));
   assert.throws(()=>verifyStage(f.site,f.commit,f.source),/City.*pin/i);
  }
  writeFileSync(pins,original);
  // Replace the base, both derived generations and their evidence together; only the pin remains.
  writeFileSync(join(f.raw,'app.mjs'),'export const recorded = "replacement";');
  const replaced=JSON.parse(f.originalManifest);replaced.files=inventory(f.raw);delete replaced.files['release.json'];
  writeFileSync(join(f.raw,'release.json'),JSON.stringify(replaced));
  const projected=join(f.root,'replacement-base'),branded=join(f.root,'replacement-current'),tool=join(f.source,'apps/fleetlab-city/tools/hosted-brand.py');
  execFileSync('python3',['-B',tool,'--viewer',f.raw,'--out',projected,'--project-base']);
  execFileSync('python3',['-B',tool,'--viewer',projected,'--out',branded,'--source-commit',f.commit]);
  const prior={current:f.selection.current.path,rollback:f.selection.rollback.path};
  for(const [key,input] of [['current',branded],['rollback',projected]]){
   const sha256=fingerprint(readFileSync(join(input,'release.json'))).sha256;
   f.selection[key]={path:'city-explorer/releases/'+sha256.slice(0,16),release_sha256:sha256};
   cpSync(input,join(f.site,f.selection[key].path),{recursive:true});rmSync(join(f.site,prior[key]),{recursive:true});
  }
  rmSync(join(f.site,'city-explorer/switch-'+prior.current.split('/').at(-1)+'.mjs'));
  writeFiles(f.site,cityEntryFiles(f.selection.current.path.split('/').at(-1)));
  writeFileSync(join(f.site,'_headers'),readFileSync(join(f.site,'_headers'),'utf8').replace('/'+prior.rollback+'/*','/'+f.selection.rollback.path+'/*'));
  writeFiles(f.site,[['publication.json',JSON.stringify(f.selection)]]);
  writeFiles(f.review,[['inputs/city-base-release.json',readFileSync(join(f.raw,'release.json'))]]);f.seal();
  assert.throws(()=>verifyStage(f.site,f.commit,f.source),/City approved base/i,'resealed replacement base and both derived generations cannot approve themselves');
 }finally{f.cleanup();}
});
