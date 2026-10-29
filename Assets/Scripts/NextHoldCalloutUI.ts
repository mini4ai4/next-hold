// NextHoldCalloutUI — the two pieces of text that appear on the wall:
//   SuggestLabel: the limb label beside the suggested hold ("R hand"). In
//                 Ground it fades after about 2 s (brief: "When things show");
//                 On wall it stays, since it is the only word there.
//   WhyLine:      that hold's "why" line, only when asked for with '?', in
//                 capitals: "PINCH HOLD · LONG REACH".
//
// Owns: the text widgets, the label's fade timer. Passive view.
// Main -> UI: showSuggestion(), moveSuggestion(), hideSuggestion(), showWhy(), hideWhy(),
//             setLabelMinSize().
// Must not: score anything or pick the suggestion; Main does that.

import {BackPlate} from "SpectaclesUIKit.lspkg/Scripts/BackPlate"
import {FlexLayout} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout"
import {FlexItem} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem"
import {FlexAlign, FlexDirection, FlexJustify} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import {ORDER_GHOST_NUMBER} from "./NextHoldWallVisuals"

// ── Typography ───────────────────────────────────────────────────────────────
const FONT_SIZE_SCALE = 1.0
type TextRole = "HeadlineXL" | "Headline1" | "Headline2" | "Body"
const TYPE_SCALE: Record<TextRole, {size: number; weight: number}> = {
  HeadlineXL: {size: 62, weight: 700}, Headline1: {size: 54, weight: 700},
  Headline2: {size: 48, weight: 700}, Body: {size: 39, weight: 500},
}
function applyTextRole(t: Text, role: TextRole, distanceCm: number = 110): void {
  t.size = TYPE_SCALE[role].size * FONT_SIZE_SCALE * (distanceCm / 110)
  ;(t as Text & {weight?: number}).weight = TYPE_SCALE[role].weight
}

const LABEL_W = 16
/** the label is the one word read mid-climb: a step above the largest UI role */
const LABEL_SCALE = 1.3
const LABEL_OUTLINE = 0.3
const LABEL_OUTLINE_COLOR = new vec4(0.08, 0.1, 0.09, 0.85)
const WHY_W = 40
const WHY_SCALE = 1.5

