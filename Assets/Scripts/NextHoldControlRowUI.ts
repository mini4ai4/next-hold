// NextHoldControlRowUI — the control row on the wall plane (brief: "Control row"; v7 part G, session 24:
// fewer, bigger controls; v7.2, session 26: readable labels, a strip on the wall, full-size − / +).
//
// Cells of 11 x 10 cm, 3 cm apart, and three pages over them, one shown at a time:
//   climb, on the mats:  "Show my beta" / "Hide beta"   ?   /   Body   Setup            (2 x 2)
//   climb, on the wall:  ?   Body                                                     (1 x 2 strip, 25 x 10 cm:
//                        Setup is a mats action and "Show my beta" a mats read, so no empty cell)
//   body:                LH  RH  /  LF  RF       (the preview's stand-in for body tracking; picking one closes it)
//   settings:            Mark holds   Ground|On wall  /  −   +  /  Done                (2 x 3; − and + full cells)
// So at most 4 buttons show while climbing (2 on the wall), each at least 10 cm, gaps at least 3 cm. Above the
// cells one short line, empty unless there is something to say (an override, "Pick a limb", the cue); under them
// "Planned for 175 cm" (twice the size on the settings page: the one height readout) and the not-a-spotter note
// (both on the mats only). "?" carries the word for what its next pinch gives (Hint, Move, Why) and one dot per
// hint rung, hollow until taken, filled once taken; kept with beta shown.
// Session 26 type sizes (cap height at the row's 110 cm size): button labels 2.2 cm, "?" 4 cm, two-line labels and
// the word under "?" 1.7 cm, dots 1.2 cm across. Fixed copy is in consts, not @inputs: a stale @input default
// serialized in the .meta put "Marknholds" on screen (session 24).
//
// Owns: the row's UIKit widgets, their lit/unlit look and which page shows. Passive view.
// Main -> UI: setSelectedLimb(), setAskArmed(), setMode(), setView(), setHeight(), setBetaShown(), setCue(),
//             setOverride(), setPage(), setAskDots(), setAskWord(), setHidden(), placeAt().
// UI -> Main: onLimbPressed, onAskPressed, onModePressed, onViewPressed, onShowBetaPressed, onHeightStep (-1 / +1),
//             onBodyPressed, onSetupPressed.
// Must not: hold climbing state or decide anything; Main owns all state (the page too).
//
// Stable scene names for tests: ShowBetaButton, AskButton, AskWord, AskDot_1..3, BodyButton, SetupButton, Toggle_LH,
// Toggle_RH, Toggle_LF, Toggle_RF, ModeSwitch, ViewToggle, HeightDown, HeightUp, OverrideLabel, PlannedLine,
// SafetyNote, ButtonGrid. Each button's text is its child "Label".

import {BackPlate} from "SpectaclesUIKit.lspkg/Scripts/BackPlate"
import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import {FlexLayout} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout"
import {FlexItem} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem"
import {FlexAlign, FlexDirection, FlexJustify} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"

// ── Typography ───────────────────────────────────────────────────────────────
/** Text.size per cm of cap height at scale 1 (measured on the v7 shots: size 48-54 drew a ~0.9 cm cap) */
export const TEXT_PER_CM = 56
/** session 26 cap heights (cm, at the row's 110 cm size) */
export const LABEL_CAP_CM = 2.2
export const ASK_CAP_CM = 4
export const SMALL_CAP_CM = 1.7
/** session 28: the planned line's cap on the climb page (cm, at its 110 cm size) */
export const PLANNED_CAP_CM = 1.3
/** the "●"/"○" glyphs are about 0.6 of an em across, an em about 1.43 caps: the size that draws a 1.2 cm dot */
export const DOT_CM = 1.2
const DOT_SIZE = (DOT_CM / 0.6) * (TEXT_PER_CM / 1.43)
type TextRole = "Headline2" | "Body" | "Caption"
const TYPE_SCALE: Record<TextRole, {size: number; weight: number}> = {
  Headline2: {size: 48, weight: 700}, Body: {size: 39, weight: 500}, Caption: {size: 38, weight: 500},
}
function capSize(cm: number): number { return cm * TEXT_PER_CM }

