// Verify the new presentation against the retained original viewer, not a resealed claim.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {dirname,join} from 'node:path';
import {BRAND_MEDIA,BRAND_TEXT,renderPage} from '../hosted/site-transform.mjs';
const ordered=value=>value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(Object.keys(value).sort().map(k=>[k,ordered(value[k])])):Array.isArray(value)?value.map(ordered):value;
const json=value=>JSON.stringify(ordered(value),null,2)+'\n';
const same=(a,b)=>JSON.stringify(ordered(a))===JSON.stringify(ordered(b));
const fingerprint=data=>({bytes:Buffer.byteLength(data),sha256:createHash('sha256').update(data).digest('hex')});
// Same fields as tools/hosted-brand.py; the Google tag's cookies make storage a description, not false.
export const hostedNetwork=network=>({...network,schema:'fleetlab.city-network/1.1.0',origins:['self','https://www.googletagmanager.com','https://*.google-analytics.com','https://*.google.com'],analytics:true,storage:'Google Analytics first-party cookies on fleetlab.pages.dev',hosting_disclosure:'Google Analytics measures visits on fleetlab.pages.dev. Preview collection is disabled. Cloudflare receives hosting requests.'});
export function verifyBrandedCity(site,selection,files,commit){
 const current=selection.current,prior=selection.rollback;
 for(const item of [current,prior])if(!/^city-explorer\/releases\/[a-f0-9]{16}$/.test(item?.path??''))throw Error('Invalid City generation path.');
 const base=JSON.parse(readFileSync(join(site,prior.path,'release.json'),'utf8'));
 const release=JSON.parse(readFileSync(join(site,current.path,'release.json'),'utf8'));
 if(base.hosted_presentation)throw Error('Expected original review viewer as presentation baseline.');
 const originalBytes=readFileSync(join(dirname(site),'review/inputs/city-base-release.json'));
 const original=JSON.parse(originalBytes);
 if(original.schema!=='fleetlab.city-release/1.0.0'||original.hosting_projection||original.hosted_presentation||!original.files?._headers)throw Error('Original City manifest required for hosting projection.');
 const projected={...original,files:Object.fromEntries(Object.entries(original.files).filter(([name])=>name!=='_headers')),
  hosting_projection:{schema:'fleetlab.city-hosting-projection/1.0.0',original_release_sha256:fingerprint(originalBytes).sha256,omitted_paths:['_headers'],header_source:'ROOT_HEADERS'}};
 if(!same(base,projected))throw Error('City base differs from original hosting projection.');
 for(const [item,manifest] of [[current,release],[prior,base]]){
  const actual=Object.fromEntries(Object.entries(files).filter(([p])=>p.startsWith(item.path+'/')&&p!==item.path+'/release.json').map(([p,r])=>[p.slice(item.path.length+1),r]));
  const hash=files[item.path+'/release.json']?.sha256;
  if(!same(actual,manifest.files)||hash!==item.release_sha256||!item.path.endsWith(hash.slice(0,16)))throw Error('City manifest or generation identity differs.');
 }
 const html=renderPage(readFileSync(join(site,prior.path,'index.html'),'utf8'),{analytics:true});
 const network=hostedNetwork(JSON.parse(readFileSync(join(site,prior.path,'network.json'),'utf8')));
 const changes={'index.html':html,'network.json':json(network)};
 if(base.files['index.html.gz'])changes['index.html.gz']=gzipSync(html,{level:9});
 const expectedFiles={...base.files,...Object.fromEntries(Object.entries(changes).map(([p,data])=>[p,fingerprint(data)]))};
 const external_assets=Object.fromEntries([...BRAND_TEXT,...Object.keys(BRAND_MEDIA)].map(p=>[p,files[p]]));
 const expected={...base,files:expectedFiles,hosted_presentation:{schema:'fleetlab.hosted-presentation/1.0.0',source_commit:commit,base_release_sha256:prior.release_sha256,measurement_id:'G-04EZ8EZWQ2',external_assets}};
 if(!same(release,expected))throw Error('City presentation differs from reproduced transform or changes scientific files.');
 return true;
}
