// Strict review B, "body readability": a thin, light stick figure on the wall
// plane joins the four limb markers to a torso point at the centre of mass the
// scoring uses. After a limb moves, the figure's end points match the limb
// positions in the same frame.
// End points are read from what renders: each Figure_<limb> line is a unit
// mesh along local +X, so its world start is the transform applied to (0,0,0)
// and its world end the transform applied to (1,0,0). The expected centre of
// mass comes from the test's own port of scoring.js (NextHoldReferenceRule).
// The figure must not run through the control row: where a line passes behind
// the row's plate, as the eye sees it, it fades out. The test projects the
// plate's four corners from the eye onto the wall itself, then reads each line's
// brightness along its length from the rendered mesh (the centre vertices' U:
// the core's U = full, near 0 = faded) and checks every sample behind the plate
// is faded and every sample well clear of it is full.

import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {HOLD_SIZE, holdById} from "../../Scripts/Wall/WallLayout"
import {HOVER_PROFILE} from "../../Scripts/Wall/ProceduralTextures"
import {NextHoldMain} from "../../Scripts/NextHoldMain"
import {camera, fmtPos, frames, getMain, makeReference, mustFind, pinch, pinchCapture, restorePreset} from "./NextHoldTestKit"
import {REF_LIMBS, RefPosition} from "./NextHoldReferenceRule"

const TOL = 0.5 // cm in the wall plane
/** a line is "full" here or further from the plate's outline (the Lens fades from 1.5 cm out over 4 cm) */
const CLEAR_CM = 6
const FULL_U = (HOVER_PROFILE.coreAt + HOVER_PROFILE.coreW / 2) / HOVER_PROFILE.span

/** the control row plate's outline on the wall (wall-local cm), projected from the eye */
function plateOnWall(main: NextHoldMain): {x: number; y: number}[] {
  const size = main.controlRow.getSize()
  if (!size) throw new Error("control row has no laid-out size")
  const toWall = mustFind("ClimbingWall (stand-in)").getTransform().getInvertedWorldTransform()
  const row = main.controlRow.getSceneObject().getTransform().getWorldTransform()
  const eye = toWall.multiplyPoint(camera().getSceneObject().getTransform().getWorldPosition())
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => {
    const c = toWall.multiplyPoint(row.multiplyPoint(new vec3(sx * size.x / 2, sy * size.y / 2, 0)))
    const k = eye.z / (eye.z - c.z)
    return {x: eye.x + k * (c.x - eye.x), y: eye.y + k * (c.y - eye.y)}
  })
}

/** largest signed distance to the outline's edges: <= 0 inside, else a lower bound of the distance outside */
function outside(poly: {x: number; y: number}[], p: {x: number; y: number}): number {
  let area = 0
  for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length]; area += a.x * b.y - b.x * a.y }
  const sgn = area >= 0 ? 1 : -1
  let worst = -1e9
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length]
    const l = Math.hypot(b.x - a.x, b.y - a.y) || 1
    worst = Math.max(worst, (sgn * ((b.y - a.y) * (p.x - a.x) - (b.x - a.x) * (p.y - a.y))) / l)
  }
  return worst
}

/** brightness (0..1) of the rendered Figure_<limb> line at t along it, from its mesh's centre vertices */
function lineBrightness(limb: string): (t: number) => number {
  const mesh = (mustFind("Figure_" + limb).getComponent("Component.RenderMeshVisual") as RenderMeshVisual).mesh
  const pos = mesh.getVertexDataForAttribute("position")
  const uv = mesh.getVertexDataForAttribute("texture0")
  const st: {t: number; f: number}[] = []
  for (let i = 0; i * 3 < pos.length; i++) if (Math.abs(pos[i * 3 + 1]) < 1e-4) st.push({t: pos[i * 3], f: uv[i * 2] / FULL_U})
  st.sort((a, b) => a.t - b.t)
  return (t: number) => {
    for (let i = 1; i < st.length; i++) {
      if (t <= st[i].t + 1e-6) {
        const a = st[i - 1], b = st[i]
        return b.t - a.t < 1e-6 ? b.f : a.f + ((t - a.t) / (b.t - a.t)) * (b.f - a.f)
      }
    }
    return st.length ? st[st.length - 1].f : 0
  }
}

