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
cyan=material('Cyan toy casing',(.025,.56,.72),0,.3)
orange=material('Orange toy grip and nozzle',(1,.31,.025),0,.42)
blue=material('Blue moulded water reservoir',(.08,.35,.69),0,.26)
white=material('Cream trigger guard',(.92,.91,.72),0,.5)
def rounded_box(name,position,size,m,bevel=.025):
    bpy.ops.mesh.primitive_cube_add(size=1,location=(position[0],-position[2],position[1]));o=bpy.context.object;o.name=name;o.dimensions=(size[0],size[2],size[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(m)
    mod=o.modifiers.new('Rounded moulded edges','BEVEL');mod.width=bevel;mod.segments=3
    bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
    for f in o.data.polygons:f.use_smooth=True
    o.modifiers.new('Weighted plastic normals','WEIGHTED_NORMAL')
    return o
rounded_box('Compact rounded body',(0,.15,.105),(.145,.15,.285),cyan)
rounded_box('Palm centred pistol grip',(0,-.005,-.015),(.075,.205,.095),orange,.017)
rounded_box('Rear body cap',(0,.17,-.055),(.15,.13,.04),blue,.017)
sphere('Oval water reservoir',(0,.277,.045),(.075,.072,.135),blue)
rounded_box('Reservoir filler cap',(0,.342,-.01),(.066,.022,.055),orange,.009)
# Barrel and nozzle run straight forward along +Z, with no skewed scaling.
for name,z,r,length,m in [('Cyan barrel',.267,.039,.16,cyan),('Orange nozzle',.357,.043,.045,orange),('Nozzle aperture',.382,.021,.004,white)]:
    bpy.ops.mesh.primitive_cylinder_add(vertices=24,radius=r,depth=length,location=(0,-z,.16),rotation=(math.pi/2,0,0));o=bpy.context.object;o.name=name;o.data.materials.append(m)
rounded_box('Trigger guard lower',(0,-.075,.063),(.031,.025,.14),white,.008)
rounded_box('Trigger guard front',(0,-.01,.12),(.031,.13,.025),white,.008)
rounded_box('Trigger',(0,.023,.073),(.025,.062,.02),orange,.006)
marker('Muzzle',(0,.16,.386));marker('Palm',(0,0,0));save('water-pistol','merch_badday · original compact toy water pistol, palm-centred grip')

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

clear()
parts=source(pathlib.Path('art/weapons/shovel-wood-source.glb'),lambda p:Vector((p.x*.35,(.30-p.y)*.35,-p.z*.35)))
for o in parts:
    for m in o.data.materials:
        shader=m.node_tree.nodes.get('Principled BSDF')
        if m.name.startswith('DarkWood'):
            shader.inputs['Base Color'].default_value=(.26,.135,.055,1);shader.inputs['Roughness'].default_value=.78
        if m.name.startswith('Grey'):
            shader.inputs['Metallic'].default_value=.6;shader.inputs['Roughness'].default_value=.5
marker('Palm',(0,0,0));marker('HandleGripRight',(0,0,0));marker('HandleGripLeft',(0,-.23,0));save('shovel','Quaternius · CC0 · Survival Pack Shovel; oak shaft with two handle grips')
