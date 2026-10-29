// Review item 1, "Mark your problem": in setup mode a pinch on a hold adds it to
// "your problem" and opens its picker (a pinch on a marked hold reopens it; Remove
// takes it out), the picker's Start and Top buttons set the start holds and the
// top hold, in any order with the type (session 15: the type used to close the
// picker first), Done closes it, and every marked hold shows a marked state
// (Mark_<id> ring, START / TOP tag). Outside setup only the problem's holds are
// scored and ringed; the other holds stay visible but dim, with no ring, and a
// pinch on one moves nothing.
// Input path: real SIK pinches on ModeSwitch, Hold_<id>, StartButton,
// TopButton, TypeButton_<type>, DoneButton and RemoveButton. Expected rings come from the test's own
// port of scoring.js over the expected problem.

import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {HOLDS, PRESET_START, PRESET_TOP} from "../../Scripts/Wall/WallLayout"
import {NextHoldMain} from "../../Scripts/NextHoldMain"
import {
  BRIEF_REACH, fmtPos, frames, getMain, isPresetProblem, mustFind, pinch, presetProblem, presetTypes,
  renderedRingColour, restorePreset, samePosition, sceneHoldCoords,
} from "./NextHoldTestKit"
import {RefPosition, RefPt, ReferenceRule} from "./NextHoldReferenceRule"

/** a hold outside the preset problem, and one inside it that no limb is on */
const OUTSIDE = "h12"
const DROP = "h11"

function checkClimbView(main: NextHoldMain, problem: string[], errs: string[], tag: string): void {
  const all = sceneHoldCoords()
  const coords: {[id: string]: RefPt} = {}
  for (const id of problem) coords[id] = all[id]
  const ref = new ReferenceRule(coords, presetTypes(), BRIEF_REACH)
  const pos = main.getPosition() as RefPosition
  const ev = ref.evaluate(main.getSelectedLimb() as any, pos)
  const want: {[id: string]: string} = {}
  for (const r of ev.results) want[r.holdId] = r.colour
  for (const h of HOLDS) {
    const inP = problem.indexOf(h.id) >= 0
    const rc = renderedRingColour(h.id, main)
    if (!inP) {
      if (rc !== null) errs.push(`${tag}: ${h.id} is outside the problem but renders a ${rc} ring`)
      if (!main.isHoldDim(h.id)) errs.push(`${tag}: ${h.id} is outside the problem but not dim`)
      if (!mustFind("Hold_" + h.id).enabled) errs.push(`${tag}: ${h.id} is hidden, should stay visible`)
    } else {
      if (main.isHoldDim(h.id)) errs.push(`${tag}: problem hold ${h.id} is dim`)
      if ((want[h.id] || null) !== rc) errs.push(`${tag}: Ring_${h.id} renders ${rc}, reference over the problem ${want[h.id] || null}`)
    }
    if (main.isMarkVisible(h.id)) errs.push(`${tag}: Mark_${h.id} shows outside setup`)
    // outside setup the only tag is "TOP" on the problem's top hold, and only in Ground
    const wantTag = main.getView() === "ground" && h.id === main.getTopHold() ? "TOP" : null
    if (main.getTagText(h.id) !== wantTag) errs.push(`${tag}: tag "${main.getTagText(h.id)}" on ${h.id} outside setup, want ${wantTag ? '"' + wantTag + '"' : "none"}`)
  }
}

