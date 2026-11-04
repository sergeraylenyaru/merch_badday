// Adapted from iskan-k/aktobe-2000s, Copyright (c) 2026 Iskander Kinzhibayev. MIT; see LICENSE.
import * as THREE from 'three';
import {loft,sweep,headGeo,hairGeo,handGeo,frame,HEAD} from './figure.mjs';
const _up=new THREE.Vector3(0,1,0),_v=new THREE.Vector3();
export class Sculpt {
  /** `statue` bakes into the statue material; otherwise the plain solid one. */
  constructor(batch, x, y, z, facing = 0, scale = 1, { statue = false } = {}) {
    this.batch = batch;
    this.mat='statue';
    this.m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, facing, 0)), new THREE.Vector3(scale, scale, scale));
  }

  place(g, color) {
    g.applyMatrix4(this.m);
    const shade = g.attributes.shade;
    if (!shade) {
      this.batch.add(g, { color, mat: this.mat });
      return;
    }
    // bake the geometry's cavity shade into its vertex colour
    const base = new THREE.Color(color);
    const arr = new Float32Array(shade.count * 3);
    for (let i = 0; i < shade.count; i++) {
      const k = shade.getX(i);
      arr[i * 3] = base.r * k;
      arr[i * 3 + 1] = base.g * k;
      arr[i * 3 + 2] = base.b * k;
    }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    g.deleteAttribute('shade');
    this.batch.add(g, { color: null, mat: this.mat });
  }

  /** Tube along a smooth curve; see figure.js sweep. */
  sweep(pts, radii, color, o) { this.place(sweep(pts, radii, o), color); }

  /** Stacked rings; see figure.js loft. */
  loft(rings, color, o) { this.place(loft(rings, o), color); }

  /** A hand at the wrist, fingers along `along`, palm toward `toward`. */
  hand(wrist, along, toward, color, { kind = 'open', side = 1, size = 1 } = {}) {
    const f = frame(wrist, along, toward).scale(new THREE.Vector3(size, size, size));
    for (const g of handGeo(kind, side)) { g.applyMatrix4(f); this.place(g, color); }
  }

  /**
   * A head centred at `at`, turned by rot [pitch (+ lifts the chin), yaw
   * (+ turns to the figure's left), roll]. `hair` is a hairline function
   * or null; `ears` false under a hat.
   */
  head(at, rot, color, { hair = null, hairColor = color, hairOpts = {}, ears = true, size = 1, ...face } = {}) {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(...at),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(rot[0], rot[1], rot[2] || 0, 'YXZ')), new THREE.Vector3(size, size, size));
    const add = (g, col) => { g.applyMatrix4(m); this.place(g, col); };
    add(headGeo(face), color);
    if (hair) add(hairGeo(hair, hairOpts), hairColor);
    if (ears) {
      for (const s of [-1, 1]) {
        const e = new THREE.SphereGeometry(1, 8, 6);
        e.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(s * HEAD.rx * 0.9, -0.01, HEAD.rz * 0.14),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(0, s * 0.5, 0)), new THREE.Vector3(0.009, 0.026, 0.016)));
        add(e, color);
      }
    }
    return m;
  }

  /** Tapered cylinder from a to b, radius r0 at a and r1 at b. */
  limb(a, b, r0, r1, color, seg = 9) {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
    const len = A.distanceTo(B);
    if (len < 1e-4) return;
    const g = new THREE.CylinderGeometry(r1, r0, len, seg, 1, false);
    g.translate(0, len / 2, 0);
    const q = new THREE.Quaternion().setFromUnitVectors(_up, _v.copy(B).sub(A).normalize());
    g.applyMatrix4(new THREE.Matrix4().compose(A, q, new THREE.Vector3(1, 1, 1)));
    this.place(g, color);
  }

  /** Ellipsoid at c; r is a number or [rx, ry, rz]; rot is [x, y, z] euler. */
  ball(c, r, color, seg = 12, rot = [0, 0, 0]) {
    const [rx, ry, rz] = Array.isArray(r) ? r : [r, r, r];
    const g = new THREE.SphereGeometry(1, seg, Math.max(6, seg - 4));
    g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...c),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(rot[0], rot[1], rot[2], 'YXZ')), new THREE.Vector3(rx, ry, rz)));
    this.place(g, color);
  }

  /** Box centred at c. */
  box(w, h, d, c, color, rot = [0, 0, 0]) {
    const g = new THREE.BoxGeometry(w, h, d);
    g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...c),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(rot[0], rot[1], rot[2], 'YXZ')), new THREE.Vector3(1, 1, 1)));
    this.place(g, color);
  }

  /** Cone or frustum centred at c (rTop = 0 for a cone). */
  cone(r, h, c, color, seg = 10, rot = [0, 0, 0], rTop = 0) {
    const g = new THREE.CylinderGeometry(rTop, r, h, seg, 1, false);
    g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...c),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(rot[0], rot[1], rot[2], 'YXZ')), new THREE.Vector3(1, 1, 1)));
    this.place(g, color);
  }

  /** Any geometry authored in local space. */
  geo(g, color) { this.place(g, color); }
}

/** Engraved plaque: pale letters cut into a dark stone or bronze panel. */