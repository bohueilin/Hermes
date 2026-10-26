// Independent contract tests for the depot lab input layer (annex C1.1, C1.3, C2.1, D1-04, D12-03, C4.7).
// Expected values are transcribed from the controlling documents, never read back from the modules under test.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../src/model/depot-lab/rational.js';
import {MJ_PER_W_TICK,BYTES_PER_MBPS_TICK,MJ_PER_KWH,PACK_MJ,MJ_PER_SOC_PCT,socEnergy,requiredChargeMj,bandAt,nextBandEdge,uncontendedChargeTicks} from '../src/model/depot-lab/units.js';
import {parseStrict,jcs,utf8Length,canonicalBytes} from '../src/model/depot-lab/canonical.js';
import {validateScenario} from '../src/model/depot-lab/schema.js';

// C1.3 vehicle profile constant and D12-01 durations, written out here from the annex.
const BANDS=[{from_soc_pct:0,until_soc_pct:60,cap_w:100000},{from_soc_pct:60,until_soc_pct:80,cap_w:60000},{from_soc_pct:80,until_soc_pct:100,cap_w:30000}];
const VP={capacity_mj:216000000000,storage_capacity_bytes:50000000000,ac_cap_w:11000,dc_bands:BANDS,efficiency:'1/1',thermal_factor:'1/1'};
const CLASSES=['intake','cabin','diagnosis','mechanical_repair','specialist_repair','inspection','connect','unplug','move'];
const PROF={intake:[180,120,90],cabin:[900,600,480],diagnosis:[1680,1200,1020],mechanical_repair:[4800,3600,3300],specialist_repair:[7200,5400,4800],inspection:[420,300,240],connect:[180,120,105],unplug:[150,120,90],move:[120,120,120]};
const LEVELS=['developing','practiced','advanced'];
const row=(c,level='independent',p='practiced',sup=level==='independent')=>({task_class:c,level,proficiency:p,may_supervise:sup,solo_duration_ticks:PROF[c][LEVELS.indexOf(p)]});
const worker=(id,H=43200)=>({id,qualifications:CLASSES.map(c=>row(c)),availability:[{start_tick:0,end_tick:H}]});
const obj=(id,kind,size)=>({id,kind,size_bytes:size,check_ticks:60,activation_ticks:600,postcheck_ticks:60});
const ep=()=>({service_reachable:'reachable',entitlement:'valid'});
const visit=(id,o={})=>({id,arrival_tick:0,due_tick:21600,initial_soc_pct:20,fault:'none',cabin_required:true,installed_object_ids:['map1','sw1'],required_object_ids:['map1','sw2'],initial_log_bytes:5000000000,upload_required:false,task_windows:[{task_template:'cabin',earliest_start_tick:0}],...o});
const base=()=>({
 schema:'fleetlab.depot.scenario.v1',model_version:'depot_model_v1',profile_version:'depot_contract_v1',policy_id:'fcfs_eligible_fair_resources_v1',
 overlap_profile:'serial_activation_connected_inspection_v1',reference_effort_version:'practiced_reference_v1',horizon_tick:43200,arrival_window_tick:21600,
 requirements:{energy:{target_soc_pct:80}},task_windows:{cabin_earliest_start_tick:0},vehicle_profile:structuredClone(VP),
 site:{positions:[{id:'P1',zone:'waiting',enabled:true},{id:'P2',zone:'charging',enabled:true},{id:'P3',zone:'cleaning',enabled:true},{id:'P4',zone:'garage',enabled:true}],ports:[{id:'DC1',position_id:'P2',kind:'DC',rating_w:150000,enabled:true}],lane_count:1,supply_w:300000,background_w:0,garage_level:'basic'},
 workers:[worker('W1')],
 network:{generation:'wifi6',pool_bytes_per_tick:37500000,client_bytes_per_tick:12500000,wan_down_bytes_per_tick:25000000,wan_up_bytes_per_tick:12500000,cache_read_bytes_per_tick:125000000,covered_zones:['charging','cleaning','garage','waiting'],cache:{state:'cold',capacity_bytes:20000000000,initial_object_ids:[]}},
 services:{maps:ep(),software:ep(),uploads:ep()},
 content_objects:[obj('map1','map',500000000),obj('sw1','software',2000000000),obj('sw2','software',2000000000)],
 visits:[visit('01')],
 vendor:{enabled:true,bay_count:1,worker_count:1,outbound_ticks:1800,service_ticks:7200,return_ticks:1800,traction_energy_mj:0,availability:[{start_tick:0,end_tick:43200}]},
});
const imp=s=>validateScenario(s,{origin:'import'});
const at=(r,p)=>r.issues.filter(i=>i.path===p);
const under=(r,p)=>r.issues.some(i=>i.path===p||i.path.startsWith(p+'/'));
const ptr=(s,p)=>{const k=p.split('/').slice(1);let o=s;for(const x of k.slice(0,-1))o=o[x];return [o,k[k.length-1]];};
const put=(s,p,v)=>{const [o,k]=ptr(s,p);o[k]=v;return s;};
const del=(s,p)=>{const [o,k]=ptr(s,p);delete o[k];return s;};
const mut=f=>{const s=base();f(s);return s;};
const okOf=s=>{const r=imp(s);assert.ok(r.ok,JSON.stringify(r.issues));return r.scenario;};

