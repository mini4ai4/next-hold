// Strict review B, "body readability": a thin, light stick figure on the wall
// plane joins the four limb markers to a torso point at the centre of mass the
// scoring uses. After a limb moves, the figure's end points match the limb
// positions in the same frame.
// End points are read from what renders: each Figure_<limb> line is a unit
// mesh along local +X, so its world start is the transform applied to (0,0,0)
// and its world end the transform applied to (1,0,0). The expected centre of
// mass comes from the test's own port of scoring.js (NextHoldReferenceRule).

import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {HOLD_SIZE, holdById} from "../../Scripts/Wall/WallLayout"
import {NextHoldMain} from "../../Scripts/NextHoldMain"
import {fmtPos, frames, getMain, makeReference, mustFind, pinch, pinchCapture, restorePreset} from "./NextHoldTestKit"
import {REF_LIMBS, RefPosition} from "./NextHoldReferenceRule"

const TOL = 0.5 // cm in the wall plane

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
    const got = await pinchCapture("Hold_" + sug.holdId, () => snap(main))
    if (!got.fired || !got.value) errs.push(`Hold_${sug.holdId} pinch did not fire`)
    else {
      if (got.value.pos[sug.limb] !== sug.holdId) errs.push(`pinch frame: ${sug.limb} on ${got.value.pos[sug.limb]}, want ${sug.holdId}`)
      check(got.value, errs, `pinch frame, ${sug.limb} -> ${sug.holdId}`)
      const before = s0.lines[sug.limb].end, after = got.value.lines[sug.limb].end
      if (planeD(before, after) < 1) errs.push(`pinch frame: Figure_${sug.limb} end did not move`)
    }

    // ── a foot this time, and in the On wall view (the figure shows in both) ──
    await pinch("ViewToggle")
    await frames(2)
    await pinch("Toggle_LF")
    await frames(2)
    const lfSug = main.getSuggestion()
    if (lfSug && lfSug.limb === "LF") {
      const got2 = await pinchCapture("Hold_" + lfSug.holdId, () => snap(main))
      if (!got2.fired || !got2.value) errs.push(`Hold_${lfSug.holdId} pinch did not fire`)
      else check(got2.value, errs, `on wall, pinch frame, LF -> ${lfSug.holdId}`)
    } else {
      errs.push(`setup: no LF suggestion after Toggle_LF (${lfSug ? lfSug.limb + "->" + lfSug.holdId : "none"})`)
    }

    await restorePreset(main)
    check(snap(main), errs, "after restore")
    expect(errs.length, "stick figure mismatches:\n" + errs.join("\n")).toBe(0)
  }
}
