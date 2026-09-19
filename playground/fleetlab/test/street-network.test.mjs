import test from 'node:test';
import assert from 'node:assert/strict';
import * as streets from '../src/model/street-network.js';

const fixture = () => ({
  nodes: ['a','b','c','d','z'].map(id => ({id})),
  edges: [['ab','a','b',1],['bc','b','c',1],['bd','b','d',2],['dc','d','c',2],['cb','c','b',1]].map(([id,from,to,length_m])=>({id,from,to,length_m,speed_kph:3.6})),
  restrictions: [{id:'turn',from:'ab',via:'b',to:'bc',kind:'no'}],
});

test('router respects imported direction, a prohibited turn and incoming-edge context',()=>{
  assert.equal(typeof streets.createStreetRouter,'function');
  const route = streets.createStreetRouter(fixture());
  assert.deepEqual(route('a','c').edge_ids,['ab','bd','dc']);
  assert.deepEqual(route('b','c').edge_ids,['bc']);
  assert.deepEqual(route('b','c',{viaEdge:'ab'}).edge_ids,['bd','dc']);
  assert.equal(route('b','a').available,false);
  assert.equal(route('a','b',{viaEdge:'bc'}).available,false);
});

test('only-turn restrictions, closures and nonnegative custom weights preserve routing semantics',()=>{
  const network=fixture(); network.restrictions=[{id:'only',from:'ab',via:'b',to:'bd',kind:'only'}];
  const route=streets.createStreetRouter(network);
  assert.deepEqual(route('a','c').edge_ids,['ab','bd','dc']);
  assert.equal(route('a','c',{blockedEdges:new Set(['bd'])}).available,false);
  assert.deepEqual(route('a','c',{edgeCost:e=>e.id==='dc'?0:e.length_m}).edge_ids,['ab','bd','dc']);
  assert.throws(()=>route('a','c',{edgeCost:()=>-1}),/cost/i);
  assert.throws(()=>route('a','c',{edgeCost:()=>NaN}),/cost/i);
});

test('missing endpoints and unreachable targets are unavailable, valid identity is zero',()=>{
  const route=streets.createStreetRouter(fixture());
  const missing={available:false,edge_ids:[],distance_m:null,free_seconds:null};
  assert.deepEqual(route('a','z'),missing);
  assert.deepEqual(route('missing','missing'),missing);
  assert.deepEqual(route(null,'a'),missing);
  assert.deepEqual(route('a','a'),{available:true,edge_ids:[],distance_m:0,free_seconds:0});
});

test('deterministic cost ties survive edge input order and zero-cost cycles',()=>{
  const data=fixture(); data.restrictions=[];
  const first=streets.createStreetRouter(data),second=streets.createStreetRouter({...data,edges:[...data.edges].reverse()});
  assert.deepEqual(first('a','c',{edgeCost:()=>0}),second('a','c',{edgeCost:()=>0}));
  assert.equal(first('a','z',{edgeCost:()=>0}).available,false);
});

const n=streets.STREET_NETWORK;
const edgeById=new Map(n.edges.map(e=>[e.id,e]));
const wayById=new Map(n.metadata.ways.map(w=>[w.id,w]));
const nodeById=new Map(n.nodes.map(node=>[node.id,node]));
function checkRoute(path,start,end,initial){
  let node=start,incoming=initial;
  for(const id of path){
    const edge=edgeById.get(id);assert.ok(edge,`edge ${id} exists`);
    assert.equal(edge.from,node,'geographic continuity uses shared OSM node identity');
    const turns=n.restrictions.filter(r=>r.from===incoming);
    assert.ok(!turns.some(r=>r.kind==='no'&&r.to===id));
    const only=turns.filter(r=>r.kind==='only');
    assert.ok(!only.length||only.some(r=>r.to===id));
    node=edge.to;incoming=id;
  }
  assert.equal(node,end);
}

test('all required anchors are distinct and every ordered pair follows legal modeled directed turns',()=>{
  for(const id of ['fidi','soma','chinatown','van-ness','waterfront','lombard','sfo','east-bay'])assert.ok(n.anchors.some(a=>a.id===id));
  assert.equal(new Set(n.anchors.map(a=>a.node)).size,n.anchors.length);
  for(const from of n.anchors)for(const to of n.anchors){
    const r=streets.findStreetRoute(from.node,to.node);
    assert.equal(r.available,true,`${from.id} → ${to.id}`);
    checkRoute(r.edge_ids,from.node,to.node);
    assert.equal(r.distance_m,r.edge_ids.reduce((sum,id)=>sum+edgeById.get(id).length_m,0));
    assert.equal(r.free_seconds,r.edge_ids.reduce((sum,id)=>{const e=edgeById.get(id);return sum+e.length_m/(e.speed_kph/3.6);},0));
  }
});

