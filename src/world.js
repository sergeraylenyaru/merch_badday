import * as T from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { SHOPS } from "./state.js";
import { createVisuals } from "./visuals/index.js";
import { PLAYER_SHAPE, AVENUES, buildingPlot, circleIntersectsBox, boxesIntersect, vehicleBox } from "./spatial.js";
import { createJobWorld } from './jobs/world.js';
import { createCartBody } from './physics/cart.js';
export async function createWorld(scene, state) {
  await RAPIER.init();
  const physics = new RAPIER.World({ x: 0, y: -20, z: 0 });
  const blockers = [],
    carts = [],
    vehicles = [],
    people = [],
    zones = [],
    shelves = [],
    secrets = [];
  const mat = (color) => new T.MeshStandardMaterial({ color, roughness: 0.85 });
  const materials = new Map();
  const shopDecor = SHOPS.map(() => []);
  const surfaces = [];
  let visualBucket = null;
  function box(x, y, z, w, h, d, color, solid = false) {
    let m = materials.get(color);
    if (!m) {
      m = mat(color);
      materials.set(color, m);
    }
    const mesh = new T.Mesh(new T.BoxGeometry(w, h, d), m);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    visualBucket?.push(mesh);
    if (solid) {
      const b = physics.createRigidBody(
        RAPIER.RigidBodyDesc.fixed().setTranslation(x, y, z),
      );
      const collider = physics.createCollider(
        RAPIER.ColliderDesc.cuboid(w / 2, h / 2, d / 2),
        b,
      );
      const blocker = { x, z, y, h, w: w / 2, d: d / 2, enabled: true };
      blockers.push(blocker);
      mesh.userData.blocker = blocker;
      mesh.userData.colliderHandle = collider.handle;
    }
    return mesh;
  }
  function label(text, x, y, z, color = "#faf0d0", size = 3) {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 96;
    const ctx = c.getContext("2d");
    ctx.fillStyle = color;
    ctx.font = "bold 42px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(text, 256, 64);
    const t = new T.CanvasTexture(c);
    const p = new T.Sprite(new T.SpriteMaterial({ map: t, depthWrite: false }));
    p.position.set(x, y, z);
    p.scale.set(size * 4, size * 0.75, 1);
    scene.add(p);
    visualBucket?.push(p);
    return p;
  }
  const ground = box(20, -0.5, 20, 300, 1, 300, "#708666");
  const gb = physics.createRigidBody(
    RAPIER.RigidBodyDesc.fixed().setTranslation(20, -0.5, 20),
  );
  physics.createCollider(RAPIER.ColliderDesc.cuboid(150, 0.5, 150), gb);
  function surface(x, z, width, depth, height) {
    surfaces.push({ x, z, w: width / 2, d: depth / 2, height });
    const body = physics.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(x, height / 2, z));
    physics.createCollider(RAPIER.ColliderDesc.cuboid(width / 2, height / 2, depth / 2), body);
  }
  function groundHeight(x, z) {
    let height = 0;
    for (const surface of surfaces) if (Math.abs(x - surface.x) <= surface.w && Math.abs(z - surface.z) <= surface.d)
      height = Math.max(height, surface.height);
    return height;
  }
  for (const v of AVENUES) {
    surface(v, 20, 15, 270, 0.05);
    surface(20, v, 270, 15, 0.05);
    box(v, 0.015, 20, 15, 0.06, 270, "#3d484b");
    box(20, 0.02, v, 270, 0.06, 15, "#3d484b");
    for (let j = -105; j < 155; j += 10) {
      box(v, 0.052, j, 0.22, 0.002, 4, "#e5dbb6");
      box(j, 0.052, v, 4, 0.002, 0.22, "#e5dbb6");
    }
    for (let j = -100; j < 145; j += 32) {
      box(v + 10, 2.5, j, 0.18, 5, 0.18, "#34433e");
      box(v + 9.2, 5, j, 2, 0.15, 0.5, "#e9c486");
    }
  }
  function human(x, z, color, kind = "civilian", shop = -1) {
    const g = new T.Group();
    const torso = new T.Mesh(new T.BoxGeometry(0.75, 1, 0.45), mat(color));
    torso.position.y = 1.45;
    g.add(torso);
    const head = new T.Mesh(new T.SphereGeometry(0.29, 8, 8), mat("#dbb596"));
    head.position.y = 2.23;
    g.add(head);
    const legs = [];
    for (const dx of [-0.23, 0.23]) {
      const leg = new T.Mesh(new T.BoxGeometry(0.27, 0.8, 0.3), mat("#344445"));
      leg.position.set(dx, 0.5, 0);
      g.add(leg);
      legs.push(leg);
    }
    const arms = [];
    for (const side of [-1, 1]) {
      const arm = new T.Mesh(new T.BoxGeometry(0.24, 0.85, 0.28), mat(color));
      arm.position.set(side * 0.53, 1.4, 0);
      g.add(arm);
      arms.push(arm);
    }
    if (kind === "player") {
      const bag = new T.Mesh(new T.BoxGeometry(0.35, 0.6, 0.6), mat("#566454"));
      bag.position.set(0.62, 0.9, 0);
      g.add(bag);
    }
    g.position.set(x, 0, z);
    scene.add(g);
    return {
      mesh: g,
      legs,
      arms,
      kind,
      shop,
      home: new T.Vector3(x, 0, z),
      phase: Math.random() * 6,
      stun: 0,
      anger: 0,
    };
  }
  function car(x, z, type, i, traffic = false) {
    const colors = ["#eac275", "#719da6", "#c56c56", "#9aab9a"];
    const g = new T.Group();
    const w = type === 3 ? 3 : 2.5,
      l = type === 3 ? 6.8 : type === 1 ? 5.8 : 4.6;
    const chassis = new T.Mesh(new T.BoxGeometry(w, 0.9, l), mat(colors[type]));
    chassis.position.y = 1;
    g.add(chassis);
    const cab = new T.Mesh(
      new T.BoxGeometry(w * 0.83, 1, l * 0.45),
      mat("#b8c8c3"),
    );
    cab.position.set(0, 1.8, type === 1 ? -0.8 : 0);
    g.add(cab);
    const glass = new T.Mesh(
      new T.BoxGeometry(w * 0.85, 0.65, 0.08),
      mat("#385867"),
    );
    glass.position.set(0, 1.95, l * 0.225 + 0.05);
    g.add(glass);
    for (const a of [-1, 1])
      for (const b of [-1, 1]) {
        const wheel = new T.Mesh(
          new T.CylinderGeometry(0.48, 0.48, 0.3, 10),
          mat("#28302e"),
        );
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set((a * w) / 2, 0.55, b * l * 0.31);
        g.add(wheel);
      }
    for (const a of [-0.8, 0.8]) {
      const light = new T.Mesh(
        new T.BoxGeometry(0.4, 0.22, 0.1),
        mat("#ffe7a7"),
      );
      light.position.set(a, 1, l / 2 + 0.05);
      g.add(light);
    }
    g.position.set(x, 0, z);
    scene.add(g);
    const visualModel = type === 1 ? 'van' : type === 3 ? 'truck' : type === 2 ? 'sedan' : i % 2 ? 'suv' : 'hatchback';
    return {
      mesh: g,
      type,
      visualModel,
      displayName: { hatchback: 'Компакт', sedan: 'Седан', suv: 'Кроссовер', van: 'Фургон доставки', truck: 'Грузовик' }[visualModel],
      speed: 0,
      heading: 0,
      w: w / 2,
      l: l / 2,
      max: [20, 16, 23, 13][type],
      accel: [11, 8, 12, 6][type],
      traffic,
      claimed: false,
      id: i,
      home: { x, z },
    };
  }
  for (const shop of SHOPS) {
    const { x, z, color, id } = shop;
    visualBucket = shopDecor[id];
    surface(x, z, 39, 36, 0.06);
    surface(x, z - 3, 28, 11, 0.08);
    surface(x, z + 3.7, 15.5, 2.5, 0.08);
    surface(x + (x === -55 ? 1 : -1) * 24.75, z + 13, 10.5, 7, 0.04);
    box(x, 0.03, z, 39, 0.06, 36, "#a4a797");
    // Open-front stores: back, side walls, canopy and shelves form a walkable interior.
    box(x, 3.2, z - 8, 28, 6.4, 1, color, true);
    box(x - 14, 3.2, z - 3, 1, 6.4, 11, color, true);
    box(x + 14, 3.2, z - 3, 1, 6.4, 11, color, true);
    box(x, 6.5, z - 3, 29, 0.5, 12, "#e6d8ba");
    box(x, 0.07, z - 3, 28, 0.02, 11, "#d4d0bd");
    box(x, 5.2, z + 2.6, 28, 1.3, 0.5, color);
    label(shop.name.toUpperCase(), x, 5.25, z + 3, "#fff4da", 3.7);
    label(String(id + 1).padStart(2, "0"), x - 12, 8, z, "#ffe2a0", 2);
    for (const sx of [-8, 8]) {
      box(x + sx, 1, z - 4, 3, 2, 4, "#c7c7ad", true);
      for (let j = 0; j < 3; j++)
        for (let k = 0; k < 2; k++)
          box(
            x + sx - 1 + j,
            0.8 + k * 0.8,
            z - 1.9,
            0.7,
            0.6,
            0.45,
            ["#dc9461", "#87a48b", "#cabc70"][j],
          );
    }
    const shelf = box(x + 8, 2.5, z - 4, 2, 0.2, 3, "#e8b34d");
    shelves.push({ mesh: shelf, shop: id, x: x + 8, z: z - 1 });
    const npc = human(x, z - 2, color, "staff", id);
    people.push(npc);
    label(shop.npc.split(" · ")[0], x, 3.1, z - 2, "#fff0c7", 1.3);
    const zone = box(x - 9, 0.06, z + 11, 9, 0.05, 7, "#b8c16d");
    zones.push({ mesh: zone, x: x - 9, z: z + 11, shop: id });
    label("ТЕЛЕЖКИ", x - 9, 1.2, z + 11, "#f3e8ac", 1.1);
    for (let j = 0; j < shop.required; j++) {
      const idx = carts.length;
      const saved = state.carts[idx];
      const missionCargo = id === 2 && j < 2;
      const cx = saved?.x ?? (missionCargo ? x - 23.3 + j * 2.6 : x + 3 + (j % 2) * 3),
        cz = saved?.z ?? (missionCargo ? z - 1.5 : z + 8 + Math.floor(j / 2) * 4);
      const g = new T.Group();
      const basket = new T.Mesh(
        new T.BoxGeometry(1.15, 0.7, 1.5),
        new T.MeshStandardMaterial({ color: "#bccac0", wireframe: true }),
      );
      basket.position.y = 1;
      g.add(basket);
      const bottom = new T.Mesh(
        new T.BoxGeometry(1.15, 0.12, 1.5),
        mat("#7c9288"),
      );
      bottom.position.y = 0.65;
      g.add(bottom);
      for (const dx of [-0.5, 0.5])
        for (const dz of [-0.6, 0.6]) {
          const wheel = new T.Mesh(
            new T.SphereGeometry(0.15, 6, 6),
            mat("#2d3c35"),
          );
          wheel.name = `Wheel${dz < 0 ? "Rear" : "Front"}${dx < 0 ? "Left" : "Right"}`;
          wheel.position.set(dx, 0.2, dz);
          g.add(wheel);
        }
      const handle = new T.Mesh(new T.BoxGeometry(1.2, 0.13, 0.15), mat(color));
      handle.position.set(0, 1.5, -0.85);
      g.add(handle);
      for (const [side, name] of [[-1, "CartHandleLeft"], [1, "CartHandleRight"]]) {
        const anchor = new T.Object3D();
        anchor.name = name;
        anchor.position.set(side * 0.42, 1.5, -0.85);
        g.add(anchor);
      }
      scene.add(g);
      const heading = Number.isFinite(saved?.heading) ? saved.heading : 0;
      const body = createCartBody(physics, RAPIER, { x: cx, z: cz, heading, loaded: missionCargo });
      carts.push({ mesh: g, body, shop: id, id: idx, missionCargo, rewarded: !!saved?.rewarded, gripped: false, delivered: false });
    }
    const parked = car(x + 16, z + 13, id === 4 ? 3 : id % 4, vehicles.length);
    parked.delivery = id === 4;
    vehicles.push(parked);
    box(x + 17, 1.2, z + 4, 1.2, 2.4, 1.2, "#314d3e", true);
    label("КОФЕ", x + 17, 3, z + 4, "#ffe5a1", 0.9);
  }
  visualBucket = null;
  vehicles.push(car(-21, 35, 2, vehicles.length));
  for (let i = 0; i < 6; i++) {
    const v = car(-21, -90 + i * 36, i % 4, vehicles.length, true);
    vehicles.push(v);
  }
  for (let i = 0; i < 24; i++) {
    const x = [-29, 46, 69][i % 3],
      z = -85 + Math.floor(i / 3) * 30;
    people.push(
      human(x, z, ["#cb985c", "#758eb2", "#a77d91", "#94a774"][i % 4]),
    );
  }
  for (let i = 0; i < 3; i++) {
    const p = human(-110 + i * 15, -95, "#577d9a", "police");
    people.push(p);
  }
  for (let i = 0; i < 16; i++) {
    const x = -105 + (i % 4) * 75,
      z = -105 + Math.floor(i / 4) * 75;
    if (SHOPS.some((s) => Math.hypot(s.x - x, s.z - z) < 30)) continue;
    const plot = buildingPlot(x, z);
    if (!plot) continue;
    const width = plot.w * 2, depth = plot.d * 2;
    const h = 10 + (i % 4) * 4;
    box(x, h / 2, z, width, h, depth, ["#a1a79b", "#baa993", "#84968a"][i % 3], true);
    for (let y = 3; y < h; y += 3)
      for (const j of [-width / 3, 0, width / 3])
        box(x + j, y, z + depth / 2 + 0.06, Math.min(2, width / 4), 1.5, 0.1, "#d9cf9d");
  }
  for (let i = 0; i < 34; i++) {
    const x = -116 + (i % 7) * 40,
      z = -113 + Math.floor(i / 7) * 58;
    if (SHOPS.some((s) => Math.hypot(s.x - x, s.z - z) < 25)) continue;
    if (AVENUES.some((road) => Math.abs(x - road) < 10.5 || Math.abs(z - road) < 10.5)) continue;
    box(x, 1.6, z, 0.5, 3.2, 0.5, "#6d6750", true);
    const tree = new T.Mesh(new T.IcosahedronGeometry(3, 0), mat("#4c7557"));
    tree.position.set(x, 4, z);
    scene.add(tree);
  }
  for (let i = 0; i < 4; i++) {
    const x = -90 + i * 65,
      z = 126;
    const m = box(x, 0.8, z, 0.8, 0.8, 0.8, "#e8c568");
    secrets.push({ mesh: m, taken: false });
  }
  // A bus shelter and benches along the avenue.
  box(43, 2.6, 34, 3, 0.3, 9, "#6b938b");
  box(44.3, 1.3, 34, 0.15, 2.5, 9, "#98b1a1");
  box(43, 0.65, 34, 1.3, 0.3, 6, "#af9871", true);
  label("ОСТАНОВКА · 08", 43, 3.3, 34, "#f7e6b9", 1.5);
  const policeVehicles = [];
  for (let i = 0; i < 3; i++) {
    const v = car(-108 + i * 10, -112, 2, vehicles.length);
    v.police = true;
    const light = new T.Mesh(new T.BoxGeometry(1.2, 0.2, 0.5), mat("#517db7"));
    light.position.set(0, 2.5, 0);
    v.mesh.add(light);
    v.light = light;
    policeVehicles.push(v);
    vehicles.push(v);
  }
  const rival = car(8, 130, 1, vehicles.length, true);
  rival.rival = true;
  vehicles.push(rival);
  label("КОЛЛЕГА ДИМА", 8, 4, 130, "#edda9b", 1);
  // Keep pre-existing IDs stable for saved games; extra cars replace the
  // formerly decorative, non-interactive sedans on each shop's left bay.
  for (const shop of SHOPS) vehicles.push(car(shop.x - 17, shop.z + 12, shop.id % 2 ? 0 : 2, vehicles.length));
  const player = human(state.position.x, state.position.z, "#d8b25e", "player");
  const badge = box(0, 0, 0, 0.2, 0.27, 0.07, "#f6efcd");
  scene.remove(badge);
  badge.position.set(0.2, 1.6, 0.27);
  player.mesh.add(badge);
  for (const v of vehicles) {
    const p = state.vehicles[v.id];
    if (p && (!v.traffic || p.claimed)) {
      v.claimed = !!p.claimed;
      v.mesh.position.set(p.x, groundHeight(p.x, p.z), p.z);
      v.heading = p.heading;
      v.mesh.rotation.y = p.heading;
    }
  }
  for (const person of [...people, player]) person.mesh.position.y = groundHeight(person.mesh.position.x, person.mesh.position.z);
  for (const v of vehicles) v.mesh.position.y = groundHeight(v.mesh.position.x, v.mesh.position.z);
  function blocked(x, z, r = PLAYER_SHAPE.radius, ignoreCar = null) {
    if (x < -125 || x > 165 || z < -125 || z > 165) return true;
    if (
      blockers.some(
        (b) => b.enabled !== false && circleIntersectsBox(x, z, r, b),
      )
    )
      return true;
    return vehicles.some(
      (v) =>
        v !== ignoreCar && v.mesh.visible && !(v.police && state.wanted < 3) &&
        circleIntersectsBox(x, z, r, vehicleBox(v)),
    );
  }
  function vehicleBlocked(vehicle, x, z, heading = vehicle.heading) {
    const shape = vehicleBox(vehicle, x, z, heading);
    const c = Math.abs(Math.cos(heading)), s = Math.abs(Math.sin(heading));
    const rx = c * shape.w + s * shape.d, rz = s * shape.w + c * shape.d;
    if (x - rx < -125 || x + rx > 165 || z - rz < -125 || z + rz > 165) return true;
    return blockers.some((b) => b.enabled !== false && boxesIntersect(shape, b)) || vehicles.some((v) => v !== vehicle && v.mesh.visible
      && !(v.police && state.wanted < 3) && boxesIntersect(shape, vehicleBox(v)));
  }
  const world = {
    physics,
    RAPIER,
    box,
    label,
    player,
    carts,
    vehicles,
    policeVehicles,
    people,
    zones,
    shelves,
    secrets,
    blocked,
    vehicleBlocked,
    groundHeight,
    blockers,
    addSurface: surface,
    state,
  };
  // Rendering supplies measured vehicle extents. Entity IDs, transforms,
  // interaction targets and physical bodies remain owned by the world.
  world.visuals = await createVisuals(scene, world, shopDecor);
  world.jobs = createJobWorld(scene, world, state);
  world.streetObstructions = blockers.filter((blocker) => AVENUES.some((road) =>
    boxesIntersect(blocker, { x: road, z: 20, w: 7.5, d: 135 }) || boxesIntersect(blocker, { x: 20, z: road, w: 135, d: 7.5 })));
  return world;
}
