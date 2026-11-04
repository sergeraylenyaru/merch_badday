import test from 'node:test';import assert from 'node:assert/strict';import {Group,Vector3} from 'three';
import {freshState,save,load} from '../src/state.js';
import {pickupWeapon,equipSlot} from '../src/adventure/state.js';
import {acceptSideWork,advanceSideCargo,interactSideCargo,ensureSideWork} from '../src/jobs/side-work.js';
import {vehicleHitsPerson,separatePeople} from '../src/npc/body-collision.js';
import {createRoofPursuit} from '../src/npc/roof-pursuit.js';
import {rectanglePolygon,clipSurface,appendSurface} from '../src/city/planar-surfaces.js';
import {planPotholes} from '../src/city/road-wear.js';
test('numbered weapon slots keep collected weapons while allowing empty hands and reject missing weapons',()=>{
 const s=freshState();assert.equal(equipSlot(s,2),false);pickupWeapon(s,'bat');assert.equal(equipSlot(s,1),true);assert.equal(s.adventure.equipped,null);assert.deepEqual(s.adventure.inventory,['bat']);assert.equal(equipSlot(s,2),true);assert.equal(s.adventure.equipped,'bat');for(const [slot,id]of [[3,'stick'],[4,'water']]){pickupWeapon(s,id);assert.equal(equipSlot(s,slot),true);assert.equal(s.adventure.equipped,id);}assert.equal(equipSlot(s,5),false);
});
test('shop deliveries require real driving, survive reload and pay only once; urgent bonuses respect the deadline',()=>{
 for(const [type,late,pay]of [['delivery',false,160],['express',false,280],['express',true,180]]){
  const s=freshState(),live=ensureSideWork(s);assert.ok(acceptSideWork(s,0,type,{x:50,z:60,label:'Дом 7'}));assert.ok(live.active,'the live world must immediately see the accepted cargo');assert.equal(interactSideCargo(s,'address').needsCar,true);
  for(let x=0;x<16;x++)advanceSideCargo(s,{x,z:0},true);
  const storage={value:null,setItem(k,v){this.value=v;},getItem(){return this.value;}};save(s,storage);const restored=load(storage);ensureSideWork(restored);if(late)restored.time=181;
  assert.equal(interactSideCargo(restored,'address').amount,pay);assert.equal(restored.money,300+pay);assert.equal(interactSideCargo(restored,'address').ok,false);assert.equal(acceptSideWork(restored,0,type,{x:50,z:60}),false);
 }
});
test('returning crates requires collecting at the address, driving back and reaching the original stockroom',()=>{
 const s=freshState();acceptSideWork(s,2,'returns',{x:40,z:50,label:'Дом 8'});assert.equal(interactSideCargo(s,'store').ok,false);assert.equal(interactSideCargo(s,'address').collected,true);assert.equal(interactSideCargo(s,'address').ok,false);for(let x=0;x<16;x++)advanceSideCargo(s,{x,z:0},true);assert.equal(interactSideCargo(s,'store').amount,170);assert.equal(s.money,470);
});
test('vehicle contact uses a narrow body radius and the actual rotation, including front and rear corners',()=>{
 const v={mesh:{position:new Vector3()},w:1,l:2,heading:0,h:1.6};assert.equal(vehicleHitsPerson(v,new Vector3(2.5,0,0)),false);assert.equal(vehicleHitsPerson(v,new Vector3(1.2,0,0)),true);assert.equal(vehicleHitsPerson(v,new Vector3(1.3,0,0)),false);assert.equal(vehicleHitsPerson(v,new Vector3(0,8,0)),false);v.heading=Math.PI/2;assert.equal(vehicleHitsPerson(v,new Vector3(2.2,0,0)),true);assert.equal(vehicleHitsPerson(v,new Vector3(0,0,1.4)),false);
});
test('standing people separate without moving through walls or colliding with people on another floor',()=>{
 const people=Array.from({length:6},(_,i)=>{const mesh=new Group();mesh.position.set(1+i*.08,0,0);return {mesh,stun:0};});for(let n=0;n<50;n++)separatePeople(people,(x)=>x<0);
 for(let i=0;i<people.length;i++)for(let j=i+1;j<people.length;j++)assert.ok(people[i].mesh.position.distanceTo(people[j].mesh.position)>.56);assert.ok(people.every(n=>n.mesh.position.x>=0));const high={mesh:new Group(),stun:0};high.mesh.position.set(1,10,0);people.push(high);const before=high.mesh.position.clone();separatePeople(people,()=>false);assert.ok(high.mesh.position.equals(before));
});
test('officers climb the actual ladder in sequence, walk on the roof and descend instead of teleporting',()=>{
 const mesh=new Group();mesh.position.set(-9.03,0,0);const n={mesh,stun:0},second={mesh:new Group(),stun:0};second.mesh.position.copy(mesh.position);
 const l={id:'r',x:-8.68,z:0,y0:0,top:12,exit:{x:-7.13,y:12,z:0}},r={id:'r',x:0,z:0,y:12,w:8,d:6};
 const world={people:[n,second],roofs:[r],parkour:{diagnostics:{ladders:[l]}},groundHeight:()=>0,blockedAt:()=>false},pursuit=createRoofPursuit(world),player=new Vector3(0,12,0);let animated=false;
 for(let f=0;f<160;f++){const old=mesh.position.y,result=pursuit.update(n,player,.05,true);pursuit.update(second,player,.05,true);if(n.climb)animated=true;assert.ok(Math.abs(mesh.position.y-old)<.3);if(result.onRoof)result.move(player,3);if(n.climb&&second.climb)assert.ok(Math.abs(mesh.position.y-second.mesh.position.y)>2.1||Math.hypot(mesh.position.x-second.mesh.position.x,mesh.position.z-second.mesh.position.z)>.6);}
 assert.ok(animated);assert.equal(n.roofPursuit.phase,'roof');assert.equal(mesh.position.y,12);assert.ok(mesh.position.x> -6);
 for(let f=0;f<400;f++){pursuit.update(n,new Vector3(0,0,0),.05,false);pursuit.update(second,new Vector3(0,0,0),.05,false);}
 assert.equal(n.roofPursuit,null);assert.ok(mesh.position.y<.2);
});
test('paving and road intersections are cut into disjoint triangles with shared edges and upward normals',()=>{
 const main=rectanglePolygon(0,0,20,4),cross=rectanglePolygon(0,0,4,20),pieces=clipSurface(cross,[main]);assert.equal(pieces.length,2);
 const data={positions:[],uv:[]};for(const p of pieces)appendSurface(data,p,()=>.025);let area=0;
 for(let i=0;i<data.positions.length;i+=9){const a=new Vector3(...data.positions.slice(i,i+3)),b=new Vector3(...data.positions.slice(i+3,i+6)),c=new Vector3(...data.positions.slice(i+6,i+9)),normal=b.sub(a).cross(c.sub(a));assert.ok(normal.y>0);area+=normal.y/2;}
 assert.ok(Math.abs(area-64)<1e-6);assert.deepEqual(clipSurface(main,[main]),[]);assert.ok(planPotholes().length>=10);
});
