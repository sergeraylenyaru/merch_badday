import assert from 'node:assert/strict';
import {startBrowser,advance} from './job-browser.mjs';
import {freshState} from '../src/state.js';
import {LOCAL_POINTS,ROAD_BOXES,point} from '../src/city/reference-layout.js';
import {boxesIntersect} from '../src/spatial.js';
const app=await startBrowser(5252);
try {
  const state=freshState();state.position=point(560,235);
  const {page,context}=await app.scenario(state,'urban-details');
  await advance(page,.1);
  const details=await page.evaluate(()=>__MERCH__.city.urbanDetails);
  assert.equal(details.categories,19);assert.equal(details.catalogModels,238);assert.ok(details.placedModels>30);
  for(const p of details.placements)if(!p.roadSurface)assert.equal(ROAD_BOXES.some(road=>boxesIntersect(p.footprint,road)),false,p.id+' on road');
  for(let i=0;i<LOCAL_POINTS.length;i++)assert.ok(details.placements.some(p=>p.category==='store-exterior'&&p.shopIndex===i),'no details near local shop '+i);
  for(const id of ['transformer-hut','electrical-cabinet'])assert.ok(details.placements.some(p=>p.id===id),id+' missing');
  assert.equal(details.publicServices,details.placements.filter(p=>p.category==='public-buildings').length);
  assert.deepEqual(app.errors,[]);
  await page.screenshot({path:'.playwright/urban-details-shop.png'});
  console.log('PASS actual urban layer: '+details.placedModels+' placements, '+details.uniqueBatches+' batches, clear roads, six furnished shop aprons, no browser errors');
  await context.close();
} finally {await app.close();}
