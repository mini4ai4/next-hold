// Strict review A, "two viewing modes": Ground (default at open) rings every
// free hold of the marked problem and shows the ghosts 1-2-3; On wall shows
// only the suggested hold's ring (with its glow and label), no ghosts; the
// off-view arrow and its chime still work there. Holds outside the problem stay
// dim in both. Switching changes only what is shown, in the same frame: same
// suggestion, same colours, same position.
// Input path: real SIK pinches on ViewToggle, Toggle_<limb> and Hold_<id>; the
// mode switch is read back inside the pinch's own onTriggerEnd (same frame).
// Readability from where you stand: Ground sizes the ring line, the glow, the
// ghost badges and numbers and the suggestion label from the eye's actual distance
// D from the wall plane (clamped to 110-365 cm): each is its 110 cm size x D / 110,
// text never below its own size. The preset viewpoint is the near case, so Ground
// must use those sizes there, not the 365 cm ones. The test measures D from the
// scene and reads every size from what renders. On wall keeps its own sizes
// (1.6 cm line, label at its 110 cm size), and keeps its one word: the label
// stays in full On wall (also after a move), while Ground still fades it in ~2 s.

import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {HOLDS, HOLD_SIZE, holdById} from "../../Scripts/Wall/WallLayout"
import {NextHoldMain} from "../../Scripts/NextHoldMain"
import {
  AT_110, GROUND_FAR_CM, camera, checkGroundSizes, eyeToWallCm, fmtPos, frames, getMain, groundSizesFor, makeReference, mustFind,
  pinch, pinchCapture, renderedLineWidth, renderedRingColour, restorePreset, textSize,
} from "./NextHoldTestKit"
import {RefPosition} from "./NextHoldReferenceRule"

const RING_LINE_AT_110 = AT_110.ringLine
const LABEL_OWN_SIZE = AT_110.label

interface ViewSnap {
  view: string
  label: string
  pos: string
  suggestion: string
  ringOn: {[id: string]: boolean}
  rendered: {[id: string]: string | null}
  state: {[id: string]: string | null}
  dim: {[id: string]: boolean}
  ghosts: (string | null)[]
  ghostObjs: boolean[]
  glow: boolean
}

function snap(main: NextHoldMain): ViewSnap {
  const s: ViewSnap = {
    view: main.getView(), label: main.getViewLabel(), pos: fmtPos(main.getPosition() as RefPosition),
    suggestion: (() => { const g = main.getSuggestion(); return g ? g.limb + "->" + g.holdId : "none" })(),
    ringOn: {}, rendered: {}, state: {}, dim: {}, ghosts: [], ghostObjs: [], glow: mustFind("SuggestGlow").enabled,
  }
  for (const h of HOLDS) {
    s.ringOn[h.id] = mustFind("Ring_" + h.id).enabled
    s.rendered[h.id] = renderedRingColour(h.id, main)
    s.state[h.id] = main.getHoldColour(h.id)
    s.dim[h.id] = main.isHoldDim(h.id)
  }
  for (let n = 1; n <= 3; n++) {
    s.ghosts.push(main.getGhostHold(n))
    // step 1 is shown by the glow itself; steps 2 and 3 by their badges
    s.ghostObjs.push(n === 1 ? s.glow : mustFind("Ghost_" + n).enabled || mustFind("GhostNumber_" + n).enabled)
  }
  return s
}

