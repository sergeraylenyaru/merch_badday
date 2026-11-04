import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {SHOPS} from '../state.js';
import {point,meetsStreet,HOSPITAL} from './reference-layout.js';
import {boxesIntersect,circleIntersectsBox} from '../spatial.js';

export function createEnclosures(scene,world){
 const root=new T.Group();root.name='territory-enclosures';scene.add(root);
 const areas=[],segments=[],gates=[],parts=new Map(),materials=new Map(),geometries=[],textures=[],postKeys=new Set();
 const schemes={garage:{height:2.1,iron:'#52695e',post:'#67736b',base:'#77796c',solid:true},shop:{height:1.8,iron:'#607774',post:'#6a7671',base:'#9a9d8c'},park:{height:1.55,iron:'#345951',post:'#b1a186',base:'#958b75',ornament:true},hospital:{height:1.45,iron:'#6a9486',post:'#d5dacb',base:'#b0bbae',ornament:true}};
 function piece(g,color,x,y,z,angle=0){g.rotateY(angle);g.translate(x,y,z);const key=color+':'+Math.floor(x/48)+','+Math.floor(z/48);if(!parts.has(key))parts.set(key,{color,list:[]});parts.get(key).list.push(g);}
 const box=(x,y,z,w,h,d,color,angle=0)=>piece(new T.BoxGeometry(w,h,d),color,x,y,z,angle);
 function post(x,z,style){const key=x.toFixed(2)+':'+z.toFixed(2)+':'+style;if(postKeys.has(key))return;postKeys.add(key);const s=schemes[style],y=world.groundHeight(x,z),w=s.ornament?.34:.17;box(x,y+(s.height+.25)/2,z,w,s.height+.25,w,s.post);box(x,y+s.height+.28,z,w+.14,.10,w+.14,s.post);}
 function fence(area,a,b){
  const length=Math.hypot(b.x-a.x,b.z-a.z);if(length<.3)return;const dx=(b.x-a.x)/length,dz=(b.z-a.z)/length,angle=-Math.atan2(dz,dx),s=schemes[area.kind],x=(a.x+b.x)/2,z=(a.z+b.z)/2,y0=world.groundHeight(x,z),nx=Math.abs(dz)>.5?1:0,nz=nx?0:1;
  const proxy=world.box(x,y0+s.height/2,z,Math.abs(b.x-a.x)+.16,s.height,Math.abs(b.z-a.z)+.16,'#6a786e',true);proxy.visible=false;proxy.userData.blocker.vaultOnly=true;
  const f={id:area.id+':'+area.segments.length,territory:area.id,kind:area.kind,x,z,w:Math.abs(b.x-a.x)/2+.08,d:Math.abs(b.z-a.z)/2+.08,span:length/2,nx,nz,height:s.height,y0,props:[],a,b};area.segments.push(f);segments.push(f);
  const count=Math.max(1,Math.ceil(length/3.1));
  for(let i=0;i<=count;i++)post(a.x+dx*length*i/count,a.z+dz*length*i/count,area.kind);
  if(s.solid){
   box(x,y0+1.05,z,length,1.8,.07,s.iron,angle);
   for(let t=.18;t<length;t+=.36)box(a.x+dx*t,y0+1.05,a.z+dz*t,.035,1.78,.11,s.post,angle);
  }else{
   box(x,y0+.12,z,length,.24,.28,s.base,angle);
   for(const y of [.5,s.height-.12])box(x,y0+y,z,length,.06,.08,s.iron,angle);
   for(let t=.22;t<length;t+=.46){const px=a.x+dx*t,pz=a.z+dz*t;box(px,y0+s.height/2+.1,pz,.035,s.height-.18,.04,s.iron,angle);if(s.ornament)piece(new T.ConeGeometry(.065,.13,4),s.iron,px,y0+s.height+.035,pz,angle);}
   if(s.ornament)for(let i=0;i<count;i++){const t=length*(i+.5)/count;piece(new T.TorusGeometry(.24,.018,4,16),s.iron,a.x+dx*t,y0+.96,a.z+dz*t,angle);}
  }
 }
 function rectangle(id,kind,bounds,openings=[],wallSide=null){
  const area={id,kind,bounds:{...bounds},segments:[],gates:[],closedByBuilding:wallSide};areas.push(area);
  const {minX,maxX,minZ,maxZ}=bounds,corners=[{x:minX,z:minZ},{x:maxX,z:minZ},{x:maxX,z:maxZ},{x:minX,z:maxZ}];
  for(let side=0;side<4;side++){
   if(side===wallSide)continue;const a=corners[side],b=corners[(side+1)%4],length=Math.hypot(b.x-a.x,b.z-a.z),dx=(b.x-a.x)/length,dz=(b.z-a.z)/length,holes=[];
   for(const opening of openings.filter(g=>g.side===side)){const t=dx?((opening.at-a.x)/dx):((opening.at-a.z)/dz);holes.push({lo:Math.max(0,t-opening.width/2),hi:Math.min(length,t+opening.width/2),reason:'entrance'});}
   // Every street crossing remains a deliberate, recorded vehicle entrance.
   let start=null;for(let t=0;t<=length+.21;t+=.2){const road=t<=length&&meetsStreet(a.x+dx*t,a.z+dz*t,.6,.6);if(road&&start===null)start=t;if(!road&&start!==null){holes.push({lo:Math.max(0,start-.8),hi:Math.min(length,t+.8),reason:'road'});start=null;}}
   holes.sort((a,b)=>a.lo-b.lo);const merged=[];for(const h of holes){const last=merged.at(-1);if(last&&h.lo<=last.hi+.2)last.hi=Math.max(last.hi,h.hi);else merged.push({...h});}
   let t=0;for(const h of [...merged,{lo:length,hi:length}]){
    if(h.lo>t+.2)fence(area,{x:a.x+dx*t,z:a.z+dz*t},{x:a.x+dx*h.lo,z:a.z+dz*h.lo});
    if(h.hi>h.lo){const mid=(h.lo+h.hi)/2,norm=[{x:0,z:-1},{x:1,z:0},{x:0,z:1},{x:-1,z:0}][side],gate={territory:id,side,x:a.x+dx*mid,z:a.z+dz*mid,width:h.hi-h.lo,nx:norm.x,nz:norm.z,reason:h.reason};area.gates.push(gate);gates.push(gate);post(a.x+dx*h.lo,a.z+dz*h.lo,kind);post(a.x+dx*h.hi,a.z+dz*h.hi,kind);}
    t=Math.max(t,h.hi);
   }
  }
  return area;
 }
 // Two garage cooperatives enclose whole rows, with driving lanes and gates.
 for(const [id,group]of [['garages-north',world.garages.filter(g=>g.z<point(0,200).z)],['garages-south',world.garages.filter(g=>g.z>point(0,650).z)]]){
  if(!group.length)continue;const minX=Math.min(...group.map(g=>g.x-g.w))-1.5,maxX=Math.max(...group.map(g=>g.x+g.w))+1.5,minZ=Math.min(...group.map(g=>g.z-g.d))-(id.endsWith('south')?.35:1.2),maxZ=Math.max(...group.map(g=>g.z+g.d))+3.5;
  const xs=[...group].sort((a,b)=>a.z-b.z),lane=(Math.min(...group.map(g=>g.z))+Math.max(...group.map(g=>g.z)))/2;
  const area=rectangle(id,'garage',{minX,maxX,minZ,maxZ},[{side:1,at:lane,width:5.6},{side:2,at:(minX+maxX)/2,width:5.6}]);
  box((minX+maxX)/2,.006,(minZ+maxZ)/2,maxX-minX,.012,maxZ-minZ,'#86877b');
  for(const fraction of [.18,.38,.62,.82]){const x=minX+(maxX-minX)*fraction,f=area.segments.find(f=>f.nz===1&&Math.abs(f.z-maxZ)<.1&&x>Math.min(f.a.x,f.b.x)+3&&x<Math.max(f.a.x,f.b.x)-3);if(f)world.yards.add(x,maxZ,-1,f,xs[0].id);}
 }
 const a=point(670,370),b=point(1110,760),park=rectangle('city-park','park',{minX:a.x,maxX:b.x,minZ:a.z,maxZ:b.z},[{side:0,at:point(850,0).x,width:8},{side:1,at:point(0,475).z,width:10},{side:1,at:point(0,601).z,width:5},{side:2,at:point(850,0).x,width:8},{side:3,at:point(0,562).z,width:6}]);
 const front=park.gates.find(g=>g.side===0),s=schemes.park;
 if(front){for(const side of [-1,1]){box(front.x+side*front.width/2,2.025,front.z,.6,4.05,.6,s.post);box(front.x+side*front.width/2,4.13,front.z,.8,.16,.8,s.base);}box(front.x,4.22,front.z,front.width,.1,.1,s.iron);
  if(typeof document!=='undefined'){const canvas=document.createElement('canvas');canvas.width=512;canvas.height=96;const c=canvas.getContext('2d');c.fillStyle='#ddd0aa';c.fillRect(0,0,512,96);c.fillStyle='#345951';c.font='bold 44px Arial';c.textAlign='center';c.fillText('ГОРОДСКОЙ ПАРК',256,63);const t=new T.CanvasTexture(canvas);textures.push(t);const g=new T.PlaneGeometry(5,.65),m=new T.MeshBasicMaterial({map:t});geometries.push(g);materials.set('park-name',m);for(const side of [-1,1]){const sign=new T.Mesh(g,m);sign.position.set(front.x,3.8,front.z+side*.025);sign.rotation.y=side<0?Math.PI:0;root.add(sign);}}
 }
 rectangle('hospital-garden','hospital',{minX:HOSPITAL.x-11.2,maxX:HOSPITAL.x+11.2,minZ:HOSPITAL.z-8,maxZ:HOSPITAL.z+10},[{side:2,at:HOSPITAL.x,width:6},{side:3,at:HOSPITAL.z,width:2.4}]);
 for(const shop of SHOPS){
  let plot=null,entrance=null;
  for(const depth of [8,6,4]){const width=20,back=shop.z-8.65,bounds={minX:shop.x-width/2,maxX:shop.x+width/2,minZ:back-depth,maxZ:back},shape={x:shop.x,z:back-depth/2,w:width/2,d:depth/2};
   if(meetsStreet(shape.x,shape.z,width,depth)||world.blockers.some(p=>p.enabled!==false&&boxesIntersect(shape,p))||world.jobs.diagnostics.targets.some(t=>t.x>bounds.minX-.8&&t.x<bounds.maxX+.8&&t.z>bounds.minZ-.8&&t.z<bounds.maxZ+.8))continue;
   const mid=(bounds.minZ+bounds.maxZ)/2,options=[{side:1,at:mid,x:bounds.maxX,z:mid,nx:1,nz:0},{side:3,at:mid,x:bounds.minX,z:mid,nx:-1,nz:0},{side:0,at:shop.x,x:shop.x,z:bounds.minZ,nx:0,nz:-1}];
   entrance=options.find(g=>[-1.5,-.6,.6,1.5].every(distance=>[-.5,0,.5].every(side=>!world.blockers.some(p=>p.enabled!==false&&circleIntersectsBox(g.x+g.nx*distance+g.nz*side,g.z+g.nz*distance-g.nx*side,.35,p)))));if(!entrance)continue;
   plot=bounds;break;
  }
  if(plot)rectangle('shop-back:'+shop.id,'shop',plot,[{side:entrance.side,at:entrance.at,width:3.4}],2);
 }
 // Supports alternate sides at different crossing sites; the return needs another route.
 // Keep entrances, streets, shop work points and the landing strip clear.
 for(const area of areas){
  if(area.kind==='garage')continue;
  let sites=0;
  for(const f of [...area.segments].sort((a,b)=>b.span-a.span)){
   if(f.span<2.6)continue;
   for(const fraction of [0,-.45,.45]){
    const x=f.x+f.nz*f.span*fraction,z=f.z-f.nx*f.span*fraction;
    if(gates.some(g=>Math.hypot(g.x-x,g.z-z)<5)||world.jobs.diagnostics.targets.some(t=>Math.hypot(t.x-x,t.z-z)<4))continue;
    const free=[-1,1].every(side=>[-.9,1.35].every(along=>{const px=x+(f.nx?f.nx*side*1.4:along),pz=z+(f.nx?along:f.nz*side*1.4);return !meetsStreet(px,pz,2,2)&&!world.blockers.some(b=>b.enabled!==false&&circleIntersectsBox(px,pz,.76,b));}));
    if(!free)continue;
    const side=sites%2?1:-1;world.yards.add(x,z,f.nz*side,f,area.id,f.nx*side);
    sites++;break;
   }
   if(sites>=(area.kind==='park'?6:3))break;
  }
 }
 world.yards.finish();
 for(const {color,list}of parts.values()){const geometry=mergeGeometries(list);list.forEach(g=>g.dispose());geometries.push(geometry);if(!materials.has(color))materials.set(color,new T.MeshStandardMaterial({color,roughness:.9,metalness:color===schemes.park.iron?.3:0}));const mesh=new T.Mesh(geometry,materials.get(color));mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);}
 return {areas,segments,gates,get diagnostics(){return {areas,gates,count:areas.length,segments:segments.length,batches:parts.size};},dispose(){root.removeFromParent();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());}};
}
