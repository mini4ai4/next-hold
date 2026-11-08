// DemoTimelineV8 — the video's take for v8 (session 30, CHANGES_V8 G4; session 31, CHANGES_V8_FIX1 item 5): the v7 take
// (DemoTimelineV7.ts) with every camera key, action and check 8 s later, after an opening beat for change 1. Scene 2's
// 16 − / + presses are gone: two other climbers are shown by two fresh eye readings, then you again, with no pinch. Go 2
// goes one hand move over the shortest so the card shows change 2. LEAF d3 plays it at x8; d2 still plays the v7 take.
//   0 (new) the height from your eye height: the eye stands 3 cm lower than the preview's own (y = −3: 163 cm over the
//     stand-in's floor), level and still on the mats; at 1.5 s the eye's proposal is turned on (enableEye, as an open
//     with no kept height does): "Reading your eye height…" for its 2.0 s window, then "Planned for 175 cm" / "from your
//     eye height (preview camera)", held to the end of the beat (8 s) and on through the hidden read. waitEye is a
//     gate: the Lens's window runs in real time, so at x8 the timeline waits for it.
//   1–2: the v7 take's scenes 0–1 (the hidden read, Show my beta), 8 s later.
//   3 (session 31, was Setup's − / +): a new climber on the glasses, twice: a fresh store (nothing kept) and the eye
//     proposal on again (freshEye), the eye still at y −21 (145 cm: 155, the head 2.8° up) then +16 (182 cm: 195), each read in 2 s with
//     no pinch, the beta's rings and 1-2-3 redrawn for that body; then a third fresh read at y −3 (175) for the rest of
//     the take. In the preview the camera's height stands in for each climber's eyes (the panel's line says so).
//   4–9: the v7 take's scenes 3–8, 8 s later. The eye rises to the preview's own height (y = 0, 166 cm) from 42.5 to
//     43.5 s; that is 3 cm, under the 4 cm the proposal needs to revise up, so it stays 175, and the first move (73 s)
//     keeps it in the take's own store.
//   9: go 2 goes RH up, LH h09, LF lh, then LH h10 (an intermediate hand move, one off the shortest), then LH h20:
//     TOPPED in 5 moves, and the card reads "SEND · go 2" / "5 moves · 4 is possible · rethink move 4" / "1 hint · sent!
//     Again without it?", with the time line under it ("m:ss start to top": the first time kept, and the take's timing,
//     not a climber's).

import {CameraKey, DemoAction, DemoCheck, DemoScene, DemoTake} from "./DemoTimeline"
import {V7_ACTIONS, V7_CAMERA, V7_CHECKS, V7_SCENES} from "./DemoTimelineV7"

/** the v7 take starts this much later */
export const V8_SHIFT = 8
/** the eye's height for the opening beat and for "you" (scene cm from the preview's reset eye): 163 cm -> 175 */
export const V8_EYE_Y = -3
/** session 31: the two other climbers' eyes (the reset eye is 166 cm over the floor; stature = eye / 0.935):
 *  145 cm -> 155.1 -> 155, 182 cm -> 194.7 -> 195 */
export const V8_EYE_155_Y = -21
export const V8_EYE_195_Y = 16
/** go 2's extra move: at V7's 105 s + 8 the plan's LF to lh, then LH to h10, then LH to the top */
const GO2_LH = 105 + V8_SHIFT
const GO2_EXTRA = 116
export const GO2_EXTRA_HOLD = "h10"
const GO2_TOP = 119
/** the card is up about 2.6 s after the top (TOPPED 2 s + its 0.6 s fade); the take holds it to the end */
export const V8_END = 130
/** session 31: scene 2's span on the v8 timeline (v7's 14-35, + 8): the readings replace the v7 Setup presses */
const S2_FROM = 14 + V8_SHIFT
const S2_TO = 35 + V8_SHIFT
/** the three readings: the eye arrives, then a fresh store and the proposal (freshEye), the gate, the check */
/** the mats pitch (V7's MATS_PITCH); for 155 the head comes up 2.8° (atan 21 / 425): the eye 21 cm lower then sees the
 *  wall's band as at 175, and the panel's footprint on the wall doesn't drop 21 cm onto a ring (d3 found it ranked 2 at
 *  -2°). Well inside the 10° a level head allows */
const MATS_PITCH = -2
const READS = [
  {cm: 155, y: V8_EYE_155_Y, pitch: MATS_PITCH + 2.8, arrive: 23, fresh: 23.5, gate: 26, check: 27.5, leave: 28.5},
  {cm: 195, y: V8_EYE_195_Y, pitch: MATS_PITCH, arrive: 29.5, fresh: 30, gate: 32.5, check: 34, leave: 35},
  {cm: 175, y: V8_EYE_Y, pitch: MATS_PITCH, arrive: 36, fresh: 36.5, gate: 39, check: 41, leave: 42.5},
]
export const V8_READS = READS

