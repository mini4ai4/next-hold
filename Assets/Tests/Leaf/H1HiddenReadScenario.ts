// Session 23, beta on request (v7 A1, A2): with beta hidden, from the mats the problem's holds show a
// neutral outline with START and TOP; no grip colour, no glow, no 1-2-3, no limb label. On the wall only
// the four position markers. Nothing leaks by another route either: no lit toggle, no brighter marker,
// no off-view arrow. A real pinch still moves the best limb, and the wall stays quiet in that same frame.
// Input path: real SIK pinches. Distances: a second camera handed to the Lens (setSizingCamera), as a3.

import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {NextHoldMain} from "../../Scripts/NextHoldMain"
import {HOLDS, PRESET_START, PRESET_TOP} from "../../Scripts/Wall/WallLayout"
import {
  NEUTRAL_COLOR, camera, checkNothingRevealed, eyeToWallCm, frames, getMain, isColour, isHued, isPresetProblem, makeReference, mustFind, pinch,
  pinchCapture, presetPosition, renderedLineWidthOf, restorePreset,
} from "./NextHoldTestKit"
import {REF_LIMBS, RefPosition} from "./NextHoldReferenceRule"

/** the read from the mats, as drawn */
function checkMats(main: NextHoldMain, errs: string[], tag: string): void {
  checkNothingRevealed(main, errs, tag)
  for (const h of HOLDS) {
    const want = isPresetProblem(h.id)
    if (main.isOutlineVisible(h.id) !== want || mustFind("Outline_" + h.id).enabled !== want) errs.push(`${tag}: Outline_${h.id} shown ${main.isOutlineVisible(h.id)}, in the problem ${want}`)
    if (want && !isColour("Outline_" + h.id, NEUTRAL_COLOR)) errs.push(`${tag}: Outline_${h.id} is not the neutral colour`)
    const wantTag = h.id === PRESET_TOP ? "TOP" : PRESET_START.indexOf(h.id) >= 0 ? "START" : null
    if (main.getTagText(h.id) !== wantTag) errs.push(`${tag}: ${h.id} tagged "${main.getTagText(h.id)}", want "${wantTag}"`)
  }
}

/** on the wall: the four markers, and nothing else on the wall */
function checkWall(main: NextHoldMain, errs: string[], tag: string): void {
  checkNothingRevealed(main, errs, tag)
  for (const h of HOLDS) {
    if (mustFind("Outline_" + h.id).enabled) errs.push(`${tag}: Outline_${h.id} shows on the wall`)
    if (main.getTagText(h.id)) errs.push(`${tag}: ${h.id} tagged "${main.getTagText(h.id)}" on the wall`)
  }
  checkMarkers(main, errs, tag)
}

/** every limb has its marker on its hold, all at one brightness: none says which limb moves next. Session 27 (P1 item
 *  11): with beta hidden a foot still on its starting hold has no marker unless the setter marked it a start hold */
function checkMarkers(main: NextHoldMain, errs: string[], tag: string): void {
  const pos = main.getPosition() as RefPosition
  const start = presetPosition()
  const starts = main.getStartHolds()
  const levels: number[] = []
  for (const l of REF_LIMBS) {
    const startFoot = (l === "LF" || l === "RF") && !main.isBetaShown() && pos[l] === start[l] && starts.indexOf(pos[l] as string) < 0
    const want = startFoot ? null : pos[l]
    if (main.getMarkerHold(l as any) !== want) errs.push(`${tag}: Marker_${l} on ${main.getMarkerHold(l as any)}, want ${want}${startFoot ? " (a start foot the setter didn't mark)" : ""}`)
    if (!want) continue
    levels.push(((mustFind("Marker_" + l).getComponent("Component.RenderMeshVisual") as RenderMeshVisual).mainMaterial.mainPass.baseColor as vec4).x)
  }
  if (Math.max(...levels) - Math.min(...levels) > 1e-3) errs.push(`${tag}: the markers differ in brightness (${levels.map((v) => v.toFixed(2)).join(", ")}): one names the next move`)
}

