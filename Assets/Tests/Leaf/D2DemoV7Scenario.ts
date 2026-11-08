// Session 28 (CHANGES_V7_3 P0-1): the v7 take for the video (DemoTimelineV7.ts), played by the autopilot at x8 from a
// fresh, beta-hidden Lens. In the frame each CHECKS key fires it checks that key's state as drawn:
//   s0 the hidden read from 2.5 m (no ring, no glow, no badge; every problem hold's outline; START, TOP; the four
//   buttons, "Show my beta", ○○○) · s1 Show my beta (the glow on up, "2 · LH" on h09, "3 · LF" on lh, "Hide beta") ·
//   s2 Setup: 155 ("2 · LH" on h09), 195 (on h10), 175 again and the climb page · s3 the quiet wall (On wall, nothing
//   revealed, the strip ? and Body in view) · s4 "next hold" typed: rung 1, the chip with its preview line · s5 "?":
//   rung 2 (the glow on up, "R hand"), rung 3 (●●●) · s6 two moves, then off the wall: "Came off from here" (h09 pulsing)
//   over "Hint · move 3", Again,
//   the panel hidden, go 2 · s7 the card's hint (rung 1, pinned, one hint for go 2), Again (the start holds, 0 moves)
//   · s8 the pin back at h09, LF to lh, TOPPED on h20 · the card's exact three lines, with Again beside it, and the card
//   up for at least 4 s of the take before it ends.
// Also: every action's pinch ripples where it lands, in order; the scenes log in order; the take ends handed back.

import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {DemoAutopilot} from "../../Scripts/Demo/DemoAutopilot"
import {DemoAction} from "../../Scripts/Demo/DemoTimeline"
import {V7_ACTIONS, V7_CHECKS, V7_END, V7_SCENES, V7_TAKE} from "../../Scripts/Demo/DemoTimelineV7"
import {NextHoldMain} from "../../Scripts/NextHoldMain"
import {PREVIEW_VOICE_LABEL} from "../../Scripts/NextHoldVoice"
import {HOLDS, PRESET_START, PRESET_TOP} from "../../Scripts/Wall/WallLayout"
import {AGAIN_GAP, AGAIN_W, RESULT_HALF_W} from "../../Scripts/NextHoldCalloutUI"
import {camera, checkNothingRevealed, checkSideBySide, eyeToWallCm, fmtPos, frames, getMain, isPresetProblem, mustFind, notOnScreen, presetPosition, restorePreset, samePosition} from "./NextHoldTestKit"
import {RefPosition} from "./NextHoldReferenceRule"

const SPEED = 8
/** the card's lines at the end of the take */
export const D2_CARD = ["SEND · go 2", "4 moves · the shortest for you", "1 hint · sent! Again without it?"]

export function rippleTarget(a: DemoAction): string | null {
  switch (a.do) {
    case "pressHold": return String(a.arg)
    case "pressHeight": return (a.arg as number) > 0 ? "HeightUp" : "HeightDown"
    case "pressAsk": return "AskButton"
    case "say": return "AskButton" // "next hold" presses "?"
    case "pressSetup": return "SetupButton"
    case "pressShowBeta": return "ShowBetaButton"
    case "pressCameOffHint": return "CameOffCard"
    case "pressAgain": return "AgainButton"
    case "pressBody": return "BodyButton"
  }
  return null
}

function badge(main: NextHoldMain, n: number): string {
  const so = mustFind("GhostNumber_" + n)
  return so.enabled ? `${(so.getComponent("Component.Text") as Text).text} on ${main.getGhostHold(n)}` : "none"
}

