// NextHoldWallVisuals — the overlays drawn flat on the wall (brief: "Rings",
// "Position markers", "Suggested hold", "Targets ... highlight when aimed at").
//
// Owns: runtime-built overlay meshes under the wall (Ring_<id>, Marker_<limb>,
// SuggestGlow, HoverRing, setup mode's Mark_<id> "in your problem" ring and
// Tag_<id> START / TOP text, the sequence preview's badges for steps 2 and 3
// (Ghost_2..3 pill outlines with their GhostNumber_2..3 text "2 · LH", pinned on
// the hold's ring; GhostHoldRing_2..3 when that hold has no ring of its own because
// a limb is on it now; the pill and that ring wear the step's own green / yellow / red),
// the dotted GhostPath_1 (glow -> badge 2) and GhostPath_2 (badge 2 -> 3),
// and the stick figure: Figure_LH / RH / LF / RF lines from
// Figure_Torso to each limb's hold, faded where they pass behind the control
// row) and their colours. One cloned material per overlay.
// The ring line, glow and ghost badges are sized for the view distance in the state
// (viewCm, in Ground the eye's measured distance): from further back they grow so
// they read as they do at 110 cm.
// Main pushes state in with apply(); this class never scores or decides.
// Plain class (not a component): Main creates it once in onAwake.

//
// Look: every overlay is a flat annulus painted by a ProceduralTextures
// profile row (crisp core + soft halo), alpha-blended over the wall. Ring hue
// lives in mainPass.baseColor (tests classify it); the halo is in the texture.

import {UVGeo, UV_LAYOUT, addProfileAnnulus} from "./Wall/MeshKit"
import {HOLDS, HOLD_SIZE, HoldDef} from "./Wall/WallLayout"
import {GLOW_PROFILE, HOVER_PROFILE, ProfileRow, RING_PROFILE, overlayMaterial, profileV} from "./Wall/ProceduralTextures"

export type RingColour = "green" | "yellow" | "red"

export interface OverlayState {
  /** ring colour per hold id; null/absent = no ring (occupied, or setup mode) */
  rings: {[id: string]: RingColour | null}
  /** hold whose ring glows (the suggestion), or null */
  glowHoldId: string | null
  /** limb -> hold id for the dim position markers */
  position: {[limb: string]: string | null}
  selectedLimb: string | null
  showMarkers: boolean
  /** setup mode: holds marked as part of "your problem" (thin pale ring); empty outside setup */
  marks: {[id: string]: boolean}
  /** tag text by a hold: in setup under each marked hold ("START", "TOP"); in Ground's climb view
   *  "TOP" over the problem's top hold. Absent = no tag */
  tags: {[id: string]: string}
  /** tags sit above the hold's ring (climb: the top of the problem) instead of under it (setup) */
  tagsAbove?: boolean
  /** sequence preview: the next moves in order, each a hold and the limb that moves there. Step 1
   *  is the suggestion (its glow and label show it); steps 2 and 3 get a badge "2 · LH" pinned on
   *  their hold's ring. Empty = none */
  ghosts: GhostStep[]
  /** the suggestion label's box in wall cm (centre and half sizes), kept clear by the badges and
   *  the dotted path; absent = no label */
  labelBox?: {x: number; y: number; hw: number; hh: number} | null
  /** the distance (cm) the overlay is drawn to be read from; absent = DESIGN_VIEW_CM.
   *  The ring line and the ghost badges grow with it (see readSize). */
  viewCm?: number
  /** how much larger the suggestion label is drawn than its 110 cm size; absent = 1. The glow
   *  grows with it, so its target ring stays outside the label as it does on the wall. */
  labelScale?: number
  /** stick figure: the torso point in wall cm (the centre of mass the scoring uses); null = no figure */
  torso: {x: number; y: number} | null
}

export interface FigureBody {
  shoulders: {L: WallPt; R: WallPt}
  hips: {L: WallPt; R: WallPt}
  armLength: number
  legLength: number
  /** head radius (cm) */
  headR: number
}

/** one step of the look-ahead: the hold, the limb that moves onto it, and how secure that move is
 *  for you at its turn (its tag, and the ring it puts on a hold a limb is on now, wear this colour) */
export interface GhostStep {hold: string; limb: string; colour: RingColour}

export interface OverlayColours {
  green: vec4
  yellow: vec4
  red: vec4
}

const RING_W = RING_PROFILE.core // crisp ring band width, cm (1.6)
const RING_Z = 0.4          // just proud of the wall face
const RING_DIM = 0.8       // non-suggested rings: a little dimmer than the glowing one
const SEG = 64
const MARKER_R = 2.6
const MARKER_DIM = 0.42     // "small dim marker"
const MARKER_SELECTED = 0.95
const HOVER_COLOR = new vec4(0.95, 0.97, 1.0, 1)
/** setup mode "in your problem" ring: pale blue-white, distinct from the hover ring and the score colours */
const MARK_COLOR = new vec4(0.62, 0.86, 1.0, 1)
const TAG_COLOR = new vec4(0.8, 0.93, 1.0, 1)
/** Text sizes on the overlay canvas (same scale as the UI modules' 110 cm roles) */
const TAG_SIZE = 44
/** from the ring line's outer edge to the tag's centre (cm at 110 cm), and half the tag's box per
 *  letter and in height ("TOP" at TAG_SIZE is about 3.4 x 1.6 cm) */
const TAG_GAP = 1.8
/** the climbing "TOP" over the problem's top hold: the goal of the whole sequence, a step larger */
const TOP_TAG_SIZE = 60
const TAG_HALF_W_PER_CHAR = 0.6
const TAG_HALF_H = 0.9
/** sequence preview: steps 2 and 3 as small, light badges "2 · LH" (they must read on the additive
 *  display). Step 1 has no badge: the glowing suggestion with its label already is step 1. */