@component
export class H1HiddenReadScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const main = getMain()
    await restorePreset(main, false)
    const errs: string[] = []

    if (main.isBetaShown()) errs.push("setup: beta is shown")
    if (main.getShowBetaLabel() !== "Show my\nbeta" || main.isShowBetaLit()) errs.push(`the button reads "${main.getShowBetaLabel()}", lit ${main.isShowBetaLit()}`)
    // the plan still exists behind it: this hides, it doesn't break
    const sug = main.getSuggestion()
    if (!sug || sug.holdId !== "up") errs.push(`setup: the suggestion behind the hidden read is ${sug ? sug.holdId : "none"}`)

    // ── from the preview's own place, then from 2.5 m ──
    checkMats(main, errs, "125 cm")
    checkMarkers(main, errs, "125 cm")
    const neutral = (mustFind("Outline_up").getComponent("Component.RenderMeshVisual") as RenderMeshVisual).mainMaterial.mainPass.baseColor as vec4
    if (isHued(neutral)) errs.push(`the outline has a hue: ${neutral}`)

    const so = global.scene.createSceneObject("HiddenReadCam")
    const cam = so.createComponent("Component.Camera") as Camera
    try {
      cam.devicePropertyUsage = Camera.DeviceProperty.None
      cam.renderLayer = LayerSet.makeUnique() // draws nothing
      const face = mustFind("Hold_lh").getTransform().getWorldPosition()
      const eye = camera().getSceneObject().getTransform().getWorldPosition()
      const at = async (cm: number) => {
        so.getTransform().setWorldPosition(new vec3(eye.x, eye.y, face.z + cm))
        await frames(3)
      }
      await at(250)
      main.setSizingCamera(cam)
      await frames(3)
      checkMats(main, errs, "250 cm")
      // the outline's line grows with the distance, as a ring's does: it must read from the mats
      const line = renderedLineWidthOf("Outline_up")
      print(`[H1] from ${eyeToWallCm(cam).toFixed(0)} cm: outline line ${line.toFixed(2)} cm, a ring's ${main.getRingLineWidth().toFixed(2)} cm`)
      if (Math.abs(line - main.getRingLineWidth()) > 0.05) errs.push(`from 250 cm the outline's line is ${line.toFixed(2)} cm, a ring's is ${main.getRingLineWidth().toFixed(2)}`)

      // ── a real move from the mats: it moves, and shows nothing more, in the pinch's own frame ──
      const ref = makeReference()
      const pos0 = main.getPosition() as RefPosition
      const b = ref.bestForHold("up", pos0)
      const frameErrs: string[] = []
      const got = await pinchCapture("Hold_up", () => {
        checkMats(main, frameErrs, "pinch frame")
        return main.getPosition() as RefPosition
      })
      if (!got.fired || !got.value || got.value[b.limb] !== "up") errs.push(`a pinch on up: ${JSON.stringify(got.value)}, want ${b.limb} there`)
      errs.push(...frameErrs)
      if (main.getMovesMade() !== 1) errs.push(`moves made ${main.getMovesMade()}, want 1`)

      // ── a height change and a refused pinch don't reveal anything either ──
      await pinch("HeightUp"); await frames(2)
      checkMats(main, errs, "after a height step")
      await pinch("HeightDown"); await frames(2)
      await pinch("Hold_" + PRESET_TOP); await frames(2)
      print(`[H1] refused on the top hold: "${main.getWhyText()}"`)
      if (main.getWhyText() !== "OUT OF REACH") errs.push(`a refused pinch says "${main.getWhyText()}"`)
      await sleep(1900)
      checkMats(main, errs, "after a refusal")

      // ── walk in: the four markers, no rings, no figure ──
      await at(60)
      if (main.getView() !== "wall") errs.push(`at 60 cm the view is ${main.getView()}`)
      checkWall(main, errs, "on the wall")
      await pinch("Hold_h09"); await frames(2)
      if (main.getMovesMade() !== 2) errs.push(`on the wall: moves made ${main.getMovesMade()}, want 2`)
      checkWall(main, errs, "on the wall, after a move")

      // ── a limb the climber picks stays lit, and names only their own choice; rings stay off ──
      await pinch("Toggle_LF"); await frames(2)
      if (main.getLitLimb() !== "LF") errs.push(`the picked toggle: lit ${main.getLitLimb()}, want LF`)
      checkNothingRevealed(main, errs, "with an override")
    } finally {
      main.setSizingCamera(null)
      so.destroy()
    }

    // ── session 27 (P1 item 11): start feet ──
    await restorePreset(main, false)
    const footMarks = () => `LF ${main.getMarkerHold("LF")}, RF ${main.getMarkerHold("RF")}, LH ${main.getMarkerHold("LH")}, RH ${main.getMarkerHold("RH")}`
    print(`[H1] start feet, beta hidden: ${footMarks()}`)
    if (main.getMarkerHold("LF") || main.getMarkerHold("RF") || !main.getMarkerHold("LH") || !main.getMarkerHold("RH")) errs.push(`beta hidden at the start: ${footMarks()}, want the hands only (the setter marked lh and rh)`)
    await pinch("ShowBetaButton"); await frames(2)
    print(`[H1] start feet, beta shown: ${footMarks()}`)
    if (!main.getMarkerHold("LF") || !main.getMarkerHold("RF")) errs.push(`beta shown: ${footMarks()}, want all four`)
    await pinch("ShowBetaButton"); await frames(2)
    // a foot that moves is marked where it is (the marker is the body); here LF to h16 with a real override pinch
    await pinch("Toggle_LF"); await frames(2)
    await pinch("Hold_h16"); await frames(2)
    print(`[H1] LF moved: ${footMarks()}`)
    if (main.getMarkerHold("LF") !== "h16" || main.getMarkerHold("RF")) errs.push(`after LF moved: ${footMarks()}, want LF on h16 and RF still unmarked`)
    // the setter marks rf as a start hold (setup through the action API, as the kit's restoreProblem does): RF shows
    await restorePreset(main, false)
    main.pressMode(); main.pressHold("rf"); main.pressStart(); main.pressDone(); main.pressMode()
    main.resetBetaForTests(false)
    await frames(2)
    print(`[H1] rf marked a start hold: ${footMarks()} (starts ${main.getStartHolds().join(",")})`)
    if (main.getMarkerHold("RF") !== "rf" || main.getMarkerHold("LF")) errs.push(`rf marked as a start: ${footMarks()}, want RF on rf and LF unmarked`)
    await restorePreset(main)
    expect(errs.length, "the hidden read:\n" + errs.join("\n")).toBe(0)
  }
}
