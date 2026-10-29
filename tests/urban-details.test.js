import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const catalogUrl = new URL('../src/city/urban-details.js', import.meta.url);
const cityUrl = new URL('../src/city/reference-city.js', import.meta.url);

test('urban library covers all 19 requested asset families with reusable model ids', async () => {
  const source = await readFile(catalogUrl, 'utf8');
  const categories = [...source.matchAll(/\['([^']+)',\s*'[^']+',\s*'([^']+)'\]/g)];
  assert.equal(categories.length, 19);
  const ids = categories.flatMap(([, , list]) => list.split(/\s+/));
  assert.ok(ids.length >= 180, 'catalog should provide broad model coverage');
  for (const id of [
    'apartment-5', 'apartment-9', 'arched-building', 'intercom', 'wheelchair-ramp',
    'traffic-light', 'bridge-pier', 'birch', 'spruce', 'bench-wood', 'slide',
    'pharmacy', 'storefront', 'self-checkout', 'tea-box', 'loaded-pallet',
    'forklift', 'director-desk', 'handheld-terminal', 'police-patrol', 'baby-stroller',
    'fire-hydrant', 'transformer-hut',
  ]) assert.ok(ids.includes(id), 'missing asset: ' + id);
  assert.match(source, /export function createUrbanAsset/);
  assert.match(source, /export function createUrbanDetails/);
  assert.match(source, /new T\.InstancedMesh/);
});

test('reference city mounts and releases the expanded urban asset layer', async () => {
  const source = await readFile(cityUrl, 'utf8');
  assert.match(source, /import \{ createUrbanDetails \} from '\.\/urban-details\.js'/);
  assert.match(source, /createUrbanDetails\(scene,world,point\)/);
  assert.match(source, /urbanDetails:urbanDetails\.diagnostics/);
  assert.match(source, /urbanDetails\.dispose\(\)/);
});
