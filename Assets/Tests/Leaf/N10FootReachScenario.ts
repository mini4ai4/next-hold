// Judge plan item 7, feet reach like legs, not arms (session 14). A foot reaches
// from the hip with the leg's reach (1.25 x the arm's), and the hip hangs 0.5 x
// reach below the lower hand. So a foot can go well below the hands (a rock-over
// about 40 cm under them is a normal green move), but a foot above the hip is a
// high step: hard. Hands keep the arm's reach from the shoulder, unchanged.
// Input path: real SIK pinches on Toggle_<limb> and Hold_<id> walk the hands up
// from the preset. Same hold "rh" (a jug at 150 cm), right foot selected:
//   A: hands on h09 and up (both 190 cm): rh is 40 cm under the hands, at the hip -> green
//   B: right hand down to h11 (172 cm): the hip drops to 133.5, rh is 16.5 cm above it -> hard
// Every rendered ring is checked against the test's own rule, and for the hands
// also against the arm rule written out here (shoulder, 77 cm, 0.8 / 1.0 bands).

import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {NextHoldMain} from "../../Scripts/NextHoldMain"
import {BRIEF_REACH, fmtPos, frames, getMain, makeReference, pinch, problemHoldCoords, renderedRingColour, restorePreset} from "./NextHoldTestKit"
import {RefLimb, RefPosition, ReferenceRule} from "./NextHoldReferenceRule"

async function move(limb: RefLimb, hold: string): Promise<void> {
  await pinch("Toggle_" + limb)
  await frames(2)
  await pinch("Hold_" + hold)
  await frames(3)
}

async function select(limb: RefLimb, main: NextHoldMain, errs: string[]): Promise<void> {
  await pinch("Toggle_" + limb)
  await frames(3)
  if (main.getSelectedLimb() !== limb) errs.push(`Toggle_${limb} pinch: selected ${main.getSelectedLimb()}`)
}

/** every ring for the selected limb renders the reference colour; hands also match the plain arm rule */
function checkRings(main: NextHoldMain, ref: ReferenceRule, errs: string[], tag: string): number {
  const limb = main.getSelectedLimb() as RefLimb
  const pos = main.getPosition() as RefPosition
  const com = ref.com(pos)
  let n = 0
  for (const r of ref.evaluate(limb, pos).results) {
    const rc = renderedRingColour(r.holdId, main)
    if (rc !== r.colour) errs.push(`${tag} ${limb}: Ring_${r.holdId} renders ${rc}, reference ${r.colour} (${r.score.toFixed(3)})`)
    const sc = main.getHoldScore(r.holdId)
    if (sc === null || Math.abs(sc - r.score) > 1e-9) errs.push(`${tag} ${limb}: getHoldScore(${r.holdId}) = ${sc}, reference ${r.score}`)
    if (limb === "LH" || limb === "RH") {
      const a = ref.anchor(limb, com)
      const t = problemHoldCoords()[r.holdId]
      const x = Math.sqrt((a.x - t.x) * (a.x - t.x) + (a.y - t.y) * (a.y - t.y)) / BRIEF_REACH
      const arm = x <= 0.8 ? 1 : x <= 1 ? 1 - (x - 0.8) * 2 : 0
      if (r.limbReach !== BRIEF_REACH || r.highStep !== 1 || Math.abs(r.reachFactor - arm) > 1e-9) {
        errs.push(`${tag} ${limb}: hand ${r.holdId} is not on the arm rule (reach ${r.limbReach}, high step ${r.highStep}, factor ${r.reachFactor} vs ${arm})`)
      }
    }
    n++
  }
  return n
}

