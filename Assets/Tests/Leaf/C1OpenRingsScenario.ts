// Done criterion 1: at open (climb mode, preset position) every hold of the
// preset problem that no limb is on shows exactly one ring whose colour matches
// the reference rule (over the problem's holds) for the auto-selected limb; the
// four occupied holds show a dim marker and no ring; holds outside the problem
// show no ring and are dim (review item 1: "Mark your problem").
// Expected colours are computed by the test's own port of scoring.js
// (NextHoldReferenceRule) from the Hold_<id> positions in the scene.
// No input is driven here: the open state is observed.

import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {HOLDS} from "../../Scripts/Wall/WallLayout"
import {NextHoldMain} from "../../Scripts/NextHoldMain"
import {
  BRIEF_REACH, countByName, fmtPos, getMain, isPresetProblem, makeReference, mustFind, planeDistanceToHold,
  presetPosition, presetProblem, renderedRingColour, restorePreset, samePosition, sceneHoldCoords,
} from "./NextHoldTestKit"
import {REF_LIMBS, RefPosition} from "./NextHoldReferenceRule"

function checkOpenState(main: NextHoldMain, tag: string): string[] {
  const errs: string[] = []
  const ref = makeReference()
  const pos = presetPosition()
  const lensPos = main.getPosition() as RefPosition
  if (!samePosition(lensPos, pos)) errs.push(`${tag}: position ${fmtPos(lensPos)} != preset ${fmtPos(pos)}`)
  if (main.getMode() !== "climb") errs.push(`${tag}: mode ${main.getMode()} != climb`)

  const best = ref.bestMove(pos)
  if (!best) { errs.push(`${tag}: reference has no best move`); return errs }
  const sel = main.getSelectedLimb()
  if (sel !== best.limb) errs.push(`${tag}: selected limb ${sel} != reference bestMove limb ${best.limb}`)
  if (main.getLitLimb() !== best.limb) errs.push(`${tag}: lit toggle ${main.getLitLimb()} != ${best.limb}`)

  const ev = ref.evaluate(best.limb, pos)
  const byId: {[id: string]: any} = {}
  for (const r of ev.results) byId[r.holdId] = r
  const occupied: {[id: string]: string} = {}
  for (const l of REF_LIMBS) occupied[pos[l] as string] = l

  let ringed = 0, markerOnly = 0, outside = 0
  const tally: {[c: string]: number} = {green: 0, yellow: 0, red: 0}
  for (const h of HOLDS) {
    const id = h.id
    const n = countByName("Ring_" + id)
    if (n !== 1) errs.push(`${tag}: ${n} objects named Ring_${id} (want exactly 1)`)
    const ringOn = mustFind("Ring_" + id).enabled
    const rendered = renderedRingColour(id, main)
    const state = main.getHoldColour(id)
    if (!isPresetProblem(id)) {
      // not in "your problem": visible but dim, no ring, not scored
      if (ringOn) errs.push(`${tag}: ${id} is not in the problem but shows a ring`)
      if (state !== null) errs.push(`${tag}: ${id} is not in the problem but has colour ${state}`)
      if (!mustFind("Hold_" + id).enabled) errs.push(`${tag}: ${id} is hidden (should stay visible, dim)`)
      if (!main.isHoldDim(id)) errs.push(`${tag}: ${id} is not in the problem but is not dim`)
      outside++
      continue
    }
    if (main.isHoldDim(id)) errs.push(`${tag}: problem hold ${id} is dim`)
    if (occupied[id]) {
      const limb = occupied[id]
      if (ringOn) errs.push(`${tag}: occupied hold ${id} (${limb}) shows a ring`)
      if (state !== null) errs.push(`${tag}: occupied hold ${id} has colour ${state}`)
      const marker = mustFind("Marker_" + limb)
      if (!marker.enabled) errs.push(`${tag}: Marker_${limb} hidden`)
      const d = planeDistanceToHold(marker, id)
      if (d > 1) errs.push(`${tag}: Marker_${limb} is ${d.toFixed(1)} cm from Hold_${id}`)
      if (main.getMarkerHold(limb as any) !== id) errs.push(`${tag}: getMarkerHold(${limb}) = ${main.getMarkerHold(limb as any)} != ${id}`)
      markerOnly++
    } else {
      const want = byId[id].colour
      if (!ringOn) errs.push(`${tag}: free hold ${id} has no ring (want ${want})`)
      if (rendered !== want) errs.push(`${tag}: Ring_${id} renders ${rendered}, reference ${want} (score ${byId[id].score.toFixed(3)})`)
      if (state !== want) errs.push(`${tag}: getHoldColour(${id}) = ${state}, reference ${want}`)
      const ringD = planeDistanceToHold(mustFind("Ring_" + id), id)
      if (ringD > 1) errs.push(`${tag}: Ring_${id} is ${ringD.toFixed(1)} cm from its hold`)
      ringed++
      tally[want]++
    }
  }
  const wantRinged = presetProblem().length - 4
  if (ringed !== wantRinged) errs.push(`${tag}: ${ringed} ringed holds, want ${wantRinged} (the problem's free holds)`)
  if (markerOnly !== 4) errs.push(`${tag}: ${markerOnly} marker-only holds, want 4`)
  if (outside !== HOLDS.length - presetProblem().length) errs.push(`${tag}: ${outside} holds outside the problem`)
  print(`[C1] ${tag}: limb ${best.limb}, reference colours green ${tally.green} / yellow ${tally.yellow} / red ${tally.red}, ${errs.length} mismatches`)
  return errs
}

@component
export class C1OpenRingsScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const main = getMain()
    expect(main.isReady(), "Lens not ready").toBe(true)

    // the test's coordinates come from the scene; make sure they are the brief's wall
    const coords = sceneHoldCoords()
    for (const h of HOLDS) {
      expect(Math.abs(coords[h.id].x - h.x) < 0.01 && Math.abs(coords[h.id].y - h.y) < 0.01,
        `Hold_${h.id} sits at ${coords[h.id].x},${coords[h.id].y}, layout says ${h.x},${h.y}`).toBe(true)
    }
    expect(Math.abs(main.getReach() - BRIEF_REACH) < 1e-6, `Lens reach ${main.getReach()} != 77`).toBe(true)

    const errs: string[] = []
    const fresh = samePosition(main.getPosition() as RefPosition, presetPosition())
    if (fresh) {
      // the Lens is still at its untouched open state: check it as-is first
      errs.push(...checkOpenState(main, "as opened"))
    } else {
      print("[C1] Lens was not at the preset on entry (earlier scenario moved it); checking after restore only")
    }
    await restorePreset(main)
    errs.push(...checkOpenState(main, "after restore"))
    expect(errs.length, "criterion 1 mismatches:\n" + errs.join("\n")).toBe(0)
  }
}
