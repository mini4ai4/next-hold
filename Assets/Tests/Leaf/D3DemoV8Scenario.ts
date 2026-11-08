// Session 30 (CHANGES_V8 G4), session 31 (CHANGES_V8_FIX1 item 5): the v8 take for the video (DemoTimelineV8.ts),
// played by the autopilot at x8 from a fresh, beta-hidden Lens. Not a done criterion, like d1 and d2. It checks:
//   - the take itself: no − / + anywhere in it (no pressHeight action at all, so none before the first move)
//   - the opening eye beat: before the proposal can land (t 3) the line reads "Reading your eye height…", no number,
//     the eye not yet the source; after the gate (t 4.5) "Planned for 175 cm" / "from your eye height (preview
//     camera)", from the eye, both lines whole in view and at least 0.5° tall as drawn; and every frame from there to
//     the end of the beat (t 7.9) the line is still up (held), and still at t 6.9 ("s0-eye-held")
//   - the v7 take's beats 8 s later, with d2's own checks for each key (the hidden read, Show my beta, the quiet wall,
//     the voice, the ladder, the fall, the card's hint, Again, the pin)
//   - in place of v7's Setup − / +: two other climbers by fresh eye readings, no pinch: "Reading your eye height…" at
//     the first; then 155 from the eye with the beta's "2 · LH" on h09, 195 on h10, and 175 again on h09, each with the
//     preview's line, on the climb page with the beta shown, the planned lines whole in view, the panel over nothing,
//     no move yet; after the first move (s6-moved) still 175 from the eye
//   - go 2 one hand move off the shortest: LF on lh, then LH on h10 (s8-extra), TOPPED on h20
//   - the card's three lines word for word ("SEND · go 2" / "5 moves · 4 is possible · rethink move 4" / "1 hint · sent!
//     Again without it?"), the time line by its pattern ("m:ss start to top": the first time kept, no suffix; the
//     Lens's clock runs in real time, so at x8 the number is the take's own), Again beside the card, the card up for at
//     least 4 s of the take and never down once up; no time line on screen before the card (no clock while climbing)
//   - every action's ripple in order, the scenes logged 0-9 in order, the take handed back at the end.

import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {DemoAutopilot} from "../../Scripts/Demo/DemoAutopilot"
import {V8_ACTIONS, V8_CHECKS, V8_END, V8_SCENES, V8_TAKE} from "../../Scripts/Demo/DemoTimelineV8"
import {NextHoldMain} from "../../Scripts/NextHoldMain"
import {AGAIN_GAP, AGAIN_W, RESULT_HALF_W} from "../../Scripts/NextHoldCalloutUI"
import {camera, checkSideBySide, eyeToWallCm, fmtPos, frames, getMain, mustFind, notOnScreen, restorePreset} from "./NextHoldTestKit"
import {RefPosition} from "./NextHoldReferenceRule"
import {checkKey, rippleTarget} from "./D2DemoV7Scenario"

const SPEED = 8
/** the spec's words, fixed here (not read from the Lens) */
const PREVIEW_EYE_LINE = "from your eye height (preview camera)"
const READING = "Reading your eye height…"
export const D3_CARD = ["SEND · go 2", "5 moves · 4 is possible · rethink move 4", "1 hint · sent! Again without it?"]
/** the first time kept: no suffix */
const TIME_LINE = /^\d:\d\d start to top$/
/** the readings: the height, and the hold "2 · LH" shows on for that body (as d2's Setup checks: 155 h09, 195 h10) */
const READS: {[key: string]: {cm: number; badge: string}} = {
  "s2-eye-155": {cm: 155, badge: "h09"}, "s2-eye-195": {cm: 195, badge: "h10"}, "s2-eye-175": {cm: 175, badge: "h09"},
}
const D2R = Math.PI / 180

