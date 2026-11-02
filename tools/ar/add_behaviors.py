"""Adds AR Quick Look tap interactions to the USDZ exported by to_usdz.py.

Usage: python add_behaviors.py IN.usdz OUT.usdz INFO.json   (needs `pip install usd-core`)

- Tap a section: it glides to the front of the display, 1.6x larger (any other open section glides back).
- Tap it again: it glides back to its place.
- The reveal plays once when the scene appears, then only the idle part (bobbing, waving) loops,
  so the intro doesn't restart while someone is reading.

Uses Apple's preliminary behaviour schemas (Preliminary_Behavior / _Trigger / _Action) in the same layout
that Reality Composer exports: /Root/Scenes/Scene (sceneLibrary, plane anchoring) with a Behaviors scope.
"""
import json, os, shutil, sys, tempfile, zipfile
from pxr import Sdf, Usd, UsdGeom, UsdUtils, Kind

SRC, DST, INFO = sys.argv[1], sys.argv[2], sys.argv[3]
info = json.load(open(INFO))
SECTIONS = ['about', 'education', 'skills', 'projects', 'awards', 'connect']
MOVE = 0.6            # seconds for the glide in / out

work = tempfile.mkdtemp(prefix='qlbeh_')
with zipfile.ZipFile(SRC) as z:
    z.extractall(work)
root_layer = next(os.path.join(work, n) for n in os.listdir(work) if n.endswith(('.usdc', '.usda')))
stage = Usd.Stage.Open(root_layer)

scene = stage.GetPrimAtPath('/Root/Scenes/Scene')
assert scene, 'expected the export under /Root/Scenes/Scene'
stage.SetDefaultPrim(stage.GetPrimAtPath('/Root'))
Usd.ModelAPI(stage.GetPrimAtPath('/Root/Scenes')).SetKind('sceneLibrary')

# plane anchoring on the scene (horizontal floor / table)
scene.SetMetadata('apiSchemas', Sdf.TokenListOp.Create(prependedItems=['Preliminary_AnchoringAPI']))
scene.SetCustomDataByKey('sceneName', 'Scene')
scene.SetCustomDataByKey('preliminary_collidesWithEnvironment', False)
scene.CreateAttribute('preliminary:anchoring:type', Sdf.ValueTypeNames.Token, variability=Sdf.VariabilityUniform).Set('plane')
scene.CreateAttribute('preliminary:planeAnchoring:alignment', Sdf.ValueTypeNames.Token, variability=Sdf.VariabilityUniform).Set('horizontal')

def find(name):
    hits = [p for p in stage.Traverse() if p.GetName() == name]
    assert len(hits) == 1, f'{name}: {len(hits)} matches'
    return hits[0].GetPath()

P = {k: {n: find(f'{n}_{k}') for n in ('Focus', 'TapOpen', 'TapClose', 'FocusTarget', 'HomeTarget')} for k in SECTIONS}
ANIM_ROOT = find('ARPortfolio')

# ---------- writing helpers ----------
def attr(prim, name, typ, value, uniform=False):
    prim.CreateAttribute(name, typ, variability=Sdf.VariabilityUniform if uniform else Sdf.VariabilityVarying).Set(value)

def rel(prim, name, targets):
    prim.CreateRelationship(name).SetTargets(targets)

def action(parent, name, kind, **kw):
    a = stage.DefinePrim(parent.GetPath().AppendChild(name), 'Preliminary_Action')
    attr(a, 'info:id', Sdf.ValueTypeNames.Token, kind)
    if 'targets' in kw: rel(a, 'affectedObjects', kw['targets'])
    if kind == 'Transform':
        attr(a, 'duration', Sdf.ValueTypeNames.Double, kw['duration'])
        attr(a, 'easeType', Sdf.ValueTypeNames.Token, 'inout')
        attr(a, 'type', Sdf.ValueTypeNames.Token, 'absolute')
        rel(a, 'xformTarget', [kw['to']])
    elif kind == 'Visibility':
        attr(a, 'duration', Sdf.ValueTypeNames.Double, 0.0)
        attr(a, 'easeType', Sdf.ValueTypeNames.Token, 'none')
        attr(a, 'motionType', Sdf.ValueTypeNames.Token, 'none')
        attr(a, 'moveDistance', Sdf.ValueTypeNames.Double, 0.0)
        attr(a, 'style', Sdf.ValueTypeNames.Token, 'basic')
        attr(a, 'type', Sdf.ValueTypeNames.Token, kw['mode'])
    elif kind == 'StartAnimation':
        attr(a, 'start', Sdf.ValueTypeNames.Double, kw['start'])          # seconds
        attr(a, 'duration', Sdf.ValueTypeNames.Double, kw['duration'])    # seconds
        attr(a, 'animationSpeed', Sdf.ValueTypeNames.Double, 1.0)
        attr(a, 'reversed', Sdf.ValueTypeNames.Bool, False)
        attr(a, 'reverses', Sdf.ValueTypeNames.Bool, False)
        attr(a, 'multiplePerformOperation', Sdf.ValueTypeNames.Token, 'allow')
    return a

def group(parent, name, kind='parallel', loops=False):
    g = stage.DefinePrim(parent.GetPath().AppendChild(name), 'Preliminary_Action')
    attr(g, 'info:id', Sdf.ValueTypeNames.Token, 'Group')
    attr(g, 'loops', Sdf.ValueTypeNames.Bool, loops)
    attr(g, 'performCount', Sdf.ValueTypeNames.Int, 0 if loops else 1)
    attr(g, 'type', Sdf.ValueTypeNames.Token, kind)
    return g

