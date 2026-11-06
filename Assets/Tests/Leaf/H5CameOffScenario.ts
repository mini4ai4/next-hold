// Session 23, came off (v7 A3). The preview has no body, so the eye stands in: it was under 80 cm from the
// wall (On wall) and goes past 120 cm (Ground). With beta hidden, below the top and a move made, that ends
// the attempt with the card "Came off at move N. Hint for that move?"; one real pinch on the card opens
// the hint ladder at that position, which hasn't changed. Not a fall: stepping back with no move made, a
// hand on the top hold, the view button, or stepping back again with no new move. Session 24: with beta
// shown a fall is a go too, with no card; "Again" sits under the card, in view.
// Distances: a second camera handed to the Lens (a3). The card's place on screen: the real eye, held as
// r8 holds it, so what is checked is what the wearer sees from 2.5 m.

import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {NextHoldMain} from "../../Scripts/NextHoldMain"
import {HOLD_SIZE, holdById, PRESET_TOP} from "../../Scripts/Wall/WallLayout"
import {AGAIN_GAP, AGAIN_W, BUTTON_W} from "../../Scripts/NextHoldCalloutUI"
import {
  boxesOverlap, camera, checkNothingRevealed, checkSideBySide, fmtBox, fmtPos, frames, getMain, makeReference, mustFind, pinch, pinchCapture,
  renderedRingColour, restorePreset, samePosition, screenBoxOf,
} from "./NextHoldTestKit"
import {RefPosition} from "./NextHoldReferenceRule"

