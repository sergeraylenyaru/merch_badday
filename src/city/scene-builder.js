import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
/** Static coloured geometry shares one draw call; physical proxies stay independent. */
export function sceneBuilder(scene,world,name){
 const root=new T.Group();root.name=name;scene.add(root);const parts=[],owned=[],materials=[],textures=[],proxies=[];
 function geometry(g,color,position=new T.Vector3(),rotation=null){if(rotation)g.applyMatrix4(new T.Matrix4().makeRotationFromEuler(rotation));g.translate(position.x,position.y,position.z);const c=new T.Color(color),a=new Float32Array(g.attributes.position.count*3);for(let i=0;i<a.length;i+=3){a[i]=c.r;a[i+1]=c.g;a[i+2]=c.b;}g.setAttribute('color',new T.BufferAttribute(a,3));if(g.index)g=g.toNonIndexed();g.deleteAttribute('uv');parts.push(g);}
 function box(x,y,z,w,h,d,color,solid=false){geometry(new T.BoxGeometry(w,h,d),color,new T.Vector3(x,y,z));if(solid){const p=world.box(x,y,z,w,h,d,color,true);p.visible=false;proxies.push(p);} }
 function finish(){if(parts.length){const g=mergeGeometries(parts),m=new T.MeshStandardMaterial({vertexColors:true,roughness:.85}),mesh=new T.Mesh(g,m);parts.forEach(p=>p.dispose());parts.length=0;owned.push(g);materials.push(m);mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);} }
 function sign(parent,text,width,height,x,y,z,{color='#fff1d2',background='#29493e',heading=0}={}){const c=document.createElement('canvas');c.width=1024;c.height=192;const ctx=c.getContext('2d');ctx.fillStyle=background;ctx.fillRect(0,0,1024,192);ctx.fillStyle=color;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='bold 100px sans-serif';ctx.fillText(text,512,99,980);const texture=new T.CanvasTexture(c);texture.colorSpace=T.SRGBColorSpace;const g=new T.PlaneGeometry(width,height),m=new T.MeshBasicMaterial({map:texture,side:T.DoubleSide}),mesh=new T.Mesh(g,m);mesh.position.set(x,y,z);mesh.rotation.y=heading;parent.add(mesh);owned.push(g);materials.push(m);textures.push(texture);return mesh;}
 return {root,owned,materials,textures,box,geometry,finish,sign,dispose(){root.removeFromParent();owned.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());}};
}