export const V8_SCENES: DemoScene[] = [
  {n: 0, start: 0, title: "the height from your eye height: \"Reading your eye height…\", then \"Planned for 175 cm\" / the preview's line"},
].concat(V7_SCENES.map((s) => ({n: s.n + 1, start: s.start + V8_SHIFT, title: s.title})))
// scene 3 and scene 9's titles say what changed
V8_SCENES[3] = {...V8_SCENES[3], title: "two other climbers by their eye height (155, then 195), then you (175): no pinch"}
V8_SCENES[V8_SCENES.length - 1] = {...V8_SCENES[V8_SCENES.length - 1], title: "go 2 from the mats: the pin, one hand move off the shortest, the top, the card with where to rethink and the time"}

const first = V7_CAMERA[0]
const readKeys: CameraKey[] = [{...first, t: S2_FROM, y: 0}]
for (const r of READS) readKeys.push({...first, t: r.arrive, y: r.y, pitch: r.pitch}, {...first, t: r.leave, y: r.y, pitch: r.pitch})
export const V8_CAMERA: CameraKey[] = [
  // the beat: the mats pose, the eye 3 cm lower, level and still
  {...first, t: 0, y: V8_EYE_Y},
  {...first, t: 7, y: V8_EYE_Y},
].concat(V7_CAMERA.map((k) => ({...k, t: k.t + V8_SHIFT})), readKeys).sort((a, b) => a.t - b.t)
// the last key holds to the v8 end
V8_CAMERA[V8_CAMERA.length - 1] = {...V8_CAMERA[V8_CAMERA.length - 1], t: V8_END}

// v7's scene 2 (Setup, 16 − / +, Setup) is replaced by the readings; go 2's last moves: V7's h20 at 110 (+8 = 118) and
// its card gate at 114 (+8) are replaced by h10, then h20, then the gate
const shifted: DemoAction[] = V7_ACTIONS.map((a) => ({...a, t: a.t + V8_SHIFT}))
const kept = shifted.filter((a) => !(a.t >= S2_FROM && a.t <= S2_TO) && !(a.t >= GO2_LH + 1))
const readActions: DemoAction[] = []
for (const r of READS) readActions.push({t: r.fresh, do: "freshEye"}, {t: r.gate, do: "waitEye"})
export const V8_ACTIONS: DemoAction[] = [
  {t: 1.5, do: "enableEye"},
  {t: 4, do: "waitEye"},
  ...kept.filter((a) => a.t < S2_FROM),
  ...readActions,
  ...kept.filter((a) => a.t > S2_TO),
  {t: GO2_EXTRA, do: "pressHold", arg: GO2_EXTRA_HOLD},
  {t: GO2_TOP, do: "pressHold", arg: "h20"},
  {t: GO2_TOP + 4, do: "waitCard"},
]

const shiftedChecks: DemoCheck[] = V7_CHECKS.filter((c) => c.t < 108).map((c) => ({...c, t: c.t + V8_SHIFT}))
export const V8_CHECKS: DemoCheck[] = [
  // before the proposal can land (the window is 2.0 s of real time after 1.5 s): the line reads the eye, no number
  {t: 3, key: "s0-eye-before"},
  // right after the gate: the eye's 175 and the preview's line, whole in view
  {t: 4.5, key: "s0-eye"},
  // still there at the end of the beat, before the eye rises
  {t: 6.9, key: "s0-eye-held"},
  ...shiftedChecks.filter((c) => c.t < S2_FROM),
  // session 31: the readings (v7's s2-setup / -155 / -195 / -175 keys are its Setup checks; these are the eye's)
  {t: READS[0].fresh + 0.5, key: "s2-reading"},
  {t: READS[0].check, key: "s2-eye-155"},
  {t: READS[1].check, key: "s2-eye-195"},
  {t: READS[2].check, key: "s2-eye-175"},
  ...shiftedChecks.filter((c) => c.t > S2_TO),
  {t: GO2_EXTRA - 1, key: "s8-lh"},
  {t: GO2_EXTRA + 1.5, key: "s8-extra"},
  {t: GO2_TOP + 1.5, key: "s8-topped"},
  {t: GO2_TOP + 4.5, key: "s8-card"},
  {t: V8_END, key: "end"},
]

export const V8_TAKE: DemoTake = {
  name: "v8", scenes: V8_SCENES, end: V8_END, camera: V8_CAMERA, actions: V8_ACTIONS, checks: V8_CHECKS, betaShownAtStart: false,
}
