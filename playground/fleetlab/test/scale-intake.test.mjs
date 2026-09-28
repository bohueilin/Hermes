// Lab B of the Scale lab, "fleet-intake": the lab's own laws, controls, identities, refusals, copy and pinned values.
// The shell test (scale-lab.test.mjs) holds the contract; this file holds what only this lab can know.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {LAB,INTERNALS} from '../src/model/scale-intake.js';
import {scaleJson} from '../src/model/scale-contract.js';
import {cellText} from '../src/ui/scale-lab.js';
import {sha256Hex} from '../src/core/sha256.js';
import {u32} from '../src/core/keyed.js';

const PINS=JSON.parse(readFileSync(new URL('./scale-intake.pins.json',import.meta.url),'utf8'));
const SOURCE=readFileSync(new URL('../src/model/scale-intake.js',import.meta.url),'utf8');
const SELF=readFileSync(new URL(import.meta.url),'utf8'),PINS_TEXT=readFileSync(new URL('./scale-intake.pins.json',import.meta.url),'utf8');
const {size,tapeOf,simulate,PLAN,STANDING}=INTERNALS;
const FLEET=624,PLACES=96,RATE=24,WEEKS=26,H=104,IDLE=13,HELD=2,MARGIN=.02,EVERY=4;
const CONTROL={id:'control',ahead:0,pace:1,open:false};
const drain=g=>{let s;do{s=g.next();}while(!s.done);return s.value;};
const plain=x=>JSON.parse(JSON.stringify(x));
const press=(config,hooks)=>{const d=LAB.derive(config);assert.equal(d.ok,true,JSON.stringify(config));return {d,r:drain(LAB.steps(d.setup,hooks))};};
const value=c=>c.v;
/** Setups across the accepted region: the default, the four corners that run, and three between. The release week is a fixed
 * teaching assumption, week 16 with a range of 12 to 20, so a setup is two typed lead times. */
const SETUPS=[{power:48,ports:24},{power:56,ports:16},{power:56,ports:28},{power:24,ports:16},{power:36,ports:28},{power:40,ports:24},{power:44,ports:20},{power:32,ports:24}];
const H3=/\b(predict(?:s|ed|ing|ion|ions|ive)?|forecast(?:s|ed|ing|er|ers)?|expected\s+traffic|live|real[\s-]?time|monitoring)\b/i;
const H6=/\b(wins?|winners?|beats|scores?|scoring|gauges?|grades?|leaderboards?|revenue|costs?)\b|better option|best configuration/i;
const V=/\b(improved|regressed|unchanged|inconclusive|advance_to_next_test|run_more_experiments|no_recommendation|hold)\b/i;
const DIRECTION=/\b(lower|higher|more|fewer|less|rises?|rising|falls?|falling|longer|shorter|slower|faster|increases?|increased|decreases?|decreased|grows?|drops?|up|down|above|below|better|worse)\b/i;
const HOUSE=/\b(should|prove[sn]?|guarantee\w*|safe|safety|monitor\w*)\b/i;
const LINKS=/https?:/i,DASH=/[–—]/;
const clean=(text,list,what)=>{for(const re of list){const m=re.exec(text);assert.ok(!m,m?`${what}: "${m[0]}" in ${text}`:'');}};
const texts=cell=>typeof cell==='string'?[cell]:cell&&typeof cell.u==='string'?[cell.u]:cell&&typeof cell.absent==='string'?[cell.absent]:[];

