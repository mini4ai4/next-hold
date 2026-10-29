// Review item 3, "Sequence preview": a small look-ahead over bestMove gives the
// next 2-3 moves. Step 1 is the glowing suggestion with its label; steps 2 and 3
// show as small light badges pinned on their own hold's ring, naming the limb:
// "2 · LH", "3 · RF". They update in the same frame as the main rings.
// Attribution (strict review 29.10): on screen the ring nearest each badge is its
// own hold's, by at least 2 cm, and its text names the limb that moves in that
// step. Every badge stays readable: no glow ring and no other badge covers it,
// and a dotted path runs glow -> 2 -> 3, clear of the glow, the label and the
// badges (an arc around the hold when two moves share one, checked on a forced
// match; a badge on the glowing hold, also forced, sits on the glow's outer ring).
// Input path: real SIK pinches on Hold_<id>, Toggle_<limb>, ModeSwitch. The
// expected look-ahead comes from the test's own port (NextHoldReferenceRule).

import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {HOLD_SIZE, holdById} from "../../Scripts/Wall/WallLayout"
import {NextHoldMain} from "../../Scripts/NextHoldMain"
import {
  BADGE_STEPS, camera, checkBadgeAttribution, checkGhostNumbersClear, fmtPos, frames, ghostBadge, ghostPathDots, getMain,
  makeReference, mustFind, pinch, pinchCapture, renderedRingColour, restorePreset,
} from "./NextHoldTestKit"
import {RefPosition} from "./NextHoldReferenceRule"

interface GhostSnap {
  pos: RefPosition
  selected: string
  steps: (string | null)[]
  rendered: {[id: string]: string | null}
}

function snap(main: NextHoldMain, holds: string[]): GhostSnap {
  const s: GhostSnap = {pos: main.getPosition() as RefPosition, selected: main.getSelectedLimb(), steps: [], rendered: {}}
  for (let n = 1; n <= 3; n++) s.steps.push(main.getGhostHold(n))
  for (const id of holds) s.rendered[id] = renderedRingColour(id, main)
  return s
}

function checkGhosts(main: NextHoldMain, s: GhostSnap, errs: string[], tag: string): string[] {
  const ref = makeReference()
  const want = ref.sequence(s.pos, s.selected as any)
  const ids = want.map((m) => m.holdId)
  print(`[N3] ${tag}: ${fmtPos(s.pos)}, selected ${s.selected}; look-ahead ${want.map((m, i) => `${i + 1}. ${m.limb}->${m.holdId}`).join("  ")}; ` +
    `shown ${s.steps.join(",")}`)
  if (want.length < 2) errs.push(`${tag}: reference look-ahead has only ${want.length} move(s); want 2-3`)
  for (let n = 1; n <= 3; n++) {
    const w = n <= ids.length ? ids[n - 1] : null
    if (s.steps[n - 1] !== w) errs.push(`${tag}: step ${n} shown on ${s.steps[n - 1]}, look-ahead says ${w}`)
  }
  for (const n of BADGE_STEPS) {
    const w = n <= ids.length
    if (mustFind("Ghost_" + n).enabled !== w || mustFind("GhostNumber_" + n).enabled !== w) errs.push(`${tag}: badge ${n} enabled ${mustFind("Ghost_" + n).enabled}, want ${w}`)
  }
  // the sequence path: glow -> 2 when step 2 is on another hold, 2 -> 3 when there is a step 3
  const wantPath = [ids.length >= 2 && ids[1] !== ids[0], ids.length >= 3]
  for (let n = 1; n <= 2; n++) {
    const on = mustFind("GhostPath_" + n).enabled
    if (on !== wantPath[n - 1]) errs.push(`${tag}: GhostPath_${n} enabled ${on}, want ${wantPath[n - 1]}`)
  }
  print(`[N3] ${tag}: ${checkBadgeAttribution(camera(), main, want, errs, tag)}`)
  print(`[N3] ${tag}: ${checkGhostNumbersClear(camera(), errs, tag, main)}`)
  return ids
}

