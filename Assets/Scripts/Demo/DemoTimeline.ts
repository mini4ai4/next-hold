// DemoTimeline — the demo video's scenes 0-7 (devpost/VIDEO_PLAN.md) as data, for DemoAutopilot.
//
// Everything here is in timeline seconds from the start of the take (scene 0 = 0.0). The autopilot
// waits START_DELAY seconds after the Lens starts, then plays this; its Time Scale input speeds the
// whole thing up (LEAF d1 plays it at x8). Edit freely: keep each list sorted by time.
//
// Camera keys are the eye's pose in scene cm, the same numbers as MovePreviewCamera and the
// Inspector: the preview's reset pose is (0, 0, 0), 125 cm from the wall face and 166 cm above the
// floor, so z = 125 is 2.5 m back and z = -55 is 70 cm from the wall. pitch: degrees, + looks up.
// yaw: degrees, + turns right. Between two keys the eye eases in and out (no jumps); two keys
// with the same pose are a hold. cut: true jumps to that key instead (none used: VIDEO_PLAN's only
// cut, to the two stills in scene 4, is made in the edit while the Lens holds still).
//
// Actions call the same NextHoldMain functions a real pinch calls (see DemoAutopilot.ACTIONS), so
// each one shows the Lens's pinch ripple on the hold or button it lands on, as a real pinch does.
// Checks name the key states LEAF d1 verifies; they do nothing in a normal run.

export const START_DELAY = 3

export interface DemoScene { n: number; start: number; title: string }
export interface CameraKey { t: number; x: number; y: number; z: number; pitch: number; yaw: number; cut?: boolean }
export type DemoActionName = "pressLimb" | "pressHold" | "pressHeight" | "pressAsk" | "pressMode" | "pressView" |
  "pickType" | "pressStart" | "pressTop" | "pressDone" | "pressRemove"
export interface DemoAction { t: number; do: DemoActionName; arg?: string | number }
export interface DemoCheck { t: number; key: string }

/** VIDEO_PLAN v3 scene starts (s); the take ends at END */
export const SCENES: DemoScene[] = [
  {n: 0, start: 0, title: "the lit Ground read from 2.5 m: glow, R hand, 2 · LH, TOP"},
  {n: 1, start: 8, title: "look down at the start, up at the plan"},
  {n: 2, start: 30, title: "walk in: Ground, then On wall under 80 cm"},
  {n: 3, start: 48, title: "RH to up; step back to Ground"},
  {n: 4, start: 65, title: "back to the start; Height 155, then 195, the −/+ row in shot"},
  {n: 5, start: 90, title: "175 again; RH to up, LH to h09; LF; ? on h11"},
  {n: 6, start: 105, title: "look away: arrow and chime; look back"},
  {n: 7, start: 117, title: "setup: mark a hold, Crimp, Start, Done, Remove"},
]
export const END = 130

/** session 18: the take opens on the lit read (the hook in 2 s): the overlays fade in from 1 s to 2 s */
export const OVERLAYS_FROM = 1
export const FADE_SECONDS = 1

const BACK = 125 // 2.5 m from the wall: reading the problem from the mats
const LOWER = -17.5 // the look at the lower half (a2's head positions from 2.5 m)
const UPPER = 8.8 // the look at the upper half
// On wall the eye stands square in front of the suggested hold, 70 cm out, level with it: the
// view there is only ~40 x 46 cm, so off to one side the glow was cut by the frame's edge.
// x = the hold's wall x - 130.5 (the reset eye's wall x); pitch = atan((hold y - 166) / 70).
const WALL_Z = -55
const UP_X = 9.5 // "up" (140, 190)
const H09_X = -15.5 // h09 (115, 190)
const WALL_PITCH = 18.9
// scene 4: a step left and back to 2.8 m, the eye left of the problem's middle, so the panel sits on
// the left, beside h09 and h10: the −/+ row, the height label and "2 · LH" (on h09 at 155 cm, on h10
// at 195 cm) share one frame while the height changes
const HEIGHT_X = -15
const HEIGHT_Z = 155
const HEIGHT_YAW = -11.8
const HEIGHT_PITCH = 3.9
// scenes 5-6: the eye stays just left of the problem's middle (wall x 125.5), so the panel stays on
// the left, out of the shot, and looks a little right, midway between lh (90) and h11 (182): the
// why-line then sits right over h11 with nothing to slide away from
const FEET_X = -5
const FEET_YAW = 5.6
// scene 6: the head turns up and right, over the top right of the problem, until the next hold (lh)
// and its glow are out of view down to the left: the arrow in the lower left points back at lh past
// bare wall, and the panel (on the left, beyond lh) is out of the shot. Session 17 turned 42° right
// from the middle: the arrow sat by the panel's Climb button and read as "press Climb". Level, it
// sat on rh's ring (rh is level with lh).
const AWAY = 22
const AWAY_PITCH = 18

