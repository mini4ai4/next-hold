// NextHoldOffViewArrow — when the suggested hold is outside the view, a small
// arrow sits at the edge of the view nearest to it, with one soft chime, then
// quiet (brief: "If the suggestion is out of view").
//
// Owns: the arrow mesh, its per-frame placement in camera space, the chime.
// Main -> this: setTarget(worldPos | null, key). Read-back: isArrowVisible().
// Must not: choose the suggestion; Main does that.

import WorldCameraFinderProvider from "SpectaclesInteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider"
import {GEO_LAYOUT, Geo, addArrow} from "./Wall/MeshKit"

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

  onAwake() {
    this.arrow = global.scene.createSceneObject("OffViewArrowMesh")
    this.arrow.setParent(this.sceneObject)
    const g = new Geo()
    g.bake = false
    addArrow(g, 5, 3.6, [1, 1, 1, 1])
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
  }

  isArrowVisible(): boolean {
    return this.visible
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
    const posLocal = new vec3(ex * tanH * D, ey * tanV * D, -D)
    const tr = this.arrow.getTransform()
    tr.setWorldPosition(camT.getWorldTransform().multiplyPoint(posLocal))
    const angle = Math.atan2(ey, ex)
    tr.setWorldRotation(camT.getWorldRotation().multiply(quat.fromEulerAngles(0, 0, angle)))
    this.setVisible(true)
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
