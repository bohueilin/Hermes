import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createHash} from 'node:crypto';
import {deliveryInput,canonicalDelivery,DELIVERY_BOUNDS} from '../src/model/software-delivery-contract.js';
const api=await import('../src/model/software-delivery.js').catch(()=>({}));
function run(input=deliveryInput(),policy='repeated'){assert.equal(typeof api.runDelivery,'function','engine exists');return api.runDelivery(input,policy);}
function allocation(universe,eligible,cursor,budget_bytes){assert.equal(typeof api.allocateDelivery,'function','allocator exists');return api.allocateDelivery({universe,eligible,cursor,budget_bytes});}
const row=(id,remaining_bytes,cap_bytes=99)=>({id,remaining_bytes,cap_bytes});
const values=r=>r.eligible.map(e=>e.grant_bytes);
const seconds=(record,key)=>record.outcomes.map(o=>o[key]===null?null:o[key]/1000);
const bytes=(record,resource,t=record.input.H_ms,id=null)=>record.resources.filter(r=>r.resource===resource&&r.t_ms<t).reduce((sum,r)=>sum+r.eligible.filter(e=>id===null||e.id===id).reduce((s,e)=>s+e.grant_bytes,0),0);
function short({q=1000,size=4,H=2000,check=0,activation=0,deadline=H}={}){const i=deliveryInput('one',q);i.H_ms=H;i.artifact.size_bytes=size;i.requests[0].deadline_ms=deadline;i.requests[0].check_ms=check;i.requests[0].activation_ms=activation;for(const r of Object.values(i.resources)){r.aggregate_Bps=4;r.transfer_cap_Bps=4;}return i;}

test('simultaneous rounds cap, redistribute and advance only for residual bytes',()=>{
  const fixtures=[
    [['A','B'],[1,99],'A',10,[1,9],0,'A'],[['A','B'],[1,4],'A',10,[1,4],5,'A'],
    [['A','B','C'],[1,99,99],'A',6,[1,3,2],0,'C'],[['A','B','C'],[1,99,99],'C',6,[1,2,3],0,'A'],
    [['A','B','C'],[1,2,99],'B',10,[1,2,7],0,'B']];
  for(const [u,limits,c,b,grants,unused,next]of fixtures){const r=allocation(u,u.map((id,i)=>row(id,limits[i])),c,b);assert.deepEqual(values(r),grants);assert.equal(r.unused_bytes,unused);assert.equal(r.cursor_out,next);}
  const r=allocation(['A','B','C'],[row('B',99),row('C',99)],'B',1);assert.deepEqual(values(r),[1,0]);assert.equal(r.cursor_out,'C');
  const capped=allocation(['A','B'],[row('A',99,0),row('B',99,3)],'A',10);assert.deepEqual(values(capped),[0,3]);assert.equal(capped.unused_bytes,7);assert.equal(capped.cursor_out,'A');
  const shuffled=allocation(['C','B','A'],[row('C',99),row('A',1),row('B',99)],'A',6);assert.deepEqual(shuffled,allocation(['A','B','C'],[row('A',1),row('B',99),row('C',99)],'A',6));
});

test('residual fairness, full-universe persistence, idle budget discard and joining transfers',()=>{
  const u=['A','B'];let cursor='A',sum=[0,0];
  for(let n=0;n<10;n++){const r=allocation(u,u.map(id=>row(id,99)),cursor,1);assert.deepEqual(values(r),n%2?[0,1]:[1,0]);cursor=r.cursor_out;sum=sum.map((v,i)=>v+values(r)[i]);}assert.deepEqual(sum,[5,5]);assert.equal(cursor,'A');
  const all=['A','B','C','D'];let r=allocation(all,[row('A',99),row('B',99)],'A',1);assert.deepEqual(values(r),[1,0]);assert.equal(r.cursor_out,'B');
  r=allocation(all,[row('A',99),row('C',99)],r.cursor_out,1);assert.deepEqual(values(r),[0,1]);assert.equal(r.cursor_out,'D');
  for(let n=0;n<100;n++){r=allocation(all,[],r.cursor_out,10);assert.equal(r.unused_bytes,10);assert.equal(r.cursor_out,'D');}
  r=allocation(all,[row('A',99),row('B',99)],r.cursor_out,1);assert.deepEqual(values(r),[1,0]);assert.equal(r.cursor_out,'B');
  r=allocation(all,[row('B',99),row('D',99)],r.cursor_out,1);assert.deepEqual(values(r),[1,0]);assert.equal(r.cursor_out,'C');
  assert.throws(()=>allocation(['A'],[row('unknown',1)],'A',1),/eligible|universe/);
  assert.throws(()=>allocation(['A','A'],[row('A',1)],'A',1),/duplicate/);
  assert.throws(()=>allocation(['A'],[row('A',1)],'missing',1),/cursor/);
});

