// Depot lab evidence access (note 13, 16; D1-11): every registered assumption with the current draft value per arm,
// deferred depth as not modeled, the plain-text source list and the Technical evidence of the current run.
import {el} from './dom.js';
import {termsByCategory,SOURCES} from '../model/depot-lab/registry.js';
import {numberText} from './depot-lab-format.js';
import {NOT_AVAILABLE,current,table} from './depot-lab-view.js';
const ARMS=['baseline','candidate'],ARM={baseline:'Baseline',candidate:'Candidate'};
const tech=t=>el('span',{class:'technical-only mono'},t);
// Pointer lookup into one draft arm; `*` spans every member of an array or object.
const look=(v,p)=>p.split('/').slice(1).reduce((xs,k)=>xs.flatMap(x=>x===null||typeof x!=='object'?[]:k==='*'?Object.values(x):Object.hasOwn(x,k)?[x[k]]:[]),[v]);
const text=(v,u)=>v===null||Array.isArray(v)&&!v.length?'none':typeof v==='object'?JSON.stringify(v):typeof v==='number'?`${numberText(v)}${u?` ${v===1&&/^[a-z]{3,}s$/.test(u)?u.slice(0,-1):u}`:''}`:String(v);
const size=v=>Array.isArray(v)?`${v.length} entries`:`${Object.keys(v).length} fields`;
function value(t,arm){
 if(!t.pointer)return el('td',{},'Fixed rule');
 const xs=arm?look(arm,t.pointer):[];
 if(!xs.length)return el('td',{},NOT_AVAILABLE);
 const all=xs.map(x=>text(x,t.unit)),seen=new Set(all),exact=all.join(', ');
 const brief=t.pointer.includes('*')?seen.size===1?`all ${all[0]} (${xs.length})`:`${xs.length} values, ${seen.size} different`:all[0].length>80?size(xs[0]):all[0];
 return el('td',{},brief===exact?brief:[brief,tech(` ${exact}`)]);
}
function assumptions(s){
 const cols=s.draft.candidate?ARMS:['baseline'],by=termsByCategory();
 const list=[...by.ASSUMPTION,...by.NOT_AVAILABLE.filter(t=>t.term_id.startsWith('deferred.'))];
 const rows=list.map(t=>el('tr',{'data-term':t.term_id},[el('th',{scope:'row'},[t.label_plain,el('span',{class:'note'},` ${t.definition}${t.provenance.origin.includes('profile')?' Fixed in this version.':''}`),tech(` ${t.term_id}${t.pointer?` ${t.pointer}`:''}; ${t.provenance.kind} from ${t.provenance.origin.join(', ')}`)]),
  ...cols.map(a=>t.category==='NOT_AVAILABLE'?el('td',{},'Not modeled in this version'):value(t,s.draft[a]))]));
 return table(`All assumptions, ${rows.length} rows, with the current draft value`,['Assumption',...cols.map(a=>ARM[a])],rows);
}
function evidence(s){
 const r=current(s),rows=ARMS.filter(a=>s.digests?.[a]).map(a=>[`${ARM[a]} draft scenario digest`,s.digests[a]]);
 if(r)for(const a of ARMS){
  const e=r.envelopes[a];if(!e)continue;
  const d=e.digests,v=e.versions,l=e.ledger,p=e.primary_violation,g=l.guard?.guard??l.guard;
  rows.push(...[['verification status',`${e.status}; ${e.consistency}`],['primary violation',p?`${p.code} at record ${p.seq}, tick ${p.tick}`:'none'],['scenario digest',d.scenario],['workload digest',d.workload],['policy digest',d.policy],['run digest',d.run??NOT_AVAILABLE],
   ['versions',`${v.engine}; ${v.verifier}; ${v.projection}; ${v.metric}`],['ledger',`${l.records} records; ${l.bytes} bytes; ${l.terminal_status}${g?`; guard ${g}`:''}`],['trust',Object.entries(e.trust).map(([k,x])=>`${k} ${x}`).join('; ')]].map(([k,x])=>[`${ARM[a]} ${k}`,x]));
 }
 rows.push(r?.comparison?['Comparison',`${r.comparison.classification}; digest ${r.comparison.digest??NOT_AVAILABLE}`]:['Current result',r?'baseline only':NOT_AVAILABLE]);
 return [el('h3',{},'Technical evidence'),el('dl',{class:'trust','aria-label':'Digests, versions, record counts and verification status'},rows.map(([k,x])=>el('div',{},[el('dt',{},k),el('dd',{},String(x))]))),
  el('h3',{},'Sources'),el('ul',{class:'sources'},SOURCES.map(x=>el('li',{'data-source':x.id},`${x.id} · ${x.label} · ${x.citation}. Limitation: ${x.limitation}${x.tag?` Tag: ${x.tag}.`:''}`)))];
}
// Mount point: rebuilt only when the draft or the attached result changes, never on cursor or tab changes.
export function mountEvidence({doc}){
 const box=doc.getElementById('assumptions'),ev=doc.getElementById('technical-evidence');let last={};
 return {render(s){
  if(s.draft!==last.draft)box.replaceChildren(assumptions(s));
  if(s.result!==last.result||s.digests!==last.digests)ev.replaceChildren(...evidence(s));
  last=s;
 }};
}
