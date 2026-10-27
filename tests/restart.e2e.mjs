import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { freshState } from "../src/state.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const port = 5194;
const url = `http://127.0.0.1:${port}`;
const settings = { quality: "low", volume: 0, sensitivity: 1.4 };

// Do not accidentally attach this test to somebody else's development server.
await new Promise((resolve, reject) => {
  const probe = createServer();
  probe.once("error", () => reject(new Error(`Port ${port} is occupied; no existing process was stopped.`)));
  probe.listen(port, "127.0.0.1", () => probe.close(resolve));
});
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

async function ready(page) {
  await page.waitForFunction(() => window.__MERCH__?.state?.version === 1, undefined, { timeout: 60000 });
  await page.locator("#begin").waitFor({ state: "visible" });
}

function savedShift() {
  const state = freshState();
  state.time = 610;
  state.health = 58;
  state.stress = 63;
  state.reputation = 78;
  state.money = 1430;
  state.bonus = 300;
  state.conflicts = 2;
  state.fines = 80;
  state.selected = 3;
  state.position = { x: -48, z: 30 };
  state.shops[0].done = true;
  state.shops[0].badge = true;
  state.shops[0].rep = 12;
  state.shops[2].photo = true;
  state.messages.push("Тестовое сохранение: маршрут уже начат.");
  return state;
}

async function scenario(browser) {
  const context = await browser.newContext({ viewport: { width: 800, height: 600 } });
  await context.addInitScript(({ state, preferences }) => {
    // Seed only the first navigation. Reseeding on reload would conceal a
    // broken restart or bring the old shift back independently of the app.
    if (sessionStorage.getItem("restart-fixture")) return;
    localStorage.setItem("merch-badday-v1", JSON.stringify(state));
    localStorage.setItem("merch-settings", JSON.stringify(preferences));
    sessionStorage.setItem("restart-fixture", "1");
  }, { state: savedShift(), preferences: settings });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await ready(page);
  assert.match(await page.locator("#begin").innerText(), /ПРОДОЛЖИТЬ СМЕНУ/);
  assert.equal(await page.locator("#newShift").count(), 1);
  return { context, page, errors };
}

async function confirmReset(page, selector, accept) {
  const dialogHandled = new Promise((resolve, reject) => {
    page.once("dialog", async (dialog) => {
      try {
        assert.equal(dialog.type(), "confirm");
        assert.match(dialog.message(), /Начать новую смену/);
        assert.match(dialog.message(), /Настройки останутся/);
        if (accept) await dialog.accept();
        else await dialog.dismiss();
        resolve();
      } catch (error) { reject(error); }
    });
  });
  const navigated = accept
    ? page.waitForEvent("framenavigated", { predicate: (frame) => frame === page.mainFrame() })
    : null;
  await page.click(selector);
  await dialogHandled;
  if (navigated) {
    await navigated;
    await page.waitForLoadState("domcontentloaded");
    await ready(page);
  }
}

async function assertNewShift(page) {
  const actual = await page.evaluate(() => __MERCH__.state);
  const expected = freshState();
  for (const field of [
    "time", "health", "stress", "reputation", "money", "wanted", "conflicts",
    "fines", "bonus", "energy", "selected", "ending", "weather",
  ]) assert.equal(actual[field], expected[field], `fresh field: ${field}`);
  assert.deepEqual(actual.position, expected.position, "fresh starting position");
  assert.deepEqual(actual.shops, expected.shops, "quests, badges, photos and reputation reset");
  assert.deepEqual(actual.messages, expected.messages, "old messages reset");
  assert.equal(await page.evaluate(() => __MERCH__.mode), "intro");
  assert.match(await page.locator("#begin").innerText(), /ВЫЙТИ НА МАРШРУТ/);
  assert.equal(await page.locator("#newShift").count(), 0);
  assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem("merch-settings"))), settings);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("merch-badday-v1")));
  if (stored) {
    assert.equal(stored.time, 0, "pagehide must not restore the old shift");
    assert.equal(stored.money, 300);
    assert.ok(stored.shops.every((shop) => !shop.done && !shop.badge && !shop.photo));
  }
}

let browser;
try {
  await waitForService();
  browser = await chromium.launch({
    executablePath: process.env.BROWSER_PATH || (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
    headless: true,
    args: ["--no-sandbox", "--enable-unsafe-swiftshader", "--use-angle=swiftshader"],
  });

  const intro = await scenario(browser);
  const initial = await intro.page.evaluate(() => __MERCH__.state);
  await confirmReset(intro.page, "#newShift", false);
  assert.deepEqual(await intro.page.evaluate(() => __MERCH__.state), initial, "cancel keeps saved shift");
  assert.deepEqual(await intro.page.evaluate(() => JSON.parse(localStorage.getItem("merch-settings"))), settings);
  await confirmReset(intro.page, "#newShift", true);
  await assertNewShift(intro.page);
  // A second ordinary reload catches the old pagehide-snapshot race.
  await intro.page.reload({ waitUntil: "domcontentloaded" });
  await ready(intro.page);
  await assertNewShift(intro.page);
  assert.deepEqual(intro.errors, [], "intro restart browser errors");
  console.log("INTRO NEW SHIFT / CANCEL / RELOAD / SETTINGS PASS");
  await intro.context.close();

  const pause = await scenario(browser);
  await pause.page.click("#begin");
  await pause.page.waitForFunction(() => __MERCH__.mode === "play");
  await pause.page.keyboard.press("Escape");
  await pause.page.locator("#new").waitFor({ state: "visible" });
  const paused = await pause.page.evaluate(() => __MERCH__.state);
  await confirmReset(pause.page, "#new", false);
  assert.deepEqual(await pause.page.evaluate(() => __MERCH__.state), paused, "cancel keeps paused shift");
  await confirmReset(pause.page, "#new", true);
  await assertNewShift(pause.page);
  assert.deepEqual(pause.errors, [], "pause restart browser errors");
  console.log("PAUSE NEW SHIFT / CANCEL / SETTINGS PASS");
  await pause.context.close();
} finally {
  await browser?.close();
  service.kill("SIGTERM");
}
