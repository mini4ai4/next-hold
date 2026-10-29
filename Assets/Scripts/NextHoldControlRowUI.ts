// NextHoldControlRowUI — the compact control row on the wall plane (brief:
// "Control row"). Four limb toggles (LH, RH, LF, RF), a '?' button, a
// Setup/Climb mode switch, a Ground / On wall view switch and the climber's
// height (− / +), plus the small not-a-spotter note underneath.
//
// Owns: the row's UIKit widgets and their lit/unlit look. Passive view.
// Main -> UI: setSelectedLimb(), setAskArmed(), setMode(), setView(), setHeight(), placeAt().
// UI -> Main: onLimbPressed, onAskPressed, onModePressed, onViewPressed, onHeightStep (-1 / +1).
// Must not: hold climbing state or decide anything; Main owns all state.
//
// Stable scene names for tests: Toggle_LH, Toggle_RH, Toggle_LF, Toggle_RF,
// AskButton, ModeSwitch, ViewToggle, HeightDown, HeightUp, HeightLabel, SafetyNote.

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

const LIMB_ORDER = ["LH", "RH", "LF", "RF"]

/** UI Kit's current Specs look (SnapOS 3 prism buttons); set before the button initialises */
const BUTTON_VARIANT = {theme: "SnapOS3", shape: "Rectangle", style: "Prism"}

