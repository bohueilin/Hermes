// Exact display text for depot lab quantities (contract C1.6, D1-11, A30). Display truncates toward zero, never rounds
// up and never shows a positive quantity as zero, so a shown value cannot cross a threshold; an ellipsis marks
// digits left out. Exact values stay available beside every display. BigInt only; no float division.
import {Q,parseRational,decimalText,floor} from '../model/depot-lab/rational.js';
import {MJ_PER_KWH} from '../model/depot-lab/units.js';
const INT=/^-?(0|[1-9][0-9]*)$/;
// Accepts a safe integer, a bigint, a decimal integer string, a reduced "p/q" (optionally signed) or a rational.
export function exactValue(v){
 if(v&&typeof v==='object'&&typeof v.n==='bigint'&&typeof v.d==='bigint')return Q(v.n,v.d);
 if(typeof v==='bigint')return Q(v);
 if(Number.isSafeInteger(v))return Q(BigInt(v));
 if(typeof v==='string'){
  if(INT.test(v))return Q(BigInt(v));
  const neg=v.startsWith('-'),r=parseRational(neg?v.slice(1):v);
  if(r)return neg?Q(-r.n,r.d):r;
 }
 throw new TypeError('display values are safe integers, bigints or reduced p/q strings');
}
const magnitude=r=>r.n<0n?Q(-r.n,r.d):r;
export const groupDigits=s=>s.replace(/\B(?=(\d{3})+(?!\d))/g,',');
export function numberText(v,digits=3){
 const r=exactValue(v),a=magnitude(r),neg=r.n<0n;
 if(a.n===0n)return '0';
 const scale=10n**BigInt(digits),scaled=a.n*scale;
 if(scaled<a.d){const tiny=digits?`0.${'0'.repeat(digits-1)}1`:'1';return neg?`> -${tiny}`:`< ${tiny}`;}
 const exact=scaled%a.d===0n;let [whole,frac='']=decimalText(a,digits).split('.');
 if(exact)frac=frac.replace(/0+$/,'');
 return `${neg?'-':''}${groupDigits(whole)}${frac?`.${frac}`:''}${exact?'':'…'}`;
}
export const secondsText=v=>`${numberText(v)} s`;
// Whole minutes, truncated: a positive value under one minute is "< 1 min", never "0 min" (A30).
function wholeMinutes(v){const r=exactValue(v),a=magnitude(r);return {neg:r.n<0n,zero:a.n===0n,m:floor(Q(a.n,a.d*60n))};}
export function minutesText(v){
 const {neg,zero,m}=wholeMinutes(v);
 if(zero)return '0 min';
 return `${neg?'-':''}${m===0n?'< 1 min':`${groupDigits(m.toString())} min`}`;
}
export function hoursText(v){
 const {neg,zero,m}=wholeMinutes(v);
 if(zero||m<60n)return minutesText(v);
 const h=m/60n,rest=m%60n;
 return `${neg?'-':''}${groupDigits(h.toString())} h${rest?` ${rest} min`:''}`;
}
export const overdueText=minutesText;
// Energy is exact integer mJ; 1 kWh = 3,600,000,000 mJ. Data is bytes; 1 GB = 1,000,000,000 bytes.
export const kwhText=(mj,digits=3)=>{const r=exactValue(mj);return `${numberText(Q(r.n,r.d*MJ_PER_KWH),digits)} kWh`;};
export const gbText=(bytes,digits=3)=>{const r=exactValue(bytes);return `${numberText(Q(r.n,r.d*1000000000n),digits)} GB`;};
export const kwText=(watts,digits=3)=>{const r=exactValue(watts);return `${numberText(Q(r.n,r.d*1000n),digits)} kW`;};
export const percentText=(fraction,digits=1)=>{const r=exactValue(fraction);return `${numberText(Q(r.n*100n,r.d),digits)}%`;};
export const rationalText=(v,digits=3)=>numberText(v,digits);
// Display format and exact unit per vector component (note 18), shared by the page and every summary; time stays in seconds.
export const componentKind=id=>id==='remaining_required_kWh'?[kwhText,'mJ']:id==='remaining_required_bytes'?[gbText,'bytes']:id==='on_time_count'||id==='unreleased_count'?[numberText,'visits']:[secondsText,'s'];
// A signed change: "+" or "-" before the magnitude formatted by `format`; zero has no sign.
export function signedText(v,format=secondsText){
 const r=exactValue(v);
 return `${r.n>0n?'+':r.n<0n?'-':''}${format(magnitude(r))}`;
}
