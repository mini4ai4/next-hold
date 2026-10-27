// Done criterion 2: pinching a free hold moves the selected limb there; its
// dim marker jumps to that hold; all rings recompute in the SAME frame; and the
// limb with the best next move (reference bestMove) is auto-selected.
// Input path: real SIK pinches on Hold_<id> (simulated right hand). The
// post-move state is captured inside the Interactable's onTriggerEnd, in the
// same frame as the Lens's own handler, with no frame wait.

import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {HOLDS} from "../../Scripts/Wall/WallLayout"
import {NextHoldMain} from "../../Scripts/NextHoldMain"
import {
  fmtPos, frames, getMain, makeReference, mustFind, pinch, pinchCapture, planeDistanceToHold,
  renderedRingColour, restorePreset,
} from "./NextHoldTestKit"
import {REF_LIMBS, RefPosition} from "./NextHoldReferenceRule"

interface Snap {
  pos: RefPosition
  selected: string
  lit: string | null
  marker: {[l: string]: string | null}
  markerDist: {[l: string]: number}
  colour: {[id: string]: string | null}
  rendered: {[id: string]: string | null}
  ringOn: {[id: string]: boolean}
}

function snap(main: NextHoldMain): Snap {
  const s: Snap = {pos: main.getPosition() as RefPosition, selected: main.getSelectedLimb(), lit: main.getLitLimb(),
    marker: {}, markerDist: {}, colour: {}, rendered: {}, ringOn: {}}
  for (const l of REF_LIMBS) {
    s.marker[l] = main.getMarkerHold(l as any)
    const at = s.pos[l]
    s.markerDist[l] = at ? planeDistanceToHold(mustFind("Marker_" + l), at) : -1
  }
  for (const h of HOLDS) {
    s.colour[h.id] = main.getHoldColour(h.id)
    s.rendered[h.id] = renderedRingColour(h.id, main)
    s.ringOn[h.id] = mustFind("Ring_" + h.id).enabled
  }
  return s
}

async function moveAndCheck(main: NextHoldMain, target: string, errs: string[], tag: string): Promise<void> {
  const ref = makeReference()
  const before = snap(main)
  const mover = before.selected
  const fromHold = before.pos[mover] as string
  const got = await pinchCapture("Hold_" + target, () => snap(main))
  if (!got.fired || !got.value) { errs.push(`${tag}: Hold_${target} onTriggerEnd never fired`); return }
  const a = got.value

  const expectPos: RefPosition = {...before.pos}
  expectPos[mover] = target
  const best = ref.bestMove(expectPos)
  print(`[C2] ${tag}: ${mover} ${fromHold} -> ${target}; now ${fmtPos(a.pos)}; selected ${a.selected}; reference best ${best ? best.limb + "->" + best.holdId : "none"}`)

  // the selected limb moved, nothing else did
  for (const l of REF_LIMBS) {
    if (a.pos[l] !== expectPos[l]) errs.push(`${tag}: same-frame position ${l}=${a.pos[l]}, want ${expectPos[l]}`)
  }
  // its dim marker jumped there (same frame)
  if (a.marker[mover] !== target) errs.push(`${tag}: Marker_${mover} on ${a.marker[mover]} in the pinch frame, want ${target}`)
  if (a.markerDist[mover] > 1) errs.push(`${tag}: Marker_${mover} is ${a.markerDist[mover].toFixed(1)} cm from Hold_${target} in the pinch frame`)
  // auto-select = reference bestMove for the new position (same frame)
  if (!best) errs.push(`${tag}: reference has no best move`)
  else {
    if (a.selected !== best.limb) errs.push(`${tag}: selected ${a.selected} in the pinch frame, reference bestMove limb ${best.limb}`)
    // every ring recomputed in the same frame, for the auto-selected limb
    const ev = ref.evaluate(best.limb, expectPos)
    const want: {[id: string]: string} = {}
    for (const r of ev.results) want[r.holdId] = r.colour
    let changed = 0
    for (const h of HOLDS) {
      const w = want[h.id] || null
      if (a.colour[h.id] !== w) errs.push(`${tag}: pinch-frame getHoldColour(${h.id}) = ${a.colour[h.id]}, reference ${w}`)
      if (a.rendered[h.id] !== w) errs.push(`${tag}: pinch-frame Ring_${h.id} renders ${a.rendered[h.id]}, reference ${w}`)
      if (a.ringOn[h.id] !== !!w) errs.push(`${tag}: pinch-frame Ring_${h.id} enabled=${a.ringOn[h.id]}, want ${!!w}`)
      if (a.rendered[h.id] !== before.rendered[h.id]) changed++
    }
    if (a.ringOn[target]) errs.push(`${tag}: the hold just moved to still shows a ring`)
    if (!a.ringOn[fromHold]) errs.push(`${tag}: the hold just left (${fromHold}) shows no ring`)
    print(`[C2] ${tag}: ${changed} rings changed colour/visibility in the pinch frame`)
    if (changed === 0) errs.push(`${tag}: no ring changed in the pinch frame`)
  }
  // toggle row shows the auto-selected limb (in the pinch frame and settled)
  if (best && a.lit !== best.limb) errs.push(`${tag}: pinch-frame lit toggle ${a.lit}, want ${best.limb}`)
  await frames(3)
  if (best && main.getLitLimb() !== best.limb) errs.push(`${tag}: settled lit toggle ${main.getLitLimb()}, want ${best.limb}`)
  if (best && main.getSelectedLimb() !== best.limb) errs.push(`${tag}: settled selected ${main.getSelectedLimb()}, want ${best.limb}`)
}

@component
export class C2PinchMoveScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const main = getMain()
    await restorePreset(main)
    const errs: string[] = []

    // move 1: from the preset, pinch the suggested hold
    const s1 = main.getSuggestion()
    expect(s1 !== null, "no suggestion at preset").toBe(true)
    await moveAndCheck(main, s1!.holdId, errs, "move 1")

    // move 2: pinch a free hold that is NOT the suggestion (a non-red one if any)
    const ref = makeReference()
    const pos = main.getPosition() as RefPosition
    const ev = ref.evaluate(main.getSelectedLimb() as any, pos)
    const sug = ev.suggestion ? ev.suggestion.holdId : ""
    const pick = ev.results.filter((r) => r.holdId !== sug && r.colour !== "red")[0] ||
      ev.results.filter((r) => r.holdId !== sug)[0]
    await moveAndCheck(main, pick.holdId, errs, "move 2")

    // move 3: a move after which a DIFFERENT limb is best (reference: RF -> h18 makes LF best),
    // so the auto-select visibly switches the toggle row. Limb chosen with a real pinch on Toggle_RF.
    await restorePreset(main)
    await pinch("Toggle_RF")
    await frames(3)
    if (main.getSelectedLimb() !== "RF") errs.push(`Toggle_RF pinch: selected ${main.getSelectedLimb()}`)
    const refBest3 = makeReference().bestMove({...(main.getPosition() as RefPosition), RF: "h18"})
    if (!refBest3 || refBest3.limb === "RF") errs.push(`setup: reference best after RF->h18 is ${refBest3 ? refBest3.limb : "none"}, wanted a different limb`)
    await moveAndCheck(main, "h18", errs, "move 3")

    expect(errs.length, "criterion 2 mismatches:\n" + errs.join("\n")).toBe(0)
  }
}
