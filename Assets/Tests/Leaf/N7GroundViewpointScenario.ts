// Strict review A, the viewpoint check, as climbers actually read a problem:
// they stand about 2-3 m back on the mats and look up and down it. The rings stay
// on the holds, so the whole problem never has to fit in one view. From SCAN_CM
// (250 cm) back from the wall at eye height, two head positions: one looking at
// the lower half of the marked problem, one at the upper half. Together they must
// cover every hold of the problem: each whole ring inside at least one of the two views.
// The preview camera is driven by device tracking, so instead of moving it the
// test builds a second camera with the same projection (fov, aspect, near, far,
// read from the live scene camera), puts it 250 cm back from the wall face at
// the scene camera's eye height and turns it (pitch only, the eye stays put).
// Ground sizes itself from the eye's distance to the wall, so the test hands the
// Lens this second camera to size from (setSizingCamera) and reads back what
// renders: ring line, glow, ghost badges and numbers and label must be the sizes
// for the second camera's own distance (250 cm), and the fit check uses the line
// width actually drawn. Handing the wearer's camera back must bring the preset
// sizes back. From each head position no glow ring or other badge may cover a
// ghost number on the second camera's screen.
// "In view" is strict: the circle through the outer edge of the ring's line
// must lie fully inside all four sides of the view (camera.isSphereVisible is
// also reported, but it is true for a ring that is only partly in view). A sanity
// pass first proves the test camera follows its pose.

import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {HOLD_SIZE, holdById} from "../../Scripts/Wall/WallLayout"
import {camera, checkBadgeAttribution, checkGhostNumbersClear, checkGroundSizes, eyeToWallCm, frames, getMain, groundSizesFor, mustFind, renderedLineWidth, restorePreset} from "./NextHoldTestKit"