// ---------- rational.js (C1.1, C2.1) ----------
test('rationals reduce, keep a positive denominator and spell zero 0/1',()=>{
 const {Q}=R,pair=r=>[r.n,r.d];
 assert.deepEqual(pair(Q(6n,8n)),[3n,4n]);assert.deepEqual(pair(Q(-6n,-8n)),[3n,4n]);assert.deepEqual(pair(Q(6n,-8n)),[-3n,4n]);
 assert.deepEqual(pair(Q(0n,7n)),[0n,1n]);assert.deepEqual(pair(Q(0n,-7n)),[0n,1n]);assert.deepEqual(pair(Q(5n)),[5n,1n]);
 assert.equal(R.formatRational(Q(6n,8n)),'3/4');assert.equal(R.formatRational(Q(0n,7n)),'0/1');assert.equal(R.formatRational(R.fromInt(12)),'12/1');
 assert.ok(Object.isFrozen(Q(1n,3n)));assert.throws(()=>Q(1n,0n));assert.throws(()=>Q(1,2));
 const t=(a,b)=>[Q(a[0],a[1]),Q(b[0],b[1])];
 assert.equal(R.formatRational(R.add(...t([1n,3n],[1n,6n]))),'1/2');assert.equal(R.formatRational(R.sub(...t([1n,2n],[1n,3n]))),'1/6');
 assert.equal(R.formatRational(R.mul(...t([2n,3n],[3n,4n]))),'1/2');assert.equal(R.formatRational(R.div(...t([1n,2n],[1n,4n]))),'2/1');
 assert.throws(()=>R.div(Q(1n),R.ZERO));assert.equal(R.cmp(...t([1n,3n],[2n,6n])),0);assert.equal(R.cmp(...t([1n,3n],[1n,2n])),-1);
 assert.ok(R.eq(...t([2n,4n],[1n,2n])));assert.ok(R.isZero(Q(0n,9n)));assert.equal(R.formatRational(R.min(...t([1n,3n],[1n,2n]))),'1/3');
 assert.equal(R.formatRational(R.max(...t([1n,3n],[1n,2n]))),'1/2');assert.equal(R.formatRational(R.mulBig(Q(1n,6n),3n)),'1/2');
});
test('canonical wire rationals: one reduced p/q, no sign, no leading zeros, at most 256 digits per component',()=>{
 const n256='9'.repeat(256),n257='1'+'0'.repeat(256);
 for(const ok of ['0/1','3/4','1/1','10/3',`${n256}/1`,`1/${n256}`]){const r=R.parseRational(ok);assert.ok(r,ok);assert.equal(R.formatRational(r),ok);}
 for(const bad of ['6/8','0/7','0/0','1/0','2/4','00/1','01/2','1/02','+1/2','-1/2',' 1/2','1/2 ','1 /2','1/2/3','1','/2','1/','0x1/2','1.5/2','1e2/3',`${n257}/3`,`1/${n257}`,'3\u00a0/4','\uff13/4',3,null,{n:3n,d:4n}])assert.equal(R.parseRational(bad),null,String(bad));
 assert.throws(()=>R.formatRational(R.Q(10n**256n,3n)),e=>e instanceof R.RationalGuardError&&e.code==='INCOMPLETE_RESOURCE_LIMIT');
 assert.throws(()=>R.formatRational(R.Q(-1n,2n)));
});
test('bit-length guard refuses on operand bits before multiplying, never by rounding',()=>{
 assert.deepEqual([0n,1n,255n,256n,-256n,1n<<8191n].map(R.bitLength),[0,1,8,9,9,8192]);
 const a=1n<<4096n,b=1n<<4095n;// 4,097 + 4,096 operand bits refuse although the product itself would have only 8,192 bits
 assert.throws(()=>R.mulInt(a,b),e=>e instanceof R.RationalGuardError&&e.code==='INCOMPLETE_RESOURCE_LIMIT'&&e.reason==='RATIONAL_GUARD'&&e.operand_bits===8193);
 assert.equal(R.mulInt(b,b),1n<<8190n);
 assert.throws(()=>R.mul(R.Q(a),R.Q(b)),R.RationalGuardError);assert.throws(()=>R.add(R.Q(1n,a),R.Q(1n,b)),R.RationalGuardError);
 assert.throws(()=>R.cmp(R.Q(a),R.Q(1n,b)),R.RationalGuardError);// the cross product a x b needs 8,193 bits
 assert.throws(()=>R.Q(1n<<8192n),R.RationalGuardError);assert.equal(R.bitLength(R.Q((1n<<8192n)-1n).n),8192);
});
test('floor and ceil are exact BigInt operations, including negatives',()=>{
 const f=(n,d)=>[R.floor(R.Q(n,d)),R.ceil(R.Q(n,d))];
 assert.deepEqual(f(7n,2n),[3n,4n]);assert.deepEqual(f(-7n,2n),[-4n,-3n]);assert.deepEqual(f(6n,3n),[2n,2n]);assert.deepEqual(f(0n,5n),[0n,0n]);
 assert.deepEqual(f(1n,1000000n),[0n,1n]);assert.deepEqual(f(999999n,1000000n),[0n,1n]);
 assert.equal(R.floorDiv(R.Q(7n,2n)),3n);assert.equal(R.ceilDiv(R.Q(7n,2n)),4n);
});
test('C2.1 anchor oracle: rate 1/2 credits 0 then 1; a real change to 1/3 at tick 1 credits 1 byte over [1,4)',()=>{
 const credit=(rate,a,t,rem)=>{const c=R.floor(R.mulBig(rate,BigInt(t-a)));return c<rem?c:rem;};
 const half=R.Q(1n,2n),third=R.Q(1n,3n);
 assert.equal(credit(half,0,1,1n),0n);assert.equal(credit(half,0,2,1n)-credit(half,0,1,1n),1n);
 assert.equal(R.ceil(R.div(R.Q(1n),half)),2n);// completion tick = anchor + ceil(R q / p)
 assert.equal(credit(half,0,2,1n)-0n,1n);// sub-quantum check at t = 1, H = 2: one more byte is still deliverable, so no refusal
 assert.equal(R.formatRational(R.sub(R.mulBig(half,1n),R.Q(credit(half,0,1,1n)))),'1/2');// discarded slack on a real reallocation
 assert.equal(credit(third,1,4,1n),1n);
});
test('C2.1 21% oracle: 2,160,000,000 mJ, 22 ticks at 100 kW, 40,000,000 mJ undrawn on the final tick',()=>{
 const need=requiredChargeMj(20,21),rate=R.Q(100000n*MJ_PER_W_TICK);
 assert.equal(need,2160000000n);assert.equal(R.ceil(R.div(R.Q(need),rate)),22n);
 assert.equal(R.formatRational(R.sub(R.mulBig(rate,22n),R.Q(need))),'40000000/1');assert.equal(uncontendedChargeTicks(20,21,BANDS,150000),22n);
});

