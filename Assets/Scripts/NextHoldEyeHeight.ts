// NextHoldEyeHeight — the climber's height from their eye height (v8 change 1, session 29).
//
// Plain code with no Lens globals, unit-checked in Node (tests/scoring.port.test.mjs). NextHoldMain feeds the
// sampler one sample a frame (the camera's height over the floor under the climber, its pitch and roll) and applies
// the proposal the way a height step applies a height.
//
// Eye height is about 0.935 x stature (adult tables 0.933-0.937, men and women alike; about ±1 cm between people, the
// device's errors from mats, posture and shoes unmeasured), so stature = eye / 0.935,
// snapped to 5 cm (a kept height and the best's key both use 5 cm steps) and held to the Lens's 150-200 cm. A value
// whose implied stature is outside 140-210 cm (sitting, crouching, standing on a bench, a bad floor) is no proposal.
//
// When it samples (pushSample): only on the mats (Ground view, climb mode, no card up) with no go under way, the head
// level (|pitch| <= 10 deg, |roll| <= 8 deg) and still: a WINDOW_S window whose eye heights spread no more than 1.5 cm
// and whose horizontal speed is under 5 cm/s. The window's median is the eye height. It never revises down; it
// revises up only for a later window at least 4 cm higher (standing up after a crouch). It freezes on the first move
// of a go, on a manual − / +, and is never on when a height is kept.
//
// What the preview proves is this logic, not the measurement: in the preview the eye is wherever the scene puts it.

export const EYE_RATIO = 0.935
export const STATURE_MIN_CM = 140
export const STATURE_MAX_CM = 210
export const HEIGHT_MIN_CM = 150
export const HEIGHT_MAX_CM = 200
export const HEIGHT_STEP_CM = 5
/** seconds of level, still head the window needs (2.0 s: the LEAF reset sleeps 1.5 s before restorePreset) */
export const WINDOW_S = 2.0
export const MAX_PITCH_DEG = 10
export const MAX_ROLL_DEG = 8
export const MAX_SPREAD_CM = 1.5
export const MAX_SPEED_CM_S = 5
export const REVISE_UP_CM = 4

export function statureFromEye(eyeCm: number): number {
  return eyeCm / EYE_RATIO
}

/** a stature as a height the Lens can plan for: snapped to 5 cm and held to 150-200 (clamped says it was held);
 *  null when it isn't a plausible standing climber (outside 140-210 cm) */
export function proposeHeight(stature: number): {cm: number; clamped: boolean} | null {
  if (typeof stature !== "number" || !isFinite(stature) || stature < STATURE_MIN_CM || stature > STATURE_MAX_CM) return null
  const snapped = Math.round(stature / HEIGHT_STEP_CM) * HEIGHT_STEP_CM
  const cm = Math.min(HEIGHT_MAX_CM, Math.max(HEIGHT_MIN_CM, snapped))
  return {cm, clamped: cm !== snapped}
}

export interface EyeSample {
  /** seconds */
  t: number
  /** the eye's height over the floor under the climber, cm */
  eyeCm: number
  pitchDeg: number
  rollDeg: number
  /** horizontal position (cm), for the speed gate */
  x?: number
  z?: number
  /** Ground view, climb mode, no card up */
  onMats: boolean
  /** a go is under way */
  goLive: boolean
}

export interface EyeState {
  /** the samples of the current level, still window */
  window: {t: number; eyeCm: number; x: number; z: number}[]
  /** the proposed height, cm; null = none yet */
  proposal: number | null
  /** the eye height (window median) the proposal came from */
  eyeCm: number | null
  /** stature before snapping, for the log */
  stature: number | null
  frozen: boolean
  /** why the last sample didn't count, for the log and tests ("" when it did) */
  last: string
}

export function initialEye(): EyeState {
  return {window: [], proposal: null, eyeCm: null, stature: null, frozen: false, last: ""}
}

export function freezeEye(s: EyeState): EyeState {
  return s.frozen ? s : {...s, frozen: true, window: [], last: "frozen"}
}

function median(v: number[]): number {
  const a = v.slice().sort((p, q) => p - q)
  const m = a.length >> 1
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2
}

/** One frame's sample. Returns the new state; `proposal` changes only when a window is complete and passes. */
export function pushSample(s: EyeState, p: EyeSample): EyeState {
  if (s.frozen) return s
  const gate = !p.onMats ? "not on the mats" : p.goLive ? "go under way"
    : !isFinite(p.eyeCm) ? "no floor"
    : Math.abs(p.pitchDeg) > MAX_PITCH_DEG ? "head pitched"
    : Math.abs(p.rollDeg) > MAX_ROLL_DEG ? "head rolled" : ""
  if (gate) return {...s, window: [], last: gate}
  const x = p.x || 0, z = p.z || 0
  let w = s.window.concat([{t: p.t, eyeCm: p.eyeCm, x, z}])
  // a gap of more than a few frames (a dropped sample, a reset) starts the window again
  if (w.length > 1 && p.t - w[w.length - 2].t > 0.5) w = [w[w.length - 1]]
  // keep only the last WINDOW_S seconds (and one sample before, so the window can span the whole time)
  while (w.length > 2 && p.t - w[1].t >= WINDOW_S) w = w.slice(1)
  const span = p.t - w[0].t
  if (span < WINDOW_S) return {...s, window: w, last: "window filling"}
  const ys = w.map((q) => q.eyeCm)
  const spread = Math.max(...ys) - Math.min(...ys)
  const dist = Math.sqrt((x - w[0].x) * (x - w[0].x) + (z - w[0].z) * (z - w[0].z))
  if (spread > MAX_SPREAD_CM) return {...s, window: w, last: "head moving"}
  if (dist / span >= MAX_SPEED_CM_S) return {...s, window: w, last: "walking"}
  const eye = median(ys)
  const stature = statureFromEye(eye)
  const prop = proposeHeight(stature)
  if (!prop) return {...s, window: w, last: "implausible"}
  if (s.proposal !== null && s.eyeCm !== null && eye < s.eyeCm + REVISE_UP_CM) return {...s, window: w, last: ""}
  return {...s, window: w, proposal: prop.cm, eyeCm: eye, stature, last: ""}
}

