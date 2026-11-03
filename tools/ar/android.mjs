// Android (Google Scene Viewer) copy of the AR model, following Google's model requirements:
// textures at most 2048 px, and without the iPhone-only tap areas and focus targets (fewer alpha materials).
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup } from '@gltf-transform/functions';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(process.argv[2]);
let removed = 0;
for (const node of doc.getRoot().listNodes()) {
  if (/^(TapOpen|TapClose|FocusTarget|HomeTarget)_/.test(node.getName())) { node.dispose(); removed++; }
}
await doc.transform(prune({ keepLeaves: false }), dedup());
await io.write(process.argv[3], doc);
console.log('android: removed', removed, 'iPhone-only nodes ->', process.argv[3]);
