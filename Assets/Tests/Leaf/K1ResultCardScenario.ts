// Session 24, v7 part B: the climb in climbing's own words. Every top here is real pinches from the preset,
// each on the hold of the test's own best move (with beta hidden there is no glow to follow).
// - Go 1, beta hidden, no hint: in the top-out pinch's own frame the result is kept but no card shows ("TOPPED"
//   has the moment); once TOPPED has faded the card is on the mats, in view and over no ring:
//   "ONSIGHT" / "N moves · par for your body P" / "Clean onsight. Pick something harder?", P the test's own route
//   search from the start at 175 cm; "Again" under it, at least 10 x 10 cm.
// - The store (a fresh one handed in): under the key for this problem and height, 1 go, best ONSIGHT.
// - A real pinch on Again: back on the start holds in its own frame, no card, go 2, beta hidden.
// - Go 2 with "Show my beta": "SEND (attempt 2)" / moves and par / "Hints: 0 · Best: ONSIGHT, N moves".
// - Go 3 with one hint (rung 2): "SEND (attempt 3)" / ... / "Hints: 1 · Best: ONSIGHT, N moves".
// - Another height is another problem: at 195 cm, go 1 with beta: "FLASH" / par for 195 / "Hints: 0 · New best".
// No timer and no points on any card.

import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {TOPPED_FADE_SECONDS, TOPPED_SECONDS} from "../../Scripts/NextHoldMain"
import {NextHoldMain} from "../../Scripts/NextHoldMain"
import {HOLDS, HOLD_SIZE} from "../../Scripts/Wall/WallLayout"
import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import {camera, climbByRule, fmtBox, fmtPos, frames, getMain, mustFind, parFor, pinch, pinchCapture, presetPosition, restorePreset, samePosition, screenBoxOf} from "./NextHoldTestKit"
import {RefPosition} from "./NextHoldReferenceRule"

/** wait out TOPPED, then read the card */
async function cardAfterTop(main: NextHoldMain, topTime: number): Promise<string[]> {
  while (getTime() - topTime < TOPPED_SECONDS + TOPPED_FADE_SECONDS + 0.3) await frames(1)
  await frames(2)
  return main.getResultLines()
}

