// HoldShapes — one recognisable, sculpted shape per hold type, built with
// MeshKit. Each shape is centred on the origin, sits on the wall face at z = 0
// and sticks out toward +Z (the user). Sizes come from WallLayout.HOLD_SIZE.
//
// Every hold is one smooth surface over a superellipse footprint: a height
// field (the type's character) times a rim curve that rolls it into the wall.
// Normals are averaged across faces, so the baked light reads as cast resin,
// not facets. Cavities (the jug's bucket, the pocket's pit) and the contact
// with the wall get baked occlusion; a steel bolt washer sits where real holds
// are bolted on.

import { Geo, type RGBA, type V3, normalize } from "./MeshKit";
import { HOLD_SIZE, type HoldType } from "./WallLayout";

/**
 * Neutral, light resin tones (off-white, pale stone, light warm grey). They
 * stay well clear of the ring colours, so a ring is never mistaken for a
 * hold colour, and read on the additive display.
 */
export const HOLD_TONES: RGBA[] = [
  [0.98, 0.96, 0.91, 1],
  [0.93, 0.91, 0.86, 1],
  [0.9, 0.86, 0.8, 1],
];

const WASHER: RGBA = [0.8, 0.8, 0.82, 1];
const BOLT: RGBA = [0.16, 0.15, 0.14, 1];

/** Stable tone per hold id, so the wall looks the same every run. */
export function toneFor(id: string): number {
  let h = 7;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 9973;
  return h % HOLD_TONES.length;
}

const NA = 44; // around the footprint
const NB = 18; // rim to centre

interface Sculpt {
  /** footprint superellipse exponent: 2 = ellipse, higher = boxier */
  n: number;
  /** rim roll-off: 2 = round dome, higher = flatter top with a tighter edge */
  k: number;
  /** top surface height (cm) over the footprint, u and v in -1..1 */
  height: (u: number, v: number) => number;
  /** baked cavity occlusion, 1 = open, lower = deeper in a cavity */
  cavity?: (u: number, v: number) => number;
  /** bolt washer position (u, v) and radius (cm) */
  bolt?: [number, number, number];
}

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

function gauss(u: number, v: number, cu: number, cv: number, ru: number, rv: number): number {
  const a = (u - cu) / ru, b = (v - cv) / rv;
  return Math.exp(-(a * a + b * b));
}

/** a little cast-resin unevenness so no two patches of surface are identical */
function lumpy(u: number, v: number): number {
  return Math.sin(u * 4.1 + v * 2.3) * Math.sin(v * 5.2 - u * 1.7);
}

const SCULPTS: Record<HoldType, Sculpt> = {
  // Big friendly hold with a deep bucket you can wrap your fingers into.
  jug: (() => {
    const d = HOLD_SIZE.jug.d;
    const dish = (u: number, v: number) => gauss(u, v, 0, 0.36, 0.56, 0.3);
    return {
      n: 2.4,
      k: 2.8,
      height: (u, v) => Math.max(0.18 * d, d * (0.8 + 0.2 * v) - 0.6 * d * dish(u, v)),
      cavity: (u, v) => 1 - 0.5 * dish(u, v),
      bolt: [0, 0.36, 0.85],
    } as Sculpt;
  })(),
  // Thin, wide edge: a ramp up to a flat, slightly lipped top edge.
  crimp: (() => {
    const d = HOLD_SIZE.crimp.d;
    return {
      n: 5,
      k: 7,
      height: (u, v) => {
        const t = (v + 1) / 2;
        return d * (0.45 + 0.55 * Math.pow(t, 1.3)) + 0.2 * d * smoothstep(0.55, 0.85, v);
      },
      cavity: (u, v) => 1 - 0.18 * (1 - (v + 1) / 2),
    } as Sculpt;
  })(),
  // Tall, narrow fin with a spine down the middle to squeeze.
  pinch: (() => {
    const d = HOLD_SIZE.pinch.d;
    return {
      n: 2.2,
      k: 2.4,
      height: (u, v) => d * (1 - 0.22 * v * v) * (0.7 + 0.3 * Math.exp(-u * u * 5)),
      bolt: [0, -0.5, 0.6],
    } as Sculpt;
  })(),
  // Rounded lump with a deep finger pit.
  pocket: (() => {
    const d = HOLD_SIZE.pocket.d;
    const pit = (u: number, v: number) => gauss(u, v, 0, 0.08, 0.34, 0.3);
    return {
      n: 2.3,
      k: 3.2,
      height: (u, v) => Math.max(0.14 * d, d * (1 - 0.1 * v) - 0.82 * d * pit(u, v)),
      cavity: (u, v) => 1 - 0.72 * pit(u, v),
    } as Sculpt;
  })(),
  // Wide, low, smooth dome with nothing to grab, a little fuller at the bottom.
  sloper: (() => {
    const d = HOLD_SIZE.sloper.d;
    return {
      n: 2.1,
      k: 2.0,
      height: (u, v) => d * (1 - 0.22 * v + 0.06 * u),
      bolt: [0.05, 0.12, 0.85],
    } as Sculpt;
  })(),
};

