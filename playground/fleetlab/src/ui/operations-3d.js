import {el} from './dom.js';
import {createCarGlyph} from './car-glyph.js';
import {ACTIVITY_COLORS} from './operations-map.js';
import {cameraMatrix,projectPoint,fitCameraToPoints,orbitCamera,pointOnPath,buildCarMesh,buildRoadMesh,box,quad,transformMesh,createWebGLRenderer} from './scene-3d.js';
const svg=(tag,attrs={})=>{const n=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,String(v));return n;};
const color=state=>state.startsWith('queued_')?'#bd9277':ACTIVITY_COLORS[state]??'#568676';
const append=(target,source)=>{for(let i=0;i<source.length;i++)target.push(source[i]);};
const button=(text,fn)=>el('button',{type:'button',class:'studio-button',on:{click:fn}},text);

export function bayVehiclePosition(run,car,next,fraction){
  const route=run.routes?.[car.route_id];
  if(car.from&&car.to&&route?.points?.length){let progress=car.progress??0;if(next?.route_id===car.route_id&&next?.from===car.from&&next?.to===car.to)progress+=(next.progress-progress)*fraction;else if(car.remaining_min<=1)progress+=(1-progress)*fraction;return pointOnPath(route.points,progress);}
  const node=run.locations.find(p=>p.id===(car.node??car.depot_id))??run.locations[0];return {x:node?.road_anchor?.x??node?.x??0,y:node?.road_anchor?.y??node?.y??0,heading:0};
 }

/** Display slots only: recorded anchors, movement and distances are never modified. */
export function layoutBayVehicles(run,frame,nextFrame,fraction,scale){
 const positions=new Map(),groups=new Map(),next=new Map((nextFrame?.vehicles??[]).map(c=>[c.id,c]));
 for(const car of frame?.vehicles??[]){positions.set(car.id,bayVehiclePosition(run,car,next.get(car.id),fraction));if(!car.from||!car.to){const key=car.node??car.depot_id;const group=groups.get(key)??[];group.push(car);groups.set(key,group);}}
 for(const group of groups.values()){if(group.length<2)continue;const cols=Math.ceil(Math.sqrt(group.length)),rows=Math.ceil(group.length/cols);group.forEach((car,i)=>{const p=positions.get(car.id);positions.set(car.id,{...p,x:p.x+((i%cols)-(cols-1)/2)*scale*3,y:p.y+(Math.floor(i/cols)-(rows-1)/2)*scale*2});});}
 return positions;
}

