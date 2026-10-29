// Review item 4, why-line wording: the hold type is written in capitals as
// "<TYPE> HOLD", e.g. "PINCH HOLD · LONG REACH", so the word "pinch" can't be
// read as a gesture instruction.
// Input path: real SIK pinches on AskButton then Hold_<id>, for the tagged pinch
// h09 (its "2 · LH" step, session 18), a jug in comfortable reach (up), the
// out-of-reach top (h20) and an untagged hold at a long reach for RH. Expected
// text from the test's own reference.

import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {expectedWhy, frames, getMain, makeReference, mustFind, pinch, restorePreset, taggedHolds} from "./NextHoldTestKit"
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

    // session 18: "?" explains the score the ring shows. h09 carries "2 · LH" at the preset, so it
    // wears LH's colour and explains LH's move there ("PINCH HOLD"), no longer RH's long reach. The
    // LONG REACH wording is checked last, on a hold with no tag, for another limb (at the preset
    // every long reach for RH is under a tag)
    const h09 = expectedWhy(main, "h09")
    const cases: {hold: string; want: string; limb?: string}[] = [
      {hold: "h09", want: h09 ? h09.why : "?"},
      {hold: "up", want: "JUG HOLD"},
      {hold: "h20", want: "JUG HOLD · OUT OF REACH"},
      {hold: "", want: "", limb: "LONG REACH"},
    ]
    if (!h09 || h09.from.indexOf("step 2") !== 0 || h09.why !== "PINCH HOLD") errs.push(`precondition: h09's ring shows ${h09 ? h09.from + ' "' + h09.why + '"' : "nothing"}, want step 2 "PINCH HOLD"`)
    for (const c of cases) {
      if (c.limb) {
        // select each other limb with a real pinch until one has an untagged LONG REACH hold
        for (const l of ["LH", "LF", "RF"]) {
          await pinch("Toggle_" + l)
          await frames(3)
          const tg = taggedHolds(main)
          const hit = ref.evaluate(l as any, pos).results.filter((r) => !tg[r.holdId] && r.why.indexOf("LONG REACH") >= 0)[0]
          if (hit) { c.hold = hit.holdId; c.want = hit.why; c.limb = l; break }
        }
        if (!c.hold) { errs.push("precondition: no untagged hold whose reference why says LONG REACH, for any limb"); continue }
        print(`[N4] LONG REACH case: ${c.limb} on ${c.hold}`)
      }
      const r = expectedWhy(main, c.hold)
      if (!r || r.why !== c.want) errs.push(`precondition: reference why for ${c.hold} is "${r ? r.why : null}", want "${c.want}"`)
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
