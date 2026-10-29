// NextHoldTypePickerUI — setup mode's type picker (brief: "Mark a hold").
// Big buttons beside the hold just pinched: jug / crimp / pinch / pocket / sloper,
// a row under them: Start (toggle: one of the problem's start holds) and Top (the
// problem's top hold), and a last row: Remove (take the hold out of the problem)
// and Done. Type, Start and Top can be pressed in any order; the picker stays open
// until Done or Remove (session 15: a type used to close it, so Start and Top only
// worked if pressed first).
//
// Owns: the picker panel and its buttons. Passive view, starts hidden.
// Main -> UI: showFor(), setFlags(), setType(), hide().
// UI -> Main: onTypePicked(type), onStartPressed, onTopPressed, onRemovePressed, onDonePressed.
// Must not: change hold types or the problem itself; Main owns them.
//
// Stable scene names for tests: TypePicker panel, TypeButton_<type>, StartButton, TopButton,
// RemoveButton, DoneButton.

import {BackPlate} from "SpectaclesUIKit.lspkg/Scripts/BackPlate"
import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import {FlexLayout} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout"
import {FlexItem} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem"
import {FlexAlign, FlexDirection, FlexJustify} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"

// ── Typography ───────────────────────────────────────────────────────────────
const FONT_SIZE_SCALE = 1.0
type TextRole = "Headline1" | "Headline2" | "Subheadline" | "Body" | "Caption"
const TYPE_SCALE: Record<TextRole, {size: number; weight: number}> = {
  Headline1: {size: 54, weight: 700}, Headline2: {size: 48, weight: 700},
  Subheadline: {size: 41, weight: 700}, Body: {size: 39, weight: 500}, Caption: {size: 38, weight: 500},
}
function applyTextRole(t: Text, role: TextRole, distanceCm: number = 110): void {
  t.size = TYPE_SCALE[role].size * FONT_SIZE_SCALE * (distanceCm / 110)
  ;(t as Text & {weight?: number}).weight = TYPE_SCALE[role].weight
}

const LAYOUT_Z_LIFT = 0.02
/** in front of the prism's face, including its 0.3 cm hover pop */
const BUTTON_LABEL_Z = 1.6
const TYPES = ["jug", "crimp", "pinch", "pocket", "sloper"]
/** same UI Kit look as the control row (SnapOS 3 prism buttons) */
const BUTTON_VARIANT = {theme: "SnapOS3", shape: "Rectangle", style: "Prism"}

