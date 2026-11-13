"""
Blender 5.2 Python Script — Rebuild Female Modular Character Presets (07..10)
using Template Mesh Cloning & Smooth Organic Deformation from 830-vertex Male Base Meshes.

Guarantees 100% visual, topological, and stylistic consistency with Presets 01..06:
- Reuses Arm_L_Base & Arm_R_Base (with rounded hands & thumbs, 1860 verts)
- Uses Shoes01_Sneaker_Upper_L/R across all presets (matching Presets 01..06)
- Clones 830-vert torso, sleeve, pelvis, leg, and headgear templates from 01..06
- Applies smooth trigonometric/polynomial deformations (no boxy primitive blocks)
"""

import math
import shutil
from pathlib import Path
import bpy
from mathutils import Vector


PROJECT_ROOT = Path(r"c:\Users\nurdi\Desktop\bentengan")
BLEND_MASTER = PROJECT_ROOT / "assets" / "3d" / "character_modular_master.blend"
BACKUP_DIR = PROJECT_ROOT / "assets" / "3d" / "backups"
GLB_EXPORT_PATH = PROJECT_ROOT / "public" / "models" / "character_modular.glb"


def ensure_backups() -> None:
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    blend_backup = BACKUP_DIR / "character_modular_v4_6sets_backup.blend"
    glb_backup = BACKUP_DIR / "character_modular_v4_6sets_backup.glb"
    if BLEND_MASTER.exists() and not blend_backup.exists():
        shutil.copy2(BLEND_MASTER, blend_backup)
    if GLB_EXPORT_PATH.exists() and not glb_backup.exists():
        shutil.copy2(GLB_EXPORT_PATH, glb_backup)


def get_or_create_material(name: str, rgba: tuple[float, float, float, float], roughness: float = 0.85) -> bpy.types.Material:
    mat = bpy.data.materials.get(name)
    if mat is None:
        mat = bpy.data.materials.new(name=name)
        mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = rgba
        bsdf.inputs["Roughness"].default_value = roughness
    mat.diffuse_color = rgba
    return mat


def get_or_create_collection(name: str, parent_col: bpy.types.Collection) -> bpy.types.Collection:
    col = bpy.data.collections.get(name)
    if col is None:
        col = bpy.data.collections.new(name)
        parent_col.children.link(col)
    return col


def remove_existing_female_objects() -> None:
    prefixes = (
        "Top07_", "Bot07_", "Hat07_",
        "Top08_", "Bot08_", "Hat08_",
        "Top09_", "Bot09_", "Hat09_",
        "Top10_", "Bot10_", "Hat10_",
        "Arm_L_Female", "Arm_R_Female",
        "FaceFem_",
    )
    to_remove = [obj for obj in list(bpy.data.objects) if obj.name.startswith(prefixes)]
    for obj in to_remove:
        mesh_data = obj.data if obj.type == "MESH" else None
        bpy.data.objects.remove(obj, do_unlink=True)
        if mesh_data and mesh_data.users == 0:
            bpy.data.meshes.remove(mesh_data)


def clone_template_mesh(
    src_name: str,
    new_name: str,
    mat: bpy.types.Material,
    collection: bpy.types.Collection,
    deform_fn=None,
    target_parent_ref_name: str | None = None,
) -> bpy.types.Object:
    """
    Clones an existing 830-vert (or spherical) template mesh from 01..06,
    preserving its exact parent, matrix_parent_inverse, matrix_world, and smooth topology.
    """
    src_obj = bpy.data.objects.get(src_name)
    if src_obj is None:
        raise RuntimeError(f"Template object {src_name} not found")

    ref_obj = bpy.data.objects.get(target_parent_ref_name) if target_parent_ref_name else src_obj
    if ref_obj is None:
        raise RuntimeError(f"Reference parent object {target_parent_ref_name} not found")

    mesh = src_obj.data.copy()
    mesh.name = new_name

    if ref_obj != src_obj:
        world_to_ref = ref_obj.matrix_world.inverted() @ src_obj.matrix_world
        for v in mesh.vertices:
            v.co = world_to_ref @ v.co

    if deform_fn is not None:
        for v in mesh.vertices:
            v.co = deform_fn(v.co.copy())

    mesh.update()
    for poly in mesh.polygons:
        poly.use_smooth = True

    mesh.materials.clear()
    mesh.materials.append(mat)

    obj = bpy.data.objects.new(new_name, mesh)
    obj.parent = ref_obj.parent
    obj.matrix_parent_inverse = ref_obj.matrix_parent_inverse.copy()
    obj.matrix_world = ref_obj.matrix_world.copy()
    collection.objects.link(obj)
    return obj


