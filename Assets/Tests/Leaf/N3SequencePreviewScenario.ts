// Review item 3, "Sequence preview": a small look-ahead over bestMove gives the
// next 2-3 moves; they show as small numbered ghost rings (1, 2, 3) on those
// holds, light-coloured for the additive display, and they update in the same
// frame as the main rings.
// Every number stays readable: no glow ring and no other badge covers it on
// screen, and a dotted path joins 1 -> 2 -> 3 under the badges (an arc around
// the hold when two moves share one, checked on a forced match).
// Input path: real SIK pinches on Hold_<id>, Toggle_<limb>, ModeSwitch. The
// expected look-ahead comes from the test's own port (NextHoldReferenceRule).

import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {HOLD_SIZE, holdById} from "../../Scripts/Wall/WallLayout"
import {GLOW_PROFILE} from "../../Scripts/Wall/ProceduralTextures"
import {NextHoldMain} from "../../Scripts/NextHoldMain"
import {camera, checkGhostNumbersClear, fmtPos, frames, ghostBadgeRadius, ghostPathDots, getMain, makeReference, mustFind, pinch, pinchCapture, planeDistanceToHold, renderedRingColour, restorePreset} from "./NextHoldTestKit"
import {RefPosition} from "./NextHoldReferenceRule"

interface GhostSnap {
  pos: RefPosition
  selected: string
  ghosts: {hold: string | null; on: boolean; numberOn: boolean; number: string; dist: number}[]
  rendered: {[id: string]: string | null}
}

function snap(main: NextHoldMain, holds: string[]): GhostSnap {
  const s: GhostSnap = {pos: main.getPosition() as RefPosition, selected: main.getSelectedLimb(), ghosts: [], rendered: {}}
  for (let n = 1; n <= 3; n++) {
    const ring = mustFind("Ghost_" + n)
    const num = mustFind("GhostNumber_" + n)
    const hold = main.getGhostHold(n)
    s.ghosts.push({
      hold, on: ring.enabled, numberOn: num.enabled,
      number: (num.getComponent("Component.Text") as Text).text,
      dist: hold ? planeDistanceToHold(ring, hold) : -1,
    })
  }
  for (const id of holds) s.rendered[id] = renderedRingColour(id, main)
  return s
}

