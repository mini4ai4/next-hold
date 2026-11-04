// NextHoldOffViewArrow — when the suggested hold is outside the view, a small
// arrow sits at the edge of the view nearest to it, with one soft chime, then
// quiet (brief: "If the suggestion is out of view").
//
// Owns: the arrow mesh, its per-frame placement in camera space, the chime.
// Main -> this: setTarget(worldPos | null, key), setKeepClearOf(corners). Read-back: isArrowVisible(), isArrowMoved().
// Must not: choose the suggestion; Main does that.

import WorldCameraFinderProvider from "SpectaclesInteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider"
import {GEO_LAYOUT, Geo, addArrow, addDisc} from "./Wall/MeshKit"

const ARROW_LEN = 5
/** the dark disc behind the arrow: radius (cm) and colour */
const BACK_R = 3.9
const BACK_COLOR = new vec4(0.08, 0.1, 0.09, 0.6)
/** over everything on the wall and the panels */
const ORDER_ARROW = 20
/** session 21, the arrow keeps clear of the panel: the gap (cm, on the arrow's plane) kept between
 *  its disc and the panel, and between its disc and the frame's edge */
const CLEAR_GAP = 0.6
/** how many boxes round the frame the arrow may move along, from its usual inset out to the frame's edge (the
 *  free band above the panel is hardly wider than the disc, so they are close together: 0.5 cm), and how many
 *  places are tried along each side. Only on a frame where the arrow would otherwise touch the panel. */
const CLEAR_BOXES = 12
const CLEAR_STEPS = 16
/** how much smaller the arrow is drawn when the panel leaves no room for it at its own size */
const CLEAR_SMALL = 0.65

interface Box {x0: number; x1: number; y0: number; y1: number}
interface Spot {x: number; y: number}

/** where the arrow's disc is centred at this place, angle and scale: it sits behind the arrow's tail */
function discCentre(p: Spot, angle: number, scale: number): Spot {
  const back = (scale * ARROW_LEN) / 2
  return {x: p.x - back * Math.cos(angle), y: p.y - back * Math.sin(angle)}
}

function discHits(p: Spot, angle: number, b: Box, scale: number): boolean {
  const c = discCentre(p, angle, scale)
  return Math.hypot(Math.max(b.x0 - c.x, 0, c.x - b.x1), Math.max(b.y0 - c.y, 0, c.y - b.y1)) < scale * BACK_R + CLEAR_GAP
}

/** The arrow and its disc are wholly inside the frame (half sizes on the arrow's plane). */
function fitsFrame(p: Spot, angle: number, halfW: number, halfH: number, scale: number): boolean {
  const c = discCentre(p, angle, scale), r = scale * BACK_R + CLEAR_GAP
  return Math.abs(c.x) <= halfW - r && Math.abs(c.y) <= halfH - r && Math.abs(p.x) <= halfW - CLEAR_GAP && Math.abs(p.y) <= halfH - CLEAR_GAP
}

/** The nearest place round the frame's edge where the arrow, turned to the hold, is clear of the panel and
 *  wholly in the frame; null if the panel leaves no room. */
function nearestClear(from: Spot, halfW: number, halfH: number, inset: number, panel: Box, toward: (x: number, y: number) => number, scale: number): Spot | null {
  let best: Spot | null = null, bestD = 1e9
  for (let n = 0; n <= CLEAR_BOXES; n++) {
    const share = inset + ((1 - inset) * n) / CLEAR_BOXES
    const w = halfW * share, h = halfH * share
    for (let i = 0; i <= CLEAR_STEPS; i++) {
      const u = -1 + (2 * i) / CLEAR_STEPS
      for (const c of [{x: u * w, y: h}, {x: u * w, y: -h}, {x: w, y: u * h}, {x: -w, y: u * h}]) {
        const a = toward(c.x, c.y)
        if (!fitsFrame(c, a, halfW, halfH, scale) || discHits(c, a, panel, scale)) continue
        const d = Math.hypot(c.x - from.x, c.y - from.y)
        if (d < bestD) { best = c; bestD = d }
      }
    }
  }
  return best
}