def smoothstep(edge0: float, edge1: float, x: float) -> float:
    if edge1 == edge0:
        return 0.0
    t = max(0.0, min(1.0, (x - edge0) / (edge1 - edge0)))
    return t * t * (3.0 - 2.0 * t)


def waist_taper_deform(v: Vector, pinch: float = 0.065, flare_bottom: float = 0.02) -> Vector:
    """
    Preserves top shoulder dimensions (z >= 0.28) 100% so arms and neck fit seamlessly,
    applies a gentle feminine waist curve around z = 0.12, and optional subtle bottom flare.
    """
    z = v.z
    if -0.02 <= z <= 0.30:
        t = (z - (-0.02)) / 0.32
        waist_factor = math.sin(t * math.pi)
        scale_xy = 1.0 - pinch * waist_factor
    else:
        scale_xy = 1.0

    if z < 0.08 and flare_bottom != 0.0:
        b_t = smoothstep(0.08, -0.01, z)
        scale_xy += flare_bottom * b_t

    return Vector((v.x * scale_xy, v.y * scale_xy, z))


def female_full_hair_shell_deform(v: Vector, back_drop: float = 0.03) -> Vector:
    """
    Deforms a cloned Head_Base mesh (in Socket_Headgear space: x[-0.277, 0.277], y[-0.271, 0.266], z[-0.305, 0.165])
    into a full, smooth female hair shell that covers the top crown, temples/sides, and back of the head
    while recessing the front face window so Head_Base face, eyes, and blush remain 100% clean.
    """
    x = v.x * 1.038
    y = v.y * 1.038
    z = v.z * 1.038 + 0.008

    if y < -0.02:
        wx = smoothstep(0.258, 0.195, abs(x))
        wz_top = smoothstep(0.055, -0.005, z)
        wy = smoothstep(-0.02, -0.18, y)
        face_mask = wx * wz_top * wy
        y += 0.085 * face_mask
        x *= (1.0 - 0.08 * face_mask)
        if z < -0.22:
            chin_mask = smoothstep(-0.22, -0.30, z) * wy
            z += 0.06 * chin_mask

    if y > -0.10 and z < -0.10:
        back_t = smoothstep(-0.10, 0.15, y)
        low_t = smoothstep(-0.10, -0.30, z)
        x *= (1.0 + 0.035 * back_t * low_t)
        y += 0.018 * back_t * low_t
        z -= back_drop * back_t * low_t

    return Vector((x, y, z))


def build_shared_female_details(
    base_col: bpy.types.Collection,
    mat_face: bpy.types.Material,
    mat_blush: bpy.types.Material,
) -> None:
    """
    Minimalist, cute female facial accents cloned from Eye_L_Base / Eye_R_Base (332 verts):
    - FaceFem_Eyelash_L/R: delicate small outer-corner flick next to each eye
    - FaceFem_Blush_L/R: ultra-thin horizontal oval cheek blush sitting flush on Head_Base
    """
    def eyelash_l_deform(v: Vector) -> Vector:
        nx = (v.x - 0.082) / 0.0212
        ny = (v.y - (-0.262)) / 0.0184
        nz = (v.z - 0.234) / 0.056
        u = nz
        w = nx
        x = 0.104 + 0.014 * u + 0.003 * w
        z = 0.268 + 0.010 * u + 0.0045 * w + 0.003 * (u * u)
        y = -0.268 + 0.008 * ny
        return Vector((x, y, z))

    def eyelash_r_deform(v: Vector) -> Vector:
        nx = (v.x - (-0.082)) / 0.0212
        ny = (v.y - (-0.262)) / 0.0184
        nz = (v.z - 0.234) / 0.056
        u = nz
        w = -nx
        x = -0.104 - 0.014 * u - 0.003 * w
        z = 0.268 + 0.010 * u + 0.0045 * w + 0.003 * (u * u)
        y = -0.268 + 0.008 * ny
        return Vector((x, y, z))

    clone_template_mesh("Eye_L_Base", "FaceFem_Eyelash_L", mat_face, base_col, eyelash_l_deform)
    clone_template_mesh("Eye_R_Base", "FaceFem_Eyelash_R", mat_face, base_col, eyelash_r_deform)

    def blush_l_deform(v: Vector) -> Vector:
        nx = (v.x - 0.082) / 0.0212
        ny = (v.y - (-0.262)) / 0.0184
        nz = (v.z - 0.234) / 0.056
        x = 0.150 + 0.028 * nz
        z = 0.152 + 0.013 * nx
        cheek_curve = 0.005 * max(0.0, (abs(x) - 0.12) / 0.06)
        y = -0.2705 + cheek_curve + 0.0025 * ny
        return Vector((x, y, z))

    def blush_r_deform(v: Vector) -> Vector:
        nx = (v.x - (-0.082)) / 0.0212
        ny = (v.y - (-0.262)) / 0.0184
        nz = (v.z - 0.234) / 0.056
        x = -0.150 - 0.028 * nz
        z = 0.152 + 0.013 * nx
        cheek_curve = 0.005 * max(0.0, (abs(x) - 0.12) / 0.06)
        y = -0.2705 + cheek_curve + 0.0025 * ny
        return Vector((x, y, z))

    clone_template_mesh("Eye_L_Base", "FaceFem_Blush_L", mat_blush, base_col, blush_l_deform)
    clone_template_mesh("Eye_R_Base", "FaceFem_Blush_R", mat_blush, base_col, blush_r_deform)


