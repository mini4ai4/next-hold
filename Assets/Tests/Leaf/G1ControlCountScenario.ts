// Session 24, v7 part G: fewer, bigger controls (the SPECS live review: "a constant kind of pinching"; small
// buttons and lots of text are hard to hit with a pinch on glasses). Counted on what is enabled in the scene:
// - climbing, on the mats: at most 4 buttons ("Show my beta", "?", Body, Setup), each at least 10 x 10 cm, every
//   gap at least 3 cm; on the wall 3 ("Show my beta" is a mats action);
// - the limb toggles are one "body" cluster: Body opens LH RH / LF RF in the same cells (4 buttons, the same sizes),
//   and picking one closes it again; the top line then names the override;
// - Setup/Climb, the view switch and height − / + are behind Setup, never on screen while climbing;
// - the top line is empty by default (no "Limb override: none"); every text in the row is one short line;
// - the row's size never changes with the page, so its placement doesn't either.
// Input path: real SIK pinches on BodyButton, Toggle_LF, SetupButton, ShowBetaButton.

import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import {NextHoldMain} from "../../Scripts/NextHoldMain"
import {frames, getMain, mustFind, pinch, restorePreset} from "./NextHoldTestKit"

const MAX_CLIMBING = 4
const MIN_CM = 10
const MIN_GAP = 3

/** every Button under the row that is enabled in the hierarchy: name, centre and size in the grid's plane (cm) */
function visibleButtons(): {name: string; x: number; y: number; w: number; h: number}[] {
  const grid = mustFind("ButtonGrid").getTransform().getInvertedWorldTransform()
  const out: {name: string; x: number; y: number; w: number; h: number}[] = []
  const walk = (so: SceneObject) => {
    if (!so.isEnabledInHierarchy) return
    const b = so.getComponent(Button.getTypeName()) as Button
    if (b) {
      const p = grid.multiplyPoint(so.getTransform().getWorldPosition())
      out.push({name: so.name, x: p.x, y: p.y, w: b.size.x, h: b.size.y})
    }
    for (let i = 0; i < so.getChildrenCount(); i++) walk(so.getChild(i))
  }
  walk(mustFind("ControlRow"))
  return out
}

/** every visible text in the row */
function visibleTexts(): {name: string; text: string}[] {
  const out: {name: string; text: string}[] = []
  const walk = (so: SceneObject, owner: string) => {
    if (!so.isEnabledInHierarchy) return
    const t = so.getComponent("Component.Text") as Text
    const name = so.name === "Label" ? owner : so.name
    if (t && t.text) out.push({name, text: t.text})
    for (let i = 0; i < so.getChildrenCount(); i++) walk(so.getChild(i), so.name === "Item" ? owner : so.name)
  }
  walk(mustFind("ControlRow"), "ControlRow")
  return out
}

function check(main: NextHoldMain, errs: string[], tag: string, want: string[], climbing: boolean): string {
  const bs = visibleButtons()
  const names = bs.map((b) => b.name).sort()
  if (names.join() !== want.slice().sort().join()) errs.push(`${tag}: buttons ${names.join(", ")}, want ${want.slice().sort().join(", ")}`)
  if (climbing && bs.length > MAX_CLIMBING) errs.push(`${tag}: ${bs.length} buttons while climbing, at most ${MAX_CLIMBING}`)
  let least = 1e9
  for (const b of bs) {
    if (climbing && (b.w < MIN_CM || b.h < MIN_CM)) errs.push(`${tag}: ${b.name} is ${b.w} x ${b.h} cm, want ${MIN_CM} or more each way`)
    for (const o of bs) {
      if (o === b) continue
      const gap = Math.max(Math.abs(o.x - b.x) - (o.w + b.w) / 2, Math.abs(o.y - b.y) - (o.h + b.h) / 2)
      least = Math.min(least, gap)
      if (climbing && gap < MIN_GAP - 1e-3) errs.push(`${tag}: ${b.name} and ${o.name} are ${gap.toFixed(2)} cm apart, want ${MIN_GAP} or more`)
    }
  }
  for (const t of visibleTexts()) {
    const lines = t.text.split("\n")
    if (t.text.length > 40 || lines.length > 2) errs.push(`${tag}: "${t.text}" (${t.name}) is more than one short line`)
    if (/override: none/i.test(t.text)) errs.push(`${tag}: the debug line "${t.text}" shows`)
  }
  for (const n of ["ModeSwitch", "ViewToggle", "HeightDown", "HeightUp"]) {
    if (climbing && mustFind(n).isEnabledInHierarchy) errs.push(`${tag}: ${n} is on screen while climbing`)
  }
  return `${bs.length} buttons (${bs.map((b) => `${b.name} ${b.w}x${b.h}`).join(", ")}), least gap ${least === 1e9 ? "-" : least.toFixed(2)} cm; ` +
    `texts ${visibleTexts().map((t) => `"${t.text.replace("\n", " ")}"`).join(", ")}`
}

