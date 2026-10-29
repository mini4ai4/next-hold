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
import {HOLDS, HOLD_SIZE, PRESET_POSITION, PRESET_PROBLEM, PRESET_START, PRESET_TOP, holdById} from "../../Scripts/Wall/WallLayout"
import {GLOW_PROFILE, HOVER_PROFILE, RING_PROFILE} from "../../Scripts/Wall/ProceduralTextures"
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

// ── Ground sizes: what the overlay must measure from distance D ────────────

/** Sizes as drawn for reading at 110 cm (brief / type scale), fixed here, not read from the Lens */
export const AT_110 = {
  ringLine: RING_PROFILE.core, // 1.6 cm
  body: 39, // Body text: the smallest text meant to be read
  label: 62 * 1.3, // the suggestion label's own size: HeadlineXL x 1.3
  ghostNumber: 56,
  ghostR: 3.4,
}
export const GROUND_NEAR_CM = 110
export const GROUND_FAR_CM = 365

/** The camera's distance (cm) from the wall's face plane, along the wall's normal, from the scene itself. */
export function eyeToWallCm(cam: Camera): number {
  const wall = mustFind("ClimbingWall (stand-in)").getTransform().getWorldTransform()
  const o = wall.multiplyPoint(vec3.zero())
  const n = wall.multiplyPoint(new vec3(0, 0, 1)).sub(o).normalize()
  return cam.getSceneObject().getTransform().getWorldPosition().sub(o).dot(n)
}

/** The rule: from D (clamped to 110-365 cm) each element is its 110 cm size x D / 110; text never
 *  below its own size, and never reading smaller than Body at 110 cm. */
export function groundSizesFor(distanceCm: number): {D: number; line: number; label: number; ghostNumber: number; ghostR: number; labelScale: number} {
  const D = Math.min(GROUND_FAR_CM, Math.max(GROUND_NEAR_CM, distanceCm))
  const need = (AT_110.body * D) / 110
  const label = Math.max(AT_110.label, need)
  const ghostNumber = Math.max(AT_110.ghostNumber, need)
  return {D, line: (AT_110.ringLine * D) / 110, label, ghostNumber, ghostR: (AT_110.ghostR * ghostNumber) / AT_110.ghostNumber, labelScale: label / AT_110.label}
}

/**
 * Width (cm) of the crisp line of the rendered Ring_<id>: the ring texture's core runs from
 * U = inner / total to U = (inner + core) / total, so it is the radius at the second minus the first.
 */
export function renderedLineWidth(id: string): number {
  const mesh = (mustFind("Ring_" + id).getComponent("Component.RenderMeshVisual") as RenderMeshVisual).mesh
  const pos = mesh.getVertexDataForAttribute("position")
  const uv = mesh.getVertexDataForAttribute("texture0")
  const {inner, core, outer} = RING_PROFILE
  const total = inner + core + outer
  const radiusAt = (u: number) => {
    for (let i = 0; i * 2 < uv.length; i++) {
      if (Math.abs(uv[i * 2] - u) < 1e-4) return Math.hypot(pos[i * 3], pos[i * 3 + 1])
    }
    return NaN
  }
  return radiusAt((inner + core) / total) - radiusAt(inner / total)
}

/** outer radius (cm) of the named object's rendered annulus mesh */
export function renderedOuterRadius(name: string): number {
  const pos = (mustFind(name).getComponent("Component.RenderMeshVisual") as RenderMeshVisual).mesh.getVertexDataForAttribute("position")
  let r = 0
  for (let i = 0; i * 3 < pos.length; i++) r = Math.max(r, Math.hypot(pos[i * 3], pos[i * 3 + 1]))
  return r
}

export function textSize(name: string): number {
  return (mustFind(name).getComponent("Component.Text") as Text).size
}

/**
 * Ground: every rendered size against the rule at distance D: each visible ring's line, the
 * glow's outer edge, each visible ghost badge (ring radius and number) and the suggestion label.
 * Returns a one-line summary of what was read.
 */
