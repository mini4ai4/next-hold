// NextHoldMain — orchestrator for Next Hold (devpost/design-brief.md).
//
// Owns ALL climbing state: the four-limb position, the marked hold types, the
// selected limb, mode (climb / setup), the '?' armed flag, and the current
// evaluation. On every change it recomputes synchronously (same frame) and
// pushes the result into the passive views: wall overlays, control row,
// callouts, type picker, off-view arrow.
//
// @inputs: wall (ClimbingWall), controlRow, typePicker, callouts, offViewArrow,
//          ringMaterial (Unlit, cloned per overlay).
// Must not: build UI text itself (that lives in the *UI modules) or re-derive
//           the scoring rule (NextHoldScoring is the only rule).
//
// Public read API (for LEAF / tests) is grouped at the bottom: getMode(),
// getPosition(), getSelectedLimb(), getHoldColour(id), getHoldScore(id),
// isRingVisible(id), getSuggestion(), isRingGlowing(id), isLabelVisible(),
// getLabelOpacity(), getLabelText(), getWhyText(), isWhyVisible(),
// isAskArmed(), isOffViewArrowVisible(), isTypePickerVisible(), getHoldType(id).
// Action API mirrors a pinch: pressHold(id), pressLimb(limb), pressAsk(),
// pressMode(), pickType(type).

import {Interactable} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable"
import {ClimbingWall} from "./Wall/ClimbingWall"
import {HOLDS, PRESET_POSITION, HOLD_SIZE, holdById} from "./Wall/WallLayout"
import {
  Evaluation, HoldTypes, Holds, LIMBS, Limb, Position, ScoreResult, bestMove, evaluate,
} from "./NextHoldScoring"
import {NextHoldWallVisuals, RingColour} from "./NextHoldWallVisuals"
import {NextHoldControlRowUI} from "./NextHoldControlRowUI"
import {NextHoldTypePickerUI} from "./NextHoldTypePickerUI"
import {NextHoldCalloutUI} from "./NextHoldCalloutUI"
import {NextHoldOffViewArrow} from "./NextHoldOffViewArrow"

export type Mode = "climb" | "setup"

const LIMB_LABEL: {[l: string]: string} = {LH: "L hand", RH: "R hand", LF: "L foot", RF: "R foot"}
const HAND_LIMBS: Limb[] = ["LH", "RH"]

