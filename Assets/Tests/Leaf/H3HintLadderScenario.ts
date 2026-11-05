// Session 23, the hint ladder (v7 A2), on the wall with beta hidden, with real pinches on "?":
//   first: grip-coloured rings on the holds in reach, by the test's own rule; no glow, no word;
//   second: the glow and the one word for the next move; no 1-2-3;
//   third: "?" arms, as it always has; the next pinch on a ring shows that hold's why-line and moves
//   nothing, one-shot; then a pinch on a hold is a move again.
// A move ends the hint: the next position starts from nothing. From the mats the ladder works too, and
// the outlines stay on the holds it hasn't ringed.

import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {NextHoldMain} from "../../Scripts/NextHoldMain"
import {HOLDS} from "../../Scripts/Wall/WallLayout"
import {camera, checkNothingRevealed, fmtPos, frames, getMain, makeReference, mustFind, pinch, pinchCapture, renderedRingColour, renderedStyle, restorePreset, samePosition, STYLE_FOR} from "./NextHoldTestKit"
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
      const pos0 = main.getPosition() as RefPosition

      // ── first pinch: options, no answer, in the pinch's own frame ──
      const one: string[] = []
      const p1 = await pinchCapture("AskButton", () => { const r = checkRings(main, one, "step 1, pinch frame"); return {r, armed: main.isAskArmed(), step: main.getHintStep()} })
      errs.push(...one)
      if (!p1.fired || !p1.value || p1.value.step !== 1 || p1.value.armed) errs.push(`step 1: ${JSON.stringify(p1.value)}`)
      await frames(2)
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
      if (!samePosition(main.getPosition() as RefPosition, pos0)) errs.push("the ladder moved a limb")

      // ── third pinch: armed, nothing new drawn; the next pinch on a ring is the why-line, one-shot ──
      await pinch("AskButton"); await frames(2)
      if (main.getHintStep() !== 3 || !main.isAskArmed() || !main.isAskLit()) errs.push(`step 3: step ${main.getHintStep()}, armed ${main.isAskArmed()}, lit ${main.isAskLit()}`)
      if (main.isWhyVisible()) errs.push("step 3: a why-line shows before a ring is asked about")
      const asked = ids.filter((id) => id !== sug.holdId)[0]
      const wantWhy = makeReference().bestForHold(asked, pos0).why
      await pinch("Hold_" + asked); await frames(2)
      print(`[H3] step 3: "?" on ${asked}: "${main.getWhyText()}" (rule "${wantWhy}"); position ${fmtPos(main.getPosition() as RefPosition)}`)
      if (main.getWhyText() !== wantWhy || !mustFind("WhyLine").enabled) errs.push(`step 3: why "${main.getWhyText()}", want "${wantWhy}"`)
      if (!samePosition(main.getPosition() as RefPosition, pos0)) errs.push("the why-line moved a limb")
      if (main.isAskArmed() || main.isAskLit()) errs.push(`one-shot: still armed ${main.isAskArmed()}, lit ${main.isAskLit()}`)
      if (main.getMovesMade() !== 0) errs.push(`the ladder counted ${main.getMovesMade()} moves`)

      // ── back to normal: the next pinch moves, and the move ends the hint ──
      await pinch("Hold_" + sug.holdId); await frames(2)
      const pos1 = main.getPosition() as RefPosition
      if (pos1[sug.limb] !== sug.holdId) errs.push(`after the ladder a pinch on ${sug.holdId} didn't move ${sug.limb}: ${fmtPos(pos1)}`)
      if (main.getHintStep() !== 0) errs.push(`after a move the hint step is ${main.getHintStep()}`)
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
