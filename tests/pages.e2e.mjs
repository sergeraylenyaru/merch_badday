import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { chromium } from 'playwright';
import { freshState } from '../src/state.js';

// Exercise the committed Pages artifact, not Vite's source server.
const root = new URL('../', import.meta.url), prefix = '/merch_badday/';
const artifacts = fileURLToPath(new URL('.playwright/', root));
await mkdir(artifacts, { recursive: true });
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.glb': 'model/gltf-binary', '.svg': 'image/svg+xml', '.woff': 'font/woff', '.woff2': 'font/woff2' };
const server = createServer(async (req, res) => {
  try {
    const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = path.slice(prefix.length) || 'index.html';
    if (!path.startsWith(prefix) || file.includes('..') || !/^(index\.html$|icon\.svg$|assets\/|models\/)/.test(file)) {
      res.writeHead(404); res.end(); return;
    }
    const content = await readFile(new URL(file, root));
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' });
    res.end(content);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(5202, '127.0.0.1', resolve); });
let browser;
const errors = [], models = [];
async function advance(page, seconds) {
  const start = await page.evaluate(() => __MERCH__.state.time);
  await page.waitForFunction(({ start, seconds }) => __MERCH__.state.time > start + seconds, { start, seconds });
}
async function scenario(state) {
  const page = await browser.newPage({ viewport: { width: 900, height: 650 } });
  page.setDefaultTimeout(60000);
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('requestfailed', (req) => errors.push(req.url()));
  page.on('response', (r) => { if (new URL(r.url()).pathname.endsWith('.glb')) models.push({ url: r.url(), status: r.status() }); });
  await page.addInitScript((s) => {
    localStorage.setItem('merch-badday-v1', JSON.stringify(s));
    localStorage.setItem('merch-settings', JSON.stringify({ quality: 'low', volume: 0, sensitivity: 1 }));
  }, state);
  await page.goto('http://127.0.0.1:5202' + prefix);
  await page.locator('#begin').waitFor();
  await page.click('#begin');
  await page.waitForFunction(() => __MERCH__.view.pointerLocked);
  return page;
}
try {
  browser = await chromium.launch({ executablePath: process.env.BROWSER_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined), headless: true,
    args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
  let state = freshState();
  state.position = { x: -52, z: 30 };
  state.carts = [{ x: -52, z: 28 }, { x: -65, z: 31 }];
  let page = await scenario(state);
  const visuals = await page.evaluate(() => __MERCH__.visuals);
  assert.equal(visuals.assets.loaded, 17);
  assert.equal(models.length, 17);
  assert.equal(visuals.districts.length, 8);
  assert.equal(new Set(visuals.districts.map((d) => d.feature)).size, 8);
  assert.deepEqual(await page.evaluate(() => __MERCH__.navigation.streetObstructions), []);
  assert.ok(models.some((r) => r.url.endsWith('/vehicles/van.glb')));
  assert.ok(models.some((r) => r.url.endsWith('/vehicles/truck.glb')));
  assert.ok(models.every((r) => r.status === 200));
  await page.keyboard.press('KeyR');
  await page.waitForFunction(() => __MERCH__.motion.player.gripWeight > 0.99 && __MERCH__.motion.player.gripErrors.length === 2 && __MERCH__.motion.player.gripErrors.every((e) => e < 0.04));
  await page.keyboard.down('KeyW');
  try { await advance(page, 0.35); } finally { await page.keyboard.up('KeyW'); }
  assert.ok((await page.evaluate(() => __MERCH__.motion.player.gripErrors)).every((e) => e < 0.04));
  await page.keyboard.press('KeyC');
  await page.waitForFunction(() => __MERCH__.view.firstPersonHandsVisible);
  await page.screenshot({ path: `${artifacts}/city-pages-firstperson.png` });
  await page.keyboard.press('KeyM');
  await page.locator('.phone').waitFor();
  assert.equal(await page.evaluate(() => document.pointerLockElement), null);
  await page.click('[data-tab="Карта"]');
  assert.equal(await page.locator('#bigmap').count(), 1);
  await page.click('#close');
  await page.waitForFunction(() => __MERCH__.view.pointerLocked);
  await page.keyboard.press('KeyC');
  await page.keyboard.press('KeyR');
  await page.waitForFunction(() => __MERCH__.motion.player.gripWeight < 0.01);
  await page.keyboard.down('KeyS');
  try {
    await advance(page, 0.35);
    assert.equal(await page.evaluate(() => __MERCH__.motion.player.animation.clip), 'Walk');
    assert.ok(await page.evaluate(() => Math.abs(__MERCH__.view.playerY - __MERCH__.view.groundHeight) < 0.005));
  } finally { await page.keyboard.up('KeyS'); }
  await page.screenshot({ path: `${artifacts}/city-pages-character.png` });
  await page.close();

  state = freshState();
  state.position = { x: -23.2, z: -87 };
  page = await scenario(state);
  await page.waitForFunction(() => /Остановить и сесть/.test(document.querySelector('#context').innerText));
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => __MERCH__.vehicles.some((v) => v.id === 9 && v.claimed && v.controlled));
  const stopped = await page.evaluate(() => __MERCH__.vehicles.find((v) => v.controlled));
  await advance(page, 0.4);
  assert.deepEqual(await page.evaluate(() => __MERCH__.vehicles.find((v) => v.controlled).position), stopped.position);
  await page.keyboard.down('KeyW');
  try { await advance(page, 0.6); } finally { await page.keyboard.up('KeyW'); }
  assert.ok(await page.evaluate((z) => __MERCH__.vehicles.find((v) => v.controlled).position[2] > z + 0.5, stopped.position[2]));
  await page.screenshot({ path: `${artifacts}/city-pages-traffic.png` });
  await page.close();
  state = freshState(); state.selected = 1; state.position = { x: -47, z: -56 };
  page = await scenario(state);
  assert.equal(await page.evaluate(() => __MERCH__.jobs.gateOpen), false);
  await page.keyboard.press('KeyE'); await page.locator('#matchGrid').waitFor();
  assert.equal(await page.locator('[data-cell]').count(), 36);
  assert.equal(await page.evaluate(() => document.pointerLockElement), null);
  await page.screenshot({ path: `${artifacts}/pages-match3.png` });
  await page.click('#close'); await page.waitForFunction(() => __MERCH__.view.pointerLocked);
  await page.close();
  assert.deepEqual(errors, []);
  console.log('PAGES ROOT /merch_badday/ / 17 GLBs / 8 SHOPS / FLOOR / CART / HANDS / POINTER / TRAFFIC / MATCH3 / JOB GATE PASS');
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
