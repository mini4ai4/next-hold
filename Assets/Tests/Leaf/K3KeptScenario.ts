// Session 24, v7 parts B and C: what is kept, and that a store can never stop the Lens.
// - Height (C): a real − pinch (behind Setup) keeps the new height in the store ("nh.height"), and the row
//   under the buttons reads "Planned for 170 cm". A store that holds 160 is read as an open would: the Lens
//   plans for 160 cm (reach 70.4), says so, and every ring follows the test's own rule at 160. A height that
//   isn't one (999) is ignored.
// - Best (B): the key covers the problem and the height. A garbage record reads as none: go 1 again.
// - Fail safe: a store already near its size (getMaxSizeInBytes) takes no new record and throws nothing; the top
//   still shows its card; nothing written; the Lens goes on.
// - The real store in the preview (global.persistentStorageSystem.store): its size cap is read and printed; a smoke
//   key is written, read back and removed. Nothing else of the real store is touched.

import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {TOPPED_FADE_SECONDS, TOPPED_SECONDS} from "../../Scripts/NextHoldMain"
import {HEIGHT_KEY} from "../../Scripts/NextHoldAttempt"
import {climbByRule, frames, getMain, makeReference, pinch, renderedRingColour, restorePreset} from "./NextHoldTestKit"
import {RefPosition} from "./NextHoldReferenceRule"

