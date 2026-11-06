// Session 24, v7 part B: the climb in climbing's own words; session 26 (v7.2): the climber's and the engineer's
// fixes. Every top here is real pinches from the preset, each on the hold of the test's own glow (glow = plan).
// - Go 1, beta hidden, no hint: in the top-out pinch's own frame the result is kept but no card shows ("TOPPED"
//   has the moment); once TOPPED has faded the card reads "ONSIGHT · go 1" / "N moves · your par P" / "Clean
//   onsight. Pick something harder?", P the test's own shortest route from the start at 175 cm, and N = P:
//   following the glow takes par. While it is up the card takes the control row's place (the row hides), with
//   Again as its own right-hand button: same row, 3 cm apart; both in view and over no ring of the problem.
// - Kept (a fresh store): the problem's goes and tick under its goes key, the best under the problem+height key.
// - Again: back on the start holds in its own frame, no card, go 2, beta hidden.
// - Go 2 with "Show my beta": the problem is ticked, so "REPEAT · go 2" / ... / "0 hints · ticked: onsight (go 1)".
// - Go 3 with rungs 1 and 2: both are hints: "REPEAT · go 3" / ... / "2 hints · ticked: onsight (go 1)".
// - 195 cm is the same problem: no re-read of the store (the s24 test-only reloadFromStore is gone), the go is 4,
//   the goes key the same, the best key another: "REPEAT · go 4" with 195's par.
// - A height change in the middle of a go ends that go (engineer bug 2), and climbing on to the top is not from
//   the start: "TOPPED · not from the start", no tick, nothing kept for it (hound 3a).
// No timer and no points on any card.

import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {TOPPED_FADE_SECONDS, TOPPED_SECONDS} from "../../Scripts/NextHoldMain"
import {NextHoldMain} from "../../Scripts/NextHoldMain"
import {AGAIN_GAP, AGAIN_W, RESULT_HALF_W} from "../../Scripts/NextHoldCalloutUI"
import {ONSIGHT_LINE} from "../../Scripts/NextHoldAttempt"
import {HOLDS, HOLD_SIZE} from "../../Scripts/Wall/WallLayout"
import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import {
  camera, checkSideBySide, climbByRule, fmtBox, fmtPos, frames, getMain, makeReference, mustFind, parFor, pinch, pinchCapture, presetPosition,
  restorePreset, samePosition, screenBoxOf,
} from "./NextHoldTestKit"
import {RefPosition} from "./NextHoldReferenceRule"

/** wait out TOPPED, then read the card */
async function cardAfterTop(main: NextHoldMain, topTime: number): Promise<string[]> {
  while (getTime() - topTime < TOPPED_SECONDS + TOPPED_FADE_SECONDS + 0.3) await frames(1)
  await frames(2)
  return main.getResultLines()
}

/** the card and Again: one block in the row's place (the row hidden), in view, over no ring, Again beside the card */
function checkCardPlace(main: NextHoldMain, errs: string[], tag: string): void {
  const cam = camera()
  for (const name of ["ResultCard", "AgainButton"]) {
    const box = screenBoxOf(name, cam, true)
    if (!box || box.x0 < 0 || box.x1 > 1 || box.y0 < 0 || box.y1 > 1) { errs.push(`${tag}: ${name} isn't fully in view (${fmtBox(box)})`); continue }
    for (const h of HOLDS) {
      if (!main.isInProblem(h.id)) continue
      const c = main.getHoldWorldPosition(h.id)!
      const s = cam.worldSpaceToScreenSpace(c), e = cam.worldSpaceToScreenSpace(c.add(new vec3(HOLD_SIZE[h.type].ringR, 0, 0)))
      const rx = Math.abs(e.x - s.x), ry = rx * cam.aspect
      if (s.x + rx > box.x0 && s.x - rx < box.x1 && s.y + ry > box.y0 && s.y - ry < box.y1) errs.push(`${tag}: ${name} is over ${h.id}'s ring`)
    }
  }
  print(`[K1] ${tag}: ${checkSideBySide("ResultCard", 2 * RESULT_HALF_W, "AgainButton", AGAIN_W, AGAIN_GAP, errs, tag)}`)
  if (!main.isRowHidden() || mustFind("ControlRow").isEnabledInHierarchy) errs.push(`${tag}: the control row shows with the card (it should take the row's place)`)
  const again = mustFind("AgainButton").getComponent(Button.getTypeName()) as Button
  if (again.size.x < 10 || again.size.y < 10) errs.push(`${tag}: Again is ${again.size.x} x ${again.size.y} cm`)
}

