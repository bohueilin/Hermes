import {el} from './dom.js';
import {STREET_NETWORK,streetMapDownload} from '../model/street-network.js';
import {defaultStreetConfig,simulateStreets,compareStreetPolicies,STREET_PRESETS} from '../model/street-simulation.js';
import {createStreetScene} from './street-scene.js';
const button=(text,fn,primary=false)=>el('button',{type:'button',class:primary?'studio-button studio-button-primary':'studio-button',on:{click:fn}},text);
const eyebrow=text=>el('p',{class:'eyebrow'},text);
const fmt=(v,d=1)=>v===null||v===undefined?'Not available':Number(v).toLocaleString('en-US',{maximumFractionDigits:d});
const stateName=id=>({available:'Available',pickup:'Driving to pickup',curb_queue:'Waiting for a pickup berth',boarding:'Boarding',occupied:'Passenger on board',turnaround:'Off-road turnaround'})[id]??id;
const clock=(seconds,start=0)=>{const min=Math.floor(seconds/60)+start*60;return `${min>=1440?'Day 2 · ':''}${String(Math.floor(min/60)%24).padStart(2,'0')}:${String(min%60).padStart(2,'0')}:${String(Math.floor(seconds%60)).padStart(2,'0')}`;};
function download(name,data){const link=el('a',{href:'data:application/json;charset=utf-8,'+encodeURIComponent(JSON.stringify(data)),download:name});document.body.appendChild(link);link.click();link.remove();}