export const CAMERA: CameraKey[] = [
  // 0: already the lit read of the upper half; drift in to 2.5 m
  {t: 0, x: 0, y: 0, z: 135, pitch: UPPER, yaw: 0},
  {t: 8, x: 0, y: 0, z: BACK, pitch: UPPER, yaw: 0},
  // 1: down at the start and the feet, then up again at the glow, "2 · LH", "3 · LF", TOP
  {t: 10, x: 0, y: 0, z: BACK, pitch: UPPER, yaw: 0},
  {t: 12.5, x: 0, y: 0, z: BACK, pitch: LOWER, yaw: 0},
  {t: 18.5, x: 0, y: 0, z: BACK, pitch: LOWER, yaw: 0},
  {t: 21.5, x: 0, y: 0, z: BACK, pitch: UPPER, yaw: 0},
  {t: 28, x: 0, y: 0, z: BACK, pitch: UPPER, yaw: 0},
  {t: 30, x: 0, y: 0, z: BACK, pitch: 2, yaw: 0},
  // 2: walk in toward "up"; at 1.35 m it is still Ground; under 80 cm it is On wall
  {t: 30.5, x: 0, y: 0, z: BACK, pitch: 2, yaw: 0},
  {t: 35, x: 5, y: 0, z: 10, pitch: 8, yaw: 0},
  {t: 36.5, x: 5, y: 0, z: 10, pitch: 8, yaw: 0},
  {t: 40, x: UP_X, y: 0, z: WALL_Z, pitch: WALL_PITCH, yaw: 0},
  // 3: the move, On wall: the ring moves to h09 and the eye follows it; then step back to the upper look
  {t: 51, x: UP_X, y: 0, z: WALL_Z, pitch: WALL_PITCH, yaw: 0},
  {t: 53, x: H09_X, y: 0, z: WALL_Z, pitch: WALL_PITCH, yaw: 0},
  {t: 55.5, x: H09_X, y: 0, z: WALL_Z, pitch: WALL_PITCH, yaw: 0},
  {t: 61, x: 0, y: 0, z: BACK, pitch: UPPER, yaw: 0},
  // 4: step left and back (before the first pinch re-places the panel), then hold while the height changes
  {t: 61.5, x: 0, y: 0, z: BACK, pitch: UPPER, yaw: 0},
  {t: 64.5, x: HEIGHT_X, y: 0, z: HEIGHT_Z, pitch: HEIGHT_PITCH, yaw: HEIGHT_YAW},
  {t: 90, x: HEIGHT_X, y: 0, z: HEIGHT_Z, pitch: HEIGHT_PITCH, yaw: HEIGHT_YAW},
  // 5: back to 2.5 m and level, between lh (the foot) and h11 (see FEET_X)
  {t: 92.5, x: FEET_X, y: 0, z: BACK, pitch: 0, yaw: FEET_YAW},
  // 6: turn the head away from the next hold, then back
  {t: 106, x: FEET_X, y: 0, z: BACK, pitch: 0, yaw: FEET_YAW},
  {t: 108.5, x: FEET_X, y: 0, z: BACK, pitch: AWAY_PITCH, yaw: AWAY},
  {t: 112.5, x: FEET_X, y: 0, z: BACK, pitch: AWAY_PITCH, yaw: AWAY},
  {t: 115, x: FEET_X, y: 0, z: BACK, pitch: 0, yaw: FEET_YAW},
  // 7: step in and right a little, toward h12 (still Ground: 1.7 m)
  {t: 117, x: FEET_X, y: 0, z: BACK, pitch: 0, yaw: FEET_YAW},
  {t: 120, x: 20, y: 0, z: 45, pitch: -4, yaw: 0},
  {t: END, x: 20, y: 0, z: 45, pitch: -4, yaw: 0},
]

