// Session 23, the ring and the tag (v7 E): a step tag never sits on a ring whose colour means something
// else. A tag is its own badge colour, solid, and is never green, yellow or red.
// Session 24 (the A+E judges' fix 1): session 23 left the hold's own grip ring under the tag, so at 195 cm
// "2 · LH" sat on h10's red, broken ring and "?" there said "JUG HOLD · OUT OF REACH": the plan pointing at a
// hold that the ring and the why-line both called out of reach. Now a hold under a drawn step tag says nothing
// about gripping it from here: no Ring_<id>, only the neutral outline (the one an occupied hold and the hidden
// read use), and "?" on it names the step ("STEP 2"), never "OUT OF REACH". A refused pinch there
// still says "STEP 1 FIRST". The glowing hold (step 1) keeps its own colour.
// Input path: real SIK pinches on HeightUp (behind Setup), AskButton and Hold_<id>; rings read as drawn.

import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {NextHoldMain} from "../../Scripts/NextHoldMain"
import {BADGE_COLOR, NEUTRAL_COLOR, checkTagRingsAgree, frames, getMain, isColour, isHued, mustFind, pinch, renderedStyle, restorePreset} from "./NextHoldTestKit"
import {RefPosition} from "./NextHoldReferenceRule"

/** under every shown tag (not the glow): no grip ring, the neutral outline, solid, with no hue */
function checkTagged(main: NextHoldMain, errs: string[], tag: string): string {
  const out: string[] = []
  for (const n of [2, 3]) {
    if (!mustFind("Ghost_" + n).enabled) continue
    const id = main.getGhostHold(n)!
    if (!isColour("Ghost_" + n, BADGE_COLOR)) errs.push(`${tag}: badge ${n} on ${id} is not the badge colour`)
    if (renderedStyle("Ghost_" + n) !== "solid") errs.push(`${tag}: badge ${n} draws ${renderedStyle("Ghost_" + n)}`)
    if (main.isRingGlowing(id)) { out.push(`${n} on ${id}: the glow`); continue }
    const ring = mustFind("Ring_" + id).enabled
    const outline = mustFind("GhostHoldRing_" + n)
    const rgb = (outline.getComponent("Component.RenderMeshVisual") as RenderMeshVisual).mainMaterial.mainPass.baseColor as vec4
    if (ring) errs.push(`${tag}: under badge ${n} Ring_${id} shows a grip colour`)
    if (!outline.enabled || !isColour("GhostHoldRing_" + n, NEUTRAL_COLOR) || isHued(rgb)) errs.push(`${tag}: under badge ${n} on ${id}: no neutral outline (shown ${outline.enabled})`)
    if (outline.enabled && renderedStyle("GhostHoldRing_" + n) !== "solid") errs.push(`${tag}: the outline on ${id} draws ${renderedStyle("GhostHoldRing_" + n)}`)
    out.push(`${n} on ${id}: ${ring ? "RING" : "neutral outline"} (its score from here ${main.getHoldColour(id) || "none, occupied"})`)
  }
  return out.join(", ")
}

@component
export class E1TagOwnBadgeScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const main = getMain()
    await restorePreset(main)
    const errs: string[] = []

    // the badge's colour is none of the three a ring can be, and it is a colour
    const dist = (a: vec4, b: vec4) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y) + Math.abs(a.z - b.z)
    for (const [name, c] of [["green", main.greenColor], ["yellow", main.yellowColor], ["red", main.redColor]] as [string, vec4][]) {
      print(`[E1] badge vs ${name}: ${dist(BADGE_COLOR, c).toFixed(2)}`)
      if (dist(BADGE_COLOR, c) < 0.6) errs.push(`the badge colour is close to ${name}'s`)
    }
    if (!isHued(BADGE_COLOR)) errs.push("the badge colour has no hue")

    // ── at the preset: "2 · LH" on h09, "3 · LF" on lh (which LH is on): both on the neutral outline ──
    print(`[E1] preset: ${checkTagged(main, errs, "preset")}; ${checkTagRingsAgree(main, errs, "preset")}`)
    if (main.getGhostHold(2) !== "h09" || main.getGhostHold(3) !== "lh") errs.push(`precondition: badges on ${main.getGhostHold(2)}, ${main.getGhostHold(3)}`)

    // ── 195 cm: the case the judges found. h10 scores red from here; it carries "2 · LH" ──
    for (let i = 0; i < 4; i++) { await pinch("HeightUp"); await frames(2) }
    if (main.getHeightCm() !== 195 || main.getGhostHold(2) !== "h10") errs.push(`precondition: ${main.getHeightCm()} cm, badge 2 on ${main.getGhostHold(2)}`)
    if (main.getHoldColour("h10") !== "red") errs.push(`precondition: h10 scores ${main.getHoldColour("h10")} from the start at 195 cm, the case is a red one`)
    print(`[E1] 195 cm: ${checkTagged(main, errs, "195 cm")}`)
    // "?" on it names the step, never "OUT OF REACH"
    await pinch("AskButton"); await frames(2)
    await pinch("Hold_h10"); await frames(2)
    print(`[E1] ? on h10: "${main.getWhyText()}"`)
    if (main.getWhyText() !== "STEP 2") errs.push(`? on h10 reads "${main.getWhyText()}", want "STEP 2"`)
    if (main.getWhyText().indexOf("OUT OF REACH") >= 0) errs.push("the why-line on a step says OUT OF REACH")
    // a pinch on it is refused (red for every limb from here) and says so as a step
    const pos0 = main.getPosition() as RefPosition
    await pinch("Hold_h10"); await frames(2)
    print(`[E1] pinch on h10: why "${main.getWhyText()}", LH on ${main.getPosition().LH}`)
    if (main.getWhyText() !== "STEP 1 FIRST" || main.getPosition().LH !== pos0.LH) errs.push(`the refused pinch on the step: "${main.getWhyText()}", LH ${main.getPosition().LH}`)

    // ── step 1 made: the plan moves on; whatever carries a tag now wears the outline ──
    await pinch("Hold_up"); await frames(2)
    print(`[E1] 195 cm, after step 1: ${checkTagged(main, errs, "after step 1")}; h10 glowing ${main.isRingGlowing("h10")}, its own colour ${main.getHoldColour("h10")}`)
    if (main.isRingGlowing("h10") && main.getHoldColour("h10") === "red") errs.push("the glow sits on a red move")

    // ── through the climb at 175, each position ──
    await restorePreset(main)
    for (const hold of ["up", "h09", "lh", "rh"]) {
      await pinch("Hold_" + hold); await frames(2)
      print(`[E1] after ${hold}: ${checkTagged(main, errs, "after " + hold)}`)
      checkTagRingsAgree(main, errs, "after " + hold)
    }

    await restorePreset(main)
    expect(errs.length, "the tag and the ring:\n" + errs.join("\n")).toBe(0)
  }
}
