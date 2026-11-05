import assert from 'node:assert/strict';
import {startBrowser,advance,hold,walkTo} from './job-browser.mjs';
import {freshState} from '../src/state.js';
import {pickupWeapon} from '../src/adventure/state.js';
import {point} from '../src/city/reference-layout.js';
import {coastPixelAt} from '../src/city/coast-layout.js';
const app=await startBrowser(5299),stage=process.env.HANDLING_STAGE,run=k=>!stage||stage.split(',').includes(k);
const fresh=p=>{const s=freshState();s.position=p;s.stress=40;s.onboarding={callReceived:true,carTaken:true};return s;};let page,context;
async function checkGrip(){const d=await page.evaluate(()=>({rig:__MERCH__.city.adventure.weaponRig,errors:__MERCH__.motion.player.weaponGripErrors}));assert.equal(d.rig.id,'shovel');assert.equal(d.rig.twoHanded,true);assert.equal(d.errors.length,2);assert.ok(d.errors.every(e=>e<.04),JSON.stringify(d));return d.rig;}
async function driveTo(target){
 for(let i=0;i<650;i++){
  const car=await page.evaluate(()=>__MERCH__.vehicles.find(v=>v.controlled));assert.ok(car,'hero must remain driving');assert.equal(car.sunk,false);
  const dx=target.x-car.position[0],dz=target.z-car.position[2],distance=Math.hypot(dx,dz);if(distance<2.6)return;
  const error=Math.atan2(Math.sin(Math.atan2(dx,dz)-car.heading),Math.cos(Math.atan2(dx,dz)-car.heading));
  const keys=[];if(car.speed<4.8)keys.push('KeyW');if(car.speed>5.8)keys.push('Space');if(Math.abs(error)>.045)keys.push(error>0?'KeyA':'KeyD');
  await hold(page,keys,.08);
 }
 throw new Error('car blocked '+JSON.stringify(await page.evaluate(()=>__MERCH__.vehicles.find(v=>v.controlled)))+' goal '+JSON.stringify(target));
}
try{
 if(run('shovel')){
  const s=fresh(point(820,620));pickupWeapon(s,'shovel');({page,context}=await app.scenario(s,'handling-shovel'));
  await page.waitForFunction(()=>__MERCH__.motion?.player);await advance(page,.2);
  const rig=await checkGrip(),[x,,z]=rig.quaternion;assert.ok(Math.abs(1-2*(x*x+z*z))<.001,'blade axis must be horizontal');
  const box=await page.locator('.vitals-panel').boundingBox();assert.ok(Math.abs(box.x+box.width/2-450)<2);assert.ok(box.y<30);assert.equal(await page.locator('.vitals-panel #hp').count(),1);assert.equal(await page.locator('.vitals-panel #stress').count(),1);
  await page.screenshot({path:'.playwright/handling-shovel-carry.png'});await hold(page,['ShiftLeft','KeyA'],.35);await checkGrip();
  await page.keyboard.press('KeyF');await page.waitForFunction(()=>__MERCH__.city.adventure.weaponRig.phase==='windup');await checkGrip();await page.screenshot({path:'.playwright/handling-shovel-swing.png'});
  await advance(page,.9);await page.keyboard.press('KeyC');await advance(page,.1);await checkGrip();assert.equal(await page.evaluate(()=>__MERCH__.view.firstPerson),true);
  const visuals=await page.evaluate(()=>__MERCH__.visuals);console.log('ASSETS',JSON.stringify(visuals.assets));assert.equal(visuals.assets.failed,0);await context.close();console.log('PASS wooden-shaft two-hand grip, horizontal carry/run, animated strike and centred health/stress');
 }
 if(run('road')){
  const h=Math.atan2(-50,-30),car=point(1230,777),s=fresh({x:car.x+Math.cos(h)*2.2,z:car.z-Math.sin(h)*2.2});s.vehicles[0]={...car,heading:h,claimed:false};({page,context}=await app.scenario(s,'handling-dry-junction'));
  await page.evaluate(()=>{window.testRandom=Math.random;Math.random=()=>.99;});const before=await page.evaluate(()=>__MERCH__.city.streetActors.exits);await page.keyboard.press('KeyE');await page.waitForFunction(()=>__MERCH__.vehicles.some(v=>v.controlled));assert.equal(await page.evaluate(()=>__MERCH__.vehicles.find(v=>v.controlled).id),0);assert.equal(await page.evaluate(()=>__MERCH__.city.streetActors.exits),before);assert.equal(await page.evaluate(()=>__MERCH__.people.some(n=>n.activeDriver&&n.driverCarId===0)),false);await page.evaluate(()=>{Math.random=window.testRandom;});
  for(const [u,v]of [[1185,752],[1120,773],[1065,773]])await driveTo(point(u,v));
  const end=await page.evaluate(()=>({car:__MERCH__.vehicles.find(v=>v.controlled),health:__MERCH__.state.health,view:__MERCH__.view}));assert.ok(end.health>0);assert.ok(end.car.position[0]<point(1085,770).x);assert.equal(end.car.waterTime,0);await page.screenshot({path:'.playwright/handling-road-after-turn.png'});console.log('ROAD',JSON.stringify(end));await context.close();console.log('PASS parked car stays empty and drives through southern bend and shifted river crossing without sinking');
 }
 if(run('uniform')){
  const s=fresh(point(850,317));s.wanted=1;({page,context}=await app.scenario(s,'handling-patrol-uniform'));await page.keyboard.press('KeyC');console.log('PATROL_START',JSON.stringify(await page.evaluate(()=>__MERCH__.people.filter(n=>n.kind==='police'&&n.activePolice).map(n=>({blue:n.patrolPolice,p:n.position})))));
  await page.waitForFunction(()=>{const p=__MERCH__.state.position;return __MERCH__.people.some(n=>n.patrolPolice&&n.activePolice&&Math.hypot(n.position[0]-p.x,n.position[2]-p.z)<5);},{},{timeout:150000});
  const patrol=await page.evaluate(()=>{const p=__MERCH__.state.position,n=__MERCH__.people.filter(n=>n.patrolPolice&&n.activePolice).sort((a,b)=>Math.hypot(a.position[0]-p.x,a.position[2]-p.z)-Math.hypot(b.position[0]-p.x,b.position[2]-p.z))[0];return {n,yaw:Math.atan2(p.x-n.position[0],p.z-n.position[2]),view:__MERCH__.view};});
  await page.evaluate(({yaw,view})=>document.dispatchEvent(new MouseEvent('mousemove',{movementX:Math.atan2(Math.sin(view.cameraYaw-yaw),Math.cos(view.cameraYaw-yaw))/.002,movementY:(-.03-view.cameraPitch)/.002})),patrol);await advance(page,.08);await page.screenshot({path:'.playwright/handling-blue-patrol.png'});assert.ok(patrol.n.motion);assert.equal(await page.evaluate(()=>__MERCH__.visuals.assets.failed),0);await context.close();console.log('PASS new blue patrol model animates and approaches in its skinned police uniform');
 }
 if(run('quay')){
  const s=fresh(point(625,coastPixelAt(625)-12));({page,context}=await app.scenario(s,'handling-quay-extension'));await advance(page,.1);assert.ok((await page.evaluate(()=>__MERCH__.view.playerY))>=.075);
  for(const u of [635,645,655]){const q=point(u,coastPixelAt(u)-12);await walkTo(page,q.x,q.z,.35);assert.ok((await page.evaluate(()=>__MERCH__.view.playerY))>=.075);}
  await page.screenshot({path:'.playwright/handling-quay-extension.png'});await page.keyboard.press('KeyM');await page.locator('button[data-map-mode="satellite"]').click();await page.screenshot({path:'.playwright/handling-waterfront-satellite.png'});await page.locator('button[data-map-mode="schematic"]').click();await page.screenshot({path:'.playwright/handling-waterfront-schematic.png'});await context.close();console.log('PASS real walking on western quay extension; satellite and schematic reflect moved river and full quay');
 }
 assert.deepEqual(app.errors,[]);
}catch(error){console.error('BROWSER ERRORS',app.errors);if(page&&!page.isClosed()){await page.screenshot({path:'.playwright/handling-failure.png'}).catch(()=>{});console.error('DETAILS',JSON.stringify(await page.evaluate(()=>({state:__MERCH__.state,view:__MERCH__.view,visuals:__MERCH__.visuals,rig:__MERCH__.city.adventure.weaponRig,vehicles:__MERCH__.vehicles})).catch(()=>null)));}throw error;}finally{await app.close();}