/** A recorded-car projection on sourced geography. Camera movement never advances the model. */
export function createOperations3D({places=[],mapData={},onSelect=()=>{},onFocus=()=>{},createRenderer=createWebGLRenderer,onDownloadMap=null}={}){
 const canvas=el('canvas',{'aria-label':'3D Bay Area fleet: orbit with arrow keys, zoom with plus or minus',tabindex:'0',role:'img'});
 const flat=svg('svg',{viewBox:'0 0 1000 700',role:'img','aria-label':'Flat Bay Area road map'});
 const overlay=el('div',{class:'bay-map-labels'});
 const leaders=svg('svg',{'aria-hidden':'true',class:'bay-label-leaders'});overlay.appendChild(leaders);
 const viewport=el('div',{class:'bay-map-viewport'},[canvas,flat,overlay]);
 const renderer=createRenderer(canvas);let mode=renderer?'3d':'flat';
 const status=el('span',{class:'bay-render-status'},renderer?'3D · WebGL':'Flat map · WebGL unavailable');
 const viewSelect=el('select',{'aria-label':'Map view',on:{change:()=>{mode=viewSelect.value;redraw();}}},[el('option',{value:'3d',disabled:!renderer},'3D perspective'),el('option',{value:'flat'},'Flat map')]);viewSelect.value=mode;
 const focusSelect=el('select',{'aria-label':'Focus map on a city',on:{change:()=>focus(focusSelect.value)}},[el('option',{value:'all'},'Entire Bay Area'),...places.map(p=>el('option',{value:p.id},p.label))]);
 const labelSelect=el('select',{'aria-label':'City label density',on:{change:()=>redraw()}},[el('option',{value:'key'},'Key place names'),el('option',{value:'all'},'All 18 names'),el('option',{value:'none'},'Roads & cars only')]);
 const controls=el('div',{class:'bay-map-controls'},[viewSelect,focusSelect,labelSelect,button('−',()=>changeCamera({zoom:1.25})),button('+',()=>changeCamera({zoom:.8})),button('Rotate ↶',()=>changeCamera({yaw:-.3})),button('Rotate ↷',()=>changeCamera({yaw:.3})),button('Tilt',()=>{camera.pitch=camera.pitch>1.1?.7:1.3;redraw();}),button('Follow selected car',()=>{following=true;overview=false;camera.distance=6;redraw();}),button('Reset view',()=>focus('all'))]);
 const element=el('figure',{class:'bay-map'},[controls,el('div',{class:'bay-map-caption-top'},[status,el('span',{},'Drag to orbit · scroll to zoom · choose a city to inspect')]),viewport,
  el('figcaption',{},[el('a',{href:'https://www.openstreetmap.org/copyright',target:'_blank',rel:'noopener noreferrer'},'© OpenStreetMap contributors'),el('span',{},' · ODbL. Frozen September 2026 extract. Sparse major-road routes; one-way and access rules excluded. Cars and hypothetical depots are enlarged; stationary cars are spread into display slots around their recorded anchor. Grid spacing: 5 km. Coastlines are sourced outlines; no terrain or water polygons. Traffic and demand are simulated. This is not a commercial service-area map.')])]);
 if(onDownloadMap)element.appendChild(button('Download attributed map data',onDownloadMap));
 const xs=places.map(p=>p.x),ys=places.map(p=>p.y);
 const bounds={minX:Math.min(...xs,0)-3,maxX:Math.max(...xs,10)+3,minY:Math.min(...ys,0)-3,maxY:Math.max(...ys,10)+3};
 const center=[(bounds.minX+bounds.maxX)/2,(bounds.minY+bounds.maxY)/2,0];
 let camera={target:[...center],distance:Math.max(bounds.maxX-bounds.minX,bounds.maxY-bounds.minY)*1.12,yaw:0,pitch:.9};
 let current=null,selected=null,drag=null,destroyed=false,lastFlatKey=null,hitPoints=[],following=false,overview=true,contextLost=false;
 const labelNodes=new Map();for(const p of places){const label=button(p.label,()=>{focus(p.id);onFocus(p.id);});label.setAttribute('class',`bay-city-label${p.kind==='airport'?' is-airport':''}`);label.setAttribute('data-place-id',p.id);overlay.appendChild(label);labelNodes.set(p.id,label);}
 const meshes={ipace:buildCarMesh('ipace','#f3f5ec'),ojai:buildCarMesh('ojai','#d8e3f3')};
 const land=[];
 quad(land,[bounds.minX-30,bounds.minY-30,-.06],[bounds.maxX+30,bounds.minY-30,-.06],[bounds.maxX+30,bounds.maxY+30,-.06],[bounds.minX-30,bounds.maxY+30,-.06],'#e5eadc');
 const coast=buildRoadMesh((mapData.coastlines??[]).map(points=>({points})),.05,'#7cb1b0',.002);
 const roadEdges=buildRoadMesh(mapData.roads??[],.17,'#fafbf6',.018);
 const roads=buildRoadMesh(mapData.roads??[],.085,'#829788',.02);
 const grid=[];for(let x=0;x<=bounds.maxX;x+=5)grid.push({points:[[x,0],[x,bounds.maxY]]});for(let y=0;y<=bounds.maxY;y+=5)grid.push({points:[[0,y],[bounds.maxX,y]]});
 const staticMesh=land.concat(buildRoadMesh(grid,.016,'#d6dfd0',-.02),coast,roadEdges,roads);
 const flatRoads=svg('g'),flatCars=svg('g');flat.appendChild(flatRoads);flat.appendChild(flatCars);
 const vehicleNodes=new Map();
 function changeCamera(change){overview=false;camera=orbitCamera(camera,change);redraw();}
 function focus(id){following=false;overview=id==='all';focusSelect.value=id;const p=places.find(p=>p.id===id);camera={...camera,target:p?[p.x,p.y,0]:[...center],distance:p?8:Math.max(bounds.maxX-bounds.minX,bounds.maxY-bounds.minY)*1.12};redraw();}
 function placeLabels(project,width,height){
  leaders.setAttribute('viewBox',`0 0 ${width} ${height}`);leaders.replaceChildren();const occupied=[];
  const ordered=[...places].sort((a,b)=>(b.id===focusSelect.value)-(a.id===focusSelect.value));
  for(const p of ordered){
   const n=labelNodes.get(p.id),pt=project(p);
   if(p.id!==focusSelect.value&&(labelSelect.value==='none'||(labelSelect.value!=='all'&&!['san-francisco','sfo','san-mateo','palo-alto','san-jose','sjc'].includes(p.id)))){n.hidden=true;if(pt.visible)leaders.appendChild(svg('circle',{cx:pt.x,cy:pt.y,r:2.5,fill:'#76947e'}));continue;}
   const w=Math.min(width<400?105:130,Math.max(82,p.label.length*5.7+22)),h=44;
   if(!pt.visible||pt.x<8||pt.x>width-8||pt.y<8||pt.y>height-8){n.hidden=true;continue;}
   const candidates=[];for(const dx of [18,-w-18,148,-w-148])for(const dy of [-22,-70,26,-118,74,-166,122,-214,170,218])candidates.push({x:pt.x+dx,y:pt.y+dy,w,h});
   candidates.sort((a,b)=>Math.hypot(a.x+w/2-pt.x,a.y+h/2-pt.y)-Math.hypot(b.x+w/2-pt.x,b.y+h/2-pt.y));
   const spot=candidates.find(r=>r.x>5&&r.x+w<width-5&&r.y>5&&r.y+h<height-5&&!occupied.some(q=>r.x<q.x+q.w+5&&r.x+r.w+5>q.x&&r.y<q.y+q.h+4&&r.y+r.h+4>q.y));
   n.hidden=!spot;if(!spot)continue;occupied.push(spot);n.style.width=`${w}px`;n.style.transform=`translate(${spot.x}px, ${spot.y}px)`;n.classList.toggle('is-focused',p.id===focusSelect.value);
   leaders.appendChild(svg('line',{x1:pt.x,y1:pt.y,x2:Math.max(spot.x,Math.min(spot.x+w,pt.x)),y2:Math.max(spot.y,Math.min(spot.y+h,pt.y)),stroke:'#829f8c','stroke-width':.8}));
   leaders.appendChild(svg('circle',{cx:pt.x,cy:pt.y,r:2.8,fill:p.kind==='airport'?'#687cac':'#487563'}));
  }
 }
 function drawLabels(matrix,width,height){placeLabels(p=>projectPoint([p.x,p.y,.15],matrix,width,height),width,height);}
 function flatProjection(point,width,height){const span=camera.distance*1.2,ratio=width/height;return {x:width/2+(point[0]-camera.target[0])/span*width,y:height/2-(point[1]-camera.target[1])/span*width,visible:Math.abs(point[0]-camera.target[0])<span/2&&Math.abs(point[1]-camera.target[1])<span/ratio/2};}
 function drawFlat(run,frame,nextFrame,fraction,width,height){
  flat.setAttribute('viewBox',`0 0 ${width} ${height}`);
  const key=JSON.stringify([camera.target,camera.distance,width,height]);
  if(key!==lastFlatKey){lastFlatKey=key;flatRoads.replaceChildren();for(const road of mapData.roads??[]){const points=road.points.map(p=>flatProjection(p,width,height));flatRoads.appendChild(svg('polyline',{points:points.map(p=>`${p.x},${p.y}`).join(' '),fill:'none',stroke:'#a8b8a5','stroke-width':1.6}));}}
  placeLabels(p=>flatProjection([p.x,p.y],width,height),width,height);
  const positions=run?layoutBayVehicles(run,frame,nextFrame,fraction,Math.max(.035,camera.distance*.017)):new Map();
  const seen=new Set();for(const car of frame?.vehicles??[]){seen.add(car.id);let n=vehicleNodes.get(car.id);if(!n){n=svg('g',{'data-car-id':car.id,role:'button',tabindex:'-1'});n.addEventListener('click',()=>onSelect(car.id));flatCars.appendChild(n);vehicleNodes.set(car.id,n);}n.replaceChildren(createCarGlyph(color(car.state)));const pos=positions.get(car.id),p=flatProjection([pos.x,pos.y],width,height);n.setAttribute('transform',`translate(${p.x} ${p.y}) rotate(${-pos.heading*180/Math.PI}) scale(${selected===car.id?.8:.55})`);n.setAttribute('aria-label',`${car.id}: ${car.state.replaceAll('_',' ')}`);}
  for(const[id,n]of vehicleNodes)if(!seen.has(id)){n.remove();vehicleNodes.delete(id);}
 }
 function redraw(){
  if(destroyed)return;
  const width=Math.max(280,viewport.clientWidth||900),height=Math.max(320,viewport.clientHeight||580);
  if(overview){camera.distance=Math.max(bounds.maxY-bounds.minY,(bounds.maxX-bounds.minX)/(width/height))*1.16;camera=fitCameraToPoints(camera,places.map(p=>[p.x,p.y,0]),width,height);}
  canvas.hidden=mode!=='3d';flat.setAttribute('style',mode==='flat'?'display:block':'display:none');
  status.textContent=mode==='3d'?'3D · WebGL':contextLost?'Flat map · 3D context unavailable':renderer?'Flat map':'Flat map · WebGL unavailable';
  const [run,frame,nextFrame,fraction]=current??[null,null,null,0];
  const scale=Math.max(.035,camera.distance*.017);const positions=run?layoutBayVehicles(run,frame,nextFrame,fraction,scale):new Map();
  if(following&&positions.has(selected)){const pos=positions.get(selected);camera.target=[pos.x,pos.y,0];}
  if(mode==='flat'){drawFlat(run,frame,nextFrame,fraction,width,height);return;}
  const matrix=cameraMatrix(camera,width/height);let mesh=staticMesh.slice();
  for(const depot of run?.locations.filter(p=>p.kind==='depot')??[]){const x=depot.road_anchor?.x??depot.x,y=depot.road_anchor?.y??depot.y;
   box(mesh,x,y,0,scale*4,scale*2.5,scale*.12,'#cbbd97');box(mesh,x,y+scale*.65,scale*.12,scale*3,scale*.9,scale*.8,'#4c7666');
   for(let i=0;i<Math.min(8,run.config?.chargers??0);i++)box(mesh,x+(i-1)*scale*.45,y-scale*.7,scale*.12,scale*.15,scale*.15,scale*.35,'#a6cfb9');
  }
  hitPoints=[];
  for(const car of frame?.vehicles??[]){const pos=positions.get(car.id);const carMesh=meshes[car.vehicle_type]??meshes.ipace;
   const pt=projectPoint([pos.x,pos.y,scale*.5],matrix,width,height);if(pt.visible)hitPoints.push({...pt,id:car.id});
   append(mesh,transformMesh(carMesh,{x:pos.x,y:pos.y,z:.04,scale:scale*(selected===car.id?1.2:.85),heading:pos.heading}));
   box(mesh,pos.x,pos.y,.03,scale*2.8,scale*1.4,scale*.03,color(car.state));
   if(car.id===selected&&run.routes?.[car.route_id])append(mesh,buildRoadMesh([run.routes[car.route_id]],Math.max(.03,camera.distance*.003),'#477f70',.045));
  }
  renderer.draw(mesh,matrix,Math.round(width),Math.round(height));canvas.setAttribute('data-renderer','webgl');drawLabels(matrix,width,height);
 }
 canvas.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY};canvas.setPointerCapture?.(e.pointerId);});
 canvas.addEventListener('pointermove',e=>{if(!drag)return;changeCamera({yaw:(e.clientX-drag.x)*.007,pitch:(e.clientY-drag.y)*.005});drag={...drag,x:e.clientX,y:e.clientY};});
 canvas.addEventListener('pointerup',e=>{if(drag&&Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)<6){const rect=canvas.getBoundingClientRect();const p=hitPoints.map(p=>({...p,d:Math.hypot(p.x-e.clientX+rect.left,p.y-e.clientY+rect.top)})).filter(p=>p.d<24).sort((a,b)=>a.d-b.d)[0];if(p)onSelect(p.id);}drag=null;});canvas.addEventListener('pointercancel',()=>{drag=null;});
 canvas.addEventListener('wheel',e=>{e.preventDefault();changeCamera({zoom:e.deltaY>0?1.12:.89});},{passive:false});
 canvas.addEventListener('keydown',e=>{const keys={ArrowLeft:{yaw:-.12},ArrowRight:{yaw:.12},ArrowUp:{pitch:.1},ArrowDown:{pitch:-.1},'+':{zoom:.85},'=':{zoom:.85},'-':{zoom:1.18}};if(keys[e.key]){e.preventDefault();changeCamera(keys[e.key]);}});
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();contextLost=true;mode='flat';viewSelect.value='flat';viewSelect.querySelector('option[value="3d"]').disabled=true;redraw();});
 const resize=typeof ResizeObserver==='function'?new ResizeObserver(()=>redraw()):null;resize?.observe(viewport);
 redraw();
 return {element,render(run,frame,nextFrame,fraction=0,id=null){current=[run,frame,nextFrame,fraction];selected=id;redraw();},focus,refresh:redraw,getCamera:()=>({...camera,target:[...camera.target]}),destroy(){destroyed=true;resize?.disconnect();renderer?.destroy();}};
}
