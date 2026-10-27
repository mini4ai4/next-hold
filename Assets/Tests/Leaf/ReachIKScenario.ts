// Extra (not a done criterion): can a standing user physically operate the
// control row? Drives an IK arm + head (Bitmoji avatar) onto Toggle_LF and
// AskButton. LEAF's diagnostic recorder fails the scenario if a reach is out
// of range, out of view, or cross-body; the routing (direct poke vs far-field
// ray) is printed for each target, including two holds for information.

import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {createIKInteractor} from "Leaf.lspkg/Interactors/interactor/ik/visualizer/BitmojiAvatar"
import {DiagnosticRecorder} from "Leaf.lspkg/Diagnostic/DiagnosticRecorder"
import {frames, getMain, interactable, restorePreset} from "./NextHoldTestKit"

@component
export class ReachIKScenario extends Scenario {
  private readonly ik = createIKInteractor()

  async run(): Promise<void> {
    await sleep(1500)
    const main = getMain()
    await restorePreset(main)
    const errs: string[] = []

    for (const name of ["Toggle_LF", "AskButton", "Hold_up", "Hold_lf"]) {
      print(`[IK] ${name}: right hand routes ${this.ik.right.isIndirect(interactable(name)) ? "INDIRECT (far-field ray)" : "direct"}`)
    }

    const before = DiagnosticRecorder.getInstance().getAll().length
    await this.ik.trigger(interactable("Toggle_LF"))
    await frames(3)
    if (main.getSelectedLimb() !== "LF") errs.push(`IK pinch on Toggle_LF: selected ${main.getSelectedLimb()}`)

    await this.ik.trigger(interactable("AskButton"))
    await frames(3)
    if (!main.isAskArmed() || !main.isAskLit()) errs.push("IK pinch on AskButton did not arm/light '?'")
    await this.ik.trigger(interactable("AskButton"))
    await frames(3)
    if (main.isAskArmed()) errs.push("second IK pinch on AskButton did not disarm '?'")

    const diags = DiagnosticRecorder.getInstance().getAll().slice(before)
    for (const d of diags) print(`[IK] diagnostic ${d.diagnostic.severity} ${d.diagnostic.category}: ${d.diagnostic.message}`)
    print(`[IK] ${diags.length} reach diagnostics`)
    expect(errs.length, "IK reach mismatches:\n" + errs.join("\n")).toBe(0)
  }
}
