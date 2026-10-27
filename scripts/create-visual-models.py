"""Original stylized meshes for Плохой день мерча.
Run: blender --background --python scripts/create-visual-models.py
No external assets, fonts, textures, or Blender add-ons are required.
Game-space coordinates: +Y up, +Z forward; export is floor centered.
"""
from pathlib import Path
import bpy
from math import pi, sin, cos
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/models/original'
OUT.mkdir(parents=True, exist_ok=True)

def xyz(p):
    return Vector((p[0], -p[2], p[1]))

def clean():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for datablocks in (bpy.data.meshes, bpy.data.materials, bpy.data.curves):
        for block in list(datablocks):
            if block.users == 0:
                datablocks.remove(block)

def material(name, hexcolor, metallic=0, roughness=.65):
    rgb = tuple(int(hexcolor[i:i+2],16)/255 for i in (0,2,4))
    # Three.js and glTF materials use linear factors.
    linear = tuple(v/12.92 if v <= .04045 else ((v+.055)/1.055)**2.4 for v in rgb)
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*linear,1)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*linear,1)
    bsdf.inputs['Metallic'].default_value = metallic
    bsdf.inputs['Roughness'].default_value = roughness
    return m

def parent_obj(obj, parent):
    if parent:
        bpy.context.view_layer.update()
        matrix = obj.matrix_world.copy()
        obj.parent = parent
        obj.matrix_world = matrix
    return obj

def empty(name, pos=(0,0,0), parent=None):
    obj = bpy.data.objects.new(name,None)
    bpy.context.collection.objects.link(obj)
    obj.location = xyz(pos)
    return parent_obj(obj,parent)

def finish(obj, mat, parent=None, smooth=False):
    if mat:
        obj.data.materials.append(mat)
    if smooth:
        for face in obj.data.polygons:
            face.use_smooth = True
    return parent_obj(obj,parent)

def sphere(name, pos, scale, mat, parent=None, smooth=True):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=12,ring_count=8,location=xyz(pos))
    obj = bpy.context.object
    obj.name = name
    obj.scale = (scale[0],scale[2],scale[1])
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    return finish(obj,mat,parent,smooth)

def box(name, pos, size, mat, parent=None, bevel=.035):
    bpy.ops.mesh.primitive_cube_add(size=1,location=xyz(pos))
    obj = bpy.context.object
    obj.name = name
    obj.scale = (size[0],size[2],size[1])
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel:
        mod = obj.modifiers.new('crafted rounded edges','BEVEL')
        mod.width = bevel
        mod.segments = 2
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return finish(obj,mat,parent)

def rod(name, a, b, radius, mat, parent=None, radius2=None, sides=8):
    a,b=xyz(a),xyz(b)
    delta=b-a
    bpy.ops.mesh.primitive_cone_add(vertices=sides,radius1=radius,radius2=radius if radius2 is None else radius2,depth=delta.length,location=(a+b)/2)
    obj=bpy.context.object
    obj.name=name
    obj.rotation_euler=delta.to_track_quat('Z','Y').to_euler()
    return finish(obj,mat,parent,True)

def text(name, value, pos, size, mat, parent=None, back=False):
    curve=bpy.data.curves.new(name,'FONT')
    curve.body=value
    curve.align_x='CENTER'
    curve.size=size
    curve.extrude=.0008
    obj=bpy.data.objects.new(name,curve)
    bpy.context.collection.objects.link(obj)
    obj.location=xyz(pos)
    obj.rotation_euler=(pi/2,0,pi if back else 0)
    bpy.context.view_layer.objects.active=obj
    obj.select_set(True)
    bpy.ops.object.convert(target='MESH')
    obj.select_set(False)
    return finish(obj,mat,parent)

def merge_batches():
    # Keep animation pivots, merge all other parts by parent and material.
    groups={}
    for obj in list(bpy.context.scene.objects):
        if obj.type=='MESH':
            key=(obj.parent.name if obj.parent else '',obj.data.materials[0].name if obj.data.materials else '')
            groups.setdefault(key,[]).append(obj)
    for (joint,mat),objects in groups.items():
        bpy.ops.object.select_all(action='DESELECT')
        for obj in objects: obj.select_set(True)
        bpy.context.view_layer.objects.active=objects[0]
        if len(objects)>1: bpy.ops.object.join()
        bpy.context.object.name=f'{joint or "Model"}_{mat}'
        bpy.context.object.select_set(False)

