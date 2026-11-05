import test from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';import {readFile} from 'node:fs/promises';import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {hasRoadDriver,createStreetActors} from '../src/npc/street-actors.js';import {meleePose} from '../src/visuals/weapon-rig.js';import {createParkour} from '../src/city/parkour.js';import {createTraversal} from '../src/city/traversal.js';
import {NPC_LADDER_SPEED,HERO_LADDER_SPEED} from '../src/city/traversal-speeds.js';import {freshState} from '../src/state.js';import {point,rawWater,isReferenceWater} from '../src/city/reference-layout.js';import {coastPixelAt,quayEnds,planCoastDecks,coastFloorAt} from '../src/city/coast-layout.js';
import {ROAD_PROFILES} from '../src/city/terrain.js';import {clipSurface,roadPolygon} from '../src/city/planar-surfaces.js';
test('parked vehicles never invent a driver; actual road traffic retains its owner while stopped',()=>{
 for(const parked of [{traffic:false,speed:0},{traffic:true,speed:0,trafficRoute:null}]){
  const v={...parked,id:1,mesh:new T.Group(),w:1.2,l:2.3,heading:0},n={kind:'driver',mesh:new T.Group(),home:new T.Vector3()},world={vehicles:[v],driverPool:[n],residentPool:[],seats:[],player:{mesh:new T.Group()},blockers:[],groundHeight:()=>0,blockedAt:()=>false};
  const actors=createStreetActors(world,freshState());actors.update(.1,0,new T.Vector3(5,0,5));assert.equal(v.driver,undefined);assert.equal(actors.exit(v),null);assert.equal(actors.diagnostics.exits,0);
 }
 assert.equal(hasRoadDriver({traffic:true,cameFromTraffic:true,speed:0}),true);assert.equal(hasRoadDriver({traffic:true,trafficRoute:{},speed:5}),true);assert.equal(hasRoadDriver({traffic:true,cameFromTraffic:true,claimed:true}),false);
 const v={id:12,traffic:true,cameFromTraffic:true,mesh:new T.Group(),w:1,l:2,heading:0,speed:4},n={kind:'driver',mesh:new T.Group(),home:new T.Vector3()},p=new T.Vector3(3,0,0),world={vehicles:[v],driverPool:[n],residentPool:[],seats:[],player:{mesh:new T.Group()},blockers:[],groundHeight:()=>0,blockedAt:()=>false};
 const actors=createStreetActors(world,freshState());actors.update(.1,0,p);assert.equal(v.driver,n);assert.equal(n.insideCar,true);assert.equal(actors.exit(v,'theft',p),n);actors.update(1,1,p);assert.equal(n.insideCar,false);assert.equal(n.exitMotion,null);assert.equal(actors.diagnostics.exits,1);
});
test('both shovel grips lie on real wood and its carry axis is horizontal in third and first person',async()=>{
 const b=await readFile(new URL('../public/models/equipment/shovel.glb',import.meta.url)),g=await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');g.scene.updateMatrixWorld(true);let wood;g.scene.traverse(n=>{if(n.isMesh&&n.material.name.startsWith('DarkWood'))wood=n;});assert.ok(wood);const bounds=new T.Box3().setFromObject(wood);
 for(const name of ['HandleGripRight','HandleGripLeft']){const p=g.scene.getObjectByName(name).getWorldPosition(new T.Vector3());assert.ok(bounds.containsPoint(p),name+' must hold the wooden shaft');}
 for(const first of [false,true]){const pose=meleePose('shovel',0,false,first),axis=new T.Vector3(0,1,0).applyQuaternion(pose.quaternion);assert.ok(Math.abs(axis.y)<1e-7);assert.equal(pose.twoHanded,true);}
});
test('hero actually climbs twenty percent faster than NPCs and wire travel is thirteen metres per second',()=>{
 const mesh=new T.Group();mesh.position.set(-2.4,0,0);const world={player:{mesh},roofs:[{id:'roof',x:0,z:0,w:2,d:2,y:10,ladder:{x:-2.08,z:0,nx:-1,nz:0}}],blockers:[],garages:[],vehicles:[],parkourSurfaces:[],cables:{wires:[]},yards:{fences:[]},groundHeight:()=>0,blockedAt:()=>false},p=createParkour(new T.Scene(),world,freshState());assert.ok(p.tryGrab());const before=mesh.position.y;p.advanceClimb(1,new Set(['KeyW']));assert.ok(Math.abs(mesh.position.y-before-HERO_LADDER_SPEED)<1e-8);assert.equal(HERO_LADDER_SPEED/NPC_LADDER_SPEED,1.2);p.dispose();
 mesh.position.set(0,10,0);world.cables.wires=[{id:'wire',length:40,a:{x:0,z:0,y:15.8,roofY:10},b:{x:40,z:0,y:15.8,roofY:10}}];const t=createTraversal(new T.Scene(),world,{});assert.ok(t.grab());t.advance(1.15);const x=mesh.position.x;t.advance(.5);assert.ok(Math.abs(mesh.position.x-x-6.5)<1e-7);t.dispose();
});
test('river is west of the full southern turn and large vehicle corners stay on dry land',()=>{
 for(const [u,v]of [[1185,750],[1173,750],[1168,710],[1120,770]])assert.equal(rawWater(u,v),false);
 for(const angle of [0,.4,Math.PI/2,1.9]){const p=point(1185,750),rx=Math.abs(Math.cos(angle))*1.35+Math.abs(Math.sin(angle))*4.25,rz=Math.abs(Math.sin(angle))*1.35+Math.abs(Math.cos(angle))*4.25;for(const dx of [-rx,rx])for(const dz of [-rz,rz])assert.equal(rawWater((p.x+dx+334)/.4,(p.z+dz+188)/.4),false);}
 assert.equal(rawWater(1085,770),true);assert.equal(isReferenceWater(1085,770),false,'remaining crossing is a straight supported bridge');
});
test('granite promenade reaches both river banks, remains continuous and never covers asphalt',()=>{
 const floors=planCoastDecks();for(const offset of [5,12,17]){const {from,to}=quayEnds(offset);for(let u=from+1;u<to-1;u+=2.3){const p=point(u,coastPixelAt(u)-offset);assert.ok(coastFloorAt(floors,p.x,p.z)>=.08,'quay gap at '+u);}}
 const p=point(620,coastPixelAt(620)-12);assert.ok(coastFloorAt(floors,p.x,p.z)>=.08,'western extension');
 const area=p=>Math.abs(p.reduce((n,a,i)=>{const b=p[(i+1)%p.length];return n+a.x*b.z-b.x*a.z;},0)/2);
 for(const f of floors.filter(f=>f.kind==='granite-quay'))for(const r of ROAD_PROFILES){const pieces=clipSurface(f.polygon,[roadPolygon(r)]);assert.ok(area(f.polygon)-pieces.reduce((n,p)=>n+area(p),0)<1e-6);}
});
test('blue patrol uses its own fully skinned police uniform with fitted cap and all recorded animations',async()=>{
 const b=await readFile(new URL('../public/models/characters/police-patrol.glb',import.meta.url)),g=await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');assert.equal(g.animations.length,18);const cap=g.scene.getObjectByName('Police_fitted_peaked_cap');assert.ok(cap?.isSkinnedMesh);assert.ok(cap.skeleton.bones.some(n=>n.name==='Head'));assert.ok(g.scene.getObjectByName('POLICE_back_label'));assert.equal(g.scene.getObjectByName('Backpack'),undefined);
});