test('the default setup reproduces its pinned values exactly, for both arms',()=>{
  assert.equal(PINS.version,LAB.version);assert.deepEqual(PINS.seeds,[...LAB.seeds]);assert.deepEqual(PINS.defaults,LAB.defaults());
  for(const [arm,pin] of Object.entries(PINS.arms)){
    const {d,r}=press({...LAB.defaults(),arm}),a=r.analysis;
    assert.equal(r.label,pin.label,arm);assert.equal(r.digest,pin.digest);
    assert.equal(sha256Hex(scaleJson(plain(r))),pin.result_sha256,`${arm}: the whole result`);
    assert.deepEqual([d.setup.ratio,d.setup.room,d.setup.ahead],[pin.setup.ratio,pin.setup.room,pin.setup.ahead]);
    assert.deepEqual([a.outcome,a.recommendation],[pin.main.outcome,pin.main.recommendation]);
    for(const k of ['baseline_mean','candidate_mean','mean_delta','median_delta','ci_low','ci_high'])assert.equal(a.primary[k],pin.main[k],`${arm} ${k}`);
    assert.deepEqual(plain(a.guardrail_statuses[0]),pin.main.guardrail);
    assert.deepEqual(r.controls.map(c=>[c.label,c.analysis.outcome,c.analysis.recommendation,c.analysis.guardrail_statuses[0].harm]),pin.controls.map(c=>[c.label,c.outcome,c.recommendation,c.guardrail.harm]));
    assert.deepEqual(plain(r.tables),pin.tables);assert.deepEqual(plain(r.chart),pin.chart);assert.deepEqual(plain(d.rows),pin.inputs);
    assert.ok(JSON.stringify(r).length<=65536,'the record fits under Exact values');
  }
  // The values a reader meets first, to four decimals, so that a changed pin is read by a person.
  const m=PINS.arms.middle.main,e=PINS.arms.end.main,f=x=>Number(x.toFixed(4));
  assert.deepEqual([f(m.baseline_mean),f(m.mean_delta),f(m.ci_low),f(m.ci_high),f(m.guardrail.harm)],[.5696,.1847,.1722,.1965,5.6024]);
  assert.deepEqual([f(e.mean_delta),f(e.ci_low),f(e.ci_high),f(e.guardrail.harm)],[.2161,.1961,.2355,14.4722]);
  assert.deepEqual([m.outcome,m.recommendation,e.outcome,e.recommendation],['IMPROVED','ADVANCE_TO_NEXT_TEST','IMPROVED','HOLD']);
  // The depot door rows of the vehicle-weeks table, control then other arm: depot induction, site power, ports.
  const door=arm=>PINS.arms[arm].tables[1].rows.slice(3,6).map(row=>[row[0],f(row[1].v),f(row[2].v)]);
  assert.deepEqual(door('middle'),[['Waiting: depot induction',290,321],['Waiting: site power',20106.1667,4943.6667],['Waiting: ports',0,4534.5]]);
  assert.deepEqual(door('end'),[['Waiting: depot induction',290,386],['Waiting: site power',20106.1667,947.9167],['Waiting: ports',0,6662.25]]);
});

test('conservation, the order of the counts, the gap identity and the horizon hold in every run',()=>{
  let runs=0;
  for(const c of SETUPS)for(const arm of ['middle','end']){
    const s=LAB.derive({...c,arm}).setup,arms=[s.main.spec.candidate,...s.checks.flatMap(k=>[k.spec.baseline,k.spec.candidate])];
    for(const seed of LAB.seeds)for(const a of arms){
      const r=simulate(a,tapeOf(s,seed));runs++;
      assert.equal(r.violation,null);
      assert.equal(r.sumD-r.sumS,r.held.reduce((x,y)=>x+y,0)+r.sumIn+r.sumR,'delivered less in service is waiting by gate, plus in process, plus out of service');
      assert.equal(r.rows.length,H);assert.ok(r.sumS/PLAN<=1);
      const ready=r.tape.lead[0].map((_,k)=>Math.max(...r.tape.lead.map((row,i)=>1+k*4+(i?row[k]:(a.open?0:row[k])-a.ahead))));
      assert.ok(Math.max(...ready)<=H-13,'every tranche is ready with a quarter of the horizon left');
      assert.ok(r.rows.every(x=>x[0]>=x[1]&&x[1]>=x[2]&&x[2]>=x[3]&&x[3]>=x[4]&&x[4]===x[5]+x[6]));
    }
  }
  assert.equal(runs,SETUPS.length*2*12*7);
});

test('each week the depot door stock is split: depot induction holds what a place was left for, the resource that holds the next tranche holds the rest',()=>{
  let runs=0,most=0;
  for(const c of SETUPS)for(const arm of ['middle','end']){
    const s=LAB.derive({...c,arm}).setup;
    for(const a of [s.main.spec.candidate,...s.checks.flatMap(k=>[k.spec.baseline,k.spec.candidate])])for(const seed of LAB.seeds){
      const r=simulate(a,tapeOf(s,seed)),lands=r.tape.lead.map((row,i)=>row.map((lead,k)=>1+k*EVERY+(i?lead:(a.open?0:lead)-a.ahead)));
      const ready=lands[0].map((_,k)=>Math.max(...lands.map(x=>x[k]))),door=[0,0,0,0,0];let places=0,last=0;
      for(const [t,row] of r.rows.entries()){
        const stock=row[3]-row[4],left=PLACES*(1+ready.filter(w=>w<=t+1).length)-row[5]-row[6],next=Math.min(...ready.filter(w=>w>t+1)),held=next===Infinity?stock:Math.min(stock,left);
        assert.ok(left>=0&&stock>=0);door[0]+=held;if(stock>held)door[1+lands.findIndex(x=>x[ready.indexOf(next)]===next)]+=stock-held;
        if(stock>0){if(next===Infinity)last+=stock;else places+=left;}
      }
      runs++;most=Math.max(most,r.held[3]);
      assert.deepEqual(r.held.slice(3),door,`${JSON.stringify(c)} ${a.id} seed ${seed}: the depot door rows, induction first`);
      assert.ok(r.held[3]<=places+last,'depot induction holds no vehicle that had no place to enter');
    }
  }
  assert.equal(runs,SETUPS.length*2*12*7);assert.ok(most>0);
});

