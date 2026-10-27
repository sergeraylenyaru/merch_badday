import * as T from 'three';
import { JOBS, PRICE_ITEMS, WAREHOUSE_RECEIVING, DELIVERY_ORDER, isShopUnlocked, jobDone } from './catalog.js';
import { fitsParkingBay, PARKING_BAY } from './parking.js';
import { SHOPS } from '../state.js';

/** Physical job props and transactions; no UI or completion shortcuts. */
export function createJobWorld(scene, world, state) {
  const root = new T.Group(); root.name = 'route-jobs'; scene.add(root);
  const materials = new Map(), geometries = new Map(), textures = new Set(), labels = [];
  const proxies = [], groups = [], targets = [], events = [], boxes = [], priceLabels = [];
  let pending = null, activityId = 0, disposed = false, carryingAge = state.carrying ? 1 : 0;
  const v = new T.Vector3(), q = new T.Quaternion();
  function material(color) {
    if (!materials.has(color)) materials.set(color, new T.MeshStandardMaterial({ color, roughness: 0.76 }));
    return materials.get(color);
  }
  function box(group, x, y, z, w, h, d, color) {
    const key = [w, h, d].join('/');
    if (!geometries.has(key)) geometries.set(key, new T.BoxGeometry(w, h, d));
    const mesh = new T.Mesh(geometries.get(key), material(color));
    mesh.position.set(x, y, z); mesh.castShadow = mesh.receiveShadow = true; group.add(mesh); return mesh;
  }
  function sign(group, text, x, y, z, width = 3, color = '#f2ddb0', background = '#233c48') {
    const canvas = document.createElement('canvas'); canvas.width = 768; canvas.height = 160;
    const ctx = canvas.getContext('2d');
    const texture = new T.CanvasTexture(canvas); texture.colorSpace = T.SRGBColorSpace; textures.add(texture);
    const mat = new T.SpriteMaterial({ map: texture, depthWrite: false });
    const sprite = new T.Sprite(mat); sprite.position.set(x, y, z); sprite.scale.set(width, width * 160 / 768, 1); group.add(sprite);
    let last = '';
    const label = { sprite, set(value) {
      if (value === last) return; last = value;
      ctx.fillStyle = background; ctx.fillRect(0, 0, 768, 160);
      ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.strokeRect(8, 8, 752, 144);
      ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = 'bold 55px sans-serif';
      ctx.fillText(value, 384, 82, 710); texture.needsUpdate = true;
    } };
    label.set(text); labels.push(label); return label;
  }
  function proxy(shop, x, y, z, w, h, d) {
    const mesh = world.box(shop.x + x, y, shop.z + z, w, h, d, '#344b50', true);
    mesh.visible = false; proxies.push(mesh); return mesh;
  }
  function target(shop, type, point, label, extra = {}) {
    const data = { shop, type, x: SHOPS[shop].x + point[0], z: SHOPS[shop].z + point[1], label, range: 1.9, ...extra };
    targets.push(data); return data;
  }
  function paint(group, x, z, w, d, color) {
    for (const sx of [-1, 1]) box(group, x + sx * w / 2, 0.064, z, 0.08, 0.004, d, color);
    for (const sz of [-1, 1]) box(group, x, 0.064, z + sz * d / 2, w, 0.004, 0.08, color);
  }
  for (const shop of SHOPS) {
    const group = new T.Group(); group.position.set(shop.x, 0, shop.z); root.add(group); groups.push(group);
  }
  // A free bay, separate from both initially occupied parking places.
  const parking = groups[0];
  paint(parking, PARKING_BAY.x, PARKING_BAY.z, PARKING_BAY.w * 2, PARKING_BAY.d * 2, '#71c9df');
  box(parking, 11, 0.96, 14.8, 0.55, 1.8, 0.5, '#2d515f');
  const meterScreen = box(parking, 11, 1.39, 15.06, 0.4, 0.43, 0.025, '#75b9cc');
  box(parking, 11, 0.9, 15.075, 0.27, 0.08, 0.03, '#162c34');
  const meterLabel = sign(parking, 'ПАРКОВКА · 40 ₽', 11, 2.25, 14.8, 3.5);
  target(0, 'parking', JOBS[0].point, 'Паркомат · 40 ₽');
  target(1, 'planogram', JOBS[1].point, 'Планограмма · три в ряд');

  // Open-front side warehouse, on a surface matching its visible floor.
  const warehouse = groups[2], shop = SHOPS[2];
  // Keep the loading yard level with the shop apron. A carton-laden trolley
  // must not drop onto grass and strike the vertical lip of a parking pad.
  world.addSurface(shop.x - 13.5, shop.z + 5.5, 27, 21, 0.06);
  box(warehouse, -13.5, 0.03, 5.5, 27, 0.06, 21, '#aaa99a');
  world.addSurface(shop.x - 22, shop.z, 10, 10, 0.08);
  box(warehouse, -22, 0.04, 0, 10, 0.08, 10, '#aeb4a7');
  for (const x of [-27, -17]) {
    box(warehouse, x, 2, 0, 0.22, 4, 10.2, '#74878b'); proxy(shop, x, 2, 0, 0.22, 4, 10.2);
    for (let z = -4.8; z < 5; z += 0.6) box(warehouse, x + 0.13, 2, z, 0.05, 3.8, 0.07, '#bcc5bc');
  }
  box(warehouse, -22, 2, -5, 10, 4, 0.22, '#74878b'); proxy(shop, -22, 2, -5, 10, 4, 0.22);
  box(warehouse, -22, 4.12, 0.15, 10.4, 0.24, 10.7, '#465a5f');
  box(warehouse, -22, 3.4, 5.15, 10.2, 0.9, 0.16, '#234652');
  sign(warehouse, 'СКЛАД · АКЦИЗНЫЙ ТОВАР', -22, 3.4, 5.3, 8.7);
  for (const x of [-25.1, -18.9]) {
    box(warehouse, x, 0.5, -3.9, 2.5, 0.8, 1.2, '#8e7353');
    proxy(shop, x, 0.8, -3.9, 2.5, 1.5, 1.2);
    for (let level = 0; level < 2; level++) for (let n = 0; n < 3; n++) box(warehouse, x - 0.75 + n * 0.74, 1.12 + level * 0.42, -3.9, 0.67, 0.37, 0.9, '#bea27a');
  }
  for (const cart of world.carts.filter((c) => c.missionCargo)) {
    const load = new T.Group(); load.name = 'ExciseConsignment'; cart.mesh.add(load);
    for (let level = 0; level < 2; level++) for (const x of [-0.27, 0.27]) {
      box(load, x, 1.06 + level * 0.29, 0.1, 0.5, 0.26, 0.85, '#c5aa83');
      box(load, x, 1.08 + level * 0.29, -0.334, 0.32, 0.09, 0.012, '#e6ddbd');
    }
    sign(load, 'ТАБАК · АКЦИЗ', 0, 1.56, -0.4, 1.18);
  }
  const receiving = WAREHOUSE_RECEIVING;
  paint(warehouse, receiving.x, receiving.z, receiving.w, receiving.d, '#76c3d5');
  sign(warehouse, 'ПРИЁМКА · 2 ТЕЛЕЖКИ', receiving.x, 2.45, receiving.z, 5);
  target(3, 'repair', JOBS[3].point, 'Шкаф · восстановить подсветку');

  // Delivery cartons are the same visible objects on the truck, in the hands,
  // and at receiving. Nothing is created by just incrementing a task counter.
  const truck = world.vehicles.find((car) => car.delivery);
  function pickupPosition(index) {
    const local = new T.Vector3((index % 2 ? 0.38 : -0.38), 1.13 + Math.floor(index / 2) * 0.55, -truck.l - 0.6);
    return truck.mesh.localToWorld(local);
  }
  box(truck.mesh, 0, 0.81, -truck.l - 0.6, 1.8, 0.14, 1.2, '#64736f');
  for (let index = 0; index < 3; index++) {
    const carton = new T.Group(); carton.name = `DeliveryBox${index}`; root.add(carton);
    box(carton, 0, 0, 0, 0.65, 0.5, 0.55, ['#bca071', '#af956c', '#c9ad7c'][index]);
    box(carton, 0, 0.255, 0, 0.1, 0.012, 0.55, '#e3d8b7');
    sign(carton, ['ЧАЙ', 'СОК', 'КРУПА'][index], 0, 0.03, -0.285, 0.48);
    for (const [side, name] of [[-1, 'CartHandleLeft'], [1, 'CartHandleRight']]) {
      const anchor = new T.Object3D(); anchor.name = name; anchor.position.set(side * 0.35, 0, 0); carton.add(anchor);
    }
    carton.userData.carry = true;
    carton.position.copy(pickupPosition(index)); boxes.push(carton);
  }
  const deliveryDrop = target(4, 'drop', [-3.8, -4.8], 'Поставить коробку в приёмку');
  const deliveryPickup = target(4, 'pickup', JOBS[4].point, 'Разгрузка · взять коробку');
  paint(groups[4], -3.8, -5.5, 3.4, 2.7, '#76c3d5');
  sign(groups[4], 'ПРИЁМКА ТОВАРА', -3.8, 2.65, -6.3, 4.2);
  target(5, 'expiry', JOBS[5].point, 'Проверка сроков годности');
  const expiryCrate = box(groups[5], -4.7, 0.35, -6.5, 1.2, 0.55, 0.8, '#a95046');
  sign(groups[5], 'КАРАНТИН ТОВАРА', -4.7, 1.0, -6.5, 2.4);
  target(6, 'prices', JOBS[6].point, 'Заменить ценники по накладной');
  for (let i = 0; i < 3; i++) priceLabels.push(sign(groups[6], `${PRICE_ITEMS[i].old} ₽`, 9.95 + i * 0.95, 0.96, 5.26, 0.85));

  const searchPoints = [[-11, 1.6], [8, -1], [11, -3.8]];
  const searchObjects = [];
  for (const [i, point] of searchPoints.entries()) {
    target(7, 'search', point, ['Проверить тару у кассы', 'Осмотреть коробки у полки', 'Осмотреть коробки у холодильника'][i], { spot: i });
    const object = new T.Group(); object.position.set(point[0], i === 0 ? 0.8 : 0.65, point[1] - 0.6); groups[7].add(object);
    box(object, 0, 0, 0, 0.55, 0.3, 0.42, '#ac936a');
    const scanner = new T.Group(); object.add(scanner);
    box(scanner, 0, 0.24, 0, 0.19, 0.16, 0.3, '#243c49');
    box(scanner, 0, 0.325, 0.025, 0.13, 0.014, 0.14, '#80cfdb');
    scanner.visible = i === state.shops[7].job.scannerLocation;
    searchObjects.push(scanner);
  }
  // A full collision barrier closes the glazed front as well as the shutter;
  // the small window-frame gaps cannot bypass the five-visit condition.
  const gateProxy = proxy(SHOPS[7], 0, 2, 2.7, 27.2, 4, 0.2);
  const gate = new T.Group(); groups[7].add(gate);
  for (let y = 0.2; y < 4; y += 0.22) box(gate, 0, y, 2.73, 15.1, 0.18, 0.13, y % 0.44 < 0.22 ? '#687879' : '#80918d');
  const gateLabel = sign(gate, 'ЗАКРЫТО · ПОСЛЕ 5 ВИЗИТОВ', 0, 2.3, 2.9, 12);
  target(7, 'locked', [0, 4.6], 'Закрыто · сначала 5 магазинов', { range: 3 });
  let gateAmount = isShopUnlocked(state, 7) ? 1 : 0;
  gate.position.y = gateAmount * 4;

  function enabled(target) {
    if (target.type === 'locked') return !isShopUnlocked(state, 7);
    if (!isShopUnlocked(state, target.shop) || state.shops[target.shop].done || jobDone(state, target.shop)) return false;
    if (target.type === 'drop') return state.carrying?.shop === 4;
    if (target.type === 'pickup') return !state.carrying && !pending;
    if (target.type === 'search') return !state.shops[7].job.scannerFound && !state.shops[7].job.searched.includes(target.spot);
    return true;
  }
  function start(kind, extra = {}) {
    if (pending) return false;
    pending = { kind, elapsed: 0, duration: kind === 'repair' ? 1.6 : 0.75, id: ++activityId, ...extra };
    return true;
  }
  function update(dt, time, active) {
    const player = world.player.mesh;
    for (let i = 0; i < groups.length; i++) groups[i].visible = groups[i].position.distanceToSquared(player.position) < 115 * 115;
    const parked = world.vehicles.find((vehicle) => fitsParkingBay(vehicle, SHOPS[0]));
    if (!state.shops[0].job.paid) state.shops[0].job.parkedCarId = parked?.id ?? null;
    meterLabel.set(state.shops[0].job.paid ? 'ОПЛАЧЕНО · ЧЕК ПОЛУЧЕН' : parked ? 'МЕСТО ЗАНЯТО · ОПЛАТИТЕ 40 ₽' : 'СВОБОДНО · ПАРКОВКА 40 ₽');
    meterScreen.material = material(state.shops[0].job.paid ? '#7ab987' : '#75b9cc');
    truck.jobLocked = !jobDone(state, 4);
    const pickup = pickupPosition(0); deliveryPickup.x = pickup.x; deliveryPickup.z = pickup.z;
    if (active && pending) {
      const approaching = pending.approach && Math.hypot(player.position.x - pending.approach.x, player.position.z - pending.approach.z) > 0.15;
      if (approaching) pending.approachTime = (pending.approachTime || 0) + dt;
      else { pending.approach = null; pending.elapsed += dt; }
      if ((pending.approachTime || 0) > 4) { events.push({ kind: 'blocked' }); pending = null; }
    }
    if (active && pending) {
      if (pending.elapsed >= pending.duration) {
        if (pending.kind === 'pickup') { state.carrying = { shop: 4, box: pending.box }; carryingAge = 0; }
        if (pending.kind === 'drop') { state.shops[4].job.delivered.push(pending.box); state.carrying = null; }
        if (pending.kind === 'repair') state.shops[3].job.repaired = true;
        if (pending.kind === 'search') {
          const job = state.shops[7].job;
          if (!job.searched.includes(pending.spot)) job.searched.push(pending.spot);
          if (pending.spot === job.scannerLocation) job.scannerFound = true;
        }
        events.push({ kind: pending.kind, found: state.shops[7].job.scannerFound }); pending = null;
      }
    }
    if (active && state.carrying) carryingAge += dt;
    for (let index = 0; index < boxes.length; index++) {
      const object = boxes[index];
      object.visible = groups[4].visible || state.carrying?.box === index || pending?.box === index;
      if (state.shops[4].job.delivered.includes(index)) {
        object.position.set(SHOPS[4].x - 4.4 + (index % 2) * 0.85, 0.35 + Math.floor(index / 2) * 0.52, SHOPS[4].z - 6.3);
        object.quaternion.identity();
      } else if (state.carrying?.box === index || (pending?.kind === 'drop' && pending.box === index)) {
        player.updateWorldMatrix(true, false);
        v.set(0, 1.28, 0.5); player.localToWorld(v); player.getWorldQuaternion(q);
        if (!active || carryingAge > 0.3) { object.position.copy(v); object.quaternion.copy(q); }
        else { object.position.lerp(v, 1 - Math.exp(-dt * 18)); object.quaternion.slerp(q, 1 - Math.exp(-dt * 18)); }
      } else { object.position.copy(pickupPosition(index)); object.quaternion.copy(truck.mesh.quaternion); }
    }
    for (const cart of world.carts.filter((c) => c.missionCargo)) {
      const p = cart.body.translation();
      if (active && !cart.gripped && p.y > -1 && Math.abs(p.x - SHOPS[2].x - receiving.x) < receiving.w / 2 - .5 && Math.abs(p.z - SHOPS[2].z - receiving.z) < receiving.d / 2 - .4 && !state.shops[2].job.delivered.includes(cart.id)) {
        state.shops[2].job.delivered.push(cart.id); events.push({ kind: 'warehouse', count: state.shops[2].job.delivered.length });
      }
    }
    for (let i = 0; i < priceLabels.length; i++) priceLabels[i].set(`${state.shops[6].job.labels[i] ?? PRICE_ITEMS[i].old} ₽`);
    expiryCrate.scale.y = 1 + state.shops[5].job.removed.length * 0.15;
    expiryCrate.position.y = 0.08 + 0.275 * expiryCrate.scale.y;
    for (const [i, object] of searchObjects.entries()) object.visible = i === state.shops[7].job.scannerLocation && !state.shops[7].job.scannerFound;
    const unlocked = isShopUnlocked(state, 7);
    gateProxy.userData.blocker.enabled = !unlocked;
    world.physics.getCollider(gateProxy.userData.colliderHandle).setEnabled(!unlocked);
    if (active) gateAmount = T.MathUtils.damp(gateAmount, unlocked ? 1 : 0, 5, dt);
    gate.position.y = gateAmount * 4; gate.visible = gateAmount < 0.99;
    gateLabel.set(`ЗАКРЫТО · ВИЗИТЫ ${state.shops.filter((s) => s.done).length}/5`);
  }
  update(0, 0, false);
  if (!isShopUnlocked(state, 7) && Math.abs(world.player.mesh.position.x - SHOPS[7].x) < 13.5 && world.player.mesh.position.z > SHOPS[7].z - 7.5 && world.player.mesh.position.z < SHOPS[7].z + 2.8)
    world.player.mesh.position.set(SHOPS[7].x, world.groundHeight(SHOPS[7].x, SHOPS[7].z + 6), SHOPS[7].z + 6);

  return {
    update,
    get parkingCar() { return world.vehicles.find((car) => fitsParkingBay(car, SHOPS[0])) ?? null; },
    get activity() { return pending ? { id: pending.id * 2 + (pending.approach ? 0 : 1), clip: pending.approach ? 'Walk' : { pickup: 'PickUp', drop: 'Interact', repair: 'Fixing', search: 'Interact' }[pending.kind],
      approach: pending.approach, duration: pending.duration, remaining: pending.duration - pending.elapsed } : null; },
    get handObject() { return state.carrying ? boxes[state.carrying.box] : pending?.kind === 'pickup' && !pending.approach ? boxes[pending.box] : null; },
    startPickup() {
      if (state.carrying) return false;
      const index = DELIVERY_ORDER.find((i) => !state.shops[4].job.delivered.includes(i));
      if (index === undefined) return false;
      const position = boxes[index].position, player = world.player.mesh.position;
      const delta = new T.Vector3(player.x - position.x, 0, player.z - position.z);
      if (delta.lengthSq() < 0.01) delta.set(0, 0, -1);
      delta.normalize().multiplyScalar(0.85);
      const approach = { x: position.x + delta.x, z: position.z + delta.z };
      if (world.blocked(approach.x, approach.z)) return false;
      world.player.actionFacing = Math.atan2(position.x - approach.x, position.z - approach.z);
      return start('pickup', { box: index, approach });
    },
    startDrop() { return !!state.carrying && start('drop', { box: state.carrying.box }); },
    startRepair() { return start('repair'); },
    startSearch(spot) { return start('search', { spot }); },
    takeEvents() { return events.splice(0); },
    nearest(position) {
      let best = null, distance = Infinity;
      for (const item of targets) {
        const d = Math.hypot(position.x - item.x, position.z - item.z);
        if (enabled(item) && d < item.range && d < distance) { best = item; distance = d; }
      }
      return best;
    },
    targetFor(id) {
      if (!isShopUnlocked(state, id)) return targets.find((t) => t.shop === id && t.type === 'locked');
      if (jobDone(state, id) || (id === 7 && state.shops[7].job.scannerFound)) {
        const person = world.people.find((n) => n.kind === 'staff' && n.shop === id);
        return { x: person.mesh.position.x, z: person.mesh.position.z, label: SHOPS[id].npc };
      }
      if (id === 2) {
        const cart = world.carts.find((c) => c.missionCargo && c.gripped);
        if (cart) return { x: SHOPS[2].x + receiving.x, z: SHOPS[2].z + receiving.z, label: 'Голубая приёмка' };
        const next = world.carts.find((c) => c.missionCargo && !state.shops[2].job.delivered.includes(c.id));
        if (next) { const p = next.body.translation(); return { x: p.x, z: p.z, label: 'Тележка на складе' }; }
      }
      if (id === 4) return state.carrying ? deliveryDrop : deliveryPickup;
      if (id === 0 && !state.shops[0].job.paid && state.shops[0].job.parkedCarId === null) return { x: SHOPS[0].x + PARKING_BAY.x, z: SHOPS[0].z + PARKING_BAY.z, label: 'Свободное голубое место' };
      return targets.find((t) => t.shop === id && enabled(t));
    },
    get diagnostics() { return { targets: targets.filter(enabled).map((t) => ({ ...t })), parkingCar: this.parkingCar?.id ?? null, gateOpen: isShopUnlocked(state, 7), activity: this.activity,
      carrying: state.carrying, handPosition: this.handObject?.position.toArray() ?? null }; },
    dispose() {
      if (disposed) return; disposed = true; root.removeFromParent();
      for (const geometry of geometries.values()) geometry.dispose();
      for (const mat of materials.values()) mat.dispose();
      for (const label of labels) label.sprite.material.dispose();
      for (const texture of textures) texture.dispose();
      for (const mesh of proxies) { mesh.removeFromParent(); mesh.geometry.dispose(); }
    },
  };
}
