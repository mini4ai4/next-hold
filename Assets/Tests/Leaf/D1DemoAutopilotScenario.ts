// Session 17, the demo autopilot (Assets/Scripts/Demo): it plays VIDEO_PLAN scenes 0-7 by itself
// for the screen recording. This plays the whole timeline at x8 and checks, in the frame each
// DemoTimeline.CHECKS entry fires, that the scene reached its key state:
//   0 the lit Ground read by 2.5 s (glow, "R hand", the tags, TOP, on screen); 1 Ground at 2.5 m
//   with the tags; 2 still Ground at 1.35 m, then On wall under 80 cm with one ring and "R hand",
//   both fully in the shot; 3 after the pinch the ring is on h09, then Ground again with the tags
//   moved on; 4 back at the start, "2 · LH" on h09 at 155 cm and on h10 at 195 cm, with the −/+ row
//   in the shot; 5 LF on lh is green, "?" on h11 says "POCKET HOLD · HIGH STEP", over h11's own ring
//   in that score's colour; 6 the off-view arrow pointing at the next hold with no panel in the way,
//   and gone when looking back; 7 the setup picker: open on h12, Crimp, Start, Done, reopened, Removed.
// Session 18, every frame of the take: On wall the panel's screen box never overlaps the ring's;
// each height change happens with the −/+ row in the shot; every pinch shows its ripple there.
// The view is the Lens's own: the autopilot moves the wearer's camera, so Main measures the real
// eye distance (no sizing camera). It also checks that idle the autopilot touches nothing, every
// scene start is logged in order, and stop() hands back tracking, hidden objects and colours.

