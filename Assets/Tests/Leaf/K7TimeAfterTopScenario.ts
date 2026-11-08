// Session 29, v8 change 3: your time, shown only after the top.
// - Every frame of every go, from its first pinch to its top, every enabled Text in the scene is read: none shows a
//   clock (\d:\d\d). That is the safety claim: no clock while you climb.
// - Go 1 from the start (real pinches on the test's own glow, at 175 cm): after TOPPED, the card's fourth line matches
//   "m:ss start to top · new best", and the time the Lens kept equals the test's own measure of the go (its first
//   move's pinch to the top-out pinch) within 0.2 s. getResultLines() stays three lines with no clock.
// - Go 2, slower (a 3 s wait before each move): "m:ss start to top · best <go 1's m:ss>"; the store's "s" is still
//   go 1's (the fastest).
// - 195 cm: a separate best ("new best" again), under its own key.
// - A top climbed on from a fall (not from the start): no fourth line.
// - The card (RESULT_HALF_H 7.5, as v7: the four lines fit the old plate) is whole in view and over no ring of the problem, its time line too.

import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {NextHoldMain, TOPPED_FADE_SECONDS, TOPPED_SECONDS} from "../../Scripts/NextHoldMain"
import {HOLDS, HOLD_SIZE} from "../../Scripts/Wall/WallLayout"
import {camera, fmtBox, fmtPos, frames, getMain, makeReference, mustFind, pinch, pinchCapture, restorePreset, screenBoxOf} from "./NextHoldTestKit"
import {RefPosition} from "./NextHoldReferenceRule"

const CLOCK = /\d:\d\d/
const TIME_LINE = /^(\d+):(\d\d) start to top · (new best|best (\d+):(\d\d))$/

function textsUnder(so: SceneObject, out: Text[]): Text[] {
  if (!so.enabled) return out
  for (const c of so.getComponents("Component.Text") as Text[]) if (c.enabled && c.text) out.push(c)
  for (let i = 0; i < so.getChildrenCount(); i++) textsUnder(so.getChild(i), out)
  return out
}

/** every Text drawn now that shows a clock, as "name: text" */
function clocksShown(): string[] {
  const out: string[] = []
  for (let i = 0; i < global.scene.getRootObjectsCount(); i++) {
    for (const t of textsUnder(global.scene.getRootObject(i), [])) if (CLOCK.test(t.text)) out.push(`${t.getSceneObject().name}: "${t.text}"`)
  }
  return out
}

function secsOf(m: string, s: string): number { return Number(m) * 60 + Number(s) }

