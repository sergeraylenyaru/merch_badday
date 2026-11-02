import test from 'node:test';
import assert from 'node:assert/strict';
import {policeCombat,POLICE_ATTACK} from '../src/npc/police-combat.js';
const close={hostile:true,distance:1.4,clear:true};
test('a police punch winds up, hits once at contact and recovers before another swing',()=>{
  const officer={};assert.deepEqual(policeCombat(officer,close,.01),{attack:.35,damage:0});
  assert.equal(policeCombat(officer,close,.1).damage,0);
  assert.equal(policeCombat(officer,close,.1).damage,POLICE_ATTACK.damage);
  assert.equal(policeCombat(officer,close,.1).damage,0);
  assert.equal(policeCombat(officer,close,.2).damage,0);
  assert.equal(policeCombat(officer,close,.2).attack,0);
  assert.equal(officer.combat.sequence,1);
  policeCombat(officer,close,.5);assert.equal(officer.combat.sequence,2);
});
test('dodging, walls, guarding, stun and vehicles are checked at impact',()=>{
  for(const change of [{distance:3},{clear:false},{guarding:true},{stunned:true},{inVehicle:true},{hostile:false}]){
    const officer={};policeCombat(officer,close,.01);
    const impact=policeCombat(officer,{...close,...change},.2);
    assert.equal(impact.damage,change.guarding?POLICE_ATTACK.guardedDamage:0,JSON.stringify(change));
    assert.equal(policeCombat(officer,{...close,...change},.05).damage,0);
  }
});
test('officers have independent animation timers and cannot hit from pursuit distance',()=>{
  const a={},b={};policeCombat(a,close,.01);
  assert.equal(policeCombat(b,{...close,distance:3.1},10).attack,0);
  assert.equal(policeCombat(b,{...close,distance:3.1},10).damage,0);
  assert.equal(policeCombat(a,close,.2).damage,10);
  assert.equal(b.combat.sequence,0);
});