test('every geometry is bounded, endpoint-accurate and retains sourced or explicitly modeled values',()=>{
  for(const edge of n.edges){
    const a=nodeById.get(edge.from),b=nodeById.get(edge.to);
    assert.deepEqual(edge.points[0],[a.x,a.y]);assert.deepEqual(edge.points.at(-1),[b.x,b.y]);
    assert.ok(edge.length_m>0&&edge.speed_kph>0&&edge.lanes>=1);
    assert.match(edge.speed_source,/^(osm|modeled):/);assert.match(edge.lanes_source,/^(osm|modeled):/);
    const direct=Math.hypot(a.x-b.x,a.y-b.y)*1000;
    assert.ok(edge.length_m>=direct-0.2);
    for(const p of edge.points)assert.ok(p.every(Number.isFinite));
    const tags=wayById.get(edge.way_id).tags;
    const one=tags['oneway:motorcar']??tags['oneway:motor_vehicle']??tags.oneway;
    if(['yes','1','true'].includes(one))assert.equal(edge.direction,1);
    if(['-1','reverse'].includes(one))assert.equal(edge.direction,-1);
    if(one===undefined&&tags.highway==='motorway')assert.equal(edge.direction,1);
    assert.notEqual(edge.name,'Market Street','conservative SF Market scope is explicit');
  }
});

test('all six local hotspots have real multi-block samples and correctly scoped street groups',()=>{
  assert.deepEqual(n.hotspots.map(h=>h.id),['first','harrison','stockton','van-ness','embarcadero','lombard']);
  for(const h of n.hotspots){
    assert.ok(h.edge_ids.length>0);assert.ok(h.sample_route.length>=3);
    for(const id of h.sample_route)assert.ok(h.edge_ids.includes(id));
    const first=edgeById.get(h.sample_route[0]),last=edgeById.get(h.sample_route.at(-1));
    checkRoute(h.sample_route,first.from,last.to);
    assert.ok(h.sample_route.reduce((sum,id)=>sum+edgeById.get(id).length_m,0)>500);
    for(const id of h.edge_ids){const e=edgeById.get(id),node=nodeById.get(e.from);assert.equal(e.hotspot,h.id);assert.ok(node.lon>-122.43&&node.lon<-122.385&&node.lat>37.774&&node.lat<37.805);}
  }
  assert.ok(n.hotspots.find(h=>h.id==='stockton').edge_ids.some(id=>edgeById.get(id).name==='Stockton Tunnel'));
  assert.ok(n.hotspots.find(h=>h.id==='lombard').edge_ids.some(id=>edgeById.get(id).points.length>10),'crooked Lombard geometry retained');
});

test('SFO and East Bay routes use distinct real freeways and boundary handoffs',()=>{
  const anchor=id=>n.anchors.find(a=>a.id===id);
  const refs=id=>streets.findStreetRoute(anchor('fidi').node,anchor(id).node).edge_ids.map(id=>wayById.get(edgeById.get(id).way_id).tags.ref);
  assert.ok(refs('sfo').includes('US 101'));assert.ok(refs('east-bay').includes('I 80'));
  assert.ok(n.metadata.ways.some(w=>w.tags.ref==='I 280'));
  assert.match(anchor('sfo').kind,/handoff/);assert.match(anchor('east-bay').kind,/gateway/);
  assert.match(n.metadata.turn_scope,/not implemented/);
  assert.ok(n.metadata.unsupported_restrictions.via_way_or_missing_via.length>0);
  assert.ok(n.metadata.unsupported_restrictions.conditional_or_unsupported_kind.length>0);
});

test('blocking a selected downtown edge yields a continuous alternative or explicit unavailable',()=>{
  const from=n.anchors.find(a=>a.id==='fidi').node,to=n.anchors.find(a=>a.id==='soma').node;
  const base=streets.findStreetRoute(from,to);
  let found=false;
  for(const blocked of base.edge_ids){
    const alt=streets.findStreetRoute(from,to,{blockedEdges:new Set([blocked])});
    if(alt.available){assert.ok(!alt.edge_ids.includes(blocked));checkRoute(alt.edge_ids,from,to);found=true;break;}
  }
  assert.equal(found,true,'useful local alternative retained');
  const none=streets.findStreetRoute(from,to,{blockedEdges:new Set(n.edges.filter(e=>e.from===from).map(e=>e.id))});
  assert.deepEqual(none,{available:false,edge_ids:[],distance_m:null,free_seconds:null});
});

test('real no-turn and only-turn relations are obeyed when routing starts with incoming context',()=>{
  assert.ok(n.restrictions.some(r=>r.kind==='no'));
  assert.ok(n.restrictions.some(r=>r.kind==='only'));
  for(const rule of n.restrictions){
    const target=edgeById.get(rule.to);
    if(!target)continue;
    const result=streets.findStreetRoute(rule.via,target.to,{viaEdge:rule.from});
    if(result.available)checkRoute(result.edge_ids,rule.via,target.to,rule.from);
    if(rule.kind==='no'&&result.available)assert.notEqual(result.edge_ids[0],rule.to);
  }
});

test('attributed full derived download is immutable and contains source identities and fallback provenance',()=>{
  assert.equal(streets.streetMapDownload(),n);
  assert.equal(streets.STREET_MAP_DATA,n);
  assert.equal(Object.isFrozen(n),true);assert.equal(Object.isFrozen(n.edges[0].points),true);
  assert.match(n.metadata.attribution,/OpenStreetMap contributors/);
  assert.equal(n.metadata.license,'ODbL-1.0');
  assert.ok(n.metadata.source_sha256.downtown.length===64);
  assert.ok(n.metadata.ways.every(w=>w.id&&w.tags.highway));
  const decoded=JSON.parse(JSON.stringify(streets.streetMapDownload()));
  assert.equal(decoded.edges.length,n.edges.length);assert.equal(decoded.restrictions.length,n.restrictions.length);
});
