// Session 23, the cue (v7 A2): "? for a hint" in the control row's top line after 20 s on the wall without a
// move, with beta hidden. It is a cue only: read every frame for the whole wait, it reveals nothing and
// changes nothing. There is none on the first attempt before a fall. Real waits, no shortened timer.
// Runs about a minute. Distances: a second camera handed to the Lens, as a3.

import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {NextHoldMain} from "../../Scripts/NextHoldMain"
import {camera, checkNothingRevealed, frames, getMain, mustFind, pinch, restorePreset, samePosition} from "./NextHoldTestKit"
import {RefPosition} from "./NextHoldReferenceRule"

const NOT_YET = "Limb override: none"
const CUE = "? for a hint"

/** Watch every frame for `seconds`: nothing is revealed and nothing changes. Returns when the cue first
 *  showed (s from the start), or -1. */
async function watch(main: NextHoldMain, seconds: number, errs: string[], tag: string): Promise<number> {
  const t0 = getTime()
  const pos0 = main.getPosition() as RefPosition
  const moves0 = main.getMovesMade(), step0 = main.getHintStep()
  let first = -1
  const seen: {[e: string]: boolean} = {}
  while (getTime() - t0 < seconds) {
    const fe: string[] = []
    checkNothingRevealed(main, fe, tag)
    if (!samePosition(main.getPosition() as RefPosition, pos0)) fe.push(`${tag}: the position changed`)
    if (main.getMovesMade() !== moves0 || main.getHintStep() !== step0) fe.push(`${tag}: moves ${main.getMovesMade()}, hint step ${main.getHintStep()}`)
    if (main.isBetaShown()) fe.push(`${tag}: the beta shows`)
    for (const e of fe) if (!seen[e]) { seen[e] = true; errs.push(`${e} (at ${(getTime() - t0).toFixed(1)} s)`) }
    if (first < 0 && main.isCueVisible()) first = getTime() - t0
    await frames(1)
  }
  return first
}

@component
export class H4HintCueScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const main = getMain()
    await restorePreset(main, false)
    const errs: string[] = []
    const so = global.scene.createSceneObject("CueCam")
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

      // ── the first attempt, before any fall: no cue at all, past 20 s ──
      await at(60)
      main.setSizingCamera(cam)
      await frames(3)
      await pinch("Hold_up"); await frames(2)
      const firstTry = await watch(main, 22, errs, "first attempt")
      print(`[H4] first attempt: cue after ${firstTry.toFixed(1)} s (-1: none in 22 s); top line "${main.getOverrideLabel()}"`)
      if (firstTry >= 0) errs.push(`first attempt: the cue showed at ${firstTry.toFixed(1)} s`)
      if (main.getOverrideLabel() !== NOT_YET) errs.push(`first attempt: the top line reads "${main.getOverrideLabel()}"`)

      // ── a fall, then back on the wall: nothing before 20 s, the cue from there, and still nothing else ──
      await at(250)
      await frames(2)
      if (!main.isCameOffVisible()) errs.push("setup: stepping back didn't come off")
      await at(60)
      await frames(1)
      if (main.getView() !== "wall") errs.push(`setup: the view is ${main.getView()}`)
      const cued = await watch(main, 21.5, errs, "second attempt")
      print(`[H4] back on the wall after the fall: cue after ${cued.toFixed(1)} s; top line "${main.getOverrideLabel()}"`)
      if (cued < 19.5 || cued > 20.8) errs.push(`the cue showed at ${cued.toFixed(1)} s, want about 20`)
      if (!main.isCueVisible() || main.getOverrideLabel() !== CUE) errs.push(`the top line reads "${main.getOverrideLabel()}", cue ${main.isCueVisible()}`)
      if (!mustFind("OverrideLabel").enabled) errs.push("the top line isn't shown")
      // it stays a cue for as long as it is up
      const still = await watch(main, 3, errs, "cue up")
      if (still < 0) errs.push("the cue went by itself")

      // ── a limb the climber picked keeps the line ──
      await pinch("Toggle_LF"); await frames(2)
      if (main.getOverrideLabel() !== "Limb override: LF") errs.push(`with an override the top line reads "${main.getOverrideLabel()}"`)
      await restorePreset(main, false)

      // ── asked, it has done its work: from the fall again, the first rung takes it down ──
      await at(60)
      await frames(2)
      await pinch("Hold_up"); await frames(2)
      await at(250)
      await at(60)
      await sleep(20600)
      if (!main.isCueVisible()) errs.push("setup: no cue before the hint")
      await pinch("AskButton"); await frames(2)
      print(`[H4] "?" pinched: cue ${main.isCueVisible()}, hint step ${main.getHintStep()}, top line "${main.getOverrideLabel()}"`)
      if (main.isCueVisible() || main.getOverrideLabel() !== NOT_YET) errs.push(`after "?" the cue is ${main.isCueVisible()}, top line "${main.getOverrideLabel()}"`)
      if (main.getHintStep() !== 1) errs.push(`"?" gave hint step ${main.getHintStep()}, want 1: the cue must not have used a step`)

      // ── a move restarts the clock: no cue at once ──
      await pinch("AskButton"); await frames(2)
      const sug = main.getSuggestion()!
      await pinch("Hold_" + sug.holdId); await frames(2)
      if (main.isCueVisible()) errs.push("the cue shows right after a move")
    } finally {
      main.setSizingCamera(null)
      so.destroy()
    }
    await restorePreset(main)
    expect(errs.length, "the cue:\n" + errs.join("\n")).toBe(0)
  }
}