function superellipse(t: number, n: number): [number, number] {
  const c = Math.cos(t), s = Math.sin(t);
  const e = 2 / n;
  return [Math.sign(c) * Math.pow(Math.abs(c), e), Math.sign(s) * Math.pow(Math.abs(s), e)];
}

function sculpt(g: Geo, type: HoldType, tone: RGBA, k: number) {
  const dimmed = (c: RGBA): RGBA => [c[0] * k, c[1] * k, c[2] * k, c[3]];
  tone = dimmed(tone);
  const size = HOLD_SIZE[type];
  const sc = SCULPTS[type];
  const hw = size.w / 2, hh = size.h / 2;
  const rim = (rho: number) => Math.sqrt(Math.max(0, 1 - Math.pow(rho, sc.k)));
  const surfaceZ = (u: number, v: number, rho: number) =>
    (sc.height(u, v) + size.d * 0.012 * lumpy(u, v)) * rim(rho);

  // positions: rings from the rim (j = 0, on the wall) to the centre, rings
  // packed toward the rim where the surface turns fastest; one centre vertex
  const P: V3[] = [];
  const UV: [number, number][] = [];
  for (let j = 0; j < NB; j++) {
    const rho = Math.cos((j / NB) * (Math.PI / 2));
    for (let i = 0; i < NA; i++) {
      const [eu, ev] = superellipse((i / NA) * Math.PI * 2, sc.n);
      const u = eu * rho, v = ev * rho;
      P.push([u * hw, v * hh, surfaceZ(u, v, rho)]);
      UV.push([u, v]);
    }
  }
  const centre = P.length;
  P.push([0, 0, surfaceZ(0, 0, 0)]);
  UV.push([0, 0]);

  const tris: number[] = [];
  const idx = (j: number, i: number) => j * NA + (i % NA);
  for (let j = 0; j < NB - 1; j++) {
    for (let i = 0; i < NA; i++) {
      const a = idx(j, i), b = idx(j, i + 1), c = idx(j + 1, i + 1), d = idx(j + 1, i);
      tris.push(a, b, c, a, c, d);
    }
  }
  for (let i = 0; i < NA; i++) tris.push(idx(NB - 1, i), idx(NB - 1, i + 1), centre);

  // smooth normals: area-weighted face normals; flip any that point into the wall
  const N: V3[] = P.map(() => [0, 0, 0] as V3);
  for (let t = 0; t < tris.length; t += 3) {
    const p0 = P[tris[t]], p1 = P[tris[t + 1]], p2 = P[tris[t + 2]];
    const e1 = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
    const e2 = [p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]];
    const fn: V3 = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    for (let k = 0; k < 3; k++) {
      const n = N[tris[t + k]];
      n[0] += fn[0];
      n[1] += fn[1];
      n[2] += fn[2];
    }
  }
  // winding check on one face near the top: the mesh must face +Z (the user)
  const flip = N[centre][2] < 0;

  const base = g.count;
  for (let k = 0; k < P.length; k++) {
    let n = N[k];
    if (flip) n = [-n[0], -n[1], -n[2]];
    if (n[2] < -0.05) n = [n[0], n[1], 0];
    const [u, v] = UV[k];
    const cav = sc.cavity ? sc.cavity(u, v) : 1;
    // contact occlusion where the hold meets the wall
    const contact = 0.7 + 0.3 * smoothstep(0, 0.35 * size.d, P[k][2]);
    const grit = 1 + 0.025 * Math.sin(u * 91.7 + v * 47.3) * Math.sin(v * 73.1 - u * 29.9);
    const ao = cav * contact * grit;
    g.vert(P[k], normalize(n), [tone[0] * ao, tone[1] * ao, tone[2] * ao, 1]);
  }
  for (let t = 0; t < tris.length; t += 3) {
    if (flip) g.tri(base + tris[t], base + tris[t + 2], base + tris[t + 1]);
    else g.tri(base + tris[t], base + tris[t + 1], base + tris[t + 2]);
  }

  if (sc.bolt) {
    const [bu, bv, br] = sc.bolt;
    const z = surfaceZ(bu, bv, Math.hypot(bu, bv) * 0.6) + 0.12;
    addFlatDisc(g, [bu * hw, bv * hh, z], br, dimmed(WASHER));
    addFlatDisc(g, [bu * hw, bv * hh, z + 0.03], br * 0.5, dimmed(BOLT));
  }
}

function addFlatDisc(g: Geo, c: V3, r: number, color: RGBA) {
  const seg = 16;
  const ctr = g.vert(c, [0, 0, 1], color);
  const ring = g.count;
  for (let i = 0; i <= seg; i++) {
    const t = (i / seg) * Math.PI * 2;
    g.vert([c[0] + r * Math.cos(t), c[1] + r * Math.sin(t), c[2]], [0, 0, 1], color);
  }
  for (let i = 0; i < seg; i++) g.tri(ctr, ring + i, ring + i + 1);
}

/** brightness k scales every vertex colour (1 = the lit hold; lower = a dim hold outside the problem) */
export function buildHoldGeo(type: HoldType, tone = 0, k = 1): Geo {
  const g = new Geo();
  sculpt(g, type, HOLD_TONES[tone % HOLD_TONES.length], k);
  return g;
}
