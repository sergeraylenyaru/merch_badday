import assert from 'node:assert/strict';
import {startBrowser,advance,walkTo} from './job-browser.mjs';
import {freshState,SHOPS} from '../src/state.js';
import {pickupWeapon} from '../src/adventure/state.js';
const only=process.env.PLAYER_STAGE,run=id=>!only||only===id||only==='world'&&id!=='hud';
const app=await startBrowser(5268),fresh=()=>{const s=freshState();s.onboarding.callReceived=true;return s;};
try{
 let s,page,context,city;
 if(run('hud')){s=fresh();s.health=50;s.stress=10;pickupWeapon(s,'bat');
 ({page,context}=await app.scenario(s,'player-city-hud'));
 await advance(page,.2);
 assert.equal(await page.locator('#handItem').textContent(),'Бита');
 const status=await page.locator('.player-status').boundingBox();assert.ok(status.x>600&&status.y<250);
 let weapon=await page.evaluate(()=>__MERCH__.city.adventure);assert.ok(weapon.heldVisible);assert.ok(Math.max(...weapon.heldBounds)>.9);assert.ok(weapon.heldScale.every(n=>Math.abs(n-1)<.01));
 await page.screenshot({path:'.playwright/player-bat-third.png'});await page.keyboard.press('KeyC');await advance(page,.1);
 weapon=await page.evaluate(()=>__MERCH__.city.adventure);assert.ok(weapon.heldVisible);assert.ok(weapon.heldScale.every(n=>Math.abs(n-1)<.01));await page.screenshot({path:'.playwright/player-bat-first.png'});
 await page.waitForFunction(()=>__MERCH__.state.health===51);console.log('PASS visible full-size bat in both cameras, right HUD and timed HP recovery');
 await page.keyboard.press('KeyM');assert.equal(await page.locator('.tablet-sheet').count(),0);
 const tabs=['Маршрут','Город','Охрана','Коллекция','Снаряжение','Гараж','Сообщения','Показатели','Фото'];
 for(const tab of tabs){await page.locator(`[data-tab="${tab}"]`).click();assert.ok(await page.locator('.tablet-sheet').isVisible());assert.ok(await page.locator('#bigmap').isVisible());assert.equal(await page.locator('.tablet-sheet header h2').textContent(),tab);}
 const buttons=await page.locator('[data-tab]').evaluateAll(bs=>bs.map(b=>{const r=b.getBoundingClientRect();return{x:r.x,y:r.y};}));assert.ok(buttons.every(b=>Math.abs(b.x-buttons[0].x)<1));for(let i=1;i<buttons.length;i++)assert.ok(buttons[i].y>buttons[i-1].y);
 await page.locator('[data-tab="Коллекция"]').click();await page.screenshot({path:'.playwright/player-tablet-wide.png'});
 await page.setViewportSize({width:600,height:800});await page.screenshot({path:'.playwright/player-tablet-narrow.png'});
 await page.locator('#hideSheet').click();assert.equal(await page.locator('.tablet-sheet').count(),0);
 city=await page.evaluate(()=>__MERCH__.city);assert.equal(city.adventure.guards.length,15);assert.equal(new Set(city.tracedBuildings.filter(b=>b.housingStyle).map(b=>b.housingStyle)).size,8);
 await page.locator('[data-tab="Охрана"]').click();assert.equal(await page.locator('[data-value^="guard:"]').count(),15);console.log('PASS one-column tablet navigation, overlays, fifteen guards and eight instanced house finishes');await context.close();}

 if(run('stress')){s=fresh();s.health=50;s.stress=85;s.adventure.vitals={rest:0,strain:9.5};({page,context}=await app.scenario(s,'player-city-stress'));await page.waitForFunction(()=>__MERCH__.state.health===49);assert.ok(await page.evaluate(()=>__MERCH__.state.time>=.499));console.log('PASS saved high-stress clock damages HP at the ten-second boundary');await context.close();}

 if(run('money')){const p={x:SHOPS[0].x+1,z:SHOPS[0].z+7};s=fresh();s.position={x:p.x,z:p.z+3};s.adventure.drops=[{id:'test-cash',x:p.x,z:p.z,amount:40,taken:false}];({page,context}=await app.scenario(s,'player-city-cash'));
 assert.equal(await page.evaluate(()=>__MERCH__.state.money),300);await walkTo(page,p.x,p.z+1,.2);await page.waitForFunction(()=>__MERCH__.state.adventure.drops[0].taken);assert.equal(await page.evaluate(()=>__MERCH__.state.money),340);await advance(page,.1);assert.equal(await page.evaluate(()=>__MERCH__.state.money),340);console.log('PASS cash picked up once by walking, without E');await context.close();}

 if(run('flyers')){s=fresh();s.position={x:SHOPS[0].x+1,z:SHOPS[0].z+8};({page,context}=await app.scenario(s,'player-city-flyers'));
 await page.waitForFunction(()=>__MERCH__.city.flyers.thrown>0,undefined,{timeout:90000});await page.waitForFunction(()=>__MERCH__.city.flyers.active>0);const f=await page.evaluate(()=>__MERCH__.city.flyers);assert.equal(f.sellers,9);assert.ok(f.active<=12);assert.ok(Math.hypot(f.people[0].x-(SHOPS[0].x+4.8),f.people[0].z-(SHOPS[0].z-.8))>1);await page.screenshot({path:'.playwright/player-flyer.png'});console.log('PASS seller approaches a person and throws a visible flyer with bounded effects');await context.close();}
 assert.deepEqual(app.errors,[]);
}finally{await app.close();}
