import {stageFixture,fingerprint,writeFiles,inventory} from './stage-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,symlinkSync,cpSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {verifyStage,releaseCommand} from '../deploy/stage-guard.mjs';
import {verifyBrandedCity} from '../deploy/branded-city.mjs';
import {cityEntryFiles} from '../deploy/city-evidence.mjs';
test('aliases and global options cannot redirect or bypass a guarded upload',()=>{
 const valid=['pages','deploy','build/site','--project-name','fleetlab','--branch','codex-city-explorer'];
 assert.equal(releaseCommand(valid),'deploy');
 for(const invalid of [ ['pages','publish',...valid.slice(2)], ['pages','deployment','create',...valid.slice(2)], ['--cwd','elsewhere',...valid], [...valid,'--cwd','elsewhere'], [...valid,'--config','other.toml'], [...valid,'--project-name','other'], [...valid.slice(0,6),'other'], ['pages','deploy'] ])assert.throws(()=>releaseCommand(invalid),/Unsupported/);
 assert.equal(releaseCommand(['--version']),'version');assert.equal(releaseCommand(['pages','deployment','list','--project-name','fleetlab','--json']),'list');
});

const repository=fileURLToPath(new URL('../../../',import.meta.url));

test('current source checkout cannot downgrade to a package-free release',()=>{
 const root=mkdtempSync(join(tmpdir(),'fleetlab-downgrade-test-'));
 try{
  const site=join(root,'site');
  writeFiles(site,[['publication.json',JSON.stringify({source_commit:'example'})],
   ...['setup-codec.js','setup-sharing.js','studio.js'].map(name=>['src/ui/'+name,readFileSync(join(repository,'playground/fleetlab/src/ui',name))])]);
  mkdirSync(join(root,'review'));
  writeFileSync(join(root,'review/integration-manifest.json'),JSON.stringify({files:inventory(site)}));
  assert.throws(()=>verifyStage(site,'example',repository),/teaching package/i);
 }finally{rmSync(root,{recursive:true,force:true});}
});

