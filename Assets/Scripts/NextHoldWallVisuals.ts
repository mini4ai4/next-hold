// NextHoldWallVisuals — the overlays drawn flat on the wall (brief: "Rings",
// "Position markers", "Suggested hold", "Targets ... highlight when aimed at").
//
// Owns: runtime-built overlay meshes under the wall (Ring_<id>, Marker_<limb>,
// SuggestGlow, HoverRing) and their colours. One cloned material per overlay.
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
  private state: OverlayState | null = null
  private ringMeshes: {[r: string]: RenderMesh} = {}

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
