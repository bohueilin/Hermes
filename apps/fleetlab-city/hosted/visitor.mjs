import {QUESTION_FAMILIES} from './visitor-families.mjs';
import {decorateConceptMedia} from './enhancement-media.mjs';

// Presentation and navigation only. Existing lessons own their controls, results and playback.
// Same refusals as src/ui/dom.js setAttr.
export function node(doc,tag,attrs={},children=[]){
 const n=doc.createElement(tag);
 for(const [key,value] of Object.entries(attrs)){if(/^on/i.test(key)||/^(href|src)$/i.test(key)&&/^(javascript|data):/i.test(String(value).replace(/[\0- ]/g,'')))throw Error(`unsafe attribute ${key}`);n.setAttribute(key,value);}
 for(const child of [children].flat())if(child!=null)n.appendChild(typeof child==='string'?doc.createTextNode(child):child);
 return n;
}
// Editorial context only; these records never enter model inputs, results or verifiers.
const FIELD_NOTES={
rebalancing:['An MIT study of Waymo’s California filings found that 43–45% of miles were driven without passengers from mid-2025 through December 2025. This includes travel to pickups as well as repositioning.','MIT researcher · Findings, May 2026','https://doi.org/10.32866/001c.161870'],
dispatch:['In three weeks of April 2026 checks in Austin, Reuters found Tesla Robotaxi wait times above 15 minutes about half the time and no cars available in 27% of checks.','Reuters · May 2026 (syndicated)','https://www.investing.com/news/stock-market-news/teslas-robotaxi-rollout-features-texassized-wait-times-4679470'],
'depot-count':['Lyft announced an 80,000-square-foot Nashville depot for servicing, charging and maintaining autonomous vehicles.','Lyft · October 2026','https://www.lyft.com/blog/posts/flexdrive-nashville-av-depot'],
'staffing-readiness':['In February 2026, Waymo reported about 70 remote-assistance agents on duty worldwide for a fleet of about 3,000 vehicles. Remote assistance is a different job from the depot cleaning work modeled here.','Waymo · February 2026','https://waymo.com/blog/shorts/advice-not-control-the-role-of-remote-assistance/'],
'region-launch':["As of late September 2026, no operator had completed the UK's vehicle-registration stage or applied for a driverless permit; automated-passenger-service permits were yet to be granted.",'Covington · October 1, 2026','https://www.insideglobaltech.com/2026/10/01/overview-of-eu-and-uk-regulatory-developments-relating-to-autonomous-vehicles/'],
upload:['NTT and NTT DOCOMO tested transmitting vehicle-camera video to a remote monitoring room in Japan. That live communication is different from the depot transfers modeled here.','NTT Technical Review · February 2025','https://www.ntt-review.jp/archive/ntttechnical.php?contents=ntr202502ra1.html'],
'airport-preparation':['Harry Reid International Airport announced Zoox robotaxi service in September 2026.','Harry Reid International Airport · September 2026','https://www.harryreidairport.com/newsroom/news-articles/las-has-a-new-way-to-ride-with-zoox'],
cleaning:['Cruise said its 2023 contractor cuts included people who cleaned, charged and maintained its vehicles.','CBS News · November 2023','https://www.cbsnews.com/sanfrancisco/news/cruise-contract-workers-laid-off-after-robotaxi-service-halted/'],
};
const fieldObservers=new WeakSet(),pairObservers=new WeakSet();
function decorateFieldNotes(doc){
const make=key=>{const [copy,source,href]=FIELD_NOTES[key];return node(doc,'aside',{class:'visitor-field','aria-label':'From the field · public reporting · not FleetLab simulation evidence'},[
 node(doc,'h2',{},'From the field'),node(doc,'p',{class:'visitor-field-label'},'Public reporting · not FleetLab simulation evidence'),node(doc,'p',{},copy),node(doc,'a',{href},source+' ↗'),
]);};
for(const [selector,key] of [['.r1-hero','rebalancing'],['#main > .hero','dispatch'],['.delivery-hero','upload']]){const hero=doc.querySelector(selector);if(hero&&!hero.querySelector('.visitor-field'))hero.appendChild(make(key));}
const teaching=doc.querySelector('.ops-teaching');
if(teaching&&!fieldObservers.has(teaching)){
 let note=null,key=null;
 const sync=()=>{const next=teaching.querySelector('.teaching-frame')?.getAttribute('data-frame');if(next===key)return;key=next;note?.remove();note=FIELD_NOTES[key]?make(key):null;if(note)teaching.parentNode.insertBefore(note,teaching.nextSibling);};
 sync();new MutationObserver(sync).observe(teaching,{childList:true});fieldObservers.add(teaching);
}
}
export function decorateVisitors(doc=document){
const el=(...args)=>node(doc,...args);
const diagram=(file,alt)=>el('figure',{class:'visitor-diagram'},[el('img',{src:'/diagrams/'+file,alt,width:'2048',height:'1152',decoding:'async'}),el('figcaption',{},'Concept illustration · not simulation output')]);
const flow=doc.querySelector('.flow-hero');
if(flow&&!flow.hasAttribute('data-diagram-observed')){
 flow.setAttribute('data-diagram-observed','');
 const draw=()=>{const question=flow.querySelector('.flow-question');if(!question||question.querySelector('.visitor-diagram'))return;const crossed=flow.querySelector('.lab-chooser a[aria-current="page"]')?.getAttribute('href')?.includes('crossed-priorities');question.insertBefore(diagram(crossed?'D-02-crossed-priorities.webp':'D-01-depot-scenario.webp',crossed?'Four pods with mismatched upload sizes and deadlines sharing one link.':'Two autonomous pods sharing one network link, each with a deadline.'),question.querySelector(crossed?'.flow-definition':'.flow-lede'));};
 draw();new MutationObserver(draw).observe(flow,{childList:true});
}
const dispatch=doc.querySelector('.bench>#chapter-copy');
if(dispatch&&!doc.querySelector('.dispatch-concept')){const figure=diagram('D-05-opportunity-cost.webp','Dispatching the car now strands the next rider.');figure.classList.add('dispatch-concept');figure.querySelector('img').setAttribute('loading','lazy');dispatch.parentNode.insertBefore(figure,dispatch.nextSibling);}
const staffing=doc.querySelector('#staffing-help')?.parentNode;
if(staffing&&!staffing.querySelector('.visitor-diagram')){staffing.classList.add('visitor-staffing');const figure=diagram('D-03-staffing-queue.webp','Pods queued at service bays; one bay works, one waits for a worker.');figure.querySelector('img').setAttribute('loading','lazy');staffing.insertBefore(figure,staffing.firstChild.nextSibling);}
const art=(file,alt='',className='visitor-tile-art')=>el('img',{src:'/tiles/'+file,alt,class:className,width:'1600',height:'1600',loading:'lazy',decoding:'async'});
const text=(selector,value)=>{const n=doc.querySelector(selector);if(n)n.textContent=value;};
const tour=()=>el('section',{class:'visitor-tour'},[el('h2',{},'The 15-minute tour'),el('ol',{},[['Walkthrough','/#/walkthrough'],['Dispatch lesson','/network-flows/dispatch/'],['City Explorer notebook','/city-explorer/#compare']].map(([title,href])=>el('li',{},el('a',{href},title+' →'))))]);
text('#limits-view a[href="/city-explorer/sources/"]','Visit the map sources page for databases, captured sources, code and licenses →');
const paired=doc.querySelector('#study-help');if(paired&&!doc.getElementById('visitor-paired'))paired.parentNode.appendChild(el('p',{id:'visitor-paired'},'A paired repeat compares configurations using the same seed, vehicle starting positions and rider requests.'));
const home=doc.querySelector('.studio-overview');
if(home&&!doc.getElementById('visitor-purpose')){
 const intro=el('section',{id:'visitor-purpose',class:'visitor-purpose','aria-labelledby':'visitor-purpose-title'},[
  el('div',{},[
   el('p',{class:'visitor-kicker'},'BO-HUEI LIN’S INDEPENDENT LEARNING PROJECT'),
   el('h1',{id:'visitor-purpose-title'},'Explore the work between the rides.'),
   el('p',{class:'visitor-byline'},'I’m building this project to learn how autonomous fleets work—and to share what each experiment teaches us.'),
   el('p',{class:'visitor-lede'},'An autonomous car needs more than a charged battery. It needs time, data and a place to get ready. FleetLab makes those hidden decisions visible through small, interactive simulations — the same tradeoffs Waymo, Tesla and Zoox wrestle with at fleet scale.'),
   el('a',{class:'design-primary visitor-first-action',href:'/#/depot-flow-lab?lesson=two-vehicles'},'Start with a 3-minute lesson →'),
  ]),
  el('ol',{class:'visitor-steps','aria-label':'How to learn with FleetLab'},[
   ['01','Choose a question','Why is a vehicle waiting? Would another charger help?'],
   ['02','Change one thing','Try a different capacity, location or order of work.'],
   ['03','See the trade-off','Find out who benefits, who waits and what the model leaves out.'],
  ].map(([num,title,copy])=>el('li',{},[el('span',{'aria-hidden':'true'},num),el('div',{},[el('h2',{},title),el('p',{},copy)])]))),
 ]);
 home.insertBefore(intro,home.firstChild);
 intro.firstChild.appendChild(tour());
 const filmTitle=home.querySelector('.film-copy h1');
 if(filmTitle){const h=el('h2',{class:'visitor-film-title'},'First, picture the work between rides.');filmTitle.parentNode.insertBefore(h,filmTitle);filmTitle.remove();}
 home.querySelector('.film-copy .eyebrow')?.remove();
 text('.film-lede','Watch a concept film of the ride, the neighborhood and the depot. Then try a lesson to see how everyday operating choices affect the fleet.');
 const first=home.querySelector('.design-readiness .design-primary');if(first){first.setAttribute('href','/#/depot-flow-lab?lesson=two-vehicles');first.textContent='Try your first experiment →';}
 text('.design-eyebrow','START SMALL · ABOUT 3 MINUTES');
 text('.design-art-description','Why is a fully charged vehicle still waiting? Follow the work that must finish before its next ride.');
 text('.start-points h2','Where would you like to explore next?');
 const startTiles=[['T-01-fleet-day.webp','Concept vehicle with daily demand waves.'],['T-02-sf-study.webp','Two fictional depot locations on an illustrated city map.'],['T-03-street-lab.webp','Three white pods queued on a curved clay street.']];
 home.querySelectorAll('.start-card').forEach((card,i)=>{if(startTiles[i]){card.classList.add('visitor-start-card');card.insertBefore(art(...startTiles[i]),card.firstChild);}});
 const pathTiles=['T-04-shared-resources.webp','T-05-rider-service.webp','T-06-model-limits.webp'];
 home.querySelectorAll('.learning-path-grid article').forEach((card,i)=>{
  if(!pathTiles[i])return;card.classList.add('visitor-learning-card');card.querySelector('svg')?.remove();card.insertBefore(art(pathTiles[i]),card.firstChild);
 });
 const credit=el('p',{class:'visitor-illustration-note'},'Illustrations introduce the questions. The lessons show the model’s results and limits.');
 home.querySelector('.start-points')?.appendChild(credit);
}
const catalog=doc.querySelector('.simulation-catalog');
if(catalog&&!doc.getElementById('visitor-families')){
 catalog.classList.add('visitor-catalog');
 text('.catalog-intro .hero-lede','Pick a question you’re curious about. Try a small simulation, compare what changes and leave with a clearer trade-off. No autonomy background needed.');
 const status=el('p',{id:'visitor-family-status',class:'visitor-family-status'},'All question families');
 const resultTitle=catalog.querySelector('.catalog-library-title');
 const results=el('details',{class:'visitor-library',id:'visitor-library'});
 results.appendChild(el('summary',{},'Browse the lesson library'));
 // Move the existing controls and result nodes together; their listeners and state stay owned by the catalogue.
 if(resultTitle){let part=resultTitle;while(part){const next=part.nextSibling;results.appendChild(part);if(part.classList.contains('catalog-grid'))break;part=next;}}
 const buttons=QUESTION_FAMILIES.map(f=>{
  const b=el('button',{type:'button',class:'visitor-family','data-family':f.id,'aria-pressed':'false','aria-controls':'visitor-library'},[
   art(f.tile),el('span',{class:'visitor-family-title'},f.title),el('span',{class:'visitor-family-question'},f.question),el('span',{class:'visitor-family-count'},`${f.lessons.length} lessons`),
  ]);
  b.addEventListener('click',()=>{
   const wasSelected=b.getAttribute('aria-pressed')==='true';select(wasSelected?null:f);
   results.open=true;
  });return b;
 });
 function select(f){
  for(const b of buttons)b.setAttribute('aria-pressed',String(b.getAttribute('data-family')===f?.id));
  status.textContent=f?`${f.title} · ${f.question} `:'All question families. ';
  if(resultTitle)resultTitle.textContent=f?`${f.title} · lesson library`:'The complete learning library';
  catalog.dispatchEvent(new CustomEvent('fleetlab:catalog-filter',{detail:f?.lessons??null}));
 }
 const all=el('button',{type:'button',class:'visitor-all'},'Browse all lessons →');
 all.addEventListener('click',()=>{results.open=true;catalog.querySelector('.catalog-count-row button')?.click();});
 const families=el('section',{id:'visitor-families','aria-labelledby':'visitor-family-heading'},[
  el('div',{class:'visitor-section-heading'},[el('div',{},[el('p',{class:'visitor-kicker'},'FOLLOW YOUR CURIOSITY'),el('h2',{id:'visitor-family-heading'},'Choose a place to start.')]),all]),
  el('p',{class:'visitor-scroll-hint'},'Choose one of 9 topics. Each opens its matching lessons below.'),
  el('div',{class:'visitor-family-strip',role:'group','aria-label':'Question family'},buttons),status,
 ]);
 const feature=catalog.querySelector('.network-flows-feature');
 catalog.insertBefore(families,feature);catalog.insertBefore(results,feature);
 catalog.addEventListener('fleetlab:catalog-cleared',()=>{
  for(const b of buttons)b.setAttribute('aria-pressed','false');status.textContent='All question families';
  if(resultTitle)resultTitle.textContent='The complete learning library';
 });
 const sequence=catalog.querySelector('.network-question-list');
 for(const href of ['#/depot-flow-lab?lesson=two-vehicles','#/depot-flow-lab?lesson=crossed-priorities']){
  const card=sequence?.querySelector(`a[href="${href}"]`)?.closest('article');if(card)sequence.appendChild(card);
 }
 text('#network-flows-title','Start with one parked vehicle. Follow the whole system.');
 text('.network-feature-scope','These guided lessons build on one another: first readiness, then shared resources, then the order of work. Start with the first question or jump to the one that interests you.');
}
const shift=doc.getElementById('shift-bar'),timeline=doc.getElementById('time')?.closest('.timeline');
if(shift&&timeline&&!doc.querySelector('.visitor-shift-preview')){
 const axis=shift.nextElementSibling?.classList.contains('shift-axis')?shift.nextElementSibling:doc.querySelector('.shift-axis');
 const preview=el('section',{class:'visitor-shift-preview','aria-label':'Shape of this recorded shift'},[el('p',{class:'visitor-kicker'},'THE SHIFT AT A GLANCE · SELECT AN ACTIVITY TO SEEK'),shift]);
 if(axis)preview.appendChild(axis);
 preview.appendChild(el('p',{class:'visitor-hold-key'},[el('span',{'aria-hidden':'true',class:'visitor-held-dot'},'● ━━━ ●'), 'Each dot is a recorded position. The map holds it until the next 15-second sample. No interpolation; gaps stop playback.']));
 timeline.parentNode.insertBefore(preview,timeline);
}
// User-approved correction: concept artwork motion only, with no fabricated results or replay.
for(const [selector,kind,file,alt] of [
 ['.r1-hero','rebalancing'],['.delivery-hero','delivery'],['#order-root .hero','order'],
 ['.capacity-hero','capacity','D-01-depot-scenario.webp','Two autonomous pods sharing one network link, each with a deadline.'],
]){
 const hero=doc.querySelector(selector);if(!hero||hero.hasAttribute('data-ambient-ready'))continue;
 const figure=hero.querySelector('figure')||(file?diagram(file,alt):null);if(!figure)continue;
 if(!hero.contains(figure))hero.appendChild(figure);
 figure.classList.add('visitor-ambient-art');figure.setAttribute('data-ambient-kind',kind);
 const caption=figure.querySelector('figcaption');if(caption&&!caption.textContent.includes('not simulation output'))caption.textContent='Concept illustration · not simulation output. Use the checked model below to compare outcomes and individual delays.';
 hero.setAttribute('data-ambient-ready','');
}
const welcome=doc.getElementById('welcome-view');
if(welcome&&!doc.getElementById('visitor-city-path')){
 const ribbon=el('section',{id:'visitor-city-path','aria-labelledby':'visitor-city-title'},[
  el('p',{class:'visitor-kicker'},'FOUR WAYS TO EXPLORE SAN FRANCISCO'),el('h2',{id:'visitor-city-title'},'A map. A decision. A vehicle’s day.'),
  el('p',{class:'visitor-city-intro'},'Start anywhere. The map, recorded study and replay help you inspect the same city question. Model lab offers separate interactive examples.'),
  el('div',{class:'visitor-city-grid'},[
   ['atlas','City atlas','What does the road map cover?','T-16-city-atlas.webp'],
   ['compare','Decision notebook','Would two depots help?','T-17-decision-notebook.webp'],
   ['replay','Replay studio','Where did one vehicle spend its day?','T-18-replay-studio.webp'],
   ['models','Model lab','What changes when I change an assumption?','T-19-model-lab.webp'],
  ].map(([view,title,question,file])=>{
   const b=el('button',{type:'button',class:'visitor-city-card','data-city-section':view},[art(file),el('span',{class:'visitor-city-label'},title+' →'),el('span',{class:'visitor-city-question'},question)]);
   b.addEventListener('click',()=>doc.querySelector(`.tabs button[data-view="${view}"]`)?.click());return b;
  })),el('p',{class:'visitor-illustration-note'},'Concept illustrations · Recorded studies use synthetic operations and fictional depots. Map qualification remains open.'),
 ]);
 const comparison=welcome.querySelector('.learning-insight');
 welcome.insertBefore(ribbon,comparison?.nextSibling??null);
}
if(doc.defaultView?.requestAnimationFrame&&typeof doc.defaultView.MutationObserver==='function')installVisualMotion(doc);
text('.approach-intro .hero-lede','FleetLab is my independent learning project about autonomous fleet operations. I build small simulations to ask better questions about charging, depot work, data and rider service. Each lesson lets you change an assumption, see a trade-off and inspect the limits.');
const about=doc.querySelector('.approach-intro .hero-lede');
if(about&&!doc.getElementById('visitor-founder'))about.parentNode.insertBefore(el('section',{id:'visitor-founder','aria-labelledby':'visitor-founder-title'},[
 el('h2',{id:'visitor-founder-title'},'Why I built this'),
 el('p',{},"I'm Bo-Huei Lin. I spent the last 19+ years moving from software engineering into product leadership across Cisco, Amazon Alexa, Riot Games, and Meta, building across consumer devices, smart wearables, and large-scale platforms. The common thread in my work has always been operational reality at scale: designing systems that don't just work in the lab, but hold up when the edge cases hit simultaneously in production. Autonomous fleets take that software and hardware complexity into the physical world—where charging, turnaround, routing, and fleet-wide software updates directly dictate unit economics and passenger safety every single day."),
 el('p',{},"I built FleetLab to learn how that works — and to show my work. Every simulation here is synthetic and labeled as such, because I'd rather be honest about what I don't know than impressive about what I can't prove."),
]),about.nextSibling);
if(about&&!doc.getElementById('visitor-presenting'))about.parentNode.parentNode.insertBefore(el('section',{id:'visitor-presenting',class:'approach-case','aria-label':'The 15-minute tour'},[
 tour(),el('p',{},'Read the results shown in the selected run. These are synthetic teaching examples, not operator performance.'),
]),about.parentNode.nextSibling);
const close=doc.querySelector('.approach-close');
if(close&&!doc.getElementById('visitor-contact'))close.parentNode.insertBefore(el('section',{id:'visitor-contact',class:'approach-case','aria-labelledby':'visitor-contact-title'},[
 el('div',{},[el('h2',{id:'visitor-contact-title'},'Bo-Huei Lin'),el('p',{},'I build fleet-operations simulations and network-flow optimization engines to advance my work across Autonomous Vehicles and Physical AI.')]),
 el('div',{},el('a',{href:'mailto:bohueilin@gmail.com',class:'studio-button'},'bohueilin@gmail.com')),
]),close.nextSibling);
for(const pairs of doc.querySelectorAll('#pair-rows,#pair-story'))if(!pairObservers.has(pairs)){
 const fix=()=>{for(const cell of pairs.id==='pair-story'?[pairs]:pairs.querySelectorAll('.pair-lesson')){const before=cell.textContent,after=before.replace(/Two depots completed 1 (more|fewer) trips,/, 'Two depots completed 1 $1 trip,');if(before!==after)cell.textContent=after;}};
 fix();new MutationObserver(fix).observe(pairs,{childList:true,subtree:true});pairObservers.add(pairs);
}
decorateFieldNotes(doc);
decorateConceptMedia(doc,node);
}

