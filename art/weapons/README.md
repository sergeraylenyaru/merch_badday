# Equipment source assets

- `pistol-source.glb`: Quaternius **Survival Pack / Pistol_1.glb**, CC0.
  https://github.com/trebeljahr/quaternius-showcase/blob/722c39e964360beff2728a8ee4d103e2d11d457c/public/glb/survival_pack/Pistol_1.glb
- `kenney-blaster/blaster-a.glb` and its original `Textures/colormap.png`:
  Kenney **Blaster Kit**, CC0.
  https://github.com/shorepine/kenney/tree/3694c6879e487c108f55677be7dd2ca75b07cc3b/3d/blaster
- `kenney-survival/tree-log-small.glb` and its original `Textures/colormap.png`:
  Kenney **Survival Kit**, CC0.
  https://github.com/shorepine/kenney/tree/3694c6879e487c108f55677be7dd2ca75b07cc3b/3d/survival
- The security vest is extracted from the already attributed original
  `../quaternius/police-swat.glb`, Quaternius Ultimate Animated Character Pack,
  CC0; see `../quaternius/README.md`.

`KENNEY-README.md` preserves the pinned collection's explicit statement that
all its art is Kenney's and released under CC0. `KENNEY-LICENSE.txt` is the
collection's original license file (its heading names Castle Kit; the
collection README explicitly applies CC0 to all art). `LICENSE.txt` is the
full CC0 text distributed with the project's Quaternius assets.

Rebuild from the repository root with Blender 4.3:

    blender -b --python scripts/import-equipment.py

The import script converts the pistol to a palm-centred +Z barrel, adds muzzle
markers, reshapes/recolours the Kenney toy blaster with a water reservoir and
orange nozzle, reshapes the irregular log into a hand-held branch, and extracts
and fits SWAT chest armour. It also authors an original rounded ash baseball
bat with a wrapped grip; the baseball bat is **project-made**, not an external
asset. Internet searches of Kenney Weapon Kit and Quaternius Survival/Medieval
Weapons packs supplied suitable guns and wood, but no suitable baseball bat.
All runtime GLBs embed any required textures; the game makes no vendor requests.

The second equipment revision replaces the adapted blaster with an original,
compact toy water pistol: rounded casing, straight barrel, palm-centred grip,
trigger guard and oval water tank. The archived Kenney blaster remains as the
source of the previous revision. The current `water-pistol.glb` is project art.

The builder's shovel comes from Kenney Survival Kit `tool-shovel.glb`, at the
same pinned collection commit as the log. The source and original colormap are
stored together under `kenney-survival/`; the import script enlarges the tool to
1.16 m and places the grip at the palm origin. It is also the dropped/player model.
