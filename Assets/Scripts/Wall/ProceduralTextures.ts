// ProceduralTextures — the two textures Next Hold draws with, built once at
// Lens start (no texture assets to ship):
//
//   profile:  a strip of radial profiles. Every overlay (ring, suggestion glow,
//             position marker, hover ring, hold contact shadow) is an annulus
//             mesh whose U runs from its inner to its outer radius, so one row
//             of this texture paints its whole look: crisp core, soft halo.
//   plywood:  a tileable pale birch-ply sheet for the wall face.
//
// The pixel math lives in pure functions (no Lens globals) so it can be read
// and checked on its own; makeTexture() is the only Lens call.

// ── profile layout (cm, shared with the meshes in NextHoldWallVisuals) ───────
/** ring: inner halo, crisp core band, outer halo */
export const RING_PROFILE = {inner: 1.2, core: 1.6, outer: 2.4}
/** suggestion glow: starts at the ring's outer edge; the target ring sits
 *  outside the "R hand" label, which hangs ~3 cm below the ring */
export const GLOW_PROFILE = {span: 8.6, ringAt: 4.8, ringW: 0.55}
/** hover ring: thin crisp band with a faint halo */
export const HOVER_PROFILE = {span: 2.7, coreAt: 0.6, coreW: 0.6}

export enum ProfileRow { Ring = 0, Glow = 1, Marker = 2, Hover = 3, Shadow = 4 }

const PROFILE_W = 512
const ROW_COUNT = 5
const ROW_H = 8
// Every row is written twice, mirrored (row k and row 2N-1-k), so the lookup
// is right whichever way up the platform stores texture rows.
const TEX_ROWS = ROW_COUNT * 2

export function profileV(row: ProfileRow): number {
  return (row * ROW_H + ROW_H / 2) / (TEX_ROWS * ROW_H)
}

function clamp01(x: number): number { return x < 0 ? 0 : x > 1 ? 1 : x }
function smoothstep(a: number, b: number, x: number): number {
  const t = clamp01((x - a) / (b - a))
  return t * t * (3 - 2 * t)
}
/** 1 inside [a, b] with anti-aliased edges `aa` wide */
function band(a: number, b: number, aa: number, x: number): number {
  return smoothstep(a - aa, a + aa, x) * (1 - smoothstep(b - aa, b + aa, x))
}
function endFade(u: number): number { return 1 - Math.pow(clamp01(u), 4) }

/** [rgb multiplier, alpha] at u in [0, 1] across the row */
type Profile = (u: number) => [number, number]

const AA = 0.07 // cm

const ringProfile: Profile = (u) => {
  const {inner, core, outer} = RING_PROFILE
  const s = u * (inner + core + outer)
  const c0 = inner, c1 = inner + core
  const coreA = band(c0, c1, AA, s)
  // tube shading: bright centre line, a darker crisp edge (reads as a neon tube)
  const t = (s - (c0 + c1) / 2) / (core / 2)
  const tube = 0.8 + 0.2 * (1 - t * t)
  const rim = 1 - 0.28 * smoothstep(0.72, 0.96, Math.abs(t))
  const haloIn = s < c0 ? 0.3 * Math.pow(s / inner, 2.2) : 0
  const haloOut = s > c1 ? 0.5 * Math.exp(-(s - c1) / 0.75) * endFade((s - c1) / outer) : 0
  const halo = Math.max(haloIn, haloOut)
  const a = Math.max(coreA, halo)
  const rgb = a > 0 ? (coreA * tube * rim + (a - coreA) * 1) / a : 1
  return [rgb, a]
}

const glowProfile: Profile = (u) => {
  const {span, ringAt, ringW} = GLOW_PROFILE
  const s = u * span
  const bloom = 0.85 * Math.exp(-s / 1.5)
  const ring = 0.95 * band(ringAt, ringAt + ringW, AA, s)
  const ringHalo = 0.28 * Math.exp(-Math.abs(s - (ringAt + ringW / 2)) / 0.55)
  return [1, Math.max(bloom, ring, ringHalo) * endFade(u)]
}

const markerProfile: Profile = (u) => {
  const dot = 1 - smoothstep(0.3, 0.36, u)
  const fill = 0.2 * band(0.33, 0.62, 0.03, u)
  const ring = band(0.6, 0.8, 0.03, u)
  const outline = band(0.8, 0.9, 0.03, u)
  const a = Math.max(dot, fill, ring, 0.6 * outline) * endFade(u)
  const rgb = outline > Math.max(ring, dot) ? 0.25 : 1
  return [rgb, a]
}

const hoverProfile: Profile = (u) => {
  const {span, coreAt, coreW} = HOVER_PROFILE
  const s = u * span
  const core = 0.95 * band(coreAt, coreAt + coreW, AA, s)
  const halo = 0.3 * Math.exp(-Math.abs(s - (coreAt + coreW / 2)) / 0.45)
  return [1, Math.max(core, halo) * endFade(u)]
}

