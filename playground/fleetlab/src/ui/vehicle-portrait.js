import {el} from './dom.js';
import {buildCarMesh,cameraMatrix,createWebGLRenderer,box} from './scene-3d.js';
import {createCarGlyph} from './car-glyph.js';
/** Static illustrative portraits, using the exact same 3D vehicle meshes as the map. */
export function createVehiclePortrait(type,label){
 const canvas=el('canvas',{class:'bay-vehicle-portrait',role:'img','aria-label':`${label}: illustrative 3D ${type==='ojai'?'minivan':'SUV'}`});
 const renderer=createWebGLRenderer(canvas);
 if(renderer){const mesh=[];box(mesh,0,0,0,3.3,2,.04,'#bad0c2');mesh.push(...buildCarMesh(type,type==='ojai'?'#d8e3f3':'#f3f5ec'));renderer.draw(mesh,cameraMatrix({target:[0,0,.6],distance:4.7,yaw:-.65,pitch:.60},1.7),255,150);return {element:canvas,destroy:()=>renderer.destroy()};}
 const fallback=document.createElementNS('http://www.w3.org/2000/svg','svg');fallback.setAttribute('viewBox','-24 -18 48 36');fallback.setAttribute('class','bay-vehicle-portrait');fallback.setAttribute('role','img');fallback.setAttribute('aria-label',`${label}: illustrative vehicle`);fallback.appendChild(createCarGlyph(type==='ojai'?'#9baed6':'#789b81'));return {element:fallback,destroy(){}};
}
