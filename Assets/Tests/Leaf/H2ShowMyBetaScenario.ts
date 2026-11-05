// Session 23, "Show my beta" (v7 A1): a real pinch on the button sets betaShown, and the full v6 read
// appears in that pinch's own frame: every free ring in the rule's colour, the glow with its word, the
// 1-2-3 by the test's own search, the best limb lit, the outlines and START gone. On the wall: one ring
// and its word. The button is at least 8 cm wide, 2 cm or more from its neighbour, and in the row's free
// slot: the row doesn't grow. It resets on a new problem, and on the new attempt after topping out.

import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {NextHoldMain} from "../../Scripts/NextHoldMain"
import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import {HOLDS, PRESET_START, PRESET_TOP} from "../../Scripts/Wall/WallLayout"
import {checkTagRingsAgree, checkNothingRevealed, fmtPos, frames, getMain, makeReference, mustFind, pinch, pinchCapture, renderedRingColour, restorePreset} from "./NextHoldTestKit"
import {REF_LIMBS, RefLimb, RefPosition} from "./NextHoldReferenceRule"

/** the full read, as drawn, against the test's own rule */
function checkFull(main: NextHoldMain, errs: string[], tag: string): void {
  const pos = main.getPosition() as RefPosition
  const ref = makeReference(main.getHeightCm())
  const occupied = (id: string) => REF_LIMBS.some((l) => pos[l] === id)
  for (const h of HOLDS) {
    if (mustFind("Outline_" + h.id).enabled) errs.push(`${tag}: Outline_${h.id} still shows`)
    const free = main.isInProblem(h.id) && !occupied(h.id)
    if (mustFind("Ring_" + h.id).enabled !== free) errs.push(`${tag}: Ring_${h.id} shown ${mustFind("Ring_" + h.id).enabled}, a free hold of the problem ${free}`)
    if (PRESET_START.indexOf(h.id) >= 0 && main.getTagText(h.id) === "START") errs.push(`${tag}: START still shows on ${h.id}`)
  }
  for (const r of ref.perHold(pos)) {
    if (renderedRingColour(r.holdId, main) !== r.colour) errs.push(`${tag}: Ring_${r.holdId} renders ${renderedRingColour(r.holdId, main)}, rule ${r.colour}`)
  }
  const best = ref.bestMove(pos)!
  if (!main.isRingGlowing(best.holdId) || !mustFind("SuggestGlow").enabled) errs.push(`${tag}: the glow isn't on ${best.holdId}`)
  if (!main.isLabelVisible()) errs.push(`${tag}: no label`)
  if (main.getLitLimb() !== best.limb) errs.push(`${tag}: lit ${main.getLitLimb()}, the best limb is ${best.limb}`)
  const want = ref.sequence(pos, main.getSelectedLimb() as RefLimb)
  const got = main.getPreview()
  if (got.map((m) => m.limb + m.holdId).join() !== want.map((m) => m.limb + m.holdId).join()) errs.push(`${tag}: 1-2-3 ${got.map((m) => m.limb + "->" + m.holdId).join(" ")}, the search says ${want.map((m) => m.limb + "->" + m.holdId).join(" ")}`)
  for (let n = 2; n <= want.length; n++) if (main.getGhostHold(n) !== want[n - 1].holdId) errs.push(`${tag}: badge ${n} on ${main.getGhostHold(n)}, want ${want[n - 1].holdId}`)
  checkTagRingsAgree(main, errs, tag)
}

