import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Box3, Vector3 } from 'three';

test('three distinct original vehicle GLBs have rolling axles, door pivots and finite bodies', async () => {
  const vertices = new Set();
  for (const name of ['suv', 'van', 'truck']) {
    const bytes = await readFile(new URL(`../public/models/vehicles/${name}.glb`, import.meta.url));
    const asset = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
    const wheels = [], doors = [];
    let count = 0, provenance = false;
    asset.scene.traverse((node) => {
      if (/^VehicleWheel(?:Front|Rear|Back)(?:Left|Right)$/.test(node.name)) wheels.push(node);
      if (node.name === 'DoorLeft' || node.name === 'DoorRight') doors.push(node);
      if (node.isMesh) count += node.geometry.attributes.position.count;
      if (node.userData.provenance?.includes('CC0-1.0')) provenance = true;
    });
    assert.equal(wheels.length, name === 'truck' ? 6 : 4);
    assert.equal(doors.length, 2);
    assert.ok(provenance);
    assert.ok(count > 1000);
    vertices.add(count);
    const bounds = new Box3().setFromObject(asset.scene), size = bounds.getSize(new Vector3());
    assert.ok(bounds.min.y > -0.02 && bounds.min.y < 0.02);
    assert.ok(size.z > size.x && size.y > 1.8);
    assert.ok(wheels.every((wheel) => wheel.children.length > 0));
  }
  assert.equal(vertices.size, 3, 'different vehicle geometry rather than color aliases');
});
