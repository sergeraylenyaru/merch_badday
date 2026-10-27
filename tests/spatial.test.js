import test from 'node:test';
import assert from 'node:assert/strict';
import { PLAYER_SHAPE, AVENUES, buildingPlot, circleIntersectsBox, boxesIntersect, vehicleBox, vehicleDoor, nearestBoardableVehicle } from '../src/spatial.js';

test('a person fits a 72cm aisle; rounded corners do not invent a square body', () => {
  const left = { x: -0.86, z: 0, w: 0.5, d: 2 };
  const right = { ...left, x: 0.86 };
  assert.equal(circleIntersectsBox(0, 0, PLAYER_SHAPE.radius, left), false);
  assert.equal(circleIntersectsBox(0, 0, PLAYER_SHAPE.radius, right), false);
  assert.equal(circleIntersectsBox(0, 0, 0.65, left), true, 'the previous oversized blocker prevented this passage');
  const corner = { x: 0, z: 0, w: 1, d: 1 };
  assert.equal(circleIntersectsBox(1.23, 1.23, PLAYER_SHAPE.radius, corner), false);
  assert.equal(circleIntersectsBox(1.2, 1.2, PLAYER_SHAPE.radius, corner), true);
});

test('vehicle collisions rotate with the actual rectangular body', () => {
  const long = { x: 0, z: 0, w: 1.25, d: 3.4, heading: Math.PI / 2 };
  assert.equal(circleIntersectsBox(2.8, 0, 0.3, long), true);
  assert.equal(circleIntersectsBox(0, 2, 0.3, long), false);
  const wall = { x: 0, z: 3, w: 10, d: 0.5 };
  assert.equal(boxesIntersect(long, wall), false, 'no invisible circular bumper alongside a long vehicle');
  assert.equal(boxesIntersect({ ...long, heading: 0 }, wall), true);
  assert.equal(boxesIntersect(long, { ...long, x: 8 }), false);
});

test('passing cars can be selected at their doors; inactive and reserved cars cannot', () => {
  const car = { mesh: { position: { x: 10, z: 20 }, visible: true }, heading: Math.PI / 2, w: 1.1, l: 2.4, type: 0, traffic: true };
  const door = vehicleDoor(car);
  assert.equal(door.x, 10);
  assert.ok(door.z > 21.5);
  assert.equal(nearestBoardableVehicle([car], door), car);
  assert.equal(nearestBoardableVehicle([{ ...car, police: true }], door), null);
  assert.equal(nearestBoardableVehicle([{ ...car, rival: true }], door), null);
  assert.equal(nearestBoardableVehicle([{ ...car, mesh: { ...car.mesh, visible: false } }], door), null);
  assert.deepEqual(vehicleBox(car), { x: 10, z: 20, w: 1.1, d: 2.4, heading: Math.PI / 2 });
});

test('background building plots leave every avenue and its pavement clear', () => {
  for (const x of [-105, -30, 45, 120]) for (const z of [-105, -30, 45, 120]) {
    const plot = buildingPlot(x, z);
    assert.ok(plot);
    for (const road of AVENUES) {
      assert.equal(boxesIntersect(plot, { x: road, z: 20, w: 8.4, d: 135 }), false);
      assert.equal(boxesIntersect(plot, { x: 20, z: road, w: 135, d: 8.4 }), false);
    }
  }
  assert.equal(buildingPlot(-17.5, -30), null);
});
