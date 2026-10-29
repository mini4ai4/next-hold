// Strict review A, the viewpoint check: from the ground, ~180 cm back from the
// wall at eye height, is every hold of the marked problem (its whole ring)
// inside the view?
// The preview camera is driven by device tracking, so instead of moving it the
// test builds a second camera with the same projection (fov, aspect, near, far,
// read from the live scene camera), puts it 180 cm back from the wall face at
// the scene camera's eye height, aims it at the middle of the problem (the best
// case for fitting it), and asks Camera.isSphereVisible for each hold. A sanity
// pass first proves isSphereVisible on that camera follows its pose.
// It also reports how far back the whole problem first fits, at the same aim.

import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {HOLD_SIZE, holdById} from "../../Scripts/Wall/WallLayout"
import {camera, getMain, mustFind, restorePreset} from "./NextHoldTestKit"

const BACK_CM = 180

@component
export class N7GroundViewpointScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const main = getMain()
    await restorePreset(main)
    const errs: string[] = []

    const live = camera()
    const so = global.scene.createSceneObject("GroundViewpointCam")
    const cam = so.createComponent("Component.Camera") as Camera
    try {
      cam.devicePropertyUsage = Camera.DeviceProperty.None
      cam.type = Camera.Type.Perspective
      cam.fov = live.fov
      cam.aspect = live.aspect
      cam.near = live.near
      cam.far = live.far
      cam.renderLayer = LayerSet.makeUnique() // draws nothing
      const tr = so.getTransform()

      const problem = main.getProblemHolds()
      const spheres = problem.map((id) => ({
        id, p: mustFind("Hold_" + id).getTransform().getWorldPosition(), r: HOLD_SIZE[holdById(id)!.type].ringR,
      }))
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9
      for (const s of spheres) {
        x0 = Math.min(x0, s.p.x - s.r); x1 = Math.max(x1, s.p.x + s.r)
        y0 = Math.min(y0, s.p.y - s.r); y1 = Math.max(y1, s.p.y + s.r)
      }
      const faceZ = spheres[0].p.z
      const eyeY = live.getSceneObject().getTransform().getWorldPosition().y
      const aim = new vec3((x0 + x1) / 2, (y0 + y1) / 2, faceZ)

      const place = (back: number, aimAt: vec3 | null) => {
        const eye = new vec3(aim.x, eyeY, faceZ + back)
        tr.setWorldPosition(eye)
        const dir = aimAt ? aimAt.sub(eye).normalize() : new vec3(0, 0, -1)
        tr.setWorldRotation(quat.lookAt(dir.uniformScale(-1), vec3.up()))
      }
      const visible = () => spheres.filter((s) => cam.isSphereVisible(s.p, s.r)).map((s) => s.id)

      // sanity: isSphereVisible on this camera follows its pose
      place(BACK_CM, aim)
      const ahead = cam.isSphereVisible(aim, 1)
      const behind = cam.isSphereVisible(new vec3(aim.x, eyeY, faceZ + 2 * BACK_CM), 1)
      print(`[N7] sanity: aim point visible ${ahead}, point behind the eye visible ${behind}`)
      if (!ahead || behind) errs.push(`sanity: isSphereVisible does not follow the test camera (ahead ${ahead}, behind ${behind})`)

      const vFov = live.fov * 180 / Math.PI
      const hFov = 2 * Math.atan(Math.tan(live.fov / 2) * live.aspect) * 180 / Math.PI
      print(`[N7] view ${hFov.toFixed(1)} x ${vFov.toFixed(1)} deg; problem spans wall ${(x1 - x0).toFixed(0)} x ${(y1 - y0).toFixed(0)} cm; eye ${(eyeY - (mustFind("ClimbingWall (stand-in)").getTransform().getWorldPosition().y)).toFixed(0)} cm above the floor`)

      place(BACK_CM, aim)
      const seen = visible()
      const missing = problem.filter((id) => seen.indexOf(id) < 0)
      place(BACK_CM, null)
      const level = visible()
      print(`[N7] ${BACK_CM} cm back, aimed at the problem's middle: ${seen.length}/${problem.length} holds in view; out: ${missing.join(",") || "none"}`)
      print(`[N7] ${BACK_CM} cm back, looking level: ${level.length}/${problem.length} in view`)

      let fits = -1
      for (let back = 100; back <= 800; back += 10) {
        place(back, aim)
        if (visible().length === problem.length) { fits = back; break }
      }
      print(`[N7] the whole problem first fits ${fits > 0 ? fits + " cm" : "beyond 800 cm"} back (aimed at its middle)`)

      if (missing.length) {
        errs.push(`from ${BACK_CM} cm back ${missing.length} of ${problem.length} problem holds are outside the ${hFov.toFixed(0)} x ${vFov.toFixed(0)} deg view (${missing.join(",")}); the whole problem first fits at ${fits > 0 ? fits + " cm" : "> 800 cm"}`)
      }
    } finally {
      so.destroy()
    }
    expect(errs.length, "ground viewpoint:\n" + errs.join("\n")).toBe(0)
  }
}
