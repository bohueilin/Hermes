import { el } from './dom.js';
import { createCarGlyph } from './car-glyph.js';

export const ACTIVITY_COLORS=Object.freeze({available:'#478e69',ready:'#478e69',pickup:'#c48c42',passenger_trip:'#498fa9',drive_to_depot:'#9c84b5',software:'#927ab3',cleaning:'#43a398',charging:'#c29531',upload:'#718ac0'});
const colorOf=state=>state.startsWith('queued_')?'#a87560':ACTIVITY_COLORS[state]??'#667e70';
const svg=(tag,attrs={},text=null)=>{
  const n=document.createElementNS('http://www.w3.org/2000/svg',tag);
  for(const [k,v] of Object.entries(attrs)) n.setAttribute(k,String(v));
  if(text!==null)n.textContent=text;
  return n;
};

/** Decorative street geometry; progress comes only from the recorded route. */
export function vehiclePosition(car,next,fraction,locations) {
  const byId=id=>locations.find(x=>x.id===id);
  if(!car.from||!car.to){const n=byId(car.node)??byId(car.depot_id)??locations[0];return {x:n?.x??50,y:n?.y??50,angle:0};}
  const a=byId(car.from),b=byId(car.to);
  if(!a||!b)return {x:50,y:50,angle:0};
  let p=car.progress??0;
  if(next?.from===car.from&&next?.to===car.to)p+=(next.progress-p)*fraction;
  else if(car.remaining_min<=1)p+=(1-p)*fraction;
  p=Math.max(0,Math.min(1,p));
  const dx=b.x-a.x,dy=b.y-a.y,leg=Math.abs(dx)+Math.abs(dy),distance=p*leg;
  if(distance<=Math.abs(dx)&&dx!==0)return {x:a.x+Math.sign(dx)*distance,y:a.y,angle:dx>0?0:180};
  return {x:b.x,y:a.y+Math.sign(dy)*Math.max(0,distance-Math.abs(dx)),angle:dy>=0?90:270};
}