/** the card and Again are on screen, Again is big, and neither lies over a ring of the problem */
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
  const again = mustFind("AgainButton").getComponent(Button.getTypeName()) as Button
  if (again.size.x < 10 || again.size.y < 10) errs.push(`${tag}: Again is ${again.size.x} x ${again.size.y} cm`)
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
    main.reloadFromStore()
    await frames(2)
    const start = presetPosition()
    const par175 = parFor(start, 175)
    if (main.getAttempt() !== 1) errs.push(`setup: go ${main.getAttempt()}, want 1 with a fresh store`)
    if (main.getPar() !== par175) errs.push(`par: the Lens says ${main.getPar()}, the test's route search ${par175}`)

    // ── go 1: hidden, no hint ──
    const g1 = await climbByRule(main, errs, "go 1")
    print(`[K1] go 1: ${g1.moves.join(", ")}; top frame ${JSON.stringify(g1.top)}`)
    if (g1.top && (!g1.top.result || g1.top.card || g1.top.again)) errs.push(`go 1, the top-out frame: result kept ${g1.top.result}, card ${g1.top.card}, Again ${g1.top.again}: the card waits for TOPPED`)
    const l1 = await cardAfterTop(main, g1.time)
    print(`[K1] go 1 card: ${l1.join(" | ")} (par from the test: ${par175})`)
    const want1 = ["ONSIGHT", `${g1.moves.length} moves · par for your body ${par175}`, "Clean onsight. Pick something harder?"]
    if (l1.join("|") !== want1.join("|")) errs.push(`go 1 card: "${l1.join(" | ")}", want "${want1.join(" | ")}"`)
    if (!main.isResultVisible() || !main.isAgainVisible() || !mustFind("ResultCard").enabled) errs.push(`go 1: card ${main.isResultVisible()}, Again ${main.isAgainVisible()}`)
    checkCardPlace(main, errs, "go 1")
    // kept
    const key = main.getBestKey()
    const kept = store.has(key) ? store.getString(key) : ""
    print(`[K1] kept under ${key}: ${kept}; store max ${main.getStoreMaxBytes()} bytes`)
    let rec: any = null
    try { rec = JSON.parse(kept) } catch (e) { rec = null }
    if (!rec || rec.g !== 1 || !rec.b || rec.b.t !== "ONSIGHT" || rec.b.m !== g1.moves.length || rec.b.n !== 1 || rec.b.h !== 0) errs.push(`go 1 kept: "${kept}"`)

    // ── Again: back to the start holds in its own frame ──
    const again = await pinchCapture("AgainButton", () => ({pos: main.getPosition() as RefPosition, card: main.isResultVisible(), go: main.getAttempt(), beta: main.isBetaShown(), moves: main.getMovesMade()}))
    print(`[K1] Again: ${JSON.stringify(again.value)}`)
    if (!again.value || !samePosition(again.value.pos, start) || again.value.card || again.value.go !== 2 || again.value.beta || again.value.moves !== 0) errs.push(`Again's frame: ${JSON.stringify(again.value)}, want ${fmtPos(start)}, no card, go 2, beta hidden, 0 moves`)
    await frames(3)
    if (main.isAgainVisible()) errs.push("Again stays after its pinch")

    // ── go 2, with beta: a SEND, and the best is still the onsight ──
    await pinch("ShowBetaButton"); await frames(2)
    const g2 = await climbByRule(main, errs, "go 2")
    const l2 = await cardAfterTop(main, g2.time)
    print(`[K1] go 2 card: ${l2.join(" | ")}`)
    const want2 = ["SEND (attempt 2)", `${g2.moves.length} moves · par for your body ${par175}`, `Hints: 0 · Best: ONSIGHT, ${g1.moves.length} moves`]
    if (l2.join("|") !== want2.join("|")) errs.push(`go 2 card: "${l2.join(" | ")}", want "${want2.join(" | ")}"`)

    // ── go 3, one hint (rung 2): counted ──
    await pinch("AgainButton"); await frames(3)
    await pinch("AskButton"); await frames(2)
    await pinch("AskButton"); await frames(2)
    if (main.getHintsThisGo() !== 1) errs.push(`go 3: hints ${main.getHintsThisGo()} after rung 2`)
    const g3 = await climbByRule(main, errs, "go 3")
    const l3 = await cardAfterTop(main, g3.time)
    print(`[K1] go 3 card: ${l3.join(" | ")}`)
    if (l3[0] !== "SEND (attempt 3)" || l3[2] !== `Hints: 1 · Best: ONSIGHT, ${g1.moves.length} moves`) errs.push(`go 3 card: "${l3.join(" | ")}"`)
    if (/\d:\d\d|point|pts/i.test(l1.concat(l2, l3).join(" "))) errs.push("a card shows a time or points")

    // ── 195 cm is another body: its own record, go 1 with beta, a FLASH ──
    await pinch("AgainButton"); await frames(3)
    for (let i = 0; i < 4; i++) { await pinch("HeightUp"); await frames(2) }
    main.reloadFromStore()
    await frames(2)
    const par195 = parFor(start, 195)
    if (main.getHeightCm() !== 195 || main.getAttempt() !== 1 || main.getBestKey() === key) errs.push(`195 cm: height ${main.getHeightCm()}, go ${main.getAttempt()}, key ${main.getBestKey()} (175's ${key})`)
    await pinch("ShowBetaButton"); await frames(2)
    const g4 = await climbByRule(main, errs, "195 cm")
    const l4 = await cardAfterTop(main, g4.time)
    print(`[K1] 195 cm card: ${l4.join(" | ")} (par from the test: ${par195})`)
    const want4 = ["FLASH", `${g4.moves.length} moves · par for your body ${par195}`, "Hints: 0 · New best"]
    if (l4.join("|") !== want4.join("|")) errs.push(`195 cm card: "${l4.join(" | ")}", want "${want4.join(" | ")}"`)
    // the 175 record is untouched by it
    if (JSON.parse(store.getString(key)).g !== 3) errs.push(`the 175 cm record: ${store.getString(key)}, want 3 goes`)

    // ── a move takes the card down (the hand off the top climbs on) ──
    await pinch("AgainButton"); await frames(2)
    if (main.isResultVisible() || main.getLastResult()) errs.push("Again left the card")

    await restorePreset(main)
    expect(errs.length, "the result card:\n" + errs.join("\n")).toBe(0)
  }
}
