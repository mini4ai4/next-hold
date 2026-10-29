// NextHoldWallVisuals — the overlays drawn flat on the wall (brief: "Rings",
// "Position markers", "Suggested hold", "Targets ... highlight when aimed at").
//
// Owns: runtime-built overlay meshes under the wall (Ring_<id>, Marker_<limb>,
// SuggestGlow, HoverRing, setup mode's Mark_<id> "in your problem" ring and
// Tag_<id> START / TOP text, the sequence preview's Ghost_1..3 rings with their
// GhostNumber_1..3) and their colours. One cloned material per overlay.
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
  /** setup mode: tag text under a marked hold ("START", "TOP"); absent = no tag */
  tags: {[id: string]: string}
  /** sequence preview: the holds of the next moves in order (ghost 1, 2, 3); empty = none */
  ghosts: string[]
}

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
/** sequence preview: small, light ghost rings (they must read on the additive display) */
const GHOST_COUNT = 3
const GHOST_R = 3.4
const GHOST_COLOR = new vec4(0.86, 0.93, 1.0, 0.95)
const GHOST_NUMBER_COLOR = new vec4(0.95, 0.98, 1.0, 1)
const GHOST_NUMBER_SIZE = 56
/** a ghost sits as a badge on the hold's upper side; a second ghost on the same hold takes the next angle */
const GHOST_ANGLES_DEG = [45, 135, 90]
/** glow breathing: alpha range of the suggestion's halo */
const GLOW_MIN = 0.6
const GLOW_MAX = 1.0

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

export class NextHoldWallVisuals {
  private group: SceneObject
  private rings: {[id: string]: {so: SceneObject; mat: Material}} = {}
  private markers: {[limb: string]: {so: SceneObject; mat: Material}} = {}
  private glow: {so: SceneObject; mat: Material; meshes: {[r: string]: RenderMesh}; rmv: RenderMeshVisual}
  private hover: {so: SceneObject; rmv: RenderMeshVisual; meshes: {[r: string]: RenderMesh}}
  private marks: {[id: string]: {so: SceneObject; mat: Material}} = {}
  private textGroup: SceneObject
  private tags: {[id: string]: {so: SceneObject; text: Text}} = {}
  private ghosts: {ring: {so: SceneObject; mat: Material}; label: {so: SceneObject; text: Text}}[] = []
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
      const so = this.makeVisual("Ring_" + h.id, this.ringMesh(r))
      so.so.getTransform().setLocalPosition(this.wallToLocal(h.x, h.y, RING_Z))
      so.so.enabled = false
      this.rings[h.id] = so

