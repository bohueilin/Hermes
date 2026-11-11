import {decorateVisitors,node,syncRouteImages} from './visitor.mjs';
// Hosted presentation. No simulation, result, map or playback logic is changed.
const media='/site-media/';
export function decorateDesign(doc=document){
const el=(...args)=>node(doc,...args);
decorateShell(doc);
const mark=()=>el('img',{src:media+'fleetlab-logo.png',srcset:media+'fleetlab-logo-64.png 64w, '+media+'fleetlab-logo-128.png 128w, '+media+'fleetlab-logo.png 256w',sizes:'(max-width:767px) 48px, 64px',alt:'',width:'64',height:'64',decoding:'async'});
for(const brand of doc.querySelectorAll('header .studio-monogram,header .delivery-brand,header a.brand')){
 if(brand.getAttribute('data-art-logo'))continue;
 brand.setAttribute('data-art-logo','true');brand.classList.add('design-brand');brand.setAttribute('aria-label','FleetLab home');
 brand.replaceChildren(mark(),el('strong',{},'FleetLab'));
}
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
decorateFleetCycle(doc);
decorateVisitors(doc);
const motion=doc.querySelector('.visitor-motion-control'),shell=doc.querySelector('header.design-shell');
if(motion&&shell&&motion.parentNode!==shell)shell.appendChild(motion);
decorateCityOrientation(doc);
decorateDepotPipes(doc);
decorateAtlasCoverage(doc);
installConceptMotion(doc);
}

// One global shell; City section controls stay local to the City content.
export function decorateShell(doc=document){
 const el=(...a)=>node(doc,...a),main=doc.querySelector('main');
 let header=doc.querySelector('header');
 const sources=/Map data & licenses/.test(doc.title??doc.querySelector('title')?.textContent??'');
 if(!header&&sources&&main){header=el('header',{},el('a',{class:'brand',href:'/#/home'},'FleetLab'));doc.body.insertBefore(header,main);}
 if(header&&!header.classList.contains('design-shell')){
  header.classList.add('design-shell');
  const tabs=header.querySelector('.tabs'),intro=main?.querySelector('.intro');
  if(tabs&&main){tabs.classList.add('design-local-nav');main.insertBefore(tabs,intro?intro.nextSibling:main.firstChild);}
  if(!header.classList.contains('studio-header')){
   for(const nav of header.querySelectorAll('nav'))nav.remove();
   const nav=el('nav',{id:'design-navigation',class:'design-global-nav','aria-label':'Main navigation','data-expanded':'false'},[['Home','home'],['Fleet day','fleet-day'],['Street lab','street-lab'],['Explore','catalog'],['About & limits','approach']].map(([label,route])=>el('a',{href:'/#/'+route},label)));
   const menu=el('button',{type:'button',class:'design-shell-menu','aria-controls':'design-navigation','aria-expanded':'false'},'Menu');
   const toggle=open=>{menu.setAttribute('aria-expanded',String(open));menu.textContent=open?'Close':'Menu';nav.setAttribute('data-expanded',String(open));};
   menu.addEventListener('click',()=>toggle(menu.getAttribute('aria-expanded')!=='true'));
   header.addEventListener('keydown',event=>{if(event.key==='Escape'){toggle(false);menu.focus();}});
   header.appendChild(menu);header.appendChild(nav);
  }
 }
 let footer=doc.querySelector('.studio-footer')??doc.querySelector('footer');
 if(!footer&&!doc.getElementById('fleetlab-root')){footer=el('footer');doc.body.appendChild(footer);}
 if(footer){
  footer.classList.add('design-shell-footer');
  for(const p of footer.querySelectorAll('p'))if(!p.classList.contains('design-honesty')&&/Not affiliated with or endorsed by/.test(p.textContent)){
   for(const text of p.childNodes)if(text.nodeType===3)text.textContent=text.textContent.replace(/Not affiliated with or endorsed by[^.]*\.\s*/g,'');
  }
  if(!footer.querySelector('nav'))footer.appendChild(el('nav',{'aria-label':'Footer navigation'},[['Explore','catalog'],['About & limits','approach'],['Guided walkthrough','walkthrough']].map(([label,route])=>el('a',{href:'/#/'+route},label))));
  if(!footer.classList.contains('studio-footer')&&!footer.querySelector('time'))footer.appendChild(el('time',{datetime:'2026-11-08'},'Date: Nov 8th, 2026'));
 }
 if(sources&&main){
  if(!main.id)main.id='source-content';
  if(!doc.querySelector('.design-source-skip'))doc.body.insertBefore(el('a',{class:'design-source-skip',href:'#'+main.id},'Skip to map sources'),header);
  const first=[...main.querySelectorAll('a')].find(a=>/\/sf-v1-complete\.tar\.gz$/.test(a.getAttribute('href')??''));
  if(first&&!doc.getElementById('design-source-start')){
   const list=first.closest('ul');
   const start=el('aside',{id:'design-source-start'},[el('strong',{},'Start here: the map behind the recorded study'),el('p',{},[el('a',{href:first.getAttribute('href')},'Download SF v1 →'),' for the Decision notebook and Replay studio. SF v2 and the temporal versions are candidate map work, separate from that recorded experiment.']),el('p',{},[el('a',{href:'./REPRODUCE.md'},'Read the reproduction guide →'),' for the source archives, transformation code and exact local steps.'])]);
   list?.parentNode.insertBefore(start,list);first.setAttribute('aria-describedby','design-source-start');
  }
 }
}

