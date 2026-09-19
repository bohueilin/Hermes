"""Author FleetLab's original 3D concept film with Blender 4.5.

Run with Blender: blender -b --python render.py -- --output /path/to/frames
Add --preview to render three review frames instead of the full 16-second film.
This is illustrative animation, independent of the FleetLab simulation engine.
All meshes, materials and choreography are created here; no external assets.
"""

import argparse
import math
import random
import sys
from pathlib import Path

import bpy
from mathutils import Vector

args_parser = argparse.ArgumentParser()
args_parser.add_argument("--output", required=True)
args_parser.add_argument("--preview", action="store_true")
args_parser.add_argument("--start", type=int, default=1)
args_parser.add_argument("--end", type=int, default=384)
args = args_parser.parse_args(sys.argv[sys.argv.index("--") + 1 :])
output = Path(args.output).resolve()
output.mkdir(parents=True, exist_ok=True)
random.seed(27)
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)


def material(name, color, roughness=0.5, metal=0, emission=0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metal
    if emission:
        bsdf.inputs["Emission Color"].default_value = (*color, 1)
        bsdf.inputs["Emission Strength"].default_value = emission
    return mat


pearl = material("Warm pearl ceramic", (0.89, 0.92, 0.87), 0.22, 0.28)
glass = material("Deep blue panoramic glass", (0.026, 0.070, 0.090), 0.16, 0.58)
rubber = material("Soft graphite tire", (0.026, 0.035, 0.038), 0.85)
chrome = material("Satin aluminum", (0.48, 0.57, 0.60), 0.24, 0.78)
blue = material("Fleet coastal blue", (0.055, 0.29, 0.45), 0.35, 0.2)
mint = material("Readiness mint", (0.29, 0.75, 0.57), 0.35)
led = material("Soft white light", (0.83, 0.96, 0.91), 0.2, emission=2)
red = material("Rear lamp coral", (0.88, 0.18, 0.12), 0.2, emission=1)
amber = material("Warm saffron", (0.93, 0.59, 0.19), 0.4)
asphalt = material("Blue gray road", (0.115, 0.165, 0.18), 0.93)
concrete = material("Warm limestone", (0.62, 0.65, 0.58), 0.8)
white = material("Lane paint", (0.91, 0.90, 0.75), 0.7)
cream = material("Facade cream", (0.81, 0.79, 0.66), 0.8)
sage = material("Facade sage", (0.41, 0.55, 0.50), 0.8)
coral = material("Facade terracotta", (0.66, 0.31, 0.23), 0.8)
light_blue = material("Facade blue", (0.46, 0.62, 0.64), 0.8)
wood = material("Warm cedar", (0.38, 0.20, 0.10), 0.8)
leaves = [
    material("Leaf " + str(i), c, 0.8)
    for i, c in enumerate([(0.13, 0.30, 0.18), (0.27, 0.46, 0.22), (0.40, 0.53, 0.24)])
]
trunk = material("Tree bark", (0.22, 0.16, 0.10), 0.9)
skin = material("Warm skin", (0.55, 0.30, 0.18), 0.85)
skin_light = material("Light skin", (0.79, 0.51, 0.34), 0.85)


def finish(obj, name, mat, parent=None):
    obj.name = name
    if mat:
        obj.data.materials.append(mat)
    if parent:
        obj.parent = parent
    return obj


def cube(name, loc, scale, mat, bevel=0, parent=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    obj = bpy.context.object
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        mod = obj.modifiers.new("Soft manufactured edges", "BEVEL")
        mod.width = bevel
        mod.segments = 4
        obj.modifiers.new("Weighted normals", "WEIGHTED_NORMAL")
    return finish(obj, name, mat, parent)


def sphere(name, loc, scale, mat, parent=None):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=20, ring_count=12, radius=1, location=loc)
    obj = bpy.context.object
    obj.scale = scale
    for face in obj.data.polygons:
        face.use_smooth = True
    return finish(obj, name, mat, parent)


def cylinder(name, loc, radius, depth, mat, parent=None, axis="Z"):
    bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=radius, depth=depth, location=loc)
    obj = bpy.context.object
    if axis == "Y":
        obj.rotation_euler.x = math.pi / 2
    if axis == "X":
        obj.rotation_euler.y = math.pi / 2
    mod = obj.modifiers.new("Edge highlights", "BEVEL")
    mod.width = min(0.06, radius / 4)
    mod.segments = 3
    obj.modifiers.new("Weighted normals", "WEIGHTED_NORMAL")
    return finish(obj, name, mat, parent)


