// Session 21, the off-view arrow on the control panel: On wall the panel slides into view, and looking
// down at it put the arrow on its buttons (the arrow draws over everything). Now the arrow keeps clear of
// the panel's screen rect: it moves to the nearest free place at the frame's edge and still points at the
// hold, drawn smaller where the band beside the panel is narrower than its disc. Hidden only if the panel
// leaves it no room at all, so hiding can't be the way this passes: most looks must still show it.
// The eye is held as the demo autopilot holds it (device tracking off, the camera placed directly). From 70
// cm, square to the suggested hold, it looks from level down past the panel, then off to each side, plus
// a look from further out with the view forced On wall. Everything is read from what is placed on the
// scene and projected to the screen, independent of how the arrow placed itself.

import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {camera, fmtBox, frames, getMain, mustFind, pinch, renderedOuterRadius, restorePreset, screenBoxOf} from "./NextHoldTestKit"

const D = Math.PI / 180

interface Pose {x: number; y: number; z: number; pitch: number; yaw: number}

@component
export class R8ArrowClearOfPanelScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const main = getMain()
    await restorePreset(main)
    const errs: string[] = []
    const cam = camera()
    const so = cam.getSceneObject()
    const tr = so.getTransform()
    const tracking = so.getComponent("Component.DeviceTracking") as DeviceTracking
    const trackingWas = tracking ? tracking.enabled : true
    const p0 = tr.getWorldPosition(), r0 = tr.getWorldRotation()

    const sug = main.getSuggestion()!
    if (sug.limb !== "RH" || sug.holdId !== "up") errs.push(`precondition: glow ${sug.limb}->${sug.holdId}, want RH->up`)

    let shown = 0, moved = 0, hidden = 0, total = 0
    const check = async (tag: string, p: Pose, wantView: string) => {
      tr.setWorldPosition(new vec3(p.x, p.y, p.z))
      tr.setWorldRotation(quat.angleAxis(-p.yaw * D, vec3.up()).multiply(quat.angleAxis(p.pitch * D, vec3.right())))
      await frames(4) // the view follows the distance, the panel the eye, the arrow late in the frame
      if (main.getView() !== wantView) errs.push(`${tag}: view ${main.getView()}, want ${wantView}`)
      const glow = main.getHoldWorldPosition(sug.holdId)!
      const inView = cam.isSphereVisible(glow, 9.5)
      const row = screenBoxOf("ControlRow", cam)
      const vis = main.isOffViewArrowVisible()
      total++
      if (!vis) {
        if (!inView) hidden++
        print(`[R8] ${tag}: no arrow (hold in view ${inView}); row ${fmtBox(row)}`)
        return
      }
      shown++
      const isMoved = main.isOffViewArrowMoved()
      if (isMoved) moved++
      // what is drawn: the arrow's disc (it faces the eye and holds the arrow) as a circle on screen, and the
      // panel's plate, its corners on screen. World bounding boxes of a tilted disc and of 3D buttons come out
      // larger than what is drawn. The disc's size is read from its mesh, the plate from the row's layout.
      const back = mustFind("OffViewArrowBack").getTransform()
      const r = renderedOuterRadius("OffViewArrowBack") * back.getWorldScale().x
      const c = back.getWorldPosition()
      const right = tr.getWorldRotation().multiplyVec3(vec3.right()), up = tr.getWorldRotation().multiplyVec3(vec3.up())
      const disc: vec2[] = []
      for (let i = 0; i < 32; i++) {
        const t = (i / 32) * Math.PI * 2
        disc.push(cam.worldSpaceToScreenSpace(c.add(right.uniformScale(r * Math.cos(t))).add(up.uniformScale(r * Math.sin(t)))))
      }
      const box = {x0: Math.min(...disc.map((q) => q.x)), x1: Math.max(...disc.map((q) => q.x)), y0: Math.min(...disc.map((q) => q.y)), y1: Math.max(...disc.map((q) => q.y))}
      const size = main.controlRow.getSize()!
      const rowW = main.controlRow.getTransform().getWorldTransform()
      const plate = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => cam.worldSpaceToScreenSpace(rowW.multiplyPoint(new vec3(sx * size.x / 2, sy * size.y / 2, 0))))
      const pb = {x0: Math.min(...plate.map((q) => q.x)), x1: Math.max(...plate.map((q) => q.x)), y0: Math.min(...plate.map((q) => q.y)), y1: Math.max(...plate.map((q) => q.y))}
      const onPlate = disc.filter((q) => q.x > pb.x0 && q.x < pb.x1 && q.y > pb.y0 && q.y < pb.y1).length
      print(`[R8] ${tag}: disc ${fmtBox(box)}, radius ${r.toFixed(2)} cm${isMoved ? " (moved)" : ""}; plate ${fmtBox(pb)}`)
      if (onPlate) errs.push(`${tag}: the arrow's disc (${fmtBox(box)}) is on the panel (${fmtBox(pb)})`)
      if (box.x0 < 0 || box.x1 > 1 || box.y0 < 0 || box.y1 > 1) errs.push(`${tag}: the arrow is cut by the frame: ${fmtBox(box)}`)
      // it still points at the hold: the mesh's +X, from where it sits, within 25 deg of the hold's direction
      const camT = tr.getInvertedWorldTransform()
      const a = camT.multiplyPoint(mustFind("OffViewArrowMesh").getTransform().getWorldPosition())
      const h = camT.multiplyPoint(glow)
      const tanV = Math.tan(cam.fov / 2), tanH = tanV * cam.aspect
      const ndc = (v: vec3) => new vec2(v.x / (Math.max(1e-3, -v.z) * tanH), v.y / (Math.max(1e-3, -v.z) * tanV))
      const na = ndc(a), nh = ndc(h)
      const fwd = camT.multiplyDirection(mustFind("OffViewArrowMesh").getTransform().getWorldRotation().multiplyVec3(vec3.right()))
      let diff = Math.abs(Math.atan2(fwd.y, fwd.x) - Math.atan2(nh.y - na.y, nh.x - na.x)) * 180 / Math.PI
      if (diff > 180) diff = 360 - diff
      if (diff > 25) errs.push(`${tag}: the arrow points ${diff.toFixed(0)} deg away from ${sug.holdId}`)
    }

    try {
      if (tracking) tracking.enabled = false
      // on wall, square to the hold ("up", wall x 140 is scene x 9.5), looking from level down past the panel
      for (const pitch of [0, -4, -8, -12, -16, -20, -25, -30]) await check(`look down ${-pitch}`, {x: 9.5, y: 0, z: -55, pitch, yaw: 0}, "wall")
      // and off to each side, where the panel slides along with the eye
      for (const yaw of [-14, 14]) for (const pitch of [-6, -14]) await check(`yaw ${yaw}, down ${-pitch}`, {x: 9.5, y: 0, z: -55, pitch, yaw}, "wall")
      // the pose the arrow used to land on the panel from (with the view forced On wall, at the preset's distance)
      tr.setWorldPosition(p0)
      tr.setWorldRotation(r0)
      await frames(4)
      if (tracking) tracking.enabled = trackingWas
      await pinch("ViewToggle")
      if (tracking) tracking.enabled = false
      await check("from 125 cm, On wall", {x: 45, y: -12, z: 0, pitch: 0, yaw: 12}, "wall")
      await check("from 125 cm, On wall, down", {x: 45, y: -12, z: 0, pitch: -14, yaw: 12}, "wall")
    } finally {
      tr.setWorldPosition(p0)
      tr.setWorldRotation(r0)
      if (tracking) tracking.enabled = trackingWas
      await frames(4)
    }
    print(`[R8] ${total} looks: arrow shown in ${shown}, moved off the panel in ${moved}, hidden with the hold off view in ${hidden}`)
    if (moved < 3) errs.push(`the arrow moved in only ${moved} looks: this proves little`)
    if (hidden > 2) errs.push(`the arrow was hidden in ${hidden} of ${total} looks with the hold off view: hiding is the last resort`)

    await restorePreset(main)
    expect(errs.length, "the arrow and the panel:\n" + errs.join("\n")).toBe(0)
  }
}
