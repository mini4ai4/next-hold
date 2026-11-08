// NextHoldFloorSource — the floor under the climber on SPECS, for the eye height (v8 change 1, session 29).
//
// NOT RUN ON A DEVICE YET. WorldQueryModule is wearable-only and doesn't run in the Lens Studio preview, so this file
// has only been compiled, never exercised: the preview uses the stand-in wall's floor (NextHoldEyeHeight.FixedFloor).
// Everything is behind try/catch: if the module can't load or never hits, there is no floor, so no proposal, and
// Setup's − / + work as before.
//
// How: while the climber looks down (pitch between −20° and −75°), hit-test along the gaze; keep hits whose surface
// faces up (normal·up > 0.95), below the eye and within 3 m horizontally of it. From 15 such hits, drop any more than
// 8 cm from their median and take the median of the rest (NextHoldEyeHeight.floorFromHits, checked in node): that is
// the surface the climber stands on (the mat's top, not the gym floor). Session 31 (CHANGES_V8_FIX1 item 9, the
// engineer's P1-1): the band was −25°…−60° within 1.5 m, so with the eye 160 cm up only −47°…−60° could ever hit, and
// the floor was measured once and frozen. Now, once the eye has moved 1 m (horizontally) from where the floor was
// measured (the gym floor, then onto 30 cm mats), it is measured again; the old floor is used until the new one lands.

import {FLOOR_HITS, FloorSource, floorFromHits, needsRemeasure} from "./NextHoldEyeHeight"

const MAX_HORIZ_CM = 300
/** long enough for −20° from a 200 cm eye (200 / sin 20° = 585 cm) */
const RAY_CM = 600
const PITCH_MAX_DEG = -20
const PITCH_MIN_DEG = -75

export class WorldQueryFloor implements FloorSource {
  private session: HitTestSession | null = null
  private hits: number[] = []
  private floor: number | null = null
  /** where the eye was (x, z) when the floor in use was measured */
  private measuredAt: {x: number; z: number} | null = null
  private measuring = true
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
    if (!this.session || this.pending) return
    if (!this.measuring) {
      if (!needsRemeasure(this.measuredAt, {x: eye.x, z: eye.z})) return
      this.measuring = true
      this.hits = []
    }
    if (pitchDeg > PITCH_MAX_DEG || pitchDeg < PITCH_MIN_DEG) return
    try {
      const start = new vec3(eye.x, eye.y, eye.z)
      const end = new vec3(eye.x + gaze.x * RAY_CM, eye.y + gaze.y * RAY_CM, eye.z + gaze.z * RAY_CM)
      const at = {x: eye.x, z: eye.z}
      this.pending = true
      this.session.hitTest(start, end, (hit) => {
        this.pending = false
        if (!hit) return
        const n = hit.normal, p = hit.position
        const dx = p.x - at.x, dz = p.z - at.z
        if (n.y > 0.95 && Math.sqrt(dx * dx + dz * dz) <= MAX_HORIZ_CM && p.y < eye.y) this.hits.push(p.y)
        if (this.hits.length >= FLOOR_HITS) {
          const f = floorFromHits(this.hits)
          if (f !== null) {
            this.floor = f
            this.measuredAt = at
            this.measuring = false
          }
          // too scattered (fewer than 8 agree): start the 15 again
          this.hits = []
        }
      })
    } catch (e) {
      this.pending = false
    }
  }
}
