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
 const home=doc.querySelector('.studio-overview');
 if(home&&!doc.getElementById('visitor-purpose')){
  const intro=el('section',{id:'visitor-purpose',class:'visitor-purpose','aria-labelledby':'visitor-purpose-title'},[
   el('div',{},[
    el('p',{class:'visitor-kicker'},'BO-HUEI LIN’S INDEPENDENT LEARNING PROJECT'),
    el('h1',{id:'visitor-purpose-title'},'Explore the work between the rides.'),
    el('p',{class:'visitor-lede'},'An autonomous car needs more than a charged battery. It needs time, data and a place to get ready. FleetLab makes those hidden decisions visible through small, interactive simulations.'),
    el('p',{class:'visitor-byline'},'I’m building this project to learn how autonomous fleets work—and to share what each experiment teaches us.'),
    el('a',{class:'design-primary visitor-first-action',href:'/#/depot-flow-lab?lesson=two-vehicles'},'Start with a 3-minute lesson ↗'),
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
  const first=home.querySelector('.design-readiness .design-primary');if(first){first.setAttribute('href','/#/depot-flow-lab?lesson=two-vehicles');first.textContent='Try your first experiment ↗';}
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
   status.textContent=f?`${f.title} · ${f.question}`:'All question families';
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
  });
  const sequence=catalog.querySelector('.network-question-list');
  for(const href of ['#/depot-flow-lab?lesson=two-vehicles','#/depot-flow-lab?lesson=crossed-priorities','/network-flows/capacity/','/network-flows/software-delivery/','/network-flows/delivery-order/']){
   const card=sequence?.querySelector(`a[href="${href}"]`)?.closest('article');if(card)sequence.appendChild(card);
  }
  text('#network-flows-title','Start with one parked vehicle. Follow the whole system.');
  text('.network-feature-scope','These guided lessons build on one another: first readiness, then shared resources, then the order of work. Start with the first question or jump to the one that interests you.');
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
    const b=el('button',{type:'button',class:'visitor-city-card','data-city-section':view},[art(file),el('span',{class:'visitor-city-label'},title+' ↗'),el('span',{class:'visitor-city-question'},question)]);
    b.addEventListener('click',()=>doc.querySelector(`.tabs button[data-view="${view}"]`)?.click());return b;
   })),el('p',{class:'visitor-illustration-note'},'Concept illustrations · Recorded studies use synthetic operations and fictional depots. Map qualification remains open.'),
  ]);
  const comparison=welcome.querySelector('.learning-insight');
  welcome.insertBefore(ribbon,comparison?.nextSibling??null);
 }
 text('.approach-intro .hero-lede','FleetLab is my independent learning project about autonomous fleet operations. I build small simulations to ask better questions about charging, depot work, data and rider service. Each lesson lets you change an assumption, see a trade-off and inspect the limits.');
}
