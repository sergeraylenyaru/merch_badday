import test from 'node:test';
import assert from 'node:assert/strict';
import { STAFF_ROUTE, staffPatrol } from '../src/npc/patrol.js';
import { circleIntersectsBox } from '../src/spatial.js';

test('the complete director route reaches both aisles without crossing shelves or checkout', () => {
  const obstacles = [{ x: -8, z: -4, w: 1.5, d: 2 }, { x: 8, z: -4, w: 1.5, d: 2 },
    { x: 11.1, z: 0, w: 1.425, d: 0.975 }, { x: -11, z: -0.3, w: 1.55, d: 0.8 },
    { x: -11.25, z: -6.55, w: 1.625, d: 0.725 }, { x: 11.25, z: -6.55, w: 1.625, d: 0.725 }];
  for (let i = 0; i < STAFF_ROUTE.length; i++) {
    const from = STAFF_ROUTE[i], to = STAFF_ROUTE[(i + 1) % STAFF_ROUTE.length];
    for (let t = 0; t <= 1; t += 0.02) {
      const x = from[0] + (to[0] - from[0]) * t, z = from[1] + (to[1] - from[1]) * t;
      assert.equal(obstacles.some((box) => circleIntersectsBox(x, z, 0.3, box)), false, `route ${i}: ${x},${z}`);
    }
  }
  const person = { mesh: { position: { x: 0, z: -2 } } }, xs = [];
  for (let frame = 0; frame < 1400; frame++) {
    const intent = staffPatrol(person, { x: 0, z: 0 }, { x: 100, z: 100 }, 0.1);
    if (intent.target) {
      const dx = intent.target.x - person.mesh.position.x, dz = intent.target.z - person.mesh.position.z;
      const scale = Math.min(1, intent.speed * 0.1 / Math.hypot(dx, dz));
      person.mesh.position.x += dx * scale; person.mesh.position.z += dz * scale;
    }
    xs.push(person.mesh.position.x);
  }
  assert.ok(Math.min(...xs) < -10 && Math.max(...xs) > 10);
});
test('the director stops for a nearby visitor and resumes the same patrol afterwards', () => {
  const person = { mesh: { position: { x: 0, z: -2 } } }, shop = { x: 0, z: 0 };
  const stopped = staffPatrol(person, shop, { x: 1, z: -2 }, 0.1);
  assert.equal(stopped.target, null); assert.equal(stopped.social, true);
  for (let n = 0; n < 15; n++) staffPatrol(person, shop, { x: 100, z: 100 }, 0.1);
  assert.ok(staffPatrol(person, shop, { x: 100, z: 100 }, 0.1).target);
});
