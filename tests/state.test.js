import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SHOPS, freshState, canComplete, complete, finish, save, load } from '../src/state.js';
import { JOBS, jobDone, isShopUnlocked } from '../src/jobs/catalog.js';
import { finishPrimary } from './job-fixtures.js';

test('eight different primary jobs can close the route with zero ordinary carts', () => {
  const state = freshState();
  assert.equal(new Set(SHOPS.map((s) => s.task)).size, 8);
  for (const shop of SHOPS) {
    assert.equal(canComplete(state, shop.id), false);
    state.shops[shop.id].badge = state.shops[shop.id].photo = state.shops[shop.id].shelf = true;
    assert.equal(canComplete(state, shop.id), false, 'old flags do not bypass a new job');
    finishPrimary(state, shop.id);
    assert.equal(canComplete(state, shop.id), true, shop.name);
    assert.equal(state.shops[shop.id].carts, 0);
    assert.equal(complete(state, shop.id), true);
    const money = state.money;
    assert.equal(complete(state, shop.id), false);
    assert.equal(state.money, money, 'no repeated visit reward');
  }
  assert.ok(state.ending);
  assert.equal(state.money, 1860); // 8 × 200, minus the real parking fee.
  assert.equal(state.bonus, 800);
});
test('ordinary carts alone cannot complete any primary job', () => {
  const state = freshState();
  for (const shop of SHOPS) {
    state.shops[shop.id].carts = shop.required;
    assert.equal(jobDone(state, shop.id), false);
    assert.equal(canComplete(state, shop.id), false);
  }
});
test('stock and unloading count distinct consignments rather than repeated returns', () => {
  const state = freshState();
  state.shops[2].job.delivered = [5, 5];
  state.shops[4].job.delivered = [0, 0, 1];
  assert.equal(jobDone(state, 2), false);
  assert.equal(jobDone(state, 4), false);
  state.shops[2].job.delivered.push(6); state.shops[4].job.delivered.push(2);
  assert.equal(jobDone(state, 2), true); assert.equal(jobDone(state, 4), true);
});
test('HyperMax unlocks after five confirmed visits, not five unfinished tasks', () => {
  const state = freshState();
  for (let id = 0; id < 5; id++) finishPrimary(state, id);
  assert.equal(isShopUnlocked(state, 7), false);
  for (let id = 0; id < 4; id++) complete(state, id);
  assert.equal(isShopUnlocked(state, 7), false);
  complete(state, 4);
  assert.equal(isShopUnlocked(state, 7), true);
  assert.equal(canComplete(state, 7), false);
  state.shops[7].job.scannerFound = true;
  assert.equal(canComplete(state, 7), false, 'the scanner must be returned');
  state.shops[7].job.scannerReturned = true;
  assert.equal(canComplete(state, 7), true);
});
test('saved boards, circuit, carried carton and distinct deliveries survive reload', () => {
  const state = freshState();
  finishPrimary(state, 1); complete(state, 1);
  state.shops[2].job.delivered = [5]; state.shops[3].job.circuit[0] = 3;
  state.shops[4].job.delivered = [0]; state.carrying = { shop: 4, box: 1 };
  state.carts = [{ x: 10, z: 15, rewarded: true }]; state.position = { x: 44, z: 12 }; state.fines = 200;
  let value;
  const storage = { setItem(k, v) { value = v; }, getItem() { return value; } };
  save(state, storage); assert.deepEqual(load(storage), state);
  value = '{broken'; assert.deepEqual(load(storage), freshState());
});
test('old saves keep confirmed visits and receive fresh unfinished jobs', () => {
  const old = freshState(); delete old.missionVersion;
  old.shops.forEach((shop) => delete shop.job);
  old.shops[0].done = true; old.shops[1].shelf = true; old.money = 712;
  old.carts = Array.from({ length: 24 }, () => ({ x: 0, z: 0 }));
  const state = load({ getItem: () => JSON.stringify(old) });
  assert.equal(state.shops[0].done, true); assert.equal(state.money, 712);
  assert.equal(state.missionVersion, 2);
  assert.equal(jobDone(state, 1), false);
  assert.equal(state.shops[1].job.match.moves, 18);
  assert.equal(state.carts[5].x, SHOPS[2].x - 23.3);
});
test('a damaged puzzle resets locally without erasing other confirmed visits', () => {
  const saved = freshState(); saved.shops[2].done = true;
  saved.shops[1].job.match.board = 'a'.repeat(36);
  saved.carrying = { shop: 4, box: 20 };
  const state = load({ getItem: () => JSON.stringify(saved) });
  assert.equal(state.shops[2].done, true); assert.equal(state.carrying, null);
  assert.equal(state.shops[1].job.match.board.length, 36);
  assert.ok(Array.isArray(state.shops[1].job.match.board));
});
test('partial endings and value normalization remain compatible', () => {
  const state = freshState(); state.shops[0].done = true;
  assert.equal(finish(state), 'Выжил и ладно'); state.wanted = 4;
  assert.equal(finish(state), 'Самый разыскиваемый мерч');
  const loaded = load({ getItem: () => JSON.stringify({ ...freshState(), health: -100, stress: 900 }) });
  assert.equal(loaded.health, 0); assert.equal(loaded.stress, 100);
  assert.equal(load({ getItem: () => '{"version":2}' }).time, 0);
});