export function checkGroundSizes(main: NextHoldMain, distanceCm: number, errs: string[], tag: string): string {
  const want = groundSizesFor(distanceCm)
  // the Lens re-sizes only after the eye moves more than 2 cm, and rounds text up to 0.1: allow
  // what 2 cm does to each size (line 0.03 cm, text 0.7, glow ~0.1 cm, badge 0.04 cm)
  const slack = (v: number) => (v * 2) / Math.max(want.D, 1) + 0.005
  const tol = {line: slack(want.line), text: slack(AT_110.body * want.D / 110) + 0.1, glow: 0.12, ghostR: slack(want.ghostR) + 0.01}
  const near = (got: number, w: number, t: number) => Math.abs(got - w) <= t
  const lines: number[] = []
  for (const h of HOLDS) {
    if (!mustFind("Ring_" + h.id).enabled) continue
    const w = renderedLineWidth(h.id)
    lines.push(w)
    if (!near(w, want.line, tol.line)) errs.push(`${tag}: Ring_${h.id} line ${w.toFixed(3)} cm, want ${want.line.toFixed(3)} for ${want.D.toFixed(1)} cm`)
  }
  if (!lines.length) errs.push(`${tag}: no ring is visible to measure`)
  const sug = main.getSuggestion()
  let glow = NaN
  if (sug && mustFind("SuggestGlow").enabled) {
    glow = renderedOuterRadius("SuggestGlow")
    const wantGlow = HOLD_SIZE[holdById(sug.holdId)!.type].ringR + want.line / 2 + GLOW_PROFILE.span * want.labelScale
    if (!near(glow, wantGlow, tol.glow)) errs.push(`${tag}: glow outer edge ${glow.toFixed(2)} cm, want ${wantGlow.toFixed(2)}`)
  } else errs.push(`${tag}: no suggestion glow to measure`)
  const ghosts: string[] = []
  for (let n = 1; n <= 3; n++) {
    if (!mustFind("Ghost_" + n).enabled) continue
    const num = textSize("GhostNumber_" + n)
    // the badge is a thin ring whose crisp core sits on its radius: outer edge = r - (coreAt + coreW / 2) + span
    const r = renderedOuterRadius("Ghost_" + n) - HOVER_PROFILE.span + HOVER_PROFILE.coreAt + HOVER_PROFILE.coreW / 2
    ghosts.push(`${num.toFixed(1)}/${r.toFixed(2)}`)
    if (!near(num, want.ghostNumber, tol.text)) errs.push(`${tag}: ghost ${n} number size ${num.toFixed(2)}, want ${want.ghostNumber.toFixed(2)}`)
    if (!near(r, want.ghostR, tol.ghostR)) errs.push(`${tag}: ghost ${n} badge radius ${r.toFixed(2)} cm, want ${want.ghostR.toFixed(2)}`)
  }
  const label = textSize("SuggestLabel")
  if (!near(label, want.label, tol.text)) errs.push(`${tag}: suggestion label size ${label.toFixed(2)}, want ${want.label.toFixed(2)}`)
  if (!near(main.getRingLineWidth(), want.line, tol.line)) errs.push(`${tag}: Main reports a ${main.getRingLineWidth().toFixed(3)} cm line, want ${want.line.toFixed(3)}`)
  return `D ${want.D.toFixed(1)} cm: line ${Math.min(...lines).toFixed(2)}-${Math.max(...lines).toFixed(2)} (want ${want.line.toFixed(2)}), ` +
    `glow edge ${glow.toFixed(2)}, ghosts number/radius ${ghosts.join(" ")} (want ${want.ghostNumber.toFixed(1)}/${want.ghostR.toFixed(2)}), ` +
    `label ${label.toFixed(1)} (want ${want.label.toFixed(1)})`
}

