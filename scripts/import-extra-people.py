"""Adapt pinned CC0 Quaternius people; reuse the recorded UAL clips in merch-male.glb.
Run: blender --background --threads 2 --python-exit-code 1 --python scripts/import-extra-people.py
"""
from pathlib import Path
import bpy
import sys
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(ROOT/'public/models/characters/merch-male.glb'))
original=set(bpy.data.objects)
source=next(o for o in original if o.type=='ARMATURE')
actions=[(t.name,t.strips[0].action) for t in source.animation_data.nla_tracks if t.strips]
for profile,filename,width in [('stocky','Worker',1.3),('short','Casual',1.04),('tall','Suit',.92),('elder','Farmer',1),('bandit','Punk',1)]:
    if '--profile' in sys.argv and profile!=sys.argv[sys.argv.index('--profile')+1]:continue
    before=set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(ROOT/f'art/quaternius/{filename}.glb'))
    objects=set(bpy.data.objects)-before
    armature=next(o for o in objects if o.type=='ARMATURE');armature.name='Citizen_'+profile
    renames={'Abdomen':'Spine'}
    for side,label in [('L','Left'),('R','Right')]:
        for old,new in [('UpperArm','Arm'),('LowerArm','Elbow'),('Hand','Hand'),('UpperLeg','Leg'),('LowerLeg','Knee'),('Foot','Foot')]:renames[old+'.'+side]=label+new
    for old,new in renames.items():
        if old in armature.data.bones:
            armature.data.bones[old].name=new
            for obj in objects:
                if obj.type=='MESH' and obj.vertex_groups.get(old):obj.vertex_groups[old].name=new
    for obj in original:
        if obj.name.startswith(('PalmGrip','FootContact')):
            clone=obj.copy();bpy.context.collection.objects.link(clone);clone.parent=armature;clone.parent_bone=obj.parent_bone;objects.add(clone)
    for bone in armature.data.bones:
        if bone.name in source.data.bones:
            for key in source.data.bones[bone.name].keys():bone[key]=source.data.bones[bone.name][key]
    for obj in objects:
        if obj.parent not in objects:obj.scale.x*=width
    if profile=='elder':
        for obj in objects:
            if obj.type=='MESH':
                for slot in obj.material_slots:
                    if slot.material and any(k in (slot.material.name+obj.name).lower() for k in ['hair','beard']):
                        mat=slot.material.copy();mat.diffuse_color=(.67,.67,.62,1)
                        if mat.use_nodes:
                            for node in mat.node_tree.nodes:
                                if node.type=='BSDF_PRINCIPLED':node.inputs['Base Color'].default_value=(.67,.67,.62,1)
                        slot.material=mat
        head=armature.matrix_world@armature.data.bones['Head'].head_local
        bpy.ops.mesh.primitive_uv_sphere_add(segments=12,ring_count=6,location=head+Vector((0,-.09,.07)))
        beard=bpy.context.object;beard.name='GreyBeard';beard.scale=(.12,.055,.11)
        mat=bpy.data.materials.new('Grey beard');mat.diffuse_color=(.72,.72,.68,1);beard.data.materials.append(mat)
        bpy.context.view_layer.update()
        matrix=beard.matrix_world.copy();beard.parent=armature;beard.parent_type='BONE';beard.parent_bone='Head';bpy.context.view_layer.update();beard.matrix_world=matrix;objects.add(beard)
    armature.animation_data_create();armature.animation_data.action=None
    for name,action in actions:
        track=armature.animation_data.nla_tracks.new();track.name=name;track.strips.new(name,0,action);track.mute=True
    armature['artist']='Quaternius';armature['license']='CC0-1.0';armature['profile']=profile;armature['rigVersion']=4
    bpy.context.scene.frame_set(0);bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:obj.select_set(True)
    bpy.context.view_layer.objects.active=armature
    bpy.ops.export_scene.gltf(filepath=str(ROOT/f'public/models/characters/civilian-{profile}.glb'),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_skins=True,export_cameras=False,export_lights=False,export_extras=True,export_rest_position_armature=True)
    for obj in objects:bpy.data.objects.remove(obj,do_unlink=True)
    print('EXPORTED',profile,len(actions),'clips')
