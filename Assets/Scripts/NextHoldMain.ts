// NextHoldMain — orchestrator for Next Hold (devpost/design-brief.md).
//
// Owns ALL climbing state: the four-limb position, the marked hold types,
// "your problem" (which holds belong to the boulder, its start holds and its
// top hold), the selected limb, mode (climb / setup), the '?' armed flag, and
// the current evaluation. Outside setup only the problem's holds are scored and
// ringed; the others stay visible but dim and are not targets. On every change it recomputes synchronously (same frame) and
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
// isAskArmed(), isOffViewArrowVisible(), isTypePickerVisible(), getHoldType(id),
// isInProblem(id), getProblemHolds(), getStartHolds(), getTopHold(), isHoldDim(id),
// isMarkVisible(id), getTagText(id), getPreview(), getGhostHold(n), getView(),
// getTorso(), getGroundViewCm(), getGroundSizedCm(), getRingLineWidth(), getFigureMask().
// Test hook: setSizingCamera(cam) sizes Ground from another camera's distance.
// Action API mirrors a pinch: pressHold(id), pressLimb(limb), pressAsk(),
// pressMode(), pressView(), pressHeight(±1), pickType(type), pressStart(), pressTop(), pressRemove(), pressDone().
// The climber's height (150-200 cm, set in the Lens) is state too: every reach is a share of it.
//
// View (Ground / On wall) is display only: both views share the same state and
// scoring; switching it re-pushes the overlay in the same frame. It follows the
// eye's distance from the wall (On wall under ON_WALL_CM, Ground over GROUND_CM);
// the view button overrides until the eye next crosses one of those.

import {Interactable} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable"
import {ClimbingWall} from "./Wall/ClimbingWall"
import {HOLDS, PRESET_POSITION, PRESET_PROBLEM, PRESET_START, PRESET_TOP, HOLD_SIZE, holdById} from "./Wall/WallLayout"
import {
  Evaluation, HoldTypes, Holds, LEG_REACH, LIMBS, Limb, Position, ScoreResult, bestMove, centreOfMass, evaluate, hipOf,
  sequence, shoulderOf,
} from "./NextHoldScoring"
import {DESIGN_VIEW_CM, FigureBody, NextHoldWallVisuals, OverlayState, RingColour, WallPt, minReadSize, ringLineWidth} from "./NextHoldWallVisuals"
import {NextHoldControlRowUI} from "./NextHoldControlRowUI"
import {NextHoldTypePickerUI} from "./NextHoldTypePickerUI"
import {NextHoldCalloutUI} from "./NextHoldCalloutUI"
import {NextHoldOffViewArrow} from "./NextHoldOffViewArrow"
import {NextHoldPinchRipple, RippleEvent} from "./NextHoldPinchRipple"
import {GLOW_PROFILE} from "./Wall/ProceduralTextures"
import WorldCameraFinderProvider from "SpectaclesInteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider"

/** half the why-line plate: WHY_W (40 cm) in NextHoldCalloutUI plus its padding */
const WHY_HALF_W = 21.5
/** half the type picker: the Start / Top row (2 x 8 cm + gap) + padding wide;
 *  title, five type buttons, the Start / Top and Remove / Done rows, gaps and padding tall */
const PICKER_HALF_W = 10.5
const PICKER_HALF_H = 27.5
/** half the control row block (four rows of 5 cm buttons + the note + padding), until its layout reports a size */
const ROW_HALF_W = 15.4
const ROW_HALF_H = 14.5
/** Ground: gap (cm) between the problem's outermost ring and the control row beside it */
const ROW_SIDE_GAP = 4

export type Mode = "climb" | "setup"
/** What is shown, never what is scored. "ground": standing back at the base, every ring of the
 *  problem and the ghosts 1-2-3, no stick figure. "wall": face ~40 cm from the wall, only the
 *  suggested ring, and the stick figure. */
export type View = "ground" | "wall"

/** Ground view: the far end of the distance range Ground sizes itself for (cm). Climbers read a
 *  problem from about 2-3 m back, looking up and down it: the rings stay on the holds, so the whole
 *  problem never has to fit in one view (test a2: from 250 cm a look at the lower half and one at
 *  the upper half cover every ring). Text and lines are sized for 110 cm; in Ground the ring line,
 *  the glow, the ghost badges and the suggestion label are sized for the eye's actual distance
 *  from the wall plane, kept between DESIGN_VIEW_CM and this, so from anywhere in that range they
 *  read at least as large as they do at 110 cm (Body text for the label and the numbers). */
export const GROUND_VIEW_CM = 365
/** Ground resizes only when the eye's distance from the wall moves by more than this (cm) */
const GROUND_RESIZE_CM = 2
/** The view follows the eye's distance from the wall: closer than ON_WALL_CM it switches to On wall,
 *  further than GROUND_CM to Ground. In between nothing changes (hysteresis), so a climber leaning
 *  in and out doesn't flicker. The button overrides until the eye next crosses one of the two. */
export const ON_WALL_CM = 80
export const GROUND_CM = 120

