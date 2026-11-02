import test from 'node:test';
import assert from 'node:assert/strict';
import {freshState,save,load} from '../src/state.js';
import {ensureAdventure,collectPack,pickupWeapon,bribeGuard,bribePrice,startEvent,finishEvent,buyGarage,crashCargo,tableCard} from '../src/adventure/state.js';
const fresh=()=>{const s=freshState();ensureAdventure(s);return s;};
test('all ten distinct cigarette colours persist and award the collection exactly once',()=>{
 const s=fresh(),before=s.money;for(let i=0;i<10;i++){assert.equal(collectPack(s,i),true);assert.equal(collectPack(s,i),false);}assert.equal(collectPack(s,10),false);assert.equal(s.money,before+300);
 const storage={value:null,setItem(k,v){this.value=v;},getItem(){return this.value;}};save(s,storage);const restored=load(storage);assert.equal(restored.adventure.cigarettes.length,10);assert.equal(collectPack(restored,9),false);assert.equal(restored.money,s.money);
});
test('weapons equip on pickup and a guard bribe removes precisely one star',()=>{
 const s=fresh();pickupWeapon(s,'bat');pickupWeapon(s,'water');assert.equal(s.adventure.equipped,'water');assert.deepEqual(s.adventure.inventory,['bat','water']);
 s.wanted=5;s.money=1000;
 for(const [price,wanted]of [[50,4],[100,3],[150,2]]){const before=s.money;assert.equal(bribePrice(s),price);assert.equal(bribeGuard(s),true);assert.equal(s.wanted,wanted);assert.equal(s.money,before-price);}
 s.time+=29.99;assert.equal(bribePrice(s),200);s.time+=.01;assert.equal(bribePrice(s),50);assert.equal(bribeGuard(s),true);assert.equal(s.wanted,1);
 const count=s.adventure.bribes.count;s.money=0;assert.equal(bribeGuard(s),false);assert.equal(s.adventure.bribes.count,count);

});
test('bribe escalation survives saving and resets thirty seconds after the last successful payment',()=>{
 const s=fresh();s.wanted=5;s.money=1000;bribeGuard(s);s.time=20;bribeGuard(s);
 const storage={value:null,setItem(k,v){this.value=v;},getItem(){return this.value;}};save(s,storage);const restored=load(storage);
 assert.equal(bribePrice(restored),150);restored.time=49.99;assert.equal(bribePrice(restored),150);restored.time=50;assert.equal(bribePrice(restored),50);
 restored.wanted=0;assert.equal(bribeGuard(restored),false);assert.equal(bribePrice(restored),50);
});
test('side jobs require their actual objective, have choices and cannot pay twice',()=>{
 const s=fresh();startEvent(s,'spill');assert.equal(finishEvent(s,'spill'),0);s.adventure.events.spill.boxes=[0,1,2];assert.equal(finishEvent(s,'spill'),80);assert.equal(finishEvent(s,'spill'),0);
 startEvent(s,'favor');s.adventure.events.favor.found=true;assert.equal(finishEvent(s,'favor'),120);assert.ok(s.career.contacts.includes('seller'));assert.equal(s.career.loyalty[0],1);
 const other=fresh();startEvent(other,'favor');other.adventure.events.favor.found=true;assert.equal(finishEvent(other,'favor',true),80);assert.equal(other.reputation,45);assert.equal(other.career.contacts.length,0);
});
test('delivery condition and suspension change crash consequences and payout',()=>{
 const s=fresh();startEvent(s,'delivery');s.adventure.events.delivery.carrying=true;crashCargo(s,12,{x:10,z:20});assert.equal(s.adventure.events.delivery.carrying,false);assert.deepEqual(s.adventure.events.delivery.drop,{x:10,z:20});assert.ok(s.adventure.events.delivery.integrity<100);
 s.adventure.events.delivery.carrying=true;const reward=finishEvent(s,'delivery');assert.ok(reward<150&&reward>=90);
 const safe=fresh();safe.career.garage.suspension=true;startEvent(safe,'delivery');safe.adventure.events.delivery.carrying=true;crashCargo(safe,12,{x:10,z:20});assert.equal(safe.adventure.events.delivery.carrying,true);assert.ok(safe.adventure.events.delivery.integrity>s.adventure.events.delivery.integrity);
});
test('vehicle progression costs money and the table game only rewards completed pairs once',()=>{
 const s=fresh();s.money=2000;assert.ok(buyGarage(s,'van'));assert.equal(s.money,1100);assert.equal(buyGarage(s,'van'),false);assert.ok(buyGarage(s,'engine'));assert.equal(s.money,700);
 s.adventure.garage.condition=40;assert.ok(buyGarage(s,'repair'));assert.equal(s.adventure.garage.condition,100);assert.equal(buyGarage(s,'repair'),false);
 const before=s.money;for(const i of [0,3,1,5,2,4])tableCard(s,i);assert.equal(s.adventure.fun.table.won,true);assert.equal(s.money,before+20);tableCard(s,0);assert.equal(s.money,before+20);
});
