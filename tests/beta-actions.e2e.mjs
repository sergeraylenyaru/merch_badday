import assert from 'node:assert/strict';
import {startBrowser,advance} from './job-browser.mjs';
import {point} from '../src/city/reference-layout.js';
import {freshState,SHOPS} from '../src/state.js';
const app=await startBrowser(5189);
try{
 const shelf=freshState();shelf.position={x:SHOPS[1].x+8,z:SHOPS[1].z-1};
 let {page,context}=await app.scenario(shelf,'beta-planogram');
 await page.keyboard.press('KeyE');await page.locator('#matchGrid').waitFor();assert.equal(await page.locator('[data-cell]').count(),36);assert.equal(await page.evaluate(()=>__MERCH__.state.shops[1].job.match.moves),18);await context.close();
 console.log('PASS planogram entry and 36-cell game');
 const photo=freshState();photo.position={x:SHOPS[2].x-9,z:SHOPS[2].z+11};
 ({page,context}=await app.scenario(photo,'beta-photo'));
 await page.keyboard.press('KeyM');await page.locator('.phone').waitFor();await page.locator('[data-tab="Фото"]').click();await page.locator('#takePhoto').click();await page.locator('#photoResult img').waitFor();assert.equal(await page.evaluate(()=>__MERCH__.state.shops[2].photo),true);await context.close();console.log('PASS photo report');
 const combat=freshState();combat.position={x:SHOPS[0].x,z:SHOPS[0].z-1};
 ({page,context}=await app.scenario(combat,'beta-combat'));
 await page.keyboard.press('KeyF');await advance(page,.1);assert.ok(await page.evaluate(()=>__MERCH__.state.wanted>=1));assert.equal(await page.evaluate(()=>__MERCH__.state.conflicts),1);
 await page.keyboard.press('Escape');await page.locator('#finish').click();await page.waitForFunction(()=>__MERCH__.mode==='end');assert.ok(await page.locator('#restart').count());await context.close();console.log('PASS combat, witnesses, wanted level and ending');
 const cart=freshState();cart.position={x:SHOPS[0].x+3,z:SHOPS[0].z+6.5};
 ({page,context}=await app.scenario(cart,'beta-cart'));
 await page.keyboard.press('KeyR');await page.waitForFunction(()=>__MERCH__.motion.heldCartId===0);await page.keyboard.press('KeyR');await page.waitForFunction(()=>__MERCH__.motion.heldCartId===null);await context.close();console.log('PASS physical trolley grip and release');
 const officer=freshState();officer.position=point(220,395);
 ({page,context}=await app.scenario(officer,'beta-officer'));
 await page.keyboard.press('KeyC');await advance(page,.1);await page.screenshot({path:'.playwright/beta-police.png'});await context.close();
 assert.deepEqual(app.errors,[]);
}finally{await app.close();}
