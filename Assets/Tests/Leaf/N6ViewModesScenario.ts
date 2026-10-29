// Strict review A, "two viewing modes": Ground (default at open) rings every
// free hold of the marked problem and shows the ghosts 1-2-3; On wall shows
// only the suggested hold's ring (with its glow and label), no ghosts; the
// off-view arrow and its chime still work there. Holds outside the problem stay
// dim in both. Switching changes only what is shown, in the same frame: same
// suggestion, same colours, same position.
// Input path: real SIK pinches on ViewToggle, Toggle_<limb> and Hold_<id>; the
// mode switch is read back inside the pinch's own onTriggerEnd (same frame).
// Readability from the ground: apparent size goes as 1 / distance, so from the
// Ground distance D the ghost numbers and the suggestion label must be at least
// Body (size 39) x D / 110, and the rings' crisp line at least its 110 cm width
// (1.6 cm) x D / 110. The line width is read from the rendered Ring mesh. On wall
// keeps its own sizes (1.6 cm line, label at its 110 cm size).

import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {HOLDS, HOLD_SIZE, holdById} from "../../Scripts/Wall/WallLayout"
import {RING_PROFILE} from "../../Scripts/Wall/ProceduralTextures"
import {NextHoldMain} from "../../Scripts/NextHoldMain"
import {camera, fmtPos, frames, getMain, makeReference, mustFind, pinch, pinchCapture, renderedRingColour, restorePreset} from "./NextHoldTestKit"
import {RefPosition} from "./NextHoldReferenceRule"

const BODY_SIZE_AT_110 = 39
const RING_LINE_AT_110 = RING_PROFILE.core
/** the label's own size: HeadlineXL (62) x 1.3 */
const LABEL_OWN_SIZE = 62 * 1.3

/**
 * Width (cm) of the crisp line of the rendered Ring_<id>: the ring texture's core runs from
 * U = inner / total to U = (inner + core) / total, so it is the radius at the second minus the first.
 */
function renderedLineWidth(id: string): number {
  const mesh = (mustFind("Ring_" + id).getComponent("Component.RenderMeshVisual") as RenderMeshVisual).mesh
  const pos = mesh.getVertexDataForAttribute("position")
  const uv = mesh.getVertexDataForAttribute("texture0")
  const {inner, core, outer} = RING_PROFILE
  const total = inner + core + outer
  const radiusAt = (u: number) => {
    for (let i = 0; i * 2 < uv.length; i++) {
      if (Math.abs(uv[i * 2] - u) < 1e-4) return Math.hypot(pos[i * 3], pos[i * 3 + 1])
    }
    return NaN
  }
  return radiusAt((inner + core) / total) - radiusAt(inner / total)
}

function textSize(name: string): number {
  return (mustFind(name).getComponent("Component.Text") as Text).size
}

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
    s.ghostObjs.push(mustFind("Ghost_" + n).enabled || mustFind("GhostNumber_" + n).enabled)
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
  for (let n = 1; n <= 3; n++) if (s.ghosts[n - 1] !== null || s.ghostObjs[n - 1]) errs.push(`${tag}: ghost ${n} still shows`)
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

    // readable from the ground: apparent size at D vs the same thing at 110 cm
    const D = main.getGroundViewCm()
    const need = BODY_SIZE_AT_110 * D / 110
    const needLine = RING_LINE_AT_110 * D / 110
    for (let n = 1; n <= 3; n++) {
      if (!g0.ghosts[n - 1]) continue
      const size = textSize("GhostNumber_" + n)
      if (size < need) errs.push(`ground: ghost ${n} number size ${size.toFixed(1)} reads smaller than Body at ${D} cm (need ${need.toFixed(1)})`)
    }
    const labelSize = textSize("SuggestLabel")
    if (labelSize < need) errs.push(`ground: suggestion label size ${labelSize.toFixed(1)} < ${need.toFixed(1)}`)
    const lines = HOLDS.filter((h) => g0.ringOn[h.id]).map((h) => renderedLineWidth(h.id))
    const thinnest = Math.min(...lines)
    if (!(thinnest >= needLine - 0.01)) errs.push(`ground: thinnest ring line ${thinnest.toFixed(2)} cm < ${needLine.toFixed(2)} cm`)
    print(`[N6] ground readability at ${D} cm: ghost number ${textSize("GhostNumber_1").toFixed(1)}, label ${labelSize.toFixed(1)}, need >= ${need.toFixed(1)}; ring line ${thinnest.toFixed(2)} cm (${lines.length} rings), need >= ${needLine.toFixed(2)}`)

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

    // ── On wall still follows a move: one ring, on the new suggestion ──
    await pinch("ViewToggle")
    await frames(2)
    const sug = main.getSuggestion()!
    const moved = await pinchCapture("Hold_" + sug.holdId, () => snap(main))
    if (!moved.fired || !moved.value) errs.push(`Hold_${sug.holdId} pinch did not fire`)
    else checkOnWall(main, moved.value, errs, `on wall, after ${sug.limb} -> ${sug.holdId}`)

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
