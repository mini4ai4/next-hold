// Session 23, the ring and the tag (v7 E): a step tag never sits on a ring whose colour means something
// else. A tag is its own badge colour, solid, and is never green, yellow or red. A ring's colour only ever
// means grip / reach for you from here, by the test's own rule, tag or no tag. On a hold a limb is on,
// which has no score, the tag pins onto the neutral outline. The case that started this: at 195 cm "2 · LH"
// sits on h10, whose ring from the start is red. It used to be painted green.
// Input path: real SIK pinches on HeightUp and Hold_<id>; rings read as drawn.

import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {NextHoldMain} from "../../Scripts/NextHoldMain"
import {BADGE_COLOR, NEUTRAL_COLOR, STYLE_FOR, checkTagRingsAgree, frames, getMain, isColour, isHued, makeReference, mustFind, pinch, renderedRingColour, renderedStyle, restorePreset} from "./NextHoldTestKit"
import {RefPosition} from "./NextHoldReferenceRule"

/** the two meanings apart: under every shown tag, the ring is what the rule says of that hold from here */
function checkTagged(main: NextHoldMain, errs: string[], tag: string): string {
  const pos = main.getPosition() as RefPosition
  const rule = makeReference(main.getHeightCm())
  const out: string[] = []
  for (const n of [2, 3]) {
    if (!mustFind("Ghost_" + n).enabled) continue
    const id = main.getGhostHold(n)!
    if (!isColour("Ghost_" + n, BADGE_COLOR)) errs.push(`${tag}: badge ${n} on ${id} is not the badge colour`)
    if (renderedStyle("Ghost_" + n) !== "solid") errs.push(`${tag}: badge ${n} draws ${renderedStyle("Ghost_" + n)}`)
    const occupied = ["LH", "RH", "LF", "RF"].some((l) => pos[l] === id)
    if (occupied) {
      if (!mustFind("GhostHoldRing_" + n).enabled || !isColour("GhostHoldRing_" + n, NEUTRAL_COLOR)) errs.push(`${tag}: badge ${n} on occupied ${id}: no neutral outline`)
      if (isHued((mustFind("GhostHoldRing_" + n).getComponent("Component.RenderMeshVisual") as RenderMeshVisual).mainMaterial.mainPass.baseColor as vec4)) errs.push(`${tag}: the outline on ${id} has a hue`)
      out.push(`${n} on ${id}: neutral outline`)
    } else if (!main.isRingGlowing(id)) {
      const want = rule.bestForHold(id, pos).colour, got = renderedRingColour(id, main)
      if (got !== want) errs.push(`${tag}: under badge ${n} Ring_${id} renders ${got}, the rule says ${want} from here`)
      if (renderedStyle("Ring_" + id) !== STYLE_FOR[want]) errs.push(`${tag}: Ring_${id} draws ${renderedStyle("Ring_" + id)}, ${want} is ${STYLE_FOR[want]}`)
      out.push(`${n} on ${id}: ring ${got}`)
    } else out.push(`${n} on ${id}: the glow`)
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

    // ── at the preset: "2 · LH" on h09's own ring, "3 · LF" on lh, which LH is on now ──
    print(`[E1] preset: ${checkTagged(main, errs, "preset")}; ${checkTagRingsAgree(main, errs, "preset")}`)
    if (main.getGhostHold(3) !== "lh" || !mustFind("GhostHoldRing_3").enabled) errs.push(`precondition: badge 3 on ${main.getGhostHold(3)}, its outline ${mustFind("GhostHoldRing_3").enabled}`)

    // ── 195 cm: the tag on a ring that says "not from here". Painted green before; red now, and its gap shows ──
    for (let i = 0; i < 4; i++) { await pinch("HeightUp"); await frames(2) }
    if (main.getHeightCm() !== 195 || main.getGhostHold(2) !== "h10") errs.push(`precondition: ${main.getHeightCm()} cm, badge 2 on ${main.getGhostHold(2)}`)
    print(`[E1] 195 cm: ${checkTagged(main, errs, "195 cm")}`)
    if (renderedRingColour("h10", main) !== "red") errs.push(`at 195 cm Ring_h10 renders ${renderedRingColour("h10", main)}, want its own red`)
    if (renderedStyle("Ring_h10") !== "broken") errs.push(`at 195 cm Ring_h10 draws ${renderedStyle("Ring_h10")}`)
    // "?" on it explains that ring, not the step
    const pos0 = main.getPosition() as RefPosition
    const wantWhy = makeReference(195).bestForHold("h10", pos0).why
    await pinch("AskButton"); await frames(2)
    await pinch("Hold_h10"); await frames(2)
    print(`[E1] ? on h10: "${main.getWhyText()}" (rule "${wantWhy}")`)
    if (main.getWhyText() !== wantWhy) errs.push(`? on h10 reads "${main.getWhyText()}", the ring shows "${wantWhy}"`)

    // ── the same hold once the plan reaches it: the move is there now, the ring says so ──
    await pinch("Hold_up"); await frames(2)
    print(`[E1] 195 cm, after step 1: ${checkTagged(main, errs, "after step 1")}; h10 ${renderedRingColour("h10", main)}`)

    // ── through the climb, each position, the tags never change what a ring says ──
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
