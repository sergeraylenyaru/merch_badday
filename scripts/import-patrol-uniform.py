"""Adapt the CC0 Quaternius police uniform into a separate blue patrol GLB.
blender -b --threads 4 --python scripts/import-patrol-uniform.py
"""
from pathlib import Path
import bpy,math,json,struct
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
bpy.ops.wm.read_factory_settings(use_empty=True)
base=ROOT/'public/models/characters/police-officer.glb'
bpy.ops.import_scene.gltf(filepath=str(base));original=set(bpy.data.objects)
arm=next(o for o in original if o.type=='ARMATURE');arm.name='BluePatrolOfficer'
def material(name,color,metal=0):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=.74;p.inputs['Metallic'].default_value=metal;return m
blue=material('Police_Uniform_Blue',(.035,.12,.27));navy=material('Police_Uniform_Navy',(.018,.045,.10));black=material('Police_Belt_and_Visor',(.012,.018,.025));gold=material('Police_Badge_Gold',(.66,.48,.13),.45);light=material('Police_Shirt_Collar',(.23,.40,.63));white=material('Police_Lettering',(.75,.81,.86))
for o in list(original):
 if o.type!='MESH':continue
 if 'Head' in o.name:bpy.data.objects.remove(o,do_unlink=True);original.remove(o);continue
 o.data=o.data.copy();old=list(o.data.materials)
 for m in [blue,navy,black]:o.data.materials.append(m)
 for f in o.data.polygons:
  name=old[f.material_index].name if f.material_index<len(old) else ''
  if name.startswith('Skin'):continue
  centre=o.matrix_world@f.center
  f.material_index=len(old)+(0 if 'Body' in o.name and centre.z>1.17 else 1 if 'Leg' in o.name else 2)
# Keep a real skinned human head from the matching modular-men rig, without
# the tactical helmet. The uniform itself remains the actual SWAT mesh.
before=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=str(ROOT/'public/models/characters/civilian-tall.glb'));added=set(bpy.data.objects)-before
heads=[o for o in added if o.type=='MESH' and 'Head' in o.name]
if not heads:raise RuntimeError('No Suit head found')
points=[o.matrix_world@Vector(c) for o in heads for c in o.bound_box];xmin=min(p.x for p in points);xmax=max(p.x for p in points);ymin=min(p.y for p in points);ymax=max(p.y for p in points);zmax=max(p.z for p in points)
for o in heads:
 o.data.transform(arm.matrix_world.inverted()@o.matrix_world);o.parent=arm;o.matrix_parent_inverse.identity();o.matrix_basis.identity()
 for mod in o.modifiers:
  if mod.type=='ARMATURE':mod.object=arm
 o.parent=arm;o.name='Patrol_Head';original.add(o)
for o in added:
 if o not in heads:bpy.data.objects.remove(o,do_unlink=True)
arm.data.pose_position='REST';bpy.context.view_layer.update();dg=bpy.context.evaluated_depsgraph_get();points=[]
for o in heads:
 evaluated=o.evaluated_get(dg);data=evaluated.to_mesh();points.extend(evaluated.matrix_world@v.co for v in data.vertices);evaluated.to_mesh_clear()
xmin=min(p.x for p in points);xmax=max(p.x for p in points);ymin=min(p.y for p in points);ymax=max(p.y for p in points);zmax=max(p.z for p in points);arm.data.pose_position='POSE'
def bind(o,bone):
 if o.type!='MESH':bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.convert(target='MESH');o=bpy.context.object
 o.data.transform(arm.matrix_world.inverted()@o.matrix_world);o.parent=arm;o.matrix_parent_inverse.identity();o.matrix_basis.identity()
 vg=o.vertex_groups.new(name=bone);vg.add(list(range(len(o.data.vertices))),1,'REPLACE');mod=o.modifiers.new('Uniform follows skeleton','ARMATURE');mod.object=arm;original.add(o);return o
def mesh(name,vertices,faces,m,bone):
 data=bpy.data.meshes.new(name);data.from_pydata(vertices,[],faces);data.update();o=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(o);data.materials.append(m);return bind(o,bone)
cx=(xmin+xmax)/2;cy=(ymin+ymax)/2;rx=(xmax-xmin)*.53;ry=(ymax-ymin)*.52;base_z=zmax-.045
verts=[];faces=[];segments=32
for z,sx,sy in [(base_z,.98,.98),(base_z+.018,1.05,1.03),(base_z+.075,1.12,1.06),(base_z+.092,1.04,1.0)]:
 for i in range(segments):a=i*math.tau/segments;verts.append((cx+math.cos(a)*rx*sx,cy+math.sin(a)*ry*sy,z))
