// NextHoldWallVisuals — the overlays drawn flat on the wall (brief: "Rings",
// "Position markers", "Suggested hold", "Targets ... highlight when aimed at").
//
// Owns: runtime-built overlay meshes under the wall (Ring_<id>, Marker_<limb>,
// SuggestGlow, HoverRing) and their colours. One cloned material per overlay.
// Main pushes state in with apply(); this class never scores or decides.
// Plain class (not a component): Main creates it once in onAwake.

import {GEO_LAYOUT, Geo, addDisc, addRing} from "./Wall/MeshKit"
import {HOLDS, HOLD_SIZE, HoldDef} from "./Wall/WallLayout"

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

const RING_W = 1.6          // ring band width, cm
const RING_Z = 0.4          // just proud of the wall face
const GLOW_W = 2.6          // glow band just outside the suggested ring
const GLOW_OFFSET = RING_W / 2 + 1.3
const RING_DIM = 0.8       // non-suggested rings: a little dimmer than the glowing one
const MARKER_R = 2.6
const MARKER_DIM = 0.38     // "small dim marker"
const MARKER_SELECTED = 0.75
const HOVER_COLOR = new vec4(0.95, 0.97, 1.0, 1)

function toMesh(g: Geo): RenderMesh {
  const b = new MeshBuilder(GEO_LAYOUT)
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

    const disc = new Geo()
    disc.bake = false
    addDisc(disc, MARKER_R, 28, [1, 1, 1, 1])
    const discMesh = toMesh(disc)
    for (const limb of ["LH", "RH", "LF", "RF"]) {
      const m = this.makeVisual("Marker_" + limb, discMesh)
      m.so.enabled = false
      this.markers[limb] = m
    }

    const glowVis = this.makeVisual("SuggestGlow", this.ringMesh(10, GLOW_W, GLOW_OFFSET))
    glowVis.so.enabled = false
    this.glow = {...glowVis, meshes: {}, rmv: glowVis.so.getComponent("Component.RenderMeshVisual") as RenderMeshVisual}

    const hoverVis = this.makeVisual("HoverRing", this.ringMesh(12, 0.6, 2.4))
    hoverVis.mat.mainPass.baseColor = HOVER_COLOR
    hoverVis.so.enabled = false
    this.hover = {so: hoverVis.so, rmv: hoverVis.so.getComponent("Component.RenderMeshVisual") as RenderMeshVisual, meshes: {}}
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
      this.glow.rmv.mesh = this.cachedRing(this.glow.meshes, r, GLOW_W, GLOW_OFFSET)
      this.glow.so.getTransform().setLocalPosition(this.wallToLocal(glowHold.x, glowHold.y, RING_Z + 0.05))
      this.glow.so.enabled = true
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
    const k = 0.55 + 0.4 * (0.5 + 0.5 * Math.sin(time * Math.PI * 2 * 0.8))
    this.glow.mat.mainPass.baseColor = scaled(this.colours[c], k)
  }

  setHover(id: string | null): void {
    const h = id ? this.holdDef(id) : null
    if (!h) {
      this.hover.so.enabled = false
      return
    }
    const r = HOLD_SIZE[h.type].ringR
    this.hover.rmv.mesh = this.cachedRing(this.hover.meshes, r + 2.4, 0.6, 0)
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

  private ringMesh(r: number, width: number = RING_W, offset: number = 0): RenderMesh {
    return this.cachedRing(this.ringMeshes, r, width, offset)
  }

  /** ring centred on radius r + offset, `width` wide */
  private cachedRing(cache: {[k: string]: RenderMesh}, r: number, width: number, offset: number): RenderMesh {
    const key = r + "/" + width + "/" + offset
    if (!cache[key]) {
      const g = new Geo()
      g.bake = false
      const mid = r + offset
      addRing(g, mid - width / 2, mid + width / 2, 48, [1, 1, 1, 1])
      cache[key] = toMesh(g)
    }
    return cache[key]
  }

  private makeVisual(name: string, mesh: RenderMesh): {so: SceneObject; mat: Material} {
    const so = global.scene.createSceneObject(name)
    so.setParent(this.group)
    const rmv = so.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
    rmv.mesh = mesh
    const mat = this.material.clone()
    mat.mainPass.baseColor = new vec4(1, 1, 1, 1)
    rmv.mainMaterial = mat
    return {so, mat}
  }
}
