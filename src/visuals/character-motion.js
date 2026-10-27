import { AnimationMixer, Euler, LoopOnce, MathUtils, Quaternion, Vector3 } from "three";

const TAU = Math.PI * 2;
const X = new Vector3(1, 0, 0);
const UP = new Vector3(0, 1, 0);
const Z = new Vector3(0, 0, 1);
const damp = (from, to, rate, dt) => MathUtils.lerp(from, to, 1 - Math.exp(-rate * dt));
const wrapAngle = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle));

function joint(node) {
  return node && { node, position: node.position.clone(), rotation: node.quaternion.clone() };
}

function chain(upper, lower, end, contact, entity) {
  if (!upper || !lower || !end || !contact) return null;
  entity.updateWorldMatrix(true, true);
  const endWorld = end.getWorldPosition(new Vector3());
  const contactWorld = contact.getWorldPosition(new Vector3());
  const entityRotation = entity.getWorldQuaternion(new Quaternion());
  return {
    upper, lower, end, contact,
    side: Math.sign(entity.worldToLocal(upper.getWorldPosition(new Vector3())).x) || 1,
    contactOffset: end.worldToLocal(contactWorld.clone()),
    neutralContact: entity.worldToLocal(contactWorld.clone()),
    neutralEndRotation: entityRotation.invert().multiply(end.getWorldQuaternion(new Quaternion())),
    gripOrientation: end.userData.gripOrientation ? new Quaternion().fromArray(end.userData.gripOrientation).normalize() : null,
    endScale: end.getWorldScale(new Vector3()),
    a: upper.getWorldPosition(new Vector3()),
    b: lower.getWorldPosition(new Vector3()),
    c: endWorld,
    direction: new Vector3(), pole: new Vector3(), elbow: new Vector3(), endpoint: new Vector3(),
    from: new Vector3(), to: new Vector3(), contactGoal: new Vector3(), offset: new Vector3(), actual: new Vector3(),
    q: new Quaternion(), parentQ: new Quaternion(), delta: new Quaternion(), endQ: new Quaternion(),
    freeUpper: new Quaternion(), freeLower: new Quaternion(), freeEnd: new Quaternion(),
    gripUpper: new Quaternion(), gripLower: new Quaternion(), gripEnd: new Quaternion(),
    targetObject: null,
    plant: contactWorld.clone(), previousContact: contactWorld.clone(), swingStart: contactWorld.clone(), swingEnd: contactWorld.clone(),
    plantRotation: end.getWorldQuaternion(new Quaternion()), wasStance: null,
    settleStart: contactWorld.clone(), settleProgress: 1,
    error: 0,
  };
}

function worldRotation(node, rotation, scratch) {
  if (node.parent) {
    node.parent.getWorldQuaternion(scratch);
    node.quaternion.copy(scratch.invert()).multiply(rotation);
  } else node.quaternion.copy(rotation);
  node.updateWorldMatrix(false, true);
}