test('source-bound stage rejects resealed shell, owner assets, unexpected files and package downgrades',()=>{
 const fixture=stageFixture(),{root}=fixture;
 try{
  const {source,commit,site,review,selection,packageFiles,proof,base,branded,originalManifest,seal}=fixture;
  seal();assert.ok(verifyStage(site,commit,source)>0);
  const changedOriginal=JSON.parse(originalManifest);changedOriginal.files['app.mjs']=fingerprint('changed original');
  writeFiles(review,[['inputs/city-base-release.json',JSON.stringify(changedOriginal)]]);
  assert.throws(()=>verifyStage(site,commit,source),/hosting projection|approved.*base/i,'rollback must match the retained original manifest');
  writeFiles(review,[['inputs/city-base-release.json',originalManifest]]);
  for(const [key,input] of [['current',branded],['rollback',base]]){
   const old={...selection[key]},manifest=JSON.parse(readFileSync(join(input,'release.json')));
   const header='/*\n  Content-Security-Policy: default-src *\n';
   manifest.files._headers=fingerprint(header);
   const bytes=JSON.stringify(manifest),digest=fingerprint(bytes).sha256;
   selection[key]={path:'city-explorer/releases/'+digest.slice(0,16),release_sha256:digest};
   cpSync(input,join(site,selection[key].path),{recursive:true});
   writeFiles(site,[[selection[key].path+'/_headers',header],[selection[key].path+'/release.json',bytes]]);
   rmSync(join(site,old.path),{recursive:true});
   assert.throws(()=>verifyBrandedCity(site,selection,inventory(site),commit),/hosting projection|presentation differs/i,'resealed nested '+key+' policy must fail');
   rmSync(join(site,selection[key].path),{recursive:true});cpSync(input,join(site,old.path),{recursive:true});selection[key]=old;
  }
  for(const path of ['city-explorer/releases/index.html','network-flows/capacity/index.html','network-flows/software-delivery/index.html','network-flows/fleet-day/index.html','index.html','boot.js','_headers','integration.mjs','integration.css','404.html','not-found.css','brand.mjs','brand.css','site-media/fleetlab-logo.png']){
   const original=readFileSync(join(site,path));writeFileSync(join(site,path),Buffer.concat([original,Buffer.from('\nchanged after review')]));seal();
   assert.throws(()=>verifyStage(site,commit,source),/integration.*(?:differ|mismatch)/i,path);
   writeFileSync(join(site,path),original);
  }
  const recordedPath=join(site,selection.current.path,'data/catalog.json');
  const recorded=readFileSync(recordedPath),releasePath=join(site,selection.current.path,'release.json'),releaseBytes=readFileSync(releasePath);
  writeFileSync(recordedPath,'{"recorded":99}');
  const changedRelease=JSON.parse(releaseBytes);changedRelease.files['data/catalog.json']=fingerprint(readFileSync(recordedPath));
  writeFileSync(releasePath,JSON.stringify(changedRelease));
  const oldCurrent={...selection.current},newHash=fingerprint(readFileSync(releasePath)).sha256;
  const oldPrefix=oldCurrent.path.split('/').at(-1),oldEntries=cityEntryFiles(oldPrefix);
  selection.current={path:'city-explorer/releases/'+newHash.slice(0,16),release_sha256:newHash};
  cpSync(join(site,oldCurrent.path),join(site,selection.current.path),{recursive:true});rmSync(join(site,oldCurrent.path),{recursive:true});
  rmSync(join(site,'city-explorer/switch-'+oldPrefix+'.mjs'));writeFiles(site,cityEntryFiles(newHash.slice(0,16)));
  writeFiles(site,[['publication.json',JSON.stringify(selection)]]);seal();
  assert.throws(()=>verifyStage(site,commit,source),/scientific files|presentation differs/i,'resealed recording must fail');
  cpSync(join(site,selection.current.path),join(site,oldCurrent.path),{recursive:true});rmSync(join(site,selection.current.path),{recursive:true});
  rmSync(join(site,'city-explorer/switch-'+newHash.slice(0,16)+'.mjs'));writeFiles(site,oldEntries);
  selection.current=oldCurrent;writeFileSync(recordedPath,recorded);writeFileSync(releasePath,releaseBytes);
  writeFiles(site,[['publication.json',JSON.stringify(selection)]]);
  writeFiles(site,[['unreviewed.js','console.log("unreviewed")']]);seal();
  assert.throws(()=>verifyStage(site,commit,source),/inventory|unexpected/i);rmSync(join(site,'unreviewed.js'));
  for(const marker of [null,undefined]){seal({teaching_package:marker});assert.throws(()=>verifyStage(site,commit,source),/teaching package/i);}
  seal({teaching_package:{...packageFiles,[proof.receipt.source_offer.path]:{bytes:1,sha256:'0'.repeat(64)}}});
  assert.throws(()=>verifyStage(site,commit,source),/teaching package/i);
  const missingPointer={...selection};delete missingPointer.teaching_package;
  writeFiles(site,[['publication.json',JSON.stringify(missingPointer)]]);seal();
  assert.throws(()=>verifyStage(site,commit,source),/teaching package/i);
 }finally{rmSync(root,{recursive:true,force:true});}
});
test('release guard rejects byte changes, extra files, wrong commits and links',()=>{
 const root=mkdtempSync(join(tmpdir(),'fleetlab-release-test-'));
 try{
  const site=join(root,'site');mkdirSync(site);mkdirSync(join(root,'review'));
  const data=JSON.stringify({source_commit:'example'});writeFileSync(join(site,'publication.json'),data);
  writeFileSync(join(root,'review/integration-manifest.json'),JSON.stringify({files:{'publication.json':{bytes:Buffer.byteLength(data),sha256:createHash('sha256').update(data).digest('hex')}}}));
  assert.equal(verifyStage(site,'example'),1);assert.throws(()=>verifyStage(site,'other'),/commit/);
  const manifestPath=join(root,'review/integration-manifest.json');
  const originalManifest=JSON.parse(readFileSync(manifestPath,'utf8'));
  writeFileSync(manifestPath,JSON.stringify({...originalManifest,teaching_package:{}}));
  assert.throws(()=>verifyStage(site,'example'),/source checkout/);
  writeFileSync(manifestPath,JSON.stringify(originalManifest));
  writeFileSync(join(site,'publication.json'),data+' ');assert.throws(()=>verifyStage(site,'example'),/bytes/);
  writeFileSync(join(site,'publication.json'),data);writeFileSync(join(site,'extra'),'unreviewed');assert.throws(()=>verifyStage(site,'example'),/inventory/);
  rmSync(join(site,'extra'));symlinkSync(join(site,'publication.json'),join(site,'linked'));assert.throws(()=>verifyStage(site,'example'),/Linked/);
 }finally{rmSync(root,{recursive:true,force:true});}
});
