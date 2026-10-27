# Original road vehicles

`suv.glb`, `van.glb` and `truck.glb` are original low-poly meshes authored for this project, released under CC0-1.0. They do not use downloaded vehicle geometry, textures or trademarks. Each has mirrors, lamps, glazing, handles, trim, independently rolling tyre/rim pivots and opening cab-door pivots. The truck has three axles; its cargo box and the van's sliding-panel body differ from the SUV cabin.

Rebuild with Blender 4.3+:

```sh
blender --background --threads 2 --python-exit-code 1 --python scripts/create-vehicles.py
```

The script reuses primitive construction helpers from `scripts/create-visual-models.py`. The GLBs are self-contained. Runtime bounds determine each vehicle's oriented collision footprint and door positions; they are not separate decorative car shells.
