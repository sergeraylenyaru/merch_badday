import assert from 'node:assert/strict';
import {startBrowser,advance} from './job-browser.mjs';
import {freshState} from '../src/state.js';
import {point,START} from '../src/city/reference-layout.js';
const app=await startBrowser(5256);
try{
  let page,context;
  if(!process.env.TRAFFIC_ONLY){
  const s=freshState();s.onboarding.callReceived=true;
  ({page,context}=await app.scenario(s,'local-crowd'));
  await advance(page,.2);
  const city=await page.evaluate(()=>__MERCH__.city);
  assert.ok(city.urbanDetails.placedModels<350);
  assert.ok(city.walkways.segments>300&&city.walkways.nodes>100);
  assert.ok(city.crowd.active>=8&&city.crowd.active<=12);
  assert.ok(city.planner.nodesLastFrame<=64);
  console.log('PASS sparse city, continuous pavement, local crowd and bounded planner',JSON.stringify({props:city.urbanDetails.placedModels,paths:city.walkways,crowd:city.crowd,renderer:await page.evaluate(()=>__MERCH__.renderer)}));
  const table=city.destructibles.props.find(p=>p.id==='game-table'&&!p.broken);
  const ball=city.destructibles.props.find(p=>p.id==='ball'&&!p.broken);
  const shopBench=city.destructibles.props.find(p=>p.key==='shop-bench:0');assert.ok(shopBench);
  assert.ok(table&&ball);await context.close();

  for(const prop of [shopBench,table,ball]){
    const state=freshState();state.onboarding.callReceived=true;
    state.position={x:prop.x+Math.sin(.25)*1.8,z:prop.z+Math.cos(.25)*1.8};
    ({page,context}=await app.scenario(state,'destroy-'+prop.id));
    const blockedBefore=await page.evaluate(p=>__MERCH__.navigation.obstacles.some(b=>Math.hypot(b.x-p.x,b.z-p.z)<.2),prop);
    await page.keyboard.press('KeyG');
    await page.waitForFunction(key=>__MERCH__.city.destructibles.props.some(p=>p.key===key&&p.broken),prop.key);
    assert.ok(await page.evaluate(()=>__MERCH__.state.brokenProps.length>0));
    const d=await page.evaluate(()=>__MERCH__.city.destructibles);assert.ok(d.activeBodies>0&&d.activeBodies<=12);
    if(blockedBefore)assert.equal(await page.evaluate(p=>__MERCH__.navigation.obstacles.some(b=>Math.hypot(b.x-p.x,b.z-p.z)<.2),prop),false,'broken prop must release its collision');
    await advance(page,.15);await page.screenshot({path:'.playwright/broken-'+prop.id+'.png'});
    await page.keyboard.press('Escape');await page.reload();await page.locator('#begin').click();
    await page.waitForFunction(()=>__MERCH__.view.pointerLocked);
    assert.ok(await page.evaluate(key=>__MERCH__.city.destructibles.props.some(p=>p.key===key&&p.broken),prop.key));
    await context.close();console.log('PASS destruction, debris and saved state:',prop.id);
  }
  }

  const pedestrian=freshState();pedestrian.onboarding.callReceived=true;pedestrian.position=point(76,343);pedestrian.health=5;
  ({page,context}=await app.scenario(pedestrian,'nonlethal-traffic'));
  await page.waitForFunction(()=>__MERCH__.state.health<5);
  const hit=await page.evaluate(()=>__MERCH__.state);
  assert.equal(hit.health,1);assert.equal(hit.fines,0);
  assert.ok(Math.hypot(hit.position.x-START.x,hit.position.z-START.z)>30);
  assert.ok(hit.time<20);await advance(page,.3);
  assert.equal(await page.evaluate(()=>__MERCH__.state.health),1);
  assert.ok(await page.evaluate(()=>__MERCH__.view.knockdown>0&&Math.abs(__MERCH__.view.playerLean)>.3));
  await page.screenshot({path:'.playwright/traffic-knockdown.png'});
  await context.close();console.log('PASS traffic knockdown at 1 HP without respawn, fine or time penalty');

  const driver=freshState(),parked=point(90,343);driver.onboarding.callReceived=true;driver.health=3;
  driver.vehicles[0]={...parked,heading:Math.PI/2,claimed:true};driver.position={x:parked.x,z:parked.z+2};
  ({page,context}=await app.scenario(driver,'nonlethal-driver'));
  await page.keyboard.press('KeyE');await page.waitForFunction(()=>__MERCH__.vehicles.some(v=>v.controlled));
  await page.waitForFunction(()=>__MERCH__.state.health<3,{},{timeout:90000});
  const crash=await page.evaluate(()=>({state:__MERCH__.state,car:__MERCH__.vehicles.find(v=>v.controlled)}));
  assert.ok(crash.car);assert.equal(crash.state.health,1);assert.equal(crash.state.fines,0);assert.equal(crash.state.wanted,0);
  assert.ok(Math.hypot(crash.car.position[0]-parked.x,crash.car.position[2]-parked.z)<1);
  await context.close();console.log('PASS stationary driver hit by traffic remains in the car without respawn or false crime');
  assert.deepEqual(app.errors,[]);
}finally{await app.close();}
