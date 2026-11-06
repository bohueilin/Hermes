import {decorateVisitors,node} from './visitor.mjs';
// Hosted presentation. No simulation, result, map or playback logic is changed.
const media='/site-media/';
export function decorateDesign(doc=document){
const el=(...args)=>node(doc,...args);
const mark=()=>el('img',{src:media+'fleetlab-logo.png',srcset:media+'fleetlab-logo-64.png 64w, '+media+'fleetlab-logo-128.png 128w, '+media+'fleetlab-logo.png 256w',sizes:'(max-width:767px) 48px, 64px',alt:'',width:'64',height:'64',decoding:'async'});
for(const brand of doc.querySelectorAll('header .studio-monogram,header .delivery-brand,header a.brand')){
 if(brand.getAttribute('data-art-logo'))continue;
 brand.setAttribute('data-art-logo','true');brand.classList.add('design-brand');brand.setAttribute('aria-label','FleetLab home');
 brand.replaceChildren(mark(),el('strong',{},'FleetLab'));
}
const masthead=doc.querySelector('header.masthead');
if(masthead&&!masthead.querySelector('.design-global-nav'))masthead.insertBefore(el('nav',{class:'design-global-nav','aria-label':'FleetLab navigation'},[['Home','home'],['Fleet day','fleet-day'],['Street lab','street-lab'],['Explore','catalog'],['About & limits','approach']].map(([label,route])=>el('a',{href:'/#/'+route},label))),masthead.querySelector('.tabs'));
for(const footer of doc.querySelectorAll('footer'))if(!footer.querySelector('.design-footer-mark'))footer.insertBefore(el('a',{href:'/#/home',class:'design-footer-mark','aria-label':'FleetLab home'},[mark(),el('strong',{},'FleetLab')]),footer.firstChild);
let footer=doc.querySelector('.studio-footer')??doc.querySelector('footer');
if(!footer&&!doc.getElementById('fleetlab-root')){footer=el('footer');doc.body.appendChild(footer);}
if(footer&&!footer.querySelector('.design-honesty'))footer.appendChild(el('p',{class:'design-honesty'},'Synthetic operations; map qualification remains open. Not affiliated with or endorsed by Waymo, Zoox, or their partners. No operational authority.'));
if(footer&&!footer.querySelector('.map-gloss'))footer.appendChild(el('a',{class:'map-gloss',href:'/city-explorer/#limits'},'Map qualification: read the unresolved map checks →'));
for(const panel of doc.querySelectorAll('.offline-edition'))if(!panel.querySelector('.design-panel-mark'))panel.insertBefore(el('span',{class:'design-panel-mark'},[mark(),el('strong',{},'FleetLab')]),panel.firstChild);
const home=doc.querySelector('.studio-overview');
if(home&&!doc.getElementById('design-readiness')){
 const filmButton=el('button',{type:'button',class:'design-secondary'},'Watch the concept film ↓');
 filmButton.addEventListener('click',()=>{
  const film=home.querySelector('.welcome-visual');
  film?.scrollIntoView({block:'center'});
  const control=film?.querySelector('.film-control');
  // Explicit visitor action delegates to the existing film controller, including replay.
  if(/^(Play|Replay) concept film$/.test(control?.getAttribute('aria-label')||''))control.click();
  control?.focus({preventScroll:true});
 });
 const feature=el('section',{id:'design-readiness',class:'design-readiness','aria-label':'Readiness, made visible'},[
  el('img',{class:'design-readiness-image',src:media+'readiness.jpg',alt:'Readiness, made visible. Explore the decisions behind fleet availability. An illustrative depot with four autonomous vehicles under a green canopy.',width:'1672',height:'941',fetchpriority:'high',decoding:'async'}),
  el('div',{class:'design-art-caption'},[
   el('div',{},[el('p',{class:'design-eyebrow'},'A SMALL EXPERIMENT. A VISIBLE TRADE-OFF.'),el('p',{class:'design-art-description'},'Follow the energy, data and decisions that get a vehicle ready for its next ride.')]),
   el('div',{class:'design-art-actions'},[el('a',{href:'/network-flows/capacity/',class:'design-primary'},'Explore depot operations →'),filmButton]),
  ]),el('p',{class:'design-art-note'},'Independent simulation · Concept artwork, not a recorded depot or simulation result.'),
 ]);
 home.insertBefore(feature,home.firstChild);
}
const feature=doc.querySelector('.network-flows-feature');
if(feature&&!doc.getElementById('design-network')){
 feature.insertBefore(el('figure',{id:'design-network',class:'design-network'},[
  el('img',{src:media+'shared-delivery.webp',alt:'Two concept vehicles connected to one shared data source.',width:'2048',height:'1152',loading:'lazy',decoding:'async'}),
  el('figcaption',{},'NETWORK FLOWS · Concept visual. Shared work does not guarantee a better outcome for every vehicle.'),
 ]),feature.firstChild);
}
const hero=doc.querySelector('.delivery-hero')||doc.querySelector('#order-root .hero');
if(hero&&!doc.getElementById('design-network-lesson')){
 const art=el('details',{id:'design-network-lesson',class:'design-network-lesson',...(doc.querySelector('.delivery-hero')?{open:''}:{})},[
  el('summary',{},'Same work. Different order. · View the concept artwork'),
  el('figure',{},[el('img',{src:media+'shared-delivery.webp',alt:'Two concept vehicles connected to one shared data source.',width:'2048',height:'1152',loading:'lazy',decoding:'async'}),el('figcaption',{},'Illustration only. Use the checked model below to compare outcomes and individual delays.')]),
 ]);hero.appendChild(art);
}
decorateVisitors(doc);
decorateDepotPipes(doc);
decorateAtlasCoverage(doc);
}
const installed=new WeakSet();
export function installDesign(doc=document){
if(installed.has(doc))return;installed.add(doc);decorateDesign(doc);
const selector='.studio-monogram,.delivery-brand,a.brand,.studio-overview,.approach-intro,.depot-flow-lab,.capacity-map';
new MutationObserver(rows=>{if(rows.some(r=>{const n=r.target;return n?.closest?.('#setup,#outcome,#preset');}))decorateDepotPipes(doc);if(rows.some(r=>[...r.addedNodes].some(n=>n.nodeType===1&&(n.matches(selector)||n.querySelector(selector)))))decorateDesign(doc);}).observe(doc.body,{childList:true,subtree:true});
}

