import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

/** Visuals for shop 01. Existing world colliders and interaction targets win. */
export function createDistrict(scene, { library, materials: m, box: collisionBox, shop }) {
  const root = new T.Group();
  root.name = "district-01-u-doma";
  root.position.set(shop?.x ?? -55, 0, shop?.z ?? 20);
  scene.add(root);
  const batches = new Map();
  const generated = new Set();
  const localMaterials = new Set();
  const modelBatches = new Map();
  const instanceMeshes = new Set();
  const proxyMeshes = new Set();
  const metrics = { generatedMeshes: 0, modelMeshes: 0, modelPlacements: 0, collisionProxies: 0, triangles: 0 };
  let disposed = false;

  function queue(geometry, material) {
    let list = batches.get(material);
    if (!list) batches.set(material, list = []);
    list.push(geometry);
  }

  function proxy(x, y, z, width, height, depth) {
    if (!collisionBox) return;
    const mesh = collisionBox(root.position.x + x, y, root.position.z + z,
      width, height, depth, m.colors.navy, true);
    mesh.visible = false;
    proxyMeshes.add(mesh);
    metrics.collisionProxies++;
  }

  function tileUV(geometry, material, dimensions) {
    const tile = material.userData.tileMeters;
    if (!tile) return;
    const uv = geometry.getAttribute("uv"), normal = geometry.getAttribute("normal");
    for (let index = 0; index < uv.count; index++) {
      const nx = Math.abs(normal.getX(index)), ny = Math.abs(normal.getY(index));
      const width = nx > 0.5 ? dimensions[2] : dimensions[0];
      const height = ny > 0.5 ? dimensions[2] : dimensions[1];
      uv.setXY(index, uv.getX(index) * width / tile, uv.getY(index) * height / tile);
    }
  }

  function box(x, y, z, width, height, depth, material, rotationY = 0) {
    const geometry = new T.BoxGeometry(width, height, depth);
    tileUV(geometry, material, [width, height, depth]);
    if (rotationY) geometry.rotateY(rotationY);
    geometry.translate(x, y, z);
    queue(geometry, material);
  }

  function cylinder(x, y, z, radius, height, material, rotationX = 0) {
    const geometry = new T.CylinderGeometry(radius, radius, height, 12);
    if (rotationX) geometry.rotateX(rotationX);
    geometry.translate(x, y, z);
    queue(geometry, material);
  }

  function sphere(x, y, z, radius, material) {
    const geometry = new T.IcosahedronGeometry(radius, 1);
    geometry.translate(x, y, z);
    // Merge batches consistently: both primitives and detail meshes are indexed.
    const indexed = geometry;
    if (!indexed.index) {
      const count = indexed.getAttribute("position").count;
      indexed.setIndex(Array.from({ length: count }, (_, index) => index));
    }
    queue(indexed, material);
  }

  function sign(text, x, y, z, width, height, options = {}, ground = false) {
    const material = m.makeSignMaterial(text, options);
    const geometry = new T.PlaneGeometry(width, height);
    if (ground) geometry.rotateX(-Math.PI / 2);
    geometry.translate(x, y, z);
    queue(geometry, material);
  }

  // Flatten static GLBs into shared geometry/material instance batches. Nothing
  // here takes ownership of the library's authored meshes or PBR textures.
  function model(id, x, y, z, options = {}, rotationY = 0) {
    const instance = library?.instantiate(id, options);
    if (!instance) return false;
    instance.position.set(x, y, z);
    instance.rotation.y = rotationY;
    instance.updateMatrixWorld(true);
    let accepted = 0;
    instance.traverse((node) => {
      if (!node.isMesh || node.isSkinnedMesh) return;
      const materialIds = (Array.isArray(node.material) ? node.material : [node.material])
        .map((material) => material.uuid).join(":");
      const key = `${node.geometry.uuid}:${materialIds}`;
      let batch = modelBatches.get(key);
      if (!batch) {
        batch = { geometry: node.geometry, material: node.material, matrices: [], shadow: node.castShadow };
        modelBatches.set(key, batch);
      }
      batch.matrices.push(node.matrixWorld.clone());
      accepted++;
    });
    library.release(instance);
    if (accepted) metrics.modelPlacements++;
    return accepted > 0;
  }

  // A continuous public apron and a low interior threshold retain the original
  // flat walking plane. Painted details never become obstacles.
  box(0, 0.025, 0, 39, 0.05, 36, m.pavement);
  box(14.4, 0.057, 11.3, 10.2, 0.012, 13.2, m.asphalt);
  box(-17, 0.057, 12, 4.1, 0.012, 9.3, m.asphalt);
  // The apron joins the existing north/south avenue. Only this short section
  // receives the new surface; road positions and traffic routes are unchanged.
  box(24.75, 0.027, 13, 10.5, 0.025, 7, m.asphalt);
  box(37.5, 0.045, 14, 15, 0.015, 40, m.asphalt);
  for (let x = 31; x < 45; x += 2) box(x, 0.067, 18, 1.1, 0.01, 2.5, m.marking);
  box(0, 0.065, -3, 27.9, 0.025, 11, m.floor);
  box(0, 0.065, 3.7, 15.5, 0.025, 2.5, m.floor);
  box(0, 0.081, 5.0, 15.5, 0.015, 0.16, m.metal);
  box(0, 0.077, 17.8, 38.6, 0.012, 0.2, m.marking);
  box(-19.35, 0.13, 0, 0.25, 0.23, 36, m.plaster);
  box(19.35, 0.13, -4.25, 0.25, 0.23, 27.5, m.plaster);
  box(19.35, 0.13, 17.25, 0.25, 0.23, 1.5, m.plaster);

  // Back and side walls reproduce the original collision envelope exactly.
  box(0, 3.2, -8, 28, 6.4, 1, m.plaster);
  for (const side of [-1, 1]) {
    box(side * 14, 3.2, -3, 1, 6.4, 11, m.plaster);
    box(side * 14.53, 0.87, -3, 0.08, 1.55, 10.9, m.brick);
    box(side * 13.46, 0.57, -3, 0.06, 0.8, 10.9, m.navy);
    box(side * 14.54, 5.7, -3, 0.07, 0.3, 11, m.navy);
    // The front remains open across its central fifteen metres.
    box(side * 10.9, 0.67, 2.54, 5.1, 1.05, 0.2, m.brick);
    box(side * 10.9, 2.8, 2.58, 5.1, 3.15, 0.075, m.glass);
    for (const offset of [-2.6, 0, 2.6]) {
      box(side * 10.9 + offset, 2.8, 2.65, 0.085, 3.2, 0.13, m.navy);
    }
    box(side * 10.9, 1.21, 2.65, 5.35, 0.08, 0.16, m.navy);
    box(side * 10.9, 3.73, 2.65, 5.35, 0.085, 0.16, m.navy);
    box(side * 7.55, 2.05, 2.68, 0.2, 3.85, 0.26, m.navy);
    box(side * 7.55, 2.0, 2.85, 0.035, 2.6, 0.055, m.mustard);
    proxy(side * 10.9, 2.2, 2.58, 5.1, 4.2, 0.16);
  }
  box(0, 0.62, -7.46, 27, 0.85, 0.07, m.navy);
  box(0, 3.95, -7.43, 27, 0.12, 0.08, m.mustard);

  // Deep fascia, dimensional sign tray, ribbed weather canopy and warm soffit.
  box(0, 5.3, 2.7, 28.3, 2.05, 0.42, m.navy);
  box(0, 6.28, 2.95, 28.5, 0.13, 0.12, m.mustard);
  box(0, 4.34, 2.95, 28.5, 0.09, 0.12, m.mustard);
  box(0, 5.3, 3.02, 11.95, 2.08, 0.26, m.darkMetal);
  sign("У ДОМА", 0, 5.3, 3.16, 11.65, 1.96, { subtitle: "ПРОДУКТЫ • 08–23" });
  sign("01", -10.4, 5.3, 2.93, 2.1, 0.95);
  sign("КАЖДЫЙ ДЕНЬ", 10.4, 5.3, 2.93, 4.8, 1.0);
  box(0, 4.15, 4.3, 28.65, 0.22, 3.25, m.roof);
  box(0, 4.09, 5.96, 28.75, 0.2, 0.12, m.mustard);
  box(0, 4.01, 4.32, 28.25, 0.045, 2.9, m.plaster);
  for (let x = -13.5; x <= 13.5; x += 1.5) {
    box(x, 4.28, 4.32, 0.055, 0.08, 3.12, m.metal);
  }
  for (const x of [-10.4, 0, 10.4]) {
    box(x, 3.97, 4.9, 3.3, 0.06, 0.15, m.warmLight);
  }

  box(0, 6.55, -3, 29, 0.45, 12, m.roof);
  box(0, 6.25, -3.1, 27, 0.05, 9.9, m.plaster);
  for (const side of [-1, 1]) {
    box(side * 14.35, 6.82, -3, 0.2, 0.22, 11.7, m.navy);
    box(side * 8.5, 7.14, -4.2, 3.1, 0.78, 2.1, m.metal);
    box(side * 8.5, 7.57, -4.2, 3.2, 0.1, 2.2, m.darkMetal);
    for (let index = 0; index < 8; index++) {
      box(side * 8.5 - 1.2 + index * 0.34, 7.15, -3.13, 0.11, 0.5, 0.04, m.darkMetal);
    }
    cylinder(side * 8.5, 7.88, -4.2, 0.36, 0.65, m.darkMetal);
    cylinder(side * 8.5, 8.22, -4.2, 0.48, 0.07, m.metal);
  }
  box(0, 6.83, -8.85, 28.9, 0.22, 0.18, m.navy);
  for (const x of [-10, -5, 0, 5, 10]) {
    box(x, 6.15, -2.7, 0.28, 0.11, 6.6, m.darkMetal);
    box(x, 6.08, -2.7, 0.2, 0.035, 6.35, m.warmLight);
  }
  // Downpipes and maintenance ladder sit against existing side-wall colliders.
  for (const side of [-1, 1]) cylinder(side * 14.62, 3.0, -7.4, 0.085, 5.8, m.darkMetal);
  for (const z of [-6.8, -5.9]) cylinder(14.62, 3.2, z, 0.045, 5.95, m.metal);
  for (let y = 0.55; y < 6.2; y += 0.36) box(14.62, y, -6.35, 0.065, 0.055, 0.9, m.metal);

  // Shelving and product packs fit entirely within the existing 3×4m racks.
  const packMaterials = [m.terracotta, m.mustard, m.navy, m.leaf, m.plaster];
  for (const side of [-1, 1]) {
    const x = side * 8;
    box(x, 0.31, -4, 2.94, 0.23, 3.9, m.darkMetal);
    box(x, 1.2, -4, 2.7, 1.8, 0.09, m.plaster);
    for (const offset of [-1.35, 1.35]) {
      for (const z of [-5.82, -2.18]) box(x + offset, 1.3, z, 0.095, 2.2, 0.095, m.metal);
    }
    for (let level = 0; level < 4; level++) {
      const y = 0.46 + level * 0.51;
      box(x, y, -4, 2.88, 0.07, 3.86, m.metal);
      for (const z of [-5.92, -2.08]) {
        box(x, y + 0.02, z, 2.87, 0.12, 0.055, side > 0 ? m.mustard : m.navy);
        for (let column = 0; column < 5; column++) {
          const packX = x - 1.06 + column * 0.53;
          const packHeight = 0.29 + ((column + level) % 3) * 0.055;
          const face = z > -4 ? -0.25 : 0.25;
          const productMaterial = packMaterials[(column + level * 2 + (side > 0 ? 1 : 0)) % packMaterials.length];
          box(packX, y + 0.075 + packHeight / 2, z + face, 0.39, packHeight, 0.43, productMaterial);
          box(packX, y + 0.1 + packHeight / 2, z + (z > -4 ? -0.025 : 0.025), 0.26, 0.11, 0.012, m.marking);
          box(packX, y + 0.01, z + (z > -4 ? 0.033 : -0.033), 0.19, 0.055, 0.012, m.plaster);
        }
      }
    }
    box(x, 2.25, -4, 2.95, 0.11, 3.95, m.navy);
    sign(side < 0 ? "БАКАЛЕЯ" : "СВЕЖЕЕ", x, 2.45, -2.015, 2.6, 0.47);
  }
  sign("СВЕЖИЕ ПРОДУКТЫ", 0, 4.65, -7.405, 8.3, 1.55, {
    background: m.colors.cream, color: m.colors.navy,
    subtitle: "РЯДОМ С ВАШИМ ДОМОМ",
  });

  // Refrigerated cases occupy rear corners, away from the employee and aisle.
  for (const x of [-11.25, 11.25]) {
    proxy(x, 1.5, -6.55, 3.25, 2.7, 1.45);
    box(x, 1.55, -6.55, 3.25, 2.7, 1.45, m.navy);
    box(x, 2.83, -5.78, 3.08, 0.12, 0.1, m.warmLight);
    box(x, 1.55, -5.8, 2.95, 2.28, 0.05, m.glass);
    for (const dx of [-1.47, 0, 1.47]) box(x + dx, 1.55, -5.75, 0.055, 2.4, 0.08, m.metal);
    for (const dx of [-0.13, 0.13]) box(x + dx, 1.45, -5.66, 0.035, 0.53, 0.065, m.metal);
    for (let level = 0; level < 3; level++) {
      const y = 0.75 + level * 0.62;
      box(x, y, -6.13, 2.75, 0.04, 0.65, m.metal);
      for (let index = 0; index < 6; index++) {
        const material = packMaterials[(index + level) % packMaterials.length];
        cylinder(x - 1.08 + index * 0.43, y + 0.2, -6.08, 0.12, 0.35, material);
        cylinder(x - 1.08 + index * 0.43, y + 0.39, -6.08, 0.065, 0.08, m.marking);
      }
    }
  }

  // Compact checkout in the right corner, leaving the centre route untouched.
  box(11.1, 0.72, 0.0, 2.7, 1.1, 1.8, m.wood);
  proxy(11.1, 0.72, 0, 2.7, 1.1, 1.8);
  box(11.1, 1.32, 0.0, 2.85, 0.13, 1.95, m.navy);
  box(10.85, 1.4, -0.1, 1.25, 0.08, 1.25, m.darkMetal);
  cylinder(11.98, 1.56, -0.45, 0.06, 0.42, m.darkMetal);
  box(11.98, 1.92, -0.45, 0.65, 0.47, 0.12, m.navy);
  box(11.98, 1.92, -0.375, 0.53, 0.34, 0.015, m.glass);
  box(10.2, 1.49, 0.39, 0.28, 0.25, 0.24, m.terracotta);
  sign("КАССА", 11, 3.65, 1.95, 2.55, 0.64);
  for (const x of [-11, -10.15]) {
    box(x, 0.46, 0.3, 0.67, 0.56, 0.75, m.mustard);
    box(x, 0.75, 0.3, 0.72, 0.055, 0.8, m.darkMetal);
  }

  // Existing coffee-machine collider is x+17,z+4, 1.2×1.2m.
  box(17, 1.2, 4, 1.2, 2.4, 1.2, m.navy);
  box(17, 2.44, 4, 1.3, 0.12, 1.3, m.mustard);
  box(17, 1.8, 4.61, 0.78, 0.7, 0.025, m.darkMetal);
  box(16.82, 1.86, 4.64, 0.25, 0.32, 0.015, m.glass);
  box(17.23, 1.87, 4.65, 0.11, 0.1, 0.025, m.mustard);
  box(17, 1.11, 4.63, 0.65, 0.32, 0.04, m.darkMetal);
  box(17, 0.9, 4.67, 0.68, 0.06, 0.14, m.metal);
  sign("КОФЕ", 17, 2.12, 4.63, 1.05, 0.28);

  // Parking, crossing and the cart-return outline are paint on the apron.
  const zoneFill = new T.MeshBasicMaterial({
    color: m.colors.mustard, transparent: true, opacity: 0.12, depthWrite: false,
  });
  localMaterials.add(zoneFill);
  box(-9, 0.072, 11, 9, 0.008, 7, zoneFill);
  for (const x of [-13.5, -4.5]) box(x, 0.088, 11, 0.11, 0.01, 7, m.mustard);
  for (const z of [7.5, 14.5]) box(-9, 0.088, z, 9, 0.01, 0.11, m.mustard);
  sign("ТЕЛЕЖКИ", -9, 0.096, 13.95, 4.4, 0.8, {
    background: "#a7aa98", color: m.colors.navy,
  }, true);
  for (const x of [12.4, 19]) box(x, 0.079, 13, 0.1, 0.01, 7.0, m.marking);
  for (const z of [9.5, 16.5]) box(15.7, 0.079, z, 6.7, 0.01, 0.1, m.marking);
  sign("01", 13.5, 0.096, 15.6, 0.9, 0.43, {
    background: "#505b59", color: m.colors.cream,
  }, true);
  box(16, 0.15, 10.0, 2.1, 0.17, 0.22, m.darkMetal);
  for (const x of [-1.9, 0, 1.9, 3.8, 5.7, 7.6]) {
    box(x, 0.078, 16.6, 1.05, 0.01, 1.8, m.marking);
  }
  for (let index = 0; index < 9; index++) {
    box(-13.85 + index * 1.04, 0.082, 7.1, 0.12, 0.01, 0.55, m.mustard, -0.65);
  }

  // Static imported street furniture is peripheral, clear of every E2E route.
  for (const x of [-18.6, -15.4]) box(x, 0.079, 12, 0.09, 0.01, 7.8, m.marking);
  for (const z of [8.1, 15.9]) box(-17, 0.079, z, 3.25, 0.01, 0.09, m.marking);
  if (!model("sedan", -17, 0.055, 12, { size: [2.5, 2.2, 4.6] })) {
    box(-17, 0.9, 12, 2.35, 0.75, 4.5, m.navy);
    box(-17, 1.6, 11.8, 2.0, 0.75, 2.25, m.glass);
    for (const side of [-1, 1]) for (const z of [10.5, 13.5])
      sphere(-17 + side * 1.02, 0.4, z, 0.4, m.darkMetal);
  }
  proxy(-17, 1.1, 12, 2.5, 2.2, 4.6);
  for (const side of [-1, 1]) {
    if (!model("trees", side * 15.1, 0.055, -13.6, { size: [8, 7, 8] })) {
      cylinder(side * 17.5, 2, -13.8, 0.22, 3.7, m.wood);
      sphere(side * 17.5, 4.9, -13.8, 2.0, m.leaf);
      sphere(side * 17.1, 5.9, -13.8, 1.35, m.leaf);
    }
    // This is a planted island, not a single trunk at the group's origin.
    // A visible curb explains its conservative, static collision footprint.
    for (const dx of [-4.05, 4.05]) box(side * 15.1 + dx, 0.23, -13.6, 0.15, 0.4, 8.2, m.plaster);
    for (const z of [-17.65, -9.55]) box(side * 15.1, 0.23, z, 8.2, 0.4, 0.15, m.plaster);
    proxy(side * 15.1, 0.23, -13.6, 8.2, 0.4, 8.2);
    if (!model("streetlight", side * 18.1, 0.055, 15.6, { size: [1.65, 6.8, 0.6] }, side > 0 ? Math.PI : 0)) {
      cylinder(side * 18.1, 3.4, 15.6, 0.09, 6.5, m.darkMetal);
      box(side * 17.6, 6.55, 15.6, 1.2, 0.12, 0.4, m.darkMetal);
      box(side * 17.6, 6.47, 15.6, 1, 0.025, 0.3, m.warmLight);
    }
    proxy(side * 18.1, 3.4, 15.6, 0.24, 6.8, 0.24);
    if (!model("bush", side * 18.0, 0.55, -0.7, { size: [1.3, 1.15, 2.3] })) {
      sphere(side * 18.0, 1.0, -0.7, 0.65, m.leaf);
      sphere(side * 18.0, 1.0, -1.35, 0.65, m.leaf);
      sphere(side * 18.0, 1.0, -0.05, 0.65, m.leaf);
    }
    box(side * 18.0, 0.34, -0.7, 1.5, 0.4, 2.65, m.plaster);
    box(side * 18.0, 0.55, -0.7, 1.35, 0.04, 2.5, m.darkMetal);
    proxy(side * 18.0, 0.34, -0.7, 1.5, 0.5, 2.65);
  }
  if (!model("bench", -17.8, 0.055, 2.2, { size: [2.6, 0.95, 0.95] }, Math.PI / 2)) {
    for (let slat = 0; slat < 4; slat++) box(-17.8 + slat * 0.19, 0.65, 2.2, 0.15, 0.11, 2.4, m.wood);
    for (const z of [1.4, 3]) box(-17.5, 0.38, z, 0.65, 0.65, 0.13, m.darkMetal);
    box(-18.05, 1.06, 2.2, 0.12, 0.7, 2.4, m.wood);
  }
  proxy(-17.8, 0.5, 2.2, 0.95, 0.95, 2.6);
  if (!model("dumpster", -17.5, 0.055, -5.7, { size: [2.2, 1.4, 1.55] }, Math.PI / 2)) {
    box(-17.5, 0.8, -5.7, 1.6, 1.2, 2.1, m.darkMetal);
    box(-17.5, 1.45, -5.7, 1.7, 0.15, 2.2, m.navy);
  }
  proxy(-17.5, 0.7, -5.7, 1.55, 1.4, 2.2);
  model("box", -16.4, 0.14, -8, { height: 0.6 }, 0.18);
  model("box", -17.2, 0.14, -8.5, { height: 0.55 }, -0.3);
  model("box", -16.65, 0.74, -8.2, { height: 0.5 }, 0.6);

  // Distant architecture stays wholly outside the existing playable boundary.
  const skyline = [
    [-92, -73, "buildingA", 27], [-91, -39, "buildingC", 32],
    [-96, -3, "buildingA", 24], [-92, 34, "buildingC", 35],
    [-95, 75, "buildingA", 28], [-31, -160, "buildingC", 31],
    [7, -162, "buildingA", 25], [48, -163, "buildingC", 34],
  ];
  for (const [x, z, id, height] of skyline) {
    if (!model(id, x, 0, z, { height, shadow: false }, x < -80 ? Math.PI / 2 : 0)) {
      box(x, height / 2, z, 17, height, 18, m.plaster);
      for (let y = 3; y < height - 1; y += 3) {
        for (const dx of [-5.7, -1.9, 1.9, 5.7]) box(x + dx, y, z + 9.02, 1.6, 1.7, 0.04, m.navy);
      }
    }
  }

  // One mesh per generated material, regardless of product or facade count.
  for (const [material, geometries] of batches) {
    const merged = mergeGeometries(geometries, false);
    for (const geometry of geometries) geometry.dispose();
    if (!merged) throw new Error("District geometry batch could not be merged");
    const mesh = new T.Mesh(merged, material);
    mesh.castShadow = !material.transparent && !material.isMeshBasicMaterial;
    mesh.receiveShadow = true;
    mesh.name = `district-batch-${metrics.generatedMeshes++}`;
    root.add(mesh);
    generated.add(merged);
    metrics.triangles += merged.index ? merged.index.count / 3 : merged.getAttribute("position").count / 3;
  }
  batches.clear();
  for (const batch of modelBatches.values()) {
    const mesh = new T.InstancedMesh(batch.geometry, batch.material, batch.matrices.length);
    mesh.name = "district-imported-instances";
    batch.matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = batch.shadow;
    mesh.userData.shadowEligible = batch.shadow;
    mesh.receiveShadow = true;
    mesh.computeBoundingSphere();
    root.add(mesh);
    instanceMeshes.add(mesh);
    metrics.modelMeshes++;
    const triangleCount = batch.geometry.index
      ? batch.geometry.index.count / 3 : batch.geometry.getAttribute("position").count / 3;
    metrics.triangles += triangleCount * batch.matrices.length;
  }
  modelBatches.clear();

  return {
    root,
    metrics,
    update() {},
    setQuality(quality) {
      for (const mesh of instanceMeshes) mesh.castShadow = quality === "high" && mesh.userData.shadowEligible;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      root.removeFromParent();
      for (const geometry of generated) geometry.dispose();
      for (const material of localMaterials) material.dispose();
      for (const mesh of instanceMeshes) mesh.dispose();
      for (const mesh of proxyMeshes) {
        mesh.removeFromParent();
        mesh.geometry.dispose();
      }
      generated.clear();
      localMaterials.clear();
      instanceMeshes.clear();
      proxyMeshes.clear();
    },
  };
}
