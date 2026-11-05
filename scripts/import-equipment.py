"""Rebuild with: blender -b --python scripts/import-equipment.py (Blender 4+)."""
import bpy, math, pathlib
from mathutils import Vector

ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=ROOT/'public/models/equipment'; OUT.mkdir(parents=True,exist_ok=True)
def clear():
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
def material(name,color,metal=0,rough=.65):
    m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough
    return m
def model(name,vertices,faces,materials,indices=None):
    mesh=bpy.data.meshes.new(name);mesh.from_pydata([(x,-z,y) for x,y,z in vertices],[],faces);mesh.update()
    o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o)
    for m in materials:o.data.materials.append(m)
    if indices:
        for p,i in zip(mesh.polygons,indices):p.material_index=i
    return o
def source(path,transform=lambda p:p,face_filter=lambda o,p:True):
    bpy.ops.import_scene.gltf(filepath=str(ROOT/path));original=list(bpy.context.selected_objects);out=[]
    for o in original:
        if o.type!='MESH':continue
        verts=[];faces=[];indices=[]
        for v in o.data.vertices:
            p=o.matrix_world@v.co;verts.append(transform(Vector((p.x,p.z,-p.y))))
        for p in o.data.polygons:
            if face_filter(o,p):faces.append(tuple(p.vertices));indices.append(p.material_index)
        if faces:out.append(model(o.name+'-adapted',verts,faces,list(o.data.materials),indices))
    for o in original:bpy.data.objects.remove(o,do_unlink=True)
    return out
def marker(name,position):
    o=bpy.data.objects.new(name,None);o.location=(position[0],-position[2],position[1]);bpy.context.collection.objects.link(o)
def lathe(name,profile,m,segments=32):
    verts=[];faces=[]
    for y,r in profile:
        for j in range(segments):
            a=j*math.tau/segments;verts.append((math.cos(a)*r,y,math.sin(a)*r))
    for i in range(len(profile)-1):
        for j in range(segments):a=i*segments+j;b=i*segments+(j+1)%segments;faces.append((a,b,b+segments,a+segments))
    faces.extend([tuple(reversed(range(segments))),tuple((len(profile)-1)*segments+j for j in range(segments))])
    o=model(name,verts,faces,[m]);
    for p in o.data.polygons:p.use_smooth=True
    return o
def sphere(name,p,scale,m):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=20,ring_count=12,location=(p[0],-p[2],p[1]));o=bpy.context.object;o.name=name;o.scale=(scale[0],scale[2],scale[1]);o.data.materials.append(m)
def save(name,author):
    for o in bpy.context.scene.objects:o['source_author']=author
    bpy.ops.export_scene.gltf(filepath=str(OUT/(name+'.glb')),export_format='GLB',export_extras=True,export_animations=False)
    print('EQUIPMENT',name,(OUT/(name+'.glb')).stat().st_size)

clear()
# Quaternius pistol: +X barrel becomes +Z; the grip centre is the right palm.
source(pathlib.Path('art/weapons/pistol-source.glb'),lambda p:Vector((-p.z*.3,(p.y+.18)*.3,(p.x+.12)*.3)))
marker('Muzzle',(0,.222,.481));marker('Palm',(0,0,0));save('guard-pistol','Quaternius · CC0 · Survival Pack Pistol_1')

clear()
water_parts=source(pathlib.Path('art/weapons/kenney-blaster/blaster-a.glb'),lambda p:Vector((p.x*.8,(p.y+.17)*.8,(p.z+.05)*.8)))
cyan=material('Translucent-looking cyan reservoir',(.035,.65,.8),.05,.25)
toy_body=material('Cyan moulded toy casing',(.025,.48,.62),0,.4)
toy_grip=material('Orange toy grip',(.95,.32,.035),0,.6)
for o in water_parts:
    o.data.materials.clear();o.data.materials.append(toy_body);o.data.materials.append(toy_grip)
    for p in o.data.polygons:p.material_index=1 if p.center.z<.09 or -p.center.y>.31 else 0
sphere('Rounded water reservoir',(0,.29,-.075),(.085,.085,.15),cyan)
orange=material('Orange safety nozzle',(1,.32,.035),0,.36)
# A raised rim makes the nozzle readily visible from the third-person camera.
bpy.ops.mesh.primitive_torus_add(major_radius=.032,minor_radius=.009,major_segments=20,minor_segments=8,location=(0,-.384,.174),rotation=(math.pi/2,0,0));bpy.context.object.name='Water-nozzle-rim';bpy.context.object.data.materials.append(orange)
marker('Muzzle',(0,.174,.396));marker('Palm',(0,0,0));save('water-pistol','Kenney · CC0 · Blaster Kit blaster-a; added reservoir and nozzle')

clear()
# The irregular branch keeps the found bark, cut faces and knots, reshaped to a hand-held stick.
branch=source(pathlib.Path('art/weapons/kenney-survival/tree-log-small.glb'),lambda p:Vector((p.x*.38,(p.z+.325)*1.55-.12,(p.y-.13)*.38)))
bark=material('Weathered warm bark',(.31,.19,.095),0,.95)
for o in branch:o.data.materials.clear();o.data.materials.append(bark)
marker('Palm',(0,0,0));save('wooden-stick','Kenney · CC0 · Survival Kit tree-log-small')

clear()
wood=material('Varnished ash',(.52,.29,.115),0,.38);grip=material('Dark wrapped handle',(.065,.075,.08),0,.85)
lathe('Shaped baseball bat', [(-.14,.031),(-.135,.043),(-.115,.043),(-.1,.026),(.08,.026),(.19,.028),(.31,.037),(.48,.052),(.67,.063),(.86,.064),(.96,.057),(.985,.041),(.995,.012)],wood)
lathe('Handle wrap',[(-.1,.028),(.14,.028),(.15,.027)],grip)
for i in range(10):
    y=-.09+i*.023
    lathe('Grip winding %02d'%i,[(y,.0285),(y+.004,.029),(y+.006,.0285)],grip,20)
marker('Palm',(0,0,0));save('baseball-bat','merch_badday · original shaped ash baseball bat')

clear()
# Extract the actual SWAT chest armour, leaving arms, skin and helmet behind.
def torso(o,p):
    if 'Body' not in o.name or o.data.materials[p.material_index].name.startswith('Skin'):return False
    centre=o.matrix_world@p.center
    return abs(centre.x)<.235 and 1.115<centre.z<1.57
vest=source(pathlib.Path('art/quaternius/police-swat.glb'),lambda p:Vector((p.x,p.y-1.34,p.z-.065)),torso)
for o in vest:
    # Inflate the shell slightly above the guard's shirt, keeping its fitted silhouette.
    for v in o.data.vertices:v.co.x*=1.12;v.co.y*=1.35
    o.name='SWAT fitted vest '+o.name
marker('TorsoAnchor',(0,0,0));save('security-vest','Quaternius · CC0 · Ultimate Animated Character Pack SWAT torso armour')
