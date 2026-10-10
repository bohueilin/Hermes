// Hosted-only presentation. All live quantities and wait text arrive through the accepted bench projection.
import {el} from './dom.js';
import {gbps,kw,minute,join} from './depot-capacity-view.js';

const svg=(tag,attrs={})=>{const n=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,String(v));return n;};
const exact=n=>String(n);
const car=()=>el('span',{class:'cap-car-symbol','aria-hidden':'true'},[el('i'),el('i')]);
const stateOf=v=>!v.present?'Not arrived':v.ready?'Ready in model':v.tasks.upload==='active'?'Uploading':v.tasks.charge==='active'?'Charging':v.tasks.post==='active'?'Local step':'Waiting';
const outcomes={on_time:'on time',late:'late',unfinished_due:'unfinished, target passed',pending:'unfinished, target ahead'};
const words={complete:'✓ done',active:'in progress',waiting:'waiting','not-applicable':'already at target','not-arrived':'not arrived'};

/** The unexecuted diagram describes inputs only. It never invents a current grant or a result. */
export function createCapacityPreview(scenario,label){
  return el('aside',{class:'capacity-preview','aria-label':'Fixed study system preview'},[
    el('p',{class:'cap-kicker'},'System preview · fixed inputs'),el('h2',{},'One depot. Two shared resources.'),
    el('div',{class:'cap-preview-park','aria-label':'Twelve invented visits'},scenario.vehicles.map(v=>el('span',{'data-preview-vehicle':v.id},[car(),el('span',{},v.id)]))),
    el('div',{class:'cap-preview-channels'},[
      el('div',{class:'cap-preview-upload'},[el('strong',{},'Upload'),el('span',{},'Vehicles → shared uplink'),el('b',{},gbps(scenario.uplink_bytes_s))]),
      el('div',{class:'cap-preview-energy'},[el('strong',{},'Energy'),el('span',{},'Site feed → 2 charging ports'),el('b',{},kw(scenario.site_power_j_s))])]),
    el('p',{class:'cap-preview-caption'},`${label} workload. Upload, battery target and a local step must finish before a vehicle is ready in this model.`),
  ]);
}

function rateChannel(kind,label){
  const value=el('strong'),capacity=el('span'),scaleText=el('p',{class:'cap-rate-scale'}),allocation=el('p',{class:'cap-allocation'});
  const graph=svg('svg',{viewBox:'0 0 100 8',preserveAspectRatio:'none','aria-hidden':'true'});
  const track=svg('rect',{x:0,y:0,width:100,height:8,rx:2,class:'cap-rate-track'}),fill=svg('rect',{x:0,y:0,width:0,height:8,class:'cap-rate-fill'}),limit=svg('line',{x1:0,x2:0,y1:0,y2:8,class:'cap-rate-limit'});
  graph.append(track,fill,limit);
  const meter=el('div',{class:'cap-rate-meter',role:'meter','aria-label':`${label} aggregate rate`,'aria-valuemin':0,'data-rate':kind},graph);
  const link=el('div',{class:`cap-transfer-line cap-transfer-${kind}`,'aria-hidden':'true','data-link-moving':'false'},el('span',{class:'cap-transfer-dot'}));
  const root=el('section',{class:`cap-channel cap-channel-${kind}`},[
    el('div',{class:'cap-channel-title'},[el('h4',{},label),el('span',{},kind==='upload'?'Vehicles → uplink':'Site feed → vehicles')]),
    el('div',{class:'cap-rate-value'},[value,capacity]),meter,scaleText,link,allocation]);
  const format=kind==='upload'?gbps:kw,unit=kind==='upload'?'bytes/s':'J/s';
  return {root,update(data,scale,summary,playing){
    value.textContent=format(data.used);capacity.textContent=`of ${format(data.capacity)} capacity`;
    // No minimum is applied to these quantitative marks, including very small nonzero rates.
    fill.setAttribute('width',100*data.used/scale);const x=100*data.capacity/scale;limit.setAttribute('x1',x);limit.setAttribute('x2',x);
    meter.setAttribute('aria-valuenow',data.used);meter.setAttribute('aria-valuemax',scale);
    meter.setAttribute('aria-valuetext',`${exact(data.used)} ${unit}; common scale ${exact(scale)} ${unit}; capacity ${exact(data.capacity)} ${unit}`);
    scaleText.textContent=`Common scale: 0 to ${format(scale)}. Mark: this case's capacity.`;
    allocation.textContent=summary;link.setAttribute('data-link-moving',String(playing&&data.used>0));
  }};
}

