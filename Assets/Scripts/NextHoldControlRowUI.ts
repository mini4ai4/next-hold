// NextHoldControlRowUI — the control row on the wall plane (brief: "Control row"; v7 part G, session 24:
// fewer, bigger controls).
//
// One fixed 2 x 2 grid of 11 x 10 cm cells, 3 cm apart, and three pages over it, one shown at a time:
//   climb:    "Show my beta" / "Hide beta" (on the mats only)   ?   /   Body   Setup
//   body:     LH  RH  /  LF  RF       (the preview's stand-in for body tracking; picking one closes it)
//   settings: Mark holds   Ground|On wall   /   − 175 cm +   Setup (lit: pinch it to close)
// So at most 4 buttons show while climbing (3 on the wall), each at least 10 cm, gaps at least 3 cm. Above
// the grid one short line, empty unless there is something to say (an override, "Pick a limb", the cue);
// under it "Planned for 175 cm" and the not-a-spotter note. "?" carries one dot per hint rung.
//
// Owns: the row's UIKit widgets, their lit/unlit look and which page shows. Passive view.
// Main -> UI: setSelectedLimb(), setAskArmed(), setMode(), setView(), setHeight(), setBetaShown(), setCue(),
//             setOverride(), setPage(), setAskDots(), placeAt().
// UI -> Main: onLimbPressed, onAskPressed, onModePressed, onViewPressed, onShowBetaPressed, onHeightStep (-1 / +1),
//             onBodyPressed, onSetupPressed.
// Must not: hold climbing state or decide anything; Main owns all state (the page too).
//
// Stable scene names for tests: ShowBetaButton, AskButton, AskDot_1..3, BodyButton, SetupButton, Toggle_LH, Toggle_RH,
// Toggle_LF, Toggle_RF, ModeSwitch, ViewToggle, HeightRow, HeightDown, HeightUp, HeightLabel, OverrideLabel,
// PlannedLine, SafetyNote, ButtonGrid.

import {BackPlate} from "SpectaclesUIKit.lspkg/Scripts/BackPlate"
import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import {FlexLayout} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout"
import {FlexItem} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem"
import {FlexAlign, FlexDirection, FlexJustify} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"

// ── Typography: the single source of truth for text size + weight ────────────
const FONT_SIZE_SCALE = 1.0
type TextRole =
  | "Title1" | "Title2" | "HeadlineXL" | "Headline1" | "Headline2"
  | "Subheadline" | "Button" | "Callout" | "Body" | "Caption"
const TYPE_SCALE: Record<TextRole, {size: number; weight: number}> = {
  Title1: {size: 105, weight: 700}, Title2: {size: 93, weight: 700},
  HeadlineXL: {size: 62, weight: 700}, Headline1: {size: 54, weight: 700},
  Headline2: {size: 48, weight: 700}, Subheadline: {size: 41, weight: 700},
  Button: {size: 39, weight: 500}, Callout: {size: 39, weight: 700},
  Body: {size: 39, weight: 500}, Caption: {size: 38, weight: 500},
}
function roleSize(role: TextRole, distanceCm: number = 110): number {
  return TYPE_SCALE[role].size * FONT_SIZE_SCALE * (distanceCm / 110)
}
function applyTextRole(t: Text, role: TextRole, distanceCm: number = 110): void {
  t.size = roleSize(role, distanceCm)
  ;(t as Text & {weight?: number}).weight = TYPE_SCALE[role].weight
}

const LAYOUT_Z_LIFT = 0.02
/** in front of the prism's face, including its 0.3 cm hover pop */
const BUTTON_LABEL_Z = 1.6
/** Text uses the 110 cm scale; the row is ~100 cm away, so it reads a little larger. */
const VIEW_DISTANCE_CM = 110

/** session 24 (G): one cell of the grid, and the gap between cells (cm, at the row's 110 cm size) */
export const CELL_W = 11
export const CELL_H = 10
export const CELL_GAP = 3
export const GRID_W = 2 * CELL_W + CELL_GAP
export const GRID_H = 2 * CELL_H + CELL_GAP
/** the setup page's − and + (not a climbing control) */
const STEP_W = 5
const LIMB_ORDER = ["LH", "RH", "LF", "RF"]

const SHOW_BETA_TEXT = "Show my\nbeta"
const HIDE_BETA_TEXT = "Hide\nbeta"
export type RowPage = "climb" | "body" | "settings"

