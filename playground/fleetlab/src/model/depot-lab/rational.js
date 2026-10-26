// Exact BigInt rationals for the depot lab (contract C1.1, C2.1). No Number division, epsilon or float.
// Every result is reduced with a positive denominator; zero is 0/1. Operands are bit-length checked before
// multiplication so an oversized intermediate refuses instead of rounding.
export const MAX_BITS=8192,MAX_DIGITS=256;
const HALF=1n<<4096n,LIMIT=1n<<8192n;
export class RationalGuardError extends Error{
 constructor(detail,operand_bits=null){super(`INCOMPLETE_RESOURCE_LIMIT: RATIONAL_GUARD ${detail}`);this.code='INCOMPLETE_RESOURCE_LIMIT';this.reason='RATIONAL_GUARD';this.detail=detail;this.operand_bits=operand_bits;}
}
const abs=x=>x<0n?-x:x;
export function bitLength(x){x=abs(x);if(x===0n)return 0;const h=x.toString(16);return (h.length-1)*4+32-Math.clz32(parseInt(h[0],16));}
const guard=(x,what)=>{if(abs(x)>=LIMIT)throw new RationalGuardError(`${what} exceeds ${MAX_BITS} bits`);return x;};
// Checked product: refuse before allocating a result wider than the guard.
export function mulInt(a,b){if(abs(a)>=HALF||abs(b)>=HALF){const bits=bitLength(a)+bitLength(b);if(bits>MAX_BITS)throw new RationalGuardError('product operand bits',bits);}return guard(a*b,'product');}
export function gcd(a,b){a=abs(a);b=abs(b);while(b){[a,b]=[b,a%b];}return a;}
export function Q(n,d=1n){
 if(typeof n!=='bigint'||typeof d!=='bigint')throw new TypeError('rational parts must be bigint');
 if(d===0n)throw new RangeError('zero denominator');
 if(d<0n){n=-n;d=-d;}
 if(n===0n)return ZERO;
 const g=gcd(n,d);return Object.freeze({n:guard(n/g,'numerator'),d:guard(d/g,'denominator')});
}
export const ZERO=Object.freeze({n:0n,d:1n}),ONE=Object.freeze({n:1n,d:1n});
export const fromInt=x=>Q(BigInt(x));
export const add=(a,b)=>a.d===b.d?Q(a.n+b.n,a.d):Q(mulInt(a.n,b.d)+mulInt(b.n,a.d),mulInt(a.d,b.d));
export const sub=(a,b)=>a.d===b.d?Q(a.n-b.n,a.d):Q(mulInt(a.n,b.d)-mulInt(b.n,a.d),mulInt(a.d,b.d));
export const mul=(a,b)=>Q(mulInt(a.n,b.n),mulInt(a.d,b.d));
export function div(a,b){if(b.n===0n)throw new RangeError('division by zero');return Q(mulInt(a.n,b.d),mulInt(a.d,b.n));}
export const cmp=(a,b)=>{const x=a.d===b.d?a.n-b.n:mulInt(a.n,b.d)-mulInt(b.n,a.d);return x<0n?-1:x>0n?1:0;};
export const eq=(a,b)=>a.n===b.n&&a.d===b.d;
export const isZero=a=>a.n===0n;
export const min=(a,b)=>cmp(a,b)<=0?a:b;
export const max=(a,b)=>cmp(a,b)>=0?a:b;
export const floor=a=>a.n>=0n?a.n/a.d:-((-a.n+a.d-1n)/a.d);
export const ceil=a=>a.n>=0n?(a.n+a.d-1n)/a.d:-((-a.n)/a.d);
// The engineering note's names for the same two operations.
export const floorDiv=floor,ceilDiv=ceil;
export const mulBig=(a,k)=>Q(mulInt(a.n,k),a.d);
// Wire form: one reduced nonnegative "p/q" with at most 256 digits per component.
const WIRE=/^(0|[1-9][0-9]{0,255})\/([1-9][0-9]{0,255})$/;
export function parseRational(text){
 const m=typeof text==='string'&&text.length<=513?WIRE.exec(text):null;if(!m)return null;
 const n=BigInt(m[1]),d=BigInt(m[2]);if(gcd(n,d)!==1n||(n===0n&&d!==1n))return null;
 return Q(n,d);
}
export function formatRational(r){
 if(r.n<0n)throw new RangeError('wire rationals are nonnegative');
 const p=r.n.toString(),q=r.d.toString();
 if(p.length>MAX_DIGITS||q.length>MAX_DIGITS)throw new RationalGuardError('serialized component exceeds 256 digits');
 return `${p}/${q}`;
}
// Exact decimal text of a rational with a fixed number of fraction digits, truncated toward zero, for display only.
export function decimalText(r,digits=0){
 const neg=r.n<0n,n=abs(r.n),scale=10n**BigInt(digits),v=n*scale/r.d,s=v.toString().padStart(digits+1,'0');
 const whole=digits?s.slice(0,-digits):s,frac=digits?s.slice(-digits):'';
 return (neg&&v!==0n?'-':'')+whole+(digits?`.${frac}`:'');
}