// ---------- units.js and the Q24 equations (D1-04, D12-03) ----------
test('unit constants follow D1-04 and the fixed 60 kWh pack',()=>{
 assert.equal(MJ_PER_W_TICK,1000n);assert.equal(BYTES_PER_MBPS_TICK,125000n);assert.equal(MJ_PER_KWH,3600000000n);
 assert.equal(PACK_MJ,60n*3600000000n);assert.equal(PACK_MJ,216000000000n);assert.equal(MJ_PER_SOC_PCT,2160000000n);
 assert.equal(socEnergy(100),PACK_MJ);assert.equal(socEnergy(60),129600000000n);assert.equal(socEnergy(80),172800000000n);assert.equal(socEnergy(0),0n);
});
const tDc=S=>{const s=BigInt(S),cl=(x,lo,hi)=>x<lo?lo:x>hi?hi:x,n1=cl(s-20n,0n,40n),n2=cl(s-60n,0n,20n),n3=s>80n?s-80n:0n;return (108n*n1+4n)/5n+36n*n2+72n*n3;};
test('E_req(S) = 2,160,000,000 x (S-20) mJ and t_DC(S) = ceil(108 n1/5) + 36 n2 + 72 n3 for every integer S from 20 to 100',()=>{
 for(let S=20;S<=100;S++){
  assert.equal(requiredChargeMj(20,S),2160000000n*BigInt(S-20),`E ${S}`);
  assert.equal(uncontendedChargeTicks(20,S,BANDS,150000),tDc(S),`t ${S}`);
  // AC: one 11 kW interval, ceil(3,600 x E_req / 11) with E_req in kWh.
  assert.equal(uncontendedChargeTicks(20,S,BANDS,11000,VP.ac_cap_w),(2160n*BigInt(S-20)+10n)/11n,`ac ${S}`);
 }
});
test('80% default: 36 kWh, 1,584 s = 864 + 720, DC hold 2,904, AC 11,782 and AC hold 13,102',()=>{
 const need=requiredChargeMj(20,80),nonDraw=120+120+600+60+300+120;// inbound move, connect, activation, postcheck, inspection, unplug
 assert.equal(need,36n*MJ_PER_KWH);assert.equal(need,129600000000n);assert.equal(nonDraw,1320);
 assert.equal(uncontendedChargeTicks(20,60,BANDS,150000),864n);assert.equal(uncontendedChargeTicks(60,80,BANDS,150000),720n);
 assert.equal(uncontendedChargeTicks(20,80,BANDS,150000),1584n);assert.equal(Number(uncontendedChargeTicks(20,80,BANDS,150000))+nonDraw,2904);
 const ac=uncontendedChargeTicks(20,80,BANDS,11000,11000);assert.equal(ac,11782n);assert.equal(Number(ac)+nonDraw,13102);
});
test('Q24 sensitivity rows: 60/80/90/100 give energy, charge time, serial hold and both two-port ceilings',()=>{
 const rows=[[60,24n,864n,2184,36,38,36],[80,36n,1584n,2904,60,28,28],[90,42n,2304n,3624,120,22,22],[100,48n,3024n,4344,120,18,18]];
 for(const [S,kwh,t,hold,marginal,slots,physical]of rows){
  assert.equal(requiredChargeMj(20,S),kwh*MJ_PER_KWH);const c=uncontendedChargeTicks(20,S,BANDS,150000);assert.equal(c,t);
  assert.equal(Number(c)+1320,hold);assert.equal(2*Math.floor(43200/hold),slots);assert.equal(2*Math.floor(43200/(hold+120)),physical);
  const top=bandAt(socEnergy(S)-1n,BANDS).cap_w;assert.equal(3600000/top,marginal);
 }
});
test('bands are half-open stored-energy spans and an exact edge uses the higher-SOC band',()=>{
 const cap=e=>bandAt(e,BANDS).cap_w;
 assert.deepEqual([0n,129599999999n,129600000000n,172799999999n,172800000000n,215999999999n].map(cap),[100000,100000,60000,60000,30000,30000]);
 assert.deepEqual([0n,129599999999n,129600000000n,172800000000n].map(e=>nextBandEdge(e,BANDS)),[129600000000n,129600000000n,172800000000n,216000000000n]);
 assert.equal(nextBandEdge(216000000000n,BANDS),null);
 assert.equal(uncontendedChargeTicks(60,61,BANDS,150000),36n);assert.equal(uncontendedChargeTicks(80,81,BANDS,150000),72n);assert.equal(uncontendedChargeTicks(59,60,BANDS,150000),22n);
});
test('arbitrary initial SOC I generalizes the spans; I >= S gives zero energy and zero charge time',()=>{
 for(let I=0;I<=100;I++)for(let S=20;S<=100;S++){
  const z=x=>x>0?BigInt(x):0n,s1=z(Math.min(S,60)-I),s2=z(Math.min(S,80)-Math.max(I,60)),s3=z(S-Math.max(I,80));
  assert.equal(requiredChargeMj(I,S),z(S-I)*2160000000n,`E ${I}->${S}`);
  assert.equal(uncontendedChargeTicks(I,S,BANDS,150000),(108n*s1+4n)/5n+36n*s2+72n*s3,`t ${I}->${S}`);
 }
});
test('C4.7 Q24 boundary cases 20/21/60/80/90/100, initial = target, initial > target, initial 80 to target 90',()=>{
 assert.deepEqual([20,21,60,80,90,100].map(S=>uncontendedChargeTicks(20,S,BANDS,150000)),[0n,22n,864n,1584n,2304n,3024n]);
 assert.equal(requiredChargeMj(80,80),0n);assert.equal(requiredChargeMj(95,80),0n);assert.equal(uncontendedChargeTicks(95,80,BANDS,150000),0n);
 assert.equal(requiredChargeMj(80,90),6n*MJ_PER_KWH);assert.equal(uncontendedChargeTicks(80,90,BANDS,150000),720n);// the 30 kW tail
});

// ---------- canonical.js strict parser (C1.1, C1.3 guards) ----------
const bad=(text,code)=>{const r=parseStrict(text);assert.equal(r.ok,false,JSON.stringify(text).slice(0,80));if(code)assert.equal(r.issues[0].code,code,JSON.stringify(text).slice(0,80));return r;};
test('strict parse accepts the restricted domain exactly and yields plain objects',()=>{
 const r=parseStrict('{"a":[1,-2,0,9007199254740991,-9007199254740991,true,false,null,"x\\u00e9\\ud83d\\ude00\\n"],"b":{}} \n');
 assert.ok(r.ok);assert.deepEqual(r.value,{a:[1,-2,0,9007199254740991,-9007199254740991,true,false,null,'x\u00e9\u{1F600}\n'],b:{}});
 assert.equal(Object.getPrototypeOf(r.value),Object.prototype);assert.equal(Object.getPrototypeOf(r.value.b),Object.prototype);
});
test('strict parse refuses duplicate keys, including keys equal only after unescaping',()=>{
 bad('{"a":1,"a":2}','DUPLICATE_KEY');bad('{"x":{"a":1,"a":1}}','DUPLICATE_KEY');bad('{"a":1,"\\u0061":2}','DUPLICATE_KEY');assert.ok(parseStrict('{"a":1,"A":2}').ok);
});
test('nesting depth 32 is admitted and 33 refused, whatever the innermost member',()=>{
 const arrays=(k,inner)=>'['.repeat(k)+inner+']'.repeat(k),objects=(k,inner)=>'{"k":'.repeat(k)+inner+'}'.repeat(k);
 for(const inner of ['','1','"s"','null']){assert.ok(parseStrict(arrays(32,inner)).ok,`32 ${inner}`);bad(arrays(33,inner),'NESTING_LIMIT');}
 assert.ok(parseStrict(objects(32,'1')).ok);bad(objects(33,'1'),'NESTING_LIMIT');assert.ok(parseStrict(objects(31,'[]')).ok);bad(objects(32,'[]'),'NESTING_LIMIT');
});
test('numbers: only safe integers, never -0, fractions or exponents',()=>{
 for(const t of ['9007199254740992','-9007199254740992','1'.repeat(500)])bad(t,'UNSAFE_INTEGER');
 for(const t of ['1.0','1.5','-0.0','[0.5]','1e2','1E2','1e+2','-1e-2'])bad(t,'NON_INTEGER_NUMBER');
 bad('-0','NEGATIVE_ZERO');bad('[-0]','NEGATIVE_ZERO');bad('{"a":-0}','NEGATIVE_ZERO');
 for(const t of ['01','[01]','+1','.5','-','NaN','Infinity','0x10'])bad(t);
});
test('strings: lone surrogates refused raw or escaped, in values and keys; control characters refused',()=>{
 for(const t of ['"\ud800"','"\udc00"','"a\ud800b"','"\\ud800"','"\\udc00"','"\\ud800\\u0041"','"\\ude00\\ud83d"','{"\\ud800":1}','["\ud83d\ude00\udc00"]'])bad(t,'LONE_SURROGATE');
 assert.equal(parseStrict('"\\ud83d\\ude00"').value,'\u{1F600}');assert.equal(parseStrict('"\ud83d\ude00"').value,'\u{1F600}');
 bad('"\u0001"','CONTROL_CHARACTER');bad('"\\x41"','BAD_ESCAPE');bad('"\\u12"','BAD_ESCAPE');
});
test('prototype keys are refused, escaped or not, at any depth',()=>{
 for(const t of ['{"__proto__":{}}','{"constructor":1}','{"prototype":1}','{"a":{"__proto__":1}}','[{"constructor":[]}]','{"\\u005f_proto__":1}'])bad(t,'FORBIDDEN_KEY');
 assert.equal({}.polluted,undefined);
});
test('trailing content after the single top-level value is refused; trailing whitespace is not content',()=>{
 for(const t of ['{}x','{} {}','[1]]','1 2','"a""b"','null,','{}\u0000'])bad(t);
 for(const t of ['{} ','{}\n\t\r ',' [ 1 , 2 ] '])assert.ok(parseStrict(t).ok,JSON.stringify(t));
});
test('524,289 UTF-8 bytes are refused before parsing, for ASCII and multibyte text alike',()=>{
 const over=[' '.repeat(524289),'{{{'+'x'.repeat(524286),'"'+'\u20ac'.repeat(174762)+'"x','"'+'\u{1F600}'.repeat(131071)+'"\u00e9}'];
 for(const t of over){
  assert.equal(new TextEncoder().encode(t).length,524289);assert.equal(utf8Length(t),524289);
  const r=parseStrict(t);assert.equal(r.ok,false);assert.equal(r.issues.length,1);assert.equal(r.issues[0].code,'INCOMPLETE_RESOURCE_LIMIT');assert.equal(r.issues[0].value,524289);
 }
 assert.ok(over[2].length<524289&&over[3].length<300000);// the gate counts bytes, not UTF-16 code units
});
test('524,288 UTF-8 bytes pass the size gate, for ASCII and multibyte text alike',()=>{
 const pad=(t,n)=>t+' '.repeat(n-new TextEncoder().encode(t).length);
 const ascii=pad('{"a":1}',524288),multi=pad(JSON.stringify(Array.from({length:40},(_,i)=>(i%2?'\u20ac':'\u{1F600}').repeat(3000))),524288);
 for(const t of [ascii,multi]){assert.equal(new TextEncoder().encode(t).length,524288);const r=parseStrict(t);assert.ok(r.ok,JSON.stringify(r.issues));assert.equal(r.bytes,524288);}
 const nearly='{{'+'x'.repeat(524286);const r=parseStrict(nearly);assert.equal(r.ok,false);assert.notEqual(r.issues[0].code,'INCOMPLETE_RESOURCE_LIMIT');
});
test('utf8Length equals TextEncoder byte length, lone surrogates counting as the replacement character',()=>{
 for(const s of ['','a','\u00e9','\u20ac','\u{1F600}','a\ud800b','\udc00','\ud83d\ude00\ud800','\u0000\u007f\u0080\u07ff\u0800\uffff'])assert.equal(utf8Length(s),new TextEncoder().encode(s).length,JSON.stringify(s));
});

