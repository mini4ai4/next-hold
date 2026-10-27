// MeshKit — pure geometry generators for Next Hold (no Lens globals, so the
// winding can be checked outside Lens Studio).
//
// Every generator writes into a Geo buffer laid out as
//   position(3) normal(3) color(4)   → stride 10
// which matches GEO_LAYOUT below. Front faces are CCW seen from outside.
//
// The vertex-colour material is unlit, so a simple key light is baked into the
// vertex colours (shade()). That keeps the hold shapes readable instead of
// flat silhouettes.

export const GEO_STRIDE = 10;

export const GEO_LAYOUT = [
  { name: "position", components: 3 },
  { name: "normal", components: 3, normalized: true },
  { name: "color", components: 4 },
];

export type RGBA = [number, number, number, number];
export type V3 = [number, number, number];

// Key light from upper left-front, toward the wall face (+Z faces the user).
const LIGHT: V3 = normalize([-0.35, 0.6, 0.72]);
// Half vector for a viewer straight in front of the wall: a soft resin sheen.
const HALF: V3 = normalize([LIGHT[0], LIGHT[1], LIGHT[2] + 1]);

export function normalize(v: V3): V3 {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

/** Gym lighting baked into vertex colours: sky-ish ambient, wrapped key light, soft sheen. */
export function shade(c: RGBA, n: V3, bake: boolean): RGBA {
  if (!bake) return c;
  const nl = n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2];
  const d = Math.max(0, (nl + 0.25) / 1.25);
  const k = 0.5 + 0.1 * n[1] + 0.45 * d;
  const nh = Math.max(0, n[0] * HALF[0] + n[1] * HALF[1] + n[2] * HALF[2]);
  const spec = 0.16 * Math.pow(nh, 28);
  return [Math.min(1, c[0] * k + spec), Math.min(1, c[1] * k + spec), Math.min(1, c[2] * k + spec), c[3]];
}

export class Geo {
  v: number[] = [];
  i: number[] = [];
  count = 0;
  /** bake the key light into vertex colours */
  bake = true;

  vert(p: V3, n: V3, c: RGBA): number {
    const nn = normalize(n);
    const col = shade(c, nn, this.bake);
    this.v.push(p[0], p[1], p[2], nn[0], nn[1], nn[2], col[0], col[1], col[2], col[3]);
    return this.count++;
  }

  tri(a: number, b: number, c: number) {
    this.i.push(a, b, c);
  }
}

