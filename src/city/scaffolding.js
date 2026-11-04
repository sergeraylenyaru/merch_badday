import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {boxesIntersect} from '../spatial.js';
import {meetsStreet} from './reference-layout.js';
export function planScaffolding(roofs,blockers=[],isWater=()=>false){
 const out=[];
 for(const roof of roofs.filter(r=>r.kind==='residential').sort((a,b)=>a.y-b.y||a.id.localeCompare(b.id))){
  if(out.length>=2)break;if(roof.y>20||out.some(p=>Math.hypot(p.x-roof.x,p.z-roof.z)<90))continue;
  const wall=roof.wallBounds??roof;
  for(const [nx,nz]of [[0,1],[0,-1],[1,0],[-1,0]]){
   const p={x:wall.x+nx*(wall.w+1.35),z:wall.z+nz*(wall.d+1.35),w:nx?1.25:3.2,d:nz?1.25:3.2};
   if(meetsStreet(p.x,p.z,p.w*2,p.d*2)||blockers.some(b=>b.enabled!==false&&boxesIntersect(p,b))||isWater(p.x,p.z))continue;
   out.push({...p,id:'scaffold:'+out.length,roofId:roof.id,top:roof.y,nx,nz});break;
  }
 }return out;
}
export function createScaffolding(scene,world){
 const root=new T.Group();root.name='climbable-building-scaffolds';scene.add(root);const parts=[[],[]],materials=[new T.MeshStandardMaterial({color:'#846f5a',roughness:.9}),new T.MeshStandardMaterial({color:'#968a75',metalness:.45,roughness:.65})],sites=planScaffolding(world.roofs,world.blockers,(x,z)=>world.water.isWater(x,z));
 function box(site,x,y,z,w,h,d,material=1){const g=new T.BoxGeometry(w,h,d);g.translate(x,y,z);g.rotateY(Math.atan2(site.nx,site.nz));g.translate(site.x,0,site.z);parts[material].push(g);}
 for(const s of sites){const y0=world.groundHeight(s.x,s.z),height=s.top-y0;s.levels=[];
  world.roofs.find(r=>r.id===s.roofId).scaffoldAccess=s.id;
  for(const x of [-3,-1,1,3])for(const z of [-1.1,1.1])box(s,x,y0+height/2,z,.07,height+.9,.07);
  const levels=[];for(let y=y0+2.6;y<s.top-.6;y+=2.6)levels.push(y);levels.push(s.top);
  for(const y of levels){box(s,0,y-.07,0,6.4,.14,2.5,0);box(s,0,y+1.0,1.1,6.4,.06,.06);for(const x of [-3,3]){box(s,x,y+1,0,.06,.06,2.2);box(s,x,y-.15,0,.08,.08,2.3);}const surface={x:s.x,z:s.z,w:s.w,d:s.d,y};world.parkourSurfaces.push(surface);s.levels.push(y);}
  const base={x:s.x+s.nx*(s.nx?s.w:s.d)+s.nx*.08,z:s.z+s.nz*(s.nz?s.d:s.w)+s.nz*.08,nx:s.nx,nz:s.nz};
  world.roofs.push({id:s.id,x:s.x,z:s.z,w:s.w,d:s.d,y:s.top,kind:'scaffold',ownerRoofId:s.roofId,ladder:{...base,exit:{x:s.x,z:s.z,y:s.top}}});
 }
 const geometries=[];for(let i=0;i<parts.length;i++)if(parts[i].length){const g=mergeGeometries(parts[i]);parts[i].forEach(p=>p.dispose());geometries.push(g);const mesh=new T.Mesh(g,materials[i]);mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);}
 return {diagnostics:{count:sites.length,sites},dispose(){root.removeFromParent();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());}};
}
