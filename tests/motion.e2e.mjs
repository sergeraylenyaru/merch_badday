import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { freshState, SHOPS } from "../src/state.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const artifacts = fileURLToPath(new URL("../.playwright/", import.meta.url));
const port = 5196;
const url = `http://127.0.0.1:${port}`;

await new Promise((resolve, reject) => {
  const probe = createServer();
  probe.once("error", () => reject(new Error(`Port ${port} is occupied; no existing process was stopped.`)));
  probe.listen(port, "127.0.0.1", () => probe.close(resolve));
});
await mkdir(artifacts, { recursive: true });
let serviceOutput = "";
let serviceError;
const service = spawn(process.execPath, [
  "node_modules/vite/bin/vite.js", "--host", "127.0.0.1",
  "--port", String(port), "--strictPort",
], { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
for (const stream of [service.stdout, service.stderr]) {
  stream.on("data", (chunk) => { serviceOutput = (serviceOutput + chunk).slice(-8000); });
}
service.on("error", (error) => { serviceError = error; });

async function waitForService() {
  for (let i = 0; i < 100; i++) {
    if (serviceError) throw serviceError;
    if (service.exitCode !== null) throw new Error(`Vite exited: ${serviceOutput}`);
    try { if ((await fetch(url)).ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Vite did not become ready: ${serviceOutput}`);
}

const angleDifference = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
const planarDistance = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);

async function sample(page) {
  return page.evaluate(() => ({
    time: __MERCH__.state.time,
    position: __MERCH__.state.position,
    view: __MERCH__.view,
    motion: __MERCH__.motion,
  }));
}

async function advance(page, seconds) {
  const start = await page.evaluate(() => __MERCH__.state.time);
  await page.waitForFunction(({ start, seconds }) => __MERCH__.state.time >= start + seconds,
    { start, seconds }, { timeout: 60000 });
}

// Capture while keys are still held: a passing stationary pose must not conceal
// hand separation or foot skating during the actual movement.
async function inputFor(page, keys, seconds) {
  for (const key of keys) await page.keyboard.down(key);
  try {
    await advance(page, seconds);
    return await sample(page);
  } finally {
    for (const key of [...keys].reverse()) await page.keyboard.up(key);
  }
}

async function waitForGrip(page) {
  await page.waitForFunction(() => {
    const motion = window.__MERCH__?.motion;
    return motion?.heldCartId === 0 && motion.player?.gripWeight > 0.98 &&
      motion.player.gripErrors?.length === 2 &&
      motion.player.gripErrors.every((error) => Number.isFinite(error) && error < 0.04);
  }, undefined, { timeout: 60000 });
}

function assertGrip(snapshot, label) {
  const { motion } = snapshot;
  assert.equal(motion.heldCartId, 0, `${label}: selected cart remains held`);
  assert.equal(motion.player.articulated, true, `${label}: articulated GLB rig`);
  assert.ok(motion.player.gripWeight > 0.98, `${label}: full hand contact`);
  assert.equal(motion.player.gripErrors.length, 2);
  for (const [index, error] of motion.player.gripErrors.entries()) {
    assert.ok(Number.isFinite(error) && error < 0.04,
      `${label}: palm ${index} separated from handle by ${error}m`);
  }
  const cart = motion.carts.find((entry) => entry.id === 0);
  assert.ok(cart, `${label}: physical cart diagnostics`);
  assert.ok(angleDifference(motion.player.heading, cart.heading) < 0.12,
    `${label}: avatar and trolley face the same heading`);
  assert.ok(Math.abs(snapshot.view.playerY - snapshot.view.groundHeight) < 0.01,
    `${label}: grounded while holding handle`);
  return cart;
}

function assertRolling(before, after, label) {
  assert.equal(after.wheelAngles.length, 4, `${label}: four separate rolling wheels`);
  assert.ok(after.wheelAngles.every(Number.isFinite));
  assert.ok(after.wheelAngles.some((angle, index) =>
    angleDifference(angle, before.wheelAngles[index]) > 0.02), `${label}: wheels rotate with displacement`);
}

let browser;
try {
  await waitForService();
  browser = await chromium.launch({
    executablePath: process.env.BROWSER_PATH || (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
    headless: true,
    args: ["--no-sandbox", "--enable-unsafe-swiftshader", "--use-angle=swiftshader"],
  });
  const context = await browser.newContext({ viewport: { width: 800, height: 600 } });
  const fixture = freshState();
  fixture.position = { x: SHOPS[0].x+3, z: SHOPS[0].z+10 };
  fixture.carts = [{ x: SHOPS[0].x+3, z: SHOPS[0].z+8 }, { x: SHOPS[0].x-10, z: SHOPS[0].z+11 }];
  await context.addInitScript((state) => {
    if (sessionStorage.getItem("motion-fixture")) return;
    localStorage.setItem("merch-badday-v1", JSON.stringify(state));
    localStorage.setItem("merch-settings", JSON.stringify({ quality: "low", volume: 0, sensitivity: 1 }));
    sessionStorage.setItem("motion-fixture", "1");
  }, fixture);
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__MERCH__?.motion?.player?.articulated, undefined, { timeout: 60000 });
  await page.click("#begin");
  await page.keyboard.press("KeyR");
  await waitForGrip(page);
  let previous = assertGrip(await sample(page), "stationary grip");
  const measurements = [];

  for (const [label, key, expectedState] of [
    ["forward", "KeyW", "push"],
    ["backward", "KeyS", "pull"],
    ["sideways", "KeyA", "strafe"],
  ]) {
    const moving = await inputFor(page, [key], 0.45);
    assert.equal(moving.motion.player.state, expectedState, `${label}: gait follows achieved velocity`);
    const cart = assertGrip(moving, label);
    assert.ok(planarDistance(previous.position, cart.position) > 0.3, `${label}: physical cart moves`);
    assertRolling(previous, cart, label);
    measurements.push({ label, state: moving.motion.player.state, gripErrors: moving.motion.player.gripErrors });
    previous = cart;
  }
  await advance(page, 0.35);
  const beforeTurn = assertGrip(await sample(page), "before turn");
  const turned = await inputFor(page, ["ArrowLeft"], 0.35);
  const turnedCart = assertGrip(turned, "turning");
  assert.ok(angleDifference(turnedCart.heading, beforeTurn.heading) > 0.25, "trolley steers with the avatar");
  await advance(page, 0.3);

  // Jumping, crouching and punches must not tear the palms away from the handle.
  await page.keyboard.down("Control");
  try {
    await page.keyboard.press("Space");
    await page.keyboard.press("KeyF");
    await advance(page, 0.25);
    const constrained = await sample(page);
    assertGrip(constrained, "cart gesture constraints");
    assert.equal(constrained.motion.player.grounded, true);
    assert.ok(constrained.motion.player.crouchWeight < 0.02, "release handle before crouching");
    assert.notEqual(constrained.motion.player.state, "attack", "release handle before punching");
  } finally { await page.keyboard.up("Control"); }
  await page.screenshot({ path: `${artifacts}motion-cart-front.png` });

  await page.keyboard.press("KeyC");
  await page.waitForFunction(() => __MERCH__.view.firstPerson &&
    !__MERCH__.view.playerVisible && __MERCH__.view.firstPersonHandsVisible);
  await advance(page, 0.15);
  const firstPerson = await sample(page);
  assertGrip(firstPerson, "first-person hands");
  assert.equal(firstPerson.view.fov, 78, "first-person view frames both hands and the handle");
  await page.screenshot({ path: `${artifacts}motion-cart-firstperson.png` });
  await page.keyboard.press("KeyC");
  await page.waitForFunction(() => !__MERCH__.view.firstPerson &&
    __MERCH__.view.playerVisible && !__MERCH__.view.firstPersonHandsVisible);

  await page.keyboard.press("Escape");
  await page.locator("#resume").waitFor({ state: "visible" });
  const frozenBefore = await sample(page);
  // Observe two rendered pause frames, rather than waiting for simulation time
  // which is correctly stopped while the menu is open.
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const frozenAfter = await sample(page);
  assert.equal(frozenAfter.time, frozenBefore.time, "pause freezes game time");
  assert.equal(frozenAfter.motion.player.stride, frozenBefore.motion.player.stride, "pause freezes the gait");
  assert.deepEqual(frozenAfter.motion.carts, frozenBefore.motion.carts, "pause freezes cart and wheel transforms");
  await page.click("#resume");
  await waitForGrip(page);

  await page.keyboard.press("KeyR");
  await page.waitForFunction(() => __MERCH__.motion.heldCartId === null &&
    __MERCH__.motion.player.gripWeight < 0.01 && __MERCH__.motion.player.state === "idle",
  undefined, { timeout: 60000 });

  const walk = await inputFor(page, ["KeyS", "Shift"], 0.45);
  assert.equal(walk.motion.player.state, "walk");
  assert.equal(walk.motion.player.animation?.clip, "Walk", "walking plays the recorded skeleton clip");
  assert.ok(walk.motion.player.speed > 1, "walk has measured travel speed");
  const run = await inputFor(page, ["KeyS"], 0.65);
  assert.equal(run.motion.player.state, "run");
  assert.ok(["Run", "Sprint"].includes(run.motion.player.animation?.clip), "running plays a recorded run/sprint clip");
  assert.ok(run.motion.player.speed > walk.motion.player.speed + 1, "running is faster than walking");
  assert.ok(run.motion.player.distance > walk.motion.player.distance, "stride advances with actual distance");
  const crouch = await inputFor(page, ["Control", "KeyS"], 0.35);
  assert.equal(crouch.motion.player.state, "crouch-walk");
  assert.ok(crouch.motion.player.crouchWeight > 0.7);
  assert.ok(Math.abs(crouch.motion.player.jointAngles.leftKnee) > 0.25 &&
    Math.abs(crouch.motion.player.jointAngles.rightKnee) > 0.25, "crouching bends both knees");
  await page.waitForFunction(() => __MERCH__.motion.player.state === "idle" &&
    __MERCH__.motion.player.speed < 0.1, undefined, { timeout: 60000 });
  const idleBefore = await sample(page);
  await advance(page, 0.3);
  const idleAfter = await sample(page);
  assert.ok(Math.abs(idleAfter.motion.player.distance - idleBefore.motion.player.distance) < 0.01,
    "idle feet do not accumulate a walking stride");

  await page.keyboard.press("Space");
  await page.waitForFunction(() => __MERCH__.motion.player.state === "jump" &&
    !__MERCH__.motion.player.grounded && __MERCH__.view.playerY > 0.03, undefined, { timeout: 60000 });
  await page.waitForFunction(() => __MERCH__.motion.player.state === "fall", undefined, { timeout: 60000 });
  await page.waitForFunction(() => __MERCH__.motion.player.grounded &&
    Math.abs(__MERCH__.view.playerY - __MERCH__.view.groundHeight) < 0.01, undefined, { timeout: 60000 });
  await page.waitForFunction(() => __MERCH__.motion.player.state === "idle", undefined, { timeout: 60000 });
  const guard = await inputFor(page, ["KeyQ"], 0.25);
  assert.equal(guard.motion.player.state, "guard");
  await page.keyboard.press("KeyF");
  await page.waitForFunction(() => __MERCH__.motion.player.state === "attack", undefined, { timeout: 60000 });
  await page.waitForFunction(() => __MERCH__.motion.player.state === "idle", undefined, { timeout: 60000 });

  await page.keyboard.down("KeyW");
  try {
    await advance(page, 0.3);
    await page.screenshot({ path: `${artifacts}motion-walk.png` });
  } finally { await page.keyboard.up("KeyW"); }
  assert.deepEqual(errors, [], "locomotion browser JavaScript/resource errors");
  console.log("TWO-HAND CART GRIP / FORWARD / BACKWARD / STRAFE / TURN / WHEELS PASS", JSON.stringify(measurements));
  console.log("FIRST-PERSON HANDS / PAUSE / RELEASE / WALK / RUN / CROUCH / JUMP / LAND / GUARD / ATTACK PASS");
  console.log(`MOTION PASS; screenshots: ${artifacts}`);
  await context.close();
} finally {
  await browser?.close();
  service.kill("SIGTERM");
}
