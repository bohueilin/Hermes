// Integer units for the depot lab (contract D1-04, D12-04): ticks are seconds, energy is millijoules,
// data is bytes. SOC is an integer percent of the fixed 60-kWh pack; targets are never float accumulators.
import {Q,ceil} from './rational.js';
export const MJ_PER_W_TICK=1000n,BYTES_PER_MBPS_TICK=125000n,MJ_PER_KWH=3600000000n;
export const PACK_MJ=216000000000n,MJ_PER_SOC_PCT=2160000000n,STORAGE_BYTES=50000000000n;
export const socEnergy=pct=>BigInt(pct)*MJ_PER_SOC_PCT;
export function requiredChargeMj(initialPct,targetPct){const d=BigInt(targetPct)-BigInt(initialPct);return d>0n?d*MJ_PER_SOC_PCT:0n;}
// The band whose half-open [from, until) energy span contains `energy`; at an exact edge this is the higher-SOC band.
export function bandAt(energy,bands){
 for(const b of bands)if(energy>=socEnergy(b.from_soc_pct)&&energy<socEnergy(b.until_soc_pct))return b;
 return bands[bands.length-1];
}
export function nextBandEdge(energy,bands){const until=socEnergy(bandAt(energy,bands).until_soc_pct);return until>energy?until:null;}
// Uncontended band-by-band charge duration with each band's completion on its ceiling tick (oracle helper only).
export function uncontendedChargeTicks(initialPct,targetPct,bands,portW,acceptanceW=null){
 let energy=socEnergy(initialPct),ticks=0n;const target=socEnergy(targetPct);
 while(energy<target){
  const band=bandAt(energy,bands),cap=BigInt(Math.min(acceptanceW??band.cap_w,portW))*MJ_PER_W_TICK;
  if(cap<=0n)return null;
  const edge=acceptanceW===null?socEnergy(band.until_soc_pct):target,stop=edge<target?edge:target;
  ticks+=ceil(Q(stop-energy,cap));energy=stop;
 }
 return ticks;
}
export const wattsToMjPerTick=w=>BigInt(w)*MJ_PER_W_TICK;
export const mbpsToBytesPerTick=m=>BigInt(m)*BYTES_PER_MBPS_TICK;