@component
export class H2ShowMyBetaScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const main = getMain()
    await restorePreset(main, false)
    const errs: string[] = []

    // ── the button: its place in the row, its size, its gap ──
    const row = mustFind("ViewRow").getTransform().getInvertedWorldTransform()
    const button = mustFind("ShowBetaButton").getComponent(Button.getTypeName()) as Button
    const view = mustFind("ViewToggle").getComponent(Button.getTypeName()) as Button
    const xB = row.multiplyPoint(mustFind("ShowBetaButton").getTransform().getWorldPosition()).x
    const xV = row.multiplyPoint(mustFind("ViewToggle").getTransform().getWorldPosition()).x
    const gap = Math.abs(xB - xV) - button.size.x / 2 - view.size.x / 2
    const size = main.controlRow.getSize()
    print(`[H2] button ${button.size.x} x ${button.size.y} cm, gap to the view switch ${gap.toFixed(2)} cm; panel ${size ? size.x.toFixed(1) + " x " + size.y.toFixed(1) : "?"} cm`)
    if (button.size.x < 8 || button.size.y < 5) errs.push(`the button is ${button.size.x} x ${button.size.y} cm`)
    if (gap < 2 - 1e-3) errs.push(`the gap to the view switch is ${gap.toFixed(2)} cm, want 2 or more`)
    // the free slot: the row's width is three buttons and two gaps, as before
    if (size && Math.abs(size.x - (3 * 8 + 2 * 2 + 2.8)) > 0.1) errs.push(`the panel is ${size.x.toFixed(2)} cm wide: the button should use the free slot`)

    // ── the pinch: the full read in its own frame ──
    const ripples0 = main.getRippleLog().length
    const frameErrs: string[] = []
    const got = await pinchCapture("ShowBetaButton", () => {
      checkFull(main, frameErrs, "pinch frame")
      return main.isBetaShown()
    })
    if (!got.fired || got.value !== true) errs.push(`ShowBetaButton: fired ${got.fired}, betaShown ${got.value}`)
    errs.push(...frameErrs)
    print(`[H2] in the pinch frame: betaShown ${got.value}, ${frameErrs.length} problems, position ${fmtPos(main.getPosition() as RefPosition)}`)
    await frames(3)
    checkFull(main, errs, "after the pinch")
    if (main.getShowBetaLabel() !== "Beta\nshown" || !main.isShowBetaLit()) errs.push(`after the pinch the button reads "${main.getShowBetaLabel()}", lit ${main.isShowBetaLit()}`)
    if (!main.getRippleLog().slice(ripples0).some((r) => r.target === "ShowBetaButton")) errs.push("no ripple on the button")

    // once shown, a second pinch changes nothing, and the button stays lit (UI Kit's toggle flips itself)
    await pinch("ShowBetaButton"); await frames(3)
    if (!main.isBetaShown() || !main.isShowBetaLit()) errs.push(`a second pinch: betaShown ${main.isBetaShown()}, lit ${main.isShowBetaLit()}`)
    // "?" arms as in v6, with no ladder
    await pinch("AskButton"); await frames(2)
    if (!main.isAskArmed() || main.getHintStep() !== 0) errs.push(`"?" with beta shown: armed ${main.isAskArmed()}, hint step ${main.getHintStep()}`)
    await pinch("AskButton"); await frames(2)

    // ── a move and on: the read stays ──
    await pinch("Hold_up"); await frames(2)
    if (!main.isBetaShown()) errs.push("a move hid the beta again")
    checkFull(main, errs, "after a move")

    // ── a new problem hides it: a real trip through setup that changes the problem ──
    await restorePreset(main, false)
    await pinch("ShowBetaButton"); await frames(2)
    if (!main.isBetaShown()) errs.push("setup: beta not shown")
    await pinch("ModeSwitch"); await frames(2)
    await pinch("Hold_h12"); await frames(2)
    await pinch("DoneButton"); await frames(2)
    // and the button does nothing in setup: there is no read to show
    await pinch("ModeSwitch"); await frames(2)
    print(`[H2] a hold added in setup: problem ${main.getProblemHolds().length} holds, betaShown ${main.isBetaShown()}`)
    if (main.isBetaShown()) errs.push("a changed problem kept the beta shown")
    checkNothingRevealed(main, errs, "the new problem")

    // ── a trip through setup that leaves the same problem doesn't ──
    await restorePreset(main, false)
    await pinch("ShowBetaButton"); await frames(2)
    await pinch("ModeSwitch"); await frames(2)
    await pinch("Hold_h12"); await frames(2)
    await pinch("RemoveButton"); await frames(2)
    await pinch("ModeSwitch"); await frames(2)
    if (!main.isBetaShown()) errs.push("setup changed nothing, yet the beta was hidden")

    // ── a new attempt hides it: topped out, then a hand off the top ──
    await restorePreset(main, false)
    await pinch("ShowBetaButton"); await frames(2)
    main.forceMove("RH", "up")
    main.forceMove("LH", "h09")
    main.forceMove("LF", "lh")
    main.forceMove("RF", "rh")
    await pinch("Hold_" + PRESET_TOP); await frames(2)
    if (!main.isTopped() || !main.isBetaShown()) errs.push(`topped ${main.isTopped()}, betaShown ${main.isBetaShown()}: topping out keeps the read`)
    main.forceMove("LH", "h09"); await frames(2)
    print(`[H2] a hand off the top: betaShown ${main.isBetaShown()}, attempt ${main.getAttempt()}`)
    if (main.isBetaShown()) errs.push("the new attempt kept the beta shown")
    if (main.getMovesMade() !== 0) errs.push(`the new attempt starts with ${main.getMovesMade()} moves`)

    await restorePreset(main)
    expect(errs.length, "show my beta:\n" + errs.join("\n")).toBe(0)
  }
}
