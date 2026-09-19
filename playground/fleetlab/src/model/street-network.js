/** Deterministic directed routing with incoming-edge state for imported turn restrictions. */
const unavailable = () => ({available:false,edge_ids:[],distance_m:null,free_seconds:null});
const freeSeconds = edge => edge.length_m / (edge.speed_kph / 3.6);
const compare = (a,b) => a.cost-b.cost || (a.key<b.key?-1:a.key>b.key?1:0);

function push(queue, value) {
  queue.push(value); let i=queue.length-1;
  while(i>0){ const p=(i-1)>>1; if(compare(queue[p],value)<=0)break; queue[i]=queue[p];i=p; }
  queue[i]=value;
}
function pop(queue) {
  const first=queue[0],last=queue.pop();
  if(queue.length){let i=0;while(true){let j=i*2+1;if(j>=queue.length)break;if(j+1<queue.length&&compare(queue[j+1],queue[j])<0)j++;if(compare(last,queue[j])<=0)break;queue[i]=queue[j];i=j;}queue[i]=last;}
  return first;
}

export function createStreetRouter(network) {
  const nodes=new Set(network.nodes.map(n=>n.id));
  const edges=new Map(network.edges.map(e=>[e.id,e]));
  const outgoing=new Map(),turns=new Map();
  for(const e of network.edges){
    if(!nodes.has(e.from)||!nodes.has(e.to)||!Number.isFinite(e.length_m)||e.length_m<=0||!Number.isFinite(e.speed_kph)||e.speed_kph<=0)throw new Error('Invalid street edge');
    if(!outgoing.has(e.from))outgoing.set(e.from,[]);outgoing.get(e.from).push(e);
  }
  for(const list of outgoing.values())list.sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
  for(const rule of network.restrictions||[]){
    if(!turns.has(rule.from))turns.set(rule.from,{no:new Set(),only:new Set()});
    const from=edges.get(rule.from),to=edges.get(rule.to);
    // A retained only restriction may point to a pruned edge: retain its rule and fail closed.
    if(!from||from.to!==rule.via||(to&&to.from!==rule.via)||!['no','only'].includes(rule.kind))throw new Error('Invalid street turn restriction');
    turns.get(rule.from)[rule.kind].add(rule.to);
  }
  return function route(fromNode,toNode,{edgeCost=freeSeconds,blockedEdges=new Set(),viaEdge}={}) {
    if(!nodes.has(fromNode)||!nodes.has(toNode))return unavailable();
    if(viaEdge!==undefined&&(!edges.has(viaEdge)||edges.get(viaEdge).to!==fromNode))return unavailable();
    if(fromNode===toNode)return {available:true,edge_ids:[],distance_m:0,free_seconds:0};
    const start=viaEdge===undefined?'':viaEdge;
    const costs=new Map([[start,0]]),previous=new Map(),queue=[];
    push(queue,{key:start,node:fromNode,cost:0});
    let final;
    while(queue.length){
      const current=pop(queue);
      if(current.cost!==costs.get(current.key))continue;
      if(current.node===toNode){final=current.key;break;}
      const turn=turns.get(current.key);
      for(const edge of outgoing.get(current.node)||[]){
        if(blockedEdges.has(edge.id)||turn?.no.has(edge.id)||(turn?.only.size&&!turn.only.has(edge.id)))continue;
        const weight=edgeCost(edge);
        if(!Number.isFinite(weight)||weight<0)throw new RangeError('Street edge cost must be finite and nonnegative');
        const cost=current.cost+weight;
        if(cost<(costs.get(edge.id)??Infinity)){
          costs.set(edge.id,cost);previous.set(edge.id,current.key);push(queue,{key:edge.id,node:edge.to,cost});
        }
      }
    }
    if(final===undefined)return unavailable();
    const ids=[];for(let key=final;key!==start;key=previous.get(key)){ids.push(key);}
    ids.reverse();
    return {available:true,edge_ids:ids,distance_m:ids.reduce((sum,id)=>sum+edges.get(id).length_m,0),free_seconds:ids.reduce((sum,id)=>sum+freeSeconds(edges.get(id)),0)};
  };
}

import { SF_STREETS_DATA } from '../data/sf-streets.js';

function deepFreeze(value) {
  if(value&&typeof value==='object'&&!Object.isFrozen(value)){
    for(const child of Object.values(value))deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

function expandStreetData(data) {
  const projection=data.metadata.projection;
  const project=(lon,lat)=>[
    (lon-projection.origin_lon)*Math.PI/180*projection.earth_radius_km*Math.cos(projection.cosine_lat*Math.PI/180),
    (lat-projection.origin_lat)*Math.PI/180*projection.earth_radius_km,
  ].map(v=>Math.round(v*10000)/10000);
  const nodes=data.nodes.map(([id,lon,lat])=>{const [x,y]=project(lon,lat);return {id:String(id),x,y,lon,lat};});
  const nodeById=new Map(nodes.map(n=>[n.id,n]));
  const ways=data.ways.map(([id,name,tags])=>({id,name:data.names[name],tags:Object.fromEntries(tags.map(([key,value])=>[data.tag_keys[key],value]))}));
  const segments=data.segments.map(([from,to,way,middle,length_m])=>({from:nodes[from],to:nodes[to],way:ways[way],points:[[nodes[from].x,nodes[from].y],...middle,[nodes[to].x,nodes[to].y]],length_m}));
  const edges=data.edges.map(([segment,direction,speed_kph,lanes,signal,hotspot,speedSource,lanesSource])=>{
    const s=segments[segment],from=direction===1?s.from:s.to,to=direction===1?s.to:s.from;
    return {id:`${s.way.id}:${from.id}:${to.id}`,from:from.id,to:to.id,name:s.way.name,
      points:direction===1?s.points:[...s.points].reverse(),length_m:s.length_m,speed_kph,lanes,signal:Boolean(signal),
      hotspot:hotspot<0?null:data.hotspots[hotspot].id,way_id:s.way.id,highway:s.way.tags.highway,
      direction,speed_source:data.sources[speedSource],lanes_source:data.sources[lanesSource]};
  });
  const anchors=data.anchors.map(a=>({...a,x:nodeById.get(a.node).x,y:nodeById.get(a.node).y}));
  const hotspots=data.hotspots.map(h=>({...h,edge_ids:edges.filter(e=>e.hotspot===h.id).map(e=>e.id)}));
  const restrictions=data.restrictions.map(r=>({...r,via:String(r.via)}));
  return deepFreeze({version:data.version,nodes,edges,anchors,hotspots,restrictions,metadata:{...data.metadata,ways}});
}

export const STREET_NETWORK = expandStreetData(SF_STREETS_DATA);
export const STREET_MAP_DATA = STREET_NETWORK;
export const findStreetRoute = createStreetRouter(STREET_NETWORK);
export function streetMapDownload() { return STREET_MAP_DATA; }
