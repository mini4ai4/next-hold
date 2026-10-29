// Done criterion 4: the single suggested hold glows with the limb label
// ("R hand"), the label fades after about 2 s; if the hold is outside the
// view an arrow appears at that edge (and is hidden while it's in view).
// Input path: real SIK pinches on Toggle_<limb> and Hold_<id>. In-view is
// decided independently with Camera.isSphereVisible on the scene camera.

import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {HOLDS, HOLD_SIZE, holdById} from "../../Scripts/Wall/WallLayout"
import {NextHoldMain} from "../../Scripts/NextHoldMain"
import {
  LIMB_WORDS, camera, fmtPos, frames, getMain, makeReference, mustFind, pinch, pinchCapture,
  planeDistanceToHold, presetProblem, restorePreset,
} from "./NextHoldTestKit"
import {RefPosition} from "./NextHoldReferenceRule"

function labelText(): string {
  const t = mustFind("SuggestLabel").getComponent("Component.Text") as Text
  return t ? t.text : ""
}

function checkGlow(main: NextHoldMain, holdId: string, errs: string[], tag: string): void {
  for (const h of HOLDS) {
    const g = main.isRingGlowing(h.id)
    if (h.id === holdId && !g) errs.push(`${tag}: suggested hold ${holdId} is not glowing`)
    if (h.id !== holdId && g) errs.push(`${tag}: ${h.id} glows but is not the suggestion`)
  }
  const glow = mustFind("SuggestGlow")
  if (!glow.enabled) errs.push(`${tag}: SuggestGlow hidden`)
  const d = planeDistanceToHold(glow, holdId)
  if (d > 1) errs.push(`${tag}: SuggestGlow is ${d.toFixed(1)} cm from Hold_${holdId}`)
}

function holdInView(holdId: string): boolean {
  const def = holdById(holdId)
  const r = def ? HOLD_SIZE[def.type].ringR : 9
  return camera().isSphereVisible(mustFind("Hold_" + holdId).getTransform().getWorldPosition(), r)
}

