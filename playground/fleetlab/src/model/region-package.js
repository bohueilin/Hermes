/** Small pinned synthetic region. No Bay geometry, external ingestion or calendar conversion. */
import {deepFreeze} from './schema.js';
import {sha256Hex} from '../core/sha256.js';
export const REGION_PACKAGE_VERSION='region-package-1.0.0';
const geometry={kind:'schematic_graph',graph_version:'tx-austin-schematic-1.0.0',coordinate_system:'local_meters',driving_side:'right',
  nodes:[{id:'aus-north',label:'North neighborhood',x:0,y:10000},{id:'aus-central',label:'Central district',x:0,y:4000},
    {id:'aus-event',label:'Event zone',x:4000,y:6000},{id:'aus-east',label:'East neighborhood',x:8000,y:4000},{id:'aus-airport',label:'Airport gateway',x:8000,y:0}],
  edges:[['aus-north','aus-central'],['aus-central','aus-event'],['aus-event','aus-east'],['aus-east','aus-airport'],['aus-central','aus-east']]};
export const AUSTIN_REGION=deepFreeze({version:REGION_PACKAGE_VERSION,id:'tx-austin-demo',label:'Austin-inspired operating testbed',geometry,
  graph_digest:sha256Hex(JSON.stringify(geometry)),
  depots:[{id:'depot-1',label:'Fictional Site A',place_id:'aus-north'},{id:'depot-2',label:'Fictional Site B',place_id:'aus-east'}],
  calendar:{mode:'elapsed_simulation_time',display_timezone:'America/Chicago',local_date:null},
  provenance:{version:'regional-sources-1.0.0',source_id:'fictional-austin-topology-v1',provider:'FleetLab synthetic teaching configuration',original_url:null,
    version_date:'2026-09-25',use_decision:'Project-authored synthetic configuration; static and offline package',geographic_coverage:'Fictional compact Austin-inspired graph',temporal_coverage:'Synthetic elapsed shift',
    units:'meters in package; kilometers in engine',transformation:'region-package-1.0.0: meters / 1000; undirected shortest graph path',hash:sha256Hex(JSON.stringify(geometry)),
    geometry_state:'synthetic',demand_state:'synthetic',service_state:'synthetic',vehicle_energy_state:'synthetic',missing:['measured travel','ride demand','depot operations','vehicle calibration','commercial access'],destination:'public_package'},
  supported_mechanisms:['staffing_readiness','charging_allocation','resource_observations','time_varying_site_power'],
  unsupported_claims:['calibrated_city_forecast','autonomous_driving_safety','airport_access','vehicle_thermal_response']});
export const regionReference=()=>({version:REGION_PACKAGE_VERSION,id:AUSTIN_REGION.id,graph_version:geometry.graph_version});
export function validateRegion(c){
  const r=c.region,expected=regionReference(),errors=[];
  if(!r||typeof r!=='object'||Array.isArray(r)||Object.keys(r).length!==3||Object.keys(expected).some(k=>r[k]!==expected[k]))errors.push('Unsupported region package or graph version.');
  if(JSON.stringify(c.place_ids)!==JSON.stringify(geometry.nodes.map(p=>p.id)))errors.push('Region places must match the pinned graph order.');
  if(c.depot_count!==2)errors.push('The Austin package requires its two fixed fictional depots.');
  if(c.launch||c.airport)errors.push('Regional power does not support launch or airport-demand extensions.');
  if(!c.charging)errors.push('Regional power requires the existing charging extension.');
  return errors;
}
export function prepareRegionNetwork(c){
  const errors=validateRegion(c);if(errors.length)throw new RangeError(errors.join(' '));
  const places=geometry.nodes.map(p=>({...p,x:p.x/1000,y:p.y/1000,kind:'synthetic-place',road_anchor:{x:p.x/1000,y:p.y/1000}}));
  const nodes=new Map(places.map(p=>[p.id,p])),adj=new Map(places.map(p=>[p.id,[]])),routes={};
  for(const [a,b] of geometry.edges){const pa=nodes.get(a),pb=nodes.get(b),distance=Math.hypot(pa.x-pb.x,pa.y-pb.y);adj.get(a).push([b,distance]);adj.get(b).push([a,distance]);}
  const key=(a,b)=>`${AUSTIN_REGION.id}:${a}->${b}`;
  for(const from of places){
    const distance=new Map(places.map(p=>[p.id,Infinity])),previous=new Map(),open=new Set(nodes.keys());distance.set(from.id,0);
    while(open.size){const at=[...open].sort((a,b)=>distance.get(a)-distance.get(b)||a.localeCompare(b,'en'))[0];open.delete(at);
      if(!Number.isFinite(distance.get(at)))throw new RangeError('Disconnected regional graph; no substitute route.');
      for(const [next,length] of adj.get(at))if(distance.get(at)+length<distance.get(next)){distance.set(next,distance.get(at)+length);previous.set(next,at);}
    }
    for(const to of places){const path=[to.id];while(path[0]!==from.id){const prev=previous.get(path[0]);if(!prev)throw new RangeError('Regional route unavailable.');path.unshift(prev);}
      routes[key(from.id,to.id)]={id:key(from.id,to.id),from:from.id,to:to.id,available:true,distance_km:distance.get(to.id),points:path.map(id=>[nodes.get(id).x,nodes.get(id).y]),source:AUSTIN_REGION.provenance.source_id,
        limitations:['Synthetic undirected graph; no real road, navigation or airport access claim.']};
    }
  }
  return {places,routes,key,depots:AUSTIN_REGION.depots};
}
