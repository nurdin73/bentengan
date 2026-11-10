"""
Bentengan Online - Modular Arena Builder (Blender 5.x, bpy)

Reproducibly builds the arena master scene and exports the runtime GLB.

Usage (Blender Python console / MCP):
    exec(open(r"<repo>/assets/3d/scripts/build_arena_modular.py").read(), ns := {})
    ns["build_all"](repo_root)

Coordinate contract (MUST match src/game/scenes/arena-greybox.ts + GAME_CONFIG.arena):
    Three.js (x, y, z)  <->  Blender (x, -z, y)   [glTF exporter, +Y up]
    Arena: 30 m wide (x) x 60 m long (three z), perimeter walls 1 m thick, 3.5 m high.
    Every visual that has a Rapier collider stays INSIDE that collider's box, so
    visuals never promise more (or less) solidity than physics provides.
"""

import math

import bmesh
import bpy
from mathutils import Matrix, Vector

ARENA_LENGTH = 60.0
ARENA_WIDTH = 30.0
WALL_HEIGHT = 3.5


def T(x, y, z):
    """Three.js world position -> Blender world position."""
    return Vector((x, -z, y))


# ---------------------------------------------------------------------------
# Scene / materials
# ---------------------------------------------------------------------------


def reset_scene():
    for ob in list(bpy.data.objects):
        bpy.data.objects.remove(ob, do_unlink=True)
    for coll in list(bpy.data.collections):
        bpy.data.collections.remove(coll)
    for pool in (bpy.data.meshes, bpy.data.materials, bpy.data.cameras, bpy.data.lights):
        for block in list(pool):
            pool.remove(block)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0


def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hex_rgb(hex_value):
    r = (hex_value >> 16) & 0xFF
    g = (hex_value >> 8) & 0xFF
    b = hex_value & 0xFF
    return tuple(srgb_to_linear(v / 255.0) for v in (r, g, b))


def make_material(name, hex_color, rough=0.85, metal=0.0, emit_strength=0.0, double_sided=False):
    mat = bpy.data.materials.new(name)
    try:
        mat.use_nodes = True  # no-op / deprecated on 5.x, required on older builds
    except Exception:
        pass
    rgb = hex_rgb(hex_color)
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*rgb, 1.0)
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    if emit_strength > 0:
        bsdf.inputs["Emission Color"].default_value = (*rgb, 1.0)
        bsdf.inputs["Emission Strength"].default_value = emit_strength
    mat.diffuse_color = (*rgb, 1.0)
    mat.use_backface_culling = not double_sided
    return mat


def build_materials():
    return {
        "grass": make_material("M_Grass", 0x7FB24A),
        "grass_dark": make_material("M_GrassDark", 0x5E8F36),
        "dirt": make_material("M_CourtDirt", 0xD9B77E, rough=0.95),
        "chalk": make_material("M_Chalk", 0xF8F4EA, rough=0.9),
        "stone": make_material("M_Stone", 0x9AA0A6, rough=0.9),
        "stone_dark": make_material("M_StoneDark", 0x6B7178, rough=0.9),
        "plaster": make_material("M_Plaster", 0xEDE4D3, rough=0.9),
        "terracotta": make_material("M_Terracotta", 0xC0613B, rough=0.8),
        "brick": make_material("M_Brick", 0xA94F32, rough=0.9),
        "wood": make_material("M_Wood", 0xB98250, rough=0.8),
        "wood_dark": make_material("M_WoodDark", 0x7A4E2D, rough=0.8),
        "bamboo": make_material("M_Bamboo", 0xD8C25A, rough=0.6),
        "bamboo_dark": make_material("M_BambooDark", 0x9E8A33, rough=0.6),
        "leaves": make_material("M_Leaves", 0x4E9A3E),
        "bark": make_material("M_Bark", 0x6A4A32),
        "metal": make_material("M_Metal", 0x3F4650, rough=0.5, metal=0.6),
        "lamp": make_material("M_LampGlow", 0xFFE3A3, rough=0.3, emit_strength=3.0),
        "gold": make_material("M_Gold", 0xE8B931, rough=0.35, metal=0.8),
        "blue": make_material("M_TeamBlue", 0x3B82F6, rough=0.55),
        "red": make_material("M_TeamRed", 0xEF4444, rough=0.55),
        "blue_glow": make_material("M_TeamBlueGlow", 0x60A5FA, rough=0.2, emit_strength=2.5),
        "red_glow": make_material("M_TeamRedGlow", 0xF87171, rough=0.2, emit_strength=2.5),
        "blue_cloth": make_material("M_TeamBlueCloth", 0x2563EB, rough=0.9, double_sided=True),
        "red_cloth": make_material("M_TeamRedCloth", 0xDC2626, rough=0.9, double_sided=True),
    }


