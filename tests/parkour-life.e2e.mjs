import assert from 'node:assert/strict';
import {startBrowser,advance,hold,walkTo} from './job-browser.mjs';
import {freshState} from '../src/state.js';
const app=await startBrowser(5277),only=process.env.PARKOUR_STAGE,run=id=>!only||only===id;
const fresh=()=>{const s=freshState();s.onboarding.callReceived=true;s.onboarding.carTaken=true;return s;};
let page,context,city;
try{
 ({page,context}=await app.scenario(fresh(),'parkour-catalog'));await advance(page,.1);city=await page.evaluate(()=>__MERCH__.city);
 assert.equal(city.parkour.ladders.length,30);assert.ok(city.orchard.trees>=10);assert.equal(await page.evaluate(()=>__MERCH__.visuals.assets.failed),0);assert.deepEqual(await page.evaluate(()=>__MERCH__.navigation.streetObstructions),[]);
 await context.close();
 if(run('defeat')){
  const s=fresh();s.health=1;s.stress=90;s.adventure.vitals={rest:0,strain:9};
  ({page,context}=await app.scenario(s,'parkour-defeat'));
  await page.waitForFunction(()=>__MERCH__.mode==='defeat');
  const fallen=await page.evaluate(()=>({state:__MERCH__.state,view:__MERCH__.view}));assert.equal(fallen.state.health,0);assert.equal(fallen.state.fines,0);assert.ok(await page.locator('#heal').isDisabled());
  await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>__MERCH__.mode),'defeat');
  await page.locator('#heal:enabled').waitFor();const ready=await page.evaluate(()=>({state:__MERCH__.state,view:__MERCH__.view,motion:__MERCH__.motion.player}));
  assert.equal(ready.state.defeat.elapsed,3);assert.equal(ready.state.health,0);assert.equal(ready.state.fines,0);assert.ok(ready.view.playerLean>1.4);assert.equal(ready.motion.state,'defeated');
  const distance=(view)=>Math.hypot(view.cameraPosition[0]-s.position.x,view.cameraPosition[1]-view.playerY,view.cameraPosition[2]-s.position.z);assert.ok(distance(ready.view)>distance(fallen.view)+4);
  assert.deepEqual(ready.state.position,s.position);assert.equal(await page.locator('.failure-title').textContent(),'ПРОВАЛЕНО');await page.screenshot({path:'.playwright/parkour-failed.png'});
  await page.reload();await page.locator('#heal:enabled').waitFor();assert.equal(await page.evaluate(()=>__MERCH__.state.health),0);assert.equal(await page.evaluate(()=>__MERCH__.state.fines),0);
  await page.click('#heal');await page.waitForFunction(()=>__MERCH__.mode==='play'&&__MERCH__.view.pointerLocked);
  const healed=await page.evaluate(()=>__MERCH__.state);assert.equal(healed.health,100);assert.equal(healed.fines,150);assert.equal(healed.defeat,null);assert.ok(Math.hypot(healed.position.x-city.hospital.spawn.x,healed.position.z-city.hospital.spawn.z)<.1);
  await page.screenshot({path:'.playwright/parkour-hospital.png'});await hold(page,['KeyS'],.5);assert.ok(Math.hypot((await page.evaluate(()=>__MERCH__.state.position)).z-city.hospital.spawn.z)>.5);await context.close();console.log('PASS noninstant fall, zoom-out, failure screen, no escape/reload bypass and manual hospital treatment');
 }
 if(run('ladder')){
  const l=[...city.parkour.ladders].sort((a,b)=>Math.hypot(a.x+268,a.z+116)-Math.hypot(b.x+268,b.z+116))[0],s=fresh();s.position={x:l.x,z:l.z};
  ({page,context}=await app.scenario(s,'parkour-ladder'));await page.keyboard.down('Space');await page.keyboard.press('KeyE');await page.keyboard.up('Space');
  await page.waitForFunction(()=>!!__MERCH__.city.parkour.climbing);assert.equal(await page.evaluate(()=>__MERCH__.city.parkour.climbing),l.id);const y0=await page.evaluate(()=>__MERCH__.view.playerY);
  await hold(page,['KeyW'],1);const midway=await page.evaluate(()=>({y:__MERCH__.view.playerY,m:__MERCH__.motion.player}));assert.ok(midway.y>y0+1.5);assert.equal(midway.m.state,'climb');assert.ok(midway.m.climbGripErrors.every(e=>e<.003));await page.screenshot({path:'.playwright/parkour-ladder.png'});
  await page.keyboard.down('KeyW');try{await page.waitForFunction(()=>!__MERCH__.city.parkour.climbing,null,{timeout:120000});}finally{await page.keyboard.up('KeyW');}
  const roof=await page.evaluate(()=>({y:__MERCH__.view.playerY,p:__MERCH__.city.parkour}));assert.ok(Math.abs(roof.y-l.top)<.06);assert.ok(roof.p.grounded);const saved=await page.evaluate(()=>__MERCH__.state);await context.close();
  ({page,context}=await app.scenario(saved,'parkour-roof-save'));await advance(page,.1);assert.ok(Math.abs(await page.evaluate(()=>__MERCH__.view.playerY)-l.top)<.06);
  await page.keyboard.press('Space');await advance(page,.16);const first=await page.evaluate(()=>__MERCH__.view.playerY);await page.keyboard.press('Space');await advance(page,.16);const second=await page.evaluate(()=>({y:__MERCH__.view.playerY,p:__MERCH__.city.parkour,m:__MERCH__.motion.player}));assert.ok(second.p.extraUsed);assert.ok(second.y>first+.8);assert.equal(second.m.state,'double-jump');
  await page.keyboard.press('Space');await page.waitForFunction(()=>__MERCH__.city.parkour.grounded);assert.ok(Math.abs(await page.evaluate(()=>__MERCH__.view.playerY)-l.top)<.06);assert.equal(await page.evaluate(()=>__MERCH__.city.parkour.extraUsed),false);
  await page.screenshot({path:'.playwright/parkour-roof.png'});await context.close();console.log('PASS Space+E grab, alternating IK climbing, roof mantle/support/save, altitude-gated double jump and roof landing');
 }
 if(run('apple')){
  const a=city.orchard.apples.find(a=>Math.hypot(a.x+268,a.z+116)>40),s=fresh();s.position={x:a.x-.8,z:a.z+2.2};s.health=40;s.stress=70;
  ({page,context}=await app.scenario(s,'parkour-apple'));await advance(page,.1);await page.screenshot({path:'.playwright/parkour-apple-hanging.png'});await page.keyboard.press('KeyF');await page.waitForFunction(id=>__MERCH__.city.orchard.apples.find(a=>a.id===id).status!=='hanging',a.id);
  await page.waitForFunction(id=>['ground','picked'].includes(__MERCH__.city.orchard.apples.find(a=>a.id===id).status),a.id);await walkTo(page,a.x+.65,a.z+.15,.7);
  await page.waitForFunction(id=>__MERCH__.state.adventure.orchard.picked.includes(id),a.id);const hp=await page.evaluate(()=>__MERCH__.state.health);assert.equal(hp,70);assert.ok(await page.evaluate(()=>__MERCH__.state.stress<22));await advance(page,.2);assert.equal(await page.evaluate(()=>__MERCH__.state.health),hp);await context.close();console.log('PASS visible hanging apple, actual strike/fall, automatic pickup, +30 HP and -50 stress once');
 }
 assert.deepEqual(app.errors,[]);
} catch(error){console.error('BROWSER ERRORS',app.errors);if(page&&!page.isClosed())console.error('DIAGNOSTICS',await page.evaluate(()=>({mode:window.__MERCH__?.mode,state:window.__MERCH__?.state,view:window.__MERCH__?.view,parkour:window.__MERCH__?.city?.parkour})).catch(()=>null));throw error;}finally{await app.close();}