const GHOST_COUNT = 3
/** a badge is a pill: half its height (cm, at 110 cm) and half its text's width at GHOST_NUMBER_SIZE */
const GHOST_R = 2.6
const BADGE_TEXT_HALF_W = 2.9
const BADGE_PAD = 0.8
const GHOST_COLOR = new vec4(0.86, 0.93, 1.0, 0.95)
const GHOST_NUMBER_COLOR = new vec4(0.95, 0.98, 1.0, 1)
const GHOST_NUMBER_SIZE = 64
/** clock positions a badge tries on its hold's ring, in order: on top, below, the sides, the diagonals */
const BADGE_ANGLES_DEG = [90, -90, 0, 180, 45, 135, -45, -135]
/** gap (cm) between the badge's outline and its own hold's ring line: it is pinned on the ring */
const BADGE_PIN_GAP = 0.4
/** a badge keeps at least this far (cm) from any other hold's ring, so its nearest ring is its own */
const BADGE_OTHER_GAP = 3
/** the glow's outer ring and the faint halo just past it, in the glow profile's cm (x its scale):
 *  a badge whose outline reaches inside this has the ring running through its text */
export const GLOW_CLEAR = GLOW_PROFILE.ringAt + GLOW_PROFILE.ringW + 1.0
/** gap (cm) between a badge and the glow or the label it keeps clear of */
const GHOST_GLOW_GAP = 0.5
/** sequence path: a thin, light dotted line from the glow to badge 2 to badge 3 */
const GHOST_PATH_COLOR = new vec4(0.86, 0.93, 1.0, 0.7)
const GHOST_DOT_R = 0.32
const GHOST_DOT_STEP = 1.5
/** the path keeps this far (cm) from badges, the glow and the label */
const GHOST_PATH_GAP = 0.8
/** Overlays write no depth, so their draw order is set here, not left to the engine's sort:
 *  glow and rings first, then the sequence path, the badges, and the numbers on top of all of them */
export const ORDER_PATH = 1
export const ORDER_GHOST = 2
export const ORDER_GHOST_NUMBER = 3
/** stick figure: thin light lines on the wall plane, under the rings and the markers */
const FIGURE_COLOR = new vec4(0.95, 0.94, 0.88, 0.8)
const FIGURE_Z = 0.25
const FIGURE_TORSO_R = 2.2
/** where the figure passes behind the control row it fades out: fully faded from GAP cm
 *  outside the panel's outline (as seen from the eye) inward, ramping back up over RAMP cm */
const FIGURE_FADE_GAP = 1.5
const FIGURE_FADE_RAMP = 4
/** torso alpha when the torso point itself is behind the panel */
const FIGURE_TORSO_HIDDEN = 0.05
/** glow breathing: alpha range of the suggestion's halo */
const GLOW_MIN = 0.6
const GLOW_MAX = 1.0

/** Text and overlay sizes are set for reading at 110 cm (the UI type scale). */
export const DESIGN_VIEW_CM = 110
/** Body text size on the 110 cm scale: the smallest text meant to be read */
export const BODY_TEXT_SIZE = 39

/** Text size that reads from viewCm at least as large as Body does at 110 cm (apparent size goes as 1 / distance).
 *  Rounded up to 0.1: Text.size is stored as a 32-bit float and would otherwise land a hair under. */
export function minReadSize(viewCm: number): number {
  return Math.ceil(((BODY_TEXT_SIZE * viewCm) / DESIGN_VIEW_CM) * 10) / 10
}

/** The ring's crisp line, as wide (cm) as it must be from viewCm to look as wide as its 110 cm width. */
export function ringLineWidth(viewCm: number): number {
  return RING_W * Math.max(1, viewCm / DESIGN_VIEW_CM)
}

/** a point in wall cm (x from the left edge, y up) */
export interface WallPt {x: number; y: number}

function toMesh(g: UVGeo): RenderMesh {
  const b = new MeshBuilder(UV_LAYOUT)
  b.topology = MeshTopology.Triangles
  b.indexType = MeshIndexType.UInt16
  b.appendVerticesInterleaved(g.v)
  b.appendIndices(g.i)
  b.updateMesh()
  return b.getMesh()
}

function scaled(c: vec4, k: number): vec4 {
  return new vec4(c.x * k, c.y * k, c.z * k, c.w)
}

/** Outward unit normals of a convex polygon's edges, whichever way it winds. */
function edgeNormals(poly: WallPt[]): {p: WallPt; nx: number; ny: number}[] {
  let area = 0
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length]
    area += a.x * b.y - b.x * a.y
  }
  const sign = area >= 0 ? 1 : -1 // counter-clockwise: outward is (dy, -dx)
  return poly.map((a, i) => {
    const b = poly[(i + 1) % poly.length]
    const dx = b.x - a.x, dy = b.y - a.y
    const l = Math.hypot(dx, dy) || 1
    return {p: a, nx: (sign * dy) / l, ny: (-sign * dx) / l}
  })
}

/** True if p is inside the convex polygon grown by `margin` cm. */
export function insideConvex(poly: WallPt[], p: WallPt, margin: number): boolean {
  return edgeNormals(poly).every((e) => e.nx * (p.x - e.p.x) + e.ny * (p.y - e.p.y) <= margin)
}

/** The part of segment a -> b inside the convex polygon grown by `margin` cm, as t0..t1 along it; null if none. */
export function clipConvex(poly: WallPt[], a: WallPt, b: WallPt, margin: number): {t0: number; t1: number} | null {
  let t0 = 0, t1 = 1
  for (const e of edgeNormals(poly)) {
    const num = e.nx * (a.x - e.p.x) + e.ny * (a.y - e.p.y) - margin
    const den = e.nx * (b.x - a.x) + e.ny * (b.y - a.y)
    if (Math.abs(den) < 1e-9) {
      if (num > 0) return null
      continue
    }
    const t = -num / den
    if (den > 0) t1 = Math.min(t1, t)
    else t0 = Math.max(t0, t)
    if (t0 > t1) return null
  }
  return {t0, t1}
}

