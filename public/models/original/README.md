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
| `merch-hero.glb` | 1.241 × 2.440 × 0.678 | 37 | Cap, face, embroidered patches, badge, watch, satchel, cargo pockets and shoes |
| `store-staff.glb` | 1.241 × 2.440 × 0.775 | 36 | Teal uniform, badge and tied hair; matching visual scale |
| `shopping-cart.glb` | 1.204 × 1.620 × 1.750 | 15 | Tapered wire basket, lower rack, grip anchors, four swivelling casters and independently rolling spoked tyres |

Coordinates are glTF-standard **Y up**, floor at Y ≈ 0, facing **+Z**. Character feet are on the origin plane; the cart tyres begin at Y = 0.005. The cart handle is at the rear (**−Z**).

## Articulated character rig (version 2)

Both characters have the same hierarchy and identity rest rotations in glTF's Y-up coordinate space:

```text
MerchHero / StoreStaff
├─ Spine
│  ├─ Head
│  ├─ LeftArm → LeftElbow → LeftHand → PalmGripLeft
│  └─ RightArm → RightElbow → RightHand → PalmGripRight
├─ LeftLeg → LeftKnee → LeftFoot → FootContactLeft
└─ RightLeg → RightKnee → RightFoot → FootContactRight
```

The spine owns the torso, head, arms and clothing/bag details; the hip roots remain independent so leaning does not rotate planted feet. Hands and shoes are actual joint descendants, with rounded knees/elbows covering the seams. These nodes are animation adapters only: gameplay IDs, health, AI, controls and collisions remain outside the model hierarchy.

| Joint / anchor | Authored world-space rest position (X, Y, Z) |
| --- | --- |
| `Spine` | 0, 1.20, 0 |
| `Head` | 0, 1.94, 0 |
| `LeftLeg` / `RightLeg` | ∓0.174, 1.10, 0 |
| `LeftKnee` / `RightKnee` | ∓0.174, 0.61, 0 |
| `LeftFoot` / `RightFoot` | ∓0.174, 0.19, 0.015 |
| `FootContactLeft` / `FootContactRight` | ∓0.174, 0.02, 0.10 |
| `LeftArm` / `RightArm` | ∓0.415, 1.80, 0 |
| `LeftElbow` / `RightElbow` | ∓0.474, 1.505, 0.015 |
| `LeftHand` / `RightHand` | ∓0.490, 1.235, 0.045 |
| `PalmGripLeft` / `PalmGripRight` | ∓0.490, 1.15, 0.050 |

Left is negative X, right is positive X. `PalmGrip*` lies in the centre of the visible hand, so IK should solve to this anchor rather than merely placing the wrist on a trolley handle. Shoulder-to-elbow length is approximately 0.3012; elbow-to-palm length is approximately 0.3571. Wrist rotation can remain neutral while the two-link IK aims the palm. `FootContact*` marks the white sole at Y=0.02; the rounded black shoe bottom reaches Y≈0.

The loader floor-centres the bounding box. Consequently these authored positions are not already final world positions: for the hero, normalized XZ centring translates the rig by Z≈−0.05625 (staff Z≈−0.00750). Read anchors with `getWorldPosition()` after updating matrices, rather than hard-coding the table as final world-space targets.

## Animated shopping cart

`CartHandleLeft` and `CartHandleRight` are at authored (∓0.42, 1.58, −0.94), on the actual rear handle. With the current visual envelope `[1.2, 1.62, 1.75]`, the normalized positions are approximately (∓0.418605, 1.569767, −0.827243), before the gameplay model's existing +0.05 vertical offset. The rigid body settles near Y=−0.05, cancelling that visual offset on flat ground.

The four `CasterFrontLeft`, `CasterFrontRight`, `CasterRearLeft`, `CasterRearRight` pivots steer about local Y. Each owns its correspondingly named `Wheel*` child, which rolls about local X. Rubber radius is 0.15 authored / approximately 0.149502 normalized. Forks and fixed axle caps follow the caster; visible metal hub spokes follow the rolling tyre, making rolling visible rather than rotating a visually uniform black disc.

Wheel rotation belongs to the visual model and does not introduce extra physical bodies. The existing single cuboid collider, mass, damping and delivery-zone logic remain authoritative.

The cart reuses the existing gameplay collider; its decorative wires and caster details do not create individual physics bodies. Reuse mesh/material resources across clones; dispose the shared asset library after all instances are released.

Verified with Three.js GLTFLoader parsing and Box3 world bounds after export. No compression extension is required. Blender may print a warning about an unavailable optional Draco library, but this script exports ordinary uncompressed glTF geometry.
