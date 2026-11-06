// Session 24, v7 part G: fewer, bigger controls (the SPECS live review: "a constant kind of pinching"; small
// buttons and lots of text are hard to hit with a pinch on glasses). Session 26 (v7.2): s24's run printed
// "Marknholds" and passed, so every page's labels are now checked word for word, and their size.
// Counted on what is enabled in the scene:
// - climbing, on the mats: at most 4 buttons ("Show my beta", "?", Body, Setup); on the wall a 1 x 2 strip, "?" and
//   Body, side by side, with no empty cell; its bottom edge never below the lower hand's hold as the eye sees it,
//   and over no hold of the problem;
// - every page (Setup's − and + too, session 26): each button at least 10 x 10 cm, every gap at least 3 cm;
// - each button's label exactly as the table below, drawn at its cap height: 2.2 cm, "?" 4 cm, two-line labels
//   1.7 cm; the word under "?" names its next step; the hint dots 1.2 cm, hollow "○" until taken;
// - the limb toggles are one "body" cluster: Body opens LH RH / LF RF in the same cells, and picking one closes it;
// - Setup/Climb, the view switch and height − / + are behind Setup, never on screen while climbing;
// - the top line is empty by default; the row's size doesn't change between the climb and body pages.
// Input path: real SIK pinches on BodyButton, Toggle_LF, SetupButton, ShowBetaButton.

import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import {NextHoldMain} from "../../Scripts/NextHoldMain"
import {ASK_CAP_CM, DOT_CM, LABEL_CAP_CM, NextHoldControlRowUI, SMALL_CAP_CM} from "../../Scripts/NextHoldControlRowUI"
import {HOLD_SIZE, holdById} from "../../Scripts/Wall/WallLayout"
import {camera, fmtBox, frames, getMain, mustFind, pinch, restorePreset, screenBoxOf} from "./NextHoldTestKit"

const MAX_CLIMBING = 4
const MIN_CM = 10
const MIN_GAP = 3

/** session 26: what each button must read, per page */
const LABELS: {[page: string]: {[name: string]: string}} = {
  mats: {ShowBetaButton: "Show my\nbeta", AskButton: "?", BodyButton: "Body", SetupButton: "Setup"},
  matsBeta: {ShowBetaButton: "Hide\nbeta", AskButton: "?", BodyButton: "Body", SetupButton: "Setup"},
  body: {Toggle_LH: "LH", Toggle_RH: "RH", Toggle_LF: "LF", Toggle_RF: "RF"},
  setup: {ModeSwitch: "Mark\nholds", ViewToggle: "Ground", HeightDown: "−", HeightUp: "+", SetupButton: "Done"},
  wall: {AskButton: "?", BodyButton: "Body"},
}

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

