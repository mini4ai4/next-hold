// Session 20, hands stay on the holds. A pinch on a hold moves the limb that makes the best move to
// it, by the test's own rule (the highest rank for that hold over the four limbs), with no limb
// chosen first, in the pinch's own frame. Each free hold's ring shows that move, so a ring never
// looks red when a pinch on it would make a good move, and "?" explains that same move. The glow
// stays the best move overall. The toggles are an override, and the panel says so: pick one and the
// next pinch moves it, if that move is green or yellow (session 21, p2), whatever is best there; the
// move uses it up. Picking one moves nothing.
// Input path: real SIK pinches on Hold_<id>, Toggle_<limb>, AskButton. No toggle is touched before
// the first checks: the toggle row's lit limb stays the glow's, and is not the limb that moves.

import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {NextHoldMain} from "../../Scripts/NextHoldMain"
import {fmtPos, frames, getMain, makeReference, mustFind, pinch, pinchCapture, renderedRingColour, restorePreset, ringRule, samePosition, taggedHolds} from "./NextHoldTestKit"
import {REF_LIMBS, RefPosition, ReferenceRule} from "./NextHoldReferenceRule"

interface Frame { pos: RefPosition; over: string | null; label: string; sel: string; marker: {[l: string]: string | null}; colour: {[id: string]: string | null} }

function read(main: NextHoldMain): Frame {
  const f: Frame = {pos: main.getPosition() as RefPosition, over: main.getLimbOverride(), label: main.getOverrideLabel(), sel: main.getSelectedLimb(), marker: {}, colour: {}}
  for (const l of REF_LIMBS) f.marker[l] = main.getMarkerHold(l as any)
  for (const id of main.getProblemHolds()) f.colour[id] = main.getHoldColour(id)
  return f
}

/** a pinch on `hold` moves exactly `limb`, read in the pinch's own frame; rings and glow for the new position */
async function pinchMoves(main: NextHoldMain, ref: ReferenceRule, hold: string, limb: string, errs: string[], tag: string): Promise<void> {
  const pos0 = main.getPosition() as RefPosition
  const got = await pinchCapture("Hold_" + hold, () => read(main))
  if (!got.fired || !got.value) { errs.push(`${tag}: Hold_${hold} never fired`); return }
  const f = got.value
  const want: RefPosition = {...pos0, [limb]: hold}
  print(`[P1] ${tag}: pinch on ${hold}: ${fmtPos(pos0)} -> ${fmtPos(f.pos)} (want ${limb} to move)`)
  if (!samePosition(f.pos, want)) errs.push(`${tag}: in the pinch frame ${fmtPos(f.pos)}, want ${fmtPos(want)}`)
  if (f.marker[limb] !== hold) errs.push(`${tag}: Marker_${limb} on ${f.marker[limb]} in the pinch frame, want ${hold}`)
  if (f.over !== null || f.label !== "") errs.push(`${tag}: after the move: override ${f.over}, panel "${f.label}"`)
  // the rings, each for the limb a pinch on it moves now, in that same frame
  for (const r of ref.perHold(want)) {
    if (f.colour[r.holdId] !== r.colour) errs.push(`${tag}: pinch-frame ring ${r.holdId} ${f.colour[r.holdId]}, rule ${r.limb} ${r.colour}`)
  }
  const best = ref.glow(want)
  if (best && f.sel !== best.limb) errs.push(`${tag}: pinch-frame limb ${f.sel}, the best move is ${best.limb}'s`)
  await frames(3)
}

