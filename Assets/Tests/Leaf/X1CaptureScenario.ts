// Session 27: the screenshot driver for devpost/visual/v7_2 (not a test; it isn't part of the LEAF suite's count).
// Each run sets one shot's state the way a climber would, with real SIK pinches from LEAF's simulated hand on the
// Lens's own buttons and holds, and the real eye moved to the shot's pose (tracking off), then holds that state for
// HOLD_S while PreviewPanelTool shoots it. Refresh the preview between shots.
// - Which shot: a counter under CAPTURE_KEY in the preview's persistent store (1 when absent, back to absent after
//   the last), advanced only when the run's own checks pass, so a failed shot is simply run again.
// - Nothing the shots do is kept: the Lens is handed a fresh in-memory store first (useStore), as every test does.
// - S12, the voice chip: the preview's only voice input is typed text (injectVoice), and the chip lasts 1 s, less
//   than a tool round trip, so this run keeps saying "next hold" every 0.8 s for HOLD_S and the shot is taken while
//   it runs (the run tool times out first). The panel climbs to rung 3 and stays there.

import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {findSceneObjectByName, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {TOPPED_FADE_SECONDS, TOPPED_SECONDS} from "../../Scripts/NextHoldMain"
import {PREVIEW_VOICE_LABEL} from "../../Scripts/NextHoldVoice"
import {camera, climbByRule, fmtPos, frames, getMain, mustFind, pinch, presetPosition, samePosition} from "./NextHoldTestKit"
import {RefPosition} from "./NextHoldReferenceRule"

export const CAPTURE_KEY = "nh.capture.s27b"
/** the drafts' counters, removed on sight */
const OLD_KEYS = ["nh.capture.next", "nh.capture.shot", "nh.capture.s27"]
/** the shot a missing counter starts at */
const FIRST_SHOT = 1
export const SHOTS = 12
/** every shot holds its state this long: LEAF's PASSED banner covers the top of the frame once a run ends, so the
 *  shot is taken while the run is still holding (the run tool times out first) */
const HOLD_S = 90
/** the mats shots: 4.25 m out, 37.5 cm right, pitch -2 (the whole problem and the panel; 2.5 m cuts the top off) */
const MATS: [number, number, number] = [425, 37.5, -2]

@component
export class X1CaptureScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const main = getMain()
    const real = global.persistentStorageSystem.store
    for (const k of OLD_KEYS) if (real.has(k)) real.remove(k)
    const shot = real.has(CAPTURE_KEY) ? real.getInt(CAPTURE_KEY) : FIRST_SHOT
    const errs: string[] = []
    // the Lens as it opened after the refresh: the preset, beta hidden, 175 cm, go 1
    const opened = `${fmtPos(main.getPosition() as RefPosition)}, beta ${main.isBetaShown()}, ${main.getHeightCm()} cm, go ${main.getAttempt()}, mode ${main.getMode()}`
    print(`[X1] shot ${shot}; the Lens as opened: ${opened}`)
    if (!samePosition(main.getPosition() as RefPosition, presetPosition()) || main.isBetaShown() || main.getHeightCm() !== 175 || main.getAttempt() !== 1 || main.getMode() !== "climb") errs.push(`not a fresh open (refresh first): ${opened}`)
    main.useStore(GeneralDataStore.create())

    const camT = camera().getSceneObject().getTransform()
    const tracking = camT.getSceneObject().getComponent("Component.DeviceTracking") as DeviceTracking
    if (tracking) tracking.enabled = false
    const p0 = camT.getWorldPosition(), r0 = camT.getWorldRotation()
    const face = mustFind("Hold_lh").getTransform().getWorldPosition()
    /** the eye `cm` from the wall face, `x` cm across, pitched `pitch` degrees (up +) */
    const pose = async (cm: number, x = 0, pitch = 0) => {
      camT.setWorldPosition(new vec3(p0.x + x, p0.y, face.z + cm))
      camT.setWorldRotation(r0.multiply(quat.angleAxis(pitch * Math.PI / 180, vec3.right())))
      await frames(4)
    }
    const ask = async (n: number) => { for (let i = 0; i < n; i++) { await pinch("AskButton"); await frames(3) } }
    const fall = async () => {
      await pose(60)
      await pinch("Hold_up"); await frames(2)
      await pinch("Hold_h09"); await frames(2)
      await pose(250)
    }
    const height = async (to: number) => {
      for (let i = 0; i < 8 && main.getHeightCm() !== to; i++) { await pinch(main.getHeightCm() > to ? "HeightDown" : "HeightUp"); await frames(2) }
      await pinch("ShowBetaButton"); await frames(3) // closes Setup on the way (a pinch on Setup), then shows the beta
    }
    let what = ""

    if (shot === 1) { await pose(...MATS); what = "mats, beta hidden" }
    else if (shot === 2) { await pose(...MATS); await pinch("ShowBetaButton"); await frames(3); what = "mats, beta shown"; if (!main.isBetaShown()) errs.push("beta not shown") }
    else if (shot === 3) { await pose(60); await pose(110); what = "on wall, quiet"; if (main.getView() !== "wall") errs.push(`view ${main.getView()}`) }
    else if (shot >= 4 && shot <= 6) { await pose(...MATS); await ask(shot - 3); what = `hint rung ${shot - 3}`; if (main.getHintStep() !== shot - 3) errs.push(`rung ${main.getHintStep()}`) }
    else if (shot === 7) {
      await fall(); what = "came off"
      if (main.getCameOffText() !== "Came off from here" || main.getCameOffHintText() !== "Hint · move 3" || !main.isAgainVisible()) errs.push(`card "${main.getCameOffText()}", Again ${main.isAgainVisible()}`)
    } else if (shot === 8) {
      // go 1 comes off; Again; go 2 from the start with one hint, to the top; read from the mats
      await fall()
      await pinch("AgainButton"); await frames(3)
      await pose(60)
      await ask(1)
      const g = await climbByRule(main, errs, "go 2")
      await pose(250)
      while (getTime() - g.time < TOPPED_SECONDS + TOPPED_FADE_SECONDS + 0.5) await frames(1)
      await frames(3)
      what = "result card: " + main.getResultLines().join(" | ")
      if (!main.isResultVisible() || main.getResultLines()[0] !== "SEND · go 2") errs.push(`card ${main.isResultVisible()}: ${main.getResultLines().join(" | ")}`)
    } else if (shot === 9) { await pose(...MATS); await pinch("SetupButton"); await frames(3); what = "Setup open"; if (main.getPage() !== "settings") errs.push(`page ${main.getPage()}`) }
    else if (shot === 10 || shot === 11) {
      const cm = shot === 10 ? 155 : 195
      await pose(250, 0, 8.8); await height(cm); what = `beta shown at ${cm} cm`
      if (main.getHeightCm() !== cm || !main.isBetaShown() || main.getPage() !== "climb") errs.push(`height ${main.getHeightCm()}, beta ${main.isBetaShown()}, page ${main.getPage()}`)
    } else if (shot === 12) {
      await pose(...MATS)
      what = "voice chip"
      if (main.getVoiceKind() !== "injected") errs.push(`voice source ${main.getVoiceKind()}`)
    } else errs.push(`no shot ${shot}`)

    // let the panel settle on its lazy follow
    await frames(10)
    print(`[X1] shot ${shot} (${what}): ${fmtPos(main.getPosition() as RefPosition)}, view ${main.getView()}, page ${main.getPage()}, step ${main.getHintStep()} ${main.getAskDots()}, beta ${main.isBetaShown()}, ${main.getHeightCm()} cm, panel hidden ${main.isRowHidden()} ${main.getGroundPanelDownDeg().toFixed(1)} deg down`)
    if (!errs.length) {
      // LEAF's own banner ("RUNS: ...", then "PASSED") is drawn by its debug camera over the top of the frame; it is
      // LEAF's, not the Lens's, so it is switched off for the hold and back on after
      // and the preview's simulated hands that made the pinches stay in view where they pinched: hidden too
      const hidden = ["LeafDebugUICamera", "RightHandModel", "LeftHandModel"].map((n) => findSceneObjectByName(n)).filter((so) => !!so && so.enabled)
      for (const so of hidden) so.enabled = false
      await frames(2)
      print(`[X1] shot ${shot}: holding for ${HOLD_S} s, hidden: ${hidden.map((so) => so.name).join(", ")}; shoot now`)
      const until = getTime() + HOLD_S
      while (getTime() < until) {
        if (shot === 12) {
          main.injectVoice("next hold")
          const chip = main.getVoiceChip()
          if (!chip || chip.label !== PREVIEW_VOICE_LABEL) { errs.push(`chip ${JSON.stringify(chip)}`); break }
        }
        await sleep(800)
      }
      for (const so of hidden) so.enabled = true
    }
    // the next shot only once this one has held to the end (a reset mid-hold runs it again)
    if (!errs.length) {
      if (shot >= SHOTS) real.remove(CAPTURE_KEY)
      else real.putInt(CAPTURE_KEY, shot + 1)
    }
    expect(errs.length, `capture shot ${shot}:\n` + errs.join("\n")).toBe(0)
  }
}
