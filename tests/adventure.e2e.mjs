import assert from 'node:assert/strict';
import {startBrowser,advance,walkTo} from './job-browser.mjs';
import {freshState,SHOPS} from '../src/state.js';
import {ensureAdventure,pickupWeapon,startEvent} from '../src/adventure/state.js';
const app=await startBrowser(5262),only=process.env.ADVENTURE_STAGE;
const run=id=>!only||only===id;
const fresh=()=>{const s=freshState();s.onboarding.callReceived=true;ensureAdventure(s);return s;};
const at=(state,p)=>{state.position={x:p.x,z:p.z+1.2};return state;};
let page,context;
async function scenario(s,name){({page,context}=await app.scenario(s,'adventure-'+name));}
async function close(){await context.close();}
try{
 await scenario(fresh(),'catalog');await advance(page,.15);
 const city=await page.evaluate(()=>__MERCH__.city),items=city.adventure.items;
 assert.equal(await page.evaluate(()=>__MERCH__.visuals.assets.failed),0);assert.equal(items.filter(i=>i.kind==='pack').length,10);
 const people=await page.evaluate(()=>__MERCH__.people.filter(n=>n.activePedestrian));for(const type of ['stocky','short','tall','elder','bandit'])assert.ok(people.some(n=>n.personType===type),type);
 assert.ok(await page.evaluate(()=>__MERCH__.view.goalZone.visible));await close();
 console.log('PASS five new animated people and ground goal zone');

 if(run('weapons'))for(const id of ['bat','stick','water']){
  const item=items.find(i=>i.kind==='weapon'&&i.id===id);await scenario(at(fresh(),item),'weapon-'+id);
  await page.screenshot({path:'.playwright/pickup-'+id+'.png'});await page.keyboard.press('KeyE');
  await page.waitForFunction(id=>__MERCH__.state.adventure.equipped===id,id);
  await advance(page,.1);assert.ok(await page.evaluate(()=>__MERCH__.city.adventure.heldVisible));
  assert.ok(await page.evaluate(()=>__MERCH__.city.adventure.heldY>.5));
  if(id==='water'){await page.keyboard.press('KeyF');await page.waitForFunction(()=>__MERCH__.city.adventure.activeEffects>0);}
  await page.keyboard.press('Digit0');assert.equal(await page.evaluate(()=>__MERCH__.state.adventure.equipped),null);await close();
  console.log('PASS visible pickup and held weapon:',id);
 }

 if(run('collection')){
  let progress=fresh();
  for(let id=0;id<10;id++){
   await scenario(at(progress,items.find(i=>i.kind==='pack'&&i.id===id)),'pack-'+id);await page.keyboard.press('KeyE');
   await page.waitForFunction(id=>__MERCH__.state.adventure.cigarettes.includes(id),id);
   progress=await page.evaluate(()=>__MERCH__.state);
   if(id===9){assert.equal(progress.money,600);await page.keyboard.press('KeyM');await page.locator('[data-tab="Коллекция"]').click();assert.equal(await page.locator('#collectionCount').textContent(),'10/10');assert.equal(await page.locator('.collection-card.collected').count(),10);await page.screenshot({path:'.playwright/collection-complete.png'});}
   await close();
  }
  console.log('PASS ten physical cigarette pickups, saved progress, all colours in M and one completion reward');
 }

 if(run('guard')){
  const s=fresh(),guard=city.adventure.guards[0];s.money=500;s.wanted=3;s.position={x:guard.x+1.8,z:guard.z};
  await scenario(s,'guard');await page.keyboard.press('KeyE');await page.locator('#extra-bribe').click();
  await page.waitForFunction(()=>__MERCH__.state.wanted===2);assert.equal(await page.evaluate(()=>__MERCH__.state.money),350);
  await page.keyboard.press('KeyE');assert.equal(await page.locator('#extra-bribe').isDisabled(),true);await close();console.log('PASS guard dialogue, 150 ₽ for exactly one star and bribe cooldown');
 }

 if(run('money')){
  const s=fresh(),guard=city.adventure.guards[0];pickupWeapon(s,'bat');s.position={x:guard.x+1.8,z:guard.z};
  await scenario(s,'cash');await page.keyboard.press('KeyG');await page.waitForFunction(()=>__MERCH__.state.adventure.drops.length>0);
  const drop=await page.evaluate(()=>__MERCH__.state.adventure.drops[0]);await page.screenshot({path:'.playwright/dropped-money.png'});
  await walkTo(page,drop.x,drop.z+1,.2);await page.waitForFunction(()=>__MERCH__.state.adventure.drops[0].taken);
  assert.equal(await page.evaluate(()=>__MERCH__.state.money),300+drop.amount);await close();console.log('PASS knocked-down NPC drops visible money collected automatically by walking nearby');
 }

 if(run('jobs')){
  let progress=fresh();await scenario(progress,'offer');await page.keyboard.press('KeyM');await page.locator('[data-tab="Город"]').click();await page.locator('[data-extra="start"][data-value="spill"]').click();progress=await page.evaluate(()=>__MERCH__.state);assert.equal(progress.adventure.events.spill.status,'active');await close();
  for(let i=0;i<3;i++){await scenario(at(progress,items.find(p=>p.kind==='spill'&&p.id===i)),'box-'+i);await page.keyboard.press('KeyE');await page.waitForFunction(i=>__MERCH__.state.adventure.events.spill.boxes.includes(i),i);progress=await page.evaluate(()=>__MERCH__.state);await close();}
  assert.equal(progress.adventure.events.spill.status,'done');assert.equal(progress.money,380);
  progress=fresh();startEvent(progress,'delivery');await scenario(at(progress,items.find(p=>p.kind==='parcel')),'delivery-pickup');await page.keyboard.press('KeyE');await page.waitForFunction(()=>__MERCH__.state.adventure.events.delivery.carrying);progress=await page.evaluate(()=>__MERCH__.state);await close();
  await scenario(at(progress,items.find(p=>p.kind==='recipient')),'delivery-drop');await page.keyboard.press('KeyE');await page.waitForFunction(()=>__MERCH__.state.adventure.events.delivery.status==='done');assert.equal(await page.evaluate(()=>__MERCH__.state.money),450);await close();
  progress=fresh();startEvent(progress,'favor');await scenario(at(progress,items.find(p=>p.kind==='wallet')),'wallet');await page.keyboard.press('KeyE');await page.waitForFunction(()=>__MERCH__.state.adventure.events.favor.found);progress=await page.evaluate(()=>__MERCH__.state);await close();
  const vendor=items.find(p=>p.kind==='event'&&p.id==='favor');progress.position={x:vendor.x+1.5,z:vendor.z+1.2};await scenario(progress,'return-wallet');await page.keyboard.press('KeyE');await page.waitForFunction(()=>__MERCH__.state.adventure.events.favor.status==='done');progress=await page.evaluate(()=>__MERCH__.state);assert.ok(progress.career.contacts.includes('seller'));await close();
  progress.position={x:SHOPS[0].x+17,z:SHOPS[0].z+4};const money=progress.money;await scenario(progress,'coffee-discount');await page.keyboard.press('KeyE');await page.waitForFunction(m=>__MERCH__.state.money===m-20,money);await close();
  console.log('PASS physical spill, intact delivery, returned wallet and remembered coffee discount');
 }

 if(run('fun')){
  const table=city.destructibles.props.find(p=>p.id==='game-table'&&!p.broken);await scenario(at(fresh(),table),'memory');await page.keyboard.press('KeyE');await page.locator('[data-memory="0"]').waitFor();
  for(const i of [0,3,1,5,2,4])await page.locator(`[data-memory="${i}"]`).click();assert.ok(await page.evaluate(()=>__MERCH__.state.adventure.fun.table.won));assert.equal(await page.evaluate(()=>__MERCH__.state.money),320);await close();
  const court=city.adventure.court;const s=at(fresh(),court);await scenario(s,'football');for(let i=1;i<=3;i++){await page.keyboard.press('KeyE');await page.waitForFunction(i=>__MERCH__.state.adventure.fun.goals>=i,i,{timeout:60000});}assert.equal(await page.evaluate(()=>__MERCH__.state.money),330);await page.screenshot({path:'.playwright/courtyard-football.png'});await close();
  console.log('PASS table pairs and three actual physics goals with one reward');
 }

 if(run('garage')){
  const s=fresh();s.money=2000;s.adventure.garage.condition=40;await scenario(s,'garage');await page.keyboard.press('KeyM');await page.locator('[data-tab="Гараж"]').click();
  for(const id of ['engine','suspension','van','repair'])await page.locator(`[data-extra="garage"][data-value="${id}"]`).click();
  const state=await page.evaluate(()=>__MERCH__.state);assert.equal(state.money,330);assert.equal(state.adventure.garage.condition,100);assert.ok(state.career.garage.van);assert.ok(state.career.garage.engine);assert.ok(state.career.garage.suspension);assert.ok(await page.evaluate(()=>__MERCH__.vehicles.some(v=>v.name==='Ваш фургон'&&v.claimed)));
  await page.reload();await page.locator('#begin').click();await page.waitForFunction(()=>__MERCH__.view.pointerLocked);
  assert.ok(await page.evaluate(()=>__MERCH__.vehicles.some(v=>v.name==='Ваш фургон'&&v.claimed)));
  assert.equal(await page.evaluate(()=>__MERCH__.state.career.garage.engine),true);
  await close();console.log('PASS engine, suspension, repairs and a real owned van at home, including reload');
 }
 assert.deepEqual(app.errors,[]);
}finally{await app.close();}
