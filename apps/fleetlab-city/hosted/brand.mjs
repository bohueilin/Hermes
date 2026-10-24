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
for(const footer of doc.querySelectorAll('footer'))if(!footer.querySelector('.design-footer-mark'))footer.insertBefore(el('a',{href:'/#/home',class:'design-footer-mark','aria-label':'FleetLab home'},[mark(),el('strong',{},'FleetLab')]),footer.firstChild);
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
}
const installed=new WeakSet();
export function installDesign(doc=document){
if(installed.has(doc))return;installed.add(doc);decorateDesign(doc);
const selector='.studio-monogram,.delivery-brand,a.brand,.studio-overview,.approach-intro';
new MutationObserver(rows=>{if(rows.some(r=>[...r.addedNodes].some(n=>n.nodeType===1&&(n.matches(selector)||n.querySelector(selector)))))decorateDesign(doc);}).observe(doc.body,{childList:true,subtree:true});
}
if(typeof document!=='undefined'){
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>installDesign(),{once:true});
else installDesign();
}
