"""Converts the baked glTF to USDZ for iPhone AR Quick Look (Blender as the converter)."""
import bpy, sys
src, dst = sys.argv[-2], sys.argv[-1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
sc = bpy.context.scene
sc.render.fps = 24
sc.frame_start = 0
sc.frame_end = 30 * 24
acts = [a.name for a in bpy.data.actions]
print('actions', len(acts), acts[:3])
print('objects', len(bpy.data.objects), 'armatures', [o.name for o in bpy.data.objects if o.type == 'ARMATURE'])
bpy.ops.wm.usd_export(filepath=dst, export_animation=True, export_armatures=True, only_deform_bones=False,
    export_materials=True, generate_preview_surface=True, export_textures_mode='NEW', overwrite_textures=True,
    convert_orientation=True, export_global_forward_selection='NEGATIVE_Z', export_global_up_selection='Y',
    export_lights=False, export_cameras=False, triangulate_meshes=True, root_prim_path='/root',
    accessibility_label='Mithun Kumar Vijayakumar - AR portfolio',
    accessibility_description='An animated display of Mithun Kumar Vijayakumar\'s portfolio: about, education, skills, projects, awards and contact.')
print('exported', dst)
