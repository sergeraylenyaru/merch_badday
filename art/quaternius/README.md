# CC0 human model sources

Artist: Quaternius. All models and animation data used here are CC0-1.0.

- `male-casual.glb`: **Casual2**, Ultimate Modular Men Pack. [Artist's catalog and CC0 statement](https://quaternius.com/packs/ultimatemodularcharacters.html).
- `female-casual.glb`: **Casual**, Ultimate Modular Women Pack. [Artist's catalog and CC0 statement](https://quaternius.com/packs/ultimatemodularwomen.html).

The GLB copies were obtained from [trebeljahr/quaternius-showcase](https://github.com/trebeljahr/quaternius-showcase), commit `722c39e964360beff2728a8ee4d103e2d11d457c`, paths `public/glb/modular_men/Casual2.glb` and `public/glb/modular_women/Casual.glb`. The mirror's LICENSES.md identifies these exact packs as CC0; this was checked against the artist's catalog pages in Quaternius/quaternius.github.io. The showcase code's MIT license is not used as a model license.

Animation source: **Quaternius Universal Animation Library Standard**, [artist's catalog](https://quaternius.com/packs/universalanimationlibrary.html). The source FBX was obtained from [IAFahim/quaternius.universalAnimationLibrary.standard](https://github.com/IAFahim/quaternius.universalAnimationLibrary.standard), commit `8456155dbae7eb861f553a2341871ccae633c857`, `UAL1_Standard.fbx`. Its complete CC0 license accompanies this file. The 24 MB source FBX is not duplicated in this repository; selected recorded clips are retargeted and embedded in the runtime GLBs.

## Rebuild

Install Blender 4.3+. Obtain the pinned CC0 FBX through Git:

```sh
git clone --filter=blob:none --no-checkout https://github.com/IAFahim/quaternius.universalAnimationLibrary.standard.git /tmp/merch-animation-library
git -C /tmp/merch-animation-library fetch --depth 1 origin 8456155dbae7eb861f553a2341871ccae633c857
git -C /tmp/merch-animation-library checkout 8456155dbae7eb861f553a2341871ccae633c857 -- UAL1_Standard.fbx
blender --background --threads 2 --python-exit-code 1 --python scripts/import-human-characters.py -- --animations /tmp/merch-animation-library/UAL1_Standard.fbx
```

The script recolors real mesh materials, adds a structured backpack, maps the skeleton to the game's visual joint names, retargets selected recorded UAL animation tracks, removes horizontal root motion, and exports self-contained GLBs into `public/models/characters/`. It does not execute code from the model files. No textures or external URLs are requested during gameplay.