const LAYOUT_Z_LIFT = 0.02
/** in front of the prism's face, including its 0.3 cm hover pop */
const BUTTON_LABEL_Z = 1.6

/** one cell, and the gap between cells (cm, at the row's 110 cm size) */
export const CELL_W = 11
export const CELL_H = 10
export const CELL_GAP = 3
export const GRID_W = 2 * CELL_W + CELL_GAP
export const GRID_H = 2 * CELL_H + CELL_GAP
/** the settings page: three rows of cells */
export const SETTINGS_GRID_H = 3 * CELL_H + 2 * CELL_GAP
const LIMB_ORDER = ["LH", "RH", "LF", "RF"]

/** session 26: the row's fixed copy (consts: an @input's stale serialized default once showed "Marknholds") */
export const SHOW_BETA_TEXT = "Show my\nbeta"
export const HIDE_BETA_TEXT = "Hide\nbeta"
export const MARK_TEXT = "Mark\nholds"
export const MARKING_TEXT = "Climb"
export const GROUND_TEXT = "Ground"
export const ON_WALL_TEXT = "On wall"
export const SETUP_TEXT = "Setup"
export const DONE_TEXT = "Done"
export const BODY_TEXT = "Body"
export const NOTE_TEXT = "Bouldering/top-rope aid. Not a spotter."
export type RowPage = "climb" | "body" | "settings"

/** UI Kit's current Specs look (SnapOS 3 prism buttons); set before the button initialises */
const BUTTON_VARIANT = {theme: "SnapOS3", shape: "Rectangle", style: "Prism"}

const COL = (CELL_W + CELL_GAP) / 2
const ROW = CELL_H + CELL_GAP

