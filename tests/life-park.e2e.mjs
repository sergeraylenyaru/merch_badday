import assert from 'node:assert/strict';
import {startBrowser,advance,hold,navigate} from './job-browser.mjs';
import {freshState,SHOPS} from '../src/state.js';
import {point,PARK_SQUARE} from '../src/city/reference-layout.js';
const app=await startBrowser(5293),only=process.env.LIFE_STAGE,run=k=>!only||only.split(',').includes(k);
const fresh=()=>{const s=freshState();s.onboarding={callReceived:true,carTaken:true};s.stress=40;return s;};
let page,context;
try{
 if(run('equipment')){
  ({page,context}=await app.scenario(fresh(),'life-equipment'));await advance(page,.15);
  const data=await page.evaluate(()=>({state:__MERCH__.state,city:__MERCH__.city,jobs:__MERCH__.jobs}));
  assert.equal(data.state.mapMode,'satellite');assert.equal(data.state.backpack.boots,false);assert.equal(data.state.shift.upgrades.boots,false);
  assert.ok(data.city.crowd.nearby>=7,JSON.stringify(data.city.crowd));assert.ok(data.city.traffic.nearby>=2,JSON.stringify(data.city.traffic));assert.ok(data.city.traffic.active<=5);
  assert.equal(data.city.park.bridges.length,2);assert.equal(data.city.park.pondIsland,false);assert.ok(data.city.park.square.statueHeight>7);assert.equal(data.jobs.gateSign.mesh,true);assert.equal(data.jobs.gateSign.width,5.7);
  const pickups=data.city.adventure.items.filter(i=>['weapon','pack'].includes(i.kind));assert.ok(pickups.length>10);for(const i of pickups){assert.equal(i.beaconHeight,4.2);assert.equal(i.hasBillboard,false);}
  await page.screenshot({path:'.playwright/life-home.png'});await page.keyboard.press('KeyM');await page.locator('[data-tab="Снаряжение"]').click();
  assert.equal(await page.locator('.equipment-grid button').count(),7);assert.equal(await page.locator('[data-purchase="boots"]').count(),0);assert.match(await page.locator('[data-bag-item="boots"]').textContent(),/Награда за первое/);
  for(const [width,height]of [[900,700],[1440,900],[600,800]]){await page.setViewportSize({width,height});await page.waitForTimeout(250);const boxes=await page.evaluate(()=>['.equipment-sheet','#phoneBody','.compact-equipment','.compact-dima'].map(sel=>{const e=document.querySelector(sel),r=e.getBoundingClientRect();return {sel,scroll:e.scrollHeight,client:e.clientHeight,x:r.x,y:r.y,right:r.right,bottom:r.bottom};}));for(const b of boxes){assert.ok(b.scroll<=b.client+2,JSON.stringify({width,height,boxes}));assert.ok(b.x>=0&&b.right<=width&&b.y>=0&&b.bottom<=height,JSON.stringify({width,height,boxes}));}await page.screenshot({path:`.playwright/life-equipment-${width}.png`});}
  await context.close();console.log('PASS satellite default, nearby street life, fixed small sign, 4.2m pickup beams, two bridges and compact equipment at three viewport sizes');
 }
 if(run('camera')){
  ({page,context}=await app.scenario(fresh(),'life-camera'));const sign=await page.evaluate(()=>__MERCH__.jobs.gateSign);
  await hold(page,['ArrowUp'],.8);let view=await page.evaluate(()=>__MERCH__.view);assert.ok(view.cameraPitch<-.9,JSON.stringify(view));assert.ok(view.cameraForward[1]>.65,JSON.stringify(view));
  await page.keyboard.press('KeyC');await advance(page,.2);view=await page.evaluate(()=>__MERCH__.view);assert.ok(view.firstPerson);assert.ok(view.cameraForward[1]>.9,JSON.stringify(view));
  await hold(page,['ArrowRight'],.3);const after=await page.evaluate(()=>__MERCH__.jobs.gateSign);assert.deepEqual(after.position,sign.position);assert.deepEqual(after.rotation,sign.rotation);
  await page.screenshot({path:'.playwright/life-camera-up.png'});await context.close();console.log('PASS camera looks into sky in both views; visit sign stays fixed to building');
 }
 if(run('reward')){
  const s=fresh();Object.assign(s.shops[0].job,{paid:true,parkedCarId:0,assigned:true,stocked:[0,1,2]});s.position={x:SHOPS[0].x,z:SHOPS[0].z+2};
  ({page,context}=await app.scenario(s,'life-first-job-reward'));for(let i=0;i<8;i++){const p=await page.evaluate(()=>__MERCH__.people.find(n=>n.kind==='staff'&&n.shop===0).position);await navigate(page,p[0],p[2],1.1);await page.keyboard.press('KeyE');if(await page.locator('[data-choice="polite"]').count())break;}
  await page.locator('[data-choice="polite"]').click();await page.locator('#bigmap').waitFor();let state=await page.evaluate(()=>__MERCH__.state);assert.ok(state.shops[0].done&&state.rewards.firstJobBoots&&state.backpack.boots);assert.equal(state.shift.upgrades.boots,false);
  await page.locator('[data-tab="Снаряжение"]').click();await page.locator('[data-use-supply="boots"]').click();assert.equal(await page.evaluate(()=>__MERCH__.state.shift.upgrades.boots),true);await page.reload();await page.locator('#begin').click();await page.waitForFunction(()=>__MERCH__.view.pointerLocked);assert.equal(await page.evaluate(()=>__MERCH__.state.shift.upgrades.boots),true);assert.match(await page.evaluate(()=>__MERCH__.jobs.gateSign.text),/1\/5/);
  await context.close();console.log('PASS actual first report awards boots without buying or auto-equipping, explicit wear survives reload');
 }
 if(run('impact')){
  const s=fresh(),p=point(850,337);s.vehicles=[{x:p.x,z:p.z-2,heading:Math.PI/2,claimed:true},{x:p.x+12,z:p.z-2,heading:Math.PI/2,claimed:false}];s.position={x:p.x,z:p.z};
  ({page,context}=await app.scenario(s,'life-car-impact'));await page.keyboard.press('KeyE');assert.equal(await page.evaluate(()=>__MERCH__.vehicles.find(v=>v.controlled)?.id),0);
  const before=await page.evaluate(()=>__MERCH__.vehicles[1].position);await page.keyboard.down('KeyW');try{await page.waitForFunction(()=>__MERCH__.view.lastVehicleImpact?.other===1,{},{timeout:60000});}finally{await page.keyboard.up('KeyW');}
  const hit=await page.evaluate(()=>__MERCH__.view.lastVehicleImpact);assert.ok(hit.faster&&hit.driverBefore>hit.driverAfter&&hit.driverAfter>0,JSON.stringify(hit));await advance(page,.6);const after=await page.evaluate(()=>({cars:__MERCH__.vehicles,mode:__MERCH__.mode}));assert.ok(after.cars[1].position[0]-before[0]>1.5,JSON.stringify({before,after:after.cars[1],hit}));assert.ok(after.cars[0].controlled);assert.equal(after.mode,'play');await page.screenshot({path:'.playwright/life-car-impact.png'});
  await context.close();console.log('PASS faster player car knocks parked car forward and slows without reversal, respawn or losing control');
 }
 if(run('statue')){
  const s=fresh();s.position={x:PARK_SQUARE.x-17,z:PARK_SQUARE.z};
  ({page,context}=await app.scenario(s,'life-lenin-square'));await hold(page,['ArrowRight'],1.07);await hold(page,['ArrowUp'],.17);await navigate(page,PARK_SQUARE.x-6,PARK_SQUARE.z,.3);await hold(page,['ArrowUp'],.12);await page.screenshot({path:'.playwright/life-lenin-square.png'});assert.equal(await page.evaluate(()=>__MERCH__.city.park.square.license),'MIT');await context.close();console.log('PASS detailed Lenin GLB loads on accessible park plaza without browser errors');
 }
 assert.deepEqual(app.errors,[]);
}catch(e){console.error('BROWSER ERRORS',app.errors);if(page&&!page.isClosed())console.error('DETAILS',await page.evaluate(()=>({state:__MERCH__.state,view:__MERCH__.view,crowd:__MERCH__.city.crowd,traffic:__MERCH__.city.traffic,vehicles:__MERCH__.vehicles})).catch(()=>null));throw e;}finally{await app.close();}
