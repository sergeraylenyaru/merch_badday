import assert from 'node:assert/strict';
import {startBrowser,advance,hold} from './job-browser.mjs';
import {freshState,SHOPS} from '../src/state.js';
import {point,START} from '../src/city/reference-layout.js';
const app=await startBrowser(5223);
try{
 for(const [name,u,v] of [['residential',200,310],['park',850,560],['business',1450,310]]){
  const s=freshState();s.position=point(u,v);const {page,context}=await app.scenario(s,'reference-'+name);
  await advance(page,.2);const city=await page.evaluate(()=>({city:__MERCH__.city,renderer:__MERCH__.renderer,position:__MERCH__.state.position}));console.log(name,city);assert.equal(city.city.source,'user-map');assert.ok(city.city.modelTypes>10);await page.screenshot({path:`.playwright/reference-${name}.png`});
  if(name==='residential'){
   const a=await page.evaluate(()=>__MERCH__.state.position);await hold(page,['KeyD'],1);const b=await page.evaluate(()=>__MERCH__.state.position);await hold(page,['ShiftLeft','KeyD'],1);const c=await page.evaluate(()=>__MERCH__.state.position);const run=Math.hypot(b.x-a.x,b.z-a.z),walk=Math.hypot(c.x-b.x,c.z-b.z);console.log({run,walk});assert.ok(run>walk*1.5);assert.ok(run>4);
   await page.keyboard.press('Tab');await page.locator('#bigmap').waitFor();await page.screenshot({path:'.playwright/reference-map.png'});
  }
  await context.close();
 }
 const state=freshState();state.time=1499.7;state.wanted=3;state.wantedElapsed=19.9;state.position=START;
 const {page,context}=await app.scenario(state,'reference-timeout');await page.locator('#freeRoam').waitFor();assert.equal((await page.evaluate(()=>__MERCH__.state)).wanted,2);await page.click('#freeRoam');await page.waitForFunction(()=>__MERCH__.mode==='play'&&__MERCH__.view.pointerLocked);await advance(page,.6);assert.ok((await page.evaluate(()=>__MERCH__.state)).time>1500);await page.keyboard.press('Escape');assert.ok(await page.locator('#new').isVisible());await context.close();
 if(app.errors.length)throw Error(JSON.stringify(app.errors));
 console.log('Reference city, map, default run, Shift walk, wanted and overtime PASS');
}finally{await app.close();}
