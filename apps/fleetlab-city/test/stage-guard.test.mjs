import {lessonNavigation} from '../../../playground/fleetlab/tools/software-delivery-package.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,symlinkSync,cpSync,existsSync,realpathSync,readdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {verifyStage,releaseCommand} from '../deploy/stage-guard.mjs';
import {buildSite,buildHtml} from '../../../playground/fleetlab/tools/pack.mjs';
import {buildPackageProof} from '../../../playground/fleetlab/tools/package-proof.mjs';
test('aliases and global options cannot redirect or bypass a guarded upload',()=>{
 const valid=['pages','deploy','build/site','--project-name','fleetlab','--branch','codex-city-explorer'];
 assert.equal(releaseCommand(valid),'deploy');
 for(const invalid of [ ['pages','publish',...valid.slice(2)], ['pages','deployment','create',...valid.slice(2)], ['--cwd','elsewhere',...valid], [...valid,'--cwd','elsewhere'], [...valid,'--config','other.toml'], [...valid,'--project-name','other'], [...valid.slice(0,6),'other'], ['pages','deploy'] ])assert.throws(()=>releaseCommand(invalid),/Unsupported/);
 assert.equal(releaseCommand(['--version']),'version');assert.equal(releaseCommand(['pages','deployment','list','--project-name','fleetlab','--json']),'list');
});

const repository=fileURLToPath(new URL('../../../',import.meta.url));
const fingerprint=data=>({bytes:Buffer.byteLength(data),sha256:createHash('sha256').update(data).digest('hex')});
function writeFiles(root,files){
 for(const [path,data] of files){mkdirSync(dirname(join(root,path)),{recursive:true});writeFileSync(join(root,path),data);}
}
function inventory(root){
 const files={};
 function walk(dir,prefix=''){
  for(const entry of readdirSync(dir,{withFileTypes:true})){
   const path=join(dir,entry.name),name=prefix+entry.name;
   if(entry.isDirectory())walk(path,name+'/');else files[name]=fingerprint(readFileSync(path));
  }
 }
 walk(root);return files;
}

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

// An independently assembled fixture follows the Python integration contract.
// Mutations below reseal the outer inventory, so only source-bound checks can reject them.
function integratedShell(packed){
 const marker='<link rel="stylesheet" href="./styles.css">';
 const intro='<section aria-label="About FleetLab"><h1>FleetLab: test fleet decisions in simulation</h1>'+
  '<p>Independent educational software by Bo-Huei Lin. Explore Fleet day, Street lab, paired experiments, Depot flow lab and the <a href="/city-explorer/">San Francisco City Explorer</a>.</p>'+
  '<p>Synthetic operations; map qualification remains open. Not affiliated with or endorsed by Waymo, Zoox, or their partners. No operational authority.</p></section>';
 let html=packed.get('index.html').replace(marker,marker+'\n<link rel="stylesheet" href="./integration.css">')
  .replace('</head>','<link rel="canonical" href="https://fleetlab.pages.dev/"><meta property="og:url" content="https://fleetlab.pages.dev/"><meta property="og:site_name" content="FleetLab"><meta name="author" content="Bo-Huei Lin"></head>')
  .replace('<div id="fleetlab-teaching-strip"',intro+'<div id="fleetlab-teaching-strip"')
  .replace('</head>','<meta name="fleetlab-teaching-package" content="/downloads/teaching-package.json"></head>');
 if(packed.has('network-flows/software-delivery/release.json'))html=html.replace('</head>','<meta name="fleetlab-software-delivery" content="/network-flows/software-delivery/release.json"></head>');
 if(packed.has('network-flows/rebalancing/release.json'))html=html.replace('</head>','<meta name="fleetlab-rebalancing" content="/network-flows/rebalancing/release.json"></head>');
 if(packed.has('network-flows/dispatch/release.json'))html=html.replace('</head>','<meta name="fleetlab-dispatch" content="/network-flows/dispatch/release.json"></head>');
 if(packed.has('network-flows/delivery-order/release.json'))html=html.replace('</head>','<meta name="fleetlab-delivery-order" content="/network-flows/delivery-order/release.json"></head>');
 const headers=packed.get('_headers').replace(/\n+$/,'')+'\n\n/city-explorer/*\n  ! Content-Security-Policy\n'+
  "  Content-Security-Policy: default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; connect-src 'self'; worker-src 'self' blob:; font-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'none'\n"+
  '  Permissions-Policy: camera=(), microphone=(), geolocation=()\n'+
  '\n/downloads/fleetlab-offline.html\n  Content-Disposition: attachment; filename="fleetlab-offline.html"\n'+
  '\n/downloads/fleetlab-offline\n  Content-Disposition: attachment; filename="fleetlab-offline.html"\n'+
  '\n/network-flows/sources/*\n  Content-Type: application/gzip\n  Content-Disposition: attachment; filename="fleetlab-teaching-source.json.gz"\n  ! Cache-Control\n  Cache-Control: public, max-age=31536000, immutable\n'+
  '\n/downloads/teaching-package.json\n  Content-Type: application/json\n';
 return [...lessonNavigation(packed),['index.html',html],['boot.js','import { mountCityEntry } from "./integration.mjs";\n'+packed.get('boot.js')+'\nmountCityEntry();\n'],['_headers',headers]];
}

