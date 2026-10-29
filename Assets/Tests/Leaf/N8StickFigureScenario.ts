// Strict review B, "body readability", redrawn in session 15 so it reads as a
// person, not an X: a head, a spine from the shoulders to the hips, and each limb
// in two segments bent out at the elbow or knee, ending on its hold. Shoulders and
// hips come from the scoring's own anchors. Thinner and softer than the rings.
// After a limb moves, the figure follows in the same frame. Session 16: the figure is
// On wall only; in Ground it is hidden (the limb markers stay), also in a pinch's frame.
// End points are read from what renders: each Figure_<line> is a unit
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
import {AT_110, camera, fmtPos, frames, getMain, makeReference, mustFind, pinch, pinchCapture, restorePreset} from "./NextHoldTestKit"
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

/** every figure line: two segments per limb, the spine, the shoulder and hip lines */
const LINES = REF_LIMBS.map((l) => l + "_Upper").concat(REF_LIMBS.map((l) => l + "_Lower"), ["Spine", "Shoulders", "Hips"])

/** brightness (0..1) of the rendered Figure_<name> line at t along it, from its mesh's centre vertices */
function lineBrightness(name: string): (t: number) => number {
  const mesh = (mustFind("Figure_" + name).getComponent("Component.RenderMeshVisual") as RenderMeshVisual).mesh
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
  for (const l of LINES) {
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
    if (inN) notes.push(`${l} ${inN}/201 behind`)
  }
  const head = mustFind("Figure_Head")
  if (head.enabled) {
    const hp = wallInv.multiplyPoint(head.getTransform().getWorldPosition())
    const ha = ((head.getComponent("Component.RenderMeshVisual") as RenderMeshVisual).mainMaterial.mainPass.baseColor as vec4).w
    if (outside(plate, hp) <= 0 && ha > 0.1) errs.push(`${tag}: the head is behind the control row but shows (alpha ${ha.toFixed(2)})`)
    notes.push(`head ${outside(plate, hp) <= 0 ? "behind" : (outside(plate, hp).toFixed(1) + " cm clear")}, alpha ${ha.toFixed(2)}`)
  }
  print(`[N8] ${tag}, fade behind the control row: ${notes.join(", ")}`)
  return behind
}

interface FigSnap {
  pos: RefPosition
  /** wall cm: each figure line's start and end, whether it shows, and its distance off the wall */
  lines: {[name: string]: {on: boolean; a: {x: number; y: number}; b: {x: number; y: number}; z: number}}
  head: {on: boolean; c: {x: number; y: number}; r: number}
  markers: {[limb: string]: {x: number; y: number} | null}
}

function toWallCm(p: vec3): {x: number; y: number; z: number} {
  const l = mustFind("ClimbingWall (stand-in)").getTransform().getInvertedWorldTransform().multiplyPoint(p)
  return {x: l.x + 120, y: l.y, z: l.z}
}

function snap(main: NextHoldMain): FigSnap {
  const s: FigSnap = {pos: main.getPosition() as RefPosition, lines: {}, head: {on: false, c: {x: 0, y: 0}, r: 0}, markers: {}}
  for (const n of LINES) {
    const so = mustFind("Figure_" + n)
    const m = so.getTransform().getWorldTransform()
    const a = toWallCm(m.multiplyPoint(vec3.zero())), b = toWallCm(m.multiplyPoint(new vec3(1, 0, 0)))
    s.lines[n] = {on: so.enabled, a, b, z: a.z}
  }
  const head = mustFind("Figure_Head")
  const hm = (head.getComponent("Component.RenderMeshVisual") as RenderMeshVisual).mesh
  s.head = {on: head.enabled, c: toWallCm(head.getTransform().getWorldPosition()), r: (hm.aabbMax.x - hm.aabbMin.x) / 2}
  for (const l of REF_LIMBS) {
    const mk = mustFind("Marker_" + l)
    s.markers[l] = mk.enabled ? toWallCm(mk.getTransform().getWorldPosition()) : null
  }
  return s
}

