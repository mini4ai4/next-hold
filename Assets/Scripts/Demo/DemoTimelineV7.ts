// DemoTimelineV7 — the video's take for v7 (session 28, CHANGES_V7_3 P0-1; the story of judge_v7_2/presentation.md):
//   0 the hidden read from the mats (4.25 m) → 1 Show my beta → 2 155 | 195 in Setup → 3 hide beta, walk in: the quiet wall →
//   4 "next hold" by voice (typed in the preview, the chip says so) → 5 "?" twice: the move, then why →
//   6 two moves, step back: came off → 7 the card's hint, then Again → 8 go 2 from the mats, the pin shows where the
//   climber fell, to the top; TOPPED, then the result card held for the take's last seconds.
// It opens as the Lens opens (beta hidden): no beta is set without a pinch. Every action calls the function a real
// pinch on that button or hold calls (so each ripples where it lands); "say" hands typed words to the preview's
// injected voice source, the only voice input the preview has.
// Times are timeline seconds from the take's start; camera keys as in DemoTimeline.ts (scene cm, the preview's reset
// pose is (0, 0, 0), 125 cm from the wall face and 166 cm up; pitch + looks up). LEAF d2 plays it at x8 and checks
// every CHECKS key and the card's exact lines.

import {CameraKey, DemoAction, DemoCheck, DemoScene, DemoTake} from "./DemoTimeline"

export const V7_SCENES: DemoScene[] = [
  {n: 0, start: 0, title: "the hidden read from the mats: outlines, START, TOP, the four buttons"},
  {n: 1, start: 8, title: "Show my beta: rings, the glow, 2 · LH, 3 · LF"},
  {n: 2, start: 14, title: "Setup: 155 cm, then 195 cm, then back to 175"},
  {n: 3, start: 35, title: "hide beta, walk in: the quiet wall"},
  {n: 4, start: 47, title: "\"next hold\" by voice (typed in the preview): rung 1"},
  {n: 5, start: 52, title: "? twice: the move, then why"},
  {n: 6, start: 64, title: "two moves, step back: came off"},
  {n: 7, start: 81, title: "the card's hint, then Again"},
  {n: 8, start: 92, title: "go 2 from the mats: the pin, the top, the card"},
]
/** the card goes up at about 112.6 s at real speed (TOPPED 2 s + its 0.6 s fade after the top at 110); held to the end */
export const V7_END = 120

// session 28 (v7.3 P0-2): the mats beats from S01's pose, 4.25 m back, 37.5 cm right, looking 2° down: the whole problem,
// TOP included, and the panel low at the right, over nothing (LEAF r5 ranks this pose 3, clear of everything). From
// 2.5 m looking up (session 27's S10/S11 pose) no place in view is clear of the glow, so the panel waits below the view
const MATS_X = 37.5
const MATS_Z = 300
const MATS_PITCH = -2
// on the wall: in under 80 cm (On wall), then back out to 105 cm (On wall holds until 120 cm), square between rh (150)
// and up (140): x = wall x - 130.5. From 70 cm the view is only ~46 cm tall and the strip beside the hands fell off its
// left edge; from 105 cm the hands, "up" and the strip are all in view (S03 was at 110 cm)
const IN_Z = -55
const WALL_Z = -20
const WALL_X = 4.5 // 10 cm left of between rh and up: the strip, left of the hands, is then whole in view
const WALL_PITCH = 2

export const V7_CAMERA: CameraKey[] = [
  // 0-2: drift in a little to the mats pose and stay for the read, the beta and the heights
  {t: 0, x: MATS_X, y: 0, z: MATS_Z + 15, pitch: MATS_PITCH, yaw: 0},
  {t: 7, x: MATS_X, y: 0, z: MATS_Z, pitch: MATS_PITCH, yaw: 0},
  {t: 35.5, x: MATS_X, y: 0, z: MATS_Z, pitch: MATS_PITCH, yaw: 0},
  // 3: walk in: Ground at 1.35 m, On wall under 80 cm
  {t: 39.5, x: 5, y: 0, z: 10, pitch: 6, yaw: 0},
  {t: 41.5, x: WALL_X, y: 0, z: IN_Z, pitch: WALL_PITCH, yaw: 0},
  {t: 44, x: WALL_X, y: 0, z: WALL_Z, pitch: WALL_PITCH, yaw: 0},
  // 4-6: on the wall through the voice, the ladder and the two moves
  {t: 71, x: WALL_X, y: 0, z: WALL_Z, pitch: WALL_PITCH, yaw: 0},
  // 6: step back off the wall to the mats pose (past 120 cm: came off)
  {t: 76, x: MATS_X, y: 0, z: MATS_Z, pitch: MATS_PITCH, yaw: 0},
  // 7-8: the rest from the mats; for go 2 the head comes up 3.5°, so TOPPED (larger than TOP) is whole in view
  {t: 92, x: MATS_X, y: 0, z: MATS_Z, pitch: MATS_PITCH, yaw: 0},
  {t: 95, x: MATS_X, y: 0, z: MATS_Z, pitch: MATS_PITCH + 3.5, yaw: 0},
  {t: V7_END, x: MATS_X, y: 0, z: MATS_Z, pitch: MATS_PITCH + 3.5, yaw: 0},
]

