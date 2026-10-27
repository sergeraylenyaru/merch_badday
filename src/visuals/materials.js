import * as T from "three";

const COLORS = Object.freeze({
  navy: "#183746",
  mustard: "#efbf50",
  terracotta: "#b76d55",
  cream: "#eee5cc",
});

// All texture detail is local and repeatable. Geometry can scale its UVs using
// material.userData.tileMeters without cloning these shared materials.
export function createDistrictMaterials() {
  const textures = new Set();
  const materials = new Set();
  const signs = new Map();
  let disposed = false;

  function random(seed) {
    let value = seed >>> 0;
    return () => {
      value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
      return value / 4294967296;
    };
  }

  function canvas(width = 256, height = width) {
    const element = document.createElement("canvas");
    element.width = width;
    element.height = height;
    return [element, element.getContext("2d")];
  }

  function texture(element, color = true) {
    const map = new T.CanvasTexture(element);
    map.colorSpace = color ? T.SRGBColorSpace : T.NoColorSpace;
    map.wrapS = map.wrapT = T.RepeatWrapping;
    map.anisotropy = 4;
    textures.add(map);
    return map;
  }

  function surface({ base, grain = 7, seed = 1, paint, roughness = 0.9 }) {
    const [element, context] = canvas();
    context.fillStyle = base;
    context.fillRect(0, 0, 256, 256);
    const pixels = context.getImageData(0, 0, 256, 256);
    const rng = random(seed);
    for (let index = 0; index < pixels.data.length; index += 4) {
      const variation = (rng() - 0.5) * grain;
      pixels.data[index] += variation;
      pixels.data[index + 1] += variation;
      pixels.data[index + 2] += variation;
    }
    context.putImageData(pixels, 0, 0);
    paint?.(context, rng);

    // A separate, linear roughness map adds restrained highlights to stone and
    // metal without introducing normals or additional geometry.
    const [roughCanvas, roughContext] = canvas(128);
    const roughPixels = roughContext.createImageData(128, 128);
    const roughRng = random(seed + 97);
    for (let index = 0; index < roughPixels.data.length; index += 4) {
      const value = Math.round(roughness * 255 + (roughRng() - 0.5) * 9);
      roughPixels.data[index] = value;
      roughPixels.data[index + 1] = value;
      roughPixels.data[index + 2] = value;
      roughPixels.data[index + 3] = 255;
    }
    roughContext.putImageData(roughPixels, 0, 0);
    return { map: texture(element), roughnessMap: texture(roughCanvas, false) };
  }

  function standard(parameters, tileMeters) {
    const material = new T.MeshStandardMaterial(parameters);
    if (tileMeters) material.userData.tileMeters = tileMeters;
    materials.add(material);
    return material;
  }

  const asphalt = standard({
    ...surface({
      base: "#505b59", grain: 18, seed: 13, roughness: 0.96,
      paint(context, rng) {
        for (let index = 0; index < 1500; index++) {
          context.fillStyle = index % 3 === 0
            ? "rgba(207,204,179,0.16)" : "rgba(24,38,38,0.16)";
          const x = Math.floor(rng() * 256), y = Math.floor(rng() * 256);
          context.fillRect(x, y, 1 + (index % 2), 1);
        }
      },
    }),
    roughness: 1,
  }, 6);

  function tiles(base, joint, seed, size = 64, stagger = false) {
    return surface({
      base, grain: 9, seed, roughness: 0.91,
      paint(context, rng) {
        for (let row = 0; row < 256 / size; row++) {
          for (let column = -1; column <= 256 / size; column++) {
            const x = column * size + (stagger && row % 2 ? size / 2 : 0);
            const y = row * size;
            context.fillStyle = `rgba(255,250,230,${0.025 + rng() * 0.04})`;
            context.fillRect(x + 2, y + 2, size - 3, size - 3);
            context.fillStyle = joint;
            context.fillRect(x, y, size, 1.5);
            context.fillRect(x, y, 1.5, size);
            context.fillStyle = "rgba(255,250,230,0.16)";
            context.fillRect(x + 2, y + 2, size - 3, 1);
          }
        }
      },
    });
  }

  const pavement = standard({
    ...tiles("#b5b6a7", "rgba(78,87,79,0.48)", 25, 64, true),
    roughness: 1,
  }, 4);

  const floor = standard({
    ...tiles("#d0c8b2", "rgba(105,107,93,0.38)", 37),
    roughness: 0.88,
  }, 4);

  const plaster = standard({
    ...surface({ base: "#d9d2be", grain: 7, seed: 41, roughness: 0.98 }),
    roughness: 1,
  }, 4);

  const brick = standard({
    ...surface({
      base: "#a86d57", grain: 12, seed: 63, roughness: 0.97,
      paint(context, rng) {
        for (let row = 0; row < 8; row++) {
          for (let column = -1; column < 5; column++) {
            const x = column * 64 + (row % 2 ? 32 : 0), y = row * 32;
            context.fillStyle = `rgba(248,210,168,${rng() * 0.13})`;
            context.fillRect(x + 2, y + 2, 61, 29);
            context.fillStyle = "rgba(211,198,172,0.76)";
            context.fillRect(x, y, 64, 2);
            context.fillRect(x, y, 2, 32);
            context.fillStyle = "rgba(56,39,31,0.12)";
            context.fillRect(x + 2, y + 2, 61, 1);
          }
        }
      },
    }),
    roughness: 1,
  }, 3.2);

  const roof = standard({
    ...surface({
      base: "#64716a", grain: 8, seed: 79, roughness: 0.78,
      paint(context) {
        for (let x = 0; x < 256; x += 32) {
          context.fillStyle = "rgba(27,46,42,0.35)";
          context.fillRect(x, 0, 2, 256);
          context.fillStyle = "rgba(227,232,208,0.18)";
          context.fillRect(x + 2, 0, 1, 256);
        }
      },
    }),
    roughness: 0.86, metalness: 0.2,
  }, 6);

  const metal = standard({
    ...surface({ base: "#b3bbb1", grain: 5, seed: 83, roughness: 0.66 }),
    roughness: 0.78, metalness: 0.45,
  }, 2);

  const wood = standard({
    ...surface({
      base: "#a9875b", grain: 6, seed: 101, roughness: 0.88,
      paint(context) {
        for (let x = 0; x < 256; x += 3) {
          context.strokeStyle = `rgba(76,51,31,${0.035 + (x % 7) * 0.006})`;
          context.lineWidth = x % 4 ? 1 : 2;
          context.beginPath();
          for (let y = 0; y <= 256; y += 8) {
            const wave = Math.sin(y / 256 * Math.PI * 2 + x * 0.1) * 1.4;
            if (y === 0) context.moveTo(x + wave, y);
            else context.lineTo(x + wave, y);
          }
          context.stroke();
        }
      },
    }),
    roughness: 0.95,
  }, 2);

  function makeSignMaterial(text, options = {}) {
    const {
      background = COLORS.navy,
      color = COLORS.cream,
      accent = COLORS.mustard,
      subtitle = "",
    } = options;
    const key = JSON.stringify([String(text), background, color, accent, subtitle]);
    if (signs.has(key)) return signs.get(key);
    const [element, context] = canvas(1024, 256);
    context.fillStyle = background;
    context.fillRect(0, 0, 1024, 256);
    context.fillStyle = accent;
    context.fillRect(24, 22, 976, 3);
    context.fillRect(24, 231, 976, 3);
    context.fillRect(27, 110, 10, 36);
    context.fillRect(987, 110, 10, 36);
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = color;
    let size = subtitle ? 91 : 106;
    const title = String(text).toUpperCase();
    context.font = `700 ${size}px sans-serif`;
    if (context.measureText(title).width > 890) {
      size *= 890 / context.measureText(title).width;
      context.font = `700 ${Math.floor(size)}px sans-serif`;
    }
    context.fillText(title, 512, subtitle ? 108 : 133);
    if (subtitle) {
      context.fillStyle = accent;
      context.font = "500 27px sans-serif";
      context.fillText(String(subtitle).toUpperCase(), 512, 184, 880);
    }
    const map = texture(element);
    map.wrapS = map.wrapT = T.ClampToEdgeWrapping;
    const material = new T.MeshBasicMaterial({ map, toneMapped: false });
    materials.add(material);
    signs.set(key, material);
    return material;
  }

  const result = {
    asphalt,
    pavement,
    plaster,
    brick,
    roof,
    floor,
    metal,
    wood,
    darkMetal: standard({ color: "#344743", roughness: 0.7, metalness: 0.5 }),
    glass: standard({
      color: "#77999b", roughness: 0.2, metalness: 0.22,
      transparent: true, opacity: 0.46, depthWrite: false,
    }),
    leaf: standard({ color: "#6f8260", roughness: 0.96 }),
    marking: standard({ color: "#eee1b6", roughness: 0.97 }),
    warmLight: standard({
      color: "#ffe1a2", emissive: "#ffc36e", emissiveIntensity: 0.55,
      roughness: 0.65,
    }),
    navy: standard({ color: COLORS.navy, roughness: 0.8 }),
    mustard: standard({ color: COLORS.mustard, roughness: 0.84 }),
    terracotta: standard({ color: COLORS.terracotta, roughness: 0.95 }),
    colors: COLORS,
    makeSignMaterial,
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const material of materials) material.dispose();
      for (const map of textures) map.dispose();
      materials.clear();
      textures.clear();
      signs.clear();
    },
  };
  const tinted = new Map();
  result.forShop = (style) => {
    function tint(source, color) {
      const key = `${source.uuid}:${color}`;
      if (!tinted.has(key)) {
        const material = source.clone();
        material.color.set(color);
        materials.add(material);
        tinted.set(key, material);
      }
      return tinted.get(key);
    }
    return { ...result, style,
      navy: tint(result.navy, style.primary), mustard: tint(result.mustard, style.accent),
      colors: { ...COLORS, navy: style.primary, mustard: style.accent },
    };
  };
  return result;
}