@component
export class NextHoldCalloutUI extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">NextHoldCalloutUI – suggestion label and why-line</span>')
  @ui.separator
  @ui.group_start("Settings")
  @input
  @hint("Seconds the suggestion label stays fully visible before fading")
  @widget(new SliderWidget(0.5, 5, 0.1))
  labelHoldSeconds: number = 1.5

  @input
  @hint("Seconds the suggestion label takes to fade out (hold + fade ≈ 2 s per the brief)")
  @widget(new SliderWidget(0.1, 3, 0.1))
  labelFadeSeconds: number = 0.5

  @input("vec4", "{0.92,1.0,0.95,1.0}")
  @hint("Suggestion label colour (keep it light: the display is additive)")
  @widget(new ColorWidget())
  labelColor: vec4 = new vec4(0.92, 1.0, 0.95, 1.0)

  @input("vec4", "{1,1,1,1}")
  @hint("Why-line text colour")
  @widget(new ColorWidget())
  whyColor: vec4 = new vec4(1, 1, 1, 1)
  @ui.group_end

  private labelRoot: SceneObject
  private labelText: Text
  private whyRoot: SceneObject
  private whyText: Text
  private whyPlate: BackPlate

  private labelBaseSize = 0
  /** set by Main per view: from further back the label must not read smaller than Body at 110 cm */
  private labelMinSize = 0
  private labelShownAt = -1
  private labelOpacity = 0
  /** a suggestion is showing (its label may have faded) */
  private labelActive = false
  /** On wall: the label is the only word there, so it stays instead of fading */
  private labelSticky = false
  private whyWanted = false
  private whyReady = false
  private whyHoldId: string | null = null

  onAwake() {
    this.sceneObject.createComponent("Component.Canvas")

    // ── SuggestLabel ──
    this.labelRoot = this.obj(this.sceneObject, "SuggestLabel")
    this.labelText = this.labelRoot.createComponent("Component.Text") as Text
    this.labelText.depthTest = true
    applyTextRole(this.labelText, "HeadlineXL")
    this.labelText.size *= LABEL_SCALE
    this.labelBaseSize = this.labelText.size
    this.labelText.size = Math.max(this.labelBaseSize, this.labelMinSize)
    this.labelText.horizontalAlignment = HorizontalAlignment.Center
    this.labelText.verticalAlignment = VerticalAlignment.Center
    this.labelText.horizontalOverflow = HorizontalOverflow.Overflow
    this.labelText.verticalOverflow = VerticalOverflow.Overflow
    this.labelText.layoutRect = Rect.create(-LABEL_W / 2, LABEL_W / 2, -1.6, 1.6)
    // a dark outline keeps the label crisp over the light ply; on the
    // additive display it simply drops out and the light text remains
    this.labelText.outlineSettings.enabled = true
    this.labelText.outlineSettings.size = LABEL_OUTLINE
    this.labelText.outlineSettings.fill.color = LABEL_OUTLINE_COLOR
    // drawn over the wall overlays, like the ghost numbers: the dotted sequence path can pass under it
    this.labelText.setRenderOrder(ORDER_GHOST_NUMBER)
    this.labelRoot.enabled = false

    // ── WhyLine: a dark plate behind the text so it reads over the wall ──
    this.whyRoot = this.obj(this.sceneObject, "WhyLine")
    this.whyPlate = this.whyRoot.createComponent(BackPlate.getTypeName()) as BackPlate
    const content = this.obj(this.whyRoot, "Content", new vec3(0, 0, 0.6))
    const flex = content.createComponent(FlexLayout.getTypeName()) as FlexLayout
    flex.autoDiscoverItemsOnStart = false // items are registered explicitly via addItems
    flex.width = -1
    flex.height = -1
    flex.direction = FlexDirection.Column
    flex.alignItems = FlexAlign.Center
    flex.justifyContent = FlexJustify.Center
    flex.paddingTop = 1.0
    flex.paddingBottom = 1.0
    flex.paddingLeft = 1.4
    flex.paddingRight = 1.4
    flex.onLayoutComplete.add((r) => {
      this.whyPlate.size = new vec2(r.containerWidth, r.containerHeight)
    })
    const textSO = this.obj(content, "WhyText", new vec3(0, 0, 0.02))
    const item = textSO.createComponent(FlexItem.getTypeName()) as FlexItem
    item.overrideWidth = WHY_W
    item.overrideHeight = 3
    this.whyText = textSO.createComponent("Component.Text") as Text
    this.whyText.depthTest = true
    applyTextRole(this.whyText, "Headline2")
    this.whyText.size *= WHY_SCALE   // read at arm's length on a wall, mid-climb: bigger than a panel headline
    this.whyText.textFill.color = this.whyColor
    this.whyText.horizontalAlignment = HorizontalAlignment.Center
    this.whyText.verticalAlignment = VerticalAlignment.Center
    // capitals run wide ("CRIMP HOLD · OUT OF REACH · COMMITTING BALANCE"): shrink a long line to the plate, never past it
    this.whyText.horizontalOverflow = HorizontalOverflow.Shrink
    this.whyText.verticalOverflow = VerticalOverflow.Overflow
    this.whyText.layoutRect = Rect.create(-WHY_W / 2, WHY_W / 2, -1.5, 1.5)
    flex.addItems([item])
    // start hidden, but only after the plate has initialised
    this.whyPlate.onInitialized.add(() => {
      this.whyReady = true
      this.whyRoot.enabled = this.whyWanted
    })

    this.createEvent("UpdateEvent").bind(() => this.tickLabel())
  }

  // ── Main -> UI ────────────────────────────────────────────────────────────
  /** Show the limb label centred at worldPos (just below the suggested ring), then fade it. */
  showSuggestion(worldPos: vec3, worldRot: quat, text: string): void {
    const tr = this.labelRoot.getTransform()
    tr.setWorldPosition(worldPos)
    tr.setWorldRotation(worldRot)
    this.labelText.text = text
    this.labelShownAt = getTime()
    this.labelActive = true
    this.setLabelOpacity(1)
  }

  /** On wall the label stays (sticky); in Ground it fades ~2 s after it shows. Leaving On wall
   *  starts the fade afresh, so the label is still there for a moment after stepping back. */
  setLabelSticky(sticky: boolean): void {
    if (sticky === this.labelSticky) return
    this.labelSticky = sticky
    if (!this.labelActive) return
    this.labelShownAt = getTime()
    this.setLabelOpacity(1)
  }

  /** The label's size never drops below this (0 = its own 110 cm size). */
  setLabelMinSize(size: number): void {
    this.labelMinSize = size
    if (this.labelText) this.labelText.size = Math.max(this.labelBaseSize, size)
  }

  /** How much larger the label is drawn than its own 110 cm size (1 = not at all). */
  getLabelScale(): number {
    return this.labelBaseSize > 0 ? Math.max(this.labelBaseSize, this.labelMinSize) / this.labelBaseSize : 1
  }

  /** Move the label (its size changed) without showing it again or restarting its fade. */
  moveSuggestion(worldPos: vec3, worldRot: quat): void {
    const tr = this.labelRoot.getTransform()
    tr.setWorldPosition(worldPos)
    tr.setWorldRotation(worldRot)
  }

  hideSuggestion(): void {
    this.labelShownAt = -1
    this.labelActive = false
    this.setLabelOpacity(0)
  }

  showWhy(worldPos: vec3, worldRot: quat, text: string, holdId: string): void {
    const tr = this.whyRoot.getTransform()
    tr.setWorldPosition(worldPos)
    tr.setWorldRotation(worldRot)
    this.whyText.text = text
    this.whyHoldId = holdId
    this.whyWanted = true
    if (this.whyReady) this.whyRoot.enabled = true
  }

  hideWhy(): void {
    this.whyWanted = false
    this.whyHoldId = null
    if (this.whyReady) this.whyRoot.enabled = false
  }

  // ── read-back (tests) ─────────────────────────────────────────────────────
  isLabelVisible(): boolean { return this.labelOpacity > 0.01 }
  getLabelOpacity(): number { return this.labelOpacity }
  getLabelText(): string { return this.labelText ? this.labelText.text : "" }
  isWhyVisible(): boolean { return this.whyWanted }
  getWhyText(): string { return this.whyWanted && this.whyText ? this.whyText.text : "" }
  getWhyHoldId(): string | null { return this.whyHoldId }

  private tickLabel(): void {
    if (this.labelSticky && this.labelActive) {
      if (this.labelOpacity < 1) this.setLabelOpacity(1)
      return
    }
    if (this.labelShownAt < 0) return
    const t = getTime() - this.labelShownAt
    if (t <= this.labelHoldSeconds) {
      this.setLabelOpacity(1)
    } else if (t < this.labelHoldSeconds + this.labelFadeSeconds) {
      this.setLabelOpacity(1 - (t - this.labelHoldSeconds) / this.labelFadeSeconds)
    } else {
      this.labelShownAt = -1
      this.setLabelOpacity(0)
    }
  }

  private setLabelOpacity(a: number): void {
    this.labelOpacity = a
    const c = this.labelColor
    this.labelText.textFill.color = new vec4(c.x, c.y, c.z, c.w * a)
    const o = LABEL_OUTLINE_COLOR
    this.labelText.outlineSettings.fill.color = new vec4(o.x, o.y, o.z, o.w * a)
    this.labelRoot.enabled = a > 0.01
  }

  private obj(parent: SceneObject, name: string, position?: vec3): SceneObject {
    const so = global.scene.createSceneObject(name)
    so.setParent(parent)
    if (position) so.getTransform().setLocalPosition(position)
    return so
  }
}
