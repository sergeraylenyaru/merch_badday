import { Box3, Vector3, Group, Mesh, SkinnedMesh, Float32BufferAttribute,BoxGeometry,MeshStandardMaterial } from "three";
import { AssetLibrary } from "./assets.js";
import { createDistrictMaterials } from "./materials.js";
import { createDistrict } from "./district.js";
import { SHOPS } from "../state.js";
import { createCharacterMotion } from "./character-motion.js";
import { SHOP_STYLES } from "./shop-styles.js";
import { PLAYER_SHAPE } from "../spatial.js";

const base = import.meta.env.BASE_URL;
const vendor = (file) => `${base}models/vendor/kaykit/${file}.glb`;
// The articulated rig must not reuse a browser-cached, older rigid GLB after
// a Pages update. Keep the version tied to the authored rig contract.
const original = (file) => `${base}models/original/${file}.glb?rig=2`;

// Envelopes fit local models. Cars feed their measured body footprint back to
// the world; entity identities, saved positions and physical bodies stay intact.
export const MODEL_MANIFEST = {
  hero: { url: `${base}models/characters/merch-male.glb?rig=6`, size: [1.3, 2.1, 0.9] },
  staff: { url: `${base}models/characters/civilian-female.glb?rig=4`, size: [1.3, 2.1, 0.9] },
  officer: {url: `${base}models/characters/police-officer.glb?rig=2`,size:[1.3,2.1,.9]},
  stocky:{url:`${base}models/characters/civilian-stocky.glb?rig=1`,size:[1.6,1.95,1]},
  short:{url:`${base}models/characters/civilian-short.glb?rig=1`,size:[1.15,1.65,.85]},
  tall:{url:`${base}models/characters/civilian-tall.glb?rig=1`,size:[1.2,2.35,.9]},
  elder:{url:`${base}models/characters/civilian-elder.glb?rig=1`,size:[1.2,1.8,.9]},
  bandit:{url:`${base}models/characters/civilian-bandit.glb?rig=1`,size:[1.3,2.05,.9]},
  cart: { url: original("shopping-cart"), size: [1.2, 1.62, 1.75] },
  hatchback: { url: vendor("car_hatchback"), size: [2.5, 2.2, 4.6] },
  sedan: { url: vendor("car_sedan"), size: [2.5, 2.2, 4.6] },
  police: { url: vendor("car_police"), size: [2.5, 2.3, 4.6] },
  suv: { url: `${base}models/vehicles/suv.glb`, size: [2.5, 2.4, 4.6] },
  van: { url: `${base}models/vehicles/van.glb`, size: [2.5, 2.8, 5.8] },
  truck: { url: `${base}models/vehicles/truck.glb`, size: [3, 3.7, 6.8] },
  taxi: {url:`${base}models/vehicles/suv.glb`,size:[2.5,2.4,4.6]},
  bus: {url:`${base}models/vehicles/bus.glb?rig=1`,size:[2.7,3.4,8.5]},
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

export async function createVisuals(scene, world, shopDecor) {
  const library = new AssetLibrary(MODEL_MANIFEST);
  await library.preload();
  const materials = createDistrictMaterials();
  const replacements = [];
  const actors = [];
  const actorMaterials = new Set();
  const vehicleGeometries=new Set();

  function replace(entity, id, animate = false, groundOffset = 0) {
    const model = library.instantiate(id, animate ? { height: MODEL_MANIFEST[id]?.size[1]??PLAYER_SHAPE.height } : {});
    if (!model) return; // Original visual and its working animation stay intact.
    const limbs = animate && ["LeftLeg", "RightLeg", "LeftArm", "RightArm"]
      .map((name) => model.getObjectByName(name));
    if (animate && limbs.some((node) => !node)) {
      console.warn(`[visuals] ${id}: missing animation pivots; keeping fallback.`);
      library.release(model);
      return;
    }
    const bounds = modelBounds(model);
    if (entity.visualModel) {
      // Collision and door reach follow the normalized visible body, including
      // each variant's length; a van no longer carries a generic large circle.
      entity.w = bounds.size[0] / 2;
      entity.l = bounds.size[2] / 2;
      entity.h = bounds.size[1];
      model.traverse((node) => {
        if (node.userData.wheelRadius) entity.wheelRadius = node.userData.wheelRadius * node.getWorldScale(new Vector3()).x;
      });
    }
    model.position.y = groundOffset;
    if (entity.light) entity.light.removeFromParent();
    discardPrimitiveChildren(entity.mesh);
    entity.mesh.add(model);
    if (entity.light) entity.mesh.add(entity.light);
    if (animate) {
      if (entity !== world.player) {
        model.traverse((node) => {
          if (node.name.startsWith('Backpack')) node.visible = false;
          if (!node.isMesh) return;
          const recolor = (source) => {
            if (!['Merch_BlueTShirt', 'Civilian_TealShirt'].includes(source.name)) return source;
            const material = source.clone();
            material.color.set(entity.kind === 'police' ? '#344663' : entity.shop >= 0 ? SHOP_STYLES[entity.shop].primary : ['#577986', '#8d6556', '#73885f'][actors.length % 3]);
            actorMaterials.add(material);
            return material;
          };
          node.material = Array.isArray(node.material) ? node.material.map(recolor) : recolor(node.material);
        });
      }
      entity.legs = limbs.slice(0, 2);
      entity.arms = limbs.slice(2);
      entity.motion = createCharacterMotion(entity, model);
      actors.push({ entity, last: entity.mesh.position.clone(), velocity: new Vector3() });
    }
    replacements.push({ entity: id, kind: entity.kind ?? (entity.body ? 'cart' : 'vehicle'), shop: entity.shop ?? -1, id: entity.id ?? null, ...bounds });
  }

  replace(world.player, "hero", true);
  world.people.forEach((person, index) => {
    const female = person.role === 'elder' || (person.kind === 'staff' ? [0, 2, 6, 8].includes(person.shop) : person.kind !== 'police' && index % 2 === 0);
    const profile=person.kind==='guard'?'tall':person.kind==='civilian'?['stocky','short','tall','elder','bandit','staff','hero'][index%7]:person.kind==='resident'?'elder':null;
    person.personType=profile??(female?'staff':'hero');
    replace(person, person.kind==='police' ? 'officer' : profile??(female?'staff':'hero'), true);
  });
  for (const vehicle of world.vehicles){replace(vehicle, vehicle.police ? 'police' : vehicle.visualModel);
    if(vehicle.visualModel==='taxi'){
      vehicle.mesh.traverse(n=>{if(n.isMesh&&n.material.name==='Vehicle_Paint'){n.material=n.material.clone();n.material.color.set('#e6bd35');actorMaterials.add(n.material);}});
      const black=new MeshStandardMaterial({color:'#202d2c'}),yellow=new MeshStandardMaterial({color:'#f1cf5c'});actorMaterials.add(black);actorMaterials.add(yellow);
      for(const [w,h,d,x,y,z,material]of [[.7,.22,.3,0,vehicle.h+.13,0,yellow],...[-1,1].flatMap(side=>Array.from({length:5},(_,i)=>[.035,.14,.2,side*(vehicle.w+.02),1.1,-.5+i*.2,i%2?black:yellow]))]){const g=new BoxGeometry(w,h,d);vehicleGeometries.add(g);const mesh=new Mesh(g,material);mesh.position.set(x,y,z);vehicle.mesh.add(mesh);}
    }
  }
  // The existing cart collider bottom is local Y=0.05; match that resting
  // plane without changing the rigid body's placement or collision response.
  for (const cart of world.carts) replace(cart, "cart", false, 0);
  // First person renders the same animated arm meshes at their exact world
  // transforms. The full avatar remains hidden, so its head/chest cannot fill
  // the camera. Shared source resources belong to the library; masked arm
  // geometry and material copies are owned and disposed by this adapter.
  const firstPersonArms = new Group();
  firstPersonArms.name = "first-person-arms";
  firstPersonArms.visible = false;
  scene.add(firstPersonArms);
  const armCopies = [];
  const armGeometries = new Set(), armMaterials = new Map();
  function armMaterial(source) {
    if (armMaterials.has(source)) return armMaterials.get(source);
    const material = source.clone();
    material.onBeforeCompile = (shader) => {
      shader.vertexShader = 'attribute float armMask; varying float vArmMask;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvArmMask = armMask;');
      shader.fragmentShader = 'varying float vArmMask;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif (vArmMask < 0.5) discard;');
    };
    material.customProgramCacheKey = () => 'first-person-skinned-arms-v1';
    armMaterials.set(source, material);
    return material;
  }
  const skinnedSources = [];
  world.player.mesh.traverse((source) => { if (source.isSkinnedMesh) skinnedSources.push(source); });
  for (const source of skinnedSources) {
    const armBones = new Set();
    source.skeleton.bones.forEach((bone, index) => {
      for (let node = bone; node; node = node.parent) if (node.name === 'LeftArm' || node.name === 'RightArm') {
        armBones.add(index); break;
      }
    });
    const indices = source.geometry.getAttribute('skinIndex'), weights = source.geometry.getAttribute('skinWeight');
    const mask = new Float32Array(indices.count), access = ['getX', 'getY', 'getZ', 'getW'];
    let hasArms = false;
    for (let vertex = 0; vertex < indices.count; vertex++) {
      for (let component = 0; component < 4; component++) if (armBones.has(indices[access[component]](vertex))) mask[vertex] += weights[access[component]](vertex);
      if (mask[vertex] > 0.5) hasArms = true;
    }
    if (!hasArms) continue;
    const geometry = source.geometry.clone();
    geometry.setAttribute('armMask', new Float32BufferAttribute(mask, 1));
    armGeometries.add(geometry);
    const materials = Array.isArray(source.material) ? source.material.map(armMaterial) : armMaterial(source.material);
    const mesh = new SkinnedMesh(geometry, materials);
    mesh.bindMode = source.bindMode;
    mesh.bind(source.skeleton, source.bindMatrix);
    mesh.matrixAutoUpdate = false;
    mesh.receiveShadow = true;
    firstPersonArms.add(mesh);
    armCopies.push({ source, mesh });
  }
  if (!skinnedSources.length) for (const arm of world.player.arms) arm.traverse((source) => {
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

  const districts = SHOPS.map((shop) => createDistrict(scene, {
    props:world.props,
    library, materials: materials.forShop(SHOP_STYLES[shop.id]), box: world.box, shop, shopState: world.state.shops[shop.id],
  }));
  for (const meshes of shopDecor) for (const mesh of meshes) mesh.visible = false;
  const rollingVehicles = world.vehicles.map((vehicle) => {
    const wheels = [], steering = [], doors = [];
    vehicle.mesh.traverse((node) => {
      if (/^VehicleWheel(?:Front|Rear|Back)(?:Left|Right)$/.test(node.name)) wheels.push(node);
      if (/^VehicleSteerFront(?:Left|Right)$/.test(node.name)) steering.push(node);
      if (node.name === 'DoorLeft' || node.name === 'DoorRight') doors.push(node);
    });
    return { vehicle, wheels, steering, doors, last: vehicle.mesh.position.clone() };
  });
  let disposed = false;
  return {
    update(dt, time, input = {}) {
      controls = input;
      for (const district of districts) {
        district.root.visible = district.root.position.distanceTo(world.player.mesh.position) < 115;
        district.update?.(dt, time);
      }
      for (const { vehicle, wheels, steering, doors, last } of rollingVehicles) {
        const dx = vehicle.mesh.position.x - last.x, dz = vehicle.mesh.position.z - last.z;
        const distance = Math.hypot(dx, dz);
        if (input.active && distance < 2) {
          const forward = Math.sin(vehicle.heading) * dx + Math.cos(vehicle.heading) * dz;
          for (const wheel of wheels) wheel.rotation.x += Math.sign(forward || 1) * distance / (vehicle.wheelRadius || 0.43);
          for (const pivot of steering) pivot.rotation.y = Math.atan2(Math.cos(vehicle.heading) * dx - Math.sin(vehicle.heading) * dz, Math.abs(forward) + 0.001) * 0.4;
          vehicle.doorAnimation = Math.max(0, (vehicle.doorAnimation || 0) - dt * 1.8);
          for (const door of doors) door.rotation.y = (door.name === 'DoorLeft' ? -1 : 1) * Math.sin((vehicle.doorAnimation || 0) * Math.PI) * 0.8;
        }
        last.copy(vehicle.mesh.position);
      }
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
        if(entity!==world.player&&!entity.mesh.visible)continue;
        if(entity.dead)continue;
        velocity.copy(entity.mesh.position).sub(last);
        const teleported = velocity.length() > 2;
        last.copy(entity.mesh.position);
        if (!input.active) continue; // Menus freeze the pose as well as physics.
        if (teleported || (entity === world.player && input.inVehicle)) velocity.set(0, 0, 0);
        else velocity.multiplyScalar(1 / Math.max(dt, 0.001));
        const isPlayer = entity === world.player;
        if (input.active === false) continue;
        let animationDt=dt;if(!isPlayer&&entity.mesh.position.distanceToSquared(world.player.mesh.position)>75*75){actor.farElapsed=(actor.farElapsed??0)+dt;if(actor.farElapsed<.12)continue;animationDt=actor.farElapsed;actor.farElapsed=0;}
        entity.motion.update(animationDt, {
          ...(isPlayer ? input : { active: entity.stun <= 0, grounded: !entity.climb,climb:entity.climb??null,fists:entity.kind==='police'&&!entity.weapon, crouch: false, attack: entity.attack??0, attackKind:entity.attackKind??'quick', guard: false,
            staff: entity.kind === 'staff', social: entity.social, activity: entity.activity, lookAt: entity.lookAt }),
          active: isPlayer ? !input.inVehicle : entity.stun <= 0,
          velocity, facing: entity.mesh.rotation.y,
          heldCart: isPlayer ? input.heldCart : null,
          weaponRig:entity.weaponRig?.root.visible?entity.weaponRig:null,
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
    setQuality(quality) { for (const district of districts) district.setQuality?.(quality); },
    get diagnostics() {
      return {
        district: "01 / У дома",
        assets: { ...library.metrics },
        replacements: replacements.map((entry) => ({ ...entry, size: [...entry.size] })),
        districtMetrics: { ...districts[0].metrics },
        districts: districts.map((district) => ({ ...district.metrics, visible: district.root.visible })),
        cabinet: districts[3].lampState,
      };
    },
    get motionDiagnostics() {
      return {
        player: world.player.motion ? { ...world.player.motion.diagnostics, heading: world.player.mesh.rotation.y } : null,
        heldCartId: world.carts.find((cart) => cart.mesh === controls.heldCart)?.id ?? null,
        carts: rollingCarts.map(({ cart, wheels }) => ({
          id: cart.id, position: cart.mesh.position.toArray(), heading: cart.mesh.rotation.y,
          wheelAngles: wheels.map(({ wheel }) => wheel.rotation.x),
        })),
        vehicles: rollingVehicles.map(({ vehicle, wheels, doors }) => ({
          id: vehicle.id, wheelAngles: wheels.map((wheel) => wheel.rotation.x),
          doorAngles: doors.map((door) => door.rotation.y),
        })),
      };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const { entity } of actors) entity.motion.dispose?.();
      firstPersonArms.removeFromParent();
      for (const geometry of armGeometries) geometry.dispose();
      for (const material of armMaterials.values()) material.dispose();
      for (const district of districts) district.dispose();
      for (const material of actorMaterials) material.dispose();
      vehicleGeometries.forEach(g=>g.dispose());
      library.dispose();
      materials.dispose();
    },
  };
}