test('with every gate open and no removal, rider service is delivery two weeks earlier and the plan is met exactly',()=>{
  const s=size(LAB.defaults()),t=tapeOf(s,7001),zero=t.remove.map(()=>0);
  const r=simulate(CONTROL,{...t,release:1,lead:t.lead.map(row=>row.map(()=>0)),rework:zero,remove:zero});
  for(let w=1;w<=H;w++)assert.equal(r.rows[w-1][5],w>2?r.rows[w-3][0]:0,`week ${w}`);
  assert.equal(r.sumS,PLAN);assert.equal(PLAN,55848);
});

test('every draw is on the tape, the tape never sees the arm, and a run replays exactly',()=>{
  const s=size(LAB.defaults()),a=tapeOf(s,7001);
  assert.deepEqual(Object.keys(a).sort(),['lead','release','remove','rework','seed','turn']);
  assert.equal(scaleJson(a),scaleJson(tapeOf(s,7001)));assert.notEqual(scaleJson(a),scaleJson(tapeOf(s,7002)));
  assert.equal(tapeOf.length,2,'the tape is a function of the sizes and the seed only');
  const body=SOURCE.slice(SOURCE.indexOf('function simulate('),SOURCE.indexOf('const metrics='));
  assert.ok(body.length>1500);assert.doesNotMatch(body,/u32|keyed|tapeOf/,'the weekly update makes no keyed draw');
  assert.equal(JSON.stringify(simulate(CONTROL,a)),JSON.stringify(simulate(CONTROL,tapeOf(s,7001))));
  for(const [i,[lo,hi]] of s.ranges.entries())for(const lead of a.lead[i])assert.ok(Number.isInteger(lead)&&lead>=lo&&lead<=hi);
  assert.ok(a.release>=s.release[0]&&a.release<=s.release[1]);
});

test('the controls can fail: six injected pairing defects stop the press before any arm is read',()=>{
  const others=['middle','end'];
  const defects=[
    [{bend:(arm,t)=>u32('defect',arm.id,t)},/the null control moved/],
    [{bend:(arm,t)=>u32('defect',arm.ahead,t)},/the non-binding order control moved/],
    [{bend:(arm,t)=>u32('defect',arm.pace*100,t)},/the non-binding deliveries control moved/],
    [{tape:(s,seed,arm)=>tapeOf(s,arm.id==='null'?seed+1:seed)},/the two arms did not share their draws/],
    [{tape:(s,seed,arm)=>tapeOf(s,others.includes(arm.id)?seed+1:seed)},/the two arms did not share their draws/],
    [{tape:(s,seed,arm)=>{const t=tapeOf(s,seed);return others.includes(arm.id)?{...t,lead:t.lead.map(r=>r.map(x=>x+1))}:t;}},/the two arms did not share their draws/],
  ];
  for(const arm of others){
    const setup=LAB.derive({...LAB.defaults(),arm}).setup;
    for(const [hooks,message] of defects)assert.throws(()=>drain(LAB.steps(setup,hooks)),e=>e instanceof RangeError&&message.test(e.message)&&/^Seed 7001, /.test(e.message)&&/No arm can be read\.$/.test(e.message));
    assert.equal(drain(LAB.steps(setup)).validity,'VALID');
  }
  // The margin alone would have passed the first defect: the exact rule is what catches it.
  const s=LAB.derive(LAB.defaults()).setup,bend=(arm,t)=>u32('defect',arm.id,t);
  const deltas=LAB.seeds.map(seed=>{const tape=tapeOf(s,seed);return (simulate(s.checks[0].spec.candidate,tape,bend).sumS-simulate(s.checks[0].spec.baseline,tape,bend).sumS)/PLAN;});
  assert.ok(deltas.every(x=>x!==0)&&deltas.every(x=>Math.abs(x)<MARGIN));
});

