import test from 'node:test';
import assert from 'node:assert/strict';
import {freshState,save,load} from '../src/state.js';
import {beginDefeat,advanceDefeat,healAtHospital} from '../src/city/recovery.js';
import {jumpImpulse,verticalStep,DOUBLE_JUMP_HEIGHT} from '../src/city/parkour-physics.js';
import {eatApple} from '../src/city/orchard.js';

test('defeat keeps zero HP and the original location until the fall finishes and treatment is chosen',()=>{
 const s=freshState();s.health=0;const origin={x:12,y:15,z:34,floor:0};beginDefeat(s,origin,2);assert.equal(s.health,0);assert.equal(s.fines,0);assert.equal(healAtHospital(s),false);
 advanceDefeat(s,2.99);assert.equal(s.defeat.phase,'falling');assert.equal(s.defeat.groundY,0);assert.equal(healAtHospital(s),false);advanceDefeat(s,.01);assert.equal(s.defeat.phase,'ready');assert.equal(s.fines,0);
 assert.equal(healAtHospital(s),true);assert.equal(s.health,100);assert.equal(s.fines,240);assert.equal(s.wanted,0);assert.equal(s.defeat,null);assert.equal(healAtHospital(s),false);assert.equal(s.fines,240);
});
test('a saved failure resumes without granting healing or charging the penalty twice',()=>{
 const s=freshState();beginDefeat(s,{x:1,y:0,z:3});advanceDefeat(s,3);const storage={value:null,setItem(k,v){this.value=v;},getItem(){return this.value;}};save(s,storage);const r=load(storage);assert.equal(r.health,0);assert.equal(r.defeat.phase,'ready');assert.equal(r.fines,0);assert.ok(healAtHospital(r));assert.equal(r.fines,150);
});
test('only one extra jump is available above three complete body heights',()=>{
 assert.equal(DOUBLE_JUMP_HEIGHT,6.300000000000001);assert.equal(jumpImpulse({grounded:false,heightAboveGround:6.3,used:false}),null);
 assert.deepEqual(jumpImpulse({grounded:false,heightAboveGround:6.31,used:false}),{velocity:9,double:true});assert.equal(jumpImpulse({grounded:false,heightAboveGround:15,used:true}),null);
 assert.deepEqual(jumpImpulse({grounded:true,heightAboveGround:15,used:true}),{velocity:8,double:false});
});
test('vertical integration lands on the roof rather than teleporting down to street level',()=>{
 let y=15,v=8,airborne=false;for(let i=0;i<100;i++){const next=verticalStep(y,v,15,1/60);y=next.y;v=next.velocity;airborne||=!next.grounded;if(airborne&&next.grounded)break;}
 assert.ok(airborne);assert.equal(y,15);assert.equal(v,0);const falling=verticalStep(15,-2,0,.1);assert.ok(falling.y<15&&falling.y>0);assert.equal(falling.grounded,false);
});
test('one fallen apple restores thirty HP and removes fifty stress once, with caps and persistence',()=>{
 const s=freshState();s.health=45;s.stress=80;assert.ok(eatApple(s,'tree:a'));assert.equal(s.health,75);assert.equal(s.stress,30);assert.equal(eatApple(s,'tree:a'),false);assert.equal(s.health,75);
 s.health=90;s.stress=20;assert.ok(eatApple(s,'tree:b'));assert.equal(s.health,100);assert.equal(s.stress,0);
 const storage={value:null,setItem(k,v){this.value=v;},getItem(){return this.value;}};save(s,storage);const r=load(storage);assert.equal(eatApple(r,'tree:a'),false);assert.deepEqual(r.adventure.orchard.picked,['tree:a','tree:b']);
});
test('a fallen apple cannot bypass the defeat screen and revive a zero-HP character',()=>{
 const s=freshState();s.health=0;assert.equal(eatApple(s,'tree:a'),false);assert.equal(s.health,0);
});
