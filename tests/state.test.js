import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SHOPS,
  freshState,
  canComplete,
  complete,
  finish,
  save,
  load,
} from "../src/state.js";
test("all eight shops require carts and their own extra task", () => {
  const s = freshState();
  for (const shop of SHOPS) {
    assert.equal(canComplete(s, shop.id), false);
    s.shops[shop.id].carts = shop.required;
    assert.equal(canComplete(s, shop.id), false);
    s.shops[shop.id][shop.task] = true;
    assert.equal(complete(s, shop.id), true);
    assert.equal(complete(s, shop.id), false);
  }
  assert.ok(s.ending);
  assert.equal(s.money, 1900);
  assert.equal(s.bonus, 800);
});
test("partial route cannot finish as employee of the month", () => {
  const s = freshState();
  s.shops[0].done = true;
  assert.equal(finish(s), "Выжил и ладно");
  s.wanted = 4;
  assert.equal(finish(s), "Самый разыскиваемый мерч");
});
test("saved route, carts, positions and consequences survive reload", () => {
  const s = freshState();
  s.shops[1].shelf = true;
  s.shops[1].carts = 3;
  complete(s, 1);
  s.carts = [{ x: 10, z: 15 }];
  s.position = { x: 44, z: 12 };
  s.fines = 200;
  let value;
  const storage = {
    setItem(k, v) {
      value = v;
    },
    getItem() {
      return value;
    },
  };
  save(s, storage);
  assert.deepEqual(load(storage), s);
  value = "{broken";
  assert.deepEqual(load(storage), freshState());
});
test("normalizes values and rejects incompatible saves", () => {
  const storage = {
    getItem: () =>
      JSON.stringify({ ...freshState(), health: -100, stress: 900 }),
  };
  assert.equal(load(storage).health, 0);
  assert.equal(load(storage).stress, 100);
  assert.equal(load({ getItem: () => '{"version":2}' }).time, 0);
});