def make_collection(name):
    coll = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(coll)
    return coll


# ---------------------------------------------------------------------------
# bmesh part helpers (all coordinates in Blender object-local space, Z up)
# ---------------------------------------------------------------------------


class Part:
    """Accumulates primitives with per-face material slots into one mesh object."""

    def __init__(self, materials):
        self.bm = bmesh.new()
        self.materials = list(materials)

    def _slot(self, mat):
        if mat not in self.materials:
            self.materials.append(mat)
        return self.materials.index(mat)

    def _assign(self, verts, mat):
        idx = self._slot(mat)
        for face in {f for v in verts for f in v.link_faces}:
            face.material_index = idx

    def box(self, size, center, mat, rot_z=0.0):
        verts = bmesh.ops.create_cube(self.bm, size=1.0)["verts"]
        bmesh.ops.scale(self.bm, vec=Vector(size), verts=verts)
        if rot_z:
            bmesh.ops.rotate(self.bm, verts=verts, cent=(0, 0, 0), matrix=Matrix.Rotation(rot_z, 3, "Z"))
        bmesh.ops.translate(self.bm, vec=Vector(center), verts=verts)
        self._assign(verts, mat)

    def cylinder(self, r1, r2, height, base_center, mat, segments=10, rot_z=0.0, axis=None):
        """Cylinder/cone standing on base_center (local Z up), optionally re-oriented to `axis`."""
        verts = bmesh.ops.create_cone(
            self.bm, cap_ends=True, cap_tris=False, segments=segments,
            radius1=r1, radius2=r2, depth=height,
        )["verts"]
        bmesh.ops.translate(self.bm, vec=Vector((0, 0, height / 2)), verts=verts)
        if rot_z:
            bmesh.ops.rotate(self.bm, verts=verts, cent=(0, 0, 0), matrix=Matrix.Rotation(rot_z, 3, "Z"))
        if axis == "X":
            bmesh.ops.rotate(self.bm, verts=verts, cent=(0, 0, 0), matrix=Matrix.Rotation(math.pi / 2, 3, "Y"))
        elif axis == "Y":
            bmesh.ops.rotate(self.bm, verts=verts, cent=(0, 0, 0), matrix=Matrix.Rotation(-math.pi / 2, 3, "X"))
        bmesh.ops.translate(self.bm, vec=Vector(base_center), verts=verts)
        self._assign(verts, mat)

    def blob(self, radius, center, mat, squash=1.0, subdiv=1):
        verts = bmesh.ops.create_icosphere(self.bm, subdivisions=subdiv, radius=radius)["verts"]
        bmesh.ops.scale(self.bm, vec=Vector((1, 1, squash)), verts=verts)
        bmesh.ops.translate(self.bm, vec=Vector(center), verts=verts)
        self._assign(verts, mat)

    def octahedron(self, radius, center, mat):
        verts = bmesh.ops.create_uvsphere(self.bm, u_segments=4, v_segments=2, radius=radius)["verts"]
        bmesh.ops.translate(self.bm, vec=Vector(center), verts=verts)
        self._assign(verts, mat)

    def ring(self, r_in, r_out, center, mat, segments=48, rot=0.0):
        """Flat annulus on the XY plane (segments=4 + rot=pi/4 gives a square frame)."""
        cx, cy, cz = center
        inner, outer = [], []
        for i in range(segments):
            a = rot + 2 * math.pi * i / segments
            inner.append(self.bm.verts.new((cx + r_in * math.cos(a), cy + r_in * math.sin(a), cz)))
            outer.append(self.bm.verts.new((cx + r_out * math.cos(a), cy + r_out * math.sin(a), cz)))
        idx = self._slot(mat)
        for i in range(segments):
            j = (i + 1) % segments
            face = self.bm.faces.new((inner[i], outer[i], outer[j], inner[j]))
            face.material_index = idx

    def plane(self, size_x, size_y, center, mat):
        cx, cy, cz = center
        hx, hy = size_x / 2, size_y / 2
        verts = [self.bm.verts.new((cx + dx, cy + dy, cz)) for dx, dy in ((-hx, -hy), (hx, -hy), (hx, hy), (-hx, hy))]
        face = self.bm.faces.new(verts)
        face.material_index = self._slot(mat)

    def triangle(self, p0, p1, p2, mat):
        face = self.bm.faces.new([self.bm.verts.new(p) for p in (p0, p1, p2)])
        face.material_index = self._slot(mat)

    def finish(self, name, collection, location=(0, 0, 0), bevel=0.0):
        mesh = bpy.data.meshes.new(name)
        bmesh.ops.recalc_face_normals(self.bm, faces=self.bm.faces)
        self.bm.to_mesh(mesh)
        self.bm.free()
        for mat in self.materials:
            mesh.materials.append(mat)
        obj = bpy.data.objects.new(name, mesh)
        obj.location = location
        collection.objects.link(obj)
        if bevel > 0:
            mod = obj.modifiers.new("Bevel", "BEVEL")
            mod.width = bevel
            mod.segments = 1
            mod.limit_method = "ANGLE"
            mod.harden_normals = False
        return obj


