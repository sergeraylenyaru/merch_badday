import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

const FILES={bat:'baseball-bat',stick:'wooden-stick',water:'water-pistol',pistol:'guard-pistol',vest:'security-vest',shovel:'shovel'};
export async function loadEquipmentModels(base){
 const loader=new GLTFLoader(),models=new Map(await Promise.all(Object.entries(FILES).map(async([id,file])=>[id,(await loader.loadAsync(`${base}models/equipment/${file}.glb`)).scene])));
 return {
  make(parent,id){const source=models.get(id);if(!source)return false;const model=source.clone(true);model.name='equipment-model:'+id;if(id==='pistol')model.scale.setScalar(.65);model.traverse(n=>{if(n.isMesh)n.castShadow=n.receiveShadow=true;});parent.add(model);return true;},
  dress(person){
   const owner=person.mesh,vest=models.get('vest').clone(true),spine=owner.getObjectByName('Spine')??owner;
   owner.updateWorldMatrix(true,true);
   const shoulder=owner.getObjectByName('RightArm'),head=owner.getObjectByName('Head');
   const top=head?owner.worldToLocal(head.getWorldPosition(new T.Vector3())).y:2;
   const factor=top/1.65,centre=shoulder?owner.worldToLocal(shoulder.getWorldPosition(new T.Vector3())):new T.Vector3(0,1.5,0);
   centre.x=0;centre.y-=.12*factor;centre.z+=.015;
   const world=new T.Matrix4().compose(centre,new T.Quaternion(),new T.Vector3(factor,factor,factor)).premultiply(owner.matrixWorld);
   vest.name='fitted-SWAT-security-vest';vest.matrixAutoUpdate=false;vest.matrix.copy(spine.matrixWorld).invert().multiply(world);spine.add(vest);
   return vest;
  },
  diagnostics:{files:Object.values(FILES).map(f=>`models/equipment/${f}.glb`),sourceModels:models.size},
  dispose(){const geometries=new Set(),materials=new Set(),textures=new Set();for(const s of models.values())s.traverse(n=>{if(n.isMesh){geometries.add(n.geometry);for(const m of Array.isArray(n.material)?n.material:[n.material]){materials.add(m);for(const v of Object.values(m))if(v?.isTexture)textures.add(v);}}});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());},
 };
}
