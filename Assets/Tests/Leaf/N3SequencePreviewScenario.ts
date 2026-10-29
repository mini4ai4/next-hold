// Review item 3, "Sequence preview": the next 2-3 moves. Step 1 is the glowing
// suggestion with its label; after it, since session 15, the start of the cheapest
// secure route to the top, searched over every limb and hold. Steps 2 and 3 show as
// small badges pinned on their own hold's ring, naming the limb: "2 · LH", "3 · LF".
// They update in the same frame as the main rings. Each badge's outline wears its
// step's colour; a step onto a hold a limb is on now gets a ring in that colour, so
// no ring on the wall is white (session 15, item 3). Session 16: the ring of a hold
// a tag sits on wears the tag's colour too, so no tag disagrees with its ring (also
// forced: a green tag on a hold whose score ring is red).
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
  BADGE_STEPS, camera, checkBadgeAttribution, checkGhostNumbersClear, checkStepColours, classifyColour, fmtPos, frames, ghostBadge, ghostPathDots, getMain,
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

    // session 15: each badge's outline wears its step's colour (how secure that move is at its
    // turn, by the test's own search), its text stays light; and nothing on the wall is a white
    // ring: a step onto a hold a limb is on now (no score ring) gets a ring in that step's colour
    print(`[N3] preset colours: ${checkStepColours(main, s0.pos, s0.selected, errs, "preset")}`)
    for (const n of BADGE_STEPS) {
      const tc = (mustFind("GhostNumber_" + n).getComponent("Component.Text") as Text).textFill.color
      if (Math.min(tc.x, tc.y, tc.z) < 0.75) errs.push(`badge ${n} text colour ${tc} is not light`)
    }
    const occupiedStep = s0.steps.findIndex((id, i) => i > 0 && !!id && Object.keys(s0.pos).some((l) => s0.pos[l] === id))
    if (occupiedStep < 0) errs.push("precondition: no preset step goes onto a hold a limb is on now (the case the white ring was)")
    else if (!mustFind("GhostHoldRing_" + (occupiedStep + 1)).enabled) errs.push(`step ${occupiedStep + 1} is onto an occupied hold but has no ring`)

    // ── a real pinch on the suggestion: badges and rings in the same frame ──
    const got = await pinchCapture("Hold_" + sug0!.holdId, () => snap(main, problem))
    if (!got.fired || !got.value) errs.push(`Hold_${sug0!.holdId} pinch did not fire`)
    else {
      const a = got.value
      const ids1 = checkGhosts(main, a, errs, "pinch frame")
      print(`[N3] pinch frame colours: ${checkStepColours(main, a.pos, a.selected, errs, "pinch frame")}`)
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
      vis.apply({...vis.state, ghosts: want.map((m) => ({hold: m.holdId, limb: m.limb, colour: "green"}))})
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

      // session 16, the judge's picture: a green "2 · LH" on a hold whose score ring (the selected
      // limb's, from here) is red. The ring under the tag must take the tag's green
      const red = problem.filter((id) => id !== sug.holdId && mustFind("Ring_" + id).enabled && main.getHoldColour(id) === "red")[0]
      if (!red) errs.push("precondition: no red ring at the preset to put a green tag on")
      else {
        want = [{limb: sug.limb, holdId: sug.holdId}, {limb: "LH", holdId: red}]
        vis.apply({...vis.state, ghosts: [{hold: sug.holdId, limb: sug.limb, colour: "green"}, {hold: red, limb: "LH", colour: "green"}]})
        tag = `green tag on ${red} (score red)`
        const c = classifyColour((mustFind("Ring_" + red).getComponent("Component.RenderMeshVisual") as RenderMeshVisual).mainMaterial.mainPass.baseColor as vec4, main)
        if (c !== "green") errs.push(`${tag}: Ring_${red} renders ${c} under the green tag`)
        print(`[N3] ${tag}: Ring_${red} renders ${c}; ${checkBadgeAttribution(camera(), main, want, errs, tag)}`)
      }

      // step 2 on the glowing hold (two limbs onto it in a row): badge 2 sits on the glow's outer ring
      want = [{limb: sug.limb, holdId: sug.holdId}, {limb: "LH", holdId: sug.holdId}, {limb: "RF", holdId: third}]
      vis.apply({...vis.state, ghosts: want.map((m) => ({hold: m.holdId, limb: m.limb, colour: "green"}))})
      tag = `step 2 on the glow ${sug.holdId}`
      if (mustFind("GhostPath_1").enabled) errs.push(`${tag}: GhostPath_1 shows, but step 2 is on the glowing hold itself`)
      print(`[N3] ${tag}: ${checkBadgeAttribution(camera(), main, want, errs, tag)}; ${checkGhostNumbersClear(camera(), errs, tag, main)}`)
    }

    await restorePreset(main)
    expect(errs.length, "sequence-preview mismatches:\n" + errs.join("\n")).toBe(0)
  }
}
