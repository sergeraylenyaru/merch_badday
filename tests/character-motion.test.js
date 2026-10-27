import test from "node:test";
import assert from "node:assert/strict";
import { Group, Quaternion, Vector3 } from "three";
import { createCharacterMotion } from "../src/visuals/character-motion.js";

function node(parent, name, position) {
  const group = new Group();
  group.name = name;
  group.position.fromArray(position);
  parent.add(group);
  return group;
}

function fixture({ heading = 0, scale = 1, parentScale = 1 } = {}) {
  const scene = new Group();
  scene.position.set(7, 0, -3);
  scene.rotation.y = 0.37;
  scene.scale.setScalar(parentScale);
  const mesh = node(scene, "Entity", [-5, 0, 4]);
  mesh.rotation.y = heading;
  const model = node(mesh, "NormalizedModel", [0, 0, 0]);
  const normalized = node(model, "FloorNormalized", [0, 0, -0.05625 * scale]);
  normalized.scale.setScalar(scale);
  const spine = node(normalized, "Spine", [0, 1.2, 0]);
  node(spine, "Head", [0, 0.74, 0]);
  for (const [side, name] of [[-1, "Left"], [1, "Right"]]) {
    const hip = node(normalized, `${name}Leg`, [side * 0.174, 1.1, 0]);
    const knee = node(hip, `${name}Knee`, [0, -0.49, 0]);
    const foot = node(knee, `${name}Foot`, [0, -0.42, 0.015]);
    node(foot, `FootContact${name}`, [0, -0.17, 0.085]);
    const arm = node(spine, `${name}Arm`, [side * 0.415, 0.6, 0]);
    const elbow = node(arm, `${name}Elbow`, [side * 0.059, -0.295, 0.015]);
    const hand = node(elbow, `${name}Hand`, [side * 0.016, -0.27, 0.03]);
    node(hand, `PalmGrip${name}`, [0, -0.085, 0.005]);
  }
  const cart = node(scene, "Cart", mesh.position.toArray());
  cart.position.add(new Vector3(Math.sin(heading), 0, Math.cos(heading)).multiplyScalar(1.32 * scale));
  cart.rotation.y = heading;
  cart.scale.setScalar(scale);
  node(cart, "CartHandleLeft", [-0.4186046, 1.5697675, -0.8272425]);
  node(cart, "CartHandleRight", [0.4186046, 1.5697675, -0.8272425]);
  scene.updateMatrixWorld(true);
  const entity = { mesh };
  const motion = createCharacterMotion(entity, model);
  return { scene, mesh, model, cart, motion };
}

function frames(motion, count, input) {
  for (let i = 0; i < count; i++) motion.update(1 / 60, input);
}

test("both palm contacts reach the handle with translated, rotated and normalized parents", () => {
  for (const heading of [-2.7, -0.3, 1.8]) {
    for (const scale of [0.84, 1.13]) {
      const f = fixture({ heading, scale, parentScale: 1.17 });
      const rootPosition = f.mesh.position.clone(), rootScale = f.mesh.scale.clone();
      frames(f.motion, 90, { heldCart: f.cart, velocity: new Vector3(), grounded: true, facing: heading });
      assert.equal(f.motion.articulated, true);
      assert.equal(f.motion.diagnostics.state, "hold");
      assert.equal(f.motion.diagnostics.gripWeight, 1);
      assert.equal(f.motion.diagnostics.gripErrors.length, 2);
      for (const error of f.motion.diagnostics.gripErrors) assert.ok(error < 1e-5, `palm error ${error} at ${heading}/${scale}`);
      assert.ok(f.mesh.position.equals(rootPosition));
      assert.ok(f.mesh.scale.equals(rootScale), "animation must not scale physics root");
    }
  }
});

test("gait uses achieved distance, differentiates run/backpedal and stops phase at a wall", () => {
  const f = fixture();
  frames(f.motion, 60, { velocity: new Vector3(0, 0, 4.6), grounded: true });
  assert.equal(f.motion.diagnostics.state, "walk");
  assert.ok(Math.abs(f.motion.diagnostics.distance - 4.6) < 1e-8);
  const kneeA = f.model.getObjectByName("LeftKnee").quaternion.clone();
  frames(f.motion, 7, { velocity: new Vector3(0, 0, 4.6), grounded: true });
  assert.ok(kneeA.angleTo(f.model.getObjectByName("LeftKnee").quaternion) > 0.01, "articulated knee should participate in gait");
  frames(f.motion, 60, { velocity: new Vector3(0, 0, 8), grounded: true });
  assert.equal(f.motion.diagnostics.state, "run");
  frames(f.motion, 60, { velocity: new Vector3(), grounded: true });
  const stopped = f.motion.diagnostics;
  frames(f.motion, 60, { velocity: new Vector3(), grounded: true });
  assert.equal(f.motion.diagnostics.state, "idle");
  assert.equal(f.motion.diagnostics.speed, 0);
  assert.equal(f.motion.diagnostics.stride, stopped.stride, "no actual movement means no walking-in-place");
  assert.equal(f.motion.diagnostics.distance, stopped.distance);
  frames(f.motion, 40, { heldCart: f.cart, velocity: new Vector3(0, 0, -2), grounded: true });
  assert.equal(f.motion.diagnostics.state, "pull");
  frames(f.motion, 40, { heldCart: f.cart, velocity: new Vector3(2, 0, 0), grounded: true });
  assert.equal(f.motion.diagnostics.state, "strafe");
});

