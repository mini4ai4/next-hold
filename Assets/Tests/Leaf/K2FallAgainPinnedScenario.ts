// Session 24, the A+E judges' fixes 6 and 7, with part B's Again. Beta hidden; the eye stands in for the body
// as in h5 (a second camera handed to the Lens).
// - Two moves on the wall, then back past 120 cm: the came-off card with "Again" under it; go 1 has ended.
// - One real pinch on the card: rung 1 at the fall's position, pinned there. The card goes; Again stays (the
//   climber read the hint from the mats and now wants to start again).
// - A real pinch on Again: in its own frame every limb is back on the start holds, no card, no hint showing at
//   the start (the pin waits at the fall's position), still go 2 (the fall ended go 1), 0 moves.
// - Climbing back up the same way: no hint after move 1; arriving at the fall's position (move 2) the pinned rung
//   shows again in that move's own frame, its rings exactly the holds in reach there by the test's own rule.
// - "?" there climbs the ladder from the pin (rung 2, the glow). The move from there (move 3) uses the pin up:
//   nothing shows at the next position and the pin is gone.
// - Again isn't offered back on the wall without a card, nor after a move.

import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {checkNothingRevealed, fmtPos, frames, getMain, makeReference, mustFind, pinch, pinchCapture, presetPosition, restorePreset, samePosition} from "./NextHoldTestKit"
import {RefPosition} from "./NextHoldReferenceRule"

@component
export class K2FallAgainPinnedScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const main = getMain()
    await restorePreset(main, false)
    const errs: string[] = []
    const so = global.scene.createSceneObject("FallCam")
    const cam = so.createComponent("Component.Camera") as Camera
    try {
      cam.devicePropertyUsage = Camera.DeviceProperty.None
      cam.renderLayer = LayerSet.makeUnique()
      const face = mustFind("Hold_lh").getTransform().getWorldPosition()
      const eye = mustFind("Camera Object").getTransform().getWorldPosition()
      const at = async (cm: number) => { so.getTransform().setWorldPosition(new vec3(eye.x, eye.y, face.z + cm)); await frames(3) }
      await at(250)
      main.setSizingCamera(cam)
      await frames(3)
      const start = presetPosition()

      // ── the fall ──
      await at(60)
      await pinch("Hold_up"); await frames(2)
      await pinch("Hold_h09"); await frames(2)
      const fallPos = main.getPosition() as RefPosition
      await at(250)
      print(`[K2] fell at ${fmtPos(fallPos)}: "${main.getCameOffText()}", Again ${main.isAgainVisible()}, go ${main.getAttempt()}`)
      if (main.getCameOffText() !== "Came off at move 3. Hint for that move?" || !main.isAgainVisible() || main.getAttempt() !== 2) errs.push(`the fall: "${main.getCameOffText()}", Again ${main.isAgainVisible()}, go ${main.getAttempt()}`)

      // ── the card's hint, pinned; Again stays ──
      await pinch("CameOffCard"); await frames(2)
      const pin = main.getPinnedHint()
      print(`[K2] the card's hint: step ${main.getHintStep()}, pinned ${JSON.stringify(pin)}, card ${main.isCameOffVisible()}, Again ${main.isAgainVisible()}`)
      if (main.getHintStep() !== 1 || !pin || pin.step !== 1) errs.push(`the card's hint: step ${main.getHintStep()}, pin ${JSON.stringify(pin)}`)
      if (main.isCameOffVisible() || !main.isAgainVisible() || !mustFind("AgainButton").enabled) errs.push(`after the hint: card ${main.isCameOffVisible()}, Again ${main.isAgainVisible()}`)

      // ── Again: the start holds, in its own frame ──
      const ag = await pinchCapture("AgainButton", () => ({pos: main.getPosition() as RefPosition, card: main.isCameOffVisible(), step: main.getHintStep(), go: main.getAttempt(), moves: main.getMovesMade()}))
      print(`[K2] Again: ${JSON.stringify(ag.value)}`)
      if (!ag.value || !samePosition(ag.value.pos, start) || ag.value.card || ag.value.step !== 0 || ag.value.go !== 2 || ag.value.moves !== 0) errs.push(`Again's frame: ${JSON.stringify(ag.value)}, want the start ${fmtPos(start)}, no card, no hint, go 2, 0 moves`)
      await frames(2)
      if (main.isAgainVisible()) errs.push("Again stays after its pinch")
      if (!main.getPinnedHint()) errs.push("Again dropped the pinned hint")
      checkNothingRevealed(main, errs, "at the start, the pin waiting")

      // ── the same way up: nothing after move 1; at the fall's position the pinned rung, in that move's frame ──
      await at(60)
      const m1 = await pinchCapture("Hold_up", () => main.getHintStep())
      if (m1.value !== 0) errs.push(`after move 1 the hint shows: step ${m1.value}`)
      await frames(2)
      const inReach = makeReference().perHold(fallPos).filter((r) => r.reachFactor > 0).map((r) => r.holdId)
      const m2 = await pinchCapture("Hold_h09", () => ({step: main.getHintStep(), pos: main.getPosition() as RefPosition,
        rings: inReach.filter((id) => mustFind("Ring_" + id).enabled).length, others: main.getHoldIds().filter((id) => inReach.indexOf(id) < 0 && mustFind("Ring_" + id).enabled)}))
      print(`[K2] back at the fall's position: ${JSON.stringify(m2.value)}; in reach ${inReach.join(", ")}`)
      if (!m2.value || !samePosition(m2.value.pos, fallPos) || m2.value.step !== 1 || m2.value.rings !== inReach.length || m2.value.others.length) errs.push(`at the pin: ${JSON.stringify(m2.value)}, want rung 1 on exactly ${inReach.join(", ")}`)
      await frames(2)
      // "?" climbs from the pin: rung 2, the glow
      await pinch("AskButton"); await frames(2)
      const sug = main.getSuggestion()
      const pin2 = main.getPinnedHint()
      if (main.getHintStep() !== 2 || !sug || !main.isRingGlowing(sug.holdId) || !pin2 || pin2.step !== 2) errs.push(`rung 2 at the pin: step ${main.getHintStep()}, pin ${JSON.stringify(pin2)}`)
      // move 3, the glowing one: the pin is used up
      if (sug) { await pinch("Hold_" + sug.holdId); await frames(2) }
      print(`[K2] move 3 (${sug ? sug.limb + "->" + sug.holdId : "-"}) made: step ${main.getHintStep()}, pin ${JSON.stringify(main.getPinnedHint())}`)
      if (main.getHintStep() !== 0 || main.getPinnedHint()) errs.push(`after move 3: step ${main.getHintStep()}, pin ${JSON.stringify(main.getPinnedHint())}`)
      checkNothingRevealed(main, errs, "after move 3")

      // ── Again isn't left lying about: a fall, then back on the wall unanswered, then a move ──
      await at(250)
      if (!main.isAgainVisible()) errs.push("the third fall: no Again")
      await at(60)
      if (main.isAgainVisible()) errs.push("back on the wall: Again still offered")
    } finally {
      main.setSizingCamera(null)
      so.destroy()
    }

    await restorePreset(main)
    expect(errs.length, "came off, Again, the pinned hint:\n" + errs.join("\n")).toBe(0)
  }
}