@component
export class G1ControlCountScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const main = getMain()
    await restorePreset(main, false)
    await frames(3)
    const errs: string[] = []
    const size0 = main.controlRow.getSize()
    const sameSize = (tag: string) => {
      const s = main.controlRow.getSize()
      if (!size0 || !s || Math.abs(s.x - size0.x) > 0.01 || Math.abs(s.y - size0.y) > 0.01) errs.push(`${tag}: the row is ${s} cm, it was ${size0}`)
    }

    // ── climbing, on the mats, beta hidden ──
    print(`[G1] mats: ${check(main, errs, "mats", ["ShowBetaButton", "AskButton", "BodyButton", "SetupButton"], true)}`)
    if (main.getOverrideLabel() !== "") errs.push(`mats: the top line reads "${main.getOverrideLabel()}", want empty`)
    if (main.getPlannedLine() !== "Planned for 175 cm") errs.push(`mats: "${main.getPlannedLine()}"`)

    // ── beta shown: the same four, the toggle reads "Hide beta" ──
    await pinch("ShowBetaButton"); await frames(3)
    print(`[G1] mats, beta shown: ${check(main, errs, "mats, beta shown", ["ShowBetaButton", "AskButton", "BodyButton", "SetupButton"], true)}`)
    if (main.getShowBetaLabel() !== "Hide\nbeta") errs.push(`beta shown: the toggle reads "${main.getShowBetaLabel()}"`)
    // the best limb lit is still read back (it is behind Body now)
    sameSize("beta shown")

    // ── the body cluster: four limbs in the same cells; a pick closes it ──
    await pinch("BodyButton"); await frames(3)
    print(`[G1] body: ${check(main, errs, "body", ["Toggle_LH", "Toggle_RH", "Toggle_LF", "Toggle_RF"], true)}`)
    if (main.getPage() !== "body" || main.getOverrideLabel() !== "Pick a limb") errs.push(`body: page ${main.getPage()}, top line "${main.getOverrideLabel()}"`)
    sameSize("body")
    await pinch("Toggle_LF"); await frames(3)
    print(`[G1] LF picked: ${check(main, errs, "LF picked", ["ShowBetaButton", "AskButton", "BodyButton", "SetupButton"], true)}`)
    if (main.getPage() !== "climb" || main.getLimbOverride() !== "LF" || main.getOverrideLabel() !== "Limb override: LF") errs.push(`LF picked: page ${main.getPage()}, override ${main.getLimbOverride()}, "${main.getOverrideLabel()}"`)
    const body = mustFind("BodyButton").getComponent(Button.getTypeName()) as Button
    if (!body.isOn) errs.push("LF picked: Body isn't lit while an override waits")

    // ── setup: the mode, the view and the height, not climbing ──
    await pinch("SetupButton"); await frames(3)
    print(`[G1] setup: ${check(main, errs, "setup", ["ModeSwitch", "ViewToggle", "HeightDown", "HeightUp", "SetupButton"], false)}`)
    if (main.getPage() !== "settings" || !main.isSetupLit()) errs.push(`setup: page ${main.getPage()}, Setup lit ${main.isSetupLit()}`)
    sameSize("setup")
    await pinch("SetupButton"); await frames(3)
    if (main.getPage() !== "climb" || main.isSetupLit()) errs.push(`setup closed: page ${main.getPage()}, lit ${main.isSetupLit()}`)

    // ── on the wall: three ──
    await restorePreset(main, false)
    const so = global.scene.createSceneObject("CountCam")
    const cam = so.createComponent("Component.Camera") as Camera
    try {
      cam.devicePropertyUsage = Camera.DeviceProperty.None
      cam.renderLayer = LayerSet.makeUnique()
      const face = mustFind("Hold_lh").getTransform().getWorldPosition()
      const eye = mustFind("Camera Object").getTransform().getWorldPosition()
      so.getTransform().setWorldPosition(new vec3(eye.x, eye.y, face.z + 60))
      main.setSizingCamera(cam)
      await frames(4)
      if (main.getView() !== "wall") errs.push(`wall: the view is ${main.getView()}`)
      print(`[G1] wall: ${check(main, errs, "wall", ["AskButton", "BodyButton", "SetupButton"], true)}`)
      sameSize("wall")
    } finally {
      main.setSizingCamera(null)
      so.destroy()
    }
    print(`[G1] before (session 23): 10 buttons while climbing (LH, RH, ?, LF, RF, Setup/Climb, View, Show my beta, −, +), 8 x 5 cm, 2 cm gaps; now ${visibleButtons().length}`)

    await restorePreset(main)
    expect(errs.length, "fewer, bigger controls:\n" + errs.join("\n")).toBe(0)
  }
}