# ---------------------------------------------------------------------------
# Modules
# ---------------------------------------------------------------------------


def build_ground(M, coll):
    half_w, half_l = ARENA_WIDTH / 2, ARENA_LENGTH / 2
    p = Part([M["grass"]])
    # Outer apron (outside the walls, for props) sits slightly below the playable floor.
    p.box((ARENA_WIDTH + 24, ARENA_LENGTH + 24, 0.2), (0, 0, -0.12), M["grass_dark"])
    p.plane(ARENA_WIDTH - 1, ARENA_LENGTH - 1, (0, 0, 0.0), M["grass"])
    p.plane(ARENA_WIDTH - 5, ARENA_LENGTH - 5, (0, 0, 0.01), M["dirt"])
    p.finish("Ground_Field", coll)


def build_markings(M, coll):
    p = Part([M["chalk"]])
    court_w, court_l = ARENA_WIDTH - 5, ARENA_LENGTH - 5
    z = 0.02
    # Center dividing line: territory boundary (gameplay-critical readability).
    p.plane(ARENA_WIDTH - 1, 0.45, (0, 0, z), M["chalk"])
    p.ring(2.8, 3.0, (0, 0, z), M["chalk"], segments=48)
    # Court outline.
    for sx, sy, cx, cy in (
        (court_w, 0.15, 0, court_l / 2), (court_w, 0.15, 0, -court_l / 2),
        (0.15, court_l, court_w / 2, 0), (0.15, court_l, -court_w / 2, 0),
    ):
        p.plane(sx, sy, (cx, cy, z), M["chalk"])
    # Base capture rings (GAME_CONFIG.gameplay.baseCaptureRadius = 2.6).
    for team, pos in (("blue", T(0, 0, -25)), ("red", T(0, 0, 25))):
        p.ring(2.25, 2.6, (pos.x, pos.y, z + 0.005), M[team], segments=48)
    # Jail floor frames (4 x 4 m). Blue jail sits in red territory and vice versa.
    for team, pos in (("blue", T(10, 0, 20)), ("red", T(-10, 0, -20))):
        half_diag_in = 2.0 * math.sqrt(2)
        half_diag_out = 2.2 * math.sqrt(2)
        p.ring(half_diag_in, half_diag_out, (pos.x, pos.y, z + 0.005), M[team], segments=4, rot=math.pi / 4)
        p.plane(3.6, 3.6, (pos.x, pos.y, z), M[f"{team}_cloth"])
    p.finish("Ground_Markings", coll)


