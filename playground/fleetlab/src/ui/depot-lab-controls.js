// Depot lab setup controls (note 13, 16; annex C1.2, Q8, Q24): questions, named setups, counters, seven families. Never runs.
import {el,setText,keyedList} from './dom.js';
import {presetCatalog,worker as roleWorker,port as newPort} from '../model/depot-lab/presets.js';
import {LIMITS} from '../model/depot-lab/schema.js';
import {term,TERMS} from '../model/depot-lab/registry.js';
import {requiredChargeMj,socEnergy,bandAt} from '../model/depot-lab/units.js';
import {numberText,kwhText} from './depot-lab-format.js';
const T=id=>term(id)?.label_plain??id,DEF=id=>term(id)?.definition??'';
const J=v=>v===undefined||v===null?'none':typeof v==='object'?JSON.stringify(v):String(v);
const clone=v=>JSON.parse(JSON.stringify(v)),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const tech=(t='')=>el('span',{class:'technical-only mono'},t),note=t=>el('p',{class:'note'},t);
const pl=(n,w)=>`${n} ${w}${n===1?'':'s'}`,pad=(n,w)=>String(n).padStart(w,'0'),byId=(x,y)=>x.id<y.id?-1:x.id>y.id?1:0;
const per=(x,k)=>x%k===0?numberText(x/k):String(x/k),MB=125000,GB=1000000000;
const ZONES=['waiting','charging','cleaning','garage'],ROLES={cleaner:'C',technician:'T',mover:'M',lead:'L'};
const CLASSES={intake:'Intake',cabin:'Cabin reset',diagnosis:'Diagnosis',mechanical_repair:'Mechanical repair',specialist_repair:'Specialist repair',inspection:'Final inspection',connect:'Connect charger',unplug:'Unplug',move:'Move'};
const LEVELS=[['unqualified','Not qualified'],['supervised_only','Supervised only'],['independent','Independent']],PROFS=[['developing','Developing'],['practiced','Practiced'],['advanced','Advanced']];
const FIELD=new Map(TERMS.filter(t=>t.treatment).map(t=>[t.pointer,t.label_plain]));
const QUESTIONS=[['What work is required before this vehicle can leave the depot?',['B','M']],['Which resources are occupied, available, incompatible or missing?',['T2','S200']],['Would more space, power, skills or network capacity change the outcome?',['P','PS','D','DR','W','G','GN','TP','TN','ST']]];
// Schema issues show on the card owning their path, else on Workload and rules.
const OWNER=[['space',/^\/site\/positions/],['energy',/^\/(site\/(ports|supply_w|background_w)|requirements)/],['garage',/^\/(site\/garage_level|vendor)/],['services',/^\/services/],['data',/^\/network/],['training',/^\/workers\/\d+\/qualifications/],['staff',/^\/workers/]];
// Solo durations always come from the fixed proficiency table, through the role-template builder.
const qual=(c,level,proficiency,may)=>roleWorker('X','lead',{[c]:{level,proficiency,may_supervise:!!may&&level==='independent'}}).qualifications.find(r=>r.task_class===c);
const cnt=(a,z)=>a.site.positions.filter(p=>p.zone===z).length,ported=a=>new Set(a.site.ports.map(p=>p.position_id));
const free=(a,z)=>{const h=ported(a);return a.site.positions.filter(p=>p.zone===z&&!h.has(p.id)).map(p=>p.id).sort().reverse();};
// Zone inventory is authoritative: additions take new ids; reductions remove portless positions of that zone, never rezone.
function rezone(a,z,v){
 const k=cnt(a,z);
 if(v>k){const m=Math.max(0,...a.site.positions.map(p=>/^P\d+$/.test(p.id)?Number(p.id.slice(1)):0));for(let i=1;i<=v-k;i++)a.site.positions.push({id:`P${pad(m+i,3)}`,zone:z,enabled:true});}
 else{const drop=new Set(free(a,z).slice(0,k-v));a.site.positions=a.site.positions.filter(p=>!drop.has(p.id));}
 a.site.positions.sort(byId);
}
const zoneCheck=(a,z,v)=>{const k=cnt(a,z),t=a.site.positions.length-k+v,f=free(a,z).length;return t<1||t>LIMITS.positions?`The total must stay from 1 to ${LIMITS.positions} positions; this would make ${t}.`:k-v>f?`Only ${f} ${z} positions have no charging port, so this count cannot go below ${k-f} here. Remove a port in AC/DC charging first.`:null;};
const freeCharging=a=>{const h=ported(a);return a.site.positions.filter(p=>p.zone==='charging'&&!h.has(p.id)).map(p=>p.id);};
const nextId=(list,pre)=>`${pre}${pad(Math.max(0,...list.map(x=>x.id.startsWith(pre)&&/^\d+$/.test(x.id.slice(pre.length))?Number(x.id.slice(pre.length)):0))+1,2)}`;
// A count change keeps visits and appends the tape pattern at the current spacing; a spacing change re-spaces every
// arrival. Release-by offsets are kept; the arrival window only grows.
function regen(a,n,sp,all){
 const v=a.visits,k=v.length,w=n>99?3:2,last=Math.max(...v.map(x=>x.arrival_tick));
 a.visits=Array.from({length:n},(_,i)=>{const t=v[i%k],at=all?v[0].arrival_tick+i*sp:i<k?t.arrival_tick:last+(i-k+1)*sp;return {...clone(t),id:pad(i+1,w),arrival_tick:at,due_tick:t.due_tick===null?null:at+t.due_tick-t.arrival_tick};});
 a.arrival_window_tick=Math.max(a.arrival_window_tick,...a.visits.map(x=>x.arrival_tick+1));
}
const tapeCheck=(a,n,sp,all)=>{const x=clone(a);regen(x,n,sp,all);const last=Math.max(...x.visits.map(v=>v.arrival_tick));return x.arrival_window_tick>x.horizon_tick?`The last arrival would be at ${numberText(last)} s, not before the end of the run at ${numberText(x.horizon_tick)} s. Shorten the arrival spacing or lengthen the run.`:null;};
export function mountSetup({doc,session}){
 const by=id=>doc.getElementById(id),cat=presetCatalog(),ups=[],rows=new WeakMap(),scope={};
 let n=0,mark={preset:undefined,gen:0,own:false},issues=[],memo=900;
 const now=()=>session.get(),shown=s=>s.draft.candidate??s.draft.baseline,uid=()=>`dlc-${++n}`,refresh=()=>render(now());
 const itext=i=>`${i.arm==='baseline'?'Baseline':'Candidate'} setup check: ${i.code} at ${i.path||'/'}${i.bound!=null?`, allowed ${J(i.bound)}`:''}.`;
 const spacing=a=>{const v=a.visits;return v.length>1?Math.floor((v[v.length-1].arrival_tick-v[0].arrival_tick)/(v.length-1)):memo;};
 // Infrastructure edits follow the card's arm choice; requirements (no card) update both. Every target arm must pass
 // `check`; an edit changing nothing never reaches the session.
 function change(card,apply,check){
  const sc=card?scope[card]:'both',d=now().draft,list=(sc==='both'?[d.baseline,d.candidate]:[d.candidate??d.baseline]).filter(Boolean);
  let diff=false;
  for(const a of list){const m=check?.(a);if(m)return m;const x=clone(a);apply(x);diff||=!same(x,a);}
  if(diff)session.edit(a=>{apply(a);},{scope:sc});
  return null;
 }
 // A labelled control over get(arm)/apply(arm,v). A refusal keeps the typed text with its message attached, as do issues at path.
 function control(o,input,read,write){
  const id=uid(),mid=`${id}-m`,base=el('span',{class:'note'}),tx=tech(),msg=el('p',{id:mid,class:'issue',hidden:true}),typed=input.getAttribute('type')==='number';
  let bad=null,gen=0;input.setAttribute('id',id);
  input.addEventListener('change',()=>{const v=read();gen=now().generation;bad=v===undefined?o.err:change(o.card,a=>o.apply(a,v),o.check&&(a=>o.check(a,v)));refresh();});
  const up=s=>{
   if(bad&&s.generation!==gen)bad=null;
   const a=shown(s),v=o.get(a),b=o.get(s.draft.baseline),u=o.tid&&term(o.tid)?.unit;
   if(!bad&&!(typed&&doc.activeElement===input))write(v);
   setText(base,s.draft.candidate&&!same(b,v)?`Baseline: ${o.show?o.show(b):J(b)}`:'');
   setText(tx,`${o.tech??o.tid}${u?` (${u})`:''}: ${J(v)}`);
   const m=bad??(o.path?issues.filter(i=>i.path===o.path(a)).map(itext).join(' '):'');msg.hidden=!m;setText(msg,m||'');
   if(m){input.setAttribute('aria-invalid','true');input.setAttribute('aria-describedby',mid);}else{input.removeAttribute('aria-invalid');input.removeAttribute('aria-describedby');}
  };
  return {node:el('div',{class:'field'},[el('label',{for:id},`${o.label??T(o.tid)}${o.unit&&o.unit!=='%'?`, in ${o.unit}`:''}${o.diag?' (diagnostic field)':''}`),input,base,tx,msg]),up};
 }
 const num=o=>{const k=o.scale??1,i=el('input',{type:'number',inputmode:'numeric',step:1,min:o.min,max:o.max});
  return control({err:`Enter a whole number from ${o.min} to ${o.max}${o.unit?` ${o.unit}`:''}.`,show:v=>v==null?'none':`${per(v,k)}${o.unit?` ${o.unit}`:''}`,...o},i,()=>{const t=i.value.trim(),v=Number(t);return /^-?\d+$/.test(t)&&v>=o.min&&v<=o.max?v*k:undefined;},v=>{i.value=v==null?'':String(v/k);});};
 const pick=o=>{const i=el('select',{},o.options.map(([v,t])=>el('option',{value:v},t)));return control(o,i,()=>i.value,v=>{i.value=v;});};
 const tick=o=>{const i=el('input',{type:'checkbox'});return control({show:v=>v==null?'none':v?'on':'off',...o},i,()=>i.checked,v=>{i.checked=!!v;});};
 const add=c=>{ups.push(c.up);return c.node;};
 const dyn=(f,tag='p',cls='note')=>{const p=el(tag,{class:cls});return {node:p,up:s=>setText(p,f(s,shown(s)))};},info=(f,cls)=>add(dyn(f,'p',cls));
 const btn=(t,f,attrs={})=>el('button',{type:'button',...attrs,on:{click:()=>{f();refresh();}}},t);
 const flash=()=>{const p=el('p',{class:'issue'});let g=-1;ups.push(s=>{if(s.generation!==g)setText(p,'');});return {node:p,set:m=>{g=now().generation;setText(p,m??'');}};};
 const row=parts=>{const ps=parts.filter(Boolean);return {node:el('li',{},ps.map(p=>p.node??p)),up:s=>ps.forEach(p=>p.up?.(s))};};
 // Keyed rows keep their nodes, and so focus, across renders.
 const list=(items,key,create)=>{const ul=el('ul',{class:'rows'});ups.push(s=>{keyedList(ul,items(shown(s)),{key,create:x=>{const r=create(x);rows.set(r.node,r.up);return r.node;}});for(const c of ul.children)rows.get(c)?.(s);});return ul;};
 const armUI=key=>{
  scope[key]='candidate';const chip=el('p',{class:'scope'}),r=(v,t)=>{const i=el('input',{type:'radio',name:`dlc-${key}-arm`,value:v,checked:v==='candidate'});i.addEventListener('change',()=>{if(i.checked){scope[key]=v;refresh();}});return el('label',{class:'field-row'},[i,t]);};
  ups.push(()=>setText(chip,`Applies to: ${scope[key]==='both'?'both setups':'candidate only'}`));
  return [chip,el('fieldset',{class:'arm'},[el('legend',{},'Apply edits in this card to'),r('candidate','Candidate only'),r('both','Both setups')])];
 };
 const shared=()=>[el('p',{class:'scope'},'Applies to: both setups'),note('Shared requirement: every change updates both setups together.')];
 const card=(key,title,kids)=>{const ul=el('ul',{class:'issues'});ups.push(()=>ul.replaceChildren(...issues.filter(i=>i.card===key).map(i=>el('li',{class:'issue'},itext(i)))));return el('section',{class:'card','aria-labelledby':`dlc-${key}`},[el('h3',{id:`dlc-${key}`},title),...kids,ul]);};
 const load=id=>{session.selectPreset(id);mark={preset:id,gen:now().generation,own:false};refresh();};
 const own=()=>{session.selectPreset(cat[0].id);const b=now().draft.baseline;session.edit(()=>clone(b),{scope:'candidate'});mark={preset:cat[0].id,gen:now().generation,own:true};refresh();};
 const qBtn=id=>{const p=cat.find(x=>x.id===id),rid=uid();return el('li',{},[el('button',{type:'button','aria-describedby':rid,on:{click:()=>load(id)}},p.title),el('p',{id:rid,class:'note'},`Declared regime: ${p.regime}`),tech(`preset ${id}`)]);};
 const qCard=(i,q,kids)=>el('section',{class:'card'},[el('p',{class:'note'},`Learning question ${i}`),el('h3',{},q),...kids]);
 by('questions').replaceChildren(...QUESTIONS.map(([q,ids],i)=>qCard(i+1,q,[el('ul',{class:'rows'},ids.map(qBtn))])),
  el('section',{class:'card'},[el('p',{class:'note'},'Free-form'),el('h3',{},'Build your own'),el('p',{},`Start from the ${cat[0].title} with an identical candidate, then change any family below. Nothing runs until you press Run.`),btn('Build your own setup',own,{class:'primary'})]),
  qCard(4,'How does a local depot decision affect riders, empty travel and the rest of the fleet?',[el('p',{},'Not available in this version: no fleet model is included.')]),
  qCard(5,'What trade-off did a scheduling policy make, and how strong is the evidence for it?',[el('p',{},`A later stage. This version uses one fixed rule, ${now().draft.baseline.policy_id}, and compares setups, not policies.`)]));
 const sel=by('preset');
 sel.replaceChildren(el('option',{value:'',disabled:true,hidden:true},'Your own setup'),...cat.map(p=>el('option',{value:p.id},p.title)));
 sel.addEventListener('change',()=>{if(sel.value)load(sel.value);});
 // Counters read the session's compatibility and edit count.
 const cK=el('p'),cE=el('p'),cT=el('p'),sum=el('summary'),leaves=el('ul');
 by('counters').replaceChildren(cK,cE,cT,el('details',{},[sum,leaves]));
 const leaf=l=>{const f=[...FIELD.keys()].filter(p=>l.pointer===p||l.pointer.startsWith(`${p}/`)).sort((x,y)=>y.length-x.length)[0],rest=f?l.pointer.slice(f.length+1).split('/').map(x=>x.replaceAll('~1','/').replaceAll('~0','~')).join(' '):'';
  return el('li',{},[`${FIELD.get(f)??l.pointer}${rest?`, ${rest}`:''}: ${l.old===null?'added':l.new===null?'removed':`${J(l.old)} to ${J(l.new)}`}`,tech(` ${l.pointer}: ${J(l.old)} to ${J(l.new)}`)]);};
 ups.push(s=>{
  const c=s.compatibility,t=c?.compatible?c.treatment:null;
  setText(cK,`${T('session.differences_from_baseline')}: ${s.draft.candidate===null?'no candidate':t?t.fields.length:c?'not comparable':'not available, a setup fails its checks'}`);
  setText(cE,`${T('session.edits_since_last_run')}: ${s.edits_since_run}`);
  setText(cT,t?`${pl(t.intervention_count,'intervention')} · ${pl(t.fields.length,'authoritative field')}`:'');cT.hidden=!t;
  setText(sum,t?`Every changed value (${t.leaves.length})${t.fields.length?`: ${t.fields.map(f=>FIELD.get(f)??f).join('; ')}`:''}`:`Why these setups are not comparable (${c?.issues.length??0})`);
  leaves.replaceChildren(...(t?t.leaves.map(leaf):(c?.issues??[]).map(i=>el('li',{},`${i.code} at ${i.path}`))));
 });
 const ports=a=>a.site.ports,posSel=el('select',{'aria-label':'Charging position for a new port'}),portMsg=flash(),staffMsg=flash();
 let opts='';ups.push(s=>{const f=freeCharging(shown(s)),v=posSel.value;if(J(f)!==opts){opts=J(f);posSel.replaceChildren(...f.map(id=>el('option',{value:id},id)));if(f.includes(v))posSel.value=v;}});
 const addPort=kind=>{const pos=posSel.value;portMsg.set(pos?change('energy',a=>{ports(a).push(newPort(nextId(ports(a),kind),pos,kind));ports(a).sort(byId);},a=>ports(a).length>=LIMITS.ports?`At most ${LIMITS.ports} ports.`:freeCharging(a).includes(pos)?null:`${pos} is not a free charging position in every setup this edit applies to.`):'Every charging position already has a port. Add a charging position in Space first.');};
 const tgt=a=>a.requirements.energy.target_soc_pct,setT=v=>a=>{a.requirements.energy.target_soc_pct=v;};
 const need=a=>{const e=a.visits.map(x=>requiredChargeMj(x.initial_soc_pct,tgt(a)));return {t:e.reduce((x,y)=>x+y,0n),lo:e.reduce((x,y)=>y<x?y:x),hi:e.reduce((x,y)=>y>x?y:x)};};
 const quick=[60,80,90,100].map(v=>{const b=btn(`${v}%`,()=>change(null,setT(v)));ups.push(s=>b.setAttribute('aria-pressed',String(tgt(s.draft.baseline)===v)));return b;});
 const svc=(k,f,tid,options)=>add(pick({card:'services',tid,tech:`services.${k}.${f}`,options,get:a=>a.services[k][f],apply:(a,v)=>{a.services[k][f]=v;},path:()=>`/services/${k}/${f}`}));
 const rate=(key,max,diag)=>add(num({card:'data',tid:`network.${key}`,diag,unit:'Mbps',scale:MB,min:0,max:max/MB,get:a=>a.network[key],apply:(a,v)=>{a.network[key]=v;},path:()=>`/network/${key}`}));
 const quals=w=>{const ctl=[],fs=Object.keys(CLASSES).map(c=>{
  const g=a=>a.workers.find(x=>x.id===w.id)?.qualifications.find(r=>r.task_class===c),set=f=>(a,v)=>{const r=g(a);if(r)Object.assign(r,f(r,v));};
  const parts=[pick({card:'training',label:`${w.id} ${CLASSES[c]}: ${T('worker.qualification')}`,tid:'worker.qualification',options:LEVELS,get:a=>g(a)?.level,apply:set((r,v)=>qual(c,v,r.proficiency,v==='independent'))}),
   pick({card:'training',label:`${w.id} ${CLASSES[c]}: ${T('worker.proficiency')}`,tid:'worker.proficiency',options:PROFS.map(([v,t])=>[v,`${t} (${qual(c,'independent',v).solo_duration_ticks} s)`]),get:a=>g(a)?.proficiency,apply:set((r,v)=>qual(c,r.level,v,r.may_supervise))}),
   dyn((s,a)=>{const r=g(a);return r?`${T('worker.solo_duration_ticks')}: ${numberText(r.solo_duration_ticks)} s${r.may_supervise?'; may supervise':''}.`:'';})];
  ctl.push(...parts);return el('fieldset',{},[el('legend',{},CLASSES[c]),...parts.map(p=>p.node)]);});
  return {node:el('li',{},el('details',{},[el('summary',{},`${w.id}: qualification and proficiency per task`),...fs])),up:s=>ctl.forEach(p=>p.up(s))};};
 const addStaff=Object.entries(ROLES).map(([r,pre])=>btn(`Add ${r}`,()=>staffMsg.set(change('staff',a=>{a.workers.push(roleWorker(nextId(a.workers,pre),r,{},a.horizon_tick));a.workers.sort(byId);},a=>a.workers.length>=LIMITS.workers?`At most ${LIMITS.workers} workers.`:null))));
 const fixedRow=(id,f)=>el('div',{},[el('dt',{},T(id)),el('dd',{},[add(dyn((s,a)=>f(a),'span','mono')),tech(` ${DEF(id)}`)])]);
 by('setup').replaceChildren(
  card('space','Space',[...armUI('space'),
   ...ZONES.map(z=>add(num({card:'space',label:`${T('site.positions')}: ${z}`,tid:'site.positions',tech:`site.positions ${z} count`,min:0,max:LIMITS.positions,get:a=>cnt(a,z),check:(a,v)=>zoneCheck(a,z,v),apply:(a,v)=>rezone(a,z,v)}))),
   add(num({card:'space',tid:'site.position_total',min:1,max:LIMITS.positions,get:a=>a.site.positions.length,check:(a,v)=>{const w=free(a,'waiting').length,t=a.site.positions.length;return t-v>w?`Only ${w} waiting positions can be removed, so the total cannot go below ${t-w} here. Reduce another zone first.`:null;},apply:(a,v)=>rezone(a,'waiting',cnt(a,'waiting')+v-a.site.positions.length)})),
   note('Derived from the zones above; changing it adds or removes waiting positions only, never rezoning. It counts work positions, not fleet size.'),
   el('details',{},[el('summary',{},'Enable or disable each position'),list(a=>a.site.positions,p=>`${p.id}:${p.zone}`,p=>row([tick({card:'space',label:`${p.id} (${p.zone}) enabled`,tid:'site.positions',tech:`site.positions ${p.id} enabled`,get:a=>a.site.positions.find(x=>x.id===p.id)?.enabled,apply:(a,v)=>{const x=a.site.positions.find(q=>q.id===p.id);if(x)x.enabled=v;}})]))])]),
  card('energy','AC/DC charging',[...armUI('energy'),
   list(ports,p=>`${p.id}:${p.kind}:${p.position_id}`,p=>{const g=a=>ports(a).find(x=>x.id===p.id),ap=f=>(a,v)=>{const x=g(a);if(x)f(x,v);};
    return row([`${p.id}: ${p.kind} port on ${p.position_id}`,num({card:'energy',label:`${p.id} rating`,tid:'site.ports',tech:`site.ports ${p.id} rating_w (W)`,unit:'kW',scale:1000,min:0,max:LIMITS.watts/1000,get:a=>g(a)?.rating_w,apply:ap((x,v)=>{x.rating_w=v;})}),
     tick({card:'energy',label:`${p.id} enabled`,tid:'site.ports',tech:`site.ports ${p.id} enabled`,get:a=>g(a)?.enabled,apply:ap((x,v)=>{x.enabled=v;})}),btn(`Remove ${p.id}`,()=>{posSel.focus();change('energy',a=>{a.site.ports=ports(a).filter(x=>x.id!==p.id);});})]);}),
   el('div',{class:'field-row'},[posSel,btn('Add DC port',()=>addPort('DC')),btn('Add AC port',()=>addPort('AC'))]),portMsg.node,note(`${T('site.ports')}: ${DEF('site.ports')}`),
   add(num({card:'energy',diag:1,tid:'site.supply_w',unit:'kW',scale:1000,min:0,max:LIMITS.watts/1000,get:a=>a.site.supply_w,apply:(a,v)=>{a.site.supply_w=v;},path:()=>'/site/supply_w'})),
   info((s,a)=>`${T('site.background_w')}: ${numberText(a.site.background_w)} W, a fixed shared assumption.`),
   el('h4',{},'Target battery SOC, a shared requirement'),...shared(),
   add(num({tid:'requirement.energy.target_soc_pct',min:20,max:100,unit:'%',err:'Enter a whole number from 20 to 100.',get:tgt,apply:(a,v)=>setT(v)(a),path:()=>'/requirements/energy/target_soc_pct'})),
   el('div',{class:'shortcuts',role:'group','aria-label':'Target SOC shortcuts'},quick),
   info((s,a)=>{const v=a.visits.map(x=>x.initial_soc_pct),lo=Math.min(...v),hi=Math.max(...v);return `${T('visit.initial_soc_pct')}: ${lo===hi?`${lo}% for all ${pl(v.length,'visit')}`:`${lo}% to ${hi}% across ${pl(v.length,'visit')}`}. ${T('vehicle.pack_capacity_mj')}.`;}),
   info((s,a)=>{const {lo,hi,t}=need(a);return `${T('energy.required_charge_mj')}: ${lo===hi?kwhText(lo):`${kwhText(lo)} to ${kwhText(hi)}`} per visit, ${kwhText(t)} in total.${t===0n?' Visits at or above the target need no charging work.':''}`;}),info((s,a)=>`energy.required_charge_mj total: ${need(a).t} mJ`,'technical-only mono'),
   info((s,a)=>{const b=bandAt(socEnergy(tgt(a))-1n,a.vehicle_profile.dc_bands);return `Final DC band below the target: ${b.from_soc_pct}% to ${b.until_soc_pct}% SOC, up to ${per(b.cap_w,1000)} kW. AC: ${DEF('vehicle.ac_cap_w')}`;}),
   note(DEF('requirement.shared_across_arms'))]),
  card('garage','Garage',[...armUI('garage'),
   add(pick({card:'garage',tid:'site.garage_level',options:[['none','None'],['basic','Basic'],['specialist','Specialist']],get:a=>a.site.garage_level,apply:(a,v)=>{a.site.garage_level=v;},path:()=>'/site/garage_level'})),
   note('“None” removes on-site repair capability. It does not remove faults from the work.'),note('Specialist adds zero eligible tasks in these tapes: no visit has a specialist fault.'),
   info((s,a)=>{const v=a.vendor;return `Fixed shared assumptions: ${T('vendor.enabled')} ${v.enabled?'on':'off'}; ${T('vendor.bay_count')} ${v.bay_count}; ${T('vendor.worker_count')} ${v.worker_count}; ${T('vendor.times')}: ${numberText(v.outbound_ticks)} s out, ${numberText(v.service_ticks)} s service, ${numberText(v.return_ticks)} s back.`;})]),
  card('services','Services',[...armUI('services'),...['maps','software','uploads'].map(k=>el('fieldset',{},[el('legend',{},T(`services.${k}`)),svc(k,'service_reachable','service.reachable',[['reachable','Yes'],['unreachable','No']]),svc(k,'entitlement','service.entitlement',[['valid','Valid'],['denied','Denied'],['unknown','Unknown']])])),
   note('Reachable and permission are two different answers. Both are simulated: no real service is contacted.')]),
  card('data','Wi-Fi and data',[...armUI('data'),
   add(pick({card:'data',tid:'network.generation',options:[['wifi6','Wi-Fi 6'],['wifi7','Wi-Fi 7']],get:a=>a.network.generation,apply:(a,v)=>{a.network.generation=v;},path:()=>'/network/generation'})),
   info((s,a)=>`Assumed useful capacity: shared radio ${per(a.network.pool_bytes_per_tick,MB)} Mbps, per vehicle ${per(a.network.client_bytes_per_tick,MB)} Mbps. Changing the generation alone changes no assumed capacity here.`),
   rate('pool_bytes_per_tick',LIMITS.pool),rate('client_bytes_per_tick',LIMITS.client),rate('wan_down_bytes_per_tick',LIMITS.wan,1),rate('wan_up_bytes_per_tick',LIMITS.wan,1),
   add(pick({card:'data',diag:1,tid:'network.cache',tech:'network.cache.state',options:[['off','Off'],['cold','Cold, starts empty'],['warm','Warm, required objects already cached']],get:a=>a.network.cache.state,apply:(a,v)=>{const c=a.network.cache;c.state=v;c.initial_object_ids=v==='warm'?[...new Set(a.visits.flatMap(x=>x.required_object_ids))].filter(id=>a.content_objects.some(o=>o.id===id)).sort():[];},path:()=>'/network/cache/state'})),
   add(num({card:'data',label:'Cache capacity',diag:1,tid:'network.cache',tech:'network.cache.capacity_bytes (bytes)',unit:'GB',scale:GB,min:0,max:LIMITS.cacheBytes/GB,get:a=>a.network.cache.capacity_bytes,apply:(a,v)=>{a.network.cache.capacity_bytes=v;},path:()=>'/network/cache/capacity_bytes'})),
   info((s,a)=>`Cached at start: ${a.network.cache.initial_object_ids.join(', ')||'nothing'}. Fixed shared assumptions: ${T('network.cache_read_bytes_per_tick')} ${per(a.network.cache_read_bytes_per_tick,MB)} Mbps; ${T('network.covered_zones')}: ${a.network.covered_zones.join(', ')||'none'}.`),
   note('A Wi-Fi 6E or 7 label does not establish usable spectrum, equipment support or permission.'),
   el('dl',{},['deferred.wifi_6e','deferred.mlo','deferred.ap_count'].map(id=>el('div',{},[el('dt',{},T(id)),el('dd',{},['Not available: not modeled in this version.',tech(` ${id}: ${DEF(id)}`)])])))]),
  card('staff','Staffing',[...armUI('staff'),
   list(a=>a.workers,w=>w.id,w=>row([dyn((s,a)=>{const x=a.workers.find(y=>y.id===w.id);const at=l=>x.qualifications.filter(r=>r.level===l).map(r=>CLASSES[r.task_class]).join(', ');return x?`${x.id}: independent at ${at('independent')||'no task'}${at('supervised_only')?`; supervised only at ${at('supervised_only')}`:''}. Available ${x.availability.map(i=>`${numberText(i.start_tick)} s to ${numberText(i.end_tick)} s`).join(', ')||'never'}.`:'';},'span',''),btn(`Remove ${w.id}`,()=>{addStaff[0].focus();change('staff',a=>{a.workers=a.workers.filter(x=>x.id!==w.id);});})])),
   el('div',{class:'field-row'},addStaff),
   staffMsg.node,note(`${T('worker.role_template')}: ${DEF('worker.role_template')}`)]),
  card('training','Training',[...armUI('training'),
   note('Qualification (alone, only supervised, or not at all) and proficiency are separate answers; proficiency sets the solo duration from the fixed table.'),
   note('A supervised task uses 2 people for 1 task and adds no simultaneous capacity.'),list(a=>a.workers,w=>w.id,quals)]),
  card('work','Workload and rules',[...shared(),
   add(num({label:'Vehicles in the workload, one visit each',tech:'visits (count)',min:1,max:LIMITS.visits,get:a=>a.visits.length,check:(a,v)=>tapeCheck(a,v,spacing(a),false),apply:(a,v)=>regen(a,v,spacing(a),false)})),
   add(num({label:'Arrival spacing between visits',tech:'visits[].arrival_tick spacing',unit:'seconds',min:0,max:LIMITS.tick,get:spacing,check:(a,v)=>tapeCheck(a,a.visits.length,v,true),apply:(a,v)=>regen(a,a.visits.length,v,true)})),
   add(num({label:`${T('visit.due_tick')}: offset after arrival`,tid:'visit.due_tick',unit:'seconds',min:0,max:LIMITS.due,get:a=>{const v=a.visits[0];return v.due_tick===null?null:v.due_tick-v.arrival_tick;},check:(a,v)=>a.visits.some(x=>x.arrival_tick+v>LIMITS.due)?`A release-by time would pass ${numberText(LIMITS.due)} s.`:null,apply:(a,v)=>{for(const x of a.visits)x.due_tick=x.arrival_tick+v;}})),
   info((s,a)=>new Set(a.visits.map(x=>x.due_tick===null?'none':x.due_tick-x.arrival_tick)).size>1?'Release-by offsets differ by visit in this setup; a change sets one offset for every visit.':''),
   add(num({tid:'scenario.horizon_tick',unit:'seconds',min:1,max:LIMITS.tick,get:a=>a.horizon_tick,check:(a,v)=>a.arrival_window_tick>v?`The arrival window ends at ${numberText(a.arrival_window_tick)} s, so the run must last at least that long.`:null,apply:(a,v)=>{const fit=l=>l.forEach(i=>{if(i.end_tick===a.horizon_tick)i.end_tick=v;});a.workers.forEach(w=>fit(w.availability));fit(a.vendor.availability);a.horizon_tick=v;},path:()=>'/horizon_tick'})),
   add(num({tid:'task_windows.cabin_earliest_start_tick',unit:'seconds',min:0,max:LIMITS.tick,get:a=>a.task_windows.cabin_earliest_start_tick,apply:(a,v)=>{a.task_windows.cabin_earliest_start_tick=v;},path:()=>'/task_windows/cabin_earliest_start_tick'})),
   info((s,a)=>`${T('scenario.arrival_window_tick')}: ${numberText(a.arrival_window_tick)} s. Arrivals run from ${numberText(Math.min(...a.visits.map(x=>x.arrival_tick)))} s to ${numberText(Math.max(...a.visits.map(x=>x.arrival_tick)))} s.`),
   el('h4',{},'Diagnostic field'),...armUI('work'),
   add(num({card:'work',diag:1,tid:'site.lane_count',min:0,max:LIMITS.lanes,get:a=>a.site.lane_count,apply:(a,v)=>{a.site.lane_count=v;},path:()=>'/site/lane_count'})),
   el('h4',{},'Fixed rules, shown as assumptions'),
   el('dl',{},[fixedRow('profile.policy',a=>a.policy_id),fixedRow('profile.overlap',a=>a.overlap_profile),fixedRow('profile.reference_effort',a=>a.reference_effort_version)])]));
 function render(s){
  issues=['baseline','candidate'].flatMap(arm=>(s.checks?.[arm]?.issues??[]).map(i=>({...i,arm,card:OWNER.find(([,re])=>re.test(i.path??''))?.[0]??'work'})));
  const a=shown(s);if(a.visits.length>1)memo=spacing(a);
  if(s.preset!==mark.preset)mark={preset:s.preset,gen:s.generation,own:false};
  const p=cat.find(x=>x.id===s.preset);sel.value=mark.own?'':s.preset??'';
  setText(by('preset-regime'),mark.own?`Your own setup, started from the ${cat[0].title} in both setups. The counters list every difference.`:p?`Declared regime, configuration reasoning only and not a result: ${p.regime}${s.generation>mark.gen?' Edited since loading, so this regime may no longer describe the setup.':''}`:'No named setup is loaded; this is your own setup.');
  for(const u of ups)u(s);
 }
 render(now());
 return {render};
}