export function createOperationsMap(onSelect=()=>{}) {
  const drawing=svg('svg',{viewBox:'0 0 1000 670',role:'img','aria-label':'Simulated fleet on an invented street diagram'});
  const pan=el('div',{class:'ops-map-pan',tabindex:'0',role:'region','aria-label':'Fleet diagram; scroll to pan when enlarged'},drawing);
  const zoom=el('select',{'aria-label':'Car diagram zoom',on:{change:()=>{drawing.setAttribute('style',`width:${Number(zoom.value)*100}%`);}}},[['1','Whole fleet'],['2','Larger cars · 2×'],['3','Close up · 3×']].map(([value,label])=>el('option',{value},label)));
  const element=el('figure',{class:'ops-map'},[el('div',{class:'ops-map-tools'},[zoom,el('span',{},'Enlarge, then scroll to explore.')]),pan,el('figcaption',{},'Each car is one simulated AV. Streets and movement between minute snapshots are illustrative; no lane, collision or physical driving model.')]);
  const ground=svg('g'),roads=svg('g'),places=svg('g'),route=svg('g'),cars=svg('g');
  drawing.appendChild(ground);drawing.appendChild(roads);drawing.appendChild(places);drawing.appendChild(route);drawing.appendChild(cars);
  const records=new Map();let priorLocations=null;
  const px=x=>50+x*9,py=y=>30+y*5.5;
  function setLocations(locations){
    if(priorLocations===locations)return;
    priorLocations=locations;ground.replaceChildren();roads.replaceChildren();places.replaceChildren();
    ground.appendChild(svg('rect',{width:1000,height:670,rx:18,fill:'#eaf0e4'}));
    for(let row=0;row<4;row++)for(let col=0;col<5;col++){
      const x=72+col*180,y=56+row*142;
      ground.appendChild(svg('rect',{x,y,width:120,height:79,rx:10,fill:(row+col)%3===0?'#d7e4cd':'#e0e7d7'}));
      if((row+col)%3!==0){ground.appendChild(svg('rect',{x:x+13,y:y+13,width:51,height:37,rx:5,fill:'#cad6c2'}));ground.appendChild(svg('rect',{x:x+71,y:y+15,width:31,height:48,rx:4,fill:'#f8f8ec'}));}
      else for(let t=0;t<3;t++)ground.appendChild(svg('circle',{cx:x+20+t*35,cy:y+37,r:12,fill:'#9fb992'}));
    }
    const xs=[...new Set(locations.map(n=>n.x))],ys=[...new Set(locations.map(n=>n.y))];
    for(const x of xs){roads.appendChild(svg('path',{d:`M ${px(x)} 16 V 639`,stroke:'#c3cdc2','stroke-width':25}));roads.appendChild(svg('path',{d:`M ${px(x)} 16 V 639`,stroke:'#fcfdf7','stroke-width':1.6,'stroke-dasharray':'9 12'}));}
    for(const y of ys){roads.appendChild(svg('path',{d:`M 24 ${py(y)} H 976`,stroke:'#c3cdc2','stroke-width':25}));roads.appendChild(svg('path',{d:`M 24 ${py(y)} H 976`,stroke:'#fcfdf7','stroke-width':1.6,'stroke-dasharray':'9 12'}));}
    for(const n of locations){
      const depot=n.kind==='depot';const p=svg('g');
      p.appendChild(svg('rect',{x:px(n.x)-43,y:py(n.y)-43,width:86,height:24,rx:6,fill:depot?'#284b39':'#fffef6',stroke:'#bfd0b8'}));
      p.appendChild(svg('text',{x:px(n.x),y:py(n.y)-27,'text-anchor':'middle','font-size':11,'font-weight':600,fill:depot?'#fffef6':'#385341'},n.label));
      if(depot){p.appendChild(svg('rect',{x:px(n.x)-42,y:py(n.y)+18,width:84,height:35,rx:5,fill:'#e6d7b5',stroke:'#b69e71'}));for(let j=0;j<4;j++)p.appendChild(svg('path',{d:`M ${px(n.x)-32+j*19} ${py(n.y)+24} v 23`,stroke:'#fdf9e9','stroke-width':2}));}
      places.appendChild(p);
    }
  }
  function render(run,frame,nextFrame=null,fraction=0,selected=null){
    setLocations(run.locations);const nextById=new Map((nextFrame?.vehicles??[]).map(c=>[c.id,c]));const seen=new Set();const occupancy=new Map();
    route.replaceChildren();
    for(const car of frame.vehicles){
      seen.add(car.id);let r=records.get(car.id);const color=colorOf(car.state);
      if(!r){const group=svg('g',{'data-car-id':car.id,role:'button',tabindex:'-1'});group.addEventListener('click',()=>onSelect(car.id));const ring=svg('ellipse',{cx:0,cy:0,rx:23,ry:16,fill:'none',stroke:'#173c2c','stroke-width':2});group.appendChild(ring);const glyph=createCarGlyph(color);group.appendChild(glyph);group.appendChild(svg('title',{},car.id));cars.appendChild(group);r={group,ring,glyph,color};records.set(car.id,r);}
      if(r.color!==color){const glyph=createCarGlyph(color);r.group.insertBefore(glyph,r.glyph);r.glyph.remove();r.glyph=glyph;r.color=color;}
      const pos=vehiclePosition(car,nextById.get(car.id),fraction,run.locations);
      let x=px(pos.x),y=py(pos.y);
      if(!car.from){const key=car.node??car.depot_id;const index=occupancy.get(key)??0;occupancy.set(key,index+1);x+=(index%6-2.5)*19;y+=Math.floor(index/6)*13;}
      r.group.setAttribute('transform',`translate(${x} ${y}) rotate(${pos.angle}) scale(${selected===car.id?1.12:.77})`);
      r.group.setAttribute('aria-label',`${car.id}: ${car.state.replaceAll('_',' ')}; battery ${Number(car.soc_kwh).toFixed(1)} kWh`);
      r.ring.setAttribute('visibility',selected===car.id?'visible':'hidden');
      if(selected===car.id&&car.from&&car.to){const a=run.locations.find(n=>n.id===car.from),b=run.locations.find(n=>n.id===car.to);if(a&&b)route.appendChild(svg('path',{d:`M ${px(a.x)} ${py(a.y)} H ${px(b.x)} V ${py(b.y)}`,fill:'none',stroke:'#3c8060','stroke-width':4,'stroke-dasharray':'8 6',opacity:.6}));}
    }
    for(const [id,r] of records)if(!seen.has(id)){r.group.remove();records.delete(id);}
    const night=(frame.clock_minute%1440)<360||(frame.clock_minute%1440)>=1200;
    ground.setAttribute('opacity',night?.72:1);
  }
  return {element,render};
}
