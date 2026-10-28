import {startBrowser,advance} from '../tests/job-browser.mjs';
import {freshState,SHOPS} from '../src/state.js';
const app=await startBrowser(5210);
try{for(const [name,x,z] of [['residential',-62,-89],['leisure',20,-90],['business',97,-87],['newshop',20,26]]){const s=freshState();s.position={x,z};s.selected=8;const {page,context}=await app.scenario(s,name);await advance(page,.3);console.log(name,await page.evaluate(()=>({shops:__MERCH__.state.shops.length,visuals:__MERCH__.visuals.assets,city:__MERCH__.city})));await page.screenshot({path:`.playwright/city-${name}-new.png`});await context.close();}if(app.errors.length)throw Error(JSON.stringify(app.errors));}finally{await app.close();}
