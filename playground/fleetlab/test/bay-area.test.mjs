import test from 'node:test';
import assert from 'node:assert/strict';
import * as map from '../src/model/bay-area.js';
const ids=['san-francisco','sfo','daly-city','colma','broadmoor','brisbane','south-san-francisco','san-bruno','millbrae','burlingame','san-mateo','menlo-park','palo-alto','los-altos','mountain-view','sunnyvale','san-jose','sjc'];

test('all18 requested places have distinct sourced coordinates inside the extract',()=>{
  assert.ok(Array.isArray(map.BAY_AREA_PLACES));
  assert.equal(map.BAY_AREA_PLACES.length,18);
  assert.deepEqual(new Set(map.BAY_AREA_PLACES.map(p=>p.id)),new Set(ids));
  assert.equal(new Set(map.BAY_AREA_PLACES.map(p=>`${p.lon},${p.lat}`)).size,18);
  for(const p of map.BAY_AREA_PLACES){
    assert.ok(p.lat>=37.25&&p.lat<=37.84&&p.lon>=-122.55&&p.lon<=-121.8);
    assert.match(p.source,/openstreetmap.org\/(node|way|relation)\//);
    assert.deepEqual({x:p.x,y:p.y},map.projectBayArea(p.lon,p.lat));
    assert.ok(p.road_anchor.distance_km>=0&&p.road_anchor.distance_km<3);
  }
});
test('geographic projection preserves known SF/San Jose separation and north/east order',()=>{
  const sf=map.BAY_AREA_PLACES.find(p=>p.id==='san-francisco'),sj=map.BAY_AREA_PLACES.find(p=>p.id==='san-jose');
  assert.ok(sf.y>sj.y&&sf.x<sj.x);
  const distance=Math.hypot(sf.x-sj.x,sf.y-sj.y);
  assert.ok(distance>65&&distance<75);
  assert.deepEqual(map.projectBayArea(-122.55,37.25),{x:0,y:0});
});
test('all distinct anchor pairs have nonzero continuous road routes, never missing-as-zero',()=>{
  const roadEdges=new Set();
  const pointKey=p=>p.join(',');
  for(const road of map.BAY_AREA_MAP.roads) for(let i=1;i<road.points.length;i++){
    roadEdges.add(`${pointKey(road.points[i-1])}|${pointKey(road.points[i])}`);
    roadEdges.add(`${pointKey(road.points[i])}|${pointKey(road.points[i-1])}`);
  }
  for(const from of map.BAY_AREA_PLACES)for(const to of map.BAY_AREA_PLACES){
    const r=map.bayAreaRoute(from.id,to.id);
    assert.equal(r.available,true);
    assert.deepEqual(r.points[0],[from.road_anchor.x,from.road_anchor.y]);
    assert.deepEqual(r.points.at(-1),[to.road_anchor.x,to.road_anchor.y]);
    if(from.id===to.id){assert.equal(r.distance_km,0);assert.equal(r.points.length,1);continue;}
    assert.ok(r.distance_km>0);
    const displacement=Math.hypot(r.points.at(-1)[0]-r.points[0][0],r.points.at(-1)[1]-r.points[0][1]);
    assert.ok(r.distance_km+1e-8>=displacement);
    let sum=0;
    for(let i=1;i<r.points.length;i++){
      assert.ok(roadEdges.has(`${pointKey(r.points[i-1])}|${pointKey(r.points[i])}`),'route segment must exist in the fetched road geometry');
      sum+=Math.hypot(r.points[i][0]-r.points[i-1][0],r.points[i][1]-r.points[i-1][1]);
    }
    assert.ok(Math.abs(sum-r.distance_km)<1e-7);
  }
});
test('teaching routes explicitly ignore direction restrictions and reverse exactly',()=>{
  const a=map.bayAreaRoute('san-francisco','sjc'),b=map.bayAreaRoute('sjc','san-francisco');
  assert.deepEqual(a.points,[...b.points].reverse());
  assert.equal(a.distance_km,b.distance_km);
  assert.match(a.limitations.join(' '),/one-way/);
  assert.match(a.source,/OpenStreetMap/);
});
test('unknown places return unavailable and nullable distance without fabricating geometry',()=>{
  const r=map.bayAreaRoute('missing','sfo');
  assert.equal(r.available,false);assert.equal(r.distance_km,null);assert.deepEqual(r.points,[]);
});
test('offline calls are deterministic and caller mutation cannot change route data',()=>{
  const a=map.bayAreaRoute('sfo','sunnyvale'),copy=structuredClone(a);
  a.points[0][0]=999;
  assert.deepEqual(map.bayAreaRoute('sfo','sunnyvale'),copy);
});
test('map includes fetched roads and coastline with attribution and explicit license',()=>{
  assert.ok(map.BAY_AREA_MAP.roads.length>20);
  assert.ok(map.BAY_AREA_MAP.coastlines.length>0);
  assert.match(map.BAY_AREA_MAP.attribution,/OpenStreetMap contributors/);
  assert.match(map.BAY_AREA_MAP.license,/ODbL/);
  for(const road of map.BAY_AREA_MAP.roads){assert.ok(road.points.length>=2);assert.ok(road.points.every(p=>p.length===2&&p.every(Number.isFinite)));}
});

test('the downloadable OSM database preserves source coordinates, routes and license',async()=>{
 const {bayAreaSourceJSON}=await import('../src/model/bay-area.js');const data=JSON.parse(bayAreaSourceJSON());
 assert.equal(data.places.length,18);assert.ok(data.nodes.length>0);assert.ok(data.paths.length>0);assert.match(data.license,/ODbL/);assert.match(data.attribution,/OpenStreetMap/);
 const copy=JSON.parse(bayAreaSourceJSON());copy.places.length=0;assert.equal(JSON.parse(bayAreaSourceJSON()).places.length,18);
});
