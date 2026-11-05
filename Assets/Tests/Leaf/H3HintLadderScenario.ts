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
import {HOLDS} from "../../Scripts/Wall/WallLayout"
import {camera, checkNothingRevealed, checkWhyAgrees, expectedWhy, fmtPos, frames, getMain, makeReference, mustFind, pinch, pinchCapture, renderedRingColour, renderedStyle, restorePreset, samePosition, STYLE_FOR} from "./NextHoldTestKit"
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
      if (main.getAskDots() !== "○○○") errs.push(`before any hint: dots "${main.getAskDots()}"`)
      const pos0 = main.getPosition() as RefPosition

      // ── first pinch: options, no answer, in the pinch's own frame ──
      const one: string[] = []
      const p1 = await pinchCapture("AskButton", () => { const r = checkRings(main, one, "step 1, pinch frame"); return {r, armed: main.isAskArmed(), step: main.getHintStep()} })
      errs.push(...one)
      if (!p1.fired || !p1.value || p1.value.step !== 1 || p1.value.armed) errs.push(`step 1: ${JSON.stringify(p1.value)}`)
      await frames(2)
      if (main.getAskDots() !== "●○○" || main.getHintsThisGo() !== 0) errs.push(`step 1: dots "${main.getAskDots()}", hints ${main.getHintsThisGo()} (rung 1 isn't a hint)`)
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
      if (main.getAskDots() !== "●●○" || main.getHintsThisGo() !== 1) errs.push(`step 2: dots "${main.getAskDots()}", hints ${main.getHintsThisGo()}`)
      if (!samePosition(main.getPosition() as RefPosition, pos0)) errs.push("the ladder moved a limb")

      // ── third pinch (session 24, the judges' fix 5): the move's why-line at once, in the pinch's own frame;
      //    nothing armed, no pinch on a ring needed ──
      const wantWhy = expectedWhy(main, sug.holdId)!.why
      const p3 = await pinchCapture("AskButton", () => ({step: main.getHintStep(), armed: main.isAskArmed(), shown: main.isWhyVisible(), on: main.getWhyHoldId(), text: main.getWhyText()}))
      await frames(2)
      print(`[H3] step 3: in the pinch frame ${JSON.stringify(p3.value)} (rule "${wantWhy}"); dots "${main.getAskDots()}", hints this go ${main.getHintsThisGo()}`)
      if (!p3.value || p3.value.step !== 3 || p3.value.armed || !p3.value.shown || p3.value.on !== sug.holdId || p3.value.text !== wantWhy) errs.push(`step 3: ${JSON.stringify(p3.value)}, want the why-line "${wantWhy}" on ${sug.holdId}, not armed`)
      if (!mustFind("WhyLine").enabled || main.isAskLit()) errs.push(`step 3: why-line drawn ${mustFind("WhyLine").enabled}, "?" lit ${main.isAskLit()}`)
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
          print(`[H3] step 3 from the wall, 70 cm: ${checkWhyAgrees(camera(), main, errs, "step 3, eye on the wall")}`)
        } finally {
          tr.setWorldPosition(p0)
          tr.setWorldRotation(r0)
          if (tracking) tracking.enabled = was
          await frames(3)
        }
      }
      if (!samePosition(main.getPosition() as RefPosition, pos0)) errs.push("the why-line moved a limb")
      if (main.getMovesMade() !== 0) errs.push(`the ladder counted ${main.getMovesMade()} moves`)
      // the dots: one per rung; hints this go: rungs 2 and 3, a repeat isn't another
      if (main.getAskDots() !== "●●●") errs.push(`step 3: dots "${main.getAskDots()}"`)
      await pinch("AskButton"); await frames(2)
      if (main.getHintStep() !== 3 || main.isAskArmed() || !main.isWhyVisible() || main.getHintsThisGo() !== 2) errs.push(`a fourth "?": step ${main.getHintStep()}, armed ${main.isAskArmed()}, why ${main.isWhyVisible()}, hints ${main.getHintsThisGo()}`)

      // ── back to normal: the next pinch moves, and the move ends the hint ──
      await pinch("Hold_" + sug.holdId); await frames(2)
      const pos1 = main.getPosition() as RefPosition
      if (pos1[sug.limb] !== sug.holdId) errs.push(`after the ladder a pinch on ${sug.holdId} didn't move ${sug.limb}: ${fmtPos(pos1)}`)
      if (main.getHintStep() !== 0 || main.getAskDots() !== "○○○" || main.isWhyVisible()) errs.push(`after a move: hint step ${main.getHintStep()}, dots "${main.getAskDots()}", why ${main.isWhyVisible()}`)
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
    } finally {
      main.setSizingCamera(null)
      so.destroy()
    }
    await restorePreset(main)
    expect(errs.length, "the hint ladder:\n" + errs.join("\n")).toBe(0)
  }
}