/** a placed badge: its centre, the hold it belongs to, its angle (rad) and distance from that hold,
 *  and its pill's half straight length L and end radius R (cm) */
interface GhostAt {x: number; y: number; hold: HoldDef; a: number; d: number; L: number; R: number}

/** Distance (cm) from point p to a horizontal pill (centre c, half straight length L, end radius R); < 0 inside. */
export function pillDistance(c: WallPt, L: number, R: number, p: WallPt): number {
  const dx = Math.max(0, Math.abs(p.x - c.x) - L)
  return Math.hypot(dx, p.y - c.y) - R
}

/** Distance (cm) from a horizontal pill to an axis-aligned box (centre b, half sizes hw, hh); < 0 overlapping. */
function pillBoxDistance(c: WallPt, L: number, R: number, b: {x: number; y: number; hw: number; hh: number}): number {
  const dx = Math.max(0, Math.abs(c.x - b.x) - L - b.hw)
  const dy = Math.max(0, Math.abs(c.y - b.y) - b.hh)
  return Math.hypot(dx, dy) - R
}

/** Distance (cm) between two horizontal pills; < 0 overlapping. */
function pillPillDistance(a: GhostAt, c: WallPt, L: number, R: number): number {
  const dx = Math.max(0, Math.abs(a.x - c.x) - a.L - L)
  return Math.hypot(dx, a.y - c.y) - a.R - R
}


export class NextHoldWallVisuals {
  private group: SceneObject
  private rings: {[id: string]: {so: SceneObject; mat: Material}} = {}
  private markers: {[limb: string]: {so: SceneObject; mat: Material}} = {}
  private glow: {so: SceneObject; mat: Material; meshes: {[r: string]: RenderMesh}; rmv: RenderMeshVisual}
  private hover: {so: SceneObject; rmv: RenderMeshVisual; meshes: {[r: string]: RenderMesh}}
  private marks: {[id: string]: {so: SceneObject; mat: Material}} = {}
  private textGroup: SceneObject
  private tags: {[id: string]: {so: SceneObject; text: Text}} = {}
  /** badges for steps 2 and 3 (index 0 = step 2): the pill outline, its text, and a thin ring on the
   *  hold for when the hold has no ring of its own (a limb is on it now and leaves it first) */
  private ghosts: {ring: {so: SceneObject; mat: Material}; label: {so: SceneObject; text: Text}; holdRing: {so: SceneObject; mat: Material}}[] = []
  private pillMeshes: {[k: string]: RenderMesh} = {}
  /** path 1 joins the glow (step 1) to badge 2, path 2 badge 2 to badge 3 */
  private ghostPaths: {so: SceneObject; rmv: RenderMeshVisual}[] = []
  private dotMeshes: {[k: string]: RenderMesh} = {}
  private figure: {[limb: string]: {so: SceneObject; rmv: RenderMeshVisual}} = {}
  private torso: {so: SceneObject; mat: Material}
  /** the control row's outline on the wall as seen from the eye (wall cm), or null */
  private figureMask: WallPt[] | null = null
  private lineMeshes: {[k: string]: RenderMesh} = {}
  private state: OverlayState | null = null
  private ringMeshes: {[r: string]: RenderMesh} = {}
  private thinMeshes: {[r: string]: RenderMesh} = {}

  constructor(
    private wallRoot: SceneObject,
    private wallToLocal: (x: number, y: number, z?: number) => vec3,
    private material: Material,
    private colours: OverlayColours,
  ) {}

