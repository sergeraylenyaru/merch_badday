import test from 'node:test';
import assert from 'node:assert/strict';
import { newPlanogram, findMatches, possibleSwaps, swapProducts, planogramWon } from '../src/jobs/match3.js';
import { newCircuit, rotatePort, CIRCUIT_SOLUTION, poweredContacts, circuitConnected } from '../src/jobs/circuit.js';
import { freshState } from '../src/state.js';
import { payParking } from '../src/jobs/catalog.js';
import { PARKING_BAY, fitsParkingBay } from '../src/jobs/parking.js';
import { bestVisibleSwap } from './job-fixtures.js';

test('generated match-three shelves start without automatic triples and always allow a move', () => {
  for (let seed = 1; seed <= 60; seed++) {
    const game = newPlanogram(seed);
    assert.equal(game.board.length, 36); assert.deepEqual(findMatches(game.board), []);
    assert.ok(possibleSwaps(game.board).length > 0);
    assert.ok(game.board.every((n) => n >= 0 && n < 5));
  }
});
test('an invalid swap leaves moves, board, score and progress untouched', () => {
  const game = newPlanogram(), before = structuredClone(game);
  assert.equal(swapProducts(game, 5, 6).valid, false, 'row wrapping is not adjacency');
  assert.deepEqual(game, before);
  const legal = possibleSwaps(game.board);
  const invalid = Array.from({ length: 5 }, (_, n) => [n, n + 1]).find((p) => !legal.some((m) => m[0] === p[0] && m[1] === p[1]));
  assert.equal(swapProducts(game, ...invalid).valid, false);
  assert.deepEqual(game, before);
});
test('matches clear, fall and refill through cascades, consuming only one move', () => {
  const game = newPlanogram(), before = structuredClone(game);
  const result = swapProducts(game, ...bestVisibleSwap(game));
  assert.equal(result.valid, true); assert.equal(game.moves, before.moves - 1);
  assert.equal(game.collected.reduce((a, b) => a + b), result.events.reduce((n, e) => n + e.cleared.length, 0));
  assert.equal(new Set(result.events[0].cleared).size, result.events[0].cleared.length);
  assert.equal(game.board.length, 36); assert.ok(game.board.every(Number.isInteger));
  assert.deepEqual(findMatches(game.board), []);
});
test('intersecting horizontal and vertical triples count their shared product once', () => {
  const board = Array.from({ length: 36 }, (_, i) => (Math.floor(i / 6) + i % 6) % 5);
  for (const i of [6, 7, 8, 1, 13]) board[i] = 4;
  const matches = findMatches(board);
  assert.equal(new Set(matches).size, matches.length);
  assert.ok([6, 7, 8, 1, 13].every((i) => matches.includes(i)));
});
test('the full planogram is achievable with visible-color choices and cannot reward extra swaps after winning', () => {
  const game = newPlanogram();
  while (!planogramWon(game) && game.moves > 0) assert.equal(swapProducts(game, ...bestVisibleSwap(game)).valid, true);
  assert.equal(planogramWon(game), true);
  const before = structuredClone(game);
  assert.equal(swapProducts(game, 0, 1).valid, false);
  assert.deepEqual(game, before);
});
test('saving in the middle of a shelf preserves the next refill and remaining moves', () => {
  const a = newPlanogram(); swapProducts(a, ...bestVisibleSwap(a));
  const b = JSON.parse(JSON.stringify(a));
  const move = bestVisibleSwap(a);
  assert.deepEqual(swapProducts(a, ...move), swapProducts(b, ...move));
  assert.deepEqual(a, b);
});
test('empty move budgets cannot become negative', () => {
  const game = newPlanogram(); game.moves = 0;
  assert.equal(swapProducts(game, ...bestVisibleSwap(game)).valid, false);
  assert.equal(game.moves, 0);
});
test('cabinet contacts require a real connected path from supply to lamp', () => {
  assert.equal(circuitConnected(newCircuit()), false);
  assert.equal(circuitConnected(CIRCUIT_SOLUTION), true);
  assert.deepEqual(poweredContacts(CIRCUIT_SOLUTION).sort(), [0, 1, 2, 3, 5]);
  const cut = [...CIRCUIT_SOLUTION]; cut[1] = rotatePort(cut[1]);
  assert.equal(circuitConnected(cut), false);
  for (const mask of CIRCUIT_SOLUTION) assert.equal(rotatePort(mask, 4), mask);
});
test('parking checks the entire oriented car, zero speed and a single payment', () => {
  const shop = { x: 10, z: 20 };
  const car = { mesh: { visible: true, position: { x: shop.x + PARKING_BAY.x, z: shop.z + PARKING_BAY.z } }, w: 1.25, l: 2.3, speed: 0, heading: 0 };
  assert.equal(fitsParkingBay(car, shop), true);
  assert.equal(fitsParkingBay({ ...car, speed: 0.5 }, shop), false);
  assert.equal(fitsParkingBay({ ...car, heading: Math.PI / 2 }, shop), false);
  assert.equal(fitsParkingBay({ ...car, l: 3.4 }, shop), false);
  const state = freshState(); state.money = 20;
  assert.equal(payParking(state, 0), false); assert.equal(state.money, 20);
  state.money = 100;
  assert.equal(payParking(state, 0), true); assert.equal(state.money, 60);
  assert.equal(payParking(state, 0), false); assert.equal(state.money, 60);
});