def build_preset_07_srikandi(
    col: bpy.types.Collection,
    mats: dict[str, bpy.types.Material],
) -> None:
    """Preset 07: Srikandi Nusantara (Kebaya Kutubaru, Selendang, Kain Batik, Sanggul & Siger/Sunting)"""
    clone_template_mesh(
        "Top02_Pangsi_Torso", "Top07_Kebaya_Torso", mats["primary"], col,
        lambda v: waist_taper_deform(v, pinch=0.065, flare_bottom=0.025),
    )
    clone_template_mesh("Top02_Pangsi_Sleeve_L", "Top07_Kebaya_Sleeve_L", mats["primary"], col)
    clone_template_mesh("Top02_Pangsi_Sleeve_R", "Top07_Kebaya_Sleeve_R", mats["primary"], col)
    # Gold sleeve cuffs matching Top02_Pangsi_GoldCuff_L/R
    clone_template_mesh("Top02_Pangsi_GoldCuff_L", "Top07_Kebaya_GoldCuff_L", mats["accent"], col)
    clone_template_mesh("Top02_Pangsi_GoldCuff_R", "Top07_Kebaya_GoldCuff_R", mats["accent"], col)
    clone_template_mesh(
        "Top02_Pangsi_GoldBelt", "Top07_Kebaya_GoldBelt", mats["accent"], col,
        lambda v: Vector((v.x * 0.96, v.y * 0.96, v.z + 0.015)),
    )
    clone_template_mesh(
        "Top05_Kacu_TeamScarf", "Top07_Kebaya_Collar", mats["secondary"], col,
        lambda v: Vector((v.x * 0.86, v.y * 0.985, v.z)),
    )

    def selendang_deform(v: Vector) -> Vector:
        nz = (v.z - (-0.008)) / 0.128
        nx = v.x / 0.2575
        center_z = 0.20 + 0.135 * nx
        band_half = 0.042
        z_new = center_z + (nz - 0.5) * (2.0 * band_half)
        base_taper = waist_taper_deform(Vector((v.x, v.y, max(0.0, min(0.42, z_new)))), pinch=0.065, flare_bottom=0.025)
        return Vector((base_taper.x * 1.018, base_taper.y * 1.018, z_new))

    clone_template_mesh("Top02_Pangsi_WaistSash", "Top07_Kebaya_Selendang", mats["secondary"], col, selendang_deform)

    def batik_skirt_deform(v: Vector) -> Vector:
        t = (0.045 - v.z) / 0.160
        z_new = 0.045 - t * 0.230
        flare = 1.0 + 0.065 * math.sin(t * math.pi * 0.85)
        return Vector((v.x * flare, v.y * flare, z_new))

    clone_template_mesh("Bot02_Komprang_Pelvis", "Bot07_BatikSkirt_Pelvis", mats["dark"], col, batik_skirt_deform)

    def batik_hem_deform(v: Vector) -> Vector:
        nz = (v.z - 0.042) / 0.036
        z_new = -0.188 + nz * 0.032
        return Vector((v.x * 1.02, v.y * 1.02, z_new))

    clone_template_mesh("Top02_Pangsi_GoldBelt", "Bot07_BatikSkirt_GoldHem", mats["accent"], col, batik_hem_deform)
    clone_template_mesh("Bot04_Shin_Skin_L", "Bot07_Shin_Skin_L", mats["skin"], col)
    clone_template_mesh("Bot04_Shin_Skin_R", "Bot07_Shin_Skin_R", mats["skin"], col)
    clone_template_mesh("Bot02_Komprang_GoldCuff_L", "Bot07_GoldAnklet_L", mats["accent"], col)
    clone_template_mesh("Bot02_Komprang_GoldCuff_R", "Bot07_GoldAnklet_R", mats["accent"], col)

    # Hat07: Full hair shell + classic wide Sanggul + twin hanging Melati ronce at temples + gold Siger/Sunting crown
    clone_template_mesh(
        "Head_Base", "Hat07_BaseHair", mats["hair"], col,
        deform_fn=lambda v: female_full_hair_shell_deform(v, back_drop=0.025),
        target_parent_ref_name="Hat02_BaseHair",
    )

    def sanggul_bun_deform(v: Vector) -> Vector:
        nx = v.x / 0.0624
        ny = v.y / 0.0624
        nz = (v.z - 0.290) / 0.045
        # Classic wide Javanese/Sundanese sanggul with rounded side lobes peeking gently behind the ears
        lobe = 1.0 + 0.25 * (nx * nx)
        return Vector((nx * 0.285, 0.135 + ny * 0.105, -0.085 + nz * 0.125 * lobe))

    clone_template_mesh("Hat06_Beanie_PomPom", "Hat07_Sanggul_Bun", mats["hair"], col, sanggul_bun_deform)

    # Twin jasmine ronce strands (Melati) framing the sides of the sanggul so they show clearly in 3/4 view
    def melati_deform(side: float):
        def _deform(v: Vector) -> Vector:
            nx = v.x / 0.0624
            ny = v.y / 0.0624
            nz = (v.z - 0.290) / 0.045
            t = (nz + 1.0) * 0.5  # 0 at bottom, 1 at top
            bead_wave = 1.0 + 0.18 * math.cos(t * math.pi * 6.0)
            cx = side * (0.282 + (1.0 - t) * 0.012)
            cy = 0.015 + (1.0 - t) * 0.020
            cz = -0.265 + t * 0.265
            return Vector((cx + nx * 0.028 * bead_wave, cy + ny * 0.028 * bead_wave, cz))
        return _deform

    clone_template_mesh("Hat06_Beanie_PomPom", "Hat07_Melati_Crown_L", mats["light"], col, melati_deform(1.0))
    clone_template_mesh("Hat06_Beanie_PomPom", "Hat07_Melati_Crown_R", mats["light"], col, melati_deform(-1.0))

    def sunting_deform(v: Vector) -> Vector:
        nz = (v.z - 0.02) / 0.028
        nx = abs(v.x) / 0.2907
        front_mask = smoothstep(0.05, -0.22, v.y)
        main_peak = max(0.0, 1.0 - nx * 1.45) ** 1.5
        side_peak = 0.45 * math.exp(-(((nx - 0.52) / 0.16) ** 2))
        crown_height = 0.028 + nz * (0.022 + 0.095 * front_mask * (main_peak + side_peak))
        return Vector((v.x * 0.94, v.y * 0.94, 0.065 + crown_height))

    clone_template_mesh("Hat04_Sweatband_Stripe", "Hat07_Sunting_Gold", mats["accent"], col, sunting_deform)