  build(): void {
    this.group = global.scene.createSceneObject("Overlays")
    this.group.setParent(this.wallRoot)

    for (const h of HOLDS) {
      const r = HOLD_SIZE[h.type].ringR
      const so = this.makeVisual("Ring_" + h.id, this.ringMesh(r, RING_W))
      so.so.getTransform().setLocalPosition(this.wallToLocal(h.x, h.y, RING_Z))
      so.so.enabled = false
      this.rings[h.id] = so

      const mark = this.makeVisual("Mark_" + h.id, this.thinRingMesh(r))
      mark.mat.mainPass.baseColor = MARK_COLOR
      mark.so.getTransform().setLocalPosition(this.wallToLocal(h.x, h.y, RING_Z))
      mark.so.enabled = false
      this.marks[h.id] = mark
    }

    // the glow sits under the ghosts by render order (see ORDER_*), not by hierarchy: overlays
    // write no depth, and the engine's own sort put the glow's ring over ghost 1's number
    const glowMeshes: {[r: string]: RenderMesh} = {}
    const glowVis = this.makeVisual("SuggestGlow", this.glowMesh(glowMeshes, 10))
    glowVis.so.enabled = false
    this.glow = {...glowVis, meshes: glowMeshes, rmv: glowVis.so.getComponent("Component.RenderMeshVisual") as RenderMeshVisual}

    // text on the wall (setup tags) lives under a world-space canvas, like the UI modules' text
    this.textGroup = global.scene.createSceneObject("OverlayText")
    this.textGroup.setParent(this.group)
    this.textGroup.createComponent("Component.Canvas")
    for (const h of HOLDS) {
      const r = HOLD_SIZE[h.type].ringR
      const t = this.makeText("Tag_" + h.id, this.wallToLocal(h.x, h.y - r - 2.4, RING_Z + 0.2), TAG_SIZE, TAG_COLOR)
      t.so.enabled = false
      this.tags[h.id] = t
    }

    for (let n = 1; n < GHOST_COUNT; n++) {
      const p = this.makeVisual("GhostPath_" + n, this.dotsMesh([{x: 0, y: 0}], 1))
      p.mat.mainPass.baseColor = GHOST_PATH_COLOR
      p.so.enabled = false
      const rmv = p.so.getComponent("Component.RenderMeshVisual") as RenderMeshVisual
      rmv.setRenderOrder(ORDER_PATH)
      this.ghostPaths.push({so: p.so, rmv})
    }
    for (let n = 2; n <= GHOST_COUNT; n++) {
      const ring = this.makeVisual("Ghost_" + n, this.pillMesh(1, GHOST_R))
      ring.mat.mainPass.baseColor = GHOST_COLOR
      ring.so.enabled = false
      ;(ring.so.getComponent("Component.RenderMeshVisual") as RenderMeshVisual).setRenderOrder(ORDER_GHOST)
      // a ring like every other, in the step's colour (set in apply)
      const holdRing = this.makeVisual("GhostHoldRing_" + n, this.ringMesh(9, RING_W))
      holdRing.so.enabled = false
      const label = this.makeText("GhostNumber_" + n, vec3.zero(), GHOST_NUMBER_SIZE, GHOST_NUMBER_COLOR)
      label.text.text = "" + n
      label.text.setRenderOrder(ORDER_GHOST_NUMBER)
      label.so.enabled = false
      this.ghosts.push({ring, label, holdRing})
    }

    // stick figure: one unit-long line mesh along +X, stretched and turned per limb
    const lineMesh = this.lineMesh([{t: 0, f: 1}, {t: 1, f: 1}])
    for (const limb of ["LH", "RH", "LF", "RF"]) {
      const f = this.makeVisual("Figure_" + limb, lineMesh)
      f.mat.mainPass.baseColor = FIGURE_COLOR
      f.so.enabled = false
      this.figure[limb] = {so: f.so, rmv: f.so.getComponent("Component.RenderMeshVisual") as RenderMeshVisual}
    }
    const torsoGeo = new UVGeo()
    addProfileAnnulus(torsoGeo, 0, FIGURE_TORSO_R, 32, profileV(ProfileRow.Marker))
    const torso = this.makeVisual("Figure_Torso", toMesh(torsoGeo))
    torso.mat.mainPass.baseColor = FIGURE_COLOR
    torso.so.enabled = false
    this.torso = torso

    const disc = new UVGeo()
    addProfileAnnulus(disc, 0, MARKER_R, 40, profileV(ProfileRow.Marker))
    const discMesh = toMesh(disc)
    for (const limb of ["LH", "RH", "LF", "RF"]) {
      const m = this.makeVisual("Marker_" + limb, discMesh)
      m.so.enabled = false
      this.markers[limb] = m
    }

    const hoverMeshes: {[r: string]: RenderMesh} = {}
    const hoverVis = this.makeVisual("HoverRing", this.hoverMesh(hoverMeshes, 12))
    hoverVis.mat.mainPass.baseColor = HOVER_COLOR
    hoverVis.so.enabled = false
    this.hover = {so: hoverVis.so, rmv: hoverVis.so.getComponent("Component.RenderMeshVisual") as RenderMeshVisual, meshes: hoverMeshes}
  }