/** Analytic two-bone reach with a separate end rotation and contact offset. */
function solve(chain, contactWorld, endWorldRotation, poleWorld) {
  const c = chain;
  c.upper.getWorldPosition(c.a);
  c.lower.getWorldPosition(c.b);
  c.end.getWorldPosition(c.c);
  const lengthA = c.a.distanceTo(c.b), lengthB = c.b.distanceTo(c.c);
  if (lengthA < 1e-6 || lengthB < 1e-6) return;
  c.offset.copy(c.contactOffset).multiply(c.endScale).applyQuaternion(endWorldRotation);
  c.endpoint.copy(contactWorld).sub(c.offset);
  c.direction.subVectors(c.endpoint, c.a);
  const requested = c.direction.length();
  if (requested < 1e-6) c.direction.set(0, -1, 0);
  else c.direction.multiplyScalar(1 / requested);
  const distance = MathUtils.clamp(requested, Math.abs(lengthA - lengthB) + 1e-5, lengthA + lengthB - 1e-5);
  c.endpoint.copy(c.a).addScaledVector(c.direction, distance);
  c.pole.copy(poleWorld).addScaledVector(c.direction, -poleWorld.dot(c.direction));
  if (c.pole.lengthSq() < 1e-8) {
    c.pole.copy(UP).addScaledVector(c.direction, -UP.dot(c.direction));
    if (c.pole.lengthSq() < 1e-8) c.pole.set(1, 0, 0);
  }
  c.pole.normalize();
  const along = (lengthA * lengthA - lengthB * lengthB + distance * distance) / (2 * distance);
  const height = Math.sqrt(Math.max(0, lengthA * lengthA - along * along));
  c.elbow.copy(c.a).addScaledVector(c.direction, along).addScaledVector(c.pole, height);

  c.from.subVectors(c.b, c.a).normalize();
  c.to.subVectors(c.elbow, c.a).normalize();
  c.delta.setFromUnitVectors(c.from, c.to);
  c.upper.getWorldQuaternion(c.q).premultiply(c.delta);
  worldRotation(c.upper, c.q, c.parentQ);

  c.lower.getWorldPosition(c.b);
  c.end.getWorldPosition(c.c);
  c.from.subVectors(c.c, c.b).normalize();
  c.to.subVectors(c.endpoint, c.b).normalize();
  c.delta.setFromUnitVectors(c.from, c.to);
  c.lower.getWorldQuaternion(c.q).premultiply(c.delta);
  worldRotation(c.lower, c.q, c.parentQ);
  worldRotation(c.end, endWorldRotation, c.parentQ);
}

/**
 * Visual-only motion. Root transforms and physics remain owned by gameplay.
 * Gait advances from achieved distance, so pushing against a wall stops steps.
 */
