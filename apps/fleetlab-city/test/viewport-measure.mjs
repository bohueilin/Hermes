// Page measurement shared by viewport.test.mjs (the CI gate) and network-flows-evidence.mjs (the browser evidence), so
// both settle and measure a page the same way. The expressions run in the page through Runtime.evaluate.
import {setTimeout as sleep} from 'node:timers/promises';

// The expected title of each measured route.
export const TITLES={'/':'Home · FleetLab by Hermes','/network-flows/':'Network flows · FleetLab','/network-flows/capacity/':'Scheduling or capacity? | FleetLab',
 '/network-flows/software-delivery/':'One update. Where is the wait? | FleetLab','/network-flows/delivery-order/':'Who gets the depot link first? | FleetLab',
 '/network-flows/rebalancing/':'Where should the empty cars go? | FleetLab','/network-flows/dispatch/':'Which car takes the next request? | FleetLab',
 '/depot-readiness/':'Depot readiness lab | FleetLab'};
export const PROBE='(()=>{const d=document.documentElement;return d.scrollWidth+" "+d.scrollHeight+" "+document.getElementsByTagName("*").length})()';
// Overflowing elements: those past the requested width with no clipping ancestor below body. With allowed, the source
// of an in-page predicate, outside also lists the overflowing elements the predicate rejects.
export const MEASURE=(width,allowed)=>`document.fonts.ready.then(()=>{const d=document.documentElement,over=[],outside=[],allowed=${allowed??'null'};
 for(const el of document.body.querySelectorAll('*')){
  const r=el.getBoundingClientRect();if(!r.width||r.right<=${width}+0.5)continue;
  let p=el.parentElement;while(p&&p!==document.body&&getComputedStyle(p).overflowX==='visible')p=p.parentElement;
  if(p!==document.body)continue;
  const name=el.localName+(el.id?'#'+el.id:'')+(typeof el.className==='string'&&el.className.trim()?'.'+el.className.trim().split(/\\s+/).join('.'):'')+
   (el.labels?.length?' "'+el.labels[0].textContent.trim()+'"':'')+' right '+Math.round(r.right);
  over.push(name);if(allowed&&!allowed(el))outside.push(name);
 }
 return {title:document.title,visibility:document.visibilityState,innerWidth,clientWidth:d.clientWidth,scrollWidth:d.scrollWidth,over,...(allowed?{outside}:{})};})`;

// Settled once scroll size and element count are unchanged for 600 ms, capped at 5 s after the load event.
export async function settle(page){
 const start=Date.now();let last=await page.evaluate(PROBE),since=start;
 while(Date.now()-start<5000){
  await sleep(100);const now=await page.evaluate(PROBE);
  if(now!==last){last=now;since=Date.now();}else if(Date.now()-since>=600)return true;
 }
 return false;
}
