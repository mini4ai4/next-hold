// Session 27, v7.2 P1 item 12: voice, on the preview's injected path (the preview has no microphone; typed text
// stands in for speech, and the chip says so). Beta hidden; the real eye walks as in k2.
// - The preview picked the injected source by itself (isEditor), so injectVoice reaches the Lens's own handler.
// - Nothing acts on: a partial transcript, gym chatter (too long, or two commands at once), "why" before a hint
//   has named a move, "again" with no Again on screen, "show my beta" on the wall (the button isn't there).
// - "next hold" x2 climbs rungs 1 and 2 exactly as "?" would (dots, word), "why" then gives rung 3.
// - The chip: its words and the preview line, drawn in frame above the gaze, 70 cm out, clear of the panel; gone
//   after 1 s (by getTime, not wall-clock).
// - "show my beta" on the mats shows it; said again it doesn't hide it (only "show" is a command).
// - A fall: card and Again up, the panel hidden, so "next hold" and "show my beta" do nothing; "again" goes back
//   to the start holds and Again goes.

import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {boxesOverlap, camera, fmtBox, fmtPos, frames, getMain, mustFind, pinch, presetPosition, renderedOuterRadius, restorePreset, samePosition, screenBoxOf} from "./NextHoldTestKit"
import {RefPosition} from "./NextHoldReferenceRule"
import {NextHoldMain} from "../../Scripts/NextHoldMain"
import {PREVIEW_VOICE_LABEL, VOICE_PAUSED} from "../../Scripts/NextHoldVoice"
import {InjectedVoiceSource, VoiceSource} from "../../Scripts/NextHoldVoiceSource"
import {HOLDS, HOLD_SIZE} from "../../Scripts/Wall/WallLayout"

/** Session 28 (v7.3 P1-4): the chip as drawn, from the real eye: attached to `button` (its box beside the button's, not
 *  on it, within 0.04 of the frame; null: the button has gone with its press), whole in view, and over no ring of the
 *  problem, not the glow, not the move's label (measured on screen); the Lens's own rank for its place is 3 or 2 */
function checkChip(main: NextHoldMain, button: string | null, errs: string[], tag: string): void {
  const cam = camera()
  const cb = screenBoxOf("VoiceChip", cam)
  if (!cb) { errs.push(`${tag}: the chip doesn't render`); return }
  if (cb.x0 < 0 || cb.x1 > 1 || cb.y0 < 0 || cb.y1 > 1) errs.push(`${tag}: the chip isn't whole in view (${fmtBox(cb)})`)
  if (button) {
    if (main.getVoiceChipButton() !== button) errs.push(`${tag}: the chip is attached to "${main.getVoiceChipButton()}", want ${button}`)
    const bb = screenBoxOf(button, cam, true)
    if (bb) {
      const gap = Math.max(bb.x0 - cb.x1, cb.x0 - bb.x1, bb.y0 - cb.y1, cb.y0 - bb.y1)
      if (boxesOverlap(cb, bb)) errs.push(`${tag}: the chip (${fmtBox(cb)}) covers ${button} (${fmtBox(bb)})`)
      else if (gap > 0.04) errs.push(`${tag}: the chip (${fmtBox(cb)}) is ${gap.toFixed(3)} of the frame from ${button} (${fmtBox(bb)}), want beside it`)
    }
  }
  const wallRot = mustFind("ClimbingWall (stand-in)").getTransform().getWorldRotation()
  const over: string[] = []
  const circleOver = (c: vec3, r: number) => {
    const s = cam.worldSpaceToScreenSpace(c), e = cam.worldSpaceToScreenSpace(c.add(wallRot.multiplyVec3(new vec3(r, 0, 0))))
    const rx = Math.abs(e.x - s.x), ry = rx * cam.aspect
    return Math.hypot(Math.max(0, cb.x0 - s.x, s.x - cb.x1) / rx, Math.max(0, cb.y0 - s.y, s.y - cb.y1) / ry) < 1
  }
  for (const h of HOLDS) if (main.isInProblem(h.id) && circleOver(mustFind("Hold_" + h.id).getTransform().getWorldPosition(), HOLD_SIZE[h.type].ringR)) over.push(h.id)
  const glow = mustFind("SuggestGlow")
  if (glow.isEnabledInHierarchy && circleOver(glow.getTransform().getWorldPosition(), renderedOuterRadius("SuggestGlow"))) over.push("the glow")
  const lb = main.isLabelVisible() ? screenBoxOf("SuggestLabel", cam) : null
  if (lb && boxesOverlap(lb, cb)) over.push("the move's label")
  print(`[V1] ${tag}: chip ${fmtBox(cb)} on ${main.getVoiceChipButton()}, rank ${main.getVoiceChipRank()}${over.length ? ", over " + over.join(", ") : ", over nothing"}`)
  if (over.length) errs.push(`${tag}: the chip (${fmtBox(cb)}) is over ${over.join(", ")}`)
  if (main.getVoiceChipRank() < 2) errs.push(`${tag}: the Lens ranks the chip's place ${main.getVoiceChipRank()}`)
}