// A deliberately separate steady-state calculator: no simulation result is changed.
const PIPE_DEFAULT={radio:300,client:100,down:200,up:100,read:1000,cache:'cold',capacity:20};
export function depotPipeRates(c,{downloads=2,uploads=1,warm=false}={}){
 const n=Math.max(1,downloads+uploads),radio=c.radio/n,hit=warm&&c.cache!=='off'&&c.capacity>0;
 return {download:downloads?Math.min(c.client,radio,(hit?c.read:c.down)/downloads):0,upload:uploads?Math.min(c.client,radio,c.up/uploads):0,hit};
}
export function readDepotPipeConfig(doc){
 const c={...PIPE_DEFAULT};
 const preset=doc.getElementById('preset');if(preset)c.label=[...preset.querySelectorAll('option')].find(o=>o.value===preset.value)?.textContent;
 c.arm='Displayed values (candidate when present)';
 const keys={pool_bytes_per_tick:'radio',client_bytes_per_tick:'client',wan_down_bytes_per_tick:'down',wan_up_bytes_per_tick:'up'};
 for(const t of doc.querySelectorAll('.field .technical-only')){
  const text=t.textContent,m=text.match(/^network\.(\w+)(?:\s*\([^)]*\))?:\s*(\d+)$/);
  if(m&&keys[m[1]])c[keys[m[1]]]=Number(m[2])*8/1e6;
  const state=text.match(/^network\.cache\.state:\s*"?(off|cold|warm)"?$/);if(state)c.cache=state[1];
  const size=text.match(/^network\.cache\.capacity_bytes.*:\s*(\d+)$/);if(size)c.capacity=Number(size[1])/1e9;
 }
 for(const n of doc.querySelectorAll('#setup .note')){const m=n.textContent.match(/Cache read capacity[^\d]*([\d,]+) Mbps/i);if(m)c.read=Number(m[1].replaceAll(',',''));}
 return c;
}
const pipeControllers=new WeakMap();
export function DepotPipe(doc,config=PIPE_DEFAULT){
 const el=(...a)=>node(doc,...a),c={...config};
 const mode=el('select',{'aria-label':'Illustrative cache state'},[['cold','Cold / direct WAN'],['warm','Warm / local cache']].map(([value,text])=>el('option',{value},text)));mode.value=c.cache==='warm'?'warm':'cold';
 const downloads=el('input',{type:'number',min:'1',max:'24',value:'2','aria-label':'Illustrative download vehicles'});downloads.value='2';
 const uploads=el('input',{type:'number',min:'0',max:'24',value:'1','aria-label':'Illustrative upload vehicles'});uploads.value='1';
 const topology=el('div',{class:'depot-pipe-topology','aria-label':'Directional depot topology'}),usage=el('div',{class:'depot-pipe-usage'}),cacheNote=el('p',{class:'depot-pipe-cache-note'}),rates=el('p',{'data-pipe-rates':'',role:'status'}),caps=el('p',{class:'depot-pipe-caps'});
 const root=el('section',{class:'depot-pipe','aria-label':'Shared depot data paths'},[
  el('p',{class:'design-eyebrow'},'FOLLOW THE SHARED PIPE'),el('h2',{},'One radio. Two WAN directions. A local cache.'),caps,topology,
  el('div',{class:'depot-pipe-controls'},[el('label',{},['Cache experiment',mode]),el('label',{},['Download vehicles',downloads]),el('label',{},['Upload vehicles',uploads])]),rates,usage,cacheNote,
  el('p',{},'Separate illustrative steady-state calculator: each active vehicle gets an equal radio reservation; its own client and directional WAN or local-read cap may reduce it further. Unused reservations are not redistributed. No completion time, price or simulation outcome is predicted.'),
  el('p',{},'Cold cache fills consume WAN down first. A warm cache avoids repeated WAN downloads, but still uses radio and local reads. Sensor uploads always use WAN up. Telemetry is an illustrative upload class, not an additional modeled Readiness task.'),
  el('p',{class:'depot-pipe-caption'},'Concept illustration · not simulation output')]);
 const paint=()=>{
  const d=Math.max(1,Math.min(24,Number(downloads.value)||1)),u=Math.max(0,Math.min(24,Number(uploads.value)||0));downloads.value=String(d);uploads.value=String(u);
  const r=depotPipeRates(c,{downloads:d,uploads:u,warm:mode.value==='warm'});
  const cap=`${c.label?c.label+' · ':''}${c.arm?c.arm+' controls · ':''}Radio ${c.radio} Mbps · client ${c.client} Mbps · WAN down ${c.down} Mbps · WAN up ${c.up} Mbps · cache ${c.cache}, ${c.capacity} GB · local reads ${c.read} Mbps`;
  if(caps.textContent!==cap)caps.textContent=cap;
  const enabled=c.cache!=='off'&&c.capacity>0,warmOption=mode.querySelector('option[value="warm"]');warmOption.disabled=!enabled;
  if(!enabled)mode.value='cold';
  const cacheText=enabled?'Warm option is a separate prepositioned-cache illustration; it does not edit the actual setup.':'No enabled cache in the displayed setup. Warm delivery is unavailable; downloads use WAN down.';
  if(cacheNote.textContent!==cacheText)cacheNote.textContent=cacheText;
  const lanes=[['software','OTA software ↓',[['cloud','Cloud'],['wan-down','WAN down'],['radio','Shared radio'],['vehicle','Vehicle']]],['maps','Map downloads ↓',[['cloud','Cloud'],['wan-down','WAN down'],['radio','Shared radio'],['vehicle','Vehicle']]],['upload','Sensor / telemetry ↑',[['vehicle','Vehicle'],['radio','Shared radio'],['wan-up','WAN up'],['cloud','Cloud']]],['cache-fill','Cold fill ↓',[['cloud','Cloud'],['wan-down','WAN down'],['cache','Local cache']]],['warm-delivery','Warm cache delivery →',[['cache','Local cache'],['local-read','Local reads'],['radio','Shared radio'],['vehicle','Vehicle']]]];
  if(!topology.firstChild)topology.replaceChildren(...lanes.map(([id,name,path])=>el('div',{class:'depot-pipe-route','data-path':id},[el('strong',{class:'depot-pipe-route-label'},name),el('div',{class:'depot-pipe-track'},path.flatMap(([key,label],i)=>[...(i?[el('span',{class:'depot-pipe-connector','aria-hidden':'true'},'→')]:[]),el('span',{class:'depot-pipe-node','data-resource':key},label)]))])));
  const usedDownload=d*r.download,usedUpload=u*r.upload,radioUsed=usedDownload+usedUpload;
  const resources=[['Radio',radioUsed,c.radio],['WAN down',r.hit?0:usedDownload,c.down],['WAN up',usedUpload,c.up],['Local reads',r.hit?usedDownload:0,c.read]];
  const usageSig=JSON.stringify(resources);
  if(usage.getAttribute('data-usage')!==usageSig){usage.setAttribute('data-usage',usageSig);usage.replaceChildren(...resources.map(([label,used,total])=>el('div',{class:'depot-pipe-resource'},[el('span',{},`${label}: ${used.toFixed(1)} / ${total} Mbps`),el('div',{class:'depot-pipe-meter',role:'meter','aria-label':label,'aria-valuemin':'0','aria-valuemax':String(total),'aria-valuenow':String(used)},el('span',{style:`width:${total?Math.min(100,100*used/total):0}%`}))])),el('p',{},`Unused radio: ${Math.max(0,c.radio-radioUsed).toFixed(1)} Mbps. Bars show only the illustrative delivery/upload rates, not cache-fill work. Cache fill is WAN-down-only; no fill workload or duration is assumed.`));}
  const text=`${r.hit?'Warm cache delivery':'WAN download delivery'}: ${r.download.toFixed(1)} Mbps per download vehicle · Upload: ${r.upload.toFixed(1)} Mbps per upload vehicle. ${d+u} vehicles share the radio.`;
  if(rates.textContent!==text)rates.textContent=text;
 };
 for(const control of [mode,downloads,uploads])control.addEventListener('change',paint);
 pipeControllers.set(root,next=>{Object.assign(c,next);paint();});paint();return root;
}
export function decorateDepotPipes(doc=document){
 const el=(...a)=>node(doc,...a),ready=doc.querySelector('.depot-intro'),flow=doc.querySelector('.depot-flow-lab'),capacity=doc.querySelector('.capacity-map');
 const host=ready||flow||capacity;if(!host)return;
 let pipe=host.querySelector('.depot-pipe');
 if(!pipe){pipe=DepotPipe(doc,ready?readDepotPipeConfig(doc):PIPE_DEFAULT);host.appendChild(pipe);
  if(!ready)pipe.insertBefore(el('p',{class:'depot-pipe-companion'},capacity?'Readiness architecture companion — separate from this NF03 twelve-visit upload model (base 1 Gbps upload).':'Readiness architecture companion — separate from Depot Flow. The two-vehicle default remains 75 / 7.5 GB uploads, 1 Gbps, 60 kW and a 120-second post-upload check.'),pipe.firstChild);
  pipe.appendChild(el('a',{href:'/depot-readiness/'},'Explore the full Readiness setup →'));
 }
 if(!ready)return;
 pipeControllers.get(pipe)?.(readDepotPipeConfig(doc));
 if(!ready.querySelector('.depot-readiness-context')){
  const context=el('div',{class:'depot-readiness-context'},[
   el('p',{},'This is an uncalibrated teaching simulation. It proves nothing about a real fleet and authorizes no operational change.'),
   el('p',{},'Power-slack B changes the physical yard: one added DC port also rezones one waiting stall. That bundled comparison cannot isolate the effect of the port alone.'),
   el('p',{},'The default release-by allowance is 21,600 seconds after each arrival: a six-hour overnight window per visit, distinct from the twelve-hour run horizon. WAN spend, prepositioning cache content and allowing later release are trade-offs to test; this lab models no prices.'),
   el('a',{href:'/#/fleet-day?lesson=staffing-readiness'},'Isolate staffing versus bays in Fleet day →'),el('a',{href:'/#/depot-flow-lab?lesson=two-vehicles'},'Compare one scheduling factor in Depot Flow →')]);ready.insertBefore(context,ready.firstChild);
 }
 const outcome=doc.getElementById('outcome');if(!outcome?.querySelector('[data-state="verified"]'))return;
 const countText=[...doc.querySelectorAll('.field .technical-only')].find(n=>/^visits \(count\):/.test(n.textContent))?.textContent;
 const count=Number(countText?.match(/:\s*(\d+)/)?.[1]);if(!count)return;
 const tile=outcome.querySelector('[data-term="visit.turnaround_observed_s"]');if(!tile)return;
 for(const row of tile.querySelectorAll('p[data-arm]')){
  const seconds=Number(row.querySelector('.technical-only')?.textContent.match(/(\d+) s/)?.[1]);if(!Number.isFinite(seconds))continue;
  let mean=row.querySelector('.depot-visit-mean');if(!mean){mean=el('span',{class:'depot-visit-mean'});row.appendChild(mean);}
  const text=` Across ${count} visits: ${/at least/.test(row.querySelector('strong')?.textContent||'')?'at least ':''}${(seconds/count).toFixed(1)} s observed per visit (${Math.floor(Math.round(seconds/count/60)/60)} h ${Math.round(seconds/count/60)%60} min).`;
  if(mean.textContent!==text)mean.textContent=text;
 }
}

