// Session 21, a pinch on an out-of-reach hold moves no one. It used to move LH by the tie-break: from
// the start a pinch on the top hold jumped LH there and showed "TOPPED". Now, by the test's own rule,
// a pinch moves a limb only if that move is green or yellow. Otherwise nothing moves, the hold's ring
// gives a short pulse, and the why-line says "OUT OF REACH" for about 1.5 s. An override wins only if
// its move is green or yellow; otherwise it is the same refusal, and the override stays.
// Input path: real SIK pinches on Hold_<id> and the buttons. Every frame from before the pinch is
// sampled (the simulated pinch only returns after its release, too late to see the frames in between).

import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {NextHoldMain, REFUSED_SECONDS} from "../../Scripts/NextHoldMain"
import {PRESET_TOP} from "../../Scripts/Wall/WallLayout"
import {fmtPos, frames, getMain, makeReference, mustFind, pinch, pinchCapture, restorePreset, samePosition} from "./NextHoldTestKit"
import {REF_LIMBS, RefPosition} from "./NextHoldReferenceRule"

const REFUSED = "OUT OF REACH"

interface Sample {t: number; pos: RefPosition; tag: string | null; topped: boolean; why: string; whyOn: boolean; whyHold: string | null; shown: string; pulse: string | null; scale: number; ring: boolean}

function sample(main: NextHoldMain, hold: string): Sample {
  const p = main.getRingPulse()
  return {t: getTime(), pos: main.getPosition() as RefPosition, tag: main.getTagText(PRESET_TOP), topped: main.isTopped(),
    why: main.getWhyText(), whyOn: main.isWhyVisible() && mustFind("WhyLine").enabled, whyHold: main.getWhyHoldId(),
    shown: (mustFind("WhyText").getComponent("Component.Text") as Text).text,
    pulse: p ? p.hold : null, scale: mustFind("Ring_" + hold).getTransform().getLocalScale().x, ring: mustFind("Ring_" + hold).enabled}
}

/**
 * A real pinch on `hold` that must be refused, watched for `seconds` after it, every frame: no limb
 * moves, "TOPPED" never shows, the why-line says OUT OF REACH on this hold for about REFUSED_SECONDS and
 * then goes, the ring pulses and settles, no ripple (that marks a pinch taken). Returns every frame.
 */