/** UI Kit's current Specs look (SnapOS 3 prism buttons); set before the button initialises */
const BUTTON_VARIANT = {theme: "SnapOS3", shape: "Rectangle", style: "Prism"}

/** cell centres in the grid (cm): top-left, top-right, bottom-left, bottom-right */
const CELL = {
  TL: new vec2(-(CELL_W + CELL_GAP) / 2, (CELL_H + CELL_GAP) / 2),
  TR: new vec2((CELL_W + CELL_GAP) / 2, (CELL_H + CELL_GAP) / 2),
  BL: new vec2(-(CELL_W + CELL_GAP) / 2, -(CELL_H + CELL_GAP) / 2),
  BR: new vec2((CELL_W + CELL_GAP) / 2, -(CELL_H + CELL_GAP) / 2),
}

@component
export class NextHoldControlRowUI extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">NextHoldControlRowUI – the row: climb, body and setup pages</span>')
  @ui.separator
  @ui.group_start("Settings")
  @input
  @hint("Not-a-spotter note shown under the row, one short line (session 24). Never use the word 'safe'.")
  noteLine: string = "Bouldering/top-rope aid. Not a spotter."

  @input
  @hint("Mode switch label while climbing: pinch to mark the problem (session 24)")
  markLabel: string = "Mark holds"

  @input
  @hint("Mode switch label while marking: pinch to climb again (session 24)")
  markingLabel: string = "Climb"

  @input
  @hint("View switch label while every ring and the ghosts show (standing back at the base)")
  groundLabel: string = "Ground"

  @input
  @hint("View switch label while only the suggested hold shows (on the wall)")
  onWallLabel: string = "On wall"
  @ui.group_end

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
  private modeButton: Button
  private modeLabel: Text
  private viewButton: Button
  private viewLabel: Text
  private heightLabel: Text
  private plannedLine: Text
  private overrideLabel: Text
  private backPlate: BackPlate
  private betaButton: Button
  private betaLabel: Text
  private bodyButton: Button
  private setupButton: Button
  private askDots: Text[] = []
  private dots = ""
  private betaShown = false
  private overrideLimb: string | null = null
  private cue: string | null = null
  private page: RowPage = "climb"
  /** every button object with the pages it shows on (and Ground only for "Show my beta"), and whether UI Kit has set it up */
  private items: {so: SceneObject; pages: RowPage[]; groundOnly?: boolean; ready: boolean}[] = []
  private heightRow: SceneObject

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
    })

    // the top line: empty unless there is something to say
    this.flexChild(content, {w: GRID_W, h: 2.6}, (so) => {
      so.name = "OverrideLabel"
      this.overrideLabel = this.addButtonLabel(so, "", GRID_W, "Headline2")
      this.overrideLabel.getSceneObject().getTransform().setLocalPosition(new vec3(0, 0, LAYOUT_Z_LIFT))
    })

    // the grid: one fixed size whatever the page, so the row never changes size (and Main never re-places it for a page)
    this.flexChild(content, {w: GRID_W, h: GRID_H}, (grid) => {
      grid.name = "ButtonGrid"
      // climb page
      const beta = this.addButton(grid, "ShowBetaButton", SHOW_BETA_TEXT, CELL.TL, CELL_W, CELL_H, "Headline2", ["climb"], true)
      this.betaButton = beta.btn
      this.betaLabel = beta.label
      beta.btn.onTriggerUp.add(() => this.fire(() => this._onShowBetaPressed.invoke()))
      const ask = this.addButton(grid, "AskButton", "?", CELL.TR, CELL_W, CELL_H, "HeadlineXL", ["climb"])
      this.askButton = ask.btn
      ask.label.getSceneObject().getTransform().setLocalPosition(new vec3(0, 1.2, BUTTON_LABEL_Z))
      for (let i = 0; i < 3; i++) {
        const d = this.obj(ask.btn.getSceneObject(), "AskDot_" + (i + 1), new vec3((i - 1) * 1.8, -3.0, BUTTON_LABEL_Z))
        const t = d.createComponent("Component.Text") as Text
        t.text = "•"
        t.depthTest = true
        applyTextRole(t, "HeadlineXL", VIEW_DISTANCE_CM)
        t.horizontalAlignment = HorizontalAlignment.Center
        t.verticalAlignment = VerticalAlignment.Center
        this.askDots.push(t)
      }
      ask.btn.onTriggerUp.add(() => this.fire(() => this._onAskPressed.invoke()))
      const body = this.addButton(grid, "BodyButton", "Body", CELL.BL, CELL_W, CELL_H, "Headline1", ["climb"])
      this.bodyButton = body.btn
      body.btn.onTriggerUp.add(() => this.fire(() => this._onBodyPressed.invoke()))
      const setup = this.addButton(grid, "SetupButton", "Setup", CELL.BR, CELL_W, CELL_H, "Headline2", ["climb", "settings"])
      this.setupButton = setup.btn
      setup.btn.onTriggerUp.add(() => this.fire(() => this._onSetupPressed.invoke()))
      // body page: hands above feet, as on the body
      const cells = [CELL.TL, CELL.TR, CELL.BL, CELL.BR]
      LIMB_ORDER.forEach((limb, i) => {
        const b = this.addButton(grid, "Toggle_" + limb, limb, cells[i], CELL_W, CELL_H, "Headline1", ["body"])
        this.limbButtons[limb] = b.btn
        b.btn.onTriggerUp.add(() => this.fire(() => this._onLimbPressed.invoke(limb)))
      })
      // settings page
      const mode = this.addButton(grid, "ModeSwitch", this.markLabel, CELL.TL, CELL_W, CELL_H, "Headline2", ["settings"])
      this.modeButton = mode.btn
      this.modeLabel = mode.label
      mode.btn.onTriggerUp.add(() => this.fire(() => this._onModePressed.invoke()))
      const view = this.addButton(grid, "ViewToggle", this.groundLabel, CELL.TR, CELL_W, CELL_H, "Headline2", ["settings"])
      this.viewButton = view.btn
      this.viewLabel = view.label
      view.btn.onTriggerUp.add(() => this.fire(() => this._onViewPressed.invoke()))
      // the climber's height: reach comes from it, so a step recolours the wall for that body
      this.heightRow = this.obj(grid, "HeightRow", new vec3(CELL.BL.x, CELL.BL.y, LAYOUT_Z_LIFT))
      this.items.push({so: this.heightRow, pages: ["settings"], ready: true})
      const hl = this.obj(this.heightRow, "HeightLabel", new vec3(0, 2.6, 0))
      this.heightLabel = this.addButtonLabel(hl, "175 cm", CELL_W, "Headline2")
      this.heightLabel.getSceneObject().getTransform().setLocalPosition(new vec3(0, 0, LAYOUT_Z_LIFT))
      // the signs are thin glyphs: drawn at title size so they read as large as the letters
      const down = this.addButton(this.heightRow, "HeightDown", "−", new vec2(-3, -2.4), STEP_W, STEP_W, "Title1", [], false, false)
      down.btn.onTriggerUp.add(() => this._onHeightStep.invoke(-1))
      const up = this.addButton(this.heightRow, "HeightUp", "+", new vec2(3, -2.4), STEP_W, STEP_W, "Title1", [], false, false)
      up.btn.onTriggerUp.add(() => this._onHeightStep.invoke(+1))
    })

    this.flexChild(content, {w: GRID_W, h: 2.2}, (so) => {
      so.name = "PlannedLine"
      this.plannedLine = this.addButtonLabel(so, "Planned for 175 cm", GRID_W, "Body")
      this.plannedLine.getSceneObject().getTransform().setLocalPosition(new vec3(0, 0, LAYOUT_Z_LIFT))
      this.plannedLine.textFill.color = new vec4(1, 1, 1, 0.85)
    })

    this.flexChild(content, {w: GRID_W, h: 2.2}, (noteSO) => {
      noteSO.name = "SafetyNote"
      const t = noteSO.createComponent("Component.Text") as Text
      t.text = this.noteLine
      t.depthTest = true
      applyTextRole(t, "Caption", VIEW_DISTANCE_CM)
      t.textFill.color = new vec4(1, 1, 1, 0.7)
      t.horizontalAlignment = HorizontalAlignment.Center
      t.verticalAlignment = VerticalAlignment.Center
      t.horizontalOverflow = HorizontalOverflow.Shrink
      t.verticalOverflow = VerticalOverflow.Overflow
      t.layoutRect = Rect.create(-GRID_W / 2, GRID_W / 2, -1.1, 1.1)
    })

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
  setPage(page: RowPage): void { this.page = page; this.applyStates(); this.applyTopLine() }
  getPage(): RowPage { return this.page }

  setHeight(cm: number): void {
    if (this.heightLabel) this.heightLabel.text = Math.round(cm) + " cm"
    if (this.plannedLine) this.plannedLine.text = "Planned for " + Math.round(cm) + " cm"
  }

  /** The limb the next pinch on a hold will move instead of the best one, or null. */
  setOverride(limb: string | null): void { this.overrideLimb = limb; this.applyTopLine() }

  /** A small cue for the top line, or null. An override, the climber's own choice, keeps the line. */
  setCue(text: string | null): void { this.cue = text; this.applyTopLine() }

  /** The hint rungs as dots ("●○○"), or "" for none (beta shown: there is no ladder). */
  setAskDots(dots: string): void { this.dots = dots; this.applyDots() }

  private applyDots(): void {
    for (let i = 0; i < this.askDots.length; i++) {
      const t = this.askDots[i]
      t.getSceneObject().enabled = this.dots.length === 3
      t.textFill.color = new vec4(1, 1, 1, this.dots.charAt(i) === "●" ? 1 : 0.28)
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
  getHeightLabel(): string { return this.heightLabel ? this.heightLabel.text : "" }
  getPlannedLine(): string { return this.plannedLine ? this.plannedLine.text : "" }
  /** the dots as shown on "?": "●○○", or "" when they are hidden */
  getAskDots(): string { return this.askDots.length && this.askDots[0].getSceneObject().enabled ? this.dots : "" }
  isSetupLit(): boolean { return this.setupButton ? this.setupButton.isOn : false }

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

  /** The whole block (top line, grid, planned line and note) in cm at its 110 cm size (scale 1), as laid
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
    if (this.modeLabel) this.modeLabel.text = this.mode === "setup" ? this.markingLabel : this.markLabel
    if (this.viewButton) this.viewButton.isOn = this.view === "wall"
    if (this.viewLabel) this.viewLabel.text = this.view === "wall" ? this.onWallLabel : this.groundLabel
    if (this.betaButton) this.betaButton.isOn = this.betaShown
    if (this.betaLabel) this.betaLabel.text = this.betaShown ? HIDE_BETA_TEXT : SHOW_BETA_TEXT
    if (this.bodyButton) this.bodyButton.isOn = !!this.overrideLimb
    if (this.setupButton) this.setupButton.isOn = this.page === "settings"
    for (const it of this.items) {
      if (!it.ready) continue
      const on = it.pages.indexOf(this.page) >= 0 && (!it.groundOnly || this.view === "ground")
      if (it.so.enabled !== on) it.so.enabled = on
    }
  }

  /** Read-back for tests: the view switch's label as shown. */
  getViewLabel(): string { return this.viewLabel ? this.viewLabel.text : "" }

  // ── builders ──────────────────────────────────────────────────────────────
  /** a UI Kit button at `at` (cm, in the parent) on the given pages; an empty `pages` list leaves it to its parent */
  private addButton(parent: SceneObject, name: string, label: string, at: vec2, w: number, h: number,
                    role: TextRole, pages: RowPage[], groundOnly = false, toggleable = true): {btn: Button; label: Text} {
    const so = this.obj(parent, name, new vec3(at.x, at.y, LAYOUT_Z_LIFT))
    const btn = so.createComponent(Button.getTypeName()) as Button
    btn.setVariant(BUTTON_VARIANT)
    btn.size = new vec3(w, h, 1)
    btn.setIsToggleable(toggleable)
    const text = this.addButtonLabel(so, label, w - 0.5, role)
    if (pages.length) {
      const item = {so, pages, groundOnly, ready: false}
      this.items.push(item)
      // hidden only once UI Kit has set the button up (as the came-off card does)
      btn.onInitialized.add(() => {
        item.ready = true
        this.applyStates()
      })
    }
    return {btn, label: text}
  }

  private addButtonLabel(parent: SceneObject, text: string, widthCM: number, role: TextRole): Text {
    const so = this.obj(parent, "Label", new vec3(0, 0, BUTTON_LABEL_Z))
    const t = so.createComponent("Component.Text") as Text
    t.text = text
    t.depthTest = true
    applyTextRole(t, role, VIEW_DISTANCE_CM)
    t.horizontalAlignment = HorizontalAlignment.Center
    t.verticalAlignment = VerticalAlignment.Center
    t.horizontalOverflow = HorizontalOverflow.Overflow
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