// Initialize only after all component state has been created.
// Hosted alternate coverage view: the recorded renderer and scientific payload stay unchanged.
export function atlasCoveragePaths(collection){
 if(collection?.type!=='FeatureCollection'||!Array.isArray(collection.features))throw Error('Invalid coverage collection');
 const counts={included:0,unsupported:0,excluded:0},lines=[];let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
 for(const f of collection.features){const status=f.properties?.status,c=f.geometry?.coordinates;
  if(!Object.hasOwn(counts,status))throw Error('Unknown coverage status');
  if(f.geometry?.type!=='LineString'||!Array.isArray(c)||c.length<2||c.some(p=>!Array.isArray(p)||p.length<2||!Number.isFinite(p[0])||!Number.isFinite(p[1])||Math.abs(p[0])>180||Math.abs(p[1])>=85))throw Error('Invalid coverage geometry');
  counts[status]++;if(status==='excluded')continue;
  const points=c.map(([lon,lat])=>[lon*Math.PI/180,Math.log(Math.tan(Math.PI/4+lat*Math.PI/360))]);
  for(const [x,y]of points){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}lines.push({status,points});
 }
 if(!lines.length)throw Error('No eligible coverage roads');
 const scale=Math.min(752/Math.max(1e-9,maxX-minX),552/Math.max(1e-9,maxY-minY)),cx=(minX+maxX)/2,cy=(minY+maxY)/2,paths={included:'',unsupported:''};
 for(const {status,points}of lines)paths[status]+=points.map(([x,y],i)=>(i?'L':'M')+(400+(x-cx)*scale).toFixed(2)+' '+(300-(y-cy)*scale).toFixed(2)).join('');
 return {counts,paths};
}
export async function verifyAtlasBytes(bytes,expected){
 if(!expected||!Number.isSafeInteger(expected.bytes)||!/^[a-f0-9]{64}$/.test(expected.sha256))throw Error('File absent from snapshot catalogue');
 if(bytes.byteLength!==expected.bytes||bytes.byteLength>26*1024*1024)throw Error('Recorded coverage size mismatch');
 const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
 if(hash!==expected.sha256)throw Error('Recorded coverage digest mismatch');
 return JSON.parse(new TextDecoder().decode(bytes));
}
const atlasDecorated=new WeakSet();
export function decorateAtlasCoverage(doc=document){
 const atlas=doc.getElementById('atlas-view'),bar=atlas?.querySelector('.atlas-version-bar'),stage=atlas?.querySelector('.atlas-map-stage');
 if(!bar||!stage||atlasDecorated.has(atlas))return;atlasDecorated.add(atlas);
 const el=(...args)=>node(doc,...args),svg=(tag,attrs)=>node(doc,tag,attrs,[],'http://www.w3.org/2000/svg');
 bar.appendChild(el('p',{class:'atlas-scope-badge'},'Atlas view only — notebook and replay results always use frozen SF v1'));
 const versionContext=el('p',{class:'atlas-version-context'},'SF v2 is an earlier static candidate; SF v3 adds time-aware rules. Source checks are loading.');bar.appendChild(versionContext);
 const button=el('button',{type:'button',class:'secondary','aria-pressed':'false','aria-controls':'atlas-coverage-detail'},'Highlight unsupported gaps');
 const status=el('p',{role:'status',class:'atlas-coverage-status'}),drawing=svg('svg',{viewBox:'0 0 800 600',role:'img','aria-label':'Recorded road support coverage, fixed full-network view'});
 const detail=el('section',{id:'atlas-coverage-detail',class:'atlas-coverage-detail',hidden:''},[status,drawing,el('p',{},'Fixed full-network view of eligible source roads. Thick dashed ochre: unsupported; thin teal: supported. Excluded road classes are omitted. This is map coverage, not fleet simulation output or navigation.')]);
 stage.parentNode.insertBefore(button,stage);stage.parentNode.insertBefore(detail,stage);
 let wanted=false,ticket=0,catalogPromise=null;const cache=new Map(),base=new URL('./',doc.baseURI),fetcher=doc.defaultView?.fetch?.bind(doc.defaultView)??fetch;
 const catalog=()=>catalogPromise??=(async()=>{const r=await fetcher(new URL('data/catalog.json',base),{cache:'no-cache'});if(!r.ok)throw Error('Snapshot catalogue unavailable');return r.json();})().catch(e=>{catalogPromise=null;throw e;});
 const read=async path=>{const c=await catalog(),r=await fetcher(new URL(path,base),{cache:'no-cache'});if(!r.ok)throw Error('Recorded coverage unavailable');return verifyAtlasBytes(await r.arrayBuffer(),c.files?.[path]);};
 const selected=()=>doc.getElementById('temporal-map')?.getAttribute('aria-pressed')==='true'?'temporal':doc.getElementById('candidate-map')?.getAttribute('aria-pressed')==='true'?'candidate':'recorded';
 async function update(){
  const id=++ticket;if(!wanted)return;const version=selected(),label={recorded:'SF v1',candidate:'SF v2',temporal:'SF v3'}[version];
  drawing.replaceChildren();status.textContent=`Loading ${label} coverage from this recorded snapshot…`;
  try{let result=cache.get(version);if(!result){result=atlasCoveragePaths(await read(`data/${version==='recorded'?'source':version}-roads.geo.json`));cache.set(version,result);}if(id!==ticket||!wanted)return;
   const supported=svg('path',{d:result.paths.included,class:'atlas-coverage-supported',fill:'none'}),unsupported=svg('path',{d:result.paths.unsupported,class:'atlas-coverage-unsupported',fill:'none'});
   const swatch=atlas.querySelector('.legend-line.amber'),warm=swatch&&doc.defaultView?.getComputedStyle?.(swatch).backgroundColor;
   if(warm)unsupported.style.color=warm;
   drawing.replaceChildren(supported,unsupported);status.textContent=`${label}: ${result.counts.unsupported.toLocaleString('en-US')} unsupported / ${(result.counts.included+result.counts.unsupported).toLocaleString('en-US')} eligible source records. ${result.counts.excluded.toLocaleString('en-US')} excluded records omitted.`;
  }catch(e){if(id===ticket&&wanted)status.textContent=`Coverage view unavailable: ${e.message}. Use the original map; no substituted road data.`;}
 }
 button.addEventListener('click',()=>{wanted=!wanted;button.setAttribute('aria-pressed',String(wanted));button.textContent=wanted?'Return to interactive atlas':'Highlight unsupported gaps';detail.hidden=!wanted;stage.hidden=wanted;update();});
 const Observer=doc.defaultView?.MutationObserver??globalThis.MutationObserver;
 if(Observer)new Observer(rows=>{if(rows.some(r=>r.type==='attributes'))update();}).observe(bar,{subtree:true,attributes:true,attributeFilter:['aria-pressed']});
 // Use the same checksum-bound temporal summary as the native viewer; never hardcode candidate outcomes.
 read('data/temporal-summary.json').then(data=>{const r=data.report??data;
  if(Number.isFinite(r.timed_turn_count)&&Number.isFinite(r.timed_access_count)&&Number.isFinite(r.before?.unsupported_fraction)&&Number.isFinite(r.after?.unsupported_fraction))versionContext.textContent=`SF v2 → SF v3: ${r.timed_turn_count} timed turn rules, ${r.timed_access_count} way-access schedules; unsupported eligible length ${(100*r.before.unsupported_fraction).toFixed(2)}% → ${(100*r.after.unsupported_fraction).toFixed(2)}%. These candidates have no notebook or replay results.`;
  else versionContext.textContent='SF v2 is an earlier static candidate; SF v3 adds time-aware rules. Inspect source checks below; notebook and replay stay on SF v1.';
 }).catch(()=>{versionContext.textContent='SF v2 is an earlier static candidate; SF v3 adds time-aware rules. Candidate summary unavailable; notebook and replay stay on SF v1.';});
}

if(typeof document!=='undefined'){
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>installDesign(),{once:true});
else installDesign();
}
