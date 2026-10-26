import {readFileSync} from 'node:fs';
import {createServer} from 'node:http';
import {createHash} from 'node:crypto';
import {extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildSite} from '../../../playground/fleetlab/tools/pack.mjs';
import {integratedRootFiles} from '../deploy/integration-assets.mjs';
import {BRAND_MEDIA,BRAND_TEXT,STATIC_INTEGRATION_FILES,renderPage} from '../hosted/site-transform.mjs';
// The non-City hosted site in memory, built with Node only the way verifyIntegrationAssets builds its expected map
// (integration-assets.mjs:93-114). That map is checked against Python-built output when deploy/build-release.py runs
// deploy/record-release.mjs, whose verifyStage calls verifyIntegrationAssets; release-build.test.mjs exercises that path.
const repository=new URL('../../../',import.meta.url);
const hosted=name=>readFileSync(new URL('apps/fleetlab-city/hosted/'+name,repository));
const page=(path,data)=>path.endsWith('.html')?renderPage(data.toString(),{analytics:true}):data;
const TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8',
 '.json':'application/json','.xml':'application/xml','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.mp4':'video/mp4'};

export function hostedSite(){
 const teaching=buildSite(fileURLToPath(new URL('playground/fleetlab/',repository)));
 const site=new Map([...teaching,...integratedRootFiles(teaching,{branded:true,rollback:'city-explorer/releases/'+'0'.repeat(16)})]);
 const add=(target,name)=>site.set(target,page(target,hosted(name)));
 for(const name of ['integration.mjs','integration.css','404.html','not-found.css',...BRAND_TEXT])add(name,name);
 for(const [name,record] of Object.entries(BRAND_MEDIA)){
  const data=readFileSync(new URL(record.source,repository));
  if(data.length!==record.bytes||createHash('sha256').update(data).digest('hex')!==record.sha256)throw Error(`Artwork source fingerprint differs: ${name}`);
  site.set(name,data);
 }
 add('network-flows/fleet-day/index.html','fleet-day-redirect.html');
 for(const [target,name] of Object.entries(STATIC_INTEGRATION_FILES))add(target,name);
 return site;
}

// The root '/*' rule of the site's own _headers, so every response carries the hosted CSP and framing policy.
export function rootHeaders(text){
 const lines=text.split('\n'),start=lines.indexOf('/*'),headers={};
 if(start<0)throw Error('Missing root header rule.');
 for(const line of lines.slice(start+1)){
  if(!/^\s/.test(line))break;
  const entry=line.trim(),colon=entry.indexOf(':');
  if(!entry.startsWith('!'))headers[entry.slice(0,colon)]=entry.slice(colon+1).trim();
 }
 return headers;
}

export function serveSite(site){
 const headers=rootHeaders(String(site.get('_headers')));
 for(const path of site.keys())if(path!=='_headers'&&!TYPES[extname(path)])throw Error(`No content type for ${path}`);
 const server=createServer((req,res)=>{
  let path=new URL(req.url,'http://127.0.0.1').pathname.slice(1);
  if(path===''||path.endsWith('/'))path+='index.html';
  const data=path==='_headers'?undefined:site.get(path);
  if(data===undefined){res.writeHead(404,{...headers,'Content-Type':'text/plain; charset=utf-8'});res.end('Not found');return;}
  res.writeHead(200,{...headers,'Content-Type':TYPES[extname(path)]});res.end(data);
 });
 return new Promise((resolve,reject)=>{
  server.once('error',reject);
  server.listen(0,'127.0.0.1',()=>resolve({origin:`http://127.0.0.1:${server.address().port}`,close:()=>new Promise(done=>{server.closeAllConnections();server.close(done);})}));
 });
}
