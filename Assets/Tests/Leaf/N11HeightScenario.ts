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
// Session 15, two heights, two betas: from the same start the 1-2-3 at 155 cm is
// RH up, LH h09, LF lh and at 195 cm RH up, LH h10, LF lh (the taller left hand
// takes the jug h10 and skips the pinch). Both match the test's own search, every
// step after the glow is green or yellow, and the pinch from 180 to 185 cm changes
// the 1-2-3 and badge 2 in its own frame.

import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {NextHoldMain} from "../../Scripts/NextHoldMain"
import {BRIEF_HEIGHT, camera, checkBadgeAttribution, checkStepColours, fmtPos, frames, getMain, makeReference, mustFind, pinch, pinchCapture, presetPosition, renderedRingColour, restorePreset, samePosition} from "./NextHoldTestKit"
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

/** The 1-2-3 shown at `heightCm` (the Lens must be there), checked against the test's own search
 *  from `pos0` for the selected limb, with every step after the glow green or yellow and each badge
 *  in its step's colour. Returns it as "RH->up LH->h09 LF->lh". */
function readSequence(main: NextHoldMain, heightCm: number, pos0: RefPosition, errs: string[]): string {
  const tag = heightCm + " cm"
  if (main.getHeightCm() !== heightCm) errs.push(`${tag}: the Lens is at ${main.getHeightCm()} cm`)
  if (!samePosition(main.getPosition() as RefPosition, pos0)) errs.push(`${tag}: not at the preset start (${fmtPos(main.getPosition() as RefPosition)})`)
  const shown = main.getPreview()
  const seq = shown.map((m) => m.limb + "->" + m.holdId).join(" ")
  const want = makeReference(heightCm).sequence(pos0, main.getSelectedLimb() as RefLimb)
  const wantSeq = want.map((m) => m.limb + "->" + m.holdId).join(" ")
  const route = makeReference(heightCm).route(pos0, main.getSelectedLimb() as RefLimb)
  const colours = checkStepColours(main, pos0, main.getSelectedLimb(), errs, tag, heightCm)
  print(`[r7] ${tag}: 1-2-3 ${shown.map((m) => `${m.limb}->${m.holdId} (${m.colour} ${m.score.toFixed(2)})`).join(", ")}; ` +
    `rule ${wantSeq}; route to the top ${route ? route.length + " moves" : "none"}; ${colours}`)
  if (seq !== wantSeq) errs.push(`${tag}: 1-2-3 ${seq}, the test's search says ${wantSeq}`)
  if (shown.length !== 3) errs.push(`${tag}: ${shown.length} steps, want 3`)
  shown.forEach((m, i) => {
    if (i > 0 && m.colour === "red") errs.push(`${tag}: step ${i + 1} ${m.limb}->${m.holdId} is red`)
    if (want[i] && (m.colour !== want[i].colour || Math.abs(m.score - want[i].score) > 1e-9)) {
      errs.push(`${tag}: step ${i + 1} is ${m.colour} ${m.score}, rule ${want[i].colour} ${want[i].score}`)
    }
  })
  for (let n = 1; n <= shown.length; n++) {
    if (main.getGhostHold(n) !== shown[n - 1].holdId) errs.push(`${tag}: step ${n} shown on ${main.getGhostHold(n)}, want ${shown[n - 1].holdId}`)
  }
  print(`[r7] ${tag}: ${checkBadgeAttribution(camera(), main, shown, errs, tag)}`)
  return seq
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

    // ── session 15: height changes the 1-2-3 too, in the pinch's own frame ──
    // up to 155, then to 180; the pinch to 185 is read in its own frame: from about 185 cm the left
    // hand reaches the jug h10 from "up" and skips the pinch h09
    await pinch("HeightUp"); await frames(2)
    const at155 = readSequence(main, 155, pos0, errs)
    for (let i = 0; i < 5; i++) { await pinch("HeightUp"); await frames(2) }
    if (main.getHeightCm() !== 180) errs.push(`after six steps up from 150: ${main.getHeightCm()} cm, want 180`)
    const seq180 = main.getPreview().map((m) => m.limb + "->" + m.holdId).join(" ")
    const cross = await pinchCapture("HeightUp", () => ({
      h: main.getHeightCm(), seq: main.getPreview().map((m) => m.limb + "->" + m.holdId).join(" "),
      badge2: main.getGhostHold(2), badge3: main.getGhostHold(3),
      text2: (mustFind("GhostNumber_2").getComponent("Component.Text") as Text).text,
      colours: checkStepColours(main, main.getPosition() as RefPosition, main.getSelectedLimb(), errs, "185 pinch frame", 185),
    }))
    if (!cross.fired || !cross.value) errs.push("HeightUp pinch (180 -> 185) did not fire")
    else {
      const v = cross.value
      const want = makeReference(185).sequence(pos0, "RH").map((m) => m.limb + "->" + m.holdId).join(" ")
      print(`[r7] 180 cm look-ahead ${seq180}; in the 185 pinch frame ${v.seq} (rule ${want}); badge 2 "${v.text2}" on ${v.badge2}, badge 3 on ${v.badge3}; ${v.colours}`)
      if (v.h !== 185) errs.push(`pinch frame: height ${v.h}, want 185`)
      if (v.seq !== want) errs.push(`185 pinch frame: look-ahead ${v.seq}, the test's search at 185 cm says ${want}`)
      if (v.seq === seq180) errs.push(`185 pinch frame: the look-ahead did not change from 180 cm (${seq180})`)
      if (v.badge2 !== "h10" || v.text2 !== "2 · LH") errs.push(`185 pinch frame: badge 2 "${v.text2}" on ${v.badge2}, want "2 · LH" on h10`)
    }
    await pinch("HeightUp"); await frames(2)
    await pinch("HeightUp"); await frames(2)
    const at195 = readSequence(main, 195, pos0, errs)
    if (at155 === at195) errs.push(`155 and 195 cm give the same 1-2-3 from the same start (${at155})`)

    // ── on to 200, and it stops there ──
    for (let i = 0; i < 2; i++) { await pinch("HeightUp"); await frames(2) }
    if (main.getHeightCm() !== 200 || main.getHeightLabel() !== "Height 200 cm") errs.push(`after eleven steps up: ${main.getHeightCm()} cm, panel "${main.getHeightLabel()}"`)
    const g200 = readRings(main, 200, errs, "200")
    print(`[r7] 200 cm: ${main.getSelectedLimb()} green ${g200.join(",")}; look-ahead ${main.getPreview().map((m) => m.limb + "->" + m.holdId).join(" ")}`)
    if (!(g200.length >= g175.length)) errs.push(`fewer greens at 200 cm (${g200.join(",")}) than at 175 (${g175.join(",")})`)

    await restorePreset(main)
    if (main.getHeightCm() !== BRIEF_HEIGHT || Math.abs(main.getReach() - 77) > 1e-9) errs.push(`restore: height ${main.getHeightCm()}`)
    expect(errs.length, "height mismatches:\n" + errs.join("\n")).toBe(0)
  }
}
