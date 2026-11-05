import * as T from 'three';

/** Clothing accessories follow the authored head/spine, with world-size fitting. */
export function addUniform(person,owned){
 if(person.kind!=='worker')return;
 const owner=person.mesh,head=owner.getObjectByName('Head');if(!head)return;owner.updateWorldMatrix(true,true);
 const position=head.getWorldPosition(new T.Vector3()),hat=new T.Group(),police=!!person.patrolPolice;
 const material=new T.MeshStandardMaterial({color:police?'#254f89':'#edb23c',roughness:.7}),dark=new T.MeshStandardMaterial({color:police?'#102d50':'#d58924',roughness:.65});owned.materials.add(material);owned.materials.add(dark);
 const dome=new T.Mesh(police?new T.CylinderGeometry(.205,.185,.085,20):new T.SphereGeometry(.21,16,10,0,Math.PI*2,0,Math.PI/2),material),brim=new T.Mesh(new T.CylinderGeometry(police?.21:.245,police?.21:.245,.035,20),dark);dome.position.y=police?.12:.07;brim.position.y=.07;hat.add(dome,brim);
 if(police){const visor=new T.Mesh(new T.SphereGeometry(1,12,6),dark);visor.scale.set(.17,.018,.14);visor.position.set(0,.075,.14);hat.add(visor);}
 if(police){const badge=new T.Mesh(new T.OctahedronGeometry(.044,0),new T.MeshStandardMaterial({color:'#d6bf64',metalness:.4,roughness:.45}));badge.scale.set(.8,1,.18);badge.position.set(0,.15,.19);hat.add(badge);owned.materials.add(badge.material);}
 hat.traverse(n=>{if(n.isMesh){owned.geometries.add(n.geometry);n.castShadow=true;}});
 position.y+=.11;const world=new T.Matrix4().compose(position,owner.getWorldQuaternion(new T.Quaternion()),new T.Vector3(1,1,1));hat.matrixAutoUpdate=false;hat.matrix.copy(head.matrixWorld).invert().multiply(world);hat.name=police?'blue-police-peaked-cap':'construction-hard-hat';head.add(hat);
}
