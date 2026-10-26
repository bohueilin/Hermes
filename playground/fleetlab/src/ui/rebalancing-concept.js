// Concept motion. This module has no simulator, metrics or ledger access.
export function mountConceptLoops(doc=document){
 const view=doc.defaultView,motion=view?.matchMedia?.('(prefers-reduced-motion: reduce)'),saving=view?.navigator?.connection?.saveData;
 const cleanup=[];
 for(const video of doc.querySelectorAll('video[data-concept-loop]')){
  const box=video.parentNode,button=box.querySelector('[data-loop-control]'),status=box.querySelector('[data-loop-status]');
  if(!button||!status)throw Error('Concept player requires a visible control and status');
  video.muted=true;video.loop=true;video.playsInline=true;video.setAttribute('muted','');video.setAttribute('playsinline','');video.setAttribute('loop','');
  let visible=false,away=false,dead=false,wanted=!motion?.matches&&!saving,pending=false,reload=false,generation=0;
  const eligible=()=>visible&&!doc.hidden&&!away&&!dead&&!doc.documentElement.hasAttribute('data-visitor-user-paused');
  const label=()=>{button.textContent=(pending&&wanted)||video.paused===false?'Pause':'Play';button.setAttribute('aria-label',button.textContent+' concept illustration');};
  const pause=()=>{generation++;video.pause?.();label();};
  const fail=()=>{reload=true;wanted=false;pause();status.textContent='Playback unavailable. The poster remains visible; press Play to retry.';};
  function reconcile(){
   if(!wanted||!eligible()){pause();return;}
   if(pending||video.paused===false)return;
   if(!video.getAttribute('src'))video.setAttribute('src',video.getAttribute('data-src'));
   video.setAttribute('autoplay','');pending=true;const token=++generation;label();
   let attempt;try{attempt=video.play();}catch{pending=false;fail();return;}
   Promise.resolve(attempt).then(()=>{pending=false;if(token!==generation||!wanted||!eligible()){pause();if(wanted&&eligible())reconcile();}else{status.textContent='';label();}},()=>{pending=false;if(token!==generation||!wanted||!eligible()){label();if(wanted&&eligible())reconcile();}else fail();});
  }
  const click=()=>{if((pending&&wanted)||video.paused===false){wanted=false;pause();}else{wanted=true;status.textContent='';if(reload){reload=false;video.load?.();}reconcile();}};
  const playback=()=>{if(video.paused===false&&(!wanted||!eligible()))pause();else label();};
  const pref=()=>{if(motion.matches){wanted=false;video.removeAttribute('autoplay');pause();}};
  const hide=()=>{away=true;reconcile();},show=()=>{away=false;reconcile();};
  const observer=typeof view?.IntersectionObserver==='function'?new view.IntersectionObserver(entries=>{visible=entries.some(e=>e.target===video&&e.isIntersecting&&e.intersectionRatio>=.25);reconcile();},{threshold:[0,.25]}):null;
  if(observer)observer.observe(video);else{visible=true;wanted=false;}
  const held=typeof view?.MutationObserver==='function'?new view.MutationObserver(reconcile):null;held?.observe(doc.documentElement,{attributes:true,attributeFilter:['data-visitor-user-paused']});
  button.addEventListener('click',click);video.addEventListener('play',playback);video.addEventListener('pause',label);video.addEventListener('error',fail);
  doc.addEventListener('visibilitychange',reconcile);motion?.addEventListener('change',pref);view?.addEventListener('pagehide',hide);view?.addEventListener('pageshow',show);label();
  cleanup.push(()=>{dead=true;wanted=false;pause();observer?.disconnect();held?.disconnect();button.removeEventListener('click',click);video.removeEventListener('play',playback);video.removeEventListener('pause',label);video.removeEventListener('error',fail);doc.removeEventListener('visibilitychange',reconcile);motion?.removeEventListener('change',pref);view?.removeEventListener('pagehide',hide);view?.removeEventListener('pageshow',show);});
 }
 return()=>cleanup.forEach(fn=>fn());
}