def export(filename):
    merge_batches()
    bpy.ops.object.select_all(action='SELECT')
    target=str(OUT/filename)
    bpy.ops.export_scene.gltf(filepath=target,export_format='GLB',use_selection=True,export_yup=True,export_cameras=False,export_lights=False,export_animations=False,export_extras=True)
    vertices=0
    for obj in bpy.context.scene.objects:
        if obj.type=='MESH': vertices+=len(obj.data.vertices)
    print(f'EXPORTED {filename}: {vertices} vertices, {(OUT/filename).stat().st_size} bytes')

def character(staff=False):
    clean()
    navy=material('navy cotton','243b53')
    blue=material('uniform teal' if staff else 'uniform navy','3f7874' if staff else '304b68')
    dark=material('denim seams','192b3b')
    skin=material('warm skin','d8a17e')
    hair=material('auburn hair' if staff else 'dark hair','77432e' if staff else '302b29')
    yellow=material('ochre identity','f4c65a',0,.5)
    white=material('warm white','eee9d5')
    black=material('rubber and eyes','20262b')
    metal=material('brushed hardware','b5bac0',.65,.4)
    root=empty('StoreStaff' if staff else 'MerchHero')
    spine=empty('Spine',(0,1.20,0),root)
    # Torso is a shaped rounded jacket, separate shoulder and hip volumes.
    sphere('tailored jacket', (0,1.54,0),(.385,.435,.225),blue,spine)
    box('jacket hem',(0,1.19,0),(.61,.14,.36),navy,spine,.05)
    sphere('shoulders',(0,1.78,0),(.43,.18,.23),blue,spine)
    rod('neck',(0,1.88,0),(0,2.01,0),.12,skin,spine)
    head=empty('Head',(0,1.94,0),spine)
    sphere('face',(0,2.13,.018),(.238,.285,.215),skin,head)
    sphere('hair back',(0,2.23,-.065),(.247,.21,.18),hair,head)
    for side in (-1,1):
        sphere('ear',(side*.236,2.13,0),(.047,.078,.05),skin,head)
        sphere('eye white',(side*.081,2.18,.212),(.047,.028,.012),white,head)
        sphere('pupil',(side*.081,2.18,.223),(.019,.021,.007),black,head)
        rod('eyebrow',(side*.045,2.237,.207),(side*.115,2.231,.198),.009,hair,head)
    sphere('nose',(0,2.11,.238),(.037,.055,.052),skin,head)
    rod('mouth',(-.047,2.023,.191),(.047,2.023,.191),.008,hair,head)
    # Cap crown and brim. Brim is rounded and reads well in third person.
    sphere('uniform cap',(0,2.34,-.015),(.26,.10,.235),navy,head)
    sphere('cap brim',(0,2.305,.215),(.25,.025,.18),navy,head)
    box('cap crest',(0,2.352,.201),(.095,.045,.012),yellow,head,.005)
    if staff:
        sphere('tied hair',(0,2.17,-.25),(.13,.17,.13),hair,head)
    # Collar, zip, pockets, identity patch and a usable looking ID lanyard.
    for side in (-1,1):
        rod('collar',(side*.15,1.94,.11),(side*.075,1.82,.217),.04,navy,spine)
    rod('jacket zip',(0,1.21,.199),(0,1.83,.23),.008,metal,spine)
    box('pocket',( .205,1.59,.207),(.16,.15,.028),navy,spine,.014)
    box('chest patch',(-.205,1.72,.214),(.19,.07,.022),yellow,spine,.007)
    text('chest embroidery','MERCH',(-.205,1.707,.229),.042,navy,spine)
    box('back work patch',(0,1.69,-.225),(.47,.17,.022),yellow,spine,.008)
    text('back embroidery','MERCH',(0,1.65,-.242),.105,navy,spine,True)
    for side in (-1,1):
        rod('lanyard',(side*.10,1.91,.213),(side*.028,1.52,.25),.009,yellow,spine)
    box('ID badge',(.017,1.43,.25),(.16,.21,.022),white,spine,.008)
    box('ID photo',(-.021,1.455,.264),(.052,.068,.004),blue,spine,.002)
    for yy in (1.44,1.41,1.38):
        box('ID printed line',(.044,yy,.265),(.06,.006,.003),navy,spine,0)
    # Independent hip, knee and ankle pivots keep the silhouette connected
    # while allowing a real planted-foot gait rather than swinging rigid poles.
    for side,name in ((-1,'Left'),(1,'Right')):
        hip=empty(name+'Leg',(side*.174,1.1,0),root)
        knee=empty(name+'Knee',(side*.174,.61,0),hip)
        foot=empty(name+'Foot',(side*.174,.19,.015),knee)
        rod('trouser upper',(side*.174,.59,0),(side*.174,1.13,0),.122,navy,hip,.165)
        rod('trouser lower',(side*.174,.19,.015),(side*.174,.66,0),.105,navy,knee,.126)
        sphere('rounded knee',(side*.174,.61,0),(.122,.125,.12),navy,knee)
        box('cargo pocket',(side*.298,.71,.01),(.06,.23,.18),blue,hip,.02)
        rod('upper leg seam',(side*.284,.66,-.022),(side*.30,.84,-.022),.006,dark,hip)
        rod('lower leg seam',(side*.274,.22,-.022),(side*.284,.63,-.022),.006,dark,knee)
        sphere('shoe',(side*.174,.115,.09),(.137,.115,.245),black,foot)
        box('shoe sole',(side*.174,.05,.10),(.26,.06,.43),white,foot,.028)
        for zz in (.08,.13,.18):
            rod('shoelace',(side*.174-.065,.207,zz),(side*.174+.065,.207,zz),.008,white,foot)
        empty('FootContact'+name,(side*.174,.02,.10),foot)
    # Shoulder -> elbow -> wrist -> palm anchors. The grip is the centre of
    # the hand geometry, not the wrist, so runtime IK can touch the actual bar.
    for side,name in ((-1,'Left'),(1,'Right')):
        shoulder=empty(name+'Arm',(side*.415,1.80,0),spine)
        elbow=empty(name+'Elbow',(side*.474,1.505,.015),shoulder)
        hand=empty(name+'Hand',(side*.49,1.235,.045),elbow)
        rod('shirt sleeve',(side*.47,1.54,0),(side*.405,1.81,0),.123,blue,shoulder,.155)
        rod('sleeve cuff',(side*.474,1.525,0),(side*.47,1.56,0),.13,navy,shoulder)
        sphere('rounded elbow',(side*.474,1.505,.015),(.09,.09,.085),skin,elbow)
        rod('forearm',(side*.49,1.22,.035),(side*.474,1.535,0),.082,skin,elbow,.106)
        sphere('hand',(side*.49,1.15,.05),(.089,.12,.078),skin,hand)
        sphere('thumb',(side*.434,1.175,.10),(.04,.065,.045),skin,hand)
        for offset in (-.049,-.016,.016,.049):
            sphere('rounded finger',(side*.49+offset,1.073,.072),(.019,.041,.04),skin,hand)
        empty('PalmGrip'+name,(side*.49,1.15,.05),hand)
        if side==-1:
            rod('watch strap',(side*.49,1.26,.034),(side*.49,1.305,.03),.103,black,elbow)
            box('watch face',(side*.49,1.28,.117),(.075,.067,.018),metal,elbow,.009)
    # Work satchel is an actual soft rounded silhouette, with a shoulder strap.
    if not staff:
        box('satchel',(.445,1.03,-.08),(.25,.43,.39),navy,spine,.065)
        box('satchel flap',(.455,1.13,-.08),(.27,.20,.405),dark,spine,.035)
        rod('bag shoulder strap',(-.30,1.88,.19),(.49,1.20,.22),.028,dark,spine)
        rod('bag back strap',(-.30,1.88,-.18),(.49,1.20,-.25),.028,dark,spine)
        box('bag clasp',(.59,1.06,-.08),(.012,.07,.08),metal,spine,.005)
    root['provenance']='Original mesh authored for this project; CC0-1.0'
    root['forward']='+Z'
    root['animationPivots']='Spine,Head,LeftLeg,RightLeg,LeftKnee,RightKnee,LeftFoot,RightFoot,LeftArm,RightArm,LeftElbow,RightElbow,LeftHand,RightHand'
    root['gripAnchors']='PalmGripLeft,PalmGripRight'
    root['rigVersion']=2
    export('store-staff.glb' if staff else 'merch-hero.glb')