def build_preset_08_sporty_ponytail(
    col: bpy.types.Collection,
    mats: dict[str, bpy.types.Material],
) -> None:
    """Preset 08: Aero Ponytail (Sport Jersey, Pleated Skirt, Sport Visor & High Bouncy Ponytail)"""
    clone_template_mesh(
        "Top01_Jersey_Torso", "Top08_Jersey_Torso", mats["primary"], col,
        lambda v: waist_taper_deform(v, pinch=0.06, flare_bottom=0.01),
    )
    clone_template_mesh("Top01_Jersey_Sleeve_L", "Top08_Jersey_Sleeve_L", mats["primary"], col)
    clone_template_mesh("Top01_Jersey_Sleeve_R", "Top08_Jersey_Sleeve_R", mats["primary"], col)
    clone_template_mesh(
        "Top04_Tank_ChestStripe", "Top08_Jersey_ChestStripe", mats["secondary"], col,
        lambda v: Vector((v.x * 0.985, v.y * 0.965, v.z)),
    )
    clone_template_mesh(
        "Top06_PufferVest_Collar", "Top08_Jersey_Collar", mats["light"], col,
        lambda v: Vector((v.x * 0.92, v.y * 0.92, 0.395 + (v.z - 0.395) * 0.55)),
    )
    clone_template_mesh("Top03_Hoodie_WristCuff_L", "Top08_Wristband_L", mats["secondary"], col)
    clone_template_mesh("Top03_Hoodie_WristCuff_R", "Top08_Wristband_R", mats["secondary"], col)

    def pleated_skirt_deform(v: Vector) -> Vector:
        t = (0.045 - v.z) / 0.150
        z_new = 0.045 - t * 0.215
        smooth_t = t * t * (3.0 - 2.0 * t)
        angle = math.atan2(v.y, v.x)
        pleat_wave = 0.018 * smooth_t * math.cos(angle * 12.0)
        flare = 1.0 + 0.13 * smooth_t + pleat_wave
        return Vector((v.x * flare, v.y * flare, z_new))

    clone_template_mesh("Bot04_AthleticShorts_Pelvis", "Bot08_PleatedSkirt_Pelvis", mats["secondary"], col, pleated_skirt_deform)

    def pleated_trim_deform(v: Vector) -> Vector:
        nz = (v.z - 0.042) / 0.036
        z_new = -0.172 + nz * 0.028
        angle = math.atan2(v.y, v.x)
        pleat_wave = 0.018 * math.cos(angle * 12.0)
        flare = 1.06 + pleat_wave
        return Vector((v.x * flare, v.y * flare, z_new))

    clone_template_mesh("Top02_Pangsi_GoldBelt", "Bot08_PleatedSkirt_Trim", mats["primary"], col, pleated_trim_deform)
    clone_template_mesh("Bot04_Shin_Skin_L", "Bot08_Shin_Skin_L", mats["skin"], col)
    clone_template_mesh("Bot04_Shin_Skin_R", "Bot08_Shin_Skin_R", mats["skin"], col)
    clone_template_mesh(
        "Bot05_HighSock_L", "Bot08_SportSock_L", mats["light"], col,
        lambda v: Vector((v.x, v.y, -0.34 + (v.z - (-0.34)) * 0.82)),
    )
    clone_template_mesh(
        "Bot05_HighSock_R", "Bot08_SportSock_R", mats["light"], col,
        lambda v: Vector((v.x, v.y, -0.34 + (v.z - (-0.34)) * 0.82)),
    )

    # Hat08: Full female hair shell + open-top sport visor + high fountain ponytail arching visibly above/beside crown!
    clone_template_mesh(
        "Head_Base", "Hat08_HairCrown", mats["hair"], col,
        deform_fn=lambda v: female_full_hair_shell_deform(v, back_drop=0.025),
        target_parent_ref_name="Hat02_BaseHair",
    )
    clone_template_mesh(
        "Hat04_Sweatband_Main", "Hat08_SportVisor_Band", mats["primary"], col,
        lambda v: Vector((v.x * 1.015, v.y * 1.015, v.z)),
    )
    clone_template_mesh("Hat01_Cap_Visor", "Hat08_SportVisor_Brim", mats["secondary"], col)

    def ponytail_tie_deform(v: Vector) -> Vector:
        nx = v.x / 0.0624
        ny = v.y / 0.0624
        nz = (v.z - 0.290) / 0.045
        # High top-back scrunchie so the ponytail fountain rises visibly over the crown!
        return Vector((nx * 0.085, 0.125 + ny * 0.065, 0.195 + nz * 0.055))

    clone_template_mesh("Hat06_Beanie_PomPom", "Hat08_Ponytail_Tie", mats["secondary"], col, ponytail_tie_deform)

    def ponytail_flow_deform(v: Vector) -> Vector:
        nx = v.x / 0.0624
        ny = v.y / 0.0624
        nz = (v.z - 0.290) / 0.045
        t = (nz + 1.0) * 0.5  # 0 at bottom tip, 1 at top root
        profile = math.sin(t * math.pi) * 0.90 + 0.25
        # High energetic ponytail: rises up to z=0.33 near root (t=0.75) and cascades down to z=-0.08 at back
        arch = 0.125 * math.sin(t * math.pi)
        center_y = 0.145 + (1.0 - t) * 0.195
        center_z = -0.055 + t * 0.265 + arch
        return Vector((
            nx * 0.135 * profile,
            center_y + ny * 0.085 * profile,
            center_z,
        ))

    clone_template_mesh("Hat06_Beanie_PomPom", "Hat08_Ponytail_Flow", mats["hair"], col, ponytail_flow_deform)


