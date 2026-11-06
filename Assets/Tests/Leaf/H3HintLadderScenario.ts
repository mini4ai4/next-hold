// Session 23, the hint ladder (v7 A2), on the wall with beta hidden, with real pinches on "?":
//   first: grip-coloured rings on the holds in reach, by the test's own rule; no glow, no word;
//   second: the glow and the one word for the next move; no 1-2-3;
//   third (session 24, the judges' fix 5): the next move's why-line, at once, in the pinch's own frame; nothing
//   armed, no pinch on a ring; a fourth "?" shows it again; then a pinch on a hold is a move.
// Session 24 also: the dots on "?" (○○○ ●○○ ●●○ ●●●), and hints this go (rungs 2 and 3, once each).
// A move ends the hint: the next position starts from nothing. From the mats the ladder works too, and
// the outlines stay on the holds it hasn't ringed.

import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {NextHoldMain} from "../../Scripts/NextHoldMain"
import {HOLDS, HOLD_SIZE, holdById} from "../../Scripts/Wall/WallLayout"
import {
  LIMB_WORDS, camera, checkNothingRevealed, fmtBox, fmtPos, frames, getMain, makeReference, mustFind, pinch, pinchCapture, presetTypes,
  renderedOuterRadius, renderedRingColour, renderedStyle, restorePreset, samePosition, screenBoxOf, STYLE_FOR,
} from "./NextHoldTestKit"
import {RefPosition} from "./NextHoldReferenceRule"

/** the holds in reach from here, by the test's own rule: a limb's reach factor isn't 0 */
function inReach(main: NextHoldMain): {id: string; colour: string}[] {
  const pos = main.getPosition() as RefPosition
  return makeReference(main.getHeightCm()).perHold(pos).filter((r) => r.reachFactor > 0).map((r) => ({id: r.holdId, colour: r.colour}))
}

/** step 1 or 2 as drawn: exactly the in-reach holds ringed, each in the rule's colour and its style */
function checkRings(main: NextHoldMain, errs: string[], tag: string): string[] {
  const want = inReach(main)
  const ids = want.map((w) => w.id)
  for (const h of HOLDS) {
    if (mustFind("Ring_" + h.id).enabled !== (ids.indexOf(h.id) >= 0)) errs.push(`${tag}: Ring_${h.id} shown ${mustFind("Ring_" + h.id).enabled}, in reach ${ids.indexOf(h.id) >= 0}`)
  }
  for (const w of want) {
    const rc = renderedRingColour(w.id, main)
    if (rc !== w.colour) errs.push(`${tag}: Ring_${w.id} renders ${rc}, rule ${w.colour}`)
    if (renderedStyle("Ring_" + w.id) !== STYLE_FOR[w.colour]) errs.push(`${tag}: Ring_${w.id} is ${w.colour} but draws ${renderedStyle("Ring_" + w.id)}`)
  }
  return ids
}

/** Session 26, the test's own statement of rung 3's words: the glow's hold type, then the one reason that matters
 *  most: the top; saves a move (the plan overrode the greedy best); high step; a stretch; committing; in reach. */
function whyWords(main: NextHoldMain, pos: RefPosition): string {
  const p = makeReference(main.getHeightCm()).plan(pos)
  const g = p.glow!
  const top = main.getTopHold()
  const reason = g.holdId === top && (g.limb === "LH" || g.limb === "RH") ? "the top"
    : p.planned ? "saves a move"
    : g.highStep < 1 ? "high step"
    : g.reachFactor < 1 ? "a stretch"
    : g.balanceFactor < 1 ? "committing"
    : "in reach"
  return `${presetTypes()[g.holdId] || "hold"}, ${reason}`
}

/** Session 26 (shot 06: the why plate sat on a start hold's outline): the label, with its why, covers no hold of the
 *  problem (ring, outline or marker: the hold's ring circle) other than its own, and not the glow, on screen. */