/** Behind the plate every sample is faded, well clear of it every sample is full. Returns the count of samples behind it. */
function checkFade(main: NextHoldMain, errs: string[], tag: string): number {
  const plate = plateOnWall(main)
  const wallInv = mustFind("ClimbingWall (stand-in)").getTransform().getInvertedWorldTransform()
  let behind = 0
  const notes: string[] = []
  for (const l of REF_LIMBS) {
    const so = mustFind("Figure_" + l)
    if (!so.enabled) continue
    const m = so.getTransform().getWorldTransform()
    const a = wallInv.multiplyPoint(m.multiplyPoint(vec3.zero())), b = wallInv.multiplyPoint(m.multiplyPoint(new vec3(1, 0, 0)))
    const f = lineBrightness(l)
    let inN = 0, badIn = 0, badOut = 0
    for (let i = 0; i <= 200; i++) {
      const t = i / 200
      const p = {x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y)}
      const d = outside(plate, p)
      const v = f(t)
      if (d <= 0) { inN++; if (v > 0.1) badIn++ }
      else if (d >= CLEAR_CM && v < 0.95) badOut++
    }
    behind += inN
    if (badIn) errs.push(`${tag}: Figure_${l} shows (brightness > 0.1) at ${badIn} of ${inN} samples behind the control row`)
    if (badOut) errs.push(`${tag}: Figure_${l} is dimmed at ${badOut} samples more than ${CLEAR_CM} cm clear of the control row`)
    notes.push(`${l} ${inN}/201 behind`)
  }
  const torso = mustFind("Figure_Torso")
  if (torso.enabled) {
    const tp = wallInv.multiplyPoint(torso.getTransform().getWorldPosition())
    const ta = ((torso.getComponent("Component.RenderMeshVisual") as RenderMeshVisual).mainMaterial.mainPass.baseColor as vec4).w
    if (outside(plate, tp) <= 0 && ta > 0.1) errs.push(`${tag}: torso point is behind the control row but shows (alpha ${ta.toFixed(2)})`)
    notes.push(`torso ${outside(plate, tp) <= 0 ? "behind" : (outside(plate, tp).toFixed(1) + " cm clear")}, alpha ${ta.toFixed(2)}`)
  }
  print(`[N8] ${tag}, fade behind the control row: ${notes.join(", ")}`)
  return behind
}

interface FigSnap {
  pos: RefPosition
  torso: vec3 | null
  lines: {[limb: string]: {on: boolean; start: vec3; end: vec3; z: number}}
  markers: {[limb: string]: vec3 | null}
}

function snap(main: NextHoldMain): FigSnap {
  const s: FigSnap = {pos: main.getPosition() as RefPosition, torso: null, lines: {}, markers: {}}
  const t = mustFind("Figure_Torso")
  s.torso = t.enabled ? t.getTransform().getWorldPosition() : null
  const wallInv = mustFind("ClimbingWall (stand-in)").getTransform().getInvertedWorldTransform()
  for (const l of REF_LIMBS) {
    const so = mustFind("Figure_" + l)
    const m = so.getTransform().getWorldTransform()
    const start = m.multiplyPoint(vec3.zero())
    s.lines[l] = {on: so.enabled, start, end: m.multiplyPoint(new vec3(1, 0, 0)), z: wallInv.multiplyPoint(start).z}
    const mk = mustFind("Marker_" + l)
    s.markers[l] = mk.enabled ? mk.getTransform().getWorldPosition() : null
  }
  return s
}

const planeD = (a: vec3, b: vec3) => Math.hypot(a.x - b.x, a.y - b.y)

function check(s: FigSnap, errs: string[], tag: string): void {
  const ref = makeReference()
  const com = ref.com(s.pos)
  const wall = mustFind("ClimbingWall (stand-in)").getTransform().getWorldTransform()
  const comW = wall.multiplyPoint(new vec3(com.x - 120, com.y, 0))
  if (!s.torso) { errs.push(`${tag}: Figure_Torso hidden`); return }
  const dT = planeD(s.torso, comW)
  if (dT > TOL) errs.push(`${tag}: torso is ${dT.toFixed(2)} cm from the centre of mass (${com.x.toFixed(1)}, ${com.y.toFixed(1)})`)
  const worst: string[] = []
  for (const l of REF_LIMBS) {
    const line = s.lines[l]
    const hold = s.pos[l]
    if (!line.on) { errs.push(`${tag}: Figure_${l} hidden`); continue }
    const marker = s.markers[l]
    if (!marker) { errs.push(`${tag}: Marker_${l} hidden`); continue }
    const holdW = mustFind("Hold_" + hold).getTransform().getWorldPosition()
    const dS = planeD(line.start, comW), dM = planeD(line.end, marker), dH = planeD(line.end, holdW)
    if (dS > TOL) errs.push(`${tag}: Figure_${l} starts ${dS.toFixed(2)} cm from the torso point`)
    if (dM > TOL) errs.push(`${tag}: Figure_${l} ends ${dM.toFixed(2)} cm from Marker_${l}`)
    if (dH > TOL) errs.push(`${tag}: Figure_${l} ends ${dH.toFixed(2)} cm from Hold_${hold}`)
    // on the wall plane: behind the holds' fronts, not out toward the face
    const front = HOLD_SIZE[holdById(hold as string)!.type].d
    if (line.z < 0 || line.z > Math.min(1, front)) errs.push(`${tag}: Figure_${l} sits ${line.z.toFixed(2)} cm off the wall`)
    worst.push(`${l}->${hold} ${Math.max(dS, dM, dH).toFixed(2)}`)
  }
  print(`[N8] ${tag}: ${fmtPos(s.pos)}, torso (${com.x.toFixed(1)}, ${com.y.toFixed(1)}) off by ${dT.toFixed(2)} cm; end point errors ${worst.join(", ")}`)
}

