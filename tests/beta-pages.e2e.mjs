import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {extname,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
const root=fileURLToPath(new URL('../',import.meta.url)).replace(/\/$/,''),prefix='/merch_badday/';
const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.json':'application/json','.glb':'model/gltf-binary','.woff':'font/woff','.woff2':'font/woff2','.wasm':'application/wasm'};
const server=createServer(async(req,res)=>{try{let path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(!path.startsWith(prefix))throw Error('prefix');const file=resolve(root,path.slice(prefix.length)||'index.html');if(!file.startsWith(root+sep))throw Error('path');res.setHeader('Content-Type',types[extname(file)]||'application/octet-stream');res.end(await readFile(file));}catch{res.statusCode=404;res.end();}});
await new Promise(r=>server.listen(5240,'127.0.0.1',r));let browser;
try{
 browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});const p=await browser.newPage({viewport:{width:800,height:600}});p.setDefaultTimeout(60000);
 const errors=[],requests=[];p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());if(r.url().includes('police-officer.glb'))requests.push(r.status());});
 await p.addInitScript(()=>localStorage.setItem('merch-settings',JSON.stringify({quality:'low',volume:0,sensitivity:1})));await p.goto('http://127.0.0.1:5240'+prefix);await p.locator('#begin').click();await p.locator('#answerCall').click();await p.waitForFunction(()=>window.__MERCH__?.view.pointerLocked);
 const start=await p.evaluate(()=>__MERCH__.state.time);await p.waitForFunction(t=>__MERCH__.state.time>t+.1,start);await p.keyboard.press('KeyM');await p.locator('#bigmap').waitFor();assert.deepEqual(errors,[]);assert.deepEqual(requests,[200]);assert.equal(await p.evaluate(()=>__MERCH__.visuals.assets.failed),0);console.log('PASS exported GitHub Pages prefix, new call, WebGL simulation, map and police GLB; no HTTP/page errors');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
