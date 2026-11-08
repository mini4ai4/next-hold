// Session 29, v8 change 1: the height from the eye height (NextHoldEyeHeight), driven by the real Lens camera.
// The preview has no body: its eye is where the scene puts it (y = 0 is 166 cm over the stand-in wall's floor), so
// this proves the logic (the gates, the window, the crouch and up-only rules, snapping, precedence, freezing, the
// line's words, keeping on the first move), not a measurement. The camera's DeviceTracking is switched off while the
// test moves it, and put back.
//   - eye at y = −3 (163 cm): nothing changes before the 2.0 s window is full (read every frame), then 175 with the
//     preview's line "Preview: the camera's height stands in"; the planned line whole in view, both lines at least
//     0.5° tall as drawn; every ring by the test's rule at 175
//   - y = −9 (157 cm): 170 within a window; rings by the rule at 170
//   - a crouch (y = −60) and a head pitched 20° up change nothing in 3 s
//   - a − pinch after a proposal: "Planned for N−5 cm", no eye line, and the eye moving after it changes nothing
//   - a real move freezes it; the store holds the height only after that move
//   - a kept 160 plus enableEyeProposal() keeps 160
//   - y = 0 gives 180 (printed: the preview's 166 cm on record)

import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {HEIGHT_KEY} from "../../Scripts/NextHoldAttempt"
import {EYE_LINE_PREVIEW} from "../../Scripts/NextHoldEyeHeight"
import {NextHoldMain} from "../../Scripts/NextHoldMain"
import {camera, frames, getMain, makeReference, openPageFor, pinch, pinchCapture, renderedRingColour, restorePreset} from "./NextHoldTestKit"
import {RefPosition} from "./NextHoldReferenceRule"

const D2R = Math.PI / 180
/** the spec's sampling window (CHANGES_V8: 2.0 s), fixed here, not read from the Lens */
const WINDOW_S = 2.0

/** the screen box of one Text's world box, or null */
function textBox(t: Text | null, cam: Camera): {x0: number; x1: number; y0: number; y1: number} | null {
  if (!t || !t.getSceneObject().isEnabledInHierarchy || !t.text) return null
  const lo = t.worldAabbMin(), hi = t.worldAabbMax()
  const inv = cam.getSceneObject().getTransform().getInvertedWorldTransform()
  const b = {x0: 1e9, x1: -1e9, y0: 1e9, y1: -1e9}
  for (const x of [lo.x, hi.x]) for (const y of [lo.y, hi.y]) for (const z of [lo.z, hi.z]) {
    const p = new vec3(x, y, z)
    if (inv.multiplyPoint(p).z >= 0) return null
    const s = cam.worldSpaceToScreenSpace(p)
    b.x0 = Math.min(b.x0, s.x); b.x1 = Math.max(b.x1, s.x); b.y0 = Math.min(b.y0, s.y); b.y1 = Math.max(b.y1, s.y)
  }
  return b
}