const d2 = (a: {x: number; y: number}, b: {x: number; y: number}) => Math.hypot(a.x - b.x, a.y - b.y)

/** Ground (session 16): every figure line and the head are off, and each limb on a hold keeps its marker. */
function checkHiddenInGround(main: NextHoldMain, errs: string[], tag: string): string {
  if (main.getView() !== "ground") errs.push(`${tag}: view ${main.getView()}, want ground`)
  const on = LINES.concat(["Head"]).filter((n) => mustFind("Figure_" + n).enabled)
  if (on.length) errs.push(`${tag}: the figure shows in Ground (${on.map((n) => "Figure_" + n).join(", ")})`)
  const pos = main.getPosition() as RefPosition
  const noMarker = REF_LIMBS.filter((l) => pos[l] != null && !mustFind("Marker_" + l).enabled)
  if (noMarker.length) errs.push(`${tag}: no marker in Ground for ${noMarker.join(", ")}`)
  const msg = `${tag}: figure ${on.length ? on.length + " parts shown" : "hidden"}, markers ${noMarker.length ? "missing " + noMarker.join(",") : "all shown"}`
  print(`[N8] ${msg}`)
  return msg
}

/**
 * The figure reads as a person (session 15), against the test's own rule: shoulders at the
 * shoulder anchors (centre of mass + (±18, 35)), hips at the rule's hip for each foot but at
 * least 0.55 x reach under the shoulders, a spine from the middle of one to the middle of the
 * other, a head above the spine, and each limb in two segments from its shoulder or hip that
 * meet at a joint pushed out from the body (bent, not straight) and end on its hold and marker.
 */
