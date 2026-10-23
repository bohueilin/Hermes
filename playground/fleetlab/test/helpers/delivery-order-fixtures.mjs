import {deliveryInput} from '../../src/model/software-delivery-contract.js';
export const orderInput=(targets=[480,340,290,240],n=4,q=1000)=>{const d=deliveryInput('default',q);d.requests=d.requests.slice(0,n);d.requests.forEach((r,i)=>{r.arrival_ms=i*30000;r.deadline_ms=targets[i]*1000;});return {schema:'fleetlab.delivery-order-input/1.0.0',domain:'cold-serial-known-at-copy/1.0.0',delivery:d};};
