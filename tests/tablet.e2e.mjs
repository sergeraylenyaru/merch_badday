import assert from 'node:assert/strict';
import{startBrowser,advance}from'./job-browser.mjs';import{freshState,SHOPS}from'../src/state.js';import{mapViewport,MINIMAP_SPAN}from'../src/city/map-view.js';import{MAP_BUILDINGS}from'../src/city/map-buildings.js';
const app=await startBrowser(5230);
try{
const {page,context}=await app.scenario(freshState(),'tablet-layout');await page.keyboard.press('KeyM');await page.locator('.tablet').waitFor();await page.locator('#bigmap').waitFor();
for(const [width,height]of[[1440,900],[1000,700],[600,800]]){
 await page.setViewportSize({width,height});await page.waitForFunction(()=>{const c=document.querySelector('#bigmap'),r=c.getBoundingClientRect();return Math.abs(c.width-r.width*Math.min(devicePixelRatio||1,1.5))<1&&Math.abs(c.height-r.height*Math.min(devicePixelRatio||1,1.5))<1;});
 const boxes=await page.evaluate(()=>Object.fromEntries(['.tablet-layout','.tablet-map','.tablet-sidebar','#bigmap'].map(k=>{let b=document.querySelector(k).getBoundingClientRect();return[k,{x:b.x,y:b.y,w:b.width,h:b.height}];})));
 assert.ok(Math.abs(boxes['.tablet-sidebar'].w/boxes['.tablet-layout'].w-.2)<.005);assert.ok(boxes['#bigmap'].w>width*.65);assert.ok(boxes['#bigmap'].h>height*.5);assert.ok(boxes['.tablet-sidebar'].x>=boxes['.tablet-map'].x+boxes['.tablet-map'].w-.5);assert.equal(await page.evaluate(()=>document.pointerLockElement),null);
 await page.screenshot({path:`.playwright/tablet-${width}.png`});
}
await page.setViewportSize({width:1440,height:900});await page.waitForFunction(()=>{const c=document.querySelector('#bigmap'),r=c.getBoundingClientRect();return Math.abs(c.width-r.width*Math.min(devicePixelRatio||1,1.5))<1&&Math.abs(c.height-r.height*Math.min(devicePixelRatio||1,1.5))<1;});
const canvas=await page.locator('#bigmap').boundingBox(),target=SHOPS[6],view=mapViewport(canvas.width,canvas.height,SHOPS[0]);const xy=view.project(target.x,target.z);await page.mouse.click(canvas.x+xy.x,canvas.y+xy.y);await page.waitForFunction(()=>__MERCH__.state.selected===6);assert.equal(await page.locator('#bigmap').count(),1);
for(const tab of ['Сообщения','Карта','Показатели','Фото','Маршрут']){await page.click(`[data-tab="${tab}"]`);assert.equal(await page.locator('#bigmap').count(),1);assert.ok(await page.locator('#bigmap').isVisible());}
const city=await page.evaluate(()=>({city:__MERCH__.city,roads:__MERCH__.navigation.streetObstructions,renderer:__MERCH__.renderer}));console.log(JSON.stringify({modelTypes:city.city.modelTypes,placements:city.city.placements,tracedBuildings:city.city.tracedBuildings.length,roads:city.roads,renderer:city.renderer}));assert.deepEqual(city.roads,[]);assert.ok(city.city.tracedBuildings.length>=60);
const actual=new Set(city.city.tracedBuildings.filter(b=>b.model.startsWith('panel')).map(b=>`${b.u},${b.v}`));const missing=MAP_BUILDINGS.filter(b=>b[0].startsWith('panel')&&!actual.has(`${b[1]},${b[2]}`));assert.deepEqual(missing,[],'all measured residential blocks should appear');
await page.click('#close');await page.waitForFunction(()=>__MERCH__.view.pointerLocked);await page.screenshot({path:'.playwright/minimap-close.png'});const mini=await page.evaluate(()=>+document.querySelector('#minimap').dataset.mapZoom);assert.ok(Math.abs(mini-300/MINIMAP_SPAN)<1e-6);
assert.deepEqual(app.errors,[]);await context.close();console.log('Tablet 80/20, all tabs, map selection, close navigator and measured city PASS');
}finally{await app.close();}
