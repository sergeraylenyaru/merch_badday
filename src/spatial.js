export const PLAYER_SHAPE = Object.freeze({ height: 2.1, radius: 0.3, eyeHeight: 1.8 });
export const AVENUES = Object.freeze([-17.5, 57.5]);

/** Reserve the full road plus pavement before placing background buildings. */
export function buildingPlot(x, z) {
  const w = Math.min(8.5, ...AVENUES.map((road) => Math.abs(x - road) - 8.5));
  const d = Math.min(9, ...AVENUES.map((road) => Math.abs(z - road) - 8.5));
  return w >= 2.5 && d >= 2.5 ? { x, z, w, d } : null;
}

/** Circle against an oriented rectangle, with rounded rather than square corners. */
export function circleIntersectsBox(x, z, radius, box) {
  const angle = box.heading || 0, c = Math.cos(angle), s = Math.sin(angle);
  const dx = x - box.x, dz = z - box.z;
  const localX = c * dx - s * dz, localZ = s * dx + c * dz;
  const ex = Math.max(0, Math.abs(localX) - box.w);
  const ez = Math.max(0, Math.abs(localZ) - box.d);
  return ex * ex + ez * ez < radius * radius;
}

/** Separating-axis test; long vehicles keep their real footprint when turning. */
export function boxesIntersect(a, b) {
  const axes = (angle = 0) => [[Math.cos(angle), -Math.sin(angle)], [Math.sin(angle), Math.cos(angle)]];
  const aa = axes(a.heading), bb = axes(b.heading);
  for (const axis of [...aa, ...bb]) {
    const projection = (box, basis) => box.w * Math.abs(axis[0] * basis[0][0] + axis[1] * basis[0][1])
      + box.d * Math.abs(axis[0] * basis[1][0] + axis[1] * basis[1][1]);
    const separation = Math.abs((b.x - a.x) * axis[0] + (b.z - a.z) * axis[1]);
    if (separation >= projection(a, aa) + projection(b, bb)) return false;
  }
  return true;
}

export function vehicleBox(vehicle, x = vehicle.mesh.position.x, z = vehicle.mesh.position.z, heading = vehicle.heading) {
  return { x, z, w: vehicle.w, d: vehicle.l, heading };
}

export function vehicleDoor(vehicle, side = -1) {
  const x = side * (vehicle.w + PLAYER_SHAPE.radius + 0.18);
  const z = vehicle.type === 1 || vehicle.type === 3 ? vehicle.l * 0.45 : 0;
  const c = Math.cos(vehicle.heading), s = Math.sin(vehicle.heading);
  return { x: vehicle.mesh.position.x + c * x + s * z, z: vehicle.mesh.position.z - s * x + c * z };
}

export function nearestBoardableVehicle(vehicles, position, reach = 2.6) {
  let result = null, distance = reach;
  for (const vehicle of vehicles) {
    if (vehicle.police || vehicle.rival || vehicle.jobLocked || !vehicle.mesh.visible) continue;
    for (const side of [-1, 1]) {
      const door = vehicleDoor(vehicle, side), d = Math.hypot(position.x - door.x, position.z - door.z);
      if (d < distance) { result = vehicle; distance = d; }
    }
  }
  return result;
}
