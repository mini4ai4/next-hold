// Review item 4, why-line wording: the hold type is written in capitals as
// "<TYPE> HOLD", e.g. "PINCH HOLD · LONG REACH", so the word "pinch" can't be
// read as a gesture instruction.
// Input path: real SIK pinches on AskButton then Hold_<id>, for a pinch at a
// stretch (h09 from the preset, for RH), a jug in comfortable reach (up) and
// the out-of-reach top (h20). Expected text from the test's own reference.

import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {frames, getMain, makeReference, mustFind, pinch, restorePreset} from "./NextHoldTestKit"
import {RefPosition} from "./NextHoldReferenceRule"

/** "HIGH STEP" since session 14: a foot target above the hip */
const WHY_FORM = /^[A-Z]+ HOLD( · (LONG REACH|OUT OF REACH|HIGH STEP|COMMITTING BALANCE))*$/

function shownWhy(): string {
  const t = mustFind("WhyText").getComponent("Component.Text") as Text
  return t ? t.text : ""
}

@component
export class N4WhyWordingScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const main = getMain()
    await restorePreset(main)
    const ref = makeReference()
    const errs: string[] = []
    const pos = main.getPosition() as RefPosition
    const limb = main.getSelectedLimb()
    if (limb !== "RH") errs.push(`precondition: preset selects ${limb}, want RH`)

    const cases: {hold: string; want: string}[] = [
      {hold: "h09", want: "PINCH HOLD · LONG REACH"},
      {hold: "up", want: "JUG HOLD"},
      {hold: "h20", want: "JUG HOLD · OUT OF REACH"},
    ]
    for (const c of cases) {
      const r = ref.score(limb as any, c.hold, pos)
      if (r.why !== c.want) errs.push(`precondition: reference why for ${c.hold} is "${r.why}", want "${c.want}"`)
      await pinch("AskButton")
      await frames(3)
      await pinch("Hold_" + c.hold)
      await frames(3)
      const shown = shownWhy()
      print(`[N4] ? then ${c.hold}: why line "${shown}"`)
      if (!mustFind("WhyLine").enabled) errs.push(`${c.hold}: why line not shown`)
      if (shown !== c.want) errs.push(`${c.hold}: why line "${shown}", want "${c.want}"`)
      if (!WHY_FORM.test(shown)) errs.push(`${c.hold}: "${shown}" is not "<TYPE> HOLD · ..." in capitals`)
      if (/[a-z]/.test(shown)) errs.push(`${c.hold}: "${shown}" has lowercase letters`)
    }

    // every hold of the problem: its why is in the new form
    for (const id of main.getHoldIds()) {
      const w = main.getHoldWhy(id)
      if (w !== null && !WHY_FORM.test(w)) errs.push(`getHoldWhy(${id}) = "${w}" is not in the "<TYPE> HOLD · ..." form`)
    }

    await restorePreset(main)
    expect(errs.length, "why-wording mismatches:\n" + errs.join("\n")).toBe(0)
  }
}