const shadowProfile: Profile = (u) => [1, 0.6 * Math.pow(1 - smoothstep(0.2, 1, u), 1.5)]

const PROFILES: Profile[] = [ringProfile, glowProfile, markerProfile, hoverProfile, shadowProfile]

export function profilePixels(): {w: number; h: number; data: Uint8Array} {
  const w = PROFILE_W, h = TEX_ROWS * ROW_H
  const data = new Uint8Array(w * h * 4)
  for (let r = 0; r < ROW_COUNT; r++) {
    const line = new Uint8Array(w * 4)
    for (let x = 0; x < w; x++) {
      const [rgb, a] = PROFILES[r](x / (w - 1))
      const c = Math.round(clamp01(rgb) * 255)
      line[x * 4] = c
      line[x * 4 + 1] = c
      line[x * 4 + 2] = c
      line[x * 4 + 3] = Math.round(clamp01(a) * 255)
    }
    for (const row of [r, TEX_ROWS - 1 - r]) {
      for (let y = row * ROW_H; y < (row + 1) * ROW_H; y++) data.set(line, y * w * 4)
    }
  }
  return {w, h, data}
}

// ── plywood ─────────────────────────────────────────────────────────────────
/** pale birch ply; the wall material tints it down so the rings stay on top */
const BIRCH = [0.9, 0.83, 0.7]

function hash2(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295
}

/** value noise on a lattice that wraps every (px, py) cells: tileable */
function noise(x: number, y: number, px: number, py: number): number {
  const x0 = Math.floor(x), y0 = Math.floor(y)
  const fx = x - x0, fy = y - y0
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy)
  const w = (i: number, j: number) => hash2(((i % px) + px) % px, ((j % py) + py) % py)
  const a = w(x0, y0), b = w(x0 + 1, y0), c = w(x0, y0 + 1), d = w(x0 + 1, y0 + 1)
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy
}

function fbm(u: number, v: number, px: number, py: number): number {
  let sum = 0, amp = 0.5, norm = 0
  for (let o = 0; o < 3; o++) {
    const f = 1 << o
    sum += amp * noise(u * px * f, v * py * f, px * f, py * f)
    norm += amp
    amp *= 0.5
  }
  return sum / norm
}

export function plywoodPixels(n: number): {w: number; h: number; data: Uint8Array} {
  const data = new Uint8Array(n * n * 4)
  for (let y = 0; y < n; y++) {
    const v = y / n
    for (let x = 0; x < n; x++) {
      const u = x / n
      // long grain running along X, gently warped
      // (birch ply is quiet: faint, irregular figure rather than bold rings)
      const warp = fbm(u, v, 4, 8)
      const grain = 0.5 + 0.5 * Math.sin(2 * Math.PI * (v * 26 + warp * 3.2))
      const streak = fbm(u, v, 3, 64)
      const blotch = fbm(u, v, 2, 3)
      const speck = hash2(x, y)
      const k = 1 - 0.012 * grain - 0.07 * (streak - 0.5) + 0.06 * (blotch - 0.5) + 0.03 * (speck - 0.5)
      const warm = 1 - 0.03 * grain
      const i = (y * n + x) * 4
      data[i] = Math.round(clamp01(BIRCH[0] * k) * 255)
      data[i + 1] = Math.round(clamp01(BIRCH[1] * k) * 255)
      data[i + 2] = Math.round(clamp01(BIRCH[2] * k * warm) * 255)
      data[i + 3] = 255
    }
  }
  return {w: n, h: n, data}
}

// ── Lens side ───────────────────────────────────────────────────────────────
function makeTexture(p: {w: number; h: number; data: Uint8Array}): Texture {
  const tex = ProceduralTextureProvider.createWithFormat(p.w, p.h, TextureFormat.RGBA8Unorm)
  ;(tex.control as ProceduralTextureProvider).setPixels(0, 0, p.w, p.h, p.data)
  return tex
}

let profileTex: Texture | null = null
let plywoodTex: Texture | null = null

/** Shared by the wall (contact shadows) and the overlays; built once. */
export function getProfileTexture(): Texture {
  if (!profileTex) profileTex = makeTexture(profilePixels())
  return profileTex
}

export function getPlywoodTexture(): Texture {
  if (!plywoodTex) plywoodTex = makeTexture(plywoodPixels(256))
  return plywoodTex
}

/** Clone `base` (a textured Unlit material) as an alpha-blended overlay using the profile strip. */
export function overlayMaterial(base: Material, color: vec4): Material {
  const m = base.clone()
  m.mainPass.baseTex = getProfileTexture()
  m.mainPass.baseColor = color
  m.mainPass.blendMode = BlendMode.Normal
  m.mainPass.depthWrite = false
  setWrap(m, WrapMode.ClampToEdge)
  return m
}

export function setWrap(m: Material, mode: WrapMode): void {
  try {
    const s = (m.mainPass.samplers as any).baseTex as SamplerWrapper
    if (s) {
      s.wrapU = mode
      s.wrapV = mode
    }
  } catch (e) {
    // older runtimes: keep the default sampler
  }
}