def line(name, points, radius, mat, parent=None):
    curve = bpy.data.curves.new(name, "CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = 2
    curve.bevel_depth = radius
    curve.bevel_resolution = 3
    spline = curve.splines.new("POLY")
    spline.points.add(len(points) - 1)
    for p, co in zip(spline.points, points, strict=True):
        p.co = (*co, 1)
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    return finish(obj, name, mat, parent)


def empty(name):
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    return obj


def car(name, van=False, accent=blue):
    root = empty(name)
    length = 4.65 if not van else 5.05
    cube("Lower body", (0, 0, 0.81), (length, 1.97, 0.73), pearl, 0.28, root)
    cube("Lower sill", (-0.1, 0, 0.45), (length - 0.5, 1.75, 0.17), rubber, 0.06, root)
    # A rounded dark cabin and porcelain roof give a crisp, recognizable car silhouette.
    cabin_length = 3.08 if not van else 3.85
    cabin_height = 0.82 if not van else 1.06
    cabin_x = -0.34 if not van else -0.15
    if van:
        cube(
            "Panoramic cabin",
            (cabin_x, 0, 1.33),
            (cabin_length, 1.79, cabin_height),
            glass,
            0.31,
            root,
        )
    else:
        mesh = bpy.data.meshes.new("Sculpted SUV cabin")
        mesh.from_pydata(
            [
                (-1.9, -0.89, 1.10),
                (1.35, -0.89, 1.10),
                (1.35, 0.89, 1.10),
                (-1.9, 0.89, 1.10),
                (-1.42, -0.77, 1.74),
                (0.70, -0.77, 1.74),
                (0.70, 0.77, 1.74),
                (-1.42, 0.77, 1.74),
            ],
            [],
            [(0, 3, 2, 1), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7), (4, 5, 6, 7)],
        )
        obj = bpy.data.objects.new("Sloped panoramic cabin", mesh)
        bpy.context.collection.objects.link(obj)
        finish(obj, obj.name, glass, root)
        bevel = obj.modifiers.new("Soft glass corners", "BEVEL")
        bevel.width = 0.12
        bevel.segments = 5
        obj.modifiers.new("Weighted normals", "WEIGHTED_NORMAL")
    roof_z = 1.33 + cabin_height / 2
    cube(
        "Floating roof",
        (cabin_x - 0.04, 0, roof_z - 0.01),
        (cabin_length - (0.41 if van else 0.94), 1.64 if van else 1.54, 0.12),
        pearl,
        0.075,
        root,
    )
    for side in [-1, 1]:
        cube("Window pillar", (-0.48, side * 0.902, 1.40), (0.105, 0.055, 0.59), pearl, 0.025, root)
        cube("Mirror arm", (0.95, side * 1.02, 1.19), (0.14, 0.23, 0.06), rubber, 0.02, root)
        cube("Side mirror", (0.98, side * 1.17, 1.21), (0.3, 0.16, 0.16), pearl, 0.07, root)
        for dx in [-0.76, 0.69]:
            cube(
                "Flush door handle",
                (dx, side * 0.986, 1.00),
                (0.24, 0.023, 0.043),
                chrome,
                0.015,
                root,
            )
        line(
            "Door seam",
            [(-0.5, side * 0.99, 1.12), (-0.5, side * 0.994, 0.66)],
            0.008,
            chrome,
            root,
        )
        cube(
            "Coastal side accent",
            (-0.13, side * 0.987, 0.64),
            (2.3, 0.02, 0.06),
            accent,
            0.02,
            root,
        )
        for dx in [-1.46, 1.44]:
            wheel = empty("Wheel assembly")
            wheel.parent = root
            wheel.location = (dx, side * 0.97, 0.49)
            cylinder("Tire", (0, 0, 0), 0.43, 0.27, rubber, wheel, "Y")
            cylinder("Alloy wheel", (0, side * 0.148, 0), 0.29, 0.03, chrome, wheel, "Y")
            cylinder("Wheel hub", (0, side * 0.17, 0), 0.115, 0.04, pearl, wheel, "Y")
            for j in range(5):
                a = j * 2 * math.pi / 5
                spoke = cube(
                    "Wheel spoke",
                    (0.13 * math.cos(a), side * 0.17, 0.13 * math.sin(a)),
                    (0.23, 0.018, 0.045),
                    pearl,
                    0.015,
                    wheel,
                )
                spoke.rotation_euler.y = -a
    front = length / 2
    cube("Front smile", (front - 0.05, 0, 0.70), (0.04, 1.18, 0.13), rubber, 0.04, root)
    for side in [-1, 1]:
        cube(
            "Daytime running light",
            (front - 0.052, side * 0.66, 1.005),
            (0.058, 0.43, 0.075),
            led,
            0.035,
            root,
        )
        cube("Rear lamp", (-front + 0.025, side * 0.69, 0.98), (0.06, 0.35, 0.07), red, 0.028, root)
    cylinder("Roof sensor pedestal", (-0.13, 0, roof_z + 0.12), 0.19, 0.15, rubber, root)
    cylinder("Roof sensor", (-0.13, 0, roof_z + 0.22), 0.26, 0.20, pearl, root)
    cylinder("Sensor dark band", (-0.13, 0, roof_z + 0.215), 0.265, 0.08, glass, root)
    cylinder("Sensor cap", (-0.13, 0, roof_z + 0.345), 0.21, 0.06, pearl, root)
    return root