/** a button's own label (its child "Label") */
function labelOf(button: string): Text | null {
  const so = mustFind(button)
  for (let i = 0; i < so.getChildrenCount(); i++) {
    const c = so.getChild(i)
    if (c.name === "Label") return c.getComponent("Component.Text") as Text
  }
  return null
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

function check(main: NextHoldMain, errs: string[], tag: string, page: string, climbing: boolean): string {
  const want = LABELS[page]
  const bs = visibleButtons()
  const names = bs.map((b) => b.name).sort()
  if (names.join() !== Object.keys(want).sort().join()) errs.push(`${tag}: buttons ${names.join(", ")}, want ${Object.keys(want).sort().join(", ")}`)
  if (climbing && bs.length > MAX_CLIMBING) errs.push(`${tag}: ${bs.length} buttons while climbing, at most ${MAX_CLIMBING}`)
  let least = 1e9
  const read: string[] = []
  for (const b of bs) {
    // session 26: the size and gap rule on every page, Setup's − / + included
    if (b.w < MIN_CM || b.h < MIN_CM) errs.push(`${tag}: ${b.name} is ${b.w} x ${b.h} cm, want ${MIN_CM} or more each way`)
    for (const o of bs) {
      if (o === b) continue
      const gap = Math.max(Math.abs(o.x - b.x) - (o.w + b.w) / 2, Math.abs(o.y - b.y) - (o.h + b.h) / 2)
      least = Math.min(least, gap)
      if (gap < MIN_GAP - 1e-3) errs.push(`${tag}: ${b.name} and ${o.name} are ${gap.toFixed(2)} cm apart, want ${MIN_GAP} or more`)
    }
    // the label, word for word, and its cap height (Text.size per cm of cap, NextHoldControlRowUI.capSize)
    const t = labelOf(b.name)
    const text = t ? t.text : "(none)"
    if (want[b.name] !== undefined && text !== want[b.name]) errs.push(`${tag}: ${b.name} reads "${text}", want "${want[b.name]}"`)
    // (session 28: the view switch at the small cap too, so "Ground" / "On wall" don't fill the cell)
    const cap = text === "?" || text === "−" || text === "+" ? ASK_CAP_CM : b.name === "ShowBetaButton" || b.name === "ViewToggle" ? SMALL_CAP_CM : LABEL_CAP_CM
    const size = t ? t.size : 0
    if (size < NextHoldControlRowUI.capSize(cap) - 0.01) errs.push(`${tag}: ${b.name}'s label is size ${size.toFixed(1)}, under the ${cap} cm cap (${NextHoldControlRowUI.capSize(cap).toFixed(1)})`)
    // and as drawn: the label's rendered height against its button's (a 10 cm cell)
    if (t) {
      const lo = t.worldAabbMin(), hi = t.worldAabbMax(), k = mustFind(b.name).getTransform().getWorldScale().y
      const hCm = (hi.y - lo.y) / k
      read.push(`${b.name} "${text.replace("\n", " ")}" ${hCm.toFixed(2)} cm`)
      // (− and + are flat glyphs: their size is checked, not their drawn height)
      if (text !== "−" && text !== "+" && hCm < cap * (text.indexOf("\n") >= 0 ? 2 : 1) - 0.05) errs.push(`${tag}: ${b.name}'s label draws ${hCm.toFixed(2)} cm tall, want at least ${cap} cm a line`)
    }
  }
  for (const t of visibleTexts()) {
    const lines = t.text.split("\n")
    if (t.text.length > 40 || lines.length > 2) errs.push(`${tag}: "${t.text}" (${t.name}) is more than one short line`)
    if (/override: none|\\n|Markn/i.test(t.text)) errs.push(`${tag}: "${t.text}" (${t.name}) shows`)
  }
  for (const n of ["ModeSwitch", "ViewToggle", "HeightDown", "HeightUp"]) {
    if (climbing && mustFind(n).isEnabledInHierarchy) errs.push(`${tag}: ${n} is on screen while climbing`)
  }
  return `${bs.length} buttons (${bs.map((b) => `${b.name} ${b.w}x${b.h}`).join(", ")}), least gap ${least === 1e9 ? "-" : least.toFixed(2)} cm; labels ${read.join(", ")}`
}

/** "?": the word under it, and the dots, hollow until taken, 1.2 cm */
function checkAsk(main: NextHoldMain, errs: string[], tag: string, word: string, dots: string): string {
  if (main.getAskWord() !== word) errs.push(`${tag}: the word under "?" is "${main.getAskWord()}", want "${word}"`)
  if (main.getAskDots() !== dots) errs.push(`${tag}: dots "${main.getAskDots()}", want "${dots}"`)
  const out: string[] = []
  // session 28: no dots at all with the beta shown
  if (dots === "") {
    for (let i = 1; i <= 3; i++) if (mustFind("AskDot_" + i).isEnabledInHierarchy) errs.push(`${tag}: dot ${i} shows, want none`)
    return `word "${main.getAskWord()}", no dots`
  }
  for (let i = 1; i <= 3; i++) {
    const t = mustFind("AskDot_" + i).getComponent("Component.Text") as Text
    const glyph = dots.charAt(i - 1)
    if (t.text !== glyph) errs.push(`${tag}: dot ${i} draws "${t.text}", want "${glyph}"`)
    const lo = t.worldAabbMin(), hi = t.worldAabbMax(), k = mustFind("AskButton").getTransform().getWorldScale().x
    const w = (hi.x - lo.x) / k
    out.push(w.toFixed(2))
    if (w < DOT_CM - 0.2) errs.push(`${tag}: dot ${i} is ${w.toFixed(2)} cm across, want about ${DOT_CM}`)
  }
  return `word "${main.getAskWord()}", dots "${main.getAskDots()}" ${out.join("/")} cm`
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
    print(`[G1] mats: ${check(main, errs, "mats", "mats", true)}`)
    print(`[G1] mats: ${checkAsk(main, errs, "mats", "Hint", "○○○")}`)
    if (main.getOverrideLabel() !== "") errs.push(`mats: the top line reads "${main.getOverrideLabel()}", want empty`)
    if (main.getPlannedLine() !== "Planned for 175 cm") errs.push(`mats: "${main.getPlannedLine()}"`)

    // ── beta shown: the same four, the toggle reads "Hide beta"; session 28: "?" reads Why ("?" then a ring), no dots
    //    (they read as a ladder not yet climbed under a word promising its last rung) ──
    await pinch("ShowBetaButton"); await frames(3)
    print(`[G1] mats, beta shown: ${check(main, errs, "mats, beta shown", "matsBeta", true)}`)
    print(`[G1] mats, beta shown: ${checkAsk(main, errs, "mats, beta shown", "Why", "")}`)
    sameSize("beta shown")
    await pinch("ShowBetaButton"); await frames(2)
    // one rung: a filled dot, the next word
    await pinch("AskButton"); await frames(2)
    print(`[G1] rung 1: ${checkAsk(main, errs, "rung 1", "Move", "●○○")}`)
    // session 28: at ●●● a fourth pinch gives nothing new: no word
    await pinch("AskButton"); await frames(2)
    await pinch("AskButton"); await frames(2)
    print(`[G1] rung 3: ${checkAsk(main, errs, "rung 3", "", "●●●")}`)
    await restorePreset(main, false)
    await frames(3)

    // ── the body cluster: four limbs in the same cells; a pick closes it ──
    await pinch("BodyButton"); await frames(3)
    print(`[G1] body: ${check(main, errs, "body", "body", true)}`)
    if (main.getPage() !== "body" || main.getOverrideLabel() !== "Pick a limb") errs.push(`body: page ${main.getPage()}, top line "${main.getOverrideLabel()}"`)
    sameSize("body")
    await pinch("Toggle_LF"); await frames(3)
    print(`[G1] LF picked: ${check(main, errs, "LF picked", "mats", true)}`)
    if (main.getPage() !== "climb" || main.getLimbOverride() !== "LF" || main.getOverrideLabel() !== "Limb override: LF") errs.push(`LF picked: page ${main.getPage()}, override ${main.getLimbOverride()}, "${main.getOverrideLabel()}"`)
    const body = mustFind("BodyButton").getComponent(Button.getTypeName()) as Button
    if (!body.isOn) errs.push("LF picked: Body isn't lit while an override waits")

    // ── setup: the mode, the view and the height (− and + full cells), and Done ──
    await pinch("SetupButton"); await frames(4)
    print(`[G1] setup: ${check(main, errs, "setup", "setup", false)}`)
    if (main.getPage() !== "settings" || !main.isSetupLit() || main.getRowLayout() !== "settings") errs.push(`setup: page ${main.getPage()}, Setup lit ${main.isSetupLit()}, layout ${main.getRowLayout()}`)
    // session 28 (v7.3 P1-7): − and + on the bottom row, Done above them, and right under − and + the line that says what
    // they change: "Your height: 175 cm"; the view switch's word inside its cell
    {
      const bs = visibleButtons()
      const at = (n: string) => bs.filter((b) => b.name === n)[0]
      const dn = at("HeightDown"), up = at("HeightUp"), done = at("SetupButton"), mode = at("ModeSwitch")
      const lowest = Math.min(...bs.map((b) => b.y))
      if (!dn || !up || !done || !mode || Math.abs(dn.y - lowest) > 0.01 || Math.abs(up.y - lowest) > 0.01 || !(done.y > dn.y && done.y < mode.y))
        errs.push(`setup: rows ${bs.map((b) => `${b.name}@${b.y.toFixed(1)}`).join(", ")}; want − and + lowest, Done between them and the top row`)
      if (main.getPlannedLine() !== "Your height: 175 cm") errs.push(`setup: the line under − and + reads "${main.getPlannedLine()}", want "Your height: 175 cm"`)
      const grid = mustFind("ButtonGrid").getTransform().getInvertedWorldTransform()
      const ly = grid.multiplyPoint(mustFind("PlannedLine").getTransform().getWorldPosition()).y
      if (dn && !(ly < dn.y - dn.h / 2)) errs.push(`setup: the height line (y ${ly.toFixed(1)}) isn't under − and + (y ${dn.y.toFixed(1)})`)
      const vt = labelOf("ViewToggle")
      if (vt) {
        const k = mustFind("ViewToggle").getTransform().getWorldScale().x
        const w = (vt.worldAabbMax().x - vt.worldAabbMin().x) / k
        print(`[G1] setup: "${vt.text}" ${w.toFixed(2)} cm wide in an 11 cm cell; the height line "${main.getPlannedLine()}" at y ${ly.toFixed(1)}`)
        if (w > 10 + 0.01) errs.push(`setup: "${vt.text}" is ${w.toFixed(2)} cm wide, more than its cell's 10 cm of room`)
      }
    }
    await pinch("SetupButton"); await frames(3)
    if (main.getPage() !== "climb" || main.isSetupLit()) errs.push(`setup closed: page ${main.getPage()}, lit ${main.isSetupLit()}`)
    sameSize("back from setup")

    // ── on the wall: the 1 x 2 strip at the side of the hands, never below them ──
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
      await frames(5)
      if (main.getView() !== "wall") errs.push(`wall: the view is ${main.getView()}`)
      print(`[G1] wall: ${check(main, errs, "wall", "wall", true)}`)
      const bs = visibleButtons()
      const a = bs.filter((b) => b.name === "AskButton")[0], b = bs.filter((x) => x.name === "BodyButton")[0]
      if (main.getRowLayout() !== "strip" || !a || !b || Math.abs(a.y - b.y) > 0.01 || !(b.x > a.x)) errs.push(`wall: layout ${main.getRowLayout()}, "?" ${JSON.stringify(a)}, Body ${JSON.stringify(b)}: want one row, "?" then Body`)
      // as the wearer sees it: the strip's lower edge is no lower than the lower hand's hold, and it covers no hold
      const live = camera()
      const strip = [screenBoxOf("AskButton", live, true), screenBoxOf("BodyButton", live, true)]
      if (!strip[0] || !strip[1]) errs.push("wall: the strip doesn't render")
      else {
        const box = {x0: Math.min(strip[0].x0, strip[1].x0), x1: Math.max(strip[0].x1, strip[1].x1), y0: Math.min(strip[0].y0, strip[1].y0), y1: Math.max(strip[0].y1, strip[1].y1)}
        const pos = main.getPosition()
        const hands = [pos.LH, pos.RH].filter((id) => !!id) as string[]
        const lowY = Math.max(...hands.map((id) => live.worldSpaceToScreenSpace(main.getHoldWorldPosition(id)!).y))
        const covered: string[] = []
        for (const id of main.getProblemHolds()) {
          const c = main.getHoldWorldPosition(id)!, r = HOLD_SIZE[holdById(id)!.type].ringR
          const s = live.worldSpaceToScreenSpace(c), e = live.worldSpaceToScreenSpace(c.add(new vec3(r, 0, 0)))
          const rx = Math.abs(e.x - s.x), ry = rx * live.aspect
          if (s.x + rx > box.x0 && s.x - rx < box.x1 && s.y + ry > box.y0 && s.y - ry < box.y1) covered.push(id)
        }
        print(`[G1] wall: strip ${fmtBox(box)}; lower hand's hold at screen y ${lowY.toFixed(3)}; over ${covered.length ? covered.join(", ") : "no hold"}`)
        if (box.y1 > lowY + 0.005) errs.push(`wall: the strip reaches down to y ${box.y1.toFixed(3)}, below the lower hand's hold (y ${lowY.toFixed(3)})`)
        if (covered.length) errs.push(`wall: the strip covers ${covered.join(", ")}`)
      }
    } finally {
      main.setSizingCamera(null)
      so.destroy()
    }
    print(`[G1] before (session 23): 10 buttons while climbing, 8 x 5 cm, 2 cm gaps; Setup's − / + 5 x 5 cm (session 24); now ${visibleButtons().length}`)

    await restorePreset(main)
    expect(errs.length, "fewer, bigger controls:\n" + errs.join("\n")).toBe(0)
  }
}