@component
export class NextHoldOffViewArrow extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">NextHoldOffViewArrow – edge arrow + chime for an off-view suggestion</span>')
  @ui.separator
  @ui.group_start("References")
  @input
  @hint("Unlit material, cloned for the arrow")
  material: Material

  @input
  @hint("One soft chime when the arrow appears for a new suggestion")
  chime: AudioTrackAsset
  @ui.group_end

  @ui.separator
  @ui.group_start("Settings")
  @input
  @hint("How far in front of the eyes the arrow sits, in cm")
  @widget(new SliderWidget(40, 150, 1))
  distanceCm: number = 80

  @input
  @hint("How close to the edge of the view the arrow sits (1 = the very edge)")
  @widget(new SliderWidget(0.5, 0.95, 0.01))
  edgeInset: number = 0.78

  @input("vec4", "{0.95,0.95,0.8,1}")
  @hint("Arrow colour (keep it light: the display is additive)")
  @widget(new ColorWidget())
  arrowColor: vec4 = new vec4(0.95, 0.95, 0.8, 1)

  @input
  @hint("Chime volume")
  @widget(new SliderWidget(0, 1, 0.05))
  chimeVolume: number = 0.5
  @ui.group_end

  private arrow: SceneObject
  private audio: AudioComponent | null = null
  private target: vec3 | null = null
  private targetKey = ""
  private targetRadius = 0
  private chimedKey = ""
  private visible = false
  private keepClearOf: (() => vec3[] | null) | null = null
  private moved = false

  onAwake() {
    this.arrow = global.scene.createSceneObject("OffViewArrowMesh")
    this.arrow.setParent(this.sceneObject)
    const g = new Geo()
    g.bake = false
    addArrow(g, ARROW_LEN, 3.6, [1, 1, 1, 1])
    const b = new MeshBuilder(GEO_LAYOUT)
    b.topology = MeshTopology.Triangles
    b.indexType = MeshIndexType.UInt16
    b.appendVerticesInterleaved(g.v)
    b.appendIndices(g.i)
    b.updateMesh()
    const rmv = this.arrow.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
    rmv.mesh = b.getMesh()
    if (this.material) {
      const mat = this.material.clone()
      mat.mainPass.baseColor = this.arrowColor
      mat.mainPass.depthTest = false // always readable at the edge of view
      rmv.mainMaterial = mat
      rmv.setRenderOrder(ORDER_ARROW)
      // a dark disc behind it, so the pale arrow reads over the light ply too; on the additive
      // display dark draws as nothing and the arrow alone remains (as the label's dark outline)
      const back = global.scene.createSceneObject("OffViewArrowBack")
      back.setParent(this.arrow)
      const bg = new Geo()
      bg.bake = false
      addDisc(bg, BACK_R, 32, [1, 1, 1, 1], -0.3)
      const bb = new MeshBuilder(GEO_LAYOUT)
      bb.topology = MeshTopology.Triangles
      bb.indexType = MeshIndexType.UInt16
      bb.appendVerticesInterleaved(bg.v)
      bb.appendIndices(bg.i)
      bb.updateMesh()
      back.getTransform().setLocalPosition(new vec3(-ARROW_LEN / 2, 0, 0))
      const brmv = back.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
      brmv.mesh = bb.getMesh()
      const bmat = this.material.clone()
      bmat.mainPass.baseColor = BACK_COLOR
      bmat.mainPass.blendMode = BlendMode.Normal
      bmat.mainPass.depthTest = false
      bmat.mainPass.depthWrite = false
      brmv.mainMaterial = bmat
      brmv.setRenderOrder(ORDER_ARROW - 1)
    }
    this.arrow.enabled = false

    if (this.chime) {
      this.audio = this.sceneObject.createComponent("Component.AudioComponent") as AudioComponent
      this.audio.audioTrack = this.chime
      this.audio.volume = this.chimeVolume
      this.audio.playbackMode = Audio.PlaybackMode.LowLatency
    }

    this.createEvent("LateUpdateEvent").bind(() => this.place())
  }

  /** key identifies the suggestion (limb + hold) so the chime plays once per suggestion. */
  /** radiusCm: the ring radius; the hold counts as in view while any of its ring is. */
  setTarget(worldPos: vec3 | null, key: string, radiusCm: number = 0): void {
    this.target = worldPos
    this.targetKey = key
    this.targetRadius = radiusCm
    // no next move (topped out, setup): gone in this frame, not at its late update
    if (!worldPos) this.setVisible(false)
  }

  /** Session 21: the rect the arrow keeps clear of, as four world corners (Main: the control panel). */
  setKeepClearOf(corners: () => vec3[] | null): void {
    this.keepClearOf = corners
  }

  isArrowVisible(): boolean {
    return this.visible
  }

  /** The arrow has left its place on the hold's line to stay clear of the panel. */
  isArrowMoved(): boolean {
    return this.visible && this.moved
  }

  private place(): void {
    const cam = WorldCameraFinderProvider.getInstance()
    const camComp = cam ? cam.getComponent() : null
    if (!this.target || !camComp) {
      this.setVisible(false)
      return
    }
    const camT = camComp.getSceneObject().getTransform()
    const local = camT.getInvertedWorldTransform().multiplyPoint(this.target)
    const tanV = Math.tan(camComp.fov / 2)
    const tanH = tanV * camComp.aspect
    // normalised device coords; camera looks down -Z
    const depth = -local.z
    let nx: number, ny: number
    if (depth > 1e-3) {
      nx = local.x / (depth * tanH)
      ny = local.y / (depth * tanV)
    } else {
      // behind the viewer: point the way you'd turn
      nx = local.x >= 0 ? 10 : -10
      ny = local.y
    }
    const inView = depth > 1e-3 &&
      Math.abs(local.x) <= depth * tanH + this.targetRadius &&
      Math.abs(local.y) <= depth * tanV + this.targetRadius
    if (inView) {
      this.setVisible(false)
      return
    }
    // push the direction out to the inset box edge
    const m = Math.max(Math.abs(nx), Math.abs(ny)) || 1
    const ex = (nx / m) * this.edgeInset
    const ey = (ny / m) * this.edgeInset
    const D = this.distanceCm
    const halfW = tanH * D, halfH = tanV * D
    // the same place on the arrow's own plane (cm), with the hold's direction from there
    const toward = (x: number, y: number) => Math.atan2(ny * halfH - y, nx * halfW - x)
    const natural = {x: ex * halfW, y: ey * halfH}
    // session 21: never on the control panel. It moves to the nearest free place at the edge and still
    // turns to the hold; hiding it instead left nothing saying where the next hold is, and the panel is
    // in view whenever it matters (On wall it slides into view). From 70 cm the panel fills most of the
    // frame and the band left is narrower than the arrow's disc: there it is drawn smaller. Hidden only
    // when even that doesn't fit.
    const panel = this.panelBox(camT, D)
    let spot: Spot | null = natural
    let scale = 1
    this.moved = false
    if (panel && discHits(natural, Math.atan2(ey * halfH, ex * halfW), panel, 1)) {
      spot = nearestClear(natural, halfW, halfH, this.edgeInset, panel, toward, 1)
      if (!spot) {
        scale = CLEAR_SMALL
        spot = nearestClear(natural, halfW, halfH, this.edgeInset, panel, toward, scale)
      }
      this.moved = !!spot
    }
    if (!spot) {
      this.setVisible(false)
      return
    }
    const tr = this.arrow.getTransform()
    tr.setLocalScale(vec3.one().uniformScale(scale))
    tr.setWorldPosition(camT.getWorldTransform().multiplyPoint(new vec3(spot.x, spot.y, -D)))
    const angle = this.moved ? toward(spot.x, spot.y) : Math.atan2(ey, ex)
    tr.setWorldRotation(camT.getWorldRotation().multiply(quat.fromEulerAngles(0, 0, angle)))
    this.setVisible(true)
  }

  /** The panel's rect as the eye sees it, on the arrow's plane D cm out (cm, camera axes); null if it isn't in front. */
  private panelBox(camT: Transform, D: number): Box | null {
    const corners = this.keepClearOf ? this.keepClearOf() : null
    if (!corners) return null
    const inv = camT.getInvertedWorldTransform()
    const box: Box = {x0: 1e9, x1: -1e9, y0: 1e9, y1: -1e9}
    for (const c of corners) {
      const l = inv.multiplyPoint(c)
      if (-l.z <= 1e-3) return null
      const k = D / -l.z
      box.x0 = Math.min(box.x0, l.x * k); box.x1 = Math.max(box.x1, l.x * k)
      box.y0 = Math.min(box.y0, l.y * k); box.y1 = Math.max(box.y1, l.y * k)
    }
    return box
  }

  private setVisible(v: boolean): void {
    if (v && !this.visible && this.targetKey !== this.chimedKey) {
      this.chimedKey = this.targetKey
      if (this.audio) this.audio.play(1)
    }
    this.visible = v
    this.arrow.enabled = v
  }
}