export const V7_ACTIONS: DemoAction[] = [
  // 1
  {t: 9, do: "pressShowBeta"},
  // 2: Setup, four − (155), eight + (195), four − (175), Setup again closes it
  {t: 15, do: "pressSetup"},
  {t: 16, do: "pressHeight", arg: -1},
  {t: 16.6, do: "pressHeight", arg: -1},
  {t: 17.2, do: "pressHeight", arg: -1},
  {t: 17.8, do: "pressHeight", arg: -1},
  {t: 22, do: "pressHeight", arg: 1},
  {t: 22.6, do: "pressHeight", arg: 1},
  {t: 23.2, do: "pressHeight", arg: 1},
  {t: 23.8, do: "pressHeight", arg: 1},
  {t: 24.4, do: "pressHeight", arg: 1},
  {t: 25, do: "pressHeight", arg: 1},
  {t: 25.6, do: "pressHeight", arg: 1},
  {t: 26.2, do: "pressHeight", arg: 1},
  {t: 30, do: "pressHeight", arg: -1},
  {t: 30.6, do: "pressHeight", arg: -1},
  {t: 31.2, do: "pressHeight", arg: -1},
  {t: 31.8, do: "pressHeight", arg: -1},
  {t: 33, do: "pressSetup"},
  // 3: Hide beta, then walk in
  {t: 35.5, do: "pressShowBeta"},
  // 4: before any hint, on the wall
  {t: 48, do: "say", arg: "next hold"},
  // 5: the move, then why
  {t: 53, do: "pressAsk"},
  {t: 58, do: "pressAsk"},
  // 6: RH to up, LH to h09 (the plan's first two moves), then the step back
  {t: 65, do: "pressHold", arg: "up"},
  {t: 68, do: "pressHold", arg: "h09"},
  // 7
  {t: 82, do: "pressCameOffHint"},
  {t: 88, do: "pressAgain"},
  // 8: go 2 from the start holds, the plan's four moves; the card's hint waits at h09 (where the climber came off)
  {t: 96, do: "pressHold", arg: "up"},
  {t: 99, do: "pressHold", arg: "h09"},
  {t: 105, do: "pressHold", arg: "lh"},
  {t: 110, do: "pressHold", arg: "h20"},
  {t: 114, do: "waitCard"},
]

export const V7_CHECKS: DemoCheck[] = [
  {t: 2.5, key: "s0-hidden-read"},
  {t: 12, key: "s1-beta"},
  {t: 15.5, key: "s2-setup"},
  {t: 21, key: "s2-155"},
  {t: 29, key: "s2-195"},
  {t: 34, key: "s2-175"},
  {t: 46, key: "s3-quiet-wall"},
  {t: 48.5, key: "s4-voice"},
  {t: 56, key: "s5-move"},
  {t: 61, key: "s5-why"},
  {t: 70, key: "s6-moved"},
  {t: 79, key: "s6-came-off"},
  {t: 85, key: "s7-hint"},
  {t: 90, key: "s7-again"},
  {t: 101, key: "s8-pin"},
  {t: 108, key: "s8-lh"},
  {t: 111.5, key: "s8-topped"},
  {t: 114.5, key: "s8-card"},
  {t: V7_END, key: "end"},
]

export const V7_TAKE: DemoTake = {
  name: "v7", scenes: V7_SCENES, end: V7_END, camera: V7_CAMERA, actions: V7_ACTIONS, checks: V7_CHECKS, betaShownAtStart: false,
}
