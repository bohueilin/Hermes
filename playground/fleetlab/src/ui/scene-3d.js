// Small native WebGL renderer: actual 3D meshes, perspective camera and depth buffer.
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm=a=>{const l=Math.hypot(...a)||1;return a.map(v=>v/l);};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function multiply4(a,b){const out=Array(16).fill(0);for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)out[c*4+r]+=a[k*4+r]*b[c*4+k];return out;}
export function cameraMatrix(camera,aspect){
 const {target:t,distance:d,yaw:y,pitch:p}=camera;
 const eye=[t[0]+d*Math.cos(p)*Math.sin(y),t[1]-d*Math.cos(p)*Math.cos(y),t[2]+d*Math.sin(p)];
 const z=norm(sub(eye,t)),x=norm(cross([0,0,1],z)),up=cross(z,x);
 const view=[x[0],up[0],z[0],0,x[1],up[1],z[1],0,x[2],up[2],z[2],0,-dot(x,eye),-dot(up,eye),-dot(z,eye),1];
 const f=1/Math.tan(Math.PI/8),near=.02,far=1000;
 const perspective=[f/Math.max(.1,aspect),0,0,0,0,f,0,0,0,0,(far+near)/(near-far),-1,0,0,2*far*near/(near-far),0];
 return multiply4(perspective,view);
}
export function projectPoint(point,matrix,width,height){
 const v=[...point,1],r=[0,0,0,0];for(let i=0;i<4;i++)for(let j=0;j<4;j++)r[i]+=matrix[j*4+i]*v[j];
 const w=r[3],x=r[0]/w,y=r[1]/w,z=r[2]/w;
 return {x:(x+1)*width/2,y:(1-y)*height/2,visible:w>0&&z>=-1&&z<=1&&Math.abs(x)<1.15&&Math.abs(y)<1.15,depth:z};
}
export function orbitCamera(camera,{yaw=0,pitch=0,zoom=1}={}){
 return {...camera,target:[...camera.target],yaw:camera.yaw+yaw,pitch:clamp(camera.pitch+pitch,.25,1.47),distance:clamp(camera.distance*zoom,2,180)};
}
export function pointOnPath(points,progress){
 if(!points?.length)return {x:0,y:0,heading:0};
 if(points.length===1)return {x:points[0][0],y:points[0][1],heading:0};
 const lengths=points.slice(1).map((p,i)=>Math.hypot(p[0]-points[i][0],p[1]-points[i][1]));
 let remaining=lengths.reduce((a,b)=>a+b,0)*clamp(progress,0,1);
 for(let i=0;i<lengths.length;i++)if(remaining<=lengths[i]||i===lengths.length-1){const a=points[i],b=points[i+1],t=lengths[i]?remaining/lengths[i]:0;return {x:a[0]+(b[0]-a[0])*t,y:a[1]+(b[1]-a[1])*t,heading:Math.atan2(b[1]-a[1],b[0]-a[0])};}else remaining-=lengths[i];
 return {x:points.at(-1)[0],y:points.at(-1)[1],heading:0};
}
const rgb=color=>typeof color==='string'?[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)/255):color;
export function triangle(out,a,b,c,color){const col=rgb(color);for(const p of [a,b,c])out.push(...p,...col);}
export function quad(out,a,b,c,d,color){triangle(out,a,b,c,color);triangle(out,a,c,d,color);}
export function box(out,x,y,z,l,w,h,color){
 const p=[[x-l/2,y-w/2,z],[x+l/2,y-w/2,z],[x+l/2,y+w/2,z],[x-l/2,y+w/2,z],[x-l/2,y-w/2,z+h],[x+l/2,y-w/2,z+h],[x+l/2,y+w/2,z+h],[x-l/2,y+w/2,z+h]];
 for(const [indices,light] of [[[4,5,6,7],1],[[0,1,5,4],.78],[[1,2,6,5],.86],[[2,3,7,6],.73],[[3,0,4,7],.68]])quad(out,...indices.map(i=>p[i]),rgb(color).map(c=>c*light));
}
function cylinder(out,x,y,z,radius,height,color,sides=10){
 for(let i=0;i<sides;i++){const a=i/sides*Math.PI*2,b=(i+1)/sides*Math.PI*2,p=[x+Math.cos(a)*radius,y+Math.sin(a)*radius,z],q=[x+Math.cos(b)*radius,y+Math.sin(b)*radius,z];quad(out,p,q,[q[0],q[1],z+height],[p[0],p[1],z+height],rgb(color).map(c=>c*(.75+.2*Math.cos(a))));triangle(out,[x,y,z+height],[p[0],p[1],z+height],[q[0],q[1],z+height],color);}
}
export function buildCarMesh(type='ipace',color='#f4f7ee'){
 const out=[],van=type==='ojai',length=van?2.65:2.5,width=van?1.22:1.1;
 // Proportions distinguish a taller van and a sloping SUV; geographic scale is deliberately exaggerated.
 box(out,0,0,.18,length,width,.35,color);
 box(out,van?-.1:-.12,0,.53,van?1.95:1.45,width*.87,van?.65:.43,'#94bcc0');
 box(out,van?-.1:-.14,0,van?1.15:.94,van?1.91:1.36,width*.89,.09,color);
 box(out,0,-width*.48,.58,.1,.05,van?.55:.36,color);box(out,-.6,-width*.48,.58,.09,.05,van?.55:.3,color);
 for(const x of [-.8,.78])for(const y of [-width*.49,width*.49])box(out,x,y,.08,.43,.21,.36,'#2b3b3a');
 for(const y of [-width*.32,width*.32]){box(out,length/2+.01,y,.37,.04,.24,.10,'#fff0bd');box(out,-length/2-.01,y,.38,.04,.18,.1,'#d98e77');}
 cylinder(out,0,0,van?1.23:1.03,.18,.18,'#e9eeea');cylinder(out,0,0,van?1.4:1.2,.15,.10,'#354f50');
 return out;
}
export function buildRoadMesh(roads,width=.055,color='#c5cbbb',z=.015){
 const out=[];for(const road of roads){const points=road.points??road;for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);if(!len)continue;
  const nx=-dy/len*width/2,ny=dx/len*width/2;
  quad(out,[a[0]+nx,a[1]+ny,z],[b[0]+nx,b[1]+ny,z],[b[0]-nx,b[1]-ny,z],[a[0]-nx,a[1]-ny,z],color);
 }}return out;
}
export function transformMesh(mesh,{x=0,y=0,z=0,scale=1,heading=0}={}){
 const out=[],cs=Math.cos(heading),sn=Math.sin(heading);for(let i=0;i<mesh.length;i+=6){const a=mesh[i]*scale,b=mesh[i+1]*scale;out.push(x+a*cs-b*sn,y+a*sn+b*cs,z+mesh[i+2]*scale,mesh[i+3],mesh[i+4],mesh[i+5]);}return out;
}
export function createWebGLRenderer(canvas){
 const gl=canvas.getContext?.('webgl',{alpha:false,antialias:true,preserveDrawingBuffer:true});if(!gl)return null;
 const shader=(kind,source)=>{const s=gl.createShader(kind);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){gl.deleteShader(s);throw Error('3D shader unavailable.');}return s;};
 let program,buffer;
 try{
  program=gl.createProgram();const vs=shader(gl.VERTEX_SHADER,'attribute vec3 position;attribute vec3 color;uniform mat4 camera;varying vec3 vColor;void main(){gl_Position=camera*vec4(position,1.0);vColor=color;}');
  const fs=shader(gl.FRAGMENT_SHADER,'precision mediump float;varying vec3 vColor;void main(){gl_FragColor=vec4(vColor,1.0);}');
  gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);
  if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('3D program unavailable.');
  buffer=gl.createBuffer();gl.useProgram(program);gl.enable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);
  const pos=gl.getAttribLocation(program,'position'),col=gl.getAttribLocation(program,'color'),camera=gl.getUniformLocation(program,'camera');
  return {
   draw(mesh,matrix,width,height){if(canvas.width!==width)canvas.width=width;if(canvas.height!==height)canvas.height=height;gl.viewport(0,0,width,height);gl.clearColor(.85,.92,.91,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(program);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(mesh),gl.DYNAMIC_DRAW);gl.enableVertexAttribArray(pos);gl.vertexAttribPointer(pos,3,gl.FLOAT,false,24,0);gl.enableVertexAttribArray(col);gl.vertexAttribPointer(col,3,gl.FLOAT,false,24,12);gl.uniformMatrix4fv(camera,false,new Float32Array(matrix));gl.drawArrays(gl.TRIANGLES,0,mesh.length/6);},
   destroy(){gl.deleteBuffer(buffer);gl.deleteProgram(program);},
  };
 }catch{if(buffer)gl.deleteBuffer(buffer);if(program)gl.deleteProgram(program);return null;}
}

/** Fit actual projected locations, including perspective foreshortening on narrow screens. */
export function fitCameraToPoints(camera,points,width,height){
 const fitted={...camera,target:[...camera.target]};
 for(let attempt=0;attempt<32;attempt++){
  const matrix=cameraMatrix(fitted,width/height);
  if(points.every(point=>{const p=projectPoint(point,matrix,width,height);return p.visible&&p.x>=width*.1&&p.x<=width*.9&&p.y>=height*.1&&p.y<=height*.9;}))break;
  fitted.distance*=1.1;
 }
 return fitted;
}