  apply(s: OverlayState): void {
    this.state = s
    const viewCm = s.viewCm || DESIGN_VIEW_CM
    const ringW = ringLineWidth(viewCm)
    const gs = Math.max(1, s.labelScale || 1)
    for (const h of HOLDS) {
      const ring = this.rings[h.id]
      const c = s.rings[h.id]
      ring.so.enabled = !!c
      if (c) {
        ring.mat.mainPass.baseColor = scaled(this.colours[c], h.id === s.glowHoldId ? 1 : RING_DIM)
        ;(ring.so.getComponent("Component.RenderMeshVisual") as RenderMeshVisual).mesh = this.ringMesh(HOLD_SIZE[h.type].ringR, ringW)
      }
      this.marks[h.id].so.enabled = !!s.marks[h.id]
      const tag = s.tags[h.id]
      const t = this.tags[h.id]
      t.so.enabled = !!tag
      if (tag) {
        t.text.text = tag
        // tags grow with the distance like the ring line
        const tk = Math.max(1, viewCm / DESIGN_VIEW_CM) * (s.tagsAbove ? TOP_TAG_SIZE / TAG_SIZE : 1)
        t.text.size = TAG_SIZE * tk
        const r = HOLD_SIZE[h.type].ringR + ringW / 2
        const dy = s.tagsAbove ? r + TAG_GAP * tk : -(r + TAG_GAP * tk)
        t.so.getTransform().setLocalPosition(this.wallToLocal(h.x, h.y + dy, RING_Z + 0.2))
      }
    }

    const glowHold = s.glowHoldId ? this.holdDef(s.glowHoldId) : null
    const glowColour = s.glowHoldId ? s.rings[s.glowHoldId] : null

    // Step 1 is the glowing suggestion with its label: no badge. Steps 2 and 3 get a pill badge
    // "2 · LH" pinned on their own hold's ring (on the glow's outer ring if that hold glows), at the
    // first clock position where the badge is clear of the glow, the label, the badge before it and
    // every other hold's ring by BADGE_OTHER_GAP, so the nearest ring to a badge is always its own.
    // A hold with no ring of its own (a limb is on it now) gets a thin light ring to pin onto.
    // From further back the badge grows until its text reads at least as large as Body at 110 cm.
    const gk = Math.max(GHOST_NUMBER_SIZE, minReadSize(viewCm)) / GHOST_NUMBER_SIZE
    const badgeR = GHOST_R * gk
    const badgeL = Math.max(0, (BADGE_TEXT_HALF_W + BADGE_PAD) * gk - badgeR)
    const glowOn = !!glowHold && !!glowColour
    const glowClear = glowOn ? HOLD_SIZE[glowHold!.type].ringR + ringW / 2 + GLOW_CLEAR * gs : 0
    const steps = s.ghosts.slice(0, GHOST_COUNT)
    const label = s.labelBox || null
    // boxes the badges keep clear of: the label and any tag on the wall ("TOP")
    const boxes = label ? [label] : []
    for (const id of Object.keys(s.tags)) {
      const th = this.holdDef(id)
      if (!th || !s.tags[id]) continue
      const p = this.tags[id].so.getTransform().getLocalPosition()
      const tk = this.tags[id].text.size / TAG_SIZE
      boxes.push({x: th.x, y: p.y, hw: s.tags[id].length * TAG_HALF_W_PER_CHAR * tk, hh: TAG_HALF_H * tk})
    }
    const at: GhostAt[] = []
    for (let i = 0; i < this.ghosts.length; i++) {
      const g = this.ghosts[i]
      const step = steps[i + 1]
      const h = step ? this.holdDef(step.hold) : null
      g.ring.so.enabled = !!h
      g.label.so.enabled = !!h
      g.holdRing.so.enabled = false
      if (!h) continue
      const onGlow = glowOn && h.id === glowHold!.id
      const ownRing = !!s.rings[h.id]
      const edge = onGlow ? glowClear : HOLD_SIZE[h.type].ringR + ringW / 2
      const place = (deg: number) => {
        const a = (deg * Math.PI) / 180, ux = Math.cos(a), uy = Math.sin(a)
        // the pill's support toward the hold: its straight part counts along x only
        const d = edge + BADGE_PIN_GAP + badgeL * Math.abs(ux) + badgeR
        return {a, d, x: h.x + d * ux, y: h.y + d * uy}
      }
      // how clear (cm) a badge at c is of everything it must not touch: < 0 = it does
      const clearance = (c: WallPt) => {
        let m = 1e9
        if (c.x - badgeL - badgeR < 0 || c.x + badgeL + badgeR > 240) m = Math.min(m, -1)
        if (glowOn && !onGlow) m = Math.min(m, pillDistance(c, badgeL, badgeR, glowHold!) - glowClear - GHOST_GLOW_GAP)
        for (const b of boxes) m = Math.min(m, pillBoxDistance(c, badgeL, badgeR, b) - GHOST_GLOW_GAP)
        for (const p of at) m = Math.min(m, pillPillDistance(p, c, badgeL, badgeR) - GHOST_GLOW_GAP)
        for (const o of HOLDS) {
          if (o.id === h.id) continue
          // another hold's ring circle (drawn or not): the badge's nearest ring must stay its own
          const r = HOLD_SIZE[o.type].ringR + ringW / 2
          m = Math.min(m, pillDistance(c, badgeL, badgeR, o) - r - BADGE_OTHER_GAP)
        }
        return m
      }
      let best = place(BADGE_ANGLES_DEG[0]), bestClear = -1e9
      for (const deg of BADGE_ANGLES_DEG) {
        const p = place(deg)
        const c = clearance(p)
        if (c >= 0) { best = p; bestClear = c; break }
        if (c > bestClear) { best = p; bestClear = c }
      }
      at.push({x: best.x, y: best.y, hold: h, a: best.a, d: best.d, L: badgeL, R: badgeR})
      ;(g.ring.so.getComponent("Component.RenderMeshVisual") as RenderMeshVisual).mesh = this.pillMesh(badgeL, badgeR)
      g.label.text.size = GHOST_NUMBER_SIZE * gk
      g.label.text.text = (i + 2) + " · " + step.limb
      g.ring.so.getTransform().setLocalPosition(this.wallToLocal(best.x, best.y, RING_Z + 0.15))
      g.label.so.getTransform().setLocalPosition(this.wallToLocal(best.x, best.y, RING_Z + 0.3))
      if (!ownRing && !onGlow) {
        // a limb is on this hold now, so it has no ring of its own: it gets an ordinary ring in
        // the colour of the step that moves onto it (never white)
        ;(g.holdRing.so.getComponent("Component.RenderMeshVisual") as RenderMeshVisual).mesh = this.ringMesh(HOLD_SIZE[h.type].ringR, ringW)
        g.holdRing.mat.mainPass.baseColor = scaled(this.colours[step.colour], RING_DIM)
        g.holdRing.so.getTransform().setLocalPosition(this.wallToLocal(h.x, h.y, RING_Z))
        g.holdRing.so.enabled = true
      }
    }
    this.applyGhostPath(at, gk, ringW, glowOn ? glowHold! : null, glowClear, label)

    this.applyFigure(s)

    if (glowHold && glowColour) {
      const r = HOLD_SIZE[glowHold.type].ringR
      this.glow.rmv.mesh = this.glowMesh(this.glow.meshes, r, ringW, gs)
      this.glow.so.getTransform().setLocalPosition(this.wallToLocal(glowHold.x, glowHold.y, RING_Z + 0.05))
      this.glow.so.enabled = true
      this.setGlowColour(glowColour, GLOW_MAX)
    } else {
      this.glow.so.enabled = false
    }

    for (const limb of ["LH", "RH", "LF", "RF"]) {
      const m = this.markers[limb]
      const id = s.position[limb]
      const h = id ? this.holdDef(id) : null
      m.so.enabled = s.showMarkers && !!h
      if (!h) continue
      // in front of the hold so it isn't hidden by the hold's bulk;
      // nudge the four markers apart a little if two limbs share a hold
      const nudge = (["LH", "RH", "LF", "RF"].indexOf(limb) - 1.5) * 0.01
      m.so.getTransform().setLocalPosition(this.wallToLocal(h.x, h.y, HOLD_SIZE[h.type].d * 1.4 + 1 + nudge))
      const k = limb === s.selectedLimb ? MARKER_SELECTED : MARKER_DIM
      m.mat.mainPass.baseColor = new vec4(k, k, k, 1)
      // the tag's outline says how secure its move is at its turn; the text stays light to read
      g.ring.mat.mainPass.baseColor = this.colours[step.colour]
    }
  }

