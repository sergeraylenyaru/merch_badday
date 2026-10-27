import { Box3, Ray, Vector3 } from 'three';
const ray = new Ray(), localRay = new Ray(), bounds = new Box3();
const delta = new Vector3(), hit = new Vector3();
/** Clip the camera boom against walls and the measured, rotated car bodies. */
export function constrainCamera(origin, desired, blockers, vehicles = [], ignoredVehicle = null) {
  delta.copy(desired).sub(origin);
  let distance = delta.length();
  if (distance < .001) return distance;
  delta.multiplyScalar(1 / distance); ray.set(origin, delta);
  for (const box of blockers) {
    if (box.enabled === false) continue;
    bounds.min.set(box.x - box.w, box.y - box.h / 2, box.z - box.d);
    bounds.max.set(box.x + box.w, box.y + box.h / 2, box.z + box.d);
    if (ray.intersectBox(bounds, hit)) distance = Math.min(distance, Math.max(.1, origin.distanceTo(hit) - .14));
  }
  for (const car of vehicles) {
    if (car === ignoredVehicle || !car.mesh.visible) continue;
    const p = car.mesh.position, c = Math.cos(car.heading), s = Math.sin(car.heading);
    const dx = origin.x - p.x, dz = origin.z - p.z;
    localRay.origin.set(c * dx - s * dz, origin.y - p.y, s * dx + c * dz);
    localRay.direction.set(c * delta.x - s * delta.z, delta.y, s * delta.x + c * delta.z);
    bounds.min.set(-car.w, 0, -car.l); bounds.max.set(car.w, car.h ?? 2.4, car.l);
    if (localRay.intersectBox(bounds, hit)) distance = Math.min(distance, Math.max(.1, localRay.origin.distanceTo(hit) - .14));
  }
  desired.copy(origin).addScaledVector(delta, distance);
  return distance;
}