test('a replay that differs in any pair, a control included, voids the press through the instrument',()=>{
  // A pair makes 25 runs: seed 7001 baseline, candidate, baseline again (the replay), then 11 more seeds. One tape is built per run.
  for(const [index,name] of ['Null control','Non-binding order control','Non-binding deliveries control','Paired runs'].entries()){
    let run=-1;const replay=()=>Math.floor(run/25)===index&&run%25===2;
    const r=drain(LAB.steps(LAB.derive(LAB.defaults()).setup,{tape:(s,seed)=>{run++;return tapeOf(s,seed);},bend:(arm,t)=>replay()&&t===60?4294967295:undefined}));
    assert.equal(run,99,'four pairs of 25 runs');
    assert.equal(r.validity,'INVALID_EXPERIMENT',name);assert.equal(r.analysis.invalidity_reason,'REPLICATION_MISMATCH');assert.equal(r.analysis.recommendation,'NO_RECOMMENDATION');
    assert.equal(r.spec.control,[ 'null','non-binding','non-binding',null][index],'the press returns the pair that failed');
    assert.equal(r.tables,undefined,'an invalid press carries no table, no chart and no note');assert.equal(r.chart,undefined);
  }
});

test('the three controls read as declared at every pinned setup',()=>{
  for(const c of SETUPS)for(const arm of ['middle','end']){
    const {r}=press({...c,arm}),[zero,order,pace]=r.controls.map(x=>x.analysis);
    assert.deepEqual(r.controls.map(x=>x.spec.control),['null','non-binding','non-binding']);
    for(const m of [zero.primary,...zero.guardrail_results,...zero.descriptives])assert.ok(m.paired_deltas.every(x=>x===0),'null control, every measure, every seed');
    assert.deepEqual([zero.outcome,zero.recommendation],['UNCHANGED','NO_RECOMMENDATION']);
    const room=c.power-c.ports,past=room>IDLE;
    assert.ok(order.primary.paired_deltas.every(x=>x===0));assert.equal(order.guardrail_statuses[0].harm,room,'a gate that cannot bind, ordered ahead, buys idle weeks and nothing else');
    assert.deepEqual([order.outcome,order.recommendation,order.guardrail_statuses[0].status],['UNCHANGED',past?'HOLD':'NO_RECOMMENDATION',past?'REGRESSED':'WITHIN']);
    assert.ok(pace.primary.paired_deltas.every(x=>x===0));assert.deepEqual([pace.outcome,pace.recommendation,pace.guardrail_statuses[0].status],['UNCHANGED','HOLD','REGRESSED']);
    assert.equal(pace.guardrail_statuses[0].metric,'weeks not in service per delivered vehicle');
    assert.ok(Math.abs(pace.guardrail_statuses[0].harm-2700/FLEET)<1e-9,'the added waiting is arithmetic on the delivery plan');
  }
});

test('the note on the deliveries control says where the added waiting sits, as the recorded rows have it',()=>{
  for(const c of SETUPS){
    const {d,r}=press({...c,arm:'middle'}),s=d.setup,pace=s.checks[2].spec.candidate,added=new Array(8).fill(0);
    assert.equal(pace.id,'pace');
    for(const seed of LAB.seeds){
      const tape=tapeOf(s,seed),a=simulate(CONTROL,tape),b=simulate(pace,tape);
      assert.deepEqual([b.sumD-a.sumD,b.sumS-a.sumS,b.sumR-a.sumR,b.sumIn-a.sumIn],[2700,0,0,0],'all of the added vehicle-weeks are waiting');
      assert.equal(5*(b.held[0]-a.held[0]),2*2700,'two fifths of the added waiting is at integration, on every seed');
      b.held.forEach((h,g)=>{added[g]+=h-a.held[g];});
    }
    const [line,check,gate,...door]=added,depot=door.reduce((x,y)=>x+y,0);
    assert.ok(check>0&&gate>0&&depot>0,'each gate the note names holds some of the rest');assert.equal(line+check+gate+depot,2700*12,'and the note leaves no gate out');
    assert.ok(line<gate+depot,`${JSON.stringify(c)}: the release gate and the depot door hold over the share of integration`);
    assert.match(r.notes[5],/^The deliveries control reads the same in every accepted setup: .* Line rates stay, so two fifths of it sits at integration and the rest at validation and rework, the release gate and the depot door\.$/);
    assert.doesNotMatch(r.notes.join(' '),/the extra vehicles wait at integration/);
  }
});

