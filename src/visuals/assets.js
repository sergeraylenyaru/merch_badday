import { Box3, Group, Vector3 } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone as cloneSkeleton } from "three/addons/utils/SkeletonUtils.js";

/**
 * Shared GLB resources with independent scene instances.
 *
 * Manifest entries: { url, size: [width, height, depth], rotationY, shadows }.
 * `size` is a bounding envelope in world metres, fitted with a uniform scale.
 * `rotationY` is in radians and is applied before measuring the model. Models
 * are centred in X/Z and placed on Y=0, so gameplay owns the returned root.
 * GLTFLoader retains the correct colour spaces of authored PBR textures.
 */
export class AssetLibrary {
  constructor(manifest, { loader = new GLTFLoader(), logger = console } = {}) {
    this.manifest = manifest;
    this.loader = loader;
    this.logger = logger;
    this.cache = new Map();
    this.instances = new Set();
    this.warned = new Set();
    this.disposed = false;
    this.releasedResources = new Set();
  }

  warn(key, message) {
    if (this.warned.has(key)) return;
    this.warned.add(key);
    this.logger.warn(`[assets] ${message} Keeping the fallback visual.`);
  }

  /** Fetch and parse each URL once, including concurrent requests and errors. */
  async load(id) {
    if (this.disposed) return null;
    const entry = this.manifest[id];
    if (!entry?.url) {
      this.warn(`unknown:${id}`, `Unknown model "${id}".`);
      return null;
    }
    let record = this.cache.get(entry.url);
    if (!record) {
      record = { state: "loading", gltf: null, promise: null };
      this.cache.set(entry.url, record);
      record.promise = Promise.resolve()
        .then(() => this.loader.loadAsync(entry.url))
        .then((gltf) => {
          if (!gltf?.scene?.isObject3D) throw new Error("GLB has no scene");
          if (this.disposed) {
            this.disposeScenes(gltf);
            return null;
          }
          record.gltf = gltf;
          record.state = "loaded";
          this.logger.info?.(`[assets] Loaded ${id}: ${entry.url}`);
          return gltf;
        })
        .catch((error) => {
          record.state = "failed";
          this.warn(entry.url, `Cannot load ${id} (${entry.url}): ${error.message}.`);
          return null;
        });
    }
    return record.promise;
  }

  async preload(ids = Object.keys(this.manifest)) {
    return Promise.all(ids.map((id) => this.load(id)));
  }

  /**
   * Synchronous after preload. Null means the caller should keep its fallback.
   * `height` overrides the envelope; `size` and `shadow` override the manifest.
   * Geometry, textures and materials stay shared; do not dispose them per clone.
   */
  instantiate(id, { size, height, shadow } = {}) {
    if (this.disposed) return null;
    const entry = this.manifest[id];
    const gltf = entry && this.cache.get(entry.url)?.gltf;
    if (!gltf) return null;

    const root = new Group();
    root.name = `asset:${id}`;
    root.userData.assetId = id;
    root.animations = gltf.animations || [];
    const visual = new Group();
    visual.rotation.y = entry.rotationY || 0;
    visual.add(cloneSkeleton(gltf.scene));
    root.add(visual);
    root.updateMatrixWorld(true);
    const bounds = new Box3().setFromObject(visual);
    const extent = bounds.getSize(new Vector3());
    if (bounds.isEmpty() || ![extent.x, extent.y, extent.z].every(Number.isFinite)) {
      this.disposeSkeletons(root);
      this.warn(`bounds:${id}`, `Model ${id} has no finite visible bounds.`);
      return null;
    }

    let scale = 1;
    if (height > 0 && Number.isFinite(height) && extent.y > 0) {
      scale = height / extent.y;
    } else if (size || entry.size) {
      const target = size || entry.size;
      const ratios = [extent.x, extent.y, extent.z]
        .map((value, i) => value > 0 && target[i] > 0 ? target[i] / value : Infinity)
        .filter(Number.isFinite);
      if (ratios.length) scale = Math.min(...ratios);
    }
    visual.scale.setScalar(scale);
    root.updateMatrixWorld(true);
    bounds.setFromObject(visual);
    const center = bounds.getCenter(new Vector3());
    visual.position.set(-center.x, -bounds.min.y, -center.z);
    const casts = shadow ?? entry.shadows ?? true;
    visual.traverse((node) => {
      if (!node.isMesh) return;
      node.castShadow = casts;
      node.receiveShadow = true;
    });
    root.updateMatrixWorld(true);
    this.instances.add(root);
    return root;
  }

  get metrics() {
    const records = [...this.cache.values()];
    return {
      loaded: records.filter((r) => r.state === "loaded").length,
      failed: records.filter((r) => r.state === "failed").length,
      cacheCount: this.cache.size,
      instances: this.instances.size,
      disposed: this.disposed,
    };
  }

  disposeSkeletons(root) {
    const skeletons = new Set();
    root.traverse((node) => {
      if (node.isSkinnedMesh && node.skeleton) skeletons.add(node.skeleton);
    });
    for (const skeleton of skeletons) skeleton.dispose();
  }

  /** Remove an instance without freeing resources used by other instances. */
  release(root) {
    if (!this.instances.delete(root)) return;
    root.removeFromParent();
    this.disposeSkeletons(root);
  }

  disposeOnce(resource) {
    if (!resource || this.releasedResources.has(resource)) return;
    this.releasedResources.add(resource);
    resource.dispose();
    // GLTFLoader may decode images into ImageBitmap objects. Disposing the GPU
    // texture does not close those CPU-side images; release them only at teardown.
    if (resource.isTexture) {
      const images = Array.isArray(resource.image) ? resource.image : [resource.image];
      for (const image of images) {
        if (!image?.close || this.releasedResources.has(image)) continue;
        this.releasedResources.add(image);
        image.close();
      }
    }
  }

  disposeSource(root) {
    this.disposeSkeletons(root);
    root.traverse((node) => {
      if (!node.isMesh) return;
      this.disposeOnce(node.geometry);
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      for (const material of materials) {
        if (!material) continue;
        for (const value of Object.values(material)) {
          if (value?.isTexture) this.disposeOnce(value);
        }
        this.disposeOnce(material);
      }
    });
  }

  disposeScenes(gltf) {
    for (const root of new Set([gltf.scene, ...(gltf.scenes || [])])) {
      this.disposeSource(root);
    }
  }

  /** Only on teardown: all live instances are detached before shared disposal. */
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const root of [...this.instances]) this.release(root);
    for (const record of this.cache.values()) {
      if (record.gltf) this.disposeScenes(record.gltf);
    }
    this.cache.clear();
  }
}