function checkLabelClear(main: NextHoldMain, cam: Camera, errs: string[], tag: string): string {
  const box = screenBoxOf("SuggestLabel", cam)
  if (!box) { errs.push(`${tag}: the label doesn't render`); return "no label" }
  const sug = main.getSuggestion()
  const line = main.getRingLineWidth()
  const hits: string[] = []
  const clearOf = (c: vec3, r: number) => {
    const s = cam.worldSpaceToScreenSpace(c), e = cam.worldSpaceToScreenSpace(c.add(new vec3(r, 0, 0)))
    const rx = Math.abs(e.x - s.x)
    const dx = Math.max(box.x0 - s.x, 0, s.x - box.x1) * cam.aspect, dy = Math.max(box.y0 - s.y, 0, s.y - box.y1)
    return Math.hypot(dx, dy) - rx * cam.aspect
  }
  let least = 1e9
  for (const id of main.getProblemHolds()) {
    if (sug && id === sug.holdId) continue
    const g = clearOf(main.getHoldWorldPosition(id)!, HOLD_SIZE[holdById(id)!.type].ringR + line / 2)
    least = Math.min(least, g)
    if (g < 0) hits.push(id)
  }
  if (sug) {
    const glow = mustFind("SuggestGlow")
    const g = clearOf(glow.getTransform().getWorldPosition(), renderedOuterRadius("SuggestGlow"))
    if (g < 0) hits.push("its own glow")
  }
  if (hits.length) errs.push(`${tag}: the label "${main.getLabelText().replace("\n", " / ")}" (${fmtBox(box)}) covers ${hits.join(", ")}`)
  return `label ${fmtBox(box)}, nearest other hold ${least.toFixed(3)} frame heights clear`
}

