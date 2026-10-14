// Independent upload-time reproduction of the Python integrator's owned files.
// Keep these transforms aligned with integrate-site.py and prepare-launch.py;
// changed output fails closed until both implementations are reviewed together.
import {readFileSync,lstatSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {DELIVERY_RELEASE,softwareDeliveryProblems,INTEGRATION_TEXT_PATHS,lessonNavigation} from '../../../playground/fleetlab/tools/software-delivery-package.mjs';
import {buildSite} from '../../../playground/fleetlab/tools/pack.mjs';

const HOSTED_FILES=['integration.mjs','integration.css','404.html','not-found.css'];
const CITY_CSP="default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; connect-src 'self'; worker-src 'self' blob:; font-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'none'";
const fingerprint=data=>({bytes:Buffer.byteLength(data),sha256:createHash('sha256').update(data).digest('hex')});

export function integratedRootFiles(teaching){
 const deliveryProblems=softwareDeliveryProblems(teaching);
 if(deliveryProblems.length)throw Error(`Software delivery sidecar rejected: ${deliveryProblems.join('; ')}`);
 const marker='<link rel="stylesheet" href="./styles.css">';
 const intro='<section aria-label="About FleetLab"><h1>FleetLab: test fleet '+
  'decisions in simulation</h1>'+
  '<p>Independent educational software by Bo-Huei Lin. Explore Fleet day, Street lab, '+
  'paired experiments, Depot flow lab and the <a href="/city-explorer/">San '+
  'Francisco City Explorer</a>.</p>'+
  '<p>Synthetic operations; map qualification remains open. Not affiliated with or '+
  'endorsed by Waymo, Zoox, or their partners. No operational authority.</p></section>';
 let index=teaching.get('index.html');
 for(const anchor of [marker,'</head>','<div id="fleetlab-teaching-strip"']){
  if(index.split(anchor).length!==2)throw Error('Integration source shell contract changed.');
 }
 index=index.replace(marker,marker+'\n<link rel="stylesheet" href="./integration.css">')
  .replace('</head>','<link rel="canonical" href="https://fleetlab.pages.dev/">'+
   '<meta property="og:url" content="https://fleetlab.pages.dev/">'+
   '<meta property="og:site_name" content="FleetLab"><meta '+
   'name="author" content="Bo-Huei Lin"></head>')
  .replace('<div id="fleetlab-teaching-strip"',intro+'<div id="fleetlab-teaching-strip"')
  .replace('</head>','<meta name="fleetlab-teaching-package" content="/downloads/teaching-package.json"></head>');
 if(teaching.has(DELIVERY_RELEASE))index=index.replace('</head>','<meta name="fleetlab-software-delivery" content="/network-flows/software-delivery/release.json"></head>');
 const old=teaching.get('_headers'),permission='camera=(), microphone=(), geolocation=()';
 const inherited=old.split(/\r?\n/).map(line=>line.trim()).filter(line=>line.toLowerCase().startsWith('permissions-policy:'))
  .map(line=>line.slice(line.indexOf(':')+1).trim());
 let addition=`\n/city-explorer/*\n  ! Content-Security-Policy\n  Content-Security-Policy: ${CITY_CSP}\n`;
 if(inherited.length!==1||inherited[0]!==permission){
  if(inherited.length)addition+='  ! Permissions-Policy\n';
  addition+=`  Permissions-Policy: ${permission}\n`;
 }
 const headers=old.replace(/\n+$/,'')+'\n'+addition+
  '\n/downloads/fleetlab-offline.html\n'+
  '  Content-Disposition: attachment; filename="fleetlab-offline.html"\n'+
  '\n/downloads/fleetlab-offline\n'+
  '  Content-Disposition: attachment; filename="fleetlab-offline.html"\n'+
  '\n/network-flows/sources/*\n'+
  '  Content-Type: application/gzip\n'+
  '  Content-Disposition: attachment; filename="fleetlab-teaching-source.json.gz"\n'+
  '  ! Cache-Control\n'+
  '  Cache-Control: public, max-age=31536000, immutable\n'+
  '\n/downloads/teaching-package.json\n'+
  '  Content-Type: application/json\n';
 return new Map([...lessonNavigation(teaching),['index.html',index],
  ['boot.js','import { mountCityEntry } from "./integration.mjs";\n'+teaching.get('boot.js')+'\nmountCityEntry();\n'],
  ['_headers',headers]]);
}

export function verifyIntegrationAssets(sourceRoot,commit,files,packageFiles,selection){
 const teaching=buildSite(resolve(sourceRoot,'playground/fleetlab'),{sourceCommit:commit});
 const expected=integratedRootFiles(teaching);
 for(const name of HOSTED_FILES){
  const path=resolve(sourceRoot,'apps/fleetlab-city/hosted',name),stat=lstatSync(path);
  if(stat.isSymbolicLink()||!stat.isFile())throw Error('Integration source asset is not regular.');
  expected.set(name,readFileSync(path));
 }
 const offlineHash=files['downloads/fleetlab-offline.html']?.sha256;
 if(!offlineHash||selection.offline_sha256!==offlineHash)throw Error('Integration offline selection mismatch.');
 expected.set('downloads/fleetlab-offline.sha256',`${offlineHash}  fleetlab-offline.html\n`);
 expected.set('downloads/verify-offline.txt',
  'FleetLab offline edition — download verification\n\n'+
  `SHA-256: ${offlineHash}\n`+
  'macOS/Linux: shasum -a 256 fleetlab-offline.html\n'+
  'Windows PowerShell: Get-FileHash .\\fleetlab-offline.html -Algorithm SHA256\n\n'+
  'Compare the full digest before opening. This detects corruption against this website\'s '+
  'published copy, not independent authenticity. The offline file excludes City Explorer.\n');
 const allowed=new Set([...teaching.keys(),...expected.keys(),...Object.keys(packageFiles),
  'downloads/fleetlab-offline.html','publication.json']);
 const nonCity=Object.entries(files).filter(([path])=>!path.startsWith('city-explorer/'));
 if(nonCity.length!==allowed.size||nonCity.some(([path])=>!allowed.has(path)))throw Error('Integration teaching inventory has missing or unexpected files.');
 const emittedText=nonCity.filter(([path])=>!path.startsWith('media/')&&!path.startsWith('network-flows/sources/')&&path!=='downloads/fleetlab-offline.html').reduce((sum,[,record])=>sum+record.bytes,0);
 if(emittedText>3145728)throw Error('Integration emitted text byte budget exceeded.');
 const integrationText=INTEGRATION_TEXT_PATHS.reduce((sum,path)=>sum+(files[path]?.bytes??0),0);
 if(nonCity.reduce((sum,[,record])=>sum+record.bytes,0)>14360576)throw Error('Integration teaching byte budget exceeded.');
 for(const [path,data] of expected){
  const bound=fingerprint(data);
  if(files[path]?.bytes!==bound.bytes||files[path]?.sha256!==bound.sha256)throw Error(`Integration source bytes differ: ${path}`);
 }
 return {emitted_text_bytes:emittedText,integration_text_bytes:integrationText};
}