@component
export class K7TimeAfterTopScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const main = getMain()
    await restorePreset(main, false)
    const store = GeneralDataStore.create()
    main.useStore(store)
    await frames(2)
    const errs: string[] = []
    let framesRead = 0

    /** frames, each one read for a clock while the go is under way */
    const watch = async (n: number, tag: string) => {
      for (let i = 0; i < n; i++) {
        await frames(1)
        framesRead++
        const c = clocksShown()
        if (c.length) errs.push(`${tag}: a clock while climbing: ${c.join(", ")}`)
      }
    }
    /** the test's own glow to the top, real pinches; `waitS` before each move. Returns the measured go */
    const climb = async (tag: string, waitS = 0): Promise<{first: number; top: number} | null> => {
      const ref = makeReference(main.getHeightCm())
      let first = -1
      for (let i = 0; i < 8; i++) {
        const pos = main.getPosition() as RefPosition
        const m = ref.glow(pos)
        if (!m) { errs.push(`${tag}: no move by the rule from ${fmtPos(pos)}`); return null }
        if (waitS > 0 && first >= 0) { const t0 = getTime(); while (getTime() - t0 < waitS) await watch(1, tag) }
        const got = await pinchCapture("Hold_" + m.holdId, () => ({topped: main.isTopped(), clocks: clocksShown()}))
        if (!got.fired || !got.value) { errs.push(`${tag}: the pinch on ${m.holdId} didn't fire`); return null }
        if (first < 0) first = got.time
        if (got.value.clocks.length && !got.value.topped) errs.push(`${tag}: a clock in a move's frame: ${got.value.clocks.join(", ")}`)
        if (got.value.topped) return {first, top: got.time}
        await watch(2, tag)
      }
      errs.push(`${tag}: no top in 8 moves`)
      return null
    }
    const card = async (top: number) => {
      while (getTime() - top < TOPPED_SECONDS + TOPPED_FADE_SECONDS + 0.3) await frames(1)
      await frames(2)
      return {lines: main.getResultLines(), time: main.getResultTimeLine(), secs: main.getLastResult() ? main.getLastResult()!.secs : null}
    }
    const record = (key: string): any => { try { return store.has(key) ? JSON.parse(store.getString(key)) : null } catch (e) { return null } }
    const checkPlace = (tag: string) => {
      const cam = camera()
      for (const name of ["ResultCard", "AgainButton", "ResultLine_4"]) {
        const box = screenBoxOf(name, cam, name !== "ResultLine_4")
        if (!box || box.x0 < 0 || box.x1 > 1 || box.y0 < 0 || box.y1 > 1) { errs.push(`${tag}: ${name} isn't fully in view (${fmtBox(box)})`); continue }
        for (const h of HOLDS) {
          if (!main.isInProblem(h.id)) continue
          const c = main.getHoldWorldPosition(h.id)!
          const s = cam.worldSpaceToScreenSpace(c), e = cam.worldSpaceToScreenSpace(c.add(new vec3(HOLD_SIZE[h.type].ringR, 0, 0)))
          const rx = Math.abs(e.x - s.x), ry = rx * cam.aspect
          if (s.x + rx > box.x0 && s.x - rx < box.x1 && s.y + ry > box.y0 && s.y - ry < box.y1) errs.push(`${tag}: ${name} is over ${h.id}'s ring`)
        }
      }
    }

    // ── go 1 ──
    const g1 = await climb("go 1")
    const c1 = g1 ? await card(g1.top) : null
    const measured1 = g1 ? g1.top - g1.first : -1
    print(`[K7] go 1: measured ${measured1.toFixed(2)} s, the Lens kept ${c1 && c1.secs != null ? c1.secs.toFixed(2) : "-"} s; card ${c1 ? c1.lines.join(" | ") + " || " + c1.time : "-"}`)
    const m1 = c1 ? TIME_LINE.exec(c1.time) : null
    if (!m1 || m1[3] !== "new best") errs.push(`go 1: line 4 reads "${c1 ? c1.time : ""}", want "m:ss start to top · new best"`)
    else if (secsOf(m1[1], m1[2]) !== Math.floor(measured1)) errs.push(`go 1: line 4 says ${m1[1]}:${m1[2]}, the go took ${measured1.toFixed(2)} s`)
    if (!c1 || c1.secs == null || Math.abs(c1.secs - measured1) > 0.2) errs.push(`go 1: the Lens's time ${c1 ? c1.secs : "-"} s against the measured ${measured1.toFixed(2)} s (±0.2)`)
    if (!c1 || c1.lines.length !== 3 || c1.lines.some((l) => CLOCK.test(l))) errs.push(`go 1: getResultLines() is "${c1 ? c1.lines.join(" | ") : ""}": three lines, no clock`)
    checkPlace("go 1")
    const bk175 = main.getBestKey()
    const r1 = record(bk175)
    print(`[K7] kept at 175: ${bk175} ${JSON.stringify(r1)}`)
    if (!r1 || typeof r1.s !== "number" || Math.abs(r1.s - measured1) > 0.2) errs.push(`go 1: the best record ${JSON.stringify(r1)}`)

    // ── go 2, slower ──
    await pinch("AgainButton"); await frames(3)
    if (main.getResultTimeLine() !== "" || clocksShown().length) errs.push(`after Again: a clock shows (${clocksShown().join(", ")})`)
    const g2 = await climb("go 2", 3.0)
    const c2 = g2 ? await card(g2.top) : null
    const measured2 = g2 ? g2.top - g2.first : -1
    print(`[K7] go 2 (slower): measured ${measured2.toFixed(2)} s, kept ${c2 && c2.secs != null ? c2.secs.toFixed(2) : "-"} s; line 4 "${c2 ? c2.time : ""}"`)
    const m2 = c2 ? TIME_LINE.exec(c2.time) : null
    if (!m2 || !m2[4] || secsOf(m2[4], m2[5]) !== Math.floor(r1 ? r1.s : -1) || secsOf(m2[1], m2[2]) !== Math.floor(measured2))
      errs.push(`go 2: line 4 reads "${c2 ? c2.time : ""}", want ${Math.floor(measured2)} s "start to top · best" go 1's time`)
    const r2 = record(bk175)
    if (!r2 || !r1 || r2.s !== r1.s) errs.push(`go 2: the store's best time ${r2 ? r2.s : "-"}, want go 1's ${r1 ? r1.s : "-"} (the fastest)`)

    // ── 195 cm: its own best ──
    await pinch("AgainButton"); await frames(3)
    for (let i = 0; i < 4; i++) { await pinch("HeightUp"); await frames(2) }
    await pinch("SetupButton"); await frames(2)
    const g3 = await climb("195 cm")
    const c3 = g3 ? await card(g3.top) : null
    print(`[K7] 195 cm: line 4 "${c3 ? c3.time : ""}", key ${main.getBestKey()} ${JSON.stringify(record(main.getBestKey()))}`)
    if (main.getHeightCm() !== 195 || main.getBestKey() === bk175) errs.push(`195 cm: height ${main.getHeightCm()}, key ${main.getBestKey()}`)
    if (!c3 || !TIME_LINE.test(c3.time) || TIME_LINE.exec(c3.time)![3] !== "new best") errs.push(`195 cm: line 4 reads "${c3 ? c3.time : ""}", want a new best (its own key)`)
    checkPlace("195 cm")

    // ── a top climbed on from a fall: no time ──
    await pinch("AgainButton"); await frames(3)
    const camT = camera().getSceneObject().getTransform()
    const tracking = camT.getSceneObject().getComponent("Component.DeviceTracking") as DeviceTracking
    const trackingWas = tracking ? tracking.enabled : true
    const cp = camT.getWorldPosition()
    try {
      if (tracking) tracking.enabled = false
      camT.setWorldPosition(new vec3(cp.x, cp.y, cp.z - 70)); await frames(4)
      const ref = makeReference(main.getHeightCm())
      const m = ref.glow(main.getPosition() as RefPosition)
      if (m) { await pinch("Hold_" + m.holdId); await watch(2, "before the fall") }
      camT.setWorldPosition(cp); await frames(4)
      if (!main.isCameOffVisible()) errs.push("resumed: no came-off card after the fall")
      const g4 = await climb("climbing on")
      const c4 = g4 ? await card(g4.top) : null
      print(`[K7] climbed on from the fall: ${c4 ? c4.lines.join(" | ") : "-"}; line 4 "${c4 ? c4.time : ""}"`)
      if (!c4 || c4.lines[0] !== "TOPPED · not from the start" || c4.time !== "" || (c4.secs !== null && c4.secs !== undefined)) errs.push(`resumed: "${c4 ? c4.lines.join(" | ") : ""}", line 4 "${c4 ? c4.time : ""}", secs ${c4 ? c4.secs : "-"}`)
    } finally {
      camT.setWorldPosition(cp)
      if (tracking) tracking.enabled = trackingWas
    }
    print(`[K7] ${framesRead} frames of climbing read for a clock`)
    if (framesRead < 50) errs.push(`only ${framesRead} frames of climbing were read`)
    await restorePreset(main)
    expect(errs.length, "time after the top:\n" + errs.join("\n")).toBe(0)
  }
}
