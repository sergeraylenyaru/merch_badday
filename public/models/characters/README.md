# Human characters

Derived from Quaternius Casual2 (male) and Casual (female), CC0-1.0. Complete source URLs, pinned mirrors and the reproducible Blender command are in `art/quaternius/README.md` in the repository. License text is included beside these GLBs.

`merch-male.glb`: blue T-shirt, black trousers, black structured backpack with two shoulder straps. `civilian-female.glb`: teal shirt, dark trousers, brown hair. Both use real skinned human meshes with independent finger bones, not the earlier sphere/cylinder figures. The runtime normalizes standing height to 2.1 world units. Model URLs carry `rig=4` to avoid reusing an older browser-cached rig.

Eighteen recorded CC0 UAL clips are embedded: Idle, Walk, Run (jog), Sprint, Crouch, CrouchWalk, Push, Jump, Fall, Land, Punch, StrongPunch, Drive, Talk, Interact, PickUp, Fixing and WalkFormal. The runtime blends clips, adjusts playback speed to actual movement and applies ground-contact correction. Two-hand IK follows cart handles and the sides of carried cartons while recorded walking continues; PalmGrip and CartHandle anchors use real world transforms. AnimationMixer instances are independent per character and are stopped/uncached when the visual layer is disposed.

These are independent CC0 characters and animation clips. No GTA game models or animation files are included.

`police-officer.glb`: Quaternius Swat (CC0-1.0), a separate skinned police
uniform model with 18 recorded animations. Pinned source and rebuild command:
`art/quaternius/README.md`, `scripts/import-police.py`. The included CC0 license applies.