test('source-bound stage rejects resealed shell, owner assets, unexpected files and package downgrades',()=>{
 const root=realpathSync(mkdtempSync(join(tmpdir(),'fleetlab-bound-stage-test-')));
 try{
  const source=join(root,'source'),playground=join(source,'playground/fleetlab');
  for(const path of ['src','tools','media','capacity','software-delivery','delivery-order','rebalancing','dispatch','styles.css','index.html'].filter(path=>existsSync(join(repository,'playground/fleetlab',path))))cpSync(join(repository,'playground/fleetlab',path),join(playground,path),{recursive:true});
  for(const path of ['LICENSE','src/hermes/fleet/contracts.py']){
   mkdirSync(dirname(join(source,path)),{recursive:true});cpSync(join(repository,path),join(source,path));
  }
  for(const name of ['hosted','tools','deploy']){
   const base=join(repository,'apps/fleetlab-city',name);
   for(const path of readdirSync(base).filter(path=>/\.(?:mjs|py|json|css|html|md)$/.test(path))){
    const target=join(source,'apps/fleetlab-city',name,path);mkdirSync(dirname(target),{recursive:true});cpSync(join(base,path),target);
   }
  }
  cpSync(join(repository,'apps/fleetlab-city/rebalancing-media'),join(source,'apps/fleetlab-city/rebalancing-media'),{recursive:true});
  cpSync(join(repository,'apps/fleetlab-city/diagram-media'),join(source,'apps/fleetlab-city/diagram-media'),{recursive:true});
  cpSync(join(repository,'apps/fleetlab-city/brand-media'),join(source,'apps/fleetlab-city/brand-media'),{recursive:true});
  cpSync(join(repository,'apps/fleetlab-city/tile-media'),join(source,'apps/fleetlab-city/tile-media'),{recursive:true});
  const publicNotes=join(source,'apps/fleetlab-city/citylib/public_notes.py');mkdirSync(dirname(publicNotes),{recursive:true});cpSync(join(repository,'apps/fleetlab-city/citylib/public_notes.py'),publicNotes);
  const git=(...args)=>execFileSync('git',['-C',source,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
  git('init','-q');git('add','.');git('-c','user.name=Release test','-c','user.email=release@example.invalid','commit','-qm','bound source');
  const commit=git('rev-parse','HEAD'),site=join(root,'stage/site'),review=join(root,'stage/review');
  const packed=buildSite(playground,{sourceCommit:commit});writeFiles(site,packed);
  const offline=join(root,'offline.html');writeFileSync(offline,buildHtml(playground));
  const proof=buildPackageProof({site,playground,offline,sourceCommit:commit});
  writeFiles(site,[...proof.files,...integratedShell(packed),['downloads/fleetlab-offline.html',readFileSync(offline)]]);
  for(const path of ['integration.mjs','integration.css','404.html','not-found.css'])cpSync(join(source,'apps/fleetlab-city/hosted',path),join(site,path));
  const offlineHash=fingerprint(readFileSync(offline)).sha256;
  writeFiles(site,[['downloads/fleetlab-offline.sha256',offlineHash+'  fleetlab-offline.html\n'],['downloads/verify-offline.txt',
   'FleetLab offline edition — download verification\n\nSHA-256: '+offlineHash+'\nmacOS/Linux: shasum -a 256 fleetlab-offline.html\nWindows PowerShell: Get-FileHash .\\fleetlab-offline.html -Algorithm SHA256\n\nCompare the full digest before opening. This detects corruption against this website\'s published copy, not independent authenticity. The offline file excludes City Explorer.\n']]);
  const packageFiles=Object.fromEntries([...proof.files].map(([path,data])=>[path,fingerprint(data)]));
  const selection={source_commit:commit,offline_sha256:offlineHash,teaching_package:{path:'downloads/teaching-package.json',...packageFiles['downloads/teaching-package.json']}};
  // Exercise the actual Python presentation builder against a small recorded viewer.
  const base=join(root,'city-base'), branded=join(root,'city-branded');
  writeFiles(base,[['index.html','<!doctype html><html><head></head><body>City</body></html>'],
   ['app.mjs','export const recorded = true;'],['data/catalog.json','{"recorded":42}'],
   ['style.css','body{color:#123}'],['_headers',"/city-explorer/*\n  Content-Security-Policy: script-src 'self'; connect-src 'self'\n"],
   ['network.json',JSON.stringify({origins:['self'],accounts:false,analytics:false,provider_calls:false})]]);
  writeFiles(base,[['release.json',JSON.stringify({schema:'fleetlab.city-release/1.0.0',scope:'REVIEW_ONLY',public_deployment:'NOT_PERFORMED',
   compatibility:{viewer:'1.1.0',pack:'fleetlab.city-pack/1.0.0',run:'fleetlab.city-run/1.0.0',metrics:'fleetlab.city-metrics/1.0.0'},files:inventory(base)})]]);
  const pythonTool=join(source,'apps/fleetlab-city/tools/hosted-brand.py');
  execFileSync('python3',[pythonTool,'--viewer',base,'--out',branded,'--source-commit',commit]);
  for(const [key,path] of [['current',branded],['rollback',base]]){
   const digest=fingerprint(readFileSync(join(path,'release.json'))).sha256;
   selection[key]={path:'city-explorer/releases/'+digest.slice(0,16),release_sha256:digest};
   cpSync(path,join(site,selection[key].path),{recursive:true});
  }
  selection.hosted_presentation='fleetlab.hosted-presentation/1.0.0';
  writeFiles(site,[['city-explorer/sources/index.html','<html><head></head><body>Sources</body></html>'],['city-explorer/sources/manifest.json','{"files":{}}']]);
  execFileSync('python3',['-c',"import runpy,sys; runpy.run_path(sys.argv[1])['apply_site'](*sys.argv[2:])",pythonTool,site,selection.current.path,selection.rollback.path]);
  writeFiles(site,[['publication.json',JSON.stringify(selection)]]);mkdirSync(review);
  const seal=(overrides={})=>writeFileSync(join(review,'integration-manifest.json'),JSON.stringify({files:inventory(site),teaching_package:packageFiles,...overrides}));
  seal();assert.ok(verifyStage(site,commit,source)>0);
  for(const path of ['network-flows/capacity/index.html','network-flows/software-delivery/index.html','index.html','boot.js','_headers','integration.mjs','integration.css','404.html','not-found.css','brand.mjs','brand.css','site-media/fleetlab-logo.png']){
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
  selection.current={path:'city-explorer/releases/'+newHash.slice(0,16),release_sha256:newHash};
  cpSync(join(site,oldCurrent.path),join(site,selection.current.path),{recursive:true});rmSync(join(site,oldCurrent.path),{recursive:true});
  writeFiles(site,[['publication.json',JSON.stringify(selection)]]);seal();
  assert.throws(()=>verifyStage(site,commit,source),/scientific files|presentation differs/i,'resealed recording must fail');
  cpSync(join(site,selection.current.path),join(site,oldCurrent.path),{recursive:true});rmSync(join(site,selection.current.path),{recursive:true});
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
