// Frozen arithmetic oracle from depot-flow-lab.js renderCursor at 1f1af32.
// Keep the interval integration independent of production projection/index logic.
export function inspectAt(record, t_s) {
  return record.scenario.vehicles.map(v => {
    let bytes=0,joules=0;
    for(const n of record.intervals){const dt=Math.max(0,Math.min(t_s,n.end_s)-n.start_s);bytes+=dt*(n.upload[v.id]??0);joules+=dt*(n.charge[v.id]??0);}
    const ready=record.events.find(e=>e.vehicle===v.id&&e.type==='ready'&&e.time_s<=t_s);
    return {vehicle:v.id,upload_bytes:bytes,energy_j:joules,ready_s:ready?.time_s??null};
  });
}

// An event fold, deliberately separate from the integral and from production code.
export function tasksAt(record, t_s) {
  const states=Object.fromEntries(record.scenario.vehicles.map(v=>[v.id,{upload:null,charge:null,post:null,ready:null}]));
  for(const event of record.events){
    if(event.time_s>t_s)continue;
    if(event.type==='complete')states[event.vehicle][event.task]=event.time_s;
    if(event.type==='ready')states[event.vehicle].ready=event.time_s;
  }
  return states;
}