export function createCharacterMotion(entity, model) {
  const root = entity.mesh;
  const find = (name) => model.getObjectByName(name);
  const names = ["Spine", "Head", "LeftLeg", "RightLeg", "LeftKnee", "RightKnee", "LeftFoot", "RightFoot", "LeftArm", "RightArm", "LeftElbow", "RightElbow", "LeftHand", "RightHand"];
  const joints = Object.fromEntries(names.map((name) => [name, joint(find(name))]));
  const records = Object.values(joints).filter(Boolean);
  model.traverse((node) => {
    if (node.isBone && !records.some((record) => record.node === node)) records.push(joint(node));
  });
  const arms = ["Left", "Right"].map((side) => chain(find(`${side}Arm`), find(`${side}Elbow`), find(`${side}Hand`), find(`PalmGrip${side}`), root));
  const legs = ["Left", "Right"].map((side) => chain(find(`${side}Leg`), find(`${side}Knee`), find(`${side}Foot`), find(`FootContact${side}`), root));
  const articulated = arms.every(Boolean) && legs.every(Boolean);
  const rootScale = root.getWorldScale(new Vector3());
  const motionScale = legs[0] ? legs[0].a.distanceTo(legs[0].b) / (0.49 * Math.max(rootScale.y, 1e-6)) : 1;
  const basePosition = model.position.clone();
  // Probe actual boot vertices. A wrist/ankle marker is not the bottom of a
  // deforming shoe: during a stride it previously left toes below the floor.
  const soleProbes = [];
  const probePoint = new Vector3();
  model.updateMatrixWorld(true);
  model.traverse((mesh) => {
    if (!mesh.isSkinnedMesh) return;
    for (let index = 0; index < mesh.geometry.attributes.position.count; index++) {
      mesh.getVertexPosition(index, probePoint).applyMatrix4(mesh.matrixWorld);
      root.worldToLocal(probePoint);
      if (probePoint.y < 0.32 && probePoint.y > -0.1) soleProbes.push({ mesh, index });
    }
  });
  let soleClearance = null;
  const entityQ = new Quaternion(), cartQ = new Quaternion(), rotation = new Quaternion(), tilt = new Quaternion();
  const localVelocity = new Vector3(), pole = new Vector3(), target = new Vector3(), travelDirection = new Vector3();
  const lastVelocity = new Vector3(), acceleration = new Vector3(), balanceAxis = new Vector3();
  let bodyLean = 0, headTurn = 0, lastActivityId = null;
  const euler = new Euler();
  const fallbackTargets = [new Vector3(-0.45, 1.5, -0.85), new Vector3(0.45, 1.5, -0.85)];
  let speed = 0, distance = 0, phase = 0, moving = 0, running = 0, crouching = 0, gripWeight = 0;
  let visualTime = 0, landing = 0, turn = 0, lastFacing = root.rotation.y, lastGrounded = true, lastVertical = 0;
  let state = "idle", grounded = true, lastCart = null;
  let wasMoving = false;
  const gripErrors = [], feetErrors = [];
  const mixer = model.animations?.some((clip) => clip.name === "Walk") ? new AnimationMixer(model) : null;
  const actions = new Map();
  const closedFingers = new Map();
  let activeClip = "Idle";
  if (mixer) {
    for (const clip of model.animations) {
      const action = mixer.clipAction(clip).setEffectiveWeight(0).play();
      if (["Jump", "Land", "Punch", "StrongPunch", 'PickUp', 'Interact', 'Fixing'].includes(clip.name)) {
        action.setLoop(LoopOnce, 1);
        action.clampWhenFinished = true;
      }
      actions.set(clip.name, action);
    }
    actions.get("Idle")?.setEffectiveWeight(1);
    const punch = actions.get("Punch");
    if (punch) {
      actions.get("Idle")?.setEffectiveWeight(0);
      punch.setEffectiveWeight(1);
      punch.time = punch.getClip().duration * 0.3;
      mixer.update(0);
      for (const record of records) if (/Index|Middle|Ring|Pinky|Thumb/.test(record.node.name)) closedFingers.set(record.node, record.node.quaternion.clone());
      for (const action of actions.values()) action.reset().setEffectiveWeight(0).play();
      actions.get("Idle")?.setEffectiveWeight(1);
    }
  }

  function recordedPose(dt, input, held, rawSpeed) {
    let next = input.activity?.clip ?? (input.inVehicle ? "Drive" : !grounded ? lastVertical > 0 ? "Jump" : "Fall"
      : input.attack > 0 ? input.attackKind === "strong" ? "StrongPunch" : "Punch"
        : landing > 0.2 ? "Land" : input.crouch ? rawSpeed > 0.08 ? "CrouchWalk" : "Crouch"
          : rawSpeed > 6 && !held ? "Sprint" : rawSpeed > 0.08 ? input.staff ? 'WalkFormal' : "Walk" : input.social ? 'Talk' : "Idle");
    if (!actions.has(next)) next = "Idle";
    if (next !== activeClip || (input.activity && input.activity.id !== lastActivityId)) {
      const previous = actions.get(activeClip);
      const action = actions.get(next);
      action.reset().play();
      if (["Walk", "WalkFormal", "Run", "Sprint"].includes(next) && ["Walk", 'WalkFormal', "Run", "Sprint"].includes(activeClip))
        action.time = (previous.time / previous.getClip().duration % 1) * action.getClip().duration;
      if (input.activity && ['PickUp', 'Interact', 'Fixing'].includes(next)) action.time = Math.max(0, 1 - input.activity.remaining / input.activity.duration) * action.getClip().duration;
      activeClip = next;
    }
    lastActivityId = input.activity?.id ?? null;
    for (const [name, action] of actions) {
      const weight = damp(action.getEffectiveWeight(), name === next ? 1 : 0, 14, dt);
      action.setEffectiveWeight(weight);
      let rate = 1;
      if (name === "Walk") rate = MathUtils.clamp(rawSpeed / 1.6, 0.45, 1.9);
      if (name === 'WalkFormal') rate = MathUtils.clamp(rawSpeed / 1.15, 0.5, 1.6);
      if (name === "Run" || name === "Sprint") rate = MathUtils.clamp(rawSpeed / 4.8, 0.7, 1.7);
      if (name === "CrouchWalk") rate = MathUtils.clamp(rawSpeed / 1.3, 0.5, 1.6);
      if ((input.firstPerson || held || input.activity?.approach) && (name === "Walk" || name === "CrouchWalk") && localVelocity.z < -Math.abs(localVelocity.x) * 0.5) rate *= -1;
      if (name === "Punch" || name === "StrongPunch") rate = action.getClip().duration / (name === "Punch" ? 0.35 : 0.85);
      if (name === "Land") rate = action.getClip().duration / 0.25;
      if (name === next && input.activity && ['PickUp', 'Interact', 'Fixing'].includes(name)) rate = action.getClip().duration / input.activity.duration;
      action.setEffectiveTimeScale(rate);
    }
    mixer.update(dt);
  }

  function pose(name, x = 0, y = 0, z = 0) {
    const record = joints[name];
    if (!record) return;
    rotation.setFromEuler(euler.set(x, y, z));
    record.node.quaternion.copy(record.rotation).multiply(rotation);
  }

  function restore() {
    model.position.copy(basePosition);
    for (const record of records) {
      record.node.position.copy(record.position);
      record.node.quaternion.copy(record.rotation);
    }
  }

  function update(dt, input = {}) {
    dt = MathUtils.clamp(Number.isFinite(dt) ? dt : 0, 0, 0.1);
    const active = input.active !== false;
    const step = active ? dt : 0;
    const velocity = input.velocity;
    const rawSpeed = active && !input.inVehicle && velocity ? Math.hypot(velocity.x, velocity.z) : 0;
    const held = input.heldCart ?? input.carriedBox ?? null;
    grounded = input.grounded !== false;
    const facing = input.facing ?? root.rotation.y;
    const turning = step > 0 ? wrapAngle(facing - lastFacing) / step : 0;
    lastFacing = facing;
    turn = damp(turn, MathUtils.clamp(turning * 0.06, -0.16, 0.16), 9, dt);
    visualTime += step;
    speed = damp(speed, rawSpeed, 13, dt);
    if (rawSpeed < 0.025 && speed < 0.025) speed = 0;
    const gaitSpeed = rawSpeed > 0.05 ? rawSpeed : Math.min(1, Math.abs(turning) * 0.14);
    const gaitMoving = active && grounded && !input.inVehicle && gaitSpeed > 0.05;
    const started = gaitMoving && !wasMoving;
    moving = damp(moving, gaitMoving ? 1 : 0, 14, dt);
    running = damp(running, rawSpeed > 6 && !held && !input.crouch ? 1 : 0, 9, dt);
    crouching = damp(crouching, input.crouch && !held && grounded ? 1 : 0, 12, dt);
    gripWeight = damp(gripWeight, held ? 1 : 0, 17, dt);
    if (gripWeight > 0.995) gripWeight = 1;
    if (gripWeight < 0.005) gripWeight = 0;
    if (!lastGrounded && grounded) landing = Math.min(1, Math.abs(lastVertical) / 7);
    else landing = Math.max(0, landing - step * 4.5);
    lastGrounded = grounded;
    lastVertical = input.verticalVelocity || 0;
    const strideAmplitude = (0.45 + running * 0.1) * (1 - crouching * 0.55) * (held ? 0.88 : 1) * motionScale;
    if (grounded && active) {
      distance += rawSpeed * step;
      // During 58% stance the body covers exactly the 2×amplitude foot sweep.
      // World-space anchors below keep the supporting shoe still even in turns.
      const cycleDistance = Math.max(0.15, 2 * strideAmplitude / 0.58);
      if (started) phase = TAU * 0.29;
      phase = (phase + gaitSpeed * step / cycleDistance * TAU) % TAU;
    }
    root.updateWorldMatrix(true, true);
    root.getWorldQuaternion(entityQ);
    if (velocity) localVelocity.copy(velocity).applyQuaternion(rotation.copy(entityQ).invert());
    else localVelocity.set(0, 0, 0);
    if (rawSpeed > 0.05) travelDirection.copy(velocity).setY(0).normalize();
    else travelDirection.set(0, 0, 1).applyQuaternion(entityQ);

    state = input.inVehicle ? "drive" : input.activity ? 'work' : !grounded ? lastVertical > 0 ? "jump" : "fall"
      : input.carriedBox ? rawSpeed > 0.08 ? 'carry-walk' : 'carry' : held ? rawSpeed < 0.08 ? "hold" : Math.abs(localVelocity.x) > Math.abs(localVelocity.z) * 0.8 ? "strafe" : localVelocity.z < 0 ? "pull" : "push"
        : input.attack > 0 ? "attack" : input.guard ? "guard" : landing > 0.2 ? "land"
          : input.crouch ? rawSpeed > 0.08 ? "crouch-walk" : "crouch" : rawSpeed > 6 ? "run" : rawSpeed > 0.08 ? "walk" : "idle";
    restore();
    gripErrors.length = 0;
    feetErrors.length = 0;
    const recorded = !!mixer;
    if (mixer) {
      recordedPose(step, input, held, rawSpeed);
      if (held) for (const record of records) if (/Index|Middle|Ring|Pinky|Thumb/.test(record.node.name)) {
        const closed = closedFingers.get(record.node); if (closed) record.node.quaternion.slerp(closed, gripWeight);
      }
    }
    if (!recorded) {
    const bob = moving * (0.013 + running * 0.014) * (1 - Math.cos(phase * 2));
    model.position.y += grounded ? (-(0.16 + running * 0.12) * moving * (1 - crouching * 0.5) - 0.51 * crouching - 0.11 * landing + bob) * motionScale : 0;
    pose("Spine", 0.075 * moving + 0.13 * running + 0.3 * crouching + 0.12 * gripWeight + 0.08 * landing,
      Math.sin(phase) * 0.055 * moving * (1 - gripWeight),
      -Math.sin(phase) * 0.022 * moving - turn);
    pose("Head", -0.035 * moving - 0.14 * crouching,
      active ? Math.sin(visualTime * 0.45) * 0.035 * (1 - moving) + turn * 0.45 : 0);
    if (joints.Spine) joints.Spine.node.position.y += Math.sin(visualTime * 1.8) * 0.004 * (1 - moving) * (1 - gripWeight);

    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? -1 : 1, name = i === 0 ? "Left" : "Right";
      const cycle = (phase / TAU + i * 0.5) % 1;
      const stance = cycle < 0.58;
      const t = stance ? cycle / 0.58 : (cycle - 0.58) / 0.42;
      const stride = stance ? 1 - t * 2 : -1 + 2 * MathUtils.smoothstep(t, 0, 1);
      const lift = stance ? 0 : Math.sin(Math.PI * t) * (0.12 + running * 0.09) * (1 - crouching * 0.55);
      if (legs[i] && grounded) {
        const leg = legs[i];
        target.copy(leg.neutralContact);
        target.x += side * 0.035 * crouching * motionScale;
        root.localToWorld(target);
        leg.contactGoal.copy(target);
        leg.endQ.copy(entityQ).multiply(leg.neutralEndRotation);
        if (gaitMoving && stance) {
          if (leg.wasStance !== true || started) {
            if (started) leg.plant.copy(leg.previousContact);
            else leg.plant.copy(target).addScaledVector(travelDirection, stride * strideAmplitude);
            leg.plantRotation.copy(leg.endQ);
          }
          target.copy(leg.plant);
          leg.endQ.copy(leg.plantRotation);
        } else if (gaitMoving) {
          if (leg.wasStance !== false || started) leg.swingStart.copy(leg.previousContact);
          leg.swingEnd.copy(target).addScaledVector(travelDirection, strideAmplitude);
          target.copy(leg.swingStart).lerp(leg.swingEnd, MathUtils.smoothstep(t, 0, 1));
          target.y = leg.contactGoal.y + lift * motionScale;
          tilt.setFromAxisAngle(X, -0.24 * Math.sin(Math.PI * t));
          leg.endQ.multiply(tilt);
        } else {
          // Finish the last half step when movement stops, rather than snapping
          // a planted shoe back under the hip in a single frame.
          if (wasMoving) {
            leg.settleStart.copy(leg.previousContact);
            leg.settleProgress = 0;
          }
          if (leg.settleProgress < 1) {
            leg.settleProgress = Math.min(1, leg.settleProgress + step / 0.18);
            const restY = target.y;
            target.lerpVectors(leg.settleStart, target, MathUtils.smoothstep(leg.settleProgress, 0, 1));
            target.y = restY + Math.sin(Math.PI * leg.settleProgress) * 0.055 * motionScale;
          }
        }
        leg.wasStance = gaitMoving ? stance : null;
        leg.contactGoal.copy(target);
        pole.set(0, -0.06, 1).applyQuaternion(entityQ);
        solve(leg, target, leg.endQ, pole);
        leg.contact.getWorldPosition(leg.actual);
        leg.previousContact.copy(leg.actual);
        feetErrors.push(leg.actual.distanceTo(target));
      } else {
        if (legs[i]) legs[i].wasStance = null;
        pose(`${name}Leg`, grounded ? -Math.cos(phase + i * Math.PI) * 0.42 * moving : -0.26 - Math.max(0, lastVertical) * 0.025);
        pose(`${name}Knee`, grounded ? 0 : 0.6 + Math.max(0, lastVertical) * 0.035);
        pose(`${name}Foot`, grounded ? 0 : -0.25);
      }
      pose(`${name}Arm`, Math.cos(phase + i * Math.PI) * (0.25 + running * 0.15) * moving - crouching * 0.3,
        0, side * (0.055 + running * 0.04));
      pose(`${name}Elbow`, -0.11 - 0.38 * running - 0.25 * crouching);
      if (!grounded) {
        pose(`${name}Arm`, -0.15, 0, side * (lastVertical > 0 ? 0.32 : 0.42));
        pose(`${name}Elbow`, -0.35);
      }
      if (input.guard && !held) {
        pose(`${name}Arm`, -0.95, side * 0.16, side * 0.13);
        pose(`${name}Elbow`, -1.12);
      }
      if (input.attack > 0 && !held) {
        const duration = input.attackKind === "strong" ? 0.85 : 0.35;
        const strike = Math.sin(Math.PI * MathUtils.clamp(1 - input.attack / duration, 0, 1));
        const lead = i === 1 || input.attackKind === "strong";
        pose(`${name}Arm`, lead ? -0.3 - strike * 1.12 : -0.55, side * strike * 0.08);
        pose(`${name}Elbow`, lead ? -0.9 * (1 - strike) : -0.6);
        if (joints.Spine) pose("Spine", 0.1 + strike * 0.1, -strike * 0.18, -turn);
      }
    }
    } else {
      if (step > 0 && velocity) acceleration.copy(velocity).sub(lastVelocity).multiplyScalar(1 / step).applyQuaternion(rotation.copy(entityQ).invert());
      else acceleration.set(0, 0, 0);
      if (velocity) lastVelocity.copy(velocity);
      const leanTarget = input.activity ? 0 : (held ? 0.08 : running * 0.1) + MathUtils.clamp(acceleration.z * 0.006, -0.09, 0.12);
      bodyLean = damp(bodyLean, leanTarget, 8, dt);
      if (joints.Spine) {
        balanceAxis.set(1, 0, 0).applyQuaternion(entityQ);
        tilt.setFromAxisAngle(balanceAxis, bodyLean);
        joints.Spine.node.getWorldQuaternion(rotation).premultiply(tilt);
        worldRotation(joints.Spine.node, rotation, cartQ);
      }
      let look = 0;
      if (input.lookAt) {
        const position = root.getWorldPosition(target);
        look = MathUtils.clamp(wrapAngle(Math.atan2(input.lookAt.x - position.x, input.lookAt.z - position.z) - facing), -0.55, 0.55);
      }
      headTurn = damp(headTurn, look, 7, dt);
      if (joints.Head) {
        tilt.setFromAxisAngle(UP, headTurn);
        joints.Head.node.getWorldQuaternion(rotation).premultiply(tilt);
        worldRotation(joints.Head.node, rotation, cartQ);
      }
    }
    if (recorded && grounded) {
      // Keep the captured performance, with a small ground-contact correction.
      // Feet close to the floor are pinned in world space during support.
      model.updateWorldMatrix(true, true);
      // Redirect the captured leg swing for lateral movement while keeping
      // shoulders facing the trolley/first-person camera and hands on the grip.
      const angle = input.firstPerson || held ? Math.atan2(localVelocity.x, Math.abs(localVelocity.z) + 0.001) : 0;
      if (rawSpeed > 0.08 && Math.abs(angle) > 0.05) for (const leg of legs) if (leg) {
        leg.contact.getWorldPosition(target); root.worldToLocal(target);
        const dx = target.x - leg.neutralContact.x, dz = target.z - leg.neutralContact.z;
        target.x = leg.neutralContact.x + Math.cos(angle) * dx + Math.sin(angle) * dz;
        target.z = leg.neutralContact.z - Math.sin(angle) * dx + Math.cos(angle) * dz;
        root.localToWorld(target);
        leg.end.getWorldQuaternion(leg.endQ);
        pole.set(Math.sin(angle) * 0.6, -0.06, Math.cos(angle)).applyQuaternion(entityQ);
        solve(leg, target, leg.endQ, pole);
      }
      let lowest = Infinity;
      for (const leg of legs) if (leg) {
        leg.contact.getWorldPosition(leg.actual);
        lowest = Math.min(lowest, leg.actual.y);
      }
      const floor = root.getWorldPosition(target).y + (legs[0]?.neutralContact.y || 0);
      if (Number.isFinite(lowest)) model.position.y += floor - lowest;
      model.updateWorldMatrix(true, true);
      for (const leg of legs) if (leg) {
        leg.contact.getWorldPosition(leg.actual);
        const supporting = leg.actual.y < floor + 0.055 && rawSpeed > 0.08;
        if (supporting && !leg.wasStance) { leg.plant.copy(leg.actual).setY(floor); leg.end.getWorldQuaternion(leg.plantRotation); }
        leg.wasStance = supporting;
        if (supporting) {
          leg.endQ.copy(leg.plantRotation);
          pole.set(0, -0.06, 1).applyQuaternion(entityQ);
          solve(leg, leg.plant, leg.endQ, pole);
          leg.contact.getWorldPosition(leg.actual);
          const error = leg.actual.distanceTo(leg.plant);
          if (error > 0.04) leg.wasStance = false;
          feetErrors.push(error);
        }
      }
    }
    model.updateWorldMatrix(true, true);
    if (grounded && soleProbes.length) {
      // SkinnedMesh.updateMatrixWorld refreshes bindMatrixInverse; the generic
      // updateWorldMatrix used by IK does not. Probe the exact rendered skin.
      model.updateMatrixWorld(true);
      let bottom = Infinity;
      for (const { mesh, index } of soleProbes) {
        mesh.getVertexPosition(index, probePoint).applyMatrix4(mesh.matrixWorld);
        bottom = Math.min(bottom, probePoint.y);
      }
      const floor = root.getWorldPosition(target).y;
      const correction = floor + 0.004 - bottom;
      model.position.y += correction / Math.max(rootScale.y, 1e-6);
      soleClearance = bottom + correction - floor;
      model.updateMatrixWorld(true);
    } else soleClearance = null;

    for (let i = 0; i < arms.length; i++) {
      const arm = arms[i];
      if (!arm) continue;
      if (held) {
        if (lastCart !== held) arm.targetObject = held.getObjectByName(arm.side < 0 ? "CartHandleLeft" : "CartHandleRight");
        held.updateWorldMatrix(true, true);
        if (arm.targetObject) arm.targetObject.getWorldPosition(arm.contactGoal);
        else arm.contactGoal.copy(fallbackTargets[arm.side < 0 ? 0 : 1]), held.localToWorld(arm.contactGoal);
        held.getWorldQuaternion(cartQ);
        arm.endQ.copy(cartQ);
        if (held.userData.carry) arm.endQ.multiply(tilt.setFromAxisAngle(Z, -arm.side * Math.PI / 2));
        arm.endQ.multiply(arm.gripOrientation || arm.neutralEndRotation);
        if (!arm.gripOrientation) {
          tilt.setFromAxisAngle(X, -1.05);
          arm.endQ.multiply(tilt);
        }
        arm.freeUpper.copy(arm.upper.quaternion);
        arm.freeLower.copy(arm.lower.quaternion);
        arm.freeEnd.copy(arm.end.quaternion);
        pole.set(arm.side * 0.45, -0.8, -0.15).applyQuaternion(entityQ);
        solve(arm, arm.contactGoal, arm.endQ, pole);
        arm.gripUpper.copy(arm.upper.quaternion);
        arm.gripLower.copy(arm.lower.quaternion);
        arm.gripEnd.copy(arm.end.quaternion);
        if (gripWeight < 1) {
          arm.upper.quaternion.copy(arm.freeUpper).slerp(arm.gripUpper, gripWeight);
          arm.lower.quaternion.copy(arm.freeLower).slerp(arm.gripLower, gripWeight);
          arm.end.quaternion.copy(arm.freeEnd).slerp(arm.gripEnd, gripWeight);
        }
        model.updateWorldMatrix(true, true);
        arm.contact.getWorldPosition(arm.actual);
        arm.error = arm.actual.distanceTo(arm.contactGoal);
        gripErrors.push(arm.error);
      } else if (input.guard && recorded) {
        target.set(arm.side * 0.19, 1.73, 0.25);
        root.localToWorld(target);
        arm.endQ.copy(entityQ).multiply(arm.gripOrientation || arm.neutralEndRotation);
        pole.set(arm.side * 0.6, -1, -0.1).applyQuaternion(entityQ);
        solve(arm, target, arm.endQ, pole);
      } else if (gripWeight > 0 && lastCart) {
        arm.upper.quaternion.slerp(arm.gripUpper, gripWeight);
        arm.lower.quaternion.slerp(arm.gripLower, gripWeight);
        arm.end.quaternion.slerp(arm.gripEnd, gripWeight);
      }
    }
    if (held || gripWeight === 0) lastCart = held;
    wasMoving = gaitMoving;
    model.updateWorldMatrix(true, true);
  }

  function reset() {
    restore();
    speed = distance = phase = moving = running = crouching = gripWeight = landing = turn = visualTime = 0;
    state = "idle";
    lastCart = null;
    gripErrors.length = feetErrors.length = 0;
    lastFacing = root.rotation.y;
    lastGrounded = true;
    lastVertical = 0;
    lastVelocity.set(0, 0, 0); bodyLean = headTurn = 0; lastActivityId = null;
    wasMoving = false;
    model.updateWorldMatrix(true, true);
    for (const leg of legs) if (leg) {
      leg.contact.getWorldPosition(leg.previousContact);
      leg.wasStance = null;
      leg.settleProgress = 1;
    }
    if (mixer) {
      for (const action of actions.values()) action.reset().setEffectiveWeight(0).play();
      actions.get("Idle")?.setEffectiveWeight(1);
      activeClip = "Idle";
      update(0, { active: false, grounded: true, velocity: new Vector3() });
    }
  }

  if (mixer) update(0, { active: false, grounded: true, velocity: new Vector3() });

  return {
    articulated,
    update,
    reset,
    dispose() { mixer?.stopAllAction(); mixer?.uncacheRoot(model); lastCart = null; },
    get diagnostics() {
      return {
        state, speed, stride: phase / TAU, distance, gripWeight, grounded, crouchWeight: crouching, articulated,
        gripErrors: [...gripErrors], feetErrors: [...feetErrors], soleClearance, bodyLean, headTurn,
        feetPlanted: legs.map((leg) => leg?.wasStance === true),
        animation: mixer ? {
          source: "Quaternius Universal Animation Library (CC0)", clip: activeClip,
          time: actions.get(activeClip)?.time || 0,
          weights: Object.fromEntries([...actions].filter(([, a]) => a.getEffectiveWeight() > 0.01).map(([name, a]) => [name, a.getEffectiveWeight()])),
        } : null,
        jointAngles: {
          leftKnee: joints.LeftKnee?.node.quaternion.angleTo(joints.LeftKnee.rotation) ?? 0,
          rightKnee: joints.RightKnee?.node.quaternion.angleTo(joints.RightKnee.rotation) ?? 0,
          leftElbow: joints.LeftElbow?.node.quaternion.angleTo(joints.LeftElbow.rotation) ?? 0,
          rightElbow: joints.RightElbow?.node.quaternion.angleTo(joints.RightElbow.rotation) ?? 0,
        },
      };
    },
  };
}