// ---------- JCS (RFC 8785) on the restricted domain ----------
const esc=s=>{let o='"';for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);o+=c===0x22?'\\"':c===0x5c?'\\\\':c===8?'\\b':c===9?'\\t':c===10?'\\n':c===12?'\\f':c===13?'\\r':c<0x20?'\\u'+c.toString(16).padStart(4,'0'):s[i];}return o+'"';};
const u16=(a,b)=>{for(let i=0;i<Math.min(a.length,b.length);i++){const d=a.charCodeAt(i)-b.charCodeAt(i);if(d)return d;}return a.length-b.length;};
const rfc8785=v=>v===null?'null':typeof v==='boolean'?(v?'true':'false'):typeof v==='number'?v.toString(10):typeof v==='string'?esc(v):Array.isArray(v)?'['+v.map(rfc8785).join(',')+']':'{'+Object.keys(v).sort(u16).map(k=>esc(k)+':'+rfc8785(v[k])).join(',')+'}';
test('JCS orders keys by UTF-16 code units, so a non-BMP key sorts before U+FB33 and U+FFFF',()=>{
 const v={'\u20ac':5,'\r':1,'\ufb33':7,'1':2,'\u{1F600}':6,'\u0080':3,'\u00f6':4,'\uffff':8};
 const want='{"\\r":1,"1":2,"\u0080":3,"\u00f6":4,"\u20ac":5,"\u{1F600}":6,"\ufb33":7,"\uffff":8}';
 assert.equal(rfc8785(v),want);assert.equal(jcs(v),want);
 assert.equal(jcs({b:[3,{d:1,c:2}],a:'\u000f"\\\u007f\u2028/'}),'{"a":"\\u000f\\"\\\\\u007f\u2028/","b":[3,{"c":2,"d":1}]}');
 assert.deepEqual([...canonicalBytes({a:'\u00e9'})],[...new TextEncoder().encode('{"a":"\u00e9"}')]);
});
test('JCS equals an independent RFC 8785 serializer on generated restricted-domain values',()=>{
 let seed=20261024;const rnd=n=>{seed=(seed*1103515245+12345)%2147483648;return seed%n;};
 const pool=['','a','A','b','aa','_','-','0','10','9','\u0000','\u001f','"','\\','\u007f','\u00e9','\u2028','\u20ac','\ufb33','\uffff','\u{1F600}','\u{10FFFF}','a\u{1F600}','\u{1F600}a'];
 const str=()=>{let s='';for(let k=rnd(4);k>=0;k--)s+=pool[rnd(pool.length)];return s;};
 const val=d=>{const k=rnd(d>3?4:7);if(k===0)return null;if(k===1)return rnd(2)===1;if(k===2)return [0,1,-1,9007199254740991,-9007199254740991,rnd(100000)-50000][rnd(6)];if(k===3)return str();
  if(k===4||k===5){const o={};for(let n=rnd(5);n>0;n--)o[str()]=val(d+1);return o;}return Array.from({length:rnd(4)},()=>val(d+1));};
 for(let n=0;n<400;n++){const v=val(0);assert.equal(jcs(v),rfc8785(v));}
});
test('JCS refuses values outside the restricted domain',()=>{
 class K{}const holey=[1,,3];const nul=Object.create(null);nul.b=1;nul.a=2;
 for(const v of [1.5,NaN,Infinity,-Infinity,-0,2**53,-(2**53),10n,undefined,()=>1,Symbol('s'),new Date(0),new Map(),new K(),holey,{a:undefined},{a:1.5},['\ud800'],{'\udc00':1},{a:{b:[-0]}}])assert.throws(()=>jcs(v),TypeError);
 assert.equal(jcs(nul),'{"a":2,"b":1}');
});

