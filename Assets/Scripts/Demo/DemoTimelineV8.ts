// DemoTimelineV8 — the video's take for v8 (session 30, CHANGES_V8 G4): the v7 take (DemoTimelineV7.ts) with every
// camera key, action and check 8 s later, after an opening beat for change 1, and go 2 one move over the shortest so
// the card shows change 2's split. LEAF d3 plays it at x8; d2 still plays the v7 take, unchanged.
//   0 (new) the height from your eye height: the eye stands 3 cm lower than the preview's own (y = −3: 163 cm over the
//     stand-in's floor), level and still on the mats; at 1.5 s the eye's proposal is turned on (enableEye, as an open
//     with no kept height does) and about 2 s later the planned line reads "Planned for 175 cm" / "Preview: the
//     camera's height stands in", held to the end of the beat (8 s) and on through the hidden read. waitEye is a gate:
//     the Lens's 2.0 s window runs in real time, so at x8 the timeline waits for it.
//   1–9: the v7 take's scenes 0–8, 8 s later. In the preview the proposal is the camera's height, so this beat shows the
//     logic, not a measurement (the panel's second line says so). The eye rises back to the preview's own height (y = 0,
//     166 cm) from 7 to 8 s; that is 3 cm, under the 4 cm the proposal needs to revise up, so it stays 175 until Setup's
//     − / + (scene 3) take over, as they do in the v7 take.
//   9: go 2 goes RH up, LH h09, LF lh, then RF rh (one move off the shortest), then LH h20: TOPPED in 5 moves, and the
//     card reads "SEND · go 2" / "5 moves · shortest 4 · split at move 4" / "1 hint · sent! Again without it?", with
//     the time line under it ("m:ss start to top · new best", the take's timing, not a climber's).

import {CameraKey, DemoAction, DemoCheck, DemoScene, DemoTake} from "./DemoTimeline"
import {V7_ACTIONS, V7_CAMERA, V7_CHECKS, V7_END, V7_SCENES} from "./DemoTimelineV7"

/** the v7 take starts this much later */
export const V8_SHIFT = 8
/** the eye's height for the opening beat (scene cm from the preview's reset eye): 163 cm over the floor -> 175 */
export const V8_EYE_Y = -3
/** go 2's extra move (the split): at V7's 105 s + 8 the plan's LF to lh, then RF to rh, then LH to the top */
const GO2_LH = 105 + V8_SHIFT
const GO2_RH = 116
const GO2_TOP = 119
/** the card is up about 2.6 s after the top (TOPPED 2 s + its 0.6 s fade); the take holds it to the end */
export const V8_END = 130

export const V8_SCENES: DemoScene[] = [
  {n: 0, start: 0, title: "the height from your eye height: \"Planned for 175 cm\" / the preview's line"},
].concat(V7_SCENES.map((s) => ({n: s.n + 1, start: s.start + V8_SHIFT, title: s.title})))
// scene 9's title says what changed
V8_SCENES[V8_SCENES.length - 1] = {...V8_SCENES[V8_SCENES.length - 1], title: "go 2 from the mats: the pin, one move off the shortest, the top, the card with the split and the time"}

const first = V7_CAMERA[0]
export const V8_CAMERA: CameraKey[] = [
  // the beat: the mats pose, the eye 3 cm lower, level and still
  {...first, t: 0, y: V8_EYE_Y},
  {...first, t: 7, y: V8_EYE_Y},
].concat(V7_CAMERA.map((k) => ({...k, t: k.t + V8_SHIFT})))
// the last key holds to the v8 end
V8_CAMERA[V8_CAMERA.length - 1] = {...V8_CAMERA[V8_CAMERA.length - 1], t: V8_END}

const shifted: DemoAction[] = V7_ACTIONS.map((a) => ({...a, t: a.t + V8_SHIFT}))
// go 2's last moves: V7's h20 at 110 (+8 = 118) and its card gate at 114 (+8) are replaced by rh, then h20, then the gate
const go2 = shifted.filter((a) => !(a.t >= GO2_LH + 1))
export const V8_ACTIONS: DemoAction[] = [
  {t: 1.5, do: "enableEye"},
  {t: 4, do: "waitEye"},
  ...go2,
  {t: GO2_RH, do: "pressHold", arg: "rh"},
  {t: GO2_TOP, do: "pressHold", arg: "h20"},
  {t: GO2_TOP + 4, do: "waitCard"},
]

const shiftedChecks: DemoCheck[] = V7_CHECKS.filter((c) => c.t < 108).map((c) => ({...c, t: c.t + V8_SHIFT}))
export const V8_CHECKS: DemoCheck[] = [
  // before the proposal can land (the window is 2.0 s of real time after 1.5 s): nothing changed yet
  {t: 3, key: "s0-eye-before"},
  // right after the gate: the eye's 175 and the preview's line, whole in view
  {t: 4.5, key: "s0-eye"},
  // still there at the end of the beat, before the eye rises
  {t: 6.9, key: "s0-eye-held"},
  ...shiftedChecks,
  {t: GO2_RH - 1, key: "s8-lh"},
  {t: GO2_RH + 1.5, key: "s8-rh"},
  {t: GO2_TOP + 1.5, key: "s8-topped"},
  {t: GO2_TOP + 4.5, key: "s8-card"},
  {t: V8_END, key: "end"},
]

export const V8_TAKE: DemoTake = {
  name: "v8", scenes: V8_SCENES, end: V8_END, camera: V8_CAMERA, actions: V8_ACTIONS, checks: V8_CHECKS, betaShownAtStart: false,
}
