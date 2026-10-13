import {test} from 'node:test';
import assert from 'node:assert/strict';
import {deliveryInput} from '../src/model/software-delivery-contract.js';
const model=await import('../src/model/software-delivery.js').catch(()=>({}));
const view=await import('../src/ui/software-delivery-view.js').catch(()=>({}));
const project=(preset='default',policy='cold',edit=()=>{})=>{assert.equal(typeof view.createDeliveryProjection,'function');const input=deliveryInput(preset);edit(input);return view.createDeliveryProjection(model.runDelivery(input,policy));};
test('default accepted projection separates cumulative receipt, next interval rates and whole-run outcome',()=>{
 const p=project();const s=p.at(96000,'V1');assert.equal(s.wan_bytes,12e9);assert.equal(s.local_bytes,0);assert.equal(s.own.local_rate_Bps,62500000);assert.equal(s.own.wan_rate_Bps,0);assert.equal(s.shared.local_rate_Bps,250e6);assert.equal(s.state,'receiving');
 assert.equal(p.at(288000,'V1').state,'checking');assert.equal(p.at(348000,'V1').state,'activating');assert.equal(p.at(378000,'V1').state,'ready');assert.equal(p.at(2400000,'V1').shared.local_rate_Bps,0);
 const r=project('default','repeated');assert.equal(r.at(378000,'V1').wan_bytes,47.25e9);assert.equal(r.at(480000,'V1').local_bytes,24e9);assert.equal(r.at(480000,'V1').own.local_bytes,6e9);assert.equal(r.at(480000,'V1').target,'Target now; not ready');assert.equal(r.at(481000,'V1').target,'Target passed; not ready');assert.equal(r.at(480999,'V1').t_ms,480000);
});
test('staggered selected request is checking while another vehicle uses WAN; cold shares local',()=>{
 const r=project('two-arrivals','repeated').at(150000,'V1');assert.equal(r.state,'checking');assert.equal(r.own.wan_rate_Bps,0);assert.equal(r.shared.wan_rate_Bps,125e6);
 const c=project('two-arrivals','cold').at(150000,'V1');assert.equal(c.own.local_rate_Bps,125e6);assert.equal(c.shared.local_rate_Bps,250e6);
});
test('failure is revealed at its boundary; unfinished and binding ties do not become zeros or fake congestion',()=>{
 const f=project('default','cold',s=>{s.requests[3].check_outcome='fail';});assert.equal(f.at(347000,'V4').state,'checking');assert.equal(f.at(348000,'V4').state,'failed');assert.equal(f.metrics.all_ready_ms,null);
 const zero=project('one','cold',s=>{s.resources.wan.aggregate_Bps=0;s.resources.wan.transfer_cap_Bps=0;});assert.match(zero.at(0,'V1').cause,/0 B\/s/);assert.match(zero.at(0,'V1').cause,/capacity.*cap|cap.*capacity/i);assert.equal(zero.at(2400000,'V1').state,'unfinished');assert.equal(zero.metrics.all_ready_ms,null);
});
test('event navigation uses ceiling applied boundary while free seek floors; one shared rate scale',()=>{
 const p=project('one','cold',s=>{s.requests[0].arrival_ms=100;});assert.equal(p.at(100,'V1').t_ms,0);assert.ok(p.events.some(e=>e.raw_ms===100&&e.t_ms===1000));
 assert.equal(project().scale_Bps,250e6);assert.equal(project('slow-local').scale_Bps,125e6);
});
test('horizon closure names the next unstarted positive prerequisite',()=>{
 const s=deliveryInput('one');s.H_ms=2000;s.artifact.size_bytes=4;s.resources.wan={aggregate_Bps:4,transfer_cap_Bps:4};s.resources.local={aggregate_Bps:4,transfer_cap_Bps:4};Object.assign(s.requests[0],{deadline_ms:2000,check_ms:0,activation_ms:1});
 const p=view.createDeliveryProjection(model.runDelivery(s,'cold'));assert.equal(p.at(2000,'V1').stage,'Activation');assert.match(p.at(2000,'V1').cause,/cannot start.*observation end/i);
 s.requests[0].check_ms=1;const c=view.createDeliveryProjection(model.runDelivery(s,'cold'));assert.equal(c.at(2000,'V1').stage,'Modeled check');
});
test('default narration refuses records from a different input even if the pair label says default',()=>{
 const p=project('default','cold',s=>{s.artifact.available_at_ms=50000;});assert.deepEqual(view.deliveryChapters({id:'default',projections:{cold:p,repeated:project('default','repeated')}}),[]);
});
