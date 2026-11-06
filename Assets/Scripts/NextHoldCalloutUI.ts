// NextHoldCalloutUI — the two pieces of text that appear on the wall:
//   SuggestLabel: the limb label beside the suggested hold ("R hand"). In
//                 Ground it fades after about 2 s (brief: "When things show");
//                 On wall it stays, since it is the only word there.
//   WhyLine:      that hold's "why" line, only when asked for with '?', in
//                 capitals: "PINCH HOLD · LONG REACH".
//   CameOffCard:  session 23, on the mats after a fall: "Came off at move 3. Hint for
//                 that move?"; one pinch on it opens the hint.
//   ResultCard:   session 24, on the mats after a top: three lines (ONSIGHT / FLASH / SEND (attempt N),
//                 moves and par for your body, hints and best). Not a button.
//   AgainButton:  session 24, under either card: back to the start holds for the next go.
//
// Owns: the text widgets, the label's fade timer. Passive view.
// Main -> UI: showSuggestion(), moveSuggestion(), hideSuggestion(), showWhy(), hideWhy(),
//             setLabelMinSize(), showCameOff(), hideCameOff().
// UI -> Main: onCameOffPressed, onAgainPressed.
// Main -> UI (session 24): showResult(), hideResult(), showAgain(), hideAgain().
// Must not: score anything or pick the suggestion; Main does that.

import {BackPlate} from "SpectaclesUIKit.lspkg/Scripts/BackPlate"
import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"
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
/** the why-line's capitals run about this wide per character at their size (cm; "POCKET HOLD · HIGH
 *  STEP" measured 22.4 cm for 23 characters), and the plate's padding either side */
const WHY_CHAR_W = 1.0
const WHY_MIN_W = 12
const WHY_PAD_X = 1.4
/** half the why plate's height: the 3 cm text line and 1 cm padding above and below */
export const WHY_HALF_H = 2.5
/** session 26: Text.size per cm of cap height (as NextHoldControlRowUI.TEXT_PER_CM) */
const TEXT_PER_CM = 56
/** session 26: the came-off block at its 110 cm size (cm): the headline over two 11 x 10 cm buttons, [Hint · move N]
 *  and [Again], 3 cm apart, on one plate; half sizes, and where the buttons' centres sit from the block's centre */
export const BUTTON_W = 11
export const BUTTON_H = 10
export const AGAIN_GAP = 3
/** session 28 (v7.3 P1-6): the hint button is 16 cm wide, so "Hint · move 3" reads on one line at the button cap (in an
 *  11 cm cell it wrapped as "Hint ·" / "move 3", the dot dangling) */
export const HINT_W = 16
export const CARD_HALF_W = (HINT_W + AGAIN_GAP + BUTTON_W) / 2 + 1
/** 0.5 cm padding, a 3 cm headline row, 0.5 cm, the 10 cm buttons, 0.5 cm (h5: at 17 cm it found no clear place
 *  from 2.5 m and touched the START tags) */
export const CARD_HALF_H = 7.25
export const CARD_HEAD_Y = 5.25
export const CARD_BUTTONS_Y = -1.75
/** session 28: the buttons' centres across the block: the hint at the left, Again (CARD_BUTTON_X) at the right */
export const CARD_HINT_X = -CARD_HALF_W + 1 + HINT_W / 2
export const CARD_BUTTON_X = CARD_HALF_W - 1 - BUTTON_W / 2
/** the result card (cm, at the 110 cm size); Again stands AGAIN_GAP to its right as its own button */
export const RESULT_HALF_W = 18
export const RESULT_HALF_H = 7.5
export const AGAIN_W = BUTTON_W
export const AGAIN_H = BUTTON_H
/** cap heights (cm): the result's body lines at least 0.5° from 2.5 m (1 cm at the card's 110 cm size), its first
 *  line three times that; the came-off headline; button labels as on the row */
export const RESULT_BODY_CAP = 1.0
export const RESULT_HERO_CAP = 3.0
export const CARD_HEAD_CAP = 1.8
export const BUTTON_CAP = 2.2
/** session 27: half the voice chip (cm, at its 110 cm size): the words heard over the preview's line. Session 28: drawn
 *  beside the button it pressed, in that button's size, so a little narrower (it was 32 cm across, head-locked) */