export function checkKey(key: string, main: NextHoldMain, pilot: DemoAutopilot): string[] {
  const e: string[] = []
  const want = (c: boolean, m: string) => { if (!c) e.push(m) }
  const d = eyeToWallCm(camera())
  const pos = main.getPosition() as RefPosition
  const inView = (names: string[]) => { const off = notOnScreen(names, camera()); want(!off.length, `not fully in view: ${off.join(", ")}`) }
  // session 28: the mats beats from S01's pose (4.25 m), where the panel covers nothing (r5 ranks it 3)
  const ground = () => {
    want(main.getView() === "ground" && d > 415 && d < 445, `view ${main.getView()} at ${d.toFixed(0)} cm, want Ground at 4.25-4.4 m`)
    if (!main.isRowHidden()) want(main.getGroundPanelRank() === 3, `the panel's place is rank ${main.getGroundPanelRank()}, want 3 (over nothing)`)
  }
  const heightAt = (cm: number, hold: string) => {
    want(main.getHeightCm() === cm && main.getPlannedLine() === `Your height: ${cm} cm`, `height ${main.getHeightCm()}, "${main.getPlannedLine()}"`)
    want(badge(main, 2) === `2 · LH on ${hold}`, `badge 2 ${badge(main, 2)}, want 2 · LH on ${hold}`)
    want(main.getPage() === "settings", `page ${main.getPage()}, want the settings`)
    inView(["HeightDown", "HeightUp", "PlannedLine", "GhostNumber_2"])
  }
  switch (key) {
    case "s0-hidden-read":
      ground()
      want(pilot.getOverlayAlpha() === 1, `overlay alpha ${pilot.getOverlayAlpha()} at 2.5 s`)
      want(!main.isBetaShown(), "the take opens with the beta shown")
      checkNothingRevealed(main, e, "s0")
      for (const h of HOLDS) {
        const inP = isPresetProblem(h.id)
        want(main.isOutlineVisible(h.id) === inP, `outline of ${h.id} shown ${main.isOutlineVisible(h.id)}`)
        const tag = h.id === PRESET_TOP ? "TOP" : PRESET_START.indexOf(h.id) >= 0 ? "START" : null
        want(main.getTagText(h.id) === tag, `${h.id} tagged "${main.getTagText(h.id)}", want "${tag}"`)
      }
      want(main.getShowBetaLabel() === "Show my\nbeta" && main.getAskDots() === "○○○" && main.getPage() === "climb", `panel: "${main.getShowBetaLabel()}" ${main.getAskDots()} ${main.getPage()}`)
      inView(["ShowBetaButton", "AskButton", "BodyButton", "SetupButton", "Tag_" + PRESET_TOP])
      break
    case "s1-beta":
      ground()
      want(main.isBetaShown() && main.getShowBetaLabel() === "Hide\nbeta", `beta ${main.isBetaShown()}, button "${main.getShowBetaLabel()}"`)
      want(main.isRingGlowing("up"), "the glow is not on up")
      want(badge(main, 2) === "2 · LH on h09" && badge(main, 3) === "3 · LF on lh", `badges ${badge(main, 2)}, ${badge(main, 3)}`)
      inView(["GhostNumber_2", "GhostNumber_3", "ShowBetaButton"])
      break
    case "s2-setup":
      want(main.getPage() === "settings", `page ${main.getPage()}`)
      inView(["HeightDown", "HeightUp", "PlannedLine"])
      break
    case "s2-155": heightAt(155, "h09"); break
    case "s2-195": heightAt(195, "h10"); break
    case "s2-175":
      want(main.getHeightCm() === 175 && main.getPage() === "climb", `height ${main.getHeightCm()}, page ${main.getPage()}`)
      want(badge(main, 2) === "2 · LH on h09", `badge 2 ${badge(main, 2)}`)
      break
    case "s3-quiet-wall":
      // in under 80 cm, then back out to 105 cm: On wall holds until 120 cm
      want(main.getView() === "wall" && d > 95 && d < 115, `view ${main.getView()} at ${d.toFixed(0)} cm, want On wall at about 105 cm`)
      want(!main.isBetaShown() && main.getHintStep() === 0, `beta ${main.isBetaShown()}, rung ${main.getHintStep()}`)
      checkNothingRevealed(main, e, "s3")
      want(samePosition(pos, presetPosition()), `not on the start holds: ${fmtPos(pos)}`)
      inView(["AskButton", "BodyButton"])
      break
    case "s4-voice": {
      const log = main.getVoiceLog()
      const last = log.length ? log[log.length - 1] : null
      want(!!last && last.text === "next hold" && last.cmd === "nextHold", `voice heard ${JSON.stringify(last)}`)
      want(main.getHintStep() === 1 && main.getAskDots() === "●○○", `rung ${main.getHintStep()} ${main.getAskDots()}`)
      const chip = main.getVoiceChip()
      want(!!chip && chip.heard === "“next hold”" && chip.label === PREVIEW_VOICE_LABEL, `chip ${JSON.stringify(chip)}`)
      inView(["VoiceChip"])
      break
    }
    case "s5-move":
      want(main.getHintStep() === 2 && main.isRingGlowing("up"), `rung ${main.getHintStep()}, glow on up ${main.isRingGlowing("up")}`)
      want(main.isLabelVisible() && main.getLabelText().indexOf("R hand") === 0, `label "${main.getLabelText()}" shown ${main.isLabelVisible()}`)
      inView(["SuggestLabel"])
      break
    case "s5-why":
      want(main.getHintStep() === 3 && main.getAskDots() === "●●●", `rung ${main.getHintStep()} ${main.getAskDots()}`)
      want(main.isLabelVisible() && main.getLabelText() === "R hand\njug, sets up LH\nto the pinch", `label "${main.getLabelText()}", want "R hand / jug, sets up LH / to the pinch"`)
      inView(["SuggestLabel"])
      break
    case "s6-moved":
      want(pos.RH === "up" && pos.LH === "h09" && main.getView() === "wall", `${fmtPos(pos)}, view ${main.getView()}`)
      break
    case "s6-came-off":
      ground()
      want(main.getCameOffText() === "Came off from here" && main.getCameOffHintText() === "Hint · move 3" && main.isAgainVisible() && main.isRowHidden(), `card "${main.getCameOffText()}" / "${main.getCameOffHintText()}", Again ${main.isAgainVisible()}, panel hidden ${main.isRowHidden()}`)
      { const p = main.getOutlinePulse(); want(!!p && p.hold === "h09", `"from here" pulses ${p ? p.hold : "nothing"}, want h09 (the hold last reached)`) }
      want(main.getAttempt() === 2, `go ${main.getAttempt()}, want 2 (the fall ended go 1)`)
      inView(["CameOffCard", "AgainButton"])
      break
    case "s7-hint": {
      const pin = main.getPinnedHint()
      want(main.getHintStep() === 1 && !!pin && pin.step === 1 && !main.isCameOffVisible() && main.isAgainVisible(), `rung ${main.getHintStep()}, pin ${JSON.stringify(pin)}, card ${main.isCameOffVisible()}, Again ${main.isAgainVisible()}`)
      want(main.getHintsThisGo() === 1, `hints this go ${main.getHintsThisGo()}, want 1`)
      break
    }
    case "s7-again":
      want(samePosition(pos, presetPosition()) && !main.isAgainVisible() && main.getMovesMade() === 0 && main.getAttempt() === 2, `${fmtPos(pos)}, Again ${main.isAgainVisible()}, moves ${main.getMovesMade()}, go ${main.getAttempt()}`)
      break
    case "s8-pin":
      want(pos.RH === "up" && pos.LH === "h09" && main.getHintStep() === 1, `${fmtPos(pos)}, rung ${main.getHintStep()} (the pin should show)`)
      break
    case "s8-lh":
      want(pos.LF === "lh" && main.getHintStep() === 0, `${fmtPos(pos)}, rung ${main.getHintStep()}`)
      break
    case "s8-topped":
      want(pos.LH === "h20" && main.isTopped() && main.getTagText("h20") === "TOPPED", `${fmtPos(pos)}, topped ${main.isTopped()}, tag "${main.getTagText("h20")}"`)
      inView(["Tag_h20"])
      break
    case "s8-card": {
      const lines = main.getResultLines()
      want(lines.join(" | ") === D2_CARD.join(" | "), `the card reads "${lines.join(" | ")}", want "${D2_CARD.join(" | ")}"`)
      want(main.isRowHidden() && main.isAgainVisible(), `panel hidden ${main.isRowHidden()}, Again ${main.isAgainVisible()}`)
      checkSideBySide("ResultCard", 2 * RESULT_HALF_W, "AgainButton", AGAIN_W, AGAIN_GAP, e, "s8-card")
      inView(["ResultCard", "AgainButton"])
      break
    }
    case "end":
      want(main.isResultVisible() && main.getResultLines().join(" | ") === D2_CARD.join(" | "), `the card at the end: ${main.isResultVisible()} "${main.getResultLines().join(" | ")}"`)
      break
    default:
      e.push("no check written for this key")
  }
  return e
}

