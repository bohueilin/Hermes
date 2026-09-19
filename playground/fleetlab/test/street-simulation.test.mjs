import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultStreetConfig,simulateStreets,compareStreetPolicies} from '../src/model/street-simulation.js';
const nodes=[{id:'a',x:0,y:0},{id:'b',x:1,y:0},{id:'c',x:1,y:1},{id:'d',x:0,y:1}];
const edges=[];for(const [from,to] of [['a','b'],['b','a'],['b','c'],['c','b'],['c','d'],['d','c'],['d','a'],['a','d']]){const a=nodes.find(n=>n.id===from),b=nodes.find(n=>n.id===to);edges.push({id:from+to,from,to,name:from+to,length_m:1000,speed_kph:60,lanes:1,points:[[a.x,a.y],[b.x,b.y]],hotspot:from==='a'?'first':null});}
const anchors=[['fidi','a'],['soma','b'],['chinatown','c'],['sfo','d'],['east-bay','c']].map(([id,node])=>({id,node,label:id,...nodes.find(n=>n.id===node),id}));
const network={version:'test',nodes,edges,anchors,restrictions:[],hotspots:[{id:'first',label:'First',edge_ids:['ab'],sample_route:['ab','bc'],x:0,y:0}]};
const config=()=>({...defaultStreetConfig(),duration_minutes:30,fleet_size:4,requests_per_hour:24,background_per_hour:60,boarding_seconds:30,turnaround_minutes:1});

test('identical seed reproduces demand, trajectories and outcomes',()=>{
 const a=simulateStreets(config(),network),b=simulateStreets(config(),network);
 assert.deepEqual(a,b);assert.ok(a.requests.length>0);assert.ok(a.summary.completed>0);
});
test('every request remains visible at the horizon and every AV has one recorded state',()=>{
 const r=simulateStreets({...config(),fleet_size:1,requests_per_hour:120},network);
 const s=r.summary;assert.equal(s.requests,s.completed+s.expired+s.waiting+s.in_progress+s.unroutable);
 for(const f of r.frames){assert.equal(f.vehicles.length,1);const q=f.traffic;assert.equal(q.submitted,q.completed+q.on_road+q.pending);}
 assert.ok(s.waiting+s.in_progress>0);assert.equal(r.frames.at(-1).time,1800);
});
test('paired policies share exact exogenous requests and background traffic',()=>{
 const c=compareStreetPolicies(config(),network);
 assert.deepEqual(c.baseline.demand,c.candidate.demand);assert.deepEqual(c.baseline.incident,c.candidate.incident);
 assert.equal(c.baseline.config.policy,'free-flow');assert.equal(c.candidate.config.policy,'queue-aware');
 assert.equal(c.delta.completed,c.candidate.summary.completed-c.baseline.summary.completed);
});
test('zero requests has unavailable wait and travel means, never zero as success',()=>{
 const r=simulateStreets({...config(),requests_per_hour:0,background_per_hour:0},network);
 assert.equal(r.summary.requests,0);assert.equal(r.summary.mean_pickup_minutes,null);assert.equal(r.summary.mean_trip_minutes,null);
 assert.equal(r.summary.empty_km,0);assert.ok(r.frames.every(f=>f.vehicles.every(v=>v.state==='available')));
});
test('disconnected destinations are reported without invented routes',()=>{
 const n={...network,edges:[],hotspots:[{id:'first',label:'First',edge_ids:[],sample_route:[]}]};
 const r=simulateStreets({...config(),sfo_share_pct:100,east_bay_share_pct:0},n);assert.equal(r.summary.completed,0);assert.equal(r.summary.unroutable,r.summary.requests);
 assert.equal(Object.keys(r.routes).length,0);
});
test('invalid configuration is rejected before simulation',()=>{
 for(const patch of [{fleet_size:0},{requests_per_hour:NaN},{capacity_loss_pct:101},{policy:'magic'},{sfo_share_pct:90,east_bay_share_pct:90}])assert.throws(()=>simulateStreets({...config(),...patch},network),/Invalid/);
});
test('changing rider demand or extending the horizon preserves background arrival prefixes',()=>{
 const a=simulateStreets(config(),network),b=simulateStreets({...config(),requests_per_hour:48},network),long=simulateStreets({...config(),duration_minutes:60},network);
 assert.deepEqual(a.demand.background,b.demand.background);
 assert.deepEqual(a.demand.background,long.demand.background.filter(x=>x.time<1800));
 assert.deepEqual(a.demand.requests,long.demand.requests.filter(x=>x.time<1800));
});
test('busy vehicle minutes integrate only the elapsed intervals, not the final instantaneous state',()=>{
 const r=simulateStreets(config(),network);
 const fromRecordedIntervals=r.frames.slice(0,-1).reduce((sum,f)=>sum+f.vehicles.filter(v=>v.state!=='available').length*5/60,0);
 assert.ok(Math.abs(r.summary.busy_vehicle_minutes-fromRecordedIntervals)<1e-8);
});
