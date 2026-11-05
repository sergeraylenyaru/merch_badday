import assert from 'node:assert/strict';
import {startBrowser,advance,walkTo} from './job-browser.mjs';
import {freshState} from '../src/state.js';
import {pickupWeapon} from '../src/adventure/state.js';
import {MANSION} from '../src/city/coast-layout.js';
import {point,PARK_BRIDGES} from '../src/city/reference-layout.js';
const app=await startBrowser(5297),only=process.env.EQUIPMENT_STAGE,run=k=>!only||only.split(',').includes(k);
const fresh=position=>{const s=freshState();s.onboarding={callReceived:true,carTaken:true};s.position=position;s.stress=40;return s;};let page,context;
async function aimAt(target){
 for(let i=0;i<12;i++){
  const current=typeof target==='string'?await page.evaluate(role=>{const n=__MERCH__.people.find(n=>n.mansionGuard&&n.role===role);return [n.position[0],n.position[1]+1.2,n.position[2]];},target):target;
  const v=await page.evaluate(()=>__MERCH__.view),dx=current[0]-v.cameraPosition[0],dy=current[1]-v.cameraPosition[1],dz=current[2]-v.cameraPosition[2];
  const yaw=Math.atan2(-dx,-dz),pitch=Math.atan2(-dy,Math.hypot(dx,dz))-.12;
  const turn=Math.atan2(Math.sin(yaw-v.cameraYaw),Math.cos(yaw-v.cameraYaw));
  await page.evaluate(({x,y})=>document.dispatchEvent(new MouseEvent('mousemove',{movementX:x,movementY:y})),{x:-turn/.002,y:(pitch-v.cameraPitch)/.002});await advance(page,.15);
 }
}
try{
 if(run('weapons')){
  const s=fresh({x:MANSION.x,z:MANSION.z-MANSION.d-3});for(const id of ['bat','stick','water'])pickupWeapon(s,id);
  ({page,context}=await app.scenario(s,'equipment-mansion'));await page.setViewportSize({width:1400,height:900});await advance(page,.2);
  const city=await page.evaluate(()=>__MERCH__.city),guards=await page.evaluate(()=>__MERCH__.people.filter(n=>n.mansionGuard));assert.equal(guards.length,6);assert.ok(guards.every(n=>n.weapon==='pistol'));assert.equal(city.adventure.equipment.sourceModels,5);assert.equal(city.adventure.guardWeapons.length,6);assert.ok(city.adventure.guardWeapons.every(n=>n.muzzle&&n.droppable===false));assert.ok(city.adventure.vests.every(n=>n.boundTo==='Spine'));
  for(const [key,id]of [['Digit2','bat'],['Digit3','stick'],['Digit4','water']]){await page.keyboard.press(key);await advance(page,.1);assert.equal(await page.evaluate(()=>__MERCH__.city.adventure.weaponRig.id),id);const errors=await page.evaluate(()=>__MERCH__.motion.player.weaponGripErrors);assert.ok(errors.length>0&&errors.every(e=>e<.04),JSON.stringify({id,errors}));}
  const guard=guards.find(n=>n.role==='Охрана ворот')??guards[0],target=[guard.position[0],guard.position[1]+1.2,guard.position[2]];await aimAt(guard.role);await page.keyboard.press('KeyF');await advance(page,.1);
  const water=await page.evaluate(()=>({a:__MERCH__.city.adventure,people:__MERCH__.people,state:__MERCH__.state}));assert.ok(water.a.lastWaterShot.target!==null,JSON.stringify(water.a.lastWaterShot));const scared=water.people[water.a.lastWaterShot.target];assert.ok(scared.mansionGuard&&scared.waterFear>4);assert.equal(scared.attack,0);assert.equal(water.state.wanted,0);assert.equal(water.state.health,100);assert.ok(water.a.lastWaterShot.from.every((v,i)=>Math.abs(v-water.a.weaponRig.muzzle[i])<.1));
  const from=scared.position;await advance(page,.6);const fled=await page.evaluate(i=>__MERCH__.people[i],water.a.lastWaterShot.target);assert.ok(Math.hypot(fled.position[0]-from[0],fled.position[2]-from[2])>.5);assert.equal(await page.evaluate(()=>__MERCH__.state.wanted),0);await page.screenshot({path:'.playwright/equipment-water-guard.png'});
  console.log('PASS five GLBs, six non-droppable guard pistols, fitted spine-bound SWAT vests, real palm contacts and muzzle-origin water makes armed guard flee without wanted/damage');
  await walkTo(page,MANSION.x,MANSION.z-13,.3);const health=await page.evaluate(()=>__MERCH__.state.health);await page.waitForFunction(h=>__MERCH__.state.health<h,health,{timeout:120000});assert.ok(await page.evaluate(()=>__MERCH__.city.adventure.guardWeapons.some(n=>n.shots>0)));assert.equal(await page.evaluate(()=>__MERCH__.state.wanted),0);assert.equal(await page.evaluate(()=>__MERCH__.state.adventure.weaponDrops.some(d=>d.weapon==='pistol')),false);await page.screenshot({path:'.playwright/equipment-mansion-guns.png'});await context.close();console.log('PASS mansion warning followed by ranged pistol shots and health loss; pistols never enter loot');
 }
 if(run('diagonal')){
  ({page,context}=await app.scenario(fresh(point(1028,439)),'equipment-diagonal-path'));
  for(const uv of [[1030,440],[1110,475],[1145,490],[1168,490]]){const p=point(...uv);await walkTo(page,p.x,p.z,.25);assert.equal(await page.evaluate(()=>__MERCH__.city.water.headUnder),false);assert.equal(await page.evaluate(()=>__MERCH__.state.health),100);}
  await page.screenshot({path:'.playwright/equipment-park-business-path.png'});await context.close();console.log('PASS continuous diagonal park-to-business path, raised water crossing and joined bends');
 }
 if(run('bridge')){
  const b=PARK_BRIDGES.find(b=>b.id==='east');({page,context}=await app.scenario(fresh({x:b.x-b.length/2-3.7,z:b.z}),'equipment-east-footbridge'));
  await walkTo(page,b.x,b.z,.2);assert.ok(Math.abs((await page.evaluate(()=>__MERCH__.view.playerY))-.35)<.1);await page.screenshot({path:'.playwright/equipment-east-bridge-deck.png'});await walkTo(page,b.x+b.length/2+3.7,b.z,.2);assert.equal(await page.evaluate(()=>__MERCH__.state.health),100);assert.equal(await page.evaluate(()=>__MERCH__.city.water.headUnder),false);await context.close();console.log('PASS east GLB bridge and approach ramps support crossing from park to business without overlapping central deck');
 }
 assert.deepEqual(app.errors,[]);
}catch(error){console.error('BROWSER ERRORS',app.errors);if(page&&!page.isClosed()){await page.screenshot({path:'.playwright/equipment-failure.png'}).catch(()=>{});console.error('DETAILS',JSON.stringify(await page.evaluate(()=>({state:__MERCH__.state,view:__MERCH__.view,adventure:__MERCH__.city.adventure,guards:__MERCH__.people.filter(n=>n.mansionGuard),motion:__MERCH__.motion.player})).catch(()=>null)));}throw error;}finally{await app.close();}
