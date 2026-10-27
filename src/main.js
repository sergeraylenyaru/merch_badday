import * as T from "three";
import "@fontsource/manrope/cyrillic-400.css";
import "@fontsource/manrope/cyrillic-700.css";
import "@fontsource/oswald/cyrillic-500.css";
import "@fontsource/manrope/latin-400.css";
import "@fontsource/oswald/latin-500.css";
import "./style.css";
import {
  SHOPS,
  load,
  save,
  freshState,
  complete,
  canComplete,
  normalize,
  finish,
} from "./state.js";
import { createWorld } from "./world.js";
import { createUI } from "./ui.js";
import { createAtmosphere } from "./visuals/atmosphere.js";
import { createPointerCapture } from "./input/pointer-capture.js";
import { PLAYER_SHAPE, nearestBoardableVehicle, vehicleDoor, circleIntersectsBox, boxesIntersect, vehicleBox } from "./spatial.js";
const state = load();
let settings = { sensitivity: 1, volume: 0.25, quality: "high" };
try {
  settings = {
    ...settings,
    ...JSON.parse(localStorage.getItem("merch-settings") || "{}"),
  };
} catch {}
let world,
  renderer,
  scene,
  camera,
  atmosphere,
  mouseCapture,
  ui,
  mode = "intro",
  vehicle = null,
  held = null,
  cargo = null,
  yaw = 0.25,
  pitch = 0.15,
  firstPerson = false,
  jump = 0,
  vertical = 0,
  attack = 0,
  attackKind = "quick",
  lastCrime = -100,
  arrest = 0,
  accumulator = 0,
  lastSave = 0,
  lastMessage = 0,
  lastEvent = 0,
  stressEvent = false,
  hasStarted = false,
  resetting = false,
  audio = null;
const keys = new Set(),
  clock = new T.Clock();
let visualTime = 0,
  slowFrames = 0;
