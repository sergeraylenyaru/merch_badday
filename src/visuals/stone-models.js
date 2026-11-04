import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
export const STONE_MODELS=['rock-round','rock-flat','rock-moss'];
export function prepareStoneModel(root){
 root.updateMatrixWorld(true);const bounds=new T.Box3().setFromObject(root),size=bounds.getSize(new T.Vector3()),center=bounds.getCenter(new T.Vector3()),scale=.4/Math.max(size.x,size.y,size.z),transform=new T.Matrix4().makeScale(scale,scale,scale).multiply(new T.Matrix4().makeTranslation(-center.x,-bounds.min.y,-center.z)),parts=[];
 root.traverse(n=>{if(!n.isMesh)return;const g=n.geometry.index?n.geometry.toNonIndexed():n.geometry.clone(),colors=new Float32Array(g.attributes.position.count*3),materials=Array.isArray(n.material)?n.material:[n.material],groups=g.groups.length?g.groups:[{start:0,count:g.attributes.position.count,materialIndex:0}],old=g.attributes.color;
  for(const group of groups){const color=materials[group.materialIndex??0].color;for(let i=group.start;i<group.start+group.count;i++){colors[i*3]=color.r*(old?.getX(i)??1);colors[i*3+1]=color.g*(old?.getY(i)??1);colors[i*3+2]=color.b*(old?.getZ(i)??1);}}
  g.applyMatrix4(new T.Matrix4().multiplyMatrices(transform,n.matrixWorld));for(const key of Object.keys(g.attributes))if(!['position','normal'].includes(key))g.deleteAttribute(key);g.setAttribute('color',new T.BufferAttribute(colors,3));g.clearGroups();parts.push(g);
 });const geometry=mergeGeometries(parts);parts.forEach(g=>g.dispose());return geometry;
}
export async function loadStoneModels(base){const loader=new GLTFLoader(),models=await Promise.all(STONE_MODELS.map(name=>loader.loadAsync(`${base}models/nature/${name}.glb`)));return models.map(({scene})=>{const geometry=prepareStoneModel(scene);scene.traverse(n=>{if(n.isMesh){n.geometry.dispose();for(const m of Array.isArray(n.material)?n.material:[n.material])m.dispose();}});return geometry;});}
