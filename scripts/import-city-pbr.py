#!/usr/bin/env python3
"""Import extracted user GLBs + textures, sharing pixel-identical PNGs.
Usage: python scripts/import-city-pbr.py INPUT_FOLDER
INPUT_FOLDER contains 49 GLBs, textures/*.png, and optional reference/*.glb.
Geometry/accessors/material factors are preserved; image buffers become URIs.
"""
import copy, hashlib, io, json, struct, sys
from pathlib import Path
from PIL import Image

source=Path(sys.argv[1]);target=Path(__file__).resolve().parents[1]/'public/models/city-pack'
target.mkdir(parents=True,exist_ok=True);(target/'textures').mkdir(exist_ok=True)
def digest(blob):return hashlib.sha256(blob).hexdigest()
def pixels(blob):
 im=Image.open(io.BytesIO(blob)).convert('RGBA')
 return digest(struct.pack('<II',*im.size)+im.tobytes())
textures={}
for path in sorted((source/'textures').glob('*.png')):
 blob=path.read_bytes();key=pixels(blob);name=path.stem+'.'+key[:12]+'.png'
 if key not in textures:
  textures[key]=name;(target/'textures'/name).write_bytes(blob)

def convert(path,destination,prefix='textures/'):
 blob=path.read_bytes();size,kind=struct.unpack_from('<II',blob,12)
 assert kind==0x4e4f534a
 data=json.loads(blob[20:20+size]);binary=blob[28+size:]
 assert len(data['buffers'])==1 and 'uri'not in data['buffers'][0]
 image_views=set()
 for image in data.get('images',[]):
  index=image.pop('bufferView');image_views.add(index);view=data['bufferViews'][index]
  raw=binary[view.get('byteOffset',0):view.get('byteOffset',0)+view['byteLength']]
  key=pixels(raw)
  if key not in textures:
   name='embedded.'+key[:12]+'.png';textures[key]=name;(target/'textures'/name).write_bytes(raw)
  image['uri']=prefix+textures[key];image['extras']={**image.get('extras',{}),'cityTextureKey':key}
 def normalized(value):
  if isinstance(value,list):return [normalized(v)for v in value]
  if not isinstance(value,dict):return value
  result={k:normalized(v)for k,v in value.items()}
  # TextureInfo indices are references, not stable across individual GLBs.
  if 'index'in value:
   t=data['textures'][value['index']];im=data['images'][t['source']]
   result['index']={'image':im['extras']['cityTextureKey'],'sampler':data.get('samplers',[])[t['sampler']]if'sampler'in t else{}}
  return result
 for material in data.get('materials',[]):
  key=digest(json.dumps(normalized(material),sort_keys=True,separators=(',',':')).encode())
  material['extras']={**material.get('extras',{}),'cityMaterialKey':key}
 new_binary=bytearray();new_views=[];remap={}
 for index,view in enumerate(data['bufferViews']):
  if index in image_views:continue
  while len(new_binary)%4:new_binary.append(0)
  start=view.get('byteOffset',0);new_view={**view,'byteOffset':len(new_binary)}
  new_binary.extend(binary[start:start+view['byteLength']]);remap[index]=len(new_views);new_views.append(new_view)
 def fix_views(value):
  if isinstance(value,dict):
   for k,v in value.items():
    if k=='bufferView':value[k]=remap[v]
    else:fix_views(v)
  elif isinstance(value,list):
   for v in value:fix_views(v)
 for accessor in data.get('accessors',[]):fix_views(accessor)
 data['bufferViews']=new_views;data['buffers'][0]['byteLength']=len(new_binary)
 encoded=json.dumps(data,separators=(',',':'),ensure_ascii=False).encode();encoded+=b' '*((-len(encoded))%4)
 new_binary+=b'\0'*((-len(new_binary))%4)
 result=struct.pack('<III',0x46546c67,2,28+len(encoded)+len(new_binary))+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+struct.pack('<II',len(new_binary),0x004e4942)+new_binary
 destination.parent.mkdir(parents=True,exist_ok=True);destination.write_bytes(result)
 return {'source_sha256':digest(blob),'bytes_before':len(blob),'bytes_after':len(result),'materials':len(data.get('materials',[])),'images':len(data.get('images',[]))}
(target/'texture-files.json').write_text(json.dumps({p.name:textures[pixels(p.read_bytes())] for p in sorted((source/'textures').glob('*.png'))},indent=2)+'\n')
report={}
for path in sorted(source.glob('*.glb')):report[path.name]=convert(path,target/path.name)
for path in sorted((source/'reference').glob('*.glb')):report['reference/'+path.name]=convert(path,target/'reference'/path.name,'../textures/')
(target/'import-report.json').write_text(json.dumps({'models':report,'shared_textures':len(textures),'geometry_changed':False,'texture_pixels_changed':False},indent=2)+'\n')
print('Imported',len(report),'GLBs; shared textures',len(textures),'GLB MiB',round(sum(v['bytes_before']for v in report.values())/1024**2,1),'->',round(sum(v['bytes_after']for v in report.values())/1024**2,1))