@component
export class K3KeptScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const main = getMain()
    await restorePreset(main)
    const errs: string[] = []

    // ── height: a pinch keeps it ──
    const s1 = GeneralDataStore.create()
    main.useStore(s1)
    main.reloadFromStore()
    if (main.getHeightCm() !== 175 || s1.has(HEIGHT_KEY)) errs.push(`setup: ${main.getHeightCm()} cm, kept ${s1.has(HEIGHT_KEY)}`)
    await pinch("HeightDown"); await frames(2)
    print(`[K3] after −: ${main.getHeightCm()} cm, kept ${s1.has(HEIGHT_KEY) ? s1.getInt(HEIGHT_KEY) : "nothing"}, "${main.getPlannedLine()}" (${main.getLastWrite()})`)
    if (!s1.has(HEIGHT_KEY) || s1.getInt(HEIGHT_KEY) !== 170) errs.push(`the height wasn't kept: ${s1.has(HEIGHT_KEY) ? s1.getInt(HEIGHT_KEY) : "none"}`)
    if (main.getPlannedLine() !== "Planned for 170 cm") errs.push(`"${main.getPlannedLine()}"`)

    // ── a later open: the store holds 160 ──
    const s2 = GeneralDataStore.create()
    s2.putInt(HEIGHT_KEY, 160)
    main.useStore(s2)
    main.reloadFromStore()
    await frames(2)
    print(`[K3] opened with 160 kept: ${main.getHeightCm()} cm, reach ${main.getReach().toFixed(1)}, "${main.getPlannedLine()}", label "${main.getHeightLabel()}"`)
    if (main.getHeightCm() !== 160 || Math.abs(main.getReach() - 70.4) > 1e-6 || main.getPlannedLine() !== "Planned for 160 cm" || main.getHeightLabel() !== "160 cm") errs.push(`the kept 160: ${main.getHeightCm()} cm, reach ${main.getReach()}, "${main.getPlannedLine()}", "${main.getHeightLabel()}"`)
    const ref160 = makeReference(160)
    const pos = main.getPosition() as RefPosition
    let ringsOk = 0
    for (const r of ref160.perHold(pos)) {
      const got = renderedRingColour(r.holdId, main)
      if (got !== r.colour) errs.push(`at 160: ${r.holdId} renders ${got}, the rule says ${r.colour}`)
      else ringsOk++
    }
    print(`[K3] at 160 cm ${ringsOk} rings by the test's rule`)

    // ── a height that isn't one is ignored ──
    const s3 = GeneralDataStore.create()
    s3.putInt(HEIGHT_KEY, 999)
    main.useStore(s3)
    main.reloadFromStore()
    if (main.getHeightCm() !== 160) errs.push(`a kept 999 moved the height to ${main.getHeightCm()}`)

    // ── the key, and a garbage record ──
    await restorePreset(main)
    const k175 = main.getBestKey()
    for (let i = 0; i < 4; i++) { await pinch("HeightDown"); await frames(2) }
    const k155 = main.getBestKey()
    for (let i = 0; i < 4; i++) { await pinch("HeightUp"); await frames(2) }
    if (k175 === k155 || main.getBestKey() !== k175 || k175.indexOf("nh.best.") !== 0) errs.push(`keys: 175 ${k175}, 155 ${k155}, back ${main.getBestKey()}`)
    // session 26: goes are kept per problem, whatever the height
    const gk = main.getGoesKey()
    if (gk.indexOf("nh.goes.") !== 0 || gk === k175) errs.push(`the goes key ${gk}`)
    const s4 = GeneralDataStore.create()
    s4.putString(gk, "{not json")
    s4.putString(k175, "{not json either")
    main.useStore(s4)
    main.reloadFromStore()
    if (main.getAttempt() !== 1) errs.push(`a garbage record gave go ${main.getAttempt()}, want 1`)
    const s4b = GeneralDataStore.create()
    s4b.putString(gk, JSON.stringify({g: 3, b: null}))
    main.useStore(s4b)
    main.reloadFromStore()
    if (main.getAttempt() !== 4) errs.push(`3 goes kept for the problem gave go ${main.getAttempt()}, want 4`)

    // ── fail safe: a store at its size takes nothing, throws nothing ──
    const s5 = GeneralDataStore.create()
    main.useStore(s5)
    // an in-memory store reports a 0 cap; the Lens then uses its own (NextHoldAttempt.FALLBACK_MAX_BYTES)
    const reported = s5.getMaxSizeInBytes(), max = main.getStoreMaxBytes()
    print(`[K3] an in-memory store reports a cap of ${reported} bytes; the Lens uses ${max}`)
    if (!(max > 0)) errs.push(`the Lens uses a cap of ${max} bytes`)
    s5.putString("filler", "x".repeat(Math.max(0, Math.floor(max * 0.9) - 10)))
    main.reloadFromStore()
    const g = await climbByRule(main, errs, "full store")
    while (g.top && getTime() - g.time < TOPPED_SECONDS + TOPPED_FADE_SECONDS + 0.3) await frames(1)
    await frames(2)
    print(`[K3] a store near its ${max} bytes: card "${main.getResultLines().join(" | ")}", last write "${main.getLastWrite()}", key kept ${s5.has(k175)}`)
    if (s5.has(k175) || s5.has(gk) || main.getLastWrite().indexOf("skipped") !== 0) errs.push(`the full store: kept ${s5.has(k175)} ${s5.has(gk)}, "${main.getLastWrite()}"`)
    // (the LEAF reset shows the beta, so this first go is a FLASH)
    if (!main.isResultVisible() || main.getResultLines()[0] !== "FLASH · go 1") errs.push(`the full store: the card "${main.getResultLines().join(" | ")}"`)

    // ── the real store in the preview: read its cap, write, read back and remove one smoke key ──
    try {
      const real = global.persistentStorageSystem.store
      const keys = real.getAllKeys()
      const prev = real.has("nh.smoke") ? real.getString("nh.smoke") : "none"
      const stamp = "s24-" + getTime().toFixed(3)
      real.putString("nh.smoke", stamp)
      const back = real.getString("nh.smoke")
      real.remove("nh.smoke")
      print(`[K3] the real store: max ${real.getMaxSizeInBytes()} bytes; keys before [${keys.join(", ")}]; smoke before ${prev}; wrote "${stamp}", read "${back}", removed ${!real.has("nh.smoke")}`)
      if (back !== stamp || real.has("nh.smoke")) errs.push(`the real store: read "${back}", still there ${real.has("nh.smoke")}`)
    } catch (e) {
      errs.push(`the real store threw: ${e}`)
    }

    await restorePreset(main)
    expect(errs.length, "kept:\n" + errs.join("\n")).toBe(0)
  }
}
