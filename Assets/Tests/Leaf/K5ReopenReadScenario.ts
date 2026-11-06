// Session 24, v7 part C: the second half of the reopen pair (see K4ReopenScenario.ts). Run right after
// k4-reopen-write, with the preview reset between: the Lens opened planning for the kept 165 cm. Then the real
// store is emptied again.

import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {HEIGHT_KEY} from "../../Scripts/NextHoldAttempt"
import {getMain, restorePreset} from "./NextHoldTestKit"
import {MARKER, SNAPSHOT} from "./K4ReopenScenario"

@component
export class K5ReopenReadScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const main = getMain()
    const errs: string[] = []
    const real = global.persistentStorageSystem.store
    // read before anything touches the Lens: this is how it opened
    const opened = main.getHeightCm(), line = main.getPlannedLine(), reach = main.getReach()
    const marker = real.has(MARKER) ? real.getString(MARKER) : "none"
    print(`[K5] after the reset the Lens opened at ${opened} cm ("${line}", reach ${reach.toFixed(1)}); marker ${marker}`)
    if (marker !== "165") errs.push(`k4-reopen-write didn't run just before (marker ${marker})`)
    else if (opened !== 165 || line !== "Planned for 165 cm" || Math.abs(reach - 72.6) > 1e-6) errs.push(`opened at ${opened} cm, "${line}", reach ${reach}: the kept 165 wasn't used`)
    // session 26: back to exactly what k4 found: the kept height (or none), the same keys, our two test keys gone
    let before: {keys: string[]; height: number | null} | null = null
    try { before = real.has(SNAPSHOT) ? JSON.parse(real.getString(SNAPSHOT)) : null } catch (e) { before = null }
    if (!before) errs.push("k4-reopen-write left no snapshot of the real store")
    else if (before.height === null) real.remove(HEIGHT_KEY)
    else real.putInt(HEIGHT_KEY, before.height)
    real.remove(MARKER)
    real.remove(SNAPSHOT)
    const now = real.getAllKeys().slice().sort().join(", ")
    print(`[K5] the real store left with keys [${now}], height ${real.has(HEIGHT_KEY) ? real.getInt(HEIGHT_KEY) : "none"}; before k4: ${JSON.stringify(before)}`)
    if (before && now !== before.keys.slice().sort().join(", ")) errs.push(`the real store holds [${now}], before k4 it held [${before.keys.join(", ")}]`)
    await restorePreset(main)
    expect(errs.length, "reopen, read:\n" + errs.join("\n")).toBe(0)
  }
}
