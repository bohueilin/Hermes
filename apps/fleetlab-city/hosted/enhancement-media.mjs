import {installConceptVideos} from './enhancement-motion.mjs';
import {hostedNode} from './integration.mjs';

// Concept artwork only. No model, result, or evidence inputs are read or changed.
const observers=new WeakMap(),base='/enhancement-media/';
const peopleAlt='Clay illustration of four depot workers — a lead with a tablet, a technician, a cleaner resetting a cabin, and a remote operator — around a row of white autonomous pods.';
const fence='Concept illustration · not simulation output';
export function decorateConceptMedia(doc=document){
 const el=(tag,attrs={},children=[])=>hostedNode(doc,tag,attrs,children);
 const figure=(id,file,alt,caption='',qualification=fence,film=null)=>{
  const [width,height]=file.includes('FL-A2')?[2352,1008]:file.includes('FL-A3')?[2240,1120]:file.includes('FL-V2')?[1280,720]:[2048,1152];
  const img=el('img',{src:base+file,alt,width:String(width),height:String(height),loading:'lazy',decoding:'async'});
  const media=el('div',{class:'enhancement-visual'},img);
  if(film)media.appendChild(el('video',{'data-concept-src':base+film,poster:base+file,preload:'none',muted:'',loop:'',playsinline:'',hidden:'','aria-label':alt}));
  return el('figure',{id,class:'enhancement-media',...(film?{'data-concept-media':'','data-concept-state':'poster'}:{})},[
   media,el('figcaption',{},[el('p',{class:'enhancement-fence'},qualification),...(caption?[el('p',{class:'enhancement-caption'},caption)]:[])]),
  ]);
 };
 const home=doc.querySelector('.studio-overview'),film=home?.querySelector('.studio-film-hero'),start=home?.querySelector('.start-points');
 if(film&&start&&!doc.getElementById('enhancement-people')){
  const band=el('section',{id:'enhancement-people',class:'enhancement-people','aria-labelledby':'enhancement-people-title'},[
   el('p',{class:'visitor-kicker'},'THE PEOPLE BETWEEN RIDES'),el('h2',{id:'enhancement-people-title'},'The people between rides.'),
   el('p',{class:'enhancement-lead'},"Every simulation on this site stands in for someone's shift."),
   figure('enhancement-people-art','FL-A1-people-between-rides.webp',peopleAlt,'',fence,'FL-V3-people-between-rides-loop.mp4'),
   el('ul',{class:'enhancement-roles'},[
    'The depot lead decides which car is ready.','The technician keeps the bays honest.','The cleaner resets the cabin for the next rider.','The remote operator is there when the car asks for help.',
   ].map(text=>el('li',{},text))),el('p',{class:'enhancement-close'},'FleetLab models their decisions — never the people themselves.'),
  ]);
  // Keep the existing destination cards/listeners, but make reading order match
  // the requested film → people → destinations sequence at every viewport.
  home.insertBefore(start,film.nextSibling);home.insertBefore(band,start);
 }
 const people=doc.querySelector('.studio-approach .people-grid');
 if(people&&!doc.getElementById('enhancement-about')){
  const layout=el('div',{class:'enhancement-people-layout'});people.parentNode.insertBefore(layout,people);
  layout.appendChild(figure('enhancement-about','FL-A1-people-between-rides.webp',peopleAlt));layout.appendChild(people);
 }
 const title=doc.querySelector('.operations-lab .ops-teaching h1');
 if(title?.textContent==='Fleet day'&&!doc.getElementById('enhancement-fleet-day'))title.parentNode.insertBefore(figure('enhancement-fleet-day','FL-A2-one-fleet-day-panorama.webp','Clay panorama of the same vehicle depot at dawn, midday and night, with white autonomous pods leaving, queueing and charging.','One fleet day: out at dawn, queued by midday, charging by night. Your run will write its own version.'),title.nextSibling);
 const notebook=doc.querySelector('#legacy-study > .section-heading');
 if(notebook&&!doc.getElementById('enhancement-notebook'))notebook.parentNode.insertBefore(figure('enhancement-notebook','FL-A3-second-depot-diptych.webp','Clay diptych of the same city twice: with one depot and long looping routes, and with two depots and shorter local routes.','Same city, same streets. Left: one depot, long empty loops. Right: a second depot — the cars stay closer to the riders. The table below is what the model actually found.',"Concept illustration · the study's streets are real; this picture is not the study"),notebook.nextSibling);
 const capacity=doc.querySelector('.capacity-hero');
 if(capacity&&!doc.getElementById('enhancement-capacity')){
  const fallback=capacity.querySelector('img[src="/diagrams/D-01-depot-scenario.webp"]')?.closest('figure');fallback?.remove();
  capacity.insertBefore(figure('enhancement-capacity','FL-A4-capacity-hero.webp','Clay illustration of twelve white autonomous pods moving through three depot service bays while technicians work.','Twelve visits, three shared lanes. Whether the wait is a scheduling problem or a capacity problem is the lesson.'),capacity.querySelector('.capacity-preview-slot'));
 }
 const deadhead=doc.querySelector('[data-explainer-kind="deadhead"]');
 if(deadhead&&!doc.getElementById('enhancement-deadhead')){
  const layout=el('div',{class:'enhancement-deadhead-layout'});deadhead.parentNode.insertBefore(layout,deadhead);layout.appendChild(deadhead);
  layout.appendChild(el('section',{id:'enhancement-deadhead'},[
   el('h2',{},'Deadhead: driving with nobody aboard'),
   figure('enhancement-deadhead-art','FL-V2-deadhead-explainer-poster.jpg','Concept animation · a pod loops one block, alternating between carrying a passenger and running empty','Some loops carry a rider. Some carry nobody — same street, same cost. Rebalancing is the art of shrinking the empty loops.','Concept animation · not simulation output','FL-V2-deadhead-explainer.mp4'),
  ]));
 }
 installConceptVideos(doc);
 const Observer=doc.defaultView?.MutationObserver??globalThis.MutationObserver;
 if(Observer&&!observers.has(doc)){
  const selector='.studio-overview,.people-grid,.teaching-frame,#legacy-study,.capacity-hero,[data-explainer-kind="deadhead"]';
  const observer=new Observer(rows=>{if(rows.some(r=>[...r.addedNodes].some(n=>n.nodeType===1&&(n.matches(selector)||n.querySelector(selector)))))decorateConceptMedia(doc);});
  observer.observe(doc.body,{childList:true,subtree:true});observers.set(doc,observer);
 }
}