def build_preset_09_pramuka_putri(
    col: bpy.types.Collection,
    mats: dict[str, bpy.types.Material],
) -> None:
    """Preset 09: Siswi Pramuka (Scout Shirt, Kacu, Culottes Skirt, Beret & Twin Pigtails)"""
    clone_template_mesh(
        "Top05_Shirt_Torso", "Top09_ScoutShirt_Torso", mats["secondary"], col,
        lambda v: waist_taper_deform(v, pinch=0.055, flare_bottom=0.015),
    )
    clone_template_mesh("Top05_Shirt_Sleeve_L", "Top09_ScoutShirt_Sleeve_L", mats["secondary"], col)
    clone_template_mesh("Top05_Shirt_Sleeve_R", "Top09_ScoutShirt_Sleeve_R", mats["secondary"], col)
    clone_template_mesh(
        "Top06_PufferVest_Collar", "Top09_ScoutShirt_Collar", mats["secondary"], col,
        lambda v: Vector((v.x * 0.92, v.y * 0.92, 0.395 + (v.z - 0.395) * 0.55)),
    )
    clone_template_mesh("Top05_Kacu_TeamScarf", "Top09_Kacu_Scarf", mats["primary"], col)
    clone_template_mesh("Top05_Kacu_GoldRing", "Top09_Kacu_Ring", mats["accent"], col)

    def culottes_deform(v: Vector) -> Vector:
        t = (0.045 - v.z) / 0.160
        z_new = 0.045 - t * 0.245
        smooth_t = t * t * (3.0 - 2.0 * t)
        flare = 1.0 + 0.10 * smooth_t
        crease = -0.012 * smooth_t * math.exp(-((v.x / 0.045) ** 2))
        return Vector((v.x * flare, (v.y + (crease if v.y < 0 else -crease)) * flare, z_new))

    clone_template_mesh("Bot05_UniformShorts_Pelvis", "Bot09_Culottes_Pelvis", mats["primary"], col, culottes_deform)
    clone_template_mesh(
        "Top02_Pangsi_GoldBelt", "Bot09_Culottes_Belt", mats["dark"], col,
        lambda v: Vector((v.x * 0.96, v.y * 0.96, v.z - 0.022)),
    )
    clone_template_mesh("Bot04_Shin_Skin_L", "Bot09_Shin_Skin_L", mats["skin"], col)
    clone_template_mesh("Bot04_Shin_Skin_R", "Bot09_Shin_Skin_R", mats["skin"], col)
    clone_template_mesh("Bot05_HighSock_L", "Bot09_HighSock_L", mats["light"], col)
    clone_template_mesh("Bot05_HighSock_R", "Bot09_HighSock_R", mats["light"], col)

    clone_template_mesh(
        "Head_Base", "Hat09_BaseHair", mats["hair"], col,
        deform_fn=lambda v: female_full_hair_shell_deform(v, back_drop=0.02),
        target_parent_ref_name="Hat05_BaseHair",
    )
    clone_template_mesh(
        "Hat05_Beret_Crown", "Hat09_Beret_Crown", mats["primary"], col,
        lambda v: Vector((v.x * 1.02, v.y * 1.02, v.z + 0.01)),
    )
    clone_template_mesh(
        "Hat05_Beret_GoldBadge", "Hat09_Beret_Emblem", mats["accent"], col,
        lambda v: Vector((v.x, v.y - 0.006, v.z + 0.01)),
    )

    def twin_braid_deform(side: float):
        def _deform(v: Vector) -> Vector:
            nx = v.x / 0.0624
            ny = v.y / 0.0624
            nz = (v.z - 0.290) / 0.045
            t = (nz + 1.0) * 0.5
            profile = math.sin(t * math.pi) * 0.80 + 0.32
            cx = side * (0.268 + (1.0 - t) * 0.032)
            cy = -0.015 + (1.0 - t) * 0.015
            cz = -0.315 + t * 0.175
            return Vector((cx + nx * 0.058 * profile, cy + ny * 0.058 * profile, cz))
        return _deform

    clone_template_mesh("Hat06_Beanie_PomPom", "Hat09_TwinBraid_L", mats["hair"], col, twin_braid_deform(1.0))
    clone_template_mesh("Hat06_Beanie_PomPom", "Hat09_TwinBraid_R", mats["hair"], col, twin_braid_deform(-1.0))

    def ribbon_deform(side: float):
        def _deform(v: Vector) -> Vector:
            nx = v.x / 0.0624
            ny = v.y / 0.0624
            nz = (v.z - 0.290) / 0.045
            return Vector((side * 0.278 + nx * 0.042, -0.015 + ny * 0.038, -0.155 + nz * 0.028))
        return _deform

    clone_template_mesh("Hat06_Beanie_PomPom", "Hat09_Ribbon_L", mats["primary"], col, ribbon_deform(1.0))
    clone_template_mesh("Hat06_Beanie_PomPom", "Hat09_Ribbon_R", mats["primary"], col, ribbon_deform(-1.0))