  /**
   * Sequence path: dots from the glow (step 1) to badge 2, and from badge 2 to badge 3. Between two
   * holds it is a straight line; two badges on one hold are joined by an arc around the hold the
   * short way, so a match reads as one step on the same hold rather than a line across it. No dot
   * sits inside the glow's outer ring, the label's box, a badge or a hold's ring, each with a
   * GHOST_PATH_GAP margin: the path runs edge to edge. Dots grow with the ring line (k).
   */
  private applyGhostPath(at: GhostAt[], k: number, ringW: number, glow: HoldDef | null, glowClear: number,
                         label: {x: number; y: number; hw: number; hh: number} | null): void {
    const step = GHOST_DOT_STEP * k
    const gap = GHOST_PATH_GAP + GHOST_DOT_R * k
    const line = (a: WallPt, b: WallPt): WallPt[] => {
      const full = Math.hypot(b.x - a.x, b.y - a.y)
      if (full <= step) return []
      const n = Math.max(2, Math.round(full / step) + 1)
      const out: WallPt[] = []
      for (let j = 0; j < n; j++) out.push({x: a.x + ((b.x - a.x) * j) / (n - 1), y: a.y + ((b.y - a.y) * j) / (n - 1)})
      return out
    }
    for (let i = 0; i < this.ghostPaths.length; i++) {
      const p = this.ghostPaths[i]
      p.so.enabled = false
      let pts: WallPt[] = []
      let origin: WallPt
      if (i === 0) {
        // the glow (step 1) to badge 2
        const b = at[0]
        if (!glow || !b || b.hold.id === glow.id) continue
        pts = line(glow, b)
        origin = glow
      } else {
        const a = at[i - 1], b = at[i]
        if (!a || !b) continue
        origin = a.hold
        if (a.hold.id === b.hold.id) {
          const r = (a.d + b.d) / 2
          let da = b.a - a.a
          while (da > Math.PI) da -= 2 * Math.PI
          while (da <= -Math.PI) da += 2 * Math.PI
          const n = Math.max(2, Math.round((Math.abs(da) * r) / step) + 1)
          for (let j = 0; j < n; j++) {
            const t = a.a + (da * j) / (n - 1)
            pts.push({x: a.hold.x + r * Math.cos(t), y: a.hold.y + r * Math.sin(t)})
          }
        } else pts = line(a, b)
      }
      pts = pts.filter((q) =>
        !(glow && Math.hypot(q.x - glow.x, q.y - glow.y) < glowClear + gap) &&
        !(label && Math.abs(q.x - label.x) < label.hw + gap && Math.abs(q.y - label.y) < label.hh + gap) &&
        !at.some((g) => pillDistance(g, g.L, g.R, q) < gap) &&
        // no dots over a hold: the line passes under it, inside its ring's outer line edge
        !HOLDS.some((h) => Math.hypot(q.x - h.x, q.y - h.y) < HOLD_SIZE[h.type].ringR + ringW / 2))
      if (!pts.length) continue
      p.so.getTransform().setLocalPosition(this.wallToLocal(origin.x, origin.y, RING_Z + 0.1))
      p.rmv.mesh = this.dotsMesh(pts.map((q) => ({x: q.x - origin.x, y: q.y - origin.y})), k)
      p.so.enabled = true
    }
  }

  /**
   * The control row's outline on the wall plane as seen from the eye (wall cm, convex), or null.
   * The figure fades out behind it, so no line runs across the buttons; Main updates it when
   * the row or the head moves.
   */
  setFigureMask(mask: WallPt[] | null): void {
    this.figureMask = mask && mask.length >= 3 ? mask.map((p) => ({x: p.x, y: p.y})) : null
    if (this.state) this.applyFigure(this.state)
  }

  /** Stick figure: a line from the torso point to each limb's hold; a limb off the wall has none. */
  private applyFigure(s: OverlayState): void {
    const t = s.torso
    this.torso.so.enabled = !!t
    if (t) {
      this.torso.so.getTransform().setLocalPosition(this.wallToLocal(t.x, t.y, FIGURE_Z + 0.02))
      const hidden = this.figureMask && insideConvex(this.figureMask, t, FIGURE_FADE_GAP + FIGURE_TORSO_R)
      const c = FIGURE_COLOR
      this.torso.mat.mainPass.baseColor = new vec4(c.x, c.y, c.z, hidden ? c.w * FIGURE_TORSO_HIDDEN : c.w)
    }
    for (const limb of ["LH", "RH", "LF", "RF"]) {
      const f = this.figure[limb]
      const id = s.position[limb]
      const h = id ? this.holdDef(id) : null
      f.so.enabled = !!t && !!h
      if (!t || !h) continue
      const dx = h.x - t.x, dy = h.y - t.y
      const len = Math.max(0.01, Math.hypot(dx, dy))
      const tr = f.so.getTransform()
      tr.setLocalPosition(this.wallToLocal(t.x, t.y, FIGURE_Z))
      tr.setLocalRotation(quat.fromEulerAngles(0, 0, Math.atan2(dy, dx)))
      tr.setLocalScale(new vec3(len, 1, 1))
      f.rmv.mesh = this.lineMesh(this.fadeStations(t, h, len))
    }
  }

  /**
   * Brightness stations along a line from a to b (t 0..1, f 0..1, linear in between):
   * f = 0 over the stretch inside the mask grown by FIGURE_FADE_GAP, ramping to 1 over
   * FIGURE_FADE_RAMP cm on either side of it; a line clear of the mask is one bright run.
   */
  private fadeStations(a: WallPt, b: WallPt, len: number): {t: number; f: number}[] {
    const span = this.figureMask ? clipConvex(this.figureMask, a, b, FIGURE_FADE_GAP) : null
    if (!span) return [{t: 0, f: 1}, {t: 1, f: 1}]
    const ramp = FIGURE_FADE_RAMP / len
    const f = (t: number) => {
      const out = t < span.t0 ? span.t0 - t : t > span.t1 ? t - span.t1 : 0
      return Math.min(1, out / ramp)
    }
    const ts = [0, span.t0 - ramp, span.t0, span.t1, span.t1 + ramp, 1]
      .map((t) => Math.min(1, Math.max(0, t)))
      .sort((p, q) => p - q)
    const out: {t: number; f: number}[] = []
    for (const t of ts) {
      if (out.length && t - out[out.length - 1].t < 1e-4) continue
      out.push({t, f: Math.round(f(t) * 100) / 100})
    }
    return out
  }