export function decorateCityOrientation(doc=document){
 const el=(...a)=>node(doc,...a),limits=doc.getElementById('limits-view'),ledger=doc.getElementById('qualification-ledger');
 if(ledger&&!doc.getElementById('design-ledger-lead'))ledger.parentNode.insertBefore(el('p',{id:'design-ledger-lead'},'Read this as a checklist of unresolved map questions: are road classes represented, have restrictions been inspected, and do gaps remain across districts? A failed or unfinished check stays open even when the files agree with their recorded hashes.'),ledger);
 const correction=[...(limits?.querySelectorAll('.panel')??[])].find(p=>p.querySelector('h3')?.textContent.startsWith('Method correction'));
 if(correction&&!correction.querySelector('details')){
  const record=correction.querySelector('p');if(record){const details=el('details',{},el('summary',{},'Exact recorded terms and correction'));details.appendChild(record);correction.appendChild(el('p',{},'The lower-energy example could not reach a depot; it did not cross the reserve threshold. Its lower-demand follow-up used one seed, so it does not establish a general result. The nominal battery-capacity label is not used by the engine.'));correction.appendChild(details);}
 }
}
const installed=new WeakSet();
export function installDesign(doc=document){
if(installed.has(doc))return;installed.add(doc);decorateDesign(doc);
new MutationObserver(()=>syncRouteImages(doc)).observe(doc.body,{attributes:true,attributeFilter:['hidden'],subtree:true});
const selector='.studio-monogram,.delivery-brand,a.brand,.studio-overview,.approach-intro,.depot-flow-lab,.capacity-map,[data-concept="fleet"]';
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
 const topology=el('div',{class:'depot-pipe-topology','aria-label':'Directional depot topology','data-concept-motion':'pipe','data-concept-motion-state':'paused'}),pressure=el('p',{class:'depot-pipe-pressure','data-pipe-pressure':''}),usage=el('div',{class:'depot-pipe-usage'}),cacheNote=el('p',{class:'depot-pipe-cache-note'}),rates=el('p',{'data-pipe-rates':'',role:'status'}),caps=el('p',{class:'depot-pipe-caps'});
 const root=el('section',{class:'depot-pipe','aria-label':'Shared depot data paths'},[
  el('p',{class:'design-eyebrow'},'FOLLOW THE SHARED PIPE'),el('h2',{},'One radio. Two WAN directions. A local cache.'),caps,topology,
  el('div',{class:'depot-pipe-controls'},[el('label',{},['Cache experiment',mode]),el('label',{},['Download vehicles',downloads]),el('label',{},['Upload vehicles',uploads])]),rates,pressure,usage,cacheNote,
  el('p',{},'Separate illustrative steady-state calculator: each active vehicle gets an equal radio reservation; its own client and directional WAN or local-read cap may reduce it further. Unused reservations are not redistributed. No completion time, price or simulation outcome is predicted.'),
  el('p',{},'Cold cache fills consume WAN down first. A warm cache avoids repeated WAN downloads, but still uses radio and local reads. Sensor uploads always use WAN up. Telemetry is an illustrative upload class, not an additional modeled Readiness task.'),
  el('p',{class:'depot-pipe-motion-note'},'Moving markers show direction, not speed or packet counts. Software and maps are download classes sharing the download total; cold fill is a static prerequisite, with no modeled workload.'),
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
  for(const route of topology.querySelectorAll('[data-path]')){
   const id=route.getAttribute('data-path'),active=id==='upload'?usedUpload>0:id==='warm-delivery'?r.hit&&usedDownload>0:['software','maps'].includes(id)?!r.hit&&usedDownload>0:false;
   const value=String(active);if(route.getAttribute('data-pipe-active')!==value)route.setAttribute('data-pipe-active',value);
  }
  const saturated=usedUpload>0&&usedUpload>=c.up-1e-6;
  const pressureText=`WAN up ${saturated?'at capacity':usedUpload?'in use':'idle'}: ${usedUpload.toFixed(1)} / ${c.up} Mbps. ${r.hit?'Warm cache bypasses WAN down only; sensor uploads still use WAN up.':'Try warm cache to bypass repeated WAN downloads; sensor uploads still use WAN up.'}`;
  if(pressure.textContent!==pressureText)pressure.textContent=pressureText;
  const pressureState=saturated?'full':usedUpload?'active':'idle';if(pressure.getAttribute('data-pressure')!==pressureState)pressure.setAttribute('data-pressure',pressureState);
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
   el('p',{},'Simulation only — no real-fleet claim or deployment permission.'),
   el('p',{},'This is an uncalibrated teaching simulation. It proves nothing about a real fleet and authorizes no operational change.'),
   el('p',{},'Power-slack B changes the physical yard: one added DC port also rezones one waiting stall. That bundled comparison cannot isolate the effect of the port alone.'),
   el('p',{},'The default release-by allowance is 21,600 seconds after each arrival: a six-hour overnight window per visit, distinct from the twelve-hour run horizon. WAN spend, prepositioning cache content and allowing later release are trade-offs to test; this lab models no prices.'),
   el('a',{href:'/#/fleet-day?lesson=staffing-readiness'},'Isolate staffing versus bays in Fleet day →'),el('a',{href:'/#/depot-flow-lab?lesson=two-vehicles'},'Compare one scheduling factor in Depot Flow →')]);ready.insertBefore(context,ready.querySelector('.lead')?.nextSibling??ready.firstChild);
 }
 const outcome=doc.getElementById('outcome');if(!outcome?.querySelector('[data-state="verified"]'))return;
 const classification=outcome.querySelector('.classification');
 if(classification&&!outcome.querySelector('.depot-result-overview')){
  const overview=el('section',{class:'depot-result-overview','aria-label':'Result summary'},classification);
  for(const title of ['What changed','What got worse','What remains uncertain']){
   const heading=[...outcome.children].find(n=>n.tagName==='H3'&&n.textContent===title);
   if(heading){const copy=heading.nextSibling;overview.appendChild(heading);if(copy)overview.appendChild(copy);}
  }
  outcome.insertBefore(overview,outcome.children[1]);
  const vector=outcome.querySelector('tr[data-component]')?.closest('table');
  if(vector){
   const equal=[...vector.querySelectorAll('tbody > tr')].filter(row=>row.querySelector('.mark.equal'));
   if(equal.length){
    const heads=[...vector.querySelectorAll('thead th')].map(h=>el('th',{scope:'col'},h.textContent));
    const details=el('details',{},[el('summary',{},`${equal.length} equal components — inspect exact values`),el('div',{class:'table-scroll',role:'region',tabindex:'0','aria-label':'Unchanged comparison components'},el('table',{},[el('caption',{},'Unchanged comparison components'),el('thead',{},el('tr',{},heads)),el('tbody',{},equal)]))]);
    vector.parentNode.parentNode.insertBefore(details,vector.parentNode.nextSibling);
   }
   const remaining=[...vector.querySelectorAll('tbody > tr')],pair=classification.hasAttribute('data-classification');
   const caption=!pair?'Baseline components, in presentation order':remaining.some(row=>!row.querySelector('.mark.better,.mark.worse'))?'Comparison components — unavailable values retained':'Changed comparison components, in presentation order';
   vector.querySelector('caption').textContent=caption;vector.parentNode.setAttribute('aria-label',caption);vector.parentNode.hidden=!remaining.length;
  }
 }
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
 const gaps=lines.filter(line=>line.status==='unsupported'),pool=gaps.length?gaps:lines;
 const nearest=pool.map(line=>line.points[Math.floor(line.points.length/2)]).sort((a,b)=>Math.hypot(a[0]-cx,a[1]-cy)-Math.hypot(b[0]-cx,b[1]-cy))[0];
 const x=400+(nearest[0]-cx)*scale,y=300-(nearest[1]-cy)*scale;
 return {counts,paths,sample:{viewBox:`${(x-60).toFixed(2)} ${(y-45).toFixed(2)} 120 90`,hasGap:!!gaps.length}};
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
 const button=el('button',{type:'button',class:'secondary','aria-pressed':'true','aria-controls':'atlas-coverage-detail'},'Open interactive atlas');
 const status=el('p',{role:'status',class:'atlas-coverage-status'}),drawing=svg('svg',{viewBox:'0 0 800 600',role:'img','aria-label':'Recorded road support coverage, close sample','data-layer':'both'});
 let extent='sample',sample=null;
 const views=el('div',{class:'atlas-coverage-controls',role:'group','aria-label':'Coverage extent'}),layers=el('div',{class:'atlas-coverage-controls',role:'group','aria-label':'Supported and unsupported roads'});
 const setExtent=()=>{drawing.setAttribute('viewBox',extent==='sample'&&sample?sample.viewBox:'0 0 800 600');drawing.setAttribute('aria-label',`Recorded road support coverage, ${extent==='sample'?'close sample':'full network'}`);for(const b of views.querySelectorAll('button'))b.setAttribute('aria-pressed',String(b.getAttribute('data-coverage-view')===extent));};
 for(const [value,label]of [['sample','Close sample'],['full','Full network']]){const b=el('button',{type:'button','data-coverage-view':value,'aria-pressed':String(value===extent)},label);b.addEventListener('click',()=>{extent=value;setExtent();});views.appendChild(b);}
 for(const [value,label]of [['both','Both road classes'],['supported','Supported only'],['unsupported','Unsupported only']]){const b=el('button',{type:'button','data-coverage-layer':value,'aria-pressed':String(value==='both')},label);b.addEventListener('click',()=>{drawing.setAttribute('data-layer',value);for(const n of layers.querySelectorAll('button'))n.setAttribute('aria-pressed',String(n===b));});layers.appendChild(b);}
 const note=el('p',{class:'atlas-coverage-sample-note'});
 const detail=el('section',{id:'atlas-coverage-detail',class:'atlas-coverage-detail'},[views,layers,status,note,drawing,el('p',{},'Dashed ochre: unsupported; solid teal: supported. Excluded road classes are omitted. Counts describe the full eligible source network, not just this crop. This is map coverage, not fleet simulation output or navigation.')]);
 stage.parentNode.insertBefore(button,stage);stage.parentNode.insertBefore(detail,stage);stage.hidden=true;
 let wanted=true,ticket=0,catalogPromise=null;const cache=new Map(),base=new URL('./',doc.baseURI),fetcher=doc.defaultView?.fetch?.bind(doc.defaultView)??fetch;
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
   sample=result.sample;setExtent();note.textContent=sample.hasGap?'Close sample: an unsupported source segment near the network centre. Use Full network for context.':'No unsupported source records in this version. Close sample shows supported roads.';drawing.replaceChildren(supported,unsupported);status.textContent=`${label}: ${result.counts.unsupported.toLocaleString('en-US')} unsupported / ${(result.counts.included+result.counts.unsupported).toLocaleString('en-US')} eligible source records. ${result.counts.excluded.toLocaleString('en-US')} excluded records omitted.`;
  }catch(e){if(id===ticket&&wanted)status.textContent=`Coverage view unavailable: ${e.message}. Use the original map; no substituted road data.`;}
 }
 const showCoverage=value=>{wanted=value;button.setAttribute('aria-pressed',String(wanted));button.textContent=wanted?'Open interactive atlas':'Inspect supported roads and gaps';detail.hidden=!wanted;stage.hidden=wanted;update();};
 button.addEventListener('click',()=>showCoverage(!wanted));
 for(const control of doc.querySelectorAll('#flat-toggle,#inspect-gap,[data-mask]'))control.addEventListener('click',()=>showCoverage(false),true);
 doc.getElementById('atlas-arm')?.addEventListener('change',()=>showCoverage(false),true);
 const Observer=doc.defaultView?.MutationObserver??globalThis.MutationObserver;
 if(Observer)new Observer(rows=>{if(rows.some(r=>r.type==='attributes'))update();}).observe(bar,{subtree:true,attributes:true,attributeFilter:['aria-pressed']});
 update();
 // Use the same checksum-bound temporal summary as the native viewer; never hardcode candidate outcomes.
 read('data/temporal-summary.json').then(data=>{const r=data.report??data;
  if(Number.isFinite(r.timed_turn_count)&&Number.isFinite(r.timed_access_count)&&Number.isFinite(r.before?.unsupported_fraction)&&Number.isFinite(r.after?.unsupported_fraction))versionContext.textContent=`SF v2 → SF v3: ${r.timed_turn_count} timed turn rules, ${r.timed_access_count} way-access schedules; unsupported eligible length ${(100*r.before.unsupported_fraction).toFixed(2)}% → ${(100*r.after.unsupported_fraction).toFixed(2)}%. These candidates have no notebook or replay results.`;
  else versionContext.textContent='SF v2 is an earlier static candidate; SF v3 adds time-aware rules. Inspect source checks below; notebook and replay stay on SF v1.';
 }).catch(()=>{versionContext.textContent='SF v2 is an earlier static candidate; SF v3 adds time-aware rules. Candidate summary unavailable; notebook and replay stay on SF v1.';});
}

