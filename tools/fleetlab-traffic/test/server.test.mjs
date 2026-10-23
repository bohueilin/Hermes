import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { startTrafficServer } from '../server.mjs';
const now = Date.parse('2026-09-19T12:00:00Z');
const input={origin:{latitude:37.7749,longitude:-122.4194},destination:{latitude:37.3382,longitude:-121.8863},departureTime:'2026-09-19T13:00:00.000Z',trafficModel:'BEST_GUESS'};
async function server(t,options={}){
  const handle = await startTrafficServer({port:0,apiKey:'',now:()=>now,...options});
  t.after(()=>handle.close());
  return handle;
}
function request(handle,{method='GET',path='/api/status',headers={},body}={}){
  return new Promise((resolve,reject)=>{
    const req=http.request(handle.origin+path,{method,headers},res=>{let text='';res.on('data',c=>text+=c);res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,text}));});
    req.on('error',reject);if(body!==undefined)req.write(body);req.end();
  });
}
const post=(h,extra={})=>request(h,{method:'POST',path:'/api/estimate',headers:{origin:h.origin,'content-type':'application/json'},body:JSON.stringify(input),...extra});
test('binds only loopback and rejects public bind option',async t=>{
  const h=await server(t);assert.equal(h.server.address().address,'127.0.0.1');
  await assert.rejects(startTrafficServer({host:'0.0.0.0',port:0}),/loopback/i);
});
test('unconfigured status and assets never expose key or server files; no cache',async t=>{
  const h=await server(t,{apiKey:'TEST_SECRET'});
  for(const path of ['/','/app.js','/styles.css','/api/status','/privacy','/terms','/google-maps-logo.svg']) {
    const r=await request(h,{path});assert.equal(r.status,200);assert.ok(!r.text.includes('TEST_SECRET'));assert.match(r.headers['cache-control'],/no-store/);
    assert.match(r.headers['content-security-policy'],/connect-src 'self'/);
  }
  assert.equal(JSON.parse((await request(h)).text).state,'configured');
  for(const path of ['/server.mjs','/../google-routes.mjs','/?key=oops'])assert.equal((await request(h,{path})).status,404);
  const blank=await server(t);assert.equal(JSON.parse((await request(blank)).text).state,'unconfigured');assert.equal((await post(blank)).status,503);
});
test('rejects rebinding hosts, cross origins, missing origin and unsupported methods before request',async t=>{
  const h=await server(t,{apiKey:'mock',fetchImpl:()=>assert.fail('network')});
  assert.equal((await request(h,{headers:{host:'evil.test'}})).status,403);
  assert.equal((await request(h,{headers:{host:'127.0.0.1:9'}})).status,403);
  for(const origin of ['http://evil.test','null','http://127.0.0.1:9',undefined])assert.equal((await post(h,{headers:{...(origin?{origin}:{}),'content-type':'application/json'}})).status,403);
  assert.equal((await post(h,{method:'PUT'})).status,405);
  assert.equal((await post(h,{headers:{origin:h.origin,'content-type':'text/plain'}})).status,415);
});
test('request body byte cap and invalid JSON/fields prevent provider calls',async t=>{
  const h=await server(t,{apiKey:'mock',fetchImpl:()=>assert.fail('network')});
  assert.equal((await post(h,{body:'x'.repeat(4097)})).status,413);
  assert.equal((await post(h,{body:'{'})).status,400);
  assert.equal((await post(h,{body:JSON.stringify({...input,endpoint:'https://evil.test'})})).status,400);
});
test('limits one concurrent request, six requests per minute and thirty per server session',async t=>{
  let clock=now;let release;let calls=0;
  const payload=()=>new Response(JSON.stringify({routes:[{duration:'1200s',staticDuration:'1000s',distanceMeters:10000}]}));
  const h=await server(t,{apiKey:'mock',now:()=>clock,fetchImpl:async()=>{calls++;if(calls===1)await new Promise(resolve=>release=resolve);return payload();}});
  const first=post(h);while(!release)await new Promise(resolve=>setImmediate(resolve));
  assert.equal((await post(h)).status,429);release();assert.equal((await first).status,200);
  for(let i=1;i<6;i++)assert.equal((await post(h)).status,200);
  assert.equal((await post(h)).status,429);assert.equal(calls,6);
  for(let batch=0;batch<4;batch++){clock+=60001;for(let i=0;i<6;i++)assert.equal((await post(h)).status,200);}
  clock+=60001;assert.equal((await post(h)).status,429);assert.equal(calls,30);
});
test('server hides all provider diagnostic content',async t=>{
  const h=await server(t,{apiKey:'TEST_SECRET',fetchImpl:async()=>new Response('TEST_SECRET',{status:403})});
  const r=await post(h);assert.equal(r.status,502);assert.ok(!r.text.includes('TEST_SECRET'));assert.equal(JSON.parse(r.text).state,'error');
});
