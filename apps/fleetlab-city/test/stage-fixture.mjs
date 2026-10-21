import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,cpSync,existsSync,realpathSync,readdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {lessonNavigation} from '../../../playground/fleetlab/tools/software-delivery-package.mjs';
import {buildSite,buildHtml} from '../../../playground/fleetlab/tools/pack.mjs';
import {buildPackageProof} from '../../../playground/fleetlab/tools/package-proof.mjs';
const repository=fileURLToPath(new URL('../../../',import.meta.url));
export const fingerprint=data=>({bytes:Buffer.byteLength(data),sha256:createHash('sha256').update(data).digest('hex')});
export function writeFiles(root,files){
 for(const [path,data] of files){mkdirSync(dirname(join(root,path)),{recursive:true});writeFileSync(join(root,path),data);}
}
export function inventory(root){
 const files={};
 function walk(dir,prefix=''){
  for(const entry of readdirSync(dir,{withFileTypes:true})){
   const path=join(dir,entry.name),name=prefix+entry.name;
   if(entry.isDirectory())walk(path,name+'/');else files[name]=fingerprint(readFileSync(path));
  }
 }
 walk(root);return files;
}

// An independently assembled fixture follows the Python integration contract.
// Mutations below reseal the outer inventory, so only source-bound checks can reject them.
function integratedShell(packed,source){
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
 const headers=packed.get('_headers').replace(/\n+$/,'')+'\n  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()\n\n/city-explorer/*\n  ! Content-Security-Policy\n'+
  "  Content-Security-Policy: default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; connect-src 'self'; worker-src 'self' blob:; font-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'none'\n"+
  '\n/downloads/fleetlab-offline.html\n  Content-Disposition: attachment; filename="fleetlab-offline.html"\n'+
  '\n/downloads/fleetlab-offline\n  Content-Disposition: attachment; filename="fleetlab-offline.html"\n'+
  `\n/${source}\n  Content-Type: application/gzip\n  Content-Disposition: attachment; filename="fleetlab-teaching-source.json.gz"\n  ! Cache-Control\n  Cache-Control: public, max-age=31536000, immutable\n`+
  '\n/downloads/teaching-package.json\n  Content-Type: application/json\n';
 return [...lessonNavigation(packed),['index.html',html],['boot.js','import { mountCityEntry } from "./integration.mjs";\n'+packed.get('boot.js')+'\nmountCityEntry();\n'],['_headers',headers]];
}