test('the four laws show at every pinned setup, and the recommendation varies with the setup',()=>{
  const seen=new Set();
  for(const c of SETUPS){
    const m=press({...c,arm:'middle'}),e=press({...c,arm:'end'}),room=c.power-c.ports;
    const wait=(x,gate)=>x.r.tables[1].rows.find(row=>row[0]===`Waiting: ${gate}`).slice(1).map(value);
    // Law 1, lead-time mismatch: the whole interval clears the margin, by at least the margin again.
    assert.equal(m.r.analysis.outcome,'IMPROVED');assert.equal(e.r.analysis.outcome,'IMPROVED');assert.ok(m.r.analysis.primary.ci_low>=2*MARGIN,JSON.stringify(c));
    // Law 2, the release wave: the stock on opening is at least three weeks of deliveries and within one week of the hand value.
    const stock=m.r.tables[3].rows[1];assert.ok(value(stock[3])>=3*RATE&&Math.abs(value(stock[3])-value(stock[2]))<=RATE);
    // Law 3, the binding gate moves: waiting on site power falls by half or more and waiting on ports grows.
    for(const x of [m,e]){const [p0,p1]=wait(x,'site power'),[q0,q1]=wait(x,'ports');assert.ok(p1<=p0/2,JSON.stringify(c));assert.ok(q1>q0&&q1>0);}
    assert.match(e.r.tables[1].caption,/Most depot door waiting: site power under the control; ports in the other arm\./);
    // Law 4, several counts: at least four of six counts differ in one week, and rider service is under half of delivered.
    const counts=m.r.tables[0].rows.slice(0,6).map(row=>Math.round(value(row[2])));
    assert.ok(new Set(counts).size>=4&&counts[5]<=counts[0]/2,String(counts));
    // The idle trade as a shape, not as a word: idle weeks rise with the weeks ahead while the gain per week falls.
    const gm=m.r.analysis.primary.mean_delta,ge=e.r.analysis.primary.mean_delta,im=m.r.analysis.guardrail_statuses[0].harm,ie=e.r.analysis.guardrail_statuses[0].harm;
    assert.ok(ie>im&&im>0);assert.ok((ge-gm)/(e.d.setup.ahead-m.d.setup.ahead)<gm/m.d.setup.ahead);
    assert.equal(m.d.setup.ahead,room);assert.equal(e.d.setup.ahead,c.power+Math.round(c.power/4)-c.ports);
    // The weeks ahead table: five order weeks from the control to the whole lead time. The third and fourth rows are the two arms.
    for(const x of [m,e]){
      const t=x.r.tables[2],rows=t.rows.map(row=>row.slice(0,3).map(value));
      assert.match(t.caption,/^Lead-time mismatch\. Weeks ahead, gain and idle weeks: /);assert.deepEqual(x.r.tables.map(k=>k.caption.split(/[.:]/)[0]),['One fleet, several counts','The gate that binds','Lead-time mismatch','The gain and the release stock by hand'],'a topic heads every caption');assert.deepEqual(rows.map(w=>w[0]),[0,Math.round(room/2),room,e.d.setup.ahead,c.power]);assert.deepEqual(rows[0],[0,0,0]);
      assert.ok(Math.abs(rows[2][1]-gm)<1e-12&&Math.abs(rows[3][1]-ge)<1e-12&&Math.abs(rows[2][2]-im)<1e-12&&Math.abs(rows[3][2]-ie)<1e-12,'the arms are rows of the curve');
      for(let i=1;i<5;i++){assert.ok(rows[i][0]>rows[i-1][0]&&rows[i][1]>=rows[i-1][1]&&rows[i][2]>rows[i-1][2],`${JSON.stringify(c)} row ${i}`);}
      const slope=i=>(rows[i][1]-rows[i-1][1])/(rows[i][0]-rows[i-1][0]);assert.ok(slope(4)<slope(1)/2,'the gain per added week at the end is under half of the first');
      assert.deepEqual(t.rows.map(row=>row[3]),rows.map(w=>w[2]>IDLE?'past it':'inside it'));
    }
    assert.equal(m.r.analysis.recommendation,'ADVANCE_TO_NEXT_TEST');
    seen.add(e.r.analysis.recommendation);
    // No bound and no harm sits where rounding to the shown decimals could put it on its threshold.
    for(const x of [m,e]){const p=x.r.analysis.primary,g=x.r.analysis.guardrail_statuses[0];assert.ok(Math.abs(p.ci_low-MARGIN)>.0005);assert.ok(Math.abs(g.harm-IDLE)>.05,`${JSON.stringify(c)} idle ${g.harm}`);}
  }
  assert.deepEqual([...seen].sort(),['ADVANCE_TO_NEXT_TEST','HOLD'],'the second arm is inside the allowance at some setups and past it at others');
});

