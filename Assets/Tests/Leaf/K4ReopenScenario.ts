// Session 24, v7 part C, "later opens use it", on the preview's REAL store (global.persistentStorageSystem.store).
// A pair, run in this order with a preview reset between them (every dispatch starts from one):
//   k4-reopen-write: a real − pinch with the Lens on the real store keeps a height (165 cm) and a marker.
//   k5-reopen-read:  the Lens has been reset (a new open): before anything else, it is planning for the kept
//                    165 cm ("Planned for 165 cm"). Then both keys are removed, so the real store is left empty.
// Every other scenario hands the Lens a fresh in-memory store, so only this pair ever touches the real one.

import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {HEIGHT_KEY} from "../../Scripts/NextHoldAttempt"
import {frames, getMain, pinch, restorePreset} from "./NextHoldTestKit"

export const MARKER = "nh.test.reopen"

@component
export class K4ReopenWriteScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const main = getMain()
    await restorePreset(main)
    const errs: string[] = []
    const real = global.persistentStorageSystem.store
    main.useStore(real)
    await pinch("HeightDown"); await frames(2)
    await pinch("HeightDown"); await frames(2)
    real.putString(MARKER, "165")
    print(`[K4] the real store now holds ${HEIGHT_KEY} = ${real.has(HEIGHT_KEY) ? real.getInt(HEIGHT_KEY) : "nothing"} (${main.getLastWrite()}); keys [${real.getAllKeys().join(", ")}]`)
    if (!real.has(HEIGHT_KEY) || real.getInt(HEIGHT_KEY) !== 165) errs.push(`the real store holds ${real.has(HEIGHT_KEY) ? real.getInt(HEIGHT_KEY) : "nothing"}, want 165`)
    // back to a fresh in-memory store for the reset, so the real store keeps 165 for the next open
    await restorePreset(main)
    expect(errs.length, "reopen, write:\n" + errs.join("\n")).toBe(0)
  }
}