function check(s: FigSnap, errs: string[], tag: string, heightCm = 175): void {
  const ref = makeReference(heightCm)
  const reach = heightCm * 0.44
  const com = ref.com(s.pos)
  const sh = {LH: ref.anchor("LH", com), RH: ref.anchor("RH", com)}
  const top = Math.min(sh.LH.y, sh.RH.y) - 0.55 * reach
  const hip = (l: "LF" | "RF") => { const h = ref.hip(l, s.pos, com); return {x: h.x, y: Math.min(h.y, top)} }
  const hp = {LF: hip("LF"), RF: hip("RF")}
  const mid = (p: {x: number; y: number}, q: {x: number; y: number}) => ({x: (p.x + q.x) / 2, y: (p.y + q.y) / 2})
  const neck = mid(sh.LH, sh.RH), pelvis = mid(hp.LF, hp.RF)
  const near = (name: string, got: {x: number; y: number}, want: {x: number; y: number}, what: string) => {
    const d = d2(got, want)
    if (d > TOL) errs.push(`${tag}: ${name} ${what} is ${d.toFixed(2)} cm off (${got.x.toFixed(1)}, ${got.y.toFixed(1)} vs ${want.x.toFixed(1)}, ${want.y.toFixed(1)})`)
    return d
  }
  let worst = 0
  for (const [n, a, b] of [["Spine", neck, pelvis], ["Shoulders", sh.LH, sh.RH], ["Hips", hp.LF, hp.RF]] as [string, any, any][]) {
    const line = s.lines[n]
    if (!line.on) { errs.push(`${tag}: Figure_${n} hidden`); continue }
    worst = Math.max(worst, near("Figure_" + n, line.a, a, "start"), near("Figure_" + n, line.b, b, "end"))
  }
  if (!s.head.on) errs.push(`${tag}: no head`)
  else {
    if (!(s.head.c.y - s.head.r > neck.y) || Math.abs(s.head.c.x - neck.x) > TOL) errs.push(`${tag}: the head (${s.head.c.x.toFixed(1)}, ${s.head.c.y.toFixed(1)}, r ${s.head.r.toFixed(1)}) is not just above the shoulders' middle (${neck.x.toFixed(1)}, ${neck.y.toFixed(1)})`)
    const smallest = Math.min(...Object.keys(HOLD_SIZE).map((t) => (HOLD_SIZE as any)[t].ringR))
    if (s.head.r >= smallest) errs.push(`${tag}: the head (r ${s.head.r.toFixed(1)} cm) is as big as a ring (smallest r ${smallest})`)
  }
  const bends: string[] = []
  for (const l of REF_LIMBS) {
    const hold = s.pos[l]
    const up = s.lines[l + "_Upper"], lo = s.lines[l + "_Lower"]
    if (hold == null) { if (up.on || lo.on) errs.push(`${tag}: ${l} is off the wall but its figure limb shows`); continue }
    if (!up.on || !lo.on) { errs.push(`${tag}: Figure_${l} upper ${up.on} lower ${lo.on}`); continue }
    const root = l === "LH" || l === "RH" ? sh[l as "LH" | "RH"] : hp[l as "LF" | "RF"]
    const holdW = toWallCm(mustFind("Hold_" + hold).getTransform().getWorldPosition())
    worst = Math.max(worst,
      near(`Figure_${l}_Upper`, up.a, root, "start (shoulder / hip)"),
      near(`Figure_${l}_Lower`, lo.a, up.b, "start (the joint the upper segment ends on)"),
      near(`Figure_${l}_Lower`, lo.b, holdW, "end (Hold_" + hold + ")"))
    const marker = s.markers[l]
    if (!marker) errs.push(`${tag}: Marker_${l} hidden`)
    else worst = Math.max(worst, near(`Figure_${l}_Lower`, lo.b, marker, "end (its marker)"))
    // bent: the joint stands off the straight root-hold line, on the body's outer side
    const span = d2(root, holdW)
    const off = ((holdW.x - root.x) * (up.b.y - root.y) - (holdW.y - root.y) * (up.b.x - root.x)) / Math.max(span, 1e-6)
    const outward = (up.b.x - (root.x + holdW.x) / 2) * (l === "LH" || l === "LF" ? -1 : 1)
    const limbLen = l === "LH" || l === "RH" ? reach : 1.25 * reach
    if (span < limbLen && (Math.abs(off) < 0.05 * span || outward < -TOL)) errs.push(`${tag}: ${l}'s joint is not bent out from the body (off the line by ${off.toFixed(2)} cm over ${span.toFixed(1)}, outward ${outward.toFixed(2)})`)
    // on the wall plane: behind the holds' fronts, not out toward the face
    const front = HOLD_SIZE[holdById(hold as string)!.type].d
    for (const seg of [up, lo]) if (seg.z < 0 || seg.z > Math.min(1, front)) errs.push(`${tag}: Figure_${l} sits ${seg.z.toFixed(2)} cm off the wall`)
    bends.push(`${l}->${hold} bend ${Math.abs(off).toFixed(1)} cm`)
  }
  print(`[N8] ${tag}: ${fmtPos(s.pos)}, neck (${neck.x.toFixed(1)}, ${neck.y.toFixed(1)}), pelvis (${pelvis.x.toFixed(1)}, ${pelvis.y.toFixed(1)}), ` +
    `head r ${s.head.r.toFixed(1)}; worst point error ${worst.toFixed(2)} cm; ${bends.join(", ")}`)
}

