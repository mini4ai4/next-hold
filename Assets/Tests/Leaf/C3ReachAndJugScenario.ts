// Done criterion 3: a hold beyond reach is always red; a jug within 80% of
// reach, above the centre of mass, with both feet on holds, is green.
// From the preset: select each limb with a real SIK pinch on Toggle_<limb>
// and check every problem hold the reference puts beyond reach is red for that
// limb (there must be at least one; "far" was this hold before the wall had a
// marked problem, now it is outside the problem and must show no ring); then
// for RH check the preconditions of "up" from the wall coordinates and that it
// renders green.

import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {
  BRIEF_REACH, frames, getMain, makeReference, mustFind, pinch, presetPosition, presetTypes,
  renderedRingColour, restorePreset, sceneHoldCoords,
} from "./NextHoldTestKit"
import {REF_LIMBS, RefLimb} from "./NextHoldReferenceRule"

@component
export class C3ReachAndJugScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const main = getMain()
    await restorePreset(main)
    const ref = makeReference()
    const pos = presetPosition()
    const coords = sceneHoldCoords()
    const types = presetTypes()
    const errs: string[] = []

    // ── beyond reach is always red, for every limb ──
    for (const limb of REF_LIMBS) {
      await pinch("Toggle_" + limb)
      await frames(3)
      if (main.getSelectedLimb() !== limb) errs.push(`Toggle_${limb} pinch: selected ${main.getSelectedLimb()}`)
      if (main.getLitLimb() !== limb) errs.push(`Toggle_${limb} pinch: lit toggle ${main.getLitLimb()}`)
      // "far" is not in the preset problem any more: it shows no ring at all
      if (main.getHoldColour("far") !== null || renderedRingColour("far", main) !== null) {
        errs.push(`${limb}: far is outside the problem but shows ${renderedRingColour("far", main)}`)
      }
      // the top hold (h20) is in the problem and beyond reach of every limb from the preset
      let beyond = 0
      for (const r of ref.evaluate(limb, pos).results) {
        if (r.dist <= BRIEF_REACH) continue
        beyond++
        const rc = renderedRingColour(r.holdId, main)
        if (main.getHoldColour(r.holdId) !== "red") errs.push(`${limb}: getHoldColour(${r.holdId}) = ${main.getHoldColour(r.holdId)} beyond reach`)
        if (rc !== "red") errs.push(`${limb}: ${r.holdId} is ${r.dist.toFixed(0)} cm away (beyond reach) but renders ${rc}`)
      }
      if (beyond === 0) errs.push(`precondition: no problem hold is beyond reach of ${limb}`)
      print(`[C3] ${limb}: ${beyond} problem holds beyond reach, all checked red`)
    }

    // ── a jug in comfortable reach, above the COM, both feet on: green ──
    await pinch("Toggle_RH")
    await frames(3)
    const limb: RefLimb = "RH"
    const com = ref.com(pos)
    const anchor = ref.anchor(limb, com)
    const up = coords["up"]
    const d = Math.sqrt((anchor.x - up.x) * (anchor.x - up.x) + (anchor.y - up.y) * (anchor.y - up.y))
    const lensPos = main.getPosition()
    const feetOn = lensPos.LF != null && lensPos.RF != null &&
      mustFind("Marker_LF").enabled && mustFind("Marker_RF").enabled
    print(`[C3] up: type ${types["up"]}, ${d.toFixed(1)} cm from the RH shoulder (80% of reach = ${(0.8 * BRIEF_REACH).toFixed(1)}), y ${up.y} vs COM ${com.y.toFixed(1)}, feet on ${feetOn}`)
    if (types["up"] !== "jug" || main.getHoldType("up") !== "jug") errs.push(`up is not a jug (${main.getHoldType("up")})`)
    if (!(d <= 0.8 * BRIEF_REACH)) errs.push(`precondition: up is ${d.toFixed(1)} cm, beyond 80% of reach`)
    if (!(up.y > com.y)) errs.push(`precondition: up (y ${up.y}) not above COM (y ${com.y})`)
    if (!feetOn) errs.push("precondition: both feet are not on holds")
    if (main.getHoldColour("up") !== "green") errs.push(`getHoldColour(up) = ${main.getHoldColour("up")}`)
    if (renderedRingColour("up", main) !== "green") errs.push(`Ring_up renders ${renderedRingColour("up", main)}`)

    // every other jug meeting the same three conditions for a hand, without
    // crossing the body (the reference's cross-body penalty is separate), is green
    for (const hand of ["LH", "RH"] as RefLimb[]) {
      await pinch("Toggle_" + hand)
      await frames(3)
      const a = ref.anchor(hand, com)
      const other = coords[pos[hand === "RH" ? "LH" : "RH"] as string]
      for (const r of ref.evaluate(hand, pos).results) {
        const h = coords[r.holdId]
        const dd = Math.sqrt((a.x - h.x) * (a.x - h.x) + (a.y - h.y) * (a.y - h.y))
        const crosses = hand === "RH" ? h.x < other.x : h.x > other.x
        if (types[r.holdId] === "jug" && dd <= 0.8 * BRIEF_REACH && h.y > com.y && !crosses) {
          const rc = renderedRingColour(r.holdId, main)
          print(`[C3] ${hand}: qualifying jug ${r.holdId} renders ${rc}`)
          if (rc !== "green") errs.push(`${hand}: qualifying jug ${r.holdId} renders ${rc}`)
        }
      }
    }
    expect(errs.length, "criterion 3 mismatches:\n" + errs.join("\n")).toBe(0)
  }
}
