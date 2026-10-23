import {sha256Hex} from '../core/sha256.js';
export const VERSION='fleetlab.dispatch/1.1.0';
export const canonical=v=>JSON.stringify(v,(_k,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
export const hash=v=>sha256Hex(canonical(v));
export const copy=v=>JSON.parse(JSON.stringify(v));
const keys=(x,k)=>{if(!x||Array.isArray(x)||typeof x!=='object'||canonical(Object.keys(x).sort())!==canonical(k.sort()))throw Error('Unsupported input fields');};
const integer=(n,a,b)=>{if(!Number.isSafeInteger(n)||n<a||n>b)throw Error('Integer outside supported domain');return n;};
export function normalize(value){
 keys(value,['horizon','vehicles','requests']);const h=integer(value.horizon,30,1200);if(h%30)throw Error('Times must use the 30-second grid');
 const coord=p=>{if(!Array.isArray(p)||p.length!==2)throw Error('Coordinate must have two entries');return p.map(n=>integer(n,0,4));};
 if(!Array.isArray(value.vehicles)||value.vehicles.length<1||value.vehicles.length>4||!Array.isArray(value.requests)||value.requests.length>8)throw Error('Population exceeds contract');
 const vehicles=value.vehicles.map(v=>{keys(v,['id','at']);if(typeof v.id!=='string'||!/^ev-00[1-4]$/.test(v.id))throw Error('Invalid vehicle ID');return {id:v.id,at:coord(v.at)};}).sort((a,b)=>a.id.localeCompare(b.id));
 const requests=value.requests.map(r=>{keys(r,['id','arrival','origin','destination','deadline']);if(typeof r.id!=='string'||!/^r-00[1-8]$/.test(r.id))throw Error('Invalid request ID');integer(r.arrival,0,h);integer(r.deadline,r.arrival,h);if(r.arrival%30||r.deadline%30)throw Error('Times must use the 30-second grid');return {id:r.id,arrival:r.arrival,origin:coord(r.origin),destination:coord(r.destination),deadline:r.deadline};}).sort((a,b)=>a.id.localeCompare(b.id));
 if(new Set(vehicles.map(v=>v.id)).size!==vehicles.length||new Set(requests.map(r=>r.id)).size!==requests.length)throw Error('Duplicate ID');return {horizon:h,vehicles,requests};
}
export function fixture(id='default'){
 const car=(n,at)=>({id:`ev-00${n}`,at});const req=(n,arrival,origin,destination,deadline)=>({id:`r-00${n}`,arrival,origin,destination,deadline});
 if(id==='neutral')return normalize({horizon:1200,vehicles:[1,2,3,4].map(n=>car(n,[0,0])),requests:[1,2,3,4].map(n=>req(n,0,[0,0],[1,0],300))});
 if(id==='counterexample')return normalize({horizon:1200,vehicles:[car(1,[0,0]),car(2,[2,0])],requests:[req(1,0,[1,0],[1,2],150),req(2,0,[0,0],[0,2],60),req(3,30,[2,0],[2,1],60),req(4,120,[2,1],[2,0],150)]});
 if(id!=='default')throw Error('Unknown fixture');
 return normalize({horizon:1200,vehicles:[car(1,[0,0]),car(2,[2,0]),car(3,[0,4]),car(4,[4,4])],requests:[req(1,0,[1,0],[1,2],150),req(2,0,[0,0],[0,2],60),req(3,0,[1,4],[2,4],150),req(4,0,[4,3],[4,1],150),req(5,600,[0,2],[0,0],720),req(6,600,[1,2],[3,2],780),req(7,600,[2,4],[2,2],720),req(8,600,[4,1],[4,4],780)]});
}
export function manualTape(value,end){
 if(!Array.isArray(value)||value.length!==end/30||value.length>40)throw Error('One manual batch required per preceding boundary');
 return value.map((d,i)=>{keys(d,['t','pairs']);if(d.t!==i*30||!Array.isArray(d.pairs)||d.pairs.length>4)throw Error('Invalid decision tape');const pairs=d.pairs.map(p=>{if(!Array.isArray(p)||p.length!==2||p.some(id=>typeof id!=='string')||!/^r-00[1-8]$/.test(p[0])||!/^ev-00[1-4]$/.test(p[1]))throw Error('Invalid assignment pair');return [...p];}).sort((a,b)=>canonical(a).localeCompare(canonical(b)));return {t:d.t,pairs};});
}
