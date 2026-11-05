import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from 'three';
import {reportCrime,REPORT_CHANCE} from '../src/adventure/crime.js';
import {equipmentRay,frightenWithWater,waterEscapeGoal} from '../src/adventure/aim.js';
import {guardGun,GUARD_PISTOL} from '../src/npc/guard-gun.js';
import {rollPoliceLoot} from '../src/adventure/police-loot.js';
import {freshState} from '../src/state.js';

for(const [event,chance]of Object.entries(REPORT_CHANCE))test(`${event}: exact ${chance*100}% reporting boundary and one roll per incident`,()=>{
 const s=freshState();let calls=0;s.time=10;s.stress=60;
 assert.equal(reportCrime(s,1,event,()=>{calls++;return chance-1e-8;}).reported,true);assert.equal(calls,1);assert.equal(s.wanted,1);
 s.wantedElapsed=4;s.wantedParkourCredit=2;
 assert.deepEqual(reportCrime(s,1,event,()=>chance),{reported:false,gained:0});assert.equal(s.wanted,1);assert.equal(s.wantedElapsed,4);assert.equal(s.wantedParkourCredit,2);
 let reported=0;for(let i=0;i<1000;i++)reported+=Number(reportCrime(freshState(),1,event,()=>i/1000).reported);
 assert.equal(reported,chance*1000);
});
test('reporting retains the five-second calm wanted cooldown',()=>{
 const s=freshState();s.stress=20;s.time=10;assert.equal(reportCrime(s,1,'assault',()=>0).gained,1);s.time=14.9;assert.equal(reportCrime(s,1,'assault',()=>0).gained,0);s.time=15;assert.equal(reportCrime(s,1,'assault',()=>0).gained,1);
});
test('water hits a body at muzzle height, stops at a wall and can aim vertically',()=>{
 const person={mesh:new T.Group(),stun:0};person.mesh.position.set(0,0,4);
 const world={people:[person],blockers:[],groundHeight:()=>0},origin=new T.Vector3(0,1.2,0),direction=new T.Vector3(0,0,1);
 assert.equal(equipmentRay(world,origin,direction,12).person,person);
 const surfaceHit=equipmentRay(world,origin,direction,12);assert.equal(equipmentRay(world,origin,direction,surfaceHit.distance).person,person,'an exact endpoint contact is a hit');
 world.blockers.push({x:0,z:2,w:1,d:.15,h:3});assert.equal(equipmentRay(world,origin,direction,12).person,null);assert.ok(equipmentRay(world,origin,direction,12).distance<2);
 world.blockers=[];person.mesh.position.set(0,4,4);assert.equal(equipmentRay(world,origin,new T.Vector3(0,4,4).normalize(),12).person,person);
});
test('water makes civilians, police and armed guards flee without damage, falling or a loot drop',()=>{
 for(const kind of ['civilian','police','guard']){const s=freshState(),person={kind,dead:false,health:100,stun:0,anger:8,seated:true,seat:{id:'bench'},home:new T.Vector3(),mesh:new T.Group(),weapon:kind==='guard'?'pistol':null};
  frightenWithWater(person,new T.Vector3(1,0,2),10);assert.equal(person.health,100);assert.equal(person.stun,0);assert.equal(person.anger,0);assert.equal(person.seated,false);assert.equal(person.waterFear.until,15);assert.equal(s.wanted,0);
  person.dead=true;assert.equal(rollPoliceLoot(s,{...person,kind:'guard'},0,()=>0),null);
 }
});
test('guard fires once after aiming, respects cadence and stops behind cover or on stun',()=>{
 const n={},input={hostile:true,distance:8,clear:true};let shots=0;
 for(let i=0;i<44;i++)shots+=Number(guardGun(n,input,.01).shot);assert.equal(shots,0);
 const shot=guardGun(n,input,.011);assert.equal(shot.shot,true);assert.equal(shot.damage,GUARD_PISTOL.damage);
 for(let i=0;i<140;i++)shots+=Number(guardGun(n,input,.01).shot);assert.equal(shots,0);
 assert.equal(guardGun(n,{...input,clear:false},2).shot,false);assert.equal(guardGun(n,{...input,stunned:true},2).shot,false);assert.equal(guardGun(n,{...input,distance:25},2).shot,false);
});
test('a person frightened by water chooses a free escape beside a wall instead of running into it',()=>{
 const n={mesh:new T.Group(),waterFear:{origin:{x:0,z:-4}}};
 const blocked=(x,z)=>Math.abs(x)<2&&z>2;
 const goal=waterEscapeGoal(n,blocked);assert.ok(goal&&Math.abs(goal.x)>2);assert.equal(blocked(goal.x,goal.z),false);assert.equal(waterEscapeGoal(n,blocked),goal);
});
test('all five equipment GLBs contain real geometry, self-contained textures and gun muzzle markers',async()=>{
 for(const id of ['guard-pistol','water-pistol','wooden-stick','baseball-bat','security-vest']){
  const bytes=await readFile(new URL(`../public/models/equipment/${id}.glb`,import.meta.url)),gltf=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));
  assert.equal(bytes.readUInt32LE(8),bytes.length);assert.ok(gltf.meshes.length>0);assert.ok(gltf.accessors.filter(a=>a.type==='VEC3').reduce((n,a)=>n+a.count,0)>150,id);
  for(const image of gltf.images??[])assert.equal(image.uri,undefined,id+' has no external texture request');
  if(id.includes('pistol'))assert.ok(gltf.nodes.some(n=>n.name==='Muzzle'));
 }
});