test('four public pairs meet independently calculated outcomes and separate transfer ledgers',()=>{
  const fixture={default:[666,378,0,4,48000000000,48000000000],one:[234,234,1,1,12000000000,12000000000],
    'slow-local':[2010,1722,0,0,48000000000,48000000000],'two-arrivals':[334,282,1,0,24000000000,24000000000]};
  for(const [name,[rt,ct,rn,cn,wan,local]]of Object.entries(fixture)){
    const input=deliveryInput(name);const repeated=run(input),cold=run(input,'cold');
    assert.deepEqual([repeated.metrics.all_ready_ms,cold.metrics.all_ready_ms],[rt*1000,ct*1000]);
    assert.deepEqual([repeated.metrics.on_time_count,cold.metrics.on_time_count],[rn,cn]);
    assert.equal(repeated.metrics.wan_bytes,wan);assert.equal(cold.metrics.wan_bytes,12000000000);
    for(const record of [repeated,cold]){assert.equal(record.metrics.local_bytes,local);assert.equal(record.metrics.unique_artifact_bytes,12000000000);assert.equal(record.outcomes.length,input.requests.length);assert.equal(record.boundaries.length,2401);assert.equal(record.resources.length,4802);assert.equal(record.resources.at(-1).t_ms,input.H_ms);}
    assert.equal(repeated.metrics.storage_provision_bytes,wan);assert.equal(cold.metrics.storage_provision_bytes,12000000000);
    assert.ok(cold.outcomes.every(o=>o.wan_completed_ms===null&&o.wan_bytes===0));
    assert.deepEqual(repeated.inventory,[]);assert.equal(cold.inventory.length,1);
    assert.equal(repeated.input_digest,cold.input_digest);
    if(name==='two-arrivals'){assert.deepEqual(seconds(repeated,'ready_ms'),[234,334]);assert.deepEqual(seconds(cold,'ready_ms'),[278,282]);assert.equal(repeated.resources.find(r=>r.t_ms===150000&&r.resource==='wan').eligible[0].id,'wan-V2');assert.equal(cold.resources.find(r=>r.t_ms===150000&&r.resource==='local').eligible[0].grant_bytes,125000000);}
  }
});

test('default exact boundary snapshots bind cumulative bytes and modeled task phases',()=>{
  const r=run(),c=run(deliveryInput(),'cold');
  assert.deepEqual(seconds(c,'local_completed_ms'),[288,288,288,288]);assert.deepEqual(seconds(c,'check_completed_ms'),[348,348,348,348]);
  assert.equal(c.tasks.find(t=>t.type==='wan_received').t_ms,96000);assert.deepEqual(seconds(r,'wan_completed_ms'),[384,384,384,384]);
  assert.deepEqual(seconds(r,'local_completed_ms'),[576,576,576,576]);assert.deepEqual(seconds(r,'check_completed_ms'),[636,636,636,636]);
  assert.equal(bytes(r,'wan',378000),47250000000);assert.equal(bytes(r,'local',378000),0);
  assert.equal(bytes(r,'local',480000),24000000000);assert.equal(bytes(r,'local',480000,'loc-V1'),6000000000);
  assert.deepEqual(c.tasks.filter(t=>t.t_ms===348000).map(t=>[t.phase,t.request_id,t.type]),[
    ...['V1','V2','V3','V4'].map(id=>[1,id,'check_passed']),...['V1','V2','V3','V4'].map(id=>[5,id,'activation_started'])]);
  for(const record of [r,c])for(const slot of record.resources.filter(x=>x.t_ms===2400000)){assert.equal(slot.budget_bytes,0);assert.equal(slot.unused_bytes,0);assert.deepEqual(slot.eligible,[]);assert.equal(slot.cursor_in,slot.cursor_out);}
  const {record_digest,...payload}=c;assert.equal(record_digest,createHash('sha256').update(canonicalDelivery(payload)).digest('hex'));
});

