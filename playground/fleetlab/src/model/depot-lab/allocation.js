// Exact weight-1 max-min allocation and per-interval floor credit (contract C2.1; engineering note 8.6, BD-11).
// Pure functions over BigInt rationals; no float, epsilon or carried residual.
import {Q,ZERO,add,sub,div,cmp,eq,isZero,floor,ceil,mulBig,fromInt} from './rational.js';
import {byStr} from './state.js';
// flows: [{id, path:[resource id], cap: bigint|null}] sorted by id; caps: Map resource id -> bigint per tick.
// Progressive filling: all unfrozen flows rise together; every flow on a saturated resource or at its own cap freezes.
export function maxMin(flows,caps){
 const residual=new Map(),rate=new Map(),open=new Set(flows);
 for(const f of flows)for(const r of f.path)if(!residual.has(r))residual.set(r,Q(caps.get(r)??0n));
 let level=ZERO;
 while(open.size){
  const count=new Map();
  for(const f of open)for(const r of f.path)count.set(r,(count.get(r)??0)+1);
  let inc=null;
  for(const [r,n]of count){const x=div(residual.get(r),fromInt(n));if(inc===null||cmp(x,inc)<0)inc=x;}
  for(const f of open)if(f.cap!==null){const x=sub(Q(f.cap),level);if(inc===null||cmp(x,inc)<0)inc=x;}
  level=add(level,inc);
  for(const [r,n]of count)residual.set(r,sub(residual.get(r),mulBig(inc,BigInt(n))));
  const frozen=[...open].filter(f=>f.path.some(r=>isZero(residual.get(r)))||(f.cap!==null&&cmp(Q(f.cap),level)<=0));
  for(const f of frozen){open.delete(f);rate.set(f.id,level);}
 }
 const out=new Map();
 for(const f of flows){
  const p=rate.get(f.id),tight=f.path.filter(r=>isZero(residual.get(r)));
  if(f.cap!==null&&eq(Q(f.cap),p))tight.push(f.id);
  out.set(f.id,{rate:p,tight:tight.sort(byStr)});
 }
 return out;
}
// Cumulative interval credit min(floor(rate*(t-a)), R) and the exact unfloored amount rate*(t-a).
export const exactAt=(rate,a,t)=>mulBig(rate,BigInt(t-a));
export function creditAt(rate,a,t,R){const x=floor(exactAt(rate,a,t));return x<R?x:R;}
// Absolute closure tick a + ceil(R/rate) for a positive rate, or null when it lies beyond the horizon (C2.1).
export function closureTick(rate,a,R,H){
 if(rate.n===0n)return null;
 const c=BigInt(a)+ceil(div(Q(R),rate));
 return c>BigInt(H)?null:Number(c);
}
// Closure at the target or band edge: credited R, undrawn final-tick allocation, zero slack.
export const undrawnAt=(rate,a,c,R)=>sub(exactAt(rate,a,c),Q(R));
// Closure by reallocation, pause or cancel: discarded fraction is quantization slack.
export const slackAt=(rate,a,t,credited)=>sub(exactAt(rate,a,t),Q(credited));
// Sub-quantum guard (C2.1): a positive share that cannot deliver one more unit by H refuses the run.
export const subQuantum=(rate,a,R,H,after=0n)=>rate.n>0n&&R>0n&&a<H&&creditAt(rate,a,H,R)-after===0n;
