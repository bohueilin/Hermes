// Concept media only; captions and all simulation state stay owned by their existing surfaces.
const controllers=new WeakMap();
export function installConceptVideos(doc=document){
 if(controllers.has(doc)){controllers.get(doc)();return;}
 const win=doc.defaultView,root=doc.documentElement,media=win?.matchMedia?.('(prefers-reduced-motion: reduce)'),known=new WeakMap(),active=new Map();
 const poster=r=>{
  r.playing=false;
  if(r.video.paused!==true)r.video.pause?.();
  if(!r.video.hidden)r.video.hidden=true;
  if(r.figure.getAttribute('data-concept-state')!=='poster')r.figure.setAttribute('data-concept-state','poster');
 };
 const allowed=r=>{
  if(!r.visible||!r.video.isConnected||active.get(r.video)!==r||doc.hidden||media?.matches||root.getAttribute('data-motion')==='reduce'||root.getAttribute('data-visitor-motion')!=='running'||r.figure.closest('[hidden],[inert],[aria-hidden="true"]'))return false;
  for(let part=r.figure;part;part=part.parentElement){const style=win?.getComputedStyle?.(part);if(style?.display==='none'||style?.visibility==='hidden'||style?.visibility==='collapse')return false;}
  return true;
 };
 const syncOne=r=>{
  if(!allowed(r)){
   if(r.allowed){r.generation++;r.failed=false;}
   r.allowed=false;poster(r);return;
  }
  if(!r.allowed){r.allowed=true;r.failed=false;}
  if(r.playing||r.pending||r.failed)return;
  if(!r.video.hasAttribute('src'))r.video.setAttribute('src',r.video.getAttribute('data-concept-src'));
  const generation=r.generation;r.pending=true;
  const settled=success=>{
   r.pending=false;
   if(generation!==r.generation){poster(r);syncOne(r);return;}
   if(!success)r.failed=true;
   if(!success||r.failed||!allowed(r)){poster(r);return;}
   r.playing=true;r.video.hidden=false;r.figure.setAttribute('data-concept-state','playing');
  };
  try{Promise.resolve(r.video.play()).then(()=>settled(true),()=>settled(false));}catch{settled(false);}
 };
 const sync=()=>{for(const r of active.values())syncOne(r);};
 const intersection=typeof win?.IntersectionObserver==='function'?new win.IntersectionObserver(entries=>{
  for(const entry of entries)for(const r of active.values())if(r.frame===entry.target){r.visible=entry.isIntersecting&&entry.intersectionRatio>0;syncOne(r);}
 }):null;
 const scan=()=>{
  for(const [video,r] of active)if(!video.isConnected){r.generation++;r.allowed=false;r.visible=false;poster(r);intersection?.unobserve(r.frame);active.delete(video);}
  for(const video of doc.querySelectorAll('[data-concept-media] video[data-concept-src]')){
   if(active.has(video))continue;
   const figure=video.closest('[data-concept-media]');let r=known.get(video);
   if(!r){
    r={video,figure,visible:false,allowed:false,playing:false,pending:false,failed:false,generation:0};known.set(video,r);
    video.autoplay=false;video.removeAttribute('autoplay');video.muted=true;video.defaultMuted=true;video.loop=true;video.playsInline=true;
    for(const attr of ['muted','loop','playsinline'])video.setAttribute(attr,'');video.setAttribute('preload','none');
    video.addEventListener('error',()=>{r.failed=true;poster(r);});
   }
   r.figure=figure;r.frame=figure.querySelector('.enhancement-visual')??figure;active.set(video,r);poster(r);intersection?.observe(r.frame);
  }
  sync();
 };
 controllers.set(doc,scan);
 if(typeof win?.MutationObserver==='function'){
  new win.MutationObserver(sync).observe(root,{attributes:true,attributeFilter:['data-visitor-motion','data-motion']});
  new win.MutationObserver(scan).observe(doc.body,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden','inert','aria-hidden','class','style']});
 }
 media?.addEventListener('change',sync);doc.addEventListener('visibilitychange',sync);scan();
}
