import test from 'node:test';
import assert from 'node:assert/strict';
import RAPIER from '@dimforge/rapier3d-compat';
import { createCartBody } from '../src/physics/cart.js';
await RAPIER.init();
test('loaded trolley rolls over overlapping pavement seams and a low store threshold', () => {
  const world = new RAPIER.World({ x: 0, y: -20, z: 0 });
  function slab(x, halfWidth, height) {
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(x, height / 2, 0));
    world.createCollider(RAPIER.ColliderDesc.cuboid(halfWidth, height / 2, 5), body);
  }
  slab(-5, 5, .06); slab(4, 5, .06); slab(8, 2, .08);
  const body = createCartBody(world, RAPIER, { x: -4, z: 0, loaded: true });
  for (let n = 0; n < 60; n++) world.step();
  assert.ok(Math.abs(body.translation().y - .06) < .01, 'visible wheels stand on the surface');
  for (let n = 0; n < 300; n++) {
    body.setLinvel({ x: 2.7, y: body.linvel().y, z: 0 }, true); world.step();
  }
  assert.ok(body.translation().x > 8, `trolley caught a seam: ${JSON.stringify(body.translation())}`);
  assert.ok(body.translation().y > .065 && body.translation().y < .1, `wheel contacts climb the two-centimetre threshold: ${JSON.stringify(body.translation())}`);
  world.free();
});
