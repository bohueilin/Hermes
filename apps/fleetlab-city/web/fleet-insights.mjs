import {fleetInsights, formatMetric as fmt, clockLabel, METRES_PER_MILE} from './view-model.mjs';

export function clearFleetInsights(message='Loading the complete fleet…',busy=true,doc=document) {
  const $=id=>doc.getElementById(id);
  $('fleet-insights').setAttribute('aria-busy',String(busy));
  $('fleet-context').textContent=message;
  $('fleet-metrics').replaceChildren();
  $('fleet-charts').replaceChildren();
}

export function renderFleetInsights(fleet,roster,trace,doc=document) {
  const $=id=>doc.getElementById(id);
  const el=(tag,text,cls)=>{const node=doc.createElement(tag);if(text!==undefined)node.textContent=text;if(cls)node.className=cls;return node;};
  const s=fleetInsights(fleet,roster,trace.elapsed_s);
  const layout=trace.layout??(trace.arm==='baseline'?'A':'AB');
  $('fleet-context').textContent=`${s.count} of ${roster.length} vehicles · ${layout==='AB'?'Two depots · A + B':`One depot · ${layout}`} · seed ${trace.seed} · ${clockLabel(0)}–${clockLabel(trace.elapsed_s)}${trace.execution==='INCOMPLETE'?' · Recording stopped early':''}. Whole-recording totals; they stay fixed during playback and vehicle selection.`;
  const metrics=[
    ['Completed trips',fmt(s.completed,0),`${s.servedVehicles} of ${s.count} vehicles completed at least one pickup + drop-off.`],
    ['Typical vehicle',`${fmt(s.medianTrips,1)} trips`,`Median across all ${s.count} vehicles. Mean ${fmt(s.meanTrips,2)}; range ${s.minTrips}–${s.maxTrips}.`],
    ['Empty miles',s.emptyFraction===null?'Unavailable':`${fmt(s.emptyFraction*100,1)}%`,`${fmt(s.emptyDistance/METRES_PER_MILE,0)} empty / ${fmt(s.distance/METRES_PER_MILE,0)} total miles. Includes unfinished legs.`],
    ['Time in depot queues',`${fmt(s.queueFraction*100,1)}%`,`${fmt(s.queueHours,1)} of ${fmt(s.vehicleHours,1)} combined vehicle-hours. Waiting for charging or turnaround.`],
  ];
  $('fleet-metrics').replaceChildren(...metrics.map(([label,value,note])=>{const tile=el('article',undefined,'metric-tile');tile.append(el('h4',label),el('strong',value),el('p',note));return tile;}));
  const distribution=el('div',undefined,'fleet-chart');
  distribution.append(el('p','01 / SERVICE IS UNEVEN','eyebrow'),el('h4','How many trips did each vehicle finish?'));
  const bars=el('div',undefined,'fleet-distribution');
  for(const bin of s.bins){
    const row=el('div',undefined,'fleet-bin');
    const track=el('span',undefined,'fleet-bar-track'),bar=el('i');bar.style.width=`${bin.count/s.count*100}%`;track.append(bar);track.setAttribute('aria-hidden','true');
    row.append(el('span',`${bin.label} trips`),track,el('strong',`${bin.count} EVs`));bars.append(row);
  }
  distribution.append(bars,el('p',`Each vehicle appears once. Bar width uses all ${s.count} vehicles as its scale. The spread describes assignments and shared resources; it is not a ranking of vehicle capability.`,'small'));
  const queues=el('div',undefined,'fleet-chart');
  queues.append(el('p','02 / QUEUES CONSUME THE SHIFT','eyebrow'),el('h4','Time adds up across the whole fleet.'));
  const budget=el('div',undefined,'fleet-time-budget');budget.setAttribute('role','img');budget.setAttribute('aria-label',`${fmt(s.queueFraction*100,1)} percent in depot queues; ${fmt((1-s.queueFraction)*100,1)} percent in all other states.`);
  const queued=el('span',undefined,'fleet-queued');queued.style.width=`${s.queueFraction*100}%`;budget.append(queued);
  const legend=el('div',undefined,'fleet-time-legend');legend.append(el('span',`Depot queues · ${fmt(s.queueHours,1)} vehicle-hours`),el('span',`All other states · ${fmt(s.vehicleHours-s.queueHours,1)} vehicle-hours`));
  queues.append(budget,legend,el('p',`${s.waitingForCharge} of ${s.count} vehicles were waiting for a charging port at ${clockLabel(trace.elapsed_s)}. All other states include driving, availability, boarding, charging and turnaround; they do not all produce passenger service.`,'small'));
  $('fleet-charts').replaceChildren(distribution,queues);
  $('fleet-insights').setAttribute('aria-busy','false');
}