export function stageFixture({gzipCity=false}={}){
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
  const raw=join(root,'city-original'),base=join(root,'city-base'), branded=join(root,'city-branded');
  writeFiles(raw,[['index.html','<!doctype html><html><head></head><body>City</body></html>'],
   ['app.mjs','export const recorded = true;'],['data/catalog.json','{"recorded":42}'],
   ['style.css','body{color:#123}'],['_headers',"/city-explorer/*\n  Content-Security-Policy: script-src 'self'; connect-src 'self'\n"],
   ['network.json',JSON.stringify({origins:['self'],accounts:false,analytics:false,provider_calls:false})]]);
  if(gzipCity)writeFiles(raw,[['index.html.gz',gzipSync(readFileSync(join(raw,'index.html')),{level:9})]]);
  writeFiles(raw,[['release.json',JSON.stringify({schema:'fleetlab.city-release/1.0.0',scope:'REVIEW_ONLY',public_deployment:'NOT_PERFORMED',
   compatibility:{viewer:'1.1.0',pack:'fleetlab.city-pack/1.0.0',run:'fleetlab.city-run/1.0.0',metrics:'fleetlab.city-metrics/1.0.0'},files:inventory(raw)})]]);
  const offer=join(root,'city-offer');
  writeFiles(offer,[['index.html','<!doctype html><html><head></head><body>Sources</body></html>'],['ODbL-1.0.txt','Fixture license'],['database.tar.gz','Fixture archive']]);
  writeFiles(offer,[['manifest.json',JSON.stringify({schema:'fixture-source-offer',title:'City sources — café 🚗',files:inventory(offer)})]]);
  writeFiles(source,[['apps/fleetlab-city/deploy/approved-inputs.json',JSON.stringify({schema:'fleetlab.approved-city-inputs/1.0.0',
   base_release:{sha256:fingerprint(readFileSync(join(raw,'release.json'))).sha256,provenance:'docs/fixture.md'},
   source_offer_manifest:{sha256:fingerprint(readFileSync(join(offer,'manifest.json'))).sha256,provenance:'docs/fixture.md'}})]]);
  const git=(...args)=>execFileSync('git',['-C',source,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
  git('init','-q');git('add','.');git('-c','user.name=Release test','-c','user.email=release@example.invalid','commit','-qm','bound source');
  const commit=git('rev-parse','HEAD'),site=join(root,'stage/site'),review=join(root,'stage/review');
  const packed=buildSite(playground,{sourceCommit:commit});writeFiles(site,packed);
  const offline=join(root,'offline.html');writeFileSync(offline,buildHtml(playground));
  const proof=buildPackageProof({site,playground,offline,sourceCommit:commit});
  writeFiles(site,[...proof.files,...integratedShell(packed,proof.receipt.source_offer.path),['downloads/fleetlab-offline.html',readFileSync(offline)]]);
  for(const path of ['integration.mjs','integration.css','404.html','not-found.css'])cpSync(join(source,'apps/fleetlab-city/hosted',path),join(site,path));
  writeFiles(site,[['city-explorer/releases/index.html',readFileSync(join(source,'apps/fleetlab-city/hosted/city-releases-redirect.html'))],['network-flows/fleet-day/index.html',readFileSync(join(source,'apps/fleetlab-city/hosted/fleet-day-redirect.html'))]]);
  const offlineHash=fingerprint(readFileSync(offline)).sha256;
  writeFiles(site,[['downloads/fleetlab-offline.sha256',offlineHash+'  fleetlab-offline.html\n'],['downloads/verify-offline.txt',
   'FleetLab offline edition — download verification\n\nSHA-256: '+offlineHash+'\nmacOS/Linux: shasum -a 256 fleetlab-offline.html\nWindows PowerShell: Get-FileHash .\\fleetlab-offline.html -Algorithm SHA256\n\nCompare the full digest before opening. This detects corruption against this website\'s published copy, not independent authenticity. The offline file excludes City Explorer.\n']]);
  const packageFiles=Object.fromEntries([...proof.files].map(([path,data])=>[path,fingerprint(data)]));
  const selection={source_commit:commit,offline_sha256:offlineHash,teaching_package:{path:'downloads/teaching-package.json',...packageFiles['downloads/teaching-package.json']}};
  // Exercise the actual Python presentation builder against a small recorded viewer.
  const pythonTool=join(source,'apps/fleetlab-city/tools/hosted-brand.py');
  execFileSync('python3',['-B',pythonTool,'--viewer',raw,'--out',base,'--project-base']);
  execFileSync('python3',['-B',pythonTool,'--viewer',base,'--out',branded,'--source-commit',commit]);
  for(const [key,path] of [['current',branded],['rollback',base]]){
   const digest=fingerprint(readFileSync(join(path,'release.json'))).sha256;
   selection[key]={path:'city-explorer/releases/'+digest.slice(0,16),release_sha256:digest};
   cpSync(path,join(site,selection[key].path),{recursive:true});
   assert.equal(existsSync(join(site,selection[key].path,'_headers')),false);
  }
  selection.hosted_presentation='fleetlab.hosted-presentation/1.0.0';
  cpSync(offer,join(site,'city-explorer/sources'),{recursive:true});
  execFileSync('python3',['-B','-c',"import runpy,sys; from pathlib import Path; runpy.run_path(sys.argv[1])['make_entry'](Path(sys.argv[2]),sys.argv[3])",join(source,'apps/fleetlab-city/tools/prepare-launch.py'),join(site,'city-explorer'),selection.current.path.split('/').at(-1)]);
  execFileSync('python3',['-B','-c',"import runpy,sys; runpy.run_path(sys.argv[1])['apply_site'](*sys.argv[2:])",pythonTool,site,selection.current.path,selection.rollback.path]);
  writeFileSync(join(site,'_headers'),readFileSync(join(site,'_headers'),'utf8').replace(/^  /gm,'\t'));
  writeFiles(site,[['publication.json',JSON.stringify(selection)]]);
  const originalManifest=readFileSync(join(raw,'release.json'));
  writeFiles(review,[['inputs/city-base-release.json',originalManifest],['inputs/city-source-offer-manifest.json',readFileSync(join(offer,'manifest.json'))],['inputs/city-source-offer-index.html',readFileSync(join(offer,'index.html'))]]);
  const seal=(overrides={})=>writeFileSync(join(review,'integration-manifest.json'),JSON.stringify({files:inventory(site),teaching_package:packageFiles,...overrides}));
  seal();
  return {root,source,playground,commit,site,review,selection,packageFiles,proof,raw,base,branded,offer,originalManifest,seal,git,cleanup:()=>rmSync(root,{recursive:true,force:true})};
 }catch(error){rmSync(root,{recursive:true,force:true});throw error;}
}
