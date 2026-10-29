// Done criterion 2: pinching a free hold moves the selected limb there; its
// dim marker jumps to that hold; all rings recompute in the SAME frame; and the
// limb with the best next move (reference bestMove) is auto-selected.
// Input path: real SIK pinches on Hold_<id> (simulated right hand). The
// post-move state is captured inside the Interactable's onTriggerEnd, in the
// same frame as the Lens's own handler, with no frame wait.
// Session 18: a real pinch on a hold, and on a button, shows the pinch ripple there for 300 ms.
// Session 19: bolder, so it reads in the video: 400 ms, a white band at least twice the ring line
// over a dark halo, opening out to 1.8 x.

import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {HOLDS} from "../../Scripts/Wall/WallLayout"
import {NextHoldMain} from "../../Scripts/NextHoldMain"
import {RIPPLE_GROW, RIPPLE_SECONDS} from "../../Scripts/NextHoldPinchRipple"
import {
  fmtPos, frames, getMain, makeReference, mustFind, pinch, pinchCapture, planeDistanceToHold,
  renderedRingColour, restorePreset,
} from "./NextHoldTestKit"
import {REF_LIMBS, RefPosition} from "./NextHoldReferenceRule"

interface Snap {
  pos: RefPosition
  selected: string
  lit: string | null
  marker: {[l: string]: string | null}
  markerDist: {[l: string]: number}
  colour: {[id: string]: string | null}
  rendered: {[id: string]: string | null}
  ringOn: {[id: string]: boolean}
}

function snap(main: NextHoldMain): Snap {
  const s: Snap = {pos: main.getPosition() as RefPosition, selected: main.getSelectedLimb(), lit: main.getLitLimb(),
    marker: {}, markerDist: {}, colour: {}, rendered: {}, ringOn: {}}
  for (const l of REF_LIMBS) {
    s.marker[l] = main.getMarkerHold(l as any)
    const at = s.pos[l]
    s.markerDist[l] = at ? planeDistanceToHold(mustFind("Marker_" + l), at) : -1
  }
  for (const h of HOLDS) {
    s.colour[h.id] = main.getHoldColour(h.id)
    s.rendered[h.id] = renderedRingColour(h.id, main)
    s.ringOn[h.id] = mustFind("Ring_" + h.id).enabled
  }
  return s
}

async function moveAndCheck(main: NextHoldMain, target: string, errs: string[], tag: string): Promise<void> {
  const ref = makeReference()
  const before = snap(main)
  const mover = before.selected
  const fromHold = before.pos[mover] as string
  const got = await pinchCapture("Hold_" + target, () => snap(main))
  if (!got.fired || !got.value) { errs.push(`${tag}: Hold_${target} onTriggerEnd never fired`); return }
  const a = got.value

  const expectPos: RefPosition = {...before.pos}
  expectPos[mover] = target
  const best = ref.bestMove(expectPos)
  print(`[C2] ${tag}: ${mover} ${fromHold} -> ${target}; now ${fmtPos(a.pos)}; selected ${a.selected}; reference best ${best ? best.limb + "->" + best.holdId : "none"}`)

  // the selected limb moved, nothing else did
  for (const l of REF_LIMBS) {
    if (a.pos[l] !== expectPos[l]) errs.push(`${tag}: same-frame position ${l}=${a.pos[l]}, want ${expectPos[l]}`)
  }
  // its dim marker jumped there (same frame)
  if (a.marker[mover] !== target) errs.push(`${tag}: Marker_${mover} on ${a.marker[mover]} in the pinch frame, want ${target}`)
  if (a.markerDist[mover] > 1) errs.push(`${tag}: Marker_${mover} is ${a.markerDist[mover].toFixed(1)} cm from Hold_${target} in the pinch frame`)
  // auto-select = reference bestMove for the new position (same frame)
  if (!best) errs.push(`${tag}: reference has no best move`)
  else {
    if (a.selected !== best.limb) errs.push(`${tag}: selected ${a.selected} in the pinch frame, reference bestMove limb ${best.limb}`)
    // every ring recomputed in the same frame, for the auto-selected limb
    const ev = ref.evaluate(best.limb, expectPos)
    const want: {[id: string]: string} = {}
    for (const r of ev.results) want[r.holdId] = r.colour
    let changed = 0
    for (const h of HOLDS) {
      const w = want[h.id] || null
      if (a.colour[h.id] !== w) errs.push(`${tag}: pinch-frame getHoldColour(${h.id}) = ${a.colour[h.id]}, reference ${w}`)
      if (a.rendered[h.id] !== w) errs.push(`${tag}: pinch-frame Ring_${h.id} renders ${a.rendered[h.id]}, reference ${w}`)
      if (a.ringOn[h.id] !== !!w) errs.push(`${tag}: pinch-frame Ring_${h.id} enabled=${a.ringOn[h.id]}, want ${!!w}`)
      if (a.rendered[h.id] !== before.rendered[h.id]) changed++
    }
    if (a.ringOn[target]) errs.push(`${tag}: the hold just moved to still shows a ring`)
    if (!a.ringOn[fromHold]) errs.push(`${tag}: the hold just left (${fromHold}) shows no ring`)
    print(`[C2] ${tag}: ${changed} rings changed colour/visibility in the pinch frame`)
    if (changed === 0) errs.push(`${tag}: no ring changed in the pinch frame`)
  }
  // toggle row shows the auto-selected limb (in the pinch frame and settled)
  if (best && a.lit !== best.limb) errs.push(`${tag}: pinch-frame lit toggle ${a.lit}, want ${best.limb}`)
  await frames(3)
  if (best && main.getLitLimb() !== best.limb) errs.push(`${tag}: settled lit toggle ${main.getLitLimb()}, want ${best.limb}`)
  if (best && main.getSelectedLimb() !== best.limb) errs.push(`${tag}: settled selected ${main.getSelectedLimb()}, want ${best.limb}`)
}