// ---------- schema.js: closed shape, consts and ranges (C1.3) ----------
test('the base scenario written from the annex validates and normalizes to a frozen copy without mutating input',()=>{
 const s=base(),before=JSON.stringify(s),r=imp(s);
 assert.ok(r.ok,JSON.stringify(r.issues));assert.equal(JSON.stringify(s),before);assert.ok(Object.isFrozen(r.scenario.site.positions[0]));
 assert.notEqual(r.scenario,s);assert.equal(r.scenario.requirements.energy.target_soc_pct,80);
 const t=validateScenario(JSON.stringify(s),{origin:'import'});assert.ok(t.ok);assert.equal(jcs(t.scenario),jcs(r.scenario));
});
test('closed shape: every object refuses an unknown member and every missing required member, at its pointer',()=>{
 const objects=['','/requirements','/requirements/energy','/task_windows','/site','/site/positions/0','/site/ports/0','/workers/0','/workers/0/qualifications/0','/workers/0/availability/0','/network','/network/cache','/services','/services/maps','/services/software','/services/uploads','/content_objects/0','/visits/0','/visits/0/task_windows/0','/vendor','/vendor/availability/0'];
 const node=(s,p)=>p===''?s:ptr(s,p)[0][ptr(s,p)[1]];
 for(const p of objects){
  const r=imp(mut(s=>{node(s,p).extra=1;}));assert.equal(r.ok,false,p);assert.equal(at(r,`${p}/extra`).length,1,`${p}/extra`);
  for(const k of Object.keys(node(base(),p))){const m=imp(mut(s=>{delete node(s,p)[k];}));assert.equal(m.ok,false,`${p}/${k}`);assert.ok(at(m,`${p}/${k}`).length>=1,`${p}/${k} ${JSON.stringify(m.issues)}`);}
 }
 assert.equal(imp([]).ok,false);assert.equal(imp(null).ok,false);assert.equal(imp('[]').ok,false);
});
test('the singular requirement member is an unknown field, never an alias of requirements',()=>{
 const only=mut(s=>{s.requirement=s.requirements;delete s.requirements;});
 for(const origin of ['import','editor']){const r=validateScenario(only,{origin});assert.equal(r.ok,false);assert.equal(at(r,'/requirement').length,1,origin);}
 const both=imp(mut(s=>{s.requirement={energy:{target_soc_pct:80}};}));assert.equal(both.ok,false);assert.equal(at(both,'/requirement').length,1);
 assert.equal(validateScenario(JSON.stringify(mut(s=>{s.requirement=s.requirements;delete s.requirements;})),{origin:'import'}).ok,false);
});
test('constants: versions, policy, overlap, reference effort, vehicle profile and lifecycle durations',()=>{
 const cases=[['/schema','fleetlab.depot.scenario.v2'],['/model_version','depot_model_v2'],['/profile_version','x'],['/policy_id','greedy'],['/overlap_profile','overlap_charging_v1'],['/reference_effort_version','advanced_reference_v1'],['/content_objects/0/check_ticks',61],['/content_objects/0/activation_ticks',599],['/content_objects/0/postcheck_ticks',0],['/vendor/traction_energy_mj',1]];
 for(const [p,v]of cases){const r=imp(put(base(),p,v));assert.equal(r.ok,false,p);assert.ok(at(r,p).length>=1,p);}
 for(const f of [s=>{s.vehicle_profile.ac_cap_w=22000;},s=>{s.vehicle_profile.dc_bands.reverse();},s=>{s.vehicle_profile.dc_bands=[BANDS[1],BANDS[0],BANDS[2]];},s=>{s.vehicle_profile.extra=1;},s=>{s.vehicle_profile.efficiency='2/2';},s=>{delete s.vehicle_profile.thermal_factor;},s=>{s.vehicle_profile=null;}]){
  const r=imp(mut(f));assert.equal(r.ok,false);assert.ok(at(r,'/vehicle_profile').length>=1);
 }
 const keys=mut(s=>{s.vehicle_profile=Object.fromEntries(Object.entries(VP).reverse());s.vehicle_profile.dc_bands=BANDS.map(b=>({cap_w:b.cap_w,until_soc_pct:b.until_soc_pct,from_soc_pct:b.from_soc_pct}));});
 assert.ok(imp(keys).ok,'member order inside the constant is not identity');
});
test('enums and types refuse values outside the declared sets',()=>{
 const cases=[['/site/garage_level','expert'],['/site/positions/0/zone','roof'],['/site/ports/0/kind','XC'],['/network/generation','wifi5'],['/network/cache/state','hot'],['/services/maps/service_reachable','maybe'],['/services/uploads/entitlement','expired'],['/content_objects/0/kind','firmware'],['/visits/0/fault','flat'],['/visits/0/task_windows/0/task_template','teleport'],['/workers/0/qualifications/0/task_class','driving'],['/workers/0/qualifications/0/level','expert'],['/workers/0/qualifications/0/proficiency','expert'],['/network/covered_zones/0','roof'],
  ['/site/positions/0/enabled','true'],['/visits/0/cabin_required',1],['/visits/0/upload_required',null],['/vendor/enabled','yes'],['/workers/0/qualifications/0/may_supervise',0],['/horizon_tick','43200'],['/visits/0/due_tick','21600'],['/site/lane_count',true],['/site/supply_w',300000.5]];
 for(const [p,v]of cases){const r=imp(put(base(),p,v));assert.equal(r.ok,false,p);assert.ok(at(r,p).length>=1,`${p} ${JSON.stringify(r.issues)}`);}
});
test('ids follow ^[A-Za-z0-9][A-Za-z0-9_-]{0,31}$ (32 characters at most, colon never)',()=>{
 for(const id of ['01','A_b-9','x'.repeat(32)])assert.ok(imp(put(base(),'/site/positions/0/id',id)).ok,id);
 for(const id of ['','_a','-a','a:b','a b','\u00e9','a.b','x'.repeat(33),7]){const r=imp(put(base(),'/site/positions/0/id',id));assert.equal(r.ok,false,String(id));assert.ok(at(r,'/site/positions/0/id').length>=1);}
});
const RANGES=[// [pointer, min, max, prepare at min, prepare at max, which ends must be fully valid]
 ['/horizon_tick',1,172800,s=>{s.arrival_window_tick=1;s.workers[0].availability=[{start_tick:0,end_tick:1}];s.vendor.availability=[{start_tick:0,end_tick:1}];s.visits[0].due_tick=0;}],
 ['/arrival_window_tick',1,172800,null,s=>{s.horizon_tick=172800;}],
 ['/requirements/energy/target_soc_pct',20,100],['/task_windows/cabin_earliest_start_tick',0,172800],
 ['/site/lane_count',0,20],['/site/supply_w',0,1000000],['/site/background_w',0,1000000,null,s=>{s.site.supply_w=1000000;}],['/site/ports/0/rating_w',0,1000000],
 ['/workers/0/qualifications/0/solo_duration_ticks',1,172800,null,null,'none'],
 ['/workers/0/availability/0/start_tick',0,172800,null,null,'min'],['/workers/0/availability/0/end_tick',0,172800,null,s=>{s.horizon_tick=172800;},'max'],
 ['/vendor/availability/0/start_tick',0,172800,null,null,'min'],['/vendor/availability/0/end_tick',0,172800,null,s=>{s.horizon_tick=172800;},'max'],
 ['/network/pool_bytes_per_tick',0,625000000],['/network/client_bytes_per_tick',0,125000000],['/network/wan_down_bytes_per_tick',0,250000000],['/network/wan_up_bytes_per_tick',0,250000000],['/network/cache_read_bytes_per_tick',0,625000000],
 ['/network/cache/capacity_bytes',0,500000000000],['/content_objects/0/size_bytes',0,20000000000],
 ['/visits/0/arrival_tick',0,172800,null,null,'min'],['/visits/0/due_tick',0,345600],['/visits/0/initial_soc_pct',0,100],
 ['/visits/0/initial_log_bytes',0,50000000000,null,s=>{s.visits[0].installed_object_ids=[];}],['/visits/0/task_windows/0/earliest_start_tick',0,172800],
 ['/vendor/bay_count',0,1],['/vendor/worker_count',0,1],['/vendor/outbound_ticks',1,172800],['/vendor/service_ticks',1,172800],['/vendor/return_ticks',1,172800],
];
test('every integer range is admitted at its minimum and maximum and refused one beyond',()=>{
 for(const [p,lo,hi,prepLo,prepHi,full='both']of RANGES){
  const codes=v=>{const r=imp(put(base(),p,v));assert.equal(r.ok,false,`${p}=${v}`);const c=at(r,p).map(i=>i.code);assert.ok(c.length,`${p}=${v} ${JSON.stringify(r.issues)}`);return c;};
  const beyond=new Set([...codes(lo-1),...codes(hi+1)]);
  for(const [v,prep,end]of [[lo,prepLo,'min'],[hi,prepHi,'max']]){
   const s=base();prep?.(s);put(s,p,v);const r=imp(s);
   if(full==='both'||full===end)assert.ok(r.ok,`${p}=${v} ${JSON.stringify(r.issues)}`);
   else assert.ok(at(r,p).every(i=>!beyond.has(i.code)),`${p}=${v} refused by its range`);
  }
 }
});
const objs4=[obj('map1','map',500000000),obj('map2','map',500000000),obj('sw1','software',2000000000),obj('sw2','software',2000000000)];
const LENGTHS=[// [pointer, min, max, make(n, scenario)]
 ['/site/positions',1,200,n=>n===1?[{id:'P2',zone:'charging',enabled:true}]:[...base().site.positions,...Array.from({length:Math.max(0,n-4)},(_,i)=>({id:`X${i}`,zone:'waiting',enabled:true}))].slice(0,n)],
 ['/site/ports',0,20,(n,s)=>{s.site.positions.push(...Array.from({length:n},(_,i)=>({id:`C${i}`,zone:'charging',enabled:true})));return Array.from({length:n},(_,i)=>({id:`Q${i}`,position_id:`C${i}`,kind:'AC',rating_w:11000,enabled:true}));}],
 ['/workers',0,20,n=>Array.from({length:n},(_,i)=>worker(`W${i}`))],
 ['/workers/0/qualifications',9,9,n=>[...CLASSES,'cabin'].slice(0,n).map(c=>row(c))],
 ['/workers/0/availability',0,64,n=>Array.from({length:n},(_,i)=>({start_tick:i*100,end_tick:i*100+50}))],
 ['/vendor/availability',0,64,n=>Array.from({length:n},(_,i)=>({start_tick:i*100,end_tick:i*100+50}))],
 ['/network/covered_zones',0,4,n=>['charging','cleaning','garage','waiting','waiting'].slice(0,n)],
 ['/network/cache/initial_object_ids',0,4,(n,s)=>{s.content_objects=structuredClone(objs4);s.network.cache.state=n?'warm':'cold';return ['map1','map2','sw1','sw2','sw2'].slice(0,n);}],
 ['/content_objects',0,4,(n,s)=>{if(n===0)s.visits[0].installed_object_ids=s.visits[0].required_object_ids=[];return [...structuredClone(objs4),obj('x5','map',1)].slice(0,n);}],
 ['/visits',1,200,n=>Array.from({length:n},(_,i)=>visit(`V${i}`))],
 ['/visits/0/installed_object_ids',0,2,n=>['map1','sw1','sw2'].slice(0,n)],['/visits/0/required_object_ids',0,2,n=>['map1','sw2','sw1'].slice(0,n)],
 ['/visits/0/task_windows',0,28,n=>[...['admit','intake','to_garage','diagnosis','repair','vendor_departure','vendor_outbound','vendor_service','vendor_return','vendor_reentry','to_cleaning','cabin','map_download','map_check','software_download','software_check','to_charging','connect','charge','map_activation','map_postcheck','software_activation','software_postcheck','upload','acknowledgment','inspection','unplug','egress'],'cabin'].slice(0,n).map(t=>({task_template:t,earliest_start_tick:0}))],
];
test('every array length is admitted at its minimum and maximum and refused one beyond',()=>{
 for(const [p,lo,hi,make]of LENGTHS){
  for(const n of [lo,hi]){const s=base();put(s,p,make(n,s));const r=imp(s);assert.ok(r.ok,`${p} length ${n} ${JSON.stringify(r.issues.slice(0,3))}`);}
  for(const n of [lo-1,hi+1]){if(n<0)continue;const s=base();put(s,p,make(n,s));const r=imp(s);assert.equal(r.ok,false,`${p} length ${n}`);assert.ok(at(r,p).length>=1,`${p} length ${n} ${JSON.stringify(r.issues.slice(0,3))}`);}
 }
});
test('target SOC: integer 20..100 only; fractional, string, null and out-of-range values are refused on both origins',()=>{
 for(const v of [20,21,60,80,90,100])assert.equal(okOf(put(base(),'/requirements/energy/target_soc_pct',v)).requirements.energy.target_soc_pct,v);
 for(const origin of ['import','editor'])for(const v of [19,101,80.5,79.999,'80',null,true,-0.5]){const r=validateScenario(put(base(),'/requirements/energy/target_soc_pct',v),{origin});assert.equal(r.ok,false,`${origin} ${v}`);assert.ok(at(r,'/requirements/energy/target_soc_pct').length>=1);}
 const text=JSON.stringify(base()).replace('"target_soc_pct":80','"target_soc_pct":80.5');const r=validateScenario(text,{origin:'import'});assert.equal(r.ok,false);
});
test('editor origin materializes target 80, cabin window 0 and visit windows before validation; import refuses each omission',()=>{
 const raw=mut(s=>{delete s.requirements.energy.target_soc_pct;delete s.task_windows;delete s.visits[0].task_windows;}),before=JSON.stringify(raw);
 const e=validateScenario(raw,{origin:'editor'});assert.ok(e.ok,JSON.stringify(e.issues));assert.equal(JSON.stringify(raw),before);
 assert.equal(e.scenario.requirements.energy.target_soc_pct,80);assert.equal(e.scenario.task_windows.cabin_earliest_start_tick,0);assert.deepEqual(e.scenario.visits[0].task_windows,[]);
 for(const [p,f]of [['/requirements/energy/target_soc_pct',s=>{delete s.requirements.energy.target_soc_pct;}],['/task_windows',s=>{delete s.task_windows;}],['/visits/0/task_windows',s=>{delete s.visits[0].task_windows;}]]){
  const one=mut(f);assert.ok(validateScenario(one,{origin:'editor'}).ok,p);
  for(const input of [one,JSON.stringify(one)]){const i=validateScenario(input,{origin:'import'});assert.equal(i.ok,false,p);assert.ok(at(i,p).length>=1,p);}
 }
 assert.equal(validateScenario(mut(s=>{delete s.requirements;}),{origin:'editor'}).scenario.requirements.energy.target_soc_pct,80);
 assert.equal(validateScenario(put(base(),'/requirements/energy/target_soc_pct',60),{origin:'editor'}).scenario.requirements.energy.target_soc_pct,60);
 const rest=validateScenario(mut(s=>{delete s.horizon_tick;}),{origin:'editor'});assert.equal(rest.ok,false);assert.ok(at(rest,'/horizon_tick').length>=1);
});
test('object inputs must be plain data: accessors, sparse arrays, symbol keys and class instances are refused without throwing',()=>{
 let reads=0;const getter=mut(s=>{Object.defineProperty(s.requirements.energy,'target_soc_pct',{enumerable:true,get:()=>++reads>1?500:80});});
 for(const s of [getter,mut(s=>{s.visits=[s.visits[0],,];}),mut(s=>{s.site.positions[5]={id:'P9',zone:'waiting',enabled:true};}),mut(s=>{s.site[Symbol('k')]=1;}),mut(s=>{s.network.cache=new (class{constructor(){this.state='cold';this.capacity_bytes=0;this.initial_object_ids=[];}})();})]){
  for(const origin of ['import','editor']){const r=validateScenario(s,{origin});assert.equal(r.ok,false,origin);}
 }
 const loop=base();loop.site.self=loop.site;assert.equal(imp(loop).ok,false);
});
test('the 524,288-byte input guard applies to scenario text before parsing',()=>{
 const t=JSON.stringify(base()),n=new TextEncoder().encode(t).length;
 assert.ok(validateScenario(t+' '.repeat(524288-n),{origin:'import'}).ok);
 const r=validateScenario(t+' '.repeat(524289-n),{origin:'import'});assert.equal(r.ok,false);assert.equal(r.issues[0].code,'INCOMPLETE_RESOURCE_LIMIT');
 assert.equal(validateScenario(t.replace('"horizon_tick":43200','"horizon_tick":43200,"horizon_tick":43200'),{origin:'import'}).ok,false);
});

