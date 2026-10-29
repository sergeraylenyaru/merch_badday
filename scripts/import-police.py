"""Adapt pinned CC0 Quaternius Swat to the existing human animation rig.
Run: blender --background --threads 2 --python-exit-code 1 --python scripts/import-police.py
Reuses recorded CC0 animation clips already embedded in merch-male.glb.
"""
from pathlib import Path
import bpy
ROOT=Path(__file__).resolve().parents[1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(ROOT/'public/models/characters/merch-male.glb'))
original=set(bpy.data.objects)
source=next(o for o in original if o.type=='ARMATURE')
actions=[(t.name,t.strips[0].action) for t in source.animation_data.nla_tracks if t.strips]
bpy.ops.import_scene.gltf(filepath=str(ROOT/'art/quaternius/police-swat.glb'))
objects=set(bpy.data.objects)-original
armature=next(o for o in objects if o.type=='ARMATURE')
armature.name='PoliceOfficer'
renames={'Abdomen':'Spine'}
for side,label in [('L','Left'),('R','Right')]:
 for old,new in [('UpperArm','Arm'),('LowerArm','Elbow'),('Hand','Hand'),('UpperLeg','Leg'),('LowerLeg','Knee'),('Foot','Foot')]:renames[old+'.'+side]=label+new
for old,new in renames.items():
 if old in armature.data.bones:
  armature.data.bones[old].name=new
  for obj in objects:
   if obj.type=='MESH' and obj.vertex_groups.get(old):obj.vertex_groups[old].name=new
# Grip/foot anchors carry the same rest-bone transforms as this pack's male rig.
for obj in original:
 if obj.name.startswith(('PalmGrip','FootContact')):
  clone=obj.copy();bpy.context.collection.objects.link(clone);clone.parent=armature;clone.parent_bone=obj.parent_bone;objects.add(clone)
for bone in armature.data.bones:
 if bone.name in source.data.bones:
  for key in source.data.bones[bone.name].keys():bone[key]=source.data.bones[bone.name][key]
armature.animation_data_create();armature.animation_data.action=None
for name,action in actions:
 track=armature.animation_data.nla_tracks.new();track.name=name;track.strips.new(name,0,action);track.mute=True
armature['artist']='Quaternius';armature['license']='CC0-1.0';armature['role']='Police officer · Swat';armature['rigVersion']=4
for obj in original:bpy.data.objects.remove(obj,do_unlink=True)
bpy.context.scene.frame_set(0);bpy.ops.object.select_all(action='DESELECT')
for obj in objects:obj.select_set(True)
bpy.context.view_layer.objects.active=armature
bpy.ops.export_scene.gltf(filepath=str(ROOT/'public/models/characters/police-officer.glb'),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_skins=True,export_cameras=False,export_lights=False,export_extras=True,export_rest_position_armature=True)
print('POLICE_EXPORTED',len(actions),'clips')