/** from the ring line's outer edge to the suggestion label's centre at the label's own size, cm
 *  (with the 1.6 cm line: 3.2 cm below the ring's radius, as before) */
const LABEL_GAP = 2.4
/** half the suggestion label's box at its 110 cm size (cm): "R hand" at the label's size */
const LABEL_HALF_W = 7
const LABEL_HALF_H = 2

/** the in-Lens height setting: range and step (cm) */
export const HEIGHT_MIN_CM = 150
export const HEIGHT_MAX_CM = 200
export const HEIGHT_STEP_CM = 5

/** stick figure: the shortest spine (shoulders to hips) as a share of reach (42 cm at 175 cm), and
 *  the head's radius as a share of height (4.5 cm at 175 cm: a small mark, not a blob) */
export const FIGURE_TORSO = 0.55
export const FIGURE_HEAD = 0.026

const LIMB_LABEL: {[l: string]: string} ={LH: "L hand", RH: "R hand", LF: "L foot", RF: "R foot"}
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
  @hint("Climber height in cm at open; the climber changes it in the Lens (Height − / +, 150-200 cm in 5 cm steps). Arm reach = height x 0.44 (175 cm -> 77 cm); feet reach 1.25 x that from the hip.")
  @widget(new SliderWidget(150, 200, 5))
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
  /** "your problem": the holds of the boulder being climbed. Only these are scored outside setup. */
  private problem: {[id: string]: boolean} = {}
  /** start / top flags; they stay on a hold taken out of the problem, but only count while it is in */
  private startFlags: {[id: string]: boolean} = {}
  private topFlag: string | null = null
  private position: Position = {LH: null, RH: null, LF: null, RF: null}
  private mode: Mode = "climb"
  /** the climber's height (cm): every reach is a share of it. Starts at the Inspector value. */
  private heightCm = 175
  private view: View = "ground"
  /** which side of the two thresholds the eye was last on; null = it hasn't crossed either yet */
  private distanceView: View | null = null
  /** the distance Ground is currently sized for: the eye's distance from the wall plane, clamped */
  private groundCm = GROUND_VIEW_CM
  /** tests only: measure the Ground distance from this camera instead of the wearer's */
  private sizingCamera: Camera | null = null
  /** the full overlay for the current state; the view decides how much of it is pushed */
  private overlay: OverlayState | null = null
  private selected: Limb = "RH"
  private askArmed = false
  private evaluation: Evaluation = {results: [], suggestion: null}
  private byHold: {[id: string]: ScoreResult} = {}
  /** sequence preview: the next 2-3 moves from here (step 1 = the suggestion, then the start of the
   *  cheapest secure route to the top for this body, see NextHoldScoring.sequence) */
  private preview: ScoreResult[] = []
  private pickerHold: string | null = null
  /** the control row outline last pushed to the stick figure */
  private lastMask: WallPt[] | null = null
  /** the control row's laid-out size it was last placed with ("" = not laid out yet) */
  private placedRowSize = "-"
  private hovered: string | null = null
  private visuals: NextHoldWallVisuals
  /** the brief ring where a pinch lands (a hold or a button) */
  private ripple: NextHoldPinchRipple
  /** control row and picker buttons by scene name, for the ripple */
  private uiObjects: {[name: string]: SceneObject} = {}
  private ready = false

  onAwake() {
    if (!this.validateRefs()) return
    for (const h of HOLDS) {
      this.holds[h.id] = {x: h.x, y: h.y}
      this.holdTypes[h.id] = h.type // demo preset: every hold already marked
    }
    // demo preset: a plausible problem is already marked, from the preset position up to its top
    for (const id of PRESET_PROBLEM) this.problem[id] = true
    for (const id of PRESET_START) this.startFlags[id] = true
    this.topFlag = PRESET_TOP
    this.position = {...PRESET_POSITION}
    this.heightCm = Math.min(HEIGHT_MAX_CM, Math.max(HEIGHT_MIN_CM, this.climberHeightCm))

    this.wall.build()
    this.visuals = new NextHoldWallVisuals(
      this.wall.getSceneObject(),
      (x, y, z) => this.wall.wallToLocal(x, y, z),
      this.ringMaterial,
      {green: this.greenColor, yellow: this.yellowColor, red: this.redColor},
    )
    this.visuals.build()
    this.ripple = new NextHoldPinchRipple(this.getSceneObject(), this.ringMaterial)

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
      this.controlRow.onViewPressed.add(() => this.pressView())
      this.controlRow.onHeightStep.add((d) => this.pressHeight(d))
      this.controlRow.setHeight(this.heightCm)
      this.typePicker.onTypePicked.add((t) => this.pickType(t))
      this.typePicker.onStartPressed.add(() => this.pressStart())
      this.typePicker.onTopPressed.add(() => this.pressTop())
      this.typePicker.onRemovePressed.add(() => this.pressRemove())
      this.typePicker.onDonePressed.add(() => this.pressDone())

      this.ready = true
      this.updateGroundDistance(true)
      // The Lens opens in climb mode with the preset position: auto-select the best move.
      this.recompute(true)
      this.followDistance()
    })

    this.createEvent("UpdateEvent").bind(() => {
      this.visuals.tick(getTime())
      this.ripple.tick(getTime())
      if (!this.ready) return
      // the row lays itself out late (after a start or a refresh): once its real size is known, or
      // whenever it changes, place it again, or in Ground it sits too close and covers a ring
      const size = this.controlRow.getSize()
      const sizeKey = size ? size.x.toFixed(2) + "x" + size.y.toFixed(2) : ""
      if (sizeKey !== this.placedRowSize) {
        this.placedRowSize = sizeKey
        this.placeControlRow()
      }
      this.updateFigureMask(false) // the head moves, and the row lays itself out late
      // walking in or stepping back past a threshold switches the view
      if (this.followDistance()) return
      // stepping back or in: Ground re-sizes for the new distance
      if (this.view === "ground" && this.updateGroundDistance(false)) this.pushOverlay()
    })
  }

  /** Switch the view when the eye crosses ON_WALL_CM or GROUND_CM. True if it switched. */
  private followDistance(): boolean {
    const d = this.eyeToWallCm()
    if (d === null) return false
    const side: View | null = d < ON_WALL_CM ? "wall" : d > GROUND_CM ? "ground" : this.distanceView
    if (side === this.distanceView || side === null) return false
    this.distanceView = side
    if (side === this.view) return false
    this.setView(side)
    return true
  }

  // ── actions (one pinch each) ──────────────────────────────────────────────
  pressHold(id: string): void {
    if (!this.ready || !this.holds[id]) return
    if (this.mode === "setup") {
      // a pinch adds the hold to "your problem" and opens its picker; a pinch on a hold that is
      // already in it reopens its picker (Remove takes it out). Type, Start and Top then work in
      // any order, and the picker stays until Done.
      this.problem[id] = true
      this.pickerHold = id
      this.rippleHold(id)
      const h = this.holds[id]
      const ringR = this.ringRadius(id)
      const right = h.x < 160
      const px = right ? h.x + ringR + PICKER_HALF_W + 1.5 : h.x - ringR - PICKER_HALF_W - 1.5
      const py = Math.min(275, Math.max(25, h.y))
      // the picker is ~54 cm tall: keep all five types, Start / Top and Remove / Done inside the view
      this.typePicker.showFor(this.keepInView(this.wall.wallToWorld(px, py, 12), PICKER_HALF_W, PICKER_HALF_H),
        this.wallRot(), this.holdTypes[id] || null, !!this.startFlags[id], this.topFlag === id)
      this.recompute(false)
      return
    }
    if (!this.problem[id]) return // outside setup only the problem's holds are targets
    // climb mode
    if (this.askArmed) {
      const r = this.byHold[id]
      if (!r) return // no ring on an occupied hold: stay armed, wait for a ring
      this.askArmed = false
      this.controlRow.setAskArmed(false)
      this.rippleHold(id)
      this.showWhyFor(id, r)
      return
    }
    if (this.isOccupied(id)) return // the reference doesn't score occupied holds
    this.rippleHold(id)
    this.position[this.selected] = id
    this.callouts.hideWhy()
    this.recompute(true)
  }

  pressLimb(limb: Limb): void {
    if (!this.ready || LIMBS.indexOf(limb) < 0) return
    this.rippleButton("Toggle_" + limb)
    this.selected = limb
    this.callouts.hideWhy()
    this.recompute(false)
  }

  pressAsk(): void {
    if (!this.ready) return
    this.rippleButton("AskButton")
    this.askArmed = this.mode === "climb" ? !this.askArmed : false
    this.controlRow.setAskArmed(this.askArmed)
  }

  pressMode(): void {
    if (!this.ready) return
    this.rippleButton("ModeSwitch")
    this.mode = this.mode === "climb" ? "setup" : "climb"
    this.askArmed = false
    this.controlRow.setAskArmed(false)
    this.callouts.hideWhy()
    this.typePicker.hide()
    this.pickerHold = null
    this.recompute(false) // switching back to climb recomputes everything
  }

  /** Ground <-> On wall by hand. It holds until the eye next crosses a threshold (followDistance). */
  pressView(): void {
    if (!this.ready) return
    this.rippleButton("ViewToggle")
    this.setView(this.view === "ground" ? "wall" : "ground")
  }

  /** Height − / +: one 5 cm step, kept in 150-200 cm. The wall recolours for the new body and the
   *  1-2-3 is searched again for it, in the same frame; the selected limb stays (the climber chose
   *  it), the position doesn't change. */
  pressHeight(step: number): void {
    if (!this.ready || step === 0) return
    this.rippleButton(step > 0 ? "HeightUp" : "HeightDown")
    const snapped = Math.round(this.heightCm / HEIGHT_STEP_CM) * HEIGHT_STEP_CM
    const next = Math.min(HEIGHT_MAX_CM, Math.max(HEIGHT_MIN_CM, snapped + (step > 0 ? 1 : -1) * HEIGHT_STEP_CM))
    if (next === this.heightCm) return
    this.heightCm = next
    this.controlRow.setHeight(this.heightCm)
    this.callouts.hideWhy()
    this.recompute(false)
  }

  /** Only what is shown changes: no rescoring, same state, same frame. */
  private setView(view: View): void {
    this.view = view
    this.controlRow.setView(this.view)
    if (this.view === "ground") this.updateGroundDistance(true)
    this.pushOverlay()
  }

  /** Setup: the hold's type. The picker stays open, so Start and Top still work after it. */
  pickType(type: string): void {
    if (!this.ready || this.mode !== "setup" || !this.pickerHold) return
    this.rippleButton("TypeButton_" + type)
    this.holdTypes[this.pickerHold] = type
    this.typePicker.setType(type)
  }

  /** Setup: close the picker; the hold stays in the problem with what was set. */
  pressDone(): void {
    if (!this.ready || this.mode !== "setup" || !this.pickerHold) return
    this.rippleButton("DoneButton")
    this.pickerHold = null
    this.typePicker.hide()
  }

  /** Setup: take the picker's hold out of the problem (its start / top flags stop counting) and close it. */
  pressRemove(): void {
    if (!this.ready || this.mode !== "setup" || !this.pickerHold) return
    this.rippleButton("RemoveButton")
    delete this.problem[this.pickerHold]
    this.pickerHold = null
    this.typePicker.hide()
    this.recompute(false)
  }

  /** Setup: toggle the hold just pinched as one of the problem's start holds. */
  pressStart(): void {
    if (!this.ready || this.mode !== "setup" || !this.pickerHold) return
    const id = this.pickerHold
    this.rippleButton("StartButton")
    if (this.startFlags[id]) delete this.startFlags[id]
    else this.startFlags[id] = true
    this.typePicker.setFlags(!!this.startFlags[id], this.topFlag === id)
    this.recompute(false)
  }

  /** Setup: make the hold just pinched the problem's top hold (pinch again to clear it). */
  pressTop(): void {
    if (!this.ready || this.mode !== "setup" || !this.pickerHold) return
    const id = this.pickerHold
    this.rippleButton("TopButton")
    this.topFlag = this.topFlag === id ? null : id
    this.typePicker.setFlags(!!this.startFlags[id], this.topFlag === id)
    this.recompute(false)
  }

  // ── recompute: same frame as the change ──────────────────────────────────
  private recompute(autoSelect: boolean): void {
    const reach = this.reach()
    const holds = this.scoredHolds()
    // the problem's top hold pulls the suggestion upward (ranking only, never the colour)
    const goalTop = this.getTopHold()
    if (autoSelect) {
      const best = bestMove({holds, holdTypes: this.holdTypes, position: this.position, reach, top: goalTop})
      if (best) this.selected = best.limb
    }
    this.evaluation = evaluate({holds, holdTypes: this.holdTypes, position: this.position, limb: this.selected, reach, top: goalTop})
    this.byHold = {}
    for (const r of this.evaluation.results) this.byHold[r.holdId] = r

    const climb = this.mode === "climb"
    const rings: {[id: string]: RingColour | null} = {}
    const marks: {[id: string]: boolean} = {}
    const tags: {[id: string]: string} = {}
    for (const id of Object.keys(this.holds)) {
      rings[id] = climb && this.byHold[id] ? this.byHold[id].colour : null
      // outside setup the holds that aren't in the problem stay visible, but dim
      this.wall.setHoldDim(id, climb && !this.problem[id])
      // climbing: the goal of the sequence is marked "TOP" (Ground only, see pushOverlay)
      if (climb && id === goalTop) tags[id] = "TOP"
      if (climb || !this.problem[id]) continue
      marks[id] = true
      const tag = (this.startFlags[id] ? ["START"] : []).concat(goalTop === id ? ["TOP"] : [])
      if (tag.length) tags[id] = tag.join(" · ")
    }
    const sug = climb ? this.evaluation.suggestion : null
    // look-ahead from the same position, in the same frame as the rings
    this.preview = climb && sug
      ? sequence({holds, holdTypes: this.holdTypes, position: this.position, reach, top: goalTop, limb: this.selected})
      : []
    this.overlay = {
      rings,
      glowHoldId: sug ? sug.holdId : null,
      position: {...this.position},
      selectedLimb: this.selected,
      showMarkers: true,
      marks,
      tags,
      tagsAbove: climb,
      ghosts: this.preview.map((m) => ({hold: m.holdId, limb: m.limb, colour: m.colour})),
      // the body: the centre of mass the scoring itself uses for this position
      torso: centreOfMass(this.position, holds),
      body: this.figureBody(holds, reach),
    }
    this.pushOverlay()

    this.controlRow.setSelectedLimb(this.selected)
    this.controlRow.setMode(this.mode)
    this.controlRow.setView(this.view)
    this.updateFigureMask(true)

    if (sug) {
      const h = this.holds[sug.holdId]
      const r = this.ringRadius(sug.holdId)
      this.callouts.showSuggestion(this.labelPos(sug.holdId), this.wallRot(), LIMB_LABEL[sug.limb])
      this.offViewArrow.setTarget(this.wall.wallToWorld(h.x, h.y, 0), sug.limb + ":" + sug.holdId, r)
    } else {
      this.callouts.hideSuggestion()
      this.offViewArrow.setTarget(null, "")
    }
  }

  /** Push the overlay through the view: On wall keeps only the suggested ring (and its glow), no ghosts. */
  private pushOverlay(): void {
    const s = this.overlay
    if (!s) return
    const ground = this.view === "ground"
    this.callouts.setLabelMinSize(ground ? minReadSize(this.groundCm) : 0)
    // On wall the label is the only word: it stays there; in Ground it fades
    this.callouts.setLabelSticky(!ground)
    const labelScale = this.callouts.getLabelScale()
    const labelBox = s.glowHoldId ? this.labelBox(s.glowHoldId) : null
    if (ground) {
      // no stick figure in Ground: its 1 cm line is a faint smudge from 2.5 m and competes with
      // the rings; the limb markers already show where the hands and feet are
      this.visuals.apply({...s, body: null, viewCm: this.groundCm, labelScale, labelBox})
    } else {
      const rings: {[id: string]: RingColour | null} = {}
      if (s.glowHoldId) rings[s.glowHoldId] = s.rings[s.glowHoldId] || null
      // On wall: one ring and its word; the climbing TOP tag is a Ground thing (setup keeps its tags)
      const tags = this.mode === "climb" ? {} : s.tags
      this.visuals.apply({...s, rings, tags, ghosts: [], viewCm: DESIGN_VIEW_CM, labelScale, labelBox})
    }
    // the label's size changed with the view: keep it just below the ring
    if (s.glowHoldId) this.callouts.moveSuggestion(this.labelPos(s.glowHoldId), this.wallRot())
    // the panels follow the view: beside the problem and sized for the distance in Ground
    this.placeControlRow()
    const whyId = this.callouts.getWhyHoldId()
    if (this.callouts.isWhyVisible() && whyId && this.byHold[whyId]) this.showWhyFor(whyId, this.byHold[whyId])
  }

  /** How much larger the panels (control row, why-line) are drawn than at 110 cm: in Ground they
   *  grow with the eye's distance like the ring line, so they read as they do at 110 cm. */
  private panelScale(): number {
    return this.view === "ground" ? Math.max(1, this.groundCm / DESIGN_VIEW_CM) : 1
  }

  /** Centred just below the suggested ring's line, between the hold and the climber's eye line;
   *  a larger label (Ground) hangs a little lower. Inside the glow's target ring in both views. */
  private labelPos(id: string): vec3 {
    const c = this.labelCentre(id)
    return this.wall.wallToWorld(c.x, c.y, 3)
  }

  private labelCentre(id: string): WallPt {
    const h = this.holds[id]
    const dy = this.ringRadius(id) + this.getRingLineWidth() / 2 + LABEL_GAP * this.callouts.getLabelScale()
    return {x: h.x, y: h.y - dy}
  }

  /** the suggestion label's box on the wall (cm) at its current size: the badges and the path keep clear of it */
  private labelBox(id: string): {x: number; y: number; hw: number; hh: number} {
    const c = this.labelCentre(id)
    const k = this.callouts.getLabelScale()
    return {x: c.x, y: c.y, hw: LABEL_HALF_W * k, hh: LABEL_HALF_H * k}
  }

  /** The eye's distance (cm) from the wall plane, along the wall's normal; null without a camera. */
  private eyeToWallCm(): number | null {
    const finder = WorldCameraFinderProvider.getInstance()
    const cam = this.sizingCamera || (finder ? finder.getComponent() : null)
    if (!cam) return null
    const o = this.wall.wallToWorld(0, 0, 0)
    const n = this.wall.wallToWorld(0, 0, 1).sub(o).normalize()
    return cam.getSceneObject().getTransform().getWorldPosition().sub(o).dot(n)
  }

  /** Re-measure the distance Ground is sized for, clamped to 110-365 cm. Unless forced it only
   *  changes when the distance moved by more than GROUND_RESIZE_CM. True if it changed. */
  private updateGroundDistance(force: boolean): boolean {
    const d = this.eyeToWallCm()
    if (d === null) return false
    const cm = Math.min(GROUND_VIEW_CM, Math.max(DESIGN_VIEW_CM, d))
    if (!force && Math.abs(cm - this.groundCm) <= GROUND_RESIZE_CM) return false
    const changed = cm !== this.groundCm
    this.groundCm = cm
    return changed
  }

  /**
   * The stick figure fades where it passes behind the control row. The row stands ~10 cm off the
   * wall, so its outline on the wall is where the eye sees it: each corner of the row's plate is
   * projected from the eye onto the wall plane. Pushed when a corner moves by more than 0.3 cm.
   */
  private updateFigureMask(force: boolean): void {
    const mask = this.rowOutlineOnWall()
    const last = this.lastMask
    const moved = !mask || !last || mask.some((p, i) => Math.hypot(p.x - last[i].x, p.y - last[i].y) > 0.3)
    if (!force && !moved && !!mask === !!last) return
    this.lastMask = mask
    this.visuals.setFigureMask(mask)
  }

  private rowOutlineOnWall(): WallPt[] | null {
    const cam = WorldCameraFinderProvider.getInstance()
    const camComp = cam ? cam.getComponent() : null
    if (!camComp) return null
    const size = this.controlRow.getSize()
    const hw = size ? size.x / 2 : ROW_HALF_W
    const hh = size ? size.y / 2 : ROW_HALF_H
    const toWall = this.wall.getTransform().getInvertedWorldTransform()
    const row = this.controlRow.getTransform().getWorldTransform()
    const eye = toWall.multiplyPoint(camComp.getSceneObject().getTransform().getWorldPosition())
    const x0 = this.wall.wallToLocal(0, 0).x
    const out: WallPt[] = []
    for (const [cx, cy] of [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]]) {
      const c = toWall.multiplyPoint(row.multiplyPoint(new vec3(cx, cy, 0)))
      if (eye.z <= c.z + 1e-3) return null // the eye is not in front of the row
      const k = eye.z / (eye.z - c.z) // eye + k (c - eye) lands on the wall plane z = 0
      out.push({x: eye.x + k * (c.x - eye.x) - x0, y: eye.y + k * (c.y - eye.y)})
    }
    return out
  }

  /**
   * On wall (and up close): centred between the two hand holds, below the lower one, and kept in
   * view; it slides when a hand moves. In Ground: beside the problem, level with its start holds, on
   * the side nearer the eye, and as large as the distance needs, so it never covers the problem.
   * From the near end of Ground it may sit outside a straight-ahead view: you turn your head to it,
   * as you turn it to read the problem. It is kept in view vertically and never slides over the problem.
   */
  private placeControlRow(): void {
    const k = this.panelScale()
    const size = this.controlRow.getSize()
    const halfW = (size ? size.x / 2 : ROW_HALF_W) * k
    const halfH = (size ? size.y / 2 : ROW_HALF_H) * k
    if (this.view === "ground") {
      const box = this.problemBox()
      const starts = this.getStartHolds()
      const level = starts.length ? starts : HAND_LIMBS.map((l) => this.position[l]).filter((id) => id != null && this.holds[id]) as string[]
      const y = level.length ? level.reduce((s, id) => s + this.holds[id].y, 0) / level.length : 150
      const eyeX = this.eyeWallX()
      const right = eyeX === null || box.x1 - eyeX <= eyeX - box.x0
      const x = right ? box.x1 + ROW_SIDE_GAP + halfW : box.x0 - ROW_SIDE_GAP - halfW
      const p = this.toWall(this.keepInView(this.wall.wallToWorld(x, y, 10), halfW, halfH))
      this.controlRow.placeAt(this.wall.wallToWorld(x, Math.max(halfH + 2, p.y), 10), this.wallRot(), k)
      return
    }
    const hands = HAND_LIMBS.map((l) => this.position[l]).filter((id) => id != null && this.holds[id]) as string[]
    let x = 120, y = 120
    if (hands.length > 0) {
      x = hands.reduce((s, id) => s + this.holds[id].x, 0) / hands.length
      y = Math.min(...hands.map((id) => this.holds[id].y)) - this.rowDropCm
    }
    x = Math.min(220, Math.max(20, x))
    y = Math.max(12, y)
    // keep the whole block inside the view, both rows and the note under them, not just its
    // centre: at the preset the LF / RF / Climb row and the note fell below the narrow view
    this.controlRow.placeAt(this.keepInView(this.wall.wallToWorld(x, y, 10), halfW, halfH), this.wallRot(), k)
  }

  /** The problem's outline on the wall (cm): every problem hold's ring, its line included. */
  private problemBox(): {x0: number; x1: number; y0: number; y1: number} {
    const r = (id: string) => this.ringRadius(id) + this.getRingLineWidth() / 2
    const ids = this.getProblemHolds()
    if (!ids.length) return {x0: 120, x1: 120, y0: 150, y1: 150}
    return {
      x0: Math.min(...ids.map((id) => this.holds[id].x - r(id))), x1: Math.max(...ids.map((id) => this.holds[id].x + r(id))),
      y0: Math.min(...ids.map((id) => this.holds[id].y - r(id))), y1: Math.max(...ids.map((id) => this.holds[id].y + r(id))),
    }
  }

  /** a world point in wall cm (x from the wall's left edge, y up from the floor) */
  private toWall(p: vec3): WallPt {
    const l = this.wall.getTransform().getInvertedWorldTransform().multiplyPoint(p)
    return {x: l.x - this.wall.wallToLocal(0, 0).x, y: l.y}
  }

  /** where the wearer's eye is across the wall (wall cm), or null without a camera */
  private eyeWallX(): number | null {
    const finder = WorldCameraFinderProvider.getInstance()
    const cam = finder ? finder.getComponent() : null
    return cam ? this.toWall(cam.getSceneObject().getTransform().getWorldPosition()).x : null
  }

  private showWhyFor(id: string, r: ScoreResult): void {
    const h = this.holds[id]
    const ringR = this.ringRadius(id)
    const k = this.panelScale()
    // toward the middle of the view: a hold above the eye line gets its line below, and the other way round
    // (a fixed 265 cm cut-off put the line off the top of the narrow SPECS view for the holds you look up at)
    const dy = ringR + this.getRingLineWidth() / 2 + 4.2 * k
    const y = this.isAboveViewCentre(this.wall.wallToWorld(h.x, h.y, 0)) ? h.y - dy : h.y + dy
    this.callouts.showWhy(this.keepInView(this.wall.wallToWorld(h.x, y, 10), WHY_HALF_W * k), this.wallRot(), r.why, id, k)
  }

  // ── pinch ripple ──────────────────────────────────────────────────────────
  /** the ripple on a hold: just outside its ring, the ring line's width */
  private rippleHold(id: string): void {
    const h = this.holds[id]
    const w = this.getRingLineWidth()
    this.ripple.play(id, this.wall.wallToWorld(h.x, h.y, 0.6), this.wallRot(), this.ringRadius(id) + w, w)
  }

  /** the ripple on a control row or picker button, in front of its face, at the panel's size */
  private rippleButton(name: string): void {
    let so = this.uiObjects[name]
    if (!so) {
      so = findUnder(this.controlRow.getSceneObject(), name) || findUnder(this.typePicker.getSceneObject(), name)
      if (!so) return
      this.uiObjects[name] = so
    }
    const tr = so.getTransform()
    const k = tr.getWorldScale().x
    const out = this.wall.wallToWorld(0, 0, 1).sub(this.wall.wallToWorld(0, 0, 0)).normalize()
    this.ripple.play(name, tr.getWorldPosition().add(out.uniformScale(2.2 * k)), this.wallRot(), 3.2 * k, 0.9 * k)
  }

  private setHover(id: string | null): void {
    // outside setup a hold that isn't in the problem is not a target, so it doesn't highlight
    if (id && this.mode === "climb" && !this.problem[id]) id = null
    this.hovered = id
    this.visuals.setHover(id)
  }

  /**
   * The stick figure's body, from the scoring's own: shoulders where the hands reach from
   * (shoulderOf), hips where the feet reach from (hipOf), but never closer than FIGURE_TORSO x
   * reach under the shoulders, so the body never folds into a dot. An arm is `reach` long, a leg
   * LEG_REACH x that: the same lengths the colours use. The head scales with height.
   */
  private figureBody(holds: Holds, reach: number): FigureBody {
    const com = centreOfMass(this.position, holds)
    const sL = shoulderOf("LH", com), sR = shoulderOf("RH", com)
    const hip = (l: Limb) => {
      const h = hipOf(l, this.position, holds, com, reach)
      return {x: h.x, y: Math.min(h.y, Math.min(sL.y, sR.y) - FIGURE_TORSO * reach)}
    }
    return {shoulders: {L: sL, R: sR}, hips: {L: hip("LF"), R: hip("RF")}, armLength: reach,
            legLength: LEG_REACH * reach, headR: FIGURE_HEAD * this.heightCm}
  }

  // ── helpers ───────────────────────────────────────────────────────────────
  private reach(): number { return this.heightCm * 0.44 }
  /** The holds the rule sees: the problem's, plus any hold a limb is on (the centre of mass needs it). */
  private scoredHolds(): Holds {
    const out: Holds = {}
    for (const id of Object.keys(this.holds)) {
      if (this.problem[id] || this.isOccupied(id)) out[id] = this.holds[id]
    }
    return out
  }
  private wallRot(): quat { return this.wall.getTransform().getWorldRotation() }
  /** Slide a point (in camera space) so a panel halfW x halfH cm around it stays inside the view. */
  private keepInView(p: vec3, halfW: number, halfH = 0): vec3 {
    const cam = WorldCameraFinderProvider.getInstance()
    const camComp = cam ? cam.getComponent() : null
    if (!camComp) return p
    const camT = camComp.getSceneObject().getTransform()
    const local = camT.getInvertedWorldTransform().multiplyPoint(p)
    const depth = -local.z
    if (depth <= 1e-3) return p
    const tanV = Math.tan(camComp.fov / 2)
    const edgeX = depth * tanV * camComp.aspect - halfW - 1
    const edgeY = depth * tanV - halfH - 1
    const x = edgeX > 0 ? Math.max(-edgeX, Math.min(edgeX, local.x)) : local.x
    const y = edgeY > 0 ? Math.max(-edgeY, Math.min(edgeY, local.y)) : local.y
    return camT.getWorldTransform().multiplyPoint(new vec3(x, y, local.z))
  }

  /** True if the point sits above the middle of the wearer's view (camera space, +Y is up). */
  private isAboveViewCentre(p: vec3): boolean {
    const cam = WorldCameraFinderProvider.getInstance()
    const camComp = cam ? cam.getComponent() : null
    if (!camComp) return false
    return camComp.getSceneObject().getTransform().getInvertedWorldTransform().multiplyPoint(p).y > 0
  }

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
  getView(): View { return this.view }
  /** how far back the whole problem fits in view: the far end of the Ground range (cm) */
  getGroundViewCm(): number { return GROUND_VIEW_CM }
  /** the distance (cm) Ground is sized for right now: the eye's distance from the wall, clamped */
  getGroundSizedCm(): number { return this.groundCm }
  /** Tests only: size Ground from this camera's distance instead of the wearer's (null = the wearer's).
   *  Takes effect at once. */
  setSizingCamera(cam: Camera | null): void {
    this.sizingCamera = cam
    if (!this.ready || this.followDistance()) return
    if (this.updateGroundDistance(true) && this.view === "ground") this.pushOverlay()
  }
  /** the eye's distance (cm) from the wall plane as the Lens measures it (the sizing camera's, if set) */
  getEyeToWallCm(): number | null { return this.eyeToWallCm() }
  /** width of the rings' crisp line in the current view (cm) */
  getRingLineWidth(): number { return ringLineWidth(this.view === "ground" ? this.groundCm : DESIGN_VIEW_CM) }
  /** how much larger the suggestion label (and the glow with it) is drawn than at 110 cm */
  getLabelScale(): number { return this.callouts.getLabelScale() }
  /** the control row outline (wall cm) the stick figure fades behind, or null */
  getFigureMask(): WallPt[] | null { return this.visuals ? this.visuals.getFigureMask() : null }
  /** the torso point of the stick figure, in wall cm (null before the first recompute) */
  getTorso(): {x: number; y: number} | null { return this.overlay && this.overlay.torso ? {...this.overlay.torso} : null }
  /** the stick figure's body as drawn: shoulders, hips, arm and leg length, head radius (wall cm) */
  getFigureBody(): FigureBody | null { return this.overlay && this.overlay.body ? this.overlay.body : null }
  getPosition(): Position { return {...this.position} }
  getSelectedLimb(): Limb { return this.selected }
  getReach(): number { return this.reach() }
  /** the climber's height (cm) the rule is using, and as the panel shows it */
  getHeightCm(): number { return this.heightCm }
  getHeightLabel(): string { return this.controlRow.getHeightLabel() }
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
  /** how much larger the why-line and the control row are drawn than at 110 cm */
  getWhyScale(): number { return this.callouts.getWhyScale() }
  getRowScale(): number { return this.controlRow.getScale() }
  isAskArmed(): boolean { return this.askArmed }
  isAskLit(): boolean { return this.controlRow.isAskLit() }
  getViewLabel(): string { return this.controlRow.getViewLabel() }
  getLitLimb(): string | null { return this.controlRow.getLitLimb() }
  isOffViewArrowVisible(): boolean { return this.offViewArrow.isArrowVisible() }
  isTypePickerVisible(): boolean { return this.typePicker.isVisible() }
  getPickerHold(): string | null { return this.pickerHold }
  isInProblem(id: string): boolean { return !!this.problem[id] }
  getProblemHolds(): string[] { return Object.keys(this.holds).filter((id) => this.problem[id]) }
  /** start holds of the problem (flags on holds taken out of the problem don't count) */
  getStartHolds(): string[] { return this.getProblemHolds().filter((id) => this.startFlags[id]) }
  getTopHold(): string | null { return this.topFlag && this.problem[this.topFlag] ? this.topFlag : null }
  isHoldDim(id: string): boolean { return this.wall.isHoldDim(id) }
  isMarkVisible(id: string): boolean { return this.visuals ? this.visuals.isMarkVisible(id) : false }
  getTagText(id: string): string | null { return this.visuals ? this.visuals.tagText(id) : null }
  /** sequence preview: the next moves; step 1 is the glowing suggestion, steps 2 and 3 badges "2 · LH".
   *  colour / score: how secure each move is for you at its turn (its tag wears that colour) */
  getPreview(): {limb: Limb; holdId: string; colour: RingColour; score: number}[] {
    return this.preview.map((m) => ({limb: m.limb, holdId: m.holdId, colour: m.colour, score: m.score}))
  }
  /** the hold look-ahead step n (1-based) is shown on (step 1 by the glow), or null when hidden */
  getGhostHold(n: number): string | null { return this.visuals ? this.visuals.ghostHold(n) : null }
  getPickerLitType(): string | null { return this.typePicker.getLitType() }
  isStartLit(): boolean { return this.typePicker.isStartLit() }
  isTopLit(): boolean { return this.typePicker.isTopLit() }
  /** every pinch ripple played (newest last): the hold id or button name it landed on, and when */
  getRippleLog(): RippleEvent[] { return this.ripple ? this.ripple.getLog() : [] }
  isRippleVisible(): boolean { return this.ripple ? this.ripple.isVisible() : false }
  getRippleWorldPosition(): vec3 | null { return this.ripple ? this.ripple.getWorldPosition() : null }
}

/** the first SceneObject called `name` under root (root included), enabled or not */
function findUnder(root: SceneObject, name: string): SceneObject | null {
  if (root.name === name) return root
  for (let i = 0; i < root.getChildrenCount(); i++) {
    const f = findUnder(root.getChild(i), name)
    if (f) return f
  }
  return null
}
