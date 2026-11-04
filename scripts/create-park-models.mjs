import {mkdir,writeFile} from 'node:fs/promises';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {createParkModel} from '../src/visuals/park-models.js';
globalThis.FileReader=class{readAsArrayBuffer(blob){blob.arrayBuffer().then(value=>{this.result=value;this.onloadend?.();});}};
await mkdir(new URL('../public/models/park/',import.meta.url),{recursive:true});
for(const id of ['chain-swing','pirate-ship','mini-coaster']){const model=createParkModel(id),bytes=await new GLTFExporter().parseAsync(model,{binary:true,animations:model.animations});await writeFile(new URL('../public/models/park/'+id+'.glb',import.meta.url),Buffer.from(bytes));model.traverse(n=>{n.geometry?.dispose();n.material?.dispose();});console.log(id,bytes.byteLength);}