def tree(x, y, z=0, size=1):
    cylinder("Tree trunk", (x, y, z + size * 1.5), 0.12 * size, 3 * size, trunk)
    for i, (dx, dy, dz, r) in enumerate(
        [(0, 0, 3.8, 1.45), (-0.7, 0.1, 3.1, 1.1), (0.75, 0.15, 3.2, 1.0)]
    ):
        sphere(
            "Sculpted tree crown",
            (x + dx * size, y + dy * size, z + dz * size),
            (r * size, r * 0.85 * size, r * 1.15 * size),
            leaves[i],
        )


def person(x, y, cloth=blue, small=False, skin_mat=skin, facing=0):
    root = empty("Promenade visitor")
    root.location = (x, y, 0.15)
    root.rotation_euler.z = facing
    scale = 0.73 if small else 1
    root.scale = (scale, scale, scale)
    sphere("Head", (0, 0, 1.62), (0.17, 0.16, 0.21), skin_mat, root)
    sphere("Hair", (-0.025, 0.0, 1.74), (0.175, 0.168, 0.12), rubber, root)
    cube("Jacket", (0, 0, 1.15), (0.40, 0.28, 0.60), cloth, 0.15, root)
    for s in [-1, 1]:
        line(
            "Trousers",
            [(s * 0.11, 0, 0.91), (s * 0.13, s * 0.06, 0.47), (s * 0.13, s * 0.07, 0.12)],
            0.09,
            glass,
            root,
        )
        cube("Sneaker", (s * 0.13, -0.06 + s * 0.07, 0.08), (0.18, 0.33, 0.12), pearl, 0.045, root)
        line(
            "Sleeve",
            [(s * 0.21, 0, 1.37), (s * 0.27, 0, 1.12), (s * 0.30, -0.11, 0.99)],
            0.075,
            cloth,
            root,
        )
        sphere("Hand", (s * 0.30, -0.13, 0.97), (0.072, 0.07, 0.082), skin_mat, root)
    return root


# Waterfront district: a composed concept setting, not a literal map or route.
cube("Land", (0, 24, -0.6), (230, 61, 1), cream)
cube("Waterfront avenue", (0, 0, -0.05), (210, 9, 0.20), asphalt, 0.07)
cube("Promenade", (0, -7.1, 0.05), (210, 5.2, 0.25), concrete, 0.06)
cube("Depot pavement", (21, 12.8, 0.045), (34, 17, 0.22), concrete, 0.1)
for y in [-4.65, 4.65, -9.72]:
    cube("Limestone curb", (0, y, 0.16), (210, 0.18, 0.30), cream, 0.05)
for x in range(-100, 105, 6):
    cube("Center lane dash", (x, 0, 0.061), (2.3, 0.09, 0.01), white)