/** Ground: every free hold of the problem has its ring, in its colour; ghosts = the look-ahead. */
function checkGround(main: NextHoldMain, s: ViewSnap, errs: string[], tag: string): void {
  if (s.view !== "ground") errs.push(`${tag}: view ${s.view}, want ground`)
  if (s.label !== "Ground") errs.push(`${tag}: ViewToggle reads "${s.label}", want "Ground"`)
  const pos = main.getPosition()
  const occupied = [pos.LH, pos.RH, pos.LF, pos.RF]
  let ringed = 0
  for (const h of HOLDS) {
    const inProblem = main.isInProblem(h.id)
    const free = inProblem && occupied.indexOf(h.id) < 0
    if (free && !s.ringOn[h.id]) errs.push(`${tag}: free problem hold ${h.id} has no ring`)
    if (free && s.rendered[h.id] !== s.state[h.id]) errs.push(`${tag}: Ring_${h.id} renders ${s.rendered[h.id]}, state ${s.state[h.id]}`)
    if (!free && s.ringOn[h.id]) errs.push(`${tag}: ${h.id} (${inProblem ? "occupied" : "outside the problem"}) shows a ring`)
    if (inProblem === s.dim[h.id]) errs.push(`${tag}: ${h.id} dim=${s.dim[h.id]} but in problem=${inProblem}`)
    if (free) ringed++
  }
  const preview = main.getPreview().map((m) => m.holdId)
  if (preview.length < 2) errs.push(`${tag}: look-ahead has ${preview.length} moves`)
  for (let n = 1; n <= 3; n++) {
    const want = n <= preview.length ? preview[n - 1] : null
    if (s.ghosts[n - 1] !== want) errs.push(`${tag}: ghost ${n} on ${s.ghosts[n - 1]}, look-ahead ${want}`)
    if (s.ghostObjs[n - 1] !== !!want) errs.push(`${tag}: ghost ${n} objects enabled ${s.ghostObjs[n - 1]}, want ${!!want}`)
  }
  print(`[N6] ${tag}: ${s.pos}, suggestion ${s.suggestion}, ${ringed} rings, ghosts ${s.ghosts.join(",")}`)
}

/** On wall: exactly one visible ring, the suggestion's, plus its glow; no ghosts. */
function checkOnWall(main: NextHoldMain, s: ViewSnap, errs: string[], tag: string): void {
  if (s.view !== "wall") errs.push(`${tag}: view ${s.view}, want wall`)
  if (s.label !== "On wall") errs.push(`${tag}: ViewToggle reads "${s.label}", want "On wall"`)
  const sug = main.getSuggestion()
  const on = HOLDS.filter((h) => s.ringOn[h.id]).map((h) => h.id)
  if (!sug) errs.push(`${tag}: no suggestion`)
  else {
    if (on.length !== 1 || on[0] !== sug.holdId) errs.push(`${tag}: visible rings [${on.join(",")}], want exactly [${sug.holdId}]`)
    if (s.rendered[sug.holdId] !== s.state[sug.holdId]) errs.push(`${tag}: suggested ring renders ${s.rendered[sug.holdId]}, state ${s.state[sug.holdId]}`)
    if (!s.glow || !main.isRingGlowing(sug.holdId)) errs.push(`${tag}: suggestion ${sug.holdId} not glowing`)
  }
  for (let n = 2; n <= 3; n++) if (s.ghosts[n - 1] !== null || s.ghostObjs[n - 1]) errs.push(`${tag}: badge ${n} still shows`)
  for (const h of HOLDS) if (main.isInProblem(h.id) === s.dim[h.id]) errs.push(`${tag}: ${h.id} dim=${s.dim[h.id]} but in problem=${main.isInProblem(h.id)}`)
  print(`[N6] ${tag}: ${s.pos}, suggestion ${s.suggestion}, visible rings [${on.join(",")}]`)
}

/** The scoring state must not move when only the view changes. */
function sameState(a: ViewSnap, b: ViewSnap, errs: string[], tag: string): void {
  if (a.pos !== b.pos) errs.push(`${tag}: position ${b.pos}, was ${a.pos}`)
  if (a.suggestion !== b.suggestion) errs.push(`${tag}: suggestion ${b.suggestion}, was ${a.suggestion}`)
  for (const h of HOLDS) {
    if (a.state[h.id] !== b.state[h.id]) errs.push(`${tag}: ${h.id} colour ${b.state[h.id]}, was ${a.state[h.id]}`)
  }
}

function holdInView(holdId: string): boolean {
  const def = holdById(holdId)
  const r = def ? HOLD_SIZE[def.type].ringR : 9
  return camera().isSphereVisible(mustFind("Hold_" + holdId).getTransform().getWorldPosition(), r)
}