test('the vehicle-weeks rows sum to the total before rounding, and as printed they stay within the number of rows of it, as the caption says',()=>{
  const shown=c=>Number(cellText(c).replace(/,/g,''));let apart=0,widest=0;
  for(const c of [...SETUPS,{power:26,ports:17}])for(const arm of ['middle','end']){
    const t=press({...c,arm}).r.tables[1],body=t.rows.slice(0,-1),total=t.rows.at(-1);
    assert.match(total[0],/^Total: /);assert.equal(body.length,11);
    for(const col of [1,2]){
      for(const row of t.rows)assert.match(cellText(row[col]),/^\d{1,3}(,\d{3})*$/,'a whole number of vehicle-weeks, grouped');
      assert.ok(Math.abs(body.reduce((n,row)=>n+row[col].v,0)-total[col].v)<1e-6,'the exact rows sum to the exact total');
      const added=body.reduce((n,row)=>n+shown(row[col]),0),gap=Math.abs(added-shown(total[col])),where=`${JSON.stringify(c)} ${arm}, ${t.heads[col]}: the printed rows add to ${added} and the printed total is ${shown(total[col])}`;
      widest=Math.max(widest,gap);if(gap)apart++;
      assert.ok(gap<=body.length,where);
      if(gap)assert.doesNotMatch(t.caption,/The rows sum to the total\.$/,`${where}, so the caption may not say the rows sum to the total as printed`);
    }
    assert.match(t.caption,/ The rows sum to the total before each is rounded to a whole vehicle-week\.$/,`${JSON.stringify(c)} ${arm}`);
  }
  assert.ok(apart>0&&widest>=1,'the printed rows do not add to the printed total in every press, so the caption may not say that they do');
  // One press a reader can type, added as a reader would add it: site power 40, ports 24, the second arm, the column of the other arm.
  const t=press({arm:'end',power:40,ports:24}).r.tables[1];
  assert.deepEqual([t.rows.slice(0,-1).reduce((n,row)=>n+shown(row[2]),0),shown(t.rows.at(-1)[2])],[57097,57096]);
});

test('the hand checks hold at every pinned setup, and the closed form with spread holds on the displayed plan',()=>{
  const span=([a,b])=>Array.from({length:b-a+1},(_,i)=>a+i);
  for(const c of SETUPS)for(const arm of ['middle','end']){
    const {d,r}=press({...c,arm}),[gain,stock]=r.tables[3].rows,room=c.power-c.ports;
    assert.equal(r.tables[3].rows.length,2);for(const row of r.tables[3].rows)assert.equal(row[6],'inside the tolerance',`${JSON.stringify(c)} ${row[0]}`);
    assert.equal(value(gain[2]),room*(FLEET-PLACES)*(1-STANDING)/PLAN);assert.ok(Math.abs(value(gain[3])-value(gain[2]))<=.02*value(gain[2]));
    assert.equal(value(gain[4]),r.analysis.primary.mean_delta);assert.ok(value(gain[4])<value(gain[2]),'spread takes some of the gain away');
    assert.deepEqual(stock[4],{absent:'this check has one simulated value'});
    let sum=0,n=0;for(const p of span(d.setup.ranges[0]))for(const q of span(d.setup.ranges[1]))for(const s of span(d.setup.ranges[2]))for(const t of span(d.setup.ranges[3])){const o=Math.max(q,s,t);sum+=Math.max(p,o)-Math.max(p-d.setup.ahead,o);n++;}
    const spread=sum/n*(FLEET-PLACES)*(1-STANDING)/PLAN;
    assert.ok(Math.abs(r.analysis.primary.mean_delta-spread)<=.1*spread,`${JSON.stringify(c)} ${arm}: ${r.analysis.primary.mean_delta} against ${spread}`);
  }
  assert.ok(Math.abs(STANDING-.0279035210737056)<1e-15);
});

