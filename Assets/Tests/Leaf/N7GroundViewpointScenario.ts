// Strict review A, the viewpoint check: Ground mode means "step back about 3 m
// and the whole problem colours for you". From GROUND_VIEW_CM back from the wall
// (asked for at 300 cm; the whole problem first fits at 365 cm, so the Lens uses
// that) at eye height, is every hold of the marked problem, its whole ring,
// inside the view?
// The preview camera is driven by device tracking, so instead of moving it the
// test builds a second camera with the same projection (fov, aspect, near, far,
// read from the live scene camera), puts it that far back from the wall face at
// the scene camera's eye height and aims it at the middle of the problem.
// Ground sizes itself from the eye's distance to the wall, so the test hands the
// Lens this second camera to size from (setSizingCamera) and reads back what
// renders: ring line, glow, ghost badges and numbers and label must be the sizes
// for the second camera's own distance (365 cm), and the fit check uses the line
// width actually drawn. Handing the wearer's camera back must bring the preset
// sizes back.
// "In view" is strict: the circle through the outer edge of the ring's line
// must lie fully inside all four sides of the view (camera.isSphereVisible is
// also reported, but it is true for a ring that is only partly in view). A sanity
// pass first proves the test camera follows its pose.
// It also finds the smallest distance (1 cm steps) where the whole problem fits,
// with the line Ground would draw from each distance.

import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {HOLD_SIZE, holdById} from "../../Scripts/Wall/WallLayout"
import {camera, checkGroundSizes, eyeToWallCm, frames, getMain, groundSizesFor, mustFind, renderedLineWidth, restorePreset} from "./NextHoldTestKit"