def build_perimeter_wall(M, coll, name, length, along_x, location):
    """Wall occupying exactly length x 1 m x 3.5 m (matches Rapier static box)."""
    p = Part([M["plaster"]])
    lx, ly = (length, 1.0) if along_x else (1.0, length)
    # Plinth + body (inset) + coping, all within the collider footprint.
    p.box((lx, ly, 0.6), (0, 0, 0.3), M["stone_dark"])
    inset_x, inset_y = (lx, ly - 0.16) if along_x else (lx - 0.16, ly)
    p.box((inset_x, inset_y, 2.6), (0, 0, 0.6 + 1.3), M["plaster"])
    p.box((lx, ly, 0.3), (0, 0, 3.5 - 0.15), M["terracotta"])
    # Pilasters every 5 m (full depth, so they stay flush with the collider faces).
    count = int(length // 5)
    for i in range(count + 1):
        t = -length / 2 + i * (length / count)
        t = max(-length / 2 + 0.3, min(length / 2 - 0.3, t))
        size = (0.6, ly, 2.6) if along_x else (lx, 0.6, 2.6)
        center = (t, 0, 1.9) if along_x else (0, t, 1.9)
        p.box(size, center, M["brick"])
    return p.finish(name, coll, location=location, bevel=0.03)


def build_boundaries(M, coll):
    half_w, half_l = ARENA_WIDTH / 2, ARENA_LENGTH / 2
    build_perimeter_wall(M, coll, "Wall_North_Blue", ARENA_WIDTH, True, T(0, 0, -half_l))
    build_perimeter_wall(M, coll, "Wall_South_Red", ARENA_WIDTH, True, T(0, 0, half_l))
    build_perimeter_wall(M, coll, "Wall_West", ARENA_LENGTH, False, T(-half_w, 0, 0))
    build_perimeter_wall(M, coll, "Wall_East", ARENA_LENGTH, False, T(half_w, 0, 0))


def build_benteng(M, coll, team, location):
    """Team fortress. Solid part stays inside the 2.4 x 2.5 x 2.4 m collider."""
    p = Part([M["stone"]])
    octa = math.pi / 8  # flats face the axes -> flat distance = r * cos(22.5deg)
    # Stepped pedestal (non-colliding footprint is low enough to walk over visually).
    p.cylinder(1.8, 1.75, 0.2, (0, 0, 0), M["stone_dark"], segments=12)
    p.cylinder(1.55, 1.5, 0.2, (0, 0, 0.2), M["stone"], segments=12)
    # Main pillar: octagon circumradius 1.2 -> flats at 1.11 m (< 1.2 m collider half-extent).
    p.cylinder(1.2, 1.1, 2.1, (0, 0, 0.4), M[team], segments=8, rot_z=octa)
    for z in (0.75, 2.2):
        p.cylinder(1.25, 1.25, 0.14, (0, 0, z), M["gold"], segments=8, rot_z=octa)
    # Hanging team banners on four flats.
    for k in range(4):
        a = k * math.pi / 2
        r = 1.13
        p.box((0.55, 0.04, 0.9), (r * math.cos(a), r * math.sin(a), 1.35), M[f"{team}_cloth"], rot_z=a + math.pi / 2)
    # Joglo-style roof + glowing crest (above player height, no collider needed).
    p.cylinder(1.55, 1.45, 0.12, (0, 0, 2.5), M["wood_dark"], segments=8, rot_z=octa)
    p.cylinder(1.5, 0.25, 0.75, (0, 0, 2.62), M["terracotta"], segments=8, rot_z=octa)
    p.cylinder(0.08, 0.08, 0.35, (0, 0, 3.3), M["gold"], segments=6)
    p.octahedron(0.45, (0, 0, 4.05), M[f"{team}_glow"])
    return p.finish(f"Benteng_{team.capitalize()}", coll, location=location, bevel=0.02)


def build_penjara(M, coll, team, location):
    """Open bamboo pergola marking the 4 x 4 m jail. No collider: posts sit at the corners only."""
    p = Part([M["bamboo"]])
    c = 1.95
    corners = ((c, c), (-c, c), (-c, -c), (c, -c))
    for x, y in corners:
        p.cylinder(0.09, 0.08, 2.5, (x, y, 0), M["bamboo"], segments=8)
        p.cylinder(0.11, 0.11, 0.06, (x, y, 0.8), M["bamboo_dark"], segments=8)
        p.cylinder(0.11, 0.11, 0.06, (x, y, 1.7), M["bamboo_dark"], segments=8)
    # Top beams.
    for (x0, y0), (x1, y1) in zip(corners, corners[1:] + corners[:1]):
        if x0 == x1:
            p.cylinder(0.07, 0.07, 4.1, (x0, -2.05, 2.42), M["bamboo_dark"], segments=8, axis="Y")
        else:
            p.cylinder(0.07, 0.07, 4.1, (-2.05, y0, 2.42), M["bamboo_dark"], segments=8, axis="X")
    # Bunting (umbul-umbul segitiga) along every beam in the team colour.
    cloth = M[f"{team}_cloth"]
    for i in range(6):
        t = -1.65 + i * 0.66
        for along_x, fixed in ((True, c), (True, -c), (False, c), (False, -c)):
            if along_x:
                p.triangle((t - 0.2, fixed, 2.36), (t + 0.2, fixed, 2.36), (t, fixed, 2.0), cloth)
            else:
                p.triangle((fixed, t - 0.2, 2.36), (fixed, t + 0.2, 2.36), (fixed, t, 2.0), cloth)
    # Team flag on one corner post.
    p.cylinder(0.035, 0.035, 1.0, (c, c, 2.5), M["wood_dark"], segments=6)
    p.box((0.7, 0.03, 0.45), (c + 0.36, c, 3.25), cloth)
    return p.finish(f"Penjara_{team.capitalize()}", coll, location=location)


def build_stone_pillar(M, coll, name, location, size=2.5):
    """Tembok batu: exactly fills its size^3 collider."""
    p = Part([M["stone"]])
    p.box((size, size, 0.3), (0, 0, 0.15), M["stone_dark"])
    p.box((size - 0.1, size - 0.1, size - 0.55), (0, 0, 0.3 + (size - 0.55) / 2), M["stone"])
    p.box((size - 0.04, size - 0.04, 0.12), (0, 0, size * 0.5), M["stone_dark"])
    p.box((size, size, 0.25), (0, 0, size - 0.125), M["stone_dark"])
    return p.finish(name, coll, location=location, bevel=0.05)


def add_crate(p, M, center, s):
    cx, cy, cz = center
    f = 0.14
    p.box((s - 0.06, s - 0.06, s - 0.06), (cx, cy, cz), M["wood"])
    h = s / 2 - f / 2
    for a in (-h, h):
        for b in (-h, h):
            p.box((s, f, f), (cx, cy + a, cz + b), M["wood_dark"])
            p.box((f, s, f), (cx + a, cy, cz + b), M["wood_dark"])
            p.box((f, f, s), (cx + a, cy + b, cz), M["wood_dark"])


def build_crate_stack(M, coll, name, location):
    """Peti kayu: two 2 m crates filling the 2 x 2 x 4 m (three w x h x d) collider."""
    p = Part([M["wood"]])
    add_crate(p, M, (0, 1.0, 1.0), 2.0)
    add_crate(p, M, (0, -1.0, 1.0), 2.0)
    return p.finish(name, coll, location=location)


def build_bamboo_fence(M, coll, name, location, width, height=0.8, depth=0.6):
    """Pagar bambu (jumpable). Fits inside width x height x depth collider."""
    p = Part([M["bamboo"]])
    p.box((width, depth - 0.1, 0.12), (0, 0, 0.06), M["wood_dark"])
    p.cylinder(0.1, 0.1, height, (-width / 2 + 0.1, 0, 0), M["wood_dark"], segments=8)
    p.cylinder(0.1, 0.1, height, (width / 2 - 0.1, 0, 0), M["wood_dark"], segments=8)
    inner = width - 0.4
    n = int(inner / 0.22)
    for i in range(n + 1):
        x = -inner / 2 + i * (inner / n)
        top = height - (0.0 if i % 2 == 0 else 0.07)
        p.cylinder(0.055, 0.05, top - 0.12, (x, 0, 0.12), M["bamboo"], segments=8)
    for z in (0.35, 0.62):
        for y in (-0.11, 0.11):
            p.cylinder(0.045, 0.045, width - 0.2, (-(width - 0.2) / 2, y, z), M["bamboo_dark"], segments=8, axis="X")
    return p.finish(name, coll, location=location)


def build_obstacles(M, solid, jumpable):
    for x in (-6, 6):
        build_stone_pillar(M, solid, f"TembokBatu_Mid_{'L' if x < 0 else 'R'}", T(x, 0, 0))
    for side, z in (("Blue", -14), ("Red", 14)):
        for x in (-8, 8):
            build_crate_stack(M, solid, f"PetiKayu_{side}_{'L' if x < 0 else 'R'}", T(x, 0, z))
    for z in (-5, 5):
        build_bamboo_fence(M, jumpable, f"PagarBambu_Mid_{'Blue' if z < 0 else 'Red'}", T(0, 0, z), 4.0)
    build_bamboo_fence(M, jumpable, "PagarBambu_Blue", T(-4, 0, -20), 3.0)
    build_bamboo_fence(M, jumpable, "PagarBambu_Red", T(4, 0, 20), 3.0)


def build_tree(M, coll, name, location, scale=1.0):
    p = Part([M["bark"]])
    p.cylinder(0.32 * scale, 0.2 * scale, 3.2 * scale, (0, 0, -0.1), M["bark"], segments=8)
    for (dx, dy, dz, r) in ((0, 0, 3.6, 1.7), (0.9, 0.3, 3.1, 1.2), (-0.8, -0.4, 3.2, 1.25), (0.1, -0.8, 4.4, 1.1)):
        p.blob(r * scale, (dx * scale, dy * scale, dz * scale), M["leaves"], squash=0.85)
    return p.finish(name, coll, location=location)


def build_lamp(M, coll, name, location):
    p = Part([M["metal"]])
    p.cylinder(0.25, 0.2, 0.3, (0, 0, -0.1), M["stone_dark"], segments=8)
    p.cylinder(0.08, 0.06, 5.0, (0, 0, 0.2), M["metal"], segments=8)
    p.box((0.6, 0.6, 0.12), (0, 0, 5.25), M["metal"])
    p.box((0.45, 0.45, 0.25), (0, 0, 5.05), M["lamp"])
    return p.finish(name, coll, location=location)


def build_gapura(M, coll, team, location):
    """Candi bentar-style split gate behind each team's end wall (orientation landmark)."""
    p = Part([M["brick"]])
    for sx in (-1, 1):
        x = sx * 2.4
        tiers = ((2.0, 0.6), (1.7, 2.6), (1.4, 0.5), (1.1, 0.9), (0.8, 0.6), (0.5, 0.5))
        z = -0.1
        for width, h in tiers:
            mat = M["stone_dark"] if h <= 0.6 else M["brick"]
            p.box((width, width, h), (x, 0, z + h / 2), mat)
            z += h
        p.octahedron(0.3, (x, 0, z + 0.3), M[f"{team}_glow"])
        # Umbul-umbul (tall team banner pole) next to each tower.
        bx = sx * 4.4
        p.cylinder(0.06, 0.05, 7.0, (bx, 0, -0.1), M["bamboo"], segments=6)
        p.box((0.04, 0.6, 3.0), (bx, 0.32, 5.2), M[f"{team}_cloth"])
    return p.finish(f"Gapura_{team.capitalize()}", coll, location=location)


def build_bushes(M, coll, name, location, count=3):
    p = Part([M["leaves"]])
    for i in range(count):
        p.blob(0.55 + 0.15 * (i % 2), (i * 0.7 - (count - 1) * 0.35, 0.1 * (i % 2), 0.3), M["grass_dark"], squash=0.7)
    return p.finish(name, coll, location=location)


def build_props(M, coll):
    """All decorative props live OUTSIDE the perimeter walls -> zero gameplay/collider impact."""
    i = 0
    for x in (-19.0, 19.0):
        for z in (-24, -12, 0, 12, 24):
            i += 1
            build_tree(M, coll, f"Pohon_{i:02d}", T(x + (0.6 if z % 24 else -0.4), 0, z + 1.5), scale=1.0 + 0.1 * (i % 3))
    for z in (-34.0, 34.0):
        for x in (-11, 11):
            i += 1
            build_tree(M, coll, f"Pohon_{i:02d}", T(x, 0, z), scale=1.15)
    for k, (x, z) in enumerate(((-16.6, -31.6), (16.6, -31.6), (-16.6, 31.6), (16.6, 31.6))):
        build_lamp(M, coll, f"LampuLapangan_{k + 1}", T(x, 0, z))
    for k, z in enumerate((-18, -6, 6, 18)):
        build_bushes(M, coll, f"Semak_W{k + 1}", T(-16.2, 0, z))
        build_bushes(M, coll, f"Semak_E{k + 1}", T(16.2, 0, z))
    build_gapura(M, coll, "blue", T(0, 0, -32.5))
    build_gapura(M, coll, "red", T(0, 0, 32.5))


def build_preview_rig(coll):
    cam_data = bpy.data.cameras.new("PreviewCam")
    cam = bpy.data.objects.new("PreviewCam", cam_data)
    cam.location = (34, -46, 30)
    direction = Vector((0, 0, 0)) - cam.location
    cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    cam_data.lens = 32
    coll.objects.link(cam)
    bpy.context.scene.camera = cam
    sun_data = bpy.data.lights.new("PreviewSun", "SUN")
    sun_data.energy = 3.5
    sun = bpy.data.objects.new("PreviewSun", sun_data)
    sun.rotation_euler = (math.radians(50), math.radians(10), math.radians(35))
    coll.objects.link(sun)
    scene = bpy.context.scene
    scene.render.resolution_x, scene.render.resolution_y = 1280, 720
    scene.world = scene.world or bpy.data.worlds.new("World")
    background = scene.world.node_tree.nodes.get("Background") if scene.world.node_tree else None
    if background:
        background.inputs[0].default_value = (0.55, 0.7, 0.9, 1.0)
        background.inputs[1].default_value = 0.8


# ---------------------------------------------------------------------------
# Entry points
# ---------------------------------------------------------------------------


def build_scene():
    reset_scene()
    M = build_materials()
    colls = {name: make_collection(name) for name in (
        "Ground_Markings", "Environment_Boundaries", "Benteng", "Penjara",
        "Obstacles_Solid", "Obstacles_Jumpable", "Props_Decorative", "_Preview_NoExport",
    )}
    build_ground(M, colls["Ground_Markings"])
    build_markings(M, colls["Ground_Markings"])
    build_boundaries(M, colls["Environment_Boundaries"])
    build_benteng(M, colls["Benteng"], "blue", T(0, 0, -25))
    build_benteng(M, colls["Benteng"], "red", T(0, 0, 25))
    build_penjara(M, colls["Penjara"], "blue", T(10, 0, 20))
    build_penjara(M, colls["Penjara"], "red", T(-10, 0, -20))
    build_obstacles(M, colls["Obstacles_Solid"], colls["Obstacles_Jumpable"])
    build_props(M, colls["Props_Decorative"])
    build_preview_rig(colls["_Preview_NoExport"])
    meshes = [o for o in bpy.data.objects if o.type == "MESH"]
    return {
        "objects": len(meshes),
        "tris": sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in meshes),
        "materials": len(bpy.data.materials),
    }