/** the screen box of one Text's world box, or null when hidden, empty or behind the eye */
function textBox(t: Text | null, cam: Camera): {x0: number; x1: number; y0: number; y1: number} | null {
  if (!t || !t.getSceneObject().isEnabledInHierarchy || !t.text) return null
  const lo = t.worldAabbMin(), hi = t.worldAabbMax()
  const inv = cam.getSceneObject().getTransform().getInvertedWorldTransform()
  const b = {x0: 1e9, x1: -1e9, y0: 1e9, y1: -1e9}
  for (const x of [lo.x, hi.x]) for (const y of [lo.y, hi.y]) for (const z of [lo.z, hi.z]) {
    const p = new vec3(x, y, z)
    if (inv.multiplyPoint(p).z >= 0) return null
    const s = cam.worldSpaceToScreenSpace(p)
    b.x0 = Math.min(b.x0, s.x); b.x1 = Math.max(b.x1, s.x); b.y0 = Math.min(b.y0, s.y); b.y1 = Math.max(b.y1, s.y)
  }
  return b
}

function eyeLineShown(main: NextHoldMain, cm = 175): boolean {
  return main.getHeightCm() === cm && main.getHeightSource() === "eye" && main.getPlannedLine() === `Planned for ${cm} cm` && main.getHeightSourceLine() === PREVIEW_EYE_LINE
}

function badge(main: NextHoldMain, n: number): string {
  const so = mustFind("GhostNumber_" + n)
  return so.enabled ? `${(so.getComponent("Component.Text") as Text).text} on ${main.getGhostHold(n)}` : "none"
}

/** both planned lines drawn whole in view and at least 0.5° tall */
function linesDrawn(main: NextHoldMain, e: string[], tag: string, both = true): void {
  const cam = camera()
  const tanV = Math.tan(cam.fov / 2)
  const degH = (b: {y0: number; y1: number}) => (Math.atan((0.5 - b.y0) * 2 * tanV) - Math.atan((0.5 - b.y1) * 2 * tanV)) / D2R
  const texts = main.getPlannedTexts()
  const list: [string, Text | null][] = [["the planned line", texts.planned]]
  if (both) list.push(["the eye line", texts.source])
  for (const [name, t] of list) {
    const b = textBox(t, cam)
    if (!b) { e.push(`${tag}: ${name} doesn't render`); continue }
    if (!(b.x0 >= 0 && b.x1 <= 1 && b.y0 >= 0 && b.y1 <= 1)) e.push(`${tag}: ${name} is cut by the frame (x ${b.x0.toFixed(3)}..${b.x1.toFixed(3)}, y ${b.y0.toFixed(3)}..${b.y1.toFixed(3)})`)
    if (degH(b) < 0.5) e.push(`${tag}: ${name} is ${degH(b).toFixed(2)}° tall as drawn`)
  }
}

