import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { freshState } from "../src/state.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const port = 5198, url = `http://127.0.0.1:${port}`;
await new Promise((resolve, reject) => {
  const probe = createServer();
  probe.once("error", reject);
  probe.listen(port, "127.0.0.1", () => probe.close(resolve));
});
const service = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", String(port), "--strictPort"], { cwd: root, stdio: "ignore" });
let browser;
try {
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(url)).ok) break; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  browser = await chromium.launch({
    executablePath: process.env.BROWSER_PATH || (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
    headless: true, args: ["--no-sandbox", "--enable-unsafe-swiftshader", "--use-angle=swiftshader"],
  });
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  page.setDefaultTimeout(60000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  const state = freshState();
  state.position = { x: -55, z: 19 };
  await page.addInitScript((state) => {
    localStorage.setItem("merch-badday-v1", JSON.stringify(state));
    localStorage.setItem("merch-settings", JSON.stringify({ quality: "low", volume: 0, sensitivity: 1 }));
  }, state);
  await page.goto(url);
  await page.locator("#begin").waitFor();
  assert.equal(await page.evaluate(() => document.pointerLockElement), null);
  async function locked() {
    await page.waitForFunction(() => __MERCH__.mode === "play" && __MERCH__.view.pointerLocked && document.body.classList.contains("mouse-captured"));
    assert.equal(await page.evaluate(() => document.pointerLockElement === document.querySelector("canvas.scene")), true);
    assert.equal(await page.locator("body").evaluate((el) => el.classList.contains("mouse-captured")), true);
  }
  async function released(mode) {
    await page.waitForFunction((mode) => __MERCH__.mode === mode && !document.pointerLockElement, mode);
    assert.equal(await page.locator("body").evaluate((el) => el.classList.contains("mouse-captured")), false);
  }
  await page.click("#begin");
  await locked();
  const before = await page.evaluate(() => __MERCH__.view.cameraYaw);
  await page.mouse.move(550, 300);
  await page.waitForFunction((yaw) => Math.abs(__MERCH__.view.cameraYaw - yaw) > 0.02, before);
  await page.keyboard.press("KeyE");
  await page.locator("[data-choice=badge]").waitFor();
  await released("dialogue");
  const inDialog = await page.evaluate(() => __MERCH__.view.cameraYaw);
  await page.mouse.move(100, 150);
  assert.equal(await page.evaluate(() => __MERCH__.view.cameraYaw), inDialog, "UI pointer must not turn the camera");
  await page.click("#close");
  await locked();
  await page.keyboard.press("KeyM");
  await page.locator(".phone").waitFor();
  await released("phone");
  await page.click('[data-tab="Карта"]');
  assert.equal(await page.locator("#bigmap").count(), 1);
  await page.click("#close");
  await locked();
  await page.keyboard.press("Escape");
  await page.locator("#resume").waitFor();
  await released("pause");
  await page.click("#resume");
  await locked();
  // Browser-initiated loss (e.g. Esc/browser chrome) must pause immediately.
  await page.evaluate(() => document.exitPointerLock());
  await page.locator("#resume").waitFor();
  await released("pause");
  await page.click("#resume");
  await locked();
  assert.deepEqual(errors, []);
  console.log("AUTOMATIC POINTER CAPTURE / CAMERA / DIALOGUE / PHONE / PAUSE / LOSS AND RESUME PASS");
} finally {
  await browser?.close();
  service.kill("SIGTERM");
}
