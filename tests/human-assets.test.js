import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Box3, Group, Vector3 } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { AssetLibrary } from "../src/visuals/assets.js";
import { createCharacterMotion } from "../src/visuals/character-motion.js";
import {createWeaponRig,meleePose,MELEE_TIMING} from '../src/visuals/weapon-rig.js';

async function load(name) {
  const bytes = await readFile(new URL(`../public/models/characters/${name}.glb`, import.meta.url));
  return new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "");
}

test('the actual police skin has all four contact anchors and visibly moves both hands and knees when climbing',async()=>{
 const source=await load('police-officer'),library=new AssetLibrary({human:{url:'fixture:police-climb'}},{loader:{loadAsync:async()=>source},logger:{info(){},warn(){}}});await library.preload();const mesh=new Group(),model=library.instantiate('human',{height:2.1});mesh.add(model);mesh.position.y=5;const motion=createCharacterMotion({mesh},model),hands=[],knees=[];
 for(const phase of [0,Math.PI/2,Math.PI,Math.PI*1.5]){motion.update(1/60,{climb:{phase,moving:true,reach:.30},grounded:false,velocity:new Vector3(0,2.15,0)});assert.equal(motion.diagnostics.climbGripErrors.length,2);assert.ok(motion.diagnostics.climbGripErrors.every(e=>e<.003));hands.push(model.getObjectByName('PalmGripRight').getWorldPosition(new Vector3()).y);knees.push(model.getObjectByName('RightKnee').quaternion.clone());}
 assert.ok(Math.max(...hands)-Math.min(...hands)>.25);assert.ok(knees[0].angleTo(knees[1])>.05);for(let i=0;i<60;i++)motion.update(1/60,{grounded:true,velocity:new Vector3(0,0,3)});assert.ok(motion.diagnostics.soleClearance>=-.02&&motion.diagnostics.soleClearance<.05);motion.dispose();library.dispose();
});

test('the real hero closes both unarmed hands into fists during idle and walking',async()=>{
 const asset=await load('merch-male'),library=new AssetLibrary({human:{url:'fixture:fists'}},{loader:{loadAsync:async()=>asset},logger:{info(){},warn(){}}});await library.preload();
 const mesh=new Group(),model=library.instantiate('human',{height:2.1});mesh.add(model);const rest=['Index3L','Index3R'].map(n=>model.getObjectByName(n).quaternion.clone()),motion=createCharacterMotion({mesh},model);
 for(const speed of [0,3]){for(let i=0;i<30;i++)motion.update(1/60,{fists:true,grounded:true,velocity:new Vector3(0,0,speed)});for(const [i,n]of ['Index3L','Index3R'].entries())assert.ok(model.getObjectByName(n).quaternion.angleTo(rest[i])>1,n+' is closed');}
 motion.dispose();library.dispose();
});

test('a real skinned merchant grips the bat with both palms through windup, contact and recovery',async()=>{
 const asset=await load('merch-male');
 const library=new AssetLibrary({human:{url:'fixture:bat-user'}},{loader:{loadAsync:async()=>asset},logger:{info(){},warn(){}}});await library.preload();
 const scene=new Group(),mesh=new Group(),model=library.instantiate('human',{height:2.1});scene.add(mesh);mesh.add(model);mesh.position.set(8,0,-3);
 const fingerRest=model.getObjectByName('Index3R').quaternion.clone();
 const motion=createCharacterMotion({mesh},model),rig=createWeaponRig(scene,mesh,'bat',()=>{});
 for(let i=0;i<30;i++)motion.update(1/60,{grounded:true,velocity:new Vector3()});
 for(const heading of [0,1.3,-2.2])for(const remaining of [0,.8,.68,.47,.3]){
  mesh.rotation.y=heading;rig.update({remaining,strong:true});motion.update(1/60,{weaponRig:rig,attack:remaining,attackKind:'strong',grounded:true,velocity:new Vector3()});
  assert.equal(motion.diagnostics.weaponGripErrors.length,rig.twoHanded?2:1);
  if(remaining===0){assert.ok(new Vector3(0,1,0).applyQuaternion(rig.root.getWorldQuaternion(mesh.quaternion.clone())).y>.85,'barrel points above the hand');const h=model.getObjectByName('RightHand').getWorldPosition(new Vector3()),e=model.getObjectByName('RightElbow').getWorldPosition(new Vector3()),p=model.getObjectByName('Middle2R').getWorldPosition(new Vector3());assert.ok(h.clone().sub(e).angleTo(p.clone().sub(h))<Math.PI/4,'relaxed wrist stays aligned with the forearm');assert.ok(model.getObjectByName('Index3R').quaternion.angleTo(fingerRest)>1,'right fingers curl during one-handed carry');}
  for(const error of motion.diagnostics.weaponGripErrors)assert.ok(error<.003,'bat palm contact '+error+' at '+heading+'/'+remaining);
 }
 rig.dispose();motion.dispose();library.dispose();
});