@component
export class H3HintLadderScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const main = getMain()
    await restorePreset(main, false)
    const errs: string[] = []
    const so = global.scene.createSceneObject("LadderCam")
    const cam = so.createComponent("Component.Camera") as Camera
    try {
      cam.devicePropertyUsage = Camera.DeviceProperty.None
      cam.renderLayer = LayerSet.makeUnique()
      const face = mustFind("Hold_lh").getTransform().getWorldPosition()
      const eye = camera().getSceneObject().getTransform().getWorldPosition()
      const at = async (cm: number) => {
        so.getTransform().setWorldPosition(new vec3(eye.x, eye.y, face.z + cm))
        await frames(3)
      }
      await at(60)
      main.setSizingCamera(cam)
      await frames(3)
      if (main.getView() !== "wall") errs.push(`setup: the view is ${main.getView()}`)
      checkNothingRevealed(main, errs, "before any hint")
      if (main.getAskDots() !== "○○○" || main.getAskWord() !== "Hint") errs.push(`before any hint: dots "${main.getAskDots()}", word "${main.getAskWord()}"`)
      const pos0 = main.getPosition() as RefPosition

      // ── first pinch: options, no answer, in the pinch's own frame ──
      const one: string[] = []
      const p1 = await pinchCapture("AskButton", () => { const r = checkRings(main, one, "step 1, pinch frame"); return {r, armed: main.isAskArmed(), step: main.getHintStep()} })
      errs.push(...one)
      if (!p1.fired || !p1.value || p1.value.step !== 1 || p1.value.armed) errs.push(`step 1: ${JSON.stringify(p1.value)}`)
      await frames(2)
      if (main.getAskDots() !== "●○○" || main.getHintsThisGo() !== 1 || main.getAskWord() !== "Move") errs.push(`step 1: dots "${main.getAskDots()}", hints ${main.getHintsThisGo()} (session 26: rung 1 is a hint), word "${main.getAskWord()}"`)
      const ids = checkRings(main, errs, "step 1")
      checkNothingRevealed(main, errs, "step 1", ids)
      const colours: {[c: string]: number} = {}
      for (const w of inReach(main)) colours[w.colour] = (colours[w.colour] || 0) + 1
      print(`[H3] step 1: rings on ${ids.join(", ")} (${JSON.stringify(colours)}); out of reach, no ring: ${main.getProblemHolds().filter((id) => ids.indexOf(id) < 0).join(", ")}`)
      if (ids.length < 3) errs.push(`step 1 rings only ${ids.length} holds: this proves little`)
      if (ids.length >= main.getProblemHolds().length - 4) errs.push("every free hold is in reach at the preset: this doesn't show the filter")
      if (ids.indexOf("h20") >= 0) errs.push("the top hold, out of reach, got a ring")

      // ── second pinch: the glow and the word; the rings stay; still no 1-2-3 ──
      await pinch("AskButton"); await frames(2)
      const sug = main.getSuggestion()!
      if (main.getHintStep() !== 2 || main.isAskArmed()) errs.push(`step 2: step ${main.getHintStep()}, armed ${main.isAskArmed()}`)
      if (!main.isRingGlowing(sug.holdId) || !mustFind("SuggestGlow").enabled) errs.push(`step 2: the glow isn't on ${sug.holdId}`)
      if (!main.isLabelVisible() || main.getLabelText() !== sug.label) errs.push(`step 2: label "${main.getLabelText()}" shown ${main.isLabelVisible()}, want "${sug.label}"`)
      checkRings(main, errs, "step 2")
      if (main.getLitLimb() !== sug.limb) errs.push(`step 2: lit ${main.getLitLimb()}, the word names ${sug.limb}`)
      if (main.getPreview().length || mustFind("Ghost_2").enabled || mustFind("GhostNumber_2").enabled) errs.push("step 2: the 1-2-3 shows")
      if (mustFind("Figure_Head").enabled) errs.push("step 2: the stick figure shows")
      print(`[H3] step 2: glow on ${sug.holdId}, "${main.getLabelText()}"`)
      if (main.getAskDots() !== "●●○" || main.getHintsThisGo() !== 2) errs.push(`step 2: dots "${main.getAskDots()}", hints ${main.getHintsThisGo()}`)
      if (!samePosition(main.getPosition() as RefPosition, pos0)) errs.push("the ladder moved a limb")

      if (main.getAskWord() !== "Why") errs.push(`step 2: the word under "?" is "${main.getAskWord()}", want Why`)

      // ── third pinch (session 26): why the move works, under its label ("R hand" / "jug, in reach"), in the pinch's
      //    own frame; no why plate, nothing armed, no pinch on a ring ──
      const wantLabel = LIMB_WORDS[sug.limb] + "\n" + whyWords(main, pos0)
      const p3 = await pinchCapture("AskButton", () => ({step: main.getHintStep(), armed: main.isAskArmed(), plate: main.isWhyVisible(), label: main.getLabelText(), shown: main.isLabelVisible()}))
      await frames(2)
      print(`[H3] step 3: in the pinch frame ${JSON.stringify(p3.value)} (the test's words "${wantLabel.replace("\n", " / ")}"); dots "${main.getAskDots()}", hints this go ${main.getHintsThisGo()}`)
      if (!p3.value || p3.value.step !== 3 || p3.value.armed || p3.value.plate || p3.value.label !== wantLabel || !p3.value.shown) errs.push(`step 3: ${JSON.stringify(p3.value)}, want the label "${wantLabel}", no plate, not armed`)
      if (mustFind("WhyLine").enabled || main.isAskLit()) errs.push(`step 3: a why plate drawn ${mustFind("WhyLine").enabled}, "?" lit ${main.isAskLit()}`)
      // placed for the wearer's eye, so measured with the real eye on the wall: the pose d1 films On wall at, square
      // in front of "up", 70 cm out (the sizing camera keeps the view On wall meanwhile)
      {
        const eyeSo = camera().getSceneObject(), tr = eyeSo.getTransform()
        const tracking = eyeSo.getComponent("Component.DeviceTracking") as DeviceTracking
        const was = tracking ? tracking.enabled : true
        const p0 = tr.getWorldPosition(), r0 = tr.getWorldRotation()
        try {
          if (tracking) tracking.enabled = false
          tr.setWorldPosition(new vec3(9.5, 0, -55))
          tr.setWorldRotation(quat.angleAxis(18.9 * Math.PI / 180, vec3.right()))
          await frames(3)
          await pinch("AskButton"); await frames(3) // step 3 again (a repeat isn't another hint): placed from here
          print(`[H3] step 3 from the wall, 70 cm: ${checkLabelClear(main, camera(), errs, "step 3, eye on the wall")}`)
          // and it is read, so it is in view (s26's first run had it past the frame's bottom edge)
          const lb = screenBoxOf("SuggestLabel", camera())
          if (!lb || lb.x0 < 0 || lb.x1 > 1 || lb.y0 < 0 || lb.y1 > 1) errs.push(`step 3, eye on the wall: the label isn't fully in view (${fmtBox(lb)})`)
        } finally {
          tr.setWorldPosition(p0)
          tr.setWorldRotation(r0)
          if (tracking) tracking.enabled = was
          await frames(3)
        }
      }
      if (!samePosition(main.getPosition() as RefPosition, pos0)) errs.push("the why moved a limb")
      if (main.getMovesMade() !== 0) errs.push(`the ladder counted ${main.getMovesMade()} moves`)
      // the dots: one per rung; session 26: hints this go: every rung, a repeat isn't another
      if (main.getAskDots() !== "●●●") errs.push(`step 3: dots "${main.getAskDots()}"`)
      await pinch("AskButton"); await frames(2)
      if (main.getHintStep() !== 3 || main.isAskArmed() || main.getLabelText() !== wantLabel || main.getHintsThisGo() !== 3) errs.push(`a fourth "?": step ${main.getHintStep()}, armed ${main.isAskArmed()}, label "${main.getLabelText()}", hints ${main.getHintsThisGo()}`)

      // ── back to normal: the next pinch moves, and the move ends the hint ──
      await pinch("Hold_" + sug.holdId); await frames(2)
      const pos1 = main.getPosition() as RefPosition
      if (pos1[sug.limb] !== sug.holdId) errs.push(`after the ladder a pinch on ${sug.holdId} didn't move ${sug.limb}: ${fmtPos(pos1)}`)
      if (main.getHintStep() !== 0 || main.getAskDots() !== "○○○" || main.getAskWord() !== "Hint" || main.isWhyVisible()) errs.push(`after a move: hint step ${main.getHintStep()}, dots "${main.getAskDots()}", word "${main.getAskWord()}", why ${main.isWhyVisible()}`)
      checkNothingRevealed(main, errs, "after the move")

      // ── from the mats: the rings replace the outlines only on the holds in reach ──
      await restorePreset(main, false)
      await at(250)
      await frames(3)
      await pinch("AskButton"); await frames(2)
      const ground = checkRings(main, errs, "Ground, step 1")
      for (const id of main.getProblemHolds()) {
        const want = ground.indexOf(id) < 0
        if (main.isOutlineVisible(id) !== want) errs.push(`Ground, step 1: ${id}: outline ${main.isOutlineVisible(id)}, want ${want}`)
      }
      if (main.getTagText("lh") !== "START" || main.getTagText("h20") !== "TOP") errs.push(`Ground, step 1: tags ${main.getTagText("lh")}, ${main.getTagText("h20")}`)
      print(`[H3] Ground, step 1: rings ${ground.join(", ")}, the rest outlined`)
      // session 26, the shot-06 case from the mats: rung 3's words sit clear of every outline (the preview's eye)
      await pinch("AskButton"); await frames(2)
      await pinch("AskButton"); await frames(3)
      if (main.getHintStep() !== 3 || main.isWhyVisible()) errs.push(`Ground, step 3: step ${main.getHintStep()}, a why plate ${main.isWhyVisible()}`)
      print(`[H3] Ground, step 3: "${main.getLabelText().replace("\n", " / ")}"; ${checkLabelClear(main, camera(), errs, "Ground, step 3")}`)
    } finally {
      main.setSizingCamera(null)
      so.destroy()
    }
    await restorePreset(main)
    expect(errs.length, "the hint ladder:\n" + errs.join("\n")).toBe(0)
  }
}
