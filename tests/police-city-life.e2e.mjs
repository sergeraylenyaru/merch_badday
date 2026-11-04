import assert from 'node:assert/strict';
import {startBrowser,advance} from './job-browser.mjs';
import {freshState} from '../src/state.js';
import {point,START} from '../src/city/reference-layout.js';

const app=await startBrowser(5254);
const fightState=(health=100)=>{
  const s=freshState();s.onboarding.callReceived=true;s.wanted=2;s.health=health;s.position=point(220,384);s.policeResponse={officers:{},roster:[0,1,2],lastLevel:2,nextAt:18,extra:0};return s;
};
try{
  let {page,context}=await app.scenario(fightState(),'police-real-combat');
  await page.waitForFunction(()=>__MERCH__.people.some(n=>n.kind==='police'&&n.attack>0&&n.motion?.animation?.clip==='Punch'));
  await page.screenshot({path:'.playwright/police-punch.png'});
  await page.waitForFunction(()=>__MERCH__.state.health<100);
  await advance(page,2.2);
  const fight=await page.evaluate(()=>({state:__MERCH__.state,people:__MERCH__.people}));
  assert.ok(fight.state.health>0&&fight.state.health<100);
  assert.equal(fight.state.fines,0,'proximity must not trigger an arrest');
  assert.ok(Math.hypot(fight.state.position.x-START.x,fight.state.position.z-START.z)>20);
  assert.ok(fight.people.some(n=>n.kind==='police'&&n.combat?.sequence>=2));
  await page.keyboard.press('KeyG');
  const stunnedHealth=await page.evaluate(()=>__MERCH__.state.health);
  await advance(page,.3);
  assert.equal(await page.evaluate(()=>__MERCH__.state.health),stunnedHealth,'stunned officer must not finish an attack');
  console.log('PASS police Punch clip, repeated health damage, no proximity respawn and interrupted attacks');
  await context.close();

  ({page,context}=await app.scenario(fightState(),'police-guard'));
  await page.keyboard.down('KeyQ');
  const guardedStart=await page.evaluate(()=>({hp:__MERCH__.state.health,time:__MERCH__.state.time}));
  await advance(page,2.3);const guarded=await page.evaluate(()=>__MERCH__.state);
  assert.ok(guarded.health<guardedStart.hp&&guarded.health>=guardedStart.hp-8,'Q should reduce each hit to 2 HP');
  assert.equal(guarded.fines,0);await page.keyboard.up('KeyQ');await context.close();
  console.log('PASS guarding reduces police damage');

  ({page,context}=await app.scenario(fightState(20),'police-defeat'));
  await page.waitForFunction(()=>__MERCH__.mode==='defeat');
  assert.equal(await page.evaluate(()=>__MERCH__.state.health),0);
  assert.equal(await page.evaluate(()=>__MERCH__.state.fines),0);
  await page.locator('#heal:enabled').waitFor();await page.click('#heal');
  await page.waitForFunction(()=>__MERCH__.mode==='play');
  const defeated=await page.evaluate(()=>__MERCH__.state);
  assert.equal(defeated.fines,240);assert.equal(defeated.health,100);assert.equal(defeated.wanted,0);
  const hospital=await page.evaluate(()=>__MERCH__.city.hospital.spawn);
  assert.ok(Math.hypot(defeated.position.x-hospital.x,defeated.position.z-hospital.z)<.1);
  await context.close();console.log('PASS fall and manual hospital treatment only after health depletion');

  const s=freshState();s.onboarding.callReceived=true;s.position=point(370,185);
  ({page,context}=await app.scenario(s,'city-life'));
  const before=await page.evaluate(()=>__MERCH__.people.filter(n=>n.dailyRoute));
  assert.equal(before.length,24);assert.ok(before.filter(n=>n.activePedestrian).every(n=>n.dailyRoute.stops.length>=3));
  assert.ok(before.filter(n=>n.activePedestrian).length<=10);
  await advance(page,3.2);
  const after=await page.evaluate(()=>__MERCH__.people.filter(n=>n.dailyRoute));
  assert.ok(after.filter((n,i)=>Math.hypot(n.position[0]-before[i].position[0],n.position[2]-before[i].position[2])>.5).length>=4);
  for(const [i,n] of after.entries())if(!n.activePedestrian&&!before[i].activePedestrian)assert.deepEqual(n.position,before[i].position,'distant resident must stay asleep');
  await context.close();console.log('PASS local residents move while the distant pool stays asleep');
  assert.deepEqual(app.errors,[]);
}finally{await app.close();}
