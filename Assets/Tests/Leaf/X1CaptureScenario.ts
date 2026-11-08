// Session 27: the screenshot driver for devpost/visual/v7_2, session 28 for v7_3 (not a test; it isn't part of the LEAF
// suite's count). Session 28: pitch the preview camera up 25° before each shot (below), and the eye's poses are set
// absolutely from the wall.
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
import {camera, climbByRule, fmtBox, fmtPos, frames, getMain, mustFind, pinch, presetPosition, samePosition, screenBoxOf} from "./NextHoldTestKit"
import {RefPosition} from "./NextHoldReferenceRule"

export const CAPTURE_KEY = "nh.capture.s30"
/** older counters, removed on sight */
const OLD_KEYS = ["nh.capture.next", "nh.capture.shot", "nh.capture.s27", "nh.capture.s27b", "nh.capture.s28", "nh.capture.s28b", "nh.capture.s28c"]
/** the shot a missing counter starts at (session 30: the v8 shots, 13-16; set 1 for the v7_3 set) */
const FIRST_SHOT = 13
export const SHOTS = 16
/** session 30, v8: k6's off-plan climb (split at move 4) */
const SPLIT_PATH = ["up", "h09", "lh", "rh", "h20"]
/** every shot holds its state this long: LEAF's PASSED banner covers the top of the frame once a run ends, so the
 *  shot is taken while the run is still holding (the run tool times out first) */
