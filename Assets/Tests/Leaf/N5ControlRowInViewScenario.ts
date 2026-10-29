// Review item 5: at the preset viewpoint the control row's second row (LF / RF /
// Climb) and the safety note are fully visible, and the wall root has not moved.
// "Fully visible" is checked on what renders: every corner of the world-space
// bounding box of every visual (button meshes, labels, the note's text) under
// each control projects inside the scene camera's view. Also checked after a
// real pinch moves a hand, since the row follows the hands.

import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {camera, frames, getMain, mustFind, pinch, restorePreset} from "./NextHoldTestKit"

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

/** Returns a description of what is out of view (empty when the whole control is in view). */
function outOfView(name: string): string[] {
  const cam = camera()
  const camT = cam.getSceneObject().getTransform()
  const vis = visualsUnder(mustFind(name), [])
  if (vis.length === 0) return [`${name}: nothing renders`]
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
      if (local.z >= 0) bad.push(`${name}: a corner is behind the camera`)
    }
  }
  print(`[N5] ${name}: ${vis.length} visuals, screen x ${minX.toFixed(3)}..${maxX.toFixed(3)}, y ${minY.toFixed(3)}..${maxY.toFixed(3)}`)
  if (minX < 0 || maxX > 1 || minY < 0 || maxY > 1) {
    bad.push(`${name}: spans screen x ${minX.toFixed(3)}..${maxX.toFixed(3)}, y ${minY.toFixed(3)}..${maxY.toFixed(3)} (must stay in 0..1)`)
  }
  return bad
}

@component
export class N5ControlRowInViewScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const main = getMain()
    await restorePreset(main)
    await frames(3)
    const errs: string[] = []

    // the preset viewpoint: the scene camera where the Lens opens
    const camT = camera().getSceneObject().getTransform()
    const cp = camT.getWorldPosition(), cr = camT.getWorldRotation()
    if (cp.length > 0.01 || Math.abs(Math.abs(cr.w) - 1) > 1e-4) errs.push(`precondition: camera not at the preset viewpoint (${cp}, ${cr})`)
    const wall = mustFind("ClimbingWall (stand-in)").getTransform().getWorldPosition()
    if (wall.distance(WALL_ROOT) > 0.01) errs.push(`wall root moved to ${wall}, preset ${WALL_ROOT}`)

    for (const c of CONTROLS) errs.push(...outOfView(c))
    errs.push(...outOfView("ControlRow"))

    // the row follows the hands: still fully in view after a hand moves up
    const sug = main.getSuggestion()
    if (sug) {
      await pinch("Hold_" + sug.holdId)
      await frames(3)
      for (const c of ["Toggle_LF", "Toggle_RF", "ModeSwitch", "ViewToggle", "SafetyNote"]) {
        for (const e of outOfView(c)) errs.push(`after ${sug.limb} -> ${sug.holdId}: ${e}`)
      }
    }

    await restorePreset(main)
    expect(errs.length, "control row view mismatches:\n" + errs.join("\n")).toBe(0)
  }
}
