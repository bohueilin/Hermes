import {el} from './dom.js';
import {cameraMatrix,projectPoint,pointOnPath,buildCarMesh,buildRoadMesh,box,quad,transformMesh,createWebGLRenderer,fitCameraToPoints} from './scene-3d.js';
import {createCarGlyph} from './car-glyph.js';
const svg=(tag,attrs={})=>{const n=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,String(v));return n;};
const button=(text,fn)=>el('button',{type:'button',class:'studio-button',on:{click:fn}},text);
const append=(a,b)=>{for(const v of b)a.push(v);};
const stateColor=car=>car.waiting?'#cf723b':car.state==='occupied'?'#268170':car.state==='pickup'?'#2865ce':'#819798';

export function streetVehiclePosition(network,car,next,fraction=0){
 const edge=network.edges.find(e=>e.id===(car.edge_id??car.pending_edge_id));
 if(edge){const interpolate=next?.edge_id===car.edge_id&&next?.route_id===car.route_id;return pointOnPath(edge.points,(car.progress??0)+(interpolate?((next.progress??0)-(car.progress??0))*fraction:0));}
 const node=network.nodes.find(n=>n.id===car.node);return {x:node?.x??0,y:node?.y??0,heading:0};
}

/** A projection of recorded queue positions; camera gestures never advance model time. */
export function createStreetScene({network,onSelect=()=>{},onEdgeSelect=()=>{},createRenderer=createWebGLRenderer}={}){
 const canvas=el('canvas',{tabindex:0,role:'img','aria-label':'3D San Francisco street simulation. Drag to orbit, arrow keys to rotate, plus or minus to zoom.'});
 const flat=svg('svg',{role:'img','aria-label':'Flat San Francisco street simulation'}),labels=el('div',{class:'street-labels'});
 const viewport=el('div',{class:'street-viewport'},[canvas,flat,labels]);
 const renderer=createRenderer(canvas);let mode=renderer?'3d':'flat',destroyed=false,current=null,selected=null,selectedEdge=null,drag=null,hits=[],following=false,focusId='first';
 const origin=network.hotspots[0]??network.anchors[0];let camera={target:[origin.x,origin.y,0],distance:1.8,yaw:-.22,pitch:.92};
 const status=el('span',{class:'street-render-state'}),scaleLabel=el('span');
 const views=el('select',{'aria-label':'Street map perspective',on:{change:()=>{mode=views.value;redraw();}}},[el('option',{value:'3d',disabled:!renderer},'3D streets'),el('option',{value:'flat'},'Flat streets')]);views.value=mode;
 const focusSelect=el('select',{'aria-label':'Street map focus',on:{change:()=>focus(focusSelect.value)}},[el('option',{value:'all'},'SF · SFO · East Bay'),...network.hotspots.map(h=>el('option',{value:h.id},h.label)),...network.anchors.filter(a=>['sfo','east-bay'].includes(a.id)).map(a=>el('option',{value:a.id},a.label))]);focusSelect.value=focusId;
 const controls=el('div',{class:'street-map-controls'},[focusSelect,views,button('+',()=>move({zoom:.8})),button('−',()=>move({zoom:1.25})),button('Rotate',()=>move({yaw:.3})),button('Follow AV',()=>{following=true;camera.distance=.6;redraw();})]);
 const element=el('figure',{class:'street-map'},[controls,el('div',{class:'street-map-meta'},[status,scaleLabel]),viewport,
  el('figcaption',{},[el('a',{href:'https://www.openstreetmap.org/copyright',target:'_blank',rel:'noopener noreferrer'},'© OpenStreetMap contributors · ODbL'),el('span',{},' · Frozen directed-road extract. AVs enlarged; orange/red bars show aggregate queues. Street heights are visual styling. Road crossings retain network connectivity, not 3D overpass geometry.')])]);
 const meshes={ipace:buildCarMesh('ipace','#f5f8fc'),ojai:buildCarMesh('ojai','#dcebf4')};
 const mids=new Map(network.edges.map(e=>[e.id,pointOnPath(e.points,.5)]));
 const bounds=new Map(network.edges.map(e=>[e.id,{minX:Math.min(...e.points.map(p=>p[0])),maxX:Math.max(...e.points.map(p=>p[0])),minY:Math.min(...e.points.map(p=>p[1])),maxY:Math.max(...e.points.map(p=>p[1]))}]));
 let lastStatic='',staticMesh=[],visibleEdges=[];
 const labelNodes=[];for(let i=0;i<24;i++){const n=el('span',{class:'street-road-label'});labels.appendChild(n);labelNodes.push(n);}
 function move({zoom=1,yaw=0,pitch=0}={}){focusId='custom';camera={...camera,distance:Math.max(.12,Math.min(100,camera.distance*zoom)),yaw:camera.yaw+yaw,pitch:Math.max(.35,Math.min(1.5,camera.pitch+pitch))};redraw();}
 function focus(id){
  following=false;focusId=id;focusSelect.value=id;const p=network.hotspots.find(h=>h.id===id)??network.anchors.find(a=>a.id===id);
  if(p)camera={...camera,target:[p.x,p.y,0],distance:network.hotspots.some(h=>h.id===id)?1.8:3};
  else {const ps=network.anchors;camera={...camera,target:[mean(ps.map(a=>a.x)),mean(ps.map(a=>a.y)),0],distance:35,yaw:0,pitch:1.2};}
  redraw();
 }
 function mean(values){return values.reduce((a,b)=>a+b,0)/values.length;}
 function redraw(){
  if(destroyed)return;
  const width=Math.max(260,viewport.clientWidth||900),height=Math.max(320,viewport.clientHeight||560);
  const [run,frame,nextFrame,fraction]=current??[null,null,null,0];const nextCars=new Map((nextFrame?.vehicles??[]).map(v=>[v.id,v]));
  const positions=new Map((frame?.vehicles??[]).map(car=>[car.id,streetVehiclePosition(network,car,nextCars.get(car.id),fraction)]));
  if(following&&positions.has(selected)){const p=positions.get(selected);camera.target=[p.x,p.y,0];focusId='custom';}
  if(focusId==='all'&&mode==='3d')camera=fitCameraToPoints(camera,network.anchors.map(a=>[a.x,a.y,0]),width,height);
  const matrix=cameraMatrix(camera,width/height);
  const project=(x,y,z=0)=>mode==='3d'?projectPoint([x,y,z],matrix,width,height):{x:width/2+(x-camera.target[0])*height/camera.distance,y:height/2-(y-camera.target[1])*height/camera.distance,visible:true};
  const staticKey=JSON.stringify([camera.target,camera.distance,width,height]);
  if(lastStatic!==staticKey){
   lastStatic=staticKey;visibleEdges=network.edges.filter(e=>{const b=bounds.get(e.id),[x,y]=camera.target,r=camera.distance*1.5;return b.minX<=x+r&&b.maxX>=x-r&&b.minY<=y+r&&b.maxY>=y-r;});
   const [x,y]=camera.target,span=Math.max(2,camera.distance*3);staticMesh=[];
   quad(staticMesh,[x-span,y-span,-.004],[x+span,y-span,-.004],[x+span,y+span,-.004],[x-span,y+span,-.004],'#eaf0ed');
   append(staticMesh,buildRoadMesh(visibleEdges,.013,'#d7e0de',0));append(staticMesh,buildRoadMesh(visibleEdges,.007,'#ffffff',.001));
  }
  const roadStates=new Map((frame?.roads??[]).map(e=>[e.id,e])),routeIds=new Set(run?.routes[selected?frame?.vehicles.find(v=>v.id===selected)?.route_id:null]?.edge_ids??[]);
  canvas.hidden=mode!=='3d';flat.style.display=mode==='flat'?'block':'none';
  status.textContent=mode==='3d'?'3D · recorded street positions':'Flat streets · recorded positions';scaleLabel.textContent=`${camera.distance<3?'Block detail':'Corridor context'} · drag to orbit · scroll to zoom`;
  const mesh=mode==='3d'?staticMesh.slice():null;
  if(mode==='flat'){flat.setAttribute('viewBox',`0 0 ${width} ${height}`);flat.replaceChildren();}
  const queues=visibleEdges.filter(e=>roadStates.get(e.id)?.queued>0);
  for(const edge of [...visibleEdges.filter(e=>routeIds.has(e.id)||e.id===selectedEdge),...queues]){
   const s=roadStates.get(edge.id),color=edge.id===selectedEdge?'#183e74':s?.spillback?'#bc5544':s?.queued?'#d59a42':'#377dd7';
   if(mode==='3d'){
    append(mesh,buildRoadMesh([edge],Math.max(.007,camera.distance*.002),color,.003));
    if(s?.queued){const p=mids.get(edge.id);box(mesh,p.x,p.y,.003,.009,.009,Math.min(.006,.001+s.queued*.00015),color);}
   }
  }
  if(mode==='flat')for(const edge of visibleEdges){const s=roadStates.get(edge.id);flat.appendChild(svg('polyline',{points:edge.points.map(p=>{const xy=project(...p);return `${xy.x},${xy.y}`;}).join(' '),fill:'none',stroke:edge.id===selectedEdge?'#183e74':s?.spillback?'#bc5544':s?.queued?'#d59a42':routeIds.has(edge.id)?'#377dd7':'#bdcccb','stroke-width':s?.queued||routeIds.has(edge.id)?3:1.5}));}
  hits=[];const carScale=Math.max(.0025,camera.distance*.01);
  for(const car of frame?.vehicles??[]){
   const p=positions.get(car.id),xy=project(p.x,p.y,carScale);if(!xy.visible||xy.x<0||xy.x>width||xy.y<0||xy.y>height)continue;
   hits.push({...xy,id:car.id});const selectedScale=car.id===selected?1.22:1;
   if(mode==='3d'){box(mesh,p.x,p.y,.0018,carScale*3.1,carScale*1.5,carScale*.04,stateColor(car));append(mesh,transformMesh(meshes[car.vehicle_type]??meshes.ipace,{x:p.x,y:p.y,z:.002,scale:carScale*selectedScale,heading:p.heading}));}
   else {const n=svg('g',{transform:`translate(${xy.x} ${xy.y}) rotate(${-p.heading*180/Math.PI}) scale(${car.id===selected?.58:.42})`});n.appendChild(createCarGlyph(stateColor(car)));n.addEventListener('click',()=>onSelect(car.id));flat.appendChild(n);}
  }
  if(mode==='3d'){renderer.draw(mesh,matrix,Math.round(width),Math.round(height));canvas.setAttribute('data-renderer','webgl');}
  const candidates=[];
  if(camera.distance>6)for(const a of network.anchors)candidates.push({id:a.id,name:a.label,x:a.x,y:a.y,priority:100});
  else for(const edge of visibleEdges){const p=mids.get(edge.id),s=roadStates.get(edge.id);candidates.push({id:edge.id,name:edge.name+(s?.queued?` · ${s.queued} queued`:''),x:p.x,y:p.y,priority:(edge.id===selectedEdge?200:0)+(s?.queued??0)+(edge.hotspot===focusSelect.value?3:0),base:edge.name});}
  candidates.sort((a,b)=>b.priority-a.priority||Math.hypot(a.x-camera.target[0],a.y-camera.target[1])-Math.hypot(b.x-camera.target[0],b.y-camera.target[1]));
  const occupied=[],names=new Set();let index=0;
  for(const p of candidates){if(index>=labelNodes.length)break;if(names.has(p.base??p.name))continue;const xy=project(p.x,p.y,.009);const w=Math.min(190,p.name.length*6+18),h=23;
   const rect={x:xy.x-w/2,y:xy.y-28,w,h};if(!xy.visible||rect.x<8||rect.y<8||rect.x+w>width-8||rect.y+h>height-8||occupied.some(a=>rect.x<a.x+a.w+8&&rect.x+w+8>a.x&&rect.y<a.y+a.h+6&&rect.y+h+6>a.y))continue;
   const n=labelNodes[index++];n.hidden=false;n.textContent=p.name;n.style.transform=`translate(${rect.x}px, ${rect.y}px)`;n.style.maxWidth=`${w}px`;occupied.push(rect);names.add(p.base??p.name);
  }
  for(;index<labelNodes.length;index++)labelNodes[index].hidden=true;
 }
 canvas.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY,sx:e.clientX,sy:e.clientY};canvas.setPointerCapture?.(e.pointerId);});
 canvas.addEventListener('pointermove',e=>{if(!drag)return;move({yaw:(e.clientX-drag.x)*.005,pitch:(e.clientY-drag.y)*.004});drag={...drag,x:e.clientX,y:e.clientY};});
 canvas.addEventListener('pointerup',e=>{if(drag&&Math.hypot(e.clientX-drag.sx,e.clientY-drag.sy)<6){const r=canvas.getBoundingClientRect(),hit=hits.map(p=>({...p,d:Math.hypot(p.x-e.clientX+r.left,p.y-e.clientY+r.top)})).filter(p=>p.d<24).sort((a,b)=>a.d-b.d)[0];if(hit)onSelect(hit.id);}drag=null;});
 canvas.addEventListener('pointercancel',()=>{drag=null;});
 canvas.addEventListener('wheel',e=>{e.preventDefault();move({zoom:e.deltaY>0?1.15:.87});},{passive:false});
 canvas.addEventListener('keydown',e=>{const keys={ArrowLeft:{yaw:-.15},ArrowRight:{yaw:.15},ArrowUp:{pitch:.1},ArrowDown:{pitch:-.1},'+':{zoom:.8},'=':{zoom:.8},'-':{zoom:1.25}};if(keys[e.key]){e.preventDefault();move(keys[e.key]);}});
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();mode='flat';views.value='flat';views.querySelector('option[value="3d"]').disabled=true;redraw();});
 const observer=typeof ResizeObserver==='function'?new ResizeObserver(()=>redraw()):null;observer?.observe(viewport);redraw();
 return {element,focus,refresh:redraw,getCamera:()=>({...camera,target:[...camera.target]}),
  render(run,frame,next,fraction=0,id=null){if(current?.[0]!==run)selectedEdge=null;current=[run,frame,next,fraction];selected=id;redraw();},
  selectEdge(id){selectedEdge=id;const p=mids.get(id);if(p){following=false;focusId='custom';camera.target=[p.x,p.y,0];camera.distance=.5;}redraw();onEdgeSelect(id);},
  destroy(){destroyed=true;observer?.disconnect();renderer?.destroy();},
 };
}
