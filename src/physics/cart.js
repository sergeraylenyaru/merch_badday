/** Fixed spherical wheel contacts let trolleys roll across slab seams/low lips.
 * The basket stays above the pavement; it must not act like a flat sledge. */
export function createCartBody(physics, RAPIER, { x, z, heading = 0, loaded = false }) {
  const body = physics.createRigidBody(RAPIER.RigidBodyDesc.dynamic()
    .setTranslation(x, .2, z).setLinearDamping(4).setAngularDamping(5).lockRotations().setCcdEnabled(true));
  body.setRotation({ x: 0, y: Math.sin(heading / 2), z: 0, w: Math.cos(heading / 2) }, true);
  physics.createCollider(RAPIER.ColliderDesc.cuboid(.6, .625, .85)
    .setTranslation(0, .925, 0).setMass(loaded ? 13 : 8).setFriction(.6), body);
  for (const x of [-.46, .46]) for (const z of [-.66, .66])
    physics.createCollider(RAPIER.ColliderDesc.ball(.14).setTranslation(x, .14, z)
      .setMass(.15).setFriction(.6).setContactSkin(.003), body);
  return body;
}