@component
export class D2DemoV7Scenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const main = getMain()
    // a fresh open: the preset, beta hidden (the Lens's own default), 175 cm
    await restorePreset(main, false)
    const errs: string[] = []
    const pilot = mustFind("DemoAutopilot").getComponent(DemoAutopilot.getTypeName()) as DemoAutopilot
    if (!pilot) throw new Error("DemoAutopilot component not found")
    if (pilot.playOnStart) errs.push("Play On Start is ticked in the scene: it must be off")
    if (pilot.legacyV4Take) errs.push("the scene's autopilot is set to the legacy v4 take: the video's take is v7")

    const seen: {key: string; t: number; errs: string[]}[] = []
    const unsub = pilot.addCheckListener((key) => seen.push({key, t: pilot.getTimelineTime(), errs: checkKey(key, main, pilot)}))
    const rippleFrom = main.getRippleLog().length
    let cardFrom = -1
    let cardGaps = 0
    try {
      pilot.play(SPEED)
      if (!pilot.isPlaying() || pilot.getTake() !== V7_TAKE) throw new Error(`play() didn't start the v7 take (${pilot.getTake().name})`)
      const t0 = getTime()
      while (pilot.isPlaying() && getTime() - t0 < 60) {
        await frames(1)
        const tl = pilot.getTimelineTime()
        // the card, every frame once it is up: it stays to the end
        if (main.isResultVisible()) { if (cardFrom < 0) cardFrom = tl }
        else if (cardFrom >= 0 && tl <= V7_END) cardGaps++
      }
      if (pilot.isPlaying()) errs.push(`still playing after 60 s at x${SPEED}`)
    } finally {
      unsub()
      pilot.stop()
    }

    const keys = seen.map((s) => s.key)
    if (keys.join() !== V7_CHECKS.map((c) => c.key).join()) errs.push(`checks fired: ${keys.join(",")}; want ${V7_CHECKS.map((c) => c.key).join(",")}`)
    for (const s of seen) {
      print(`[d2] ${s.key} t=${s.t.toFixed(1)}: ${s.errs.length ? "FAIL " + s.errs.join("; ") : "ok"}`)
      for (const m of s.errs) errs.push(`${s.key}: ${m}`)
    }
    // the card held: up from cardFrom (timeline s) to the end, with no frame without it
    print(`[d2] the card up from t=${cardFrom.toFixed(1)} to ${V7_END} (${(V7_END - cardFrom).toFixed(1)} s of the take), the gate waited ${pilot.getCardWait().toFixed(1)} s real`)
    if (cardFrom < 0 || V7_END - cardFrom < 4) errs.push(`the card is up for ${(V7_END - cardFrom).toFixed(1)} s of the take, want at least 4`)
    if (cardGaps) errs.push(`the card went down for ${cardGaps} frames before the end`)

    const ripples = main.getRippleLog().slice(rippleFrom).map((r) => r.target)
    const wantRipples = V7_ACTIONS.map(rippleTarget).filter((x) => x !== null)
    print(`[d2] ripples ${ripples.join(",")}`)
    if (ripples.join() !== wantRipples.join()) errs.push(`ripples ${ripples.join(",")}; want ${wantRipples.join(",")}`)
    const log = pilot.getSceneLog()
    if (log.map((l) => l.n).join() !== V7_SCENES.map((s) => s.n).join()) errs.push(`scene log ${log.map((l) => l.n).join(",")}`)

    await restorePreset(main)
    expect(errs.length, "the v7 take:\n" + errs.join("\n")).toBe(0)
  }
}
