import test from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';
import {planRoofCables,ROOF_POST_HEIGHT,cablePoint} from '../src/city/cables.js';
import {createEnclosures} from '../src/city/enclosures.js';
import {createServiceYards} from '../src/city/service-yards.js';
import {point,meetsStreet} from '../src/city/reference-layout.js';
import {circleIntersectsBox} from '../src/spatial.js';
import {meleePose} from '../src/visuals/weapon-rig.js';
import {SHOPS} from '../src/state.js';

test('a relaxed bat points upward while the existing baton carry remains downward',()=>{
 assert.ok(new T.Vector3(0,1,0).applyQuaternion(meleePose('bat').quaternion).y>.85);
 assert.ok(new T.Vector3(0,1,0).applyQuaternion(meleePose('baton').quaternion).y<0);
});
test('roof cables stand on actual roofs and connect houses across the main highway',()=>{
 const roofs=[];for(const [u,v]of [[180,250],[180,420],[320,250],[320,420],[450,250],[450,420]])roofs.push({id:u+':'+v,...point(u,v),w:8,d:6,y:15.736});
 const blockers=roofs.map(r=>({...r,y:r.y/2,h:r.y})),wires=planRoofCables(roofs,blockers);assert.equal(wires.length,3);assert.ok(wires.every(w=>w.crossesHighway));
 for(const w of wires)for(const p of [w.a,w.b]){const r=roofs.find(r=>r.id===p.roofId);assert.equal(p.roofY,r.y);assert.equal(p.y,r.y+ROOF_POST_HEIGHT);assert.ok(Math.abs(p.x-r.x)<r.w-1.5);assert.ok(Math.abs(p.z-r.z)<r.d-1.5);}
 const barrier={...point(180,337),y:15,h:30,w:30,d:3};assert.equal(planRoofCables(roofs.slice(0,2),[barrier]).length,0);
 for(const w of wires){const mid=cablePoint(w,.5);assert.ok(mid.y>15.736+2.8);}
});
function fixture(){const scene=new T.Scene(),world={blockers:[],garages:[],groundHeight:()=>0,jobs:{diagnostics:{targets:[]}}};
 world.box=(x,y,z,w,h,d)=>{const m=new T.Mesh(new T.BoxGeometry(w,h,d),new T.MeshBasicMaterial());m.position.set(x,y,z);m.userData.blocker={x,y,z,w:w/2,d:d/2,h,enabled:true};world.blockers.push(m.userData.blocker);scene.add(m);return m;};
 for(const v of [48,90,710,744])for(let n=0;n<10;n++)world.garages.push({id:n+':'+v,...point(56+n*16,v),w:2.8,d:5.2,y:4.725});world.yards=createServiceYards(scene,world);return {scene,world};}
test('fences belong to enclosed territories, gates stay open and every driving street stays clear',()=>{
 const {scene,world}=fixture();world.box(SHOPS[0].x+15.1,1.5,SHOPS[0].z-13.6,8.2,3,8.2);const e=createEnclosures(scene,world);for(const kind of ['garage','park','hospital','shop'])assert.ok(e.areas.some(a=>a.kind===kind));
 assert.equal(e.areas.filter(a=>a.kind==='garage').length,2);assert.ok(world.yards.yards.length>=4);
 for(const f of e.segments){assert.ok(e.areas.some(a=>a.id===f.territory));assert.equal(meetsStreet(f.x,f.z,f.w*2,f.d*2),false,'fence blocks street '+f.id);}
 for(const gate of e.gates){assert.ok(gate.width>=1.5);assert.equal(e.segments.some(f=>circleIntersectsBox(gate.x,gate.z,.35,f)),false,'gate blocked '+gate.territory);}
 assert.notEqual(e.areas.find(a=>a.id==='shop-back:0').gates[0].side,1,'a gate must not face the existing building at the east approach');
 for(const y of world.yards.yards){const area=e.areas.find(a=>a.id===y.territory);if(area.kind==='garage')assert.ok(y.props.every(p=>p.x>area.bounds.minX&&p.x<area.bounds.maxX&&p.z>area.bounds.minZ&&p.z<area.bounds.maxZ));const f=world.yards.fences.find(f=>f.id===y.fence);assert.ok(f.props.length>=2);}
 for(const kind of ['park','hospital','shop'])assert.ok(world.yards.fences.some(f=>f.kind===kind&&f.props.length>=2),'supports for '+kind);
 for(const f of world.yards.fences){const sides=new Set(f.props.map(p=>Math.sign((p.x-f.x)*f.nx+(p.z-f.z)*f.nz)));assert.equal(sides.size,1,'a return crossing must use another support site');}
 assert.ok(e.areas.find(a=>a.kind==='park').gates.length>=4);assert.ok(e.areas.find(a=>a.kind==='hospital').gates.length>=2);
 e.dispose();world.yards.dispose();scene.traverse(n=>{n.geometry?.dispose();n.material?.dispose();});
});