test('derived ASCII-ID residual tie and caller permutation preserve exact record identity',()=>{
  const input=deliveryInput();input.requests=input.requests.slice(0,3).map((r,i)=>({...r,id:['A','A0','B'][i],deadline_ms:520000}));input.artifact.size_bytes=11958333334;
  const r=run(input);assert.deepEqual(seconds(r,'wan_completed_ms'),[287,288,288]);assert.deepEqual(seconds(r,'local_completed_ms'),[429,431,431]);assert.deepEqual(seconds(r,'ready_ms'),[519,521,521]);assert.equal(r.metrics.on_time_count,1);
  assert.deepEqual(r.universe.map(t=>t.id),['loc-A','loc-A0','loc-B','wan-A','wan-A0','wan-B']);
  input.requests.reverse();assert.equal(run(input).record_digest,r.record_digest);
});

test('maximum object preserves censored repeated work and null readiness at both quanta',()=>{
  for(const q of [1000,250]){const i=deliveryInput('default',q);i.artifact.size_bytes=64000000000;const r=run(i),c=run(i,'cold');
    assert.equal(c.tasks.find(t=>t.type==='wan_received').t_ms,512000);assert.deepEqual(seconds(c,'local_completed_ms'),[1536,1536,1536,1536]);assert.equal(c.metrics.all_ready_ms,1626000);assert.equal(c.metrics.wan_bytes,64000000000);assert.equal(c.metrics.local_bytes,256000000000);
    assert.deepEqual(seconds(r,'wan_completed_ms'),[2048,2048,2048,2048]);assert.equal(r.metrics.all_ready_ms,null);assert.equal(r.metrics.terminal_ms,2400000);assert.equal(r.metrics.local_bytes,88000000000);assert.ok(r.outcomes.every(o=>o.local_bytes===22000000000&&o.check_started_ms===null&&o.ready_ms===null));
    const last=r.resources.filter(s=>s.resource==='local'&&s.t_ms===2400000-q)[0];assert.ok(last.eligible.every(e=>e.remaining_bytes-e.grant_bytes===42000000000));
    for(const record of [r,c]){const entries=record.boundaries.length+record.resources.length+record.resources.reduce((s,r)=>s+r.eligible.length,0)+record.tasks.length+record.inventory.length;assert.ok(entries<=DELIVERY_BOUNDS.maxEntries);assert.ok(Buffer.byteLength(canonicalDelivery(record))<=DELIVERY_BOUNDS.maxRecordBytes);}
  }
});

test('rounding accumulation changes a raw inclusive target without changing exogenous semantics',()=>{
  for(const policy of ['repeated','cold'])for(const [q,expected]of [[1000,[1000,98000,147000,208000,238000,0]],[250,[250,96500,144750,205000,235000,1]]]){
    const i=deliveryInput('one',q);Object.assign(i.requests[0],{arrival_ms:100,check_ms:60001,deadline_ms:236000});i.artifact.size_bytes=12000000001;
    const r=run(i,policy),o=r.outcomes[0],wan=r.tasks.find(t=>t.type==='wan_received').t_ms;
    assert.deepEqual([o.arrival_applied_ms,wan,o.local_completed_ms,o.check_completed_ms,o.ready_ms,r.metrics.on_time_count],expected);
  }
});

test('failed modeled check affects only terminal tasks and preserves all allocation work',()=>{
  const i=deliveryInput();i.requests[3].check_outcome='fail';
  for(const [policy,failure,terminal,onTime]of [['cold',348000,378000,3],['repeated',636000,666000,0]]){
    const r=run(i,policy),pass=run(deliveryInput(),policy),v4=r.outcomes[3];assert.equal(v4.failed_ms,failure);assert.equal(v4.ready_ms,null);assert.equal(v4.activation_started_ms,null);assert.equal(r.metrics.all_ready_ms,null);assert.equal(r.metrics.terminal_ms,terminal);assert.equal(r.metrics.on_time_count,onTime);assert.deepEqual(r.resources,pass.resources);assert.notEqual(r.input_digest,pass.input_digest);assert.notEqual(r.record_digest,pass.record_digest);
    assert.deepEqual(r.tasks.filter(t=>t.type==='check_failed').map(t=>[t.request_id,t.t_ms]),[['V4',failure]]);
  }
});

test('source and request raw times gate WAN work, including no cold prefetch',()=>{
  for(const delay of [50000,50100])for(const [policy,ready]of [['cold',428000],['repeated',716000]]){
    const i=deliveryInput();i.artifact.available_at_ms=delay;const r=run(i,policy);assert.equal(r.metrics.all_ready_ms,ready+(delay%1000?1000:0));assert.equal(bytes(r,'wan',Math.ceil(delay/1000)*1000),0);
    const b=r.boundaries.find(x=>x.source_available);assert.equal(b.t_ms,Math.ceil(delay/1000)*1000);
  }
  const i=short({H:5000,deadline:5000});i.requests[0].arrival_ms=3000;const r=run(i,'cold');assert.equal(bytes(r,'wan',3000),0);assert.equal(r.metrics.all_ready_ms,5000);
});

