// NextHoldPinchRipple — a brief bold ring where a pinch lands, on a hold or on a button, so the
// wearer sees the pinch was taken (session 18: in the demo video nothing showed an input, things
// just changed). It opens out and fades in RIPPLE_SECONDS; a new pinch restarts it.
// Session 19: the 300 ms thin white ring was easy to miss in the video (the judge: "thin white rings
// that are easy to miss"), and white on the light ply has little contrast. Now a solid white band
// twice the given line width over a dark halo, held at full strength for the first part, opening
// out to (1 + RIPPLE_GROW) x, for 400 ms.
//
// Owns: the ripple meshes and their animation. Passive view: Main calls play() from the same
// functions a real pinch calls (so the demo autopilot's pinches show it too), and tick() each frame.
// Read-back (LEAF): isVisible(), getLog(), getWorldPosition(), getRadius(), getBandWidth().
// Must not: decide what a pinch does; Main does that.

import {UVGeo, UV_LAYOUT, addProfileAnnulus} from "./Wall/MeshKit"
import {ProfileRow, RING_PROFILE, overlayMaterial, profileV} from "./Wall/ProceduralTextures"

/** how long one ripple shows, in seconds */
export const RIPPLE_SECONDS = 0.4
/** how far it opens: it ends (1 + RIPPLE_GROW) x its start radius */
export const RIPPLE_GROW = 0.8
/** the white band's crisp core is this many times the line width play() is given */
export const RIPPLE_BAND = 2
/** the share of RIPPLE_SECONDS it stays at full strength before it fades */
const RIPPLE_HOLD = 0.35
const RIPPLE_COLOUR = new vec4(1, 1, 1, 1)
/** the dark halo under the band: it gives the white contrast on the light ply */
const RIPPLE_SHADOW = new vec4(0.04, 0.06, 0.1, 0.9)
/** over the wall overlays and the ghost numbers (ORDER_GHOST_NUMBER = 3): the halo, then the band */
const ORDER_RIPPLE_SHADOW = 4
export const ORDER_RIPPLE = 5
const SEG = 48

export interface RippleEvent { target: string; time: number }

interface Layer { so: SceneObject; rmv: RenderMeshVisual; mat: Material; colour: vec4 }

export class NextHoldPinchRipple {
  private so: SceneObject
  private layers: Layer[] = []
  private meshes: {[k: string]: RenderMesh[]} = {}
  private startedAt = -1
  private r0 = 1
  private band = 0
  private log: RippleEvent[] = []

  constructor(parent: SceneObject, base: Material) {
    this.so = global.scene.createSceneObject("PinchRipple")
    this.so.setParent(parent)
    for (const [name, colour, order] of [["PinchRippleShadow", RIPPLE_SHADOW, ORDER_RIPPLE_SHADOW], ["PinchRippleBand", RIPPLE_COLOUR, ORDER_RIPPLE]] as [string, vec4, number][]) {
      const so = global.scene.createSceneObject(name)
      so.setParent(this.so)
      const rmv = so.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
      const mat = overlayMaterial(base, colour)
      rmv.mainMaterial = mat
      rmv.setRenderOrder(order)
      this.layers.push({so, rmv, mat, colour})
    }
    this.so.enabled = false
  }

  /** A ring of `radiusCm` (its white band RIPPLE_BAND x `lineCm` wide) at worldPos, facing along worldRot's +Z. */
  play(target: string, worldPos: vec3, worldRot: quat, radiusCm: number, lineCm: number): void {
    const key = radiusCm.toFixed(2) + "/" + lineCm.toFixed(2)
    if (!this.meshes[key]) {
      if (Object.keys(this.meshes).length > 32) this.meshes = {}
      this.meshes[key] = [shadowMesh(radiusCm, lineCm), bandMesh(radiusCm, lineCm)]
    }
    this.layers.forEach((l, i) => { l.rmv.mesh = this.meshes[key][i] })
    this.r0 = radiusCm
    this.band = RIPPLE_BAND * lineCm
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
    // full strength while it opens, then a fade to nothing
    const v = u <= RIPPLE_HOLD ? 0 : (u - RIPPLE_HOLD) / (1 - RIPPLE_HOLD)
    const a = 1 - v * v
    for (const l of this.layers) l.mat.mainPass.baseColor = new vec4(l.colour.x, l.colour.y, l.colour.z, l.colour.w * a)
    this.so.enabled = true
  }

  isVisible(): boolean { return this.startedAt >= 0 && this.so.enabled }
  /** every ripple played (newest last): which hold id or button name, and when */
  getLog(): RippleEvent[] { return this.log.slice() }
  getWorldPosition(): vec3 { return this.so.getTransform().getWorldPosition() }
  /** the ripple's radius right now (cm) */
  getRadius(): number { return this.r0 * this.so.getTransform().getLocalScale().x }
  /** the white band's crisp width right now (cm) */
  getBandWidth(): number { return this.band * this.so.getTransform().getLocalScale().x }
}

/** the white band: the ring profile (crisp tube, soft halo) with its core RIPPLE_BAND x lineCm wide on radius r */
function bandMesh(r: number, lineCm: number): RenderMesh {
  const {inner, core, outer} = RING_PROFILE
  const k = (RIPPLE_BAND * lineCm) / core
  const g = new UVGeo()
  addProfileAnnulus(g, Math.max(0, r - (core / 2 + inner) * k), r + (core / 2 + outer) * k, SEG, profileV(ProfileRow.Ring))
  return toMesh(g)
}

/** the dark halo: the shadow profile, darkest on the band, fading out 3 x lineCm either side */
function shadowMesh(r: number, lineCm: number): RenderMesh {
  const w = 3 * lineCm
  const v = profileV(ProfileRow.Shadow)
  const g = new UVGeo()
  addProfileAnnulus(g, Math.max(0, r - w), r, SEG, v, [0, 0, 0], 1, 1, 0, 1, 0)
  addProfileAnnulus(g, r, r + w, SEG, v, [0, 0, 0], 1, 1, 0, 0, 1)
  return toMesh(g)
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