// ---------- normalization and duplicate ids (C1.1) ----------
test('ID-keyed collections and set-valued arrays sort by ASCII; qualification rows by class; intervals by (start, end)',()=>{
 const ids=['b','B','a_','a-','0','Z','a'];
 const s=mut(s=>{
  s.site.positions=[...ids.map(id=>({id,zone:'waiting',enabled:true})),{id:'P2',zone:'charging',enabled:true},{id:'P5',zone:'charging',enabled:true}];
  s.site.ports=[{id:'DC2',position_id:'P5',kind:'DC',rating_w:150000,enabled:true},{id:'AC1',position_id:'P2',kind:'AC',rating_w:11000,enabled:true}];
  s.workers=[worker('m'),worker('M'),worker('1')];s.workers[0].qualifications.reverse();s.workers[0].availability=[{start_tick:500,end_tick:900},{start_tick:0,end_tick:100},{start_tick:100,end_tick:500}];
  s.content_objects.reverse();s.visits=[visit('b'),visit('A'),visit('10'),visit('9')];s.visits[0].installed_object_ids=['sw1','map1'];s.visits[0].required_object_ids=['sw2','map1'];
  s.visits[0].task_windows=[{task_template:'upload',earliest_start_tick:5},{task_template:'cabin',earliest_start_tick:7}];
  s.network.covered_zones=['waiting','garage','cleaning','charging'];s.network.cache={state:'warm',capacity_bytes:20000000000,initial_object_ids:['sw2','map1']};
  s.vendor.availability=[{start_tick:10,end_tick:20},{start_tick:0,end_tick:10}];
 });
 const n=okOf(s),idsOf=a=>a.map(x=>x.id);
 assert.deepEqual(idsOf(n.site.positions),['0','B','P2','P5','Z','a','a-','a_','b']);assert.deepEqual(idsOf(n.site.ports),['AC1','DC2']);
 assert.deepEqual(idsOf(n.workers),['1','M','m']);assert.deepEqual(idsOf(n.content_objects),['map1','sw1','sw2']);assert.deepEqual(idsOf(n.visits),['10','9','A','b']);
 const w=n.workers.find(x=>x.id==='m');assert.deepEqual(w.qualifications.map(q=>q.task_class),['cabin','connect','diagnosis','inspection','intake','mechanical_repair','move','specialist_repair','unplug']);
 assert.deepEqual(w.availability,[{start_tick:0,end_tick:100},{start_tick:100,end_tick:500},{start_tick:500,end_tick:900}]);// adjacent declared intervals are kept, not merged
 assert.deepEqual(n.vendor.availability,[{start_tick:0,end_tick:10},{start_tick:10,end_tick:20}]);
 const b=n.visits.find(x=>x.id==='b');assert.deepEqual(b.installed_object_ids,['map1','sw1']);assert.deepEqual(b.required_object_ids,['map1','sw2']);assert.deepEqual(b.task_windows.map(x=>x.task_template),['cabin','upload']);
 assert.deepEqual(n.network.covered_zones,['charging','cleaning','garage','waiting']);assert.deepEqual(n.network.cache.initial_object_ids,['map1','sw2']);
 assert.deepEqual(n.vehicle_profile.dc_bands,BANDS);
});
test('duplicate ids are refused in every typed collection and set-valued array',()=>{
 const cases=[
  ['/site/positions',s=>{s.site.positions.push({id:'P1',zone:'waiting',enabled:true});}],
  ['/site/ports',s=>{s.site.positions.push({id:'P5',zone:'charging',enabled:true});s.site.ports.push({id:'DC1',position_id:'P5',kind:'DC',rating_w:150000,enabled:true});}],
  ['/workers',s=>{s.workers.push(worker('W1'));}],['/content_objects',s=>{s.content_objects.push(obj('sw2','software',2000000000));}],['/visits',s=>{s.visits.push(visit('01'));}],
  ['/network/covered_zones',s=>{s.network.covered_zones=['waiting','waiting'];}],['/visits/0/installed_object_ids',s=>{s.visits[0].installed_object_ids=['sw1','sw1'];}],
  ['/visits/0/required_object_ids',s=>{s.visits[0].required_object_ids=['sw2','sw2'];}],['/network/cache/initial_object_ids',s=>{s.network.cache={state:'warm',capacity_bytes:20000000000,initial_object_ids:['sw2','sw2']};}],
  ['/workers/0/qualifications',s=>{s.workers[0].qualifications[8]=row('cabin');}],['/visits/0/task_windows',s=>{s.visits[0].task_windows.push({task_template:'cabin',earliest_start_tick:9});}],
 ];
 for(const [p,f]of cases){const r=imp(mut(f));assert.equal(r.ok,false,p);assert.ok(under(r,p),`${p} ${JSON.stringify(r.issues)}`);}
 assert.equal(imp(mut(s=>{s.visits.push(visit('1'));})).ok,true,'01 and 1 are different ids');
});