@component
export class C4SuggestionScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const main = getMain()
    await restorePreset(main)
    const ref = makeReference()
    const errs: string[] = []

    // ── suggestion at open: glow + label ──
    const pos0 = main.getPosition() as RefPosition
    const best0 = ref.bestMove(pos0)!
    const sug0 = main.getSuggestion()
    if (!sug0 || sug0.holdId !== best0.holdId || sug0.limb !== best0.limb) {
      errs.push(`open: Lens suggests ${sug0 ? sug0.limb + "->" + sug0.holdId : "none"}, reference ${best0.limb}->${best0.holdId}`)
    }
    checkGlow(main, best0.holdId, errs, "open")

    // let the label from the restore fade first, so a visible label in the pinch frame proves the re-show
    await sleep(2600)
    if (main.isLabelVisible()) errs.push("label from the restore still visible after 2.6 s")
    // re-show the label with a real pinch on the selected limb's toggle, and time its fade
    const shown = await pinchCapture("Toggle_" + main.getSelectedLimb(),
      () => ({op: main.getLabelOpacity(), on: mustFind("SuggestLabel").enabled, text: labelText()}))
    if (!shown.fired || !shown.value) errs.push("Toggle pinch did not fire")
    else {
      print(`[C4] pinch frame: label "${shown.value.text}" opacity ${shown.value.op.toFixed(2)} enabled ${shown.value.on}`)
      if (shown.value.op < 0.99 || !shown.value.on) errs.push(`label not fully visible in the pinch frame (opacity ${shown.value.op})`)
      if (shown.value.text !== LIMB_WORDS[best0.limb]) errs.push(`pinch-frame label "${shown.value.text}"`)
    }
    const t0 = shown.time
    await frames(1)
    const early = getTime() - t0
    if (labelText() !== LIMB_WORDS[best0.limb]) errs.push(`label text "${labelText()}", want "${LIMB_WORDS[best0.limb]}"`)
    if (main.getLabelText() !== LIMB_WORDS[best0.limb]) errs.push(`getLabelText "${main.getLabelText()}"`)
    if (!mustFind("SuggestLabel").enabled || main.getLabelOpacity() < 0.99) errs.push(`label not fully visible ${early.toFixed(2)} s after the pinch (opacity ${main.getLabelOpacity()})`)
    const labelD = planeDistanceToHold(mustFind("SuggestLabel"), best0.holdId)
    if (labelD > 20) errs.push(`label is ${labelD.toFixed(1)} cm from the suggested hold`)

    await sleep(Math.max(0, (t0 + 1.2 - getTime()) * 1000))
    const op12 = main.getLabelOpacity()
    await sleep(Math.max(0, (t0 + 1.8 - getTime()) * 1000))
    const op18 = main.getLabelOpacity()
    await sleep(Math.max(0, (t0 + 2.5 - getTime()) * 1000))
    const op25 = main.getLabelOpacity()
    const on25 = mustFind("SuggestLabel").enabled
    print(`[C4] label "${labelText()}" opacity: ${early.toFixed(2)}s 1.00, 1.2s ${op12.toFixed(2)}, 1.8s ${op18.toFixed(2)}, 2.5s ${op25.toFixed(2)} (object enabled ${on25})`)
    if (op12 < 0.99) errs.push(`label already fading at 1.2 s (opacity ${op12.toFixed(2)})`)
    if (on25 || op25 > 0.01 || main.isLabelVisible()) errs.push(`label still visible at 2.5 s (opacity ${op25.toFixed(2)})`)
    // glow stays after the label fades
    checkGlow(main, best0.holdId, errs, "after fade")

    // ── suggestion in view at open: no arrow ──
    await frames(2)
    const inView0 = holdInView(best0.holdId)
    print(`[C4] open suggestion ${best0.holdId} in view (camera.isSphereVisible): ${inView0}; arrow ${main.isOffViewArrowVisible()}`)
    if (!inView0) errs.push(`setup: open suggestion ${best0.holdId} is not in view per the camera`)
    if (main.isOffViewArrowVisible() || mustFind("OffViewArrowMesh").enabled) errs.push("arrow visible while the suggestion is in view")

    // ── make an out-of-view hold the suggestion: the shortest run of moves within the problem
    //    (up to three) after which the reference's best move is a hold the camera can't see.
    //    Since the marked problem and the upward goal no single move does it (before them it
    //    was RF -> h15, which is not in the problem) ──
    print(`[C4] problem holds out of view: ${presetProblem().filter((id) => !holdInView(id)).join(",") || "none"}`)
    type Step = {limb: string; holdId: string}
    let path: Step[] | null = null
    let frontier: {pos: RefPosition; steps: Step[]}[] = [{pos: pos0, steps: []}]
    const seen: {[k: string]: boolean} = {[fmtPos(pos0)]: true}
    for (let depth = 0; depth < 3 && !path; depth++) {
      const next: {pos: RefPosition; steps: Step[]}[] = []
      for (const node of frontier) {
        for (const l of ["RF", "LF", "RH", "LH"]) {
          for (const r of ref.evaluate(l as any, node.pos).results) {
            const pos = {...node.pos, [l]: r.holdId} as RefPosition
            const k = fmtPos(pos)
            if (seen[k]) continue
            seen[k] = true
            const steps = node.steps.concat([{limb: l, holdId: r.holdId}])
            const b = ref.bestMove(pos)
            if (b && !holdInView(b.holdId)) { path = steps; break }
            next.push({pos, steps})
          }
          if (path) break
        }
        if (path) break
      }
      frontier = next
    }
    if (!path) {
      errs.push("setup: no run of up to three moves inside the problem leads to an off-view suggestion")
      expect(errs.length, "criterion 4 mismatches:\n" + errs.join("\n")).toBe(0)
      return
    }
    const moves = path.map((s) => s.limb + "->" + s.holdId).join(", ")
    for (const s of path) {
      await pinch("Toggle_" + s.limb)
      await frames(2)
      await pinch("Hold_" + s.holdId)
      await frames(3) // the arrow updates one frame after a change
    }
    const pos1 = main.getPosition() as RefPosition
    const best1 = ref.bestMove(pos1)!
    const sug1 = main.getSuggestion()
    print(`[C4] after ${moves}: Lens suggests ${sug1 ? sug1.limb + "->" + sug1.holdId : "none"}, reference ${best1.limb}->${best1.holdId}`)
    for (const s of path) if (pos1[s.limb] !== s.holdId && path.filter((o) => o.limb === s.limb).pop() === s) {
      errs.push(`${s.limb} did not move to ${s.holdId} (${pos1[s.limb]})`)
    }
    if (!sug1 || sug1.holdId !== best1.holdId || sug1.limb !== best1.limb) errs.push(`off-view: Lens suggestion differs from reference`)
    checkGlow(main, best1.holdId, errs, "off-view")
    if (labelText() !== LIMB_WORDS[best1.limb]) errs.push(`off-view label "${labelText()}", want "${LIMB_WORDS[best1.limb]}"`)
    const inView1 = holdInView(best1.holdId)
    if (inView1) errs.push(`setup: new suggestion ${best1.holdId} is still in view; cannot test the arrow`)
    const arrowSO = mustFind("OffViewArrowMesh")
    if (!main.isOffViewArrowVisible() || !arrowSO.enabled) errs.push(`arrow hidden while suggestion ${best1.holdId} is out of view`)
    else {
      // at the edge nearest the hold: the arrow sits on the hold's side of the view
      const camT = mustFind("Camera Object").getTransform()
      const a = camT.getInvertedWorldTransform().multiplyPoint(arrowSO.getTransform().getWorldPosition())
      const h = camT.getInvertedWorldTransform().multiplyPoint(mustFind("Hold_" + best1.holdId).getTransform().getWorldPosition())
      const aInView = camera().isSphereVisible(arrowSO.getTransform().getWorldPosition(), 0.5)
      print(`[C4] arrow camera-local (${a.x.toFixed(1)}, ${a.y.toFixed(1)}, ${a.z.toFixed(1)}), hold (${h.x.toFixed(1)}, ${h.y.toFixed(1)}, ${h.z.toFixed(1)}), arrow in view ${aInView}`)
      if (!aInView) errs.push("arrow itself is outside the view")
      // (the hold may be off the side as well as below, so compare directions in the view plane)
      const ha = Math.atan2(h.y / -h.z, h.x / -h.z), aa = Math.atan2(a.y / -a.z, a.x / -a.z)
      let dAng = Math.abs(ha - aa)
      if (dAng > Math.PI) dAng = 2 * Math.PI - dAng
      if (dAng > Math.PI / 3) errs.push(`arrow points ${(dAng * 180 / Math.PI).toFixed(0)} deg away from the hold's side of the view`)
    }

    expect(errs.length, "criterion 4 mismatches:\n" + errs.join("\n")).toBe(0)
  }
}
