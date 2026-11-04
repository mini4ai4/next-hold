// Session 20, bigger labels where they are read from the mats. A second camera stands 2.5 m back at
// eye height, with the preview camera's own projection, and the Lens sizes Ground from it (as a2).
// Each word's height is read on screen, from what renders, as a share of the frame's height: the
// step tags, "TOP", "TOPPED" and the suggestion label ("R hand").
// BASE is what the same camera measured on the build before this change (session 19, the run's raw
// numbers): each word must now be at least twice that. From there they must also be inside the view,
// and no word may overlap another word, another tag's outline or the glow.
// On wall the label keeps its own size, and at the preset's 125 cm the tags stay as they were.
// Input path: real SIK pinches on the hold glowing at each turn, up to the top hold.

import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {PRESET_TOP} from "../../Scripts/Wall/WallLayout"
import {
  AT_110, ScreenBox, boxesOverlap, camera, eyeToWallCm, fmtBox, frames, getMain, mustFind, pinch, restorePreset, screenBoxOf, textSize,
} from "./NextHoldTestKit"

const SCAN_CM = 250
/** frame-height shares measured on the session-19 build, from this same camera */
const BASE = {tag2: 0.0125, tag3: 0.0134, label: 0.0131, top: 0.0181, topped: 0.0289}
const TOP_TAG = "Tag_" + PRESET_TOP

/** how far (in frame heights) a screen box stays outside a circle; < 0 = it overlaps */
function boxToCircle(b: ScreenBox, cx: number, cy: number, r: number, aspect: number): number {
  const dx = Math.max(b.x0 - cx, 0, cx - b.x1) * aspect, dy = Math.max(b.y0 - cy, 0, cy - b.y1)
  return Math.hypot(dx, dy) - r
}