/** where the climber stands to read the problem: on the mats, about 2.5 m back */
const SCAN_CM = 250

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
      const holds = problem.map((id) => ({id, p: mustFind("Hold_" + id).getTransform().getWorldPosition(), r: HOLD_SIZE[holdById(id)!.type].ringR}))
      // the ring's outer line edge: the width the Lens actually draws from 250 cm (read below)
      let drawnLine = groundSizesFor(SCAN_CM).line
      const radius = (h: {r: number}) => h.r + drawnLine / 2
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9
      for (const h of holds) {
        const r = radius(h)
        x0 = Math.min(x0, h.p.x - r); x1 = Math.max(x1, h.p.x + r)
        y0 = Math.min(y0, h.p.y - r); y1 = Math.max(y1, h.p.y + r)
      }
      const faceZ = holds[0].p.z
      const eyeY = live.getSceneObject().getTransform().getWorldPosition().y
      const midX = (x0 + x1) / 2, midY = (y0 + y1) / 2
      const eye = new vec3(midX, eyeY, faceZ + SCAN_CM)
      // the two head positions: same eye, looking at the middle of the lower and of the upper half
      const poses = [
        {name: "lower half", aim: new vec3(midX, (y0 + midY) / 2, faceZ)},
        {name: "upper half", aim: new vec3(midX, (midY + y1) / 2, faceZ)},
      ]
      const look = (aim: vec3) => {
        tr.setWorldPosition(eye)
        tr.setWorldRotation(quat.lookAt(aim.sub(eye).normalize().uniformScale(-1), vec3.up()))
      }
      const tanV = Math.tan(cam.fov / 2), tanH = tanV * cam.aspect
      const aV = Math.atan(tanV), aH = Math.atan(tanH)
      /** how far (cm) the circle of radius r around p stays inside the nearest side of the view; < 0 = it crosses it */
      const clearance = (p: vec3, r: number) => {
        const l = tr.getInvertedWorldTransform().multiplyPoint(p)
        const depth = -l.z
        const sides = [
          depth * Math.sin(aH) - Math.abs(l.x) * Math.cos(aH),
          depth * Math.sin(aV) - Math.abs(l.y) * Math.cos(aV),
        ]
        return Math.min(sides[0], sides[1]) - r
      }

      // sanity: the test camera follows its pose
      look(poses[0].aim)
      const ahead = cam.isSphereVisible(poses[0].aim, 1)
      const behind = cam.isSphereVisible(new vec3(midX, eyeY, faceZ + 2 * SCAN_CM), 1)
      print(`[N7] sanity: aim point visible ${ahead}, point behind the eye visible ${behind}`)
      if (!ahead || behind) errs.push(`sanity: isSphereVisible does not follow the test camera (ahead ${ahead}, behind ${behind})`)

      // what Ground draws for an eye 250 cm back: size from the second camera's distance, read what renders
      const camCm = eyeToWallCm(cam)
      if (Math.abs(camCm - SCAN_CM) > 0.5) errs.push(`setup: the second camera is ${camCm.toFixed(1)} cm from the wall plane, want ${SCAN_CM}`)
      main.setSizingCamera(cam)
      await frames(2)
      const sized = main.getGroundSizedCm()
      if (Math.abs(sized - groundSizesFor(camCm).D) > 2) errs.push(`Ground sized for ${sized.toFixed(1)} cm, the second camera is ${camCm.toFixed(1)} cm back`)
      if (main.getView() !== "ground") errs.push(`${SCAN_CM} cm back the view is ${main.getView()}, want ground`)
      print(`[N7] sized from the second camera (${camCm.toFixed(1)} cm, Lens ${sized.toFixed(1)} cm): ${checkGroundSizes(main, camCm, errs, "second camera")}`)
      const sug = main.getSuggestion()
      if (sug) drawnLine = renderedLineWidth(sug.holdId)

      const vFov = (2 * aV * 180) / Math.PI, hFov = (2 * aH * 180) / Math.PI
      const floorY = mustFind("ClimbingWall (stand-in)").getTransform().getWorldPosition().y
      print(`[N7] view ${hFov.toFixed(1)} x ${vFov.toFixed(1)} deg; problem (whole rings, drawn Ground line ${drawnLine.toFixed(2)} cm) spans ${(x1 - x0).toFixed(0)} x ${(y1 - y0).toFixed(0)} cm; eye ${(eyeY - floorY).toFixed(0)} cm above the floor, ${SCAN_CM} cm back`)

      const covered: {[id: string]: string[]} = {}
      for (const pose of poses) {
        look(pose.aim)
        const pitch = (Math.atan2(pose.aim.y - eyeY, SCAN_CM) * 180) / Math.PI
        const inside = holds.filter((h) => clearance(h.p, radius(h)) >= 0).map((h) => h.id)
        for (const id of inside) (covered[id] = covered[id] || []).push(pose.name)
        const loose = holds.filter((h) => cam.isSphereVisible(h.p, radius(h))).length
        print(`[N7] ${pose.name} (head pitched ${pitch.toFixed(1)} deg): ${inside.length}/${problem.length} whole rings inside: ${inside.join(",")} (isSphereVisible: ${loose})`)
        print(`[N7] ${pose.name}: clearance to the nearest view edge, cm: ${holds.map((h) => `${h.id} ${clearance(h.p, radius(h)).toFixed(1)}`).join(", ")}`)
        if (!inside.length) errs.push(`${pose.name}: no whole ring inside the view`)
        print(`[N7] ${pose.name}: ${checkGhostNumbersClear(cam, errs, pose.name, main)}`)
        print(`[N7] ${pose.name}: ${checkBadgeAttribution(cam, main, main.getPreview(), errs, pose.name)}`)
      }
      const missing = problem.filter((id) => !covered[id])
      print(`[N7] two head positions from ${SCAN_CM} cm cover ${problem.length - missing.length}/${problem.length} problem holds; in both: ${problem.filter((id) => covered[id] && covered[id].length === 2).join(",") || "none"}`)
      if (missing.length) errs.push(`from ${SCAN_CM} cm back, looking at the lower and the upper half, ${missing.length} of ${problem.length} problem rings are not whole in either ${hFov.toFixed(0)} x ${vFov.toFixed(0)} deg view (${missing.join(",")})`)
    } finally {
      main.setSizingCamera(null)
      so.destroy()
    }
    // the wearer's camera again: back to the sizes for where it stands
    await frames(2)
    const eyeCm = eyeToWallCm(live)
    print(`[N7] back on the wearer's camera (${eyeCm.toFixed(1)} cm, Lens ${main.getGroundSizedCm().toFixed(1)} cm): ${checkGroundSizes(main, eyeCm, errs, "wearer's camera again")}`)
    expect(errs.length, "ground head scan:\n" + errs.join("\n")).toBe(0)
  }
}
