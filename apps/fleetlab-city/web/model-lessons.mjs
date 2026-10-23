// Presentation of precomputed core outputs. No simulator, gate, or model equations.
const SCHEMA='fleetlab.model-lessons/1.0.0';
const sites=[100,200,400,800], acceptance=[20,40,80];
const labels={SITE_GRID_SHARE:'Site grid share',PORT_GRID_LIMIT:'Port grid limit',VEHICLE_BATTERY_ACCEPTANCE:'Vehicle battery acceptance'};
const outputKeys=['demand_energy_kwh','after_service_kwh','energy_deficit_kwh','battery_charge_kwh','grid_charge_kwh','charging_loss_kwh','final_kwh','effective_battery_kw','effective_grid_kw','unused_grid_share_kw','charging_hours','cycle_hours','service_time_fraction','site_grid_saturation_kw'];
const fixedInputs={distance_km:40,battery_kwh_per_km:0.2,service_hours:2,aux_battery_kw:1,usable_capacity_kwh:60,start_kwh:30,target_kwh:48,ports:8,active_ports:8,port_grid_kw:50,charging_efficiency:0.9};
const fail=()=>{throw new Error('Model lessons are unavailable: incompatible presentation data.');};
const text=value=>typeof value==='string' && value.length>0 && value.length<10000;
const finite=value=>typeof value==='number' && Number.isFinite(value) && value>=0;
function trust(data){
  if(data?.scope!=='SIMULATION_ONLY'||data.evidence!=='ILLUSTRATIVE_CALCULATION'||data.authenticity!=='NOT_AUTHENTICATED'||data.authorization!=='NOT_EVALUATED'||data.deployment_permission!=='NONE')fail();
}

export function validateModelLessons(data){
  trust(data);
  if(data.schema!==SCHEMA||data.verification!=='INTERNALLY_CONSISTENT'||data.decision_authority!=='NONE'||!text(data.title)||!text(data.description)||!/^[a-f0-9]{64}$/.test(data.content_digest??''))fail();
  if(!Array.isArray(data.station_cases)||data.station_cases.length!==12||!Array.isArray(data.direction_cases)||data.direction_cases.length!==3)fail();
  const ids=new Set();
  for(const item of data.station_cases){
    const r=item?.result,p=r?.inputs;
    trust(r);
    if(!p||!sites.includes(p.site_grid_kw)||!acceptance.includes(p.vehicle_acceptance_battery_kw)||item.id!==`site-${p.site_grid_kw}-acceptance-${p.vehicle_acceptance_battery_kw}`||ids.has(item.id)||!text(item.label))fail();
    ids.add(item.id);
    if(r.schema!=='fleetlab.vehicle-readiness/1.0.0'||r.kind!=='station_sensitivity'||!['COMPUTED','NOT_AVAILABLE'].includes(r.availability)||!Array.isArray(r.missing_fields)||!Array.isArray(r.bottlenecks))fail();
    for(const [key,value] of Object.entries(fixedInputs)){
      if(p[key]!==value && !(r.availability==='NOT_AVAILABLE'&&p[key]===null&&r.missing_fields.includes(key)))fail();
    }
    if(!Array.isArray(r.limitations)||!r.limitations.every(text)||!r.equations||!Object.values(r.equations).every(text))fail();
    if(r.availability==='COMPUTED'){
      if(!outputKeys.every(key=>finite(r[key]))||r.missing_fields.length||!r.bottlenecks.length||!r.bottlenecks.every(key=>Object.hasOwn(labels,key)))fail();
    }else if(!r.missing_fields.length||r.bottlenecks.length||!outputKeys.every(key=>r[key]===null))fail();
  }
  const directions=['forward-only','reverse-permitted','reverse-forbidden'];
  for(const [index,item] of data.direction_cases.entries()){
    const r=item?.result,p=r?.inputs;
    trust(r);
    if(r.schema!=='fleetlab.vehicle-readiness/1.0.0'||r.availability!=='COMPUTED'||!Array.isArray(r.missing_fields)||r.missing_fields.length||r.static_footprint_fits!==true)fail();
    if(item.id!==directions[index]||!text(item.label)||r.kind!=='direction_fixture'||r.geometric_maneuver_feasibility!=='NOT_EVALUATED'||!p||p.body_heading_deg!==90||r.body_heading_deg!==90||p.vehicle_length_m!==4||p.vehicle_width_m!==2||p.bay_length_m!==6||p.bay_width_m!==3||p.bidirectional!==(index===2))fail();
    if(!Array.isArray(p.exits)||p.exits.length!==2||!Array.isArray(r.options)||r.options.length!==2)fail();
    for(const [i,exit] of p.exits.entries()){
      const o=r.options[i],permitted=i===0||index===1;
      if(exit.id!==(i?'reverse':'forward')||exit.motion!==exit.id||exit.permitted!==permitted||exit.heading_deg!==(i?270:90)||exit.dwell_s!==(i?4:12)||exit.dwell_basis!=='USER_SUPPLIED'||o.id!==exit.id)fail();
      if(permitted){
        if(o.availability!=='COMPUTED'||o.dwell_s!==exit.dwell_s||o.travel_heading_deg!==exit.heading_deg||o.declared_dwell_basis!=='USER_SUPPLIED')fail();
      }else if(o.availability!=='NOT_AVAILABLE'||o.reason!=='EXIT_NOT_PERMITTED'||o.dwell_s!==null||o.travel_heading_deg!==null)fail();
    }
  }
  if(!Array.isArray(data.limitations)||!data.limitations.length||!data.limitations.every(text)||!Array.isArray(data.source_references)||data.source_references.length>10)fail();
  for(const source of data.source_references){
    if(!text(source.label)||!text(source.use)||!text(source.url))fail();
    let url;try{url=new URL(source.url);}catch{fail();}
    if(url.protocol!=='https:'||url.username||url.password)fail();
  }
  return data;
}

