import {el,setAttr} from './dom.js';

// Static teaching diagrams, deliberately independent of records, clocks and model execution.
const node=(name,detail,tone='')=>el('div',{class:`primer-node ${tone}`},[el('strong',{},name),el('span',{},detail)]);
const arrow=()=>el('span',{class:'primer-arrow','aria-hidden':'true'},'→');
const track=items=>el('div',{class:'primer-track'},items.flatMap((item,i)=>i?[arrow(),item]:[item]));
const content={
 depot:{title:'See how readiness fits together',kicker:'TWO PATHS · ONE READY VEHICLE',description:'In the first Depot flow lesson, charging and uploading can overlap. The local step follows the upload. A vehicle is ready only when every prerequisite is complete.',body:()=>el('div',{class:'primer-dependency'},[
  el('div',{class:'primer-branches'},[el('div',{},[el('p',{class:'primer-path-label'},'Path 1 · energy'),track([node('Battery target','Charge if needed','primer-energy')])]),el('div',{},[el('p',{class:'primer-path-label'},'Path 2 · data'),track([node('Upload','Share the link','primer-data'),node('Local step','After upload')])])]),
  el('div',{class:'primer-join'},[el('span',{class:'primer-and'},'AND'),node('Ready in this model','Both paths complete','primer-ready')]),
 ]),lesson:'Watch the last unfinished prerequisite. A full battery alone does not mean the vehicle is ready.'},
 fleet:{title:'See the fleet cycle',kicker:'A DAY IS MORE THAN RIDES',description:'Fleet day follows synthetic requests, empty travel and depot work. Read service, energy and queues together; improving one resource can move the wait elsewhere.',body:()=>track([node('Serve riders','Pickup and trip','primer-data'),node('Travel empty','No rider on board'),node('Depot work','Energy and service','primer-energy'),node('Return to service','Repeat the cycle','primer-ready')]),lesson:'Look for a trade-off: more vehicles may improve coverage while increasing pressure on the depot. This is a conceptual cycle, not a timed route.'},
 street:{title:'See why a small queue matters',kicker:'ONE CONSTRAINT · MANY VEHICLES',description:'A street or pickup resource can delay more than the vehicle using it. The Street lab exposes queues in a simplified directed road network.',body:()=>track([node('Arrive','Vehicles reach a resource','primer-data'),node('Wait if occupied','Queue for capacity'),node('Serve and release','Make room for the next vehicle','primer-ready')]),lesson:'PUDO means pickup and drop-off. A modeled berth or road capacity is not real curb permission, lane geometry or a physical driving policy.'},
 paired:{title:'See what makes a fair comparison',kicker:'MATCH INPUTS · CHANGE THE POLICY',description:'Pair the baseline and candidate on the same declared workload and matching travel-variation seeds. Inspect improvements, regressions and unavailable measurements together.',body:()=>el('div',{class:'primer-pair'},[node('Matched inputs','Same workload · paired seed'),el('div',{class:'primer-arms'},[node('Policy A','Baseline rule','primer-data'),node('Policy B','Candidate rule','primer-data')]),node('Compare outcomes','Repeat across declared seeds')]),lesson:'A seed reproduces random variation. Pairing can reduce noise in the difference; it does not eliminate uncertainty or guarantee that the candidate improves the outcome.'},
};
export function conceptPrimer(kind){
 const c=content[kind];if(!c)throw new RangeError('Unknown concept primer');
 return el('details',{class:'concept-primer','data-concept':kind,open:kind==='fleet'},[
  el('summary',{},[el('span',{},c.title),' ',el('small',{class:'primer-summary-meta'},'Visual primer')]),
  el('div',{class:'primer-body'},[el('p',{class:'eyebrow'},c.kicker),el('p',{class:'primer-description'},c.description),el('figure',{},[c.body(),el('figcaption',{},'Concept diagram · not simulation output')]),el('p',{class:'primer-takeaway'},c.lesson)]),
 ]);
}

/** Decorative line art; all meaning also appears in adjacent visible HTML. */
export function learningGlyph(kind){
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
 for(const [k,v]of Object.entries({viewBox:'0 0 200 90',class:'learning-glyph','aria-hidden':'true',focusable:'false'}))setAttr(svg,k,v);
 const add=(tag,attrs)=>{const n=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const[k,v]of Object.entries(attrs))setAttr(n,k,v);svg.appendChild(n);};
 const line=d=>add('path',{d,class:'glyph-line'});
 if(kind==='capacity'){
  line('M12 25H58Q73 25 73 45T90 65H182 M12 65H182');
  for(const x of [24,46,108,148])add('rect',{x,y:x<70?17:57,width:18,height:16,rx:5,class:'glyph-car'});
  add('rect',{x:100,y:8,width:70,height:30,rx:8,class:'glyph-station'});line('M116 31V16h12v15m16 0V16h12v15');
 }else if(kind==='service'){
  line('M14 65H64V28H181 M14 70H185');
  add('rect',{x:88,y:15,width:44,height:25,rx:10,class:'glyph-car'});line('M98 23h22m-34 24h51');
  add('circle',{cx:164,cy:19,r:8,class:'glyph-station'});line('M164 28v20m-9-13h18');
 }else{
  for(const [x,y]of [[22,17],[83,29],[144,41]]){add('rect',{x,y,width:36,height:34,rx:7,class:'glyph-station'});line(`M${x+8} ${y+12}h20m-20 9h14`);}
  line('M58 34h25m36 12h25');
 }
 return svg;
}
