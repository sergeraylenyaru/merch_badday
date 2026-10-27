export const STAFF_ROUTE = Object.freeze([
  [0, -2], [3.8, -4.8], [3.8, -1.45], [11, -1.45], [11, -4.8], [11, -1.45],
  [3.8, -1.45], [-3.8, -1.5], [-11, -1.5], [-11, -4.8], [-11, -1.5], [-3.8, -1.5], [-3.8, -4.8],
]);
export function staffPatrol(person, shop, player, dt) {
  const patrol = person.patrol ??= { index: 0, wait: 0, inspection: 0, duration: 1 };
  const position = person.mesh.position;
  const near = Math.hypot(player.x - position.x, player.z - position.z) < 3.0;
  if (near) return { target: null, lookAt: player, social: true, speed: 0 };
  const [x, z] = STAFF_ROUTE[patrol.index];
  const target = { x: shop.x + x, z: shop.z + z };
  if (Math.hypot(target.x - position.x, target.z - position.z) < 0.22) {
    if (patrol.wait === 0) {
      patrol.duration = 0.65 + (patrol.index % 3) * 0.2;
      patrol.wait = patrol.duration;
      patrol.inspection++;
    }
    patrol.wait = Math.max(0.001, patrol.wait - dt);
    if (patrol.wait <= 0.002) { patrol.index = (patrol.index + 1) % STAFF_ROUTE.length; patrol.wait = 0; }
    return { target: null, lookAt: { x: shop.x + Math.sign(x || 1) * 8, z: shop.z - 4 }, speed: 0,
      activity: patrol.wait > 0 ? { id: patrol.inspection, clip: 'Interact', duration: patrol.duration, remaining: patrol.wait } : null };
  }
  return { target, lookAt: target, speed: 1.25, social: false };
}