@component
export class N8StickFigureScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const main = getMain()
    await restorePreset(main)
    const errs: string[] = []

    // ── at the preset, Ground: no figure (session 16: from 2.5 m its thin line was a smudge that
    //    competed with the rings; the limb markers show where the hands and feet are) ──
    checkHiddenInGround(main, errs, "ground, preset")
    // ── On wall: the figure; the row sits below the hands, so both hand lines pass behind it ──
    await pinch("ViewToggle")
    await frames(3)
    if (main.getView() !== "wall") errs.push(`setup: view ${main.getView()} after ViewToggle, want wall`)
    const s0 = snap(main)
    check(s0, errs, "on wall, preset")
    if (checkFade(main, errs, "on wall, preset") === 0) errs.push("on wall, preset: no figure line passes behind the control row; the fade check proves nothing")

    // thinner and lower-contrast than the rings (session 15): the figure's line is narrower than the
    // rings' crisp line at 110 cm (and the rings' grows with distance in Ground, the figure's does
    // not), and its alpha is half or less of a ring's, so it is never the heaviest shape on the wall
    const ringLine = AT_110.ringLine
    let ringAlpha = 1
    for (const id of main.getProblemHolds()) {
      const so = mustFind("Ring_" + id)
      if (so.enabled) ringAlpha = Math.min(ringAlpha, ((so.getComponent("Component.RenderMeshVisual") as RenderMeshVisual).mainMaterial.mainPass.baseColor as vec4).w)
    }
    const widths: number[] = []
    for (const n of LINES.concat(["Head"])) {
      const so = mustFind("Figure_" + n)
      const rmv = so.getComponent("Component.RenderMeshVisual") as RenderMeshVisual
      const c = rmv.mainMaterial.mainPass.baseColor as vec4
      if (Math.min(c.x, c.y, c.z) < 0.8 || c.w > 0.5 * ringAlpha + 1e-6) errs.push(`Figure_${n} colour ${c}: want light and at most half a ring's alpha (${ringAlpha})`)
      if (n === "Head" || !so.enabled) continue
      // across the line: the unit mesh's height, times the segment's scale across
      widths.push((rmv.mesh.aabbMax.y - rmv.mesh.aabbMin.y) * so.getTransform().getLocalScale().y)
    }
    const width = Math.max(...widths)
    print(`[N8] figure line ${width.toFixed(2)} cm wide (ring line ${ringLine} cm at 110 cm, wider further back), alpha <= half a ring's`)
    if (!(width < ringLine)) errs.push(`stick lines are ${width.toFixed(2)} cm wide, not thinner than the rings' ${ringLine} cm line`)

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
      const before = s0.lines[sug.limb + "_Lower"].b, after = got.value.lines[sug.limb + "_Lower"].b
      if (d2(before, after) < 1) errs.push(`pinch frame: Figure_${sug.limb}_Lower end did not move`)
    }

    // ── back in Ground the figure goes; a foot moves there and it stays hidden in the pinch's own
    //    frame; On wall again it shows the new position ──
    await pinch("ViewToggle")
    await frames(2)
    if (main.getView() !== "ground") errs.push(`setup: view ${main.getView()} after the second ViewToggle, want ground`)
    checkHiddenInGround(main, errs, "ground, after the hand move")
    await pinch("Toggle_LF")
    await frames(2)
    const lfSug = main.getSuggestion()
    if (lfSug && lfSug.limb === "LF") {
      const hidErrs: string[] = []
      const got2 = await pinchCapture("Hold_" + lfSug.holdId, () => checkHiddenInGround(main, hidErrs, `ground, pinch frame, LF -> ${lfSug.holdId}`))
      errs.push(...hidErrs)
      if (!got2.fired) errs.push(`Hold_${lfSug.holdId} pinch did not fire`)
      await pinch("ViewToggle")
      await frames(3)
      if (main.getView() !== "wall") errs.push(`setup: view ${main.getView()} after the third ViewToggle, want wall`)
      const s2 = snap(main)
      if (s2.pos.LF !== lfSug.holdId) errs.push(`on wall: LF on ${s2.pos.LF}, want ${lfSug.holdId}`)
      check(s2, errs, `on wall, after LF -> ${lfSug.holdId}`)
      checkFade(main, errs, "on wall, after the foot move")
    } else {
      errs.push(`setup: no LF suggestion after Toggle_LF (${lfSug ? lfSug.limb + "->" + lfSug.holdId : "none"})`)
    }

    await restorePreset(main)
    checkHiddenInGround(main, errs, "ground, after restore")
    await pinch("ViewToggle")
    await frames(3)
    check(snap(main), errs, "on wall, after restore")
    await restorePreset(main)
    expect(errs.length, "stick figure mismatches:\n" + errs.join("\n")).toBe(0)
  }
}
