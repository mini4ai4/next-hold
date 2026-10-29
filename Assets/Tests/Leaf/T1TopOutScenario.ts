// Session 19, topping out (the strict video judge: "the demo never finishes the problem"). From the
// preset, at 175 cm, a climber who follows the plan reaches the top: each step is a real SIK pinch
// on the hold glowing at that turn, and that glow is step 1 of the test's own plan (its own route
// search) from there; every move is green or yellow. The pinch that puts a hand on the top hold
// shows, in its own frame: "TOPPED" over it, in green, where "TOP" was, drawn above the pinch's
// own ripple (the bold one opened over the word for its first 400 ms), and no next move (no glow,
// label, 1-2-3 or arrow). "TOPPED" stays at full strength for TOPPED_SECONDS, fades out over
// TOPPED_FADE_SECONDS and is gone; the climb is still over. A hand back off the top hold climbs on:
// the glow and "TOP" come back.

import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {TOPPED_FADE_SECONDS, TOPPED_SECONDS} from "../../Scripts/NextHoldMain"
import {ORDER_RIPPLE} from "../../Scripts/NextHoldPinchRipple"
import {PRESET_TOP} from "../../Scripts/Wall/WallLayout"
import {classifyColour, fmtPos, frames, getMain, makeReference, mustFind, pinch, pinchCapture, restorePreset} from "./NextHoldTestKit"
import {RefLimb, RefPosition} from "./NextHoldReferenceRule"

function tagAlpha(): number {
  return (mustFind("Tag_" + PRESET_TOP).getComponent("Component.Text") as Text).textFill.color.w
}