@component
export class NextHoldTypePickerUI extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">NextHoldTypePickerUI – hold type picker (setup mode)</span>')
  @ui.separator
  @ui.group_start("Settings")
  @input
  @hint("Width of each type button in cm")
  @widget(new SliderWidget(8, 20, 0.5))
  buttonWidth: number = 13

  @input
  @hint("Height of each type button in cm")
  @widget(new SliderWidget(3, 8, 0.5))
  buttonHeight: number = 5

  @input
  @hint("Gap between type buttons in cm")
  @widget(new SliderWidget(1, 5, 0.25))
  buttonGap: number = 2

  @input
  @hint("Title above the type buttons")
  title: string = "Hold type"

  @input
  @hint("Width of the Start and Top buttons in cm")
  @widget(new SliderWidget(6, 12, 0.5))
  flagButtonWidth: number = 8
  @ui.group_end

  private _onTypePicked = new Event<string>()
  get onTypePicked(): PublicApi<string> { return this._onTypePicked.publicApi() }
  private _onStartPressed = new Event<void>()
  get onStartPressed(): PublicApi<void> { return this._onStartPressed.publicApi() }
  private _onTopPressed = new Event<void>()
  get onTopPressed(): PublicApi<void> { return this._onTopPressed.publicApi() }
  private _onRemovePressed = new Event<void>()
  get onRemovePressed(): PublicApi<void> { return this._onRemovePressed.publicApi() }
  private _onDonePressed = new Event<void>()
  get onDonePressed(): PublicApi<void> { return this._onDonePressed.publicApi() }

  private panel: SceneObject
  private buttons: {[type: string]: Button} = {}
  private startButton: Button
  private topButton: Button
  private current: string | null = null
  private isStart = false
  private isTop = false
  private wantVisible = false
  private ready = false
  private pending = TYPES.length + 5 // type buttons + Start + Top + Remove + Done + backplate
  private resync: DelayedCallbackEvent

  onAwake() {
    this.sceneObject.createComponent("Component.Canvas")
    this.panel = this.obj(this.sceneObject, "TypePickerPanel")
    const backPlate = this.panel.createComponent(BackPlate.getTypeName()) as BackPlate
    backPlate.onInitialized.add(() => this.markInit())

    const content = this.obj(this.panel, "Content", new vec3(0, 0, 0.6))
    const flex = content.createComponent(FlexLayout.getTypeName()) as FlexLayout
    flex.autoDiscoverItemsOnStart = false // items are registered explicitly via addItems
    flex.width = -1
    flex.height = -1
    flex.direction = FlexDirection.Column
    flex.alignItems = FlexAlign.Center
    flex.justifyContent = FlexJustify.Center
    flex.rowGap = this.buttonGap
    flex.paddingTop = 1.4
    flex.paddingBottom = 1.4
    flex.paddingLeft = 1.4
    flex.paddingRight = 1.4
    flex.onLayoutComplete.add((r) => {
      backPlate.size = new vec2(r.containerWidth, r.containerHeight)
    })

    this.flexChild(content, {w: this.buttonWidth, h: 2.6}, (so) => {
      so.name = "TypePickerTitle"
      const t = so.createComponent("Component.Text") as Text
      t.text = this.title
      t.depthTest = true
      applyTextRole(t, "Subheadline")
      t.textFill.color = new vec4(1, 1, 1, 0.8)
      t.horizontalAlignment = HorizontalAlignment.Center
      t.verticalAlignment = VerticalAlignment.Center
      t.horizontalOverflow = HorizontalOverflow.Overflow
      t.layoutRect = Rect.create(-this.buttonWidth / 2, this.buttonWidth / 2, -1.2, 1.2)
    })

    for (const type of TYPES) {
      this.flexChild(content, {w: this.buttonWidth, h: this.buttonHeight}, (so) => {
        so.name = "TypeButton_" + type
        const btn = so.createComponent(Button.getTypeName()) as Button
        btn.setVariant(BUTTON_VARIANT)
        btn.size = new vec3(this.buttonWidth, this.buttonHeight, 1)
        btn.setIsToggleable(true)
        btn.onInitialized.add(() => this.markInit())
        btn.onTriggerUp.add(() => {
          this._onTypePicked.invoke(type)
          this.resync.reset(0)
        })
        this.addButtonLabel(so, type.charAt(0).toUpperCase() + type.slice(1), this.buttonWidth - 0.5)
        this.buttons[type] = btn
      })
    }

    // the problem's start holds and its top hold, for the hold just pinched
    const flags = this.twoButtonRow(content, "ProblemFlagsRow", [
      {name: "StartButton", label: "Start", ev: this._onStartPressed, toggle: true},
      {name: "TopButton", label: "Top", ev: this._onTopPressed, toggle: true},
    ])
    this.startButton = flags[0]
    this.topButton = flags[1]
    // take the hold out of the problem, or close the picker
    this.twoButtonRow(content, "PickerActionsRow", [
      {name: "RemoveButton", label: "Remove", ev: this._onRemovePressed, toggle: false},
      {name: "DoneButton", label: "Done", ev: this._onDonePressed, toggle: false},
    ])

    this.resync = this.createEvent("DelayedCallbackEvent")
    this.resync.bind(() => this.applyStates())
  }

  // ── Main -> UI ────────────────────────────────────────────────────────────
  /** Show the picker at worldPos (beside the hold), with the hold's current type and start / top flags lit. */
  showFor(worldPos: vec3, worldRot: quat, currentType: string | null, isStart = false, isTop = false): void {
    const tr = this.getTransform()
    tr.setWorldPosition(worldPos)
    tr.setWorldRotation(worldRot)
    this.current = currentType
    this.isStart = isStart
    this.isTop = isTop
    this.wantVisible = true
    if (this.ready) this.panel.enabled = true
    this.applyStates()
  }

  hide(): void {
    this.wantVisible = false
    if (this.ready) this.panel.enabled = false
  }

  /** Main -> UI after a type is picked: light it (the picker stays open). */
  setType(type: string | null): void {
    this.current = type
    this.applyStates()
  }

  /** Read-back for tests: the type button lit. */
  getLitType(): string | null {
    for (const t of TYPES) if (this.buttons[t] && this.buttons[t].isOn) return t
    return null
  }

  /** Main -> UI after Start / Top: light the flags to match Main's state. */
  setFlags(isStart: boolean, isTop: boolean): void {
    this.isStart = isStart
    this.isTop = isTop
    this.applyStates()
  }

  isVisible(): boolean {
    return this.wantVisible
  }

  isStartLit(): boolean { return this.startButton ? this.startButton.isOn : false }
  isTopLit(): boolean { return this.topButton ? this.topButton.isOn : false }

  private markInit(): void {
    this.pending--
    if (this.pending > 0) return
    this.ready = true
    this.applyStates()
    // start hidden: the disable lands only after every widget has initialised
    this.panel.enabled = this.wantVisible
  }

  private applyStates(): void {
    for (const type of TYPES) {
      const b = this.buttons[type]
      if (b) b.isOn = type === this.current
    }
    if (this.startButton) this.startButton.isOn = this.isStart
    if (this.topButton) this.topButton.isOn = this.isTop
  }

  /** a row of two flag-width buttons under the types */
  private twoButtonRow(content: SceneObject, rowName: string,
                       specs: {name: string; label: string; ev: Event<void>; toggle: boolean}[]): Button[] {
    const fw = this.flagButtonWidth
    const rowW = 2 * fw + this.buttonGap
    const out: Button[] = []
    this.flexChild(content, {w: rowW, h: this.buttonHeight}, (rowSO) => {
      rowSO.name = rowName
      const f = rowSO.createComponent(FlexLayout.getTypeName()) as FlexLayout
      f.autoDiscoverItemsOnStart = false
      f.onInitialized.add(() => {
        f.width = rowW
        f.height = this.buttonHeight
        f.direction = FlexDirection.Row
        f.columnGap = this.buttonGap
        f.justifyContent = FlexJustify.Center
        f.alignItems = FlexAlign.Center
      })
      for (const s of specs) {
        this.flexChild(rowSO, {w: fw, h: this.buttonHeight}, (so) => {
          so.name = s.name
          const btn = so.createComponent(Button.getTypeName()) as Button
          btn.setVariant(BUTTON_VARIANT)
          btn.size = new vec3(fw, this.buttonHeight, 1)
          btn.setIsToggleable(s.toggle)
          btn.onInitialized.add(() => this.markInit())
          btn.onTriggerUp.add(() => {
            s.ev.invoke()
            this.resync.reset(0)
          })
          this.addButtonLabel(so, s.label, fw - 0.5)
          out.push(btn)
        })
      }
    })
    return out
  }

  private addButtonLabel(parent: SceneObject, text: string, widthCM: number): void {
    const so = this.obj(parent, "Label", new vec3(0, 0, BUTTON_LABEL_Z))
    const t = so.createComponent("Component.Text") as Text
    t.text = text
    t.depthTest = true
    applyTextRole(t, "Headline2")
    t.horizontalAlignment = HorizontalAlignment.Center
    t.verticalAlignment = VerticalAlignment.Center
    t.horizontalOverflow = HorizontalOverflow.Overflow
    t.verticalOverflow = VerticalOverflow.Overflow
    t.layoutRect = Rect.create(-widthCM / 2, widthCM / 2, -1.4, 1.4)
  }

  private obj(parent: SceneObject, name: string, position?: vec3): SceneObject {
    const so = global.scene.createSceneObject(name)
    so.setParent(parent)
    if (position) so.getTransform().setLocalPosition(position)
    return so
  }

  private flexChild(parent: SceneObject, size: {w?: number; h?: number},
                    builder: (child: SceneObject) => void): SceneObject {
    const child = this.obj(parent, "Item", new vec3(0, 0, LAYOUT_Z_LIFT))
    const item = child.createComponent(FlexItem.getTypeName()) as FlexItem
    if (size.w !== undefined && size.w > 0) item.overrideWidth = size.w
    if (size.h !== undefined && size.h > 0) item.overrideHeight = size.h
    item.flexGrow = 0
    item.flexShrink = 0
    builder(child)
    const parentFlex = parent.getComponent(FlexLayout.getTypeName()) as FlexLayout | null
    if (parentFlex) parentFlex.addItems([item])
    return child
  }
}
