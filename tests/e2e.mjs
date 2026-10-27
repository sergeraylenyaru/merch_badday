import { chromium } from "playwright";
import { freshState, SHOPS } from "../src/state.js";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
const service = spawn(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    "--host",
    "127.0.0.1",
    "--port",
    "5188",
    "--strictPort",
  ],
  { stdio: "ignore" },
);
const url = "http://127.0.0.1:5188";
let browser;
try {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(url)).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  browser = await chromium.launch({
    executablePath:
      process.env.BROWSER_PATH ||
      (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
    headless: true,
    args: [
      "--no-sandbox",
      "--enable-unsafe-swiftshader",
      "--use-angle=swiftshader",
    ],
  });
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(url);
  const fixture = freshState();
  fixture.position = { x: -52, z: 30 };
  fixture.carts = [
    { x: -52, z: 28 },
    { x: -65, z: 31 },
  ];
  await page.addInitScript((s) => {
    if (!sessionStorage.getItem("fixture-seeded")) {
      localStorage.setItem("merch-badday-v1", JSON.stringify(s));
      localStorage.setItem(
        "merch-settings",
        JSON.stringify({ quality: "low", volume: 0, sensitivity: 1 }),
      );
      sessionStorage.setItem("fixture-seeded", "1");
    }
  }, fixture);
  await page.reload();
  await page.waitForSelector("#begin");
  await page.click("#begin");
  await page.keyboard.press("KeyR");
  await page.waitForTimeout(500);
  assert.match(await page.locator("#context").innerText(), /Отпустить/);
  async function walk(x, z, tolerance = 1.3) {
    for (let i = 0; i < 90; i++) {
      const p = await page.evaluate(() => __MERCH__.state.position);
      const dx = x - p.x,
        dz = z - p.z;
      if (Math.hypot(dx, dz) < tolerance) return;
      const f = -Math.sin(0.25) * dx - Math.cos(0.25) * dz,
        s = Math.cos(0.25) * dx - Math.sin(0.25) * dz;
      const list = [];
      if (Math.abs(f) > 0.5) list.push(f > 0 ? "KeyW" : "KeyS");
      if (Math.abs(s) > 0.5) list.push(s > 0 ? "KeyD" : "KeyA");
      for (const k of list) await page.keyboard.down(k);
      const start = await page.evaluate(() => __MERCH__.state.time);
      await page.waitForFunction((time) => __MERCH__.state.time > time + 0.12, start, { timeout: 60000 });
      for (const k of list) await page.keyboard.up(k);
    }
    throw Error(
      "Walk failed " +
        JSON.stringify(await page.evaluate(() => __MERCH__.state.position)),
    );
  }
  await walk(-63, 32);
  await page.keyboard.press("KeyR");
  await page.waitForTimeout(600);
  console.log("CARTS", await page.evaluate(() => __MERCH__.state.shops[0]));
  assert.equal(await page.evaluate(() => __MERCH__.state.shops[0].carts), 2);
  await walk(-54, 34);
  await walk(-55, 19);
  await page.keyboard.press("KeyE");
  await page.waitForSelector('[data-choice="badge"]');
  await page.click('[data-choice="badge"]');
  await page.keyboard.press("KeyE");
  await page.waitForSelector('[data-choice="polite"]');
  await page.click('[data-choice="polite"]');
  console.log(
    "DIALOGUE RESULT",
    await page.evaluate(() => __MERCH__.state.shops[0]),
    await page.locator("#toast").innerText(),
  );
  assert.equal(await page.evaluate(() => __MERCH__.state.shops[0].done), true);
  console.log("SHOP COMPLETED");
  await walk(-42, 32, 0.4);
  await page.keyboard.press("KeyE");
  await page.waitForFunction(() => __MERCH__.vehicles.some((vehicle) => vehicle.controlled));
  await page.waitForFunction(() => document.querySelector('#speed').textContent.includes('км'));
  assert.match(await page.locator("#speed").innerText(), /км/);
  const before = await page.evaluate(() => __MERCH__.state.position);
  const driveStart = await page.evaluate(() => __MERCH__.state.time);
  await page.keyboard.down("KeyW");
  await page.waitForFunction((time) => __MERCH__.state.time > time + 0.65, driveStart, { timeout: 60000 });
  await page.keyboard.up("KeyW");
  const after = await page.evaluate(() => __MERCH__.state.position);
  assert.ok(Math.hypot(after.x - before.x, after.z - before.z) > 0.5);
  await page.keyboard.press("KeyE");
  await page.waitForFunction(() => document.querySelector('#speed').textContent === '');
  assert.equal(await page.locator("#speed").innerText(), "");
  console.log("VEHICLE", before, after);
  await page.keyboard.press("KeyM");
  await page.waitForSelector(".phone");
  await page.click('[data-tab="Маршрут"]');
  assert.match(
    await page.locator('[data-shop="0"]').innerText(),
    /подтверждён/,
  );
  await page.reload();
  await page.waitForSelector("#begin");
  assert.equal(await page.evaluate(() => __MERCH__.state.shops[0].done), true);
  console.log("PERSISTENCE PASS", errors);
  await page.close();
  async function scenario(s) {
    const p = await browser.newPage({ viewport: { width: 800, height: 650 } });
    p.on("pageerror", (e) => errors.push(e.message));
    await p.addInitScript((s) => {
      localStorage.setItem("merch-badday-v1", JSON.stringify(s));
      localStorage.setItem(
        "merch-settings",
        JSON.stringify({ quality: "low", volume: 0, sensitivity: 1 }),
      );
    }, s);
    await p.goto(url);
    await p.waitForSelector("#begin");
    await p.click("#begin");
    await p.waitForTimeout(300);
    return p;
  }

  let s = freshState();
  s.position = { x: -47, z: -56 };
  let p = await scenario(s);
  await p.keyboard.press("KeyE");
  await p.waitForSelector(".shelfitems");
  await p.click('[data-item="0"]');
  await p.click('[data-item="1"]');
  await p.click('[data-item="1"]');
  await p.click('[data-item="2"]');
  assert.equal(await p.evaluate(() => __MERCH__.state.shops[1].shelf), true);
  console.log("SHELF PASS");
  await p.close();
  s = freshState();
  s.position = { x: 11, z: -44 };
  s.carts = SHOPS.flatMap((shop) =>
    Array.from({ length: shop.required }, (_, i) => ({
      x: shop.x - 11 + (i % 3) * 2,
      z: shop.z + 10 + Math.floor(i / 3) * 2,
    })),
  );
  p = await scenario(s);
  await p.keyboard.press("KeyM");
  await p.waitForSelector(".phone");
  await p.click('[data-tab="Фото"]');
  await p.click("#takePhoto");
  await p.waitForSelector("#photoResult img");
  assert.equal(await p.evaluate(() => __MERCH__.state.shops[2].photo), true);
  console.log("PHOTO PASS");
  await p.close();
  s = freshState();
  s.position = { x: -55, z: 20 };
  p = await scenario(s);
  await p.keyboard.press("KeyF");
  await p.waitForTimeout(500);
  assert.ok(await p.evaluate(() => __MERCH__.state.wanted >= 1));
  assert.equal(await p.evaluate(() => __MERCH__.state.conflicts), 1);
  await p.keyboard.press("Escape");
  await p.waitForSelector("#finish");
  await p.click("#finish");
  assert.equal(await p.evaluate(() => __MERCH__.mode), "end");
  assert.ok(await p.locator("#restart").count());
  console.log("COMBAT/WANTED/ENDING PASS");
  await p.close();

  assert.deepEqual(errors, []);
} finally {
  await browser?.close();
  service.kill();
}
