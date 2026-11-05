import test from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';
import {freshState} from '../src/state.js';import {createUnfinishedMall} from '../src/city/unfinished-mall.js';
import {MALL_SITE} from '../src/city/new-places.js';import {createConstructionWorkers} from '../src/npc/construction-workers.js';
import {policeCombat} from '../src/npc/police-combat.js';import {policeVehicleContact} from '../src/npc/police-vehicle.js';import {createPoliceResponse,damagePolice} from '../src/npc/police-response.js';
import {pickupWeapon,equipSlot} from '../src/adventure/state.js';import {roadHeight,BRIDGE_JUNCTIONS,exposedBridgeRail} from '../src/city/terrain.js';import {point} from '../src/city/reference-layout.js';
import {CACHE_SIZE} from '../src/city/colleague-caches.js';import {MELEE_TIMING,meleePose} from '../src/visuals/weapon-rig.js';
test('every successful strike on a car has precisely a four-percent ejection chance and does not directly punch the driver',()=>{
 let ejections=0;for(let i=0;i<100;i++){const officer={},input={hostile:true,inVehicle:true,distance:.7,clear:true};policeCombat(officer,input,.01,()=>i/100);const hit=policeCombat(officer,input,.2,()=>i/100);assert.equal(hit.vehicleHit,true);assert.equal(hit.damage,0);ejections+=Number(hit.eject);assert.equal(policeCombat(officer,input,.05).vehicleHit,false);}assert.equal(ejections,4);
});
test('vehicle pursuit targets a reachable side of the measured rotated body',()=>{
 const vehicle={mesh:new T.Group(),w:1.25,l:2.6,heading:0};let contact=policeVehicleContact(new T.Vector3(5,0,0),vehicle);assert.equal(contact.distance,3.75);assert.equal(contact.x,1.85);vehicle.heading=Math.PI/2;contact=policeVehicleContact(new T.Vector3(5,0,0),vehicle);assert.ok(Math.abs(contact.x-3.2)<1e-8);assert.ok(contact.distance<2.5);
});
test('four builders actually walk and climb between floors, and the shovel carrier can die with persistent health',()=>{
 const state=freshState(),world={people:[],blockedAt:()=>false},s=MALL_SITE,sx=s.w/24,ladders=[0,1,2].map(i=>({id:'mall-ladder:'+i,x:s.x+(-21+i*7)*sx,z:s.z+15.12,nx:0,nz:1,y0:i*4.2,top:(i+1)*4.2,exit:{x:s.x+(-21+i*7)*sx,z:s.z+13}}));
 const crew=createConstructionWorkers(world,state,s,ladders,{human:(x,z)=>{const mesh=new T.Group();mesh.position.set(x,0,z);return {mesh,home:new T.Vector3(),stun:0,kind:'worker'};}});
 const seen=new Set();for(let i=0;i<1200;i++){state.time+=.05;for(const n of crew.workers){crew.update(n,.05);if(n.climb)seen.add(n.workerIndex);}}assert.deepEqual([...seen].sort(),[0,1,2]);assert.ok(crew.workers.slice(0,3).every(n=>n.workerTrips>=1));const carrier=crew.workers[3];assert.equal(carrier.weapon,'shovel');damagePolice(carrier,36,61);damagePolice(carrier,36,62);assert.ok(carrier.dead);assert.equal(state.adventure.constructionWorkers[3].health,0);
});
test('new shovel has its own inventory slot and two-handed attack animation without buying it',()=>{const s=freshState();assert.equal(equipSlot(s,8),false);pickupWeapon(s,'shovel');assert.equal(equipSlot(s,8),true);assert.equal(s.adventure.equipped,'shovel');assert.ok(MELEE_TIMING.shovel.quick.impact>0);assert.equal(meleePose('shovel',.5).twoHanded,true);});
test('southern bridge bend has one continuous level deck across its junction, including sidewalks',()=>{
 const p=point(1185,750);assert.equal(BRIDGE_JUNCTIONS.some(j=>Math.hypot(j.x-p.x,j.z-p.z)<.01),false);const j={height:.025};for(const [u,v]of [[1185,750],[1182,750],[1185,747],[1188,750],[1185,753]]){const q=point(u,v);assert.ok(Math.abs(roadHeight(q.x,q.z)-j.height)<1e-6);}
 assert.ok(Math.abs(CACHE_SIZE*3-.8)<1e-8);
});

test('blue street patrols keep walking without wanted stars and join tactical police when wanted rises',()=>{const s=freshState(),all=Array.from({length:18},(_,i)=>({kind:'police',patrolPolice:i>=12,policeIndex:i,mesh:new T.Group(),home:new T.Vector3(),stun:0})),w={people:all,walkways:{nodes:Array.from({length:24},(_,i)=>({x:(i-12)*4.5,z:33}))},groundHeight:()=>0,blockedAt:()=>false},r=createPoliceResponse(w,s);r.update(new T.Vector3(),0);assert.equal(r.diagnostics.active,0);assert.equal(r.diagnostics.patrols,2);const n=all.find(n=>n.patrolPolice&&n.activePolice);assert.ok(n);assert.ok(Math.hypot(r.patrolIntent(n).x-n.home.x,r.patrolIntent(n).z-n.home.z)>4);s.wanted=1;r.update(new T.Vector3(),1);assert.equal(r.diagnostics.active,2);assert.equal(all.filter(n=>n.activePolice&&!n.dead).length,4);});
test('bridge rails leave crossing carriageways and footpaths open',()=>{const road={start:{x:0,z:0},dx:0,dz:1,length:10,width:4},other={start:{x:-10,z:5},dx:1,dz:0,length:20,width:4};assert.equal(exposedBridgeRail(road,2.12,5,[road,other]),false);assert.equal(exposedBridgeRail(road,2.12,1,[road,other]),true);});
