import assert from 'node:assert/strict';
import { freshState, SHOPS } from '../src/state.js';
import { CIRCUIT_SOLUTION, rotatePort } from '../src/jobs/circuit.js';
import { bestVisibleSwap } from './job-fixtures.js';
import { startBrowser, advance, hold, walkTo, navigate, report, artifacts } from './job-browser.mjs';

const app = await startBrowser();
let activePage, activeName;
const results = [];
const progress = setInterval(async () => {
  if (!activePage || activePage.isClosed()) return;
  try { console.log('JOB PROGRESS', activeName, JSON.stringify(await activePage.evaluate(() => ({ mode: __MERCH__.mode, time: __MERCH__.state.time, position: __MERCH__.state.position, job: __MERCH__.state.shops[__MERCH__.state.selected].job, activity: __MERCH__.jobs.activity, held: __MERCH__.motion.heldCartId, cargoCarts: __MERCH__.motion.carts.filter((c) => c.id === 5 || c.id === 6) })))); } catch {}
}, 20000); progress.unref();
async function run(name, id, point, action, prepare = () => {}) {
  if (process.env.JOBS_ONLY && !process.env.JOBS_ONLY.split(',').includes(name)) return;
  activeName = name;
  const state = freshState(); state.selected = id; state.position = { x: SHOPS[id].x + point[0], z: SHOPS[id].z + point[1] }; prepare(state);
  const { context, page } = await app.scenario(state, `jobs-${name}`); activePage = page;
  await action(page);
  await page.screenshot({ path: `${artifacts}job-${name}.png` });
  results.push(name); console.log('JOB PASS', name);
  await context.close(); activePage = null;
}
async function reload(page) {
  await page.keyboard.press('KeyM'); await page.locator('.phone').waitFor();
  await page.reload(); await page.click('#begin'); await page.waitForFunction(() => __MERCH__.view.pointerLocked);
}
async function grip(page) {
  await page.waitForFunction(() => __MERCH__.motion.player.gripWeight > .99 && __MERCH__.motion.player.gripErrors.length === 2 && __MERCH__.motion.player.gripErrors.every((e) => e < .04));
}
async function noCarts(page, id) { assert.equal(await page.evaluate((id) => __MERCH__.state.shops[id].carts, id), 0); }
try {
  await run('parking', 0, [5.6, 9], async (page) => {
    await page.keyboard.press('KeyE'); await page.waitForFunction(() => __MERCH__.vehicles.some((v) => v.controlled && v.id === 0));
    await hold(page, ['KeyW'], .52); await hold(page, ['Space'], 1.4);
    const car = await page.evaluate(() => __MERCH__.vehicles.find((v) => v.id === 0));
    assert.equal(await page.evaluate(() => __MERCH__.jobs.parkingCar), 0, JSON.stringify(car));
    assert.equal(await page.evaluate(() => __MERCH__.state.shops[0].job.paid), false);
    await page.keyboard.press('KeyE');
    await page.waitForFunction(() => !__MERCH__.vehicles.some((v) => v.controlled)); await advance(page, .15);
    await navigate(page, -49.4, 35.8); await navigate(page, -44, 35.8); await walkTo(page, -44, 34.8);
    await page.keyboard.press('KeyE'); await page.locator('#payParking:enabled').waitFor();
    const money = await page.evaluate(() => __MERCH__.state.money);
    await page.click('#payParking');
    assert.equal(await page.evaluate(() => __MERCH__.state.money), money - 40);
    await page.waitForFunction(() => __MERCH__.view.pointerLocked); await report(page, 0); await noCarts(page, 0);
  }, (s) => { s.vehicles = [{ x: -47.5, z: 29, heading: 0 }]; s.carts = [{ x: -58, z: 37 }, { x: -61, z: 37 }]; });

  await run('match3', 1, [8, -1], async (page) => {
    await page.keyboard.press('KeyE'); await page.locator('#matchGrid').waitFor();
    assert.equal(await page.locator('[data-cell]').count(), 36);
    const bounds = await page.locator('[data-cell="35"]').boundingBox();
    assert.ok(bounds.y + bounds.height < 700, 'all six rows fit the viewport');
    const moves = await page.locator('#matchMoves').innerText();
    await page.click('[data-cell="5"]'); await page.click('[data-cell="6"]');
    assert.equal(await page.locator('#matchMoves').innerText(), moves, 'row wrap is not a valid swap');
    let game = await page.evaluate(() => __MERCH__.state.shops[1].job.match);
    let pair = bestVisibleSwap(game);
    await page.click(`[data-cell="${pair[0]}"]`); await page.click(`[data-cell="${pair[1]}"]`);
    await page.click('#close');
    const saved = await page.evaluate(() => __MERCH__.state.shops[1].job.match);
    await reload(page); await page.keyboard.press('KeyE'); await page.locator('#matchGrid').waitFor();
    assert.deepEqual(await page.evaluate(() => __MERCH__.state.shops[1].job.match), saved, 'closing during cascade and reloading preserves the canonical board');
    for (let n = 0; n < 18 && !(await page.locator('#matchFinish').count()); n++) {
      game = await page.evaluate(() => __MERCH__.state.shops[1].job.match); pair = bestVisibleSwap(game);
      assert.ok(pair); await page.click(`[data-cell="${pair[0]}"]`); await page.click(`[data-cell="${pair[1]}"]`);
      await page.locator('#matchGrid[data-busy="false"]').waitFor();
    }
    await page.click('#matchFinish'); await report(page, 1); await noCarts(page, 1);
  });

  await run('repair', 3, [11, -4.7], async (page) => {
    assert.equal(await page.evaluate(() => __MERCH__.visuals.cabinet.intensity), 0);
    await page.keyboard.press('KeyE'); await page.locator('[data-circuit="0"]').waitFor();
    await page.click('[data-circuit="0"]'); const circuit = await page.evaluate(() => __MERCH__.state.shops[3].job.circuit);
    await page.click('#close'); await reload(page); await page.keyboard.press('KeyE');
    await page.locator('[data-circuit="0"]').waitFor();
    assert.deepEqual(await page.evaluate(() => __MERCH__.state.shops[3].job.circuit), circuit);
    for (let i = 0; i < 9; i++) {
      let mask = Number(await page.locator(`[data-circuit="${i}"]`).getAttribute('data-mask'));
      while (mask !== CIRCUIT_SOLUTION[i]) { await page.click(`[data-circuit="${i}"]`); mask = rotatePort(mask); }
    }
    await page.click('#repairApply');
    await page.waitForFunction(() => __MERCH__.motion.player.animation.clip === 'Fixing');
    await page.screenshot({ path: `${artifacts}job-repair-animation.png` });
    await page.keyboard.press('Escape'); await page.locator('#resume').waitFor();
    const paused = await page.evaluate(() => __MERCH__.motion.player.animation.time);
    await page.waitForTimeout(400);
    assert.equal(await page.evaluate(() => __MERCH__.motion.player.animation.time), paused, 'work animation freezes with the paused job');
    assert.equal(await page.evaluate(() => __MERCH__.state.shops[3].job.repaired), false);
    await page.click('#resume'); await page.waitForFunction(() => __MERCH__.view.pointerLocked);
    await page.waitForFunction(() => __MERCH__.state.shops[3].job.repaired && __MERCH__.visuals.cabinet.intensity > 0);
    await report(page, 3); await noCarts(page, 3);
  });

  await run('expiry', 5, [-8, -1], async (page) => {
    await page.keyboard.press('KeyE'); await page.locator('[data-expiry="1"]').waitFor();
    const stress = await page.evaluate(() => __MERCH__.state.stress);
    await page.click('[data-expiry="1"]');
    assert.deepEqual(await page.evaluate(() => __MERCH__.state.shops[5].job.removed), []);
    assert.equal(await page.evaluate(() => __MERCH__.state.stress), stress + 2);
    for (const i of [0, 2]) await page.click(`[data-expiry="${i}"]`);
    await page.click('#close'); await reload(page); await page.keyboard.press('KeyE'); await page.locator('[data-expiry="4"]').waitFor();
    assert.deepEqual(await page.evaluate(() => __MERCH__.state.shops[5].job.removed), [0, 2]);
    await page.click('[data-expiry="4"]'); await page.click('#auditFinish'); await report(page, 5); await noCarts(page, 5);
  });

  await run('prices', 6, [10.9, 5.7], async (page) => {
    await page.keyboard.press('KeyE'); await page.locator('[data-price="0"]').first().waitFor();
    await page.click('[data-price="0"][data-value="79"]');
    assert.deepEqual(await page.evaluate(() => __MERCH__.state.shops[6].job.labels), [null, null, null]);
    for (const [i, price] of [89, 119, 139].entries()) await page.click(`[data-price="${i}"][data-value="${price}"]`);
    await page.click('#pricesFinish'); await report(page, 6); await noCarts(page, 6);
  });

  await run('warehouse', 2, [-23.3, 0], async (page) => {
    for (const [i, id] of [5, 6].entries()) {
      if (i) {
        await navigate(page, 10, -46.5); await walkTo(page, -.7, -46.5); await walkTo(page, -.7, -55);
      }
      await page.keyboard.press('KeyR'); await page.waitForFunction((id) => __MERCH__.motion.heldCartId === id, id); await grip(page);
      const x = i ? -.7 : -3.3;
      await walkTo(page, x, -46.5); await grip(page);
      // Short waypoints keep the loaded body clear of both the warehouse
      // corner and the parked car; a long diagonal keyboard leg cuts the bend.
      const destination = 20 + (i ? -2.074 : .726);
      for (let cross = x + 1.5; cross < destination; cross += 1.5) await walkTo(page, cross, -46.5, .2);
      await walkTo(page, destination, -55 + 8.679, .2); await grip(page);
      assert.equal(await page.evaluate(() => __MERCH__.motion.heldCartId), id, 'loaded cart follows around the warehouse corner');
      await page.keyboard.press('KeyR');
      await page.waitForFunction((id) => __MERCH__.state.shops[2].job.delivered.includes(id), id);
      if (!i) { await reload(page); assert.deepEqual(await page.evaluate(() => __MERCH__.state.shops[2].job.delivered), [5]); }
    }
    await report(page, 2);
    assert.deepEqual(await page.evaluate(() => __MERCH__.state.shops[2].job.delivered), [5, 6]);
  });

  await run('delivery', 4, [15.6, 7.7], async (page) => {
    for (const [trip, i] of [2, 0, 1].entries()) {
      if (trip) {
        const pickup = await page.evaluate(() => __MERCH__.jobs.targets.find((t) => t.type === 'pickup'));
        await navigate(page, SHOPS[4].x, SHOPS[4].z + 7); await navigate(page, pickup.x, pickup.z - 1.2);
      }
      await page.keyboard.press('KeyE');
      await page.waitForFunction((i) => __MERCH__.state.carrying?.box === i, i); await advance(page, .4); await grip(page);
      if (trip === 1) { await reload(page); await grip(page); assert.equal(await page.evaluate(() => __MERCH__.state.carrying.box), i); }
      await page.screenshot({ path: `${artifacts}job-carry-box-${i}.png` });
      await navigate(page, SHOPS[4].x + 4, SHOPS[4].z + 7);
      await navigate(page, SHOPS[4].x, SHOPS[4].z);
      await navigate(page, SHOPS[4].x - 3.8, SHOPS[4].z - 4.8);
      await page.keyboard.press('KeyE');
      await page.waitForFunction((i) => __MERCH__.state.shops[4].job.delivered.includes(i) && !__MERCH__.state.carrying, i);
    }
    await report(page, 4); await noCarts(page, 4);
    assert.deepEqual(await page.evaluate(() => __MERCH__.state.shops[4].job.delivered), [2, 0, 1]);
  });

  await run('closed', 7, [0, 8], async (page) => {
    assert.equal(await page.evaluate(() => __MERCH__.jobs.gateOpen), false);
    await hold(page, ['KeyW'], 2);
    assert.ok(await page.evaluate(() => __MERCH__.state.position.z > 98.05), 'cannot bypass the closed shutter');
    await page.keyboard.press('KeyE'); assert.equal(await page.locator('[data-choice]').count(), 0);
  });

  await run('delivery_camera', 4, [15.6, 7.7], async (page) => {
    await page.keyboard.press('KeyE'); await page.waitForFunction(() => __MERCH__.state.carrying?.box === 2);
    await advance(page, .4); await grip(page);
    const data = await page.evaluate(() => ({ camera: __MERCH__.view.cameraPosition, car: __MERCH__.vehicles.find((v) => v.id === 4), visible: __MERCH__.view.playerVisible }));
    const dx = data.camera[0] - data.car.position[0], dz = data.camera[2] - data.car.position[2];
    const c = Math.cos(data.car.heading), s = Math.sin(data.car.heading);
    assert.ok(Math.abs(c * dx - s * dz) > data.car.halfWidth || Math.abs(s * dx + c * dz) > data.car.halfLength || data.camera[1] > data.car.position[1] + data.car.height, 'camera stays outside the actual truck body');
    assert.equal(data.visible, true, 'player and the carried carton remain visible behind the truck');
    await hold(page, ['KeyA'], .4);
    assert.equal(await page.evaluate(() => __MERCH__.motion.player.animation.clip), 'Walk');
    assert.ok(await page.evaluate(() => __MERCH__.motion.player.gripErrors.every((error) => error < .04)));
  });

  await run('scanner', 7, [0, 8], async (page) => {
    assert.equal(await page.evaluate(() => __MERCH__.jobs.gateOpen), true);
    const initial = await page.evaluate(() => __MERCH__.people.find((n) => n.kind === 'staff' && n.shop === 7).position);
    await navigate(page, -55, 95);
    for (let i = 0; i < 3; i++) {
      const spot = await page.evaluate((i) => __MERCH__.jobs.targets.find((t) => t.type === 'search' && t.spot === i), i);
      await navigate(page, spot.x, spot.z); await page.keyboard.press('KeyE');
      await page.waitForFunction((i) => __MERCH__.state.shops[7].job.searched.includes(i), i);
    }
    assert.equal(await page.evaluate(() => __MERCH__.state.shops[7].job.scannerFound), true);
    assert.equal(await page.evaluate(() => __MERCH__.state.shops[7].done), false);
    const director = await page.evaluate(() => __MERCH__.people.find((n) => n.kind === 'staff' && n.shop === 7).position);
    assert.ok(Math.hypot(initial[0] - director[0], initial[2] - director[2]) > .5, 'director patrols while the player works');
    await report(page, 7); await noCarts(page, 7);
    assert.equal(await page.evaluate(() => __MERCH__.state.shops[7].job.scannerReturned), true);
  }, (s) => { for (let i = 0; i < 5; i++) s.shops[i].done = true; });
  assert.deepEqual(app.errors, []);
  console.log('ALL JOB BROWSER CHECKS PASSED', results.join(', '));
} catch (error) {
  if (activePage && !activePage.isClosed()) {
    console.error('JOB FAILURE', activeName, await activePage.evaluate(() => ({ state: __MERCH__.state, jobs: __MERCH__.jobs, motion: __MERCH__.motion, context: document.querySelector('#context')?.innerText })));
    await activePage.screenshot({ path: `${artifacts}job-failure-${activeName}.png` });
  }
  throw error;
} finally { clearInterval(progress); await app.close(); }
