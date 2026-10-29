// Review item 2, "Upward goal": among moves of similar quality the hold that
// gets you higher and closer to the problem's top hold ranks better. The goal
// only ranks: colours still come from grip x reach x balance, and an
// out-of-reach hold stays red, even the top hold itself.
// Input path: a real SIK pinch on Hold_up from the preset (RH is auto-selected
// and "up" is the suggestion). State is captured in the pinch frame and
// compared to the test's own port of scoring.js, with and without the goal.

import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {HOLDS, PRESET_TOP} from "../../Scripts/Wall/WallLayout"
import {NextHoldMain} from "../../Scripts/NextHoldMain"
import {fmtPos, getMain, makeReference, pinchCapture, problemHoldCoords, renderedRingColour, restorePreset} from "./NextHoldTestKit"
import {RefPosition, ReferenceRule} from "./NextHoldReferenceRule"

function checkColours(main: NextHoldMain, ref: ReferenceRule, pos: RefPosition, errs: string[], tag: string): void {
  const plain = ref.withoutGoal()
  const limb = main.getSelectedLimb() as any
  const withGoal = ref.evaluate(limb, pos).results
  const without: {[id: string]: string} = {}
  for (const r of plain.evaluate(limb, pos).results) without[r.holdId] = r.colour
  let beyond = 0
  for (const r of withGoal) {
    const rc = renderedRingColour(r.holdId, main)
    if (r.colour !== without[r.holdId]) errs.push(`${tag}: reference colour of ${r.holdId} changes with the goal`)
    if (rc !== without[r.holdId]) errs.push(`${tag}: Ring_${r.holdId} renders ${rc}, colour rule (no goal) says ${without[r.holdId]}`)
    if (r.reachFactor === 0) {
      beyond++
      if (rc !== "red") errs.push(`${tag}: ${r.holdId} is out of reach but renders ${rc}`)
      if (r.rank !== 0) errs.push(`${tag}: ${r.holdId} is out of reach but ranks ${r.rank}`)
    }
  }
  print(`[N2] ${tag}: ${withGoal.length} rings match the plain colour rule; ${beyond} out of reach, all red`)
}

@component
export class N2UpwardGoalScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const main = getMain()
    await restorePreset(main)
    const ref = makeReference()
    const errs: string[] = []
    const pos0 = main.getPosition() as RefPosition

    if (main.getTopHold() !== PRESET_TOP) errs.push(`top hold ${main.getTopHold()}, want ${PRESET_TOP}`)
    // the top hold is out of reach from the preset for every limb: red, despite being the goal
    for (const l of ["LH", "RH", "LF", "RF"]) {
      const r = ref.score(l as any, PRESET_TOP, pos0)
      if (r.reachFactor !== 0 || r.colour !== "red") errs.push(`precondition: top ${PRESET_TOP} not out of reach for ${l}`)
    }
    if (renderedRingColour(PRESET_TOP, main) !== "red") errs.push(`top ${PRESET_TOP} renders ${renderedRingColour(PRESET_TOP, main)}, want red`)
    checkColours(main, ref, pos0, errs, "preset")

    const sug0 = main.getSuggestion()
    if (!sug0 || sug0.limb !== "RH" || sug0.holdId !== "up") errs.push(`preset suggestion ${sug0 ? sug0.limb + "->" + sug0.holdId : "none"}, want RH->up`)

    // ── move RH up; in the pinch frame the suggestion must keep climbing ──
    const got = await pinchCapture("Hold_up", () => ({
      pos: main.getPosition() as RefPosition,
      sug: main.getSuggestion(),
      selected: main.getSelectedLimb(),
    }))
    if (!got.fired || !got.value) {
      errs.push("Hold_up pinch did not fire")
    } else {
      const a = got.value
      const withGoal = ref.bestMove(a.pos)
      const noGoal = ref.withoutGoal().bestMove(a.pos)
      const s = a.sug
      print(`[N2] after RH->up (${fmtPos(a.pos)}): Lens ${s ? s.limb + "->" + s.holdId : "none"}; ` +
        `reference with goal ${withGoal ? withGoal.limb + "->" + withGoal.holdId : "none"}, without ${noGoal ? noGoal.limb + "->" + noGoal.holdId : "none"}`)
      if (a.pos.RH !== "up") errs.push(`RH did not move to up (${fmtPos(a.pos)})`)
      if (!noGoal || noGoal.limb !== "RH" || noGoal.holdId !== "rh") {
        errs.push(`precondition: without the goal the reference should send RH back down to rh, got ${noGoal ? noGoal.limb + "->" + noGoal.holdId : "none"}`)
      }
      if (!s || !withGoal || s.limb !== withGoal.limb || s.holdId !== withGoal.holdId) errs.push("Lens suggestion differs from the reference with the goal")
      if (s && s.holdId === "rh") errs.push("Lens suggests going back down to rh")
      const coords = problemHoldCoords()
      if (s && !(coords[s.holdId].y > coords[a.pos[s.limb] as string].y)) errs.push(`suggested ${s.limb}->${s.holdId} does not go higher`)
      if (withGoal && a.selected !== withGoal.limb) errs.push(`auto-selected ${a.selected}, reference with goal ${withGoal.limb}`)
      checkColours(main, ref, a.pos, errs, "after RH->up")
    }

    // every hold's score in the Lens is the plain score (the goal never leaks into it)
    for (const h of HOLDS) {
      const sc = main.getHoldScore(h.id)
      if (sc === null) continue
      const want = ref.withoutGoal().score(main.getSelectedLimb() as any, h.id, main.getPosition() as RefPosition).score
      if (Math.abs(sc - want) > 1e-9) errs.push(`getHoldScore(${h.id}) = ${sc}, colour score ${want}`)
    }

    expect(errs.length, "upward-goal mismatches:\n" + errs.join("\n")).toBe(0)
  }
}