function record(store: GeneralDataStore, key: string): any {
  try { return store.has(key) ? JSON.parse(store.getString(key)) : null } catch (e) { return null }
}

@component
export class K1ResultCardScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const main = getMain()
    await restorePreset(main, false)
    const errs: string[] = []
    const store = GeneralDataStore.create()
    main.useStore(store)
    await frames(2)
    const start = presetPosition()
    const par175 = parFor(start, 175)
    if (main.getAttempt() !== 1) errs.push(`setup: go ${main.getAttempt()}, want 1 with a fresh store`)
    if (main.getPar() !== par175) errs.push(`par: the Lens says ${main.getPar()}, the test's route search ${par175}`)

    // ── go 1: hidden, no hint ──
    const g1 = await climbByRule(main, errs, "go 1")
    print(`[K1] go 1: ${g1.moves.join(", ")}; top frame ${JSON.stringify(g1.top)}`)
    if (g1.top && (!g1.top.result || g1.top.card || g1.top.again)) errs.push(`go 1, the top-out frame: result kept ${g1.top.result}, card ${g1.top.card}, Again ${g1.top.again}: the card waits for TOPPED`)
    if (g1.moves.length !== par175) errs.push(`go 1 followed the glow in ${g1.moves.length} moves, par is ${par175}`)
    const l1 = await cardAfterTop(main, g1.time)
    print(`[K1] go 1 card: ${l1.join(" | ")} (par from the test: ${par175})`)
    const want1 = ["ONSIGHT · go 1", `${g1.moves.length} moves · your par ${par175}`, ONSIGHT_LINE]
    if (l1.join("|") !== want1.join("|")) errs.push(`go 1 card: "${l1.join(" | ")}", want "${want1.join(" | ")}"`)
    if (!main.isResultVisible() || !main.isAgainVisible() || !mustFind("ResultCard").enabled) errs.push(`go 1: card ${main.isResultVisible()}, Again ${main.isAgainVisible()}`)
    checkCardPlace(main, errs, "go 1")
    // kept
    const gk = main.getGoesKey(), bk = main.getBestKey()
    const prob = record(store, gk), best = record(store, bk)
    print(`[K1] kept: ${gk} ${JSON.stringify(prob)}; ${bk} ${JSON.stringify(best)}`)
    if (!prob || prob.g !== 1 || !prob.b || prob.b.t !== "ONSIGHT" || prob.b.n !== 1) errs.push(`go 1, the problem's record: ${JSON.stringify(prob)}`)
    if (!best || !best.b || best.b.t !== "ONSIGHT" || best.b.m !== g1.moves.length || best.b.h !== 0) errs.push(`go 1, the best at 175: ${JSON.stringify(best)}`)

    // ── Again: back to the start holds in its own frame ──
    const again = await pinchCapture("AgainButton", () => ({pos: main.getPosition() as RefPosition, card: main.isResultVisible(), go: main.getAttempt(), beta: main.isBetaShown(), moves: main.getMovesMade(), row: main.isRowHidden()}))
    print(`[K1] Again: ${JSON.stringify(again.value)}`)
    if (!again.value || !samePosition(again.value.pos, start) || again.value.card || again.value.go !== 2 || again.value.beta || again.value.moves !== 0 || again.value.row) errs.push(`Again's frame: ${JSON.stringify(again.value)}, want ${fmtPos(start)}, no card, go 2, beta hidden, 0 moves, the row back`)
    await frames(3)
    if (main.isAgainVisible()) errs.push("Again stays after its pinch")

    // ── go 2, with beta: the problem is ticked, so a repeat ──
    await pinch("ShowBetaButton"); await frames(2)
    const g2 = await climbByRule(main, errs, "go 2")
    const l2 = await cardAfterTop(main, g2.time)
    print(`[K1] go 2 card: ${l2.join(" | ")}`)
    const want2 = ["REPEAT · go 2", `${g2.moves.length} moves · your par ${par175}`, "0 hints · ticked: onsight (go 1)"]
    if (l2.join("|") !== want2.join("|")) errs.push(`go 2 card: "${l2.join(" | ")}", want "${want2.join(" | ")}"`)

    // ── go 3, rungs 1 and 2: both are hints ──
    await pinch("AgainButton"); await frames(3)
    await pinch("AskButton"); await frames(2)
    await pinch("AskButton"); await frames(2)
    if (main.getHintsThisGo() !== 2) errs.push(`go 3: hints ${main.getHintsThisGo()} after rungs 1 and 2, want 2`)
    const g3 = await climbByRule(main, errs, "go 3")
    const l3 = await cardAfterTop(main, g3.time)
    print(`[K1] go 3 card: ${l3.join(" | ")}`)
    if (l3[0] !== "REPEAT · go 3" || l3[2] !== "2 hints · ticked: onsight (go 1)") errs.push(`go 3 card: "${l3.join(" | ")}"`)
    if (/\d:\d\d|point|pts/i.test(l1.concat(l2, l3).join(" "))) errs.push("a card shows a time or points")

    // ── 195 cm: the same problem, another body: the go goes on counting, the best is 195's own ──
    await pinch("AgainButton"); await frames(3)
    for (let i = 0; i < 4; i++) { await pinch("HeightUp"); await frames(2) }
    const par195 = parFor(start, 195)
    print(`[K1] 195 cm: go ${main.getAttempt()}, goes key ${main.getGoesKey()}, best key ${main.getBestKey()}`)
    if (main.getHeightCm() !== 195 || main.getAttempt() !== 4 || main.getGoesKey() !== gk || main.getBestKey() === bk) errs.push(`195 cm: height ${main.getHeightCm()}, go ${main.getAttempt()} (want 4), goes key ${main.getGoesKey()} (175's ${gk}), best key ${main.getBestKey()} (175's ${bk})`)
    await pinch("ShowBetaButton"); await frames(2)
    const g4 = await climbByRule(main, errs, "195 cm")
    const l4 = await cardAfterTop(main, g4.time)
    print(`[K1] 195 cm card: ${l4.join(" | ")} (par from the test: ${par195})`)
    const want4 = ["REPEAT · go 4", `${g4.moves.length} moves · your par ${par195}`, "0 hints · ticked: onsight (go 1)"]
    if (l4.join("|") !== want4.join("|")) errs.push(`195 cm card: "${l4.join(" | ")}", want "${want4.join(" | ")}"`)
    if (g4.moves.length !== par195) errs.push(`195 cm: following the glow took ${g4.moves.length}, par ${par195}`)
    const prob4 = record(store, gk)
    if (!prob4 || prob4.g !== 4 || !prob4.b || prob4.b.t !== "ONSIGHT") errs.push(`after 4 goes the problem's record: ${JSON.stringify(prob4)}`)

    // ── a height change mid-go ends that go; climbing on to the top isn't from the start ──
    await pinch("AgainButton"); await frames(3)
    await pinch("ShowBetaButton"); await frames(2)
    const ref = makeReference(195)
    const first = ref.glow(main.getPosition() as RefPosition)!
    await pinch("Hold_" + first.holdId); await frames(2)
    const go5 = main.getAttempt()
    await pinch("HeightDown"); await frames(2)
    print(`[K1] one move into go ${go5}, then − to ${main.getHeightCm()} cm: go ${main.getAttempt()}, from the start ${main.isFromStart()}; kept ${JSON.stringify(record(store, gk))}`)
    if (main.getAttempt() !== go5 + 1 || main.isFromStart()) errs.push(`a height change mid-go: go ${go5} -> ${main.getAttempt()}, from the start ${main.isFromStart()}`)
    if (!record(store, gk) || record(store, gk).g !== go5) errs.push(`the go ended by the height change wasn't kept: ${JSON.stringify(record(store, gk))}`)
    const g5 = await climbByRule(main, errs, "climbing on")
    const l5 = await cardAfterTop(main, g5.time)
    print(`[K1] climbed on to the top: ${l5.join(" | ")}`)
    if (l5[0] !== "TOPPED · not from the start" || l5[1] !== "A tick needs a go from the start") errs.push(`climbing on: "${l5.join(" | ")}"`)
    if (record(store, gk).g !== go5 || main.getAttempt() !== go5 + 1) errs.push(`climbing on counted a go: kept ${JSON.stringify(record(store, gk))}, go ${main.getAttempt()}`)

    // ── Again takes the card down, and the row comes back ──
    await pinch("AgainButton"); await frames(2)
    if (main.isResultVisible() || main.getLastResult() || main.isRowHidden()) errs.push(`Again left the card (${main.isResultVisible()}) or the row hidden (${main.isRowHidden()})`)

    await restorePreset(main)
    expect(errs.length, "the result card:\n" + errs.join("\n")).toBe(0)
  }
}