test("crouch bends knees and lowers the visual body while feet and physics scale remain planted", () => {
  const f = fixture({ heading: 1.1, scale: 0.96 });
  const left = f.model.getObjectByName("FootContactLeft");
  const right = f.model.getObjectByName("FootContactRight");
  const floor = [left.getWorldPosition(new Vector3()).y, right.getWorldPosition(new Vector3()).y];
  const rootPosition = f.mesh.position.clone();
  frames(f.motion, 90, { velocity: new Vector3(), grounded: true, crouch: true });
  assert.equal(f.motion.diagnostics.state, "crouch");
  assert.ok(f.model.position.y < -0.47);
  for (const [i, foot] of [left, right].entries()) {
    assert.ok(Math.abs(foot.getWorldPosition(new Vector3()).y - floor[i]) < 1e-5, "feet stay on their original ground plane");
  }
  assert.ok(f.model.getObjectByName("LeftKnee").quaternion.angleTo(new Quaternion()) > 0.5);
  assert.ok(f.mesh.position.equals(rootPosition));
  assert.deepEqual(f.mesh.scale.toArray(), [1, 1, 1]);
  frames(f.motion, 90, { velocity: new Vector3(), grounded: true });
  assert.ok(Math.abs(f.model.position.y) < 1e-5);
});

test("supporting shoes remain fixed in world space while the physics root actually travels", () => {
  for (const localVelocity of [new Vector3(0, 0, 3), new Vector3(0, 0, 8), new Vector3(0, 0, -2), new Vector3(2, 0, 0)]) {
    const f = fixture({ heading: 0.8 });
    const feet = ["Left", "Right"].map((side) => f.model.getObjectByName(`FootContact${side}`));
    const previous = feet.map((foot) => foot.getWorldPosition(new Vector3()));
    let planted = [false, false], contacts = 0;
    const before = new Vector3(), velocity = new Vector3();
    for (let i = 0; i < 180; i++) {
      f.mesh.getWorldPosition(before);
      f.mesh.translateX(localVelocity.x / 60);
      f.mesh.translateZ(localVelocity.z / 60);
      velocity.copy(f.mesh.getWorldPosition(new Vector3())).sub(before).multiplyScalar(60);
      f.motion.update(1 / 60, { velocity, grounded: true });
      const current = f.motion.diagnostics.feetPlanted;
      for (let foot = 0; foot < 2; foot++) {
        const position = feet[foot].getWorldPosition(new Vector3());
        if (i > 20 && planted[foot] && current[foot]) {
          assert.ok(position.distanceTo(previous[foot]) < 1e-4,
            `planted foot drift ${position.distanceTo(previous[foot])} at velocity ${localVelocity.toArray()}`);
          contacts++;
        }
        previous[foot].copy(position);
      }
      planted = current;
    }
    assert.ok(contacts > 30, "the test must sample real supporting phases");
  }
});

test("jump, falling, landing, guard and release are distinct finite poses without stale grips", () => {
  const f = fixture();
  f.motion.update(1 / 60, { grounded: false, verticalVelocity: 7 });
  assert.equal(f.motion.diagnostics.state, "jump");
  f.motion.update(1 / 60, { grounded: false, verticalVelocity: -6 });
  assert.equal(f.motion.diagnostics.state, "fall");
  f.motion.update(1 / 60, { grounded: true, verticalVelocity: 0 });
  assert.equal(f.motion.diagnostics.state, "land");
  frames(f.motion, 30, { grounded: true, guard: true });
  assert.equal(f.motion.diagnostics.state, "guard");
  frames(f.motion, 60, { heldCart: f.cart, grounded: true });
  assert.ok(f.motion.diagnostics.gripErrors.every((error) => error < 1e-5));
  frames(f.motion, 60, { grounded: true });
  assert.equal(f.motion.diagnostics.gripWeight, 0);
  assert.deepEqual(f.motion.diagnostics.gripErrors, []);
  for (const name of ["LeftArm", "RightArm", "LeftElbow", "RightElbow", "Spine"]) {
    assert.ok(f.model.getObjectByName(name).quaternion.toArray().every(Number.isFinite));
  }
  f.motion.reset();
  assert.equal(f.motion.diagnostics.state, "idle");
  assert.equal(f.motion.diagnostics.distance, 0);
});