test('the refusal region: what runs, what is refused, and how each refusal reads',()=>{
  const runs=[[48,24],[24,16],[32,24],[56,28],[36,28],[44,20]],refused=[[31,24,/^site power \(31\) and ports, the next gate \(24\), leave 7 weeks of room, 1\.75 tranche intervals\. The lab reads from 2\.0: set site power to 32 weeks or past it, or ports to 23 or before it$/],
    [35,28,/^site power \(35\) and ports, the next gate \(28\), leave 7 weeks of room/],[24,23,/^site power \(24\) and ports, the next gate \(23\), leave 1 week of room, 0\.25 tranche intervals\. The lab reads from 2\.0: set site power to 31 weeks or past it, or ports to 16 or before it$/],
    [24,24,/^site power \(24\) leaves no room past ports \(24\)\. The lab reads from 8 weeks of room: set site power to 32 weeks or past it, or ports to 16 or before it$/],
    [24,25,/^site power \(24\) leaves no room past ports \(25\)\. The lab reads from 8 weeks of room: set site power to 33 weeks or past it, or ports to 16 or before it$/],[24,28,/^site power \(24\) leaves no room past ports \(28\)\. /]];
  for(const [power,ports] of runs)assert.equal(LAB.derive({arm:'middle',power,ports}).ok,true,`${power}/${ports}`);
  for(const [power,ports,message] of refused){const d=LAB.derive({arm:'end',power,ports});assert.equal(d.ok,false);assert.match(d.reason,message);assert.equal(d.setup,undefined,'a refused setup has nothing to run');}
  // The governing ratio governs: no value of the room over the tranche interval is both accepted and refused.
  const seen={true:new Set(),false:new Set()};
  let accepted=0,all=0,longest=0;
  for(let power=24;power<=56;power++)for(let ports=16;ports<=28;ports++){
    const d=LAB.derive({arm:'middle',power,ports});all++;seen[d.ok].add((power-ports)/EVERY);
    assert.equal(d.ok,(power-ports)/EVERY>=2);if(d.ok)assert.equal(d.rows.find(row=>/^Governing ratio/.test(row[2]))[1].v,(power-ports)/EVERY);
    if(d.ok){accepted++;continue;}
    const shown=d.reason;longest=Math.max(longest,shown.length);
    assert.ok(shown.length<=192,shown);clean(shown,[H3,H6,V,DIRECTION,HOUSE,LINKS,DASH],'refusal');assert.doesNotMatch(shown,/undefined|NaN|_|power:|ports:/);
    // A whole sentence at every value: no count under zero, one week is a week, and ports is the next gate only when site power arrives after it.
    assert.doesNotMatch(shown,/-\d|\b[01] weeks\b|\b0\.00\b|  |[.,:;] ?$/,shown);assert.equal(/the next gate/.test(shown),power>ports,shown);
    const remedy=/^site power \(\d+\) [a-z].*\. The lab reads from [\d.]+( weeks of room)?: set site power to (\d+) weeks or past it, or ports to (\d+) or before it$/.exec(shown);
    assert.ok(remedy,shown);assert.deepEqual([+remedy[2],+remedy[3]],[ports+8,power-8]);
    assert.equal(LAB.derive({arm:'middle',power:ports+8,ports}).ok,true,'the first remedy is a value the control offers, and it runs');assert.equal(LAB.derive({arm:'middle',power,ports:power-8}).ok,true,'so is the second');
  }
  assert.deepEqual([all,accepted,longest],[429,351,184]);assert.ok(![...seen.true].some(x=>seen.false.has(x)));
  assert.equal(LAB.derive({...LAB.defaults(),release:12}).ok,true,'a release week is not an input: a typed one is ignored');assert.equal(LAB.controls.length,3);
  for(const bad of [{arm:'pace'},{arm:undefined},{power:23},{power:57},{power:40.5},{power:'40'},{ports:15},{ports:29},{ports:null}]){
    const d=LAB.derive({...LAB.defaults(),...bad});assert.equal(d.ok,false,JSON.stringify(bad));assert.doesNotMatch(d.reason,/undefined|NaN/);
    if(!('arm' in bad))assert.match(d.reason,/^(site power lead time|ports lead time), middle of its range must be a whole number from \d+ to \d+$/);
  }
  for(const nothing of [null,undefined,{},[]])assert.equal(LAB.derive(nothing).ok,false);
});