@component
export class M1EyeHeightScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const main = getMain()
    await restorePreset(main)
    await frames(3)
    const errs: string[] = []
    const live = camera()
    const camT = live.getSceneObject().getTransform()
    const cp = camT.getWorldPosition(), cr = camT.getWorldRotation()
    const tracking = camT.getSceneObject().getComponent("Component.DeviceTracking") as DeviceTracking
    const trackingWas = tracking ? tracking.enabled : true
    const at = (dy: number, pitchDeg = 0) => {
      camT.setWorldPosition(new vec3(cp.x, cp.y + dy, cp.z))
      camT.setWorldRotation(pitchDeg ? cr.multiply(quat.angleAxis(pitchDeg * D2R, vec3.right())) : cr)
    }
    const state = (m: NextHoldMain) => `${m.getHeightCm()} cm (${m.getHeightSource()}), "${m.getPlannedLine()}" / "${m.getHeightSourceLine()}", eye ${m.getEyeState().last || "ok"}`
    /** wait up to `secs`, reading every frame; returns when `done` holds (or null at the end) */
    const waitFor = async (secs: number, done: () => boolean, each?: (t: number) => void): Promise<number | null> => {
      const t0 = getTime()
      while (getTime() - t0 < secs) {
        await frames(1)
        if (each) each(getTime() - t0)
        if (done()) return getTime() - t0
      }
      return null
    }
    const ringsByRule = (cm: number, tag: string) => {
      const ref = makeReference(cm)
      const pos = main.getPosition() as RefPosition
      let ok = 0
      for (const r of ref.perHold(pos)) {
        const got = renderedRingColour(r.holdId, main)
        if (got !== r.colour) errs.push(`${tag}: ${r.holdId} renders ${got}, the rule at ${cm} cm says ${r.colour}`)
        else ok++
      }
      return ok
    }
    // every enable on a fresh store: restorePreset's − / + pinches keep 175 in the store it hands in, and a kept
    // height wins over the eye
    const enable = (store?: GeneralDataStore) => { main.useStore(store || GeneralDataStore.create()); main.enableEyeProposal() }
    const proposed = () => main.getEyeState().proposal !== null
    try {
      if (tracking) tracking.enabled = false

      // ── 1. y = −3 (163 cm over the floor): 175, only once the window is full ──
      at(-3); await frames(3)
      enable()
      const t0 = getTime()
      let early = ""
      const landed = await waitFor(WINDOW_S + 1.0, () => main.getHeightSource() === "eye", (t) => {
        if (t < WINDOW_S - 0.05 && !early && (main.getHeightSource() === "eye" || main.getHeightSourceLine() !== "" || main.getHeightCm() !== 175)) early = `at ${t.toFixed(2)} s: ${state(main)}`
      })
      await frames(2)
      print(`[M1] y −3: the proposal landed at ${landed === null ? "never" : landed.toFixed(2) + " s"} (window ${WINDOW_S} s): ${state(main)}; eye ${main.getEyeState().eyeCm}`)
      if (early) errs.push(`y −3: something changed before the window was full: ${early}`)
      if (landed === null || landed < WINDOW_S - 0.05) errs.push(`y −3: the proposal landed at ${landed}`)
      if (main.getHeightCm() !== 175 || main.getPlannedLine() !== "Planned for 175 cm" || main.getHeightSourceLine() !== EYE_LINE_PREVIEW)
        errs.push(`y −3: ${state(main)}, want 175 with "${EYE_LINE_PREVIEW}"`)
      // the line whole in view, each line at least 0.5° tall as drawn
      const tanV = Math.tan(live.fov / 2)
      const degH = (b: {y0: number; y1: number}) => (Math.atan((0.5 - b.y0) * 2 * tanV) - Math.atan((0.5 - b.y1) * 2 * tanV)) / D2R
      const texts = main.getPlannedTexts()
      const pb = textBox(texts.planned, live), sb = textBox(texts.source, live)
      for (const [name, b] of [["Planned for 175 cm", pb], [EYE_LINE_PREVIEW, sb]] as [string, any][]) {
        if (!b) { errs.push(`y −3: "${name}" doesn't render`); continue }
        if (b.x0 < 0 || b.x1 > 1 || b.y0 < 0 || b.y1 > 1) errs.push(`y −3: "${name}" is cut by the frame (x ${b.x0.toFixed(3)}..${b.x1.toFixed(3)}, y ${b.y0.toFixed(3)}..${b.y1.toFixed(3)})`)
        if (degH(b) < 0.5) errs.push(`y −3: "${name}" is ${degH(b).toFixed(2)}° tall as drawn, want at least 0.5°`)
      }
      if (pb && sb && !(sb.y0 >= pb.y1 - 0.002)) errs.push(`y −3: the eye line isn't under the planned line (${sb.y0.toFixed(3)} vs ${pb.y1.toFixed(3)})`)
      print(`[M1] y −3: planned line ${pb ? degH(pb).toFixed(2) : "-"}° tall, eye line ${sb ? degH(sb).toFixed(2) : "-"}° tall; ${ringsByRule(175, "y −3")} rings by the rule at 175`)
      if (main.isEyeProposalOn() !== true || main.getEyeState().frozen) errs.push(`y −3: the proposal turned itself off before a move`)

      // ── 2. y = −9 (157 cm): 170 ──
      at(-9); await frames(2)
      enable()
      await waitFor(WINDOW_S + 1.0, proposed)
      await frames(2)
      print(`[M1] y −9: ${state(main)}; ${ringsByRule(170, "y −9")} rings by the rule at 170`)
      if (main.getHeightCm() !== 170 || main.getHeightSourceLine() !== EYE_LINE_PREVIEW) errs.push(`y −9: ${state(main)}, want 170 from the eye`)
      if (Math.abs(main.getReach() - 170 * 0.44) > 1e-6) errs.push(`y −9: reach ${main.getReach()}`)

      // ── 3. a crouch, a pitched head: nothing ──
      await restorePreset(main); await frames(2)
      at(-60); await frames(2)
      enable()
      await waitFor(3.0, proposed)
      print(`[M1] crouch (y −60): ${state(main)}`)
      if (main.getHeightCm() !== 175 || main.getHeightSource() === "eye" || main.getEyeState().proposal !== null) errs.push(`crouch: ${state(main)}`)
      at(-3, 20); await frames(2)
      enable()
      await waitFor(3.0, proposed)
      print(`[M1] pitched 20° up (y −3): ${state(main)}`)
      if (main.getHeightSource() === "eye" || main.getEyeState().proposal !== null || main.getEyeState().last !== "head pitched") errs.push(`pitched 20° up: ${state(main)}`)
      // the crouch then standing up: up-only from nothing, so standing gives 175
      at(-3); await frames(2)
      await waitFor(WINDOW_S + 1.0, proposed)
      await frames(2)
      if (main.getHeightCm() !== 175 || main.getHeightSource() !== "eye") errs.push(`level again after the pitch: ${state(main)}`)

      // ── 4. a − pinch overrides, and the eye stops ──
      await pinch("HeightDown"); await frames(2)
      await openPageFor("AskButton"); await frames(2) // Setup's Done, a real pinch: back to the climb page
      print(`[M1] after −: ${state(main)}, page ${main.getPage()}`)
      if (main.getHeightCm() !== 170 || main.getPlannedLine() !== "Planned for 170 cm" || main.getHeightSourceLine() !== "" || main.getHeightSource() !== "manual")
        errs.push(`after −: ${state(main)}, want "Planned for 170 cm" with no eye line`)
      at(10); await frames(2)
      await waitFor(3.0, () => main.getHeightCm() !== 170)
      if (main.getHeightCm() !== 170 || !main.getEyeState().frozen) errs.push(`after −, the eye moved to y +10: ${state(main)}, frozen ${main.getEyeState().frozen}`)

      // ── 5. a real move freezes it; the store holds the height only after that move ──
      await restorePreset(main); await frames(2)
      const store = GeneralDataStore.create()
      at(-9); await frames(2)
      enable(store)
      await waitFor(WINDOW_S + 1.0, proposed)
      await frames(2)
      const keptBefore = store.has(HEIGHT_KEY) ? store.getInt(HEIGHT_KEY) : null
      if (main.getHeightCm() !== 170 || keptBefore !== null) errs.push(`before the move: ${state(main)}, kept ${keptBefore}`)
      const sug = main.getSuggestion()
      const mv = sug ? await pinchCapture("Hold_" + sug.holdId, () => ({kept: store.has(HEIGHT_KEY) ? store.getInt(HEIGHT_KEY) : null, frozen: main.getEyeState().frozen})) : null
      print(`[M1] the first move (${sug ? sug.limb + " to " + sug.holdId : "none"}): in its frame kept ${mv && mv.value ? mv.value.kept : "-"}, frozen ${mv && mv.value ? mv.value.frozen : "-"}`)
      if (!mv || !mv.fired || !mv.value || mv.value.kept !== 170 || !mv.value.frozen) errs.push(`the first move: ${JSON.stringify(mv)}`)
      at(10); await frames(2)
      await waitFor(3.0, () => main.getHeightCm() !== 170)
      if (main.getHeightCm() !== 170) errs.push(`after the first move the eye at y +10 changed the height: ${state(main)}`)

      // ── 6. a kept height wins ──
      await restorePreset(main); await frames(2)
      const s160 = GeneralDataStore.create()
      s160.putInt(HEIGHT_KEY, 160)
      main.useStore(s160)
      main.reloadFromStore()
      at(-3); await frames(2)
      main.enableEyeProposal() // on the store that keeps 160
      await waitFor(3.0, () => main.getHeightCm() !== 160)
      print(`[M1] kept 160 + eye at y −3: ${state(main)}; the eye proposed ${main.getEyeState().proposal}`)
      if (main.getHeightCm() !== 160 || main.getHeightSource() !== "kept" || main.getHeightSourceLine() !== "" || main.getPlannedLine() !== "Planned for 160 cm")
        errs.push(`kept 160: ${state(main)}`)

      // ── 7. the preview's own eye: y = 0 ──
      await restorePreset(main); await frames(2)
      at(0); await frames(2)
      enable()
      await waitFor(WINDOW_S + 1.0, proposed)
      await frames(2)
      print(`[M1] the preview's own eye (y 0): ${main.getEyeState().eyeCm} cm over the floor, stature ${main.getEyeState().stature}: ${state(main)}`)
      if (main.getHeightCm() !== 180) errs.push(`y 0: ${state(main)}, want 180`)
    } catch (e) {
      errs.push(`threw: ${e}`)
    } finally {
      camT.setWorldPosition(cp); camT.setWorldRotation(cr)
      if (tracking) tracking.enabled = trackingWas
    }
    await restorePreset(main)
    expect(errs.length, "eye height:\n" + errs.join("\n")).toBe(0)
  }
}
