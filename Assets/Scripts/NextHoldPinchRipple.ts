// NextHoldPinchRipple — a brief light ring where a pinch lands, on a hold or on a button, so the
// wearer sees the pinch was taken (session 18: in the demo video nothing showed an input, things
// just changed). It opens out and fades in RIPPLE_SECONDS; a new pinch restarts it.
//
// Owns: the ripple mesh and its animation. Passive view: Main calls play() from the same functions
// a real pinch calls (so the demo autopilot's pinches show it too), and tick() each frame.
// Read-back (LEAF): isVisible(), getLog(), getWorldPosition(), getRadius().
// Must not: decide what a pinch does; Main does that.

import {UVGeo, UV_LAYOUT, addProfileAnnulus} from "./Wall/MeshKit"
import {ProfileRow, overlayMaterial, profileV} from "./Wall/ProceduralTextures"

/** how long one ripple shows, in seconds */
export const RIPPLE_SECONDS = 0.3
/** how far it opens: it ends (1 + RIPPLE_GROW) x its start radius */
export const RIPPLE_GROW = 0.6
const RIPPLE_COLOUR = new vec4(0.95, 0.97, 1, 0.9)
/** over the wall overlays and the ghost numbers (ORDER_GHOST_NUMBER = 3) */
const ORDER_RIPPLE = 4
const SEG = 48

export interface RippleEvent { target: string; time: number }

export class NextHoldPinchRipple {
  private so: SceneObject
  private rmv: RenderMeshVisual
  private mat: Material
  private meshes: {[k: string]: RenderMesh} = {}
  private startedAt = -1
  private r0 = 1
  private log: RippleEvent[] = []

  constructor(parent: SceneObject, base: Material) {
    this.so = global.scene.createSceneObject("PinchRipple")
    this.so.setParent(parent)
    this.rmv = this.so.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
    this.mat = overlayMaterial(base, RIPPLE_COLOUR)
    this.rmv.mainMaterial = this.mat
    this.rmv.setRenderOrder(ORDER_RIPPLE)
    this.so.enabled = false
  }

  /** A ring of `radiusCm` (its crisp line `lineCm` wide) at worldPos, facing along worldRot's +Z. */
  play(target: string, worldPos: vec3, worldRot: quat, radiusCm: number, lineCm: number): void {
    const key = radiusCm.toFixed(2) + "/" + lineCm.toFixed(2)
    if (!this.meshes[key]) {
      if (Object.keys(this.meshes).length > 32) this.meshes = {}
      const g = new UVGeo()
      // the hover profile: a thin crisp band with a faint halo, stretched over 2 x lineCm
      addProfileAnnulus(g, Math.max(0, radiusCm - lineCm), radiusCm + lineCm, SEG, profileV(ProfileRow.Hover))
      this.meshes[key] = toMesh(g)
    }
    this.rmv.mesh = this.meshes[key]
    this.r0 = radiusCm
    const tr = this.so.getTransform()
    tr.setWorldPosition(worldPos)
    tr.setWorldRotation(worldRot)
    this.startedAt = getTime()
    this.log.push({target, time: this.startedAt})
    if (this.log.length > 200) this.log.shift()
    this.tick(this.startedAt)
  }

  tick(time: number): void {
    if (this.startedAt < 0) return
    const u = (time - this.startedAt) / RIPPLE_SECONDS
    if (u >= 1) {
      this.startedAt = -1
      this.so.enabled = false
      return
    }
    const out = 1 - (1 - u) * (1 - u) // eases out: quick at first, settling as it fades
    this.so.getTransform().setLocalScale(vec3.one().uniformScale(1 + RIPPLE_GROW * out))
    const c = RIPPLE_COLOUR
    this.mat.mainPass.baseColor = new vec4(c.x, c.y, c.z, c.w * (1 - u))
    this.so.enabled = true
  }

  isVisible(): boolean { return this.startedAt >= 0 && this.so.enabled }
  /** every ripple played (newest last): which hold id or button name, and when */
  getLog(): RippleEvent[] { return this.log.slice() }
  getWorldPosition(): vec3 { return this.so.getTransform().getWorldPosition() }
  /** the ripple's radius right now (cm) */
  getRadius(): number { return this.r0 * this.so.getTransform().getLocalScale().x }
}

function toMesh(g: UVGeo): RenderMesh {
  const b = new MeshBuilder(UV_LAYOUT)
  b.topology = MeshTopology.Triangles
  b.indexType = MeshIndexType.UInt16
  b.appendVerticesInterleaved(g.v)
  b.appendIndices(g.i)
  b.updateMesh()
  return b.getMesh()
}