@component
export class N1MarkProblemScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const main = getMain()
    await restorePreset(main)
    const errs: string[] = []

    // ── climb mode at the preset: problem holds ringed, the rest dim, no ring ──
    const preset = presetProblem()
    if (preset.length < 8 || preset.length > 10) errs.push(`preset problem has ${preset.length} holds (want about 8-10)`)
    if (main.getTopHold() !== PRESET_TOP) errs.push(`top hold ${main.getTopHold()}, want ${PRESET_TOP}`)
    const coords = sceneHoldCoords()
    for (const id of preset) {
      if (id !== PRESET_TOP && coords[id].y >= coords[PRESET_TOP].y) errs.push(`top ${PRESET_TOP} is not the clear top: ${id} is as high`)
    }
    checkClimbView(main, preset, errs, "climb at preset")

    // a pinch on a hold outside the problem is not a move
    const pos0 = main.getPosition() as RefPosition
    await pinch("Hold_" + OUTSIDE)
    await frames(3)
    if (!samePosition(main.getPosition() as RefPosition, pos0)) errs.push(`pinch on ${OUTSIDE} (outside the problem) moved a limb: ${fmtPos(main.getPosition() as RefPosition)}`)

    // ── setup mode: the marked state ──
    await pinch("ModeSwitch")
    await frames(3)
    if (main.getMode() !== "setup") errs.push(`ModeSwitch pinch: mode ${main.getMode()}`)
    for (const h of HOLDS) {
      const inP = isPresetProblem(h.id)
      if (main.isMarkVisible(h.id) !== inP) errs.push(`setup: Mark_${h.id} visible=${main.isMarkVisible(h.id)}, in problem=${inP}`)
      if (inP && !mustFind("Mark_" + h.id).enabled) errs.push(`setup: Mark_${h.id} object disabled`)
      if (main.isHoldDim(h.id)) errs.push(`setup: ${h.id} is dim (setup shows the whole wall lit)`)
      if (renderedRingColour(h.id, main) !== null) errs.push(`setup: ${h.id} shows a score ring`)
      const wantTag = PRESET_START.indexOf(h.id) >= 0 ? "START" : h.id === PRESET_TOP ? "TOP" : null
      if (main.getTagText(h.id) !== wantTag) errs.push(`setup: tag on ${h.id} "${main.getTagText(h.id)}", want "${wantTag}"`)
    }

    // ── pinch a hold outside the problem: it joins, picker opens beside it ──
    await pinch("Hold_" + OUTSIDE)
    await frames(3)
    if (!main.isInProblem(OUTSIDE)) errs.push(`pinch on ${OUTSIDE} in setup did not add it to the problem`)
    if (!main.isMarkVisible(OUTSIDE) || !mustFind("Mark_" + OUTSIDE).enabled) errs.push(`Mark_${OUTSIDE} not shown after adding it`)
    if (!main.isTypePickerVisible() || main.getPickerHold() !== OUTSIDE) errs.push(`picker not open for ${OUTSIDE} (${main.getPickerHold()})`)
    if (main.isStartLit() || main.isTopLit()) errs.push("Start/Top lit for a hold that is neither")

    // session 15, the setup ordering: the type FIRST. It used to close the picker, so Start and Top
    // then did nothing. Now the picker stays open and they work in any order.
    await pinch("TypeButton_crimp")
    await frames(3)
    if (main.getHoldType(OUTSIDE) !== "crimp") errs.push(`type of ${OUTSIDE} is ${main.getHoldType(OUTSIDE)}, want crimp`)
    if (!main.isTypePickerVisible() || main.getPickerHold() !== OUTSIDE) errs.push("order: picking a type closed the picker (Start / Top would no longer work)")
    if (main.getPickerLitType() !== "crimp") errs.push(`order: the picker lights ${main.getPickerLitType()}, want crimp`)

    await pinch("StartButton")
    await frames(3)
    if (main.getStartHolds().indexOf(OUTSIDE) < 0) errs.push(`order: StartButton after the type: ${OUTSIDE} not a start hold (${main.getStartHolds().join(",")})`)
    if (!main.isStartLit()) errs.push("StartButton not lit after pinch")
    if (main.getTagText(OUTSIDE) !== "START") errs.push(`tag on ${OUTSIDE} "${main.getTagText(OUTSIDE)}", want START`)

    await pinch("TopButton")
    await frames(3)
    if (main.getTopHold() !== OUTSIDE) errs.push(`order: TopButton after the type: top is ${main.getTopHold()}, want ${OUTSIDE}`)
    if (!main.isTopLit()) errs.push("TopButton not lit after pinch")
    if (main.getTagText(OUTSIDE) !== "START · TOP") errs.push(`tag on ${OUTSIDE} "${main.getTagText(OUTSIDE)}", want "START · TOP"`)
    if (main.getTagText(PRESET_TOP) !== null) errs.push(`old top ${PRESET_TOP} still tagged "${main.getTagText(PRESET_TOP)}"`)

    // and a type again after Start / Top: still open, still counts
    await pinch("TypeButton_pinch")
    await frames(3)
    if (main.getHoldType(OUTSIDE) !== "pinch" || !main.isTypePickerVisible()) errs.push(`order: a second type: ${main.getHoldType(OUTSIDE)}, picker open ${main.isTypePickerVisible()}`)

    await pinch("DoneButton")
    await frames(3)
    if (main.isTypePickerVisible()) errs.push("DoneButton did not close the picker")
    if (!main.isInProblem(OUTSIDE) || main.getTagText(OUTSIDE) !== "START · TOP") errs.push(`after Done: in problem ${main.isInProblem(OUTSIDE)}, tag "${main.getTagText(OUTSIDE)}"`)

    // ── pinch it again: its picker reopens with what was set; Remove takes it out ──
    await pinch("Hold_" + OUTSIDE)
    await frames(3)
    if (!main.isInProblem(OUTSIDE)) errs.push(`a pinch on a marked hold took ${OUTSIDE} out; it should reopen its picker`)
    if (!main.isTypePickerVisible() || main.getPickerHold() !== OUTSIDE) errs.push(`picker did not reopen for ${OUTSIDE}`)
    if (main.getPickerLitType() !== "pinch" || !main.isStartLit() || !main.isTopLit()) {
      errs.push(`reopened picker shows ${main.getPickerLitType()}, Start ${main.isStartLit()}, Top ${main.isTopLit()}; want pinch, lit, lit`)
    }
    await pinch("RemoveButton")
    await frames(3)
    if (main.isTypePickerVisible()) errs.push("RemoveButton did not close the picker")
    if (main.isInProblem(OUTSIDE)) errs.push(`RemoveButton did not take ${OUTSIDE} out of the problem`)
    if (main.isMarkVisible(OUTSIDE)) errs.push(`Mark_${OUTSIDE} still shown after taking it out`)
    if (main.getTagText(OUTSIDE) !== null) errs.push(`tag "${main.getTagText(OUTSIDE)}" still on ${OUTSIDE}`)
    if (main.getStartHolds().indexOf(OUTSIDE) >= 0) errs.push(`${OUTSIDE} still counts as a start hold`)
    if (main.getTopHold() !== null) errs.push(`top is ${main.getTopHold()} after taking the top out`)

    // ── take a problem hold out, back to climb: rings follow the problem ──
    await pinch("Hold_" + DROP)
    await frames(3)
    await pinch("RemoveButton")
    await frames(3)
    if (main.isInProblem(DROP) || main.isMarkVisible(DROP)) errs.push(`${DROP} still marked after Remove in setup`)
    await pinch("ModeSwitch")
    await frames(3)
    if (main.getMode() !== "climb") errs.push(`ModeSwitch pinch: mode ${main.getMode()}`)
    const expected = preset.filter((id) => id !== DROP)
    checkClimbView(main, expected, errs, `climb without ${DROP}`)
    print(`[N1] problem now ${main.getProblemHolds().join(",")}; start ${main.getStartHolds().join(",")}; top ${main.getTopHold()}`)

    await restorePreset(main)
    expect(errs.length, "mark-your-problem mismatches:\n" + errs.join("\n")).toBe(0)
  }
}