@component
export class NextHoldMain extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">NextHoldMain – state, scoring and input for Next Hold</span>')
  @ui.separator
  @ui.group_start("References")
  @input
  @hint("The ClimbingWall stand-in (builds the panel and the Hold_<id> objects)")
  wall: ClimbingWall

  @input
  @hint("Control row UI (limb toggles, ?, mode switch)")
  controlRow: NextHoldControlRowUI

  @input
  @hint("Setup-mode type picker UI")
  typePicker: NextHoldTypePickerUI

  @input
  @hint("Suggestion label + why-line UI")
  callouts: NextHoldCalloutUI

  @input
  @hint("Off-view arrow + chime")
  offViewArrow: NextHoldOffViewArrow

  @input
  @hint("Unlit material with Base Texture enabled (NextHoldTexturedUnlit), cloned for every ring and marker")
  ringMaterial: Material
  @ui.group_end

  @ui.separator
  @ui.group_start("Settings")
  @input
  @hint("Climber height in cm. Reach = height x 0.44 (175 cm -> 77 cm); feet use the same reach.")
  @widget(new SliderWidget(120, 210, 1))
  climberHeightCm: number = 175

  @input
  @hint("How far below the lower hand hold the control row's centre sits, in cm")
  @widget(new SliderWidget(10, 40, 0.5))
  rowDropCm: number = 20

  @input("vec4", "{0.4,1,0.5,1}")
  @hint("Green ring: secure grip for you, from where you are now (score >= 0.7)")
  @widget(new ColorWidget())
  greenColor: vec4 = new vec4(0.4, 1, 0.5, 1)

  @input("vec4", "{1,0.88,0.3,1}")
  @hint("Yellow ring: possible but harder (score 0.4 - 0.7)")
  @widget(new ColorWidget())
  yellowColor: vec4 = new vec4(1, 0.88, 0.3, 1)

  @input("vec4", "{1,0.42,0.42,1}")
  @hint("Red ring: poor or out of reach (score < 0.4)")
  @widget(new ColorWidget())
  redColor: vec4 = new vec4(1, 0.42, 0.42, 1)
  @ui.group_end

  @ui.separator
  @ui.group_start("Debug")
  @input
  @hint("Draw the hold pinch colliders as wireframes")
  debugColliders: boolean = false
  @ui.group_end

  // ── state (single owner) ──────────────────────────────────────────────────
  private holds: Holds = {}
  private holdTypes: HoldTypes = {}
  private position: Position = {LH: null, RH: null, LF: null, RF: null}
  private mode: Mode = "climb"
  private selected: Limb = "RH"
  private askArmed = false
  private evaluation: Evaluation = {results: [], suggestion: null}
  private byHold: {[id: string]: ScoreResult} = {}
  private pickerHold: string | null = null
  private hovered: string | null = null
  private visuals: NextHoldWallVisuals
  private ready = false

  onAwake() {
    if (!this.validateRefs()) return
    for (const h of HOLDS) {
      this.holds[h.id] = {x: h.x, y: h.y}
      this.holdTypes[h.id] = h.type // demo preset: every hold already marked
    }
    this.position = {...PRESET_POSITION}

    this.wall.build()
    this.visuals = new NextHoldWallVisuals(
      this.wall.getSceneObject(),
      (x, y, z) => this.wall.wallToLocal(x, y, z),
      this.ringMaterial,
      {green: this.greenColor, yellow: this.yellowColor, red: this.redColor},
    )
    this.visuals.build()

    const interactables: {id: string; it: Interactable}[] = []
    for (const id of this.wall.getHoldIds()) {
      const so = this.wall.getHoldObject(id)
      if (!so) continue
      const it = so.createComponent(Interactable.getTypeName()) as Interactable
      interactables.push({id, it})
      if (this.debugColliders) {
        const col = so.getComponent("Physics.ColliderComponent") as ColliderComponent
        if (col) col.debugDrawEnabled = true
      }
    }

    this.createEvent("OnStartEvent").bind(() => {
      for (const {id, it} of interactables) {
        it.onTriggerEnd.add(() => this.pressHold(id))
        it.onHoverEnter.add(() => this.setHover(id))
        it.onHoverExit.add(() => { if (this.hovered === id) this.setHover(null) })
      }
      this.controlRow.onLimbPressed.add((l) => this.pressLimb(l as Limb))
      this.controlRow.onAskPressed.add(() => this.pressAsk())
      this.controlRow.onModePressed.add(() => this.pressMode())
      this.typePicker.onTypePicked.add((t) => this.pickType(t))

      this.ready = true
      // The Lens opens in climb mode with the preset position: auto-select the best move.
      this.recompute(true)
    })

    this.createEvent("UpdateEvent").bind(() => this.visuals.tick(getTime()))
  }

  // ── actions (one pinch each) ──────────────────────────────────────────────
  pressHold(id: string): void {
    if (!this.ready || !this.holds[id]) return
    if (this.mode === "setup") {
      this.pickerHold = id
      const h = this.holds[id]
      const ringR = this.ringRadius(id)
      const right = h.x < 160
      const px = right ? h.x + ringR + 9.5 : h.x - ringR - 9.5
      const py = Math.min(275, Math.max(25, h.y))
      this.typePicker.showFor(this.wall.wallToWorld(px, py, 12), this.wallRot(), this.holdTypes[id] || null)
      return
    }
    // climb mode
    if (this.askArmed) {
      const r = this.byHold[id]
      if (!r) return // no ring on an occupied hold: stay armed, wait for a ring
      this.askArmed = false
      this.controlRow.setAskArmed(false)
      this.showWhyFor(id, r)
      return
    }
    if (this.isOccupied(id)) return // the reference doesn't score occupied holds
    this.position[this.selected] = id
    this.callouts.hideWhy()
    this.recompute(true)
  }

  pressLimb(limb: Limb): void {
    if (!this.ready || LIMBS.indexOf(limb) < 0) return
    this.selected = limb
    this.callouts.hideWhy()
    this.recompute(false)
  }

  pressAsk(): void {
    if (!this.ready) return
    this.askArmed = this.mode === "climb" ? !this.askArmed : false
    this.controlRow.setAskArmed(this.askArmed)
  }

  pressMode(): void {
    if (!this.ready) return
    this.mode = this.mode === "climb" ? "setup" : "climb"
    this.askArmed = false
    this.controlRow.setAskArmed(false)
    this.callouts.hideWhy()
    this.typePicker.hide()
    this.pickerHold = null
    this.recompute(false) // switching back to climb recomputes everything
  }

  pickType(type: string): void {
    if (!this.ready || this.mode !== "setup" || !this.pickerHold) return
    this.holdTypes[this.pickerHold] = type
    this.pickerHold = null
    this.typePicker.hide()
  }

  // ── recompute: same frame as the change ──────────────────────────────────
  private recompute(autoSelect: boolean): void {
    const reach = this.reach()
    if (autoSelect) {
      const best = bestMove({holds: this.holds, holdTypes: this.holdTypes, position: this.position, reach})
      if (best) this.selected = best.limb
    }
    this.evaluation = evaluate({holds: this.holds, holdTypes: this.holdTypes, position: this.position, limb: this.selected, reach})
    this.byHold = {}
    for (const r of this.evaluation.results) this.byHold[r.holdId] = r

    const climb = this.mode === "climb"
    const rings: {[id: string]: RingColour | null} = {}
    for (const id of Object.keys(this.holds)) rings[id] = climb && this.byHold[id] ? this.byHold[id].colour : null
    const sug = climb ? this.evaluation.suggestion : null
    this.visuals.apply({
      rings,
      glowHoldId: sug ? sug.holdId : null,
      position: this.position,
      selectedLimb: this.selected,
      showMarkers: true,
    })

    this.controlRow.setSelectedLimb(this.selected)
    this.controlRow.setMode(this.mode)
    this.placeControlRow()

    if (sug) {
      const h = this.holds[sug.holdId]
      const r = this.ringRadius(sug.holdId)
      // centred just below the ring: between the hold and the climber's eye line
      this.callouts.showSuggestion(this.wall.wallToWorld(h.x, h.y - r - 3.2, 3), this.wallRot(), LIMB_LABEL[sug.limb])
      this.offViewArrow.setTarget(this.wall.wallToWorld(h.x, h.y, 0), sug.limb + ":" + sug.holdId, r)
    } else {
      this.callouts.hideSuggestion()
      this.offViewArrow.setTarget(null, "")
    }
  }

  /** Centred between the two hand holds, below the lower one; slides when a hand moves. */
  private placeControlRow(): void {
    const hands = HAND_LIMBS.map((l) => this.position[l]).filter((id) => id != null && this.holds[id]) as string[]
    let x = 120, y = 120
    if (hands.length > 0) {
      x = hands.reduce((s, id) => s + this.holds[id].x, 0) / hands.length
      y = Math.min(...hands.map((id) => this.holds[id].y)) - this.rowDropCm
    }
    x = Math.min(220, Math.max(20, x))
    y = Math.max(12, y)
    this.controlRow.placeAt(this.wall.wallToWorld(x, y, 10), this.wallRot())
  }

  private showWhyFor(id: string, r: ScoreResult): void {
    const h = this.holds[id]
    const ringR = this.ringRadius(id)
    const y = h.y > 265 ? h.y - ringR - 5 : h.y + ringR + 5
    this.callouts.showWhy(this.wall.wallToWorld(h.x, y, 10), this.wallRot(), r.why, id)
  }

  private setHover(id: string | null): void {
    this.hovered = id
    this.visuals.setHover(id)
  }

  // ── helpers ───────────────────────────────────────────────────────────────
  private reach(): number { return this.climberHeightCm * 0.44 }
  private wallRot(): quat { return this.wall.getTransform().getWorldRotation() }
  private ringRadius(id: string): number {
    const def = holdById(id)
    return def ? HOLD_SIZE[def.type].ringR : 9
  }
  private isOccupied(id: string): boolean {
    return this.position.LH === id || this.position.RH === id || this.position.LF === id || this.position.RF === id
  }

  private validateRefs(): boolean {
    const missing: string[] = []
    if (!this.wall) missing.push("wall")
    if (!this.controlRow) missing.push("controlRow")
    if (!this.typePicker) missing.push("typePicker")
    if (!this.callouts) missing.push("callouts")
    if (!this.offViewArrow) missing.push("offViewArrow")
    if (!this.ringMaterial) missing.push("ringMaterial")
    if (missing.length) {
      print("[NextHoldMain] ERROR: inputs not wired: " + missing.join(", "))
      return false
    }
    return true
  }

  // ── public read API (LEAF / tests) ────────────────────────────────────────
  isReady(): boolean { return this.ready }
  getMode(): Mode { return this.mode }
  getPosition(): Position { return {...this.position} }
  getSelectedLimb(): Limb { return this.selected }
  getReach(): number { return this.reach() }
  getHoldIds(): string[] { return Object.keys(this.holds) }
  getHoldType(id: string): string | null { return this.holdTypes[id] || null }
  getHoldWallPosition(id: string): {x: number; y: number} | null { return this.holds[id] ? {...this.holds[id]} : null }
  getHoldWorldPosition(id: string): vec3 | null {
    const h = this.holds[id]
    return h ? this.wall.wallToWorld(h.x, h.y, 0) : null
  }
  /** Ring colour for the selected limb, or null when the hold shows no ring. */
  getHoldColour(id: string): RingColour | null {
    return this.mode === "climb" && this.byHold[id] ? this.byHold[id].colour : null
  }
  getHoldScore(id: string): number | null { return this.byHold[id] ? this.byHold[id].score : null }
  getHoldWhy(id: string): string | null { return this.byHold[id] ? this.byHold[id].why : null }
  isRingVisible(id: string): boolean { return this.visuals ? this.visuals.isRingVisible(id) : false }
  isRingGlowing(id: string): boolean { return this.visuals ? this.visuals.isGlowOn(id) : false }
  /** Hold the limb's dim position marker sits on (null when hidden). */
  getMarkerHold(limb: Limb): string | null { return this.visuals ? this.visuals.markerHold(limb) : null }
  getSuggestion(): {limb: Limb; holdId: string; label: string; score: number} | null {
    const s = this.mode === "climb" ? this.evaluation.suggestion : null
    return s ? {limb: s.limb, holdId: s.holdId, label: LIMB_LABEL[s.limb], score: s.score} : null
  }
  getEvaluation(): Evaluation { return this.evaluation }
  isLabelVisible(): boolean { return this.callouts.isLabelVisible() }
  getLabelOpacity(): number { return this.callouts.getLabelOpacity() }
  getLabelText(): string { return this.callouts.getLabelText() }
  isWhyVisible(): boolean { return this.callouts.isWhyVisible() }
  getWhyText(): string { return this.callouts.getWhyText() }
  getWhyHoldId(): string | null { return this.callouts.getWhyHoldId() }
  isAskArmed(): boolean { return this.askArmed }
  isAskLit(): boolean { return this.controlRow.isAskLit() }
  getLitLimb(): string | null { return this.controlRow.getLitLimb() }
  isOffViewArrowVisible(): boolean { return this.offViewArrow.isArrowVisible() }
  isTypePickerVisible(): boolean { return this.typePicker.isVisible() }
  getPickerHold(): string | null { return this.pickerHold }
}