// ── ghost numbers vs the glow, and the dotted sequence path ─────────────────

/** inner radius (cm) of the named object's rendered annulus mesh */
export function renderedInnerRadius(name: string): number {
  const pos = (mustFind(name).getComponent("Component.RenderMeshVisual") as RenderMeshVisual).mesh.getVertexDataForAttribute("position")
  let r = 1e9
  for (let i = 0; i * 3 < pos.length; i++) r = Math.min(r, Math.hypot(pos[i * 3], pos[i * 3 + 1]))
  return r
}

/** radius (cm) of ghost n's badge as rendered: its thin ring's crisp core */
export function ghostBadgeRadius(n: number): number {
  return renderedOuterRadius("Ghost_" + n) - HOVER_PROFILE.span + HOVER_PROFILE.coreAt + HOVER_PROFILE.coreW / 2
}

/** Even-odd point-in-polygon on screen points. */
function inPoly(poly: vec2[], p: vec2): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j]
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside
  }
  return inside
}

/**
 * Every shown ghost number must be readable: no glow ring may cover it on screen, as `cam` sees it.
 * The glow's outer ring is read from the rendered SuggestGlow mesh: its inner edge plus
 * (ringAt + ringW) of the glow profile at the mesh's own scale, plus 1 profile cm for the ring's
 * soft halo. That circle is projected to the screen as a polygon, and so is the circle of each
 * badge's ring around its number: no point of the badge circle (so no part of the number inside
 * it) may fall inside the glow's outer ring. Also: no two badges overlap, the numbers draw after
 * the glow and the badges (render order), and no dot of the sequence path sits under a badge.
 * Returns a summary line.
 */
export function checkGhostNumbersClear(cam: Camera, errs: string[], tag: string): string {
  const glowSo = mustFind("SuggestGlow")
  const out: string[] = []
  const glowOn = glowSo.enabled
  let poly: vec2[] = []
  let glowInv: mat4 | null = null
  let glowW: mat4 | null = null
  let ringOuter = 0
  if (glowOn) {
    const rIn = renderedInnerRadius("SuggestGlow"), rOut = renderedOuterRadius("SuggestGlow")
    const k = (rOut - rIn) / GLOW_PROFILE.span
    ringOuter = rIn + (GLOW_PROFILE.ringAt + GLOW_PROFILE.ringW + 1.0) * k
    glowW = glowSo.getTransform().getWorldTransform()
    glowInv = glowSo.getTransform().getInvertedWorldTransform()
    for (let i = 0; i < 64; i++) {
      const t = (i / 64) * Math.PI * 2
      poly.push(cam.worldSpaceToScreenSpace(glowW.multiplyPoint(new vec3(ringOuter * Math.cos(t), ringOuter * Math.sin(t), 0))))
    }
  }
  const glowOrder = (glowSo.getComponent("Component.RenderMeshVisual") as RenderMeshVisual).getRenderOrder()
  const badges: {c: vec3; r: number}[] = []
  for (let n = 1; n <= 3; n++) {
    const numSo = mustFind("GhostNumber_" + n)
    if (!numSo.enabled) continue
    const num = numSo.getComponent("Component.Text") as Text
    const ringOrder = (mustFind("Ghost_" + n).getComponent("Component.RenderMeshVisual") as RenderMeshVisual).getRenderOrder()
    if (!(num.getRenderOrder() > glowOrder && num.getRenderOrder() > ringOrder)) {
      errs.push(`${tag}: ghost ${n} number render order ${num.getRenderOrder()} is not above the glow (${glowOrder}) and its badge (${ringOrder})`)
    }
    const c = numSo.getTransform().getWorldPosition()
    const rb = ghostBadgeRadius(n)
    badges.push({c, r: rb})
    if (!glowOn) { out.push(`${n}: no glow`); continue }
    const l = glowInv!.multiplyPoint(c)
    const centre = Math.hypot(l.x, l.y)
    let covered = 0
    const screen: vec2[] = [cam.worldSpaceToScreenSpace(c)]
    for (let i = 0; i < 24; i++) {
      const t = (i / 24) * Math.PI * 2
      screen.push(cam.worldSpaceToScreenSpace(glowW!.multiplyPoint(new vec3(l.x + rb * Math.cos(t), l.y + rb * Math.sin(t), 0))))
    }
    for (const p of screen) if (inPoly(poly, p)) covered++
    if (covered) errs.push(`${tag}: ghost ${n}'s number is covered by the glow: ${covered} of ${screen.length} points of its badge (centre + circle r ${rb.toFixed(2)} cm) are inside the glow's outer ring (r ${ringOuter.toFixed(2)} cm, number ${centre.toFixed(2)} cm from the glow centre)`)
    out.push(`${n}: ${(centre - rb - ringOuter).toFixed(2)} cm clear`)
  }
  // nor may another badge's ring run through a number: badge circles must not overlap
  for (let i = 0; i < badges.length; i++) {
    for (let j = i + 1; j < badges.length; j++) {
      const gap = Math.hypot(badges[i].c.x - badges[j].c.x, badges[i].c.y - badges[j].c.y)
      if (gap < badges[i].r + badges[j].r) errs.push(`${tag}: ghost ${i + 1} and ghost ${j + 1} badges overlap (${gap.toFixed(2)} cm apart, radii ${badges[i].r.toFixed(2)} + ${badges[j].r.toFixed(2)})`)
    }
  }
  let dots = 0
  for (let n = 1; n <= 2; n++) {
    for (const d of ghostPathDots(n)) {
      dots++
      for (let b = 0; b < badges.length; b++) {
        const gap = Math.hypot(d.x - badges[b].c.x, d.y - badges[b].c.y)
        if (gap < badges[b].r) errs.push(`${tag}: GhostPath_${n} has a dot ${gap.toFixed(2)} cm from ghost ${b + 1}'s number, inside its badge (r ${badges[b].r.toFixed(2)})`)
      }
    }
  }
  return `numbers vs glow: ${out.join(", ") || "no ghosts"}; path ${dots} dots`
}

