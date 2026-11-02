"""Style the existing animated merchant from the user's four concept sheets.
blender --background --threads 2 --python-exit-code 1 --python scripts/style-concept-hero.py
The operation is repeatable; animation tracks and palm/foot contracts survive.
"""
from pathlib import Path
import json
import struct
import bpy
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
path=ROOT/'public/models/characters/merch-male.glb'
source_bytes=path.read_bytes();source_json=json.loads(source_bytes[20:20+struct.unpack_from('<I',source_bytes,12)[0]])
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(path))
arm=next(o for o in bpy.data.objects if o.type=='ARMATURE')
for obj in list(bpy.data.objects):
    if obj.name.startswith(('ConceptHood','ConceptZip')):bpy.data.objects.remove(obj,do_unlink=True)
def color(material,hex):
    rgb=tuple((int(hex[i:i+2],16)/255)**2.2 for i in (0,2,4))+(1,)
    material.diffuse_color=rgb
    if material.use_nodes:
        for node in material.node_tree.nodes:
            if node.type=='BSDF_PRINCIPLED':node.inputs['Base Color'].default_value=rgb
for material in bpy.data.materials:
    for name,hex in [('Merch_BlueTShirt','94523b'),('Merch_BlackTrousers','42443c'),('Backpack_BlackFabric','615b49'),('Backpack_Straps','39372f')]:
        if material.name.startswith(name):color(material,hex)
jacket=next(m for m in bpy.data.materials if m.name.startswith('Merch_BlueTShirt'))
for mesh in [o for o in bpy.data.objects if o.type=='MESH']:
    groups={g.index for g in mesh.vertex_groups if g.name in ['LeftArm','RightArm','LeftElbow','RightElbow']}
    if not groups:continue
    mesh.data.materials.append(jacket);slot=len(mesh.data.materials)-1
    for polygon in mesh.data.polygons:
        source=mesh.data.materials[polygon.material_index]
        if not source or not source.name.startswith('Skin'):continue
        weight=sum(sum(g.weight for g in mesh.data.vertices[i].groups if g.group in groups) for i in polygon.vertices)/len(polygon.vertices)
        if weight>.55:polygon.material_index=slot
head=arm.matrix_world@arm.data.bones['Head'].head_local
bpy.ops.mesh.primitive_torus_add(major_segments=16,minor_segments=6,location=head+Vector((0,.10,-.04)),major_radius=.145,minor_radius=.05)
hood=bpy.context.object;hood.name='ConceptHood';hood.scale=(1,.9,.6);hood.data.materials.append(jacket)
bpy.context.view_layer.update();matrix=hood.matrix_world.copy();hood.parent=arm;hood.parent_type='BONE';hood.parent_bone='Chest';bpy.context.view_layer.update();hood.matrix_world=matrix
arm['visualStyle']='Rust hoodie, canvas backpack; user concept 2026-11-02';arm['rigVersion']=5
arm['wardrobe']='rust jacket with long sleeves and folded hood; charcoal trousers; canvas backpack with two shoulder straps'
bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',export_animations=True,export_animation_mode='NLA_TRACKS',export_skins=True,export_cameras=False,export_lights=False,export_extras=True,export_rest_position_armature=True)
# Blender's glTF round-trip shifts bone-parented empties by the bone length.
# Preserve the authored local transforms of the palm/foot anchors and backpack.
data=path.read_bytes();length=struct.unpack_from('<I',data,12)[0];result=json.loads(data[20:20+length]);binary=data[28+length:]
joints={i for skin in source_json.get('skins',[]) for i in skin['joints']}
original={n['name']:n for i,n in enumerate(source_json['nodes']) if i not in joints and 'name' in n}
for node in result['nodes']:
    old=original.get(node.get('name'))
    if not old or node.get('name','').startswith('Concept'):continue
    for key in ['translation','rotation','scale','matrix']:
        node.pop(key,None)
        if key in old:node[key]=old[key]
payload=json.dumps(result,separators=(',',':')).encode();payload+=b' '*((-len(payload))%4)
path.write_bytes(struct.pack('<4sII',b'glTF',2,28+len(payload)+len(binary))+struct.pack('<II',len(payload),0x4e4f534a)+payload+struct.pack('<II',len(binary),0x004e4942)+binary)
print('CONCEPT HERO EXPORTED',len(arm.animation_data.nla_tracks),'animation tracks')
