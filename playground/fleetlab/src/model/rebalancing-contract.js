import {sha256Hex} from '../core/sha256.js';
export const ZONES=Object.freeze(['A','B','C','D']);
export const VERSION='r1-four-zones-v1';
export const canonical=value=>JSON.stringify(value,(_key,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
export const hash=value=>sha256Hex(canonical(value));
export const copy=value=>JSON.parse(JSON.stringify(value));
export function freeze(value){if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}
const fail=message=>{throw Error(`R1: ${message}`);};
const integer=(x,min,max)=>Number.isSafeInteger(x)&&x>=min&&x<=max;
const keys=(x,list)=>x&&typeof x==='object'&&!Array.isArray(x)&&canonical(Object.keys(x).sort())===canonical([...list].sort());
export function defaultInput(){
 const counts=[[3,3,1,2],[2,2,9,1],[2,2,9,1],[1,7,2,4],[1,7,2,4],[6,2,2,4],[6,2,2,4],[2,1,3,8],[2,1,3,8],[7,3,2,2],[7,3,2,2],[2,5,5,2]];
 const requests=[]; // Explicit mappings below; no randomized demand.
 for(let i=0;i<12;i++)for(let z=0;z<4;z++)for(let j=0;j<counts[i][z];j++){
  const origin=ZONES[z],destination=([3,4,7,8,11].includes(i)?{A:'C',B:'D',C:'A',D:'B'}:{A:'B',B:'A',C:'D',D:'C'})[origin];
  const arrival=i*600+60+Math.floor(480*j/counts[i][z]);
  requests.push({id:`r-${String(i).padStart(2,'0')}-${origin}-${String(j).padStart(2,'0')}`,origin,destination,arrival,deadline:arrival+360});
 }
 const distances={A:{A:0,B:2000,C:2000,D:4000},B:{A:2000,B:0,C:4000,D:2000},C:{A:2000,B:4000,C:0,D:2000},D:{A:4000,B:2000,C:2000,D:0}};
 return normalizeInput({version:VERSION,horizon:7200,interval:600,pickup_seconds:60,pickup_meters:200,seconds_per_km:120,coordinates:{A:[0,0],B:[2,0],C:[0,2],D:[2,2]},distances,
  vehicles:Array.from({length:24},(_,i)=>({id:`ev-${String(i+1).padStart(3,'0')}`,zone:i<8?'A':i<16?'B':i<18?'C':'D'})),requests,
  forecasts:counts.map((_,i)=>({t:i*600,counts:i===11?null:Object.fromEntries(ZONES.map((z,j)=>[z,counts[i+1][j]]))}))});
}
export function normalizeInput(x){
 if(!keys(x,['version','horizon','interval','pickup_seconds','pickup_meters','seconds_per_km','coordinates','distances','vehicles','requests','forecasts']))fail('input fields differ');
 if(x.version!==VERSION||!integer(x.horizon,600,7200)||x.horizon%600||x.interval!==600||x.pickup_seconds!==60||x.pickup_meters!==200||x.seconds_per_km!==120)fail('unsupported domain or clock');
 const xy={A:[0,0],B:[2,0],C:[0,2],D:[2,2]};if(canonical(x.coordinates)!==canonical(xy)||!keys(x.distances,ZONES))fail('geometry differs');
 for(const a of ZONES){if(!keys(x.distances[a],ZONES))fail('distance matrix');for(const b of ZONES)if(x.distances[a][b]!==1000*(Math.abs(xy[a][0]-xy[b][0])+Math.abs(xy[a][1]-xy[b][1])))fail('distance matrix');}
 if(!Array.isArray(x.vehicles)||!integer(x.vehicles.length,1,24)||new Set(x.vehicles.map(v=>v.id)).size!==x.vehicles.length)fail('vehicle inventory');
 for(const v of x.vehicles)if(!keys(v,['id','zone'])||!/^ev-\d{3}$/.test(v.id)||!ZONES.includes(v.zone))fail('initial vehicle');
 if(!Array.isArray(x.requests)||x.requests.length>400||new Set(x.requests.map(r=>r.id)).size!==x.requests.length)fail('request inventory');
 for(const r of x.requests)if(!keys(r,['id','origin','destination','arrival','deadline'])||!/^r-\d{2}-[A-D]-\d{2}$/.test(r.id)||!ZONES.includes(r.origin)||!ZONES.includes(r.destination)||r.origin===r.destination||!integer(r.arrival,0,x.horizon-1)||!integer(r.deadline,r.arrival,x.horizon+360))fail('request fields');
 if(!Array.isArray(x.forecasts)||x.forecasts.length!==x.horizon/600)fail('forecast coverage');
 x.forecasts.forEach((f,i)=>{if(!keys(f,['t','counts'])||f.t!==i*600||(i===x.forecasts.length-1?f.counts!==null:!keys(f.counts,ZONES)||ZONES.some(z=>!integer(f.counts[z],0,400))))fail('forecast tape');});
 const result=copy(x);result.vehicles.sort((a,b)=>a.id.localeCompare(b.id));result.requests.sort((a,b)=>a.arrival-b.arrival||a.id.localeCompare(b.id));return freeze(result);
}
export function canonicalBatch(moves,vehicles){
 if(!Array.isArray(moves)||moves.length>48)fail('move batch too large');
 const totals=new Map();for(const m of moves){if(!keys(m,['from','to','count'])||!ZONES.includes(m.from)||!ZONES.includes(m.to)||m.from===m.to||!integer(m.count,0,24))fail('invalid move');const k=m.from+m.to;totals.set(k,(totals.get(k)||0)+m.count);}
 const result=[...totals].filter(([,n])=>n>0).sort(([a],[b])=>a.localeCompare(b)).map(([k,count])=>({from:k[0],to:k[1],count}));
 for(const z of ZONES){const needed=result.filter(m=>m.from===z).reduce((n,m)=>n+m.count,0),ready=vehicles.filter(v=>v.zone===z&&(!v.activity||v.activity==='idle')).length;if(needed>ready)fail(`moves exceed ready supply in ${z}`);}
 return result;
}
export function normalizePlan(decisions,end){
 if(!Array.isArray(decisions)||decisions.length>12)fail('decision coverage');
 const result=copy(decisions);for(const d of result)if(!keys(d,['t','moves'])||!integer(d.t,0,end-1)||d.t%600||!Array.isArray(d.moves))fail('decision time');
 result.sort((a,b)=>a.t-b.t);if(new Set(result.map(d=>d.t)).size!==result.length)fail('duplicate decision');return result;
}
export function rational(n,d=1){const gcd=(a,b)=>b?gcd(b,a%b):a;const g=gcd(n,d)||1;return {n:n/g,d:d/g};}
export function addRational(a,b){return rational(a.n*b.d+b.n*a.d,a.d*b.d);}
