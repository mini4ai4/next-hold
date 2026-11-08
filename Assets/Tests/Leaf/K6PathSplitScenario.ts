// Session 29, v8 change 2: your path against the shortest, on the result card only.
// - At 175 cm, real pinches from the preset, off the plan at move 4: RH up, LH h09, LF lh, RF rh, LH h20 (each a plain
//   pinch, each green or yellow by the test's rule). Go 1 (beta hidden, no hint) is an onsight: session 31
//   (CHANGES_V8_FIX1 item 2) its card reads "5 moves · 4 is possible" with no move number, and "Onsight: first go, no
//   hints.", never "Pick something harder?". Again, and the same climb as go 2 (a REPEAT): line 2 reads "5 moves · 4 is
//   possible · rethink move 4", where 4 (par) and the move both come from the test's own route search (the first move
//   after which the test's shortest route to the top is not one move shorter; a hand on the top counts 0). No card says
//   "split". The card names no hold and no limb. Go 2's line 2 (the longest, 40 characters) is drawn whole (narrower
//   than its 34 cm line, so not shrunk), at least its 1 cm cap and 0.5° tall as drawn; the card and Again are in view
//   and over no ring of the problem.
// - Again, then the test's own glow to the top in par: line 2 is "4 moves · the shortest for you" (unchanged at par).
// - The split isn't on the came-off card: a fall at move 4 off the plan shows "Came off from here" and its hint only.

import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {TOPPED_FADE_SECONDS, TOPPED_SECONDS} from "../../Scripts/NextHoldMain"
import {NextHoldMain} from "../../Scripts/NextHoldMain"
import {RESULT_BODY_CAP, RESULT_HALF_W} from "../../Scripts/NextHoldCalloutUI"
import {HOLDS, HOLD_SIZE, PRESET_TOP} from "../../Scripts/Wall/WallLayout"
import {camera, climbByRule, fmtBox, frames, getMain, makeReference, mustFind, parFor, pinch, pinchCapture, presetPosition, restorePreset, screenBoxOf} from "./NextHoldTestKit"
import {RefPosition} from "./NextHoldReferenceRule"

const PATH: [string, string][] = [["RH", "up"], ["LH", "h09"], ["LF", "lh"], ["RF", "rh"], ["LH", "h20"]]
const D2R = Math.PI / 180

async function cardAfterTop(main: NextHoldMain, topTime: number): Promise<string[]> {
  while (getTime() - topTime < TOPPED_SECONDS + TOPPED_FADE_SECONDS + 0.3) await frames(1)
  await frames(2)
  return main.getResultLines()
}