      const mark = this.makeVisual("Mark_" + h.id, this.thinRingMesh(r))
      mark.mat.mainPass.baseColor = MARK_COLOR
      mark.so.getTransform().setLocalPosition(this.wallToLocal(h.x, h.y, RING_Z))
      mark.so.enabled = false
      this.marks[h.id] = mark
    }

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

    for (let n = 1; n <= GHOST_COUNT; n++) {
      const ring = this.makeVisual("Ghost_" + n, this.thinRingMesh(GHOST_R))
      ring.mat.mainPass.baseColor = GHOST_COLOR
      ring.so.enabled = false
      const label = this.makeText("GhostNumber_" + n, vec3.zero(), GHOST_NUMBER_SIZE, GHOST_NUMBER_COLOR)
      label.text.text = "" + n
      label.so.enabled = false
      this.ghosts.push({ring, label})
    }

    const disc = new UVGeo()
    addProfileAnnulus(disc, 0, MARKER_R, 40, profileV(ProfileRow.Marker))
    const discMesh = toMesh(disc)
    for (const limb of ["LH", "RH", "LF", "RF"]) {
      const m = this.makeVisual("Marker_" + limb, discMesh)
      m.so.enabled = false
      this.markers[limb] = m
    }

    const glowMeshes: {[r: string]: RenderMesh} = {}
    const glowVis = this.makeVisual("SuggestGlow", this.glowMesh(glowMeshes, 10))
    glowVis.so.enabled = false
    this.glow = {...glowVis, meshes: glowMeshes, rmv: glowVis.so.getComponent("Component.RenderMeshVisual") as RenderMeshVisual}

    const hoverMeshes: {[r: string]: RenderMesh} = {}
    const hoverVis = this.makeVisual("HoverRing", this.hoverMesh(hoverMeshes, 12))
    hoverVis.mat.mainPass.baseColor = HOVER_COLOR
    hoverVis.so.enabled = false
    this.hover = {so: hoverVis.so, rmv: hoverVis.so.getComponent("Component.RenderMeshVisual") as RenderMeshVisual, meshes: hoverMeshes}
  }

  apply(s: OverlayState): void {
    this.state = s
    for (const h of HOLDS) {
      const ring = this.rings[h.id]
      const c = s.rings[h.id]
      ring.so.enabled = !!c
      if (c) ring.mat.mainPass.baseColor = scaled(this.colours[c], h.id === s.glowHoldId ? 1 : RING_DIM)
      this.marks[h.id].so.enabled = !!s.marks[h.id]
      const tag = s.tags[h.id]
      this.tags[h.id].so.enabled = !!tag
      if (tag) this.tags[h.id].text.text = tag
    }

    // ghost n: a small numbered ring on the upper side of the n-th look-ahead hold,
    // on the radius of the suggestion glow's outer ring so it reads as a badge on it
    const onHold: {[id: string]: number} = {}
    for (let i = 0; i < GHOST_COUNT; i++) {
      const g = this.ghosts[i]
      const id = i < s.ghosts.length ? s.ghosts[i] : null
      const h = id ? this.holdDef(id) : null
      g.ring.so.enabled = !!h
      g.label.so.enabled = !!h
      if (!h) continue
      const k = onHold[h.id] || 0
      onHold[h.id] = k + 1
      let deg = GHOST_ANGLES_DEG[k % GHOST_ANGLES_DEG.length]
      if (h.x > 205) deg = 180 - deg // keep a badge near the right edge on the wall
      const a = (deg * Math.PI) / 180
      const d = HOLD_SIZE[h.type].ringR + RING_W / 2 + GLOW_PROFILE.ringAt + GLOW_PROFILE.ringW / 2
      const x = h.x + d * Math.cos(a), y = h.y + d * Math.sin(a)
      g.ring.so.getTransform().setLocalPosition(this.wallToLocal(x, y, RING_Z + 0.15))
      g.label.so.getTransform().setLocalPosition(this.wallToLocal(x, y, RING_Z + 0.3))
    }

    const glowHold = s.glowHoldId ? this.holdDef(s.glowHoldId) : null
    const glowColour = s.glowHoldId ? s.rings[s.glowHoldId] : null
    if (glowHold && glowColour) {
      const r = HOLD_SIZE[glowHold.type].ringR
      this.glow.rmv.mesh = this.glowMesh(this.glow.meshes, r)
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
    }
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

  /** the hold ghost n (1-based) sits on, or null when it is hidden */
  ghostHold(n: number): string | null {
    const g = this.ghosts[n - 1]
    return g && g.ring.so.enabled && this.state ? this.state.ghosts[n - 1] : null
  }

  isGlowOn(id: string): boolean {
    return !!this.state && this.state.glowHoldId === id && this.glow.so.enabled
  }

  markerHold(limb: string): string | null {
    const m = this.markers[limb]
    return m && m.so.enabled && this.state ? this.state.position[limb] : null
  }

  // ── helpers ───────────────────────────────────────────────────────────────
  private holdDef(id: string): HoldDef | null {
    for (const h of HOLDS) if (h.id === id) return h
    return null
  }

  /** ring with its crisp core centred on radius r, halo inside and out */
  private ringMesh(r: number): RenderMesh {
    const {inner, core, outer} = RING_PROFILE
    const rIn = r - RING_W / 2 - inner
    return this.cachedAnnulus(this.ringMeshes, rIn, rIn + inner + core + outer, ProfileRow.Ring)
  }

  /** suggestion glow: bloom and target ring outside the ring of radius r */
  private glowMesh(cache: {[k: string]: RenderMesh}, r: number): RenderMesh {
    const rIn = r + RING_W / 2
    return this.cachedAnnulus(cache, rIn, rIn + GLOW_PROFILE.span, ProfileRow.Glow)
  }

  /** aim highlight: thin ring 2.4 cm outside the ring of radius r */
  private hoverMesh(cache: {[k: string]: RenderMesh}, r: number): RenderMesh {
    const {span, coreAt, coreW} = HOVER_PROFILE
    const rIn = r + 2.4 - (coreAt + coreW / 2)
    return this.cachedAnnulus(cache, rIn, rIn + span, ProfileRow.Hover)
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
