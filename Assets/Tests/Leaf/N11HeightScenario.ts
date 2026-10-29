// Judge plan item 8, height in the Lens (session 14): the climber sets their
// height in the control panel (Height − / +, 150-200 cm in 5 cm steps, 175 at
// open) and reach scales from it: arm reach = height x 0.44, and the leg, the hip
// and the high step are shares of that. Same position, different body, different
// colours, in the same frame as the pinch.
// Input path: real SIK pinches on HeightDown / HeightUp. State is captured inside
// the pinch's own onTriggerEnd (the same frame) and every ring is compared with
// the test's own rule at that height.
//   175 -> 150: from the preset, h09 (a pinch up and left) is green for the right
//   hand at 175 and is not green at 150; the green set changes.
//   -> 200: back up past 175, the colours follow again; the range stops at 150 and 200.

import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {NextHoldMain} from "../../Scripts/NextHoldMain"
import {BRIEF_HEIGHT, fmtPos, frames, getMain, makeReference, mustFind, pinch, pinchCapture, presetPosition, renderedRingColour, restorePreset, samePosition} from "./NextHoldTestKit"
import {RefLimb, RefPosition} from "./NextHoldReferenceRule"

/** green holds for the selected limb as rendered, and every ring checked against the rule at `heightCm` */
function readRings(main: NextHoldMain, heightCm: number, errs: string[], tag: string): string[] {
  const ref = makeReference(heightCm)
  const limb = main.getSelectedLimb() as RefLimb
  const pos = main.getPosition() as RefPosition
  const greens: string[] = []
  for (const r of ref.evaluate(limb, pos).results) {
    const rc = renderedRingColour(r.holdId, main)
    if (rc !== r.colour) errs.push(`${tag}: Ring_${r.holdId} renders ${rc}, rule at ${heightCm} cm says ${r.colour} (${r.score.toFixed(3)})`)
    if (rc === "green") greens.push(r.holdId)
  }
  // the feet follow the height too: the rule's feet at this height match what the Lens scores
  for (const foot of ["LF", "RF"] as RefLimb[]) {
    for (const r of ref.evaluate(foot, pos).results) {
      if (Math.abs(r.limbReach - 1.25 * heightCm * 0.44) > 1e-9) errs.push(`${tag}: ${foot} leg reach ${r.limbReach} at ${heightCm} cm`)
    }
  }
  return greens.sort()
}

@component
export class N11HeightScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const main = getMain()
    await restorePreset(main)
    const errs: string[] = []
    const pos0 = presetPosition()

    if (!mustFind("HeightDown").enabled || !mustFind("HeightUp").enabled || !mustFind("HeightLabel").enabled) errs.push("the height control is not shown")
    if (main.getHeightCm() !== BRIEF_HEIGHT || main.getHeightLabel() !== "Height 175 cm") errs.push(`at open: height ${main.getHeightCm()}, panel "${main.getHeightLabel()}"`)
    if (Math.abs(main.getReach() - 77) > 1e-9) errs.push(`reach ${main.getReach()} at 175 cm, want 77`)
    const selected = main.getSelectedLimb()
    if (selected !== "RH") errs.push(`precondition: the preset selects ${selected}, want RH`)
    const g175 = readRings(main, 175, errs, "175")
    const seq175 = main.getPreview().map((m) => m.limb + "->" + m.holdId).join(" ")
    print(`[r7] 175 cm: ${selected} green ${g175.join(",")}; look-ahead ${seq175}`)
    if (g175.indexOf("h09") < 0) errs.push(`precondition: h09 is not green for RH at 175 cm (${g175.join(",")})`)

    // ── down to 150, five real pinches; the last one is read in its own frame ──
    for (let i = 0; i < 4; i++) { await pinch("HeightDown"); await frames(2) }
    if (main.getHeightCm() !== 155) errs.push(`after four steps down: ${main.getHeightCm()} cm, want 155`)
    const got = await pinchCapture("HeightDown", () => ({
      h: main.getHeightCm(), reach: main.getReach(), label: main.getHeightLabel(),
      h09: main.getHoldColour("h09"), score: main.getHoldScore("h09"),
    }))
    if (!got.fired || !got.value) errs.push("HeightDown pinch did not fire")
    else {
      const v = got.value
      const want = makeReference(150).score("RH", "h09", pos0)
      print(`[r7] in the pinch frame: height ${v.h}, reach ${v.reach.toFixed(1)}, panel "${v.label}", h09 ${v.h09} (${v.score !== null ? v.score.toFixed(3) : "-"}; rule ${want.colour} ${want.score.toFixed(3)})`)
      if (v.h !== 150 || Math.abs(v.reach - 66) > 1e-9 || v.label !== "Height 150 cm") errs.push(`pinch frame: height ${v.h}, reach ${v.reach}, panel "${v.label}"; want 150, 66, "Height 150 cm"`)
      if (v.h09 !== want.colour || v.score === null || Math.abs(v.score - want.score) > 1e-9) errs.push(`pinch frame: h09 ${v.h09} ${v.score}, rule at 150 says ${want.colour} ${want.score}`)
    }
    await frames(3)
    if (!samePosition(main.getPosition() as RefPosition, pos0)) errs.push(`the height changed the position: ${fmtPos(main.getPosition() as RefPosition)}`)
    if (main.getSelectedLimb() !== selected) errs.push(`the height changed the selected limb to ${main.getSelectedLimb()}`)
    const g150 = readRings(main, 150, errs, "150")
    const seq150 = main.getPreview().map((m) => m.limb + "->" + m.holdId).join(" ")
    print(`[r7] 150 cm: ${selected} green ${g150.join(",") || "none"}; look-ahead ${seq150}`)
    if (g150.indexOf("h09") >= 0) errs.push("h09 is still green for RH at 150 cm")
    if (g150.join() === g175.join()) errs.push(`the same holds are green at 150 and 175 cm (${g150.join(",")})`)

    // the range stops at 150
    await pinch("HeightDown"); await frames(2)
    if (main.getHeightCm() !== 150) errs.push(`below the range: ${main.getHeightCm()} cm`)

    // ── up to 200, ten steps, and it stops there ──
    for (let i = 0; i < 11; i++) { await pinch("HeightUp"); await frames(2) }
    if (main.getHeightCm() !== 200 || main.getHeightLabel() !== "Height 200 cm") errs.push(`after eleven steps up: ${main.getHeightCm()} cm, panel "${main.getHeightLabel()}"`)
    const g200 = readRings(main, 200, errs, "200")
    print(`[r7] 200 cm: ${main.getSelectedLimb()} green ${g200.join(",")}; look-ahead ${main.getPreview().map((m) => m.limb + "->" + m.holdId).join(" ")}`)
    if (!(g200.length >= g175.length)) errs.push(`fewer greens at 200 cm (${g200.join(",")}) than at 175 (${g175.join(",")})`)

    await restorePreset(main)
    if (main.getHeightCm() !== BRIEF_HEIGHT || Math.abs(main.getReach() - 77) > 1e-9) errs.push(`restore: height ${main.getHeightCm()}`)
    expect(errs.length, "height mismatches:\n" + errs.join("\n")).toBe(0)
  }
}