test('H permits zero-duration closure, rejects positive starts and preserves raw deadline edges',()=>{
  for(const policy of ['repeated','cold']){
    const r=run(short(),policy);assert.equal(r.metrics.all_ready_ms,2000);assert.equal(r.metrics.on_time_count,1);assert.equal(run(short({deadline:1999}),policy).metrics.on_time_count,0);
    assert.deepEqual(r.tasks.filter(t=>t.t_ms===2000).map(t=>[t.phase,t.type]),[[1,'local_received'],[3,'check_started'],[3,'check_passed'],[3,'activation_started'],[3,'activation_completed'],[4,'ready']]);
    const blocked=run(short({activation:1}),policy);assert.equal(blocked.outcomes[0].activation_started_ms,null);assert.equal(blocked.outcomes[0].ready_ms,null);
    const checked=run(short({H:3000,check:1}),policy);assert.equal(checked.metrics.all_ready_ms,3000);assert.ok(checked.tasks.some(t=>t.t_ms===3000&&t.phase===3&&t.type==='activation_completed'));
    const fail=short();fail.requests[0].check_outcome='fail';const f=run(fail,policy);assert.equal(f.outcomes[0].failed_ms,2000);assert.equal(f.outcomes[0].ready_ms,null);
  }
});

test('small objects consume separate service intervals; declared caps stay independent of remaining work',()=>{
  for(const policy of ['repeated','cold'])for(const [q,ready]of [[1000,2000],[250,500]]){
    const r=run(short({q,size:1,deadline:1000}),policy);assert.equal(r.metrics.all_ready_ms,ready);assert.equal(r.metrics.on_time_count,q===250?1:0);
    const first=r.resources.find(r=>r.eligible.length);assert.equal(first.eligible[0].remaining_bytes,1);assert.equal(first.eligible[0].cap_bytes,q/250);assert.equal(first.eligible[0].grant_bytes,1);
  }
  const i=short({q:250,size:8,H:2000});const r=run(i);assert.deepEqual(r.resources.filter(s=>s.resource==='wan'&&s.t_ms<1000).map(s=>s.eligible[0].grant_bytes),[1,1,1,1]);
  i.requests[0].arrival_ms=750;const idle=run(i);assert.equal(bytes(idle,'wan',1000),1);
});

test('zero aggregate, zero transfer cap and their tie do not fabricate progress',()=>{
  for(const resource of ['wan','local'])for(const [aggregate,cap]of [[0,4],[4,0],[0,0]])for(const policy of ['repeated','cold']){
    const i=short();i.resources[resource]={aggregate_Bps:aggregate,transfer_cap_Bps:cap};const r=run(i,policy);
    assert.equal(bytes(r,resource),0);assert.equal(r.metrics.all_ready_ms,null);assert.ok(r.outcomes.every(o=>o.ready_ms===null));
    const slots=r.resources.filter(s=>s.resource===resource);assert.ok(slots.every(s=>s.eligible.every(e=>e.grant_bytes===0)));
  }
});

test('residual-heavy primary and refinement stress rotate exact per-slot remainder without carry',()=>{
  for(const [q,n,rate,perRequest,total]of [[1000,3,4,3200,9600],[250,4,12,7200,28800]]){
    const i=deliveryInput('default',q);i.requests=i.requests.slice(0,n);i.artifact.size_bytes=64000000000;i.resources.wan.aggregate_Bps=rate;
    const r=run(i),c=run(i,'cold');assert.deepEqual(r.outcomes.map(o=>o.wan_bytes),Array(n).fill(perRequest));assert.equal(c.metrics.wan_bytes,total);
    for(const record of [r,c]){assert.equal(record.metrics.local_bytes,0);assert.equal(record.metrics.all_ready_ms,null);assert.equal(record.metrics.terminal_ms,2400000);}
    const slots=r.resources.filter(s=>s.resource==='wan'&&s.t_ms<q*4);assert.deepEqual(slots.map(s=>values(s)),q===1000?[[2,1,1],[1,2,1],[1,1,2],[2,1,1]]:[[1,1,1,0],[1,1,0,1],[1,0,1,1],[0,1,1,1]]);
  }
});

test('unknown policy fails before execution and input remains detached from its record',()=>{
  assert.throws(()=>run(deliveryInput(),'preload'),/policy|unsupported/);const i=short(),r=run(i);i.requests[0].id='changed';assert.equal(r.input.requests[0].id,'V1');
});
