import test from 'node:test';
import assert from 'node:assert/strict';
import {clearSegment,findWalkingPath,createPedestrianNavigator} from '../src/npc/navigation.js';
import {circleIntersectsBox} from '../src/spatial.js';
import {streetWaypoints,createCrossingMarkings} from '../src/npc/crossings.js';
import {point} from '../src/city/reference-layout.js';
import {createCityLife} from '../src/npc/city-life.js';
import {Scene,Vector3} from 'three';
test('a walker takes a real route around a long facade instead of sliding into its wall',()=>{
  const walls=[{x:0,z:0,w:1,d:6},{x:4,z:-6,w:5,d:1}];
  const blocked=(x,z,r)=>walls.some(w=>circleIntersectsBox(x,z,r,w));
  const from={x:-4,z:0},to={x:4,z:0},path=findWalkingPath(from,to,blocked);
  assert.ok(path.length>2);let previous=from;
  for(const next of path){assert.ok(clearSegment(previous,next,blocked));previous=next;}
  assert.ok(Math.hypot(previous.x-to.x,previous.z-to.z)<.01);
  const person={mesh:{position:{...from}}},nav=createPedestrianNavigator(blocked);
  for(let frame=0;frame<500;frame++){nav.beginFrame();nav.step(person,to,2,.05,frame*.05);assert.equal(blocked(person.mesh.position.x,person.mesh.position.z,.3),false);}
  assert.ok(Math.hypot(person.mesh.position.x-to.x,person.mesh.position.z-to.z)<.3);
});
test('diagonal gaps, newly parked vehicles and unreachable targets do not let NPCs pass through geometry',()=>{
  let barrier=false;
  const blocked=(x,z,r)=>barrier&&circleIntersectsBox(x,z,r,{x:0,z:0,w:1,d:100});
  const person={mesh:{position:{x:-3,z:0}}},nav=createPedestrianNavigator(blocked);
  nav.beginFrame();nav.step(person,{x:3,z:0},2,.1,0);barrier=true;
  for(let n=1;n<60;n++){nav.beginFrame();nav.step(person,{x:3,z:0},2,.1,n*.1);assert.equal(blocked(person.mesh.position.x,person.mesh.position.z,.3),false);}
  assert.ok(person.mesh.position.x<0);
  assert.deepEqual(findWalkingPath({x:0,z:0},{x:10,z:0},()=>true,{maxVisited:20}),[]);
});

test('routes cross main streets through marked gates and reuse one drawing batch',()=>{
  const from=point(760,250),to=point(920,520),path=streetWaypoints(from,to);
  assert.equal(path.length,3);assert.equal(path[0].x,point(850,0).x);assert.equal(path[1].x,path[0].x);
  assert.ok(path[0].z<point(0,337).z&&path[1].z>point(0,337).z);
  assert.deepEqual(path.at(-1),to);
  const scene=new Scene(),markings=createCrossingMarkings(scene,()=>0);
  assert.equal(scene.children.length,1);assert.ok(scene.children[0].count>50);
  markings.dispose();assert.equal(scene.children.length,0);
});

test('residents pause at the reached destination and then resume their own circuit',()=>{
  const home=point(350,180),person={kind:'civilian',phase:0,mesh:{position:new Vector3(home.x,0,home.z)},home:new Vector3(home.x,0,home.z)};
  const world={people:[person],blocked:()=>false,boroughs:{diagnostics:{urbanDetails:{placements:[
    {id:'bench-wood',u:360,v:180},{id:'information-board',u:370,v:180},
  ]}}}};
  const life=createCityLife(world);assert.ok(person.dailyRoute.stops.length>=3);
  const destination=person.dailyRoute.stops[person.dailyRoute.index];
  person.mesh.position.set(destination.x,0,destination.z);
  assert.equal(life(person,.1).target,null);
  const wait=life(person,.1);assert.equal(wait.target,null);assert.deepEqual(wait.lookAt,destination.lookAt);
  for(let i=0;i<70;i++)life(person,.1);
  assert.ok(life(person,.1).target);assert.equal(person.dailyRoute.visits,1);
});