@component
export class N3SequencePreviewScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const main = getMain()
    await restorePreset(main)
    const errs: string[] = []
    const problem = main.getProblemHolds()

    // ── at the preset: step 1 the glow, badges 2 and 3 ──
    const s0 = snap(main, problem)
    const ids0 = checkGhosts(main, s0, errs, "preset")
    const sug0 = main.getSuggestion()
    if (!sug0 || ids0[0] !== sug0.holdId) errs.push(`step 1 (${ids0[0]}) is not the suggested hold ${sug0 ? sug0.holdId : "none"}`)
    if (ids0.length !== 3) errs.push(`preset look-ahead has ${ids0.length} moves, want 3`)

    // light-coloured: every channel of the badge line and text is bright
    for (const n of BADGE_STEPS) {
      const rc = (mustFind("Ghost_" + n).getComponent("Component.RenderMeshVisual") as RenderMeshVisual).mainMaterial.mainPass.baseColor as vec4
      const tc = (mustFind("GhostNumber_" + n).getComponent("Component.Text") as Text).textFill.color
      if (Math.min(rc.x, rc.y, rc.z) < 0.75 || rc.w < 0.8) errs.push(`badge ${n} colour ${rc} is not light`)
      if (Math.min(tc.x, tc.y, tc.z) < 0.75) errs.push(`badge ${n} text colour ${tc} is not light`)
    }

    // ── a real pinch on the suggestion: badges and rings in the same frame ──
    const got = await pinchCapture("Hold_" + sug0!.holdId, () => snap(main, problem))
    if (!got.fired || !got.value) errs.push(`Hold_${sug0!.holdId} pinch did not fire`)
    else {
      const a = got.value
      const ids1 = checkGhosts(main, a, errs, "pinch frame")
      let changed = 0
      for (const id of problem) if (a.rendered[id] !== s0.rendered[id]) changed++
      if (changed === 0) errs.push("pinch frame: no main ring changed")
      if (ids1.join() === ids0.join()) errs.push("pinch frame: the look-ahead did not move on")
      // the look-ahead after following step 1 continues with what was step 2
      if (ids1[0] !== ids0[1]) errs.push(`after following step 1, the new step 1 is ${ids1[0]}, the old step 2 was ${ids0[1]}`)
    }

    // ── select another limb: step 1 follows that limb's glowing ring ──
    const other = main.getSelectedLimb() === "LF" ? "RF" : "LF"
    await pinch("Toggle_" + other)
    await frames(3)
    const s2 = snap(main, problem)
    checkGhosts(main, s2, errs, "after Toggle_" + other)
    const sug2 = main.getSuggestion()
    if (sug2 && main.getGhostHold(1) !== sug2.holdId) errs.push(`step 1 ${main.getGhostHold(1)} is not ${other}'s suggestion ${sug2.holdId}`)

    // ── setup mode: no badges ──
    await pinch("ModeSwitch")
    await frames(3)
    for (const n of BADGE_STEPS) {
      if (mustFind("Ghost_" + n).enabled || mustFind("GhostNumber_" + n).enabled) errs.push(`badge ${n} shows in setup mode`)
    }

    // ── forced layouts the preset rarely gives: the overlay is handed the state directly (test
    // setup, read in the same call), with the look-ahead the checks compare against ──
    await restorePreset(main)
    {
      const vis = (main as any).visuals
      const sug = main.getSuggestion()!
      const third = main.getGhostHold(2) !== sug.holdId ? main.getGhostHold(2)! : main.getGhostHold(3)!
      // a match: steps 2 and 3 on one hold, joined by an arc around it
      let want = [{limb: sug.limb, holdId: sug.holdId}, {limb: "LH", holdId: third}, {limb: "RH", holdId: third}]
      vis.apply({...vis.state, ghosts: want.map((m) => ({hold: m.holdId, limb: m.limb}))})
      let tag = `match ${third},${third}`
      const hold = mustFind("Hold_" + third).getTransform().getWorldPosition()
      const b2 = ghostBadge(2), b3 = ghostBadge(3)
      const gap = Math.hypot(Math.max(0, Math.abs(b2.c.x - b3.c.x) - b2.L - b3.L), b2.c.y - b3.c.y) - b2.R - b3.R
      if (gap < 0) errs.push(`${tag}: badges 2 and 3 overlap (${gap.toFixed(2)} cm)`)
      const dots = ghostPathDots(2)
      const r = dots.map((d) => Math.hypot(d.x - hold.x, d.y - hold.y))
      const edge = HOLD_SIZE[holdById(third)!.type].ringR + main.getRingLineWidth() / 2
      if (dots.length < 3) errs.push(`${tag}: GhostPath_2 has ${dots.length} dots`)
      else if (Math.max(...r) - Math.min(...r) > 0.3 || Math.min(...r) < edge) errs.push(`${tag}: GhostPath_2 is not an arc around Hold_${third}: dots ${Math.min(...r).toFixed(2)}-${Math.max(...r).toFixed(2)} cm from it (ring edge ${edge.toFixed(2)})`)
      print(`[N3] ${tag}: badges ${gap.toFixed(1)} cm apart, arc of ${dots.length} dots; ${checkBadgeAttribution(camera(), main, want, errs, tag)}; ${checkGhostNumbersClear(camera(), errs, tag, main)}`)

      // step 2 on the glowing hold (two limbs onto it in a row): badge 2 sits on the glow's outer ring
      want = [{limb: sug.limb, holdId: sug.holdId}, {limb: "LH", holdId: sug.holdId}, {limb: "RF", holdId: third}]
      vis.apply({...vis.state, ghosts: want.map((m) => ({hold: m.holdId, limb: m.limb}))})
      tag = `step 2 on the glow ${sug.holdId}`
      if (mustFind("GhostPath_1").enabled) errs.push(`${tag}: GhostPath_1 shows, but step 2 is on the glowing hold itself`)
      print(`[N3] ${tag}: ${checkBadgeAttribution(camera(), main, want, errs, tag)}; ${checkGhostNumbersClear(camera(), errs, tag, main)}`)
    }

    await restorePreset(main)
    expect(errs.length, "sequence-preview mismatches:\n" + errs.join("\n")).toBe(0)
  }
}