// Hosted concept drawings: no simulation records, model clocks or playback are read.
export function decorateFleetCycle(doc=document){
 const el=(...a)=>node(doc,...a),svg=(tag,attrs,children=[])=>node(doc,tag,attrs,children,'http://www.w3.org/2000/svg');
 for(const figure of doc.querySelectorAll('[data-concept="fleet"] figure')){
  if(figure.classList.contains('concept-cycle'))continue;figure.classList.add('concept-cycle');
  const pod=delay=>svg('g',{class:'concept-cycle-pod',style:`animation-delay:${delay}s`},[
   svg('rect',{x:'-20',y:'-12',width:'40',height:'24',rx:'10',class:'concept-cycle-body'}),
   svg('rect',{x:'-10',y:'-8',width:'20',height:'16',rx:'5',class:'concept-cycle-window'}),
   ...[-14,10].flatMap(x=>[-15,12].map(y=>svg('rect',{x:String(x),y:String(y),width:'5',height:'3',rx:'1',class:'concept-cycle-wheel'}))),
  ]);
  const steps=[['Pickup','Reach the rider empty.'],['Passenger trip','Carry the rider to a destination.'],['Depot','Return empty when energy or service is needed.'],['Redispatch','Finish required work; return to service.']];
  const drawing=svg('svg',{viewBox:'0 0 640 300',class:'concept-cycle-drawing','aria-hidden':'true',focusable:'false','data-concept-motion':'fleet','data-concept-motion-state':'paused'},[
   svg('path',{d:'M130 65H510V235H130Z',class:'concept-cycle-road'}),
   svg('path',{d:'M312 57l10 8-10 8M502 143l8 10 8-10M328 227l-10 8 10 8M122 157l8-10 8 10',class:'concept-cycle-arrows'}),
   ...[[130,65],[510,65],[510,235],[130,235]].map(([x,y],i)=>svg('g',{},[
    svg('circle',{cx:String(x),cy:String(y),r:'28',class:'concept-cycle-stop'}),
    svg('text',{x:String(x),y:String(y<100?y-38:y+46),'text-anchor':'middle',class:'concept-cycle-number'},String(i+1)),
   ])),pod(0),pod(-8),
  ]);
  figure.replaceChildren(drawing,
   el('ol',{class:'concept-cycle-steps'},steps.map(([title,detail])=>el('li',{},[el('strong',{},title),el('span',{},detail)]))),
   el('aside',{class:'concept-cycle-conditions'},[el('strong',{},'Conditional holds · outside the nominal loop'),el('p',{},'Queue if a required bay is occupied. Hold if charging or service is incomplete. These are possible constraints, not mandatory stages of every trip.')]),
   el('p',{class:'concept-cycle-note'},'White pods trace a conceptual cycle. Motion shows order only, with no simulated timing, utilization or real-world route.'),
   el('figcaption',{},'Concept illustration · not simulation output'));
 }
}