@component
export class T1TopOutScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const main = getMain()
    await restorePreset(main)
    const errs: string[] = []
    const ref = makeReference()
    if (main.getTagText(PRESET_TOP) !== "TOP") errs.push(`before the climb ${PRESET_TOP} is tagged "${main.getTagText(PRESET_TOP)}", want TOP`)

    // follow the plan: pinch the glowing hold, the test's own step 1 from here, until a hand is on TOP
    const moves: string[] = []
    let top: {topped: boolean; tag: string | null; alpha: number; green: boolean; sug: boolean; glow: boolean;
      label: boolean; badge: boolean; arrow: boolean; order: number} | null = null
    let topTime = -1
    const samples: {t: number; tag: string | null; a: number}[] = []
    let sampling = false
    let sampler: Promise<void> | null = null
    for (let i = 0; i < 8 && !top; i++) {
      const pos = main.getPosition() as RefPosition
      const sel = main.getSelectedLimb() as RefLimb
      const sug = main.getSuggestion()
      const plan = ref.sequence(pos, sel)
      if (!sug || !plan[0] || sug.limb !== plan[0].limb || sug.holdId !== plan[0].holdId) {
        errs.push(`step ${i + 1} from ${fmtPos(pos)}: glow ${sug ? sug.limb + "->" + sug.holdId : "none"}, the test's plan ${plan[0] ? plan[0].limb + "->" + plan[0].holdId : "none"}`)
        break
      }
      if (plan[0].colour === "red") errs.push(`step ${i + 1}: ${sug.limb}->${sug.holdId} is red`)
      moves.push(`${sug.limb}->${sug.holdId} (${plan[0].colour})`)
      const toTop = sug.holdId === PRESET_TOP && (sug.limb === "LH" || sug.limb === "RH")
      if (toTop) {
        // every frame from before the top-out pinch: how "TOPPED" shows and fades (real time)
        sampling = true
        sampler = (async () => {
          while (sampling) { samples.push({t: getTime(), tag: main.getTagText(PRESET_TOP), a: tagAlpha()}); await frames(1) }
        })()
      }
      const got = await pinchCapture("Hold_" + sug.holdId, () => ({
        topped: main.isTopped(), tag: main.getTagText(PRESET_TOP), alpha: tagAlpha(),
        green: classifyColour((mustFind("Tag_" + PRESET_TOP).getComponent("Component.Text") as Text).textFill.color, main) === "green",
        sug: !!main.getSuggestion(), glow: mustFind("SuggestGlow").enabled, label: main.isLabelVisible(),
        badge: mustFind("GhostNumber_2").enabled, arrow: main.isOffViewArrowVisible(),
        order: (mustFind("Tag_" + PRESET_TOP).getComponent("Component.Text") as Text).getRenderOrder(),
      }))
      if (!got.fired || !got.value) { errs.push(`step ${i + 1}: Hold_${sug.holdId} never fired`); break }
      if (toTop) { top = got.value; topTime = got.time }
      else {
        if (got.value.topped) errs.push(`step ${i + 1}: topped after ${sug.limb}->${sug.holdId}, not on the top hold`)
        await frames(3)
      }
    }
    print(`[T1] followed the plan: ${moves.join(", ")}${top ? " -> TOPPED" : ""}`)
    if (!top) errs.push(`no hand reached ${PRESET_TOP} following the plan in 8 moves`)
    else {
      // in the pinch frame
      if (!top.topped) errs.push("the top-out pinch frame: not topped")
      if (top.tag !== "TOPPED") errs.push(`the top-out pinch frame: ${PRESET_TOP} tagged "${top.tag}", want TOPPED`)
      if (!top.green || top.alpha < 0.99) errs.push(`the top-out pinch frame: TOPPED green ${top.green}, alpha ${top.alpha.toFixed(2)}`)
      // the pinch's own ripple opens over the top hold right then: TOPPED draws above it, not under
      if (!(top.order > ORDER_RIPPLE)) errs.push(`the top-out pinch frame: TOPPED render order ${top.order}, under the ripple's ${ORDER_RIPPLE}`)
      if (top.sug || top.glow || top.label || top.badge || top.arrow) {
        errs.push(`the top-out pinch frame: a next move still shows (suggestion ${top.sug}, glow ${top.glow}, label ${top.label}, badge 2 ${top.badge}, arrow ${top.arrow})`)
      }
      // over time: full, then fading, then gone
      while (getTime() - topTime < TOPPED_SECONDS + TOPPED_FADE_SECONDS + 0.5) await frames(1)
      sampling = false
      if (sampler) await sampler
      const after = samples.filter((s) => s.t >= topTime - 1e-4).map((s) => ({...s, dt: s.t - topTime}))
      const full = after.filter((s) => s.dt < TOPPED_SECONDS - 0.05)
      const fading = after.filter((s) => s.dt > TOPPED_SECONDS + 0.1 && s.dt < TOPPED_SECONDS + TOPPED_FADE_SECONDS - 0.1)
      const gone = after.filter((s) => s.dt > TOPPED_SECONDS + TOPPED_FADE_SECONDS + 0.1)
      const fullOk = full.length > 0 && full.every((s) => s.tag === "TOPPED" && s.a > 0.99)
      const fadingOk = fading.length > 0 && fading.every((s) => s.tag === "TOPPED" && s.a > 0.01 && s.a < 0.99)
      const goneOk = gone.length > 0 && gone.every((s) => s.tag === null)
      print(`[T1] TOPPED: full in ${full.length} frames to ${TOPPED_SECONDS} s ${fullOk}, fading in ${fading.length} ${fadingOk}, gone in ${gone.length} ${goneOk}`)
      if (!fullOk) errs.push(`TOPPED not shown at full strength for ${TOPPED_SECONDS} s`)
      if (!fadingOk) errs.push(`TOPPED does not fade out over ${TOPPED_FADE_SECONDS} s`)
      if (!goneOk) errs.push("TOPPED still shown after its fade (or TOP came back)")
      if (!main.isTopped() || main.getSuggestion() || mustFind("SuggestGlow").enabled) errs.push("after the fade the climb is not over: a next move shows")

      // a hand back off the top hold: climbing again, the glow and TOP come back
      const pos = main.getPosition() as RefPosition
      const hand: RefLimb = pos.LH === PRESET_TOP ? "LH" : "RH"
      const free = ["h09", "up", "h10"].filter((id) => !["LH", "RH", "LF", "RF"].some((l) => pos[l] === id))[0]
      await pinch("Toggle_" + hand)
      await frames(2)
      await pinch("Hold_" + free)
      await frames(3)
      print(`[T1] ${hand} back down to ${free}: topped ${main.isTopped()}, glow ${mustFind("SuggestGlow").enabled}, ${PRESET_TOP} tag "${main.getTagText(PRESET_TOP)}"`)
      if (main.isTopped() || !main.getSuggestion() || !mustFind("SuggestGlow").enabled || main.getTagText(PRESET_TOP) !== "TOP") {
        errs.push(`${hand} off the top to ${free}: topped ${main.isTopped()}, glow ${mustFind("SuggestGlow").enabled}, tag "${main.getTagText(PRESET_TOP)}"`)
      }
    }
    await restorePreset(main)
    expect(errs.length, "topping out:\n" + errs.join("\n")).toBe(0)
  }
}
