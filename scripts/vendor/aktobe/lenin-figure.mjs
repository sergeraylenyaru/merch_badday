// Adapted from iskan-k/aktobe-2000s, Copyright (c) 2026 Iskander Kinzhibayev. MIT; see LICENSE.
import * as THREE from 'three';
import {HAIRLINE} from './figure.mjs';
const GREY=0x9a948a,GREY_DARK=0x6f6a62;
export function leninFigure(s) {
  const C = GREY, D = GREY_DARK, J = 0x817b72;
  s.geo(slab(), D);
  const legs = [
    { hip: [0.09, 0.88, 0.02], knee: [0.1, 0.48, 0.03], ankle: [0.11, 0.085, 0.06], yaw: -0.25 },
    { hip: [-0.09, 0.88, -0.02], knee: [-0.11, 0.49, -0.12], ankle: [-0.12, 0.085, -0.16], yaw: 0.15 },
  ];
  for (const l of legs) {
    s.sweep([l.hip, l.knee, l.ankle], [0.085, 0.064, 0.056], J, { seg: 12 });
    const fx = -Math.sin(l.yaw), fz = -Math.cos(l.yaw);
    s.ball([l.ankle[0] + fx * 0.06, 0.045, l.ankle[2] + fz * 0.06], [0.048, 0.045, 0.13], D, 12, [0, l.yaw, 0]);
    s.box(0.09, 0.022, 0.27, [l.ankle[0] + fx * 0.055, 0.011, l.ankle[2] + fz * 0.055], D, [0, l.yaw, 0]);
  }
  // jacket and waistcoat under the coat, the tie
  s.loft([
    { y: 0.8, rx: 0.17, rf: 0.115, rb: 0.12 },
    { y: 1.0, rx: 0.165, rf: 0.125, rb: 0.115 },
    { y: 1.2, rx: 0.175, rf: 0.13, rb: 0.115 },
    { y: 1.38, rx: 0.19, rf: 0.115, rb: 0.105 },
    { y: 1.46, rx: 0.1, rf: 0.07, rb: 0.075 },
  ], J, { seg: 32, capBottom: true });
  s.box(0.035, 0.2, 0.012, [0, 1.3, -0.127], D, [-0.1, 0, 0]);
  s.ball([0, 1.415, -0.108], [0.022, 0.02, 0.014], D, 8);   // the knot of the tie
  for (const sd of [-1, 1]) {
    s.box(0.05, 0.26, 0.012, [sd * 0.06, 1.27, -0.128], D, [-0.12, 0, sd * 0.28]);   // jacket lapels
    s.ball([sd * 0.2, 1.405, 0], 0.066, C);
  }
  // the overcoat, open, the skirts swinging back from the stride
  s.loft([
    { y: 0.4, x: 0.0, z: 0.1, rx: 0.3, rf: 0.2, rb: 0.3, fold: 0.06, folds: 8, phase: 0.2, openR: 0.95, openL: 0.8 },
    { y: 0.64, z: 0.06, rx: 0.27, rf: 0.17, rb: 0.24, fold: 0.045, folds: 8, phase: 0.2, openR: 0.82, openL: 0.7 },
    { y: 0.9, z: 0.02, rx: 0.222, rf: 0.145, rb: 0.175, fold: 0.02, folds: 6, phase: 0.2, openR: 0.68, openL: 0.55 },
    { y: 1.1, rx: 0.2, rf: 0.14, rb: 0.14, openR: 0.6, openL: 0.5 },
    { y: 1.3, rx: 0.205, rf: 0.145, rb: 0.13, openR: 0.55, openL: 0.45 },
    { y: 1.42, rx: 0.215, rf: 0.125, rb: 0.12, openR: 0.6, openL: 0.5 },
    { y: 1.48, rx: 0.125, rf: 0.095, rb: 0.105, openR: 0.62, openL: 0.6 },
    { y: 1.535, rx: 0.085, rf: 0.08, rb: 0.09, openR: 0.5, openL: 0.5 },
  ], C, { seg: 40 });
  for (const sd of [-1, 1]) s.box(0.07, 0.3, 0.014, [sd * 0.13, 1.3, -0.145], C, [-0.1, sd * 0.3, sd * 0.25]);   // coat lapels

  // head: looking up and out over the street
  s.sweep([[0, 1.45, 0.005], [0, 1.5, -0.004], [0, 1.545, -0.012]], [0.052, 0.05, 0.048], C, { seg: 12 });
  s.head([0, 1.645, -0.02], [0.14, -0.04, 0], C, {
    beard: 'goatee', moustache: true, brow: 0.085, hair: HAIRLINE.fringe, hairOpts: { thick: 0.035, comb: 'down', groove: 0.015 },
  });

  // right arm out and up, open hand; left hand at the lapel
  const rWrist = [0.5, 1.62, -0.47];
  s.sweep([[0.2, 1.42, 0], [0.29, 1.44, -0.1], [0.37, 1.48, -0.23], [0.44, 1.55, -0.36], rWrist],
    [0.062, 0.058, 0.052, 0.048, 0.04], C, { seg: 12 });
  s.hand(rWrist, [0.4, 0.28, -0.87], [0.1, -1, -0.2], C, { kind: 'open', side: 1 });
  const lWrist = [-0.1, 1.28, -0.155];
  s.sweep([[-0.2, 1.42, 0], [-0.25, 1.28, 0.0], [-0.27, 1.14, -0.05], [-0.2, 1.2, -0.13], lWrist],
    [0.062, 0.058, 0.05, 0.046, 0.038], C, { seg: 12 });
  s.hand(lWrist, [0.3, 0.9, -0.2], [0, 0, 1], C, { kind: 'fist', side: -1 });
}

function slab() {
  const g = new THREE.CylinderGeometry(0.5, 0.52, 0.05, 18);
  g.scale(1, 1, 0.8);
  g.translate(0, 0.015, 0);
  return g;
}