const HOLD_S = 5 // session 28: the still is taken after the run (the editor is frozen during it)
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
    // session 28 (v7.3 P1-8): before each capture the preview camera is pitched up 25° (MovePreviewCamera reset, then
    // rotate pitch 25): the preview draws its "Plane" scene behind the additive Lens from that camera, and below its
    // horizon the floor showed through the wall as a dark band with grid lines. Up 25°, only its sky is behind the wall.
    // The Lens can't read that camera inside a LEAF run (it read 0° with the camera at 25°), so this is the protocol,
    // not a check: the stills show it
    if (tracking) tracking.enabled = false
    const face = mustFind("Hold_lh").getTransform().getWorldPosition()
    /** the eye `cm` from the wall face, `x` cm across (from the preview's reset eye), pitched `pitch` degrees (up +); set
     *  absolutely (session 28: not from the preview camera's own pose, which now looks up) */
    const pose = async (cm: number, x = 0, pitch = 0, y = 0) => {
      camT.setWorldPosition(new vec3(x, y, face.z + cm))
      camT.setWorldRotation(quat.angleAxis(pitch * Math.PI / 180, vec3.right()))
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
    /** session 30, v8: the eye at y = −3 (163 cm over the stand-in's floor) proposes 175, as m1 and the take do */
    const eyeProposal = async () => {
      await pose(MATS[0], MATS[1], MATS[2], -3)
      main.enableEyeProposal()
      const t0 = getTime()
      while (getTime() - t0 < 4 && main.getHeightSource() !== "eye") await frames(1)
      await frames(3)
      if (main.getHeightSource() !== "eye" || main.getHeightCm() !== 175) errs.push(`eye proposal: ${main.getHeightCm()} cm (${main.getHeightSource()}) "${main.getHeightSourceLine()}"`)
    }
    /** session 30, v8: each result line as drawn from the eye: degrees tall, inside the plate, the clear gap to the next */
    const cardMeasure = () => {
      const cam = camera()
      const tanV = Math.tan(cam.fov / 2)
      const deg = (y0: number, y1: number) => (Math.atan((0.5 - y0) * 2 * tanV) - Math.atan((0.5 - y1) * 2 * tanV)) * 180 / Math.PI
      const plate = screenBoxOf("ResultPlate", cam)
      const out: string[] = []
      let prev: {y1: number; name: string} | null = null
      for (let i = 1; i <= 4; i++) {
        const t = mustFind("ResultLine_" + i).getComponent("Component.Text") as Text
        if (!t.getSceneObject().isEnabledInHierarchy || !t.text) continue
        const b = screenBoxOf("ResultLine_" + i, cam)
        if (!b) { errs.push(`line ${i} doesn't render`); continue }
        const d = deg(b.y0, b.y1)
        out.push(`${i} "${t.text}" ${d.toFixed(2)}° tall, x ${b.x0.toFixed(3)}..${b.x1.toFixed(3)}` + (prev ? `, ${deg(prev.y1, b.y0).toFixed(2)}° clear of line ${prev.name}` : ""))
        if (i > 1 && d < 0.5) errs.push(`line ${i} is ${d.toFixed(2)}° tall as drawn`)
        if (plate && (b.x0 < plate.x0 || b.x1 > plate.x1 || b.y0 < plate.y0 || b.y1 > plate.y1)) errs.push(`line ${i} isn't inside the plate (${fmtBox(b)} vs ${fmtBox(plate)})`)
        if (prev && b.y0 < prev.y1) errs.push(`line ${i} overlaps line ${prev.name}`)
        prev = {y1: b.y1, name: String(i)}
      }
      print(`[X1] card lines as drawn (plate ${fmtBox(plate)}):\n  ` + out.join("\n  "))
    }
    const waitCard = async (topTime: number) => {
      while (getTime() - topTime < TOPPED_SECONDS + TOPPED_FADE_SECONDS + 0.5) await frames(1)
      await frames(3)
    }

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
      // session 28 (v7.3 P0-2): from S01's pose, so they match it (the panel low and over nothing)
      const cm = shot === 10 ? 155 : 195
      await pose(...MATS); await height(cm); what = `beta shown at ${cm} cm`
      if (main.getHeightCm() !== cm || !main.isBetaShown() || main.getPage() !== "climb") errs.push(`height ${main.getHeightCm()}, beta ${main.isBetaShown()}, page ${main.getPage()}`)
      if (main.getGroundPanelRank() !== 3) errs.push(`the panel's place is rank ${main.getGroundPanelRank()}, want 3 (over nothing)`)
    } else if (shot === 12) {
      // session 28: on the wall at 1.05 m (in under 80 cm first), rung 0 -> 1, as the take does (the presentation judge:
      // voice belongs on the wall, where the hands are busy, and at rung 1 the chip has no label to cover)
      await pose(60); await pose(105, 4.5, 2)
      what = "voice chip, on the wall"
      if (main.getVoiceKind() !== "injected") errs.push(`voice source ${main.getVoiceKind()}`)
      if (main.getView() !== "wall") errs.push(`view ${main.getView()}`)
    } else if (shot === 13 || shot === 16) {
      // session 30, v8: S01's pose with the eye 3 cm lower: "Planned for 175 cm" / the preview's eye line; 16 opens Setup
      await eyeProposal()
      if (shot === 16) { await pinch("SetupButton"); await frames(3); if (main.getPage() !== "settings") errs.push(`page ${main.getPage()}`) }
      what = shot === 13 ? `mats, the eye line: "${main.getPlannedLine()}" / "${main.getHeightSourceLine()}"` : `Setup after the eye's proposal: ${main.getHeightCm()} cm`
    } else if (shot === 14) {
      // session 30, v8: k6's climb (off the plan at move 4), on the wall, then read from 2.5 m
      await pose(60)
      let topTime = -1
      for (const h of SPLIT_PATH) { await pinch("Hold_" + h); await frames(2); if (main.isTopped() && topTime < 0) topTime = getTime() }
      await pose(250)
      if (topTime < 0) errs.push("the split climb didn't top out"); else await waitCard(topTime)
      what = "over-par card: " + main.getResultLines().concat([main.getResultTimeLine()]).join(" | ")
      if (main.getResultLines()[1] !== "5 moves · shortest 4 · split at move 4") errs.push(`card: ${main.getResultLines().join(" | ")}`)
      if (!/^\d:\d\d start to top · new best$/.test(main.getResultTimeLine())) errs.push(`time line "${main.getResultTimeLine()}"`)
      cardMeasure()
    } else if (shot === 15) {
      // session 30, v8: S08 again (go 1 came off; Again; go 2 with one hint to the top): now with the time line
      await fall()
      await pinch("AgainButton"); await frames(3)
      await pose(60)
      await ask(1)
      const g = await climbByRule(main, errs, "go 2")
      await pose(250)
      await waitCard(g.time)
      what = "four-line card: " + main.getResultLines().concat([main.getResultTimeLine()]).join(" | ")
      if (!main.isResultVisible() || main.getResultLines()[0] !== "SEND · go 2") errs.push(`card ${main.isResultVisible()}: ${main.getResultLines().join(" | ")}`)
      if (!/^\d:\d\d start to top · new best$/.test(main.getResultTimeLine())) errs.push(`time line "${main.getResultTimeLine()}"`)
      cardMeasure()
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
      if (shot === 12) {
        // session 28: "next hold" said once at rung 0 (typed: the preview's voice input), then the chip it raised is kept
        // up for the still (holdVoiceChipForCapture, a capture-only hook; the Lens shows it for 1 s)
        main.injectVoice("next hold")
        main.holdVoiceChipForCapture(600)
        await frames(2)
        const chip = main.getVoiceChip()
        if (!chip || chip.label !== PREVIEW_VOICE_LABEL || main.getHintStep() !== 1) errs.push(`chip ${JSON.stringify(chip)}, rung ${main.getHintStep()}`)
      }
      print(`[X1] shot ${shot}: holding for ${HOLD_S} s, hidden: ${hidden.map((so) => so.name).join(", ")}; shoot after the run`)
      const until = getTime() + HOLD_S
      while (getTime() < until) await sleep(500)
      // session 28: left hidden when the run ends (the editor is frozen while a run is going, so the still is taken after
      // it); the next refresh brings them back
    }
    // the next shot only once this one has held to the end (a reset mid-hold runs it again)
    if (!errs.length) {
      if (shot >= SHOTS) real.remove(CAPTURE_KEY)
      else real.putInt(CAPTURE_KEY, shot + 1)
    }
    expect(errs.length, `capture shot ${shot}:\n` + errs.join("\n")).toBe(0)
  }
}
