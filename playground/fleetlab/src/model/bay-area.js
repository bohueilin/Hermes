/** Frozen OSM geometry for local teaching simulations; never a navigation router. */
import {BAY_AREA_DATA as DATA} from '../data/bay-area-map.js';

const RADIUS_KM=6371.0088;
const DEG=Math.PI/180;
export function projectBayArea(lon,lat) {
  if(!Number.isFinite(lon)||!Number.isFinite(lat)||lon < -180||lon > 180||lat < -90||lat > 90) throw new RangeError('Longitude and latitude must be finite geographic coordinates.');
  return {x:(lon+122.55)*DEG*RADIUS_KM*Math.cos(37.55*DEG),y:(lat-37.25)*DEG*RADIUS_KM};
}
function freeze(value) {
  if(value&&typeof value==='object') {Object.values(value).forEach(freeze);Object.freeze(value);}
  return value;
}
const nodeById=new Map(DATA.nodes.map(([id,lon,lat])=>[id,{id,lon,lat,...projectBayArea(lon,lat)}]));
const points=DATA.nodes.map(([id])=>{const p=nodeById.get(id);return [p.x,p.y];});
export const BAY_AREA_PLACES=freeze(DATA.places.map(({anchor_node,...place})=>{
  const projected=projectBayArea(place.lon,place.lat),node=nodeById.get(anchor_node);
  return {...place,...projected,road_anchor:{x:node.x,y:node.y,lon:node.lon,lat:node.lat,node_id:node.id,distance_km:Math.hypot(projected.x-node.x,projected.y-node.y)}};
}));
const placesById=new Map(BAY_AREA_PLACES.map((p,i)=>[p.id,{place:p,index:i}]));
const roads=DATA.roads.map(([osmIds,name,kind,indexes],i)=>({id:`osm-way-${osmIds[0]}-segment-${i}`,name,kind,source:`https://www.openstreetmap.org/way/${osmIds[0]}`,sources:osmIds.map(id=>`https://www.openstreetmap.org/way/${id}`),points:indexes.map(index=>points[index])}));
const northeast=projectBayArea(DATA.bounds.east,DATA.bounds.north);
export const BAY_AREA_MAP=freeze({source:DATA.source,attribution:DATA.attribution,license:DATA.license,retrieved:DATA.retrieved,
  bounds:{...DATA.bounds,min_x:0,min_y:0,max_x:northeast.x,max_y:northeast.y},roads,
  coastlines:DATA.coastlines.map(line=>line.map(([lon,lat])=>{const p=projectBayArea(lon,lat);return [p.x,p.y];})),
  limitations:['Sparse major-road corpus connecting 18 representative anchors; not complete municipal street coverage.',
    'Sourced coastline fragments, with no inferred water polygons, terrain elevation or municipal boundaries.']});
const routeIndex=new Map(DATA.paths.map(([a,b,segments])=>[`${a}:${b}`,segments]));
const routeCache=new Map();
const limitations=[
  'Undirected teaching paths ignore one-way, turn, access and vehicle restrictions. Not valid navigation or airport pickup permission.',
  'Routes start and end at connected major-road anchors; access from the representative city or airport coordinate is not modeled.',
  'Shortest geometric paths through a sparse fetched major-road graph; eight-meter simplification tolerance. Distance sums this simplified local kilometer-plane geometry.',
  'Frozen OpenStreetMap geometry only: no real travel time, live traffic, commercial service coverage or safety evidence.',
];

export function bayAreaPlace(id) {return placesById.get(id)?.place??null;}
export function bayAreaRoute(fromId,toId) {
  const from=placesById.get(fromId),to=placesById.get(toId);
  const base={id:`bay-area:${fromId}->${toId}`,from:fromId,to:toId,source:DATA.source,limitations:[...limitations]};
  if(!from||!to) return {...base,distance_km:null,points:[],available:false,limitations:[...limitations,'Unknown anchor: no route geometry is available.']};
  if(fromId===toId) return {...base,distance_km:0,points:[[from.place.road_anchor.x,from.place.road_anchor.y]],available:true};
  const a=Math.min(from.index,to.index),b=Math.max(from.index,to.index),key=`${a}:${b}`;
  const segments=routeIndex.get(key);
  if(!segments) return {...base,distance_km:null,points:[],available:false,limitations:[...limitations,'Disconnected anchor pair: no synthetic bridge has been substituted.']};
  if(!routeCache.has(key)) {
    const routePoints=[];
    for(const segment of segments) {
      const line=roads[Math.abs(segment)-1].points;
      const oriented=segment>0?line:[...line].reverse();
      if(routePoints.length) {
        const end=routePoints.at(-1),start=oriented[0];
        if(end[0]!==start[0]||end[1]!==start[1]) throw new Error('Frozen road corpus contains a disconnected segment.');
      }
      routePoints.push(...oriented.slice(routePoints.length?1:0));
    }
    let distance=0;
    for(let i=1;i<routePoints.length;i++) distance+=Math.hypot(routePoints[i][0]-routePoints[i-1][0],routePoints[i][1]-routePoints[i-1][1]);
    routeCache.set(key,{points:routePoints,distance_km:distance});
  }
  const route=routeCache.get(key),oriented=from.index===a?route.points:[...route.points].reverse();
  return {...base,distance_km:route.distance_km,points:oriented.map(p=>[...p]),available:true};
}

/** Offer the complete compact derived database in both the offline and static UI. */
export function bayAreaSourceJSON() {return JSON.stringify(DATA);}
