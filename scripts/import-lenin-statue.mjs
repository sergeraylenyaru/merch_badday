import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {mkdir,writeFile} from 'node:fs/promises';
import {Sculpt} from './vendor/aktobe/sculpt.mjs';
import {leninFigure} from './vendor/aktobe/lenin-figure.mjs';
import {chamferFrustum} from './vendor/aktobe/figure.mjs';
globalThis.FileReader=class{readAsArrayBuffer(blob){blob.arrayBuffer().then(v=>{this.result=v;this.onloadend?.();});}};
const root=new T.Group();root.name='Lenin-monument';root.userData={author:'Iskander Kinzhibayev',source:'https://github.com/iskan-k/aktobe-2000s',license:'MIT',adaptation:'Static GLB and granite pedestal for merch_badday'};
const shapes=[],batch={add(original,{color}){let g=original.index?original.toNonIndexed():original;if(color!==null){const c=new T.Color(color),a=new Float32Array(g.attributes.position.count*3);for(let i=0;i<a.length;i+=3){a[i]=c.r;a[i+1]=c.g;a[i+2]=c.b;}g.setAttribute('color',new T.BufferAttribute(a,3));}for(const key of Object.keys(g.attributes))if(!['position','normal','color'].includes(key))g.deleteAttribute(key);shapes.push(g);}};
leninFigure(new Sculpt(batch,0,3.1,0,0,2.3,{statue:true}));const geometry=mergeGeometries(shapes);shapes.forEach(g=>g.dispose());const figure=new T.Mesh(geometry,new T.MeshStandardMaterial({vertexColors:true,metalness:.4,roughness:.68}));figure.name='Lenin-figure-with-face-coat-and-pointing-arm';root.add(figure);
for(const [w,h,d,y,color]of [[3.6,.35,3.6,0,'#666862'],[2.45,2.5,2.45,.35,'#90918a'],[2.7,.25,2.7,2.85,'#606762']]){const g=chamferFrustum(w,d,w*.97,d*.97,h,.05),m=new T.MeshStandardMaterial({color,roughness:.86});const mesh=new T.Mesh(g,m);mesh.position.y=y;mesh.name='Granite-pedestal';root.add(mesh);}
root.updateMatrixWorld(true);const bounds=new T.Box3().setFromObject(root),bytes=await new GLTFExporter().parseAsync(root,{binary:true});await mkdir(new URL('../public/models/park/',import.meta.url),{recursive:true});await writeFile(new URL('../public/models/park/lenin-statue.glb',import.meta.url),Buffer.from(bytes));console.log(JSON.stringify({bytes:bytes.byteLength,bounds:bounds.getSize(new T.Vector3()).toArray(),triangles:geometry.attributes.position.count/3}));
