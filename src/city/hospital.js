import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {HOSPITAL} from './reference-layout.js';

export function createHospital(scene,world){
 const position={x:HOSPITAL.x,z:HOSPITAL.z};
 const {x,z}=position,root=new T.Group();root.name='city-hospital';scene.add(root);
 const materials=new Map(),geometries=[],batches=new Map();
 function box(dx,y,dz,w,h,d,color){if(!materials.has(color))materials.set(color,new T.MeshStandardMaterial({color,roughness:.85}));const g=new T.BoxGeometry(w,h,d);g.translate(x+dx,y,z+dz);if(!batches.has(color))batches.set(color,[]);batches.get(color).push(g);}
 const proxy=world.box(x,4.5,z,18,9,10,'#cfcec0',true);proxy.visible=false;
 box(0,4.5,0,18,9,10,'#d7d6c7');box(0,.6,0,18.1,1.2,10.1,'#758c89');box(0,9.2,0,18.7,.4,10.7,'#657c7b');
 for(const dx of [-7,-3.5,0,3.5,7])for(const y of [3.9,6.8]){box(dx,y,5.08,2.1,1.8,.12,'#739599');box(dx,y,5.16,.07,1.8,.04,'#e9e6d3');box(dx,y,5.16,2.1,.07,.04,'#e9e6d3');}
 for(const side of [-1,1])for(const dz of [-3,0,3])for(const y of [3.9,6.8])box(side*9.05,y,dz,.1,1.8,1.8,'#739599');
 box(0,1.25,5.08,2.7,2.5,.15,'#3c656b');box(0,2.8,6,5.6,.25,2.2,'#9faeaa');box(0,.09,6,5.5,.18,2,'#c6c3af');
 box(-5,2.1,5.17,1.3,.35,.16,'#c44d41');box(-5,2.1,5.17,.35,1.3,.16,'#c44d41');box(6,10.1,0,2.1,.6,.22,'#c44d41');box(6,10.1,0,.6,2.1,.22,'#c44d41');
 for(const [color,list]of batches){const g=mergeGeometries(list);list.forEach(g=>g.dispose());geometries.push(g);const mesh=new T.Mesh(g,materials.get(color));mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);}
 const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=128;const c=canvas.getContext('2d');c.fillStyle='#294a52';c.fillRect(0,0,1024,128);c.fillStyle='#f4edda';c.font='bold 66px Arial';c.textAlign='center';c.fillText('ГОРОДСКАЯ БОЛЬНИЦА №1',512,87);
 const texture=new T.CanvasTexture(canvas),signMaterial=new T.MeshBasicMaterial({map:texture}),signGeometry=new T.PlaneGeometry(14,1),sign=new T.Mesh(signGeometry,signMaterial);sign.position.set(x,3.2,5.24+z);root.add(sign);
 const spawn={x,z:z+8};
 return {position,spawn,diagnostics:{...position,spawn:{...spawn},name:'Городская больница №1'},dispose(){root.removeFromParent();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());texture.dispose();signMaterial.dispose();signGeometry.dispose();}};
}
