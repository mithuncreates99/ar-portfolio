// Post-process: drop the optional skin.skeleton reference (validator error), then resample/prune/dedup.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { resample, prune, dedup } from '@gltf-transform/functions';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(process.argv[2]);
doc.getRoot().listSkins().forEach(s => s.setSkeleton(null));
await doc.transform(resample({ tolerance: 0.0002 }), prune(), dedup());
await io.write(process.argv[3], doc);
console.log('written', process.argv[3]);
