// NextHoldFloorSource — the floor under the climber on SPECS, for the eye height (v8 change 1, session 29).
//
// NOT RUN ON A DEVICE YET. WorldQueryModule is wearable-only and doesn't run in the Lens Studio preview, so this file
// has only been compiled, never exercised: the preview uses the stand-in wall's floor (NextHoldEyeHeight.FixedFloor).
// Everything is behind try/catch: if the module can't load or never hits, there is no floor, so no proposal, and
// Setup's − / + work as before.
//
// How: while the climber looks down at the mats (pitch between −25° and −60°), hit-test along the gaze; keep hits
// whose surface faces up (normal·up > 0.95) within 1.5 m horizontally of the eye, and take the median height of 10
// of them. That is the surface the climber stands on (the mat's top, not the gym floor). World Y is gravity-aligned
// and stable, so the floor is measured once.

import {FloorSource} from "./NextHoldEyeHeight"

const NEEDED_HITS = 10
const MAX_HORIZ_CM = 150
const RAY_CM = 400

export class WorldQueryFloor implements FloorSource {
  private session: HitTestSession | null = null
  private hits: number[] = []
  private floor: number | null = null
  private pending = false
  private failed = ""

  constructor() {
    try {
      const wq = require("LensStudio:WorldQueryModule") as WorldQueryModule
      const opts = HitTestSessionOptions.create()
      opts.filter = true
      this.session = wq.createHitTestSessionWithOptions(opts)
      this.session.start()
    } catch (e) {
      this.session = null
      this.failed = "" + e
    }
  }

  name(): string { return this.session ? "world query" : "world query unavailable (" + this.failed + ")" }

  floorY(): number | null { return this.floor }

  tick(eye: {x: number; y: number; z: number}, gaze: {x: number; y: number; z: number}, pitchDeg: number): void {
    if (!this.session || this.floor !== null || this.pending) return
    if (pitchDeg > -25 || pitchDeg < -60) return
    try {
      const start = new vec3(eye.x, eye.y, eye.z)
      const end = new vec3(eye.x + gaze.x * RAY_CM, eye.y + gaze.y * RAY_CM, eye.z + gaze.z * RAY_CM)
      this.pending = true
      this.session.hitTest(start, end, (hit) => {
        this.pending = false
        if (!hit) return
        const n = hit.normal, p = hit.position
        const dx = p.x - eye.x, dz = p.z - eye.z
        if (n.y > 0.95 && Math.sqrt(dx * dx + dz * dz) <= MAX_HORIZ_CM && p.y < eye.y) this.hits.push(p.y)
        if (this.hits.length >= NEEDED_HITS) {
          const a = this.hits.slice().sort((q, r) => q - r)
          this.floor = a[a.length >> 1]
          try { this.session!.stop() } catch (e) { /* nothing */ }
        }
      })
    } catch (e) {
      this.pending = false
    }
  }
}
