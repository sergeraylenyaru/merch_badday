import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { freshState, SHOPS } from "../src/state.js";

// Separate from the gameplay E2E: validates GLB integration, visual resource
// lifetime, quality/camera modes and graceful failure of one model download.
const root = fileURLToPath(new URL("../", import.meta.url));
const artifacts = fileURLToPath(new URL("../.playwright/", import.meta.url));
const port = 5190;
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

async function createScenario(browser, state = freshState(), { missingCart = false } = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await context.addInitScript((initialState) => {
    // Do not reseed on reload: persistence must be exercised, not replaced.
    if (sessionStorage.getItem("visual-fixture")) return;
    localStorage.setItem("merch-badday-v1", JSON.stringify(initialState));
    localStorage.setItem("merch-settings", JSON.stringify({ quality: "low", volume: 0, sensitivity: 1 }));
    sessionStorage.setItem("visual-fixture", "1");
  }, state);
  if (missingCart) await context.route("**/models/original/shopping-cart.glb*", (route) => route.abort());
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  const events = { errors: [], consoleErrors: [], warnings: [], requests: new Map(), failedRequests: [] };
  page.on("pageerror", (error) => events.errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") events.consoleErrors.push(message.text());
    if (message.type() === "warning") events.warnings.push(message.text());
  });
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    if (path.endsWith(".glb")) events.requests.set(path, (events.requests.get(path) || 0) + 1);
  });
  page.on("requestfailed", (request) => events.failedRequests.push(new URL(request.url()).pathname));
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await ready(page);
  return { context, page, events };
}

async function ready(page) {
  await page.waitForFunction(() => window.__MERCH__?.visuals?.assets?.loaded > 0, undefined, { timeout: 60000 });
  await page.locator("#begin").waitFor({ state: "visible" });
}

async function scenePixels(page) {
  return page.evaluate(() => {
    const source = document.querySelector("canvas.scene");
    const sample = document.createElement("canvas");
    sample.width = 64;
    sample.height = 40;
    const ctx = sample.getContext("2d");
    ctx.drawImage(source, 0, 0, sample.width, sample.height);
    const data = ctx.getImageData(0, 0, sample.width, sample.height).data;
    const colors = new Set();
    let darkest = 255, brightest = 0;
    for (let i = 0; i < data.length; i += 4) {
      colors.add(`${data[i] >> 4},${data[i + 1] >> 4},${data[i + 2] >> 4}`);
      const light = (data[i] + data[i + 1] + data[i + 2]) / 3;
      darkest = Math.min(darkest, light);
      brightest = Math.max(brightest, light);
    }
    return { colors: colors.size, contrast: brightest - darkest, width: source.width, height: source.height };
  });
}

async function assertScene(page, label) {
  const pixels = await scenePixels(page);
  assert.ok(pixels.width > 0 && pixels.height > 0, `${label}: missing render target`);
  assert.ok(pixels.colors > 35 && pixels.contrast > 50, `${label}: empty/flat scene ${JSON.stringify(pixels)}`);
  const renderer = await page.evaluate(() => __MERCH__.renderer);
  assert.ok(renderer.triangles > 5000 && renderer.calls > 20, `${label}: expected city geometry`);
  assert.equal(await page.locator(".error").count(), 0);
  return { pixels, renderer };
}

function assertNoErrors(events, { missingCart = false } = {}) {
  assert.deepEqual(events.errors, [], "unhandled browser JavaScript errors");
  const unexpectedConsole = missingCart
    ? events.consoleErrors.filter((message) => !/Failed to load resource: net::ERR_FAILED/.test(message))
    : events.consoleErrors;
  assert.deepEqual(unexpectedConsole, [], "unexpected console errors");
  const unexpectedRequests = missingCart
    ? events.failedRequests.filter((path) => path !== "/models/original/shopping-cart.glb")
    : events.failedRequests;
  assert.deepEqual(unexpectedRequests, [], "unexpected failed resource requests");
}