@component
export class N10FootReachScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const main = getMain()
    await restorePreset(main)
    const ref = makeReference()
    const coords = problemHoldCoords()
    const errs: string[] = []

    // ── A: both hands up to 190 cm; RF to rh (150 cm) is a 40 cm rock-over ──
    await move("LH", "h09")
    await move("RH", "up")
    const posA = main.getPosition() as RefPosition
    if (posA.LH !== "h09" || posA.RH !== "up" || posA.LF !== "lf" || posA.RF !== "rf") errs.push(`A: position ${fmtPos(posA)}`)
    await select("RF", main, errs)
    const rA = ref.score("RF", "rh", posA)
    const hipA = ref.hip("RF", posA, ref.com(posA))
    const below = Math.min(coords["h09"].y, coords["up"].y) - coords["rh"].y
    print(`[r6] A ${fmtPos(posA)}: rh ${below} cm under the hands, hip y ${hipA.y.toFixed(1)}, ${rA.dist.toFixed(1)} cm from it ` +
      `(leg reach ${rA.limbReach.toFixed(1)}), high step ${rA.highStep.toFixed(2)}, score ${rA.score.toFixed(2)} ${rA.colour}; renders ${renderedRingColour("rh", main)}`)
    if (Math.abs(below - 40) > 0.01) errs.push(`precondition: rh is ${below} cm under the hands, want 40`)
    if (rA.colour !== "green" || rA.highStep !== 1) errs.push(`A: reference RF -> rh is ${rA.colour}, high step ${rA.highStep}; want a green rock-over`)
    if (renderedRingColour("rh", main) !== "green" || main.getHoldColour("rh") !== "green") errs.push(`A: RF -> rh renders ${renderedRingColour("rh", main)}, want green`)
    // with the arm's reach from the old foot anchor it would be a stretch; the leg reaches it comfortably
    if (!(rA.limbReach > BRIEF_REACH * 1.2)) errs.push(`A: a foot reaches ${rA.limbReach} cm, not the leg's (1.25 x ${BRIEF_REACH})`)
    let rings = checkRings(main, ref, errs, "A")
    for (const l of ["LF", "LH", "RH"] as RefLimb[]) { await select(l, main, errs); rings += checkRings(main, ref, errs, "A") }

    // ── B: right hand down to h11 (172 cm); the hip drops with it and rh is now above it ──
    await move("RH", "h11")
    const posB = main.getPosition() as RefPosition
    if (posB.LH !== "h09" || posB.RH !== "h11") errs.push(`B: position ${fmtPos(posB)}`)
    await select("RF", main, errs)
    const rB = ref.score("RF", "rh", posB)
    const hipB = ref.hip("RF", posB, ref.com(posB))
    print(`[r6] B ${fmtPos(posB)}: hip y ${hipB.y.toFixed(1)}, rh ${(coords["rh"].y - hipB.y).toFixed(1)} cm above it, ` +
      `high step ${rB.highStep.toFixed(2)}, score ${rB.score.toFixed(2)} ${rB.colour}, why "${main.getHoldWhy("rh")}"; renders ${renderedRingColour("rh", main)}`)
    if (!(coords["rh"].y > hipB.y)) errs.push(`precondition: rh (${coords["rh"].y}) is not above the hip (${hipB.y})`)
    if (rB.colour === "green" || !(rB.highStep < 1)) errs.push(`B: reference RF -> rh is ${rB.colour}, high step ${rB.highStep}; want hard`)
    const shownB = renderedRingColour("rh", main)
    if (shownB === "green" || shownB === null) errs.push(`B: RF -> rh above the hip renders ${shownB}, want yellow or red`)
    if ((main.getHoldWhy("rh") || "").indexOf("HIGH STEP") < 0) errs.push(`B: why for rh is "${main.getHoldWhy("rh")}", want it to say HIGH STEP`)
    rings += checkRings(main, ref, errs, "B")
    for (const l of ["LF", "LH", "RH"] as RefLimb[]) { await select(l, main, errs); rings += checkRings(main, ref, errs, "B") }
    print(`[r6] ${rings} rings checked against the rule (hands also against the arm rule), ${errs.length} mismatches`)

    await restorePreset(main)
    expect(errs.length, "foot reach mismatches:\n" + errs.join("\n")).toBe(0)
  }
}