@component
export class L1LabelSizesScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const main = getMain()
    await restorePreset(main)
    const errs: string[] = []
    const live = camera()
    const so = global.scene.createSceneObject("LabelSizeCam")
    const cam = so.createComponent("Component.Camera") as Camera
    const height = (name: string): number => {
      const b = screenBoxOf(name, cam)
      return b ? b.y1 - b.y0 : -1
    }
    /** the word reads at least `min` of the frame's height, and is fully inside the frame */
    const words: string[] = []
    const measure = (name: string, min: number, tag: string) => {
      const b = screenBoxOf(name, cam), h = height(name)
      const text = (mustFind(name).getComponent("Component.Text") as Text).text
      words.push(`"${text}" ${h.toFixed(4)} (at least ${min.toFixed(4)})`)
      if (h < min) errs.push(`${tag}: "${text}" is ${h.toFixed(4)} of the frame's height, want at least ${min.toFixed(4)} (twice ${(min / 2).toFixed(4)})`)
      if (!b || b.x0 < 0 || b.x1 > 1 || b.y0 < 0 || b.y1 > 1) errs.push(`${tag}: "${text}" is not fully in view (${fmtBox(b)})`)
    }
    try {
      cam.devicePropertyUsage = Camera.DeviceProperty.None
      cam.type = Camera.Type.Perspective
      cam.fov = live.fov; cam.aspect = live.aspect; cam.near = live.near; cam.far = live.far
      cam.renderLayer = LayerSet.makeUnique()
      const tr = so.getTransform()
      const face = mustFind("Hold_lh").getTransform().getWorldPosition()
      const eye = new vec3(mustFind("Hold_up").getTransform().getWorldPosition().x - 20, live.getSceneObject().getTransform().getWorldPosition().y, face.z + SCAN_CM)
      tr.setWorldPosition(eye)
      const aim = new vec3(eye.x, face.y + 55, face.z)
      tr.setWorldRotation(quat.lookAt(aim.sub(eye).normalize().uniformScale(-1), vec3.up()))
      main.setSizingCamera(cam)
      await frames(2)
      if (Math.abs(eyeToWallCm(cam) - SCAN_CM) > 0.5) errs.push(`setup: the camera is ${eyeToWallCm(cam).toFixed(1)} cm from the wall`)
      if (main.getView() !== "ground") errs.push(`setup: view ${main.getView()}, want ground`)

      // ── the opening read: two tags, TOP and the label (it fades after ~2 s: read straight away) ──
      if (!main.isLabelVisible()) errs.push("setup: the suggestion label has already faded")
      measure("GhostNumber_2", 2 * BASE.tag2, "opening")
      measure("GhostNumber_3", 2 * BASE.tag3, "opening")
      measure("SuggestLabel", 2 * BASE.label, "opening")
      measure(TOP_TAG, 2 * BASE.top, "opening")

      // no word over another word or a tag's outline
      const texts = ["GhostNumber_2", "GhostNumber_3", "SuggestLabel", TOP_TAG]
      const box: {[n: string]: ScreenBox | null} = {}
      for (const n of texts.concat(["Ghost_2", "Ghost_3"])) box[n] = screenBoxOf(n, cam)
      const own: {[n: string]: string} = {GhostNumber_2: "Ghost_2", GhostNumber_3: "Ghost_3"}
      const clash: string[] = []
      for (let i = 0; i < texts.length; i++) {
        for (let j = i + 1; j < texts.length; j++) {
          const a = box[texts[i]], b = box[texts[j]]
          if (a && b && boxesOverlap(a, b)) clash.push(`${texts[i]} and ${texts[j]}`)
        }
        for (const pill of ["Ghost_2", "Ghost_3"]) {
          const a = box[texts[i]], b = box[pill]
          if (own[texts[i]] !== pill && a && b && boxesOverlap(a, b)) clash.push(`${texts[i]} and ${pill}`)
        }
      }
      for (const c of clash) errs.push(`opening: on screen ${c} overlap`)

      // no word over the glow: its whole drawn disc, ring and bloom, on screen
      const glow = mustFind("SuggestGlow")
      const gp = glow.getTransform().getWorldPosition()
      const gc = cam.worldSpaceToScreenSpace(gp)
      const mesh = (glow.getComponent("Component.RenderMeshVisual") as RenderMeshVisual).mesh
      const rCm = Math.max(mesh.aabbMax.x, mesh.aabbMax.y)
      const rScreen = Math.abs(cam.worldSpaceToScreenSpace(new vec3(gp.x, gp.y + rCm, gp.z)).y - gc.y)
      const gaps: string[] = []
      for (const n of texts) {
        const b = box[n]
        if (!b) continue
        const g = boxToCircle(b, gc.x, gc.y, rScreen, cam.aspect)
        gaps.push(`${n} ${g.toFixed(3)}`)
        if (g < 0) errs.push(`opening: ${n} overlaps the glow on screen (${fmtBox(b)}; glow at ${gc.x.toFixed(3)},${gc.y.toFixed(3)} r ${rScreen.toFixed(3)})`)
      }
      print(`[L1] opening, from ${SCAN_CM} cm: ${words.join(", ")}; clear of the glow by ${gaps.join(", ")}; ${clash.length} overlaps`)

      // ── follow the plan to the top, with real pinches: "TOPPED" ──
      words.length = 0
      for (let i = 0; i < 8 && !main.isTopped(); i++) {
        const s = main.getSuggestion()
        if (!s) break
        await pinch("Hold_" + s.holdId)
        await frames(2)
      }
      if (!main.isTopped() || main.getTagText(PRESET_TOP) !== "TOPPED") errs.push(`setup: topped ${main.isTopped()}, tag "${main.getTagText(PRESET_TOP)}"`)
      else {
        measure(TOP_TAG, 2 * BASE.topped, "topped")
        print(`[L1] topped: ${words.join(", ")}, box ${fmtBox(screenBoxOf(TOP_TAG, cam))}`)
      }
    } finally {
      main.setSizingCamera(null)
      so.destroy()
    }

    // ── On wall the label stays as it is; at the preset's 125 cm the tags too ──
    await restorePreset(main)
    await frames(2)
    const tag125 = textSize("GhostNumber_2")
    if (Math.abs(tag125 - AT_110.ghostNumber) > 0.5) errs.push(`at the preset the tag's text size is ${tag125.toFixed(1)}, want its own ${AT_110.ghostNumber}`)
    await pinch("ViewToggle")
    await frames(2)
    const wallLabel = textSize("SuggestLabel")
    if (Math.abs(wallLabel - AT_110.label) > 0.01) errs.push(`on wall the label's size is ${wallLabel.toFixed(1)}, want its own ${AT_110.label.toFixed(1)}`)
    print(`[L1] at the preset: tag size ${tag125.toFixed(1)}; on wall: label size ${wallLabel.toFixed(1)}`)
    await restorePreset(main)
    expect(errs.length, "label sizes:\n" + errs.join("\n")).toBe(0)
  }
}
