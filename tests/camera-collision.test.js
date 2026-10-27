import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import { constrainCamera } from '../src/visuals/camera-collision.js';
const vehicle = (heading = 0) => ({ mesh: { visible: true, position: new Vector3() }, w: 1.5, l: 3.2, h: 3.7, heading });
test('camera stays behind a tall truck when the player picks up its delivery cartons', () => {
  const truck = vehicle(), origin = new Vector3(0, 1.3, -5), desired = new Vector3(1, 2.5, 0);
  constrainCamera(origin, desired, [], [truck]);
  assert.ok(desired.z < -3.3 && desired.z > -5, `camera entered the cargo body: ${desired.toArray()}`);
});
test('camera respects rotated car bodies, ignores the driven car and opens with disabled gates', () => {
  const car = vehicle(Math.PI / 2), origin = new Vector3(-6, 1, 0), destination = new Vector3(0, 1.5, 0);
  const desired = destination.clone(); constrainCamera(origin, desired, [], [car]); assert.ok(desired.x < -3.3);
  constrainCamera(origin, destination, [{ x: -4, y: 2, z: 0, w: .1, h: 4, d: 2, enabled: false }], [car], car);
  assert.ok(destination.distanceTo(new Vector3(0, 1.5, 0)) < 1e-9);
});