@component
export class N7GroundViewpointScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const main = getMain()
    await restorePreset(main)
    const errs: string[] = []
    const BACK_CM = main.getGroundViewCm()

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
      const holds = problem.map((id) => ({id, p: mustFind("Hold_" + id).getTransform().getWorldPosition(), r: HOLD_SIZE[holdById(id)!.type].ringR}))
      // the ring's outer line edge from distance `back`: Ground widens the line with the distance.
      // At BACK_CM it is the width the Lens actually draws (read below), elsewhere the rule's.
      let drawnLine = groundSizesFor(BACK_CM).line
      const lineAt = (back: number) => back === BACK_CM ? drawnLine : groundSizesFor(back).line
      const radius = (h: {r: number}, back: number) => h.r + lineAt(back) / 2
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9
      for (const h of holds) {
        const r = radius(h, BACK_CM)
        x0 = Math.min(x0, h.p.x - r); x1 = Math.max(x1, h.p.x + r)
        y0 = Math.min(y0, h.p.y - r); y1 = Math.max(y1, h.p.y + r)
      }
      const faceZ = holds[0].p.z
      const eyeY = live.getSceneObject().getTransform().getWorldPosition().y
      const aim = new vec3((x0 + x1) / 2, (y0 + y1) / 2, faceZ)

      const place = (back: number) => {
        const eye = new vec3(aim.x, eyeY, faceZ + back)
        tr.setWorldPosition(eye)
        tr.setWorldRotation(quat.lookAt(aim.sub(eye).normalize().uniformScale(-1), vec3.up()))
      }
      const tanV = Math.tan(cam.fov / 2), tanH = tanV * cam.aspect
      const aV = Math.atan(tanV), aH = Math.atan(tanH)
      /** how far (cm) the circle of radius r around p stays inside the nearest side of the view; < 0 = it crosses it */
      const clearance = (p: vec3, r: number) => {
        const l = tr.getInvertedWorldTransform().multiplyPoint(p)
        const depth = -l.z
        // distance from the point to each side plane of the view, positive inside
        const sides = [
          depth * Math.sin(aH) - Math.abs(l.x) * Math.cos(aH),
          depth * Math.sin(aV) - Math.abs(l.y) * Math.cos(aV),
        ]
        return Math.min(sides[0], sides[1]) - r
      }
      const fullyIn = (back: number) => holds.filter((h) => clearance(h.p, radius(h, back)) >= 0).map((h) => h.id)

      // sanity: the test camera follows its pose
      place(BACK_CM)
      const ahead = cam.isSphereVisible(aim, 1)
      const behind = cam.isSphereVisible(new vec3(aim.x, eyeY, faceZ + 2 * BACK_CM), 1)
      print(`[N7] sanity: aim point visible ${ahead}, point behind the eye visible ${behind}`)
      if (!ahead || behind) errs.push(`sanity: isSphereVisible does not follow the test camera (ahead ${ahead}, behind ${behind})`)

      // what Ground draws for an eye at the second camera: size from its distance, read what renders
      place(BACK_CM)
      const camCm = eyeToWallCm(cam)
      if (Math.abs(camCm - BACK_CM) > 0.5) errs.push(`setup: the second camera is ${camCm.toFixed(1)} cm from the wall plane, want ${BACK_CM}`)
      main.setSizingCamera(cam)
      await frames(2)
      const sizedFar = main.getGroundSizedCm()
      if (Math.abs(sizedFar - groundSizesFor(camCm).D) > 2) errs.push(`Ground sized for ${sizedFar.toFixed(1)} cm, the second camera is ${camCm.toFixed(1)} cm back`)
      print(`[N7] sized from the second camera (${camCm.toFixed(1)} cm, Lens ${sizedFar.toFixed(1)} cm): ${checkGroundSizes(main, camCm, errs, "second camera")}`)
      const sug = main.getSuggestion()
      if (sug) drawnLine = renderedLineWidth(sug.holdId)

      const vFov = (2 * aV * 180) / Math.PI, hFov = (2 * aH * 180) / Math.PI
      const floorY = mustFind("ClimbingWall (stand-in)").getTransform().getWorldPosition().y
      print(`[N7] view ${hFov.toFixed(1)} x ${vFov.toFixed(1)} deg; problem (whole rings, drawn Ground line ${drawnLine.toFixed(2)} cm) spans ${(x1 - x0).toFixed(0)} x ${(y1 - y0).toFixed(0)} cm; eye ${(eyeY - floorY).toFixed(0)} cm above the floor`)

      place(BACK_CM)
      const seen = fullyIn(BACK_CM)
      const missing = problem.filter((id) => seen.indexOf(id) < 0)
      const loose = holds.filter((h) => cam.isSphereVisible(h.p, radius(h, BACK_CM))).length
      const tight = holds.map((h) => `${h.id} ${clearance(h.p, radius(h, BACK_CM)).toFixed(1)}`)
      print(`[N7] ${BACK_CM} cm back: ${seen.length}/${problem.length} whole rings inside the view (isSphereVisible: ${loose}/${problem.length}); out: ${missing.join(",") || "none"}`)
      print(`[N7] clearance to the nearest view edge, cm: ${tight.join(", ")}`)

      let fits = -1
      for (let back = 150; back <= 800; back += 1) {
        place(back)
        if (fullyIn(back).length === problem.length) { fits = back; break }
      }
      print(`[N7] the whole problem first fits ${fits > 0 ? fits + " cm" : "beyond 800 cm"} back (aimed at its middle)`)

      if (missing.length) {
        errs.push(`from ${BACK_CM} cm back ${missing.length} of ${problem.length} problem rings are not fully inside the ${hFov.toFixed(0)} x ${vFov.toFixed(0)} deg view (${missing.join(",")}); the whole problem first fits at ${fits > 0 ? fits + " cm" : "> 800 cm"}`)
      }
    } finally {
      main.setSizingCamera(null)
      so.destroy()
    }
    // the wearer's camera again: back to the sizes for where it stands
    await frames(2)
    const eyeCm = eyeToWallCm(live)
    print(`[N7] back on the wearer's camera (${eyeCm.toFixed(1)} cm, Lens ${main.getGroundSizedCm().toFixed(1)} cm): ${checkGroundSizes(main, eyeCm, errs, "wearer's camera again")}`)
    expect(errs.length, "ground viewpoint:\n" + errs.join("\n")).toBe(0)
  }
}