for ring in range(3):
 for i in range(segments):a=ring*segments+i;b=ring*segments+(i+1)%segments;faces.append((a,b,b+segments,a+segments))
faces.append(tuple(3*segments+i for i in range(segments)));mesh('Police_fitted_peaked_cap',verts,faces,navy,'Head')
verts=[];faces=[]
for h in [0,-.014]:
 for radius in [.72,1.0]:
  for i in range(17):a=i*math.pi/16;verts.append((cx+math.cos(a)*rx*1.1*radius,cy-math.sin(a)*ry*1.4*radius,base_z+h-.015*math.sin(a)))
for i in range(16):
 faces.extend([(i,i+1,17+i+1,17+i),(34+i,51+i,51+i+1,34+i+1),(17+i,17+i+1,51+i+1,51+i)])
mesh('Police_curved_cap_visor',verts,faces,black,'Head')
def badge(name,x,y,z,size,bone):
 vertices=[(x-size*.5,y,z+size*.5),(x+size*.5,y,z+size*.5),(x+size*.4,y,z-size*.18),(x,y,z-size*.6),(x-size*.4,y,z-size*.18)];mesh(name,vertices,[(0,1,2,3,4)],gold,bone)
badge('Cap_badge',cx,cy-ry*1.075,base_z+.048,.06,'Head');badge('Chest_badge',-.12,-.178,1.36,.075,'Spine')
# Fabric collar and shoulder straps are meshes skinned to the uniform, rather
# than floating runtime shapes.
mesh('Police_shirt_collar',[(-.095,-.14,1.48),(0,-.155,1.43),(-.06,-.17,1.38),(.095,-.14,1.48),(.06,-.17,1.38)],[(0,1,2),(3,4,1)],light,'Spine')
for side,bone in [(-1,'RightArm'),(1,'LeftArm')]:
 x=side*.20;mesh('Police_epaulette',[(x-.06,-.075,1.48),(x+.06,-.075,1.48),(x+.06,.045,1.48),(x-.06,.045,1.48)],[(0,1,2,3)],navy,bone)
font=Path('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf')
if font.exists():
 bpy.ops.object.text_add(location=(.168,.091,1.34));o=bpy.context.object;o.name='POLICE_back_label';o.data.body='ПОЛИЦИЯ';o.data.size=.06;o.data.extrude=.0005;o.data.font=bpy.data.fonts.load(str(font));o.rotation_euler=(math.pi/2,0,math.pi);o.data.materials.append(white);bind(o,'Spine')
arm['source']='Quaternius Swat uniform + Suit head · CC0';arm['adaptation']='Blue street patrol with fitted skinned peaked cap, insignia and uniform';arm['rigVersion']=5
bpy.ops.object.select_all(action='DESELECT')
for o in original:o.select_set(True)
bpy.context.view_layer.objects.active=arm;bpy.context.scene.frame_set(0)
out=ROOT/'public/models/characters/police-patrol.glb'
bpy.ops.export_scene.gltf(filepath=str(out),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_skins=True,export_extras=True,export_rest_position_armature=True)
# Preserve the already corrected hand/foot contact contract through re-export.
raw=base.read_bytes();j=json.loads(raw[20:20+struct.unpack_from('<I',raw,12)[0]]);anchors={n['name']:n for n in j['nodes'] if n.get('name','').startswith(('PalmGrip','FootContact'))}
raw=out.read_bytes();length,kind=struct.unpack_from('<II',raw,12);data=json.loads(raw[20:20+length])
for n in data['nodes']:
 name=n.get('name','').split('.')[0]
 if name in anchors:
  n['name']=name
  for key in ['translation','rotation','scale']:
   if key in anchors[name]:n[key]=anchors[name][key]
chunk=json.dumps(data,separators=(',',':')).encode();chunk+=b' '*((-len(chunk))%4);tail=raw[20+length:];out.write_bytes(struct.pack('<III',0x46546c67,2,20+len(chunk)+len(tail))+struct.pack('<II',len(chunk),kind)+chunk+tail)
print('PATROL_EXPORTED',out.stat().st_size,'head',xmin,xmax,ymin,ymax,zmax)
