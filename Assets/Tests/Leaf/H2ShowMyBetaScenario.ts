// Session 23, "Show my beta" (v7 A1): a real pinch on the button sets betaShown, and the full v6 read
// appears in that pinch's own frame: every free ring in the rule's colour, the glow with its word, the
// 1-2-3 by the test's own search, the best limb lit, the outlines and START gone. On the wall: one ring
// and its word. It resets on a new problem, and on the new attempt after topping out.
// Session 24 (G and the judges' fix 4): it is a toggle, "Show my beta" / "Hide beta"; hiding it again takes the
// read down but the go stays "with beta". It shows on the mats only (Ground), in the climb page's top-left cell:
// at least 10 x 10 cm, 3 cm or more from its neighbours, and it doesn't change the row's size.

import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {NextHoldMain} from "../../Scripts/NextHoldMain"
import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import {HOLDS, PRESET_START, PRESET_TOP} from "../../Scripts/Wall/WallLayout"
import {checkTagRingsAgree, checkNothingRevealed, fmtPos, frames, getMain, makeReference, mustFind, pinch, pinchCapture, renderedRingColour, restorePreset, tagOn} from "./NextHoldTestKit"
import {REF_LIMBS, RefLimb, RefPosition} from "./NextHoldReferenceRule"

/** the full read, as drawn, against the test's own rule */
function checkFull(main: NextHoldMain, errs: string[], tag: string): void {
  const pos = main.getPosition() as RefPosition
  const ref = makeReference(main.getHeightCm())
  const occupied = (id: string) => REF_LIMBS.some((l) => pos[l] === id)
  for (const h of HOLDS) {
    if (mustFind("Outline_" + h.id).enabled) errs.push(`${tag}: Outline_${h.id} still shows`)
    // session 24: a hold under a step tag wears the neutral outline (renderedRingColour checks it), no ring
    const free = main.isInProblem(h.id) && !occupied(h.id) && tagOn(h.id, main) === null
    if (mustFind("Ring_" + h.id).enabled !== free) errs.push(`${tag}: Ring_${h.id} shown ${mustFind("Ring_" + h.id).enabled}, a free untagged hold of the problem ${free}`)
    if (PRESET_START.indexOf(h.id) >= 0 && main.getTagText(h.id) === "START") errs.push(`${tag}: START still shows on ${h.id}`)
  }
  for (const r of ref.perHold(pos)) {
    if (renderedRingColour(r.holdId, main) !== r.colour) errs.push(`${tag}: Ring_${r.holdId} renders ${renderedRingColour(r.holdId, main)}, rule ${r.colour}`)
  }
  const best = ref.glow(pos)!
  if (!main.isRingGlowing(best.holdId) || !mustFind("SuggestGlow").enabled) errs.push(`${tag}: the glow isn't on ${best.holdId}`)
  if (!main.isLabelVisible()) errs.push(`${tag}: no label`)
  if (main.getLitLimb() !== best.limb) errs.push(`${tag}: lit ${main.getLitLimb()}, the best limb is ${best.limb}`)
  const want = main.getLimbOverride() ? ref.sequence(pos, main.getSelectedLimb() as RefLimb) : ref.plan(pos).steps
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

    // ── the button: its cell, its size, its gaps (session 24, G) ──
    const grid = mustFind("ButtonGrid").getTransform().getInvertedWorldTransform()
    const at = (n: string) => grid.multiplyPoint(mustFind(n).getTransform().getWorldPosition())
    const sz = (n: string) => (mustFind(n).getComponent(Button.getTypeName()) as Button).size
    const button = sz("ShowBetaButton")
    const b = at("ShowBetaButton"), ask = at("AskButton"), body = at("BodyButton")
    const gapX = Math.abs(ask.x - b.x) - button.x / 2 - sz("AskButton").x / 2
    const gapY = Math.abs(b.y - body.y) - button.y / 2 - sz("BodyButton").y / 2
    const size0 = main.controlRow.getSize()
    print(`[H2] button ${button.x} x ${button.y} cm at ${b.x.toFixed(1)},${b.y.toFixed(1)}; gaps ${gapX.toFixed(2)} to "?", ${gapY.toFixed(2)} to Body; panel ${size0 ? size0.x.toFixed(1) + " x " + size0.y.toFixed(1) : "?"} cm`)
    if (button.x < 10 || button.y < 10) errs.push(`the button is ${button.x} x ${button.y} cm, want 10 or more each way`)
    if (gapX < 3 - 1e-3 || gapY < 3 - 1e-3) errs.push(`gaps ${gapX.toFixed(2)} / ${gapY.toFixed(2)} cm, want 3 or more`)
    if (!(b.x < ask.x && b.y > body.y)) errs.push("the button is not in the top-left cell")
    if (!mustFind("ShowBetaButton").isEnabledInHierarchy) errs.push("the button doesn't show on the mats")
    // on the wall it is gone: a reveal there would be made while hanging
    await pinch("ViewToggle"); await frames(3)
    if (main.getView() !== "wall" || mustFind("ShowBetaButton").isEnabledInHierarchy) errs.push(`on the wall (view ${main.getView()}) the button still shows`)
    await pinch("ViewToggle"); await frames(3)
    if (main.getView() !== "ground" || !mustFind("ShowBetaButton").isEnabledInHierarchy) errs.push(`back on the mats (view ${main.getView()}) the button doesn't show`)

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
    if (main.getShowBetaLabel() !== "Hide\nbeta" || !main.isShowBetaLit()) errs.push(`after the pinch the button reads "${main.getShowBetaLabel()}", lit ${main.isShowBetaLit()}`)
    if (!main.getRippleLog().slice(ripples0).some((r) => r.target === "ShowBetaButton")) errs.push("no ripple on the button")
    if (!main.isBetaSeenThisGo()) errs.push("the go isn't marked with beta")
    const size1 = main.controlRow.getSize()
    if (size0 && size1 && (Math.abs(size0.x - size1.x) > 0.01 || Math.abs(size0.y - size1.y) > 0.01)) errs.push(`the row changed size: ${size0} -> ${size1}`)

    // session 24: a second pinch hides it again ("Hide beta"), in its own frame; the go stays "with beta"
    const hid: string[] = []
    const hide = await pinchCapture("ShowBetaButton", () => { checkNothingRevealed(main, hid, "hide, pinch frame"); return main.isBetaShown() })
    errs.push(...hid)
    await frames(3)
    print(`[H2] "Hide beta": betaShown ${hide.value}, ${hid.length} leaks in the pinch frame, button "${main.getShowBetaLabel()}" lit ${main.isShowBetaLit()}, go with beta ${main.isBetaSeenThisGo()}`)
    if (hide.value !== false || main.isShowBetaLit() || main.getShowBetaLabel() !== "Show my\nbeta") errs.push(`hide: betaShown ${hide.value}, lit ${main.isShowBetaLit()}, "${main.getShowBetaLabel()}"`)
    if (!main.isBetaSeenThisGo()) errs.push("hiding the beta cleared \"with beta\" for the go")
    checkNothingRevealed(main, errs, "hidden again")
    // and a third shows it again
    await pinch("ShowBetaButton"); await frames(3)
    if (!main.isBetaShown() || !main.isShowBetaLit()) errs.push(`a third pinch: betaShown ${main.isBetaShown()}, lit ${main.isShowBetaLit()}`)
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
