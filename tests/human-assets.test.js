import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Box3, Group, Vector3 } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { AssetLibrary } from "../src/visuals/assets.js";
import { createCharacterMotion } from "../src/visuals/character-motion.js";

async function load(name) {
  const bytes = await readFile(new URL(`../public/models/characters/${name}.glb`, import.meta.url));
  return new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "");
}

test("both licensed human models contain real skins and changing recorded locomotion tracks", async () => {
  for (const name of ["merch-male", "civilian-female"]) {
    const asset = await load(name);
    let skins = 0, artist = false;
    asset.scene.traverse((node) => {
      if (node.isSkinnedMesh) skins++;
      if (node.userData.artist === "Quaternius" && node.userData.license === "CC0-1.0") artist = true;
    });
    assert.ok(skins >= 4);
    assert.ok(artist);
    for (const clip of ["Idle", "Walk", "Run", "Sprint", "Crouch", "Jump"]) {
      const animation = asset.animations.find((a) => a.name === clip);
      assert.ok(animation && animation.duration > 0.3 && animation.tracks.length > 20, `real ${clip} clip`);
    }
    const knee = asset.animations.find((a) => a.name === "Walk").tracks.find((t) => t.name.endsWith("LeftKnee.quaternion"));
    assert.ok(knee);
    assert.ok(Math.max(...knee.values) - Math.min(...knee.values) > 0.1, "walk must animate actual joint rotations");
  }
});

test("merch wears a blue T-shirt, black trousers and a two-strap backpack", async () => {
  const asset = await load("merch-male");
  const materials = new Map(), names = [];
  asset.scene.traverse((node) => {
    names.push(node.name);
    if (node.isMesh) for (const m of Array.isArray(node.material) ? node.material : [node.material]) materials.set(m.name, m);
  });
  assert.equal(materials.get("Merch_BlueTShirt").color.getHexString(), "225ab5");
  assert.equal(materials.get("Merch_BlackTrousers").color.getHexString(), "17191e");
  assert.ok(names.some((name) => name === "Backpack"));
  assert.equal(names.filter((name) => name.startsWith("Backpack_ShoulderStrap")).length, 2);
  assert.ok(!names.some((name) => /satchel|shoulder.bag/i.test(name)));
});

test("real skinned rig plays recorded walking/running and still reaches both cart contacts", async () => {
  const source = await load("merch-male");
  const library = new AssetLibrary({ human: { url: "fixture:human" } }, { loader: { loadAsync: async () => source }, logger: { info() {}, warn() {} } });
  await library.preload();
  const model = library.instantiate("human", { height: 2.1 });
  const root = new Group();
  root.add(model);
  const motion = createCharacterMotion({ mesh: root }, model);
  for (let i = 0; i < 40; i++) motion.update(1 / 60, { velocity: new Vector3(0, 0, 2.8), grounded: true });
  assert.equal(motion.diagnostics.animation.clip, "Walk");
  assert.ok(motion.diagnostics.animation.weights.Walk > 0.9);
  for (let i = 0; i < 40; i++) motion.update(1 / 60, { velocity: new Vector3(0, 0, 6.8), grounded: true });
  assert.equal(motion.diagnostics.animation.clip, "Sprint");
  const cart = new Group();
  cart.position.z = 1.32;
  for (const [side, name] of [[-1, "CartHandleLeft"], [1, "CartHandleRight"]]) {
    const contact = new Group();
    contact.name = name;
    contact.position.set(side * 0.4186046, 1.5697675, -0.8272425);
    cart.add(contact);
  }
  for (let i = 0; i < 60; i++) motion.update(1 / 60, { heldCart: cart, velocity: new Vector3(), grounded: true });
  assert.equal(motion.diagnostics.gripErrors.length, 2);
  for (const error of motion.diagnostics.gripErrors) assert.ok(error < 0.01, `real palm contact error ${error}`);
  assert.deepEqual(root.position.toArray(), [0, 0, 0]);
  library.dispose();
});

test('actual deformed boots stay above a raised floor through walking, sprinting and crouching', async () => {
  const source = await load('merch-male');
  const library = new AssetLibrary({ human: { url: 'fixture:floor' } }, { loader: { loadAsync: async () => source }, logger: { info() {}, warn() {} } });
  await library.preload();
  const model = library.instantiate('human', { height: 2.1 }), root = new Group();
  root.position.y = 0.08;
  root.add(model);
  const motion = createCharacterMotion({ mesh: root }, model);
  for (const [speed, crouch] of [[2.8, false], [6.8, false], [1.7, true], [0, false]]) {
    for (let frame = 0; frame < 80; frame++) {
      root.position.z += speed / 60;
      motion.update(1 / 60, { grounded: true, crouch, velocity: new Vector3(0, 0, speed) });
      if (frame % 8 !== 0) continue;
      root.updateMatrixWorld(true);
      const bounds = new Box3().setFromObject(model, true);
      assert.ok(bounds.min.y >= root.position.y - 0.001, `boot penetrates floor: ${bounds.min.y}`);
      assert.ok(bounds.min.y <= root.position.y + 0.015, `supporting shoe floats: ${bounds.min.y}`);
    }
  }
  motion.dispose();
  library.dispose();
});
