"""Adapt CC0 Quaternius people and retarget CC0 UAL clips onto their skins.

blender --background --python scripts/import-human-characters.py -- \
  --animations /path/to/UAL1_Standard.fbx
Source GLBs and provenance are in art/quaternius. No third-party Python is used.
"""
import argparse
import math
import sys
from pathlib import Path
import bpy
from mathutils import Vector, Quaternion, Matrix

ROOT = Path(__file__).resolve().parents[1]
args = argparse.ArgumentParser()
args.add_argument('--animations', required=True)
options = args.parse_args(sys.argv[sys.argv.index('--') + 1:])
OUT = ROOT / 'public/models/characters'
OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=options.animations)
source = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
source.name = 'AnimationSource'
source_actions = {a.name.split('|')[-1]: a for a in bpy.data.actions}
for o in list(bpy.data.objects):
    o.hide_render = True

CLIPS = {
    'Idle': 'Idle_Loop', 'Walk': 'Walk_Loop', 'Run': 'Jog_Fwd_Loop',
    'Sprint': 'Sprint_Loop', 'Crouch': 'Crouch_Idle_Loop',
    'CrouchWalk': 'Crouch_Fwd_Loop', 'Push': 'Push_Loop',
    'Jump': 'Jump_Start', 'Fall': 'Jump_Loop', 'Land': 'Jump_Land',
    'Punch': 'Punch_Jab', 'StrongPunch': 'Punch_Cross', 'Drive': 'Driving_Loop',
    'Talk': 'Idle_Talking_Loop', 'Interact': 'Interact', 'PickUp': 'PickUp_Table',
    'Fixing': 'Fixing_Kneeling', 'WalkFormal': 'Walk_Formal_Loop',
}
PAIRS = {'Root': 'root', 'Hips': 'pelvis', 'Abdomen': 'spine_01',
         'Torso': 'spine_02', 'Chest': 'spine_03', 'Neck': 'neck_01', 'Head': 'Head'}
RENAMES = {'Abdomen': 'Spine'}
for side, suffix in [('L', 'l'), ('R', 'r')]:
    label = 'Left' if side == 'L' else 'Right'
    for target, origin in [('Shoulder', 'clavicle'), ('UpperArm', 'upperarm'),
                           ('LowerArm', 'lowerarm'), ('Hand', 'hand'),
                           ('UpperLeg', 'thigh'), ('LowerLeg', 'calf'), ('Foot', 'foot')]:
        PAIRS[target + '.' + side] = origin + '_' + suffix
    for target, name in [('UpperArm', 'Arm'), ('LowerArm', 'Elbow'), ('Hand', 'Hand'),
                         ('UpperLeg', 'Leg'), ('LowerLeg', 'Knee'), ('Foot', 'Foot')]:
        RENAMES[target + '.' + side] = label + name

def color(material, value):
    rgb = [int(value[i:i+2], 16) / 255 for i in (0, 2, 4)]
    rgb = [c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4 for c in rgb]
    material.use_nodes = True
    shader = material.node_tree.nodes.get('Principled BSDF')
    for link in list(shader.inputs['Base Color'].links):
        material.node_tree.links.remove(link)
    shader.inputs['Base Color'].default_value = (*rgb, 1)
    shader.inputs['Roughness'].default_value = .8
    material.diffuse_color = (*rgb, 1)

def material(name, value):
    result = bpy.data.materials.new(name)
    color(result, value)
    return result

def attach(obj, armature, bone, world_matrix):
    obj.parent = armature
    obj.parent_type = 'BONE'
    obj.parent_bone = bone
    bpy.context.view_layer.update()
    obj.matrix_world = world_matrix
    return obj

def anchor(name, armature, bone, position):
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    return attach(obj, armature, bone, Matrix.Translation(position))

def cube(name, position, size, mat, armature, bone, bevel=.012):
    bpy.ops.mesh.primitive_cube_add(size=1, location=position)
    obj = bpy.context.object
    obj.name = name
    obj.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        modifier = obj.modifiers.new('Soft edges', 'BEVEL')
        modifier.width = bevel
        modifier.segments = 2
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    obj.data.materials.append(mat)
    matrix = obj.matrix_world.copy()
    return attach(obj, armature, bone, matrix)