  /** Called every frame: the glow on the suggested ring breathes. */
  tick(time: number): void {
    if (!this.state || !this.glow.so.enabled || !this.state.glowHoldId) return
    const c = this.state.rings[this.state.glowHoldId]
    if (!c) return
    const breath = 0.5 + 0.5 * Math.sin(time * Math.PI * 2 * 0.8)
    this.setGlowColour(c, GLOW_MIN + (GLOW_MAX - GLOW_MIN) * breath)
  }

  /** the glow keeps the ring's full hue; it breathes in opacity, not in colour */
  private setGlowColour(c: RingColour, alpha: number): void {
    const col = this.colours[c]
    this.glow.mat.mainPass.baseColor = new vec4(col.x, col.y, col.z, alpha)
  }

  setHover(id: string | null): void {
    const h = id ? this.holdDef(id) : null
    if (!h) {
      this.hover.so.enabled = false
      return
    }
    const r = HOLD_SIZE[h.type].ringR
    this.hover.rmv.mesh = this.hoverMesh(this.hover.meshes, r)
    this.hover.so.getTransform().setLocalPosition(this.wallToLocal(h.x, h.y, RING_Z + 0.1))
    this.hover.so.enabled = true
  }

  isRingVisible(id: string): boolean {
    const r = this.rings[id]
    return !!r && r.so.enabled
  }

  isMarkVisible(id: string): boolean {
    const m = this.marks[id]
    return !!m && m.so.enabled
  }

  /** the setup tag shown under the hold ("START", "TOP"), or null */
  tagText(id: string): string | null {
    const t = this.tags[id]
    return t && t.so.enabled ? t.text.text : null
  }

  /** the hold of look-ahead step n (1-based) as shown: step 1 by the glow, steps 2 and 3 by their
   *  badge; null when it isn't shown */
  ghostHold(n: number): string | null {
    const s = this.state
    const step = s ? s.ghosts[n - 1] : null
    if (!step) return null
    if (n === 1) return this.glow.so.enabled && s!.glowHoldId === step.hold ? step.hold : null
    const g = this.ghosts[n - 2]
    return g && g.ring.so.enabled ? step.hold : null
  }

  isGlowOn(id: string): boolean {
    return !!this.state && this.state.glowHoldId === id && this.glow.so.enabled
  }

  markerHold(limb: string): string | null {
    const m = this.markers[limb]
    return m && m.so.enabled && this.state ? this.state.position[limb] : null
  }

  /** the control row outline the figure fades behind (wall cm), or null */
  getFigureMask(): WallPt[] | null {
    return this.figureMask ? this.figureMask.map((p) => ({x: p.x, y: p.y})) : null
  }

  // ── helpers ───────────────────────────────────────────────────────────────
  private holdDef(id: string): HoldDef | null {
    for (const h of HOLDS) if (h.id === id) return h
    return null
  }

  /**
   * Ring with its crisp core w cm wide, centred on radius r, halo inside and out. Built from three
   * annuli (inner halo, core, outer halo) so a wider core keeps the halos at their own width.
   */
  private ringMesh(r: number, w: number): RenderMesh {
    const key = r + "/" + w
    if (!this.ringMeshes[key]) {
      const {inner, core, outer} = RING_PROFILE
      const total = inner + core + outer
      const c0 = r - w / 2, c1 = r + w / 2
      const v = profileV(ProfileRow.Ring)
      const g = new UVGeo()
      addProfileAnnulus(g, Math.max(0, c0 - inner), c0, SEG, v, [0, 0, 0], 1, 1, 0, 0, inner / total)
      addProfileAnnulus(g, c0, c1, SEG, v, [0, 0, 0], 1, 1, 0, inner / total, (inner + core) / total)
      addProfileAnnulus(g, c1, c1 + outer, SEG, v, [0, 0, 0], 1, 1, 0, (inner + core) / total, 1)
      // Ground's line width follows the eye's distance: don't let walking about grow the cache without end
      if (Object.keys(this.ringMeshes).length > 64) this.ringMeshes = {}
      this.ringMeshes[key] = toMesh(g)
    }
    return this.ringMeshes[key]
  }

  /** suggestion glow: bloom and target ring outside the ring of radius r and line width w, k times its 110 cm span */
  private glowMesh(cache: {[k: string]: RenderMesh}, r: number, w: number = RING_W, k = 1): RenderMesh {
    const rIn = r + w / 2
    return this.cachedAnnulus(cache, rIn, rIn + GLOW_PROFILE.span * k, ProfileRow.Glow)
  }

  /** aim highlight: thin ring 2.4 cm outside the ring of radius r */
  private hoverMesh(cache: {[k: string]: RenderMesh}, r: number): RenderMesh {
    const {span, coreAt, coreW} = HOVER_PROFILE
    const rIn = r + 2.4 - (coreAt + coreW / 2)
    return this.cachedAnnulus(cache, rIn, rIn + span, ProfileRow.Hover)
  }

