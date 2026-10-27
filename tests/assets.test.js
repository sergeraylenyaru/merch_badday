import { test } from "node:test";
import assert from "node:assert/strict";
import { Bone, Box3, BoxGeometry, Float32BufferAttribute, Group, Mesh, MeshStandardMaterial, Skeleton, SkinnedMesh, Texture, Uint16BufferAttribute, Vector3 } from "three";
import { AssetLibrary } from "../src/visuals/assets.js";

function fixture() {
  const scene = new Group();
  const texture = new Texture();
  const material = new MeshStandardMaterial({ map: texture });
  const geometry = new BoxGeometry(2, 4, 6);
  const mesh = new Mesh(geometry, material);
  mesh.position.set(8, 10, -3);
  scene.add(mesh);
  return { scene, texture, material, geometry };
}
const quiet = { warn() {}, info() {} };

test("GLB aliases and concurrent preload share one request; clones fit rotated floor bounds", async () => {
  const source = fixture();
  let requests = 0;
  const library = new AssetLibrary({
    car: { url: "/car.glb", rotationY: Math.PI / 2, size: [3, 2, 1] },
    duplicate: { url: "/car.glb" },
  }, { loader: { async loadAsync() { requests++; return source; } }, logger: quiet });
  await Promise.all([library.preload(["car", "duplicate"]), library.load("car")]);
  assert.equal(requests, 1);
  const a = library.instantiate("car");
  const b = library.instantiate("car");
  assert.notEqual(a, b);
  const bounds = new Box3().setFromObject(a);
  const extent = bounds.getSize(new Vector3());
  assert.ok(Math.abs(extent.x - 3) < 1e-8);
  assert.ok(Math.abs(extent.y - 2) < 1e-8);
  assert.ok(Math.abs(extent.z - 1) < 1e-8);
  assert.ok(Math.abs(bounds.min.y) < 1e-8);
  assert.ok(bounds.getCenter(new Vector3()).distanceTo(new Vector3(0, 1, 0)) < 1e-8);
  assert.equal(a.children[0].children[0].children[0].geometry, source.geometry);
  assert.equal(a.children[0].children[0].children[0].material, source.material);
  a.position.set(100, 0, 0);
  assert.equal(b.position.x, 0);
  assert.equal(source.scene.children[0].position.x, 8);
  assert.equal(library.metrics.instances, 2);
  library.dispose();
});

test("failed models keep fallback, warn once, and never refetch a failed URL", async () => {
  let requests = 0;
  const warnings = [];
  const library = new AssetLibrary({ cart: { url: "/missing.glb" } }, {
    loader: { async loadAsync() { requests++; throw new Error("HTTP 404"); } },
    logger: { warn: (message) => warnings.push(message) },
  });
  assert.equal(await library.load("cart"), null);
  assert.equal(await library.load("cart"), null);
  assert.equal(library.instantiate("cart"), null);
  assert.equal(requests, 1);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /HTTP 404.*fallback/);
  assert.equal(library.metrics.failed, 1);
  library.dispose();
});

test("release keeps shared geometry/material/texture alive; teardown disposes each once", async () => {
  const source = fixture();
  const counts = { geometry: 0, material: 0, texture: 0 };
  for (const name of Object.keys(counts)) source[name].addEventListener("dispose", () => counts[name]++);
  const secondMesh = source.scene.children[0].clone();
  source.scene.add(secondMesh);
  const library = new AssetLibrary({ tree: { url: "/tree.glb" } }, {
    loader: { async loadAsync() { return source; } }, logger: quiet,
  });
  await library.preload();
  const a = library.instantiate("tree");
  const b = library.instantiate("tree");
  const parent = new Group();
  parent.add(a, b);
  library.release(a);
  assert.equal(a.parent, null);
  assert.equal(parent.children.length, 1);
  assert.deepEqual(counts, { geometry: 0, material: 0, texture: 0 });
  assert.equal(library.metrics.instances, 1);
  library.dispose();
  library.dispose();
  assert.equal(b.parent, null);
  assert.deepEqual(counts, { geometry: 1, material: 1, texture: 1 });
  assert.equal(library.instantiate("tree"), null);
});

test("teardown also disposes an in-flight model when its load completes", async () => {
  const source = fixture();
  let disposed = 0;
  source.geometry.addEventListener("dispose", () => disposed++);
  let resolve;
  const library = new AssetLibrary({ tree: { url: "/tree.glb" } }, {
    loader: { loadAsync() { return new Promise((r) => { resolve = r; }); } }, logger: quiet,
  });
  const load = library.load("tree");
  await Promise.resolve();
  library.dispose();
  resolve(source);
  assert.equal(await load, null);
  assert.equal(disposed, 1);
  assert.equal(library.metrics.instances, 0);
});

test("rigged instances have independent bones and release only their own skeleton textures", async () => {
  const source = fixture();
  source.scene.clear();
  const count = source.geometry.attributes.position.count;
  source.geometry.setAttribute("skinIndex", new Uint16BufferAttribute(new Uint16Array(count * 4), 4));
  const weights = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) weights[i * 4] = 1;
  source.geometry.setAttribute("skinWeight", new Float32BufferAttribute(weights, 4));
  const skinned = new SkinnedMesh(source.geometry, source.material);
  const bone = new Bone();
  skinned.add(bone);
  skinned.bind(new Skeleton([bone]));
  source.scene.add(skinned);
  const library = new AssetLibrary({ person: { url: "/person.glb" } }, {
    loader: { async loadAsync() { return source; } }, logger: quiet,
  });
  await library.preload();
  const a = library.instantiate("person");
  const b = library.instantiate("person");
  const findSkin = (root) => { let result; root.traverse((node) => { if (node.isSkinnedMesh) result = node; }); return result; };
  const skinA = findSkin(a), skinB = findSkin(b);
  assert.notEqual(skinA.skeleton, skinB.skeleton);
  assert.notEqual(skinA.skeleton.bones[0], skinB.skeleton.bones[0]);
  skinA.skeleton.bones[0].rotation.x = 0.5;
  assert.ok(Math.abs(skinB.skeleton.bones[0].rotation.x) < 1e-8);
  assert.ok(Math.abs(bone.rotation.x) < 1e-8);
  let disposedA = 0, disposedB = 0;
  skinA.skeleton.boneTexture = new Texture();
  skinB.skeleton.boneTexture = new Texture();
  skinA.skeleton.boneTexture.addEventListener("dispose", () => disposedA++);
  skinB.skeleton.boneTexture.addEventListener("dispose", () => disposedB++);
  library.release(a);
  assert.equal(disposedA, 1);
  assert.equal(disposedB, 0);
  library.dispose();
  assert.equal(disposedA, 1);
  assert.equal(disposedB, 1);
});
