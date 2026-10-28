import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:net';
import { mkdir } from 'node:fs/promises';
import { circleIntersectsBox } from '../src/spatial.js';
export const root = fileURLToPath(new URL('../', import.meta.url));
export const artifacts = fileURLToPath(new URL('../.playwright/', import.meta.url));
export async function startBrowser(port = 5204) {
  await mkdir(artifacts, { recursive: true });
  await new Promise((resolve, reject) => { const s = createServer(); s.once('error', reject); s.listen(port, '127.0.0.1', () => s.close(resolve)); });
  const service = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: root, stdio: 'ignore' });
  const url = `http://127.0.0.1:${port}`;
  let browser;
  try {
    for (let n = 0; n < 100; n++) { try { if ((await fetch(url)).ok) break; } catch {} await new Promise((r) => setTimeout(r, 100)); }
    browser = await chromium.launch({ executablePath: process.env.BROWSER_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined), headless: true,
      args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
  } catch (error) { service.kill(); throw error; }
  const errors = [];
  return {
    errors,
    async scenario(state, name) {
      const context = await browser.newContext({ viewport: { width: 900, height: 700 } });
      await context.addInitScript(({ state, name }) => {
        if (sessionStorage.getItem(name)) return;
        localStorage.setItem('merch-badday-v1', JSON.stringify(state));
        localStorage.setItem('merch-settings', JSON.stringify({ quality: 'low', volume: 0, sensitivity: 1 }));
        sessionStorage.setItem(name, '1');
      }, { state, name });
      const page = await context.newPage(); page.setDefaultTimeout(60000);
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
      await page.goto(url); await page.locator('#begin').waitFor(); await page.click('#begin');
      await page.waitForFunction(() => __MERCH__.view.pointerLocked);
      return { context, page };
    },
    async close() { await browser.close(); service.kill('SIGTERM'); },
  };
}
export async function advance(page, seconds) {
  const start = await page.evaluate(() => __MERCH__.state.time);
  await page.waitForFunction(({ start, seconds }) => __MERCH__.state.time >= start + seconds, { start, seconds }, { timeout: 90000 });
}
export async function hold(page, keys, seconds) {
  for (const key of keys) await page.keyboard.down(key);
  try { await advance(page, seconds); } finally { for (const key of keys.reverse()) await page.keyboard.up(key); }
}
export async function walkTo(page, x, z, tolerance = 0.35, maxSteps = 160) {
  await page.waitForFunction(() => __MERCH__.mode === 'play' && __MERCH__.view.pointerLocked);
  for (let n = 0; n < maxSteps; n++) {
    const { p, yaw } = await page.evaluate(() => ({ p: __MERCH__.state.position, yaw: __MERCH__.view.cameraYaw }));
    const dx = x - p.x, dz = z - p.z;
    if (Math.hypot(dx, dz) < tolerance) return;
    const forward = -Math.sin(yaw) * dx - Math.cos(yaw) * dz, side = Math.cos(yaw) * dx - Math.sin(yaw) * dz;
    const keys = ['ShiftLeft'];
    if (Math.abs(forward) > Math.max(.04, Math.abs(side) * .4142)) keys.push(forward > 0 ? 'KeyW' : 'KeyS');
    if (Math.abs(side) > Math.max(.04, Math.abs(forward) * .4142)) keys.push(side > 0 ? 'KeyD' : 'KeyA');
    await hold(page, keys, Math.hypot(dx, dz) < 0.9 ? 0.04 : 0.17);
  }
  throw new Error(`Walk blocked at ${JSON.stringify(await page.evaluate(() => __MERCH__.state.position))}; goal ${x},${z}`);
}
function path(start, goal, obstacles) {
  const step = 0.25, margin = 6;
  const minX = start.x - Math.ceil((Math.max(0, start.x - goal.x) + margin) / step) * step;
  const minZ = start.z - Math.ceil((Math.max(0, start.z - goal.z) + margin) / step) * step;
  const width = Math.ceil((Math.abs(start.x - goal.x) + margin * 2) / step) + 2;
  const height = Math.ceil((Math.abs(start.z - goal.z) + margin * 2) / step) + 2;
  const blocked = (point) => point.x < -247 || point.x > 249 || point.z < -137 || point.z > 103 || obstacles.some((box) => circleIntersectsBox(point.x, point.z, 0.36, box));
  const visible = (a, b) => {
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.18));
    for (let i = 1; i <= n; i++) if (blocked({ x: a.x + (b.x - a.x) * i / n, z: a.z + (b.z - a.z) * i / n })) return false;
    return true;
  };
  if (visible(start, goal)) return [goal];
  const encode = (x, z) => `${x},${z}`;
  const point = (node) => ({ x: minX + node.x * step, z: minZ + node.z * step });
  const first = { x: Math.round((start.x - minX) / step), z: Math.round((start.z - minZ) / step), cost: 0, previous: null };
  const open = [first], known = new Map([[encode(first.x, first.z), first]]), closed = new Set();
  let found;
  while (open.length) {
    open.sort((a, b) => a.cost + Math.hypot(point(a).x - goal.x, point(a).z - goal.z) - b.cost - Math.hypot(point(b).x - goal.x, point(b).z - goal.z));
    const current = open.shift(), key = encode(current.x, current.z);
    if (closed.has(key)) continue; closed.add(key);
    const p = point(current);
    if (Math.hypot(p.x - goal.x, p.z - goal.z) < 0.75 && visible(p, goal)) { found = current; break; }
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      if (!dx && !dz) continue;
      const x = current.x + dx, z = current.z + dz;
      if (x < 0 || z < 0 || x >= width || z >= height) continue;
      const nextKey = encode(x, z); if (closed.has(nextKey)) continue;
      const next = { x, z }, np = point(next);
      if (blocked(np) || !visible(p, np)) continue;
      const cost = current.cost + Math.hypot(dx, dz) * step;
      if (!known.has(nextKey) || known.get(nextKey).cost > cost) {
        const node = { ...next, cost, previous: current }; known.set(nextKey, node); open.push(node);
      }
    }
  }
  if (!found) throw new Error(`No walking route from ${JSON.stringify(start)} to ${JSON.stringify(goal)}`);
  const points = [goal]; for (let node = found; node; node = node.previous) points.unshift(point(node));
  const short = []; let current = start, index = 0;
  while (index < points.length) {
    let far = index; for (let j = index + 1; j < points.length && visible(current, points[j]); j++) far = j;
    short.push(points[far]); current = points[far]; index = far + 1;
  }
  return short;
}
export async function navigate(page, x, z, tolerance = 0.35) {
  const data = await page.evaluate(() => ({ position: __MERCH__.state.position, obstacles: __MERCH__.navigation.obstacles }));
  const route = path(data.position, { x, z }, data.obstacles);
  for (let i = 0; i < route.length; i++) await walkTo(page, route[i].x, route[i].z, i === route.length - 1 ? tolerance : 0.1);
}
export async function report(page, shop) {
  for (let n = 0; n < 12; n++) {
    const director = await page.evaluate((id) => __MERCH__.people.find((n) => n.kind === 'staff' && n.shop === id), shop);
    const position = await page.evaluate(() => __MERCH__.state.position);
    if (Math.hypot(director.position[0] - position.x, director.position[2] - position.z) < 2.7) break;
    await navigate(page, director.position[0], director.position[2], 1.5);
  }
  await page.keyboard.press('KeyE'); await page.locator('[data-choice="polite"]').waitFor();
  await page.click('[data-choice="polite"]');
  await page.waitForFunction((id) => __MERCH__.state.shops[id].done, shop);
  await page.waitForFunction(() => __MERCH__.view.pointerLocked);
}