export function createStreetLab({network=STREET_NETWORK,requestFrame=fn=>requestAnimationFrame(fn),cancelFrame=id=>cancelAnimationFrame(id),reducedMotion=()=>window.matchMedia?.('(prefers-reduced-motion: reduce)').matches??false}={}){
 let config=defaultStreetConfig(),result=null,comparison=null,time=0,playing=false,raf=null,lastTime=null,stale=false,busy=false,destroyed=false,selected='AV-01',edgeId=null,lastDetails='',revision=0,pauseVersion=0;
 const inputs=new Map(),anchors=new Map(network.anchors.map(a=>[a.id,a])),edges=new Map(network.edges.map(e=>[e.id,e]));
 const label=id=>anchors.get(id)?.label??id;
 const status=el('p',{class:'street-status',role:'status'},'Choose a bottleneck, then run the street scenario.');
 const error=el('p',{role:'alert',class:'ops-error',hidden:true});
 const heading=el('h2',{},'How does a ramp queue tie up the fleet?'),cause=el('p'),advice=el('p',{class:'street-advice'});
 const runButton=button('Run street scenario  ▶',()=>run(),true),compareButton=button('Compare route policies',()=>run(true));
 const scene=createStreetScene({network,onSelect:id=>{selected=id;vehicleSelect.value=id;lastDetails='';render();},onEdgeSelect:id=>{edgeId=id;lastDetails='';renderDetails();}});
 const presetButtons=STREET_PRESETS.map(p=>button(p.title,()=>{setConfig({hotspot:p.id});scene.focus(p.id);}));
 const presetRow=el('div',{class:'street-presets','aria-label':'Street stress scenarios'},presetButtons);
 function field(key,title,unit,min,max){const input=el('input',{type:'number',value:config[key],min,max,step:1,'aria-label':title,on:{change:()=>setConfig({[key]:input.value===''?NaN:Number(input.value)})}});inputs.set(key,input);return el('label',{class:'street-field'},[el('span',{},title),el('span',{},[input,el('small',{},unit)])]);}
 const policy=el('select',{'aria-label':'Route policy',on:{change:()=>setConfig({policy:policy.value})}},[el('option',{value:'free-flow'},'Free-flow routes'),el('option',{value:'queue-aware'},'Queue-aware routes')]);
 const weather=el('select',{'aria-label':'Street weather',on:{change:()=>setConfig({weather:weather.value})}},[el('option',{value:'clear'},'Clear'),el('option',{value:'rain'},'Rain: slower flow')]);
 const fields=el('fieldset',{class:'street-inputs'},[
  el('legend',{},'1 / Set the operating conditions'),field('fleet_size','Available AVs','vehicles',1,60),field('requests_per_hour','Rider demand','requests/hour',0,120),field('background_per_hour','Other road traffic','vehicles/hour',0,2400),field('capacity_loss_pct','Hotspot capacity loss','% during incident',0,95),
  el('label',{class:'street-field'},['Route policy',policy]),
  el('details',{},[el('summary',{},'Time, weather & trip mix'),field('start_hour','Start hour','clock label',0,23),field('duration_minutes','Experiment length','minutes',10,180),el('label',{class:'street-field'},['Weather',weather]),field('sfo_share_pct','SFO base destinations','%',0,100),field('east_bay_share_pct','East Bay base destinations','%',0,100),el('p',{},'Remaining destinations are local. One in five journeys reverses direction. Arrival rates stay constant; the clock does not add an automatic rush-hour multiplier.')]),
  el('details',{},[el('summary',{},'Incident & curb service'),field('incident_start_minutes','Incident begins','minutes into run',0,180),field('incident_end_minutes','Incident clears','minutes into run',0,180),field('boarding_seconds','Pickup dwell','seconds',10,300),field('curb_bays','Pickup berths per anchor','berths',1,8),field('turnaround_minutes','After-trip turnaround','minutes',0,30),el('p',{},'Hypothetical off-road pickup berths and turnaround. Curb queues consume AV time but do not block a traffic lane. This street model excludes charging and depot resource queues; those are in Fleet day.')]),
  el('details',{},[el('summary',{},'Repeatability & model rules'),field('seed','Street demand seed','same seed repeats inputs',0,4294967295),el('p',{},'Five-second road steps. FIFO links with 7.5 m storage per vehicle per modeled lane. Base discharge 0.32 vehicles/second/lane, up to four lanes. Tagged signals use an illustrative 90-second cycle, 45 seconds green. Rain adds 20% travel time and reduces discharge 15%.'),el('p',{},'Background demand: 60% on this hotspot route, 20% across hotspot routes, 20% toward SFO or the East Bay. Vehicle mix is 50/50 illustrative I-PACE and Ojai bodies with identical road behavior. No lane changing, collisions or calibrated vehicle dynamics.')]),
 ]);
 const settings=el('aside',{class:'street-settings'},[fields,el('p',{class:'street-input-note'},'Every operating value here is a teaching assumption.'),runButton,compareButton,status,error]);
 const timeLabel=el('strong',{class:'street-clock'},clock(0,config.start_hour)),live=el('span',{class:'street-live-count'});
 const playButton=button('Play',()=>{if(playing)pause();else play();}),stepButton=button('Step 5 sec',()=>seek(time+5));
 const timeline=el('input',{type:'range',min:0,max:7200,step:5,value:0,'aria-label':'Street replay time',on:{input:()=>seek(Number(timeline.value))}});
 const speed=el('select',{'aria-label':'Street replay speed'},[[30,'30×'],[60,'60×'],[180,'180×']].map(([v,t])=>el('option',{value:v},t)));speed.value='60';
 const comparisonView=el('div',{class:'street-replay-variant',hidden:true},[button('Replay free-flow routes',()=>chooseRun('baseline')),button('Replay queue-aware routes',()=>chooseRun('candidate'))]);
 const replay=el('section',{class:'street-replay'},[
  el('div',{class:'street-replay-heading'},[el('div',{},[eyebrow('2 / WATCH THE CONSTRAINT'),heading]),el('span',{class:'street-geography-tag'},'SAN FRANCISCO ↔ SFO / EAST BAY')]),cause,advice,comparisonView,
  el('div',{class:'street-clock-row'},[timeLabel,live]),scene.element,
  el('div',{class:'street-playback'},[playButton,stepButton,button('+5 minutes',()=>seek(time+300)),button('Largest queue',()=>{if(result)seek(result.frames.reduce((a,b)=>b.queued>a.queued?b:a).time);}),speed]),timeline,
  el('div',{class:'street-legend'},[el('span',{},'Blue: pickup / selected route'),el('span',{},'Green: passenger trip'),el('span',{},'Amber: waiting queue'),el('span',{},'Red: downstream block full')]),
 ]);
 const vehicleSelect=el('select',{'aria-label':'Inspect street AV',on:{change:()=>{selected=vehicleSelect.value;lastDetails='';render();}}});
 const vehicleDetail=el('div',{class:'street-vehicle-detail'}),queueList=el('div',{class:'street-queue-list'}),blockDetail=el('div',{class:'street-block-detail'});
 const inspect=el('section',{class:'street-inspect'},[
  el('div',{},[eyebrow('FOLLOW ONE AV'),vehicleSelect,button('Next AV activity',()=>{const event=result?.vehicles.find(v=>v.id===selected)?.log.find(e=>e.time>time);if(event)seek(event.time);}),vehicleDetail]),
  el('div',{},[eyebrow('INSPECT A BLOCK'),el('p',{},'Select a queued block to zoom in and inspect its direction, storage and downstream constraint.'),queueList,blockDetail]),
 ]);
 const results=el('section',{class:'street-results'},[eyebrow('3 / READ THE TRADE-OFF'),el('h2',{},'What did the fleet manage to serve?'),el('p',{},'Run a scenario to see completed and unfinished journeys together.')]);
 const element=el('main',{class:'street-lab',id:'street-lab'},[
  el('section',{class:'street-intro'},[eyebrow('STREET LAB / SAN FRANCISCO'),el('h1',{},['One blocked street.',el('br'),el('span',{},'A citywide ripple.')]),el('p',{class:'hero-lede'},'A bridge queue can delay an airport pickup. Follow the cars, find the constraint, and test what a routing change actually improves.'),el('p',{class:'street-scope-line'},`${fmt(network.edges.length,0)} directed road links · Six downtown hotspots · Five-second replay`),button('Start the street demo  ↗',async()=>{await run();scene.element.scrollIntoView?.({block:'center',behavior:'instant'});},true)]),
  presetRow,el('div',{class:'street-layout'},[settings,el('div',{class:'street-main'},[replay,inspect])]),results,
  el('section',{class:'street-learning'},[eyebrow('WHAT THIS MODEL HELPS YOU ASK'),el('h2',{},'Connect the street problem to an operating decision.'),el('div',{class:'street-learning-grid'},[
   ['Market lead','Is supply unavailable or simply stuck?','Read assigned, boarded and completed populations. Inspect time tied up in roads, pickup berths and turnaround before adding more AVs.'],
   ['Fleet optimizer','Does a detour help the whole service?','Compare identical demand under two route policies. Inspect added empty distance, unfinished work and queues outside the chosen hotspot.'],
   ['Planning partner','What would make this decision-grade?','Calibrate counts, turn movements, signal plans and travel distributions. Then test multiple seeds, hold-out days, curb access and resource constraints.'],
  ].map(([role,title,text])=>el('article',{},[eyebrow(role),el('h3',{},title),el('p',{},text)])))]),
  el('details',{class:'street-method'},[el('summary',{},'Real geography, synthetic traffic: sources and limits'),
   el('p',{},'Sourced OpenStreetMap roads, one-way tags and supported node-via turn restrictions. Missing tags, time-dependent and via-way restrictions remain gaps. Market Street is conservatively excluded from this model; this is not a statement of current commercial access rules.'),
   el('p',{},'SFO is an airport-approach handoff. East Bay is an Oakland-side network gateway. Neither is an actual pickup zone or a claim of AV operating permission. The 15 to 45 minute delays motivating these cases are user-supplied stress descriptions, not verified typical travel times.'),
   el('p',{},'Traffic signals, pedestrian friction, delivery blockages and event pressure are represented through capacity and timing assumptions. No live Google traffic feed, individual pedestrian model, driving safety validation or calibrated digital twin. Queue-aware routing reacts at leg departure; it does not reroute continuously or guarantee an optimal fleet.'),
   el('p',{},'Next fidelity: validate these mechanisms against counted traffic and a SUMO street network. CARLA is complementary when a question needs sensor or driving-policy detail. Neither simulator alone establishes real-world safety.'),
   button('Download attributed street map',()=>download('fleetlab-sf-streets-odbl.json',streetMapDownload())),
  ]),
 ]);
 function sync(){
  const p=STREET_PRESETS.find(p=>p.id===config.hotspot);heading.textContent=p.question;cause.textContent=p.cause;advice.textContent=p.action;
  presetButtons.forEach((b,i)=>b.setAttribute('aria-pressed',STREET_PRESETS[i].id===config.hotspot?'true':'false'));
  for(const[key,input]of inputs)input.value=String(config[key]);policy.value=config.policy;weather.value=config.weather;
 }
 function setConfig(patch){config={...config,...patch};revision++;pause();stale=!!result;if(stale)status.textContent='Settings changed. Replay and results show the previous run until you run again.';sync();if(patch.hotspot)scene.focus(patch.hotspot);}
 function pause(){pauseVersion++;playing=false;if(raf!==null)cancelFrame(raf);raf=null;lastTime=null;playButton.textContent='Play';}
 function play(){if(!result||destroyed)return;if(time>=result.config.duration_minutes*60)time=0;playing=true;lastTime=null;playButton.textContent='Pause';raf=requestFrame(tick);}
 function tick(timestamp){if(!playing||destroyed)return;if(lastTime!==null)time=Math.min(result.config.duration_minutes*60,time+Math.min(.1,(timestamp-lastTime)/1000)*Number(speed.value));lastTime=timestamp;render();if(time>=result.config.duration_minutes*60)pause();else raf=requestFrame(tick);}
 function seek(value){pause();time=Math.max(0,Math.min(result?.config.duration_minutes*60??0,value));lastDetails='';render();}
 function frame(){return result?.frames[Math.min(result.frames.length-1,Math.floor(time/5))]??null;}
 function render(){
  const f=frame(),index=f?Math.floor(time/5):0;timeLabel.textContent=clock(time,result?.config.start_hour??config.start_hour);timeline.value=String(Math.floor(time/5)*5);
  live.textContent=f?`${f.requests.completed} completed · ${f.queued} road vehicles queued · ${f.traffic.pending} waiting to enter`:'Ready to simulate';
  scene.render(result,f,result?.frames[index+1]??f,(time%5)/5,selected);
  const key=`${index}|${selected}|${edgeId}`;if(key!==lastDetails){lastDetails=key;renderDetails();}
 }
 function renderDetails(){
  const f=frame(),car=f?.vehicles.find(v=>v.id===selected);
  if(!car){vehicleDetail.replaceChildren(el('p',{},'Run the scenario, then select an AV or use the vehicle menu.'));queueList.replaceChildren();blockDetail.replaceChildren();return;}
  const edge=edges.get(car.edge_id??car.pending_edge_id),path=result.routes[car.route_id],names=path?path.edge_ids.map(id=>edges.get(id)?.name).filter((name,i,list)=>i===0||name!==list[i-1]):[];
  const events=result.vehicles.find(v=>v.id===selected).log.filter(e=>e.time<=time).slice(-4);
  vehicleDetail.replaceChildren(el('h3',{},`${car.id} · ${car.vehicle_type==='ojai'?'Ojai':'I-PACE'}`),el('p',{class:'street-car-state'},stateName(car.state)+(car.waiting?car.pending_edge_id?' · waiting to enter the road':' · road queue':'')),
   el('p',{},car.request_id?`${car.request_id}: ${label(car.from)} → ${label(car.to)}`:`At ${label(car.anchor)} · ${car.completed} completed journeys`),
   el('p',{},edge?`${edge.name} · ${fmt(edge.length_m,0)} m block · ${fmt(car.progress*100,0)}% along`:'At a modeled off-road anchor'),
   car.edge_id&&car.waiting?el('p',{},`${fmt(car.exit_wait_seconds/60)} min waiting after the uncongested exit time on this block. This is one part of the journey delay.`):null,
   el('details',{},[el('summary',{},'Chosen road itinerary'),el('p',{},names.length?names.join(' → '):'No road leg in progress')]),
   el('ol',{class:'street-event-log'},events.map(e=>el('li',{},[el('time',{},clock(e.time,result.config.start_hour)),e.text]))));
  const top=[...f.roads].filter(e=>e.queued>0).sort((a,b)=>Number(b.spillback)-Number(a.spillback)||b.queued-a.queued).slice(0,5);
  queueList.replaceChildren(...top.map(s=>button(`${edges.get(s.id).name} · ${s.queued} queued${s.spillback?' · spillback':''}`,()=>scene.selectEdge(s.id))));
  if(!top.length)queueList.appendChild(el('p',{},'No vehicles queued on a road block at this step.'));
  const road=edges.get(edgeId),s=f.roads.find(e=>e.id===edgeId);
  if(road)blockDetail.replaceChildren(el('h3',{},road.name),el('p',{},`${fmt(road.length_m,0)} m · ${road.lanes} modeled lane(s) · ${road.speed_kph} km/h free-flow input`),el('p',{},`${s?.occupancy??0} road vehicles occupying ${s?.storage??Math.max(1,Math.floor(road.length_m*Math.max(1,road.lanes)/7.5))} storage slots. ${s?.spillback?'The first car cannot enter the full downstream block.':'No downstream spillback at this step.'}`),el('p',{},`Directed edge ${road.from} → ${road.to}. ${road.signal?'Tagged signal; timing is synthetic.':'No signal represented at this exit.'}`));
  else blockDetail.replaceChildren();
  if(road&&s)blockDetail.appendChild(el('p',{},`Front car exit wait: ${fmt(s.front_wait_seconds/60)} min beyond its uncongested exit time. This is a recorded model wait, not an estimated clearance time.`));
 }
 function showResults(){
  const s=result.summary;const metric=(title,value,note)=>el('article',{},[el('span',{},title),el('strong',{},value),el('small',{},note)]);
  results.replaceChildren(eyebrow('3 / READ THE TRADE-OFF'),el('h2',{},'What did the fleet manage to serve?'),el('p',{},`${result.config.duration_minutes}-minute run · seed ${result.config.seed} · ${result.config.policy==='queue-aware'?'queue-aware':'free-flow'} routes. End-of-run totals, separate from the replay clock.`),
   el('div',{class:'street-metrics'},[metric('Completed journeys',`${s.completed} / ${s.requests}`,`${s.waiting} waiting · ${s.in_progress} in progress · ${s.expired} expired · ${s.unroutable} no route`),metric('Pickup wait',fmt(s.mean_pickup_minutes)+' min',`Mean for ${s.boarded} boarded riders, including pickup dwell`),metric('Passenger leg',fmt(s.mean_trip_minutes)+' min',`Mean for ${s.completed} completed journeys only`),metric('Empty road distance',fmt(s.empty_km)+' km','Actual traveled pickup distance, including partial legs')]),
   el('p',{class:'street-result-note'},`${fmt(s.busy_vehicle_minutes,0)} vehicle-minutes unavailable for another request. ${s.traffic.pending} road journeys still waiting outside the network; ${s.traffic.on_road} on a road; ${s.unavailable_background} background journeys had no modeled route. These are not completed trips.`),
   el('div',{class:'street-destination-results'},s.destinations.map(d=>metric(d.id==='sfo'?'SFO-bound':d.id==='east-bay'?'East Bay-bound':'Local / return to SF',`${d.completed} / ${d.requests}`,'Completed / requested network legs'))));
  if(comparison){
   const rows=[['Completed journeys','completed',''],['Pickup wait, boarded riders','mean_pickup_minutes',' min'],['Passenger time, completed only','mean_trip_minutes',' min'],['Empty road distance','empty_km',' km'],['Unavailable vehicle time','busy_vehicle_minutes',' vehicle-min'],['Largest road queue, all links','peak_queued',' vehicles'],['Waiting at horizon','waiting',''],['In progress at horizon','in_progress','']];
   results.appendChild(el('h3',{},'Same demand. Two route policies.'));
   results.appendChild(el('div',{class:'street-table-wrap'},el('table',{class:'street-comparison'},[el('caption',{},'Candidate minus baseline; a single seed is an illustration, not a statistically established improvement.'),el('thead',{},el('tr',{},['Metric','Free-flow','Queue-aware','Change'].map(t=>el('th',{scope:'col'},t)))),el('tbody',{},rows.map(([title,key,unit])=>el('tr',{},[el('th',{scope:'row'},title),el('td',{},fmt(comparison.baseline.summary[key])+unit),el('td',{},fmt(comparison.candidate.summary[key])+unit),el('td',{},(comparison.delta[key]>0?'+':'')+fmt(comparison.delta[key])+unit)])))])));
   results.appendChild(el('p',{},'Queues affect route choice at each leg departure. Dispatch still selects the nearest available anchor by straight-line distance. Different policies may board or complete different riders; interpret those means alongside coverage and unfinished work. No universal winner is computed.'));
  }
  results.appendChild(el('h3',{},'Where did the queue move?'));
  results.appendChild(el('div',{class:'street-hotspot-results'},result.hotspots.map(h=>el('article',{},[el('strong',{},network.hotspots.find(x=>x.id===h.id).label),el('span',{},`${h.peak_queued} vehicles at peak queue`),el('small',{},`${fmt(h.blocked_link_minutes)} blocked link-minutes. Several blocked links count separately.`),button('Inspect this corridor',()=>{scene.focus(h.id);seek(result.frames.reduce((a,b)=>{const ids=new Set(network.hotspots.find(x=>x.id===h.id).edge_ids);const count=f=>f.roads.filter(e=>ids.has(e.id)).reduce((n,e)=>n+e.queued,0);return count(b)>count(a)?b:a;}).time);scene.element.scrollIntoView?.({block:'center',behavior:'instant'});})]))));
  results.appendChild(button('Download experiment results',()=>download('fleetlab-street-experiment.json',{version:result.version,network_version:result.network_version,config:result.config,summary:result.summary,requests:result.requests,hotspots:result.hotspots,routes:result.routes,comparison:comparison?{baseline:comparison.baseline.summary,candidate:comparison.candidate.summary,delta:comparison.delta}:null})));
 }
 function chooseRun(which){if(!comparison)return;pause();result=comparison[which];time=0;edgeId=null;lastDetails='';showResults();status.textContent=`Replaying ${result.config.policy} routes on the same demand.${stale?' Settings changed; this is the previous run.':''}`;render();}
 async function run(compare=false){
  if(busy||destroyed)return;pause();busy=true;const captured={...config},version=revision,playIntent=pauseVersion;fields.disabled=true;runButton.disabled=true;compareButton.disabled=true;status.textContent=compare?'Comparing both policies on identical demand…':'Building the street experiment…';error.hidden=true;
  await new Promise(resolve=>setTimeout(resolve,0));
  try{if(destroyed)return;const nextComparison=compare?compareStreetPolicies(captured,network):null,nextResult=nextComparison?.baseline??simulateStreets(captured,network);comparison=nextComparison;result=nextResult;time=0;stale=revision!==version;selected='AV-01';edgeId=null;lastDetails='';timeline.max=String(captured.duration_minutes*60);
   vehicleSelect.replaceChildren(...result.frames[0].vehicles.map(v=>el('option',{value:v.id},v.id)));vehicleSelect.value=selected;comparisonView.hidden=!comparison;
   status.textContent=stale?'Settings changed; this is the previous run.':compare?'Comparison ready. Replay either policy, then read the trade-offs below.':'Scenario ready. Use Largest queue to jump to the bottleneck, or follow an AV.';
   showResults();scene.focus(captured.hotspot);render();if(!reducedMotion()&&!stale&&!element.hidden&&pauseVersion===playIntent)play();
  }catch(e){error.textContent=e.message;error.hidden=false;status.textContent='Check the settings and try again.';}finally{busy=false;fields.disabled=false;runButton.disabled=false;compareButton.disabled=false;}
 }
 sync();render();
 return {element,run,setConfig,pause,seek,refresh:()=>scene.refresh(),getState:()=>({run:result,time,playing,stale,busy}),destroy(){destroyed=true;pause();scene.destroy();}};
}
