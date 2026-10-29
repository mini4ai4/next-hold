// Done criterion 5: pinching '?' lights it; the next pinch on a ring shows
// that hold's "why" line without moving any limb; it's one-shot.
// Input path: real SIK pinches on AskButton and Hold_<id>. The expected why
// string comes from the test's own port of scoring.js.
// Session 18: on a hold under a step tag the ring wears the step's colour, so "?" explains that
// step's score; the line covers no ring and its nearest ring on screen is the asked hold's.

import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {
  camera, checkWhyAgrees, expectedWhy, fmtPos, frames, getMain, makeReference, mustFind, pinch, restorePreset, samePosition,
} from "./NextHoldTestKit"
import {REF_LIMBS, RefPosition} from "./NextHoldReferenceRule"

function whyText(): string {
  const t = mustFind("WhyText").getComponent("Component.Text") as Text
  return t ? t.text : ""
}

@component
export class C5AskWhyScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const main = getMain()
    await restorePreset(main)
    const ref = makeReference()
    const errs: string[] = []
    const pos0 = main.getPosition() as RefPosition
    const sel0 = main.getSelectedLimb()

    if (main.isWhyVisible() || mustFind("WhyLine").enabled) errs.push("why line visible before asking")
    if (main.isAskArmed() || main.isAskLit()) errs.push("'?' already armed/lit at start")

    // ── pinch '?': armed and lit ──
    await pinch("AskButton")
    await frames(3)
    if (!main.isAskArmed()) errs.push("'?' not armed after pinch")
    if (!main.isAskLit()) errs.push("'?' not lit after pinch")

    // guard: a pinch on an occupied hold (no ring) does not consume the ask or move anything
    const occ = pos0.LH as string
    await pinch("Hold_" + occ)
    await frames(2)
    if (!main.isAskArmed()) errs.push(`pinch on occupied ${occ} (no ring) disarmed '?'`)
    if (main.isWhyVisible()) errs.push(`pinch on occupied ${occ} showed a why line`)
    if (!samePosition(main.getPosition() as RefPosition, pos0)) errs.push(`pinch on occupied ${occ} while armed moved a limb: ${fmtPos(main.getPosition() as RefPosition)}`)

    // pick a ringed hold whose reference why says "LONG REACH" (the brief's example, in the
    // review's wording: was "a long reach"), else any ringed hold
    const ev = ref.evaluate(sel0 as any, pos0)
    const target = ev.results.filter((r) => r.why.indexOf("LONG REACH") >= 0)[0] || ev.results[0]
    if (!mustFind("Ring_" + target.holdId).enabled) errs.push(`setup: ${target.holdId} has no ring`)
    const markers0: {[l: string]: string | null} = {}
    for (const l of REF_LIMBS) markers0[l] = main.getMarkerHold(l as any)

    // ── pinch the ringed hold ──
    // session 18: "?" explains the score the ring shows: the selected limb's, or the step's under a step tag
    const want = expectedWhy(main, target.holdId)
    const wantWhy = want ? want.why : target.why
    await pinch("Hold_" + target.holdId)
    await frames(3)
    const pos1 = main.getPosition() as RefPosition
    print(`[C5] asked ${target.holdId} for ${sel0}: Lens why "${whyText()}", reference "${wantWhy}" (${want ? want.from : "selected"}); position ${fmtPos(pos1)}`)
    if (!main.isWhyVisible() || !mustFind("WhyLine").enabled) errs.push("why line not shown")
    if (whyText() !== wantWhy) errs.push(`why text "${whyText()}" != reference "${wantWhy}"`)
    if (main.getWhyText() !== wantWhy) errs.push(`getWhyText "${main.getWhyText()}"`)
    print(`[C5] ${checkWhyAgrees(camera(), main, errs, "asked " + target.holdId)}`)
    if (main.getWhyHoldId() !== target.holdId) errs.push(`why is for ${main.getWhyHoldId()}, want ${target.holdId}`)
    if (!samePosition(pos1, pos0)) errs.push(`a limb moved: ${fmtPos(pos1)} (was ${fmtPos(pos0)})`)
    for (const l of REF_LIMBS) if (main.getMarkerHold(l as any) !== markers0[l]) errs.push(`Marker_${l} moved to ${main.getMarkerHold(l as any)}`)
    if (main.getSelectedLimb() !== sel0) errs.push(`selected limb changed to ${main.getSelectedLimb()}`)
    // one-shot
    if (main.isAskArmed()) errs.push("'?' still armed after the why was shown")
    if (main.isAskLit()) errs.push("'?' still lit after the why was shown")

    // the next pinch on a hold is a normal move again
    await pinch("Hold_" + target.holdId)
    await frames(3)
    const pos2 = main.getPosition() as RefPosition
    if (pos2[sel0] !== target.holdId) errs.push(`next pinch after the why did not move ${sel0} to ${target.holdId} (${fmtPos(pos2)})`)
    if (main.isWhyVisible()) errs.push("why line still shown after a move")

    // session 18: a hold under a step tag. At the preset "2 · LH" sits on h09 while RH is selected:
    // its ring wears LH's colour at that step, so "?" on it explains LH's move there, not RH's
    await restorePreset(main)
    await frames(3)
    const tagged = [2, 3].map((n) => main.getGhostHold(n)).filter((id) => id && main.isRingVisible(id) && !main.isRingGlowing(id))[0]
    if (!tagged) errs.push("setup: no tagged hold with its own ring at the preset")
    else {
      const wantT = expectedWhy(main, tagged)
      await pinch("AskButton")
      await frames(2)
      await pinch("Hold_" + tagged)
      await frames(3)
      print(`[C5] tagged ${tagged} (${wantT ? wantT.from : "-"}): ${checkWhyAgrees(camera(), main, errs, "tagged " + tagged)}`)
      if (!wantT || wantT.from.indexOf("step") !== 0) errs.push(`tagged ${tagged}: the reference does not see it as a step's hold (${wantT ? wantT.from : "none"})`)
    }
    await restorePreset(main)

    expect(errs.length, "criterion 5 mismatches:\n" + errs.join("\n")).toBe(0)
  }
}
