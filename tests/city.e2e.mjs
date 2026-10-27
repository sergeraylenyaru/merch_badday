import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { freshState, SHOPS } from '../src/state.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const artifacts = fileURLToPath(new URL('../.playwright/', import.meta.url));
const url = 'http://127.0.0.1:5200';
await mkdir(artifacts, { recursive: true });
const service = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5200', '--strictPort'], { cwd: root, stdio: 'ignore' });
let browser;
const errors = [];
async function advance(page, seconds) {
  const start = await page.evaluate(() => __MERCH__.state.time);
  await page.waitForFunction(({ start, seconds }) => __MERCH__.state.time >= start + seconds, { start, seconds }, { timeout: 60000 });
}
async function scenario(state, name) {
  const context = await browser.newContext({ viewport: { width: 900, height: 650 } });
  await context.addInitScript(({ state, name }) => {
    if (sessionStorage.getItem(name)) return;
    localStorage.setItem('merch-badday-v1', JSON.stringify(state));
    localStorage.setItem('merch-settings', JSON.stringify({ quality: 'low', volume: 0, sensitivity: 1 }));
    sessionStorage.setItem(name, '1');
  }, { state, name });
  const page = await context.newPage();
  page.setDefaultTimeout(60000);
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(url);
  await page.locator('#begin').waitFor();
  await page.click('#begin');
  await page.waitForFunction(() => __MERCH__.view.pointerLocked);
  return { context, page };
}
async function walkTo(page, x, z, tolerance = 0.5) {
  for (let step = 0; step < 80; step++) {
    const data = await page.evaluate(() => ({ p: __MERCH__.state.position, yaw: __MERCH__.view.cameraYaw }));
    const dx = x - data.p.x, dz = z - data.p.z;
    if (Math.hypot(dx, dz) < tolerance) return;
    const f = -Math.sin(data.yaw) * dx - Math.cos(data.yaw) * dz;
    const s = Math.cos(data.yaw) * dx - Math.sin(data.yaw) * dz;
    const keys = [];
    if (Math.abs(f) > 0.14) keys.push(f > 0 ? 'KeyW' : 'KeyS');
    if (Math.abs(s) > 0.14) keys.push(s > 0 ? 'KeyD' : 'KeyA');
    for (const key of keys) await page.keyboard.down(key);
    try { await advance(page, 0.12); }
    finally { for (const key of keys) await page.keyboard.up(key); }
  }
  throw new Error(`Cannot reach ${x},${z}: ${JSON.stringify(await page.evaluate(() => __MERCH__.state.position))}`);
}
function grounded(view) {
  assert.ok(Math.abs(view.playerY - view.groundHeight) < 0.005, `root/floor mismatch: ${JSON.stringify(view)}`);
}

