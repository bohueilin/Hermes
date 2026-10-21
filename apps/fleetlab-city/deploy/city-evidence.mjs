// Historical input pins are source-owned; review inventories cannot approve replacements.
import {readSync,lstatSync,openSync,closeSync,fstatSync,constants} from 'node:fs';
import {createHash} from 'node:crypto';
import {dirname,join,resolve} from 'node:path';
import {renderPage} from '../hosted/site-transform.mjs';
const digest=data=>createHash('sha256').update(data).digest('hex');
const fingerprint=data=>({bytes:Buffer.byteLength(data),sha256:digest(data)});
const ordered=value=>value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(Object.keys(value).sort().map(k=>[k,ordered(value[k])])):Array.isArray(value)?value.map(ordered):value;
const same=(a,b)=>JSON.stringify(ordered(a))===JSON.stringify(ordered(b));
// prepare-launch.py writes JSON with ensure_ascii=True, including surrogate pairs.
const json=value=>JSON.stringify(ordered(value),null,2).replace(/[\u007f-\uffff]/g,c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0'))+'\n';
const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&same(Object.keys(value).sort(),keys.sort());
const safePath=path=>typeof path==='string'&&/^(?:[A-Za-z0-9_.-]+\/)*[A-Za-z0-9_.-]+$/.test(path)&&!path.split('/').some(p=>p==='.'||p==='..');

function readRegular(root,path,maxBytes=4194304){
 let current=resolve(root);
 for(const part of ['',...path.split('/').slice(0,-1)]){
  current=join(current,part);const stat=lstatSync(current);
  if(stat.isSymbolicLink()||!stat.isDirectory())throw Error('City evidence directory is not regular.');
 }
 const full=join(root,path),before=lstatSync(full);
 if(before.isSymbolicLink()||!before.isFile()||before.size>maxBytes)throw Error('City evidence input is not regular or exceeds its byte limit.');
 const fd=openSync(full,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
 try{
  const buffer=Buffer.alloc(before.size+1);let length=0,count;
  while(length<buffer.length&&(count=readSync(fd,buffer,length,buffer.length-length,null))>0)length+=count;
  const data=buffer.subarray(0,length),after=fstatSync(fd),last=lstatSync(full);
  if(!after.isFile()||data.length!==before.size||['dev','ino','size','mtimeMs','ctimeMs'].some(k=>before[k]!==after[k]||before[k]!==last[k]))throw Error('City evidence input changed during capture.');
  return data;
 }finally{closeSync(fd);}
}

export function readCityInput(site,name){
 if(!['city-base-release.json','city-source-offer-manifest.json','city-source-offer-index.html'].includes(name))throw Error('Unknown City evidence input.');
 return readRegular(dirname(site),'review/inputs/'+name);
}

export function approvedCityInputs(sourceRoot){
 const pins=JSON.parse(readRegular(sourceRoot,'apps/fleetlab-city/deploy/approved-inputs.json',4096));
 if(!exact(pins,['schema','base_release','source_offer_manifest'])||pins.schema!=='fleetlab.approved-city-inputs/1.0.0')throw Error('Invalid City input pin schema.');
 for(const key of ['base_release','source_offer_manifest']){
  const value=pins[key];
  if(!exact(value,['sha256','provenance'])||typeof value.sha256!=='string'||!/^[a-f0-9]{64}$/.test(value.sha256)||!safePath(value.provenance)||!value.provenance.startsWith('docs/')||!value.provenance.endsWith('.md'))throw Error('Invalid City input pin record.');
 }
 return pins;
}

// Independently reproduce prepare-launch.py::make_entry, then the hosted presentation.
export function cityEntryFiles(prefix,{branded=true}={}){
 if(!/^[a-f0-9]{16}$/.test(prefix))throw Error('Invalid City entry generation.');
 const name=`switch-${prefix}.mjs`;
 const html='<!doctype html>\n<html lang="en"><head><meta charset="utf-8">'+
  '<meta name="viewport" content="width=device-width,initial-scale=1">'+
  '<title>City explorer · FleetLab</title></head><body><p>Opening the versioned City explorer…</p>'+
  `<script type="module" src="./${name}"></script>`+
  `<noscript><a href="./releases/${prefix}/">Open the versioned City explorer</a></noscript></body></html>\n`;
 return new Map([['city-explorer/index.html',branded?renderPage(html,{analytics:true}):html],
  ['city-explorer/'+name,`const target = new URL('./releases/${prefix}/', location.href);\ntarget.search = location.search;\ntarget.hash = location.hash;\nlocation.replace(target.href);\n`]]);
}

export function verifyCityEvidence(site,sourceRoot,selection,files){
 const pins=approvedCityInputs(sourceRoot),base=readCityInput(site,'city-base-release.json'),offerBytes=readCityInput(site,'city-source-offer-manifest.json');
 if(digest(base)!==pins.base_release.sha256)throw Error('City approved base input differs.');
 if(digest(offerBytes)!==pins.source_offer_manifest.sha256)throw Error('City approved source offer input differs.');
 for(const item of [selection.current,selection.rollback])if(!/^city-explorer\/releases\/[a-f0-9]{16}$/.test(item?.path??''))throw Error('Invalid City generation path.');
 if(selection.current.path===selection.rollback.path)throw Error('City generations must be distinct.');
 const offer=JSON.parse(offerBytes),index=readCityInput(site,'city-source-offer-index.html');
 if(!offer.files||!same(offer.files['index.html'],fingerprint(index))||!offer.files['ODbL-1.0.txt'])throw Error('City source offer original index or notices differ.');
 for(const [path,record] of Object.entries(offer.files))if(!safePath(path)||path==='manifest.json'||!exact(record,['bytes','sha256'])||!Number.isSafeInteger(record.bytes)||record.bytes<0||!/^[a-f0-9]{64}$/.test(record.sha256))throw Error('Invalid City source inventory.');
 const expected=cityEntryFiles(selection.current.path.split('/').at(-1));
 const servedIndex=renderPage(index.toString('utf8'),{analytics:true});
 const servedOffer={...offer,files:{...offer.files,'index.html':fingerprint(servedIndex)}};
 expected.set('city-explorer/sources/index.html',servedIndex);
 expected.set('city-explorer/sources/manifest.json',json(servedOffer));
 const allowed=new Set([...expected.keys(),'city-explorer/releases/index.html',...Object.keys(offer.files).map(p=>'city-explorer/sources/'+p)]);
 for(const item of [selection.current,selection.rollback])for(const path of Object.keys(files))if(path.startsWith(item.path+'/'))allowed.add(path);
 const city=Object.keys(files).filter(path=>path.startsWith('city-explorer/'));
 if(city.length!==allowed.size||city.some(path=>!allowed.has(path)))throw Error('City inventory has missing or unexpected files.');
 for(const [path,record] of Object.entries(offer.files))if(path!=='index.html'&&!same(files['city-explorer/sources/'+path],record))throw Error('City source archive bytes differ.');
 for(const [path,data] of expected)if(!same(files[path],fingerprint(data)))throw Error('City source bytes differ: '+path);
 return base;
}
