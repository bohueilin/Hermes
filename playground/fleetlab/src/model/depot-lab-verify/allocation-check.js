// Independent divisible-allocation checks (C2.1, note 8.6, BD-11): exact weight-1 max-min by progressive filling, the
// bottleneck characterization and interval-floor credit. Only rational arithmetic is shared with the engine.
import {Q,ZERO,add,sub,div,cmp,eq,isZero,floor,ceil,mulBig} from '../depot-lab/rational.js';
// flows [{id, path, cap: Q|null}], caps Map resource -> Q. Every iteration freezes at least one flow.
export function maxMin(flows,caps){
 const rate=new Map(),open=new Set(),left=new Map(),count=new Map();
 for(const f of flows){rate.set(f.id,ZERO);open.add(f.id);for(const r of f.path){left.set(r,caps.get(r));count.set(r,(count.get(r)??0)+1);}}
 const freeze=f=>{if(open.delete(f.id))for(const r of f.path)count.set(r,count.get(r)-1);};
 const settle=()=>{for(const f of flows)if(open.has(f.id)&&(f.cap&&!cmp(rate.get(f.id),f.cap)||f.path.some(r=>isZero(left.get(r)))))freeze(f);};
 settle();
 while(open.size){
  let inc=null;
  for(const f of flows)if(open.has(f.id)&&f.cap){const d=sub(f.cap,rate.get(f.id));if(inc===null||cmp(d,inc)<0)inc=d;}
  for(const [r,n]of count)if(n>0){const d=div(left.get(r),Q(BigInt(n)));if(inc===null||cmp(d,inc)<0)inc=d;}
  for(const f of flows)if(open.has(f.id))rate.set(f.id,add(rate.get(f.id),inc));
  for(const [r,n]of count)if(n>0)left.set(r,sub(left.get(r),mulBig(inc,BigInt(n))));
  settle();
 }
 return new Map(flows.map(f=>{const x=rate.get(f.id);return [f.id,{rate:x,tight:[...f.path.filter(r=>isZero(left.get(r))),...(f.cap&&!cmp(x,f.cap)?[f.id]:[])].sort()}];}));
}
// Claimed rates are feasible and max-min fair iff each flow sits at its own cap or crosses a saturated resource on which
// no other flow is faster (the bottleneck characterization of the unique solution).
export function characterize(flows,rates,caps){
 const load=new Map(),top=new Map();
 for(const f of flows){
  const x=rates.get(f.id);if(cmp(x,ZERO)<0||f.cap&&cmp(x,f.cap)>0)return 'ALLOCATION_INFEASIBLE';
  for(const r of f.path){load.set(r,add(load.get(r)??ZERO,x));if(!top.has(r)||cmp(x,top.get(r))>0)top.set(r,x);}
 }
 for(const [r,l]of load)if(cmp(l,caps.get(r))>0)return 'ALLOCATION_INFEASIBLE';
 for(const f of flows){const x=rates.get(f.id);if(f.cap&&eq(x,f.cap))continue;if(!f.path.some(r=>eq(load.get(r),caps.get(r))&&eq(x,top.get(r))))return 'ALLOCATION_NOT_MAX_MIN';}
 return null;
}
// Interval credit (D1-04, C2.1): cumulative floor from the anchor, clipped by the interval remainder R.
export const exactAt=(p,a,t)=>mulBig(p,BigInt(t-a));
export const creditAt=(p,a,t,R)=>{const c=floor(exactAt(p,a,t));return c<R?c:R;};
export const slackAt=(p,a,t)=>{const x=exactAt(p,a,t);return sub(x,Q(floor(x)));};
export const undrawnAt=(p,a,t,R)=>sub(exactAt(p,a,t),Q(R));
export function closeTick(p,a,R){if(isZero(p))return Infinity;const c=ceil(div(Q(R),p));return c>400000n?Infinity:a+Number(c);}
