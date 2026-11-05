import assert from 'node:assert/strict';
import {startBrowser,advance,hold} from './job-browser.mjs';
import {freshState} from '../src/state.js';
import {START} from '../src/city/reference-layout.js';
import {pickupWeapon} from '../src/adventure/state.js';
const app=await startBrowser(5272),only=process.env.COMBAT_STAGE,run=id=>!only||only===id;
const fresh=()=>{const s=freshState();s.onboarding.callReceived=true;return s;};
let page,context,city;
try{
 ({page,context}=await app.scenario(fresh(),'concept-catalog'));await advance(page,.1);city=await page.evaluate(()=>__MERCH__.city);
 const cops=await page.evaluate(()=>__MERCH__.people.filter(n=>n.kind==='police'));assert.equal(cops.length,12);assert.deepEqual(cops.filter(n=>n.weapon==='baton').map(n=>n.policeIndex),[4,9]);
 assert.equal(await page.evaluate(()=>__MERCH__.renderer.art.passes),2);assert.equal(await page.evaluate(()=>__MERCH__.visuals.assets.failed),0);
 if(run('home')){
  const car=await page.evaluate(()=>__MERCH__.vehicles.find(v=>v.claimed&&Math.hypot(v.position[0]-__MERCH__.state.position.x,v.position[2]-__MERCH__.state.position.z)<5));assert.ok(car,'owned car beside the home');
  await page.screenshot({path:'.playwright/concept-home-parking.png'});await page.keyboard.press('KeyE');await page.waitForFunction(()=>__MERCH__.vehicles.some(v=>v.controlled));assert.equal(await page.evaluate(()=>__MERCH__.state.wanted),0);assert.equal(await page.evaluate(()=>__MERCH__.state.onboarding.carTaken),true);
  const before=await page.evaluate(()=>__MERCH__.state.position);await hold(page,['KeyW'],.4);const after=await page.evaluate(()=>__MERCH__.state.position);assert.ok(Math.hypot(after.x-before.x,after.z-before.z)>.1);
  console.log('PASS home parking within five metres, own car through E, no wanted stars, actual driving and illustrated rendering');
 }
 await context.close();
 if(run('bribe')){
  const s=fresh(),g=city.adventure.guards[0];s.position={x:g.x+1.8,z:g.z};s.wanted=5;s.money=1000;({page,context}=await app.scenario(s,'concept-bribe'));
  for(const [price,money,wanted]of [[50,950,4],[100,850,3],[150,700,2]]){await page.keyboard.press('KeyE');assert.match(await page.locator('#extra-bribe').textContent(),new RegExp(String(price)));await page.locator('#extra-bribe').click();await page.waitForFunction(w=>__MERCH__.state.wanted===w,wanted);assert.equal(await page.evaluate(()=>__MERCH__.state.money),money);}
  const saved=await page.evaluate(()=>__MERCH__.state);saved.time=saved.adventure.bribes.lastAt+30;await context.close();({page,context}=await app.scenario(saved,'concept-bribe-reset'));await page.keyboard.press('KeyE');assert.match(await page.locator('#extra-bribe').textContent(),/50 ₽/);await page.locator('#extra-bribe').click();assert.equal(await page.evaluate(()=>__MERCH__.state.money),650);await context.close();console.log('PASS 50/100/150 bribes, one star each and reset to 50 after thirty seconds');
 }
 if(run('bat')){
  const s=fresh(),g=city.adventure.guards[0];s.position={x:g.x,z:g.z+2.2};s.onboarding.carTaken=true;pickupWeapon(s,'bat');({page,context}=await app.scenario(s,'concept-bat',{random:.1}));await advance(page,.2);await page.keyboard.press('KeyG');assert.equal(await page.evaluate(()=>__MERCH__.state.adventure.drops.length),0,'no hit before the swing');
  await page.waitForFunction(()=>__MERCH__.city.adventure.weaponRig.twoHanded&&__MERCH__.motion.player.weaponGripErrors.length===2);const palms=await page.evaluate(()=>__MERCH__.motion.player.weaponGripErrors);assert.ok(palms.every(e=>e<.003));await page.screenshot({path:'.playwright/concept-bat-windup.png'});
  await page.waitForFunction(()=>__MERCH__.state.adventure.drops.length===1);assert.equal(await page.evaluate(()=>__MERCH__.state.conflicts),1);assert.ok(await page.evaluate(()=>__MERCH__.city.adventure.weaponRig.progress>=.5));await page.screenshot({path:'.playwright/concept-bat-contact.png'});await advance(page,.7);assert.equal(await page.evaluate(()=>__MERCH__.state.adventure.drops.length),1);
  await page.keyboard.press('KeyC');await advance(page,.1);assert.ok(await page.evaluate(()=>__MERCH__.motion.player.weaponGripErrors.every(e=>e<.003)));await page.screenshot({path:'.playwright/concept-bat-first.png'});await context.close();console.log('PASS closed two-palm bat grip, dedicated swing, damage at contact and real first-person hands');
 }
 if(run('police')){
  const p=cops.find(n=>n.weapon==='baton').position,s=fresh();s.position={x:p[0],z:p[2]+2.1};s.wanted=1;s.stress=40;s.onboarding.carTaken=true;s.policeResponse={officers:{},roster:[4,0],lastLevel:1,nextAt:18,extra:0};({page,context}=await app.scenario(s,'concept-baton'));
  await page.waitForFunction(()=>__MERCH__.people.some(n=>n.weapon==='baton'&&n.attack>0&&n.motion?.state==='baton-swing'));assert.ok(await page.evaluate(()=>__MERCH__.people.find(n=>n.weapon==='baton').motion.weaponGripErrors.every(e=>e<.003)));await page.waitForFunction(()=>__MERCH__.state.health<100);assert.equal(await page.evaluate(()=>__MERCH__.state.fines),0);await page.screenshot({path:'.playwright/concept-police-baton.png'});await context.close();console.log('PASS every fifth police officer visibly holds a baton, swings and damages HP without an instant respawn');
 }
 assert.deepEqual(app.errors,[]);
}finally{await app.close();}