let browser;
try {
  await waitForService();
  browser = await chromium.launch({
    executablePath: process.env.BROWSER_PATH || (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
    headless: true,
    args: ["--no-sandbox", "--enable-unsafe-swiftshader", "--use-angle=swiftshader"],
  });

  const normal = await createScenario(browser);
  const { page, events } = normal;
  const visual = await page.evaluate(() => __MERCH__.visuals);
  assert.equal(visual.district, "01 / У дома");
  assert.equal(visual.assets.loaded, 17);
  assert.equal(visual.assets.failed, 0);
  assert.equal(visual.assets.cacheCount, 17);
  assert.equal(visual.districts.length, SHOPS.length);
  assert.equal(new Set(visual.districts.map((entry) => entry.feature)).size, 9);
  assert.ok(visual.districts.every((entry) => entry.generatedMeshes > 0 && entry.modelPlacements > 0));
  assert.equal(visual.replacements.filter((entry) => entry.kind === 'staff').length, 9);
  assert.equal(visual.replacements.filter((entry) => entry.kind === 'player').length, 1);
  assert.equal(visual.replacements.filter((entry) => entry.kind === 'cart').length, SHOPS.reduce((n, shop) => n + shop.required, 0));
  assert.equal(visual.replacements.filter((entry) => entry.kind === 'vehicle').length, 27);
  assert.deepEqual([...new Set(visual.replacements.filter((entry) => entry.kind === 'vehicle').map((entry) => entry.entity))].sort(), ['hatchback','police','sedan','suv','truck','van']);
  for (const entry of visual.replacements) {
    assert.ok(entry.size.every((n) => Number.isFinite(n) && n > 0), `invalid bounds: ${entry.entity}`);
    assert.ok(Math.abs(entry.minY) < 0.001, `incorrect ground pivot: ${entry.entity}`);
    if (entry.entity === "hero" || entry.entity === "staff") assert.ok(Math.abs(entry.size[1] - 2.1) < 0.05, `adult character scale: ${entry.size}`);
    if (entry.entity === "cart") assert.ok(Math.abs(entry.size[1] - 1.615) < 0.05, `cart scale: ${entry.size}`);
  }
  assert.equal(events.requests.size, 17);
  for (const [path, count] of events.requests) assert.equal(count, 1, `model fetched repeatedly: ${path}`);
  const intro = await assertScene(page, "intro");
  await page.screenshot({ path: `${artifacts}visual-district-intro.png` });
  await page.click("#begin");
  await page.waitForFunction(() => __MERCH__.mode === "play");
  await page.waitForTimeout(600);
  const initial = await page.evaluate(() => __MERCH__.state.position);
  const movementStart = await page.evaluate(() => __MERCH__.state.time);
  await page.keyboard.down("KeyW");
  await page.waitForFunction((time) => __MERCH__.state.time > time + 0.4, movementStart, { timeout: 60000 });
  await page.keyboard.up("KeyW");
  const moved = await page.evaluate(() => __MERCH__.state.position);
  assert.ok(Math.hypot(moved.x - initial.x, moved.z - initial.z) > 0.3, "player should move with GLB hero");
  const ground = await page.evaluate(() => __MERCH__.view);
  assert.ok(Math.abs(ground.playerY - ground.groundHeight) < 0.01, "hero stands on the visible surface");
  assert.equal(ground.firstPerson, false);
  assert.equal(ground.playerVisible, true);
  await page.keyboard.press("KeyC");
  await page.waitForFunction(() => __MERCH__.view.firstPerson && !__MERCH__.view.playerVisible);
  await assertScene(page, "first-person");
  await page.keyboard.press("KeyC");
  await page.waitForFunction(() => !__MERCH__.view.firstPerson && __MERCH__.view.playerVisible);

  await page.keyboard.press("Escape");
  await page.selectOption("#quality", "high");
  await page.click("#resume");
  await page.waitForFunction(() => __MERCH__.renderer.quality === "high");
  await page.waitForTimeout(400);
  await assertScene(page, "high quality");
  await page.screenshot({ path: `${artifacts}visual-district-play.png` });
  await page.keyboard.press("Escape");
  await page.selectOption("#quality", "low");
  await page.click("#resume");
  await page.waitForFunction(() => __MERCH__.renderer.quality === "low");
  await page.waitForTimeout(1000);
  const resourcesBefore = await page.evaluate(() => __MERCH__.renderer);
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press("KeyM");
    await page.locator(".phone").waitFor({ state: "visible" });
    await page.click("#close");
    await page.keyboard.press("Escape");
    await page.locator("#resume").waitFor({ state: "visible" });
    await page.click("#resume");
  }
  await page.waitForTimeout(600);
  const resourcesAfter = await page.evaluate(() => __MERCH__.renderer);
  assert.ok(resourcesAfter.geometries <= resourcesBefore.geometries + 2, `growing geometries: ${JSON.stringify({ resourcesBefore, resourcesAfter })}`);
  assert.ok(resourcesAfter.textures <= resourcesBefore.textures + 2, `growing textures: ${JSON.stringify({ resourcesBefore, resourcesAfter })}`);
  assert.equal((await page.evaluate(() => __MERCH__.visuals)).assets.instances, visual.assets.instances);
  await page.keyboard.press("Escape"); // pause performs a real save
  const saved = await page.evaluate(() => __MERCH__.state.position);
  await page.reload({ waitUntil: "domcontentloaded" });
  await ready(page);
  const restored = await page.evaluate(() => __MERCH__.state.position);
  assert.ok(Math.hypot(saved.x - restored.x, saved.z - restored.z) < 0.01, "position survives visual-model reload");
  assert.equal((await page.evaluate(() => __MERCH__.visuals)).assets.loaded, 17);
  assertNoErrors(events);
  console.log("VISUAL MODELS / CAMERA / QUALITY / PERSISTENCE PASS", JSON.stringify({ assets: visual.assets, intro: intro.renderer, resourcesBefore, resourcesAfter }));
  await normal.context.close();

  const wallState = freshState();
  wallState.position = { x: -55, z: 14 };
  const wall = await createScenario(browser, wallState);
  await wall.page.click("#begin");
  const wallStart = await wall.page.evaluate(() => __MERCH__.state.time);
  await wall.page.keyboard.down("KeyW");
  await wall.page.waitForFunction((time) => __MERCH__.state.time > time + 0.8, wallStart, { timeout: 60000 });
  await wall.page.keyboard.up("KeyW");
  const wallPosition = await wall.page.evaluate(() => __MERCH__.state.position);
  assert.ok(wallPosition.z >= 12.79 && wallPosition.z < 13.2, `30cm character must reach, but not cross, the visible back wall: ${JSON.stringify(wallPosition)}`);
  assert.ok((await wall.page.evaluate(() => __MERCH__.view.playerY)) >= 0, "player must not fall through ground");
  assertNoErrors(wall.events);
  console.log("ORIGINAL COLLIDER PASS", wallPosition);
  await wall.context.close();

  // Drive the original entity with its GLB visual into the shop's back wall.
  // Keep the lane clear of the employee and both existing shelf colliders.
  const driveState = freshState();
  driveState.position = { x: -61, z: 25 };
  driveState.vehicles = [{ x: -58, z: 25, heading: Math.PI }];
  const drive = await createScenario(browser, driveState);
  await drive.page.setViewportSize({ width: 800, height: 600 });
  await drive.page.click("#begin");
  await drive.page.keyboard.press("KeyE");
  await drive.page.waitForFunction(() => !__MERCH__.view.playerVisible);
  const driveStart = await drive.page.evaluate(() => __MERCH__.state.time);
  await drive.page.keyboard.down("KeyW");
  await drive.page.waitForFunction((time) => __MERCH__.state.time > time + 3, driveStart, { timeout: 60000 });
  await drive.page.keyboard.up("KeyW");
  const carPosition = await drive.page.evaluate(() => __MERCH__.state.position);
  assert.ok(carPosition.z >= 14.2 && carPosition.z < 16, `vehicle must reach and stop at back wall: ${JSON.stringify(carPosition)}`);
  assert.ok(Math.abs(carPosition.x + 58) < 0.1, "straight driving keeps original heading");
  assertNoErrors(drive.events);
  console.log("VEHICLE WALL COLLISION PASS", carPosition);
  await drive.context.close();

  const rainState = freshState();
  rainState.weather = true;
  const rain = await createScenario(browser, rainState);
  await rain.page.click("#begin");
  await rain.page.waitForTimeout(600);
  assert.equal(await rain.page.evaluate(() => __MERCH__.state.weather), true);
  await assertScene(rain.page, "rain");
  await rain.page.screenshot({ path: `${artifacts}visual-district-rain.png` });
  assertNoErrors(rain.events);
  console.log("RAIN SCENE PASS");
  await rain.context.close();

  const missingState = freshState();
  missingState.position = { x: -52, z: 30 };
  missingState.carts = [{ x: -52, z: 28 }, { x: -65, z: 31 }];
  const missing = await createScenario(browser, missingState, { missingCart: true });
  const fallback = await missing.page.evaluate(() => __MERCH__.visuals);
  assert.equal(fallback.assets.loaded, 16);
  assert.equal(fallback.assets.failed, 1);
  assert.equal(fallback.replacements.filter((entry) => entry.kind === 'cart').length, 0);
  assert.equal(fallback.replacements.length, visual.replacements.length - SHOPS.reduce((n, shop) => n + shop.required, 0));
  assert.ok(missing.events.warnings.some((warning) => /\[assets\].*Cannot load cart/.test(warning)), "missing model should have one clear warning");
  await missing.page.click("#begin");
  await missing.page.keyboard.press("KeyR");
  await missing.page.waitForTimeout(300);
  assert.match(await missing.page.locator("#context").innerText(), /жёлтую зону/, "fallback cart must remain interactive");
  assert.equal(await missing.page.evaluate(() => __MERCH__.motion.heldCartId), 0);
  await missing.page.keyboard.press("KeyR");
  const fallbackBefore = await missing.page.evaluate(() => __MERCH__.state.position);
  const fallbackStart = await missing.page.evaluate(() => __MERCH__.state.time);
  await missing.page.keyboard.down("KeyA");
  await missing.page.waitForFunction((time) => __MERCH__.state.time > time + 0.35, fallbackStart, { timeout: 60000 });
  await missing.page.keyboard.up("KeyA");
  const fallbackAfter = await missing.page.evaluate(() => __MERCH__.state.position);
  assert.ok(Math.hypot(fallbackAfter.x - fallbackBefore.x, fallbackAfter.z - fallbackBefore.z) > 0.2);
  await assertScene(missing.page, "missing cart fallback");
  assertNoErrors(missing.events, { missingCart: true });
  console.log("MISSING MODEL FALLBACK PASS", JSON.stringify(fallback.assets));
  await missing.context.close();
  console.log(`VISUAL UPGRADE PASS; screenshots: ${artifacts}`);
} finally {
  await browser?.close();
  service.kill("SIGTERM");
}