@component
export class N6ViewModesScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const main = getMain()
    await restorePreset(main)
    const errs: string[] = []

    // ── Ground at open ──
    const g0 = snap(main)
    checkGround(main, g0, errs, "ground at open")

    // readable from where you stand: sized for the eye's real distance from the wall, not for 365 cm
    const eyeCm = eyeToWallCm(camera())
    const atEye = groundSizesFor(eyeCm)
    const far = groundSizesFor(GROUND_FAR_CM)
    const sizedCm = main.getGroundSizedCm()
    if (Math.abs(sizedCm - atEye.D) > 2) errs.push(`ground: sized for ${sizedCm.toFixed(1)} cm, but the eye is ${eyeCm.toFixed(1)} cm from the wall`)
    print(`[N6] ground at the preset viewpoint: eye ${eyeCm.toFixed(1)} cm from the wall, Lens sized for ${sizedCm.toFixed(1)} cm; ${checkGroundSizes(main, eyeCm, errs, "ground at open")}`)
    // and plainly not the far sizes (5.3 cm line, label 129): the preset is the near case
    if (!(eyeCm < 200)) errs.push(`setup: the preset viewpoint is ${eyeCm.toFixed(0)} cm back; this check wants the near case`)
    const sugG = main.getSuggestion()
    const lineNow = sugG ? renderedLineWidth(sugG.holdId) : NaN
    const labelNow = textSize("SuggestLabel")
    if (!(lineNow < (atEye.line + far.line) / 2)) errs.push(`ground at open: ring line ${lineNow.toFixed(2)} cm is nearer the 365 cm width ${far.line.toFixed(2)} than the ${atEye.D.toFixed(0)} cm one ${atEye.line.toFixed(2)}`)
    if (!(labelNow < (atEye.label + far.label) / 2)) errs.push(`ground at open: label ${labelNow.toFixed(1)} is nearer the 365 cm size ${far.label.toFixed(1)} than ${atEye.label.toFixed(1)}`)

    // ── pinch the view switch: On wall, read in the same frame ──
    const toWall = await pinchCapture("ViewToggle", () => snap(main))
    if (!toWall.fired || !toWall.value) errs.push("ViewToggle pinch (to On wall) did not fire")
    else {
      checkOnWall(main, toWall.value, errs, "on wall, pinch frame")
      sameState(g0, toWall.value, errs, "ground -> on wall")
    }
    await frames(3)
    checkOnWall(main, snap(main), errs, "on wall, 3 frames later")
    // On wall keeps its own sizes
    const sugW = main.getSuggestion()
    const wallLine = sugW ? renderedLineWidth(sugW.holdId) : NaN
    const wallLabel = textSize("SuggestLabel")
    print(`[N6] on wall sizes: ring line ${wallLine.toFixed(2)} cm, label ${wallLabel.toFixed(1)}`)
    if (!(Math.abs(wallLine - RING_LINE_AT_110) < 0.01)) errs.push(`on wall: ring line ${wallLine.toFixed(2)} cm, want ${RING_LINE_AT_110}`)
    if (Math.abs(wallLabel - LABEL_OWN_SIZE) > 0.01) errs.push(`on wall: label size ${wallLabel.toFixed(1)}, want its own ${LABEL_OWN_SIZE.toFixed(1)}`)
    // On wall keeps its word: well past the 2 s fade the label still shows, in full
    await sleep(3000)
    const wallSug = main.getSuggestion()
    const wallLabelOn = mustFind("SuggestLabel").enabled
    print(`[N6] on wall, 3 s later: label "${main.getLabelText()}" shown ${wallLabelOn}, opacity ${main.getLabelOpacity().toFixed(2)}`)
    if (!wallLabelOn || main.getLabelOpacity() < 0.99) errs.push(`on wall: the label faded (shown ${wallLabelOn}, opacity ${main.getLabelOpacity().toFixed(2)}) 3 s after switching`)
    if (wallSug && main.getLabelText() !== wallSug.label) errs.push(`on wall: label reads "${main.getLabelText()}", want "${wallSug.label}"`)

    // ── pinch it again: Ground, every ring back, same colours, same frame ──
    const toGround = await pinchCapture("ViewToggle", () => snap(main))
    if (!toGround.fired || !toGround.value) errs.push("ViewToggle pinch (to Ground) did not fire")
    else {
      checkGround(main, toGround.value, errs, "ground again, pinch frame")
      sameState(g0, toGround.value, errs, "on wall -> ground")
      for (const h of HOLDS) {
        if (toGround.value.ringOn[h.id] !== g0.ringOn[h.id] || toGround.value.rendered[h.id] !== g0.rendered[h.id]) {
          errs.push(`back on ground: Ring_${h.id} ${toGround.value.ringOn[h.id]}/${toGround.value.rendered[h.id]}, was ${g0.ringOn[h.id]}/${g0.rendered[h.id]}`)
        }
      }
      if (toGround.value.ghosts.join() !== g0.ghosts.join()) errs.push(`back on ground: ghosts ${toGround.value.ghosts.join()}, were ${g0.ghosts.join()}`)
    }
    // Ground still fades the label: shown on return, gone ~2 s later
    await frames(2)
    const backOn = main.isLabelVisible()
    await sleep(2600)
    print(`[N6] back on ground: label shown on return ${backOn}, 2.6 s later ${main.isLabelVisible()}`)
    if (!backOn) errs.push("back on ground: the label did not show on return")
    if (main.isLabelVisible()) errs.push(`back on ground: the label still shows 2.6 s later (opacity ${main.getLabelOpacity().toFixed(2)})`)
    // ── On wall still follows a move: one ring, on the new suggestion ──
    await pinch("ViewToggle")
    await frames(2)
    const sug = main.getSuggestion()!
    const moved = await pinchCapture("Hold_" + sug.holdId, () => snap(main))
    if (!moved.fired || !moved.value) errs.push(`Hold_${sug.holdId} pinch did not fire`)
    else checkOnWall(main, moved.value, errs, `on wall, after ${sug.limb} -> ${sug.holdId}`)
    await sleep(2600)
    const next = main.getSuggestion()
    if (next && (!main.isLabelVisible() || main.getLabelOpacity() < 0.99 || main.getLabelText() !== next.label)) {
      errs.push(`on wall, 2.6 s after the move: label "${main.getLabelText()}" opacity ${main.getLabelOpacity().toFixed(2)}, want "${next.label}" in full`)
    }

    // ── On wall: the off-view arrow and chime still work. Shortest run of up to three
    //    moves (as in C4) after which the reference's best move is out of the camera's view ──
    const ref = makeReference()
    const pos0 = main.getPosition() as RefPosition
    type Step = {limb: string; holdId: string}
    let path: Step[] | null = null
    let frontier: {pos: RefPosition; steps: Step[]}[] = [{pos: pos0, steps: []}]
    const seen: {[k: string]: boolean} = {[fmtPos(pos0)]: true}
    for (let depth = 0; depth < 3 && !path; depth++) {
      const next: {pos: RefPosition; steps: Step[]}[] = []
      for (const node of frontier) {
        for (const l of ["RF", "LF", "RH", "LH"]) {
          for (const r of ref.evaluate(l as any, node.pos).results) {
            const pos = {...node.pos, [l]: r.holdId} as RefPosition
            const k = fmtPos(pos)
            if (seen[k]) continue
            seen[k] = true
            const steps = node.steps.concat([{limb: l, holdId: r.holdId}])
            const b = ref.bestMove(pos)
            if (b && !holdInView(b.holdId)) { path = steps; break }
            next.push({pos, steps})
          }
          if (path) break
        }
        if (path) break
      }
      frontier = next
    }
    if (!path) errs.push("setup: no run of up to three moves leads to an off-view suggestion")
    else {
      const audioSO = mustFind("OffViewArrowMesh").getParent()
      const audio = audioSO ? audioSO.getComponent("Component.AudioComponent") as AudioComponent : null
      if (audio) audio.stop(false)
      let chimed = false
      for (const s of path) {
        await pinch("Toggle_" + s.limb)
        await frames(2)
        await pinch("Hold_" + s.holdId)
        for (let f = 0; f < 4; f++) {
          await frames(1)
          if (audio && audio.isPlaying()) chimed = true
        }
      }
      const s1 = snap(main)
      const sug1 = main.getSuggestion()
      checkOnWall(main, s1, errs, `on wall, after ${path.map((s) => s.limb + "->" + s.holdId).join(", ")}`)
      const off = sug1 ? !holdInView(sug1.holdId) : false
      print(`[N6] on wall off-view: suggestion ${s1.suggestion} in view ${!off}, arrow ${main.isOffViewArrowVisible()}, chime heard ${chimed}`)
      if (!off) errs.push(`setup: suggestion ${s1.suggestion} is still in view`)
      if (!main.isOffViewArrowVisible() || !mustFind("OffViewArrowMesh").enabled) errs.push("on wall: arrow hidden while the suggestion is out of view")
      if (!audio) errs.push("on wall: no chime AudioComponent")
      else if (!chimed) errs.push("on wall: the chime did not play when the arrow appeared")
    }

    await restorePreset(main)
    if (main.getView() !== "ground") errs.push("restore did not bring the view back to Ground")
    expect(errs.length, "view-mode mismatches:\n" + errs.join("\n")).toBe(0)
  }
}
