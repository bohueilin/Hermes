import { CityMap } from './city-map.mjs';
import {clearFleetInsights, renderFleetInsights} from './fleet-insights.mjs';
import { formatMetric as fmt, clockLabel, durationLabel, sampleAt, resumeTime, estimateRevenue, eventDescription, stateLabels, pairLesson, requestGate, comparisonRows, METRES_PER_MILE, recordingSelection, validateRecording } from './view-model.mjs';
const $=id=>document.getElementById(id);
const el=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
const facts=(host,rows)=>{host.replaceChildren(...rows.map(([a,b])=>{const row=el('div');row.append(el('dt',a),el('dd',b));return row;}));};
const isDepot=s=>['charging','turnaround','queue_charge','queue_turnaround'].includes(s);
export class Replay {
  constructor({catalog,roads,geometry,comparison,readData,notice,isVisible}){
    Object.assign(this,{catalog,roads,geometry,comparison,readData,notice,isVisible,study:'legacy',time:0,playing:false,gate:requestGate(),fleetCache:new Map()});
    for(const id of ['seed-select','arm-select','vehicle-select'])$(id).addEventListener('change',()=>this.load());
    $('load-replay').onclick=()=>this.load();
    $('play').onclick=async()=>{if(this.playing){this.pause();return;}if(!this.trace)await this.load();if(!this.trace||!this.isVisible()||document.hidden||this.trace.verification!=='INTERNALLY_CONSISTENT')return;this.draw(resumeTime(this.time,this.trace.samples));this.playing=true;this.tick=undefined;$('play').textContent='Pause';this.frame=requestAnimationFrame(n=>this.animate(n));};
    $('time').oninput=()=>{this.pause();this.draw(Number($('time').value));};
    document.addEventListener('visibilitychange',()=>{if(document.hidden)this.pause();});
    $('fit-journey').onclick=()=>this.map?.fitRoute();$('find-vehicle').onclick=()=>this.map?.focusCar();$('flat-journey').onclick=()=>{this.map?.useFlat();$('flat-journey').textContent='Flat map active';};
    for(const id of ['fare-base','fare-mile','fare-minute'])$(id).addEventListener('input',()=>this.revenue());
  }
  show(){const created=!this.map;if(created)this.map=new CityMap($('journey-map'),this.roads,this.geometry,{replay:true,flat:new URLSearchParams(location.search).get('renderer')==='flat',onInspect:t=>$('journey-map-hint').textContent=t});this.map.resize();if(created&&this.trace){this.map.setSites(this.trace.sites);this.map.setRoutes(this.trace.routes);this.map.fitRoute();this.draw(this.time);}if(!this.trace&&!this.loading)this.load();}
  pause(){this.playing=false;cancelAnimationFrame(this.frame);$('play').textContent=this.trace&&this.time>=this.trace.samples.at(-1)[0]?'Replay':'Play';}
  async load(){
    const ticket=this.gate.issue();this.pause();this.loading=true;this.trace=null;this.time=0;
    clearFleetInsights();
    $('play').disabled=true;$('time').disabled=true;$('trip-summary').setAttribute('aria-busy','true');
    $('featured-vehicles').replaceChildren();$('selection-note').textContent='';$('trip-metrics').replaceChildren();$('depot-facts').replaceChildren();$('summary-context').textContent='Loading selected vehicle…';$('shift-bar').replaceChildren();$('shift-story').textContent='';$('activity-totals').replaceChildren();$('vehicle-events').replaceChildren();$('vehicle-facts').replaceChildren();$('fare-estimate').textContent='Unavailable · loading trace';$('state-explanation').textContent='Loading selected vehicle…';$('state-heading').textContent='Please wait';$('event-count').textContent='Full operational event history';$('event-scope').textContent='';$('vehicle-name').textContent='Loading…';$('replay-status').textContent='Loading recorded trace…';this.map?.setCar(null);this.map?.setRoutes({type:'FeatureCollection',features:[]});
    const seed=Number($('seed-select').value),arm=$('arm-select').value,vehicle=$('vehicle-select').value||'ev-001';
    this.map?.setSites([]);
    const p=this.study==='legacy'?comparisonRows(this.comparison).find(p=>p.seed===seed):null;
    $('pair-story').textContent=this.study==='legacy'?(p?`Repeat ${this.catalog.seeds.indexOf(seed)+1} · seed ${seed}. ${pairLesson(p)}`:'No compatible paired result is available.'):`Power headroom · seed ${seed} · ${arm}. Replay is exported for the predetermined first evaluation seed only; all 144 summaries are in the notebook.`;
    try{
      const record=recordingSelection(this.catalog,this.study,seed,arm,vehicle);
      this.map?.setSites(record.sites);
      const key=`${this.study}-${seed}-${arm}`;
      const [data,fleet]=await Promise.all([this.readData(record.vehicle_files[vehicle]),this.fleetCache.has(key)?this.fleetCache.get(key):this.readData(record.fleet_file)]);
      if(!this.gate.current(ticket))return;
      validateRecording(data,fleet,record,vehicle);
      try{renderFleetInsights(fleet,this.catalog.vehicles,data);}catch{clearFleetInsights('Fleet summary unavailable · the complete inventory or required measurements could not be confirmed.',false);}
      this.fleetCache.set(key,fleet);this.trace=data;this.featured(fleet,vehicle);this.map?.setSites(data.sites);this.map?.setRoutes(data.routes);this.map?.fitRoute();
      $('vehicle-name').textContent=vehicle.toUpperCase();$('time').max=data.elapsed_s;$('play').disabled=false;$('time').disabled=false;$('trip-summary').removeAttribute('aria-busy');
      this.summary();this.history();this.draw(data.samples[0][0]);
    }catch(e){if(!this.gate.current(ticket))return;clearFleetInsights('Fleet summary unavailable · no compatible recording loaded.',false);$('replay-status').textContent='Trace unavailable';$('summary-context').textContent='No verified trace loaded.';$('trip-summary').removeAttribute('aria-busy');this.notice(`${e.message}. No substitute vehicle or run was loaded.`,true);}
    finally{if(this.gate.current(ticket))this.loading=false;}
  }
  featured(fleet,vehicle){
    $('featured-vehicles').replaceChildren(...fleet.featured.map(v=>{const b=el('button',undefined,'vehicle-choice');b.setAttribute('aria-pressed',String(v.vehicle===vehicle));b.append(el('span',v.label,'eyebrow'),el('strong',v.vehicle.toUpperCase()),el('span',`${v.completed} trips · ${durationLabel(v.queue_s)} queued`));b.onclick=()=>{$('vehicle-select').value=v.vehicle;this.load();};return b;}));
    const chosen=fleet.vehicles.find(v=>v.vehicle===vehicle);$('selection-note').textContent=`Inspecting ${vehicle.toUpperCase()} · ${chosen.completed} completed trips in this layout. Suggestions are the first ID, highest trip count, longest total queue, and middle vehicle by trip count (duplicates removed).`;
  }
  summary(){const t=this.trace,s=t.summary;const miles=m=>`${fmt(m/METRES_PER_MILE,2)} mi`;
    $('summary-context').textContent=`${t.vehicle.toUpperCase()} · ${t.layout??(t.arm==='baseline'?'A':'AB')} · ${t.total_power_kw??200} kW · ${t.study??'Original depot study'} (seed ${t.seed}) · ${clockLabel(0)}–${clockLabel(t.elapsed_s)}. Completed trips require both pickup and drop-off.`;
    const metrics=[['Completed trips (PUDO)',fmt(s.completed,0),`${s.boarded} pickups · ${s.completed} drop-offs · ${s.in_progress} assigned or aboard at end`],['Total miles driven',miles(s.distance_m),'All traveled legs, including unfinished trips'],['Empty / deadhead miles',s.empty_fraction===null?'Unavailable':`${fmt(s.empty_fraction*100,1)}%`,`${miles(s.empty_m)} without a passenger / all miles`],['Depot arrivals',String(s.depot_visits),`${s.unique_depots.length} unique site${s.unique_depots.length===1?'':'s'}${s.unique_depots.length?' · '+s.unique_depots.join(', '):''}`]];
    $('trip-metrics').replaceChildren(...metrics.map(([label,value,note])=>{const a=el('article','', 'metric-tile');a.append(el('h4',label),el('strong',value),el('p',note));return a;}));
    facts($('depot-facts'),[['Charging sessions',`${s.charge_started} started / ${s.charge_completed} completed`],['Energy received',`${fmt(s.charged_kwh,2)} kWh`],['Generic turnaround',`${s.turnaround_started} started / ${s.turnaround_completed} completed`],['Total depot queue time',durationLabel(s.queue_s)],['Clean / update / fix','Not separately modeled'],['Shift ends',`${stateLabels[s.final_state]??s.final_state}${isDepot(s.final_state)&&s.final_site?' · depot '+s.final_site:''}`]]);
    this.revenue();
    const longest=t.intervals.filter(i=>i.state.startsWith('queue_')).sort((a,b)=>(b.end-b.start)-(a.end-a.start))[0];
    $('shift-story').textContent=longest?`Longest single wait: ${durationLabel(longest.end-longest.start)} at depot ${longest.site}, ${clockLabel(longest.start)}–${clockLabel(longest.end)}. ${longest.state==='queue_charge'?'The vehicle waited for a charging port; finite ports and shared power constrain service.':'The vehicle waited for a turnaround slot.'} The shift ends ${stateLabels[s.final_state]?.toLowerCase()??s.final_state}.`:'No depot queue interval was recorded for this vehicle.';
    const totals=new Map();for(const i of t.intervals)totals.set(i.state,(totals.get(i.state)??0)+i.end-i.start);
    $('activity-totals').replaceChildren(...[...totals].map(([state,seconds])=>el('span',`${stateLabels[state]??state} · ${durationLabel(seconds)}`,`activity ${state}`)));
    $('shift-bar').replaceChildren(...t.intervals.map(i=>{const b=el('button','',`shift-segment ${i.state}`);b.style.flexGrow=String(i.end-i.start);b.title=`${stateLabels[i.state]??i.state}${i.site?' · depot '+i.site:''}: ${clockLabel(i.start)}–${clockLabel(i.end)}`;b.setAttribute('aria-label',b.title);b.onclick=()=>{this.pause();this.draw(i.start);};return b;}));
  }
  revenue(){if(!this.trace)return;const s=this.trace.summary;const fares=['fare-base','fare-mile','fare-minute'].map(id=>$(id).value);const value=estimateRevenue(s,fares);$('fare-estimate').textContent=value===null?'Unavailable · enter all three nonnegative rates':`${new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(value)} · illustrative gross fares`;
    $('fare-formula').textContent=`${s.completed} completed trips × base + ${fmt(s.completed_passenger_m/METRES_PER_MILE,2)} completed passenger miles × mile rate + ${fmt(s.completed_passenger_s/60,2)} passenger minutes × minute rate. Computed before display rounding. No surge, fees, tax, tips or operating costs; not profit. Rates stay in this page only.`;}
  history(){const t=this.trace;$('event-count').textContent=`Full operational event history · ${t.events.length} events · ${clockLabel(0)}–${clockLabel(t.elapsed_s)}`;$('event-scope').textContent=t.event_scope+' The entire history stays visible, including events after the playback cursor.';
    $('vehicle-events').replaceChildren(...t.events.map(e=>{const r=el('tr');r.dataset.time=e.t;const seconds=String(Math.floor(e.t%60)).padStart(2,'0');r.append(el('td',`${clockLabel(e.t)}:${seconds}`),el('td',durationLabel(e.t)),el('td',eventDescription(e)));const td=el('td');const b=el('button','Seek');b.setAttribute('aria-label',`Seek ${clockLabel(e.t)}:${seconds}: ${eventDescription(e)}`);b.onclick=()=>{this.pause();this.draw(e.t);};td.append(b);r.append(td);return r;}));
  }
  draw(time){if(!this.trace||time===null)return;this.time=time;const t=this.trace;$('time').value=time;$('time-label').textContent=clockLabel(time);$('elapsed-label').textContent=`${durationLabel(time)} elapsed / ${durationLabel(t.elapsed_s)} recorded`;
    const pos=sampleAt(t.samples,time,t.interval_s),s=pos.sample;this.map?.setCar(s);
    $('replay-status').textContent=pos.status==='recorded'?`${t.vehicle.toUpperCase()} · ${time>=t.elapsed_s?'Shift ended':stateLabels[s[4]]??s[4]}`:pos.status==='gap'?'Recording gap · paused':'Before first position sample (07:00:15)';
    if(!s){if(pos.status==='gap')this.pause();facts($('vehicle-facts'),[['Position','Not available at this time']]);$('state-heading').textContent='Position unavailable';$('state-explanation').textContent='Playback uses recorded samples only. The event history retains exact event times.';return;}
    const interval=t.intervals.find(i=>i.start<=time&&i.end>time)??t.intervals.at(-1);
    facts($('vehicle-facts'),[['Recorded state',stateLabels[s[4]]??s[4]],['Energy',`${fmt(s[5],2)} kWh`],['Charging target',`${fmt(t.energy?.target_kwh??48,0)} kWh · initial ${fmt(t.energy?.initial_kwh??30,0)} kWh`],['Position sample',`${clockLabel(s[0])}:${String(s[0]%60).padStart(2,'0')}`],['Run verification','Internally consistent']]);
    $('state-heading').textContent=`${stateLabels[interval.state]??interval.state}${interval.site?' · depot '+interval.site:''}`;
    const explanations={queue_charge:'Waiting for a charging port. It cannot serve a new passenger while queued; finite port capacity can make this a long wait.',charging:'Connected to a finite charging port. Site power is shared; the vehicle waits until the model’s energy target before returning to dispatch.',queue_turnaround:'Waiting for a generic turnaround slot after the required number of trips.',turnaround:'A six-minute generic turnaround service. This model does not distinguish cleaning, repairs or software work.',idle:'Available for a feasible request. Waiting here does not itself indicate a charging or service queue.',passenger:'A passenger is aboard. The blue lines show traveled passenger routes over the full shift.',pickup:'Traveling empty to an assigned pickup.',boarding:'The passenger is boarding during the modeled dwell time.',returning:'Traveling empty to the selected fictional depot for energy or scheduled turnaround.'};
    $('state-explanation').textContent=`${explanations[interval.state]??'Inspect the event history for details.'} Interval: ${clockLabel(interval.start)}–${clockLabel(interval.end)} (${durationLabel(interval.end-interval.start)}).${time>=t.elapsed_s?' Recording ends here; later trips are not observed.':''}`;
  }
  animate(now){if(!this.playing||!this.trace)return;if(this.tick===undefined)this.tick=now;const time=Math.min(this.trace.elapsed_s,this.time+(now-this.tick)/1000*Number($('playback-speed').value));this.tick=now;this.draw(time);if(time>=this.trace.elapsed_s)this.pause();if(this.playing)this.frame=requestAnimationFrame(n=>this.animate(n));}
}