@component
export class N8StickFigureScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const main = getMain()
    await restorePreset(main)
    const errs: string[] = []

    // ── at the preset ──
    const s0 = snap(main)
    check(s0, errs, "preset")
    // Ground puts the row beside the problem, clear of the figure; On wall puts it below the hands,
    // where the torso point is below the row and both hand lines pass behind it
    checkFade(main, errs, "ground, preset")
    await pinch("ViewToggle")
    await frames(3)
    if (checkFade(main, errs, "on wall, preset") === 0) errs.push("on wall, preset: no figure line passes behind the control row; the fade check proves nothing")

    // thin and light: every channel bright on the additive display, not opaque
    for (const n of ["Figure_Torso", ...REF_LIMBS.map((l) => "Figure_" + l)]) {
      const c = (mustFind(n).getComponent("Component.RenderMeshVisual") as RenderMeshVisual).mainMaterial.mainPass.baseColor as vec4
      if (Math.min(c.x, c.y, c.z) < 0.8 || c.w > 0.9) errs.push(`${n} colour ${c} is not light and soft`)
    }
    const v = mustFind("Figure_LH").getComponent("Component.RenderMeshVisual") as RenderMeshVisual
    const lo = v.mesh.aabbMin, hi = v.mesh.aabbMax
    const width = hi.y - lo.y
    print(`[N8] line width ${width.toFixed(2)} cm`)
    if (width > 2.5) errs.push(`stick lines are ${width.toFixed(2)} cm wide (want thin, <= 2.5 cm)`)

    // ── a real pinch moves a limb: the figure follows in the same frame ──
    const sug = main.getSuggestion()!
    const fadeErrs: string[] = []
    const got = await pinchCapture("Hold_" + sug.holdId, () => {
      checkFade(main, fadeErrs, `pinch frame, ${sug.limb} -> ${sug.holdId}`)
      return snap(main)
    })
    errs.push(...fadeErrs)
    if (!got.fired || !got.value) errs.push(`Hold_${sug.holdId} pinch did not fire`)
    else {
      if (got.value.pos[sug.limb] !== sug.holdId) errs.push(`pinch frame: ${sug.limb} on ${got.value.pos[sug.limb]}, want ${sug.holdId}`)
      check(got.value, errs, `pinch frame, ${sug.limb} -> ${sug.holdId}`)
      const before = s0.lines[sug.limb].end, after = got.value.lines[sug.limb].end
      if (planeD(before, after) < 1) errs.push(`pinch frame: Figure_${sug.limb} end did not move`)
    }

    // ── a foot this time, and back in Ground (the figure shows in both) ──
    await pinch("ViewToggle")
    await frames(2)
    if (main.getView() !== "ground") errs.push(`setup: view ${main.getView()} after the second ViewToggle, want ground`)
    await pinch("Toggle_LF")
    await frames(2)
    const lfSug = main.getSuggestion()
    if (lfSug && lfSug.limb === "LF") {
      const got2 = await pinchCapture("Hold_" + lfSug.holdId, () => snap(main))
      if (!got2.fired || !got2.value) errs.push(`Hold_${lfSug.holdId} pinch did not fire`)
      else check(got2.value, errs, `ground, pinch frame, LF -> ${lfSug.holdId}`)
      checkFade(main, errs, "ground, after the foot move")
    } else {
      errs.push(`setup: no LF suggestion after Toggle_LF (${lfSug ? lfSug.limb + "->" + lfSug.holdId : "none"})`)
    }

    await restorePreset(main)
    check(snap(main), errs, "after restore")
    expect(errs.length, "stick figure mismatches:\n" + errs.join("\n")).toBe(0)
  }
}
