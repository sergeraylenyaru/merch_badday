import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {HOME_CAR,START} from './reference-layout.js';

export function createHomeYard(scene,world){
 const root=new T.Group();root.name='home-resident-parking';scene.add(root);
 const owned=[],road=new T.MeshStandardMaterial({color:'#6c6c63',roughness:1}),paint=new T.MeshStandardMaterial({color:'#d1c9aa',roughness:1});
 const base=new T.Mesh(new T.BoxGeometry(17,.025,3.5),road);base.position.set(HOME_CAR.x-5.5,.014,HOME_CAR.z);base.receiveShadow=true;root.add(base);owned.push(base.geometry);
 const strips=[];
 function line(x,z,w,d){const g=new T.BoxGeometry(w,.012,d);g.translate(x,.035,z);strips.push(g);}
 for(const x of [HOME_CAR.x-14,HOME_CAR.x-8.5,HOME_CAR.x-3,HOME_CAR.x+2.5])line(x,HOME_CAR.z,.10,3.3);
 for(const z of [HOME_CAR.z-1.65,HOME_CAR.z+1.65])line(HOME_CAR.x-5.75,z,16.5,.1);
 const geometry=mergeGeometries(strips);strips.forEach(g=>g.dispose());root.add(new T.Mesh(geometry,paint));owned.push(geometry);
 return {diagnostics:{start:{...START},car:{...HOME_CAR},spaces:3},dispose(){root.removeFromParent();owned.forEach(g=>g.dispose());road.dispose();paint.dispose();}};
}