/** The dot centres (wall-plane world x, y) of GhostPath_n's rendered mesh, or [] if it is hidden.
 *  Each dot's centre is a vertex at U = 0, the solid middle of the marker profile. */
export function ghostPathDots(n: number): vec2[] {
  const p = mustFind("GhostPath_" + n)
  if (!p.enabled) return []
  const m = (p.getComponent("Component.RenderMeshVisual") as RenderMeshVisual).mesh
  const pos = m.getVertexDataForAttribute("position"), uv = m.getVertexDataForAttribute("texture0")
  const w = p.getTransform().getWorldTransform()
  const out: vec2[] = []
  const seen: {[k: string]: boolean} = {}
  for (let i = 0; i * 2 < uv.length; i++) {
    if (uv[i * 2] > 1e-4) continue
    const key = pos[i * 3].toFixed(2) + "," + pos[i * 3 + 1].toFixed(2)
    if (seen[key]) continue
    seen[key] = true
    const d = w.multiplyPoint(new vec3(pos[i * 3], pos[i * 3 + 1], 0))
    out.push(new vec2(d.x, d.y))
  }
  return out
}

// ── setup only: bring the Lens back to the demo preset ──────────────────────

/**
 * Scenarios share one live Lens. Put it back to the open state (climb mode,
 * Ground view, '?' off, preset position, best move auto-selected) through the ACTION API.
 * This is setup, not the behaviour under test. The last call is always a
 * pressHold so the Lens re-runs its auto-select exactly as at open.
 */
export async function restorePreset(main: NextHoldMain): Promise<void> {
  restoreProblem(main)
  if (main.getMode() !== "climb") main.pressMode()
  if (main.isAskArmed()) main.pressAsk()
  if (main.getView() !== "ground") main.pressView()
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