function checkV8Key(key: string, main: NextHoldMain, pilot: DemoAutopilot): string[] {
  const e: string[] = []
  const want = (c: boolean, m: string) => { if (!c) e.push(m) }
  const pos = main.getPosition() as RefPosition
  const state = `${main.getHeightCm()} cm (${main.getHeightSource()}), "${main.getPlannedLine()}" / "${main.getHeightSourceLine()}"`
  switch (key) {
    case "s0-eye-before":
      want(main.isEyeProposalOn(), "the eye's proposal isn't on after enableEye")
      want(main.getHeightSource() !== "eye" && main.getPlannedLine() === READING && main.getHeightSourceLine() === "", `before the window is full: ${state}, want "${READING}"`)
      linesDrawn(main, e, "s0-eye-before", false)
      break
    case "s0-eye":
    case "s0-eye-held": {
      want(eyeLineShown(main), `${state}, want 175 from the eye with "${PREVIEW_EYE_LINE}"`)
      linesDrawn(main, e, key)
      want(!main.isBetaShown() && main.getView() === "ground", `beta ${main.isBetaShown()}, view ${main.getView()}`)
      break
    }
    case "s2-reading":
      // a new climber on the glasses (freshEye): the line reads the eye, no number yet; the beta stays shown
      want(main.isEyeProposalOn() && main.getHeightSource() !== "eye" && main.getPlannedLine() === READING && main.getHeightSourceLine() === "", `the second climber's read: ${state}, want "${READING}"`)
      want(main.isBetaShown() && main.getPage() === "climb", `beta ${main.isBetaShown()}, page ${main.getPage()}`)
      break
    case "s2-eye-155":
    case "s2-eye-195":
    case "s2-eye-175": {
      const r = READS[key]
      const d = eyeToWallCm(camera())
      want(eyeLineShown(main, r.cm), `${state}, want ${r.cm} from the eye with "${PREVIEW_EYE_LINE}"`)
      want(main.isBetaShown() && main.getPage() === "climb" && main.getView() === "ground" && d > 415 && d < 445, `beta ${main.isBetaShown()}, page ${main.getPage()}, view ${main.getView()} at ${d.toFixed(0)} cm`)
      want(badge(main, 2) === `2 · LH on ${r.badge}`, `badge 2 ${badge(main, 2)}, want 2 · LH on ${r.badge}`)
      if (!main.isRowHidden()) want(main.getGroundPanelRank() === 3, `the panel's place is rank ${main.getGroundPanelRank()}, want 3 (over nothing)`)
      linesDrawn(main, e, key)
      const off = notOnScreen(["PlannedLine", "GhostNumber_2", "GhostNumber_3"], camera())
      want(!off.length, `not fully in view: ${off.join(", ")}`)
      // nothing is kept before the first move (the take's store is fresh for each climber)
      want(main.getMovesMade() === 0, `moves ${main.getMovesMade()} before the first move`)
      break
    }
    case "s8-lh":
      want(pos.LF === "lh" && pos.RF !== "rh" && main.getHintStep() === 0, `${fmtPos(pos)}, rung ${main.getHintStep()}`)
      break
    case "s8-extra":
      // session 31: the extra move is a hand move (an intermediate), not a foot re-set
      want(pos.LH === "h10" && pos.LF === "lh" && pos.RH === "up" && pos.RF !== "rh" && !main.isTopped(), `${fmtPos(pos)}, topped ${main.isTopped()}`)
      break
    case "s6-moved":
      // the v7 check, and the eye's 175 still planned after the first move (the take's own store keeps it)
      e.push(...checkKey(key, main, pilot))
      want(main.getHeightCm() === 175 && main.getHeightSource() === "eye", `after the first move: ${state}`)
      break
    case "s8-card": {
      const lines = main.getResultLines()
      want(lines.join(" | ") === D3_CARD.join(" | "), `the card reads "${lines.join(" | ")}", want "${D3_CARD.join(" | ")}"`)
      want(TIME_LINE.test(main.getResultTimeLine()), `the time line reads "${main.getResultTimeLine()}"`)
      want(main.isRowHidden() && main.isAgainVisible(), `panel hidden ${main.isRowHidden()}, Again ${main.isAgainVisible()}`)
      checkSideBySide("ResultCard", 2 * RESULT_HALF_W, "AgainButton", AGAIN_W, AGAIN_GAP, e, "s8-card")
      const off = notOnScreen(["ResultCard", "AgainButton"], camera())
      want(!off.length, `not fully in view: ${off.join(", ")}`)
      break
    }
    case "end":
      want(main.isResultVisible() && main.getResultLines().join(" | ") === D3_CARD.join(" | ") && TIME_LINE.test(main.getResultTimeLine()),
        `the card at the end: ${main.isResultVisible()} "${main.getResultLines().join(" | ")}" / "${main.getResultTimeLine()}"`)
      break
    default:
      // the v7 take's beats: d2's own checks
      return checkKey(key, main, pilot)
  }
  return e
}

