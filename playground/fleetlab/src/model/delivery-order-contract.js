// Plain-data contracts only. No scheduling or search is shared with the verifier.
import {normalizeDeliveryInput,canonicalDelivery,deliveryDigest} from './software-delivery-contract.js';
export const ORDER_INPUT_SCHEMA='fleetlab.delivery-order-input/1.0.0';
export const ORDER_DOMAIN='cold-serial-known-at-copy/1.0.0';
export const ORDER_RECORD_SCHEMA='fleetlab.delivery-order-record/1.0.0';
export const ORDER_POLICY_VERSION='serial-local/1.0.0';
export const ORDER_STUDY_SCHEMA='fleetlab.delivery-order-study-record/1.0.0';
export const ORDER_MANIFEST_SCHEMA='fleetlab.delivery-order-manifest/1.0.0';
export const ORDER_LIMITS=Object.freeze({input:65536,record:16384,study:262144});
export const orderCanonical=(v,limit=ORDER_LIMITS.study)=>canonicalDelivery(v,limit);
export const orderDigest=(v,limit=ORDER_LIMITS.study)=>deliveryDigest(v,limit);
export function orderFields(value,keys,path){
 if(!value||Array.isArray(value)||typeof value!=='object'||Object.keys(value).sort().join('|')!==[...keys].sort().join('|'))throw Error(`order schema: ${path}`);
}
export function normalizeOrderInput(raw){
 const v=JSON.parse(orderCanonical(raw,ORDER_LIMITS.input));
 orderFields(v,['schema','domain','delivery'],'input');
 if(v.schema!==ORDER_INPUT_SCHEMA||v.domain!==ORDER_DOMAIN)throw Error('order schema: unsupported version/domain');
 const d=normalizeDeliveryInput(v.delivery),bad=reason=>{throw Error(`unsupported-domain: ${reason}`);};
 if(d.H_ms!==2400000||d.P_ms!==0)bad('observation window');
 if(d.artifact.available_at_ms!==0)bad('source availability');
 if(d.artifact.size_bytes!==12000000000)bad('artifact size');
 if(!d.requests.some(r=>r.arrival_ms===0))bad('initial request');
 for(const [name,rate]of [['wan',125000000],['local',250000000]])if(d.resources[name].aggregate_Bps!==rate||d.resources[name].transfer_cap_Bps!==rate)bad(`${name} rate/cap`);
 for(const r of d.requests){
  if(Math.ceil(r.arrival_ms/d.quantum_ms)*d.quantum_ms>96000)bad('arrival after copy');
  if(r.check_ms!==60000||r.activation_ms!==30000||r.check_outcome!=='pass')bad('task duration/outcome');
 }
 return {schema:ORDER_INPUT_SCHEMA,domain:ORDER_DOMAIN,delivery:d};
}
export function normalizeOrder(raw,input){
 const order=JSON.parse(orderCanonical(raw,1024)),ids=input.delivery.requests.map(r=>r.id);
 if(!Array.isArray(order)||order.length!==ids.length||new Set(order).size!==ids.length||order.some(id=>!ids.includes(id)))throw Error('order-not-permutation');
 return order;
}
