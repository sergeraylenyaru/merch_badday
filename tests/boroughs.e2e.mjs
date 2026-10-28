import assert from 'node:assert/strict';import {startBrowser,advance,hold,report} from '../tests/job-browser.mjs';import {freshState,SHOPS} from '../src/state.js';
const app=await startBrowser(5211);
try{
let s=freshState();s.position={x:SHOPS[0].x+3,z:SHOPS[0].z+10};s.carts=[{x:SHOPS[0].x+3,z:SHOPS[0].z+8}];let {page,context}=await app.scenario(s,'small-cart');await page.keyboard.press('KeyR');await page.waitForFunction(()=>__MERCH__.motion.player.gripErrors.length===2&&__MERCH__.motion.player.gripErrors.every(e=>e<.04));await hold(page,['KeyS'],.5);assert.equal(await page.evaluate(()=>__MERCH__.motion.heldCartId),0);await page.screenshot({path:'.playwright/city-small-cart.png'});await context.close();
s=freshState();s.selected=8;s.position={x:SHOPS[8].x-3.8,z:SHOPS[8].z-4.8};({page,context}=await app.scenario(s,'receipt'));await page.keyboard.press('KeyE');await page.waitForFunction(()=>__MERCH__.state.shops[8].job.collected);await report(page,8);assert.equal(await page.evaluate(()=>__MERCH__.state.career.loyalty[8]),1);await context.close();assert.deepEqual(app.errors,[]);console.log('SMALL CART GRIP / NINTH JOB / CAREER PASS');
}finally{await app.close();}
