// NF04-B public schemas and canonical data only. No allocation or execution helpers.
import {canonicalJson} from '../core/canon.js';
import {sha256Hex} from '../core/sha256.js';

export const DELIVERY_INPUT_SCHEMA='fleetlab.software-delivery-input/1.0.0';
export const DELIVERY_RECORD_SCHEMA='fleetlab.software-delivery-record/1.0.0';
export const DELIVERY_POLICY_VERSION='capped-equal-share/1.0.0';
export const DELIVERY_MANIFEST_SCHEMA='fleetlab.software-delivery-study/1.0.0';
export const DELIVERY_BOUNDS=Object.freeze({maxRequests:4,maxArtifactBytes:64000000000,maxRateBps:1000000000,
  maxHorizonMs:2400000,maxTaskDurationMs:2400000,maxInputBytes:65536,maxRecordBytes:33554432,
  maxPairBytes:67108864,maxEntries:130000,maxDepth:16,maxNodes:2000000});
const fail=(path,reason)=>{throw new TypeError(`software-delivery ${path}: ${reason}`);};
const own=(v,k)=>Object.prototype.hasOwnProperty.call(v,k);

function descriptors(value,path,array=false){
  if(value===null||typeof value!=='object')fail(path,'expected plain data');
  const proto=Object.getPrototypeOf(value);
  if(array ? !Array.isArray(value)||proto!==Array.prototype : Array.isArray(value)||(proto!==Object.prototype&&proto!==null))fail(path,'expected own plain data');
  for(const key in value)if(!own(value,key))fail(path,'inherited fields');
  const keys=Reflect.ownKeys(value);
  if(keys.some(k=>typeof k!=='string'))fail(path,'symbol field');
  const data=Object.getOwnPropertyDescriptors(value);
  for(const key of keys){
    if(!own(data[key],'value'))fail(`${path}.${key}`,'accessor is not plain data');
    if(!(array&&key==='length')&&!data[key].enumerable)fail(`${path}.${key}`,'non-enumerable field is not plain data');
  }
  if(array){
    if(keys.length!==value.length+1)fail(path,'sparse or decorated array');
    for(let i=0;i<value.length;i++)if(!own(data,String(i)))fail(path,'sparse array');
  }
  return data;
}
function fields(value,keys,path){
  const d=descriptors(value,path);
  for(const key of Object.keys(d))if(!keys.includes(key))fail(path,`unknown field ${key}`);
  for(const key of keys)if(!own(d,key))fail(path,`missing field ${key}`);
  return Object.fromEntries(keys.map(key=>[key,d[key].value]));
}
function integer(value,min,max,path){
  if(!Number.isSafeInteger(value)||Object.is(value,-0)||value<min||value>max)fail(path,`expected integer ${min}..${max}`);
  return value;
}
function string(value,pattern,path){if(typeof value!=='string'||!pattern.test(value))fail(path,'invalid string');return value;}
function dense(value,min,max,path){
  if(!Array.isArray(value)||value.length<min||value.length>max)fail(path,`expected array length ${min}..${max}`);
  descriptors(value,path,true);return value;
}

/** Validate descriptors before the older canonical encoder can access a value. */
export function canonicalDelivery(value,maxBytes=DELIVERY_BOUNDS.maxRecordBytes){
  integer(maxBytes,1,DELIVERY_BOUNDS.maxPairBytes,'canonical maxBytes');
  const ancestors=new Set();let nodes=0,lowerBytes=0;
  function visit(v,path,depth){
    if(++nodes>DELIVERY_BOUNDS.maxNodes||depth>DELIVERY_BOUNDS.maxDepth)fail(path,'plain data complexity bound');
    if(v===null||typeof v==='boolean'){lowerBytes+=4;}
    else if(typeof v==='number'){integer(v,Number.MIN_SAFE_INTEGER,Number.MAX_SAFE_INTEGER,path);lowerBytes+=String(v).length;}
    else if(typeof v==='string'){lowerBytes+=v.length+2;}
    else if(typeof v==='object'){
      if(ancestors.has(v))fail(path,'cycle');
      if(Array.isArray(v)&&v.length>DELIVERY_BOUNDS.maxEntries)fail(path,'array bound');
      const d=descriptors(v,path,Array.isArray(v));ancestors.add(v);lowerBytes+=2;
      for(const key of Object.keys(d)){
        if(Array.isArray(v)&&key==='length')continue;
        if(!Array.isArray(v))lowerBytes+=key.length+3;
        if(lowerBytes>maxBytes)fail(path,'serialized bytes bound');
        visit(d[key].value,`${path}.${key}`,depth+1);
      }
      ancestors.delete(v);
    }else fail(path,'unsupported plain data');
    if(lowerBytes>maxBytes)fail(path,'serialized bytes bound');
  }
  visit(value,'$',0);
  function encode(v,key){
    if(v===null||typeof v!=='object')return canonicalJson(v);
    if(Array.isArray(v)){
      let values=v;
      if(key==='eligible'){
        if(v.some(row=>row===null||typeof row!=='object'||typeof row.id!=='string'))fail('eligible','expected plain rows with IDs');
        values=[...v].sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
      }
      return `[${values.map(item=>encode(item,'')).join(',')}]`;
    }
    return `{${Object.keys(v).sort().map(k=>`${JSON.stringify(k)}:${encode(v[k],k)}`).join(',')}}`;
  }
  const text=encode(value,'');
  if(new TextEncoder().encode(text).length>maxBytes)fail('$','serialized bytes bound');
  return text;
}
export function deliveryDigest(value,maxBytes=DELIVERY_BOUNDS.maxRecordBytes){return sha256Hex(canonicalDelivery(value,maxBytes));}

