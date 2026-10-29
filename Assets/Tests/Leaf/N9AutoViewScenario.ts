// Strict review 29.10, plan item 2, "the view switches by itself": the Lens
// measures the eye's distance from the wall every frame. Closer than 80 cm it
// shows On wall, further than 120 cm Ground; in between nothing changes, so
// leaning in and out doesn't flicker. The view button still works, and what it
// picks holds until the eye next crosses a threshold.
// The preview camera is driven by device tracking, so the test moves a second
// camera and hands it to the Lens to measure from (setSizingCamera), as a2 does.
// Every step is read back from the Lens (view, the ViewToggle's label) and from
// what renders (how many rings show), a few frames after the move: no pinch.
// The override is a real SIK pinch on ViewToggle.

import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {HOLDS} from "../../Scripts/Wall/WallLayout"
import {GROUND_CM, ON_WALL_CM} from "../../Scripts/NextHoldMain"
import {camera, eyeToWallCm, frames, getMain, mustFind, pinch, restorePreset} from "./NextHoldTestKit"

@component
export class N9AutoViewScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const main = getMain()
    await restorePreset(main)
    const errs: string[] = []
    if (ON_WALL_CM >= GROUND_CM) errs.push(`thresholds: On wall ${ON_WALL_CM} cm is not below Ground ${GROUND_CM} cm`)

    const live = camera()
    const so = global.scene.createSceneObject("AutoViewCam")
    const cam = so.createComponent("Component.Camera") as Camera
    const rings = () => HOLDS.filter((h) => mustFind("Ring_" + h.id).enabled).length
    const steps: string[] = []
    try {
      cam.devicePropertyUsage = Camera.DeviceProperty.None
      cam.renderLayer = LayerSet.makeUnique() // draws nothing
      const face = mustFind("Hold_lh").getTransform().getWorldPosition()
      const eye = live.getSceneObject().getTransform().getWorldPosition()
      const at = async (cm: number) => {
        so.getTransform().setWorldPosition(new vec3(eye.x, eye.y, face.z + cm))
        await frames(3)
        return eyeToWallCm(cam)
      }
      /** after moving to cm, the view must be `want` */
      const expectView = async (cm: number, want: string, why: string) => {
        const d = await at(cm)
        const v = main.getView(), label = main.getViewLabel(), n = rings()
        steps.push(`${d.toFixed(0)} cm: ${v} (${n} rings)`)
        if (v !== want) errs.push(`${why}: at ${d.toFixed(1)} cm the view is ${v}, want ${want === "wall" ? "On wall" : "Ground"}`)
        if (label !== (v === "wall" ? "On wall" : "Ground")) errs.push(`${why}: ViewToggle reads "${label}" in view ${v}`)
        if (v === "wall" && n !== 1) errs.push(`${why}: On wall shows ${n} rings, want 1`)
        if (v === "ground" && n < 3) errs.push(`${why}: Ground shows only ${n} rings`)
      }

      await at(365)
      main.setSizingCamera(cam)
      await expectView(365, "ground", "standing back")
      await expectView(100, "ground", "walking in, still between the thresholds")
      await expectView(ON_WALL_CM - 5, "wall", "walked in past On wall")
      await expectView(45, "wall", "face to the wall")
      await expectView(100, "wall", "leaning out, still between the thresholds")
      await expectView(GROUND_CM + 5, "ground", "stepped back past Ground")
      await expectView(250, "ground", "on the mats")

      // the button overrides, and holds until the next threshold crossing
      await pinch("ViewToggle")
      await frames(3)
      if (main.getView() !== "wall") errs.push(`override at 250 cm: the button gave ${main.getView()}, want wall`)
      await expectView(200, "wall", "override held while still past Ground")
      await expectView(100, "wall", "override held between the thresholds")
      await expectView(ON_WALL_CM - 10, "wall", "walked in past On wall (already On wall)")
      await pinch("ViewToggle")
      await frames(3)
      if (main.getView() !== "ground") errs.push(`override at ${ON_WALL_CM - 10} cm: the button gave ${main.getView()}, want ground`)
      await expectView(50, "ground", "override held, closer but no new crossing")
      await expectView(GROUND_CM + 20, "ground", "stepped back past Ground")
      await expectView(60, "wall", "the next crossing ends the override")
    } finally {
      main.setSizingCamera(null)
      so.destroy()
    }
    print(`[N9] ${steps.join(" -> ")}`)
    await restorePreset(main)
    expect(errs.length, "auto view switch:\n" + errs.join("\n")).toBe(0)
  }
}
