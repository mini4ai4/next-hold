// Review item 5, then strict review 29.10 plan item 4: where the control row and
// the why-line go, and how large, in each view. The wall root never moves.
// On wall (climbing): the row sits below the one suggested ring (session 18: its
// screen box never overlaps the ring's, glow and label included) and, from the
// preset's 125 cm, every control, both rows and the safety note, is fully inside
// the scene camera's view, also after a real pinch moves a hand. Drawn at its
// 110 cm size.
// Ground (reading the problem): the row sits beside the problem, never over it:
// its plate, projected from the eye onto the wall, lies wholly outside the
// problem's outline (every problem ring, line included), at the start holds'
// height. It is drawn D / 110 times its 110 cm size, D the eye's distance from
// the wall, so it reads the same from anywhere; so is the why-line. Turning the
// head to it (a second camera at the same eye, aimed at the row) puts every
// control fully in view. Checked at the preset (125 cm) and from 250 cm.
// The problem's top hold carries a "TOP" tag in Ground, above its ring, sized
// like the rest for the distance; On wall it doesn't.
// "Fully visible" is checked on what renders: every corner of the world-space
// bounding box of every visual (button meshes, labels, the note's text) under
// each control projects inside the camera's view.

import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {HOLD_SIZE, holdById} from "../../Scripts/Wall/WallLayout"
import {NextHoldMain} from "../../Scripts/NextHoldMain"
import {camera, checkRowClearOfRing, eyeToWallCm, frames, getMain, mustFind, pinch, restorePreset} from "./NextHoldTestKit"

/** the wall root's preset place (BUILD_LOG session 5); this item must not move it */
const WALL_ROOT = new vec3(-10.5, -166, -125)
const CONTROLS = ["Toggle_LF", "Toggle_RF", "ModeSwitch", "ViewToggle", "SafetyNote", "Toggle_LH", "Toggle_RH", "AskButton"]

function visualsUnder(so: SceneObject, out: BaseMeshVisual[]): BaseMeshVisual[] {
  if (!so.isEnabledInHierarchy) return out
  for (const t of ["Component.RenderMeshVisual", "Component.Text"]) {
    for (const c of so.getComponents(t as any) as BaseMeshVisual[]) if (c.enabled) out.push(c)
  }
  for (let i = 0; i < so.getChildrenCount(); i++) visualsUnder(so.getChild(i), out)
  return out
}

/** Returns a description of what is out of `cam`'s view (empty when the whole control is in view). */
function outOfView(name: string, cam: Camera, tag: string): string[] {
  const camT = cam.getSceneObject().getTransform()
  const vis = visualsUnder(mustFind(name), [])
  if (vis.length === 0) return [`${tag}: ${name}: nothing renders`]
  let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9
  const bad: string[] = []
  for (const v of vis) {
    const lo = v.worldAabbMin(), hi = v.worldAabbMax()
    for (const x of [lo.x, hi.x]) for (const y of [lo.y, hi.y]) for (const z of [lo.z, hi.z]) {
      const p = new vec3(x, y, z)
      const local = camT.getInvertedWorldTransform().multiplyPoint(p)
      const s = cam.worldSpaceToScreenSpace(p)
      minX = Math.min(minX, s.x); maxX = Math.max(maxX, s.x)
      minY = Math.min(minY, s.y); maxY = Math.max(maxY, s.y)
      if (local.z >= 0) bad.push(`${tag}: ${name}: a corner is behind the camera`)
    }
  }
  if (minX < 0 || maxX > 1 || minY < 0 || maxY > 1) {
    bad.push(`${tag}: ${name} spans screen x ${minX.toFixed(3)}..${maxX.toFixed(3)}, y ${minY.toFixed(3)}..${maxY.toFixed(3)} (must stay in 0..1)`)
  }
  return bad
}

/** the row plate's outline on the wall (wall cm), projected from the eye at `eyeW` */
function plateOnWall(main: NextHoldMain, eyeW: vec3): {x: number; y: number}[] {
  const size = main.controlRow.getSize()
  if (!size) throw new Error("control row has no laid-out size")
  const toWall = mustFind("ClimbingWall (stand-in)").getTransform().getInvertedWorldTransform()
  const row = main.controlRow.getSceneObject().getTransform().getWorldTransform()
  const eye = toWall.multiplyPoint(eyeW)
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => {
    const c = toWall.multiplyPoint(row.multiplyPoint(new vec3(sx * size.x / 2, sy * size.y / 2, 0)))
    const k = eye.z / (eye.z - c.z)
    return {x: eye.x + k * (c.x - eye.x) + 120, y: eye.y + k * (c.y - eye.y)}
  })
}