const v3 = new T.Vector3();
const walkingVelocity = new T.Vector3();
const cameraRay = new T.Ray(), cameraBounds = new T.Box3(), cameraHit = new T.Vector3(), cameraDelta = new T.Vector3();
function notify(t) {
  ui.toast(t);
}
function message(t) {
  state.messages.push(t);
  state.messages = state.messages.slice(-40);
  notify(t);
}
function findVehicleExit(v) {
  const candidates = [vehicleDoor(v, -1), vehicleDoor(v, 1)];
  for (const sign of [-1, 1]) candidates.push({
    x: v.mesh.position.x + Math.sin(v.heading) * sign * (v.l + 0.65),
    z: v.mesh.position.z + Math.cos(v.heading) * sign * (v.l + 0.65),
  });
  return candidates.find((p) => !world.blocked(p.x, p.z));
}
function avoidCameraCollision(origin, desired) {
  cameraDelta.copy(desired).sub(origin);
  let distance = cameraDelta.length();
  if (distance < 0.001) return;
  cameraDelta.multiplyScalar(1 / distance);
  cameraRay.set(origin, cameraDelta);
  for (const box of world.blockers) {
    cameraBounds.min.set(box.x - box.w, box.y - box.h / 2, box.z - box.d);
    cameraBounds.max.set(box.x + box.w, box.y + box.h / 2, box.z + box.d);
    if (cameraRay.intersectBox(cameraBounds, cameraHit)) distance = Math.min(distance, Math.max(0.1, origin.distanceTo(cameraHit) - 0.14));
  }
  desired.copy(origin).addScaledVector(cameraDelta, distance);
}
function snapshot() {
  if (!world || resetting) return;
  state.position = {
    x: world.player.mesh.position.x,
    z: world.player.mesh.position.z,
  };
  state.carts = world.carts.map((c) => {
    const p =
      c === cargo && vehicle
        ? { x: vehicle.mesh.position.x - 5, z: vehicle.mesh.position.z + 5 }
        : c.body.translation();
    return { x: p.x, z: p.z, heading: c.mesh.rotation.y };
  });
  state.vehicles = world.vehicles.map((v) => ({
    x: v.mesh.position.x,
    z: v.mesh.position.z,
    heading: v.heading,
    claimed: !!v.claimed,
  }));
  let savedPosition = state.position;
  if (vehicle) {
    const exit = findVehicleExit(vehicle);
    if (exit) savedPosition = exit;
  }
  try {
    save({ ...state, position: savedPosition });
  } catch {
    notify("Сохранение недоступно: разрешите localStorage в браузере.");
  }
}
function unlock() {
  mouseCapture?.release();
  keys.clear();
  walkingVelocity.set(0, 0, 0);
}
function open(next) {
  if (mode === "end") return;
  mode = next;
  unlock();
  snapshot();
}
function resume() {
  if (state.ending) {
    mode = "end";
    ui.ending();
    return;
  }
  hasStarted = true;
  mode = "play";
  ui.clear();
  initAudio();
  mouseCapture?.capture();
}
function crime(amount = 1) {
  state.wanted = Math.min(5, Math.max(state.wanted, amount) + 0.35);
  state.reputation -= 3;
  state.stress += 5;
  lastCrime = state.time;
  normalize(state);
}
function initAudio() {
  if (audio) return;
  try {
    audio = new AudioContext();
  } catch {}
}
function beep(freq = 440, duration = 0.08) {
  if (!audio || settings.volume === 0) return;
  const osc = audio.createOscillator(),
    gain = audio.createGain();
  osc.connect(gain);
  gain.connect(audio.destination);
  osc.type = "triangle";
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(settings.volume * 0.12, audio.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duration);
  osc.start();
  osc.stop(audio.currentTime + duration);
}
function configure(name, value) {
  settings[name] = value;
  try {
    localStorage.setItem("merch-settings", JSON.stringify(settings));
  } catch {}
  applyQuality();
}
function applyQuality() {
  if (!renderer) return;
  renderer.setPixelRatio(
    settings.quality === "high" ? Math.min(devicePixelRatio, 1.6) : 0.85,
  );
  renderer.shadowMap.enabled = settings.quality === "high";
  atmosphere?.setQuality(settings.quality);
  world?.visuals?.setQuality?.(settings.quality);
}
function end(quit = false) {
  finish(state, quit);
  snapshot();
  mode = "end";
  unlock();
  ui.ending();
}
function restart() {
  // pagehide also saves. Do not let that handler restore the shift being reset.
  resetting = true;
  localStorage.removeItem("merch-badday-v1");
  location.reload();
}
function nearestShop() {
  const pos = world.player.mesh.position;
  return SHOPS.reduce((a, b) =>
    Math.hypot(b.x - pos.x, b.z - pos.z) < Math.hypot(a.x - pos.x, a.z - pos.z)
      ? b
      : a,
  );
}
function talk(shop, choice) {
  const p = state.shops[shop.id];
  if (p.done) {
    notify("Визит уже подтверждён.");
    resume();
    return;
  }
  if (choice === "badge") {
    p.badge = true;
    p.rep += 2;
    state.reputation += 1;
    notify("Бейдж принят. «Ладно, работайте. Я здесь».");
  }
  if (choice === "bargain") {
    if (state.money < 100) {
      notify("Для переговоров нужно 100 ₽.");
      return;
    }
    state.money -= 100;
    p[shop.task] = true;
    p.rep -= 2;
    notify(
      "Сотрудник помог с дополнительной задачей. Тележки всё равно нужно собрать.",
    );
  }
  if (choice === "rude") {
    p.rep -= 10;
    state.reputation -= 5;
    state.stress += 12;
    crime(1);
    message(`${shop.name}: жалоба на грубость. Охрана предупреждена.`);
  }
  if (choice === "polite") {
    if (canComplete(state, shop.id)) {
      complete(state, shop.id);
      message(`${shop.name}: визит подтверждён. +200 ₽, +100 ₽ к премии.`);
      beep(700, 0.2);
      if (state.ending) {
        end();
        return;
      }
      const next = state.shops.findIndex((x) => !x.done);
      if (next >= 0) state.selected = next;
    } else {
      const missing = [];
      if (p.carts < shop.required)
        missing.push(`тележки ${p.carts}/${shop.required}`);
      if (!p[shop.task])
        missing.push(
          {
            badge: "покажите бейдж",
            shelf: "исправьте выкладку справа",
            photo: "нужен фотоотчёт из телефона",
          }[shop.task],
        );
      notify(`Сначала: ${missing.join("; ")}.`);
      state.stress += 2;
    }
  }
  normalize(state);
  snapshot();
  resume();
}
function arrange(shop, order) {
  if (order.every((v, i) => v === i)) {
    state.shops[shop.id].shelf = true;
    state.bonus += 30;
    state.stress -= 4;
    normalize(state);
    notify("Планограмма соблюдена! +30 ₽ к премии.");
    snapshot();
    resume();
  } else ui.shelf(shop, order);
}
function photo() {
  const shop = nearestShop(),
    zone = world.zones[shop.id],
    pos = world.player.mesh.position;
  if (
    Math.hypot(pos.x - zone.x, pos.z - zone.z) > 13 ||
    state.shops[shop.id].carts < shop.required
  ) {
    notify("Фото не принято: встаньте у зоны и соберите все тележки.");
    return;
  }
  state.shops[shop.id].photo = true;
  renderer.render(scene, camera);
  const img = document.createElement("img");
  img.className = "photo";
  img.alt = `Фотоотчёт: ${shop.name}`;
  img.src = renderer.domElement.toDataURL("image/png");
  ui.$("photoResult").replaceChildren(img);
  notify(`Фотоотчёт «${shop.name}» принят.`);
  beep(900);
  snapshot();
}
function energy() {
  if (state.money < 70) {
    notify("Недостаточно денег.");
    return;
  }
  state.money -= 70;
  state.energy = 45;
  state.stress -= 5;
  normalize(state);
  notify("Энергетик: быстрый бег на 45 секунд. Потом придёт стресс.");
  ui.phone("Показатели");
}
try {
  scene = new T.Scene();
  camera = new T.PerspectiveCamera(58, innerWidth / innerHeight, 0.1, 350);
  renderer = new T.WebGLRenderer({
    antialias: true,
    preserveDrawingBuffer: true,
  });
  renderer.setSize(innerWidth, innerHeight);
  renderer.domElement.className = "scene";
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  document.getElementById("game").append(renderer.domElement);
  mouseCapture = createPointerCapture(renderer.domElement, {
    onChange: (captured) => document.body.classList.toggle("mouse-captured", captured && mode === "play"),
    onLost: () => {
      if (mode === "play") { open("pause"); ui.pause(); }
    },
    onDenied: () => {
      if (mode === "play") {
        open("pause"); ui.pause();
        notify("Нажмите «Продолжить», чтобы включить управление мышью.");
      }
    },
  });
  atmosphere = createAtmosphere(scene, renderer);
  applyQuality();
  ui = createUI(state, {
    settings,
    resume,
    configure,
    finish: () => end(),
    quit: () => end(true),
    restart,
    talk,
    arrange,
    photo,
    energy,
  });
  world = await createWorld(scene, state);
  world.visuals?.setQuality?.(settings.quality);
  world.player.mesh.rotation.y = yaw + Math.PI;
  ui.$("loading").remove();
  // Gameplay uses fixed-step Rapier for movable carts and collision queries for characters.
  const playerBody = world.physics.createRigidBody(
    world.RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(
      state.position.x,
      world.groundHeight(state.position.x, state.position.z) + PLAYER_SHAPE.height / 2,
      state.position.z,
    ),
  );
  world.physics.createCollider(
    world.RAPIER.ColliderDesc.capsule(PLAYER_SHAPE.height / 2 - PLAYER_SHAPE.radius, PLAYER_SHAPE.radius),
    playerBody,
  );
  const rainPoints = new Float32Array(750 * 3);
  for (let i = 0; i < 750; i++) {
    rainPoints[i * 3] = Math.random() * 80 - 40;
    rainPoints[i * 3 + 1] = Math.random() * 30;
    rainPoints[i * 3 + 2] = Math.random() * 80 - 40;
  }
  const rainGeo = new T.BufferGeometry();
  rainGeo.setAttribute("position", new T.BufferAttribute(rainPoints, 3));
  const rain = new T.Points(
    rainGeo,
    new T.PointsMaterial({
      color: "#d1e0d0",
      size: 0.09,
      transparent: true,
      opacity: 0.65,
    }),
  );
  scene.add(rain);
  const marker = new T.Mesh(
    new T.ConeGeometry(1.1, 2, 4),
    new T.MeshStandardMaterial({
      color: "#f2c773",
      emissive: "#8b6228",
      emissiveIntensity: 0.4,
    }),
  );
  scene.add(marker);
  function dist(obj) {
    const player = world.player.mesh.position;
    // Shelves expose an approach point in the aisle. Their raised marker is
    // decoration, not a 3D distance penalty on top of the interaction range.
    return Math.hypot((obj.x ?? obj.mesh.position.x) - player.x, (obj.z ?? obj.mesh.position.z) - player.z);
  }
  function nearest(list, max) {
    let best = null,
      bd = max;
    for (const n of list) {
      const d = dist(n);
      if (d < bd) {
        best = n;
        bd = d;
      }
    }
    return best;
  }
  function context() {
    if (vehicle)
      return cargo
        ? "R · Выгрузить тележку   E · Выйти"
        : "E · Выйти   R · Загрузить тележку (фургон / грузовик)";
    if (held) return "R · Отпустить тележку в жёлтой зоне";
    const s = nearest(
      world.shelves.filter(
        (s) => !state.shops[s.shop].shelf && SHOPS[s.shop].task === "shelf",
      ),
      4,
    );
    if (s) return "E · Исправить выкладку";
    const npc = nearest(
      world.people.filter((n) => n.kind === "staff"),
      3.5,
    );
    if (npc) return `E · ${SHOPS[npc.shop].npc}`;
    const pos = world.player.mesh.position;
    const coffee = SHOPS.find(
      (s) => Math.hypot(pos.x - s.x - 17, pos.z - s.z - 4) < 3,
    );
    if (coffee) return "E · Кофе и аптечка · 40 ₽";
    const cart = nearest(
      world.carts.filter((c) => !c.delivered),
      3,
    );
    if (cart) return "R · Взяться за ручку тележки";
    const car = nearestBoardableVehicle(world.vehicles, pos);
    if (car) return car.traffic && !car.claimed
      ? `E · Остановить и сесть · ${car.displayName}` : `E · Сесть · ${car.displayName}`;
    return "";
  }
  function interact() {
    if (vehicle) {
      walkingVelocity.set(0, 0, 0);
      if (cargo) {
        grab();
        if (cargo) return;
      }
      const v = vehicle;
      const exit = findVehicleExit(v);
      if (!exit) {
        notify("Выход заблокирован. Переставьте машину.");
        return;
      }
      vehicle = null;
      world.player.mesh.visible = true;
      world.player.mesh.position.set(exit.x, world.groundHeight(exit.x, exit.z), exit.z);
      jump = vertical = 0;
      v.doorAnimation = 1;
      v.speed = 0;
      notify("Пешком тоже неплохо.");
      return;
    }
    const pos = world.player.mesh.position;
    const shelf = nearest(
      world.shelves.filter(
        (s) => !state.shops[s.shop].shelf && SHOPS[s.shop].task === "shelf",
      ),
      4,
    );
    if (shelf) {
      open("shelf");
      ui.shelf(SHOPS[shelf.shop], [2, 0, 1]);
      return;
    }
    const npc = nearest(
      world.people.filter((n) => n.kind === "staff"),
      3.5,
    );
    if (npc) {
      state.selected = npc.shop;
      open("dialogue");
      ui.dialogue(SHOPS[npc.shop]);
      return;
    }
    const coffee = SHOPS.find(
      (s) => Math.hypot(pos.x - s.x - 17, pos.z - s.z - 4) < 3,
    );
    if (coffee) {
      if (state.money < 40) {
        notify("Кофе стоит 40 ₽.");
        return;
      }
      state.money -= 40;
      state.stress -= 25;
      state.health += 30;
      normalize(state);
      notify("Кофе, аптечка и пять минут тишины. −25 стресса, +30 здоровья.");
      state.time += 10;
      beep(500);
      return;
    }
    const car = nearestBoardableVehicle(world.vehicles, pos);
    if (car) {
      if (held) {
        notify("Сначала отпустите тележку.");
        return;
      }
      vehicle = car;
      if (car.traffic && !car.claimed) {
        car.claimed = true;
        crime(1);
        message(`Вы забрали ${car.displayName}. Водитель сообщил об угоне.`);
      }
      walkingVelocity.set(0, 0, 0);
      held = null;
      jump = vertical = 0;
      world.player.mesh.position.copy(car.mesh.position);
      world.player.mesh.visible = false;
      car.speed = 0;
      car.doorAnimation = 1;
      yaw = car.heading + Math.PI;
      notify(
        [
          `${car.displayName} · манёвренный`,
          `${car.displayName} · можно перевозить тележку`,
          `${car.displayName} · быстрый разгон`,
          `${car.displayName} · тяжёлый, перевозит тележку`,
        ][car.type],
      );
    }
  }
  function grab() {
    if (vehicle) {
      if (![1, 3].includes(vehicle.type)) {
        notify("Для перевозки нужен фургон или грузовик.");
        return;
      }
      if (cargo) {
        const x = vehicle.mesh.position.x - Math.sin(vehicle.heading) * 5,
          z = vehicle.mesh.position.z - Math.cos(vehicle.heading) * 5;
        if (world.blocked(x, z, 0.8, vehicle)) {
          notify("Нет места для выгрузки.");
          return;
        }
        cargo.body.setTranslation({ x, y: 0.2, z }, true);
        cargo.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
        cargo.mesh.visible = true;
        cargo = null;
        notify("Тележка выгружена.");
      } else {
        const cart = nearest(
          world.carts.filter((c) => !c.delivered),
          7,
        );
        if (cart) {
          cargo = cart;
          cart.mesh.visible = false;
          cart.body.setTranslation({ x: 0, y: -30, z: 0 }, true);
          notify("Тележка в кузове. R — выгрузить.");
        } else notify("Подъедьте к тележке.");
      }
      return;
    }
    if (held) {
      held.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      held = null;
      beep(250);
      return;
    }
    if (jump > 0.02) {
      notify("Чтобы взяться за ручку, сначала встаньте на землю.");
      return;
    }
    const cart = nearest(
      world.carts.filter((c) => !c.delivered),
      3,
    );
    if (cart) {
      held = cart;
      held.pushHeading = yaw + Math.PI;
      held.gripTime = 0;
      attack = 0;
      notify("Держим ручку двумя руками. WASD — везти, R — отпустить в жёлтой зоне.");
    }
  }
  function hit(strong = false) {
    if (held) {
      notify("Сначала отпустите ручку тележки: R.");
      return;
    }
    if (vehicle || attack > 0) return;
    attackKind = strong ? "strong" : "quick";
    attack = strong ? 0.85 : 0.35;
    beep(strong ? 130 : 200);
    const target = nearest(world.people, 2.9);
    if (target && target.stun <= 0) {
      target.stun = strong ? 5 : 2;
      target.anger = 8;
      state.conflicts++;
      if (target.shop >= 0) state.shops[target.shop].rep--;
      const witness = world.people.some((n) => n !== target && dist(n) < 22);
      crime(witness ? 2 : 1);
      state.reputation -= 4;
      notify(
        witness
          ? "Свидетели вызвали полицию. Премия под угрозой."
          : "Конфликт испортил репутацию.",
      );
    } else {
      const cart = nearest(world.carts, 3);
      if (cart)
        cart.body.applyImpulse(
          { x: Math.sin(yaw) * -50, y: 2, z: Math.cos(yaw) * -50 },
          true,
        );
    }
  }
  document.addEventListener("keydown", (e) => {
    if (["Tab", "Space", "ArrowUp", "ArrowDown"].includes(e.code))
      e.preventDefault();
    if (e.code === "Escape") {
      if (mode === "play") {
        open("pause");
        ui.pause();
      } else if (hasStarted && mode !== "end") resume();
      return;
    }
    if (e.repeat) {
      keys.add(e.code);
      return;
    }
    if (e.code === "KeyM" || e.code === "Tab") {
      if (mode === "play") {
        open("phone");
        ui.phone(e.code === "Tab" ? "Карта" : "Маршрут");
      } else if (mode === "phone") resume();
      return;
    }
    if (mode !== "play") return;
    keys.add(e.code);
    if (e.code === "KeyE") interact();
    if (e.code === "KeyR") grab();
    if (e.code === "KeyF") hit();
    if (e.code === "KeyG") hit(true);
    if (e.code === "KeyC") firstPerson = !firstPerson;
    if (e.code === "Space" && !vehicle && !held && jump === 0) vertical = 8;
  });
  document.addEventListener("keyup", (e) => keys.delete(e.code));
  window.addEventListener("blur", () => {
    if (mode === "play") {
      open("pause");
      ui.pause();
    }
  });
  renderer.domElement.addEventListener("click", () => {
    if (mode !== "play") return;
    if (mouseCapture.captured) hit();
    else mouseCapture.capture();
  });
  document.addEventListener("mousemove", (e) => {
    if (document.pointerLockElement && mode === "play") {
      yaw -= e.movementX * 0.002 * settings.sensitivity;
      pitch = T.MathUtils.clamp(
        pitch + e.movementY * 0.002 * settings.sensitivity,
        -0.2,
        1.1,
      );
    }
  });
  window.addEventListener("resize", () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });
  window.addEventListener("pagehide", snapshot);
  function move(dt) {
    const pos = world.player.mesh.position;
    const forward = (keys.has("KeyW") ? 1 : 0) - (keys.has("KeyS") ? 1 : 0),
      side = (keys.has("KeyD") ? 1 : 0) - (keys.has("KeyA") ? 1 : 0);
    if (keys.has("ArrowLeft")) yaw += dt * 1.7;
    if (keys.has("ArrowRight")) yaw -= dt * 1.7;
    if (vehicle) {
      walkingVelocity.set(0, 0, 0);
      const old = vehicle.mesh.position.clone(),
        oldHeading = vehicle.heading,
        sign = Math.sign(vehicle.speed);
      vehicle.speed += forward * vehicle.accel * dt;
      vehicle.speed *= Math.pow(
        keys.has("Space") ? 0.08 : keys.has("ShiftLeft") ? 0.35 : 0.74,
        dt,
      );
      vehicle.speed = T.MathUtils.clamp(
        vehicle.speed,
        -vehicle.max * 0.45,
        vehicle.max,
      );
      vehicle.heading -=
        side *
        dt *
        (keys.has("ShiftLeft") ? 2 : 1.15) *
        Math.min(1, Math.abs(vehicle.speed) / 5) *
        sign;
      const dx = Math.sin(vehicle.heading) * vehicle.speed * dt,
        dz = Math.cos(vehicle.heading) * vehicle.speed * dt;
      const p = vehicle.mesh.position;
      const nx = p.x + dx,
        nz = p.z + dz;
      if (world.vehicleBlocked(vehicle, nx, nz)) {
        if (Math.abs(vehicle.speed) > 7) {
          state.health -= Math.abs(vehicle.speed) * 0.5;
          state.stress += 4;
          beep(80, 0.2);
        }
        vehicle.speed *= -0.25;
        vehicle.heading = oldHeading;
      } else p.set(nx, world.groundHeight(nx, nz), nz);
      vehicle.mesh.rotation.y = vehicle.heading;
      pos.copy(p);
      for (const n of world.people) {
        if (n.kind === "police" && state.wanted === 0) continue;
        const d = n.mesh.position.distanceTo(p);
        if (d < 3.2 && Math.abs(vehicle.speed) > 4) {
          n.stun = 5;
          n.anger = 6;
          const impact = vehicle.speed;
          vehicle.speed *= 0.4;
          crime(2);
          state.conflicts++;
          message("ДТП: прохожий оглушён. Свидетели сообщили номер полиции.");
          n.mesh.position.addScaledVector(p.clone().sub(old).normalize(), 3);
          if (impact > 12) state.money = Math.max(0, state.money - 100);
        }
      }
      for (const cart of world.carts) {
        if (cart === cargo || cart.delivered) continue;
        const cp = cart.body.translation();
        if (Math.hypot(cp.x - p.x, cp.z - p.z) < 3.5)
          cart.body.applyImpulse(
            {
              x: Math.sin(vehicle.heading) * vehicle.speed * 8,
              y: 0,
              z: Math.cos(vehicle.heading) * vehicle.speed * 8,
            },
            true,
          );
      }
    } else {
      const crouch = !held && keys.has("ControlLeft"),
        speed =
          (crouch
            ? 1.7
            : held
              ? 3.2
              : keys.has("ShiftLeft")
                ? state.energy > 0
                  ? 10
                  : 6.8
                : 2.8) * (state.health < 25 ? 0.65 : 1);
      let dx = -Math.sin(yaw) * forward + Math.cos(yaw) * side,
        dz = -Math.cos(yaw) * forward - Math.sin(yaw) * side;
      const len = Math.hypot(dx, dz);
      const acceleration = len ? 11 : 18;
      walkingVelocity.x = T.MathUtils.damp(walkingVelocity.x, len ? dx / len * speed : 0, acceleration, dt);
      walkingVelocity.z = T.MathUtils.damp(walkingVelocity.z, len ? dz / len * speed : 0, acceleration, dt);
      if (walkingVelocity.lengthSq() < 0.0001) walkingVelocity.set(0, 0, 0);
      dx = walkingVelocity.x * dt;
      dz = walkingVelocity.z * dt;
      if (held) {
        const turn = Math.atan2(Math.sin(yaw + Math.PI - held.pushHeading), Math.cos(yaw + Math.PI - held.pushHeading));
        const proposed = held.pushHeading + turn * (1 - Math.exp(-dt * 9));
        const frontX = pos.x + Math.sin(proposed) * 1.32;
        const frontZ = pos.z + Math.cos(proposed) * 1.32;
        if (!world.blocked(frontX, frontZ, 0.88)) held.pushHeading = proposed;
        world.player.mesh.rotation.y = held.pushHeading;
      }
      else if (firstPerson) world.player.mesh.rotation.y = yaw + Math.PI;
      if (walkingVelocity.lengthSq() > 0) {
        const aheadX = held ? Math.sin(held.pushHeading) * 1.32 : 0;
        const aheadZ = held ? Math.cos(held.pushHeading) * 1.32 : 0;
        const cp = held?.body.translation();
        const attached = !held || held.gripTime < 0.35 || Math.hypot(cp.x - pos.x - aheadX, cp.z - pos.z - aheadZ) < 0.65;
        if (attached && !world.blocked(pos.x + dx, pos.z) &&
            (!held || !world.blocked(pos.x + dx + aheadX, pos.z + aheadZ, 0.88))) pos.x += dx;
        else walkingVelocity.x = 0;
        if (attached && !world.blocked(pos.x, pos.z + dz) &&
            (!held || !world.blocked(pos.x + aheadX, pos.z + dz + aheadZ, 0.88))) pos.z += dz;
        else walkingVelocity.z = 0;
        if (!held && !firstPerson) {
          const target = Math.atan2(dx, dz);
          const turn = Math.atan2(Math.sin(target - world.player.mesh.rotation.y), Math.cos(target - world.player.mesh.rotation.y));
          world.player.mesh.rotation.y += turn * (1 - Math.exp(-dt * 14));
        }
        for (const [i, leg] of world.player.legs.entries())
          leg.rotation.x = Math.sin(visualTime * speed * 2 + i * Math.PI) * 0.5;
      } else world.player.legs.forEach((l) => (l.rotation.x = 0));
      vertical -= 20 * dt;
      jump = Math.max(0, jump + vertical * dt);
      if (jump === 0) vertical = 0;
      pos.y = world.groundHeight(pos.x, pos.z) + jump;
      // Articulated characters crouch at the hips/knees, preserving limb size.
      world.player.mesh.scale.y = world.player.motion ? 1 : crouch ? 0.7 : 1;
      if (held) {
        const p = held.body.translation();
        const tx = pos.x + Math.sin(held.pushHeading) * 1.32,
          tz = pos.z + Math.cos(held.pushHeading) * 1.32;
        held.gripTime += dt;
        const ex = tx - p.x, ez = tz - p.z;
        const gain = Math.min(1 / Math.max(dt, 0.001), 6 / Math.max(Math.hypot(ex, ez), 0.001));
        held.body.setLinvel(
          { x: ex * gain, y: held.body.linvel().y, z: ez * gain },
          true,
        );
        held.body.setRotation({ x: 0, y: Math.sin(held.pushHeading / 2), z: 0, w: Math.cos(held.pushHeading / 2) }, true);
        if (Math.hypot(p.x - pos.x, p.z - pos.z) > 6 ||
            (held.gripTime > 0.8 && Math.hypot(ex, ez) > 0.65)) {
          held = null;
          notify("Ручка недоступна: тележка упёрлась в препятствие. Подойдите с другой стороны.");
        }
      }
      for (const c of world.carts) {
        if (c === cargo || c === held || c.delivered) continue;
        const cp = c.body.translation();
        const d = Math.hypot(cp.x - pos.x, cp.z - pos.z);
        if (d < 1.3 && len)
          c.body.applyImpulse(
            { x: (dx / dt) * 1.7, y: 0, z: (dz / dt) * 1.7 },
            true,
          );
      }
    }
    playerBody.setNextKinematicTranslation({
      x: pos.x,
      y: vehicle ? -10 : pos.y + PLAYER_SHAPE.height / 2,
      z: pos.z,
    });
    state.position = { x: pos.x, z: pos.z };
    if (attack > 0) {
      attack -= dt;
      world.player.mesh.rotation.z =
        Math.sin(attack * (attackKind === "strong" ? 7 : 14)) * 0.15;
    } else world.player.mesh.rotation.z = 0;
    world.player.arms.forEach(
      (a, i) =>
        (a.rotation.x =
          attack > 0
            ? i === 1
              ? -1.5 - Math.sin(attack * 10) * 0.5
              : 0
            : keys.has("KeyQ")
              ? -1.3
              : held
                ? -1.1
                : Math.sin(visualTime * 6 + i * Math.PI) * 0.1),
    );
  }
  function updateCarts() {
    for (const s of state.shops) s.carts = 0;
    for (const c of world.carts) {
      if (c === cargo) continue;
      const p = c.body.translation();
      c.mesh.position.set(p.x, p.y, p.z);
      const q = c.body.rotation();
      c.heading = Math.atan2(2 * (q.w * q.y + q.x * q.z), 1 - 2 * (q.y * q.y + q.x * q.x));
      c.mesh.rotation.set(0, c.heading, 0);
      const zone = world.zones[c.shop];
      const good =
        c !== held &&
        Math.abs(p.x - zone.x) < 4.1 &&
        Math.abs(p.z - zone.z) < 3.1 &&
        p.y < 2;
      if (good && !c.delivered) {
        beep(660);
        notify(`Тележка возвращена · ${SHOPS[c.shop].name}`);
      }
      c.delivered = good;
      if (good) state.shops[c.shop].carts++;
    }
  }
  function ai(dt) {
    const player = world.player.mesh.position;
    for (const n of world.people) {
      if (n.stun > 0) {
        n.stun -= dt;
        n.mesh.rotation.z = 1.25;
        n.mesh.position.y = world.groundHeight(n.mesh.position.x, n.mesh.position.z) + 0.2;
        continue;
      }
      n.mesh.rotation.z = 0;
      n.mesh.position.y = world.groundHeight(n.mesh.position.x, n.mesh.position.z);
      const d = n.mesh.position.distanceTo(player);
      let target = null,
        speed = 1.1;
      if (n.kind === "police") {
        if (state.wanted > 0) {
          target = player;
          speed = vehicle ? 5.5 : state.wanted >= 3 ? 6.5 : 4;
          if (d < 3.2) {
            arrest += dt * (keys.has("KeyQ") ? 0.5 : 1);
            if (arrest > 2) {
              const fine = 100 + Math.ceil(state.wanted) * 70;
              state.fines += fine;
              state.money = Math.max(0, state.money - fine);
              state.time += 80;
              state.wanted = 0;
              state.health = Math.max(40, state.health);
              if (vehicle) {
                vehicle.speed = 0;
                vehicle = null;
                world.player.mesh.visible = true;
              }
              held = null;
              player.set(-42, 0, 34);
              arrest = 0;
              message(`Задержание: штраф ${fine} ₽ и потеря рабочего времени.`);
            }
          } else arrest = Math.max(0, arrest - dt * 0.05);
        } else target = n.home;
      } else if (n.anger > 0) {
        n.anger -= dt;
        if (n.kind === "staff") {
          target = player;
          speed = 3;
          if (
            d < 2 &&
            Math.floor(state.time * 2) !== Math.floor((state.time - dt) * 2)
          )
            state.health -= keys.has("KeyQ") ? 1 : 5;
        } else {
          target = n.home
            .clone()
            .add(n.home.clone().sub(player).normalize().multiplyScalar(14));
          speed = 4;
        }
      } else if (n.kind === "civilian") {
        n.phase += dt * 0.3;
        target = n.home
          .clone()
          .add(new T.Vector3(Math.sin(n.phase) * 3, 0, Math.cos(n.phase) * 7));
        if (vehicle && d < 12) {
          target = n.home
            .clone()
            .add(n.home.clone().sub(player).normalize().multiplyScalar(8));
          speed = 5;
        }
      } else if (n.mesh.position.distanceTo(n.home) > 1) target = n.home;
      if (target) {
        const delta = target.clone().sub(n.mesh.position);
        delta.y = 0;
        if (delta.length() > 0.5) {
          delta.normalize().multiplyScalar(speed * dt);
          const nx = n.mesh.position.x + delta.x,
            nz = n.mesh.position.z + delta.z;
          if (!world.blocked(nx, nz, 0.4)) {
            n.mesh.position.x = nx;
            n.mesh.position.z = nz;
            n.mesh.position.y = world.groundHeight(nx, nz);
          }
          n.mesh.rotation.y = Math.atan2(delta.x, delta.z);
          n.legs.forEach(
            (l, i) =>
              (l.rotation.x = Math.sin(visualTime * 8 + i * Math.PI) * 0.5),
          );
        }
      }
    }
    for (const [i, v] of world.policeVehicles.entries()) {
      v.mesh.visible = state.wanted >= 3;
      if (!v.mesh.visible) continue;
      v.light.material.emissive.set(
        Math.sin(visualTime * 12) > 0 ? "#3c75f5" : "#e15645",
      );
      const p = v.mesh.position;
      const delta = player.clone().sub(p);
      delta.y = 0;
      const d = delta.length();
      if (d > 9) {
        delta.normalize().multiplyScalar(dt * (8 + state.wanted));
        const nx = p.x + delta.x,
          nz = p.z + delta.z;
        if (!world.blocked(nx, nz, 2, v)) p.set(nx, 0, nz);
        else if (!world.blocked(nx, p.z, 2, v)) p.x = nx;
        else if (!world.blocked(p.x, nz, 2, v)) p.z = nz;
        v.heading = Math.atan2(delta.x, delta.z);
        v.mesh.rotation.y = v.heading;
      }
      const officer = world.people.filter((n) => n.kind === "police")[i];
      if (officer.mesh.position.distanceTo(p) > 12)
        officer.mesh.position.set(p.x + 3, 0, p.z);
    }
    for (const v of world.vehicles.filter((v) => v.traffic)) {
      if (v === vehicle || v.claimed) continue;
      if (v.rival) {
        const stop = SHOPS[Math.floor(state.time / 80) % 8],
          d = stop.x - v.mesh.position.x,
          z = stop.z + 16 - v.mesh.position.z;
        const step = new T.Vector3(d, 0, z);
        if (step.length() > 4) {
          step.normalize().multiplyScalar(dt * 5);
          if (
            !world.blocked(
              v.mesh.position.x + step.x,
              v.mesh.position.z + step.z,
              2,
              v,
            )
          )
            v.mesh.position.add(step);
          v.heading = Math.atan2(step.x, step.z);
          v.mesh.rotation.y = v.heading;
        } else if (Math.floor(state.time / 80) !== v.lastVisit) {
          v.lastVisit = Math.floor(state.time / 80);
          if (!state.shops[stop.id].done) {
            const cart = world.carts.find(
              (c) => c.shop === stop.id && !c.delivered,
            );
            if (cart) cart.body.applyImpulse({ x: 30, y: 0, z: 20 }, true);
            message(
              `Коллега Дима: «Я уже у ${stop.name}. Одну тележку случайно укатил. Без обид!»`,
            );
          }
        }
        continue;
      }
      v.speed = 6;
      v.mesh.position.z += dt * v.speed;
      v.heading = 0;
      v.mesh.rotation.y = 0;
      if (v.mesh.position.z > 150) v.mesh.position.z = -115;
      v.mesh.position.y = world.groundHeight(v.mesh.position.x, v.mesh.position.z);
      v.impactCooldown = Math.max(0, (v.impactCooldown || 0) - dt);
      if (!vehicle && v.impactCooldown === 0 && circleIntersectsBox(player.x, player.z, PLAYER_SHAPE.radius, vehicleBox(v))) {
        v.impactCooldown = 1.5;
        state.health -= 15;
        state.stress += 8;
        player.x -= 4;
        notify("Смотрите по сторонам!");
      }
      if (vehicle && boxesIntersect(vehicleBox(vehicle), vehicleBox(v))) {
        vehicle.speed *= -0.3;
        v.mesh.position.z += 8;
        state.health -= 4;
        crime(1);
      }
    }
  }
  function systems(dt) {
    state.time += dt;
    state.energy = Math.max(0, state.energy - dt);
    if (state.energy === 0 && state._energyActive) {
      state.stress += 12;
      state._energyActive = false;
      notify("Энергетик закончился. А день — ещё нет.");
    }
    if (state.energy > 0) state._energyActive = true;
    state.stress += dt * 0.017;
    if (
      state.wanted > 0 &&
      state.time - lastCrime > 25 &&
      !world.people.some(
        (n) =>
          n.kind === "police" &&
          n.mesh.position.distanceTo(world.player.mesh.position) < 30,
      )
    ) {
      state.wanted = Math.max(0, state.wanted - dt * 0.1);
    }
    if (state.time - lastMessage > 120) {
      lastMessage = state.time;
      message(
        [
          "Региональный: Где фото? Фото без тележек не считается.",
          "Региональный: Ваш маршрут сам себя не закроет.",
          "Региональный: Вы сегодня работаете или катаетесь?",
        ][Math.floor(state.time / 120) % 3],
      );
      state.stress += 4;
    }
    if (state.time - lastEvent > 180) {
      lastEvent = state.time;
      state.weather = !state.weather;
      message(
        state.weather
          ? "Начался дождь. Тележки стали скользкими."
          : "Дождь закончился. Коллега снова перепутал выкладку.",
      );
      const unfinished = world.shelves.find(
        (s) => !state.shops[s.shop].done && SHOPS[s.shop].task === "shelf",
      );
      if (unfinished) state.shops[unfinished.shop].shelf = false;
      for (const c of world.carts)
        c.body.setLinearDamping(state.weather ? 1.5 : 4);
    }
    if (state.stress >= 100 && !stressEvent) {
      stressEvent = true;
      state.time += 20;
      state.stress = 75;
      message(
        "МЕРЧ НА ПРЕДЕЛЕ: двадцать секунд ушло на спор с автоответчиком. Найдите кофе.",
      );
    }
    if (state.stress < 60) stressEvent = false;
    for (const item of world.secrets) {
      if (item.taken) continue;
      item.mesh.rotation.y += dt;
      if (item.mesh.position.distanceTo(world.player.mesh.position) < 2) {
        item.taken = true;
        item.mesh.visible = false;
        state.money += 150;
        state.bonus += 50;
        notify("Тайник коллеги: +150 ₽ и записка «держись, брат».");
      }
    }
    if (state.health <= 0) {
      state.health = 65;
      state.money = Math.max(0, state.money - 150);
      state.fines += 150;
      state.time += 100;
      state.wanted = 0;
      if (vehicle) {
        vehicle.speed = 0;
        vehicle = null;
        world.player.mesh.visible = true;
      }
      world.player.mesh.position.set(-42, 0, 34);
      held = null;
      message("Медпункт: −150 ₽ и потеря времени. Можно продолжать смену.");
    }
    normalize(state);
    if (state.time >= 1500) {
      end();
      return;
    }
    if (state.time - lastSave > 5) {
      lastSave = state.time;
      snapshot();
    }
  }
  function updateCamera(dt) {
    const pos = world.player.mesh.position;
    world.visuals?.setFirstPerson(firstPerson && !vehicle && hasStarted);
    const fov = firstPerson && !vehicle && hasStarted ? 78 : 58;
    if (camera.fov !== fov) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
    if (!hasStarted) {
      camera.position.set(-45, 12, 49);
      camera.lookAt(-64, 2, 18);
      return;
    }
    const target = pos.clone().add(new T.Vector3(0, vehicle ? 2 : firstPerson ? PLAYER_SHAPE.eyeHeight : 1.3, 0));
    let desired;
    if (firstPerson && !vehicle) {
      desired = target;
      world.player.mesh.visible = false;
      camera.position.copy(desired);
      camera.lookAt(
        target
          .clone()
          .add(
            new T.Vector3(
              -Math.sin(yaw) * 10,
              -Math.sin(pitch) * 7,
              -Math.cos(yaw) * 10,
            ),
          ),
      );
    } else {
      world.player.mesh.visible = !vehicle;
      const r = vehicle ? 10 : 4.25;
      desired = target
        .clone()
        .add(
          new T.Vector3(
            Math.sin(yaw) * r * Math.cos(pitch),
            (vehicle ? 2 : 0.6) + Math.sin(pitch) * r,
            Math.cos(yaw) * r * Math.cos(pitch),
          ),
        );
      avoidCameraCollision(target, desired);
      camera.position.lerp(desired, 1 - Math.exp(-dt * 10));
      avoidCameraCollision(target, camera.position);
      if (!vehicle) world.player.mesh.visible = camera.position.distanceTo(target) > 0.65;
      camera.lookAt(target);
    }
  }
  ui.update(world, null);
  updateCarts();
  if (state.ending) {
    mode = "end";
    ui.ending();
  } else ui.intro();
  function frame() {
    requestAnimationFrame(frame);
    const rawDelta = clock.getDelta(),
      dt = Math.min(rawDelta, 0.05);
    visualTime += dt;
    if (mode === "play" && rawDelta > 0.065 && settings.quality === "high")
      slowFrames++;
    else slowFrames = Math.max(0, slowFrames - 1);
    if (slowFrames > 180) {
      configure("quality", "low");
      notify("Включено экономное качество для плавной игры.");
    }
    rain.visible = state.weather;
    rain.position.set(
      world.player.mesh.position.x,
      0,
      world.player.mesh.position.z,
    );
    if (state.weather) {
      for (let i = 1; i < rainPoints.length; i += 3) {
        rainPoints[i] -= dt * 18;
        if (rainPoints[i] < 0) rainPoints[i] = 30;
      }
      rainGeo.attributes.position.needsUpdate = true;
    }
    if (mode === "play") {
      move(dt);
      accumulator += dt;
      let steps = 0;
      while (accumulator >= 1 / 60 && steps++ < 4) {
        world.physics.timestep = 1 / 60;
        world.physics.step();
        accumulator -= 1 / 60;
      }
      updateCarts();
      ai(dt);
      systems(dt);
      ui.context(context());
    } else ui.context("");
    const selected = SHOPS[state.selected];
    marker.position.set(
      selected.x,
      9 + Math.sin(visualTime * 2) * 0.4,
      selected.z + 4,
    );
    marker.rotation.z = Math.PI;
    marker.visible = !state.shops[state.selected].done;
    updateCamera(dt);
    atmosphere.update({
      day: state.time / 1500,
      weather: state.weather,
      player: world.player.mesh.position,
      dt,
    });
    world.visuals?.update?.(dt, visualTime, {
      active: mode === "play", heldCart: held?.mesh ?? null,
      grounded: jump <= 0, verticalVelocity: vertical,
      crouch: !held && keys.has("ControlLeft"), guard: !held && keys.has("KeyQ"),
      attack, attackKind, inVehicle: !!vehicle,
      firstPerson,
    });
    ui.update(world, vehicle);
    renderer.render(scene, camera);
  }
  frame();
  // Read-only diagnostics for smoke tests and troubleshooting, with no gameplay shortcuts.
  window.__MERCH__ = {
    get state() {
      return JSON.parse(JSON.stringify(state));
    },
    get mode() {
      return mode;
    },
    get renderer() {
      return {
        calls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        geometries: renderer.info.memory.geometries,
        textures: renderer.info.memory.textures,
        quality: settings.quality,
      };
    },
    get visuals() {
      return world.visuals?.diagnostics ?? null;
    },
    get view() {
      return {
        firstPerson,
        playerVisible: world.player.mesh.visible,
        playerY: world.player.mesh.position.y,
        groundHeight: world.groundHeight(world.player.mesh.position.x, world.player.mesh.position.z),
        collisionRadius: PLAYER_SHAPE.radius,
        firstPersonHandsVisible: world.visuals?.firstPersonHandsVisible ?? false,
        fov: camera.fov,
        pointerLocked: mouseCapture.captured,
        cameraYaw: yaw,
      };
    },
    get motion() {
      return world.visuals?.motionDiagnostics ?? null;
    },
    get vehicles() {
      return world.vehicles.map((v) => ({ id: v.id, type: v.type, model: v.visualModel, name: v.displayName,
        traffic: v.traffic, claimed: v.claimed, controlled: v === vehicle,
        position: v.mesh.position.toArray(), heading: v.heading, speed: v.speed, halfWidth: v.w, halfLength: v.l }));
    },
    get navigation() {
      return { streetObstructions: world.streetObstructions.map(({ x, z, w, d }) => ({ x, z, w, d })) };
    },
  };
  // BFCache preserves the page and its GPU resources. Dispose only on a real exit.
  addEventListener("pagehide", (event) => {
    if (!event.persisted) {
      world.visuals?.dispose();
      mouseCapture.dispose();
      atmosphere.dispose();
    }
  });
} catch (err) {
  console.error(err);
  document.body.innerHTML = "";
  const el = document.createElement("div");
  el.className = "error";
  el.textContent = `Не удалось запустить 3D-игру: ${err.message}. Проверьте поддержку WebGL 2 и обновите браузер.`;
  document.body.append(el);
}
