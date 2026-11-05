import test from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';
import {bridgeSurfaces} from '../src/city/bridge-surfaces.js';
import {PARK_BRIDGES,WALK_JOINS} from '../src/city/reference-layout.js';
import {buildReferenceTerrain} from '../src/city/reference-city.js';
import {clipSurface} from '../src/city/planar-surfaces.js';
import {roadHeight} from '../src/city/terrain.js';

test('both model bridges keep full collision support without a second visible central deck',()=>{
 for(const b of PARK_BRIDGES){const data=bridgeSurfaces(b);assert.equal(data.positions.length,288*3);assert.equal(data.rampPositions.length,96*3);
  for(let i=0;i<data.rampPositions.length;i+=3){const x=data.rampPositions[i]-b.x,z=data.rampPositions[i+2]-b.z;assert.ok(Math.abs(x*Math.cos(b.angle)+z*Math.sin(b.angle))>=b.length/2-1e-6);}
  for(let i=0;i<data.positions.length;i+=3)assert.ok(Math.abs(data.positions[i+1]-roadHeight(data.positions[i],data.positions[i+2]))<.06);
 }
});
test('park-to-business pedestrian bends meet paving along edges, with no coplanar overlap',()=>{
 const scene=new T.Scene(),mat=new T.MeshBasicMaterial(),world={box:()=>new T.Object3D(),terrainCollider(){},terrainMaterials:{byColor:new Map([['#708666',mat],['#414f59',mat],['#bcad8e',mat]]),water:mat}};
 buildReferenceTerrain(world,scene);
 const paving=scene.getObjectByName('joined-park-paving'),bends=scene.getObjectByName('joined-pedestrian-bends');assert.ok(bends.geometry.attributes.position.count>0);assert.equal(WALK_JOINS.length,2);
 const triangles=mesh=>{const a=mesh.geometry.attributes.position,out=[];for(let i=0;i<a.count;i+=3)out.push([0,1,2].map(j=>({x:a.getX(i+j),z:a.getZ(i+j)})));return out;};
 const area=p=>Math.abs(p.reduce((n,a,i)=>{const b=p[(i+1)%p.length];return n+a.x*b.z-b.x*a.z;},0)/2);
 for(const a of triangles(bends))for(const b of triangles(paving)){const remaining=clipSurface(a,[b]).reduce((n,p)=>n+area(p),0);assert.ok(area(a)-remaining<1e-4,'pedestrian bend overlaps park paving');}
 scene.traverse(n=>n.geometry?.dispose());mat.dispose();
});
