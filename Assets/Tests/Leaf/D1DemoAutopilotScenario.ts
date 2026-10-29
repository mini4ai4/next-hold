// Session 17, the demo autopilot (Assets/Scripts/Demo): it plays VIDEO_PLAN scenes 0-7 by itself
// for the screen recording. This plays the whole timeline at x8 and checks, in the frame each
// DemoTimeline.CHECKS entry fires, that the scene reached its key state:
//   0 no overlays; 1 Ground at 2.5 m with the tags; 2 still Ground at 1.35 m, then On wall under
//   80 cm with one ring and "R hand"; 3 after the pinch the ring is on h09, then Ground again with
//   the tags moved on; 4 back at the start, "2 · LH" on h09 at 155 cm and on h10 at 195 cm;
//   5 LF on lh is green, "?" on h11 says "POCKET HOLD · HIGH STEP"; 6 the off-view arrow, and gone
//   when looking back; 7 the setup picker: open on h12, Crimp, Start, Done, reopened, Removed.
// The view is the Lens's own: the autopilot moves the wearer's camera, so Main measures the real
// eye distance (no sizing camera). It also checks that idle the autopilot touches nothing, every
// scene start is logged in order, and stop() hands back tracking, hidden objects and colours.

import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {findSceneObjectsByName, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {DemoAutopilot} from "../../Scripts/Demo/DemoAutopilot"
import {CHECKS, HIDE_WHILE_PLAYING, SCENES} from "../../Scripts/Demo/DemoTimeline"
import {NextHoldMain} from "../../Scripts/NextHoldMain"
import {HOLDS} from "../../Scripts/Wall/WallLayout"
import {camera, eyeToWallCm, frames, getMain, mustFind, restorePreset} from "./NextHoldTestKit"

const SPEED = 8

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
  }
  const badge2 = (hold: string, text: string) => {
    const b = badge(2)
    want(b.hold === hold && b.text === text, `badge 2 "${b.text}" on ${b.hold}, want "${text}" on ${hold}`)
  }
  switch (key) {
    case "s0-no-overlays":
      want(pilot.getOverlayAlpha() === 0, `overlay alpha ${pilot.getOverlayAlpha()}, want 0`)
      for (const n of ["Ring_up", "SuggestGlow", "SuggestLabel", "GhostNumber_2", "Tag_h20"]) {
        want(alphaOf(n) < 0.01, `${n} drawn at alpha ${alphaOf(n).toFixed(2)} in scene 0`)
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
      break
    case "s4-195":
      want(main.getHeightCm() === 195 && main.getHeightLabel() === "Height 195 cm", `height ${main.getHeightCm()} "${main.getHeightLabel()}", want 195`)
      badge2("h10", "2 · LH")
      break
    case "s5-lf":
      want(main.getHeightCm() === 175, `height ${main.getHeightCm()}, want 175`)
      want(pos.RH === "up" && pos.LH === "h09", `RH ${pos.RH}, LH ${pos.LH}; want up, h09`)
      want(main.getSelectedLimb() === "LF" && main.getLitLimb() === "LF", `selected ${main.getSelectedLimb()}, lit ${main.getLitLimb()}`)
      want(main.getHoldColour("lh") === "green" && main.isRingVisible("lh"), `lh for LF is ${main.getHoldColour("lh")}`)
      break
    case "s5-why":
      want(main.isWhyVisible() && main.getWhyHoldId() === "h11", `why-line shown ${main.isWhyVisible()} on ${main.getWhyHoldId()}`)
      want(main.getWhyText().indexOf("POCKET HOLD · HIGH STEP") >= 0, `why-line "${main.getWhyText()}"`)
      break
    case "s6-away":
      want(main.isOffViewArrowVisible(), "no off-view arrow while looking away")
      break
    case "s6-back":
      want(!main.isOffViewArrowVisible(), "the off-view arrow stays after looking back")
      want(!main.isWhyVisible(), "the why-line is still open")
      ground(240, 260)
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
    try {
      pilot.play(SPEED)
      if (!pilot.isPlaying()) throw new Error("play() did not start")
      await frames(2)
      if (tracking && tracking.enabled) errs.push("device tracking still on while playing")
      for (const name of HIDE_WHILE_PLAYING) {
        for (const so of findSceneObjectsByName(name)) if (so.enabled) hiddenWhilePlaying = false
      }
      const t0 = getTime()
      while (pilot.isPlaying() && getTime() - t0 < 60) await frames(1)
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
