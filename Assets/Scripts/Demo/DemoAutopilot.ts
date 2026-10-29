// DemoAutopilot — plays the demo video's scenes 0-7 (devpost/VIDEO_PLAN.md) by itself, so the
// take is the real Lens running, smooth and the same every time. OFF unless "Play On Start" is
// ticked (or a LEAF scenario calls play()): with it off this component binds nothing and changes nothing.
//
// The timeline is data, in DemoTimeline.ts. While it plays:
// - it holds the wearer's camera: device tracking is paused and the eye eases between CAMERA keys
//   (walking in and out, looking up, down and away); tracking comes back at the end;
// - ACTIONS call the same NextHoldMain functions a real pinch calls (pressLimb, pressHold,
//   pressHeight, pressAsk, pressMode, pickType, pressStart, pressDone, pressRemove);
// - scene 0 has no overlays: every overlay material and text under NextHold and the wall's
//   Overlays is drawn at alpha 0, then faded in from scene 1. Only the alpha is scaled, over
//   whatever colour the Lens itself sets, and each one is handed back untouched once it is in;
// - what isn't the product is hidden (HIDE_WHILE_PLAYING: the LEAF banner, SIK's cursor and hand
//   visuals) and the hold colliders' wireframes are off;
// - each scene start prints "SCENE 3 start t=48.0" to the Logger, for the voice-over.
// Test hooks (LEAF d1): play(scale), stop(), isPlaying(), getTimelineTime(), getOverlayAlpha(),
// getSceneLog(), addCheckListener(fn): fn(key) runs at each CHECKS time, late in that frame (after
// the fade is applied, so it reads what is drawn).

import WorldCameraFinderProvider from "SpectaclesInteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider"
import {NextHoldMain} from "../NextHoldMain"
import {Limb} from "../NextHoldScoring"
import {
  ACTIONS, CAMERA, CHECKS, CameraKey, DemoAction, END, FADE_SECONDS, HIDE_WHILE_PLAYING, OVERLAYS_FROM, SCENES, START_DELAY,
} from "./DemoTimeline"

/** after END the last pose holds this long (timeline s) before tracking comes back */
const END_HOLD = 2

/** one overlay alpha the autopilot scales (a colour's alpha, or UI Kit's opacityFactor): the Lens's
 *  own value (base) and what the autopilot last wrote */
interface Faded { read: () => number; write: (a: number) => void; base: number; written: number | null }