@component
export class NextHoldControlRowUI extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">NextHoldControlRowUI – limb toggles, ? and mode switch</span>')
  @ui.separator
  @ui.group_start("Settings")
  @input
  @hint("Width of each control button in cm (brief: about 8 cm)")
  @widget(new SliderWidget(6, 12, 0.5))
  buttonWidth: number = 8

  @input
  @hint("Height of each control button in cm")
  @widget(new SliderWidget(3, 8, 0.5))
  buttonHeight: number = 5

  @input
  @hint("Gap between buttons in cm (brief: 2 cm or more)")
  @widget(new SliderWidget(2, 5, 0.25))
  buttonGap: number = 2

  @input
  @hint("Not-a-spotter note shown under the row. Never use the word 'safe'.")
  safetyNote: string = "Bouldering / top-rope aid only. Not a spotter or instructor."

  @input
  @hint("Mode switch label while in climb mode")
  climbLabel: string = "Climb"

  @input
  @hint("Mode switch label while in setup mode")
  setupLabel: string = "Setup"

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
  get onLimbPressed(): PublicApi<string> { return this._onLimbPressed.publicApi() }
  get onAskPressed(): PublicApi<void> { return this._onAskPressed.publicApi() }
  get onModePressed(): PublicApi<void> { return this._onModePressed.publicApi() }
  get onViewPressed(): PublicApi<void> { return this._onViewPressed.publicApi() }
  /** −1 or +1: one step down or up (Main decides the step and the range) */
  get onHeightStep(): PublicApi<number> { return this._onHeightStep.publicApi() }

  private limbButtons: {[limb: string]: Button} = {}
  private askButton: Button
  private modeButton: Button
  private modeLabel: Text
  private viewButton: Button
  private viewLabel: Text
  private heightLabel: Text
  private backPlate: BackPlate

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
    flex.rowGap = 0.8
    flex.paddingTop = 1.2
    flex.paddingBottom = 1.0
    flex.paddingLeft = 1.4
    flex.paddingRight = 1.4
    flex.onLayoutComplete.add((r) => {
      backPlate.size = new vec2(r.containerWidth, r.containerHeight)
    })

    // Two rows of three (hands above feet) so the block fits inside the SPECS
    // view at ~1 m; a single 6-button row is ~60 cm, wider than the view there.
    // The view switch gets a third row of its own.
    const n = 3
    const rowW = n * this.buttonWidth + (n - 1) * this.buttonGap
    const addLimb = (row: SceneObject, limb: string) => {
      const b = this.addButton(row, "Toggle_" + limb, limb, this.buttonWidth, this.buttonHeight, "Headline1")
      this.limbButtons[limb] = b.btn
      b.btn.onTriggerUp.add(() => {
        this._onLimbPressed.invoke(limb)
        this.resync.reset(0)
      })
    }
    this.flexChild(content, {w: rowW, h: this.buttonHeight}, (rowSO) => {
      rowSO.name = "HandsRow"
      const row = this.makeFlex(rowSO, FlexDirection.Row, rowW, this.buttonHeight, this.buttonGap)
      addLimb(row, "LH")
      addLimb(row, "RH")
      const ask = this.addButton(row, "AskButton", "?", this.buttonWidth, this.buttonHeight, "HeadlineXL")
      this.askButton = ask.btn
      ask.btn.onTriggerUp.add(() => {
        this._onAskPressed.invoke()
        this.resync.reset(0)
      })
    })
    this.flexChild(content, {w: rowW, h: this.buttonHeight}, (rowSO) => {
      rowSO.name = "FeetRow"
      const row = this.makeFlex(rowSO, FlexDirection.Row, rowW, this.buttonHeight, this.buttonGap)
      addLimb(row, "LF")
      addLimb(row, "RF")
      const mode = this.addButton(row, "ModeSwitch", this.climbLabel, this.buttonWidth, this.buttonHeight, "Headline2")
      this.modeButton = mode.btn
      this.modeLabel = mode.label
      mode.btn.onTriggerUp.add(() => {
        this._onModePressed.invoke()
        this.resync.reset(0)
      })
    })
    // one view switch, two buttons wide so "On wall" fits at the button text size
    const viewW = 2 * this.buttonWidth + this.buttonGap
    this.flexChild(content, {w: rowW, h: this.buttonHeight}, (rowSO) => {
      rowSO.name = "ViewRow"
      const row = this.makeFlex(rowSO, FlexDirection.Row, rowW, this.buttonHeight, this.buttonGap)
      const view = this.addButton(row, "ViewToggle", this.groundLabel, viewW, this.buttonHeight, "Headline2")
      this.viewButton = view.btn
      this.viewLabel = view.label
      view.btn.onTriggerUp.add(() => {
        this._onViewPressed.invoke()
        this.resync.reset(0)
      })
    })
    // the climber's height: reach comes from it, so a step recolours the wall for that body
    const stepW = this.buttonHeight
    const heightW = rowW - 2 * (stepW + this.buttonGap)
    this.flexChild(content, {w: rowW, h: this.buttonHeight}, (rowSO) => {
      rowSO.name = "HeightRow"
      const row = this.makeFlex(rowSO, FlexDirection.Row, rowW, this.buttonHeight, this.buttonGap)
      // the signs are thin glyphs: drawn at title size so they read as large as the letters
      const down = this.addButton(row, "HeightDown", "−", stepW, this.buttonHeight, "Title1", false)
      down.btn.onTriggerUp.add(() => this._onHeightStep.invoke(-1))
      this.flexChild(row, {w: heightW, h: this.buttonHeight}, (so) => {
        so.name = "HeightLabel"
        this.heightLabel = this.addButtonLabel(so, "Height 175 cm", heightW, "Headline2")
        this.heightLabel.getSceneObject().getTransform().setLocalPosition(new vec3(0, 0, LAYOUT_Z_LIFT))
      })
      const up = this.addButton(row, "HeightUp", "+", stepW, this.buttonHeight, "Title1", false)
      up.btn.onTriggerUp.add(() => this._onHeightStep.invoke(+1))
    })

    this.flexChild(content, {w: rowW, h: 3.6}, (noteSO) => {
      noteSO.name = "SafetyNote"
      const t = noteSO.createComponent("Component.Text") as Text
      t.text = this.safetyNote
      t.depthTest = true
      applyTextRole(t, "Caption", VIEW_DISTANCE_CM)
      t.textFill.color = new vec4(1, 1, 1, 0.7)
      t.horizontalAlignment = HorizontalAlignment.Center
      t.verticalAlignment = VerticalAlignment.Center
      t.horizontalOverflow = HorizontalOverflow.Wrap
      t.verticalOverflow = VerticalOverflow.Overflow
      t.layoutRect = Rect.create(-rowW / 2, rowW / 2, -1.8, 1.8)
    })

    // UIKit toggles flip themselves on press; re-apply Main's state one frame
    // later so the lit button always matches the real state.
    this.resync = this.createEvent("DelayedCallbackEvent")
    this.resync.bind(() => this.applyStates())
    this.applyStates()
  }

  // ── Main -> UI ────────────────────────────────────────────────────────────
  setSelectedLimb(limb: string | null): void {
    this.selectedLimb = limb
    this.applyStates()
  }

  setAskArmed(armed: boolean): void {
    this.askArmed = armed
    this.applyStates()
  }

  setMode(mode: string): void {
    this.mode = mode
    this.applyStates()
  }

  setView(view: string): void {
    this.view = view
    this.applyStates()
  }

  setHeight(cm: number): void {
    if (this.heightLabel) this.heightLabel.text = "Height " + Math.round(cm) + " cm"
  }

  /** Read-back for tests: the height as shown. */
  getHeightLabel(): string { return this.heightLabel ? this.heightLabel.text : "" }

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

  /** The whole block (both rows of buttons and the note) in cm at its 110 cm size (scale 1), as laid
   *  out; null before the first layout. */
  getSize(): vec2 | null {
    const s = this.backPlate ? this.backPlate.size : null
    return s && s.x > 0 && s.y > 0 ? s : null
  }

  /** Read-back for tests. */
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
    if (this.modeLabel) this.modeLabel.text = this.mode === "setup" ? this.setupLabel : this.climbLabel
    if (this.viewButton) this.viewButton.isOn = this.view === "wall"
    if (this.viewLabel) this.viewLabel.text = this.view === "wall" ? this.onWallLabel : this.groundLabel
  }

  /** Read-back for tests: the view switch's label as shown. */
  getViewLabel(): string { return this.viewLabel ? this.viewLabel.text : "" }

  // ── builders ──────────────────────────────────────────────────────────────
  private addButton(parent: SceneObject, name: string, label: string, w: number, h: number,
                    role: TextRole, toggleable = true): {btn: Button; label: Text} {
    let btn: Button
    let text: Text
    this.flexChild(parent, {w, h}, (so) => {
      so.name = name
      btn = so.createComponent(Button.getTypeName()) as Button
      btn.setVariant(BUTTON_VARIANT)
      btn.size = new vec3(w, h, 1)
      btn.setIsToggleable(toggleable)
      text = this.addButtonLabel(so, label, w - 0.5, role)
    })
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

  private makeFlex(so: SceneObject, direction: FlexDirection, width: number, height: number, gap: number): SceneObject {
    const f = so.createComponent(FlexLayout.getTypeName()) as FlexLayout
    f.autoDiscoverItemsOnStart = false
    f.onInitialized.add(() => {
      f.width = width
      f.height = height
      f.direction = direction
      if (direction === FlexDirection.Row) f.columnGap = gap
      else f.rowGap = gap
      f.justifyContent = FlexJustify.Center
      f.alignItems = FlexAlign.Center
    })
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
