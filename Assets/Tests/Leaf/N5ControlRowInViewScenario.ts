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
import {HOLDS, HOLD_SIZE, holdById} from "../../Scripts/Wall/WallLayout"
import {GROUND_PANEL_CM, GROUND_PANEL_MIN_DOWN_DEG, GROUND_PANEL_SCALES, NextHoldMain} from "../../Scripts/NextHoldMain"
import {
  ScreenBox, boxesOverlap, camera, checkRowClearOfRing, eyeToWallCm, fmtBox, frames, getMain, mustFind, pinch, renderedOuterRadius, restorePreset, screenBoxOf,
} from "./NextHoldTestKit"

/** the wall root's preset place (BUILD_LOG session 5); this item must not move it */
const WALL_ROOT = new vec3(-10.5, -166, -125)
// session 24 (G): what the climb page shows; the top line is empty by default (nothing renders), "Show my beta"
// only on the mats
const CONTROLS = ["ShowBetaButton", "AskButton", "BodyButton", "SetupButton", "PlannedLine", "SafetyNote"]
// session 26 (v7.2): on the wall the row is the 1 x 2 strip, "?" and Body; Setup, the planned line and the note are
// mats reading (g1 checks they're gone there)
const WALL_CONTROLS = ["AskButton", "BodyButton"]

/** session 28: the least rank (see checkGround) the panel's place must reach at each pose; poses not listed: 1 (never over the
 *  glow's halo or the beta's words). The video's and the stills' mats pose (4.25 m, 37.5 cm right, pitch -2°) and the
 *  turned poses must cover nothing */
const POSE_RANK: {[tag: string]: number} = {
  "ground, preset": 3,
  "ground, 425 cm, 37.5 cm right, pitch -2°": 3, "ground, 425 cm, 37.5 cm right, pitch -2°, beta hidden": 3,
  "ground, 425 cm, 50 cm right, pitch -2°": 3, "ground, 425 cm, 50 cm right, pitch -2°, beta hidden": 3,
  "ground, 250 cm, turned 20° left": 3, "ground, 250 cm, turned 20° right": 3,
  "ground, 250 cm, turned 20° left, beta hidden": 3, "ground, 250 cm, turned 20° right, beta hidden": 3,
  "ground, 425 cm": 2, "ground, 250 cm, pitch -10°": 2, "ground, 250 cm, 40 cm left": 2,
}