def cart():
    clean()
    steel=material('galvanised steel','b9c8ca',.82,.28)
    dark=material('rubber wheels','263239',.03,.62)
    navy=material('blue handle','2b4f6c',0,.47)
    yellow=material('ochre label','efbd50',0,.5)
    root=empty('ShoppingCart')
    # Tapered basket; substantial rim and horizontal wires, no triangle wireframe.
    bottom_y,top_y=.87,1.47
    def width(y): return .44+(y-bottom_y)/(top_y-bottom_y)*.135
    def rear(y): return -.39-(y-bottom_y)/(top_y-bottom_y)*.22
    for y in (.87,1.05,1.25,1.47):
        w=width(y); rz=rear(y)
        radius=.027 if y==top_y else .013
        rod('basket rim',(-w,y,rz),(w,y,rz),radius,steel,root)
        rod('basket front',(-w,y,.70),(w,y,.70),radius,steel,root)
        for side in (-1,1): rod('basket side',(side*w,y,rz),(side*w,y,.70),radius,steel,root)
    for i in range(10):
        u=-1+i*2/9
        rod('front lattice',(u*.44,bottom_y,.70),(u*.575,top_y,.70),.010,steel,root)
        rod('rear lattice',(u*.44,bottom_y,-.39),(u*.575,top_y,-.61),.010,steel,root)
    for side in (-1,1):
        for i in range(11):
            u=i/10
            rod('side lattice',(side*.44,bottom_y,-.39+u*1.09),(side*.575,top_y,-.61+u*1.31),.010,steel,root)
    for i in range(9):
        xx=-.42+i*.105
        rod('basket base',(xx,.87,-.39),(xx,.87,.70),.012,steel,root)
    for zz in (-.39,-.10,.20,.48,.70):
        rod('basket base cross',(-.44,.87,zz),(.44,.87,zz),.012,steel,root)
    # Back legs, handle risers, and trapezoidal bottom frame.
    for side in (-1,1):
        rod('front support',(side*.43,.37,.57),(side*.43,.87,.54),.026,steel,root)
        rod('rear support',(side*.46,.36,-.61),(side*.57,1.54,-.83),.028,steel,root)
        rod('bottom side',(side*.46,.36,-.61),(side*.43,.36,.65),.029,steel,root)
        rod('handle bend',(side*.57,1.54,-.83),(side*.54,1.58,-.94),.027,steel,root)
    rod('handle',(-.54,1.58,-.94),(.54,1.58,-.94),.045,navy,root,sides=12)
    box('handle work mark',(0,1.583,-.895),(.23,.045,.006),yellow,root,.006)
    empty('CartHandleLeft',(-.42,1.58,-.94),root)
    empty('CartHandleRight',(.42,1.58,-.94),root)
    for zz in (-.61,.65): rod('lower crossbar',(-.46,.36,zz),(.46,.36,zz),.027,steel,root)
    for i in range(7):
        rod('lower rack',(-.38+i*.126,.36,-.57),(-.38+i*.126,.36,.61),.013,steel,root)
    # Swivels steer around Y; tyre pivots roll around game-space X.
    # Forks/axle remain attached to their swivel instead of spinning with tyres.
    for xx in (-.45,.45):
        for zz in (-.59,.59):
            name=('Front' if zz>0 else 'Rear')+('Left' if xx<0 else 'Right')
            caster=empty('Caster'+name,(xx,.31,zz),root)
            wheel=empty('Wheel'+name,(xx,.155,zz+.025),caster)
            rod('caster swivel',(xx,.27,zz),(xx,.38,zz),.046,steel,root,sides=10)
            for sx in (-1,1):
                rod('caster fork',(xx+sx*.065,.15,zz+.025),(xx+sx*.065,.31,zz),.018,steel,caster)
            rod('rubber caster',(xx-.06,.155,zz+.025),(xx+.06,.155,zz+.025),.15,dark,wheel,sides=12)
            rod('axle cap',(xx-.065,.155,zz+.025),(xx+.065,.155,zz+.025),.063,steel,caster,sides=10)
            # Visible hub spokes make rolling readable even with flat rubber.
            for face in (-1,1):
                for angle in (0,pi/2,pi,pi*1.5):
                    rod('wheel spoke',
                        (xx+face*.067,.155+.035*cos(angle),zz+.025+.035*sin(angle)),
                        (xx+face*.067,.155+.115*cos(angle),zz+.025+.115*sin(angle)),
                        .008,steel,wheel,sides=6)
    root['provenance']='Original mesh authored for this project; CC0-1.0'
    root['forward']='+Z'
    root['collider']='Existing gameplay collider: half extents (0.6,0.6,0.85), centre Y=0.65'
    root['gripAnchors']='CartHandleLeft,CartHandleRight'
    root['wheelRadius']=.15
    root['rigVersion']=2
    export('shopping-cart.glb')

if __name__ == '__main__':
    character()
    character(staff=True)
    cart()
