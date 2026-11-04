import test from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';import RAPIER from '@dimforge/rapier3d-compat';
import {underwater,tickDrowning,stepSinking} from '../src/city/water.js';
import {buildRoadGraph,trafficPoint,createTraffic} from '../src/city/traffic.js';
import {createTraversal} from '../src/city/traversal.js';
import {createDestructibles} from '../src/city/destructibles.js';
import {point} from '../src/city/reference-layout.js';

test('only a submerged head loses HP, with fractional time and a reset after surfacing',()=>{
 assert.equal(underwater(-2.2),false);assert.equal(underwater(-2.4),true);const s={health:20,stress:10},clock={seconds:0};
 assert.equal(tickDrowning(s,clock,.6,true),0);assert.equal(tickDrowning(s,clock,.4,true),8);assert.equal(s.health,12);
 tickDrowning(s,clock,.9,true);tickDrowning(s,clock,10,false);assert.equal(clock.seconds,0);assert.equal(s.health,12);
 tickDrowning(s,clock,2,true);assert.equal(s.health,0);assert.equal(tickDrowning(s,clock,2,true),0);
});
test('a flooding car ejects only at three seconds, rests on the bed and cannot move again',()=>{
 const v={mesh:new T.Group(),speed:8,waterStartY:.025};assert.equal(stepSinking(v,2.99,-4),false);assert.ok(v.mesh.position.y< -3.9);assert.equal(v.sunk,undefined);
 assert.equal(stepSinking(v,.01,-4),true);assert.equal(v.mesh.position.y,-4);assert.equal(v.speed,0);assert.equal(v.sunk,true);assert.equal(stepSinking(v,5,-4),false);
});
test('traffic uses split crossings and opposite lanes instead of crossing buildings',()=>{
 const graph=buildRoadGraph();assert.ok(graph.nodes.some(n=>n.edges.length>=4));const edge=graph.edges.find(e=>e.length>25),a=trafficPoint(graph,{edge:edge.id,distance:edge.length/2,reverse:false}),b=trafficPoint(graph,{edge:edge.id,distance:edge.length/2,reverse:true});
 assert.ok(Math.hypot(a.x-b.x,a.z-b.z)>2.3);assert.ok(Math.abs(Math.cos(a.heading-b.heading)+1)<1e-6);
});
test('traffic is present nearby from the start and replacements stay concealed instead of spawning in the view',()=>{const cars=Array.from({length:6},(_,id)=>({id,traffic:true,mesh:new T.Group(),backing:2,impactBrake:4,visualModel:['sedan','taxi','bus','truck','suv','van'][id],speed:0,w:1.2,l:2.4,h:2.4})),world={vehicles:cars,blockers:[],vehicleBlocked:()=>false,groundHeight:()=>0,props:{vehicle(){}}},traffic=createTraffic(world),p=point(165,180);assert.equal(traffic.diagnostics.active,0);traffic.prime(p,0);assert.equal(traffic.diagnostics.active,3);assert.equal(traffic.diagnostics.nearby,3);const first=traffic.diagnostics.cars[0];for(let n=1;n<=30;n++)traffic.update(.1,p,n*.1);const moved=traffic.diagnostics.cars.find(c=>c.id===first.id);assert.ok(Math.hypot(moved.position[0]-first.position[0],moved.position[2]-first.position[2])>10);assert.ok(traffic.diagnostics.active<=5);const far=point(1500,450);traffic.update(.1,far,4);assert.ok(traffic.diagnostics.active<=1);for(let n=41;n<=90;n++)traffic.update(.1,far,n*.1);assert.ok(traffic.diagnostics.nearby>=2);assert.ok(traffic.diagnostics.active<=5);assert.equal(traffic.diagnostics.lastSpawn.reason,'outside-view');assert.ok(traffic.diagnostics.lastSpawn.distance<76);});
test('strong hits and car contact roll the same ball without breaking or expiring it',async()=>{
 await RAPIER.init();const physics=new RAPIER.World({x:0,y:0,z:0}),scene=new T.Scene(),state={brokenProps:['ball']},props=createDestructibles(scene,{physics,RAPIER,state,groundHeight:()=>0});
 const ball=props.register({id:'ball',key:'ball',x:0,z:0,footprint:{x:0,z:0,w:.28,d:.28},instances:[]});assert.deepEqual(state.brokenProps,[]);
 for(let n=0;n<3;n++)assert.ok(props.hit({x:-1,y:0,z:0},2,5,{x:1,z:0}));assert.equal(ball.broken,false);assert.equal(props.diagnostics.activeBodies,1);
 props.vehicle({x:0,z:0,w:1,d:1},12,{x:0,z:1});for(let n=0;n<30;n++){physics.timestep=1/60;physics.step();props.update(1/60);}assert.ok(props.diagnostics.props[0].z>1);props.update(20);assert.equal(props.diagnostics.activeBodies,1);assert.equal(ball.broken,false);assert.deepEqual(state.brokenProps,[]);props.dispose();physics.free();
});
function traversalFixture(){const scene=new T.Scene(),mesh=new T.Group();scene.add(mesh);mesh.position.set(0,.6,1);
 const wire={id:'w',a:{x:0,y:19.536,z:0,roofY:15.736,roofId:'a'},b:{x:30,y:19.536,z:0,roofY:15.736,roofId:'b'},length:30},fence={id:'f',x:50,z:0,w:3,d:.1,y0:0,height:2.1,props:[{x:50,z:1.4,y:.85}]};
 const world={player:{mesh},cables:{wires:[wire]},yards:{fences:[fence]},groundHeight:()=>0,blockedAt:()=>false};return {scene,world,mesh};}
test('pole grab becomes a suspended ride, resumes from a save and drops before the far pole',()=>{
 const f=traversalFixture(),t=createTraversal(f.scene,f.world,{});assert.equal(t.grab(),false,'ground level cannot grab a rooftop cable');f.mesh.position.y=16;assert.ok(t.grab());t.advance(1.15);assert.equal(t.motion.kind,'zipline');assert.ok(f.mesh.position.y>17);t.advance(1);assert.ok(f.mesh.position.x>6);
 const saved={parkour:{traversal:t.saved}};t.dispose();const restored=createTraversal(f.scene,f.world,saved);for(let i=0;i<100&&restored.active;i++)restored.advance(.1);assert.equal(restored.active,false);assert.ok(f.mesh.position.x>29&&f.mesh.position.x<30);restored.dispose();
});
test('vault requires a nearby box/bin, clears the fence and lands continuously on the far side',()=>{
 const f=traversalFixture();f.mesh.position.set(50,.85,1.4);const t=createTraversal(f.scene,f.world,{});assert.ok(t.grab());assert.equal(t.motion.kind,'vault');t.advance(.475);assert.ok(f.mesh.position.y>2.1);const result=t.advance(.475);assert.equal(result.grounded,true);assert.equal(f.mesh.position.y,0);assert.ok(f.mesh.position.z< -1.5);assert.equal(t.active,false);
 f.mesh.position.set(50,.5,1.4);f.world.yards.fences[0].props=[];assert.equal(t.grab(),false);t.dispose();
});
