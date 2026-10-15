import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

export const TAG_ID='G-04EZ8EZWQ2';
export const TAG_INLINE=`window['ga-disable-G-04EZ8EZWQ2'] = location.hostname !== 'fleetlab.pages.dev';
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', 'G-04EZ8EZWQ2');`;
const marker='<!-- fleetlab-google-end -->';
export function googleTag(enabled=false){
 if(!enabled)return '<!-- Google tag prepared: disabled in local design preview -->'+marker;
 return '<!-- Google tag (gtag.js) -->\n<script async src="https://www.googletagmanager.com/gtag/js?id=G-04EZ8EZWQ2"></script>\n<script>'+TAG_INLINE+'</script>'+marker;
}
export function policyFor(policy,analytics=false){
 if(!analytics)return policy;
 const hash=createHash('sha256').update(TAG_INLINE).digest('base64');
 const additions={
  'script-src':[`'sha256-${hash}'`,'https://www.googletagmanager.com'],
  'img-src':['https://www.googletagmanager.com','https://*.google-analytics.com'],
  'connect-src':['https://www.googletagmanager.com','https://*.google-analytics.com','https://*.google.com'],
 };
 return policy.split(';').map(x=>x.trim()).filter(Boolean).map(d=>{
  const [name,...values]=d.split(/\s+/);if(!additions[name])return d;
  return [name,...new Set([...values.filter(x=>x!=="'none'"),...additions[name]])].join(' ');
 }).join('; ');
}
export function renderPage(input,{analytics=false}={}){
 let html=input.replace(/<p class="hosted-privacy">[^<]*<\/p>/g,'').replace(/<!-- Google tag(?: \(gtag\.js\)| prepared: disabled in local design preview) -->[\s\S]*?<!-- fleetlab-google-end -->/g,'')
  .replace(/<link data-fleetlab-design[^>]*>\s*/g,'')
  .replace(/<link data-fleetlab-icon[^>]*>/g,'')
  .replace(/<script type="module" src="\/brand\.mjs"><\/script>/g,'');
 if(/googletagmanager\.com\/gtag\/js|gtag\(['"]config/.test(html))throw Error('Page already contains an unowned Google tag');
 if((html.match(/<head\b[^>]*>/gi)||[]).length!==1||!/<\/body>/i.test(html))throw Error('Expected one complete HTML page');
 html=html.replace(/(<meta[^>]+http-equiv="Content-Security-Policy"[^>]+content=")([^"]+)(")/i,(_,a,p,b)=>a+policyFor(p,analytics)+b);
 html=html.replace(/(<head\b[^>]*>)/i,'$1'+googleTag(analytics));
 html=html.replace(/<\/head>/i,'<link data-fleetlab-icon rel="icon" href="/site-media/favicon.png" sizes="32x32" type="image/png"><link data-fleetlab-icon rel="apple-touch-icon" href="/site-media/apple-touch-icon.png" sizes="180x180"><link data-fleetlab-design rel="stylesheet" href="/brand.css"></head>');
 html=html.replace('No app analytics or accounts. Cloudflare receives hosting requests and may receive browser network-error reports.','No account is required.');
 html=html.replace(/<\/body>/i,'<p class="hosted-privacy">Google Analytics measures visits on the public site. Cloudflare receives hosting requests. No account is required.</p><script type="module" src="/brand.mjs"></script></body>');
 return html;
}

export const BRAND_MEDIA={...JSON.parse(readFileSync(new URL('./diagram-assets.json',import.meta.url),'utf8')),...JSON.parse(readFileSync(new URL('./rebalancing-assets.json',import.meta.url),'utf8')),...JSON.parse(readFileSync(new URL('./brand-assets.json',import.meta.url),'utf8')),...JSON.parse(readFileSync(new URL('./tile-assets.json',import.meta.url),'utf8'))};
export const ARTWORK_GROUPS=[{root:'apps/fleetlab-city/diagram-media',maxBytes:512*1024,maxFiles:4},{root:'apps/fleetlab-city/rebalancing-media',maxBytes:2*1024*1024,maxFiles:4},{root:'apps/fleetlab-city/brand-media',maxBytes:2*1024*1024,maxFiles:7},{root:'apps/fleetlab-city/tile-media',maxBytes:2*1024*1024,maxFiles:19}];
export const BRAND_TEXT=['brand.mjs','brand.css','visitor.mjs','visitor-families.mjs','visitor.css'];
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const input=readFileSync(0,'utf8');
 if(process.argv[2]==='--render')process.stdout.write(renderPage(input,{analytics:true}));
 else if(process.argv[2]==='--policy')process.stdout.write(policyFor(input,true));
 else throw Error('Expected --render or --policy');
}