@component
export class DemoAutopilot extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">DemoAutopilot – plays VIDEO_PLAN scenes 0-7 for recording (timeline: DemoTimeline.ts)</span>')
  @ui.separator
  @input
  @hint("The NextHold object's NextHoldMain")
  main: NextHoldMain

  @input
  @hint("OFF in the saved scene. Tick it to play the demo 3 s after the Lens starts (for recording the preview)")
  playOnStart: boolean = false

  @input
  @hint("Timeline speed: 1 = real time (the video). LEAF d1 plays it faster; a small value nearly freezes it (for a still)")
  @widget(new SliderWidget(0.05, 20, 0.05))
  timeScale: number = 1

  @input
  @hint("Start the take here (timeline s) to rehearse or tweak one scene: every action before it runs at once, so the state is the same as in the full take. 0 for recording")
  @widget(new SliderWidget(0, 130, 0.5))
  startAt: number = 0

  @input
  @hint("Hide what isn't the product while playing: the LEAF banner, SIK's cursor and hand visuals, collider wireframes")
  hideChrome: boolean = true

  private playing = false
  private scale = 1
  /** the timeline time play() started from, and the getTime() it is reached at (after the pre-roll) */
  private from = 0
  private t0 = 0
  private nextAction = 0
  private nextCheck = 0
  private nextScene = 0
  private sceneLog: {n: number; t: number}[] = []
  private checkListeners: ((key: string) => void)[] = []
  /** a CHECKS key that came due this frame; its listeners run in LateUpdate */
  private pendingCheck: string | null = null
  private camT: Transform | null = null
  private tracking: DeviceTracking | null = null
  private trackingWas = true
  private hidden: {so: SceneObject; was: boolean}[] = []
  private colliders: {c: ColliderComponent; was: boolean}[] = []
  private faded: Faded[] = []
  private alpha = 1
  private bound = false

  onAwake() {
    if (!this.playOnStart) return // off: nothing is bound, nothing changes
    this.createEvent("OnStartEvent").bind(() => this.play(this.timeScale, this.startAt))
  }

  /** Start the timeline at `scale` x real time, after START_DELAY s of pre-roll (shortened when
   *  faster than real time) holding the first pose. From `from` > 0: every action before it runs now. */
  play(scale = 1, from = 0): void {
    if (this.playing) return
    if (!this.main || !this.main.isReady()) {
      print("[DemoAutopilot] ERROR: NextHoldMain not wired or not ready")
      return
    }
    this.scale = Math.max(0.01, scale)
    this.from = Math.max(0, Math.min(END, from))
    this.t0 = getTime() + START_DELAY / Math.max(1, this.scale)
    this.nextAction = this.nextCheck = this.nextScene = 0
    this.sceneLog = []
    this.pendingCheck = null
    if (!this.takeCamera()) return
    while (this.nextAction < ACTIONS.length && ACTIONS[this.nextAction].t < this.from) this.run(ACTIONS[this.nextAction++])
    while (this.nextCheck < CHECKS.length && CHECKS[this.nextCheck].t < this.from) this.nextCheck++
    while (this.nextScene < SCENES.length && SCENES[this.nextScene].start < this.from) this.nextScene++
    if (this.from > 0) print(`[DemoAutopilot] starting at t=${this.from.toFixed(1)}, in scene ${this.nextScene - 1}`)
    if (this.hideChrome) this.hideNonProduct()
    this.gatherFaded()
    this.alpha = -1
    this.playing = true
    if (!this.bound) {
      this.bound = true
      this.createEvent("UpdateEvent").bind(() => this.update())
      this.createEvent("LateUpdateEvent").bind(() => this.lateUpdate())
    }
    const preroll = START_DELAY / Math.max(1, this.scale)
    print(`[DemoAutopilot] play x${this.scale}: ${preroll.toFixed(1)} s pre-roll, then t=${this.from.toFixed(1)}-${END} ` +
      `(${((END - this.from + END_HOLD) / this.scale).toFixed(1)} s, scenes 0-${SCENES.length - 1})`)
    this.update()
  }

  /** Hand everything back: camera tracking, hidden objects, overlay colours. */
  stop(): void {
    if (!this.playing) return
    this.playing = false
    this.setAlpha(1)
    this.faded = []
    for (const h of this.hidden) h.so.enabled = h.was
    this.hidden = []
    for (const c of this.colliders) c.c.debugDrawEnabled = c.was
    this.colliders = []
    if (this.tracking) this.tracking.enabled = this.trackingWas
    print(`[DemoAutopilot] stopped at t=${this.getTimelineTime().toFixed(1)}`)
  }

  // ── read-back (LEAF) ──────────────────────────────────────────────────────
  isPlaying(): boolean { return this.playing }
  /** timeline s; below the start point during the pre-roll */
  getTimelineTime(): number { return this.from + (getTime() - this.t0) * this.scale }
  getOverlayAlpha(): number { return this.alpha }
  getSceneLog(): {n: number; t: number}[] { return this.sceneLog.slice() }
  /** fn(key) runs at each CHECKS entry's time, late in that frame; returns an unsubscribe */
  addCheckListener(fn: (key: string) => void): () => void {
    this.checkListeners.push(fn)
    return () => { this.checkListeners = this.checkListeners.filter((f) => f !== fn) }
  }

  // ── the timeline ──────────────────────────────────────────────────────────
  private update(): void {
    if (!this.playing) return
    const t = this.getTimelineTime()
    // the pre-roll holds the start point's pose and overlay alpha
    const at = Math.max(t, this.from)
    this.placeCamera(at)
    this.setAlpha(at < OVERLAYS_FROM ? 0 : Math.min(1, (at - OVERLAYS_FROM) / FADE_SECONDS))
    // scenes, actions and checks due by now, in timeline order (at high speed several land in one frame)
    for (;;) {
      const s = this.nextScene < SCENES.length ? SCENES[this.nextScene].start : Infinity
      const a = this.nextAction < ACTIONS.length ? ACTIONS[this.nextAction].t : Infinity
      const c = this.nextCheck < CHECKS.length ? CHECKS[this.nextCheck].t : Infinity
      const first = Math.min(s, a, c)
      if (first > t) break
      if (s === first) {
        const sc = SCENES[this.nextScene++]
        this.sceneLog.push({n: sc.n, t})
        print(`SCENE ${sc.n} start t=${sc.start.toFixed(1)}  (${sc.title})`)
      } else if (a === first) {
        this.run(ACTIONS[this.nextAction++])
      } else {
        // a check reads what is drawn: it runs late in this frame, after the alpha is applied, and
        // anything due after it waits for the next frame, so it sees exactly the state at its time
        this.pendingCheck = CHECKS[this.nextCheck++].key
        break
      }
    }
    const done = this.nextScene >= SCENES.length && this.nextAction >= ACTIONS.length && this.nextCheck >= CHECKS.length
    if (done && this.pendingCheck === null && t >= END + END_HOLD) {
      print(`SCENE end t=${END.toFixed(1)}`)
      this.stop()
    }
  }

  private lateUpdate(): void {
    this.applyAlpha()
    const key = this.pendingCheck
    if (key === null) return
    this.pendingCheck = null
    for (const fn of this.checkListeners.slice()) fn(key)
  }

  private run(a: DemoAction): void {
    const m = this.main
    switch (a.do) {
      case "pressLimb": m.pressLimb(a.arg as Limb); break
      case "pressHold": m.pressHold(a.arg as string); break
      case "pressHeight": m.pressHeight(a.arg as number); break
      case "pressAsk": m.pressAsk(); break
      case "pressMode": m.pressMode(); break
      case "pressView": m.pressView(); break
      case "pickType": m.pickType(a.arg as string); break
      case "pressStart": m.pressStart(); break
      case "pressTop": m.pressTop(); break
      case "pressDone": m.pressDone(); break
      case "pressRemove": m.pressRemove(); break
    }
  }

  // ── camera ────────────────────────────────────────────────────────────────
  private takeCamera(): boolean {
    const finder = WorldCameraFinderProvider.getInstance()
    const cam = finder ? finder.getComponent() : null
    if (!cam) {
      print("[DemoAutopilot] ERROR: no world camera")
      return false
    }
    const so = cam.getSceneObject()
    this.camT = so.getTransform()
    this.tracking = so.getComponent("Component.DeviceTracking") as DeviceTracking
    if (this.tracking) {
      this.trackingWas = this.tracking.enabled
      this.tracking.enabled = false
    }
    return true
  }

  /** the eye's pose at timeline t: eased between the keys around it, or the key itself after a cut */
  private placeCamera(t: number): void {
    if (!this.camT) return
    const p = poseAt(t)
    this.camT.setWorldPosition(new vec3(p.x, p.y, p.z))
    const d = Math.PI / 180
    this.camT.setWorldRotation(quat.angleAxis(-p.yaw * d, vec3.up()).multiply(quat.angleAxis(p.pitch * d, vec3.right())))
  }

  // ── what isn't the product ────────────────────────────────────────────────
  private hideNonProduct(): void {
    this.hidden = []
    for (const name of HIDE_WHILE_PLAYING) {
      for (const so of findAll(name)) {
        this.hidden.push({so, was: so.enabled})
        so.enabled = false
      }
    }
    this.colliders = []
    for (const id of this.main.getHoldIds()) {
      for (const so of findAll("Hold_" + id)) {
        const c = so.getComponent("Physics.ColliderComponent") as ColliderComponent
        if (!c) continue
        this.colliders.push({c, was: c.debugDrawEnabled})
        c.debugDrawEnabled = false
      }
    }
  }

  // ── overlay fade ──────────────────────────────────────────────────────────
  /** every overlay colour: materials of the wall's Overlays and of NextHold's panels, and their texts */
  private gatherFaded(): void {
    this.faded = []
    const mats: Material[] = []
    const roots = findAll("Overlays").concat([this.main.getSceneObject()])
    const add = (read: () => number, write: (a: number) => void) => this.faded.push({read, write, base: read(), written: null})
    /** the alpha of a colour property: only w is written, the Lens's current rgb is kept */
    const colour = (get: () => vec4, set: (c: vec4) => void) =>
      add(() => get().w, (a) => { const c = get(); set(new vec4(c.x, c.y, c.z, a)) })
    walk(roots, (so) => {
      for (const rmv of so.getComponents("Component.RenderMeshVisual") as RenderMeshVisual[]) {
        const mat = rmv.mainMaterial
        // a material shared by several visuals is scaled once
        if (!mat || mats.some((m) => m.isSame(mat))) continue
        const kind = alphaKind(mat)
        if (!kind) continue
        mats.push(mat)
        if (kind === "opacityFactor") add(() => mat.mainPass.opacityFactor, (a) => { mat.mainPass.opacityFactor = a })
        else colour(() => mat.mainPass.baseColor, (c) => { mat.mainPass.baseColor = c })
      }
      for (const text of so.getComponents("Component.Text") as Text[]) {
        colour(() => text.textFill.color, (c) => { text.textFill.color = c })
        if (text.outlineSettings.enabled) colour(() => text.outlineSettings.fill.color, (c) => { text.outlineSettings.fill.color = c })
      }
    })
  }

  private setAlpha(a: number): void {
    if (a === this.alpha) return
    this.alpha = a
    this.applyAlpha()
    if (a >= 1) {
      // faded in: every colour is the Lens's own again, and is left alone from here
      this.faded = []
    }
  }

  /** Each frame (late, after the Lens's own updates): a colour the Lens changed since it was last
   *  written is its new base; write base x alpha. */
  private applyAlpha(): void {
    if (!this.faded.length) return
    for (const f of this.faded) {
      const cur = f.read()
      if (f.written === null || Math.abs(cur - f.written) > 1e-4) f.base = cur
      const a = f.base * this.alpha
      f.write(a)
      f.written = a
    }
  }
}