const fmt=(value,unit='')=>finite(value)?`${new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(value)}${unit?` ${unit}`:''}`:'Not available';

export function mountModelLessons(host,data){
  host.replaceChildren();
  try{validateModelLessons(data);}catch(error){host.textContent='Not available · Model teaching data did not pass presentation validation.';throw error;}
  const doc=host.ownerDocument;
  const el=(tag,content,cls)=>{const node=doc.createElement(tag);if(content!==undefined)node.textContent=String(content);if(cls)node.className=cls;return node;};
  const root=el('div',undefined,'model-lessons');host.append(root);
  const listeners=[];
  const on=(node,handler)=>{node.addEventListener('change',handler);listeners.push([node,handler]);};
  const paragraph=(parent,value,cls)=>{const node=el('p',value,cls);parent.append(node);return node;};
  const section=(number,title)=>{const node=el('section',undefined,'ml-section');paragraph(node,number,'ml-eyebrow');node.append(el('h3',title));root.append(node);return node;};
  const exact=(parent,title,value)=>{const details=el('details',undefined,'ml-details');details.append(el('summary',title),el('pre',JSON.stringify(value,null,2)));parent.append(details);};
  const select=(parent,label,attribute,options)=>{
    const wrapper=el('label',label,'ml-select-label'),node=el('select');node.setAttribute('aria-label',label);node.setAttribute(attribute,'');
    for(const [value,caption] of options){const option=el('option',caption);option.value=String(value);node.append(option);}
    node.value=String(options[0][0]);wrapper.append(node);parent.append(wrapper);return node;
  };
  const metric=(parent,label,value,detail)=>{const card=el('div',undefined,'ml-metric');paragraph(card,label,'ml-label');card.append(el('strong',value));if(detail)paragraph(card,detail,'ml-small');parent.append(card);return card;};

  const intro=el('header',undefined,'ml-intro');root.append(intro);
  paragraph(intro,'MODEL LESSONS · ANONYMOUS ASSUMPTIONS','ml-eyebrow');intro.append(el('h2',data.title));
  paragraph(intro,'What limits charging—and what permits an exit?','ml-lead');
  paragraph(intro,'Explore twelve small arithmetic examples. Every value is synthetic; these examples use no city demand, routes, fleet results or operator parameters.');
  const badges=el('div',undefined,'ml-badges');badges.append(el('span','Illustrative calculation'),el('span','Arithmetic checked at build'),el('span','No deployment authority'));intro.append(badges);

  const station=section('01 / ENERGY & TIME','More site power helps until another limit takes over.');
  paragraph(station,'One vehicle completes a 40 km, 2 h service block, then recharges. Eight ports stay active and share the site budget equally. Select one of twelve precomputed cases.');
  const controls=el('div',undefined,'ml-controls');station.append(controls);
  const site=select(controls,'Site grid limit','data-model-site',sites.map(n=>[n,`${n} kW at the grid`]));
  const accept=select(controls,'Vehicle battery acceptance','data-model-acceptance',acceptance.map(n=>[n,`${n} kW at the battery`]));
  const result=el('div');result.setAttribute('data-model-station-result','');result.setAttribute('aria-live','polite');station.append(result);
  const drawStation=()=>{
    result.replaceChildren();
    const item=data.station_cases.find(c=>c.id===`site-${site.value}-acceptance-${accept.value}`);
    const r=item?.result,p=r?.inputs;
    if(!r||r.availability!=='COMPUTED'){
      paragraph(result,`Not available · Missing explicit inputs: ${r?.missing_fields?.join(', ')||'selected case'}.`,'ml-unavailable');
      if(r)exact(result,'Inspect unavailable inputs and output',r);return;
    }
    const flow=el('div',undefined,'ml-flow');flow.setAttribute('aria-label','Grid to port to battery power limits');result.append(flow);
    metric(flow,'01 · Site',fmt(p.site_grid_kw,'kW'),'Grid-side site budget');
    metric(flow,'02 · Shared ports',`${p.active_ports} × ${fmt(p.port_grid_kw,'kW')}`,'Each port has its own grid-side limit');
    metric(flow,'03 · Battery',fmt(r.effective_battery_kw,'kW'),`${fmt(p.vehicle_acceptance_battery_kw,'kW')} acceptance · 90% efficiency`);
    paragraph(result,`Active bottleneck: ${r.bottlenecks.map(key=>labels[key]).join(' + ')}.`,'ml-bottleneck');
    const ledger=el('div',undefined,'ml-ledger');result.append(ledger);
    metric(ledger,'Service energy',fmt(r.demand_energy_kwh,'kWh'),'Propulsion + auxiliary battery draw');
    metric(ledger,'Battery recharge',fmt(r.battery_charge_kwh,'kWh'),`${fmt(r.after_service_kwh,'kWh')} after service → ${fmt(r.final_kwh,'kWh')} target`);
    metric(ledger,'Grid recharge',fmt(r.grid_charge_kwh,'kWh'),`${fmt(r.charging_loss_kwh,'kWh')} lost in charging`);
    metric(ledger,'Charging time',fmt(r.charging_hours,'h'),`${fmt(r.cycle_hours,'h')} service + charging`);
    paragraph(result,`For this fixed occupancy, the site-power crossover is ${fmt(r.site_grid_saturation_kw,'kW')}. Above it, increasing only the site budget cannot shorten this charge. Equal shares are fixed; capped unused power is not redistributed.`,'ml-explanation');
    paragraph(result,'Displayed values are rounded to two decimal places. Exact stored values and equations are below. No queue, charging taper, charging-time auxiliary draw or fleet throughput is modeled.','ml-small');
    exact(result,'Exact assumptions, equations and stored output',r);
  };
  on(site,drawStation);on(accept,drawStation);drawStation();

  const direction=section('02 / CAPABILITY & PERMISSION','A direction choice needs explicit permission.');
  paragraph(direction,'These original synthetic rectangles illustrate declared exit choices. A conventional vehicle can reverse when that exit is permitted. Declaring bidirectional capability does not open a forbidden exit.');
  const directionControls=el('div',undefined,'ml-controls');direction.append(directionControls);
  const choice=select(directionControls,'Exit-permission fixture','data-model-direction',data.direction_cases.map(c=>[c.id,c.label]));
  const directionResult=el('div');directionResult.setAttribute('data-model-direction-result','');directionResult.setAttribute('aria-live','polite');direction.append(directionResult);
  const drawDirection=()=>{
    directionResult.replaceChildren();
    const r=data.direction_cases.find(c=>c.id===choice.value)?.result;
    if(!r){paragraph(directionResult,'Not available · No fixture selected.');return;}
    paragraph(directionResult,'Body heading stays 90° (east). Travel heading may reverse; the body does not turn.','ml-bottleneck');
    const drawing=el('div',undefined,'ml-direction');drawing.setAttribute('role','img');drawing.setAttribute('aria-label','Static synthetic 4 by 2 metre vehicle in an aligned 6 by 3 metre bay. Arrows indicate declared exit choices only; no driving path is computed.');
    const reverse=r.options[1],forward=r.options[0];
    const arrow=(option,glyph,name)=>{const node=el('div',undefined,`ml-exit ${option.availability==='COMPUTED'?'ml-exit-permitted':'ml-exit-forbidden'}`);node.append(el('span',glyph,'ml-arrow'),el('strong',name));paragraph(node,option.availability==='COMPUTED'?`${fmt(option.dwell_s,'s')} supplied dwell`:'Not available · exit not permitted');return node;};
    const bay=el('div',undefined,'ml-bay');bay.append(el('span','6 m × 3 m synthetic bay','ml-bay-label'));const body=el('div',undefined,'ml-body');body.append(el('strong','4 m × 2 m'),el('span','Body → east'));bay.append(body);
    drawing.append(arrow(reverse,'←','Reverse · 270°'),bay,arrow(forward,'→','Forward · 90°'));directionResult.append(drawing);
    paragraph(directionResult,'The 12 s forward and 4 s reverse costs are supplied teaching inputs, not measured maneuver times. No automatic winner is selected. Static dimensions do not establish path clearance, legal permission or safety.','ml-small');
    exact(directionResult,'Exact rectangle inputs, declared permissions and dwell costs',r);
  };
  on(choice,drawDirection);drawDirection();

  const boundaries=section('03 / EVIDENCE BOUNDARY','Understand what this lesson can establish.');
  const list=el('ul');for(const item of data.limitations)list.append(el('li',item));boundaries.append(list);
  const sources=el('details',undefined,'ml-details');sources.append(el('summary','Primary references and source boundaries'));
  for(const source of data.source_references){const p=el('p'),a=el('a',source.label);a.href=source.url;a.rel='noreferrer';p.append(a);sources.append(p);paragraph(sources,source.use,'ml-small');}boundaries.append(sources);
  exact(boundaries,'Projection identity and trust states',{schema:data.schema,content_digest:data.content_digest,verification:data.verification,authenticity:data.authenticity,authorization:data.authorization,deployment_permission:data.deployment_permission,decision_authority:data.decision_authority});
  paragraph(boundaries,'These examples are checked against their declared equations before publication. They remain synthetic assumptions, with no independent authentication or real-world validation.','ml-small');
  return ()=>{for(const [node,handler] of listeners)node.removeEventListener('change',handler);root.remove();};
}
