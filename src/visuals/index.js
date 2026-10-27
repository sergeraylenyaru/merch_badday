import { Box3, Vector3 } from "three";
import { AssetLibrary } from "./assets.js";
import { createDistrictMaterials } from "./materials.js";
import { createDistrict } from "./district.js";
import { SHOPS } from "../state.js";

const base = import.meta.env.BASE_URL;
const vendor = (file) => `${base}models/vendor/kaykit/${file}.glb`;
const original = (file) => `${base}models/original/${file}.glb`;

// Sizes are visual envelopes in world metres. Existing collision dimensions,
// NPC identifiers, saved positions and Rapier bodies remain authoritative.
export const MODEL_MANIFEST = {
  hero: { url: original("merch-hero"), size: [1.3, 2.44, 0.9] },
  staff: { url: original("store-staff"), size: [1.3, 2.44, 0.9] },
  cart: { url: original("shopping-cart"), size: [1.2, 1.62, 1.75] },
  hatchback: { url: vendor("car_hatchback"), size: [2.5, 2.2, 4.6] },
  sedan: { url: vendor("car_sedan"), size: [2.5, 2.2, 4.6] },
  police: { url: vendor("car_police"), size: [2.5, 2.3, 4.6] },
  bench: { url: vendor("bench"), size: [2.4, 0.8, 1] },
  bush: { url: vendor("bush"), size: [1.7, 1.7, 1.7] },
  streetlight: { url: vendor("streetlight"), size: [2, 7, 0.6] },
  dumpster: { url: vendor("dumpster"), size: [2.2, 1.3, 1.5] },
  box: { url: vendor("box_A"), size: [0.7, 0.65, 0.72] },
  buildingA: { url: vendor("building_A_withoutBase"), size: [16, 21, 18] },
  buildingC: { url: vendor("building_C_withoutBase"), size: [16, 26, 18] },
  trees: {
    url: `${base}models/vendor/kenney/grass-trees-tall.glb`,
    size: [10, 7, 10],
  },
};

function discardPrimitiveChildren(group) {
  const geometries = new Set(), materials = new Set();
  // Called only on the privately constructed human/cart/car meshes, not the
  // shared city boxes or GLB clones. This happens before their first render.
  for (const child of [...group.children]) {
    child.traverse((node) => {
      if (!node.isMesh) return;
      geometries.add(node.geometry);
      for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
        materials.add(material);
      }
    });
    group.remove(child);
  }
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
}

function modelBounds(model) {
  const bounds = new Box3().setFromObject(model);
  return {
    size: bounds.getSize(new Vector3()).toArray().map((n) => +n.toFixed(3)),
    minY: +bounds.min.y.toFixed(3),
  };
}

export async function createVisuals(scene, world, firstShopDecor) {
  const library = new AssetLibrary(MODEL_MANIFEST);
  await library.preload();
  const materials = createDistrictMaterials();
  const replacements = [];

  function replace(entity, id, animate = false, groundOffset = 0) {
    const model = library.instantiate(id);
    if (!model) return; // Original visual and its working animation stay intact.
    const limbs = animate && ["LeftLeg", "RightLeg", "LeftArm", "RightArm"]
      .map((name) => model.getObjectByName(name));
    if (animate && limbs.some((node) => !node)) {
      console.warn(`[visuals] ${id}: missing animation pivots; keeping fallback.`);
      library.release(model);
      return;
    }
    const bounds = modelBounds(model);
    model.position.y = groundOffset;
    discardPrimitiveChildren(entity.mesh);
    entity.mesh.add(model);
    if (animate) {
      entity.legs = limbs.slice(0, 2);
      entity.arms = limbs.slice(2);
    }
    replacements.push({ entity: id, ...bounds });
  }

  // The pilot district is deliberately limited to shop 01. The same adapter
  // can later be invoked per shop after that location passes its own checks.
  replace(world.player, "hero", true);
  replace(world.people.find((n) => n.kind === "staff" && n.shop === 0), "staff", true);
  replace(world.vehicles[0], "hatchback");
  const neighbours = world.people.filter((person) =>
    person.kind === "civilian" &&
    Math.hypot(person.home.x - SHOPS[0].x, person.home.z - SHOPS[0].z) < 32,
  );
  neighbours.forEach((person, index) => replace(person, index % 2 ? "hero" : "staff", true));
  // The existing cart collider bottom is local Y=0.05; match that resting
  // plane without changing the rigid body's placement or collision response.
  for (const cart of world.carts.filter((c) => c.shop === 0)) replace(cart, "cart", false, 0.05);

  const district = createDistrict(scene, {
    library, materials, box: world.box, shop: SHOPS[0],
  });
  for (const mesh of firstShopDecor) mesh.visible = false;
  let disposed = false;
  return {
    update(dt, time) { district.update?.(dt, time); },
    setQuality(quality) { district.setQuality?.(quality); },
    get diagnostics() {
      return {
        district: "01 / У дома",
        assets: { ...library.metrics },
        replacements: replacements.map((entry) => ({ ...entry, size: [...entry.size] })),
        districtMetrics: { ...district.metrics },
      };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      district.dispose();
      library.dispose();
      materials.dispose();
    },
  };
}
