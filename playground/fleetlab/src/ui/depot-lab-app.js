// Depot lab page (engineering note 14 to 16): one session holds the draft, run, cursor and selection for both reading
// levels. Nothing runs on entry, an opened link, an import, preset choice, edits or tab change; only Run starts a worker.
import {createDepotSession,READING_LEVELS} from '../runtime/depot-lab-session.js';
import {decodeShare,decodeShareText,encodeShare,buildConfigurationExport,buildResultSummary,SHARE_KEY,MAX_SHARE_CHARS,MAX_ENVELOPE_BYTES} from './depot-lab-share.js';
import {presetCatalog} from '../model/depot-lab/presets.js';
import {el,setText} from './dom.js';
import {numberText} from './depot-lab-format.js';
import {trustNodes,statusText,errorText,outcomeNodes} from './depot-lab-view.js';
import {mountEvidence} from './depot-lab-evidence.js';
import {mountSetup} from './depot-lab-controls.js';
import {mountDepot} from './depot-lab-inspector.js';
const MOVE={ArrowRight:1,ArrowLeft:-1},SUMMARY_FILE='fleetlab-depot-result-summary.txt',OPENED='Nothing has run. Press Run to rerun and verify this setup here.';
const button=(text,fn)=>el('button',{type:'button',on:{click:fn}},text);
// Share, export and import per note 15. Exported files and copied summaries carry the honesty strings through the codec;
// size gates run before any text is read or parsed, and opening or importing a setup never runs it.
function mountShare({doc,session,io}){
 const say=t=>setText(doc.getElementById('share-status'),t),out=el('textarea',{readonly:true,rows:'4',hidden:true,'aria-label':'Text to copy'});
 const paste=el('textarea',{id:'import-text',rows:'4'}),file=el('input',{type:'file',accept:'application/json,.json'});
 const copy=async(text,done,what)=>{
  try{if(typeof io.clipboard?.writeText!=='function')throw Error('unavailable');await io.clipboard.writeText(text);out.hidden=true;say(done);}
  catch{out.value=text;out.hidden=false;out.setAttribute('aria-label',`The ${what} to copy`);out.focus();out.select?.();say(`Select and copy the ${what} below. Automatic clipboard access is unavailable.`);}
 };
 // Blob download through an unattached anchor; the object URL is revoked after the click has been handled.
 const save=(text,name,type)=>{try{const url=io.URL.createObjectURL(new io.Blob([text],{type}));el('a',{href:url,download:name}).click();io.later(()=>io.URL.revokeObjectURL(url),1000);return true;}catch{say('Saving a file is unavailable in this browser. Nothing was saved.');return false;}};
 const exporter=button('Export configuration',()=>{const r=session.exportText();if(!r.ok)return say(`Export refused: ${r.code}. Nothing was saved.`);if(save(r.text,r.filename,'application/json'))say(`Saved ${r.filename}, ${numberText(r.bytes)} bytes. Opening it later loads this setup and runs nothing.`);});
 const summary=button('Export result summary',()=>{const s=session.get();if(s.status!=='verified')return say('Only a verified result has a summary to export.');if(save(buildResultSummary(s),SUMMARY_FILE,'text/plain'))say(`Saved ${SUMMARY_FILE}.`);});
 const base=()=>typeof io.location?.href==='string'?io.location.href.split('#')[0]:'';
 const link=button('Share setup link',()=>{
  const r=session.shareFragment();
  if(r.ok)return copy(base()+r.fragment,'Setup link copied. Opening it loads this setup and runs nothing.','setup link');
  say(r.offer==='export'?`No link: this setup needs ${numberText(r.issues[0]?.value??0)} characters and links hold at most ${numberText(MAX_SHARE_CHARS)}. Export the configuration as a file instead.`:`No link was made: ${r.code}. Export the configuration as a file instead.`);
  exporter.focus();
 });
 // Byte cap before parsing: text longer than the cap in UTF-16 units is already over it in UTF-8 bytes.
 const take=(text,bytes)=>{if(bytes>MAX_ENVELOPE_BYTES)return say(`Refused before parsing: larger than ${numberText(MAX_ENVELOPE_BYTES)} bytes. Nothing changed and nothing ran.`);const r=session.importText(text);say(r.ok?`Imported the configuration. ${OPENED}`:`Import refused: ${r.code}. The current setup is unchanged and nothing ran.`);};
 const read=async()=>{const f=file.files?.[0];if(!f)return;file.value='';if(!(f.size<=MAX_ENVELOPE_BYTES))return take('',Infinity);let t;try{t=await f.text();}catch{return say('The file could not be read. Nothing changed.');}take(t,new TextEncoder().encode(t).length);};
 file.addEventListener('change',read);
 doc.getElementById('share').replaceChildren(el('div',{class:'share-actions'},[link,exporter,summary,button('Copy summary',()=>copy(buildResultSummary(session.get()),'Summary copied with the three honesty statements.','summary'))]),out,
  el('div',{class:'import'},[el('label',{for:'import-text'},'Paste a configuration to import'),paste,button('Import setup',()=>{const t=paste.value;take(t,t.length>MAX_ENVELOPE_BYTES?t.length:new TextEncoder().encode(t).length);}),el('label',{},['Or import a configuration file',file])]));
 return {
  render(s){summary.setAttribute('aria-disabled',String(s.status!=='verified'));},
  // A #share= fragment in the page address opens the setup and never runs it.
  open(){const h=io.location?.hash;if(typeof h!=='string'||!h.startsWith(SHARE_KEY))return;const r=session.openFragment(h);say(r.ok?`Opened a shared setup. ${OPENED}`:`The shared link was refused: ${r.code}. Nothing ran; a configuration file can be imported instead.`);},
 };
}
// Views: setup controls (questions, presets, counters, families), evidence, share and the depot schematic/inspector all
// render on every state change; extra mounts ({doc, session}) => {render(state)} render after them. `io` injects location, clipboard, Blob, URL and the delayed call.
export function startDepotLab({createWorker,root=document,mounts=[],io={}}={}){
 const by=id=>root.getElementById(id),catalog=presetCatalog(),tabs=READING_LEVELS.map(l=>by(`tab-${l}`)),g=globalThis;
 const runPair=by('run-pair'),runBase=by('run-baseline'),cancel=by('cancel'),progress=by('progress'),error=by('error');
 let shown=null;const views=[];
 const render=s=>{
  const level=s.presentation.reading_level;
  root.documentElement.setAttribute('data-level',level);
  tabs.forEach((t,i)=>{const on=READING_LEVELS[i]===level;t.setAttribute('aria-selected',String(on));t.setAttribute('tabindex',on?'0':'-1');});
  by('lab-panel').setAttribute('aria-labelledby',`tab-${level}`);
  by('trust').replaceChildren(...trustNodes(s));
  setText(by('status'),statusText(s));
  const err=errorText(s);error.hidden=!err;setText(error,err??'');
  progress.hidden=s.status!=='running';
  if(s.progress){progress.setAttribute('max',String(Math.max(1,s.progress.total)));progress.setAttribute('value',String(s.progress.done));}
  cancel.hidden=!s.pending;
  for(const b of [runPair,runBase])b.setAttribute('aria-disabled',String(s.status==='running'));
  // The outcome depends only on the run state, the attached result and stale history, so a tab change keeps its nodes.
  if(!shown||['status','result','pending','history'].some(k=>shown[k]!==s[k])){by('outcome').replaceChildren(...outcomeNodes(s));shown=s;}
  for(const v of views)v.render(s);
 };
 const session=createDepotSession({workerFactory:createWorker,onChange:render,codec:{decodeShare,decodeShareText,encodeShare,buildConfigurationExport},preset:catalog[0].id});
 const share=mountShare({doc:root,session,io:{location:g.location,clipboard:g.navigator?.clipboard,Blob:g.Blob,URL:g.URL,later:(f,ms)=>g.setTimeout(f,ms),...io}});
 const depot=mountDepot({doc:root,session});
 views.push(mountSetup({doc:root,session}),mountEvidence({doc:root,session}),share,depot,...mounts.map(m=>m({doc:root,session})));
 const run=mode=>()=>{if(session.get().status!=='running')session.run(mode);};
 const activate=t=>{const level=READING_LEVELS[tabs.indexOf(t)];if(level&&level!==session.get().presentation.reading_level)session.setPresentation({reading_level:level});};
 runPair.addEventListener('click',run('pair'));runBase.addEventListener('click',run('baseline'));
 cancel.addEventListener('click',()=>{const mode=session.get().pending?.mode;session.cancel();(mode==='baseline'?runBase:runPair).focus();});
 // Manual activation (WAI tabs): arrows, Home and End move focus only; Enter, Space or a click activates.
 for(const t of tabs){
  t.addEventListener('click',()=>activate(t));
  t.addEventListener('keydown',e=>{
   const i=tabs.indexOf(t),n=tabs.length,j=Object.hasOwn(MOVE,e.key)?(i+MOVE[e.key]+n)%n:e.key==='Home'?0:e.key==='End'?n-1:-1;
   if(j>=0){e.preventDefault();tabs[j].focus();}
   else if(e.key==='Enter'||e.key===' '){e.preventDefault();activate(t);}
  });
 }
 render(session.get());share.open();
 return {session,dispose:()=>{depot.dispose?.();session.dispose();}};
}
