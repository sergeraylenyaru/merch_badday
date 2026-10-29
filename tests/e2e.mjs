import assert from 'node:assert/strict';
import {startBrowser,advance,hold,navigate} from './job-browser.mjs';
import {freshState,SHOPS} from '../src/state.js';
import {HOME_CAR,START,point} from '../src/city/reference-layout.js';
import {PARKING_BAY} from '../src/jobs/parking.js';
import {roadHeight} from '../src/city/terrain.js';
const app=await startBrowser(5188);
const s0=SHOPS[0];
try{
 // Test first-launch call through real buttons, without a seeded save.
 const {chromium}=await import('playwright');
 const browser=await chromium.launch({executablePath:process.env.BROWSER_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:1000,height:700}});page.setDefaultTimeout(60000);
  page.on('pageerror',e=>app.errors.push(e.message));
  await page.addInitScript(()=>localStorage.setItem('merch-settings',JSON.stringify({quality:'low',volume:0,sensitivity:1})));
  await page.goto('http://127.0.0.1:5188');await page.locator('#begin').click();await page.locator('#answerCall').waitFor();
  assert.equal(await page.evaluate(()=>__MERCH__.state.onboarding.callReceived),false);
  assert.equal(await page.evaluate(()=>document.pointerLockElement),null);
  await page.locator('#answerCall').click();await page.waitForFunction(()=>__MERCH__.view.pointerLocked);
  assert.deepEqual(await page.evaluate(()=>__MERCH__.state.position),START);
  await advance(page,.2);
  const actors=await page.evaluate(()=>({people:__MERCH__.people,replacements:__MERCH__.visuals.replacements,assets:__MERCH__.visuals.assets}));
  for(const shop of SHOPS){assert.equal(actors.people.filter(n=>n.kind==='staff'&&n.shop===shop.id).length,1);assert.equal(actors.people.filter(n=>n.kind==='employee'&&n.shop===shop.id).length,2);}
  assert.equal(actors.replacements.filter(n=>n.entity==='officer'&&n.kind==='police').length,3);assert.equal(actors.assets.failed,0);
  console.log('CHECK home path to personal car');
  await navigate(page,HOME_CAR.x-1.8,HOME_CAR.z, .5);await page.keyboard.press('KeyE');
  await page.waitForFunction(()=>__MERCH__.vehicles.some(v=>v.controlled));assert.equal(await page.evaluate(()=>__MERCH__.state.wanted),0);
  const before=await page.evaluate(()=>__MERCH__.state.position);await hold(page,['KeyW'],.4);const after=await page.evaluate(()=>__MERCH__.state.position);assert.ok(Math.hypot(after.x-before.x,after.z-before.z)>.05);
  await page.keyboard.press('KeyE');await page.waitForFunction(()=>!__MERCH__.vehicles.some(v=>v.controlled));
  await page.keyboard.press('KeyM');await page.locator('#bigmap').waitFor();await page.reload();await page.locator('#begin').click();await page.waitForFunction(()=>__MERCH__.view.pointerLocked);assert.equal(await page.locator('#answerCall').count(),0);
  console.log('PASS home, call, personal car, driving, 18 employees, 3 police models, save/reload');
 }finally{await browser.close();}
 // A vehicle already aligned in the bay is a starting fixture; payment and
 // the entire in-store assignment run through player controls and collisions.
 const state=freshState();state.onboarding.callReceived=true;state.position={x:s0.x+11,z:s0.z+16.4};
 state.vehicles[0]={x:s0.x+PARKING_BAY.x,z:s0.z+PARKING_BAY.z,heading:0,claimed:true};
 const {page,context}=await app.scenario(state,'first-visit');
 await page.keyboard.press('KeyE');await page.locator('#payParking').waitFor();assert.equal(await page.locator('#payParking').isEnabled(),true);await page.locator('#payParking').click();
 assert.equal(await page.evaluate(()=>__MERCH__.state.money),260);assert.equal(await page.evaluate(()=>__MERCH__.state.shops[0].done),false);
 async function director(){for(let i=0;i<10;i++){const p=await page.evaluate(()=>__MERCH__.people.find(n=>n.kind==='staff'&&n.shop===0).position);await navigate(page,p[0],p[2],1.1);await page.keyboard.press('KeyE');if(await page.locator('[data-choice="job"]').count())return;}throw Error('Director dialogue unreachable');}
 console.log('CHECK first director assignment');
 await director();await page.locator('[data-choice="job"]').click();assert.equal(await page.evaluate(()=>__MERCH__.state.shops[0].job.assigned),true);
 for(const [section,x] of [[0,-8],[1,-5.8],[2,8]]){console.log('CHECK stocking',section);await navigate(page,s0.x+x,s0.z-.3,.3);await page.keyboard.press('KeyE');await page.waitForFunction(i=>__MERCH__.state.shops[0].job.stocked.includes(i),section,{timeout:60000});}
 await director();await page.locator('[data-choice="polite"]').click();assert.equal(await page.evaluate(()=>__MERCH__.state.shops[0].done),true);
 await page.keyboard.press('KeyM');await page.locator('#bigmap').waitFor();await page.reload();await page.locator('#begin').click();await page.waitForFunction(()=>__MERCH__.view.pointerLocked);assert.equal(await page.evaluate(()=>__MERCH__.state.shops[0].done),true);
 await context.close();console.log('PASS parking payment, director assignment, three physical shelf sections, confirmed visit and persistence');
 // Real walking over each bridge checks collision heights and continuity.
 for(const [name,u,v,keys] of [['west-bridge',615,337,['KeyD']],['east-bridge',1100,337,['KeyD']]]){
  const state=freshState();state.onboarding.callReceived=true;state.position=point(u,v);const {page,context}=await app.scenario(state,name);
  await advance(page,.1);const before=await page.evaluate(()=>__MERCH__.state.position);await hold(page,keys,2);const after=await page.evaluate(()=>({p:__MERCH__.state.position,y:__MERCH__.view.groundHeight}));
  assert.ok(Math.hypot(after.p.x-before.x,after.p.z-before.z)>10);assert.ok(Math.abs(after.y-roadHeight(after.p.x,after.p.z))<.01);await page.screenshot({path:`.playwright/${name}.png`});await context.close();
 }
 assert.deepEqual(app.errors,[]);console.log('PASS both main bridges: movement, shared visual/physics elevations, no browser errors');
}finally{await app.close();}
await import('./beta-actions.e2e.mjs');
await import('./urban-details.e2e.mjs');
