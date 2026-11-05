"""Embed selected CC0 KayKit Restaurant Bits glTF files into standalone GLBs.
Usage: python scripts/import-restaurant-models.py /path/to/Assets/gltf
Source: KayKit-Game-Assets/KayKit-Restaurant-Bits-1.0 @153c8a7535b48237854cb54ff6890679f8c574d1
"""
from pathlib import Path
import json,struct,sys,shutil
root=Path(__file__).resolve().parents[1]; source=Path(sys.argv[1]); out=root/'public/models/food';out.mkdir(parents=True,exist_ok=True)
for name in ['food_burger','kitchencounter_straight_A','menu','food_ingredient_potato_chopped']:
 d=json.loads((source/(name+'.gltf')).read_text());binary=bytearray()
 for buf in d['buffers']:
  while len(binary)%4:binary.append(0)
  start=len(binary);binary.extend((source/buf['uri']).read_bytes())
  for view in d['bufferViews']:
   if view.get('buffer',0)==d['buffers'].index(buf):view['byteOffset']=view.get('byteOffset',0)+start;view['buffer']=0
 for im in d.get('images',[]):
  while len(binary)%4:binary.append(0)
  data=(source/im.pop('uri')).read_bytes();im['bufferView']=len(d['bufferViews']);im['mimeType']='image/png';d['bufferViews'].append({'buffer':0,'byteOffset':len(binary),'byteLength':len(data)});binary.extend(data)
 d['buffers']=[{'byteLength':len(binary)}];d['asset']['copyright']='Kay Lousberg, CC0; KayKit Restaurant Bits 1.0'
 while len(binary)%4:binary.append(0)
 j=json.dumps(d,separators=(',',':')).encode();j+=b' '*((-len(j))%4)
 data=struct.pack('<4sII',b'glTF',2,28+len(j)+len(binary))+struct.pack('<I4s',len(j),b'JSON')+j+struct.pack('<I4s',len(binary),b'BIN\0')+binary
 (out/(name+'.glb')).write_bytes(data);print(name,len(data))
shutil.copyfile(source.parent/'LICENSE.txt',out/'KAYKIT_LICENSE.txt')