function visualsUnder(so: SceneObject, out: BaseMeshVisual[]): BaseMeshVisual[] {
  if (!so.isEnabledInHierarchy) return out
  for (const t of ["Component.RenderMeshVisual", "Component.Text"]) {
    // session 24: skip an empty text (the top line, empty by default): it draws nothing, its box is unbounded
    for (const c of so.getComponents(t as any) as BaseMeshVisual[]) if (c.enabled && !(t === "Component.Text" && !(c as any).text)) out.push(c)
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

/**
 * Ground checks for the real eye (session 27, P1 item 10: the panel follows the head). The panel stands
 * GROUND_PANEL_CM in front of the eye, faces it, is drawn at one of GROUND_PANEL_SCALES, every control is whole in the
 * straight-ahead frame, and seen from the eye it covers no ring of the problem. TOP over the top hold as before.
 */
function checkGround(main: NextHoldMain, eyeCam: Camera, errs: string[], tag: string): string {
  const D = Math.min(365, Math.max(110, eyeToWallCm(eyeCam)))
  const want = D / 110
  if (main.getView() !== "ground") errs.push(`${tag}: view ${main.getView()}, want ground`)
  const k = main.getRowScale()
  const eyeT = eyeCam.getSceneObject().getTransform()
  const rowT = main.controlRow.getSceneObject().getTransform()
  // out along the gaze (it then sits below and maybe to the side of it, so the straight line is a little longer)
  const dist = -eyeT.getInvertedWorldTransform().multiplyPoint(rowT.getWorldPosition()).z
  if (Math.abs(dist - GROUND_PANEL_CM) > 0.5) errs.push(`${tag}: the panel is ${dist.toFixed(1)} cm out along the gaze, want ${GROUND_PANEL_CM}`)
  if (!GROUND_PANEL_SCALES.some((s) => Math.abs(s - k) < 1e-3)) errs.push(`${tag}: the panel is drawn x${k.toFixed(3)}, not one of the sizes it may take`)
  const facing = rowT.getWorldRotation().multiplyVec3(vec3.forward()).dot(eyeT.getWorldRotation().multiplyVec3(vec3.forward()))
  if (facing < 0.999) errs.push(`${tag}: the panel doesn't face the eye (${facing.toFixed(4)})`)
  if (main.getGroundPanelRank() === -1) {
    // session 28: no place in view clear of the glow and the beta's words: it waits under the view, wholly out of it
    const b = screenBoxOf("ControlRow", eyeCam)
    const dn = Math.atan2(-eyeT.getInvertedWorldTransform().multiplyPoint(rowT.getWorldPosition()).y, dist) * 180 / Math.PI
    if (b && b.y0 < 1) errs.push(`${tag}: the panel waits below the view, but reaches into it (${fmtBox(b)})`)
    if (dn < 20) errs.push(`${tag}: the panel waits only ${dn.toFixed(1)}° below the gaze`)
    return `D ${D.toFixed(0)} cm: no place in view clear of the glow and the beta's words: the panel waits ${dn.toFixed(1)}° below the gaze, out of view (${fmtBox(b)})`
  }
  for (const n of CONTROLS) errs.push(...outOfView(n, eyeCam, tag + ", straight ahead"))
  // seen from the eye, the plate on the wall clears every problem ring's outer edge
  const plate = plateOnWall(main, eyeT.getWorldPosition())
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
  // (session 28: what it may cover is now ranked, below; `covered` stays in the printout)
  // session 28 (v7.3 P0-2), measured as drawn from the real eye: low (its centre at least GROUND_PANEL_MIN_DOWN_DEG below the
  // gaze), large enough (a button at least 4.4° wide, the planned line at least 0.5° tall), and on screen over no hold of the
  // wall (in the problem or not) and not over the glow's halo
  const local = eyeT.getInvertedWorldTransform().multiplyPoint(rowT.getWorldPosition())
  const down = Math.atan2(-local.y, -local.z) * 180 / Math.PI
  if (down < GROUND_PANEL_MIN_DOWN_DEG - 0.05) errs.push(`${tag}: the panel's centre is ${down.toFixed(1)}° below the gaze, want at least ${GROUND_PANEL_MIN_DOWN_DEG}° (never at or above the line of sight)`)
  const tanV = Math.tan(eyeCam.fov / 2), tanH = tanV * eyeCam.aspect
  const degW = (b: ScreenBox) => (Math.atan((b.x1 - 0.5) * 2 * tanH) - Math.atan((b.x0 - 0.5) * 2 * tanH)) * 180 / Math.PI
  const degH = (b: ScreenBox) => (Math.atan((0.5 - b.y0) * 2 * tanV) - Math.atan((0.5 - b.y1) * 2 * tanV)) * 180 / Math.PI
  const ask = screenBoxOf("AskButton", eyeCam, true), planned = screenBoxOf("PlannedLine", eyeCam)
  if (!ask || degW(ask) < 4.4) errs.push(`${tag}: "?" is ${ask ? degW(ask).toFixed(2) : "?"}° wide as drawn, want at least 4.4°`)
  if (!planned || degH(planned) < 0.5) errs.push(`${tag}: "${main.getPlannedLine()}" is ${planned ? degH(planned).toFixed(2) : "?"}° tall as drawn, want at least 0.5°`)
  // what the panel is over, measured on screen by the test, ranked as the Lens ranks it (3 nothing; 2 only holds outside
  // the problem; 1 problem rings or START/TOP; 0 the glow's halo or the beta's words). The Lens must never claim a better
  // rank than this, and each pose has a floor (see POSE_RANK)
  const panel = screenBoxOf("ControlRow", eyeCam)
  const r0: string[] = [], r1: string[] = [], r2: string[] = []
  if (panel) {
    const wallRot = mustFind("ClimbingWall (stand-in)").getTransform().getWorldRotation()
    const circleOver = (c: vec3, r: number) => {
      const s = eyeCam.worldSpaceToScreenSpace(c)
      const e = eyeCam.worldSpaceToScreenSpace(c.add(wallRot.multiplyVec3(new vec3(r, 0, 0))))
      const rx = Math.abs(e.x - s.x), ry = rx * eyeCam.aspect
      const dx = Math.max(0, panel.x0 - s.x, s.x - panel.x1) / rx, dy = Math.max(0, panel.y0 - s.y, s.y - panel.y1) / ry
      return Math.hypot(dx, dy) < 1
    }
    const glowSO = mustFind("SuggestGlow")
    if (glowSO.isEnabledInHierarchy && circleOver(glowSO.getTransform().getWorldPosition(), renderedOuterRadius("SuggestGlow"))) r0.push("the glow's halo")
    for (const n of ["SuggestLabel", "GhostNumber_2", "GhostNumber_3"]) {
      const b = mustFind(n).isEnabledInHierarchy && (n !== "SuggestLabel" || main.isLabelVisible()) ? screenBoxOf(n, eyeCam) : null
      if (b && boxesOverlap(b, panel)) r0.push(n)
    }
    for (const h of HOLDS) {
      const inP = main.isInProblem(h.id)
      if (circleOver(mustFind("Hold_" + h.id).getTransform().getWorldPosition(), HOLD_SIZE[h.type].ringR)) (inP ? r1 : r2).push(h.id)
      const t = main.getTagText(h.id) ? screenBoxOf("Tag_" + h.id, eyeCam) : null
      if (t && boxesOverlap(t, panel)) r1.push(`"${main.getTagText(h.id)}" on ${h.id}`)
    }
  }
  const measured = r0.length ? 0 : r1.length ? 1 : r2.length ? 2 : 3
  const claimed = main.getGroundPanelRank()
  if (measured < claimed) errs.push(`${tag}: the Lens ranks the panel's place ${claimed}, but on screen it is over ${r0.concat(r1, r2).join(", ")} (rank ${measured})`)
  const floor = POSE_RANK[tag] !== undefined ? POSE_RANK[tag] : 1
  if (measured < floor) errs.push(`${tag}: the panel (${fmtBox(panel)}) is over ${r0.concat(r1, r2).join(", ")}: rank ${measured}, this pose needs ${floor}`)
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
  return `D ${D.toFixed(0)} cm: panel ${dist.toFixed(1)} cm from the eye, x${k.toFixed(2)}, rank ${measured} (Lens ${claimed}${r0.concat(r1, r2).length ? ": over " + r0.concat(r1, r2).join(", ") : ""}), ${down.toFixed(1)}° below the gaze, "?" ${ask ? degW(ask).toFixed(1) : "-"}° wide, planned line ${planned ? degH(planned).toFixed(2) : "-"}° tall, seen on the wall x ${px0.toFixed(0)}..${px1.toFixed(0)}, y ${py0.toFixed(0)}..${py1.toFixed(0)}; problem x ${x0.toFixed(0)}..${x1.toFixed(0)}`
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

      // the why-line in Ground: drawn for the distance too
      const sug = main.getSuggestion()!
      await pinch("AskButton")
      await frames(2)
      await pinch("Hold_" + sug.holdId)
      await frames(2)
      const wantNear = Math.max(1, eyeToWallCm(live) / 110)
      if (!main.isWhyVisible()) errs.push("ground, preset: the why-line did not show")
      else if (Math.abs(main.getWhyScale() - wantNear) > 0.03) errs.push(`ground, preset: why-line drawn x${main.getWhyScale().toFixed(3)}, want x${wantNear.toFixed(3)}`)

      // ── session 27: the real eye at 2.5 m and 4.25 m (the panel follows the real head, not a sizing camera) ──
      const tracking = camT.getSceneObject().getComponent("Component.DeviceTracking") as DeviceTracking
      const trackingWas = tracking ? tracking.enabled : true
      try {
        if (tracking) tracking.enabled = false
        for (const [cm, z] of [[250, 125], [425, 300]]) {
          camT.setWorldPosition(new vec3(cp.x, cp.y, cp.z + z)); camT.setWorldRotation(cr)
          await frames(4)
          print(`[N5] ground, ${cm} cm: ${checkGround(main, live, errs, `ground, ${cm} cm`)}`)
          if (cm === 250 && main.isWhyVisible() && Math.abs(main.getWhyScale() - 250 / 110) > 0.03) errs.push(`ground, 250 cm: why-line drawn x${main.getWhyScale().toFixed(3)}, want x${(250 / 110).toFixed(3)}`)
        }
        // session 28 (v7.3 P0-2): not only level: pitched up (S10/S11's pose) and down, turned, and off to the side,
        // with the glow on (the beta shown) and with the beta hidden; and the S01 pose from 4.25 m
        const D2 = Math.PI / 180
        const poses: [string, number, number, number, number][] = [
          ["250 cm, pitch +8.8°", 0, 125, 8.8, 0], ["250 cm, pitch -10°", 0, 125, -10, 0],
          ["250 cm, turned 20° left", 0, 125, 0, 20], ["250 cm, turned 20° right", 0, 125, 0, -20],
          ["250 cm, 40 cm left", -40, 125, 0, 0], ["250 cm, 40 cm right, pitch +8.8°", 40, 125, 8.8, 0],
          ["425 cm, 37.5 cm right, pitch -2°", 37.5, 300, -2, 0], ["425 cm, 50 cm right, pitch -2°", 50, 300, -2, 0],
        ]
        for (const hidden of [false, true]) {
          if (hidden) { main.resetBetaForTests(false); await frames(2) }
          for (const [name, x, z, pitch, yaw] of poses) {
            // a step aside first, so each pose is a fresh placement (from one pose to the next can be under the lazy
            // follow's 8° / 10 cm, and then the panel rightly stays where it was)
            camT.setWorldPosition(new vec3(cp.x + x, cp.y + 30, cp.z + z)); await frames(2)
            camT.setWorldPosition(new vec3(cp.x + x, cp.y, cp.z + z))
            camT.setWorldRotation(cr.multiply(quat.angleAxis(yaw * D2, vec3.up())).multiply(quat.angleAxis(pitch * D2, vec3.right())))
            await frames(4)
            const tag = `ground, ${name}${hidden ? ", beta hidden" : ""}`
            print(`[N5] ${tag}: ${checkGround(main, live, errs, tag)}`)
            if (main.getGroundPanelRank() === -1) {
              // a glance down (15°) brings it up, whole, low in view and off the glow and the beta's words
              camT.setWorldRotation(camT.getWorldRotation().multiply(quat.angleAxis(-15 * D2, vec3.right())))
              await frames(4)
              print(`[N5] ${tag}, then 15° down: ${checkGround(main, live, errs, tag + ", then 15° down")}`)
              if (main.getGroundPanelRank() < 1) errs.push(`${tag}: a glance down 15° leaves the panel at rank ${main.getGroundPanelRank()}`)
            }
          }
        }
        main.resetBetaForTests(true)
        camT.setWorldPosition(new vec3(cp.x, cp.y, cp.z + 300)); camT.setWorldRotation(cr)
        await frames(4)
        // lazy follow: a small turn leaves the panel where it is; a bigger one brings it along, still whole and clear
        const rowT = main.controlRow.getSceneObject().getTransform()
        const before = rowT.getWorldPosition()
        camT.setWorldRotation(cr.multiply(quat.angleAxis(-4 * Math.PI / 180, vec3.up()))); await frames(4)
        const small = rowT.getWorldPosition().distance(before)
        camT.setWorldRotation(cr.multiply(quat.angleAxis(-15 * Math.PI / 180, vec3.up()))); await frames(4)
        const big = rowT.getWorldPosition().distance(before)
        print(`[N5] ground, 425 cm: turned 4°, the panel moved ${small.toFixed(1)} cm; turned 15°, ${big.toFixed(1)} cm`)
        if (small > 0.01) errs.push(`ground: a 4° turn moved the panel ${small.toFixed(1)} cm (it follows lazily, past ~8°)`)
        if (big < 5) errs.push(`ground: a 15° turn moved the panel only ${big.toFixed(1)} cm`)
        print(`[N5] ground, 425 cm, turned 15°: ${checkGround(main, live, errs, "ground, 425 cm, turned 15°")}`)
      } finally {
        camT.setWorldPosition(cp); camT.setWorldRotation(cr)
        if (tracking) tracking.enabled = trackingWas
        await frames(4)
      }
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
    for (const c of WALL_CONTROLS) wallErrs.push(...outOfView(c, live, "on wall"))
    wallErrs.push(...outOfView("ControlRow", live, "on wall"))
    for (const n of ["SetupButton", "ShowBetaButton"]) if (mustFind(n).isEnabledInHierarchy) wallErrs.push(`on wall: ${n} shows (the strip is "?" and Body)`)
    for (const n of ["PlannedLine", "SafetyNote"]) if (visualsUnder(mustFind(n), []).length) wallErrs.push(`on wall: ${n} renders`)
    // session 18: below the one ring, never over it on screen
    print(`[N5] on wall, preset: ${checkRowClearOfRing(live, wallErrs, "on wall, preset")}`)
    // the row follows the ring: still fully in view, and clear of it, after a hand moves up
    const sug = main.getSuggestion()
    if (sug) {
      await pinch("Hold_" + sug.holdId)
      await frames(3)
      for (const c of WALL_CONTROLS) wallErrs.push(...outOfView(c, live, `on wall, after ${sug.limb} -> ${sug.holdId}`))
      print(`[N5] on wall, after ${sug.limb} -> ${sug.holdId}: ${checkRowClearOfRing(live, wallErrs, `on wall, after ${sug.limb} -> ${sug.holdId}`)}`)
    }
    print(`[N5] on wall: ${wallErrs.length ? wallErrs.length + " out of view" : "every control in the straight-ahead view"}`)
    errs.push(...wallErrs)

    await restorePreset(main)
    expect(errs.length, "control row and panels:\n" + errs.join("\n")).toBe(0)
  }
}