export const CHIP_HALF_W = 11
export const CHIP_HALF_H = 4

/** the why-line text's width (cm, at its 110 cm size): as wide as its words, at most WHY_W (longer lines shrink) */
function whyTextWidth(text: string): number {
  return Math.min(WHY_W, Math.max(WHY_MIN_W, text.length * WHY_CHAR_W + 1))
}

/** half the why plate's width (cm, at its 110 cm size) for this text */
export function whyHalfWidth(text: string): number {
  return whyTextWidth(text) / 2 + WHY_PAD_X
}

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
  private whyItem: FlexItem

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
  private chipRoot: SceneObject
  private chipPlate: BackPlate
  private chipHeard: Text
  private chipLabel: Text
  private chipWanted = false
  private chipReady = false
  private blockRoot: SceneObject
  private cardRoot: SceneObject
  private cardText: Text
  private hintText: Text
  private cardWanted = false
  private cardReady = false
  private _onCameOffPressed = new Event<void>()
  get onCameOffPressed(): PublicApi<void> { return this._onCameOffPressed.publicApi() }
  private _onAgainPressed = new Event<void>()
  get onAgainPressed(): PublicApi<void> { return this._onAgainPressed.publicApi() }
  private resultRoot: SceneObject
  private resultLines: Text[] = []
  private resultWanted = false
  private resultReady = false
  private againRoot: SceneObject
  private againWanted = false
  private againReady = false

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
    flex.paddingLeft = WHY_PAD_X
    flex.paddingRight = WHY_PAD_X
    flex.onLayoutComplete.add((r) => {
      this.whyPlate.size = new vec2(r.containerWidth, r.containerHeight)
    })
    const textSO = this.obj(content, "WhyText", new vec3(0, 0, 0.02))
    const item = textSO.createComponent(FlexItem.getTypeName()) as FlexItem
    this.whyItem = item
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

    // ── CameOffBlock (session 26): the headline "Came off at move 3" on a plate, over two buttons side by side:
    // [Hint · move 3] (CameOffCard, a pinch opens the hint) and the AgainButton, which Main places in its slot ──
    this.blockRoot = this.obj(this.sceneObject, "CameOffBlock")
    const blockPlate = this.blockRoot.createComponent(BackPlate.getTypeName()) as BackPlate
    blockPlate.size = new vec2(2 * CARD_HALF_W, 2 * CARD_HALF_H)
    const headSO = this.obj(this.blockRoot, "CameOffText", new vec3(0, CARD_HEAD_Y, 0.8))
    this.cardText = this.bigText(headSO, "", 2 * CARD_HALF_W - 2, CARD_HEAD_CAP)
    this.cardRoot = this.obj(this.blockRoot, "CameOffCard", new vec3(CARD_HINT_X, CARD_BUTTONS_Y, 0.5))
    const card = this.cardRoot.createComponent(Button.getTypeName()) as Button
    card.setVariant({theme: "SnapOS3", shape: "Rectangle", style: "Prism"})
    card.size = new vec3(HINT_W, BUTTON_H, 1)
    card.setIsToggleable(false)
    card.onTriggerUp.add(() => this._onCameOffPressed.invoke())
    this.hintText = this.bigText(this.obj(this.cardRoot, "CameOffHintText", new vec3(0, 0, 1.6)), "", HINT_W - 1, BUTTON_CAP)
    // start hidden, but only after the button and the plate have initialised
    let cardInit = 0
    const cardReady = () => {
      if (++cardInit < 2) return
      this.cardReady = true
      this.blockRoot.enabled = this.cardWanted
    }
    card.onInitialized.add(cardReady)
    blockPlate.onInitialized.add(cardReady)

    // ── ResultCard (session 24): a plate with three lines, read from the mats; not a button. Session 26: the
    // first line three times the others, the others at least 0.5° from 2.5 m ──
    this.resultRoot = this.obj(this.sceneObject, "ResultCard")
    const plate = this.resultRoot.createComponent(BackPlate.getTypeName()) as BackPlate
    plate.size = new vec2(2 * RESULT_HALF_W, 2 * RESULT_HALF_H)
    const caps = [RESULT_HERO_CAP, RESULT_BODY_CAP, RESULT_BODY_CAP]
    const ys = [3.4, -2.0, -4.9]
    for (let i = 0; i < 3; i++) {
      const t = this.obj(this.resultRoot, "ResultLine_" + (i + 1), new vec3(0, ys[i], 0.8)).createComponent("Component.Text") as Text
      t.depthTest = true
      t.size = caps[i] * TEXT_PER_CM
      ;(t as Text & {weight?: number}).weight = i === 0 ? 700 : 500
      t.horizontalAlignment = HorizontalAlignment.Center
      t.verticalAlignment = VerticalAlignment.Center
      t.horizontalOverflow = HorizontalOverflow.Shrink
      t.verticalOverflow = VerticalOverflow.Overflow
      t.layoutRect = Rect.create(-RESULT_HALF_W + 1, RESULT_HALF_W - 1, -1.8, 1.8)
      this.resultLines.push(t)
    }
    plate.onInitialized.add(() => {
      this.resultReady = true
      this.resultRoot.enabled = this.resultWanted
    })

    // ── AgainButton (session 24): one big target under the card that is up ──
    this.againRoot = this.obj(this.sceneObject, "AgainButton")
    const again = this.againRoot.createComponent(Button.getTypeName()) as Button
    again.setVariant({theme: "SnapOS3", shape: "Rectangle", style: "Prism"})
    again.size = new vec3(AGAIN_W, AGAIN_H, 1)
    again.setIsToggleable(false)
    again.onTriggerUp.add(() => this._onAgainPressed.invoke())
    this.bigText(this.obj(this.againRoot, "AgainText", new vec3(0, 0, 1.6)), "Again", AGAIN_W - 1, BUTTON_CAP)
    again.onInitialized.add(() => {
      this.againReady = true
      this.againRoot.enabled = this.againWanted
    })

    // ── VoiceChip (session 27): what voice heard, for a moment; in the preview, what stands in for speech ──
    this.chipRoot = this.obj(this.sceneObject, "VoiceChip")
    this.chipPlate = this.chipRoot.createComponent(BackPlate.getTypeName()) as BackPlate
    this.chipPlate.size = new vec2(2 * CHIP_HALF_W, 2 * CHIP_HALF_H)
    this.chipHeard = this.bigText(this.obj(this.chipRoot, "VoiceChipHeard", new vec3(0, 1.4, 0.8)), "", 2 * CHIP_HALF_W - 2, 1.5)
    this.chipLabel = this.bigText(this.obj(this.chipRoot, "VoiceChipLabel", new vec3(0, -2.2, 0.8)), "", 2 * CHIP_HALF_W - 2, 0.8)
    ;(this.chipLabel as Text & {weight?: number}).weight = 500
    this.chipPlate.onInitialized.add(() => {
      this.chipReady = true
      this.chipRoot.enabled = this.chipWanted
    })

    this.createEvent("UpdateEvent").bind(() => this.tickLabel())
  }

  /** Session 27: the voice chip at worldPos: the words heard, and (preview) the line saying typed text stood in */
  showVoiceChip(worldPos: vec3, worldRot: quat, heard: string, label: string, scale = 1): void {
    this.place(this.chipRoot, worldPos, worldRot, scale)
    this.chipHeard.text = heard
    this.chipLabel.text = label
    this.chipWanted = true
    if (this.chipReady) this.chipRoot.enabled = true
  }

  hideVoiceChip(): void {
    this.chipWanted = false
    if (this.chipReady) this.chipRoot.enabled = false
  }

  getVoiceChipTransform(): Transform { return this.chipRoot.getTransform() }

  /** the chip as shown: its two lines, or null */
  getVoiceChip(): {heard: string; label: string} | null {
    return this.chipWanted ? {heard: this.chipHeard.text, label: this.chipLabel.text} : null
  }

  /** a one- or two-line text at `capCm` cap height, shrunk to `widthCm` if it is wider */
  private bigText(so: SceneObject, text: string, widthCm: number, capCm: number): Text {
    const t = so.createComponent("Component.Text") as Text
    t.text = text
    t.depthTest = true
    t.size = capCm * TEXT_PER_CM
    ;(t as Text & {weight?: number}).weight = 700
    t.horizontalAlignment = HorizontalAlignment.Center
    t.verticalAlignment = VerticalAlignment.Center
    t.horizontalOverflow = HorizontalOverflow.Shrink
    t.verticalOverflow = VerticalOverflow.Overflow
    t.layoutRect = Rect.create(-widthCm / 2, widthCm / 2, -1.6, 1.6)
    return t
  }

  /** Show the came-off block centred at worldPos (headline over [hint] [Again's slot]); scale 1 = its 110 cm size. */
  showCameOff(worldPos: vec3, worldRot: quat, headline: string, hintLabel: string, scale = 1): void {
    this.place(this.blockRoot, worldPos, worldRot, scale)
    this.cardText.text = headline
    this.hintText.text = hintLabel
    this.cardWanted = true
    if (this.cardReady) this.blockRoot.enabled = true
  }

  hideCameOff(): void {
    this.cardWanted = false
    if (this.cardReady) this.blockRoot.enabled = false
  }

  isCameOffVisible(): boolean { return this.cardWanted }
  getCameOffHintText(): string { return this.cardWanted && this.hintText ? this.hintText.text : "" }

  /** Session 24: the result card's three lines at worldPos; scale 1 = its 110 cm size. */
  showResult(worldPos: vec3, worldRot: quat, lines: string[], scale = 1): void {
    this.place(this.resultRoot, worldPos, worldRot, scale)
    for (let i = 0; i < 3; i++) this.resultLines[i].text = lines[i] || ""
    this.resultWanted = true
    if (this.resultReady) this.resultRoot.enabled = true
  }

  hideResult(): void {
    this.resultWanted = false
    if (this.resultReady) this.resultRoot.enabled = false
  }

  isResultVisible(): boolean { return this.resultWanted }
  getResultLines(): string[] { return this.resultWanted ? this.resultLines.map((t) => t.text) : [] }

  showAgain(worldPos: vec3, worldRot: quat, scale = 1): void {
    this.place(this.againRoot, worldPos, worldRot, scale)
    this.againWanted = true
    if (this.againReady) this.againRoot.enabled = true
  }

  hideAgain(): void {
    this.againWanted = false
    if (this.againReady) this.againRoot.enabled = false
  }

  isAgainVisible(): boolean { return this.againWanted }

  private place(so: SceneObject, p: vec3, r: quat, k: number): void {
    const tr = so.getTransform()
    tr.setWorldPosition(p)
    tr.setWorldRotation(r)
    tr.setWorldScale(vec3.one().uniformScale(k))
  }
  getCameOffText(): string { return this.cardWanted && this.cardText ? this.cardText.text : "" }

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

  /** The label's own size at 110 cm (its text size). */
  getLabelBaseSize(): number { return this.labelBaseSize }

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

  /** Show the why-line at worldPos; scale 1 = its 110 cm size (Ground draws it larger from further back). */
  showWhy(worldPos: vec3, worldRot: quat, text: string, holdId: string, scale = 1): void {
    const tr = this.whyRoot.getTransform()
    tr.setWorldPosition(worldPos)
    tr.setWorldRotation(worldRot)
    tr.setWorldScale(vec3.one().uniformScale(scale))
    // the plate fits the words: a 40 cm plate drawn 2.3x from 2.5 m slid across other holds' rings
    const w = whyTextWidth(text)
    this.whyItem.overrideWidth = w
    this.whyText.layoutRect = Rect.create(-w / 2, w / 2, -1.5, 1.5)
    this.whyPlate.size = new vec2(w + 2 * WHY_PAD_X, 2 * WHY_HALF_H)
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
  getWhyScale(): number { return this.whyRoot ? this.whyRoot.getTransform().getWorldScale().x : 1 }
  /** the why plate's size (cm, at its 110 cm size) */
  getWhyPlateSize(): vec2 { return this.whyPlate ? this.whyPlate.size : vec2.zero() }

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