try {
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(url)).ok) break; } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  browser = await chromium.launch({ executablePath: process.env.BROWSER_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined), headless: true,
    args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
  const profiles = new Set();
  for (const shop of SHOPS) {
    const state = freshState();
    state.position = { x: shop.x, z: shop.z + 8 };
    state.selected = shop.id;
    const { context, page } = await scenario(state, `shop-${shop.id}`);
    const visuals = await page.evaluate(() => __MERCH__.visuals);
    assert.deepEqual(await page.evaluate(() => __MERCH__.navigation.streetObstructions), [], 'roads must remain clear of scenery');
    assert.equal(visuals.assets.loaded, 17);
    const district = visuals.districts.find((d) => d.shop === shop.id);
    assert.ok(district.visible && district.collisionProxies > 0 && district.generatedMeshes > 0);
    profiles.add(district.feature);
    await advance(page, 0.35);
    await page.screenshot({ path: `${artifacts}store-${String(shop.id + 1).padStart(2, '0')}.png` });
    grounded(await page.evaluate(() => __MERCH__.view));
    await walkTo(page, shop.x, shop.z + 0.3);
    grounded(await page.evaluate(() => __MERCH__.view));
    const skin = await page.evaluate(() => __MERCH__.motion.player);
    assert.ok(skin.soleClearance >= 0 && skin.soleClearance < 0.01, 'actual skin soles follow the raised surface');
    await page.keyboard.press('KeyE');
    await page.locator('[data-choice=badge]').waitFor();
    assert.equal(await page.evaluate(() => __MERCH__.state.selected), shop.id);
    assert.equal(await page.evaluate(() => document.pointerLockElement), null);
    await page.click('#close');
    if (shop.task === 'shelf') {
      await walkTo(page, shop.x + 8, shop.z - 1);
      await page.keyboard.press('KeyE');
      await page.locator('.shelfitems').waitFor();
      await page.click('[data-item="0"]');
      await page.click('[data-item="1"]');
      await page.click('[data-item="1"]');
      await page.click('[data-item="2"]');
      assert.equal(await page.evaluate((id) => __MERCH__.state.shops[id].shelf, shop.id), true);
    }
    console.log('SHOP ENTRANCE / FLOOR / STAFF / QUEST PASS', shop.id + 1, shop.name, district.feature);
    await context.close();
  }
  assert.equal(profiles.size, 8);

  // A real 62.5cm gap between the side wall and refrigerated case. The old
  // 1.3m blocking diameter made this visible route impossible to traverse.
  let state = freshState();
  state.position = { x: SHOPS[0].x - 13.1875, z: SHOPS[0].z - 3.5 };
  let { context, page } = await scenario(state, 'narrow-aisle');
  await page.keyboard.down('KeyW');
  try { await advance(page, 1.35); } finally { await page.keyboard.up('KeyW'); }
  const narrow = await page.evaluate(() => ({ p: __MERCH__.state.position, view: __MERCH__.view, skin: __MERCH__.motion.player.soleClearance }));
  assert.ok(narrow.p.z < SHOPS[0].z - 6.5);
  assert.ok(narrow.p.x > SHOPS[0].x - 13.21 && narrow.p.x < SHOPS[0].x - 13.15);
  grounded(narrow.view);
  assert.equal(narrow.view.collisionRadius, 0.3);
  await page.screenshot({ path: `${artifacts}city-narrow-aisle.png` });
  console.log('REAL NARROW AISLE / RAISED FLOOR PASS', JSON.stringify(narrow));
  await context.close();

  state = freshState();
  state.position = { x: -23.2, z: -87 };
  ({ context, page } = await scenario(state, 'traffic-takeover'));
  const initial = await page.evaluate(() => __MERCH__.vehicles.find((v) => v.id === 9));
  await page.waitForFunction((z) => __MERCH__.vehicles.find((v) => v.id === 9).position[2] > z + 0.2, initial.position[2]);
  await page.waitForFunction(() => /Остановить и сесть/.test(document.querySelector('#context').innerText));
  const health = await page.evaluate(() => __MERCH__.state.health);
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => __MERCH__.vehicles.some((v) => v.id === 9 && v.claimed && v.controlled));
  const stopped = await page.evaluate(() => __MERCH__.vehicles.find((v) => v.controlled));
  await advance(page, 0.5);
  const still = await page.evaluate(() => __MERCH__.vehicles.find((v) => v.controlled));
  assert.deepEqual(still.position, stopped.position, 'traffic AI must stop controlling the occupied car');
  assert.equal(await page.evaluate(() => __MERCH__.state.health), health, 'no phantom collision with the occupied car');
  assert.ok(await page.evaluate(() => __MERCH__.state.wanted >= 1));
  const wheelsBefore = await page.evaluate(() => __MERCH__.motion.vehicles.find((v) => v.id === 9).wheelAngles);
  await page.keyboard.down('KeyW');
  try { await advance(page, 0.65); } finally { await page.keyboard.up('KeyW'); }
  const driven = await page.evaluate(() => __MERCH__.vehicles.find((v) => v.controlled));
  assert.ok(driven.position[2] > stopped.position[2] + 0.5);
  const wheelsAfter = await page.evaluate(() => __MERCH__.motion.vehicles.find((v) => v.id === 9).wheelAngles);
  assert.equal(wheelsAfter.length, 4);
  assert.ok(wheelsAfter.some((angle, i) => Math.abs(angle - wheelsBefore[i]) > 0.1));
  await page.screenshot({ path: `${artifacts}city-traffic-driving.png` });
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => !__MERCH__.vehicles.some((v) => v.controlled));
  grounded(await page.evaluate(() => __MERCH__.view));
  const parked = await page.evaluate(() => __MERCH__.vehicles.find((v) => v.id === 9));
  await advance(page, 0.5);
  assert.deepEqual(await page.evaluate(() => __MERCH__.vehicles.find((v) => v.id === 9).position), parked.position);
  await page.keyboard.press('KeyM'); // Actual save from the phone.
  await page.reload();
  await page.locator('#begin').waitFor();
  const restored = await page.evaluate(() => __MERCH__.vehicles.find((v) => v.id === 9));
  assert.equal(restored.claimed, true);
  assert.deepEqual(restored.position, parked.position);
  await page.click('#begin');
  await advance(page, 0.4);
  assert.deepEqual(await page.evaluate(() => __MERCH__.vehicles.find((v) => v.id === 9).position), parked.position);
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => __MERCH__.vehicles.some((v) => v.id === 9 && v.controlled));
  console.log('MOVING TRAFFIC / TAKEOVER / NO SELF-COLLISION / DRIVE / WHEELS / EXIT / SAVE / REENTER PASS');
  await context.close();
  // Drive across the block formerly intruded on by the x=-30,z=-30 tower.
  state = freshState();
  state.position = { x: -23.2, z: -45 };
  state.vehicles = Array.from({ length: 10 }, () => null);
  state.vehicles[9] = { x: -21, z: -46, heading: 0, claimed: true };
  ({ context, page } = await scenario(state, 'clear-road-drive'));
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => __MERCH__.vehicles.some((v) => v.id === 9 && v.controlled));
  await page.keyboard.down('KeyW');
  try { await advance(page, 3); } finally { await page.keyboard.up('KeyW'); }
  const throughBlock = await page.evaluate(() => __MERCH__.vehicles.find((v) => v.controlled));
  assert.ok(throughBlock.position[2] > -24, `road blocked by scenery: ${JSON.stringify(throughBlock)}`);
  assert.equal(await page.evaluate(() => __MERCH__.state.health), 100);
  console.log('DRIVE THROUGH FORMER SCENERY OBSTRUCTION PASS', throughBlock.position);
  await context.close();
  assert.deepEqual(errors, []);
  console.log('ALL EIGHT SHOPS / VEHICLE VARIANTS / HUMAN SCALE PASS');
} finally {
  await browser?.close();
  service.kill('SIGTERM');
}