test('bat animations have distinct windup, strike and recovery poses with finite unit rotations',()=>{

 for(const strong of [false,true]){
  const duration=MELEE_TIMING.bat[strong?'strong':'quick'].duration;
  const samples=[.2,.5,.8].map(progress=>meleePose('bat',duration*(1-progress),strong));
  assert.deepEqual(samples.map(p=>p.phase),['windup','strike','recover']);
  assert.ok(samples[0].quaternion.angleTo(samples[1].quaternion)>1);
  for(const p of samples){assert.ok(Math.abs(p.quaternion.length()-1)<1e-6);assert.ok(p.position.toArray().every(Number.isFinite));}
 }
});

test('real climbing alternates both palms and legs without changing the collision root',async()=>{
 const source=await load('merch-male'),library=new AssetLibrary({human:{url:'fixture:climbing'}},{loader:{loadAsync:async()=>source},logger:{info(){},warn(){}}});await library.preload();
 const scene=new Group(),mesh=new Group(),model=library.instantiate('human',{height:2.1});scene.add(mesh);mesh.add(model);mesh.position.set(8,7,-3);
 const motion=createCharacterMotion({mesh},model),root=mesh.position.clone();
 const hands=[],knees=[];
 for(const heading of [0,1.3,-2.2])for(const phase of [0,Math.PI/2,Math.PI,Math.PI*1.5]){
  mesh.rotation.y=heading;motion.update(1/60,{climb:{phase},grounded:false,velocity:new Vector3(0,1.85,0)});
  assert.equal(motion.diagnostics.state,'climb');assert.equal(motion.diagnostics.climbGripErrors.length,2);
  assert.ok(motion.diagnostics.climbGripErrors.every(e=>e<.003),JSON.stringify(motion.diagnostics.climbGripErrors));
  assert.ok(mesh.position.equals(root));assert.deepEqual(mesh.scale.toArray(),[1,1,1]);
  if(heading===0){hands.push(model.getObjectByName('PalmGripLeft').getWorldPosition(new Vector3()).y);knees.push(model.getObjectByName('LeftKnee').quaternion.clone());}
 }
 assert.ok(Math.max(...hands)-Math.min(...hands)>.25);assert.ok(knees[0].angleTo(knees[1])>.05);
 motion.dispose();library.dispose();
});

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
    for (const clip of ["Idle", "Walk", "Run", "Sprint", "Crouch", "Jump", 'PickUp', 'Fixing', 'Talk', 'Interact', 'WalkFormal']) {
      const animation = asset.animations.find((a) => a.name === clip);
      assert.ok(animation && animation.duration > 0.3 && animation.tracks.length > 20, `real ${clip} clip`);
    }
    const knee = asset.animations.find((a) => a.name === "Walk").tracks.find((t) => t.name.endsWith("LeftKnee.quaternion"));
    assert.ok(knee);
    assert.ok(Math.max(...knee.values) - Math.min(...knee.values) > 0.1, "walk must animate actual joint rotations");
  }
});