@component
export class K6PathSplitScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const main = getMain()
    await restorePreset(main, false)
    main.useStore(GeneralDataStore.create())
    await frames(2)
    const errs: string[] = []
    const ref = makeReference(175)
    const start = presetPosition()
    const par = parFor(start, 175)
    // the test's own distance to the top: its route search, a hand on the top = 0, no route = Infinity
    const dist = (p: RefPosition) => (p.LH === PRESET_TOP || p.RH === PRESET_TOP) ? 0 : (() => { const r = ref.route(p, null, true); return r ? r.length : Infinity })()

    // ── the off-plan climb, real pinches: go 1 (an onsight), then Again and go 2 (a REPEAT) ──
    const offPlan = async (tag: string): Promise<{positions: RefPosition[]; topTime: number}> => {
      const positions: RefPosition[] = [start]
      let topTime = -1
      for (const [limb, hold] of PATH) {
        const before = positions[positions.length - 1]
        const rule = ref.perHold(before).filter((r) => r.holdId === hold && r.limb === limb)[0]
        const got = await pinchCapture("Hold_" + hold, () => ({pos: main.getPosition() as RefPosition, topped: main.isTopped()}))
        if (!got.fired || !got.value || got.value.pos[limb as keyof RefPosition] !== hold) { errs.push(`${tag}: the pinch on ${hold} didn't move ${limb} there (${JSON.stringify(got.value)})`); break }
        if (rule && rule.colour === "red") errs.push(`${tag}: ${limb} to ${hold} is red by the rule`)
        positions.push(got.value.pos)
        if (got.value.topped) topTime = got.time
        await frames(2)
      }
      return {positions, topTime}
    }
    const go1 = await offPlan("go 1")
    const lines1 = go1.topTime < 0 ? [] : await cardAfterTop(main, go1.topTime)
    print(`[K6] go 1 (onsight): ${lines1.join(" | ")}`)
    const want1 = ["ONSIGHT · go 1", `${PATH.length} moves · ${par} is possible`, "Onsight: first go, no hints."]
    if (go1.topTime < 0) errs.push("go 1 didn't top out")
    else if (lines1.join(" | ") !== want1.join(" | ")) errs.push(`go 1 (onsight) reads "${lines1.join(" | ")}", want "${want1.join(" | ")}"`)
    if (lines1.some((l) => /split|rethink|Pick something harder/.test(l))) errs.push(`go 1 (onsight over the shortest): "${lines1.join(" | ")}"`)
    await pinch("AgainButton"); await frames(3)
    const {positions, topTime} = await offPlan("go 2")
    const ds = positions.map(dist)
    let split: number | null = null
    for (let k = 1; k < ds.length && split === null; k++) if (!(ds[k] < ds[k - 1])) split = k
    print(`[K6] par ${par}; the test's distance to the top after each move: ${ds.join(", ")}; split at move ${split}`)
    if (topTime < 0) errs.push("the climb didn't top out")
    if (par !== 4 || split !== 4) errs.push(`the test's own search: par ${par}, split ${split} (the prototype says 4 and 4)`)
    const lines = topTime < 0 ? [] : await cardAfterTop(main, topTime)
    print(`[K6] go 2, the card: ${lines.join(" | ")}`)
    const want2 = `${PATH.length} moves · ${par} is possible · rethink move ${split}`
    // go 1 ticked the problem (an onsight), so go 2 is a REPEAT: not an onsight, so it gets the move number
    if (lines[0] !== "REPEAT · go 2") errs.push(`go 2's line 1 reads "${lines[0]}", want "REPEAT · go 2"`)
    if (lines[1] !== want2) errs.push(`line 2 reads "${lines[1]}", want "${want2}"`)
    if (lines.some((l) => /split|Pick something harder/.test(l))) errs.push(`go 2: "${lines.join(" | ")}"`)
    for (const w of ["LH", "RH", "LF", "RF", "hand", "foot"].concat(HOLDS.map((h) => h.id))) {
      if (lines.some((l) => new RegExp("\\b" + w + "\\b").test(l))) errs.push(`the card names "${w}": "${lines.join(" | ")}"`)
    }
    // line 2 as drawn: whole (Shrink only acts on a line wider than its rect), its cap, 0.5° from the eye
    const cam = camera()
    const t2 = mustFind("ResultLine_2").getComponent("Component.Text") as Text
    const lo = t2.worldAabbMin(), hi = t2.worldAabbMax(), k = mustFind("ResultLine_2").getTransform().getWorldScale().y
    const wCm = hi.sub(lo).length > 0 ? Math.sqrt((hi.x - lo.x) * (hi.x - lo.x) + (hi.z - lo.z) * (hi.z - lo.z)) / k : 0, hCm = (hi.y - lo.y) / k
    const lineW = 2 * (RESULT_HALF_W - 1)
    const eye = cam.getSceneObject().getTransform().getWorldPosition()
    const deg = Math.atan((hi.y - lo.y) / eye.distance(lo.add(hi).uniformScale(0.5))) / D2R
    print(`[K6] line 2 drawn ${wCm.toFixed(1)} x ${hCm.toFixed(2)} cm (line ${lineW} cm, cap ${RESULT_BODY_CAP} cm), ${deg.toFixed(2)}° tall from the eye`)
    if (!(wCm < lineW - 0.3)) errs.push(`line 2 is ${wCm.toFixed(1)} cm wide against its ${lineW} cm line: it shrinks to fit`)
    if (hCm < RESULT_BODY_CAP - 0.05) errs.push(`line 2 draws ${hCm.toFixed(2)} cm tall, under its ${RESULT_BODY_CAP} cm cap`)
    if (deg < 0.5) errs.push(`line 2 is ${deg.toFixed(2)}° tall from the eye, want at least 0.5°`)
    for (const name of ["ResultCard", "AgainButton"]) {
      const box = screenBoxOf(name, cam, true)
      if (!box || box.x0 < 0 || box.x1 > 1 || box.y0 < 0 || box.y1 > 1) { errs.push(`${name} isn't fully in view (${fmtBox(box)})`); continue }
      for (const h of HOLDS) {
        if (!main.isInProblem(h.id)) continue
        const c = main.getHoldWorldPosition(h.id)!
        const s = cam.worldSpaceToScreenSpace(c), e = cam.worldSpaceToScreenSpace(c.add(new vec3(HOLD_SIZE[h.type].ringR, 0, 0)))
        const rx = Math.abs(e.x - s.x), ry = rx * cam.aspect
        if (s.x + rx > box.x0 && s.x - rx < box.x1 && s.y + ry > box.y0 && s.y - ry < box.y1) errs.push(`${name} is over ${h.id}'s ring`)
      }
    }
    const lr = main.getLastResult()
    if (!lr || lr.split !== split) errs.push(`the Lens's own split: ${lr ? lr.split : "no result"}`)

    // ── Again, then par: line 2 unchanged ──
    await pinch("AgainButton"); await frames(3)
    const g = await climbByRule(main, errs, "at par")
    const atPar = g.top ? await cardAfterTop(main, g.time) : []
    print(`[K6] at par (${g.moves.join(", ")}): ${atPar.join(" | ")}`)
    if (atPar[1] !== `${par} moves · the shortest for you` || g.moves.length !== par) errs.push(`at par line 2 reads "${atPar[1]}" after ${g.moves.length} moves`)
    if (main.getLastResult() && main.getLastResult()!.split !== null && main.getLastResult()!.split !== undefined) errs.push(`at par a split was worked out: ${main.getLastResult()!.split}`)

    // ── not on the came-off card: the same climb to move 4, then off the wall ──
    await pinch("AgainButton"); await frames(3)
    const camT = cam.getSceneObject().getTransform()
    const tracking = camT.getSceneObject().getComponent("Component.DeviceTracking") as DeviceTracking
    const trackingWas = tracking ? tracking.enabled : true
    const cp = camT.getWorldPosition()
    try {
      if (tracking) tracking.enabled = false
      // on the wall (under 80 cm), four moves off the plan, then back to the mats (past 120 cm): a fall
      camT.setWorldPosition(new vec3(cp.x, cp.y, cp.z - 70)); await frames(4)
      for (const [, hold] of PATH.slice(0, 4)) { await pinch("Hold_" + hold); await frames(2) }
      camT.setWorldPosition(cp); await frames(4)
      const card = main.isCameOffVisible() ? [main.getCameOffText(), main.getCameOffHintText()] : []
      print(`[K6] came off after move 4: ${JSON.stringify(card)}`)
      if (!card.length) errs.push("no came-off card after the fall")
      if (card.some((l) => /split|shortest|possible|rethink/.test(l))) errs.push(`the came-off card mentions the split: ${card.join(" | ")}`)
    } finally {
      camT.setWorldPosition(cp)
      if (tracking) tracking.enabled = trackingWas
    }
    await restorePreset(main)
    expect(errs.length, "path split:\n" + errs.join("\n")).toBe(0)
  }
}