export type HeightSource = "kept" | "manual" | "eye" | "inspector"

/** The height the Lens plans for and where it came from: a kept height wins, then a − / + this session, then the
 *  eye's proposal, then the Inspector's value. */
export function heightSource(kept: number | null, manual: number | null, proposal: number | null, inspector: number): {cm: number; source: HeightSource} {
  if (kept !== null) return {cm: kept, source: "kept"}
  if (manual !== null) return {cm: manual, source: "manual"}
  if (proposal !== null) return {cm: proposal, source: "eye"}
  return {cm: inspector, source: "inspector"}
}

export const EYE_LINE = "from your eye height"
/** session 31 (CHANGES_V8_FIX1 item 1): the feature first, the stand-in in brackets (it said "Preview: the camera's
 *  height stands in", which never said "eye") */
export const EYE_LINE_PREVIEW = "from your eye height (preview camera)"
/** while the window is filling with no proposal yet: the line names the reading instead of a number */
export const READING_LINE = "Reading your eye height…"
/** Setup, under "Your height: N cm", while the height came from the eye (not after a − / + or a kept height) */
export const SETUP_EYE_LINE = "from your eye height · − / + to change"

/** The climb page's planned line: one line, or two when the height came from the eye (in the preview the second
 *  line names the preview camera, as the voice chip says typed text does). Session 31: while the eye is being read
 *  and nothing is proposed yet, "Reading your eye height…" in place of the number. */
export function plannedText(cm: number, source: HeightSource, preview: boolean, reading = false): string {
  if (reading && source !== "eye") return READING_LINE
  const first = `Planned for ${cm} cm`
  if (source !== "eye") return first
  return first + "\n" + (preview ? EYE_LINE_PREVIEW : EYE_LINE)
}

/** Setup's second line under "Your height: N cm": only while the height came from the eye */
export function setupSourceLine(source: HeightSource): string {
  return source === "eye" ? SETUP_EYE_LINE : ""
}

/** session 31: the eye is being read: the proposal is on, nothing frozen or proposed yet, and a level, still window is
 *  filling (its first 2.0 s). A window that fails (a moving head, a crouch) stops reading once it is full, so the line
 *  never hides the number for long. */
export function isReading(on: boolean, s: EyeState): boolean {
  return on && !s.frozen && s.proposal === null && s.last === "window filling"
}

/** session 31 (CHANGES_V8_FIX1 item 9, the engineer's P1-1): the device floor from its hits along the gaze. Hits more
 *  than FLOOR_OUTLIER_CM from the median are dropped (a bench, a pad edge, a ray that hit a wall's foot); the floor is
 *  the median of what is left, once at least FLOOR_MIN_KEPT remain. null until then. */
export const FLOOR_HITS = 15
export const FLOOR_MIN_KEPT = 8
export const FLOOR_OUTLIER_CM = 8
/** the floor is measured again once the eye has moved this far (cm, horizontally) from where it was measured (from the
 *  gym floor onto 30 cm mats: a frozen floor would read every eye 30 cm low) */
export const FLOOR_REMEASURE_CM = 100

export function floorFromHits(hits: number[]): number | null {
  const ok = hits.filter((h) => typeof h === "number" && isFinite(h))
  if (ok.length < FLOOR_MIN_KEPT) return null
  const m = median(ok)
  const kept = ok.filter((h) => Math.abs(h - m) <= FLOOR_OUTLIER_CM)
  return kept.length >= FLOOR_MIN_KEPT ? median(kept) : null
}

export function needsRemeasure(at: {x: number; z: number} | null, eye: {x: number; z: number}): boolean {
  if (!at) return false
  const dx = eye.x - at.x, dz = eye.z - at.z
  return Math.sqrt(dx * dx + dz * dz) >= FLOOR_REMEASURE_CM
}

/** where the floor under the climber is, in world cm (y up); null when it isn't known yet */
export interface FloorSource {
  floorY(): number | null
  /** for the log: "preview wall" or "world query" */
  name(): string
  /** a frame's look, for a source that measures (the device's hit tests along the gaze); world cm */
  tick?(eye: {x: number; y: number; z: number}, gaze: {x: number; y: number; z: number}, pitchDeg: number): void
}

/** A floor at a fixed or computed height (the preview: the stand-in wall's floor line; tests) */
export class FixedFloor implements FloorSource {
  private get: () => number | null
  private label: string
  constructor(get: () => number | null, label = "fixed") { this.get = get; this.label = label }
  floorY(): number | null { return this.get() }
  name(): string { return this.label }
}
