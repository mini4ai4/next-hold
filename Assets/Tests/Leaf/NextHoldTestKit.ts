// NextHoldTestKit — shared helpers for the Next Hold LEAF scenarios.
//
// Input path: pinch() drives a simulated SIK right hand (LeafHandInteractor)
// onto the target Interactable and pinches it, so the Interactable's own
// onTriggerStart / onTriggerEnd fire through SIK's InteractionManager, the same
// path a real pinch takes. The Lens's action API (pressHold etc.) is used ONLY
// by restorePreset(), as test setup, never as the thing under test.

import {Interactable} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable"
import {LeafHandInteractor} from "Leaf.lspkg/Interactors/interactor/LeafTwoHandInteractor"
import {findInteractableByName} from "Leaf.lspkg/Interactors/InteractableUtils"
import {findSceneObjectByName, findSceneObjectsByName, nextFrame} from "Leaf.lspkg/Utils/common/Utils"
import {NextHoldMain} from "../../Scripts/NextHoldMain"
import {HOLDS, PRESET_POSITION, PRESET_PROBLEM, PRESET_START, PRESET_TOP} from "../../Scripts/Wall/WallLayout"
import {RefColour, RefLimb, RefPosition, RefPt, ReferenceRule, REF_LIMBS} from "./NextHoldReferenceRule"

/** Brief: a 175 cm climber has 77 cm of reach (height x 0.44). Fixed here, not read from the Lens. */
export const BRIEF_REACH = 175 * 0.44

export const LIMB_WORDS: {[l: string]: string} = {LH: "L hand", RH: "R hand", LF: "L foot", RF: "R foot"}

export function getMain(): NextHoldMain {
  const so = findSceneObjectByName("NextHold")
  if (!so) throw new Error('SceneObject "NextHold" not found')
  const main = so.getComponent(NextHoldMain.getTypeName()) as NextHoldMain
  if (!main) throw new Error('NextHoldMain component not found on "NextHold"')
  return main
}

export function mustFind(name: string): SceneObject {
  const so = findSceneObjectByName(name)
  if (!so) throw new Error(`SceneObject "${name}" not found`)
  return so
}

export async function frames(n: number): Promise<void> {
  for (let i = 0; i < n; i++) await nextFrame()
}

export function interactable(name: string): Interactable {
  const it = findInteractableByName(name, undefined, true)
  if (!it) throw new Error(`Interactable "${name}" not found or not enabled`)
  return it
}

/** Real SIK pinch with the simulated right hand on the named Interactable. */
export async function pinch(name: string): Promise<void> {
  await LeafHandInteractor.get("right").trigger(interactable(name))
}

/**
 * Real SIK pinch, and run `capture` synchronously inside the Interactable's
 * onTriggerEnd, right after the Lens's own handler (it subscribed first, in
 * OnStartEvent). Whatever `capture` reads is the state of the SAME frame as
 * the pinch, with no frame wait in between.
 */
export async function pinchCapture<T>(name: string, capture: () => T): Promise<{fired: boolean; value: T | null; time: number}> {
  const it = interactable(name)
  const out: {fired: boolean; value: T | null; time: number} = {fired: false, value: null, time: -1}
  const unsub = it.onTriggerEnd.add(() => {
    if (out.fired) return
    out.fired = true
    out.time = getTime()
    out.value = capture()
  })
  try {
    await LeafHandInteractor.get("right").trigger(it)
  } finally {
    unsub()
  }
  return out
}

// ── reference data, read from the scene, not from the Lens's state ──────────

/** Hold coordinates in wall space, read from the Hold_<id> objects the wall built. */
export function sceneHoldCoords(): {[id: string]: RefPt} {
  const out: {[id: string]: RefPt} = {}
  for (const h of HOLDS) {
    const so = mustFind("Hold_" + h.id)
    const p = so.getTransform().getLocalPosition()
    out[h.id] = {x: p.x + 120, y: p.y}
  }
  return out
}

/** Hold types of the demo preset (every hold already marked with its shape). */
export function presetTypes(): {[id: string]: string} {
  const out: {[id: string]: string} = {}
  for (const h of HOLDS) out[h.id] = h.type
  return out
}

/** The preset problem ("your problem"): only these holds are scored and ringed outside setup. */
export function presetProblem(): string[] {
  return PRESET_PROBLEM.slice()
}

export function isPresetProblem(id: string): boolean {
  return PRESET_PROBLEM.indexOf(id) >= 0
}

/** Scene hold coordinates, limited to the preset problem's holds (the preset position is on them). */
export function problemHoldCoords(): {[id: string]: RefPt} {
  const all = sceneHoldCoords()
  const out: {[id: string]: RefPt} = {}
  for (const id of PRESET_PROBLEM) out[id] = all[id]
  return out
}

/** The reference rule as the Lens must apply it at the preset: over the problem's holds, toward its top hold. */
export function makeReference(): ReferenceRule {
  return new ReferenceRule(problemHoldCoords(), presetTypes(), BRIEF_REACH, PRESET_TOP)
}

export function presetPosition(): RefPosition {
  return {LH: PRESET_POSITION.LH, RH: PRESET_POSITION.RH, LF: PRESET_POSITION.LF, RF: PRESET_POSITION.RF}
}

export function samePosition(a: RefPosition, b: RefPosition): boolean {
  for (const l of REF_LIMBS) if (a[l] !== b[l]) return false
  return true
}

export function fmtPos(p: RefPosition): string {
  return REF_LIMBS.map((l) => l + "=" + p[l]).join(" ")
}

// ── what is actually rendered ────────────────────────────────────────────────

