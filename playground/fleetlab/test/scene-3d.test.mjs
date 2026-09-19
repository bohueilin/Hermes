import assert from 'node:assert/strict';
import {test} from 'node:test';
import {cameraMatrix,projectPoint,buildCarMesh,buildRoadMesh,pointOnPath,orbitCamera} from '../src/ui/scene-3d.js';

test('perspective camera projects its target to the screen center and preserves depth',()=>{
 const camera={target:[0,0,0],distance:30,yaw:0,pitch:0.9};const matrix=cameraMatrix(camera,1.5);
 const p=projectPoint([0,0,0],matrix,900,600);assert.ok(Math.abs(p.x-450)<1e-4);assert.ok(Math.abs(p.y-300)<1e-4);assert.equal(p.visible,true);
 const above=projectPoint([0,0,2],matrix,900,600);assert.ok(above.y<p.y);
});
test('orbit and zoom stay within useful non-singular camera bounds',()=>{
 const c=orbitCamera({target:[0,0,0],distance:30,yaw:0,pitch:0.9},{yaw:2,pitch:20,zoom:0.00001});
 assert.ok(c.pitch<Math.PI/2);assert.ok(c.distance>=2);assert.ok(cameraMatrix(c,1).every(Number.isFinite));
});
test('SUV and minivan are bounded 3D meshes with different silhouettes',()=>{
 const suv=buildCarMesh('ipace'),van=buildCarMesh('ojai');
 for(const mesh of [suv,van]){assert.ok(mesh.length>300);assert.equal(mesh.length%18,0);assert.ok(mesh.every(Number.isFinite));const z=mesh.filter((_,i)=>i%6===2);assert.ok(Math.max(...z)>0);}
 assert.notDeepEqual(suv,van);
});
test('car movement follows actual polyline distance and returns a heading',()=>{
 const path=[[0,0],[3,0],[3,4]];
 assert.deepEqual(pointOnPath(path,0),{x:0,y:0,heading:0});
 const p=pointOnPath(path,0.5);assert.equal(p.x,3);assert.equal(p.y,0.5);assert.equal(p.heading,Math.PI/2);
 assert.equal(pointOnPath(path,1).y,4);
});
test('road mesh has positive width and no nonfinite vertices for duplicate route points',()=>{
 const mesh=buildRoadMesh([{points:[[0,0],[0,0],[1,1]]}],.05);
 assert.ok(mesh.length>0);assert.ok(mesh.every(Number.isFinite));
});

test('overview framing keeps every Bay Area place inside a narrow phone viewport',async()=>{
 const {fitCameraToPoints}=await import('../src/ui/scene-3d.js');const {BAY_AREA_PLACES}=await import('../src/model/bay-area.js');
 const points=BAY_AREA_PLACES.map(p=>[p.x,p.y,0]),camera={target:[30,30,0],distance:80,yaw:0,pitch:.9};
 const fitted=fitCameraToPoints(camera,points,309,500),matrix=cameraMatrix(fitted,309/500);
 for(const point of points){const p=projectPoint(point,matrix,309,500);assert.ok(p.visible&&p.x>309*.09&&p.x<309*.91&&p.y>500*.09&&p.y<500*.91);}
 assert.equal(camera.distance,80);
});