function armView(arm,onSelect){
  const time=el('p',{class:'cap-arm-time'}),parking=el('div',{class:'cap-parking',role:'group','aria-label':`${arm.label} vehicle states`}),markers=new Map();
  for(const v of arm.visits){
    const state=el('span',{class:'cap-vehicle-state'}),node=el('button',{type:'button',class:'cap-vehicle','data-vehicle':v.vehicle,on:{click:()=>onSelect(v.vehicle)}},[car(),el('strong',{},v.vehicle),state]);
    markers.set(v.vehicle,{node,state});parking.appendChild(node);
  }
  const upload=rateChannel('upload','Upload'),energy=rateChannel('energy','Energy');
  const wait=el('p',{class:'flow-wait-reason'}),selectedTitle=el('h4'),chain=el('div',{class:'flow-chain',role:'group','aria-label':'Readiness chain'});
  const taskNodes=[['Battery','charge'],['Upload','upload'],['Local step','post'],['Ready','ready']].map(([label,key])=>{const node=el('span');chain.appendChild(node);return {label,key,node};});
  const selectedOutcome=el('p',{class:'cap-selected-outcome'});
  const progress=el('dl',{class:'cap-selected-progress'}),exactValues=el('p',{class:'cap-exact-values'});
  const node=el('article',{class:'capacity-board-case','data-case':arm.case},[
    el('div',{class:'cap-arm-heading'},[el('h3',{},arm.label),time]),
    el('section',{class:'cap-selected'},[el('div',{class:'cap-selected-heading'},[el('span',{class:'cap-selected-symbol','aria-hidden':'true'},car()),selectedTitle]),wait,selectedOutcome,el('details',{},[el('summary',{},'Task chain and quantities'),chain,progress,exactValues])]),
    el('div',{class:'cap-channels'},[upload.root,energy.root]),parking]);
  return {node,update(a,scales,playing){
    node.setAttribute('data-time',a.time_s);time.textContent=`Recorded minute ${minute(a.time_s)}`;
    for(const v of a.visits){const m=markers.get(v.vehicle),state=stateOf(v);m.state.textContent=state;m.node.setAttribute('aria-label',`Vehicle ${v.vehicle}: ${state}`);m.node.setAttribute('aria-pressed',String(v.vehicle===a.selected.vehicle));m.node.setAttribute('data-state',!v.present?'absent':v.ready?'ready':'present');}
    const active=a.visits.filter(v=>v.upload_rate_bytes_s>0),rates=[...new Set(active.map(v=>gbps(v.upload_rate_bytes_s)))];
    const uplink=!active.length?'Uplink idle':rates.length===1?`Uplink: ${join(active.map(v=>`Vehicle ${v.vehicle}`))} · ${rates[0]}${active.length>1?' each':''}`:join(active.map(v=>`Vehicle ${v.vehicle}: ${gbps(v.upload_rate_bytes_s)}`));
    const ports=a.ports.map(p=>`Port ${p.port}: ${p.vehicle?`Vehicle ${p.vehicle} · ${kw(p.rate_j_s)}`:'free'}`).join(' · ');
    upload.update(a.upload,scales.upload_bytes_s,uplink,playing);energy.update(a.energy,scales.energy_j_s,ports,playing);
    const f=a.final;selectedOutcome.textContent=f?`Whole-run outcome: ${f.ready_s===null?'not ready':`ready at minute ${minute(f.ready_s)}`} · ${outcomes[f.outcome]}.`:'Whole-run outcome not available.';
    const x=a.selected;selectedTitle.textContent=`Vehicle ${x.vehicle} · target minute ${minute(x.deadline_s)}`;wait.textContent=x.wait_reason;
    chain.setAttribute('data-vehicle',x.vehicle);
    for(const item of taskNodes){let state=item.key==='ready'?(x.ready?'complete':'waiting'):x.tasks[item.key];if(!x.present&&state!=='not-applicable')state='not-arrived';item.node.setAttribute('data-state',state==='complete'?'done':state);item.node.textContent=`${item.label}: ${words[state]}`;}
    progress.replaceChildren(...[
      ['Uploaded',`${exact(x.upload_bytes/1e9)} of ${exact(x.upload_total/1e9)} GB`],
      ['Energy delivered',x.energy_total===0?'Already at target':`${Number((x.energy_j/3.6e6).toFixed(3))} of ${exact(x.energy_total/3.6e6)} kWh`],
      ['Local step',`${exact(x.post_s)} of ${exact(x.post_total_s)} s`],
    ].flatMap(([label,value])=>[el('dt',{},label),el('dd',{},value)]));
    exactValues.textContent=`Upload: ${exact(x.upload_bytes)} of ${exact(x.upload_total)} bytes; rate ${exact(x.upload_rate_bytes_s)} bytes/s. Energy: ${exact(x.energy_j)} of ${exact(x.energy_total)} J; rate ${exact(x.charge_rate_j_s)} J/s. Local step: ${exact(x.post_s)} of ${exact(x.post_total_s)} s.`;
  }};
}

