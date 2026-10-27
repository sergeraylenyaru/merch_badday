"""Original CC0 SUV, delivery van and box truck. Blender 4.3+, no downloads.
blender --background --threads 2 --python-exit-code 1 --python scripts/create-vehicles.py
"""
from pathlib import Path
import importlib.util
from math import pi, cos, sin
import bpy

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('mesh_helpers', ROOT / 'scripts/create-visual-models.py')
h = importlib.util.module_from_spec(spec)
spec.loader.exec_module(h)
h.OUT = ROOT / 'public/models/vehicles'
h.OUT.mkdir(parents=True, exist_ok=True)

def panel(name, points, mat, parent):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata([h.xyz(p) for p in points], [], [list(range(len(points)))])
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    return h.finish(obj, mat, parent)

def make(kind):
    h.clean()
    root = h.empty('Vehicle_' + kind)
    paint = h.material('Vehicle_Paint', {'suv':'965b3b','van':'ece4d2','truck':'4a776e'}[kind], .2, .4)
    cargo = h.material('Cargo_Panel', 'c8c4b5', .18, .65)
    rubber = h.material('Tyres_And_Trim', '17232b', .05, .9)
    metal = h.material('Brushed_Aluminium', 'b8c4c7', .75, .32)
    glass = h.material('Blue_Glass', '285264', .35, .18)
    white = h.material('Headlights', 'fff1c7', .12, .3)
    red = h.material('Rear_Lights', 'b53727', .05, .45)
    accent = h.material('Delivery_Mark', 'e9b948', .15, .5)
    width, length = (2.2, 4.7) if kind == 'suv' else (2.25, 5.7) if kind == 'van' else (2.65, 6.7)
    half = width / 2
    front, rear = length / 2, -length / 2
    h.box('Underbody', (0,.57,0), (width-.25,.24,length-.35), rubber, root, .08)
    h.box('Lower body', (0,.91,0), (width,.55,length-.12), paint, root, .12)
    for z in (front, rear):
        h.box('Bumper', (0,.68,z), (width+.06,.22,.18), rubber, root, .055)
        h.box('Plate', (0,.8,z + (.103 if z>0 else -.103)), (.55,.13,.015), white, root, .008)
    if kind == 'suv':
        h.box('Bonnet', (0,1.23,1.57), (width-.06,.27,1.38), paint, root, .10)
        h.box('Cab', (0,1.55,-.34), (width-.18,.9,2.75), paint, root, .12)
        h.box('Roof', (0,2.06,-.34), (width-.24,.13,2.81), paint, root, .06)
        panel('Windscreen', [(-.88,1.46,1.08),(.88,1.46,1.08),(.78,1.97,.78),(-.78,1.97,.78)], glass, root)
        h.box('Rear glass', (0,1.72,-1.74), (1.7,.53,.04), glass, root, .025)
        for side in (-1,1):
            door = h.empty('DoorLeft' if side < 0 else 'DoorRight', (side*1.04,1.25,.87), root)
            h.box('Front door', (side*1.045,1.23,.28), (.065,.54,1.2), paint, door, .025)
            panel('Front side glass', [(side*1.025,1.47,-.28),(side*1.025,1.47,.86),(side*.9,1.96,.72),(side*.9,1.96,-.28)], glass, door)
            h.box('Rear side glass', (side*1.027,1.73,-1.0), (.035,.49,1.25), glass, root, .025)
            h.box('Door handle', (side*1.09,1.38,-.14), (.06,.06,.24), metal, door, .015)
            h.box('Rear door handle', (side*1.09,1.36,-1.3), (.06,.06,.24), metal, root, .015)
            h.box('Roof rail', (side*.76,2.19,-.37), (.065,.065,2.26), metal, root, .02)
            h.box('Side sill', (side*1.12,.7,-.14), (.09,.14,3.5), rubber, root, .02)
        axles = [('Front',1.46),('Rear',-1.5)]
    elif kind == 'van':
        h.box('Cargo body', (0,1.62,-.64), (width,1.55,3.8), paint, root, .13)
        h.box('Cargo roof', (0,2.45,-.64), (width-.08,.12,3.8), paint, root, .065)
        h.box('Cab', (0,1.45,1.62), (width-.08,1.1,1.82), paint, root, .12)
        h.box('Cab roof', (0,2.07,1.62), (width-.16,.13,1.86), paint, root, .065)
        panel('Windscreen', [(-.97,1.48,2.57),(.97,1.48,2.57),(.89,1.99,2.25),(-.89,1.99,2.25)], glass, root)
        for side in (-1,1):
            door = h.empty('DoorLeft' if side < 0 else 'DoorRight', (side*1.08,1.26,2.38), root)
            h.box('Cab door', (side*1.09,1.18,1.61), (.06,.66,1.4), paint, door, .035)
            h.box('Side glass', (side*1.095,1.75,1.61), (.035,.48,1.22), glass, door, .025)
            h.box('Door handle', (side*1.135,1.44,1.12), (.065,.06,.24), rubber, door, .01)
            h.box('Sliding panel', (side*1.13,1.58,-.68), (.035,1.28,2.76), cargo, root, .04)
            h.box('Sliding rail', (side*1.16,1.9,-.68), (.025,.035,2.8), metal, root, .01)
            h.box('Sliding handle', (side*1.17,1.5,.3), (.05,.1,.27), rubber, root, .01)
            h.box('Delivery stripe', (side*1.16,1.07,-.72), (.03,.14,2.95), accent, root, .01)
        for side in (-1,1):
            h.box('Rear cargo door', (side*.54,1.65,rear-.01), (1.04,1.48,.035), cargo, root, .04)
            for y in (1.15,2.12): h.box('Rear hinge', (side*1.02,y,rear-.06), (.13,.08,.07), metal, root, .01)
        h.rod('Rear lock', (.1,1,rear-.07),(.1,2.24,rear-.07),.018,metal,root)
        axles = [('Front',1.85),('Rear',-1.88)]
    else:
        h.box('Cargo box', (0,2.08,-1.05), (width,2.65,4.36), cargo, root, .055)
        h.box('Cargo top edge', (0,3.43,-1.05), (width+.06,.09,4.45), metal, root, .025)
        for side in (-1,1):
            h.box('Cargo lower rail', (side*1.35,.85,-1.05), (.065,.13,4.4), metal, root, .01)
            for z in (-3.17,1.07): h.box('Cargo corner', (side*1.35,2.1,z), (.065,2.68,.065), metal, root, .01)
            h.box('Company stripe', (side*1.342,2.2,-1.05), (.02,.28,3.7), paint, root, .01)
            h.box('Side guard', (side*1.25,.48,-.3), (.1,.15,2.3), metal, root, .015)
        h.box('Cab', (0,1.54,2.15), (2.35,1.77,2.07), paint, root, .11)
        h.box('Cab roof', (0,2.51,2.15), (2.43,.15,2.12), paint, root, .05)
        h.box('Windscreen', (0,2.04,3.202), (2.05,.68,.025), glass, root, .04)
        for side in (-1,1):
            door = h.empty('DoorLeft' if side < 0 else 'DoorRight', (side*1.19,1.6,3.04), root)
            h.box('Cab door', (side*1.2,1.48,2.26), (.06,1.14,1.38), paint, door, .035)
            h.box('Side glass', (side*1.235,2.04,2.26), (.025,.62,1.23), glass, door, .025)
            h.box('Door handle', (side*1.26,1.63,1.86), (.065,.07,.26), metal, door, .012)
            h.box('Cab step', (side*1.3,.6,2.3), (.23,.15,1.1), metal, root, .03)
            h.box('Rear door', (side*.64,2.08,rear-.01), (1.23,2.47,.035), paint, root, .025)
            h.rod('Rear lock', (side*.42,.91,rear-.07),(side*.42,3.18,rear-.07),.02,metal,root)
        axles = [('Front',2.25),('Rear',-1.65),('Back',-2.59)]
    # Mirrors, lamps, grille, wipers and visible, independently rolling wheels.
    for side in (-1,1):
        z = 1.15 if kind == 'suv' else 2.16 if kind == 'van' else 2.83
        h.rod('Mirror arm', (side*(half-.02),1.55,z),(side*(half+.22),1.62,z),.03,rubber,root)
        h.box('Mirror', (side*(half+.25),1.67,z), (.14,.25,.24), rubber,root,.045)
        h.box('Mirror glass', (side*(half+.25),1.67,z-.126), (.10,.18,.015), metal,root,.01)
        h.box('Headlight', (side*(half-.3),1.06,front+.03), (.43,.22,.06), white,root,.04)
        h.box('Rear lamp', (side*(half-.2),1.03,rear-.1), (.18,.4,.06), red,root,.025)
    for y in (.89,.96,1.03): h.box('Front grille',(0,y,front+.055),(.8,.035,.045),rubber,root,.005)
    for x in (-.47,.47): h.rod('Wiper',(x,1.49,front-.02),(x+.27,1.6,front-.04),.015,rubber,root,sides=6)
    for axle,z in axles:
        for side in (-1,1):
            name=axle+('Left' if side<0 else 'Right')
            radius=.43 if kind!='truck' else .48
            x=side*(half-.025)
            steer=h.empty('VehicleSteer'+name,(x,radius,z),root)
            wheel=h.empty('VehicleWheel'+name,(x,radius,z),steer)
            h.rod('Tyre',(x-.14,radius,z),(x+.14,radius,z),radius,rubber,wheel,sides=20)
            face=x+side*.155
            h.rod('Alloy rim',(face-side*.018,radius,z),(face,radius,z),radius*.64,metal,wheel,sides=16)
            h.rod('Axle cap',(face,radius,z),(face+side*.02,radius,z),radius*.22,rubber,wheel,sides=12)
            for spoke in range(5):
                angle=spoke*2*pi/5
                h.rod('Rim spoke',(face+side*.025,radius+.1*cos(angle),z+.1*sin(angle)),
                      (face+side*.025,radius+.32*cos(angle),z+.32*sin(angle)),.022,rubber,wheel,sides=6)
    root['provenance']='Original mesh authored for this project; CC0-1.0'
    root['forward']='+Z'
    root['wheelRadius']=.43 if kind!='truck' else .48
    root['variant']=kind
    h.export(kind+'.glb')

for kind in ['suv','van','truck']: make(kind)