async function refused(main: NextHoldMain, hold: string, errs: string[], tag: string, during?: () => Promise<void>): Promise<Sample[]> {
  const pos0 = main.getPosition() as RefPosition
  const override0 = main.getLimbOverride(), label0 = main.getOverrideLabel()
  const ripples0 = main.getRippleLog().length
  const refusals0 = main.getRefusalLog().length
  const samples: Sample[] = []
  let sampling = true
  const sampler = (async () => { while (sampling) { samples.push(sample(main, hold)); await frames(1) } })()
  const got = await pinchCapture("Hold_" + hold, () => sample(main, hold))
  if (!got.fired || !got.value) { sampling = false; await sampler; errs.push(`${tag}: Hold_${hold} never fired`); return samples }
  const f = got.value
  // in the pinch's own frame
  if (!samePosition(f.pos, pos0)) errs.push(`${tag}: in the pinch frame ${fmtPos(f.pos)}, was ${fmtPos(pos0)}`)
  if (!f.whyOn || f.why !== REFUSED || f.shown !== REFUSED || f.whyHold !== hold) errs.push(`${tag}: pinch frame why "${f.why}" (shown "${f.shown}", on ${f.whyOn}) on ${f.whyHold}, want "${REFUSED}" on ${hold}`)
  if (f.pulse !== hold) errs.push(`${tag}: pinch frame: the ring pulsing is ${f.pulse}, want ${hold}`)
  if (during) await during()
  while (getTime() - got.time < REFUSED_SECONDS + 0.5) await frames(1)
  sampling = false
  await sampler

  const after = samples.filter((s) => s.t >= got.time - 1e-4).map((s) => ({...s, dt: s.t - got.time}))
  for (const s of after) {
    if (!samePosition(s.pos, pos0)) { errs.push(`${tag}: at ${s.dt.toFixed(2)} s a limb moved: ${fmtPos(s.pos)}`); break }
  }
  if (samples.some((s) => s.tag === "TOPPED" || s.topped)) errs.push(`${tag}: "TOPPED" showed`)
  // the why-line: up from the pinch for about REFUSED_SECONDS, then gone
  const on = after.filter((s) => s.whyOn && s.why === REFUSED)
  const lastOn = on.length ? on[on.length - 1].dt : -1
  const wrong = after.filter((s) => s.whyOn && s.why !== REFUSED)
  const stillOn = after.filter((s) => s.dt > REFUSED_SECONDS + 0.25 && s.whyOn)
  const steady = after.filter((s) => s.dt < REFUSED_SECONDS - 0.1).every((s) => s.whyOn && s.why === REFUSED)
  // the ring: larger for a moment, back to its own size
  const maxScale = Math.max(...after.map((s) => s.scale))
  const pulseFrames = after.filter((s) => s.pulse === hold)
  const lastPulse = pulseFrames.length ? pulseFrames[pulseFrames.length - 1].dt : -1
  const end = after[after.length - 1]
  const toppedFrames = samples.filter((s) => s.tag === "TOPPED" || s.topped).length
  print(`[P2] ${tag}: pinch on ${hold}: ${fmtPos(pos0)} -> ${fmtPos(end.pos)}; why "${f.why}" for ${lastOn.toFixed(2)} s; ring pulse to x${maxScale.toFixed(2)}, over by ${lastPulse.toFixed(2)} s; TOPPED in ${toppedFrames} of ${samples.length} frames; override ${main.getLimbOverride()}`)
  if (wrong.length) errs.push(`${tag}: the why-line read "${wrong[0].why}" at ${wrong[0].dt.toFixed(2)} s`)
  if (!steady) errs.push(`${tag}: the why-line did not stay for the first ${(REFUSED_SECONDS - 0.1).toFixed(1)} s (last ${lastOn.toFixed(2)} s)`)
  if (lastOn > REFUSED_SECONDS + 0.2 || lastOn < REFUSED_SECONDS - 0.2) errs.push(`${tag}: "${REFUSED}" lasted ${lastOn.toFixed(2)} s, want about ${REFUSED_SECONDS}`)
  if (stillOn.length) errs.push(`${tag}: the why-line is still up at ${stillOn[0].dt.toFixed(2)} s`)
  if (!(maxScale > 1.15)) errs.push(`${tag}: Ring_${hold} only reached x${maxScale.toFixed(2)}: no pulse to see`)
  if (!(lastPulse > 0 && lastPulse < 1)) errs.push(`${tag}: the pulse lasted ${lastPulse.toFixed(2)} s, want a short one`)
  if (Math.abs(end.scale - 1) > 1e-3 || end.pulse !== null) errs.push(`${tag}: after the pulse Ring_${hold} is x${end.scale.toFixed(3)}, pulse ${end.pulse}`)
  // nothing else happened: no ripple, the override untouched, one refusal logged
  if (main.getRippleLog().slice(ripples0).some((r) => r.target === hold)) errs.push(`${tag}: a ripple played on the refused hold ${hold}`)
  if (main.getLimbOverride() !== override0 || main.getOverrideLabel() !== label0) errs.push(`${tag}: override ${override0} -> ${main.getLimbOverride()}, panel "${main.getOverrideLabel()}"`)
  if (main.getRefusalLog().length !== refusals0 + 1) errs.push(`${tag}: ${main.getRefusalLog().length - refusals0} refusals logged, want 1`)
  return samples
}