@component
export class V1VoiceScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const main = getMain()
    await restorePreset(main, false)
    const errs: string[] = []
    const camT = camera().getSceneObject().getTransform()
    const tracking = camT.getSceneObject().getComponent("Component.DeviceTracking") as DeviceTracking
    const trackingWas = tracking ? tracking.enabled : true
    const p0 = camT.getWorldPosition(), r0 = camT.getWorldRotation()
    const state = () => `step ${main.getHintStep()}, dots ${main.getAskDots()}, beta ${main.isBetaShown()}, Again ${main.isAgainVisible()}, ${fmtPos(main.getPosition() as RefPosition)}`
    /** says `text`; returns whether it changed anything a check can see, and the command the Lens logged */
    const say = async (text: string, isFinal = true) => {
      const before = state()
      const n = main.getVoiceLog().length
      if (!main.injectVoice(text, isFinal)) errs.push(`injectVoice("${text}") refused: source ${main.getVoiceKind()}`)
      await frames(2)
      const log = main.getVoiceLog()
      const cmd = log.length > n ? log[log.length - 1].cmd : "(not heard)"
      print(`[V1] "${text}"${isFinal ? "" : " (partial)"} -> ${cmd}; ${state()}`)
      return {changed: state() !== before, cmd}
    }
    const noOp = async (text: string, why: string, isFinal = true) => {
      // let an earlier command's chip run out first, so a chip after this can only be this one's
      const until = getTime() + 2
      while (main.getVoiceChip() && getTime() < until) await frames(1)
      const r = await say(text, isFinal)
      if (r.cmd !== null || r.changed) errs.push(`"${text}" (${why}) acted: command ${r.cmd}, state changed ${r.changed}`)
      // the chip only echoes what was acted on
      if (main.getVoiceChip()) errs.push(`"${text}" (${why}) got a chip: ${JSON.stringify(main.getVoiceChip())}`)
    }
    try {
      if (tracking) tracking.enabled = false
      const face = mustFind("Hold_lh").getTransform().getWorldPosition()
      const at = async (cm: number) => { camT.setWorldPosition(new vec3(p0.x, p0.y, face.z + cm)); await frames(3) }
      await at(250)
      await frames(3)
      if (main.getVoiceKind() !== "injected") errs.push(`the preview's voice source is "${main.getVoiceKind()}", want "injected"`)
      if (main.getView() !== "ground" || main.isRowHidden()) errs.push(`at 2.5 m: view ${main.getView()}, row hidden ${main.isRowHidden()}`)

      // ── nothing acts on chatter or what isn't on offer ──
      await noOp("next hold", "a partial transcript", false)
      await noOp("why'd you go left there mate", "gym chatter, six words")
      await noOp("next hold why", "two commands at once")
      await noOp("why", "no hint has named a move yet")
      await noOp("again", "no Again on screen")
      // session 28 (v7.3 P1-5): a negation with a typographic apostrophe, and "why’d" with one, are chatter
      await noOp("don’t show my beta", "a negation, curly apostrophe")
      await noOp("that's not the next hold", "a negation")

      // ── session 28: recognition stops on an error: "voice paused" and why, beside "?", for 2 s; then typing again ──
      {
        let fail: ((why: string) => void) | null = null
        const failing: VoiceSource = {kind: "asr", start: (_t, e) => { fail = e }, stop: () => {}}
        main.useVoice(failing)
        if (fail) (fail as (why: string) => void)("no network")
        await frames(2)
        const pc = main.getVoiceChip()
        print(`[V1] recognition error: chip ${JSON.stringify(pc)} on ${main.getVoiceChipButton()}, error "${main.getVoiceError()}"`)
        if (!pc || pc.heard !== VOICE_PAUSED || pc.label !== "no network" || main.getVoiceChipButton() !== "AskButton") errs.push(`a recognition error: chip ${JSON.stringify(pc)} on "${main.getVoiceChipButton()}", want "${VOICE_PAUSED}" / "no network" by "?"`)
        else checkChip(main, "AskButton", errs, "voice paused")
        main.useVoice(new InjectedVoiceSource())
        const until = getTime() + 3
        while (main.getVoiceChip() && getTime() < until) await frames(1)
        if (main.getVoiceChip()) errs.push("the \"voice paused\" chip stayed past 2 s")
      }

      // ── "next hold": rung 1, as "?" ──
      const t0 = getTime()
      const r1 = await say("Next hold.")
      if (r1.cmd !== "nextHold" || main.getHintStep() !== 1 || main.getAskDots() !== "●○○" || main.getAskWord() !== "Move") errs.push(`"Next hold." -> ${r1.cmd}: ${state()}, word ${main.getAskWord()}, want rung 1 (●○○, Move)`)
      // the chip, as drawn: its words, the preview line; session 28 (v7.3 P1-4): beside the "?" it pressed, whole in view,
      // over no ring of the problem, not the glow, not the move's label
      const chip = main.getVoiceChip()
      const heard = (mustFind("VoiceChipHeard").getComponent("Component.Text") as Text).text
      const line = (mustFind("VoiceChipLabel").getComponent("Component.Text") as Text).text
      print(`[V1] chip: ${JSON.stringify(chip)}; drawn "${heard}" / "${line}", enabled ${mustFind("VoiceChip").isEnabledInHierarchy}`)
      if (!chip || heard !== "“next hold”" || line !== PREVIEW_VOICE_LABEL || !mustFind("VoiceChip").isEnabledInHierarchy) errs.push(`the chip after "next hold": ${JSON.stringify(chip)}, drawn "${heard}" / "${line}"`)
      checkChip(main, "AskButton", errs, "after \"next hold\"")
      // shown for 1 s of Lens time, then gone
      while (getTime() < t0 + 0.6) await frames(1)
      if (!main.getVoiceChip()) errs.push(`the chip went before 0.6 s`)
      while (getTime() < t0 + 1.3) await frames(1)
      if (main.getVoiceChip() || mustFind("VoiceChip").isEnabledInHierarchy) errs.push(`the chip is still up after 1.3 s`)

      // ── rung 2, then "why" (now on offer) gives rung 3 ──
      const r2 = await say("next hold please")
      const sug = main.getSuggestion()
      if (r2.cmd !== "nextHold" || main.getHintStep() !== 2 || main.getAskDots() !== "●●○" || !sug || !main.isRingGlowing(sug.holdId)) errs.push(`"next hold please" -> ${r2.cmd}: ${state()}, glow ${sug ? sug.holdId : "none"}`)
      const r3 = await say("Why?")
      if (r3.cmd !== "why" || main.getHintStep() !== 3 || main.getAskDots() !== "●●●") errs.push(`"Why?" -> ${r3.cmd}: ${state()}, want rung 3`)
      const chip3 = main.getVoiceChip()
      if (!chip3 || chip3.heard !== "“why”") errs.push(`the chip after "why": ${JSON.stringify(chip3)}`)
      checkChip(main, "AskButton", errs, "after \"why\"")
      // session 28 (P1-4): at rung 3 "next hold" is heard and presses "?", but changes nothing: no chip
      {
        const until = getTime() + 2
        while (main.getVoiceChip() && getTime() < until) await frames(1)
        const r4 = await say("next hold")
        print(`[V1] "next hold" at rung 3 -> ${r4.cmd}, changed ${r4.changed}, chip ${JSON.stringify(main.getVoiceChip())}`)
        if (r4.cmd !== "nextHold" || r4.changed || main.getVoiceChip()) errs.push(`"next hold" at rung 3: command ${r4.cmd}, state changed ${r4.changed}, chip ${JSON.stringify(main.getVoiceChip())}; want heard, nothing changed, no chip`)
      }

      // ── "show my beta": shows it on the mats; said again it doesn't hide it ──
      const b1 = await say("show my beta")
      if (b1.cmd !== "showBeta" || !main.isBetaShown() || main.getShowBetaLabel() === "Show my beta") errs.push(`"show my beta" -> ${b1.cmd}: beta ${main.isBetaShown()}, button "${main.getShowBetaLabel()}"`)
      await noOp("show my beta", "the beta is already shown")
      if (!main.isBetaShown()) errs.push("\"show my beta\" said twice hid the beta")

      // ── the wall: "show my beta" isn't on screen there ──
      await restorePreset(main, false)
      await at(60)
      if (main.getView() !== "wall") errs.push(`at 60 cm the view is ${main.getView()}`)
      await noOp("show my beta", "not on the wall's strip")

      // ── a fall: the card takes the panel's place; only "again" is on offer ──
      const start = presetPosition()
      await pinch("Hold_up"); await frames(2)
      await pinch("Hold_h09"); await frames(2)
      await at(250)
      if (!main.isCameOffVisible() || !main.isAgainVisible() || !main.isRowHidden()) errs.push(`the fall: card ${main.isCameOffVisible()}, Again ${main.isAgainVisible()}, panel hidden ${main.isRowHidden()}`)
      await noOp("next hold", "the panel is hidden while the card is up")
      await noOp("show my beta", "the panel is hidden while the card is up")
      const ag = await say("again")
      const pos = main.getPosition() as RefPosition
      if (ag.cmd !== "again" || !samePosition(pos, start) || main.isAgainVisible() || main.isCameOffVisible() || main.getMovesMade() !== 0) errs.push(`"again" -> ${ag.cmd}: ${fmtPos(pos)} (want ${fmtPos(start)}), Again ${main.isAgainVisible()}, card ${main.isCameOffVisible()}, moves ${main.getMovesMade()}`)
      const chipA = main.getVoiceChip()
      if (!chipA || chipA.heard !== "“again”" || chipA.label !== PREVIEW_VOICE_LABEL) errs.push(`the chip after "again": ${JSON.stringify(chipA)}`)
      // beside where Again was (it goes with its press), over nothing of the problem
      if (main.getVoiceChipButton() !== "AgainButton") errs.push(`the chip after "again" is attached to "${main.getVoiceChipButton()}"`)
      checkChip(main, null, errs, "after \"again\"")
      if (main.getVoiceError()) errs.push(`voice error: ${main.getVoiceError()}`)
    } finally {
      camT.setWorldPosition(p0); camT.setWorldRotation(r0)
      if (tracking) tracking.enabled = trackingWas
      await frames(4)
    }

    await restorePreset(main)
    expect(errs.length, "voice, injected path:\n" + errs.join("\n")).toBe(0)
  }
}
