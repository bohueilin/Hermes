import {QUESTION_FAMILIES} from './visitor-families.mjs';

// Presentation and navigation only. Existing lessons own their controls, results and playback.
function node(doc,tag,attrs={},children=[]){
 const n=doc.createElement(tag);
 for(const [key,value] of Object.entries(attrs))n.setAttribute(key,value);
 for(const child of [children].flat())if(child!=null)n.appendChild(typeof child==='string'?doc.createTextNode(child):child);
 return n;
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
 const dispatch=doc.getElementById('chapter-copy');
 if(dispatch&&!doc.querySelector('.dispatch-concept')){const figure=diagram('D-05-opportunity-cost.webp','Dispatching the car now strands the next rider.');figure.classList.add('dispatch-concept');figure.querySelector('img').setAttribute('loading','lazy');dispatch.parentNode.insertBefore(figure,dispatch.nextSibling);}
 const staffing=doc.querySelector('#staffing-help')?.parentNode;
 if(staffing&&!staffing.querySelector('.visitor-diagram')){staffing.classList.add('visitor-staffing');const figure=diagram('D-03-staffing-queue.webp','Pods queued at service bays; one bay works, one waits for a worker.');figure.querySelector('img').setAttribute('loading','lazy');staffing.insertBefore(figure,staffing.firstChild.nextSibling);}
 const art=(file,alt='',className='visitor-tile-art')=>el('img',{src:'/tiles/'+file,alt,class:className,width:'1600',height:'1600',loading:'lazy',decoding:'async'});
 const text=(selector,value)=>{const n=doc.querySelector(selector);if(n)n.textContent=value;};
 text('#limits-view a[href="/city-explorer/sources/"]','Visit the map sources page for databases, captured sources, code and licenses →');
 const paired=doc.querySelector('#study-help');if(paired&&!doc.getElementById('visitor-paired'))paired.parentNode.appendChild(el('p',{id:'visitor-paired'},'A paired repeat compares configurations using the same seed, vehicle starting positions and rider requests.'));
 const home=doc.querySelector('.studio-overview');
 if(home&&!doc.getElementById('visitor-purpose')){
  const intro=el('section',{id:'visitor-purpose',class:'visitor-purpose','aria-labelledby':'visitor-purpose-title'},[
   el('div',{},[
    el('p',{class:'visitor-kicker'},'BO-HUEI LIN’S INDEPENDENT LEARNING PROJECT'),
    el('h1',{id:'visitor-purpose-title'},'Explore the work between the rides.'),
    el('p',{class:'visitor-lede'},'An autonomous car needs more than a charged battery. It needs time, data and a place to get ready. FleetLab makes those hidden decisions visible through small, interactive simulations.'),
    el('p',{class:'visitor-byline'},'I’m building this project to learn how autonomous fleets work—and to share what each experiment teaches us.'),
    el('a',{class:'design-primary visitor-first-action',href:'/#/depot-flow-lab?lesson=two-vehicles'},'Start with a 3-minute lesson →'),
   ]),
   el('ol',{class:'visitor-steps','aria-label':'How to learn with FleetLab'},[
    ['01','Choose a question','Why is a vehicle waiting? Would another charger help?'],
    ['02','Change one thing','Try a different capacity, location or order of work.'],
    ['03','See the trade-off','Find out who benefits, who waits and what the model leaves out.'],
   ].map(([num,title,copy])=>el('li',{},[el('span',{'aria-hidden':'true'},num),el('div',{},[el('h2',{},title),el('p',{},copy)])]))),
  ]);
  home.insertBefore(intro,home.firstChild);
  const filmTitle=home.querySelector('.film-copy h1');
  if(filmTitle){const h=el('h2',{class:'visitor-film-title'},'First, picture the work between rides.');filmTitle.parentNode.insertBefore(h,filmTitle);filmTitle.remove();}
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
  for(const href of ['#/depot-flow-lab?lesson=two-vehicles','#/depot-flow-lab?lesson=crossed-priorities','/network-flows/capacity/','/network-flows/software-delivery/','/network-flows/delivery-order/']){
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
  ['#main > .hero','dispatch','D-05-opportunity-cost.webp','Dispatching the car now strands the next rider.'],
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
}

// Only presentation is animated. No callback can run a model, accept an order or advance replay.
const motionControllers=new WeakMap();
export function animateOutcomeCounts(root,{request,cancel,allowed,now=()=>performance.now()}={}){
 if(!allowed()||root.getAttribute('data-stale')==='true')return ()=>{};
 const rows=[...root.querySelectorAll('[data-request-count]')],jobs=[];
 for(const row of rows){
  const final=Number(row.getAttribute('data-request-count'));
  if(!Number.isSafeInteger(final)||final<0)continue;
  const exact=row.textContent;row.setAttribute('aria-label',exact);
  const display=row.ownerDocument.createElement('span');display.setAttribute('aria-hidden','true');
  const label=exact.slice(0,exact.lastIndexOf(':')+1);display.textContent=exact;
  const swatch=row.querySelector('.request-swatch');row.replaceChildren(...(swatch?[swatch]:[]),display);jobs.push({display,label,final});
 }
 let id=null,stopped=false;const start=now();
 const finish=()=>{stopped=true;if(id!==null)cancel(id);for(const j of jobs){j.display.textContent=`${j.label} ${j.final}`;j.display.parentNode.setAttribute('aria-label',j.display.textContent);}root.classList.remove('visitor-count-reveal');};
 const step=t=>{if(stopped)return;if(!root.isConnected||!allowed()){finish();return;}const p=Math.min(1,Math.max(0,(t-start)/700));for(const j of jobs){j.display.textContent=`${j.label} ${Math.floor(j.final*p)}`;j.display.parentNode.setAttribute('aria-label',j.display.textContent);}if(p<1)id=request(step);else finish();};
 root.classList.add('visitor-count-reveal');id=request(step);return finish;
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
 if(counts)new MutationObserver(()=>{for(const stop of stops)stop();stops.clear();const r=counts.querySelector('.request-outcomes');if(r)stops.add(animateOutcomeCounts(r,{request:fn=>win.requestAnimationFrame(fn),cancel:id=>win.cancelAnimationFrame(id),allowed,now:()=>win.performance.now()}));}).observe(counts,{childList:true});
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