def finish_group(g):
    kids = [c.GetPath() for c in g.GetChildren() if c.GetTypeName() == 'Preliminary_Action']
    rel(g, 'actions', kids)

def behavior(name, trigger_kind, trigger_targets=None, trigger_type=None):
    b = stage.DefinePrim(behaviors.GetPath().AppendChild(name), 'Preliminary_Behavior')
    t = stage.DefinePrim(b.GetPath().AppendChild('Trigger'), 'Preliminary_Trigger')
    attr(t, 'info:id', Sdf.ValueTypeNames.Token, trigger_kind)
    if trigger_targets: rel(t, 'affectedObjects', trigger_targets)
    if trigger_type: attr(t, 'type', Sdf.ValueTypeNames.Token, trigger_type)
    rel(b, 'triggers', [t.GetPath()])
    attr(b, 'exclusive', Sdf.ValueTypeNames.Bool, False, uniform=True)
    return b

# the tap areas must be invisible (and have a surface Quick Look understands)
from pxr import UsdShade, Gf
for m in [p for p in stage.Traverse() if p.IsA(UsdShade.Material) and p.GetName().startswith('TapArea')]:
    mat = UsdShade.Material(m)
    for c in list(m.GetChildren()):
        stage.RemovePrim(c.GetPath())
    sh = UsdShade.Shader.Define(stage, m.GetPath().AppendChild('Surface'))
    sh.CreateIdAttr('UsdPreviewSurface')
    sh.CreateInput('diffuseColor', Sdf.ValueTypeNames.Color3f).Set(Gf.Vec3f(1, 1, 1))
    sh.CreateInput('opacity', Sdf.ValueTypeNames.Float).Set(0.0)
    sh.CreateInput('opacityThreshold', Sdf.ValueTypeNames.Float).Set(0.5)   # cut-out: never drawn, still tappable
    sh.CreateInput('roughness', Sdf.ValueTypeNames.Float).Set(1.0)
    mat.CreateSurfaceOutput().ConnectToSource(sh.ConnectableAPI(), 'surface')

behaviors = stage.DefinePrim(scene.GetPath().AppendChild('Behaviors'), 'Scope')

# ---------- scene start: hide the "close" tap areas, play the reveal once, then loop the idle part ----------
b = behavior('SceneStart', 'SceneTransition', trigger_type='enter')
g = group(b, 'Start', 'parallel')
for k in SECTIONS:
    action(g, f'HideClose_{k}', 'Visibility', targets=[P[k]['TapClose']], mode='hide')
seq = group(g, 'Play', 'serial')
intro_end = round(float(info['introEnd']), 2)
action(seq, 'Intro', 'StartAnimation', targets=[ANIM_ROOT], start=0.0, duration=intro_end)
idle = group(seq, 'Idle', 'serial', loops=True)
action(idle, 'IdleLoop', 'StartAnimation', targets=[ANIM_ROOT], start=intro_end, duration=float(info['duration']) - intro_end)
finish_group(idle); finish_group(seq); finish_group(g)
rel(b, 'actions', [g.GetPath()])

# ---------- tap a section: open it (and close any other); tap again: close it ----------
for k in SECTIONS:
    b = behavior(f'Open_{k}', 'TapGesture', [P[k]['TapOpen']])
    g = group(b, 'Open', 'parallel')
    action(g, 'Move', 'Transform', targets=[P[k]['Focus']], to=P[k]['FocusTarget'], duration=MOVE)
    action(g, 'HideOpen', 'Visibility', targets=[P[k]['TapOpen']], mode='hide')
    action(g, 'ShowClose', 'Visibility', targets=[P[k]['TapClose']], mode='show')
    for j in SECTIONS:
        if j == k: continue
        action(g, f'Back_{j}', 'Transform', targets=[P[j]['Focus']], to=P[j]['HomeTarget'], duration=MOVE)
        action(g, f'HideClose_{j}', 'Visibility', targets=[P[j]['TapClose']], mode='hide')
        action(g, f'ShowOpen_{j}', 'Visibility', targets=[P[j]['TapOpen']], mode='show')
    finish_group(g); rel(b, 'actions', [g.GetPath()])

    b = behavior(f'Close_{k}', 'TapGesture', [P[k]['TapClose']])
    g = group(b, 'Close', 'parallel')
    action(g, 'Move', 'Transform', targets=[P[k]['Focus']], to=P[k]['HomeTarget'], duration=MOVE)
    action(g, 'HideClose', 'Visibility', targets=[P[k]['TapClose']], mode='hide')
    action(g, 'ShowOpen', 'Visibility', targets=[P[k]['TapOpen']], mode='show')
    finish_group(g); rel(b, 'actions', [g.GetPath()])

stage.GetRootLayer().Save()

# ---------- repackage ----------
tmp_out = os.path.join(work, 'out.usdz')
ok = UsdUtils.CreateNewARKitUsdzPackage(Sdf.AssetPath(root_layer), tmp_out)
assert ok, 'packaging failed'
shutil.copy(tmp_out, DST)
shutil.rmtree(work, ignore_errors=True)
check = Usd.Stage.Open(DST)
n = sum(1 for p in check.Traverse() if p.GetTypeName().startswith('Preliminary_'))
print(f'behaviours added: {n} prims, intro {intro_end}s then idle loop -> {DST}')