@component
export class C2PinchMoveScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const main = getMain()
    await restorePreset(main)
    const errs: string[] = []

    // move 1: from the preset, pinch the suggested hold
    const s1 = main.getSuggestion()
    expect(s1 !== null, "no suggestion at preset").toBe(true)
    await moveAndCheck(main, s1!.holdId, errs, "move 1")

    // move 2: pinch a free hold that is NOT the suggestion (a non-red one if any)
    const ref = makeReference()
    const pos = main.getPosition() as RefPosition
    const ev = ref.evaluate(main.getSelectedLimb() as any, pos)
    const sug = ev.suggestion ? ev.suggestion.holdId : ""
    const pick = ev.results.filter((r) => r.holdId !== sug && r.colour !== "red")[0] ||
      ev.results.filter((r) => r.holdId !== sug)[0]
    await moveAndCheck(main, pick.holdId, errs, "move 2")

    // move 3: a move after which a DIFFERENT limb is best, so the auto-select visibly switches
    // the toggle row. The target is a problem hold the reference says leaves another limb best
    // (it was h18 before the wall had a marked problem; h18 is not in it).
    // Limb chosen with a real pinch on Toggle_RF.
    await restorePreset(main)
    await pinch("Toggle_RF")
    await frames(3)
    if (main.getSelectedLimb() !== "RF") errs.push(`Toggle_RF pinch: selected ${main.getSelectedLimb()}`)
    const pos3 = main.getPosition() as RefPosition
    const ref3 = makeReference()
    const t3 = ref3.evaluate("RF", pos3).results.map((r) => r.holdId).filter((id) => {
      const b = ref3.bestMove({...pos3, RF: id})
      return b !== null && b.limb !== "RF"
    })[0]
    if (!t3) errs.push("setup: no problem hold for RF after which another limb is best")
    else await moveAndCheck(main, t3, errs, "move 3 (RF -> " + t3 + ")")

    // session 18: a real pinch shows a brief ripple where it lands, a hold or a button, for
    // RIPPLE_SECONDS (session 19: 400 ms, bolder)
    await restorePreset(main)
    await sleep(600) // the setup's own ripples are over
    const rid = main.getSuggestion()!.holdId
    // every frame from before the pinch until 1 s after it: when the ripple shows (the simulated
    // hand's pinch only returns after its release, too late to start sampling then), and how large
    const samples: {t: number; on: boolean; r: number}[] = []
    let sampling = true
    const sampler = (async () => {
      while (sampling) { samples.push({t: getTime(), on: main.isRippleVisible(), r: main.getRippleRadius()}); await frames(1) }
    })()
    const ringLine = main.getRingLineWidth()
    const rp = await pinchCapture("Hold_" + rid, () => ({
      vis: main.isRippleVisible(), at: main.getRippleWorldPosition(), last: main.getRippleLog().slice(-1)[0],
      r: main.getRippleRadius(), band: main.getRippleBandWidth(),
    }))
    while (getTime() - rp.time < 1) await frames(1)
    sampling = false
    await sampler
    if (!rp.fired || !rp.value) errs.push("ripple: the hold pinch never fired")
    else {
      const v = rp.value
      const hold = mustFind("Hold_" + rid).getTransform().getWorldPosition()
      const off = v.at ? Math.hypot(v.at.x - hold.x, v.at.y - hold.y) : -1
      print(`[C2] ripple on a pinch of ${rid}: shown ${v.vis} in the pinch frame, ${off.toFixed(2)} cm from the hold, logged "${v.last ? v.last.target : "-"}"`)
      if (!v.vis) errs.push(`ripple: not shown in the frame ${rid} was pinched`)
      if (!v.last || v.last.target !== rid) errs.push(`ripple: logged on ${v.last ? v.last.target : "nothing"}, want ${rid}`)
      if (!(off >= 0 && off < 0.5)) errs.push(`ripple: centred ${off.toFixed(2)} cm from ${rid}`)
      // session 19, bold: in the pinch frame a white band at least twice the ring line; while it
      // shows it opens out toward (1 + RIPPLE_GROW) x
      const r0 = v.r, rMax = Math.max(...samples.filter((s) => s.on && s.t >= rp.time - 1e-4).map((s) => s.r), r0)
      print(`[C2] ripple: band ${v.band.toFixed(2)} cm (ring line ${ringLine.toFixed(2)}), radius ${r0.toFixed(1)} -> ${rMax.toFixed(1)} cm`)
      if (!(v.band >= 2 * ringLine - 1e-3)) errs.push(`ripple: band ${v.band.toFixed(2)} cm, want at least twice the ring line (${(2 * ringLine).toFixed(2)})`)
      if (!(rMax >= r0 * (1 + 0.8 * RIPPLE_GROW))) errs.push(`ripple: opened from ${r0.toFixed(1)} to only ${rMax.toFixed(1)} cm`)
      // it lasts RIPPLE_SECONDS from the pinch: the last frame showing it is before then, the first
      // after it without it at or past then (frame times vary in the preview: measured where it changes)
      const t0 = rp.time
      const after = samples.filter((s) => s.t >= t0 - 1e-4)
      const lastOn = Math.max(0, ...after.filter((s) => s.on).map((s) => s.t - t0))
      const gone = after.filter((s) => !s.on && s.t - t0 > lastOn)[0]
      const firstOff = gone ? gone.t - t0 : -1
      const shownFrames = after.filter((s) => s.on).length
      print(`[C2] ripple: shown in ${shownFrames} frames, last at ${(lastOn * 1000).toFixed(0)} ms, gone at ${(firstOff * 1000).toFixed(0)} ms`)
      if (!(shownFrames >= 2 && lastOn < RIPPLE_SECONDS && firstOff >= RIPPLE_SECONDS - 1e-3)) {
        errs.push(`ripple: shown in ${shownFrames} frames, last at ${(lastOn * 1000).toFixed(0)} ms, gone at ${(firstOff * 1000).toFixed(0)} ms (want ${RIPPLE_SECONDS * 1000} ms)`)
      }
    }
    await pinch("Toggle_LF")
    await frames(1)
    const lastB = main.getRippleLog().slice(-1)[0]
    const btn = mustFind("Toggle_LF").getTransform().getWorldPosition()
    const at = main.getRippleWorldPosition()!
    const offB = Math.hypot(at.x - btn.x, at.y - btn.y)
    print(`[C2] ripple on a pinch of Toggle_LF: logged "${lastB ? lastB.target : "-"}", ${offB.toFixed(2)} cm from the button, shown ${main.isRippleVisible()}`)
    if (!lastB || lastB.target !== "Toggle_LF" || offB > 0.5) errs.push(`ripple: the Toggle_LF pinch rippled on ${lastB ? lastB.target : "nothing"}, ${offB.toFixed(2)} cm from it`)
    await restorePreset(main)

    expect(errs.length, "criterion 2 mismatches:\n" + errs.join("\n")).toBe(0)
  }
}
