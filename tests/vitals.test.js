import test from 'node:test';
import assert from 'node:assert/strict';
import {tickHealth} from '../src/city/vitals.js';
import {freshState,save,load} from '../src/state.js';
test('calm restores one HP per five active seconds and never exceeds full health',()=>{
 const s=freshState();s.health=95;s.stress=19.9;tickHealth(s,4.99);assert.equal(s.health,95);tickHealth(s,.01);assert.equal(s.health,96);tickHealth(s,15);assert.equal(s.health,99);tickHealth(s,10);assert.equal(s.health,100);
});
test('stress above eighty costs one HP per ten seconds, including reaching zero',()=>{
 const s=freshState();s.health=2;s.stress=80.1;tickHealth(s,9.99);assert.equal(s.health,2);tickHealth(s,.01);assert.equal(s.health,1);tickHealth(s,10);assert.equal(s.health,0);s.stress=0;tickHealth(s,20);assert.equal(s.health,0);
});
test('boundary stress, pauses and interrupted recovery do not bank free HP',()=>{
 const s=freshState();s.health=50;s.stress=0;tickHealth(s,4);tickHealth(s,0);assert.equal(s.health,50);s.stress=20;tickHealth(s,20);assert.equal(s.health,50);s.stress=80;tickHealth(s,20);assert.equal(s.health,50);s.stress=0;tickHealth(s,1);assert.equal(s.health,50);tickHealth(s,4);assert.equal(s.health,51);
});
test('health clocks survive reload without granting immediate healing',()=>{
 const s=freshState();s.health=40;s.stress=0;tickHealth(s,4);const storage={value:null,setItem(k,v){this.value=v;},getItem(){return this.value;}};save(s,storage);const r=load(storage);tickHealth(r,.9);assert.equal(r.health,40);tickHealth(r,.1);assert.equal(r.health,41);
});
