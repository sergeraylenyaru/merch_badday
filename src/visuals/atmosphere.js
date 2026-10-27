import * as T from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

// One sun, one reflection probe and one sky mesh. No full-screen effects or
// additional shadow-casting lights are needed for the neighbourhood.
export function createAtmosphere(scene, renderer) {
  const hemisphere = new T.HemisphereLight("#d9eaf7", "#7d7863", 1.55);
  const sun = new T.DirectionalLight("#fff0d1", 3.1);
  sun.position.set(-45, 62, 35);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {
    left: -48,
    right: 48,
    top: 48,
    bottom: -48,
    near: 1,
    far: 180,
  });
  sun.shadow.normalBias = 0.035;
  sun.shadow.bias = -0.00015;
  scene.add(hemisphere, sun, sun.target);

  const room = new RoomEnvironment();
  const generator = new T.PMREMGenerator(renderer);
  const environment = generator.fromScene(room, 0.04);
  room.dispose();
  generator.dispose();
  scene.environment = environment.texture;
  scene.environmentIntensity = 0.32;
  scene.fog = new T.Fog("#d6e1df", 100, 245);
  scene.background = new T.Color("#d6e1df");

  const uniforms = {
    top: { value: new T.Color("#5896cb") },
    horizon: { value: new T.Color("#e1e7dc") },
    sunDirection: { value: new T.Vector3(-45, 62, 35).normalize() },
    sunTint: { value: new T.Color("#fff1cf") },
    cloudAmount: { value: 0.25 },
    haze: { value: 0 },
  };
  const skyMaterial = new T.ShaderMaterial({
    uniforms,
    side: T.BackSide,
    depthWrite: false,
    depthTest: false,
    toneMapped: false,
    vertexShader: `
      varying vec3 direction;
      void main() {
        direction = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 top;
      uniform vec3 horizon;
      uniform vec3 sunDirection;
      uniform vec3 sunTint;
      uniform float cloudAmount;
      uniform float haze;
      varying vec3 direction;
      void main() {
        vec3 d = normalize(direction);
        float height = max(d.y, 0.0);
        vec3 color = mix(horizon, top, pow(height, 0.55));
        float shape = sin(d.x * 24.0 + sin(d.z * 19.0))
          * sin(d.z * 21.0 + d.y * 9.0)
          + sin(d.x * 39.0 + d.z * 17.0) * 0.35;
        float band = smoothstep(0.10, 0.24, height)
          * (1.0 - smoothstep(0.55, 0.80, height));
        float clouds = smoothstep(0.25, 0.85, shape) * band * cloudAmount;
        color = mix(color, horizon * 1.06, clouds);
        float alignment = max(dot(d, sunDirection), 0.0);
        color += sunTint * pow(alignment, 28.0) * 0.16 * (1.0 - haze);
        color = mix(color, sunTint, smoothstep(0.9991, 0.9997, alignment)
          * (1.0 - haze));
        gl_FragColor = vec4(color, 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
  const sky = new T.Mesh(new T.SphereGeometry(285, 32, 16), skyMaterial);
  sky.name = "neighbourhood-sky";
  sky.frustumCulled = false;
  sky.renderOrder = -1000;
  scene.add(sky);

  // Reuse these objects in the frame loop instead of allocating colors/vectors.
  const targets = {
    top: new T.Color(),
    horizon: new T.Color(),
    sun: new T.Color(),
    ground: new T.Color(),
  };
  let disposed = false;
  let highQuality = true;
  let firstUpdate = true;
  return {
    sun,
    setQuality(quality) {
      highQuality = quality === "high";
      sun.castShadow = highQuality;
      // Cube-UV PBR reflections are expensive on integrated/software GPUs.
      // Retain the one probe, but sample it only in the high quality mode.
      scene.environment = highQuality ? environment.texture : null;
    },
    update({ day, weather, player, dt }) {
      if (disposed) return;
      const evening = T.MathUtils.smoothstep(day, 0.62, 1);
      targets.top.set(weather ? "#849eac" : evening > 0.5 ? "#818eb3" : "#5896cb");
      targets.horizon.set(weather ? "#bdc9ca" : evening > 0.5 ? "#e7bd9d" : "#e1e7dc");
      targets.sun.set(weather ? "#e0e8ed" : evening > 0.5 ? "#ffc78c" : "#fff0d1");
      targets.ground.set(weather ? "#717c77" : "#7d7863");
      const blend = firstUpdate ? 1 : 1 - Math.exp(-Math.max(dt, 0) * 1.4);
      firstUpdate = false;
      uniforms.top.value.lerp(targets.top, blend);
      uniforms.horizon.value.lerp(targets.horizon, blend);
      uniforms.sunTint.value.lerp(targets.sun, blend);
      uniforms.haze.value = T.MathUtils.lerp(uniforms.haze.value, weather ? 0.92 : 0, blend);
      uniforms.cloudAmount.value = highQuality ? 0.28 : 0.12;
      scene.fog.color.copy(uniforms.horizon.value);
      scene.background.copy(uniforms.horizon.value);
      scene.fog.near = weather ? 65 : 100;
      scene.fog.far = weather ? 190 : 245;
      sun.color.copy(uniforms.sunTint.value);
      sun.intensity = T.MathUtils.lerp(sun.intensity, weather ? 1.2 : 3.1 - evening * 1.0, blend);
      hemisphere.color.copy(uniforms.top.value).lerp(uniforms.horizon.value, 0.7);
      hemisphere.groundColor.lerp(targets.ground, blend);
      hemisphere.intensity = weather ? 1.8 : 1.55;
      // Quarter-metre steps avoid shadow swimming while walking.
      const x = Math.round(player.x * 4) / 4;
      const z = Math.round(player.z * 4) / 4;
      sun.target.position.set(x, 0, z);
      sun.position.set(x - 45, 62 - evening * 26, z + 35);
      uniforms.sunDirection.value.subVectors(sun.position, sun.target.position).normalize();
      sky.position.set(player.x, 0, player.z);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      scene.remove(sky, hemisphere, sun, sun.target);
      sky.geometry.dispose();
      skyMaterial.dispose();
      sun.shadow.map?.dispose();
      if (scene.environment === environment.texture) scene.environment = null;
      environment.dispose();
    },
  };
}
