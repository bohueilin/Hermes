import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const script=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
function harness(state='configured') {
  const nodes=new Map();const calls=[];const windowEvents={};
  function node(id){if(!nodes.has(id))nodes.set(id,{textContent:'',hidden:id==='result',disabled:false,value:'',handlers:{},addEventListener(type,fn){this.handlers[type]=fn;}});return nodes.get(id);}
  const form=node('estimate-form');form.elements={departure:{}};form.reportValidity=()=>true;
  const document={querySelector:selector=>node(selector.slice(1)),getElementById:node};
  const window={addEventListener:(type,fn)=>windowEvents[type]=fn};
  let responder=async()=>({ok:true,json:async()=>({state})});
  vm.runInNewContext(script,{document,window,Date,Intl,Number,AbortController,FormData:class{get(name){return ({originLatitude:'37',originLongitude:'-122',destinationLatitude:'38',destinationLongitude:'-121',departure:new Date(Date.now()+3600000).toISOString(),trafficModel:'BEST_GUESS'})[name];}},fetch:async(...args)=>{calls.push(args);return responder(...args);}});
  return {node,calls,windowEvents,respond:fn=>responder=fn,settle:()=>new Promise(resolve=>setImmediate(resolve))};
}
test('browser only checks local status on load; unconfigured cannot submit',async()=>{
  const h=harness('unconfigured');await h.settle();assert.deepEqual(h.calls.map(c=>c[0]),['/api/status']);assert.equal(h.node('submit').disabled,true);
  await h.node('estimate-form').handlers.submit({preventDefault(){}});assert.equal(h.calls.length,1);assert.match(h.node('status').textContent,/Unconfigured/);
});
test('explicit submit sends one same-origin request and writes untrusted values as text',async()=>{
  const h=harness();await h.settle();assert.equal(h.node('submit').disabled,false);let release;
  h.respond(async()=>{await new Promise(resolve=>release=resolve);return {ok:true,json:async()=>({state:'connected',origin:{latitude:37,longitude:-122},destination:{latitude:38,longitude:-121},durationSeconds:1200,staticDurationSeconds:1000,distanceMeters:5000,duration:'1200s',staticDuration:'1000s',departureTime:new Date().toISOString(),trafficModel:'<script>unsafe</script>',fetchedAt:'time'})};});
  const submit=()=>h.node('estimate-form').handlers.submit({preventDefault(){}});
  const active=submit();await h.settle();assert.equal(h.node('inputs').disabled,true);await submit();assert.equal(h.calls.length,2);release();await active;
  assert.equal(h.calls[1][0],'/api/estimate');assert.equal(h.calls[1][1].method,'POST');assert.ok(!h.calls[1][1].body.includes('key'));assert.equal(h.node('result').hidden,false);assert.match(h.node('estimate-context').textContent,/<script>unsafe<\/script>/);assert.equal(h.node('estimate-context').innerHTML,undefined);
  h.node('estimate-form').handlers.input();assert.equal(h.node('result').hidden,true);assert.equal(h.node('exact-values').textContent,'');
  h.windowEvents.pagehide();assert.equal(h.node('result').hidden,true);
});
test('failed estimate clears prior data and never retries',async()=>{
  const h=harness();await h.settle();h.node('result').hidden=false;h.node('exact-values').textContent='old';h.respond(async()=>{throw Error('failure');});
  await h.node('estimate-form').handlers.submit({preventDefault(){}});
  assert.equal(h.node('result').hidden,true);assert.equal(h.node('exact-values').textContent,'');assert.equal(h.calls.length,2);assert.match(h.node('status').textContent,/Error/);assert.equal(h.node('submit').disabled,false);
});