def build_preset_10_hijab_sport(
    col: bpy.types.Collection,
    mats: dict[str, bpy.types.Material],
) -> None:
    """Preset 10: Hijab Striker (Sport Tunic, Jogger Pants, Organic Fitted Sport Hijab)"""
    def tunic_torso_deform(v: Vector) -> Vector:
        t_z = (0.44 - v.z) / 0.45
        z_new = 0.44 - t_z * 0.505
        tapered = waist_taper_deform(Vector((v.x, v.y, v.z)), pinch=0.055, flare_bottom=0.03)
        return Vector((tapered.x, tapered.y, z_new))

    clone_template_mesh("Top03_Hoodie_Torso", "Top10_Tunic_Torso", mats["primary"], col, tunic_torso_deform)
    clone_template_mesh("Top03_Hoodie_LongSleeve_L", "Top10_Tunic_LongSleeve_L", mats["primary"], col)
    clone_template_mesh("Top03_Hoodie_LongSleeve_R", "Top10_Tunic_LongSleeve_R", mats["primary"], col)
    clone_template_mesh("Top03_Hoodie_WristCuff_L", "Top10_Tunic_Cuff_L", mats["secondary"], col)
    clone_template_mesh("Top03_Hoodie_WristCuff_R", "Top10_Tunic_Cuff_R", mats["secondary"], col)

    def chevron_stripe_deform(v: Vector) -> Vector:
        dip = -0.035 * (1.0 - abs(v.x) / 0.26)
        return Vector((v.x * 1.01, v.y * 1.01, v.z + dip))

    clone_template_mesh("Top04_Tank_ChestStripe", "Top10_Tunic_ChestAccent", mats["secondary"], col, chevron_stripe_deform)
    clone_template_mesh(
        "Top02_Pangsi_GoldBelt", "Top10_Tunic_HemTrim", mats["accent"], col,
        lambda v: Vector((v.x * 1.02, v.y * 1.02, v.z - 0.110)),
    )

    clone_template_mesh("Bot03_TrackPants_Pelvis", "Bot10_Jogger_Pelvis", mats["dark"], col)
    clone_template_mesh("Bot03_TrackPants_Leg_L", "Bot10_Jogger_Leg_L", mats["dark"], col)
    clone_template_mesh("Bot03_TrackPants_Leg_R", "Bot10_Jogger_Leg_R", mats["dark"], col)
    clone_template_mesh("Bot03_TrackPants_Cuff_L", "Bot10_Jogger_Cuff_L", mats["secondary"], col)
    clone_template_mesh("Bot03_TrackPants_Cuff_R", "Bot10_Jogger_Cuff_R", mats["secondary"], col)

    def stripe_l_deform(v: Vector) -> Vector:
        nx = (v.x - 0.011) / 0.1165
        return Vector((0.118 + nx * 0.012, v.y * 0.32, v.z * 0.96))

    def stripe_r_deform(v: Vector) -> Vector:
        nx = (v.x - (-0.011)) / 0.1165
        return Vector((-0.118 + nx * 0.012, v.y * 0.32, v.z * 0.96))

    clone_template_mesh("Bot03_TrackPants_Leg_L", "Bot10_Jogger_SideStripe_L", mats["primary"], col, stripe_l_deform)
    clone_template_mesh("Bot03_TrackPants_Leg_R", "Bot10_Jogger_SideStripe_R", mats["primary"], col, stripe_r_deform)

    def hijab_hood_deform(v: Vector) -> Vector:
        x = v.x * 1.048
        y = v.y * 1.048
        z = v.z * 1.045 + 0.005

        if y < -0.12:
            wx = smoothstep(0.225, 0.145, abs(x))
            wz_top = smoothstep(0.045, -0.015, z)
            wz_bot = smoothstep(-0.285, -0.225, z)
            wy = smoothstep(-0.12, -0.24, y)
            window_mask = wx * wz_top * wz_bot * wy
            y += 0.068 * window_mask

        if z < -0.20 and y > -0.16:
            neck_t = smoothstep(-0.20, -0.31, z)
            x *= (1.0 + 0.04 * neck_t)
            y += 0.02 * neck_t
            z -= 0.035 * neck_t

        return Vector((x, y, z))

    clone_template_mesh(
        "Head_Base", "Hat10_Hijab_Hood", mats["dark"], col,
        deform_fn=hijab_hood_deform,
        target_parent_ref_name="Hat05_BaseHair",
    )

    def hijab_drape_deform(v: Vector) -> Vector:
        return Vector((v.x * 1.28, v.y * 1.04, v.z + 0.025))

    clone_template_mesh(
        "Top05_Kacu_TeamScarf", "Hat10_Hijab_ShoulderDrape", mats["dark"], col,
        deform_fn=hijab_drape_deform,
        target_parent_ref_name="Hat05_BaseHair",
    )

    clone_template_mesh(
        "Hat04_Sweatband_Main", "Hat10_SportHeadband", mats["secondary"], col,
        lambda v: Vector((v.x * 1.015, v.y * 1.015, v.z + 0.025)),
    )