test('a carried carton stays in both real palms while recorded walking and turning continue', async () => {
  const source = await load('merch-male');
  const library = new AssetLibrary({ human: { url: 'fixture:carry' } }, { loader: { loadAsync: async () => source }, logger: { info() {}, warn() {} } });
  await library.preload();
  const model = library.instantiate('human', { height: 2.1 }), root = new Group(), carton = new Group();
  root.add(model); carton.userData.carry = true;
  for (const [side, name] of [[-1, 'CartHandleLeft'], [1, 'CartHandleRight']]) {
    const anchor = new Group(); anchor.name = name; anchor.position.set(side * 0.35, 0, 0); carton.add(anchor);
  }
  const motion = createCharacterMotion({ mesh: root }, model);
  for (let frame = 0; frame < 100; frame++) {
    root.position.z += 2.25 / 60;
    root.rotation.y = Math.sin(frame / 40) * 0.4;
    root.updateMatrixWorld(true);
    carton.position.copy(root.localToWorld(new Vector3(0, 1.28, 0.5)));
    carton.quaternion.copy(root.quaternion);
    motion.update(1 / 60, { carriedBox: carton, grounded: true, velocity: new Vector3(0, 0, 2.25), facing: root.rotation.y });
    if (frame > 30) for (const error of motion.diagnostics.gripErrors) assert.ok(error < 0.04, `carry contact: ${error}`);
  }
  assert.equal(motion.diagnostics.state, 'carry-walk');
  assert.equal(motion.diagnostics.animation.clip, 'Walk');
  motion.dispose(); library.dispose();
});

test("merch wears a rust jacket, dark trousers and a two-strap canvas backpack", async () => {
  const asset = await load("merch-male");
  const materials = new Map(), names = [];
  asset.scene.traverse((node) => {
    names.push(node.name);
    if (node.isMesh) for (const m of Array.isArray(node.material) ? node.material : [node.material]) materials.set(m.name, m);
  });
  const jacket=materials.get('Merch_BlueTShirt').color;
  assert.ok(jacket.r>jacket.g*2&&jacket.r>jacket.b*2);
  assert.ok(materials.get('Merch_BlackTrousers').color.getHex()<0x606060);
  assert.ok(!names.includes('ConceptHood'));
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
  for (let i = 0; i < 40; i++) motion.update(1 / 60, { staff: true, velocity: new Vector3(0, 0, 1.25), grounded: true });
  assert.equal(motion.diagnostics.animation.clip, 'WalkFormal');
  for (let i = 0; i < 40; i++) motion.update(1 / 60, { staff: true, social: true, velocity: new Vector3(), grounded: true });
  assert.equal(motion.diagnostics.animation.clip, 'Talk');
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

test('actual deformed boots stay above a raised floor through walking, sprinting, crouching and kneeling repair', async () => {
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
  for (let frame = 0; frame < 96; frame++) {
    motion.update(1 / 60, { grounded: true, velocity: new Vector3(), activity: { id: 1, clip: 'Fixing', duration: 1.6, remaining: 1.6 - frame / 60 } });
    if (frame % 8) continue;
    root.updateMatrixWorld(true);
    const bounds = new Box3().setFromObject(model, true);
    assert.ok(bounds.min.y >= root.position.y - .001 && bounds.min.y <= root.position.y + .015, `repair skin/floor: ${bounds.min.y}`);
  }
  motion.dispose();
  library.dispose();
});

test('recorded sprint stays continuous around the speed boundary instead of restarting clips each frame', async()=>{
 const source=await load('merch-male');
 const library=new AssetLibrary({human:{url:'fixture:continuous'}},{loader:{loadAsync:async()=>source},logger:{info(){},warn(){}}});await library.preload();
 const model=library.instantiate('human',{height:2.1}),root=new Group();root.add(model);const motion=createCharacterMotion({mesh:root},model);
 for(let frame=0;frame<80;frame++){root.position.z+=6.8/60;motion.update(1/60,{grounded:true,velocity:new Vector3(0,0,6.8)});}
 for(let frame=0;frame<90;frame++){const speed=6+Math.sin(frame*1.7)*.15,dt=frame%3?1/60:1/30;root.position.z+=speed*dt;motion.update(dt,{grounded:true,velocity:new Vector3(0,0,speed)});assert.equal(motion.diagnostics.animation.clip,'Sprint');assert.ok(motion.diagnostics.soleClearance>=0&&motion.diagnostics.soleClearance<.016);}
 motion.reset();assert.equal(motion.diagnostics.animation.clip,'Idle');motion.dispose();library.dispose();
});