def forward(armature, name):
    b = armature.data.bones[name]
    v = (armature.matrix_world @ b.tail_local) - (armature.matrix_world @ b.head_local)
    v.z = 0
    return v.normalized()

source_rest = {b.name: source.matrix_world @ b.matrix_local for b in source.data.bones}

for female in [False, True]:
    before = set(bpy.data.objects)
    filename = 'female-casual.glb' if female else 'male-casual.glb'
    bpy.ops.import_scene.gltf(filepath=str(ROOT / 'art/quaternius' / filename))
    objects = set(bpy.data.objects) - before
    armature = next(o for o in objects if o.type == 'ARMATURE')
    armature.name = 'FemaleCivilian' if female else 'MaleMerch'
    for obj in objects:
        obj.hide_render = False
        if obj.type != 'MESH': continue
        for mat in obj.data.materials:
            name = mat.name.split('.')[0]
            if not female:
                if name == 'LightBrown': color(mat, '225ab5'); mat.name = 'Merch_BlueTShirt'
                elif name == 'LightBlue': color(mat, '17191e'); mat.name = 'Merch_BlackTrousers'
                elif name == 'Red_Dark': color(mat, '242933')
            else:
                if name == 'White': color(mat, '49868b'); mat.name = 'Civilian_TealShirt'
                elif name == 'Orange': color(mat, '252c38'); mat.name = 'Civilian_Trousers'
                elif name == 'Hair_Blond': color(mat, '65412c')
    # Canonical names are a visual adapter contract, never gameplay rules.
    for old, new in RENAMES.items():
        if old not in armature.data.bones: continue
        armature.data.bones[old].name = new
        for obj in objects:
            if obj.type == 'MESH' and obj.vertex_groups.get(old): obj.vertex_groups[old].name = new
    pairs = {RENAMES.get(name, name): src for name, src in PAIRS.items()}
    for side, suffix in [('L', 'l'), ('R', 'r')]:
        for digit in ['Index', 'Middle', 'Ring', 'Pinky', 'Thumb']:
            available = [b.name for b in armature.data.bones if b.name.startswith(digit) and b.name.endswith('.' + side)]
            for i, name in enumerate(sorted(available)):
                pairs[name] = digit.lower() + '_0' + str(i + 1) + '_' + suffix
    target_rest = {b.name: armature.matrix_world @ b.matrix_local for b in armature.data.bones}
    a, b = forward(source, 'foot_l'), forward(armature, 'LeftFoot')
    alignment = Quaternion((0, 0, 1), math.atan2(b.y, b.x) - math.atan2(a.y, a.x))
    inverse_alignment = alignment.inverted()
    object_rotation = armature.matrix_world.to_quaternion()
    ordered = sorted(armature.pose.bones, key=lambda p: len(p.parent_recursive))
    local_rest = {p.name: ((p.parent.bone.matrix_local.inverted() @ p.bone.matrix_local)
                          if p.parent else p.bone.matrix_local).to_quaternion() for p in ordered}
    ratio = (target_rest['Head'].translation.z - target_rest['LeftFoot'].translation.z) / (source_rest['Head'].translation.z - source_rest['foot_l'].translation.z)
    # Wrist contact orientation maps the open T-pose hand toward the handle.
    yup = Quaternion((1, 0, 0), -math.pi / 2)
    for side, label in [('L', 'Left'), ('R', 'Right')]:
        hand = armature.data.bones[label + 'Hand']
        head = armature.matrix_world @ hand.head_local
        middle = next(b for b in armature.data.bones if b.name == sorted(b.name for b in armature.data.bones if b.name.startswith('Middle') and b.name.endswith('.' + side))[0])
        tail = armature.matrix_world @ middle.head_local
        anchor('PalmGrip' + label, armature, hand.name, head.lerp(tail, .6))
        desired = (tail - head).normalized().rotation_difference(Vector((0, -1, 0))) @ target_rest[hand.name].to_quaternion()
        q = yup @ desired @ yup.inverted()
        hand['gripOrientation'] = [q.x, q.y, q.z, q.w]
        foot = armature.data.bones[label + 'Foot']
        point = (armature.matrix_world @ foot.head_local).lerp(armature.matrix_world @ foot.tail_local, .65)
        point.z = .018
        anchor('FootContact' + label, armature, foot.name, point)
    if not female:
        dark = material('Backpack_BlackFabric', '1c2636')
        trim = material('Backpack_Straps', '111827')
        cube('Backpack', (0, .19, 1.20), (.36, .17, .47), dark, armature, 'Chest', .035)
        cube('Backpack_FrontPocket', (0, .29, 1.12), (.28, .065, .23), trim, armature, 'Chest', .025)
        cube('Backpack_Handle', (0, .19, 1.46), (.13, .045, .025), trim, armature, 'Chest', .009)
        for x in [-.13, .13]:
            cube('Backpack_ShoulderStrap', (x, .09, 1.29), (.035, .045, .46), trim, armature, 'Chest', .012)
        armature['wardrobe'] = 'blue T-shirt; black trousers; structured backpack with two shoulder straps'
    imported = set(bpy.data.objects) - before
    clips = []
    for name, original_name in CLIPS.items():
        original = source_actions[original_name]
        source.animation_data.action = original
        action = bpy.data.actions.new(name)
        armature.animation_data_create()
        armature.animation_data.action = action
        start, end = [int(n) for n in original.frame_range]
        for frame in range(start, end + 1):
            bpy.context.scene.frame_set(frame)
            desired_rotations = {}
            for p in ordered:
                src = pairs.get(p.name)
                if src and src in source.pose.bones:
                    pose_world = source.matrix_world @ source.pose.bones[src].matrix
                    delta = pose_world.to_quaternion() @ source_rest[src].to_quaternion().inverted()
                    world = alignment @ delta @ inverse_alignment @ target_rest[p.name].to_quaternion()
                    desired = object_rotation.inverted() @ world
                else:
                    parent = desired_rotations[p.parent.name] if p.parent else Quaternion()
                    desired = parent @ local_rest[p.name]
                parent = desired_rotations[p.parent.name] if p.parent else Quaternion()
                p.rotation_mode = 'QUATERNION'
                p.rotation_quaternion = local_rest[p.name].inverted() @ parent.inverted() @ desired
                p.location = (0, 0, 0)
                if p.name == 'Hips':
                    delta = (source.matrix_world @ source.pose.bones['pelvis'].matrix).translation - source_rest['pelvis'].translation
                    vertical = Vector((0, 0, delta.z * ratio))
                    p.location = target_rest[p.name].to_3x3().inverted() @ vertical
                    p.keyframe_insert('location', frame=frame-start)
                p.keyframe_insert('rotation_quaternion', frame=frame-start)
                desired_rotations[p.name] = desired
        for curve in action.fcurves:
            for key in curve.keyframe_points: key.interpolation = 'LINEAR'
        clips.append(action)
    armature.animation_data.action = None
    for action in clips:
        track = armature.animation_data.nla_tracks.new()
        track.name = action.name
        strip = track.strips.new(action.name, 0, action)
        track.mute = True
    for p in armature.pose.bones:
        p.rotation_quaternion = Quaternion()
        p.location = (0, 0, 0)
    armature['artist'] = 'Quaternius'
    armature['license'] = 'CC0-1.0'
    armature['rigVersion'] = 4
    bpy.context.scene.render.fps = 30
    bpy.context.scene.frame_set(0)
    bpy.ops.object.select_all(action='DESELECT')
    for obj in imported: obj.select_set(True)
    bpy.context.view_layer.objects.active = armature
    name = 'civilian-female.glb' if female else 'merch-male.glb'
    bpy.ops.export_scene.gltf(filepath=str(OUT / name), export_format='GLB', use_selection=True,
        export_animations=True, export_animation_mode='NLA_TRACKS', export_skins=True,
        export_cameras=False, export_lights=False, export_extras=True,
        export_rest_position_armature=True)
    print('CHARACTER_EXPORTED', name, (OUT / name).stat().st_size, 'clips', [a.name for a in clips])
    for obj in imported: bpy.data.objects.remove(obj, do_unlink=True)
    for action in clips: bpy.data.actions.remove(action)