/** Updating the bench preserves its vehicle controls and focus. Motion is merely an active-link direction cue. */
export function createCapacityBench({onSelect=()=>{}}={}){
  const element=el('div',{class:'capacity-board','aria-label':'Shared-clock resource comparison'});let arms=new Map(),mobileSide='base',switches=[],summaries=new Map();
  const showSide=side=>{
    mobileSide=side;
    for(const [key,arm] of arms)arm.node.setAttribute('data-mobile-visible',String((key==='base')===(side==='base')));
    for(const {side:choice,node} of switches)node.setAttribute('aria-pressed',String(choice===side));
  };
  return {element,update(projection,playing=false){
    if(!projection.available){element.replaceChildren(el('p',{class:'capacity-unavailable'},projection.reason));arms=new Map();return;}
    const keys=projection.arms.map(a=>a.case);
    if(keys.join()!==[...arms.keys()].join()){
      arms=new Map(projection.arms.map(a=>[a.case,armView(a,onSelect)]));
      switches=projection.arms.map(a=>{
        const side=a.case==='base'?'base':'comparison',id=`capacity-arm-${a.case}`;
        arms.get(a.case).node.setAttribute('id',id);
        return {side,node:el('button',{type:'button',class:'studio-button','aria-controls':id,'aria-label':`Show ${a.label}`,on:{click:()=>showSide(side)}},side==='base'?'Base':'Comparison')};
      });
      const controls=el('div',{class:'capacity-mobile-arms',role:'group','aria-label':'Visible comparison arm'},switches.map(b=>b.node));
      summaries=new Map(projection.arms.map(a=>[a.case,el('div',{'data-summary':a.case})]));
      const summary=el('div',{class:'capacity-pair-summary','aria-label':'End-of-run results for both cases'},[el('p',{class:'cap-pair-label'},'Whole-run outcomes · fixed while replay moves'),...summaries.values()]);
      element.replaceChildren(controls,summary,...[...arms.values()].map(a=>a.node));showSide(mobileSide);
    }
    for(const arm of projection.arms){
      arms.get(arm.case).update(arm,projection.scales,playing);
      const f=arm.final,outcomes={on_time:'on time',late:'late',unfinished_due:'unfinished, target passed',pending:'unfinished, target ahead'};
      summaries.get(arm.case).replaceChildren(el('strong',{},`${arm.label}: ${f?`${f.on_time} of ${f.total} on time`:'Not available'}`),
        el('p',{},f?`Vehicle ${f.vehicle}: ${f.ready_s===null?'not ready':`ready at minute ${minute(f.ready_s)}`} · ${outcomes[f.outcome]}.`:'Selected outcome not available.'));
    }
  }};
}