  /**
   * Unit line along +X, 1.8 cm wide: the hover profile runs edge -> crisp centre -> edge across it.
   * Each station (t along the line, brightness f) sets the centre's U to f x the core's U, so at
   * f = 0 the whole width samples the profile's faint outer edge: the line fades without a new texture.
   */
  private lineMesh(stations: {t: number; f: number}[]): RenderMesh {
    const key = stations.map((s) => s.t.toFixed(4) + ":" + s.f).join(",")
    if (this.lineMeshes[key]) return this.lineMeshes[key]
    const {span, coreAt, coreW} = HOVER_PROFILE
    const half = coreAt + coreW / 2
    const g = new UVGeo()
    const v = profileV(ProfileRow.Hover)
    let prev: number[] | null = null
    for (const s of stations) {
      const cur = [g.vert([s.t, -half, 0], 0, v), g.vert([s.t, 0, 0], (s.f * half) / span, v), g.vert([s.t, half, 0], 0, v)]
      if (prev) {
        g.tri(prev[0], cur[0], cur[1]); g.tri(prev[0], cur[1], prev[1])
        g.tri(prev[1], cur[1], cur[2]); g.tri(prev[1], cur[2], prev[2])
      }
      prev = cur
    }
    // a handful of fade layouts per limb; don't let a moving head grow the cache without end
    if (Object.keys(this.lineMeshes).length > 64) this.lineMeshes = {}
    this.lineMeshes[key] = toMesh(g)
    return this.lineMeshes[key]
  }

  /** One dot at each point (local cm), k times its 110 cm size: the marker profile's solid centre (U 0..0.34). */
  private dotsMesh(pts: WallPt[], k: number): RenderMesh {
    const key = k.toFixed(2) + ":" + pts.map((p) => p.x.toFixed(1) + "," + p.y.toFixed(1)).join(";")
    if (this.dotMeshes[key]) return this.dotMeshes[key]
    const g = new UVGeo()
    const v = profileV(ProfileRow.Marker)
    for (const p of pts) addProfileAnnulus(g, 0, GHOST_DOT_R * k, 12, v, [p.x, p.y, 0], 1, 1, 0, 0, 0.34)
    // the path follows the badges about as Ground re-sizes: don't let walking about grow the cache without end
    if (Object.keys(this.dotMeshes).length > 64) this.dotMeshes = {}
    this.dotMeshes[key] = toMesh(g)
    return this.dotMeshes[key]
  }

  /**
   * Thin crisp pill outline (hover profile across the line, as the thin ring): a horizontal stadium
   * whose line's core runs L cm either side of the centre and round the two ends at radius R.
   */
  private pillMesh(L: number, R: number): RenderMesh {
    const key = L.toFixed(2) + "/" + R.toFixed(2)
    if (this.pillMeshes[key]) return this.pillMeshes[key]
    const {span, coreAt, coreW} = HOVER_PROFILE
    const inIn = coreAt + coreW / 2, out = span - inIn
    const v = profileV(ProfileRow.Hover)
    // the core line's path: right half-circle, top edge, left half-circle, bottom edge (closed)
    const path: {x: number; y: number; nx: number; ny: number}[] = []
    const ARC = 16
    for (let j = 0; j <= ARC; j++) {
      const t = -Math.PI / 2 + (Math.PI * j) / ARC
      path.push({x: L + R * Math.cos(t), y: R * Math.sin(t), nx: Math.cos(t), ny: Math.sin(t)})
    }
    for (let j = 0; j <= ARC; j++) {
      const t = Math.PI / 2 + (Math.PI * j) / ARC
      path.push({x: -L + R * Math.cos(t), y: R * Math.sin(t), nx: Math.cos(t), ny: Math.sin(t)})
    }
    path.push(path[0])
    const g = new UVGeo()
    let prev: number[] | null = null
    for (const q of path) {
      const cur = [
        g.vert([q.x - q.nx * inIn, q.y - q.ny * inIn, 0], 0, v),
        g.vert([q.x + q.nx * out, q.y + q.ny * out, 0], 1, v),
      ]
      // wound as addProfileAnnulus (inner, outer, next outer): facing +Z
      if (prev) { g.tri(prev[0], prev[1], cur[1]); g.tri(prev[0], cur[1], cur[0]) }
      prev = cur
    }
    if (Object.keys(this.pillMeshes).length > 64) this.pillMeshes = {}
    this.pillMeshes[key] = toMesh(g)
    return this.pillMeshes[key]
  }

  /** thin crisp ring (hover profile) with its core centred on radius r */
  private thinRingMesh(r: number): RenderMesh {
    const {span, coreAt, coreW} = HOVER_PROFILE
    const rIn = r - (coreAt + coreW / 2)
    return this.cachedAnnulus(this.thinMeshes, rIn, rIn + span, ProfileRow.Hover)
  }

  private makeText(name: string, local: vec3, size: number, color: vec4): {so: SceneObject; text: Text} {
    const so = global.scene.createSceneObject(name)
    so.setParent(this.textGroup)
    so.getTransform().setLocalPosition(local)
    const t = so.createComponent("Component.Text") as Text
    t.depthTest = true
    t.size = size
    ;(t as Text & {weight?: number}).weight = 700
    t.textFill.color = color
    t.horizontalAlignment = HorizontalAlignment.Center
    t.verticalAlignment = VerticalAlignment.Center
    t.horizontalOverflow = HorizontalOverflow.Overflow
    t.verticalOverflow = VerticalOverflow.Overflow
    t.layoutRect = Rect.create(-6, 6, -1.2, 1.2)
    return {so, text: t}
  }

  private cachedAnnulus(cache: {[k: string]: RenderMesh}, rIn: number, rOut: number, row: ProfileRow): RenderMesh {
    const key = rIn + "/" + rOut
    if (!cache[key]) {
      // the glow and the ghost badges resize with Ground's distance: keep the cache bounded
      const keys = Object.keys(cache)
      if (keys.length > 64) for (const k of keys) delete cache[k]
      const g = new UVGeo()
      addProfileAnnulus(g, Math.max(0, rIn), rOut, SEG, profileV(row))
      cache[key] = toMesh(g)
    }
    return cache[key]
  }

  private makeVisual(name: string, mesh: RenderMesh): {so: SceneObject; mat: Material} {
    const so = global.scene.createSceneObject(name)
    so.setParent(this.group)
    const rmv = so.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
    rmv.mesh = mesh
    const mat = overlayMaterial(this.material, new vec4(1, 1, 1, 1))
    rmv.mainMaterial = mat
    return {so, mat}
  }
}