@component
export class NextHoldControlRowUI extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">NextHoldControlRowUI – the row: climb, body and setup pages</span>')

  private _onLimbPressed = new Event<string>()
  private _onAskPressed = new Event<void>()
  private _onModePressed = new Event<void>()
  private _onViewPressed = new Event<void>()
  private _onHeightStep = new Event<number>()
  private _onShowBetaPressed = new Event<void>()
  private _onBodyPressed = new Event<void>()
  private _onSetupPressed = new Event<void>()
  get onShowBetaPressed(): PublicApi<void> { return this._onShowBetaPressed.publicApi() }
  get onLimbPressed(): PublicApi<string> { return this._onLimbPressed.publicApi() }
  get onAskPressed(): PublicApi<void> { return this._onAskPressed.publicApi() }
  get onModePressed(): PublicApi<void> { return this._onModePressed.publicApi() }
  get onViewPressed(): PublicApi<void> { return this._onViewPressed.publicApi() }
  get onBodyPressed(): PublicApi<void> { return this._onBodyPressed.publicApi() }
  get onSetupPressed(): PublicApi<void> { return this._onSetupPressed.publicApi() }
  /** −1 or +1: one step down or up (Main decides the step and the range) */
  get onHeightStep(): PublicApi<number> { return this._onHeightStep.publicApi() }

  private limbButtons: {[limb: string]: Button} = {}
  private askButton: Button
  private askWord: Text
  private modeButton: Button
  private modeLabel: Text
  private viewButton: Button
  private viewLabel: Text
  private plannedLine: Text
  private plannedItem: FlexItem
  private noteText: Text
  private noteItem: FlexItem
  private gridItem: FlexItem
  private flex: FlexLayout
  /** the first layout pass has run (after it, a change of cells lays out at once) */
  private laidOut = false
  private overrideLabel: Text
  private backPlate: BackPlate
  private betaButton: Button
  private betaLabel: Text
  private bodyButton: Button
  private setupButton: Button
  private setupLabel: Text
  private askDots: Text[] = []
  private dots = ""
  private word = "Hint"
  private heightCm = 175
  private betaShown = false
  private overrideLimb: string | null = null
  private cue: string | null = null
  private page: RowPage = "climb"
  private hidden = false
  /** every button object: the pages it shows on, where it sits on each layout, whether it is a mats-only or a
   *  not-on-the-wall button, and whether UI Kit has set it up */
  private items: {so: SceneObject; pages: RowPage[]; at: {[layout: string]: vec2}; notOnWall?: boolean; ready: boolean}[] = []
  private layout = ""

  private selectedLimb: string | null = null
  private askArmed = false
  private mode = "climb"
  private view = "ground"
  private resync: DelayedCallbackEvent

  onAwake() {
    this.sceneObject.createComponent("Component.Canvas")
    const backPlate = this.sceneObject.createComponent(BackPlate.getTypeName()) as BackPlate
    this.backPlate = backPlate

    const content = this.obj(this.sceneObject, "Content", new vec3(0, 0, 0.6))
    const flex = content.createComponent(FlexLayout.getTypeName()) as FlexLayout
    this.flex = flex
    flex.autoDiscoverItemsOnStart = false // items are registered explicitly via addItems
    flex.width = -1
    flex.height = -1
    flex.direction = FlexDirection.Column
    flex.alignItems = FlexAlign.Center
    flex.justifyContent = FlexJustify.Center
    flex.rowGap = 0.6
    flex.paddingTop = 1.0
    flex.paddingBottom = 0.8
    flex.paddingLeft = 1.4
    flex.paddingRight = 1.4
    flex.onLayoutComplete.add((r) => {
      backPlate.size = new vec2(r.containerWidth, r.containerHeight)
      this.laidOut = true
    })

    // the top line: empty unless there is something to say
    this.flexChild(content, {w: GRID_W, h: 2.6}, (so) => {
      so.name = "OverrideLabel"
      this.overrideLabel = this.addText(so, "", GRID_W, TYPE_SCALE.Headline2.size, TYPE_SCALE.Headline2.weight)
      this.overrideLabel.getSceneObject().getTransform().setLocalPosition(new vec3(0, 0, LAYOUT_Z_LIFT))
    })

    // the cells; the grid's height follows the layout (the strip on the wall, three rows for the settings)
    const gridSO = this.flexChild(content, {w: GRID_W, h: GRID_H}, (grid) => {
      grid.name = "ButtonGrid"
      const TL = new vec2(-COL, ROW / 2), TR = new vec2(COL, ROW / 2), BL = new vec2(-COL, -ROW / 2), BR = new vec2(COL, -ROW / 2)
      // climb page (mats 2 x 2; wall strip: ? left, Body right)
      const beta = this.addButton(grid, "ShowBetaButton", SHOW_BETA_TEXT, SMALL_CAP_CM, ["climb"], {grid: TL})
      this.betaButton = beta.btn
      this.betaLabel = beta.label
      this.items[this.items.length - 1].notOnWall = true
      beta.btn.onTriggerUp.add(() => this.fire(() => this._onShowBetaPressed.invoke()))
      const ask = this.addButton(grid, "AskButton", "?", ASK_CAP_CM, ["climb"], {grid: TR, strip: new vec2(-COL, 0)})
      this.askButton = ask.btn
      ask.label.getSceneObject().getTransform().setLocalPosition(new vec3(0, 2.1, BUTTON_LABEL_Z))
      const wordSO = this.obj(ask.btn.getSceneObject(), "AskWord", new vec3(0, -1.6, BUTTON_LABEL_Z))
      this.askWord = this.addText(wordSO, "Hint", CELL_W - 1, capSize(SMALL_CAP_CM), 700)
      for (let i = 0; i < 3; i++) {
        const d = this.obj(ask.btn.getSceneObject(), "AskDot_" + (i + 1), new vec3((i - 1) * 2.2, -3.75, BUTTON_LABEL_Z))
        const t = d.createComponent("Component.Text") as Text
        t.text = "○"
        t.depthTest = true
        t.size = DOT_SIZE
        t.horizontalAlignment = HorizontalAlignment.Center
        t.verticalAlignment = VerticalAlignment.Center
        this.askDots.push(t)
      }
      ask.btn.onTriggerUp.add(() => this.fire(() => this._onAskPressed.invoke()))
      const body = this.addButton(grid, "BodyButton", BODY_TEXT, LABEL_CAP_CM, ["climb"], {grid: BL, strip: new vec2(COL, 0)})
      this.bodyButton = body.btn
      body.btn.onTriggerUp.add(() => this.fire(() => this._onBodyPressed.invoke()))
      const setup = this.addButton(grid, "SetupButton", SETUP_TEXT, LABEL_CAP_CM, ["climb", "settings"], {grid: BR, settings: new vec2(0, 0)})
      this.setupButton = setup.btn
      this.setupLabel = setup.label
      this.items[this.items.length - 1].notOnWall = true
      setup.btn.onTriggerUp.add(() => this.fire(() => this._onSetupPressed.invoke()))
      // body page: hands above feet, as on the body
      const cells = [TL, TR, BL, BR]
      LIMB_ORDER.forEach((limb, i) => {
        const b = this.addButton(grid, "Toggle_" + limb, limb, LABEL_CAP_CM, ["body"], {grid: cells[i]})
        this.limbButtons[limb] = b.btn
        b.btn.onTriggerUp.add(() => this.fire(() => this._onLimbPressed.invoke(limb)))
      })
      // settings page: three rows
      const mode = this.addButton(grid, "ModeSwitch", MARK_TEXT, LABEL_CAP_CM, ["settings"], {settings: new vec2(-COL, ROW)})
      this.modeButton = mode.btn
      this.modeLabel = mode.label
      mode.btn.onTriggerUp.add(() => this.fire(() => this._onModePressed.invoke()))
      // session 28 (v7.3 P1-7): "Ground" / "On wall" at the small cap: at 2.2 cm "Ground" filled its cell edge to edge
      const view = this.addButton(grid, "ViewToggle", GROUND_TEXT, SMALL_CAP_CM, ["settings"], {settings: new vec2(COL, ROW)})
      this.viewButton = view.btn
      this.viewLabel = view.label
      view.btn.onTriggerUp.add(() => this.fire(() => this._onViewPressed.invoke()))
      // the climber's height: reach comes from it, so a step recolours the wall for that body. Session 26: full cells
      // session 28 (v7.3 P1-7): − and + on the bottom row, right over the line that says what they change ("Your height:
      // 175 cm"); Done moves up to the middle row
      const down = this.addButton(grid, "HeightDown", "−", ASK_CAP_CM, ["settings"], {settings: new vec2(-COL, -ROW)}, false)
      down.btn.onTriggerUp.add(() => this._onHeightStep.invoke(-1))
      const up = this.addButton(grid, "HeightUp", "+", ASK_CAP_CM, ["settings"], {settings: new vec2(COL, -ROW)}, false)
      up.btn.onTriggerUp.add(() => this._onHeightStep.invoke(+1))
    })
    this.gridItem = gridSO.getComponent(FlexItem.getTypeName()) as FlexItem

    const planned = this.flexChild(content, {w: GRID_W, h: 2.2}, (so) => {
      so.name = "PlannedLine"
      this.plannedLine = this.addText(so, "Planned for 175 cm", GRID_W, TYPE_SCALE.Body.size, TYPE_SCALE.Body.weight)
      this.plannedLine.getSceneObject().getTransform().setLocalPosition(new vec3(0, 0, LAYOUT_Z_LIFT))
      this.plannedLine.textFill.color = new vec4(1, 1, 1, 0.85)
    })
    this.plannedItem = planned.getComponent(FlexItem.getTypeName()) as FlexItem

    const note = this.flexChild(content, {w: GRID_W, h: 2.2}, (noteSO) => {
      noteSO.name = "SafetyNote"
      const t = noteSO.createComponent("Component.Text") as Text
      t.text = NOTE_TEXT
      t.depthTest = true
      t.size = TYPE_SCALE.Caption.size
      ;(t as Text & {weight?: number}).weight = TYPE_SCALE.Caption.weight
      t.textFill.color = new vec4(1, 1, 1, 0.7)
      t.horizontalAlignment = HorizontalAlignment.Center
      t.verticalAlignment = VerticalAlignment.Center
      t.horizontalOverflow = HorizontalOverflow.Shrink
      t.verticalOverflow = VerticalOverflow.Overflow
      t.layoutRect = Rect.create(-GRID_W / 2, GRID_W / 2, -1.1, 1.1)
      this.noteText = t
    })
    this.noteItem = note.getComponent(FlexItem.getTypeName()) as FlexItem

    // UIKit toggles flip themselves on press; re-apply Main's state one frame
    // later so the lit button always matches the real state.
    this.resync = this.createEvent("DelayedCallbackEvent")
    this.resync.bind(() => this.applyStates())
    this.applyStates()
  }

  private fire(fn: () => void): void {
    fn()
    this.resync.reset(0)
  }

  // ── Main -> UI ────────────────────────────────────────────────────────────
  setSelectedLimb(limb: string | null): void { this.selectedLimb = limb; this.applyStates() }
  setAskArmed(armed: boolean): void { this.askArmed = armed; this.applyStates() }
  setMode(mode: string): void { this.mode = mode; this.applyStates() }
  setView(view: string): void { this.view = view; this.applyStates() }
  /** which page shows (Main decides) */
  setPage(page: RowPage): void { this.page = page; this.applyStates(); this.applyTopLine(); this.applyPlannedText() }
  getPage(): RowPage { return this.page }

  setHeight(cm: number): void {
    this.heightCm = Math.round(cm)
    this.applyPlannedText()
  }

  /** "Planned for 175 cm" under the climb page; session 28: "Your height: 175 cm" under Setup's − and + (they change it) */
  private applyPlannedText(): void {
    if (this.plannedLine) this.plannedLine.text = (this.page === "settings" ? "Your height: " : "Planned for ") + this.heightCm + " cm"
  }

  /** Session 26: the whole row hidden while the result card takes its place (Main decides). */
  setHidden(hidden: boolean): void {
    if (this.hidden === hidden) return
    this.hidden = hidden
    this.sceneObject.enabled = !hidden
  }
  isHidden(): boolean { return this.hidden }

  /** The limb the next pinch on a hold will move instead of the best one, or null. */
  setOverride(limb: string | null): void { this.overrideLimb = limb; this.applyTopLine() }

  /** A small cue for the top line, or null. An override, the climber's own choice, keeps the line. */
  setCue(text: string | null): void { this.cue = text; this.applyTopLine() }

  /** The hint rungs as dots ("●○○"): filled for a rung taken, hollow for one not taken. */
  setAskDots(dots: string): void { this.dots = dots; this.applyDots() }

  /** Session 26: the word under "?", what its next pinch gives (Hint, Move, Why). */
  setAskWord(word: string): void {
    this.word = word
    if (this.askWord) this.askWord.text = word
  }

  private applyDots(): void {
    for (let i = 0; i < this.askDots.length; i++) {
      const t = this.askDots[i]
      t.getSceneObject().enabled = this.dots.length === 3
      // filled: a white disc; hollow: a white ring (the glyphs themselves, so the difference is shape, not shade)
      t.text = this.dots.charAt(i) === "●" ? "●" : "○"
    }
  }

  private applyTopLine(): void {
    if (!this.overrideLabel) return
    this.overrideLabel.text = this.overrideLimb ? "Limb override: " + this.overrideLimb
      : this.page === "body" ? "Pick a limb" : this.cue || ""
  }

  /** "Show my beta" / "Hide beta" */
  setBetaShown(shown: boolean): void { this.betaShown = shown; this.applyStates() }

  /** Read-back for tests: the top line as shown. */
  getOverrideLabel(): string { return this.overrideLabel ? this.overrideLabel.text : "" }
  getShowBetaLabel(): string { return this.betaLabel ? this.betaLabel.text : "" }
  isShowBetaLit(): boolean { return this.betaButton ? this.betaButton.isOn : false }
  /** the height as the row reads it ("175 cm", in the planned line) */
  getHeightLabel(): string { return this.heightCm + " cm" }
  getPlannedLine(): string { return this.plannedLine ? this.plannedLine.text : "" }
  /** the dots as shown on "?": "●○○", or "" when they are hidden */
  getAskDots(): string { return this.askDots.length && this.askDots[0].getSceneObject().isEnabledInHierarchy ? this.dots : "" }
  getAskWord(): string { return this.askWord ? this.askWord.text : "" }
  isSetupLit(): boolean { return this.setupButton ? this.setupButton.isOn : false }
  /** the layout the cells are in: "grid" (2 x 2), "strip" (1 x 2, on the wall) or "settings" (2 x 3) */
  getLayout(): string { return this.layout }
  /** the Text.size each cap height draws at (for tests: label sizes) */
  static capSize(cm: number): number { return capSize(cm) }

  /** Move the row (Main computes where) and size it: scale 1 = its 110 cm size; Ground draws it
   *  larger from further back so it reads the same. */
  placeAt(worldPos: vec3, worldRot: quat, scale = 1): void {
    const tr = this.getTransform()
    tr.setWorldPosition(worldPos)
    tr.setWorldRotation(worldRot)
    tr.setWorldScale(vec3.one().uniformScale(scale))
  }

  /** How much larger the row is drawn than its 110 cm size. */
  getScale(): number { return this.getTransform().getWorldScale().x }

  /** The whole block (top line, cells, planned line and note) in cm at its 110 cm size (scale 1), as laid
   *  out; null before the first layout. */
  getSize(): vec2 | null {
    const s = this.backPlate ? this.backPlate.size : null
    return s && s.x > 0 && s.y > 0 ? s : null
  }

  isAskLit(): boolean { return this.askButton ? this.askButton.isOn : false }
  getLitLimb(): string | null {
    for (const l of LIMB_ORDER) if (this.limbButtons[l] && this.limbButtons[l].isOn) return l
    return null
  }

  private applyStates(): void {
    for (const limb of LIMB_ORDER) {
      const b = this.limbButtons[limb]
      if (b) b.isOn = limb === this.selectedLimb
    }
    if (this.askButton) this.askButton.isOn = this.askArmed
    if (this.modeButton) this.modeButton.isOn = this.mode === "setup"
    if (this.modeLabel) this.modeLabel.text = this.mode === "setup" ? MARKING_TEXT : MARK_TEXT
    if (this.viewButton) this.viewButton.isOn = this.view === "wall"
    if (this.viewLabel) this.viewLabel.text = this.view === "wall" ? ON_WALL_TEXT : GROUND_TEXT
    if (this.betaButton) this.betaButton.isOn = this.betaShown
    if (this.betaLabel) this.betaLabel.text = this.betaShown ? HIDE_BETA_TEXT : SHOW_BETA_TEXT
    if (this.bodyButton) this.bodyButton.isOn = !!this.overrideLimb
    if (this.setupButton) this.setupButton.isOn = this.page === "settings"
    if (this.setupLabel) this.setupLabel.text = this.page === "settings" ? DONE_TEXT : SETUP_TEXT
    const strip = this.page === "climb" && this.view === "wall"
    const layout = strip ? "strip" : this.page === "settings" ? "settings" : "grid"
    for (const it of this.items) {
      if (!it.ready) continue
      const on = it.pages.indexOf(this.page) >= 0 && !(strip && it.notOnWall)
      if (it.so.enabled !== on) it.so.enabled = on
      const at = it.at[layout] || it.at.grid
      if (on && at) {
        const p = it.so.getTransform().getLocalPosition()
        if (Math.abs(p.x - at.x) > 1e-4 || Math.abs(p.y - at.y) > 1e-4) it.so.getTransform().setLocalPosition(new vec3(at.x, at.y, LAYOUT_Z_LIFT))
      }
    }
    if (layout !== this.layout && this.gridItem) {
      this.layout = layout
      // the strip is one row of cells; the settings three; the rest two. On the wall the planned line and the note
      // are mats reading, gone with "Show my beta" and Setup; the settings page shows the height twice the size
      this.gridItem.overrideHeight = strip ? CELL_H : layout === "settings" ? SETTINGS_GRID_H : GRID_H
      this.plannedItem.overrideHeight = strip ? 0.01 : layout === "settings" ? 4.4 : 2.2
      // session 28 (v7.3 P0-2): on the climb page a 1.3 cm cap (was Body, 0.7 cm), so with the mats panel at its smallest
      // (x0.43, 60 cm out) "Planned for 155 cm" is still ~0.5° tall; the settings page twice Body as before
      this.plannedLine.size = layout === "settings" ? TYPE_SCALE.Body.size * 2 : capSize(PLANNED_CAP_CM)
      this.plannedLine.getSceneObject().enabled = !strip
      this.noteItem.overrideHeight = strip ? 0.01 : 2.2
      this.noteText.text = strip ? "" : NOTE_TEXT
      // lay out now, in this frame, so Main places the row at its new size (d1: the frame the view switched On wall
      // the 2 x 2 size was placed in the strip's spot, over the glow)
      if (this.flex && this.laidOut) this.flex.forceLayout()
    }
  }

  /** Read-back for tests: the view switch's label as shown. */
  getViewLabel(): string { return this.viewLabel ? this.viewLabel.text : "" }

  // ── builders ──────────────────────────────────────────────────────────────
  /** a UI Kit 11 x 10 cm button at its place on each layout ("grid", "strip", "settings"), on the given pages */
  private addButton(parent: SceneObject, name: string, label: string, capCm: number, pages: RowPage[],
                    at: {[layout: string]: vec2}, toggleable = true): {btn: Button; label: Text} {
    const first = at.grid || at.settings || at.strip
    const so = this.obj(parent, name, new vec3(first.x, first.y, LAYOUT_Z_LIFT))
    const btn = so.createComponent(Button.getTypeName()) as Button
    btn.setVariant(BUTTON_VARIANT)
    btn.size = new vec3(CELL_W, CELL_H, 1)
    btn.setIsToggleable(toggleable)
    const labelSO = this.obj(so, "Label", new vec3(0, 0, BUTTON_LABEL_Z))
    const text = this.addText(labelSO, label, CELL_W - 1, capSize(capCm), 700)
    const item = {so, pages, at, ready: false}
    this.items.push(item)
    // hidden only once UI Kit has set the button up (as the came-off card does)
    btn.onInitialized.add(() => {
      item.ready = true
      this.layout = "" // place every ready button again
      this.applyStates()
    })
    return {btn, label: text}
  }

  private addText(so: SceneObject, text: string, widthCM: number, size: number, weight: number): Text {
    const t = so.createComponent("Component.Text") as Text
    t.text = text
    t.depthTest = true
    t.size = size
    ;(t as Text & {weight?: number}).weight = weight
    t.horizontalAlignment = HorizontalAlignment.Center
    t.verticalAlignment = VerticalAlignment.Center
    // never wider than its cell: a long word shrinks to fit rather than spill onto the next button
    t.horizontalOverflow = HorizontalOverflow.Shrink
    t.verticalOverflow = VerticalOverflow.Overflow
    t.layoutRect = Rect.create(-widthCM / 2, widthCM / 2, -1.4, 1.4)
    return t
  }

  private obj(parent: SceneObject, name: string, position?: vec3): SceneObject {
    const so = global.scene.createSceneObject(name)
    so.setParent(parent)
    if (position) so.getTransform().setLocalPosition(position)
    return so
  }

  private flexChild(parent: SceneObject, size: {w?: number; h?: number; grow?: number},
                    builder: (child: SceneObject) => void): SceneObject {
    const child = this.obj(parent, "Item", new vec3(0, 0, LAYOUT_Z_LIFT))
    const item = child.createComponent(FlexItem.getTypeName()) as FlexItem
    if (size.w !== undefined && size.w > 0) item.overrideWidth = size.w
    if (size.h !== undefined && size.h > 0) item.overrideHeight = size.h
    item.flexGrow = size.grow ?? 0
    item.flexShrink = 0
    builder(child)
    const parentFlex = parent.getComponent(FlexLayout.getTypeName()) as FlexLayout | null
    if (parentFlex) parentFlex.addItems([item])
    return child
  }
}
