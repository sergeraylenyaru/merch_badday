import test from 'node:test';
import assert from 'node:assert/strict';
import {freshState,load,save,canComplete,complete,SHOPS} from '../src/state.js';
import {payParking,jobDone} from '../src/jobs/catalog.js';
import {START,HOME_CAR,MAP,ROADS,point,segmentDistance} from '../src/city/reference-layout.js';
import {WATER_LEVEL,BRIDGE_HEIGHT,waterDistance,terrainHeight,roadHeight,ROAD_PROFILES,gridTerrain} from '../src/city/terrain.js';
import {readFileSync} from 'node:fs';
test('a new shift starts at home with a pending call and an accessible personal car',()=>{
 const s=freshState();assert.deepEqual(s.position,START);assert.equal(s.onboarding.callReceived,false);
 assert.ok(Math.hypot(START.x-SHOPS[0].x,START.z-SHOPS[0].z)>30);
 assert.ok(Math.hypot(START.x-HOME_CAR.x,START.z-HOME_CAR.z)<26);
 assert.equal(terrainHeight(START.x,START.z),0);
});
test('parking unlocks a separate in-store job; only three distinct sections allow visit completion',()=>{
 const s=freshState();assert.equal(payParking(s,0),true);assert.equal(jobDone(s,0),false);assert.equal(canComplete(s,0),false);
 s.shops[0].job.assigned=true;s.shops[0].job.stocked=[0,0,1];assert.equal(canComplete(s,0),false);
 s.shops[0].job.stocked=[0,1,2];assert.equal(canComplete(s,0),true);assert.equal(complete(s,0),true);assert.equal(complete(s,0),false);
 assert.equal(s.money,460);
});
test('call, parking receipt and partial shelf progress survive reload; v2 saves keep confirmed visits',()=>{
 const s=freshState();s.onboarding.callReceived=true;payParking(s,3);s.shops[0].job.assigned=true;s.shops[0].job.stocked=[1];
 let value;const storage={setItem(k,v){value=v;},getItem(){return value;}};save(s,storage);const restored=load(storage);
 assert.deepEqual(restored.shops[0].job,s.shops[0].job);assert.equal(restored.onboarding.callReceived,true);
 const old=structuredClone(s);delete old.onboarding;old.missionVersion=2;old.shops[0].done=true;delete old.shops[0].job.stocked;delete old.shops[0].job.assigned;
 value=JSON.stringify(old);const migrated=load(storage);assert.equal(migrated.shops[0].done,true);assert.equal(jobDone(migrated,0),true);assert.equal(migrated.onboarding.callReceived,true);
});
test('water lies below dry land with a continuous bed, and bridge ramps have no height jumps',()=>{
 assert.ok(WATER_LEVEL<0&&BRIDGE_HEIGHT>0&&BRIDGE_HEIGHT<1);
 for(const [u,v] of [[640,200],[1118,280],[865,900],[1015,480]]){const p=point(u,v);assert.ok(terrainHeight(p.x,p.z)<WATER_LEVEL);}
 let bridges=0;
 for(const road of ROAD_PROFILES){if(!road.crossings.length)continue;bridges++;
  for(let d=0;d<road.length;d+=.25){assert.ok(Math.abs(road.heightAt(d+.25)-road.heightAt(d))<.02);}
  for(const d of road.crossings){assert.equal(road.heightAt(d),BRIDGE_HEIGHT);assert.ok(roadHeight(road.start.x+road.dx*d,road.start.z+road.dz*d)>=BRIDGE_HEIGHT-1e-5);}
 }
 assert.ok(bridges>=5);
 const data=gridTerrain();assert.equal(data.indices.length%3,0);assert.ok(data.positions.every(Number.isFinite));
});
test('all road segments belong to one connected street network',()=>{
 const joined=new Set([0]);let changed=true;
 // Sample each centreline; actual asphalt half-width determines junction reach.
 const touch=(a,b)=>{for(let i=0;i<=80;i++){const u=a[0]+(a[2]-a[0])*i/80,v=a[1]+(a[3]-a[1])*i/80;if(segmentDistance(u,v,...b.slice(0,4))<Math.min(a[4],b[4])/2)return true;}return false;};
 while(changed){changed=false;for(let i=0;i<ROADS.length;i++)if(!joined.has(i)&&[...joined].some(j=>touch(ROADS[i],ROADS[j])||touch(ROADS[j],ROADS[i]))){joined.add(i);changed=true;}}
 assert.equal(joined.size,ROADS.length,`disconnected segments: ${ROADS.map((r,i)=>joined.has(i)?null:r).filter(Boolean)}`);
});
test('police officers ship as a skinned CC0 model with locomotion and work clips',()=>{
 const data=readFileSync(new URL('../public/models/characters/police-officer.glb',import.meta.url));const json=JSON.parse(data.subarray(20,20+data.readUInt32LE(12)).toString());
 assert.ok(json.skins.length);assert.ok(json.nodes.some(n=>n.name==='PoliceOfficer'));
 for(const clip of ['Idle','Walk','Run','Talk','Interact'])assert.ok(json.animations.some(a=>a.name===clip));
 assert.equal(json.nodes.find(n=>n.name==='PoliceOfficer').extras.license,'CC0-1.0');
});

test('roundabout north and south approaches overlap the actual rectangular asphalt strips',()=>{
 for(const v of [287.2,287.4,386.6,386.8]){
  const p=point(1390,v);
  assert.ok(ROAD_PROFILES.some(r=>{const x=p.x-r.start.x,z=p.z-r.start.z,along=x*r.dx+z*r.dz;return along>=0&&along<=r.length&&Math.abs(x*r.dz-z*r.dx)<=r.width/2;}),`asphalt gap at ${v}`);
 }
});