/** Ground checks for an eye at `eyeCam` (the camera Ground is sized from). */
function checkGround(main: NextHoldMain, eyeCam: Camera, errs: string[], tag: string): string {
  const D = Math.min(365, Math.max(110, eyeToWallCm(eyeCam)))
  const want = D / 110
  if (main.getView() !== "ground") errs.push(`${tag}: view ${main.getView()}, want ground`)
  const k = main.getRowScale()
  if (Math.abs(k - want) > 0.03) errs.push(`${tag}: control row drawn x${k.toFixed(3)}, want x${want.toFixed(3)} for ${D.toFixed(0)} cm`)
  // beside the problem: the plate on the wall clears every problem ring's outer edge and the problem's outline
  const plate = plateOnWall(main, eyeCam.getSceneObject().getTransform().getWorldPosition())
  const line = main.getRingLineWidth()
  const wallInv = mustFind("ClimbingWall (stand-in)").getTransform().getInvertedWorldTransform()
  let x0 = 1e9, x1 = -1e9
  const covered: string[] = []
  const px0 = Math.min(...plate.map((p) => p.x)), px1 = Math.max(...plate.map((p) => p.x))
  const py0 = Math.min(...plate.map((p) => p.y)), py1 = Math.max(...plate.map((p) => p.y))
  for (const id of main.getProblemHolds()) {
    const l = wallInv.multiplyPoint(mustFind("Hold_" + id).getTransform().getWorldPosition())
    const hx = l.x + 120, hy = l.y, r = HOLD_SIZE[holdById(id)!.type].ringR + line / 2
    x0 = Math.min(x0, hx - r); x1 = Math.max(x1, hx + r)
    const dx = Math.max(0, px0 - hx, hx - px1), dy = Math.max(0, py0 - hy, hy - py1)
    if (Math.hypot(dx, dy) < r) covered.push(id)
  }
  if (covered.length) errs.push(`${tag}: the control row covers problem rings ${covered.join(",")}`)
  if (px1 > x0 && px0 < x1) errs.push(`${tag}: the control row (x ${px0.toFixed(0)}..${px1.toFixed(0)}) overlaps the problem's outline (x ${x0.toFixed(0)}..${x1.toFixed(0)})`)
  // at the start holds' height
  const starts = main.getStartHolds().map((id) => main.getHoldWallPosition(id)!.y)
  const sy = starts.reduce((s, y) => s + y, 0) / Math.max(1, starts.length)
  if (!(sy > py0 && sy < py1)) errs.push(`${tag}: the start holds' height ${sy.toFixed(0)} cm is not within the row (y ${py0.toFixed(0)}..${py1.toFixed(0)})`)
  // TOP over the top hold, above its ring, sized for the distance
  const top = main.getTopHold()
  if (!top || main.getTagText(top) !== "TOP") errs.push(`${tag}: the top hold ${top} is tagged "${top ? main.getTagText(top) : null}", want "TOP"`)
  else {
    const t = mustFind("Tag_" + top)
    const ty = wallInv.multiplyPoint(t.getTransform().getWorldPosition()).y
    const hy = main.getHoldWallPosition(top)!.y
    const size = (t.getComponent("Component.Text") as Text).size
    if (!(ty > hy + HOLD_SIZE[holdById(top)!.type].ringR)) errs.push(`${tag}: TOP sits at ${ty.toFixed(1)} cm, not above ${top}'s ring (hold at ${hy})`)
    if (size < 39 * want - 0.5) errs.push(`${tag}: TOP text size ${size.toFixed(1)} reads smaller than Body at 110 cm from ${D.toFixed(0)} cm (want >= ${(39 * want).toFixed(1)})`)
  }
  return `D ${D.toFixed(0)} cm: row x${k.toFixed(2)} at wall x ${px0.toFixed(0)}..${px1.toFixed(0)}, y ${py0.toFixed(0)}..${py1.toFixed(0)}; problem x ${x0.toFixed(0)}..${x1.toFixed(0)}`
}

/** A camera at `eyeCam`'s eye, turned to look at the row's centre: every control fully in its view. */
function turnToRow(eyeCam: Camera, look: Camera, errs: string[], tag: string): void {
  const eye = eyeCam.getSceneObject().getTransform().getWorldPosition()
  const c = mustFind("ControlRow").getTransform().getWorldPosition()
  const tr = look.getSceneObject().getTransform()
  tr.setWorldPosition(eye)
  tr.setWorldRotation(quat.lookAt(c.sub(eye).normalize().uniformScale(-1), vec3.up()))
  const deg = (Math.acos(Math.max(-1, Math.min(1, c.sub(eye).normalize().dot(new vec3(0, 0, -1))))) * 180) / Math.PI
  const bad: string[] = []
  for (const n of CONTROLS) bad.push(...outOfView(n, look, tag + ", head turned to the row"))
  errs.push(...bad)
  print(`[N5] ${tag}: head turned ${deg.toFixed(0)} deg to the row: ${bad.length ? bad.length + " out of view" : "every control in view"}`)
}