@component
export class P1PinchBestLimbScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const main = getMain()
    await restorePreset(main)
    const ref = makeReference()
    const errs: string[] = []
    const pos0 = main.getPosition() as RefPosition

    // ── at the preset the glow is RH's, and the panel names the toggles what they are ──
    const sug = main.getSuggestion()!
    if (sug.limb !== "RH" || sug.holdId !== "up") errs.push(`precondition: glow ${sug.limb}->${sug.holdId}, want RH->up`)
    // session 24: the top line is empty by default (the judges' fix 3); it is still there, for an override or the cue
    if (main.getOverrideLabel() !== "" || !mustFind("OverrideLabel").enabled) errs.push(`panel "${main.getOverrideLabel()}", shown ${mustFind("OverrideLabel").enabled}`)

    // ── each free hold's ring is the move a pinch on it makes, not the glow limb's ──
    const rule = ref.perHold(pos0)
    let differs = 0, saved = 0
    for (const r of rule) {
      if (renderedRingColour(r.holdId, main) !== r.colour) errs.push(`ring ${r.holdId} renders ${renderedRingColour(r.holdId, main)}, rule ${r.limb} ${r.colour}`)
      const forGlowLimb = ref.score(sug.limb as any, r.holdId, pos0)
      if (r.limb !== sug.limb) differs++
      if (forGlowLimb.colour === "red" && r.colour !== "red") saved++
    }
    print(`[P1] preset rings: ${rule.map((r) => `${r.holdId} ${r.limb} ${r.colour}`).join(", ")}; ${differs} not the glow's limb, ${saved} would have looked red for it`)
    if (!differs) errs.push("precondition: every ring's best limb is the glow's; this proves nothing")
    if (!saved) errs.push("precondition: no ring would have looked red for the glow's limb; this proves nothing")

    // ── "?" explains the same move ──
    const h16 = ref.bestForHold("h16", pos0)
    if (taggedHolds(main)["h16"]) errs.push("precondition: h16 has a step tag at the preset")
    await pinch("AskButton"); await frames(2)
    await pinch("Hold_h16"); await frames(2)
    print(`[P1] ? on h16: "${main.getWhyText()}", rule ${h16.limb} "${h16.why}"`)
    if (main.getWhyText() !== h16.why) errs.push(`? on h16 reads "${main.getWhyText()}", the move a pinch makes is ${h16.limb}'s "${h16.why}"`)
    if (!samePosition(main.getPosition() as RefPosition, pos0)) errs.push(`"?" moved a limb: ${fmtPos(main.getPosition() as RefPosition)}`)

    // ── no limb chosen: the pinch moves the best limb for that hold, where that isn't the glow's ──
    if (main.getSelectedLimb() !== "RH") errs.push(`precondition: the lit limb is ${main.getSelectedLimb()}, want RH`)
    const b09 = ref.bestForHold("h09", pos0)
    if (b09.limb === "RH") errs.push("precondition: h09's best limb is RH, the same as the glow's")
    await pinchMoves(main, ref, "h09", b09.limb, errs, "no limb chosen")
    await restorePreset(main)
    const b16 = ref.bestForHold("h16", pos0)
    await pinchMoves(main, ref, "h16", b16.limb, errs, "no limb chosen, a foot")
    await restorePreset(main)
    await pinchMoves(main, ref, "up", "RH", errs, "the glow itself")
    await restorePreset(main)

    // ── the override: picking moves nothing, the panel shows it, rings and glow are that limb's ──
    const picked = await pinchCapture("Toggle_LF", () => read(main))
    if (!picked.value || picked.value.over !== "LF" || picked.value.label !== "Limb override: LF" || picked.value.sel !== "LF") errs.push(`Toggle_LF pinch frame: ${JSON.stringify(picked.value)}`)
    if (picked.value && !samePosition(picked.value.pos, pos0)) errs.push(`Toggle_LF moved a limb: ${fmtPos(picked.value.pos)}`)
    await frames(3)
    const asLF = ringRule(ref, main, pos0)
    for (const id of Object.keys(asLF)) {
      if (asLF[id].limb !== "LF") errs.push(`with the override, ${id}'s rule is ${asLF[id].limb}'s`)
      if (main.getHoldColour(id) !== asLF[id].colour) errs.push(`with the override, ring ${id} ${main.getHoldColour(id)}, LF's is ${asLF[id].colour}`)
    }
    const lfBest = ref.evaluate("LF", pos0).suggestion!
    const glow = main.getSuggestion()
    if (!glow || glow.limb !== "LF" || glow.holdId !== lfBest.holdId) errs.push(`with the override the glow is ${glow ? glow.limb + "->" + glow.holdId : "none"}, LF's best is ${lfBest.holdId}`)
    if (main.getLitLimb() !== "LF") errs.push(`with the override the lit toggle is ${main.getLitLimb()}`)

    // the next pinch moves the override, though the hold's best limb is another; that move uses it up.
    // Session 21: LH, not LF: only a green or yellow move is made (LF on "up" is red: p2 refuses it)
    await pinch("Toggle_LH"); await frames(2)
    const bUp = ref.bestForHold("up", pos0)
    if (bUp.limb === "LH") errs.push("precondition: up's best limb is LH")
    if (ref.score("LH", "up", pos0).colour === "red") errs.push("precondition: LH on up is red")
    await pinchMoves(main, ref, "up", "LH", errs, "override LH")
    // and it is gone: the next pinch is back to the best limb
    const pos1 = main.getPosition() as RefPosition
    const free = ref.perHold(pos1).filter((r) => r.limb !== "LH" && r.colour !== "red")[0]
    if (!free) errs.push("setup: no hold with another limb's move after the override")
    else await pinchMoves(main, ref, free.holdId, free.limb, errs, "after the override")

    await restorePreset(main)
    expect(errs.length, "the limb a pinch moves:\n" + errs.join("\n")).toBe(0)
  }
}
