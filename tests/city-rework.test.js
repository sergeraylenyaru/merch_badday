import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import {createDestructibles} from '../src/city/destructibles.js';
import {collisionInjury,pedestrianContact} from '../src/physics/vehicle-impact.js';
import {circleIntersectsBox} from '../src/spatial.js';
import {createPedestrianNavigator} from '../src/npc/navigation.js';
import {createLocalCrowd,CROWD_LIMIT} from '../src/npc/local-crowd.js';
import {point} from '../src/city/reference-layout.js';
import {createWalkways} from '../src/city/walkways.js';

test('benches lose their instances and collision, damage persists and debris bodies are capped',async()=>{
  await RAPIER.init();const scene=new T.Scene(),physics=new RAPIER.World({x:0,y:-10,z:0});
  const state={brokenProps:[]},world={physics,RAPIER,state,groundHeight:()=>0},props=createDestructibles(scene,world);
  const geometry=new T.BoxGeometry(1,1,1),material=new T.MeshBasicMaterial(),mesh=new T.InstancedMesh(geometry,material,20);
  const records=[];
  for(let i=0;i<20;i++){
    mesh.setMatrixAt(i,new T.Matrix4().makeTranslation(i*4,.5,0));
    const body=physics.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(i*4,.5,0));
    const collider=physics.createCollider(RAPIER.ColliderDesc.cuboid(.5,.5,.5),body);
    const proxy={userData:{blocker:{enabled:true},colliderHandle:collider.handle}};
    records.push(props.register({key:'bench-'+i,id:'bench-wood',x:i*4,z:0,footprint:{x:i*4,z:0,w:.5,d:.5},proxy,instances:[{mesh,index:i}]}));
  }
  assert.equal(props.hit({x:0,y:15,z:1},2,1,{x:0,z:-1}),false,'a rooftop swing cannot destroy a bench on the street');
  assert.ok(props.hit({x:0,z:1},2,1,{x:0,z:-1}));assert.equal(records[0].broken,false);
  assert.ok(props.hit({x:0,z:1},2,1,{x:0,z:-1}));assert.equal(records[0].broken,true);
  assert.equal(records[0].proxy.userData.blocker.enabled,false);
  const m=new T.Matrix4();mesh.getMatrixAt(0,m);assert.equal(m.elements[0],0);
  for(let i=1;i<20;i++)props.vehicle({x:i*4,z:0,w:1,d:1},8,{x:1,z:0});
  assert.equal(props.diagnostics.activeBodies,12);assert.equal(physics.bodies.len(),12);
  assert.equal(state.brokenProps.length,20);
  const restored=props.register({key:'bench-0',id:'bench-wood',x:0,z:0,footprint:{x:0,z:0,w:.5,d:.5},instances:[]});assert.equal(restored.broken,true);
  props.update(20);assert.equal(physics.bodies.len(),0);props.dispose();physics.free();geometry.dispose();material.dispose();mesh.dispose();
});

test('repeated car impacts do not kill, fine, teleport or eject the player',()=>{
  const state={health:20,stress:0,position:{x:12,z:15},money:300,fines:0};
  for(let i=0;i<100;i++)collisionInjury(state,25,true);
  assert.equal(state.health,1);assert.equal(state.fines,0);assert.equal(state.money,300);assert.deepEqual(state.position,{x:12,z:15});
  for(const heading of [0,.7,Math.PI/2]){
    const box={x:12,z:15,w:1.2,d:2.4,heading},p=pedestrianContact({x:12.1,z:15.1},box);
    assert.equal(circleIntersectsBox(p.x,p.z,.3,box),false);assert.ok(Math.hypot(p.x-12,p.z-15)<3);
  }
});

test('a normal punch kicks the ball as a moving physics body',async()=>{
  await RAPIER.init();const scene=new T.Scene(),physics=new RAPIER.World({x:0,y:-10,z:0});
  const props=createDestructibles(scene,{physics,RAPIER,state:{brokenProps:[]},groundHeight:()=>0});
  props.register({key:'ball',id:'ball',x:0,z:0,footprint:{x:0,z:0,w:.28,d:.28},instances:[]});
  assert.ok(props.hit({x:-1,z:0},2,1,{x:1,z:0}));assert.equal(props.diagnostics.activeBodies,1);
  for(let i=0;i<20;i++){physics.timestep=1/60;physics.step();props.update(1/60);}
  assert.ok(scene.children[0].position.x>.5);props.dispose();assert.equal(physics.bodies.len(),0);physics.free();
});

test('path searches yield between frames instead of expanding thousands of nodes in one frame',()=>{
  const blocked=(x,z,r)=>circleIntersectsBox(x,z,r,{x:0,z:0,w:1,d:40});
  const nav=createPedestrianNavigator(blocked),person={mesh:{position:{x:-3,z:0},visible:true}};
  for(let frame=0;frame<30;frame++){nav.beginFrame(frame*.02);nav.step(person,{x:3,z:0},1,.02,frame*.02);assert.ok(nav.diagnostics.nodesLastFrame<=64);}
});

test('the crowd pool follows the player, with a bounded local population',()=>{
  const player={...point(200,200)},nodes=Array.from({length:30},(_,i)=>({x:player.x+20*Math.cos(i),z:player.z+20*Math.sin(i)}));
  const people=Array.from({length:24},()=>({kind:'civilian',stun:0,mesh:new T.Group(),home:new T.Vector3()}));
  const world={people,state:{wanted:0},blocked:()=>false,groundHeight:()=>0,walkways:{nodes},boroughs:{diagnostics:{urbanDetails:{placements:[]}}}};
  const life={assign(n){n.dailyRoute={};}},crowd=createLocalCrowd(world,life);
  crowd.update(player,0);assert.equal(crowd.diagnostics.active,CROWD_LIMIT);
  for(const n of people.filter(n=>n.activePedestrian))assert.ok(Math.hypot(n.mesh.position.x-player.x,n.mesh.position.z-player.z)<42);
  crowd.update({x:player.x+250,z:player.z},1);assert.equal(crowd.diagnostics.active,0);assert.ok(people.every(n=>!n.mesh.visible));
});

test('pedestrian surfaces form continuous ground-level strips with connected entrance approaches',()=>{
  const scene=new T.Scene(),entry={u:170,v:180,approach:{...point(170,180)}};
  const paths=createWalkways(scene,{blockers:[],groundHeight:()=>0},[entry]);
  assert.ok(paths.segments.length>300);assert.ok(paths.nodes.length>100);
  assert.ok(paths.segments.some(s=>Math.hypot(s.a.x-entry.approach.x,s.a.z-entry.approach.z)<.01));
  for(const segment of paths.segments)assert.ok(segment.width>=1.6);
  scene.traverse(n=>{if(n.isMesh){const position=n.geometry.attributes.position;for(let i=0;i<position.count;i++)assert.ok(Math.abs(position.getY(i))<.09);}});
  paths.dispose();assert.equal(scene.children.length,0);
});
