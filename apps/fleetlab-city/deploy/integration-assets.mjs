import {R3_RELEASE,r3PackageProblems} from '../../../playground/fleetlab/tools/dispatch-package.mjs';
import {R1_RELEASE,r1PackageProblems} from '../../../playground/fleetlab/tools/rebalancing-package.mjs';
import {BRAND_MEDIA,BRAND_TEXT,renderPage,policyFor} from '../hosted/site-transform.mjs';
import {ORDER_RELEASE,orderPackageProblems} from '../../../playground/fleetlab/tools/delivery-order-package.mjs';
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

function rootPermissions(text){
 const lines=text.replace(/\n+$/,'').split(/\r?\n/),start=lines.indexOf('/*');
 if(start<0)throw Error('Missing root header rule.');
 let end=start+1;
 while(end<lines.length&&(!lines[end]||/^\s|^#/.test(lines[end])))end++;
 const root=lines.slice(start+1,end).filter(line=>!/^permissions-policy:/i.test(line.trim())&&!/^! permissions-policy$/i.test(line.trim()));
 while(root.length&&!root.at(-1).trim())root.pop();
 lines.splice(start+1,end-start-1,...root,'  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()','');
 return lines.join('\n').replace(/\n+$/,'')+'\n';
}

export function integratedRootFiles(teaching,{branded=false,rollback,source}={}){
 if(source!==undefined&&!/^network-flows\/sources\/[a-f0-9]{64}\.json\.gz$/.test(source))throw Error('Invalid teaching source path.');
 const deliveryProblems=[...softwareDeliveryProblems(teaching),...orderPackageProblems(teaching),...r1PackageProblems(teaching),...r3PackageProblems(teaching)];
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
 if(teaching.has(R1_RELEASE))index=index.replace('</head>','<meta name="fleetlab-rebalancing" content="/network-flows/rebalancing/release.json"></head>');
 if(teaching.has(R3_RELEASE))index=index.replace('</head>','<meta name="fleetlab-dispatch" content="/network-flows/dispatch/release.json"></head>');
 if(teaching.has(ORDER_RELEASE))index=index.replace('</head>','<meta name="fleetlab-delivery-order" content="/network-flows/delivery-order/release.json"></head>');
 const old=rootPermissions(teaching.get('_headers'));
 const addition=`\n/city-explorer/*\n  ! Content-Security-Policy\n  Content-Security-Policy: ${CITY_CSP}\n`;
 // Path rules may relax or annotate the /* baseline but must never be relied on to restrict: Pages matches them
 // against the raw path, so a percent-encoded spelling gets only /* (tools/check-headers.py checks such spellings).
 const headers=old.replace(/\n+$/,'')+'\n'+addition+
  '\n/downloads/fleetlab-offline.html\n'+
  '  Content-Disposition: attachment; filename="fleetlab-offline.html"\n'+
  '\n/downloads/fleetlab-offline\n'+
  '  Content-Disposition: attachment; filename="fleetlab-offline.html"\n'+
  (source?'\n/'+source+'\n'+
  '  Content-Type: application/gzip\n'+
  '  Content-Disposition: attachment; filename="fleetlab-teaching-source.json.gz"\n'+
  '  ! Cache-Control\n'+
  '  Cache-Control: public, max-age=31536000, immutable\n':'')+
  '\n/downloads/teaching-package.json\n'+
  '  Content-Type: application/json\n';
 const result=new Map([...lessonNavigation(teaching),['index.html',index],
  ['boot.js','import { mountCityEntry } from "./integration.mjs";\n'+teaching.get('boot.js')+'\nmountCityEntry();\n'],
  ['_headers',headers]]);
 if(branded){
  for(const [path,data] of teaching)if(path.endsWith('.html'))result.set(path,renderPage(String(result.get(path)??data),{analytics:true}));
  const lines=headers.trimEnd().split('\n').map(line=>line.trim().startsWith('Content-Security-Policy:')?line.slice(0,line.indexOf(':'))+': '+policyFor(line.slice(line.indexOf(':')+1).trim(),true):line);
  lines.push('',`/${rollback}/*`,'  ! Content-Security-Policy','  Content-Security-Policy: '+CITY_CSP);
  result.set('_headers',lines.join('\n')+'\n');
 }
 // Tabs are valid header indentation and keep exact archive paths within route budgets.
 result.set('_headers',result.get('_headers').replace(/^  /gm,'\t'));
 return result;
}

export function verifyIntegrationAssets(sourceRoot,commit,files,packageFiles,selection){
 const teaching=buildSite(resolve(sourceRoot,'playground/fleetlab'),{sourceCommit:commit});
 const branded=selection.hosted_presentation==='fleetlab.hosted-presentation/1.0.0';
 const source=Object.keys(packageFiles).find(path=>path.startsWith('network-flows/sources/'));
 const expected=integratedRootFiles(teaching,{branded,rollback:selection.rollback?.path,source});
 for(const name of [...HOSTED_FILES,...(branded?BRAND_TEXT:[])]){
  const path=resolve(sourceRoot,'apps/fleetlab-city/hosted',name),stat=lstatSync(path);
  if(stat.isSymbolicLink()||!stat.isFile())throw Error('Integration source asset is not regular.');
  const raw=readFileSync(path);
  expected.set(name,branded&&name.endsWith('.html')?renderPage(raw.toString(),{analytics:true}):raw);
 }
 if(branded)for(const [name,r] of Object.entries(BRAND_MEDIA)){
  const path=resolve(sourceRoot,r.source),stat=lstatSync(path);
  if(stat.isSymbolicLink()||!stat.isFile())throw Error('Artwork is not regular.');
  const data=readFileSync(path),bound=fingerprint(data);
  if(bound.bytes!==r.bytes||bound.sha256!==r.sha256)throw Error('Artwork source fingerprint differs.');
  expected.set(name,data);
 }
 const redirect=resolve(sourceRoot,'apps/fleetlab-city/hosted/fleet-day-redirect.html');
 if(lstatSync(redirect).isSymbolicLink()||!lstatSync(redirect).isFile())throw Error('Redirect source is not regular.');
 expected.set('network-flows/fleet-day/index.html',branded?renderPage(readFileSync(redirect,'utf8'),{analytics:true}):readFileSync(redirect));
 const cityRedirect=resolve(sourceRoot,'apps/fleetlab-city/hosted/city-releases-redirect.html');
 if(lstatSync(cityRedirect).isSymbolicLink()||!lstatSync(cityRedirect).isFile())throw Error('City redirect source is not regular.');
 expected.set('city-explorer/releases/index.html',readFileSync(cityRedirect));
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
 const allowed=new Set([...teaching.keys(),...[...expected.keys()].filter(p=>!p.startsWith('city-explorer/')),...Object.keys(packageFiles),
  'downloads/fleetlab-offline.html','publication.json']);
 const nonCity=Object.entries(files).filter(([path])=>!path.startsWith('city-explorer/'));
 if(nonCity.length!==allowed.size||nonCity.some(([path])=>!allowed.has(path)))throw Error('Integration teaching inventory has missing or unexpected files.');
 const emittedText=nonCity.filter(([path])=>!path.startsWith('media/')&&!Object.hasOwn(BRAND_MEDIA,path)&&!path.startsWith('network-flows/sources/')&&path!=='downloads/fleetlab-offline.html').reduce((sum,[,record])=>sum+record.bytes,0)+(files['city-explorer/releases/index.html']?.bytes??0);
 if(emittedText>3145728)throw Error('Integration emitted text byte budget exceeded.');
 const integrationText=INTEGRATION_TEXT_PATHS.reduce((sum,path)=>sum+(files[path]?.bytes??0),0);
 if(nonCity.reduce((sum,[,record])=>sum+record.bytes,0)>14360576)throw Error('Integration teaching byte budget exceeded.');
 for(const [path,data] of expected){
  const bound=fingerprint(data);
  if(files[path]?.bytes!==bound.bytes||files[path]?.sha256!==bound.sha256)throw Error(`Integration source bytes differ: ${path}`);
 }
 return {emitted_text_bytes:emittedText,integration_text_bytes:integrationText};
}