// Only presentation is animated. No callback can run a model, accept an order or advance replay.
const motionControllers=new WeakMap(),animatedOutcomes=new WeakSet();
export function animateOutcomeCounts(root,{request,cancel,allowed,now=()=>performance.now()}={}){
if(animatedOutcomes.has(root)||root.getAttribute('data-result-accepted')!=='true'||root.getAttribute('data-stale')==='true')return ()=>{};
animatedOutcomes.add(root);
if(!allowed()||!root.isConnected||root.closest('[hidden]'))return ()=>{};
const rows=[...root.querySelectorAll('[data-request-count]')],jobs=[];
for(const row of rows){
 const final=Number(row.getAttribute('data-request-count'));
 if(!Number.isSafeInteger(final)||final<0)continue;
 const exact=row.textContent;row.setAttribute('aria-label',exact);
 const display=row.ownerDocument.createElement('span');display.setAttribute('aria-hidden','true');
 const label=exact.slice(0,exact.lastIndexOf(':')+1);display.textContent=exact;
 const swatch=row.querySelector('.request-swatch');row.replaceChildren(...(swatch?[swatch]:[]),display);jobs.push({display,label,final});
}
if(!jobs.length)return ()=>{};
const token=root.ownerDocument.defaultView?.getComputedStyle?.(root).getPropertyValue('--motion-count').trim(),match=token?.match(/^(\d+(?:\.\d+)?)(ms|s)$/),duration=match&&Number(match[1])>0?Number(match[1])*(match[2]==='s'?1000:1):1200;
let id=null,stopped=false;const start=now();
const finish=()=>{stopped=true;if(id!==null)cancel(id);for(const j of jobs)j.display.textContent=`${j.label} ${j.final}`;root.classList.remove('visitor-count-reveal');root.style.removeProperty('--count-progress');};
const step=t=>{if(stopped)return;if(!root.isConnected||root.closest('[hidden]')||root.getAttribute('data-stale')==='true'||!allowed()){finish();return;}const p=Math.min(1,Math.max(0,(t-start)/duration)),eased=1-(1-p)**3;root.style.setProperty('--count-progress',String(eased));for(const j of jobs)j.display.textContent=`${j.label} ${Math.floor(j.final*eased)}`;if(p<1)id=request(step);else finish();};
root.classList.add('visitor-count-reveal');root.style.setProperty('--count-progress','0');for(const j of jobs)j.display.textContent=`${j.label} 0`;id=request(step);return finish;
}
function installVisualMotion(doc){
if(motionControllers.has(doc))return;
const win=doc.defaultView,system=win.matchMedia('(prefers-reduced-motion: reduce)'),root=doc.documentElement;
let paused=false;const stops=new Set();
const allowed=()=>!paused&&!system.matches&&root.getAttribute('data-motion')!=='reduce'&&!doc.hidden;
const control=node(doc,'button',{type:'button',class:'visitor-motion-control','aria-pressed':'false'},'Pause visual motion');
const sync=()=>{const enabled=allowed();root.setAttribute('data-visitor-motion',enabled?'running':'paused');control.textContent=system.matches||root.getAttribute('data-motion')==='reduce'?'Visual motion: reduced':paused?'Resume visual motion':'Pause visual motion';control.disabled=system.matches||root.getAttribute('data-motion')==='reduce';control.setAttribute('aria-pressed',String(paused));if(!enabled){for(const stop of stops)stop();stops.clear();}};
control.addEventListener('click',()=>{paused=!paused;sync();});doc.body.appendChild(control);system.addEventListener('change',sync);doc.addEventListener('visibilitychange',sync);
new MutationObserver(sync).observe(root,{attributes:true,attributeFilter:['data-motion']});sync();
const counts=doc.querySelector('.ops-outcome-visual');
if(counts){
 let current=null,pending=null,stop=()=>{};const seen=new WeakSet();
 const visibility=typeof win.IntersectionObserver==='function'?new win.IntersectionObserver(entries=>{for(const e of entries)if(e.target===pending){if(!pending.isConnected)finish();else if(e.isIntersecting)start();}}):null;
 const finish=()=>{if(pending)visibility?.unobserve(pending);pending=null;stop();stop=()=>{};stops.delete(finish);};
 const start=()=>{const r=pending;if(!r)return;visibility?.unobserve(r);pending=null;stop=animateOutcomeCounts(r,{request:fn=>win.requestAnimationFrame(fn),cancel:id=>win.cancelAnimationFrame(id),allowed,now:()=>win.performance.now()});};
 const accept=()=>{const r=counts.querySelector('.request-outcomes');if(r===current)return;finish();current=r;if(!r||seen.has(r)||r.getAttribute('data-result-accepted')!=='true'||r.getAttribute('data-stale')==='true')return;seen.add(r);if(!allowed()||r.closest('[hidden]'))return;pending=r;stops.add(finish);if(visibility)visibility.observe(r);else start();};
 new MutationObserver(accept).observe(counts,{childList:true});accept();
 const owner=counts.closest('.operations-lab')??counts;new MutationObserver(()=>{if(owner.hidden)finish();}).observe(owner,{attributes:true,attributeFilter:['hidden']});
}
const ambient=[...doc.querySelectorAll('.visitor-family,.visitor-ambient-art,[data-concept="fleet"] .primer-track')];
if(typeof win.IntersectionObserver==='function'){
 const observer=new win.IntersectionObserver(entries=>{for(const e of entries)e.target.setAttribute('data-motion-visible',String(e.isIntersecting));});for(const n of ambient)observer.observe(n);
 const ledger=doc.querySelector('.fl-ledger');let gate=null;
 if(ledger)new MutationObserver(()=>{const next=ledger.querySelector('[data-beat="verdict"] [data-section="gates"]');if(next===gate)return;if(gate)observer.unobserve(gate);gate=next;if(gate)observer.observe(gate);}).observe(ledger,{childList:true,subtree:true});
}
const links=n=>{if(n.nodeType!==1)return;for(const a of [n,...n.querySelectorAll('a,button')]){const href=a.getAttribute('href');if(!['A','BUTTON'].includes(a.tagName)||href&&new URL(href,doc.baseURI).origin!==win.location.origin)continue;if(href?.endsWith('/#/overview'))a.setAttribute('href',href.replace('/#/overview','/#/home'));const walk=p=>{for(const c of p.childNodes)if(c.nodeType===3&&c.data.includes('↗'))c.data=c.data.replaceAll('↗','→');else if(c.nodeType===1)walk(c);};walk(a);}};
links(doc.body);new MutationObserver(rows=>{for(const row of rows)for(const n of row.addedNodes)links(n);}).observe(doc.body,{childList:true,subtree:true});
motionControllers.set(doc,{control});
}