for x in range(-100, 105, 10):
    for y in [-4.10, 4.1]:
        cube("Road edge marking", (x, y, 0.061), (9.5, 0.08, 0.01), white)

water = material("Bay water", (0.075, 0.31, 0.40), 0.28, 0.5)
nodes = water.node_tree.nodes
bsdf = nodes.get("Principled BSDF")
noise = nodes.new("ShaderNodeTexNoise")
noise.inputs["Scale"].default_value = 1.8
noise.inputs["Detail"].default_value = 2
bump = nodes.new("ShaderNodeBump")
bump.inputs["Strength"].default_value = 0.22
bump.inputs["Distance"].default_value = 0.15
water.node_tree.links.new(noise.outputs["Fac"], bump.inputs["Height"])
water.node_tree.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
cube("The bay", (0, -130, -0.34), (800, 241, 0.25), water)
for x in range(-100, 110, 5):
    cylinder("Promenade railing", (x, -9.6, 0.67), 0.035, 1.0, chrome)
line("Promenade rail", [(-105, -9.6, 1.16), (105, -9.6, 1.16)], 0.045, chrome)

# A distant, deliberately stylized suspension bridge anchors the Bay-inspired scene.
bridge_mat = material("Bridge vermilion", (0.63, 0.22, 0.13), 0.6)
cube("Bridge deck", (-15, -80, 7.2), (170, 3.7, 0.42), bridge_mat, 0.1)
for tx in [-53, 24]:
    for y in [-81.5, -78.5]:
        cube("Bridge tower", (tx, y, 10.5), (1, 0.85, 25), bridge_mat, 0.08)
    for z in [8.5, 15, 21.5]:
        cube("Tower cross member", (tx, -80, z), (1, 3.8, 0.65), bridge_mat, 0.1)
for y in [-81.5, -78.5]:
    for low, high in [(-95, -53), (-53, 24), (24, 66)]:
        points = []
        for i in range(61):
            t = i / 60
            x = low + (high - low) * t
            z = (
                10 + 12 * (2 * t - 1) ** 2
                if low == -53
                else (8 + 14 * (t if low == -95 else 1 - t) ** 2)
            )
            points.append((x, y, z))
        line("Suspension cable", points, 0.085, bridge_mat)
        for i in range(0, 61, 5):
            x, _, z = points[i]
            line("Suspender", [(x, y, 7.5), (x, y, z)], 0.025, bridge_mat)
hill_mat = material("Hazy coastal hills", (0.35, 0.49, 0.43), 1)
for x in range(-190, 200, 38):
    sphere("Distant hill", (x, -150, -6), (45, 30, random.uniform(15, 27)), hill_mat)

# Depot: three visibly different resource bays and a dispatch apron.
for index, x in enumerate([12, 21, 30]):
    cube("Bay paving", (x, 13.0, 0.19), (7.5, 11, 0.06), cream, 0.14)
    for side in [-1, 1]:
        cube("Bay side stripe", (x + side * 3.35, 13.0, 0.224), (0.10, 9.4, 0.01), white)
    for px in [x - 3.35, x + 3.35]:
        cylinder("Canopy post", (px, 18, 2.0), 0.10, 3.7, blue)
    cube("Floating canopy", (x, 15.2, 3.85), (8.1, 7.0, 0.26), pearl, 0.18)
    cube("Canopy blue trim", (x, 11.72, 3.82), (7.7, 0.035, 0.095), blue, 0.015)
    for panel in range(4):
        cube("Solar panel", (x - 2.7 + panel * 1.8, 15.4, 4.00), (1.64, 5.8, 0.04), glass, 0.03)
    cube("Ready bay stripe", (x, 7.8, 0.225), (5.9, 0.24, 0.02), [blue, mint, amber][index])
    if index < 2:
        cube("Charge column", (x + 2.15, 16.3, 1.08), (0.57, 0.55, 1.75), pearl, 0.16)
        cube("Charge display", (x + 2.15, 16.01, 1.37), (0.37, 0.025, 0.57), glass, 0.05)
        for j in range(4):
            cube(
                "Readiness light",
                (x + 2.15, 15.99, 1.19 + j * 0.11),
                (0.25, 0.035, 0.065),
                mint,
                0.01,
            )
        line(
            "Charging cable",
            [
                (x + 2.15, 16, 1.6),
                (x + 2.30, 15.8, 1.05),
                (x + 1.70, 15.4, 0.40),
                (x + 1.10, 15.1, 0.62),
                (x + 0.96, 15, 0.95),
            ],
            0.04,
            rubber,
        )
    vehicle = car("Parked fleet vehicle", van=index == 1, accent=mint if index == 1 else blue)
    vehicle.location = (x, 13.7, 0.17)
    vehicle.rotation_euler.z = -math.pi / 2

