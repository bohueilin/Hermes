import {createDeliveryPage} from './software-delivery-page.js';

export function startSoftwareDelivery({doc=globalThis.document,createWorker,manifest}={}){
 const win=doc.defaultView,motion=win?.matchMedia?.('(prefers-reduced-motion: reduce)'),data=win?.matchMedia?.('(prefers-reduced-data: reduce)');
 const reduced=()=>Boolean(motion?.matches||data?.matches||win?.navigator?.connection?.saveData);
 const root=doc.getElementById('delivery-root');let page;
 try{page=createDeliveryPage({manifest,createWorker,reducedMotion:reduced});}catch(error){const message=doc.createElement('p');message.textContent=`This lesson could not start: ${error.message} Reload or return Home.`;root.appendChild(message);return null;}
 root.replaceChildren(page.element);doc.title='One update. Where is the wait? | FleetLab';
 let frame=null,last=null,intersecting=false,disposed=false;
 const visibility=()=>{last=null;page.visibilityChanged(!doc.hidden&&intersecting);};
 const changed=()=>{last=null;page.preferenceChanged();};
 const restored=()=>{last=null;page.historyRestore();visibility();};
 const departed=()=>{last=null;page.suspend();};
 const tick=time=>{if(disposed)return;if(last!==null)page.advance(Math.min(1000,Math.max(0,time-last)));last=time;frame=win.requestAnimationFrame(tick);};
 const observer=typeof win?.IntersectionObserver==='function'?new win.IntersectionObserver(entries=>{intersecting=entries.some(e=>e.isIntersecting);visibility();},{threshold:0}):null;
 if(observer){page.visibilityChanged(false);observer.observe(page.bench);}else{intersecting=true;visibility();}
 doc.addEventListener('visibilitychange',visibility);motion?.addEventListener('change',changed);data?.addEventListener('change',changed);win?.navigator?.connection?.addEventListener?.('change',changed);
 win?.addEventListener('pageshow',restored);win?.addEventListener('pagehide',departed);
 if(win?.requestAnimationFrame)frame=win.requestAnimationFrame(tick);
 const destroy=page.destroy;page.destroy=()=>{disposed=true;if(frame!==null)win?.cancelAnimationFrame?.(frame);observer?.disconnect();doc.removeEventListener('visibilitychange',visibility);motion?.removeEventListener('change',changed);data?.removeEventListener('change',changed);win?.navigator?.connection?.removeEventListener?.('change',changed);win?.removeEventListener('pageshow',restored);win?.removeEventListener('pagehide',departed);destroy();};
 return page;
}
