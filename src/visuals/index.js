import { Box3, Vector3, Group, Mesh } from "three";
import { AssetLibrary } from "./assets.js";
import { createDistrictMaterials } from "./materials.js";
import { createDistrict } from "./district.js";
import { SHOPS } from "../state.js";
import { createCharacterMotion } from "./character-motion.js";

const base = import.meta.env.BASE_URL;
const vendor = (file) => `${base}models/vendor/kaykit/${file}.glb`;
// The articulated rig must not reuse a browser-cached, older rigid GLB after
// a Pages update. Keep the version tied to the authored rig contract.
const original = (file) => `${base}models/original/${file}.glb?rig=2`;

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
  const actors = [];

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
      entity.motion = createCharacterMotion(entity, model);
      actors.push({ entity, last: entity.mesh.position.clone(), velocity: new Vector3() });
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
  // First person renders the same animated arm meshes at their exact world
  // transforms. The full avatar remains hidden, so its head/chest cannot fill
  // the camera. Geometry/materials stay owned by the model library.
  const firstPersonArms = new Group();
  firstPersonArms.name = "first-person-arms";
  firstPersonArms.visible = false;
  scene.add(firstPersonArms);
  const armCopies = [];
  for (const arm of world.player.arms) arm.traverse((source) => {
    if (!source.isMesh) return;
    const mesh = new Mesh(source.geometry, source.material);
    mesh.matrixAutoUpdate = false;
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    firstPersonArms.add(mesh);
    armCopies.push({ source, mesh });
  });
  const wheelNames = ["FrontLeft", "FrontRight", "RearLeft", "RearRight"];
  const rollingCarts = world.carts.map((cart) => ({
    cart,
    wheels: wheelNames.map((name) => {
      const wheel = cart.mesh.getObjectByName(`Wheel${name}`);
      return wheel ? {
        wheel, caster: cart.mesh.getObjectByName(`Caster${name}`),
        last: wheel.getWorldPosition(new Vector3()), current: new Vector3(),
      } : null;
    }).filter(Boolean),
  }));
  let controls = { active: false, heldCart: null };

  const district = createDistrict(scene, {
    library, materials, box: world.box, shop: SHOPS[0],
  });
  for (const mesh of firstShopDecor) mesh.visible = false;
  let disposed = false;
  return {
    update(dt, time, input = {}) {
      controls = input;
      district.update?.(dt, time);
      for (const { cart, wheels } of rollingCarts) {
        cart.mesh.updateMatrixWorld(true);
        for (const item of wheels) {
          item.wheel.getWorldPosition(item.current);
          const dx = item.current.x - item.last.x, dz = item.current.z - item.last.z;
          const distance = Math.hypot(dx, dz);
          if (input.active && distance > 0.0001 && distance < 2) {
            const heading = cart.mesh.rotation.y;
            const side = Math.cos(heading) * dx - Math.sin(heading) * dz;
            const forward = Math.sin(heading) * dx + Math.cos(heading) * dz;
            if (item.caster) {
              const target = Math.atan2(side, Math.abs(forward) + 0.0001);
              const turn = Math.atan2(Math.sin(target - item.caster.rotation.y), Math.cos(target - item.caster.rotation.y));
              item.caster.rotation.y += turn * (1 - Math.exp(-dt * 16));
            }
            item.wheel.rotation.x = (item.wheel.rotation.x + Math.sign(forward || 1) * distance / 0.1495) % (Math.PI * 2);
          }
          item.last.copy(item.current);
        }
      }
      for (const actor of actors) {
        const { entity, last, velocity } = actor;
        velocity.copy(entity.mesh.position).sub(last);
        const teleported = velocity.length() > 2;
        last.copy(entity.mesh.position);
        if (!input.active) continue; // Menus freeze the pose as well as physics.
        if (teleported || (entity === world.player && input.inVehicle)) velocity.set(0, 0, 0);
        else velocity.multiplyScalar(1 / Math.max(dt, 0.001));
        const isPlayer = entity === world.player;
        entity.motion.update(dt, {
          ...(isPlayer ? input : { active: entity.stun <= 0, grounded: true, crouch: false, attack: 0, guard: false }),
          active: isPlayer ? !input.inVehicle : entity.stun <= 0,
          velocity, facing: entity.mesh.rotation.y,
          heldCart: isPlayer ? input.heldCart : null,
        });
      }
      if (firstPersonArms.visible) {
        world.player.mesh.updateMatrixWorld(true);
        for (const { source, mesh } of armCopies) {
          mesh.matrix.copy(source.matrixWorld);
          mesh.matrixWorldNeedsUpdate = true;
        }
      }
    },
    setFirstPerson(enabled) { firstPersonArms.visible = enabled; },
    get firstPersonHandsVisible() { return firstPersonArms.visible && armCopies.length > 0; },
    setQuality(quality) { district.setQuality?.(quality); },
    get diagnostics() {
      return {
        district: "01 / У дома",
        assets: { ...library.metrics },
        replacements: replacements.map((entry) => ({ ...entry, size: [...entry.size] })),
        districtMetrics: { ...district.metrics },
      };
    },
    get motionDiagnostics() {
      return {
        player: world.player.motion ? { ...world.player.motion.diagnostics, heading: world.player.mesh.rotation.y } : null,
        heldCartId: world.carts.find((cart) => cart.mesh === controls.heldCart)?.id ?? null,
        carts: rollingCarts.filter(({ cart, wheels }) => cart.shop === 0 || (wheels.length && cart.mesh === controls.heldCart)).map(({ cart, wheels }) => ({
          id: cart.id, position: cart.mesh.position.toArray(), heading: cart.mesh.rotation.y,
          wheelAngles: wheels.map(({ wheel }) => wheel.rotation.x),
        })),
      };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      firstPersonArms.removeFromParent();
      district.dispose();
      library.dispose();
      materials.dispose();
    },
  };
}