@component
export class N5ControlRowInViewScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const main = getMain()
    await restorePreset(main)
    await frames(3)
    const errs: string[] = []
    const live = camera()

    // the preset viewpoint: the scene camera where the Lens opens
    const camT = live.getSceneObject().getTransform()
    const cp = camT.getWorldPosition(), cr = camT.getWorldRotation()
    if (cp.length > 0.01 || Math.abs(Math.abs(cr.w) - 1) > 1e-4) errs.push(`precondition: camera not at the preset viewpoint (${cp}, ${cr})`)
    const wall = mustFind("ClimbingWall (stand-in)").getTransform().getWorldPosition()
    if (wall.distance(WALL_ROOT) > 0.01) errs.push(`wall root moved to ${wall}, preset ${WALL_ROOT}`)

    const so = global.scene.createSceneObject("RowLookCam")
    const look = so.createComponent("Component.Camera") as Camera
    const so2 = global.scene.createSceneObject("RowFarCam")
    const far = so2.createComponent("Component.Camera") as Camera
    try {
      for (const c of [look, far]) {
        c.devicePropertyUsage = Camera.DeviceProperty.None
        c.type = Camera.Type.Perspective
        c.fov = live.fov; c.aspect = live.aspect; c.near = live.near; c.far = live.far
        c.renderLayer = LayerSet.makeUnique()
      }

      // ── Ground at the preset (125 cm) ──
      print(`[N5] ground, preset: ${checkGround(main, live, errs, "ground, preset")}`)
      turnToRow(live, look, errs, "ground, preset")

      // the why-line in Ground: drawn for the distance too
      const sug = main.getSuggestion()!
      await pinch("AskButton")
      await frames(2)
      await pinch("Hold_" + sug.holdId)
      await frames(2)
      const wantNear = Math.max(1, eyeToWallCm(live) / 110)
      if (!main.isWhyVisible()) errs.push("ground, preset: the why-line did not show")
      else if (Math.abs(main.getWhyScale() - wantNear) > 0.03) errs.push(`ground, preset: why-line drawn x${main.getWhyScale().toFixed(3)}, want x${wantNear.toFixed(3)}`)

      // ── Ground from 250 cm: the Lens sizes from a camera there ──
      so2.getTransform().setWorldPosition(new vec3(cp.x, cp.y, cp.z + (250 - eyeToWallCm(live))))
      main.setSizingCamera(far)
      await frames(3)
      print(`[N5] ground, 250 cm: ${checkGround(main, far, errs, "ground, 250 cm")}, why-line x${main.getWhyScale().toFixed(2)}`)
      if (main.isWhyVisible() && Math.abs(main.getWhyScale() - 250 / 110) > 0.03) errs.push(`ground, 250 cm: why-line drawn x${main.getWhyScale().toFixed(3)}, want x${(250 / 110).toFixed(3)}`)
      turnToRow(far, look, errs, "ground, 250 cm")
      main.setSizingCamera(null)
      await frames(3)
    } finally {
      main.setSizingCamera(null)
      so.destroy()
      so2.destroy()
    }

    // ── On wall: below the hands, in the straight-ahead view, its own size; no TOP ──
    await restorePreset(main)
    await pinch("ViewToggle")
    await frames(3)
    if (main.getView() !== "wall") errs.push(`on wall: view ${main.getView()}`)
    if (Math.abs(main.getRowScale() - 1) > 1e-3) errs.push(`on wall: control row drawn x${main.getRowScale().toFixed(3)}, want x1`)
    const top = main.getTopHold()
    if (top && main.getTagText(top) !== null) errs.push(`on wall: the top hold is tagged "${main.getTagText(top)}"`)
    const wallErrs: string[] = []
    for (const c of CONTROLS) wallErrs.push(...outOfView(c, live, "on wall"))
    wallErrs.push(...outOfView("ControlRow", live, "on wall"))
    // session 18: below the one ring, never over it on screen
    print(`[N5] on wall, preset: ${checkRowClearOfRing(live, wallErrs, "on wall, preset")}`)
    // the row follows the ring: still fully in view, and clear of it, after a hand moves up
    const sug = main.getSuggestion()
    if (sug) {
      await pinch("Hold_" + sug.holdId)
      await frames(3)
      for (const c of ["Toggle_LF", "Toggle_RF", "ModeSwitch", "ViewToggle", "SafetyNote"]) wallErrs.push(...outOfView(c, live, `on wall, after ${sug.limb} -> ${sug.holdId}`))
      print(`[N5] on wall, after ${sug.limb} -> ${sug.holdId}: ${checkRowClearOfRing(live, wallErrs, `on wall, after ${sug.limb} -> ${sug.holdId}`)}`)
    }
    print(`[N5] on wall: ${wallErrs.length ? wallErrs.length + " out of view" : "every control in the straight-ahead view"}`)
    errs.push(...wallErrs)

    await restorePreset(main)
    expect(errs.length, "control row and panels:\n" + errs.join("\n")).toBe(0)
  }
}
