// Presentation of accepted intervals only. No scheduling, policy search or winner calculation.
export const ORDER_CHAPTERS=[0,96000,144000,234000,330000,378000];
export const orderSeconds=ms=>`${Number((ms/1000).toFixed(3))} s`;
export function createOrderProjection(study){
 const records=new Map(study.records.map(r=>[r.order.join(','),r]));
 const record=order=>{const r=records.get(order.join(','));if(!r)throw Error('Order is not in the checked study.');return r;};
 return {outcome:record,at(order,time_ms,vehicleId){const r=record(order),v=r.vehicles.find(v=>v.id===vehicleId);if(!v)throw Error('Unknown vehicle.');
  const request=r.input.delivery.requests.find(x=>x.id===vehicleId);
  const state=time_ms<request.arrival_ms?'Not arrived':time_ms<v.receive_start_ms?'Waiting':time_ms<v.receive_end_ms?'Receiving':time_ms<v.check_end_ms?'Checking':time_ms<v.ready_ms?'Activating':'Ready';
  return {...v,state,late_ms:Math.max(0,v.ready_ms-v.deadline_ms),receive_by_ms:v.deadline_ms-90000};},
 assignment(order){return study.input.delivery.requests.map(req=>({id:req.id,cells:reqPositions(req.id).map((v,i)=>({position:i+1,ready_ms:v.ready_ms,miss:v.ready_ms>v.deadline_ms,late_ms:Math.max(0,v.ready_ms-v.deadline_ms),selected:order[i]===req.id}))}));}};
 function reqPositions(id){return Array.from({length:study.input.delivery.requests.length},(_,position)=>{const r=study.records.find(r=>r.order[position]===id);return r.vehicles.find(v=>v.id===id);});}
}
