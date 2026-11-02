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
  assert.equal(details.categories,19);assert.equal(details.catalogModels,239);assert.ok(details.placedModels>30);
  for(const p of details.placements)if(!p.roadSurface)assert.equal(ROAD_BOXES.some(road=>boxesIntersect(p.footprint,road)),false,p.id+' on road');
  for(let i=0;i<LOCAL_POINTS.length;i++)assert.ok(details.placements.some(p=>p.category==='store-exterior'&&p.shopIndex===i),'no details near local shop '+i);
  for(const id of ['transformer-hut','electrical-cabinet'])assert.ok(details.placements.some(p=>p.id===id),id+' missing');
  assert.equal(details.publicServices,details.placements.filter(p=>p.category==='public-buildings').length);
  assert.equal(details.neighborhoods.length,17);
  for(const block of details.neighborhoods)assert.ok(block.placed>=1&&block.placed<=3,block.id+' needs sparse furniture');
  assert.ok(details.entrances>=20,'missing facade entrances');
  for(const yard of details.loadingYards)assert.ok(yard.placed>=2,'missing delivery yard '+yard.shopIndex);
  for(const entrance of details.placements.filter(p=>p.approach)){
    assert.equal(details.placements.some(p=>p!==entrance&&boxesIntersect(p.footprint,entrance.approach)),false,'blocked facade approach');
  }
  assert.deepEqual(app.errors,[]);
  await page.screenshot({path:'.playwright/urban-details-shop.png'});
  console.log('PASS actual urban layer: '+details.placedModels+' placements, '+details.uniqueBatches+' batches, clear roads, six furnished shop aprons, no browser errors');
  console.log(JSON.stringify({neighborhoods:details.neighborhoods,entrances:details.entrances,loadingYards:details.loadingYards}));
  await context.close();
  for(const [name,block] of [['residential','homes-nc'],['park','park-west'],['business','offices-se']]){
    const subject=details.placements.find(p=>p.neighborhood===block&&p.id.startsWith('bench-'));
    assert.ok(subject,'no bench in '+block);
    const state=freshState();state.onboarding.callReceived=true;state.position=point(subject.u,subject.v+24);
    const {page,context}=await app.scenario(state,'neighborhood-'+name);
    await advance(page,.1);
    assert.equal(await page.evaluate(()=>__MERCH__.visuals.assets.failed),0);
    await page.locator('canvas').first().screenshot({path:'.playwright/neighborhood-'+name+'.png'});
    console.log('PASS '+name+' assets and render',await page.evaluate(()=>__MERCH__.renderer));
    await context.close();
  }
  assert.deepEqual(app.errors,[]);
} finally {await app.close();}
