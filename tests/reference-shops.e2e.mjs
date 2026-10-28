import assert from 'node:assert/strict';import{startBrowser,advance,hold,report}from'./job-browser.mjs';import{freshState,SHOPS}from'../src/state.js';
const app=await startBrowser(5224);
try{
for(const shop of SHOPS){const s=freshState();s.selected=shop.id;s.position={x:shop.x,z:shop.z+6};if(shop.id===7)for(let i=0;i<5;i++)s.shops[i].done=true;
 const {page,context}=await app.scenario(s,'reference-entry-'+shop.id);await hold(page,['ShiftLeft','KeyW'],1.8);const d=await page.evaluate(()=>({p:__MERCH__.state.position,m:__MERCH__.motion.player,y:__MERCH__.view.playerY,floor:__MERCH__.view.groundHeight}));assert.ok(d.p.z<shop.z+2.4,shop.code+' entrance blocked');assert.ok(d.p.z>shop.z-3,shop.code+' unexpected movement');assert.ok(Math.abs(d.y-d.floor)<.001);assert.ok(d.m.soleClearance>=0&&d.m.soleClearance<.016);console.log(shop.code,'entry and boot contact PASS');await context.close();
}
const s=freshState(),shop=SHOPS[8];s.position={x:shop.x-3.8,z:shop.z-4.8};s.selected=8;const{page,context}=await app.scenario(s,'reference-receipt');await page.keyboard.press('KeyE');await page.waitForFunction(()=>__MERCH__.state.shops[8].job.collected);await report(page,8);await context.close();
assert.deepEqual(app.errors,[]);console.log('Nine entrances, floors and receipt/report PASS');
}finally{await app.close();}