@component
export class H5CameOffScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const main = getMain()
    await restorePreset(main, false)
    const errs: string[] = []
    const so = global.scene.createSceneObject("CameOffCam")
    const cam = so.createComponent("Component.Camera") as Camera
    const notFallen = (tag: string) => { if (main.isCameOffVisible() || main.getCameOffText()) errs.push(`${tag}: the card shows "${main.getCameOffText()}"`) }
    try {
      cam.devicePropertyUsage = Camera.DeviceProperty.None
      cam.renderLayer = LayerSet.makeUnique()
      const face = mustFind("Hold_lh").getTransform().getWorldPosition()
      const eye = camera().getSceneObject().getTransform().getWorldPosition()
      const at = async (cm: number) => {
        so.getTransform().setWorldPosition(new vec3(eye.x, eye.y, face.z + cm))
        await frames(3)
      }
      await at(250)
      main.setSizingCamera(cam)
      await frames(3)

      // ── not a fall: on and off the wall with no move made ──
      await at(60)
      await at(250)
      notFallen("no move made")

      // ── not a fall: moves made from the mats, the eye never on the wall ──
      await pinch("Hold_up"); await frames(2)
      await at(200)
      await at(250)
      notFallen("moves from the mats, never on the wall")

      // ── the fall: two moves on the wall, then the eye goes back past 120 cm ──
      await restorePreset(main, false)
      await at(60)
      await pinch("Hold_up"); await frames(2)
      await pinch("Hold_h09"); await frames(2)
      const pos2 = main.getPosition() as RefPosition
      if (main.getMovesMade() !== 2) errs.push(`setup: ${main.getMovesMade()} moves`)
      await at(100)
      notFallen("leaning out, between the thresholds")
      const attempt0 = main.getAttempt()
      await at(125)
      const line = main.getCameOffText()
      print(`[H5] stepped back past 120 cm after two moves: "${line}", view ${main.getView()}, attempt ${attempt0} -> ${main.getAttempt()}, ${fmtPos(main.getPosition() as RefPosition)}`)
      if (line !== "Came off at move 3" || main.getCameOffHintText() !== "Hint ·\nmove 3") errs.push(`the card reads "${line}" / "${main.getCameOffHintText()}"`)
      if (!mustFind("CameOffCard").isEnabledInHierarchy) errs.push("the card's hint button isn't enabled")
      if ((mustFind("CameOffText").getComponent("Component.Text") as Text).text !== line) errs.push("the card's text isn't what it says")
      if (main.getView() !== "ground") errs.push(`the view is ${main.getView()}`)
      if (main.getAttempt() !== attempt0 + 1) errs.push(`the attempt didn't end: ${attempt0} -> ${main.getAttempt()}`)
      if (!samePosition(main.getPosition() as RefPosition, pos2)) errs.push(`the fall moved a limb: ${fmtPos(main.getPosition() as RefPosition)}`)
      checkNothingRevealed(main, errs, "the card, before its pinch")
      await at(250)
      if (!main.isCameOffVisible()) errs.push("the card went when walking further back")
      const scale = mustFind("CameOffCard").getTransform().getWorldScale().x
      print(`[H5] from 250 cm the card is drawn x${scale.toFixed(2)}`)
      if (Math.abs(scale - 250 / 110) > 0.05) errs.push(`from 250 cm the card is x${scale.toFixed(2)}, want x${(250 / 110).toFixed(2)}, as the other panels`)

      // ── one real pinch on the card: step 1 at that position, in the pinch's own frame ──
      const ref = makeReference()
      const inReach = ref.perHold(pos2).filter((r) => r.reachFactor > 0)
      const got = await pinchCapture("CameOffCard", () => ({step: main.getHintStep(), shown: main.isCameOffVisible(), rings: inReach.filter((r) => mustFind("Ring_" + r.holdId).enabled).length, pos: main.getPosition() as RefPosition}))
      print(`[H5] the card pinched: ${JSON.stringify(got.value)}; ${inReach.length} holds in reach at that position (${inReach.map((r) => r.holdId).join(", ")})`)
      if (!got.fired || !got.value) errs.push("the card's pinch didn't fire")
      else {
        if (got.value.step !== 1 || got.value.shown) errs.push(`the pinch frame: step ${got.value.step}, card shown ${got.value.shown}`)
        if (got.value.rings !== inReach.length || !inReach.length) errs.push(`the pinch frame: ${got.value.rings} of ${inReach.length} in-reach rings shown`)
        if (!samePosition(got.value.pos, pos2)) errs.push(`the hint moved a limb: ${fmtPos(got.value.pos)}`)
      }
      await frames(2)
      for (const r of inReach) if (renderedRingColour(r.holdId, main) !== r.colour) errs.push(`Ring_${r.holdId} renders ${renderedRingColour(r.holdId, main)}, the rule at that position says ${r.colour}`)
      if (mustFind("CameOffCard").isEnabledInHierarchy) errs.push("the card stays after its pinch")
      // and the ladder goes on from there, the hint for that move: the glow on the plan's next move
      await pinch("AskButton"); await frames(2)
      const sug = main.getSuggestion()!
      const best = ref.glow(pos2)!
      print(`[H5] second rung: glow on ${sug.holdId}, "${main.getLabelText()}" (rule ${best.limb}->${best.holdId})`)
      if (main.getHintStep() !== 2 || !main.isRingGlowing(best.holdId) || main.getLabelText() !== sug.label) errs.push(`second rung: step ${main.getHintStep()}, glow on ${best.holdId} ${main.isRingGlowing(best.holdId)}`)

      // ── climbing on from there, the next fall names the next move; stepping back again with no new move is the same fall ──
      await at(60)
      if (main.isCameOffVisible()) errs.push("the card shows on the wall")
      await at(250)
      notFallen("stepping back again with no new move")
      await at(60)
      await pinch("Hold_" + best.holdId); await frames(2)
      await at(250)
      print(`[H5] one move on, stepped back: "${main.getCameOffText()}"`)
      if (main.getCameOffText() !== "Came off at move 4") errs.push(`next fall: "${main.getCameOffText()}"`)

      // ── "?" with the card up does what the card does ──
      await pinch("AskButton"); await frames(2)
      if (main.isCameOffVisible() || main.getHintStep() !== 1 || main.isAskArmed()) errs.push(`"?" with the card up: card ${main.isCameOffVisible()}, step ${main.getHintStep()}, armed ${main.isAskArmed()}`)

      // ── an unanswered card goes when you walk back in, or make a move ──
      await restorePreset(main, false)
      await at(60)
      await pinch("Hold_up"); await frames(2)
      await at(250)
      if (!main.isCameOffVisible()) errs.push("setup: no card")
      await at(60)
      if (main.isCameOffVisible()) errs.push("the card stays after walking back in")
      await pinch("Hold_h09"); await frames(2)
      await at(250)
      if (!main.isCameOffVisible()) errs.push("setup: no second card")
      await pinch("Hold_lh"); await frames(2)
      if (main.isCameOffVisible()) errs.push("the card stays after a move")

      // ── not a fall: a hand on the top hold ──
      await restorePreset(main, false)
      main.forceMove("RH", "up")
      main.forceMove("LH", "h09")
      main.forceMove("LF", "lh")
      main.forceMove("RF", "rh")
      await at(60)
      await pinch("Hold_" + PRESET_TOP); await frames(2)
      if (!main.isTopped()) errs.push(`setup: not topped: ${fmtPos(main.getPosition() as RefPosition)}`)
      await at(250)
      notFallen("a hand on the top hold")

      // ── session 24 (the judges' fix 2): beta shown, a fall is a go too; only the card is skipped, the read stays ──
      await restorePreset(main, false)
      await pinch("ShowBetaButton"); await frames(2) // on the mats: it shows there only
      await at(60)
      await pinch("Hold_up"); await frames(2)
      const goShown = main.getAttempt()
      await at(250)
      notFallen("beta shown")
      print(`[H5] beta shown, stepped back after a move: attempt ${goShown} -> ${main.getAttempt()}, card ${main.isCameOffVisible()}, Again ${main.isAgainVisible()}`)
      if (main.getAttempt() !== goShown + 1) errs.push(`beta shown: the fall wasn't counted as a go (${goShown} -> ${main.getAttempt()})`)
      if (!main.isBetaShown() || !main.isRingGlowing(main.getSuggestion()!.holdId)) errs.push("beta shown: stepping back took the read away")
      if (!main.isBetaSeenThisGo()) errs.push("beta shown: the next go isn't marked with beta")

      // ── not a fall: the view button, with the eye still on the wall ──
      await restorePreset(main, false)
      await at(60)
      await pinch("Hold_up"); await frames(2)
      await pinch("ViewToggle"); await frames(2)
      if (main.getView() !== "ground") errs.push(`setup: the button gave ${main.getView()}`)
      notFallen("the view button")
    } finally {
      main.setSizingCamera(null)
      so.destroy()
    }

    // ── what the wearer sees: the real eye walks back from the wall to 2.5 m, looking level ──
    await restorePreset(main, false)
    const camL = camera()
    const eyeSo = camL.getSceneObject()
    const tr = eyeSo.getTransform()
    const tracking = eyeSo.getComponent("Component.DeviceTracking") as DeviceTracking
    const trackingWas = tracking ? tracking.enabled : true
    const p0 = tr.getWorldPosition(), r0 = tr.getWorldRotation()
    try {
      if (tracking) tracking.enabled = false
      tr.setWorldPosition(new vec3(9.5, 0, -55))
      await frames(4)
      main.pressHold("up")
      main.pressHold("h09")
      await frames(2)
      for (const z of [-55, 0, 60, 125]) { tr.setWorldPosition(new vec3(0, 0, z)); await frames(3) }
      if (!main.isCameOffVisible()) errs.push("the real eye: no card after stepping back")
      // session 24: and "Again" with it; both in view, neither over a ring-to-be, START or TOP. Session 26 (s24's log
      // had Again at y 0.14-0.29 and the card at 0.79-0.94, and passed): Again is the card's own right-hand button,
      // level with [Hint · move 3] and 3 cm (x the card's scale) from it; the block is clear of the control row
      if (!main.isAgainVisible()) errs.push("the real eye: no Again with the card")
      print(`[H5] from 2.5 m: ${checkSideBySide("CameOffCard", BUTTON_W, "AgainButton", AGAIN_W, AGAIN_GAP, errs, "from 2.5 m")}`)
      const blockBox = screenBoxOf("CameOffBlock", camL, true), rowBox = screenBoxOf("ControlRow", camL)
      print(`[H5] from 2.5 m: block ${fmtBox(blockBox)}, row ${fmtBox(rowBox)}`)
      if (blockBox && rowBox && boxesOverlap(blockBox, rowBox)) errs.push(`from 2.5 m the came-off block (${fmtBox(blockBox)}) overlaps the control row (${fmtBox(rowBox)})`)
      for (const name of ["CameOffBlock", "AgainButton"]) {
      const box = screenBoxOf(name, camL, true)
      print(`[H5] from 2.5 m, level: ${name} ${fmtBox(box)}`)
      if (!box || box.x0 < 0 || box.x1 > 1 || box.y0 < 0 || box.y1 > 1) errs.push(`from 2.5 m ${name} isn't fully in view: ${fmtBox(box)}`)
      if (box) {
        for (const id of main.getProblemHolds()) {
          const c = main.getHoldWorldPosition(id)!, r = HOLD_SIZE[holdById(id)!.type].ringR
          const s = camL.worldSpaceToScreenSpace(c), e = camL.worldSpaceToScreenSpace(c.add(new vec3(r, 0, 0)))
          const rx = Math.abs(e.x - s.x), ry = rx * camL.aspect
          if (s.x + rx > box.x0 && s.x - rx < box.x1 && s.y + ry > box.y0 && s.y - ry < box.y1) errs.push(`from 2.5 m ${name} is over ${id}`)
        }
        for (const t of ["Tag_lh", "Tag_rh", "Tag_h20"]) {
          const b = screenBoxOf(t, camL)
          if (b && b.x0 < box.x1 && box.x0 < b.x1 && b.y0 < box.y1 && box.y0 < b.y1) errs.push(`from 2.5 m ${name} is over ${t} (${fmtBox(b)})`)
        }
      }
      }
    } finally {
      tr.setWorldPosition(p0)
      tr.setWorldRotation(r0)
      if (tracking) tracking.enabled = trackingWas
      await frames(4)
    }

    await restorePreset(main)
    expect(errs.length, "came off:\n" + errs.join("\n")).toBe(0)
  }
}
