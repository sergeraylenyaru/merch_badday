# Human characters

Derived from Quaternius Casual2 (male) and Casual (female), CC0-1.0. Complete source URLs, pinned mirrors and the reproducible Blender command are in `art/quaternius/README.md` in the repository. License text is included beside these GLBs.

`merch-male.glb`: rust jacket with long sleeves and a folded hood, charcoal trousers, canvas backpack with two shoulder straps, adapted to the four user-provided concept sheets. `civilian-female.glb`: teal shirt, dark trousers, brown hair. Both use real skinned human meshes with independent finger bones, not the earlier sphere/cylinder figures. The runtime normalizes standing height to 2.1 world units. The hero URL carries `rig=5`; the female model keeps `rig=4`. This prevents reuse of older cached geometry. The 18 recorded clips and authored palm/foot/backpack transforms are preserved. Rebuild the concept outfit with `scripts/style-concept-hero.py`. Bat and baton swings use keyframed weapon poses and two-bone arm IK in `src/visuals/weapon-rig.js` and `character-motion.js`.

Eighteen recorded CC0 UAL clips are embedded: Idle, Walk, Run (jog), Sprint, Crouch, CrouchWalk, Push, Jump, Fall, Land, Punch, StrongPunch, Drive, Talk, Interact, PickUp, Fixing and WalkFormal. The runtime blends clips, adjusts playback speed to actual movement and applies ground-contact correction. Two-hand IK follows cart handles and the sides of carried cartons while recorded walking continues; PalmGrip and CartHandle anchors use real world transforms. AnimationMixer instances are independent per character and are stopped/uncached when the visual layer is disposed.

These are independent CC0 characters and animation clips. No GTA game models or animation files are included.

`police-officer.glb`: Quaternius Swat (CC0-1.0), a separate skinned police
uniform model with 18 recorded animations. Pinned source and rebuild command:
`art/quaternius/README.md`, `scripts/import-police.py`. The included CC0 license applies.

## Additional people

`civilian-stocky.glb`, `civilian-short.glb`, `civilian-tall.glb`,
`civilian-elder.glb`, `civilian-bandit.glb`: adaptations of Quaternius Worker,
Casual, Suit, Farmer and Punk, CC0-1.0. All five have real skinned meshes and the
18 recorded animation clips used by the game. They have distinct standing
heights and body shapes. Original assets, exact source commit, license mapping
and rebuild command are documented in `art/quaternius/README.md`.