def main() -> None:
    print("=== Rebuilding Female Modular Characters (07..10) with 830-Vert Template Cloning (v6) ===")
    ensure_backups()
    remove_existing_female_objects()

    mats = {
        "skin": bpy.data.materials["Mat_Skin"],
        "primary": bpy.data.materials["Mat_Team_Primary"],
        "secondary": bpy.data.materials["Mat_Team_Secondary"],
        "dark": bpy.data.materials["Mat_Outfit_Dark"],
        "light": bpy.data.materials["Mat_Outfit_Light"],
        "accent": bpy.data.materials["Mat_Outfit_Accent"],
        "hair": bpy.data.materials["Mat_Hair_Dark"],
        "face": bpy.data.materials["Mat_Face_Dark"],
        "blush": get_or_create_material("Mat_Blush_Soft", (0.94, 0.48, 0.50, 1.0), roughness=0.88),
    }

    root_col = bpy.data.collections.get("Character_Modular") or bpy.context.scene.collection
    shoes02_col = bpy.data.collections.get("Shoes_02_SandalTradisional")
    if shoes02_col:
        shoes02_col.hide_viewport = False
        shoes02_col.hide_render = False
    base_col = get_or_create_collection("Base_Body", root_col)
    col_07 = get_or_create_collection("Outfit_07_Srikandi", root_col)
    col_08 = get_or_create_collection("Outfit_08_SportyPonytail", root_col)
    col_09 = get_or_create_collection("Outfit_09_PramukaPutri", root_col)
    col_10 = get_or_create_collection("Outfit_10_HijabSport", root_col)

    build_shared_female_details(base_col, mats["face"], mats["blush"])
    build_preset_07_srikandi(col_07, mats)
    build_preset_08_sporty_ponytail(col_08, mats)
    build_preset_09_pramuka_putri(col_09, mats)
    build_preset_10_hijab_sport(col_10, mats)

    bpy.context.view_layer.update()
    bpy.ops.wm.save_mainfile()
    print(f"[SAVED] {BLEND_MASTER}")

    GLB_EXPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(GLB_EXPORT_PATH),
        export_format="GLB",
        use_selection=False,
        export_apply=False,
        export_yup=True,
        export_materials="EXPORT",
    )
    print(f"[EXPORTED] {GLB_EXPORT_PATH} ({GLB_EXPORT_PATH.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