test('copy: sources are named, absence carries a reason, numbers are grouped and no banned word ships',()=>{
  const pre=[H3,H6,V,DIRECTION,HOUSE,LINKS,DASH],post=[H3,H6,HOUSE,LINKS,DASH];
  for(const arm of ['middle','end']){
    const {d,r}=press({...LAB.defaults(),arm});
    for(const [label,cell,source] of d.rows){clean([label,...texts(cell),source].join(' '),pre,'inputs table');assert.match(source,/^(You choose|Teaching assumption|Sizing rule|Governing ratio)/);}
    assert.equal(d.rows.filter(row=>/^Governing ratio/.test(row[2])).length,1);
    assert.ok(d.rows.some(row=>/^Allowances$/.test(row[0])&&/13 idle weeks/.test(row[1])&&/margin 0\.02 of plan, 1,117 vehicle-weeks/.test(row[1])),'margin and allowances are on the page before Run');
    for(const spec of [d.setup.main.spec,...d.setup.checks.map(c=>c.spec)])clean(spec.change,pre,'changed setting');
    for(const c of LAB.controls){clean(c.label,pre,'control');for(const o of c.options??[])clean(o[1],pre,'option');}
    for(const t of r.tables){clean(t.caption+' '+t.heads.join(' '),post,'table');for(const row of t.rows)for(const cell of row){for(const x of texts(cell)){clean(x,post,'cell');assert.doesNotMatch(x,/(?<![\d,.])\d{4,}(?![\d,]*\d?\s*weeks? x)/,`ungrouped number in ${x}`);}assert.ok(typeof cell==='string'||Number.isFinite(cell.v)||(typeof cell.absent==='string'&&cell.absent.length>10));}}
    for(const n of r.notes)clean(n,post,'note');for(const c of r.controls)clean(c.title,post,'control title');
    clean(r.chart.title+' '+r.chart.summary.t+' '+r.chart.series.map(s=>s.label).join(' '),post,'chart');assert.match(r.chart.summary.t,/^This replay: /);assert.equal(r.chart.seed,7001);
    assert.equal(r.chart.categories.length,52);for(const s of r.chart.series)assert.ok(s.values.every(Number.isFinite));
  }
  for(const u of LAB.unknowns)clean(u,post,'unknowns');
  const [what,how,look,take]=LAB.frame,words=t=>t.split(/\s+/).length;
  assert.ok(what.length<=160&&how.length<=220&&look.length+take.length<=240);assert.ok(words(what)+words(how)+words(look)+words(take)<=102);
  assert.match(take,/^An ops team would map /);assert.doesNotMatch(look+take,/\d/);assert.match(what,/\?$/,'the first part asks; it states no cause and no result');
});

test('no count on the default page sits near a count the default page stays away from',()=>{
  const listed=PINS.counts_the_default_page_stays_away_from;assert.deepEqual(listed,[300,2000,3200,4000]);
  for(const arm of ['middle','end']){
    const pin=PINS.arms[arm],counts=[FLEET,PLACES,...pin.tables[0].rows.slice(0,7).flatMap(row=>[row[2].v,row[3].v]),...Object.values(pin.chart.summary.v),pin.tables[3].rows[1][2].v,pin.tables[3].rows[1][3].v];
    for(const n of counts)for(const p of listed)assert.ok(Math.abs(n-p)>.1*p,`${n} is within a tenth of ${p}`);
  }
  // One word the page stays away from as well, held by its digest: no file spells it.
  const spelled=text=>[...new Set(text.toLowerCase().match(/[a-z]{8,}/g))].some(w=>Array.from({length:w.length-7},(_,i)=>w.slice(i,i+8)).some(x=>sha256Hex(x)==='959f91e0abc611bba8234c0d62d9c07f53a8c037a32a94438e5d0742c2c44382'));
  for(const text of [SOURCE,SELF,PINS_TEXT])assert.equal(spelled(text),false);
  // The list is described as counts the default page stays away from, and by no word that says whose counts they are.
  assert.deepEqual(Object.keys(PINS).filter(k=>/count/.test(k)),['counts_the_default_page_stays_away_from']);
  for(const text of [SELF,PINS_TEXT])assert.doesNotMatch(text,/publi[c]|operato[r]|compan[y]|compet[i]/i);
});

test('a pinned sample of the accepted region keeps every law, every control and every hand check',()=>{
  const at=(name,i,lo,hi)=>lo+u32('scale-intake-test',name,i)%(hi-lo+1);let ran=0;
  for(let i=0;ran<12;i++){
    const c={power:at('power',i,24,56),ports:at('ports',i,16,28)};
    if(!LAB.derive({...c,arm:'middle'}).ok)continue;ran++;
    const m=press({...c,arm:'middle'}).r,e=press({...c,arm:'end'}).r;
    assert.equal(m.analysis.outcome,'IMPROVED',JSON.stringify(c));assert.equal(e.analysis.outcome,'IMPROVED');
    for(const r of [m,e]){for(const k of r.controls)assert.ok(k.analysis.primary.paired_deltas.every(x=>x===0));for(const row of r.tables[3].rows)assert.equal(row[6],'inside the tolerance');}
    assert.ok(e.analysis.guardrail_statuses[0].harm>m.analysis.guardrail_statuses[0].harm);
  }
});

test('a press hands the page back often enough',{skip:process.env.FLEET_PLAYGROUND_PERF!=='1'&&'set FLEET_PLAYGROUND_PERF=1 on a quiet machine'},()=>{
  const g=LAB.steps(LAB.derive(LAB.defaults()).setup),start=performance.now();let last=start,longest=0,s;
  do{s=g.next();const now=performance.now();longest=Math.max(longest,now-last);last=now;}while(!s.done);
  assert.ok(longest<=8,`largest gap between two yields ${longest} ms`);assert.ok(last-start<=3000);
});
