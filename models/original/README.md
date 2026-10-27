# Original district models

These three models were authored specifically for **Плохой день мерча**, using the checked-in Blender script [`scripts/create-visual-models.py`](../../../scripts/create-visual-models.py). They contain original geometry and flat PBR materials, with no downloaded meshes, images, animation clips, or font files. The small `MERCH` letter meshes use Blender's built-in text conversion.

The model files and their generating script are provided under **CC0-1.0**: <https://creativecommons.org/publicdomain/zero/1.0/>. Attribution is optional. This dedication covers these new model assets and their script, not the rest of the repository.

Regenerate from the repository root with Blender 4.3 or newer:

```sh
blender --background --python scripts/create-visual-models.py
```

No runtime Blender dependency is needed: the browser loads the committed GLB files. No Draco decoder, texture fetch, or external service is required.

| File | Raw dimensions X × Y × Z | Mesh batches | Details |
| --- | --- | --- | --- |
| `merch-hero.glb` | 1.279 × 2.440 × 0.678 | 27 | Cap, face, embroidered patches, badge, watch, satchel, cargo pockets and shoes |
| `store-staff.glb` | 1.279 × 2.440 × 0.775 | 26 | Teal uniform, badge and tied hair; matching visual scale |
| `shopping-cart.glb` | 1.204 × 1.620 × 1.750 | 4 | Tapered wire basket, lower rack, handle, steel frame and four caster wheels |

Coordinates are glTF-standard **Y up**, floor at Y ≈ 0, facing **+Z**. Character feet are on the origin plane; the cart tyres begin at Y = 0.005. The cart handle is at the rear (**−Z**).

Both character models expose four visual animation pivots: `LeftLeg`, `RightLeg`, `LeftArm`, `RightArm`. Hip pivots are at Y = 1.10, shoulder pivots at Y = 1.80. These nodes are animation adapters only: gameplay IDs, health, AI, control and collision rules remain outside the model hierarchy.

The cart reuses the existing gameplay collider; its decorative wires and caster details do not create individual physics bodies. Reuse mesh/material resources across clones; dispose the shared asset library after all instances are released.

Verified with Three.js GLTFLoader parsing and Box3 world bounds after export. No compression extension is required. Blender may print a warning about an unavailable optional Draco library, but this script exports ordinary uncompressed glTF geometry.