// ---------------------------------------------------------------- box
/** Axis-aligned box, 24 verts (per-face normals), CCW from outside. */
export function addBox(g: Geo, c: V3, h: V3, color: RGBA) {
  const x0 = c[0] - h[0], x1 = c[0] + h[0];
  const y0 = c[1] - h[1], y1 = c[1] + h[1];
  const z0 = c[2] - h[2], z1 = c[2] + h[2];
  const face = (p0: V3, p1: V3, p2: V3, p3: V3, n: V3) => {
    const a = g.vert(p0, n, color), b = g.vert(p1, n, color);
    const cc = g.vert(p2, n, color), d = g.vert(p3, n, color);
    g.tri(a, b, cc);
    g.tri(a, cc, d);
  };
  face([x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1], [1, 0, 0]);
  face([x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [x0, y0, z0], [-1, 0, 0]);
  face([x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [0, 1, 0]);
  face([x0, y0, z1], [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [0, -1, 0]);
  face([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1]);
  face([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1]);
}

// ---------------------------------------------------------------- lathe (Z axis)
/**
 * Revolve a profile around the +Z axis (the axis pointing out of the wall).
 * profile = [[r, h], ...] from the wall (h = 0) outwards, r >= 0.
 * sx / sy stretch the footprint into an ellipse (normals use the inverse
 * scale, so lighting stays correct).
 *
 * Point = (r cos t * sx, -r sin t * sy, h): this is the Y-axis lathe rotated
 * +90 deg about X (a rotation, not a mirror), so the Y-lathe winding
 * [bl, br, tr, bl, tr, tl] stays CCW from outside.
 */
export function addLatheZ(
  g: Geo, profile: [number, number][], segments: number, color: RGBA,
  sx = 1, sy = 1, offset: V3 = [0, 0, 0], topCap = true,
) {
  const P = profile.length;
  const n2: [number, number][] = [];
  for (let j = 0; j < P; j++) {
    const a = profile[Math.max(0, j - 1)], b = profile[Math.min(P - 1, j + 1)];
    const dr = b[0] - a[0], dh = b[1] - a[1];
    const l = Math.hypot(dh, dr) || 1;
    n2.push([dh / l, -dr / l]); // outward (radial, axial) normal
  }
  const start = g.count;
  for (let i = 0; i <= segments; i++) {
    const t = (i / segments) * Math.PI * 2;
    const c = Math.cos(t), s = Math.sin(t);
    for (let j = 0; j < P; j++) {
      const [r, h] = profile[j];
      const [nr, nh] = n2[j];
      g.vert(
        [offset[0] + r * c * sx, offset[1] - r * s * sy, offset[2] + h],
        [(nr * c) / sx, (-nr * s) / sy, nh],
        color,
      );
    }
  }
  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < P - 1; j++) {
      const bl = start + i * P + j, br = start + i * P + j + 1;
      const tl = start + (i + 1) * P + j, tr = start + (i + 1) * P + j + 1;
      g.tri(bl, br, tr);
      g.tri(bl, tr, tl);
    }
  }
  // Base cap against the wall (normal -Z) when the profile starts off-axis.
  if (profile[0][0] > 1e-6) {
    const [r, h] = profile[0];
    const ctr = g.vert([offset[0], offset[1], offset[2] + h], [0, 0, -1], color);
    const ring = g.count;
    for (let i = 0; i <= segments; i++) {
      const t = (i / segments) * Math.PI * 2;
      g.vert([offset[0] + r * Math.cos(t) * sx, offset[1] - r * Math.sin(t) * sy, offset[2] + h], [0, 0, -1], color);
    }
    for (let i = 0; i < segments; i++) g.tri(ctr, ring + i, ring + i + 1);
  }
  // Outer cap (normal +Z) when the profile ends off-axis.
  if (topCap && profile[P - 1][0] > 1e-6) {
    const [r, h] = profile[P - 1];
    const ctr = g.vert([offset[0], offset[1], offset[2] + h], [0, 0, 1], color);
    const ring = g.count;
    for (let i = 0; i <= segments; i++) {
      const t = (i / segments) * Math.PI * 2;
      g.vert([offset[0] + r * Math.cos(t) * sx, offset[1] - r * Math.sin(t) * sy, offset[2] + h], [0, 0, 1], color);
    }
    for (let i = 0; i < segments; i++) g.tri(ctr, ring + i + 1, ring + i);
  }
}

// ---------------------------------------------------------------- extrude (Z)
function pointInTri(p: number[], a: number[], b: number[], c: number[]): boolean {
  const d1 = (p[0] - b[0]) * (a[1] - b[1]) - (a[0] - b[0]) * (p[1] - b[1]);
  const d2 = (p[0] - c[0]) * (b[1] - c[1]) - (b[0] - c[0]) * (p[1] - c[1]);
  const d3 = (p[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (p[1] - a[1]);
  return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
}

/** Ear clipping for a simple CCW polygon. */
export function triangulate2D(poly: [number, number][]): number[] {
  const n = poly.length;
  if (n < 3) return [];
  const V: number[] = [];
  for (let k = 0; k < n; k++) V.push(k);
  const tris: number[] = [];
  let guard = 3 * n * n;
  let i = 0;
  while (V.length > 3 && guard-- > 0) {
    const m = V.length;
    const ia = V[(i + m - 1) % m], ib = V[i % m], ic = V[(i + 1) % m];
    const a = poly[ia], b = poly[ib], c = poly[ic];
    const cross = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    if (cross > 0) {
      let ear = true;
      for (let k = 0; k < m; k++) {
        const vk = V[k];
        if (vk === ia || vk === ib || vk === ic) continue;
        if (pointInTri(poly[vk], a, b, c)) { ear = false; break; }
      }
      if (ear) { tris.push(ia, ib, ic); V.splice(i % m, 1); continue; }
    }
    i++;
  }
  if (V.length === 3) tris.push(V[0], V[1], V[2]);
  return tris;
}

/**
 * Extrude a 2D polygon (XY) from z = z0 to z = z1 (z1 > z0).
 * Front face at z1 (+Z), back at z0 (-Z), crisp side walls.
 */
export function addExtrude(
  g: Geo, polyIn: [number, number][], z0: number, z1: number, color: RGBA,
  offset: V3 = [0, 0, 0], withBack = true,
) {
  let area2 = 0;
  for (let k = 0; k < polyIn.length; k++) {
    const p = polyIn[k], q = polyIn[(k + 1) % polyIn.length];
    area2 += p[0] * q[1] - q[0] * p[1];
  }
  const poly = area2 < 0 ? polyIn.slice().reverse() : polyIn;
  const n = poly.length;
  const tris = triangulate2D(poly);
  const ox = offset[0], oy = offset[1], oz = offset[2];

  const front = g.count;
  for (let k = 0; k < n; k++) g.vert([ox + poly[k][0], oy + poly[k][1], oz + z1], [0, 0, 1], color);
  for (let t = 0; t < tris.length; t += 3) g.tri(front + tris[t], front + tris[t + 1], front + tris[t + 2]);

  if (withBack) {
    const back = g.count;
    for (let k = 0; k < n; k++) g.vert([ox + poly[k][0], oy + poly[k][1], oz + z0], [0, 0, -1], color);
    for (let t = 0; t < tris.length; t += 3) g.tri(back + tris[t], back + tris[t + 2], back + tris[t + 1]);
  }

  for (let k = 0; k < n; k++) {
    const p0 = poly[k], p1 = poly[(k + 1) % n];
    const dx = p1[0] - p0[0], dy = p1[1] - p0[1];
    const nrm: V3 = [dy, -dx, 0];
    const a = g.vert([ox + p0[0], oy + p0[1], oz + z0], nrm, color);
    const b = g.vert([ox + p1[0], oy + p1[1], oz + z0], nrm, color);
    const c = g.vert([ox + p1[0], oy + p1[1], oz + z1], nrm, color);
    const d = g.vert([ox + p0[0], oy + p0[1], oz + z1], nrm, color);
    g.tri(a, b, c);
    g.tri(a, c, d);
  }
}

/** Stadium / rounded-rectangle outline, CCW, centred on the origin. */
export function roundedRect(w: number, h: number, r: number, arcSeg = 6): [number, number][] {
  const rr = Math.min(r, w / 2, h / 2);
  const hx = w / 2 - rr, hy = h / 2 - rr;
  const pts: [number, number][] = [];
  const corners: [number, number, number][] = [
    [hx, hy, 0], [-hx, hy, Math.PI / 2], [-hx, -hy, Math.PI], [hx, -hy, (3 * Math.PI) / 2],
  ];
  for (const [cx, cy, a0] of corners) {
    for (let k = 0; k <= arcSeg; k++) {
      const a = a0 + (k / arcSeg) * (Math.PI / 2);
      pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
    }
  }
  return pts;
}

// ---------------------------------------------------------------- flat overlays
/** Flat annulus in the XY plane facing +Z (ring around a hold). */
export function addRing(g: Geo, rIn: number, rOut: number, segments: number, color: RGBA, z = 0) {
  const start = g.count;
  for (let i = 0; i <= segments; i++) {
    const t = (i / segments) * Math.PI * 2;
    const c = Math.cos(t), s = Math.sin(t);
    g.vert([rIn * c, rIn * s, z], [0, 0, 1], color);
    g.vert([rOut * c, rOut * s, z], [0, 0, 1], color);
  }
  for (let i = 0; i < segments; i++) {
    const in0 = start + i * 2, out0 = in0 + 1, in1 = in0 + 2, out1 = in0 + 3;
    g.tri(in0, out0, out1);
    g.tri(in0, out1, in1);
  }
}

/** Flat disc in the XY plane facing +Z (dim position marker). */
export function addDisc(g: Geo, r: number, segments: number, color: RGBA, z = 0) {
  const ctr = g.vert([0, 0, z], [0, 0, 1], color);
  const ring = g.count;
  for (let i = 0; i <= segments; i++) {
    const t = (i / segments) * Math.PI * 2;
    g.vert([r * Math.cos(t), r * Math.sin(t), z], [0, 0, 1], color);
  }
  for (let i = 0; i < segments; i++) g.tri(ctr, ring + i, ring + i + 1);
}

// ---------------------------------------------------------------- textured overlays
/** position(3) normal(3) uv(2): for meshes painted by a ProceduralTextures profile row */
export const UV_LAYOUT = [
  { name: "position", components: 3 },
  { name: "normal", components: 3, normalized: true },
  { name: "texture0", components: 2 },
];

export class UVGeo {
  v: number[] = [];
  i: number[] = [];
  count = 0;

  vert(p: V3, u: number, v: number): number {
    this.v.push(p[0], p[1], p[2], 0, 0, 1, u, v);
    return this.count++;
  }

  tri(a: number, b: number, c: number) {
    this.i.push(a, b, c);
  }
}

/**
 * Flat annulus facing +Z with U = 0 at rIn and U = 1 at rOut (V fixed), so a
 * profile row paints it radially. sx / sy stretch it into an ellipse, `rot`
 * spins it (radians), `c` offsets it.
 */
export function addProfileAnnulus(
  g: UVGeo, rIn: number, rOut: number, segments: number, v: number,
  c: V3 = [0, 0, 0], sx = 1, sy = 1, rot = 0,
) {
  const start = g.count;
  const cr = Math.cos(rot), sr = Math.sin(rot);
  const at = (r: number, t: number): V3 => {
    const x = r * Math.cos(t) * sx, y = r * Math.sin(t) * sy;
    return [c[0] + x * cr - y * sr, c[1] + x * sr + y * cr, c[2]];
  };
  for (let k = 0; k <= segments; k++) {
    const t = (k / segments) * Math.PI * 2;
    g.vert(at(rIn, t), 0, v);
    g.vert(at(rOut, t), 1, v);
  }
  for (let k = 0; k < segments; k++) {
    const in0 = start + k * 2, out0 = in0 + 1, in1 = in0 + 2, out1 = in0 + 3;
    g.tri(in0, out0, out1);
    g.tri(in0, out1, in1);
  }
}

/** Flat textured quad facing +Z: corners (x0,y0)-(x1,y1), UV rect (u0,v0)-(u1,v1). */
export function addUVQuad(
  g: UVGeo, x0: number, y0: number, x1: number, y1: number, z: number,
  u0: number, v0: number, u1: number, v1: number,
) {
  const a = g.vert([x0, y0, z], u0, v0), b = g.vert([x1, y0, z], u1, v0);
  const c = g.vert([x1, y1, z], u1, v1), d = g.vert([x0, y1, z], u0, v1);
  g.tri(a, b, c);
  g.tri(a, c, d);
}

/** Flat arrow in the XY plane facing +Z, pointing +X, tip at the origin. */
export function addArrow(g: Geo, length: number, width: number, color: RGBA, z = 0) {
  const head = length * 0.55, shaft = width * 0.38;
  const poly: [number, number][] = [
    [0, 0], [-head, width / 2], [-head, shaft / 2], [-length, shaft / 2],
    [-length, -shaft / 2], [-head, -shaft / 2], [-head, -width / 2],
  ];
  addExtrude(g, poly, z - 0.5, z, color, [0, 0, 0], false);
}