cube("Operations pavilion", (41.5, 17, 2.1), (9, 8, 4.1), sage, 0.25)
cube("Operations window", (41.5, 12.92, 2.0), (7.3, 0.04, 2.4), glass, 0.08)
cube("Pavilion roof", (41.5, 17, 4.19), (9.8, 8.7, 0.21), pearl, 0.1)
operator = person(24, 10.4, blue, skin_mat=skin_light, facing=-0.3)
cube("Operator tablet", (24, 10.0, 1.22), (0.37, 0.05, 0.25), glass, 0.03)

# Neighborhood buildings with warm, inhabited detail, away from the foreground AV.
for i, x in enumerate(range(-61, 3, 7)):
    height = random.uniform(7, 13)
    mat = [cream, sage, coral, light_blue][i % 4]
    cube("Neighborhood facade", (x, 13, height / 2), (6.5, 10, height), mat, 0.16)
    cube("Cornice", (x, 12.9, height - 0.15), (6.85, 10.5, 0.30), cream, 0.06)
    for floor in range(1, int(height / 2.6)):
        for dx in [-2.05, 0, 2.05]:
            cube("Window reveal", (x + dx, 7.91, floor * 2.6 + 0.35), (1.4, 0.13, 1.7), cream, 0.04)
            cube(
                "Window glazing",
                (x + dx, 7.81, floor * 2.6 + 0.35),
                (1.19, 0.03, 1.46),
                glass,
                0.02,
            )
    cube("Shop glazing", (x, 7.90, 1.40), (4.7, 0.03, 2.3), glass, 0.02)
    awning = cube(
        "Cafe awning", (x, 7.13, 2.75), (5.2, 1.8, 0.12), [amber, mint, blue][i % 3], 0.04
    )
    awning.rotation_euler.x = 0.13
for i, x in enumerate(range(-48, 70, 12)):
    h = random.uniform(12, 26)
    cube(
        "Distant city block",
        (x, 40 + random.uniform(-2, 4), h / 2),
        (9, 9, h),
        [cream, sage, light_blue][i % 3],
        0.3,
    )
    for z in range(4, int(h - 1), 3):
        cube("Distant glass ribbon", (x, 35.4, z), (7, 0.08, 1.4), light_blue, 0.02)

for x in range(-57, 61, 9):
    tree(x, -7.1, size=0.68 if x % 2 else 0.79)
    cube("Tree planter", (x, -7.1, 0.26), (1.6, 1.6, 0.4), cream, 0.14)
for x, y in [(2, 9), (4, 18), (40, 8), (48, 22), (4, 24), (33, 24)]:
    tree(x, y, size=0.9)
for x in [-40, -21, -4, 16, 38]:
    cube("Bench seat", (x, -8.3, 0.65), (2.0, 0.55, 0.15), wood, 0.06)
    cube("Bench back", (x, -8.55, 0.99), (2.0, 0.1, 0.7), wood, 0.06)
    for dx in [-0.7, 0.7]:
        cube("Bench leg", (x + dx, -8.3, 0.37), (0.1, 0.48, 0.55), blue, 0.02)
for x, y, cloth, small in [
    (-11, -6.7, coral, False),
    (-10.3, -6.9, amber, True),
    (7, -8, blue, False),
    (8, -7.8, cream, False),
    (-31, -6.4, sage, False),
    (33, -6.6, amber, False),
]:
    person(x, y, cloth, small, facing=0.4)
for x in [-52, -35, -18, 47]:
    cylinder("Street light post", (x, 5.25, 3.2), 0.055, 6.2, blue)
    line("Lamp arm", [(x, 5.25, 6.3), (x, 4.8, 6.55), (x, 3.9, 6.55)], 0.055, blue)
    cube("Street light", (x, 3.85, 6.5), (0.6, 0.43, 0.10), pearl, 0.08)