// ---------- C1.3 mandatory semantic validation and engineering note section 5 ----------
const SEMANTIC=[// [rule, positive mutation, negative mutation, pointer prefix of the refusal]
 ['1 <= A <= H',s=>{s.arrival_window_tick=43200;},s=>{s.arrival_window_tick=43201;},'/arrival_window_tick'],
 ['arrivals lie in [0, A)',s=>{s.visits[0].arrival_tick=21599;},s=>{s.visits[0].arrival_tick=21600;s.visits[0].due_tick=21600;},'/visits/0/arrival_tick'],
 ['due is null or >= arrival, even after H',s=>{s.visits=[visit('a',{due_tick:null}),visit('b',{arrival_tick:100,due_tick:100}),visit('c',{due_tick:345600})];},s=>{s.visits[0].arrival_tick=100;s.visits[0].due_tick=99;},'/visits/0/due_tick'],
 ['port position reference resolves',s=>{},s=>{s.site.ports[0].position_id='P9';},'/site/ports/0'],
 ['installed reference resolves',s=>{},s=>{s.visits[0].installed_object_ids=['map1','nope'];},'/visits/0/installed_object_ids'],
 ['required reference resolves',s=>{},s=>{s.visits[0].required_object_ids=['nope','sw2'];},'/visits/0/required_object_ids'],
 ['cache objects resolve',s=>{s.network.cache={state:'warm',capacity_bytes:20000000000,initial_object_ids:['sw2']};},s=>{s.network.cache={state:'warm',capacity_bytes:20000000000,initial_object_ids:['nope']};},'/network/cache/initial_object_ids'],
 ['every port reaches a charging position',s=>{},s=>{s.site.ports[0].position_id='P1';},'/site/ports/0'],
 ['no two ports reach the same position',s=>{s.site.positions.push({id:'P5',zone:'charging',enabled:true});s.site.ports.push({id:'DC2',position_id:'P5',kind:'DC',rating_w:150000,enabled:true});},s=>{s.site.ports.push({id:'DC2',position_id:'P2',kind:'AC',rating_w:11000,enabled:true});},'/site/ports'],
 ['background <= supply',s=>{s.site.background_w=300000;},s=>{s.site.background_w=300001;},'/site/background_w'],
 ['cold cache starts empty',s=>{},s=>{s.network.cache.initial_object_ids=['sw2'];},'/network/cache/initial_object_ids'],
 ['off cache starts empty',s=>{s.network.cache={state:'off',capacity_bytes:0,initial_object_ids:[]};},s=>{s.network.cache={state:'off',capacity_bytes:20000000000,initial_object_ids:['sw2']};},'/network/cache/initial_object_ids'],
 ['warm objects fit the cache in full',s=>{s.network.cache={state:'warm',capacity_bytes:2500000000,initial_object_ids:['map1','sw2']};},s=>{s.network.cache={state:'warm',capacity_bytes:2499999999,initial_object_ids:['map1','sw2']};},'/network/cache'],
 ['one installed object per kind',s=>{},s=>{s.visits[0].installed_object_ids=['sw1','sw2'];},'/visits/0/installed_object_ids'],
 ['one required object per kind',s=>{s.content_objects.push(obj('map2','map',500000000));s.visits[0].required_object_ids=['map2','sw2'];},s=>{s.content_objects.push(obj('map2','map',500000000));s.visits[0].required_object_ids=['map1','map2'];},'/visits/0/required_object_ids'],
 ['initial content and logs fit 50 GB',s=>{s.visits[0].initial_log_bytes=47500000000;},s=>{s.visits[0].initial_log_bytes=47500000001;},'/visits/0'],
 ['one qualification row per attended class',s=>{},s=>{s.workers[0].qualifications[8]=row('cabin');},'/workers/0/qualifications'],
 ['may_supervise requires independent',s=>{s.workers[0].qualifications[1]=row('cabin','independent','practiced',true);},s=>{s.workers[0].qualifications[1]=row('cabin','supervised_only','practiced',true);},'/workers/0/qualifications'],
 ['an unqualified row cannot supervise',s=>{s.workers[0].qualifications[1]=row('cabin','unqualified','practiced',false);},s=>{s.workers[0].qualifications[1]=row('cabin','unqualified','practiced',true);},'/workers/0/qualifications'],
 ['solo duration follows the proficiency table',s=>{s.workers[0].qualifications[1]=row('cabin','independent','advanced');},s=>{s.workers[0].qualifications[1].solo_duration_ticks=601;},'/workers/0/qualifications'],
 ['availability intervals are nonempty',s=>{s.workers[0].availability=[{start_tick:100,end_tick:101}];},s=>{s.workers[0].availability=[{start_tick:100,end_tick:100}];},'/workers/0/availability'],
 ['availability intervals do not overlap; adjacent ones are allowed',s=>{s.workers[0].availability=[{start_tick:100,end_tick:200},{start_tick:0,end_tick:100}];},s=>{s.workers[0].availability=[{start_tick:0,end_tick:100},{start_tick:50,end_tick:200}];},'/workers/0/availability'],
 ['availability lies inside [0, H)',s=>{s.workers[0].availability=[{start_tick:0,end_tick:43200}];},s=>{s.workers[0].availability=[{start_tick:0,end_tick:43201}];},'/workers/0/availability'],
 ['vendor availability follows the same rules',s=>{s.vendor.availability=[{start_tick:0,end_tick:10},{start_tick:10,end_tick:43200}];},s=>{s.vendor.availability=[{start_tick:0,end_tick:10},{start_tick:5,end_tick:43201}];},'/vendor/availability'],
 ['vendor bay and worker counts may be zero; a disabled vendor is valid input',s=>{s.vendor.bay_count=0;s.vendor.worker_count=0;s.vendor.enabled=false;},s=>{s.vendor.bay_count=2;},'/vendor/bay_count'],
 ['task windows are unique by template',s=>{s.visits[0].task_windows.push({task_template:'upload',earliest_start_tick:9});},s=>{s.visits[0].task_windows.push({task_template:'cabin',earliest_start_tick:9});},'/visits/0/task_windows'],
 ['covered zones are a set',s=>{s.network.covered_zones=[];},s=>{s.network.covered_zones=['garage','garage'];},'/network/covered_zones'],
 ['zero resources are deliberate unavailable inputs, not errors',s=>{s.site.lane_count=0;s.workers=[];s.site.ports=[];s.site.supply_w=0;s.network.pool_bytes_per_tick=0;s.network.wan_down_bytes_per_tick=0;s.site.positions[1].enabled=false;},s=>{s.site.lane_count=-1;},'/site/lane_count'],
 ['the largest catalog compiles within 32 tasks',s=>{s.site.garage_level='none';s.content_objects.push(obj('map2','map',500000000));s.visits[0]=visit('01',{fault:'mechanical',required_object_ids:['map2','sw2'],upload_required:true});},s=>{s.visits[0].fault='broken';},'/visits/0/fault'],
];
test('every C1.3 semantic rule and note section 5 addition has one admitted and one refused case',()=>{
 for(const [rule,pos,neg,p]of SEMANTIC){
  const r=imp(mut(pos));assert.ok(r.ok,`${rule}: ${JSON.stringify(r.issues)}`);
  const m=imp(mut(neg));assert.equal(m.ok,false,rule);assert.ok(under(m,p),`${rule}: ${JSON.stringify(m.issues)}`);
 }
});
test('every proficiency duration in the D12-01 table is admitted exactly; one second off is refused',()=>{
 for(const c of CLASSES)for(const p of LEVELS){
  const k=CLASSES.indexOf(c),t=PROF[c][LEVELS.indexOf(p)];
  assert.ok(imp(mut(s=>{s.workers[0].qualifications[k]=row(c,'independent',p);})).ok,`${c} ${p}`);
  for(const d of [t-1,t+1])assert.equal(imp(mut(s=>{s.workers[0].qualifications[k]={...row(c,'independent',p),solo_duration_ticks:d};})).ok,false,`${c} ${p} ${d}`);
 }
});
