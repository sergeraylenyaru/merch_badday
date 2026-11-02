import * as T from 'three';
import {ROADS,ROAD_BOXES,MAP,point,pixel,isReferenceWater} from './reference-layout.js';
import {circleIntersectsBox} from '../spatial.js';
import {clearSegment} from '../npc/navigation.js';

/** Continuous, ground-level pavement, with a curb only along its street side. */
export function createWalkways(scene,world,entrances=[]){
  const chunks=new Map(),nodes=[],segments=[];
  const buildings=world.blockers.filter(b=>b.h>=2.5&&(b.w>2||b.d>2));
  const blocked=(x,z,r=.1)=>{const p=pixel(x,z);return isReferenceWater(p.x,p.y)||buildings.some(b=>b.enabled!==false&&circleIntersectsBox(x,z,r,b));};
  function quad(a,b,width,curb=false){
    const length=Math.hypot(b.x-a.x,b.z-a.z);if(length<.01)return;
    const nx=(b.z-a.z)/length*width/2,nz=-(b.x-a.x)/length*width/2;
    const key=Math.floor((a.x+b.x)/96)+','+Math.floor((a.z+b.z)/96)+':'+curb;
    if(!chunks.has(key))chunks.set(key,{positions:[],uv:[]});const out=chunks.get(key);
    const corners=[[a.x-nx,a.z-nz],[a.x+nx,a.z+nz],[b.x+nx,b.z+nz],[b.x-nx,b.z-nz]];
    for(const i of [0,2,1,0,3,2]){const [x,z]=corners[i];out.positions.push(x,world.groundHeight(x,z)+(curb?.08:.025),z);out.uv.push(x/2,z/2);}
  }
  for(const [index,[u,v,eu,ev,width]] of ROADS.entries()){
    const a=point(u,v),b=point(eu,ev),length=Math.hypot(b.x-a.x,b.z-a.z);
    if(length<5)continue;
    const dx=(b.x-a.x)/length,dz=(b.z-a.z)/length,roadHalf=width*MAP.scale/2;
    for(const side of [-1,1]){
      for(let d=0;d<length;d+=2){
        const end=Math.min(length,d+2),offset=(roadHalf+.95)*side;
        const p={x:a.x+dx*d+dz*offset,z:a.z+dz*d-dx*offset};
        const q={x:a.x+dx*end+dz*offset,z:a.z+dz*end-dx*offset};
        const middle={x:(p.x+q.x)/2,z:(p.z+q.z)/2};
        if(!clearSegment(p,q,blocked,.85))continue;
        if(ROAD_BOXES.some((r,i)=>i!==index&&circleIntersectsBox(middle.x,middle.z,.85,r)))continue;
        quad(p,q,1.8);segments.push({a:p,b:q,width:1.8});
        if(Math.floor(d)%4===0)nodes.push({...middle,kind:'walk',lookAt:q});
        const edge=roadHalf*side;
        quad({x:a.x+dx*d+dz*edge,z:a.z+dz*d-dx*edge},{x:a.x+dx*end+dz*edge,z:a.z+dz*end-dx*edge},.13,true);
      }
    }
  }
  for(const entry of entrances.filter(p=>p.approach)){
    const a=entry.approach,nearest=nodes.reduce((best,n)=>!best||Math.hypot(n.x-a.x,n.z-a.z)<Math.hypot(best.x-a.x,best.z-a.z)?n:best,null);
    if(!nearest||Math.hypot(a.x-nearest.x,a.z-nearest.z)>65)continue;
    const corners=[{x:a.x,z:nearest.z},{x:nearest.x,z:a.z}];
    const corner=corners.find(p=>clearSegment(a,p,blocked,.75)&&clearSegment(p,nearest,blocked,.75));
    if(!corner)continue;
    for(const [p,q] of [[a,corner],[corner,nearest]]){quad(p,q,1.6);segments.push({a:{x:p.x,z:p.z},b:{x:q.x,z:q.z},width:1.6});}
    nodes.push({x:a.x,z:a.z,kind:'home',lookAt:point(entry.u,entry.v)});
  }
  const root=new T.Group();root.name='continuous-pedestrian-paths';scene.add(root);
  let texture=null;
  if(typeof document!=='undefined'){
    const canvas=document.createElement('canvas');canvas.width=canvas.height=64;const c=canvas.getContext('2d');
    c.fillStyle='#b5b0a5';c.fillRect(0,0,64,64);c.strokeStyle='#96958d';c.lineWidth=1;
    for(let i=0;i<=64;i+=16){c.beginPath();c.moveTo(i,0);c.lineTo(i,64);c.moveTo(0,i);c.lineTo(64,i);c.stroke();}
    texture=new T.CanvasTexture(canvas);texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.colorSpace=T.SRGBColorSpace;
  }
  const pavement=new T.MeshStandardMaterial({color:'#c2beb2',map:texture,roughness:1});
  const curb=new T.MeshStandardMaterial({color:'#c7c5bb',roughness:1});
  for(const [key,data] of chunks){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(data.positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(data.uv,2));g.computeVertexNormals();const mesh=new T.Mesh(g,key.endsWith('true')?curb:pavement);mesh.receiveShadow=true;root.add(mesh);}
  return {nodes,segments,diagnostics:{segments:segments.length,drawBatches:chunks.size,nodes:nodes.length},dispose(){root.traverse(n=>n.geometry?.dispose());root.removeFromParent();texture?.dispose();pavement.dispose();curb.dispose();}};
}