def export_runtime_glb(filepath):
    """Bake a draw-call-optimised copy (one mesh per material), export it, then discard it."""
    view_layer = bpy.context.view_layer
    if bpy.context.object and bpy.context.object.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")
    bpy.ops.object.select_all(action="DESELECT")
    sources = [o for o in bpy.data.objects if o.type == "MESH" and "_Preview" not in o.users_collection[0].name]
    bake = make_collection("_ExportBake")
    dups = []
    for src in sources:
        dup = src.copy()
        dup.data = src.data.copy()
        bake.objects.link(dup)
        dups.append(dup)
    for dup in dups:
        dup.select_set(True)
    view_layer.objects.active = dups[0]
    bpy.ops.object.convert(target="MESH")  # applies bevel modifiers
    bpy.ops.object.join()
    merged = view_layer.objects.active
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.separate(type="MATERIAL")
    bpy.ops.object.mode_set(mode="OBJECT")
    parts = [o for o in bake.objects]
    for part in parts:
        mat = part.data.materials[0] if part.data.materials else None
        # Drop unused material slots so each object exports as a single primitive.
        used = {p.material_index for p in part.data.polygons}
        if len(used) == 1:
            keep = part.data.materials[used.pop()]
            part.data.materials.clear()
            part.data.materials.append(keep)
            for poly in part.data.polygons:
                poly.material_index = 0
            mat = keep
        part.name = f"Arena_{mat.name[2:] if mat else 'Mesh'}"
        part.data.name = part.name
    bpy.ops.object.select_all(action="DESELECT")
    for part in parts:
        part.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=filepath, export_format="GLB", use_selection=True, export_apply=True,
        export_yup=True, export_texcoords=False, export_cameras=False, export_lights=False, export_materials="EXPORT",
    )
    summary = {"primitives": len(parts), "names": sorted(p.name for p in parts)}
    for part in parts:
        mesh = part.data
        bpy.data.objects.remove(part, do_unlink=True)
        bpy.data.meshes.remove(mesh)
    bpy.data.collections.remove(bake)
    return summary


def build_all(repo_root):
    stats = build_scene()
    bpy.ops.wm.save_as_mainfile(filepath=f"{repo_root}/assets/3d/arena_modular_master.blend")
    stats["export"] = export_runtime_glb(f"{repo_root}/public/models/arena_modular.glb")
    bpy.ops.wm.save_mainfile()
    return stats