hero = car("Hero AV")
other = car("Coastal Ojai-inspired concept", van=True, accent=mint)
third = car("Blue accent fleet AV")
departure = car("Departing depot AV", van=True, accent=mint)

# Large soft lighting and a deliberately restrained, warm coastal grade.
world = bpy.data.worlds.new("Coastal daylight")
bpy.context.scene.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.60, 0.76, 0.82, 1)
world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.5
bpy.ops.object.light_add(type="SUN", location=(20, -25, 40))
sun = bpy.context.object
sun.rotation_euler = (math.radians(25), math.radians(-25), math.radians(-35))
sun.data.energy = 2.5
sun.data.angle = math.radians(7)
sun.data.color = (1.0, 0.88, 0.72)
bpy.ops.object.light_add(type="AREA", location=(10, -12, 30))
area = bpy.context.object
area.data.energy = 2600
area.data.shape = "DISK"
area.data.size = 30

bpy.ops.object.camera_add()
camera = bpy.context.object
scene = bpy.context.scene
scene.camera = camera
camera.data.lens = 48
camera.data.clip_end = 1500
camera.data.dof.use_dof = True
camera.data.dof.aperture_fstop = 8
scene.render.engine = "CYCLES"
scene.cycles.samples = 24
scene.cycles.use_denoising = True
scene.cycles.device = "GPU"
prefs = bpy.context.preferences.addons["cycles"].preferences
prefs.compute_device_type = "METAL"
prefs.get_devices()
for device in prefs.devices:
    device.use = device.type == "METAL"
scene.render.resolution_x = 1280
scene.render.resolution_y = 720
scene.render.resolution_percentage = 100
scene.render.fps = 24
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGB"
scene.view_settings.view_transform = "AgX"
scene.view_settings.look = "AgX - Medium High Contrast"
scene.view_settings.exposure = 0.3
scene.render.film_transparent = False
scene.render.use_persistent_data = True
scene.frame_start = 1
scene.frame_end = 384


def pose(frame):
    t = (frame - 1) / 24
    hero.location = (-18 + 4.2 * t, -2.2, 0)
    other.location = (48 - 3.5 * t, 2.2, 0)
    other.rotation_euler.z = math.pi
    third.location = (-50 + 4.2 * t, -2.2, 0)
    departure.location = (35.5, max(7.8, 19 - t * 0.70), 0.12)
    departure.rotation_euler.z = -math.pi / 2
    for moving_car, distance in [
        (hero, t * 4.2),
        (other, t * 3.5),
        (third, t * 4.2),
        (departure, min(11.2, t * 0.70)),
    ]:
        for child in moving_car.children:
            if child.name.startswith("Wheel assembly"):
                child.rotation_euler.y = distance / 0.43
    # Three deliberate camera setups: the ride, readiness, the connected fleet.
    if t < 5.3333:
        hx = hero.location.x
        camera.location = (hx + 7.5, 5.5, 3.8)
        target = Vector((hx - 0.25, -2.2, 1.05))
        camera.data.lens = 37
        camera.data.dof.aperture_fstop = 5.6
    elif t < 10.6666:
        u = (t - 5.3333) / 5.3333
        camera.location = (40 - 3 * u, -3 + 1.2 * u, 12 - 0.8 * u)
        target = Vector((21.5, 13.4, 1.25))
        camera.data.lens = 42
        camera.data.dof.aperture_fstop = 11
    else:
        u = (t - 10.6666) / 5.3333
        camera.location = (50 - 4 * u, -45 + 2 * u, 39 - 2 * u)
        target = Vector((9, 8, 1.0))
        camera.data.lens = 39
        camera.data.dof.aperture_fstop = 16
    camera.rotation_euler = (target - camera.location).to_track_quat("-Z", "Y").to_euler()
    camera.data.dof.focus_distance = (target - camera.location).length
    scene.frame_set(frame)


frames = [45, 184, 310] if args.preview else range(args.start, args.end + 1)
for frame in frames:
    pose(frame)
    scene.render.filepath = str(output / f"frame-{frame:04d}.png")
    bpy.ops.render.render(write_still=True)
pose(45)
bpy.ops.wm.save_as_mainfile(filepath=str(output.parent / "fleet-film.blend"))