/** Colour of the rendered Ring_<id> material, classified against the Lens's three ring colours; null if the ring object is off. */
export function renderedRingColour(id: string, main: NextHoldMain): RefColour | null {
  const so = mustFind("Ring_" + id)
  if (!so.enabled) return null
  const rmv = so.getComponent("Component.RenderMeshVisual") as RenderMeshVisual
  const c = rmv.mainMaterial.mainPass.baseColor as vec4
  return classifyColour(c, main)
}

export function classifyColour(c: vec4, main: NextHoldMain): RefColour {
  const norm = (v: vec4) => {
    const m = Math.max(v.x, v.y, v.z) || 1
    return new vec3(v.x / m, v.y / m, v.z / m)
  }
  const n = norm(c)
  const cands: {k: RefColour; v: vec3}[] = [
    {k: "green", v: norm(main.greenColor)},
    {k: "yellow", v: norm(main.yellowColor)},
    {k: "red", v: norm(main.redColor)},
  ]
  let best = cands[0], bd = 1e9
  for (const cd of cands) {
    const d = cd.v.distance(n)
    if (d < bd) { bd = d; best = cd }
  }
  return best.k
}

export function countByName(name: string): number {
  return findSceneObjectsByName(name).length
}

/** Distance in the wall plane (x, y) between a SceneObject and a hold, in cm. */
export function planeDistanceToHold(so: SceneObject, holdId: string): number {
  const hold = mustFind("Hold_" + holdId).getTransform().getWorldPosition()
  const p = so.getTransform().getWorldPosition()
  return Math.sqrt((p.x - hold.x) * (p.x - hold.x) + (p.y - hold.y) * (p.y - hold.y))
}

export function camera(): Camera {
  const cam = mustFind("Camera Object").getComponent("Component.Camera") as Camera
  if (!cam) throw new Error("Camera component missing")
  return cam
}

// ── setup only: bring the Lens back to the demo preset ──────────────────────

/**
 * Scenarios share one live Lens. Put it back to the open state (climb mode,
 * '?' off, preset position, best move auto-selected) through the ACTION API.
 * This is setup, not the behaviour under test. The last call is always a
 * pressHold so the Lens re-runs its auto-select exactly as at open.
 */
export async function restorePreset(main: NextHoldMain): Promise<void> {
  restoreProblem(main)
  if (main.getMode() !== "climb") main.pressMode()
  if (main.isAskArmed()) main.pressAsk()
  const target = presetPosition()
  // a free hold of the problem to park a limb on (the Lens ignores holds outside the problem)
  const spare = (cur: RefPosition) =>
    PRESET_PROBLEM.filter((id) => !REF_LIMBS.some((l) => cur[l] === id || target[l] === id))[0]
  for (let round = 0; round < 8; round++) {
    const cur = main.getPosition() as RefPosition
    if (samePosition(cur, target)) break
    let moved = false
    for (const l of REF_LIMBS) {
      const want = target[l] as string
      if (cur[l] === want) continue
      const blocked = REF_LIMBS.some((o) => o !== l && cur[o] === want)
      if (blocked) continue
      main.pressLimb(l as any)
      main.pressHold(want)
      moved = true
      break
    }
    if (!moved) {
      // every wanted hold is taken (e.g. a swap): park one limb on a spare hold
      const l = REF_LIMBS.filter((x) => cur[x] !== target[x])[0]
      main.pressLimb(l as any)
      main.pressHold(spare(cur))
    }
  }
  // round-trip one foot so the final action is a move (re-runs auto-select)
  main.pressLimb("LF")
  main.pressHold(spare(main.getPosition() as RefPosition))
  main.pressLimb("LF")
  main.pressHold(target.LF as string)
  await frames(3)
  const now = main.getPosition() as RefPosition
  if (!samePosition(now, target)) throw new Error("restorePreset failed: " + fmtPos(now))
}

/**
 * Setup only: put "your problem" back to the preset (members, start holds, top
 * hold, every hold's type) through the setup-mode action API. Leaves the Lens
 * in setup mode; restorePreset switches back to climb.
 */
export function restoreProblem(main: NextHoldMain): void {
  if (main.getMode() !== "setup") main.pressMode()
  for (const h of HOLDS) {
    const want = isPresetProblem(h.id)
    const wantStart = PRESET_START.indexOf(h.id) >= 0
    const wantTop = PRESET_TOP === h.id
    const isIn = main.isInProblem(h.id)
    const flagsOk = main.getStartHolds().indexOf(h.id) >= 0 === wantStart && (main.getTopHold() === h.id) === wantTop
    if (isIn && want && flagsOk && main.getHoldType(h.id) === h.type) continue
    if (!isIn && !want && main.getHoldType(h.id) === h.type) continue
    if (isIn) main.pressHold(h.id) // out
    main.pressHold(h.id) // in: the picker opens for it
    if ((main.getStartHolds().indexOf(h.id) >= 0) !== (want && wantStart)) main.pressStart()
    if ((main.getTopHold() === h.id) !== (want && wantTop)) main.pressTop()
    main.pickType(h.type)
    if (!want) main.pressHold(h.id) // back out
  }
  const probOk = main.getProblemHolds().slice().sort().join() === PRESET_PROBLEM.slice().sort().join()
  const startOk = main.getStartHolds().slice().sort().join() === PRESET_START.slice().sort().join()
  if (!probOk || !startOk || main.getTopHold() !== PRESET_TOP) {
    throw new Error(`restoreProblem failed: problem ${main.getProblemHolds().join(",")} start ${main.getStartHolds().join(",")} top ${main.getTopHold()}`)
  }
}

export function fail(list: string[], msg: string): void {
  list.push(msg)
}

export function limbs(): RefLimb[] {
  return REF_LIMBS
}