function checkGhosts(main: NextHoldMain, s: GhostSnap, errs: string[], tag: string): string[] {
  const ref = makeReference()
  const want = ref.sequence(s.pos, s.selected as any)
  const ids = want.map((m) => m.holdId)
  print(`[N3] ${tag}: ${fmtPos(s.pos)}, selected ${s.selected}; look-ahead ${want.map((m, i) => `${i + 1}. ${m.limb}->${m.holdId}`).join("  ")}; ` +
    `ghosts ${s.ghosts.map((g) => g.hold).join(",")}`)
  if (want.length < 2) errs.push(`${tag}: reference look-ahead has only ${want.length} move(s); want 2-3`)
  for (let n = 1; n <= 3; n++) {
    const g = s.ghosts[n - 1]
    const w = n <= ids.length ? ids[n - 1] : null
    if (g.hold !== w) errs.push(`${tag}: ghost ${n} on ${g.hold}, look-ahead says ${w}`)
    if (g.on !== !!w || g.numberOn !== !!w) errs.push(`${tag}: ghost ${n} ring/number enabled ${g.on}/${g.numberOn}, want ${!!w}`)
    if (w && g.number !== "" + n) errs.push(`${tag}: ghost ${n} reads "${g.number}"`)
    if (w) {
      // a badge beside the hold: its circle outside the ring's line, and no further out than one
      // badge past the glow's outer ring (where a badge that overlapped the glow is moved to),
      // all as drawn in this view (Ground draws them larger to read from further back)
      const rb = ghostBadgeRadius(n)
      const edge = HOLD_SIZE[holdById(w)!.type].ringR + main.getRingLineWidth() / 2
      const far = edge + (GLOW_PROFILE.ringAt + GLOW_PROFILE.ringW + 1.0) * main.getLabelScale() + 2 * rb + 1
      if (g.dist < edge + rb || g.dist > far) errs.push(`${tag}: ghost ${n} is ${g.dist.toFixed(1)} cm from Hold_${w} (want ${(edge + rb).toFixed(1)}-${far.toFixed(1)})`)
    }
  }
  // the sequence path: a dotted line from each shown ghost to the next, none past the last
  for (let n = 1; n <= 2; n++) {
    const want = n < ids.length && n < 3
    const on = mustFind("GhostPath_" + n).enabled
    if (on !== want) errs.push(`${tag}: GhostPath_${n} (ghost ${n} -> ${n + 1}) enabled ${on}, want ${want}`)
  }
  print(`[N3] ${tag}: ${checkGhostNumbersClear(camera(), errs, tag)}`)
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

    // ── at the preset: three ghosts, 1 on the suggestion ──
    const s0 = snap(main, problem)
    const ids0 = checkGhosts(main, s0, errs, "preset")
    const sug0 = main.getSuggestion()
    if (!sug0 || ids0[0] !== sug0.holdId) errs.push(`ghost 1 (${ids0[0]}) is not on the suggested hold ${sug0 ? sug0.holdId : "none"}`)
    if (ids0.length !== 3) errs.push(`preset look-ahead has ${ids0.length} moves, want 3`)

    // light-coloured: every channel of the ghost ring and number is bright
    for (let n = 1; n <= 3; n++) {
      const rc = (mustFind("Ghost_" + n).getComponent("Component.RenderMeshVisual") as RenderMeshVisual).mainMaterial.mainPass.baseColor as vec4
      const tc = (mustFind("GhostNumber_" + n).getComponent("Component.Text") as Text).textFill.color
      if (Math.min(rc.x, rc.y, rc.z) < 0.75 || rc.w < 0.8) errs.push(`ghost ${n} ring colour ${rc} is not light`)
      if (Math.min(tc.x, tc.y, tc.z) < 0.75) errs.push(`ghost ${n} number colour ${tc} is not light`)
    }

    // ── a real pinch on the suggestion: ghosts and rings in the same frame ──
    const got = await pinchCapture("Hold_" + sug0!.holdId, () => snap(main, problem))
    if (!got.fired || !got.value) errs.push(`Hold_${sug0!.holdId} pinch did not fire`)
    else {
      const a = got.value
      const ids1 = checkGhosts(main, a, errs, "pinch frame")
      // the main rings changed in that same frame
      let changed = 0
      for (const id of problem) if (a.rendered[id] !== s0.rendered[id]) changed++
      if (changed === 0) errs.push("pinch frame: no main ring changed")
      if (ids1.join() === ids0.join()) errs.push("pinch frame: the ghosts did not move on")
      // the look-ahead after following ghost 1 continues with what was ghost 2
      if (ids1[0] !== ids0[1]) errs.push(`after following ghost 1, the new ghost 1 is ${ids1[0]}, the old ghost 2 was ${ids0[1]}`)
    }

    // ── select another limb: ghost 1 follows that limb's glowing ring ──
    const other = main.getSelectedLimb() === "LF" ? "RF" : "LF"
    await pinch("Toggle_" + other)
    await frames(3)
    const s2 = snap(main, problem)
    checkGhosts(main, s2, errs, "after Toggle_" + other)
    const sug2 = main.getSuggestion()
    if (sug2 && main.getGhostHold(1) !== sug2.holdId) errs.push(`ghost 1 ${main.getGhostHold(1)} is not on ${other}'s suggestion ${sug2.holdId}`)

    // ── setup mode: no ghosts ──
    await pinch("ModeSwitch")
    await frames(3)
    for (let n = 1; n <= 3; n++) {
      if (mustFind("Ghost_" + n).enabled || mustFind("GhostNumber_" + n).enabled) errs.push(`ghost ${n} shows in setup mode`)
    }

    // ── a match: moves 1 and 2 on the same (glowing) hold. The look-ahead rarely gives one from the
    // preset, so the overlay is handed that state directly (test setup, read in the same call) ──
    await restorePreset(main)
    {
      const vis = (main as any).visuals
      const sug = main.getSuggestion()!.holdId
      const third = main.getGhostHold(2) !== sug ? main.getGhostHold(2)! : main.getGhostHold(3)!
      vis.apply({...vis.state, ghosts: [sug, sug, third]})
      const tag = `match ${sug},${sug},${third}`
      const hold = mustFind("Hold_" + sug).getTransform().getWorldPosition()
      const rb = ghostBadgeRadius(1)
      const c1 = mustFind("GhostNumber_1").getTransform().getWorldPosition(), c2 = mustFind("GhostNumber_2").getTransform().getWorldPosition()
      const apart = Math.hypot(c1.x - c2.x, c1.y - c2.y)
      if (apart < 2 * rb) errs.push(`${tag}: badges 1 and 2 overlap (${apart.toFixed(1)} cm apart, badge r ${rb.toFixed(2)})`)
      // the path between them is an arc around the hold: every dot the same distance from it, outside its ring
      const dots = ghostPathDots(1)
      const r = dots.map((d) => Math.hypot(d.x - hold.x, d.y - hold.y))
      const edge = HOLD_SIZE[holdById(sug)!.type].ringR + main.getRingLineWidth() / 2
      if (dots.length < 3) errs.push(`${tag}: GhostPath_1 has ${dots.length} dots`)
      else if (Math.max(...r) - Math.min(...r) > 0.3 || Math.min(...r) < edge) errs.push(`${tag}: GhostPath_1 is not an arc around Hold_${sug}: dots ${Math.min(...r).toFixed(2)}-${Math.max(...r).toFixed(2)} cm from it (ring edge ${edge.toFixed(2)})`)
      print(`[N3] ${tag}: badges ${apart.toFixed(1)} cm apart, arc of ${dots.length} dots at ${dots.length ? Math.min(...r).toFixed(2) : "-"} cm; ${checkGhostNumbersClear(camera(), errs, tag)}`)
    }

    await restorePreset(main)
    expect(errs.length, "sequence-preview mismatches:\n" + errs.join("\n")).toBe(0)
  }
}