/** A detached canonical input; policy belongs only to its resulting record. */
export function normalizeDeliveryInput(raw){
  const v=fields(raw,['schema','P_ms','H_ms','quantum_ms','artifact','requests','resources','inventory'],'input');
  if(v.schema!==DELIVERY_INPUT_SCHEMA)fail('schema','unsupported version');
  integer(v.P_ms,0,0,'P_ms');
  if(v.quantum_ms!==1000&&v.quantum_ms!==250)fail('quantum_ms','unsupported quantum');
  integer(v.H_ms,1,DELIVERY_BOUNDS.maxHorizonMs,'H_ms');
  if(v.H_ms%v.quantum_ms!==0)fail('H_ms','must align with quantum_ms');
  const a=fields(v.artifact,['id','version','digest','size_bytes','available_at_ms'],'artifact');
  string(a.id,/^[A-Za-z0-9_.-]{1,64}$/,'artifact.id');string(a.version,/^[A-Za-z0-9_.-]{1,64}$/,'artifact.version');
  string(a.digest,/^[0-9a-f]{64}$/,'artifact.digest');integer(a.size_bytes,1,DELIVERY_BOUNDS.maxArtifactBytes,'artifact.size_bytes');
  integer(a.available_at_ms,0,v.H_ms,'artifact.available_at_ms');
  const ids=new Set();const requests=dense(v.requests,1,4,'requests').map((rawRequest,i)=>{
    const r=fields(rawRequest,['id','arrival_ms','deadline_ms','check_ms','check_outcome','activation_ms'],`requests.${i}`);
    string(r.id,/^[A-Za-z0-9_-]{1,28}$/,`requests.${i}.id`);
    if(ids.has(r.id))fail('requests','duplicate id');ids.add(r.id);
    for(const k of ['arrival_ms','deadline_ms'])integer(r[k],0,v.H_ms,`requests.${i}.${k}`);
    for(const k of ['check_ms','activation_ms'])integer(r[k],0,DELIVERY_BOUNDS.maxTaskDurationMs,`requests.${i}.${k}`);
    if(r.check_outcome!=='pass'&&r.check_outcome!=='fail')fail(`requests.${i}.check_outcome`,'expected pass or fail');
    return r;
  }).sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
  const resources=fields(v.resources,['wan','local'],'resources');
  for(const key of ['wan','local']){
    const r=fields(resources[key],['aggregate_Bps','transfer_cap_Bps'],`resources.${key}`);
    for(const k of ['aggregate_Bps','transfer_cap_Bps']){
      integer(r[k],0,DELIVERY_BOUNDS.maxRateBps,`resources.${key}.${k}`);
      if(r[k]%4!==0)fail(`resources.${key}.${k}`,'must be divisible by four at both quanta');
    }
    resources[key]=r;
  }
  if(!Array.isArray(v.inventory))fail('inventory','expected array');
  if(v.inventory.length!==0)fail('inventory','unsupported-mode: inventory');
  dense(v.inventory,0,0,'inventory');
  const input={schema:v.schema,P_ms:0,H_ms:v.H_ms,quantum_ms:v.quantum_ms,artifact:a,requests,resources,inventory:[]};
  canonicalDelivery(input,DELIVERY_BOUNDS.maxInputBytes);return input;
}

export function deliveryInput(preset='default',quantum_ms=1000){
  if(!['default','one','slow-local','two-arrivals'].includes(preset))fail('preset','unsupported preset');
  const count=preset==='one'?1:preset==='two-arrivals'?2:4;
  return normalizeDeliveryInput({schema:DELIVERY_INPUT_SCHEMA,P_ms:0,H_ms:2400000,quantum_ms,
    artifact:{id:'update',version:'1',digest:'0'.repeat(64),size_bytes:12000000000,available_at_ms:0},
    requests:Array.from({length:count},(_,i)=>({id:`V${i+1}`,arrival_ms:preset==='two-arrivals'?i*100000:0,
      deadline_ms:preset==='two-arrivals'?250000:480000,check_ms:60000,check_outcome:'pass',activation_ms:30000})),
    resources:{wan:{aggregate_Bps:125000000,transfer_cap_Bps:125000000},
      local:{aggregate_Bps:preset==='slow-local'?31250000:250000000,transfer_cap_Bps:250000000}},inventory:[]});
}