import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {findSceneObjectsByName, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {DemoAutopilot} from "../../Scripts/Demo/DemoAutopilot"
import {ACTIONS, CHECKS, DemoAction, HIDE_WHILE_PLAYING, SCENES} from "../../Scripts/Demo/DemoTimeline"
import {NextHoldMain} from "../../Scripts/NextHoldMain"
import {HOLDS} from "../../Scripts/Wall/WallLayout"
import {
  activeRingBox, camera, checkArrowPointsAt, checkRowClearOfRing, checkWhyAgrees, eyeToWallCm, fmtBox, frames, getMain,
  makeReference, mustFind, notOnScreen, restorePreset, screenBoxOf,
} from "./NextHoldTestKit"

const SPEED = 8

/** where each autopilot action's pinch lands, so its ripple shows there: a hold id or a button's scene name */
function rippleTarget(a: DemoAction): string {
  switch (a.do) {
    case "pressLimb": return "Toggle_" + a.arg
    case "pressHold": return String(a.arg)
    case "pressHeight": return (a.arg as number) > 0 ? "HeightUp" : "HeightDown"
    case "pressAsk": return "AskButton"
    case "pressMode": return "ModeSwitch"
    case "pressView": return "ViewToggle"
    case "pickType": return "TypeButton_" + a.arg
    case "pressStart": return "StartButton"
    case "pressTop": return "TopButton"
    case "pressDone": return "DoneButton"
    case "pressRemove": return "RemoveButton"
  }
  return "?"
}

/** the alpha an overlay is drawn at: UI Kit's opacityFactor, a material's baseColor or a text's fill */
function alphaOf(name: string): number {
  const so = mustFind(name)
  const text = so.getComponent("Component.Text") as Text
  if (text) return text.textFill.color.w
  const pass = (so.getComponent("Component.RenderMeshVisual") as RenderMeshVisual).mainMaterial.mainPass
  return typeof pass.opacityFactor === "number" ? pass.opacityFactor : (pass.baseColor as vec4).w
}

function badge(n: number): {hold: string | null; text: string | null} {
  const so = mustFind("GhostNumber_" + n)
  if (!so.enabled) return {hold: null, text: null}
  return {hold: getMain().getGhostHold(n), text: (so.getComponent("Component.Text") as Text).text}
}

function ringsShown(): string[] {
  return HOLDS.filter((h) => mustFind("Ring_" + h.id).enabled).map((h) => h.id)
}

/** each key state; returns the problems, empty when the scene is where it should be */
function checkKey(key: string, main: NextHoldMain, pilot: DemoAutopilot): string[] {
  const e: string[] = []
  const d = eyeToWallCm(camera())
  const view = main.getView()
  const pos = main.getPosition()
  const want = (cond: boolean, msg: string) => { if (!cond) e.push(msg) }
  const ground = (lo: number, hi: number) => {
    want(view === "ground" && main.getViewLabel() === "Ground", `view ${view} ("${main.getViewLabel()}"), want Ground`)
    want(d >= lo && d <= hi, `eye ${d.toFixed(0)} cm from the wall, want ${lo}-${hi}`)
  }
  const onWall = (ring: string, label: string) => {
    want(view === "wall" && main.getViewLabel() === "On wall", `view ${view} ("${main.getViewLabel()}"), want On wall`)
    want(d < 80, `eye ${d.toFixed(0)} cm from the wall, want under 80`)
    const r = ringsShown()
    want(r.length === 1 && r[0] === ring, `rings ${r.join(",") || "none"}, want only ${ring}`)
    want(main.isLabelVisible() && main.getLabelText() === label, `label "${main.getLabelText()}" (shown ${main.isLabelVisible()}), want "${label}"`)
    // session 18: the one ring (its whole glow) and its word fully in the shot, and the panel clear of it
    const g = activeRingBox(camera())
    want(!!g && g.x0 >= 0 && g.x1 <= 1 && g.y0 >= 0 && g.y1 <= 1, `the glow of ${ring} is not fully in view (${fmtBox(g)})`)
    const off = notOnScreen(["SuggestLabel"], camera())
    want(!off.length, `not fully in view: ${off.join(", ")}`)
    checkRowClearOfRing(camera(), e, "on wall")
  }
  /** session 18, scene 4: the −/+ row and badge 2 in the shot while the height changes; session 19:
   *  and the whole glow of "up" (move 1) */
  const heightInShot = () => {
    const off = notOnScreen(["HeightDown", "HeightLabel", "HeightUp", "GhostNumber_2"], camera())
    want(!off.length, `not fully in view: ${off.join(", ")}`)
    print(`[d1] ${key}: row ${fmtBox(screenBoxOf("HeightDown", camera()))} .. ${fmtBox(screenBoxOf("HeightUp", camera()))}, ` +
      `badge 2 ${fmtBox(screenBoxOf("GhostNumber_2", camera()))}`)
    glowInShot("up")
  }
  /** session 19: the glowing ring's whole glow is inside the frame */
  const glowInShot = (id: string) => {
    const g = activeRingBox(camera())
    want(main.isRingGlowing(id), `the glow is not on ${id}`)
    want(!!g && g.x0 >= 0 && g.x1 <= 1 && g.y0 >= 0 && g.y1 <= 1, `the glow of ${id} is cut by the frame (${fmtBox(g)})`)
    print(`[d1] ${key}: glow of ${id} ${fmtBox(g)}`)
  }
  const badge2 = (hold: string, text: string) => {
    const b = badge(2)
    want(b.hold === hold && b.text === text, `badge 2 "${b.text}" on ${b.hold}, want "${text}" on ${hold}`)
  }
  switch (key) {
    case "s0-ground-read":
      // session 18: the hook lands in 2 s: the lit Ground read, the glow on up with "R hand", the
      // 1-2-3 and TOP, all faded in and on screen
      ground(240, 270)
      want(pilot.getOverlayAlpha() === 1, `overlay alpha ${pilot.getOverlayAlpha()}, want 1 by 2 s`)
      for (const n of ["Ring_h09", "SuggestGlow", "SuggestLabel", "GhostNumber_2", "Tag_h20"]) {
        want(alphaOf(n) > 0.5, `${n} drawn at alpha ${alphaOf(n).toFixed(2)} at 2.5 s`)
      }
      want(main.isRingGlowing("up") && main.isLabelVisible() && main.getLabelText() === "R hand",
        `glow on up ${main.isRingGlowing("up")}, label "${main.getLabelText()}" shown ${main.isLabelVisible()}`)
      badge2("h09", "2 · LH")
      want(main.getTagText("h20") === "TOP", `h20 tag "${main.getTagText("h20")}", want TOP`)
      {
        const off = notOnScreen(["SuggestLabel", "GhostNumber_2", "GhostNumber_3", "Tag_h20"], camera())
        want(!off.length, `not fully in view: ${off.join(", ")}`)
      }
      break
    case "s1-lower":
    case "s1-upper":
      ground(240, 260)
      want(pilot.getOverlayAlpha() === 1, `overlay alpha ${pilot.getOverlayAlpha()}, want 1 (faded in)`)
      // (the suggestion label fades by itself in Ground, so the badge is the overlay text checked here)
      want(alphaOf("GhostNumber_2") > 0.5 && alphaOf("Ring_up") > 0.5, "badge 2 or Ring_up is still faded out")
      {
        const occupied = (id: string) => ["LH", "RH", "LF", "RF"].some((l) => (pos as any)[l] === id)
        const free = main.getProblemHolds().filter((id) => !occupied(id)).sort().join()
        want(ringsShown().sort().join() === free, `rings ${ringsShown().join(",")}, want every free problem hold ${free}`)
      }
      want(main.isRingGlowing("up") && main.getLabelText() === "R hand", `glow/label: up glowing ${main.isRingGlowing("up")}, "${main.getLabelText()}"`)
      badge2("h09", "2 · LH")
      want(badge(3).text === "3 · LF" && badge(3).hold === "lh", `badge 3 "${badge(3).text}" on ${badge(3).hold}, want "3 · LF" on lh`)
      want(main.getTagText("h20") === "TOP", `h20 tag "${main.getTagText("h20")}", want TOP`)
      break
    case "s2-still-ground":
      ground(121, 150)
      break
    case "s2-on-wall":
      onWall("up", "R hand")
      break
    case "s3-after-pinch":
      want(pos.RH === "up", `RH on ${pos.RH}, want up`)
      want(main.getMarkerHold("RH") === "up", `RH marker on ${main.getMarkerHold("RH")}`)
      onWall("h09", "L hand")
      break
    case "s3-ground-again":
      ground(240, 260)
      want(main.isRingGlowing("h09"), "the glow is not on h09")
      badge2("lh", "2 · LF")
      break
    case "s4-start":
      want(pos.RH === "rh" && pos.LH === "lh", `not back at the start: RH ${pos.RH}, LH ${pos.LH}`)
      want(main.isRingGlowing("up"), "the glow is not on up")
      badge2("h09", "2 · LH")
      break
    case "s4-155":
      want(main.getHeightCm() === 155 && main.getHeightLabel() === "Height 155 cm", `height ${main.getHeightCm()} "${main.getHeightLabel()}", want 155`)
      badge2("h09", "2 · LH")
      heightInShot()
      break
    case "s4-195":
      want(main.getHeightCm() === 195 && main.getHeightLabel() === "Height 195 cm", `height ${main.getHeightCm()} "${main.getHeightLabel()}", want 195`)
      badge2("h10", "2 · LH")
      heightInShot()
      break
    case "s5-lf":
      want(main.getHeightCm() === 175, `height ${main.getHeightCm()}, want 175`)
      want(pos.RH === "up" && pos.LH === "h09", `RH ${pos.RH}, LH ${pos.LH}; want up, h09`)
      want(main.getSelectedLimb() === "LF" && main.getLitLimb() === "LF", `selected ${main.getSelectedLimb()}, lit ${main.getLitLimb()}`)
      want(main.getHoldColour("lh") === "green" && main.isRingVisible("lh"), `lh for LF is ${main.getHoldColour("lh")}`)
      glowInShot("lh")
      break
    case "s5-why":
      want(main.isWhyVisible() && main.getWhyHoldId() === "h11", `why-line shown ${main.isWhyVisible()} on ${main.getWhyHoldId()}`)
      want(main.getWhyText().indexOf("POCKET HOLD · HIGH STEP") >= 0, `why-line "${main.getWhyText()}"`)
      // session 18: the ring under it is the asked hold's and wears the colour it explains
      print(`[d1] s5-why: ${checkWhyAgrees(camera(), main, e, "s5-why")}`)
      break
    case "s6-away":
      want(main.isOffViewArrowVisible(), "no off-view arrow while looking away")
      // session 18: it points at the next hold, off screen, with no panel in the way
      print(`[d1] s6-away: ${checkArrowPointsAt(camera(), main, e, "s6-away")}`)
      break
    case "s6-back":
      want(!main.isOffViewArrowVisible(), "the off-view arrow stays after looking back")
      want(!main.isWhyVisible(), "the why-line is still open")
      ground(290, 310) // session 19: scenes 5-6 from 3.0 m
      break
    case "s7-picker":
      want(main.getMode() === "setup", `mode ${main.getMode()}`)
      want(main.isTypePickerVisible() && main.getPickerHold() === "h12", `picker shown ${main.isTypePickerVisible()} for ${main.getPickerHold()}`)
      want(main.isInProblem("h12"), "h12 not added to the problem")
      break
    case "s7-crimp":
      want(main.getPickerLitType() === "crimp" && main.getHoldType("h12") === "crimp", `lit ${main.getPickerLitType()}, h12 type ${main.getHoldType("h12")}`)
      want(main.isTypePickerVisible(), "the picker closed after the type")
      break
    case "s7-start":
      want(main.isStartLit() && main.getStartHolds().indexOf("h12") >= 0, `Start lit ${main.isStartLit()}, starts ${main.getStartHolds().join(",")}`)
      break
    case "s7-done":
      want(!main.isTypePickerVisible() && main.isInProblem("h12"), `picker shown ${main.isTypePickerVisible()}, h12 in ${main.isInProblem("h12")}`)
      break
    case "s7-reopened":
      want(main.isTypePickerVisible() && main.getPickerHold() === "h12" && main.getPickerLitType() === "crimp", `picker ${main.isTypePickerVisible()} ${main.getPickerHold()} ${main.getPickerLitType()}`)
      break
    case "s7-removed":
      want(!main.isTypePickerVisible() && !main.isInProblem("h12"), `picker shown ${main.isTypePickerVisible()}, h12 in ${main.isInProblem("h12")}`)
      break
    case "end":
      want(main.getMode() === "climb", `mode ${main.getMode()} at the end`)
      break
    default:
      e.push("no check written for this key")
  }
  return e
}

@component
export class D1DemoAutopilotScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const main = getMain()
    await restorePreset(main)
    const errs: string[] = []
    const pilot = mustFind("DemoAutopilot").getComponent(DemoAutopilot.getTypeName()) as DemoAutopilot
    if (!pilot) throw new Error("DemoAutopilot component not found")

    // off (the saved scene): nothing plays, the camera is tracked, nothing is hidden
    const tracking = camera().getSceneObject().getComponent("Component.DeviceTracking") as DeviceTracking
    if (pilot.playOnStart) errs.push("Play On Start is ticked in the scene: it must be off")
    if (pilot.isPlaying()) errs.push("the autopilot is playing before play()")
    if (tracking && !tracking.enabled) errs.push("device tracking is off while the autopilot is idle")
    const visuals = mustFind("[OPTIONAL] Visuals")
    const visualsWas = visuals.enabled
    const ringAlpha = alphaOf("Ring_up")

    const seen: {key: string; t: number; errs: string[]}[] = []
    const unsub = pilot.addCheckListener((key) => {
      seen.push({key, t: pilot.getTimelineTime(), errs: checkKey(key, main, pilot)})
    })
    let hiddenWhilePlaying = true
    // session 18, sampled every frame of the take: On wall the panel never overlaps the one ring on
    // screen; each time the height changes, the −/+ row is in the shot
    const frameErrs: {[m: string]: number} = {}
    const frameErr = (m: string) => { frameErrs[m] = (frameErrs[m] || 0) + 1 }
    let wallFrames = 0, heightChanges = 0, heightInScene4 = 0
    let lastHeight = main.getHeightLabel()
    const rippleFrom = main.getRippleLog().length
    let rippleSeen = rippleFrom
    const rippleShots: string[] = []
    try {
      pilot.play(SPEED)
      if (!pilot.isPlaying()) throw new Error("play() did not start")
      await frames(2)
      if (tracking && tracking.enabled) errs.push("device tracking still on while playing")
      for (const name of HIDE_WHILE_PLAYING) {
        for (const so of findSceneObjectsByName(name)) if (so.enabled) hiddenWhilePlaying = false
      }
      const t0 = getTime()
      while (pilot.isPlaying() && getTime() - t0 < 60) {
        await frames(1)
        if (main.getView() === "wall" && activeRingBox(camera())) {
          wallFrames++
          const fe: string[] = []
          checkRowClearOfRing(camera(), fe, `t=${pilot.getTimelineTime().toFixed(1)} on wall`)
          if (fe.length) frameErr(fe[0].replace(/^t=[\d.]+ /, "") + ` (first at t=${pilot.getTimelineTime().toFixed(1)})`)
        }
        const h = main.getHeightLabel()
        if (h !== lastHeight) {
          heightChanges++
          lastHeight = h
          // scene 4 is the height beat; scene 5 sets 175 again while the eye walks back to 2.5 m
          const tl = pilot.getTimelineTime()
          const off = tl >= SCENES[4].start && tl < SCENES[5].start ? notOnScreen(["HeightDown", "HeightLabel", "HeightUp"], camera()) : []
          if (tl >= SCENES[4].start && tl < SCENES[5].start) heightInScene4++
          if (off.length) frameErr(`height changed to "${h}" at t=${pilot.getTimelineTime().toFixed(1)} with not in view: ${off.join(", ")}`)
        }
        // session 19: where each pinch on a hold ripples on screen (its centre and its full start ring);
        // scenes 3 (the move On wall) and 8 (the climb to TOP) must show it
        const rl = main.getRippleLog()
        if (rl.length > rippleSeen) {
          rippleSeen = rl.length
          const r = rl[rl.length - 1]
          if (HOLDS.some((h) => h.id === r.target)) {
            const tl = pilot.getTimelineTime()
            const sc = SCENES.filter((s) => s.start <= tl).pop()
            const at = main.getRippleWorldPosition()!
            const c = camera().worldSpaceToScreenSpace(at)
            const rad = main.getRippleRadius()
            const edge = camera().worldSpaceToScreenSpace(at.add(new vec3(rad, 0, 0)))
            const rx = Math.abs(edge.x - c.x)
            const inShot = c.x - rx >= 0 && c.x + rx <= 1 && c.y >= 0 && c.y <= 1
            rippleShots.push(`${r.target}@${tl.toFixed(1)} (scene ${sc ? sc.n : "?"}) centre ${c.x.toFixed(2)},${c.y.toFixed(2)} ±${rx.toFixed(2)}`)
            if (sc && (sc.n === 3 || sc.n === 8) && !inShot) frameErr(`the pinch on ${r.target} at t=${tl.toFixed(1)} rippled off screen (centre ${c.x.toFixed(2)},${c.y.toFixed(2)} ±${rx.toFixed(2)})`)
          }
        }
      }
      if (pilot.isPlaying()) errs.push(`still playing after 60 s at x${SPEED}`)
    } finally {
      unsub()
      pilot.stop()
    }
    if (!hiddenWhilePlaying) errs.push(`something in ${HIDE_WHILE_PLAYING.join(", ")} still shown while playing`)

    // every key state, in order, each with no problems
    const keys = seen.map((s) => s.key)
    if (keys.join() !== CHECKS.map((c) => c.key).join()) errs.push(`checks fired: ${keys.join(",")}; want ${CHECKS.map((c) => c.key).join(",")}`)
    for (const s of seen) {
      print(`[d1] ${s.key} t=${s.t.toFixed(1)}: ${s.errs.length ? "FAIL " + s.errs.join("; ") : "ok"}`)
      for (const m of s.errs) errs.push(`${s.key}: ${m}`)
    }
    const fm = Object.keys(frameErrs)
    print(`[d1] every frame: ${wallFrames} On wall frames, panel vs ring ${fm.filter((m) => m.indexOf("overlaps") >= 0).length ? "OVERLAP" : "clear"}; ` +
      `${heightInScene4} height changes in scene 4, the −/+ row ${fm.filter((m) => m.indexOf("height") >= 0).length ? "OUT of shot" : "in shot"} at each`)
    for (const m of fm) errs.push(`${m} (${frameErrs[m]} frames)`)
    if (wallFrames < 10) errs.push(`only ${wallFrames} On wall frames sampled`)
    if (heightChanges !== 16 || heightInScene4 !== 12) errs.push(`${heightChanges} height changes seen (${heightInScene4} in scene 4); the timeline makes 16 (12)`)

    // session 18: every pinch of the take shows the ripple where it lands, in order
    const ripples = main.getRippleLog().slice(rippleFrom).map((r) => r.target)
    const wantRipples = ACTIONS.map(rippleTarget)
    print(`[d1] ripples: ${ripples.length} of ${wantRipples.length} pinches; on holds, on screen at: ${rippleShots.join("; ")}`)
    if (ripples.join() !== wantRipples.join()) errs.push(`ripples ${ripples.join(",")}; want ${wantRipples.join(",")}`)

    const log = pilot.getSceneLog()
    print(`[d1] scenes ${log.map((l) => `${l.n}@${l.t.toFixed(1)}`).join(" ")}`)
    if (log.map((l) => l.n).join() !== SCENES.map((s) => s.n).join()) errs.push(`scene log ${log.map((l) => l.n).join(",")}, want 0-7 in order`)

    // stopped: everything handed back
    await frames(3)
    if (tracking && !tracking.enabled) errs.push("device tracking not handed back after stop")
    if (visuals.enabled !== visualsWas) errs.push("SIK's hand visuals not handed back after stop")
    if (pilot.getOverlayAlpha() !== 1) errs.push(`overlay alpha ${pilot.getOverlayAlpha()} after stop`)
    if (Math.abs(alphaOf("Ring_up") - ringAlpha) > 1e-4) errs.push(`Ring_up alpha ${alphaOf("Ring_up")} after stop, was ${ringAlpha}`)

    await restorePreset(main)
    expect(errs.length, "demo autopilot:\n" + errs.join("\n")).toBe(0)
  }
}