@component
export class D3DemoV8Scenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const main = getMain()
    await restorePreset(main, false)
    const errs: string[] = []
    const pilot = mustFind("DemoAutopilot").getComponent(DemoAutopilot.getTypeName()) as DemoAutopilot
    if (!pilot) throw new Error("DemoAutopilot component not found")
    if (pilot.playOnStart) errs.push("Play On Start is ticked in the scene: it must be off")
    // session 31 (CHANGES_V8_FIX1 item 5): no − / + in the take, so none before the first move
    const presses = V8_ACTIONS.filter((a) => a.do === "pressHeight")
    const firstMove = V8_ACTIONS.filter((a) => a.do === "pressHold")[0]
    if (presses.length) errs.push(`the take presses − / + ${presses.length} times (first at ${presses[0].t} s; the first move at ${firstMove ? firstMove.t : "-"} s)`)
    if (V8_ACTIONS.filter((a) => a.do === "freshEye").length !== 3) errs.push(`the take has ${V8_ACTIONS.filter((a) => a.do === "freshEye").length} fresh readings, want 3 (155, 195, 175)`)

    const seen: {key: string; t: number; errs: string[]}[] = []
    const unsub = pilot.addCheckListener((key) => seen.push({key, t: pilot.getTimelineTime(), errs: checkV8Key(key, main, pilot)}))
    const rippleFrom = main.getRippleLog().length
    let cardFrom = -1, cardGaps = 0, eyeFrom = -1, eyeGaps = 0, clockFrames = 0
    try {
      pilot.play(SPEED, 0, V8_TAKE)
      if (!pilot.isPlaying() || pilot.getTake() !== V8_TAKE) throw new Error(`play() didn't start the v8 take (${pilot.getTake().name})`)
      const t0 = getTime()
      while (pilot.isPlaying() && getTime() - t0 < 70) {
        await frames(1)
        const tl = pilot.getTimelineTime()
        // the eye line, every frame of the beat once it is up (held to 7.9 s, where the eye starts to rise)
        if (tl < 7.9) {
          if (eyeLineShown(main)) { if (eyeFrom < 0) eyeFrom = tl }
          else if (eyeFrom >= 0) eyeGaps++
        }
        // no time on screen before the card (no clock while climbing)
        if (!main.isResultVisible() && main.getResultTimeLine() !== "") clockFrames++
        if (main.isResultVisible()) { if (cardFrom < 0) cardFrom = tl }
        else if (cardFrom >= 0 && tl <= V8_END) cardGaps++
      }
      if (pilot.isPlaying()) errs.push(`still playing after 70 s at x${SPEED}`)
    } finally {
      unsub()
      pilot.stop()
    }

    const keys = seen.map((s) => s.key)
    if (keys.join() !== V8_CHECKS.map((c) => c.key).join()) errs.push(`checks fired: ${keys.join(",")}; want ${V8_CHECKS.map((c) => c.key).join(",")}`)
    for (const s of seen) {
      print(`[d3] ${s.key} t=${s.t.toFixed(1)}: ${s.errs.length ? "FAIL " + s.errs.join("; ") : "ok"}`)
      for (const m of s.errs) errs.push(`${s.key}: ${m}`)
    }
    print(`[d3] the eye line up from t=${eyeFrom.toFixed(2)} (the gate waited ${pilot.getEyeWait().toFixed(2)} s real), ${eyeGaps} frames without it before 7.9 s`)
    if (eyeFrom < 0 || eyeFrom > 4.5) errs.push(`the eye line came up at t=${eyeFrom}`)
    if (eyeGaps) errs.push(`the eye line went down for ${eyeGaps} frames in the beat`)
    if (clockFrames) errs.push(`a time line was up for ${clockFrames} frames before the card`)
    print(`[d3] the card up from t=${cardFrom.toFixed(1)} to ${V8_END} (${(V8_END - cardFrom).toFixed(1)} s of the take), the card gate waited ${pilot.getCardWait().toFixed(1)} s real; time line "${main.getResultTimeLine()}"`)
    if (cardFrom < 0 || V8_END - cardFrom < 4) errs.push(`the card is up for ${(V8_END - cardFrom).toFixed(1)} s of the take, want at least 4`)
    if (cardGaps) errs.push(`the card went down for ${cardGaps} frames before the end`)

    const ripples = main.getRippleLog().slice(rippleFrom).map((r) => r.target)
    const wantRipples = V8_ACTIONS.map(rippleTarget).filter((x) => x !== null)
    print(`[d3] ripples ${ripples.join(",")}`)
    if (ripples.join() !== wantRipples.join()) errs.push(`ripples ${ripples.join(",")}; want ${wantRipples.join(",")}`)
    const log = pilot.getSceneLog()
    if (log.map((l) => l.n).join() !== V8_SCENES.map((s) => s.n).join()) errs.push(`scene log ${log.map((l) => l.n).join(",")}`)

    await restorePreset(main)
    expect(errs.length, "the v8 take:\n" + errs.join("\n")).toBe(0)
  }
}
