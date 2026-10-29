import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { URBAN_ASSET_CATALOG, createUrbanAsset, createUrbanDetails } from '../src/city/urban-details.js';
import { MAP, ROAD_BOXES, PARK_PATHS, LOCAL_POINTS, WORK_STOPS, HOME, HOME_CAR, point } from '../src/city/reference-layout.js';
import { MAP_BUILDINGS } from '../src/city/map-buildings.js';
import { boxesIntersect } from '../src/spatial.js';

test('all 238 catalog assets and their variants construct finite renderable geometry', () => {
  assert.equal(new Set(URBAN_ASSET_CATALOG.map(a=>a.category)).size,19);
  assert.equal(new Set(URBAN_ASSET_CATALOG.map(a=>a.id)).size,238);
  for(const entry of URBAN_ASSET_CATALOG)for(const variant of [0,3]){
    const model=createUrbanAsset(entry.id,variant);
    try {
      const bounds=new T.Box3().setFromObject(model);
      assert.equal(bounds.isEmpty(),false,entry.id);
      assert.ok([...bounds.min.toArray(),...bounds.max.toArray()].every(Number.isFinite),entry.id);
      assert.equal(model.userData.assetId,entry.id);
      model.traverse(node=>{if(node.isMesh){
        const positions=node.geometry.attributes.position;assert.ok(positions.count>0,entry.id);
        for(let i=0;i<positions.count;i++)assert.ok(Number.isFinite(positions.getX(i))&&Number.isFinite(positions.getY(i))&&Number.isFinite(positions.getZ(i)),entry.id+' invalid vertex');
      }});
      assert.equal(model.userData.quality,'stylized-high');
    } finally { model.userData.dispose(); }
  }
  assert.equal(URBAN_ASSET_CATALOG.find(a=>a.id==='seawall-turn').archetype,'bridge');
});

test('city placements preserve roads, park paths, buildings, mission entrances and the home approach', () => {
  const scene=new T.Scene();const layer=createUrbanDetails(scene,{},point);
  try {
    const placements=layer.diagnostics.placements;
    assert.ok(placements.length>50);
    const protectedAreas=[
      ...PARK_PATHS.map(([u,v,w,d])=>({...point(u,v),w:w*MAP.scale/2,d:d*MAP.scale/2})),
      ...MAP_BUILDINGS.map(([,u,v,w,d])=>({...point(u,v),w:w*MAP.scale/2,d:d*MAP.scale/2})),
      ...WORK_STOPS.map(s=>({...point(s.u,s.v),w:50*MAP.scale,d:42*MAP.scale})),
      {x:(HOME.x+HOME_CAR.x)/2,z:(HOME.z+HOME_CAR.z)/2,w:Math.abs(HOME.x-HOME_CAR.x)/2+3,d:Math.abs(HOME.z-HOME_CAR.z)/2+3},
    ];
    for(const [i,p] of placements.entries()){
      if(p.roadSurface)assert.ok(['manhole','drain-grate'].includes(p.id));
      else assert.equal(ROAD_BOXES.some(road=>boxesIntersect(p.footprint,road)),false,p.id+' on asphalt');
      assert.equal(protectedAreas.some(area=>boxesIntersect(p.footprint,area)),false,p.id+' in protected area');
      assert.equal(placements.slice(0,i).some(other=>boxesIntersect(p.footprint,other.footprint)),false,p.id+' overlaps another detail');
    }
    for(const id of ['transformer-hut','electrical-cabinet'])assert.ok(placements.some(p=>p.id===id),id+' should relocate off the street');
    for(let shop=0;shop<LOCAL_POINTS.length;shop++)for(const id of ['a-board','atm','bike-parking','cart-shelter','loading-zone-fence']){
      assert.ok(placements.some(p=>p.id===id&&p.shopIndex===shop),id+' missing at shop '+shop);
    }
    assert.equal(layer.diagnostics.publicServices,placements.filter(p=>p.category==='public-buildings').length);
  } finally { layer.dispose(); }
  assert.equal(scene.children.length,0);
});

test('real store footprints and existing props remain clear while owned shop aprons receive details', () => {
  const blockers=LOCAL_POINTS.map(([u,v])=>({...point(u,v),w:7,d:5,enabled:true}));
  blockers.push({...point(720,455),w:8,d:8,enabled:true});
  const layer=createUrbanDetails(new T.Scene(),{blockers},point);
  try {
    for(const p of layer.diagnostics.placements)assert.equal(blockers.some(b=>boxesIntersect(p.footprint,b)),false,p.id);
    for(let shop=0;shop<LOCAL_POINTS.length;shop++)assert.ok(layer.diagnostics.placements.some(p=>p.category==='store-exterior'&&p.shopIndex===shop),'empty shop '+shop);
  } finally { layer.dispose(); }
});

test('removing a layer releases its physics bodies and blockers', async () => {
  await RAPIER.init();
  const scene=new T.Scene(),physics=new RAPIER.World({x:0,y:-9.81,z:0}),blockers=[];
  const world={physics,blockers,box(x,y,z,w,h,d){
    const mesh=new T.Mesh(new T.BoxGeometry(w,h,d));mesh.position.set(x,y,z);scene.add(mesh);
    const body=physics.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(x,y,z));
    const collider=physics.createCollider(RAPIER.ColliderDesc.cuboid(w/2,h/2,d/2),body);
    const blocker={x,z,w:w/2,d:d/2,enabled:true};blockers.push(blocker);
    mesh.userData.blocker=blocker;mesh.userData.colliderHandle=collider.handle;return mesh;
  }};
  try {
    const layer=createUrbanDetails(scene,world,point);
    assert.ok(layer.diagnostics.colliders>0);assert.equal(physics.bodies.len(),layer.diagnostics.colliders);
    layer.dispose();assert.equal(physics.bodies.len(),0);assert.equal(physics.colliders.len(),0);assert.equal(blockers.length,0);assert.equal(scene.children.length,0);
  } finally { physics.free(); }
});
