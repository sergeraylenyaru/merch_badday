export const PARKING_BAY = Object.freeze({ x: 7.5, z: 13, w: 2.1, d: 3.3 });
export function fitsParkingBay(vehicle, shop) {
  if (vehicle.police || vehicle.rival || vehicle.jobLocked || !vehicle.mesh.visible || Math.abs(vehicle.speed) > 0.35) return false;
  const dx = vehicle.mesh.position.x - shop.x - PARKING_BAY.x;
  const dz = vehicle.mesh.position.z - shop.z - PARKING_BAY.z;
  const c = Math.abs(Math.cos(vehicle.heading)), s = Math.abs(Math.sin(vehicle.heading));
  return Math.abs(dx) + c * vehicle.w + s * vehicle.l <= PARKING_BAY.w - 0.12
    && Math.abs(dz) + s * vehicle.w + c * vehicle.l <= PARKING_BAY.d - 0.12;
}