export const ACTIONS: DemoAction[] = [
  // 0: RH again as the overlays come in: the Lens shows "R hand" again (in Ground it fades after
  // ~2 s, and it showed while the Lens started, before the take)
  {t: 1.5, do: "pressLimb", arg: "RH"},
  // 3: pinch the glowing hold "up" (RH is already the selected limb: its label says "R hand").
  // Session 19: no RH button pinch first: On wall the panel is tucked under the ring, so its
  // ripple landed off-frame and the move's input read as a cut
  {t: 50.5, do: "pressHold", arg: "up"},
  // 4: back to the start first (RH down to rh): "2 · LH" names the pinch h09 or the jug h10 only
  // from there, as in r7 and beta-155/195cm.png; from RH on "up" the glow itself sits on them.
  // Then Height − to 155 cm, and + to 195 cm (badge 2 jumps from h09 to h10 at 185)
  {t: 65.5, do: "pressLimb", arg: "RH"},
  {t: 66.3, do: "pressHold", arg: "rh"},
  {t: 68.5, do: "pressHeight", arg: -1},
  {t: 69.1, do: "pressHeight", arg: -1},
  {t: 69.7, do: "pressHeight", arg: -1},
  {t: 70.3, do: "pressHeight", arg: -1},
  {t: 74.5, do: "pressHeight", arg: 1},
  {t: 75.1, do: "pressHeight", arg: 1},
  {t: 75.7, do: "pressHeight", arg: 1},
  {t: 76.3, do: "pressHeight", arg: 1},
  {t: 76.9, do: "pressHeight", arg: 1},
  {t: 77.5, do: "pressHeight", arg: 1},
  {t: 78.1, do: "pressHeight", arg: 1},
  {t: 78.7, do: "pressHeight", arg: 1},
  // 5: back to 175; RH to up again, then the plan's next move, LH to h09; pinch LF, then "?" and h11
  {t: 90.5, do: "pressHeight", arg: -1},
  {t: 91.1, do: "pressHeight", arg: -1},
  {t: 91.7, do: "pressHeight", arg: -1},
  {t: 92.3, do: "pressHeight", arg: -1},
  {t: 93.3, do: "pressLimb", arg: "RH"},
  {t: 94, do: "pressHold", arg: "up"},
  {t: 95.5, do: "pressLimb", arg: "LH"},
  {t: 96.2, do: "pressHold", arg: "h09"},
  {t: 97.4, do: "pressLimb", arg: "LF"},
  {t: 99.6, do: "pressAsk"},
  {t: 100.6, do: "pressHold", arg: "h11"},
  // 6: LF again closes the why-line, as a real pinch on it does
  {t: 105.3, do: "pressLimb", arg: "LF"},
  // 7: Setup; pinch h12, Crimp, Start, Done; pinch it again, Remove; back to Climb
  {t: 118, do: "pressMode"},
  {t: 119.5, do: "pressHold", arg: "h12"},
  {t: 121.2, do: "pickType", arg: "crimp"},
  {t: 122.7, do: "pressStart"},
  {t: 124.2, do: "pressDone"},
  {t: 125.9, do: "pressHold", arg: "h12"},
  {t: 127.6, do: "pressRemove"},
  {t: 129.3, do: "pressMode"},
]

/** the key states LEAF d1 checks, each just before the next thing happens */
export const CHECKS: DemoCheck[] = [
  {t: 2.5, key: "s0-ground-read"},
  {t: 17.5, key: "s1-lower"},
  {t: 27, key: "s1-upper"},
  {t: 36, key: "s2-still-ground"},
  {t: 47, key: "s2-on-wall"},
  {t: 54.5, key: "s3-after-pinch"},
  {t: 61.2, key: "s3-ground-again"},
  {t: 68, key: "s4-start"},
  {t: 74, key: "s4-155"},
  {t: 84, key: "s4-195"},
  {t: 99, key: "s5-lf"},
  {t: 104.5, key: "s5-why"},
  {t: 112, key: "s6-away"},
  {t: 116.5, key: "s6-back"},
  {t: 120.8, key: "s7-picker"},
  {t: 122.4, key: "s7-crimp"},
  {t: 123.9, key: "s7-start"},
  {t: 125.6, key: "s7-done"},
  {t: 127.3, key: "s7-reopened"},
  {t: 129, key: "s7-removed"},
  {t: END, key: "end"},
]

/** objects that are not the product, hidden while the autopilot plays (looked up by name at play) */
export const HIDE_WHILE_PLAYING = ["LeafDebugUICamera", "[OPTIONAL] Visuals"]