@component
export class P2PinchOutOfReachScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const main = getMain()
    await restorePreset(main)
    const errs: string[] = []
    const ref = makeReference()
    const pos0 = main.getPosition() as RefPosition

    // ── from the start, the top hold: red for every limb, by the test's own rule ──
    for (const l of REF_LIMBS) {
      const r = ref.score(l, PRESET_TOP, pos0)
      if (r.colour !== "red") errs.push(`precondition: ${l} on ${PRESET_TOP} is ${r.colour}`)
    }
    if (ref.pinchMoves(PRESET_TOP, pos0)) errs.push("precondition: the rule moves a limb to the top from the start")
    if (main.getTagText(PRESET_TOP) !== "TOP") errs.push(`precondition: ${PRESET_TOP} tagged "${main.getTagText(PRESET_TOP)}"`)
    const sug0 = main.getSuggestion()
    await refused(main, PRESET_TOP, errs, "from the start")
    const sug1 = main.getSuggestion()
    if (!sug0 || !sug1 || sug1.holdId !== sug0.holdId || sug1.limb !== sug0.limb) errs.push(`the refused pinch changed the glow: ${JSON.stringify(sug0)} -> ${JSON.stringify(sug1)}`)
    if (main.getTagText(PRESET_TOP) !== "TOP") errs.push(`after it ${PRESET_TOP} is tagged "${main.getTagText(PRESET_TOP)}", want TOP`)

    // ── a view change while it is up (the panels are placed again): it keeps saying OUT OF REACH ──
    // (by the action API: a simulated pinch on the button can take longer than the line stays up)
    await refused(main, PRESET_TOP, errs, "view change while it is up", async () => {
      if (!main.isWhyVisible()) errs.push("setup: the why-line is already down before the view change")
      main.pressView()
      if (main.getView() !== "wall") errs.push(`setup: view ${main.getView()} after pressView`)
      if (main.getWhyText() !== REFUSED) errs.push(`in the view change's own frame the why-line reads "${main.getWhyText()}"`)
      await frames(2)
      if (main.isWhyVisible() && main.getWhyText() !== REFUSED) errs.push(`after the view change the why-line reads "${main.getWhyText()}"`)
    })

    // ── On wall only the glowing ring is drawn: the pinched hold's ring shows for its pulse, then goes ──
    if (main.getView() !== "wall") errs.push(`setup: view ${main.getView()}, want wall`)
    if (mustFind("Ring_" + PRESET_TOP).enabled) errs.push(`setup: On wall Ring_${PRESET_TOP} is already drawn`)
    const wall = await refused(main, PRESET_TOP, errs, "on wall")
    if (!wall.some((s) => s.pulse === PRESET_TOP && s.ring)) errs.push(`on wall: Ring_${PRESET_TOP} never showed for its pulse`)
    if (mustFind("Ring_" + PRESET_TOP).enabled) errs.push(`on wall: Ring_${PRESET_TOP} stays drawn after its pulse`)
    await pinch("ViewToggle")
    await frames(2)

    // ── a "?" asked while it is up stays: the refusal's timer only ends the refusal's own line ──
    pinchRefuseOnly(main, errs)
    await pinch("AskButton"); await frames(1)
    await pinch("Hold_up"); await frames(1)
    const asked = main.getWhyText()
    await sleep((REFUSED_SECONDS + 0.4) * 1000)
    print(`[P2] "?" on up while OUT OF REACH was up: "${asked}", still "${main.getWhyText()}" after ${REFUSED_SECONDS + 0.4} s`)
    if (asked !== "JUG HOLD" || main.getWhyText() !== "JUG HOLD" || !main.isWhyVisible()) errs.push(`"?" while refused: "${asked}", then "${main.getWhyText()}" (shown ${main.isWhyVisible()})`)

    // ── an override whose move is red: the same refusal, though the best limb could make the move ──
    await restorePreset(main)
    await pinch("Toggle_LF"); await frames(2)
    if (ref.score("LF", "up", pos0).colour !== "red" || ref.bestForHold("up", pos0).colour === "red") errs.push("precondition: LF on up should be red, with a limb that can make the move")
    if (ref.pinchMoves("up", pos0, "LF")) errs.push("precondition: the rule moves LF to up")
    await refused(main, "up", errs, "override LF, red")
    if (main.getLimbOverride() !== "LF" || main.getOverrideLabel() !== "Limb override: LF") errs.push(`the refusal used up the override: ${main.getLimbOverride()}, "${main.getOverrideLabel()}"`)

    // ── an override whose move is green still wins over the best limb, and is used up ──
    await pinch("Toggle_LH"); await frames(2)
    if (ref.bestForHold("up", pos0).limb === "LH" || !ref.pinchMoves("up", pos0, "LH")) errs.push("precondition: LH on up should be a good move, and not the best limb's")
    await pinch("Hold_up"); await frames(2)
    const pLH = main.getPosition() as RefPosition
    print(`[P2] override LH, green: ${fmtPos(pLH)}; override ${main.getLimbOverride()}; why "${main.getWhyText()}"`)
    if (pLH.LH !== "up" || pLH.RH !== pos0.RH) errs.push(`override LH, green: ${fmtPos(pLH)}`)
    if (main.getLimbOverride() !== null) errs.push(`override LH, green: it stays ${main.getLimbOverride()} after the move`)

    // ── a red move outranking a yellow one to the same hold: the hold isn't refused, the yellow move is made ──
    await restorePreset(main)
    for (let i = 0; i < 5; i++) main.pressHeight(-1)
    main.forceMove("LH", "h10")
    main.forceMove("LF", "up")
    await frames(2)
    const posH = main.getPosition() as RefPosition
    const refH = makeReference(150)
    const rRF = refH.score("RF", "h16", posH), rLF = refH.score("LF", "h16", posH)
    if (!(rRF.colour === "red" && rLF.colour === "yellow" && rRF.rank > rLF.rank)) errs.push(`precondition: at 150 cm RF on h16 ${rRF.colour} ${rRF.rank}, LF ${rLF.colour} ${rLF.rank}`)
    if (main.getHoldColour("h16") !== "yellow") errs.push(`the ring on h16 is ${main.getHoldColour("h16")}, the move a pinch makes is yellow`)
    const refusals = main.getRefusalLog().length
    await pinch("Hold_h16"); await frames(2)
    const pH = main.getPosition() as RefPosition
    print(`[P2] red RF (rank ${rRF.rank.toFixed(3)}) over yellow LF (rank ${rLF.rank.toFixed(3)}) on h16: ${fmtPos(pH)}`)
    if (pH.LF !== "h16" || pH.RF !== posH.RF || main.getRefusalLog().length !== refusals) errs.push(`h16 at 150 cm: ${fmtPos(pH)}, want LF on it; refusals ${main.getRefusalLog().length - refusals}`)

    // ── a hold under a step tag that is out of reach for now: its ring wears the step's colour, but the move isn't there yet ──
    await restorePreset(main)
    main.forceMove("RH", "up")
    main.forceMove("LH", "h09")
    await frames(2)
    const posT = main.getPosition() as RefPosition
    const tagged = main.getGhostHold(2)
    if (tagged !== PRESET_TOP || ref.pinchMoves(PRESET_TOP, posT)) errs.push(`precondition: from ${fmtPos(posT)} badge 2 on ${tagged}, the rule moves a limb to it: ${ref.pinchMoves(PRESET_TOP, posT)}`)
    await refused(main, PRESET_TOP, errs, "under its step tag, for now")

    await restorePreset(main)
    expect(errs.length, "a pinch out of reach:\n" + errs.join("\n")).toBe(0)
  }
}

/** a refused pinch by the action API, as setup for what follows it */
function pinchRefuseOnly(main: NextHoldMain, errs: string[]): void {
  main.pressHold(PRESET_TOP)
  if (main.getWhyText() !== REFUSED) errs.push(`setup for "?": the why-line reads "${main.getWhyText()}"`)
}
