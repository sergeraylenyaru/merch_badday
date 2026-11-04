// Adapted from iskan-k/aktobe-2000s, Copyright (c) 2026 Iskander Kinzhibayev. MIT; see LICENSE.
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
export function withInside(g) {
  const inner = g.clone();
  const idx = inner.index.array;
  for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
  const n = inner.attributes.normal.array;
  for (let i = 0; i < n.length; i++) n[i] = -n[i];
  return mergeGeometries([g, inner]);
}
