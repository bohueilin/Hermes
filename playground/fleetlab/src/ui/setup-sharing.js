import {el} from './dom.js';
import {createSetup,encodeSetup} from './setup-codec.js';
import {routeHref} from './routes.js';

/** Explicit snapshots only: a setup URL contains inputs, never a computed result. */
export function createSetupSharing({models,page,capture,onLink=()=>{},baseUrl=()=>globalThis.location?.href?.split('#')[0]??'',copy=text=>globalThis.navigator?.clipboard?.writeText(text)??Promise.reject(Error('Clipboard unavailable'))}){
 const model=el('select',{'aria-label':'Setup model'},models.map(([value,label])=>el('option',{value},label)));
 const source=el('select',{'aria-label':'Setup snapshot'});
 function sources(){
  const previous=source.value;
  const items=[['current','Current inputs'],['last-run','Last completed run']];
  if(['fleet-day','regional'].includes(model.value))items.push(['last-experiment','Last completed paired experiment']);
  source.replaceChildren(...items.map(([value,label])=>el('option',{value},label)));
  source.value=items.some(([value])=>value===previous)?previous:'current';
 }
 model.addEventListener('change',sources);sources();
 const context=el('p',{class:'setup-loaded-context',role:'note',hidden:true});
 const status=el('p',{role:'status',class:'setup-share-status'});
 const url=el('input',{type:'text',readonly:true,'aria-label':'Generated setup link'});
 const output=el('div',{class:'setup-share-output',hidden:true});
 const download=el('a',{download:'fleetlab-setup.json',class:'studio-button'},'Download this setup JSON');
 const copyButton=el('button',{type:'button',class:'studio-button','data-action':'copy-setup-link',on:{click:async()=>{
  try{await copy(url.value);status.textContent='Setup link copied. It contains inputs; the recipient chooses when to run.';}
  catch{status.textContent='Select and copy the link below. Automatic clipboard access is unavailable.';url.focus();url.select?.();}
 }}},'Copy link');
 output.appendChild(url);output.appendChild(copyButton);output.appendChild(download);
 const generate=el('button',{type:'button',class:'studio-button','data-action':'create-setup-link',on:{click:()=>{
  output.hidden=true;url.value='';download.removeAttribute('href');
  try{
   const setup=createSetup(capture(source.value,model.value));
   download.setAttribute('href','data:application/json;charset=utf-8,'+encodeURIComponent(JSON.stringify(setup,null,2)));
   const href=routeHref({page:typeof page==='function'?page(setup):page,setup:encodeSetup(setup)});
   url.value=baseUrl()+href;output.hidden=false;copyButton.hidden=false;url.hidden=false;
   const label=source.options[source.selectedIndex]?.textContent??source.value;
   status.textContent=`${label} captured. This link preserves this snapshot, not later edits. Simulation only · NOT_EVIDENCE · authority NONE.`;
   onLink(href);
  }catch(error){
   status.textContent=`Could not create a setup link: ${error.message}`;
   if(download.hasAttribute('href')){output.hidden=false;copyButton.hidden=true;url.hidden=true;status.textContent+=' Download the complete setup JSON; nothing was truncated.';}
  }
 }}},'Create setup link');
 const element=el('details',{class:'setup-sharing'},[
  el('summary',{},'Share a reproducible setup'),context,
  el('p',{},'Choose the inputs you mean to share. Links contain the full teaching configuration and model versions; opening one does not run a simulation. Use synthetic information only. Custom owner names and free text cannot be included in links.'),
  el('div',{class:'setup-share-controls'},[el('label',{},['Model',model]),el('label',{},['Snapshot',source]),generate]),status,output,
  el('p',{class:'setup-share-note'},'Setup JSON preserves inputs only. Existing result downloads and summaries remain the record of a completed run. For an offline copy, open the same HTML file with the generated fragment; a file address does not transfer the file.'),
 ]);
 return {element,loaded(){context.hidden=false;context.textContent='Shared inputs loaded. Run explicitly to compute a result. The preset is a starting reference; imported settings may differ. Edit counters describe changes after import.';element.open=true;},setModel(value){model.value=value;sources();},clear(){context.hidden=true;output.hidden=true;url.value='';status.textContent='';}};
}