/** the eye's pose at timeline t (DemoTimeline.CAMERA) */
export function poseAt(t: number): CameraKey {
  const k = CAMERA
  if (t <= k[0].t) return k[0]
  for (let i = 0; i + 1 < k.length; i++) {
    const a = k[i], b = k[i + 1]
    if (t >= b.t) continue
    if (b.cut) return a
    const u = (t - a.t) / Math.max(1e-6, b.t - a.t)
    const e = u * u * (3 - 2 * u) // ease in and out
    const l = (p: number, q: number) => p + (q - p) * e
    return {t, x: l(a.x, b.x), y: l(a.y, b.y), z: l(a.z, b.z), pitch: l(a.pitch, b.pitch), yaw: l(a.yaw, b.yaw)}
  }
  return k[k.length - 1]
}

/** how a material's alpha is set: UI Kit's opacityFactor, a baseColor, or neither (left alone) */
function alphaKind(mat: Material): "opacityFactor" | "baseColor" | null {
  try {
    if (typeof mat.mainPass.opacityFactor === "number") return "opacityFactor"
    if (mat.mainPass.baseColor instanceof vec4) return "baseColor"
  } catch (e) {
    // a pass without either parameter
  }
  return null
}

function walk(roots: SceneObject[], fn: (so: SceneObject) => void): void {
  const stack = roots.slice()
  while (stack.length) {
    const so = stack.pop()
    fn(so)
    for (let i = 0; i < so.getChildrenCount(); i++) stack.push(so.getChild(i))
  }
}

/** every SceneObject with this name, enabled or not */
function findAll(name: string): SceneObject[] {
  const roots: SceneObject[] = []
  for (let i = 0; i < global.scene.getRootObjectsCount(); i++) roots.push(global.scene.getRootObject(i))
  const out: SceneObject[] = []
  walk(roots, (so) => { if (so.name === name) out.push(so) })
  return out
}