// One observer set per document consumes the existing global control. CSS provides
// an immediate global veto; this lifecycle adds visibility and route ownership.
const conceptMotionControllers=new WeakMap();
export function installConceptMotion(doc=document){
 const existing=conceptMotionControllers.get(doc);if(existing){existing();return;}
 const win=doc.defaultView,root=doc.documentElement;
 if(!win||typeof win.MutationObserver!=='function')return;
 const media=win.matchMedia?.('(prefers-reduced-motion: reduce)'),active=new Map();let stopped=false,suspended=false;
 const setState=(target,running)=>{const next=running?'running':'paused';if(target.getAttribute('data-concept-motion-state')!==next)target.setAttribute('data-concept-motion-state',next);};
 const sync=()=>{
  const enabled=!stopped&&!suspended&&!doc.hidden&&!media?.matches&&root.getAttribute('data-motion')!=='reduce'&&root.getAttribute('data-visitor-motion')==='running'&&!root.hasAttribute('data-visitor-user-paused');
  for(const [target,visible]of active)setState(target,enabled&&visible&&target.isConnected&&!target.closest('[hidden],[inert],details:not([open])')&&!target.parentElement?.closest('[aria-hidden="true"]'));
 };
 const visibility=typeof win.IntersectionObserver==='function'?new win.IntersectionObserver(entries=>{
  for(const entry of entries)if(active.has(entry.target))active.set(entry.target,entry.isIntersecting&&entry.intersectionRatio>0);sync();
 }):null;
 const scan=()=>{
  if(stopped)return;
  for(const target of active.keys())if(!target.isConnected){setState(target,false);visibility?.unobserve(target);active.delete(target);}
  for(const target of doc.querySelectorAll('[data-concept-motion]'))if(!active.has(target)){active.set(target,false);setState(target,false);visibility?.observe(target);}
  sync();
 };
 const globals=new win.MutationObserver(sync),routes=new win.MutationObserver(rows=>{
  // Replay frames may update unrelated text frequently; rescan only new/removed
  // concept subtrees, while hidden-route changes need only the small active set.
  if([...active.keys()].some(target=>!target.isConnected)||rows.some(row=>[...(row.addedNodes??[]),...(row.removedNodes??[])].some(n=>n.nodeType===1&&(n.matches('[data-concept-motion]')||n.querySelector('[data-concept-motion]')))))scan();
  else if(rows.some(row=>row.type==='attributes'))sync();
 });
 globals.observe(root,{attributes:true,attributeFilter:['data-visitor-motion','data-visitor-user-paused','data-motion']});
 routes.observe(doc.body,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden','inert','aria-hidden','open']});
 const hide=event=>{suspended=true;sync();if(event.persisted)return;
  stopped=true;visibility?.disconnect();globals.disconnect();routes.disconnect();active.clear();media?.removeEventListener('change',sync);doc.removeEventListener('visibilitychange',sync);win.removeEventListener('pagehide',hide);win.removeEventListener('pageshow',show);conceptMotionControllers.delete(doc);
 };
 const show=()=>{suspended=false;scan();};
 media?.addEventListener('change',sync);doc.addEventListener('visibilitychange',sync);win.addEventListener('pagehide',hide);win.addEventListener('pageshow',show);conceptMotionControllers.set(doc,scan);scan();
}

if(typeof document!=='undefined'){
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>installDesign(),{once:true});
else queueMicrotask(installDesign);
}
