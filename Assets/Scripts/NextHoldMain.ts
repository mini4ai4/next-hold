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
// getTorso(), getGroundViewCm(), getGroundSizedCm(), getRingLineWidth(), getFigureMask(), isTopped(), getToppedAt().
// Session 21: getRefusalLog(), getRingPulse().
// Session 23: isBetaShown(), getHintStep(), getMovesMade(), getAttempt(), isOutlineVisible(id), isCueVisible(),
// isCameOffVisible(), getCameOffText(), getShowBetaLabel(), isShowBetaLit(). The score reads (getHoldColour,
// getSuggestion, ...) answer with beta hidden too: what is drawn is what the reveal allows (NextHoldBeta).
// Test hooks: setSizingCamera(cam) sizes Ground from another camera's distance; forceMove(limb, id)
// sets a position up, red moves included (a pinch can't make those); resetBetaForTests(shown).
// Action API mirrors a pinch: pressHold(id), pressLimb(limb), pressAsk(), pressShowBeta(), pressCameOffHint(),
// pressMode(), pressView(), pressHeight(±1), pickType(type), pressStart(), pressTop(), pressRemove(), pressDone().
// The climber's height (150-200 cm, set in the Lens) is state too: every reach is a share of it.
// Session 24 (v7 G, B, C and the A+E judges' fixes):
// - G: the row shows one page at a time (climb / body / settings): pressBody(), pressSetup(); getPage().
// - B: a go ends at the top or a fall (NextHoldBeta). Topped, the result card waits for the mats (after "TOPPED"
//   fades) and reads ONSIGHT / FLASH / SEND, moves against par for your body, hints and best (NextHoldAttempt).
//   pressAgain() (the card's button) and resetAttempt() go back to the go's start position. Best per problem and
//   height, and the height, are kept in global.persistentStorageSystem.store through NextHoldSave (fail safe);
//   tests and the demo hand in a fresh store with useStore(store), and reloadFromStore() reads it as an open would.
// - A hold under a drawn step tag shows the neutral outline (no grip colour), and its why-line names the step.
// Session 24 reads: getPage(), getAskDots(), isSetupLit(), getPlannedLine(), isResultVisible(), getResultLines(),
// isAgainVisible(), getLastResult(), getPar(), getStartPosition(), getBestKey(), getLastWrite(), getStoreMaxBytes(),
// getHintsThisGo(), isBetaSeenThisGo(), getPinnedHint(). Demo hook: setHeightCm(cm) (no pinch, no ripple).
//
// View (Ground / On wall) is display only: both views share the same state and
// scoring; switching it re-pushes the overlay in the same frame. It follows the
// eye's distance from the wall (On wall under ON_WALL_CM, Ground over GROUND_CM);
// the view button overrides until the eye next crosses one of those.

import {Interactable} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable"
import {ClimbingWall} from "./Wall/ClimbingWall"
import {HOLDS, PRESET_POSITION, PRESET_PROBLEM, PRESET_START, PRESET_TOP, HOLD_SIZE, holdById} from "./Wall/WallLayout"
import {
  Evaluation, HoldTypes, Holds, LEG_REACH, LIMBS, Limb, Position, ScoreResult, bestMove, bestPerHold, centreOfMass,
  evaluate, hipOf, pinchMove, routeToTop, sequence, shoulderOf,
} from "./NextHoldScoring"
import {Go, KVStore, NextHoldSave, bestKey, better, cardLines, tickFor} from "./NextHoldAttempt"
import {
  DESIGN_VIEW_CM, FigureBody, NextHoldWallVisuals, OverlayState, RingColour, TOPPED_TEXT, WallPt, minReadSize, readBoost, ringLineWidth,
} from "./NextHoldWallVisuals"
import {NextHoldControlRowUI, RowPage} from "./NextHoldControlRowUI"
import {NextHoldTypePickerUI} from "./NextHoldTypePickerUI"
import {
  AGAIN_GAP, AGAIN_H, AGAIN_W, CARD_HALF_H, CARD_HALF_W, NextHoldCalloutUI, RESULT_HALF_H, RESULT_HALF_W, WHY_HALF_H, whyHalfWidth,
} from "./NextHoldCalloutUI"
import {
  BetaState, CUE_TEXT, HintStep, again as betaAgain, arrivedOnWall, ask, askDots, cameOffLine, cueShown, hideBeta, inReach,
  initialBeta, moved, newAttempt, positionKey, problemKey, reveal, showBeta, steppedBack, takeHint, toppedOut,
} from "./NextHoldBeta"
import {NextHoldOffViewArrow} from "./NextHoldOffViewArrow"
import {NextHoldPinchRipple, RippleEvent} from "./NextHoldPinchRipple"
import {GLOW_PROFILE} from "./Wall/ProceduralTextures"
import WorldCameraFinderProvider from "SpectaclesInteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider"

/** how far in front of the wall face the control row and the why-line stand (cm) */
const PANEL_Z = 10
/** On wall: gap (cm, as the eye sees it on the wall) between the suggested ring's glow and the control row */
const ROW_RING_GAP = 3
/** the why-line: gap (cm, as seen) from the asked hold's ring, and the least clearance from any other ring or text */
const WHY_RING_GAP = 1.5
/** half the type picker: the Start / Top row (2 x 8 cm + gap) + padding wide;
 *  title, five type buttons, the Start / Top and Remove / Done rows, gaps and padding tall */
const PICKER_HALF_W = 10.5
const PICKER_HALF_H = 27.5
/** half the control row block (the override line, four rows of 5 cm buttons, the note, padding), until its layout reports a size */
const ROW_HALF_W = 13.9
const ROW_HALF_H = 16.8
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
const LABEL_HALF_W = 4.5
const LABEL_HALF_H = 1.6
/** session 20: from this much larger than its 110 cm size the label no longer fits inside the glow's
 *  target ring: it moves out to just past the glow, gradually from 1 x */
const LABEL_OUT_SCALE = 1.3
/** gap (cm) between the glow's outer edge and the label outside it, and any other ring and the label */
const LABEL_GLOW_GAP = 1

/** session 19, topping out: once a hand is on the problem's top hold the climb is done. Its "TOP" tag
 *  reads "TOPPED" (green) for TOPPED_SECONDS, then fades out over TOPPED_FADE_SECONDS; meanwhile
 *  there is no next move (no glow, no 1-2-3, no arrow). A hand off the top hold climbs on as before. */
export const TOPPED_SECONDS = 2
export const TOPPED_FADE_SECONDS = 0.6

/** session 21, a pinch no limb can make: nothing moves, the hold's ring pulses (NextHoldWallVisuals)
 *  and the why-line says this for REFUSED_SECONDS. */
export const REFUSED_TEXT = "OUT OF REACH"
/** session 22: said instead on a hold with a drawn step tag: it is in the plan, just not yet. Step 1,
 *  for tag 3 too: the numbers are worked out again after every move, and only the glow is sure to be a
 *  move a pinch can make. Session 23: the ring under the tag keeps its own colour now; the line stays. */
export const REFUSED_STEP_TEXT = "STEP 1 FIRST"
export const REFUSED_SECONDS = 1.5

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
  /** the limb whose rings and glow show: the override if there is one, else the best move's */
  private selected: Limb = "RH"
  /** session 20: the limb picked on a toggle, which the next move uses instead of the best limb for
   *  its hold; null = none. Lasts until that move. */
  private override: Limb | null = null
  private askArmed = false
  private evaluation: Evaluation = {results: [], suggestion: null}
  private byHold: {[id: string]: ScoreResult} = {}
  /** sequence preview: the next 2-3 moves from here (step 1 = the suggestion, then the start of the
   *  cheapest secure route to the top for this body, see NextHoldScoring.sequence) */
  private preview: ScoreResult[] = []
  private pickerHold: string | null = null
  /** getTime() when a hand last reached the top hold (-1: not topped); the "TOPPED" tag times from it */
  private toppedAt = -1
  /** the "TOPPED" tag is still up (it is dropped once it has faded out) */
  private toppedShown = false
  /** getTime() when the why-line stops saying "OUT OF REACH" (-1: it isn't saying it) */
  private refusedUntil = -1
  /** what the refusal's why-line says, kept so a view change keeps saying it */
  private refusedText = REFUSED_TEXT
  /** every refused pinch (newest last), for the read API */
  private refusalLog: {hold: string; time: number}[] = []
  /** session 23: beta on request (NextHoldBeta): what the climber is shown, the hint ladder, came off */
  private beta: BetaState = initialBeta(false, 0)
  /** what a new attempt or problem goes back to: hidden; only LEAF's reset changes it */
  private betaDefault = false
  /** which problem it was when setup opened: leaving setup with another one starts it from nothing */
  private setupFromKey = ""
  private cueOn = false
  /** session 24 (G): the row's page beyond the climb page: the body cluster or the settings */
  private bodyOpen = false
  private settingsOpen = false
  /** session 24 (B, C): the store door, the position this go's count started from, the last top's card */
  private save: NextHoldSave = new NextHoldSave(null)
  private startPos: Position = {LH: null, RH: null, LF: null, RF: null}
  private result: {go: Go; par: number | null; lines: string[]; key: string} | null = null
  /** the height read from the store at open (null: none kept) */
  private storedHeight: number | null = null
  /** a go ended (a fall or the top): "Again" stays on the mats, with or without its card (a hint taken on the
   *  came-off card takes the card down, not Again), until a move, Again itself, or the eye back on the wall */
  private againOffered = false
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
    this.startPos = {...PRESET_POSITION}
    this.heightCm = Math.min(HEIGHT_MAX_CM, Math.max(HEIGHT_MIN_CM, this.climberHeightCm))
    // session 24 (C): the height kept from an earlier open wins over the Inspector's; a store that can't be
    // reached or read leaves the Lens as it was (NextHoldSave never throws)
    let store: KVStore | null = null
    try { store = global.persistentStorageSystem ? global.persistentStorageSystem.store : null } catch (e) { store = null }
    this.save = new NextHoldSave(store)
    this.storedHeight = this.save.readHeight()
    if (this.storedHeight !== null) this.heightCm = this.storedHeight
    print(`[NextHold] store: ${this.save.hasStore() ? "max " + this.save.maxBytes() + " bytes, " + this.save.usedBytes() + " used" : "none"}; ` +
      `kept height ${this.storedHeight === null ? "none" : this.storedHeight + " cm"}`)

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
      this.controlRow.onShowBetaPressed.add(() => this.pressShowBeta())
      this.callouts.onCameOffPressed.add(() => this.pressCameOffHint())
      this.callouts.onAgainPressed.add(() => this.pressAgain())
      this.controlRow.onBodyPressed.add(() => this.pressBody())
      this.controlRow.onSetupPressed.add(() => this.pressSetup())
      this.controlRow.setHeight(this.heightCm)
      this.beta = initialBeta(this.betaDefault, getTime(), this.nextGoNumber(), positionKey(this.position))
      this.typePicker.onTypePicked.add((t) => this.pickType(t))
      this.typePicker.onStartPressed.add(() => this.pressStart())
      this.typePicker.onTopPressed.add(() => this.pressTop())
      this.typePicker.onRemovePressed.add(() => this.pressRemove())
      this.typePicker.onDonePressed.add(() => this.pressDone())
      this.offViewArrow.setKeepClearOf(() => this.rowCorners())

      this.ready = true
      this.updateGroundDistance(true)
      // The Lens opens in climb mode with the preset position: the best move shows.
      this.recompute()
      this.followDistance()
    })

    this.createEvent("UpdateEvent").bind(() => {
      this.visuals.tick(getTime())
      this.ripple.tick(getTime())
      if (!this.ready) return
      this.tickTopped(getTime())
      this.tickRefused(getTime())
      this.tickCue(getTime())
      // the row lays itself out late (after a start or a refresh): once its real size is known, or
      // whenever it changes, place it again, or in Ground it sits too close and covers a ring
      const size = this.controlRow.getSize()
      const sizeKey = size ? size.x.toFixed(2) + "x" + size.y.toFixed(2) : ""
      if (sizeKey !== this.placedRowSize) {
        this.placedRowSize = sizeKey
        this.placeControlRow()
      } else if (this.view === "wall") {
        // On wall the row keeps out of the line of sight to the ring as seen from where the eye is
        // now: placed once at the switch (mid-walk, still looking up) it stayed over the ring
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
    const from = this.distanceView
    this.distanceView = side
    // session 23, came off: the preview has no body, so the eye stands in. It was closer than ON_WALL_CM
    // and is now further than GROUND_CM: the climber left the wall. Only the eye crossing counts, not the
    // view button; NextHoldBeta.steppedBack decides whether that is a fall.
    if (from === "wall" && side === "ground" && this.mode === "climb") {
      const was = this.beta
      this.beta = steppedBack(was, this.isTopped())
      if (this.beta !== was) {
        // session 24: every fall is a go, beta shown or not (only the card needs it hidden); it is kept
        const key = this.bestKeyNow()
        const rec = this.save.readRecord(key)
        this.save.writeRecord(key, {goes: Math.max(rec.goes, was.attempt), best: rec.best})
        this.againOffered = true
        this.askArmed = false
        this.controlRow.setAskArmed(false)
        this.callouts.hideWhy()
        this.recompute()
      }
    }
    if (side === this.view) return false
    this.setView(side)
    return true
  }

  // ── actions (one pinch each) ──────────────────────────────────────────────
  pressHold(id: string): void {
    if (!this.ready || !this.holds[id]) return
    // a pinch on the wall closes the body cluster unused (it has no close button of its own)
    if (this.bodyOpen) {
      this.bodyOpen = false
      this.applyPage()
    }
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
      this.recompute()
      return
    }
    if (!this.problem[id]) return // outside setup only the problem's holds are targets
    // climb mode
    if (this.askArmed) {
      const r = this.shownScore(id)
      if (!r) return // no ring on an occupied hold: stay armed, wait for a ring
      this.askArmed = false
      this.controlRow.setAskArmed(false)
      this.rippleHold(id)
      this.refusedUntil = -1
      this.showWhyFor(id, this.whyText(id)!)
      return
    }
    if (this.isOccupied(id)) return // the reference doesn't score occupied holds
    // session 20: hands stay on the holds, no limb has to be chosen first: the best limb for this
    // hold moves, unless a toggle picked one. Session 21: only if that move is green or yellow.
    const move = pinchMove({holds: this.scoredHolds(), holdTypes: this.holdTypes, position: this.position,
      reach: this.reach(), top: this.getTopHold(), holdId: id, override: this.override})
    if (!move.moves) {
      this.refusePinch(id)
      return
    }
    this.moveLimb(move.limb, id)
  }

  /** Nothing moves and nothing recomputes (an override stays: no move used it up). No ripple, which
   *  marks a pinch taken: the hold's own ring pulses and the why-line says why, for a moment. */
  private refusePinch(id: string): void {
    this.refusalLog.push({hold: id, time: getTime()})
    if (this.refusalLog.length > 200) this.refusalLog.shift()
    this.visuals.pulseRing(id)
    this.refusedUntil = getTime() + REFUSED_SECONDS
    this.refusedText = this.shownStep(id) ? REFUSED_STEP_TEXT : REFUSED_TEXT
    this.showWhyFor(id, this.refusedText)
  }

  /** The move itself. The move uses up the override. */
  private moveLimb(limb: Limb, id: string): void {
    this.rippleHold(id)
    this.visuals.stopPulse()
    this.refusedUntil = -1
    const wasTopped = this.isTopped()
    this.position[limb] = id
    this.override = null
    this.beta = moved(this.beta, getTime(), positionKey(this.position))
    // a move takes the last top's card down (a hand off the top climbs on), and Again with it
    this.result = null
    this.againOffered = false
    // session 23: topping out ended the attempt: the hand coming off the top starts a new one
    if (wasTopped && !this.isTopped()) this.beta = newAttempt(this.beta, this.betaDefault, getTime())
    // a hand just reached the top hold: the problem is done, "TOPPED" from this frame
    if (!wasTopped && this.isTopped()) {
      this.toppedAt = getTime()
      this.toppedShown = true
      this.visuals.setToppedAlpha(1)
      this.finishGo()
    }
    this.callouts.hideWhy()
    this.recompute()
    // a pinned hint on its third rung shows its why-line on arrival, as the rung did
    if (this.beta.hintStep === 3) this.showGlowWhy()
  }

  /** Session 24: the go topped out. Its tick from what the beta module recorded, par from where this go's count
   *  started, the best kept for this problem and height; the card waits for the mats. Then the go ends. */
  private finishGo(): void {
    const b = this.beta
    const go: Go = {tick: tickFor(b.attempt, b.betaSeenThisGo, b.hintsThisGo), go: b.attempt, moves: b.moves, hints: b.hintsThisGo}
    const par = this.getPar()
    const key = this.bestKeyNow()
    const rec = this.save.readRecord(key)
    this.save.writeRecord(key, {goes: Math.max(rec.goes, b.attempt), best: better(go, rec.best) ? go : rec.best})
    this.result = {go, par, lines: cardLines(go, par, rec.best), key}
    this.againOffered = true
    print(`[NextHold] topped: ${this.result.lines.join(" | ")} (${this.save.lastWrite})`)
    this.beta = toppedOut(b)
  }

  /** the next go's number on this problem at this height: one more than the goes kept */
  private nextGoNumber(): number {
    return this.save.readRecord(this.bestKeyNow()).goes + 1
  }

  private bestKeyNow(): string {
    return bestKey(this.currentProblemKey(), this.heightCm)
  }

  /** rung 3 (session 24): the next move's why-line, at once */
  private showGlowWhy(): void {
    const g = this.overlay ? this.overlay.glowHoldId : null
    const w = g ? this.whyText(g) : null
    if (g && w) {
      this.refusedUntil = -1
      this.showWhyFor(g, w)
    }
  }

  /** What "?" says about a hold: its ring's score, or, under a drawn step tag (which shows no grip colour,
   *  session 24), the step it is in the plan. Never "OUT OF REACH" for a hold the plan takes. */
  private whyText(id: string): string | null {
    const n = this.tagStep(id)
    // one short line (G), as the refusal's "STEP 1 FIRST": "PINCH HOLD · STEP 2" was twice the old line's width,
    // and from 125 cm slid into view over the glowing hold next to it (c5)
    if (n !== null) return `STEP ${n}`
    const r = this.shownScore(id)
    return r ? r.why : null
  }

  /** Tests only: set a position up, whatever its colour (a pinch can only make green or yellow moves). */
  forceMove(limb: Limb, id: string): void {
    if (!this.ready || !this.holds[id] || LIMBS.indexOf(limb) < 0) return
    this.moveLimb(limb, id)
  }

  /** A toggle is an override: the next pinch on a hold moves this limb, and until then the rings and
   *  the glow are this limb's. It lasts until that move. */
  pressLimb(limb: Limb): void {
    if (!this.ready || LIMBS.indexOf(limb) < 0) return
    this.rippleButton("Toggle_" + limb)
    this.override = limb
    // session 24: picking a limb closes the body cluster
    this.bodyOpen = false
    this.callouts.hideWhy()
    this.recompute()
  }

  /** Shows the suggestion's label again and restarts its fade; moves nothing. The demo autopilot uses
   *  it as the overlays come in, since the label from the Lens's start has faded by then. */
  showLabelAgain(): void {
    const s = this.getSuggestion()
    if (s && this.overlay && this.overlay.glowHoldId === s.holdId) this.callouts.showSuggestion(this.labelPos(s.holdId), this.wallRot(), s.label)
  }

  /** Beta shown: arms for the next pinch on a ring, as ever. Beta hidden: the next step of the hint
   *  ladder (NextHoldBeta.ask), whose third step arms it. */
  pressAsk(): void {
    if (!this.ready) return
    this.rippleButton("AskButton")
    if (this.mode !== "climb") {
      this.askArmed = false
      this.controlRow.setAskArmed(false)
      return
    }
    const was = this.beta
    const next = ask(was, this.askArmed, this.isTopped())
    this.beta = next.state
    this.askArmed = next.armed
    this.controlRow.setAskArmed(this.askArmed)
    if (next.state.hintStep !== was.hintStep || next.state.cameOffMove !== was.cameOffMove) this.recompute()
    else this.controlRow.setAskDots(askDots(this.beta))
    // session 24: rung 3 is the move's why-line, shown with this pinch (no pinch on a ring after it)
    if (next.why) this.showGlowWhy()
  }

  /** "Show my beta" / "Hide beta" (session 24: a toggle). Showing it marks the go "with beta"; hiding it again
   *  doesn't clear that. In this frame. Only while climbing. */
  pressShowBeta(): void {
    if (!this.ready || this.mode !== "climb") return
    this.rippleButton("ShowBetaButton")
    this.beta = this.beta.betaShown ? hideBeta(this.beta) : showBeta(this.beta)
    this.askArmed = false
    this.controlRow.setAskArmed(false)
    this.callouts.hideWhy()
    this.recompute()
  }

  /** Session 24 (G): the body cluster (the four limb toggles, the preview's stand-in for body tracking) opens
   *  in place of the climb page, and closes again. */
  pressBody(): void {
    if (!this.ready) return
    this.rippleButton("BodyButton")
    this.bodyOpen = !this.bodyOpen
    this.applyPage()
  }

  /** Session 24 (G): the settings page (mark holds, the view override, height) opens in place of the climb
   *  page; pinched again it closes, and if marking it goes back to climbing. */
  pressSetup(): void {
    if (!this.ready) return
    this.rippleButton("SetupButton")
    const open = this.settingsOpen || this.mode === "setup"
    this.bodyOpen = false
    this.settingsOpen = !open
    if (open && this.mode === "setup") this.pressMode()
    else this.applyPage()
  }

  private page(): RowPage {
    return this.settingsOpen || this.mode === "setup" ? "settings" : this.bodyOpen ? "body" : "climb"
  }

  private applyPage(): void {
    this.controlRow.setPage(this.page())
  }

  /** Session 24 (B): "Again" on a card: back to where this go's count started (the start holds), a fresh go. */
  pressAgain(): void {
    if (!this.ready || this.mode !== "climb") return
    this.rippleButton("AgainButton")
    this.resetAttempt()
  }

  /** Back to the start position for the next go (the Again button, and tests). No move is counted; a go still
   *  under way counts as ended; beta goes back to the default; a pinned hint waits at its own position. */
  resetAttempt(): void {
    if (!this.ready) return
    const live = this.beta.moves > this.beta.fellAtMoves
    if (live) {
      const key = this.bestKeyNow(), rec = this.save.readRecord(key)
      this.save.writeRecord(key, {goes: Math.max(rec.goes, this.beta.attempt), best: rec.best})
    }
    this.position = {...this.startPos}
    this.override = null
    this.result = null
    this.againOffered = false
    this.toppedAt = -1
    this.toppedShown = false
    this.refusedUntil = -1
    this.visuals.stopPulse()
    this.askArmed = false
    this.controlRow.setAskArmed(false)
    this.callouts.hideWhy()
    this.beta = betaAgain(this.beta, this.betaDefault, getTime(), positionKey(this.position))
    this.recompute()
  }

  /** Tests and the demo autopilot: use this store from here (a fresh GeneralDataStore.create(), so nothing leaks
   *  between scenarios or takes, and the preview's own store is never written by them). Doesn't read it: see
   *  reloadFromStore. */
  useStore(store: KVStore | null): void {
    this.save = new NextHoldSave(store)
  }

  /** Read the store as an open would: the kept height (if any) and the next go's number. The position and
   *  the beta stay as they are. */
  reloadFromStore(): void {
    if (!this.ready) return
    this.storedHeight = this.save.readHeight()
    if (this.storedHeight !== null) {
      this.heightCm = this.storedHeight
      this.controlRow.setHeight(this.heightCm)
    }
    this.beta = {...this.beta, attempt: this.nextGoNumber()}
    this.recompute()
  }

  /** The demo autopilot: the height without a pinch or a ripple, and without keeping it. */
  setHeightCm(cm: number): void {
    if (!this.ready) return
    this.heightCm = Math.min(HEIGHT_MAX_CM, Math.max(HEIGHT_MIN_CM, Math.round(cm / HEIGHT_STEP_CM) * HEIGHT_STEP_CM))
    this.controlRow.setHeight(this.heightCm)
    this.recompute()
  }

  /** One pinch on the came-off card: the hint ladder opens at that position. */
  pressCameOffHint(): void {
    if (!this.ready || this.beta.cameOffMove === null) return
    this.rippleButton("CameOffCard")
    this.beta = takeHint(this.beta)
    this.recompute()
  }

  /** The beta on, with no pinch and no ripple: the demo autopilot sets it at its start, so the take
   *  reads the full v6 read from its first frame. */
  setBetaShown(): void {
    if (!this.ready) return
    this.beta = showBeta(this.beta)
    this.recompute()
  }

  /** Tests only: start over from the opening state, with beta shown or hidden, and keep that as what
   *  a new attempt or problem goes back to. The LEAF reset uses true, so scenarios written for the full
   *  read keep their meaning; the hidden path's scenarios use false. */
  resetBetaForTests(shown: boolean): void {
    if (!this.ready) return
    this.betaDefault = shown
    // session 24: the go's count starts here, from this position, numbered from the (test's) store; no card,
    // the climb page
    this.startPos = {...this.position}
    this.result = null
    this.againOffered = false
    this.bodyOpen = false
    this.settingsOpen = false
    this.beta = initialBeta(shown, getTime(), this.nextGoNumber(), positionKey(this.position))
    this.askArmed = false
    this.controlRow.setAskArmed(false)
    this.recompute()
  }

  private currentProblemKey(): string {
    return problemKey(this.getProblemHolds(), this.getStartHolds(), this.getTopHold())
  }

  /** Each frame: the cue in the row's top line, while it applies. It shows, and does nothing else. */
  private tickCue(time: number): void {
    const on = cueShown(this.beta, {onWall: this.view === "wall", climbing: this.mode === "climb", topped: this.isTopped(), now: time})
    if (on === this.cueOn) return
    this.cueOn = on
    this.controlRow.setCue(on ? CUE_TEXT : null)  }

  pressMode(): void {
    if (!this.ready) return
    this.rippleButton("ModeSwitch")
    this.mode = this.mode === "climb" ? "setup" : "climb"
    // session 23: a card doesn't outlast a trip to setup; a different problem starts from nothing
    if (this.mode === "setup") {
      this.setupFromKey = this.currentProblemKey()
      this.beta = {...this.beta, cameOffMove: null}
      this.result = null
      this.againOffered = false
      this.bodyOpen = false
    } else {
      // session 24: back to climbing, the settings page closes with it
      this.settingsOpen = false
      if (this.currentProblemKey() !== this.setupFromKey) {
        // another problem: its own goes, counted from where the climber is now
        this.startPos = {...this.position}
        this.beta = initialBeta(this.betaDefault, getTime(), this.nextGoNumber(), positionKey(this.position))
      }
    }
    this.visuals.stopPulse()
    this.askArmed = false
    this.controlRow.setAskArmed(false)
    this.callouts.hideWhy()
    this.typePicker.hide()
    this.pickerHold = null
    this.recompute() // switching back to climb recomputes everything
  }

  /** Ground <-> On wall by hand. It holds until the eye next crosses a threshold (followDistance). */
  pressView(): void {
    if (!this.ready) return
    this.rippleButton("ViewToggle")
    // session 24: a one-off choice: the settings page closes so the view itself shows
    if (this.settingsOpen) {
      this.settingsOpen = false
      this.applyPage()
    }
    this.setView(this.view === "ground" ? "wall" : "ground")
  }

  /** Height − / +: one 5 cm step, kept in 150-200 cm. The wall recolours for the new body and the
   *  1-2-3 is searched again for it, in the same frame; an override stays (the climber chose it),
   *  otherwise the best limb is picked again for the new body. The position doesn't change. */
  pressHeight(step: number): void {
    if (!this.ready || step === 0) return
    this.rippleButton(step > 0 ? "HeightUp" : "HeightDown")
    const snapped = Math.round(this.heightCm / HEIGHT_STEP_CM) * HEIGHT_STEP_CM
    const next = Math.min(HEIGHT_MAX_CM, Math.max(HEIGHT_MIN_CM, snapped + (step > 0 ? 1 : -1) * HEIGHT_STEP_CM))
    if (next === this.heightCm) return
    this.heightCm = next
    this.controlRow.setHeight(this.heightCm)
    // session 24 (C): kept for later opens (nothing happens if the store can't take it)
    this.save.writeHeight(this.heightCm)
    this.callouts.hideWhy()
    this.recompute()
  }

  /** Only what is shown changes: no rescoring, same state, same frame. */
  private setView(view: View): void {
    this.view = view
    if (view === "wall") {
      this.beta = arrivedOnWall(this.beta, getTime())
      // back on the wall from where they are: no Again (a top's card waits for the mats again)
      if (!this.result) this.againOffered = false
    }
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
    this.recompute()
  }

  /** Setup: toggle the hold just pinched as one of the problem's start holds. */
  pressStart(): void {
    if (!this.ready || this.mode !== "setup" || !this.pickerHold) return
    const id = this.pickerHold
    this.rippleButton("StartButton")
    if (this.startFlags[id]) delete this.startFlags[id]
    else this.startFlags[id] = true
    this.typePicker.setFlags(!!this.startFlags[id], this.topFlag === id)
    this.recompute()
  }

  /** Setup: make the hold just pinched the problem's top hold (pinch again to clear it). */
  pressTop(): void {
    if (!this.ready || this.mode !== "setup" || !this.pickerHold) return
    const id = this.pickerHold
    this.rippleButton("TopButton")
    this.topFlag = this.topFlag === id ? null : id
    this.typePicker.setFlags(!!this.startFlags[id], this.topFlag === id)
    this.recompute()
  }

  /** A hand is on the problem's top hold, climbing: the problem is done (read API too). */
  isTopped(): boolean {
    const top = this.getTopHold()
    return this.mode === "climb" && top !== null && HAND_LIMBS.some((l) => this.position[l] === top)
  }

  /** Each frame while "TOPPED" is up: full for TOPPED_SECONDS, then it fades out and is dropped. */
  private tickTopped(time: number): void {
    if (!this.toppedShown) return
    const fade = (time - this.toppedAt - TOPPED_SECONDS) / TOPPED_FADE_SECONDS
    if (fade < 1) {
      this.visuals.setToppedAlpha(fade <= 0 ? 1 : 1 - fade)
      return
    }
    this.toppedShown = false
    this.recompute()
  }

  /** A refusal's line comes down by itself; any other why-line stays until something closes it. */
  private tickRefused(time: number): void {
    if (this.refusedUntil < 0 || time < this.refusedUntil) return
    this.refusedUntil = -1
    this.callouts.hideWhy()
  }

  // ── recompute: same frame as the change ──────────────────────────────────
  private recompute(): void {
    const reach = this.reach()
    const holds = this.scoredHolds()
    // the problem's top hold pulls the suggestion upward (ranking only, never the colour)
    const goalTop = this.getTopHold()
    const moveArgs = {holds, holdTypes: this.holdTypes, position: this.position, reach, top: goalTop}
    if (this.override) this.selected = this.override
    else {
      const best = bestMove(moveArgs)
      if (best) this.selected = best.limb
    }
    this.evaluation = evaluate({...moveArgs, limb: this.selected})
    // session 20: each ring shows what a pinch on it would do: the override's move if there is one,
    // else the best limb's for that hold, so a ring never looks red when a pinch on it makes a good move
    this.byHold = {}
    for (const r of this.override ? this.evaluation.results : bestPerHold(moveArgs)) this.byHold[r.holdId] = r
    this.controlRow.setOverride(this.override)

    const climb = this.mode === "climb"
    const topped = this.isTopped()
    if (!topped) {
      this.toppedAt = -1
      this.toppedShown = false
    }
    // session 23: what the climber is shown. Everything above is worked out either way; setup always
    // shows its own marks, so the reveal only speaks while climbing
    const show = reveal(this.beta)
    // the toggle a climber picked stays lit; the best limb lights only when the next move is on show
    const limbShown = !climb || show.limb || !!this.override
    const rings: {[id: string]: RingColour | null} = {}
    const marks: {[id: string]: boolean} = {}
    const tags: {[id: string]: string} = {}
    const tagsBelow: {[id: string]: boolean} = {}
    const outlines: {[id: string]: boolean} = {}
    for (const id of Object.keys(this.holds)) {
      const ringed = show.rings === "all" || (show.rings === "reach" && inReach(this.byHold[id]))
      rings[id] = climb && ringed && this.byHold[id] ? this.byHold[id].colour : null
      if (climb && show.outlines && this.problem[id]) outlines[id] = true
      // outside setup the holds that aren't in the problem stay visible, but dim
      this.wall.setHoldDim(id, climb && !this.problem[id])
      // climbing: the goal of the sequence is marked "TOP" (Ground only, see pushOverlay); topped out,
      // "TOPPED" for a moment (both views), then nothing
      if (climb && id === goalTop && !topped) tags[id] = "TOP"
      if (climb && id === goalTop && topped && this.toppedShown) tags[id] = TOPPED_TEXT
      // with beta hidden the read from the mats marks the start holds too (Ground only, as TOP)
      if (climb && show.outlines && this.problem[id] && this.startFlags[id] && id !== goalTop) {
        tags[id] = "START"
        tagsBelow[id] = true
      }
      if (climb || !this.problem[id]) continue
      marks[id] = true
      const tag = (this.startFlags[id] ? ["START"] : []).concat(goalTop === id ? ["TOP"] : [])
      if (tag.length) tags[id] = tag.join(" · ")
    }
    // topped out there is no next move: no glow, no label, no 1-2-3, no arrow (the rings stay)
    const sug = climb && !topped && show.glow ? this.evaluation.suggestion : null
    // look-ahead from the same position, in the same frame as the rings
    this.preview = climb && sug && show.steps
      ? sequence({holds, holdTypes: this.holdTypes, position: this.position, reach, top: goalTop, limb: this.selected})
      : []
    // session 24 (the A+E judges' fix 1): a hold under a step tag says nothing about gripping it from here (the
    // plan reaches it after step 1): no grip colour, the neutral outline the tag pins onto (NextHoldWallVisuals)
    for (let n = 2; n <= 3; n++) {
      const step = this.preview[n - 1]
      if (step && step.holdId !== (sug ? sug.holdId : null)) rings[step.holdId] = null
    }
    this.overlay = {
      rings,
      glowHoldId: sug ? sug.holdId : null,
      position: {...this.position},
      selectedLimb: limbShown ? this.selected : null,
      showMarkers: true,
      marks,
      tags,
      tagsAbove: climb,
      tagsBelow,
      outlines,
      ghosts: this.preview.map((m) => ({hold: m.holdId, limb: m.limb})),
      // the body: the centre of mass the scoring itself uses for this position
      torso: centreOfMass(this.position, holds),
      body: !climb || show.figure ? this.figureBody(holds, reach) : null,
    }
    this.pushOverlay()

    this.controlRow.setSelectedLimb(limbShown ? this.selected : null)
    this.controlRow.setMode(this.mode)
    this.controlRow.setView(this.view)
    this.controlRow.setBetaShown(this.beta.betaShown)
    this.controlRow.setAskDots(climb ? askDots(this.beta) : "")
    this.applyPage()
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
    this.callouts.setLabelMinSize(ground ? minReadSize(this.groundCm) * readBoost(this.groundCm) : 0)
    // On wall the label is the only word: it stays there; in Ground it fades
    this.callouts.setLabelSticky(!ground)
    const glowScale = this.glowScale()
    const labelBox = s.glowHoldId ? this.labelBox(s.glowHoldId) : null
    if (ground) {
      // no stick figure in Ground: its 1 cm line is a faint smudge from 2.5 m and competes with
      // the rings; the limb markers already show where the hands and feet are
      this.visuals.apply({...s, body: null, viewCm: this.groundCm, glowScale, labelBox})
    } else {
      // On wall: one ring and its word; with beta hidden only what the hint ladder has opened (session 23)
      let rings: {[id: string]: RingColour | null} = {}
      if (this.mode === "climb" && !this.beta.betaShown) rings = s.rings
      else if (s.glowHoldId) rings[s.glowHoldId] = s.rings[s.glowHoldId] || null
      // the climbing TOP tag is a Ground thing (setup keeps its tags), but "TOPPED" is the word when
      // there is no ring left
      const tags: {[id: string]: string} = this.mode === "climb" ? {} : s.tags
      if (this.mode === "climb") for (const id of Object.keys(s.tags)) if (s.tags[id] === TOPPED_TEXT) tags[id] = TOPPED_TEXT
      this.visuals.apply({...s, rings, tags, ghosts: [], outlines: {}, viewCm: DESIGN_VIEW_CM, glowScale, labelBox})
    }
    // the label's size changed with the view: keep it just below the ring
    if (s.glowHoldId) this.callouts.moveSuggestion(this.labelPos(s.glowHoldId), this.wallRot())
    // the panels follow the view: beside the problem and sized for the distance in Ground
    this.placeControlRow()
    // the why-line follows the view too, and keeps saying what it was saying
    const whyId = this.callouts.getWhyHoldId()
    const whyText = this.refusedUntil >= 0 ? this.refusedText : whyId ? this.whyText(whyId) : null
    if (this.callouts.isWhyVisible() && whyId && whyText) this.showWhyFor(whyId, whyText)
    this.placeMatCards()
  }

  /**
   * The cards read from the mats (session 23: came off; session 24: the result after a top), with "Again" by
   * them. Only in Ground while climbing; the result once "TOPPED" has faded. The card goes where it covers
   * nothing (as session 23 placed it); Again then takes the first clear place next to it, under it first.
   * (One card-over-Again block was too tall to fit clear from 2.5 m: h5 found it over four rings.)
   */
  private placeMatCards(): void {
    const ground = this.view === "ground" && this.mode === "climb"
    const cameOff = ground && this.beta.cameOffMove !== null
    const result = ground && !cameOff && !!this.result && !this.toppedShown
    // Again alone: a fall's card answered (the hint taken), or a fall with beta shown (no card)
    const again = ground && (cameOff || result || (this.againOffered && !this.result))
    if (!cameOff) this.callouts.hideCameOff()
    if (!result) this.callouts.hideResult()
    if (!again) {
      this.callouts.hideAgain()
      return
    }
    const k = this.panelScale()
    const aw = (AGAIN_W / 2) * k, ah = (AGAIN_H / 2) * k
    if (!cameOff && !result) {
      this.callouts.showAgain(this.placeMatBlock(aw, ah, []), this.wallRot(), k)
      return
    }
    const cw = (result ? RESULT_HALF_W : CARD_HALF_W) * k, ch = (result ? RESULT_HALF_H : CARD_HALF_H) * k
    const p = this.placeMatBlock(cw, ch, [])
    if (cameOff) this.callouts.showCameOff(p, this.wallRot(), cameOffLine(this.beta.cameOffMove!), k)
    else this.callouts.showResult(p, this.wallRot(), this.result!.lines, k)
    const c = this.toWall(p), g = AGAIN_GAP * k
    const card = {x: c.x, y: c.y, hw: cw, hh: ch}
    let best: {p: vec3; clear: number} | null = null
    for (const q of [{x: c.x, y: c.y - ch - g - ah}, {x: c.x + cw + g + aw, y: c.y}, {x: c.x - cw - g - aw, y: c.y}, {x: c.x, y: c.y + ch + g + ah}]) {
      const pq = this.keepInView(this.wall.wallToWorld(q.x, q.y, PANEL_Z), aw + 2 * k, ah + 2 * k)
      const clear = this.matClear(this.toWall(pq), aw, ah, [card])
      if (!best || clear > best.clear + 1e-6) best = {p: pq, clear}
      if (clear >= 2) break
    }
    // nothing clear next to the card: the first clear place in view, the card counted as taken
    let p2 = best!.p
    if (best!.clear < 2) {
      const p3 = this.placeMatBlock(aw, ah, [card])
      if (this.matClear(this.toWall(p3), aw, ah, [card]) > best!.clear) p2 = p3
    }
    this.callouts.showAgain(p2, this.wallRot(), k)
  }

  /** how clear (cm, wall) a box centred at w is of the problem's rings, the tags and labels, and `extra` boxes */
  private matClear(w: WallPt, hw: number, hh: number, extra: {x: number; y: number; hw: number; hh: number}[]): number {
    let clear = 1e9
    for (const id of this.getProblemHolds()) clear = Math.min(clear, boxCircleGap(w, hw, hh, this.holds[id].x, this.holds[id].y, this.ringRadius(id) + this.getRingLineWidth() / 2))
    for (const b of this.visuals.getTextBoxes().concat(extra)) clear = Math.min(clear, boxBoxGap(w, hw, hh, b))
    return clear
  }

  /**
   * Where a card read from the mats goes. It stands where the eye is looking, in the first place that
   * covers no ring or tag of the problem (lower in the view first), kept in view, and sized like the
   * other panels. World-locked once placed: it moves only when Ground re-sizes for a new distance.
   */
  private placeMatBlock(hw: number, hh: number, extra: {x: number; y: number; hw: number; hh: number}[]): vec3 {
    const k = this.panelScale()
    const finder = WorldCameraFinderProvider.getInstance()
    const cam = finder ? finder.getComponent() : null
    const eye = this.eyeOnWall()
    const h = eye ? eye.z * (cam ? Math.tan(cam.fov / 2) : 0.33) : 80
    const cx = eye ? eye.x : 120, cy = eye ? eye.y : 150
    let best: {p: vec3; clear: number} | null = null
    for (const v of [-0.55, -0.7, -0.4, -0.25, -0.1, 0.1, 0.25, 0.4, 0.55]) {
      for (const u of [0, -0.2, 0.2]) {
        // kept in view with room to spare: the card is a 3D prism, drawn k times larger from the mats
        // (h5's first run: from 2.5 m with a 1 cm margin it was cut 0.8% at the frame's edge)
        const p = this.keepInView(this.wall.wallToWorld(cx + u * h, cy + v * h, PANEL_Z), hw + 2 * k, hh + 2 * k)
        const clear = this.matClear(this.toWall(p), hw, hh, extra)
        if (!best || clear > best.clear + 1e-6) best = {p, clear}
        if (clear >= 2) break
      }
      if (best && best.clear >= 2) break
    }
    return best!.p
  }

  /** The score a hold's ring shows, which is the one "?" explains: the limb a pinch on it moves (the
   *  override, or the best limb for that hold). Session 23: also under a step tag, whose ring now keeps
   *  this colour. Null when the hold has no score. */
  private shownScore(id: string): ScoreResult | null {
    return this.byHold[id] || null
  }

  /** The step whose tag is drawn on this hold: the earliest of steps 2 and 3 on it, in Ground and not
   *  on the glowing hold. Null otherwise. */
  private shownStep(id: string): ScoreResult | null {
    const n = this.tagStep(id)
    return n === null ? null : this.preview[n - 1]
  }

  /** the number (2 or 3) of the earliest step tag drawn on this hold, in Ground and not on the glowing hold */
  private tagStep(id: string): number | null {
    if (this.view === "ground" && this.overlay && this.overlay.glowHoldId !== id) {
      for (let n = 2; n <= 3; n++) {
        const step = this.preview[n - 1]
        if (step && step.holdId === id && this.visuals.ghostHold(n) === id) return n
      }
    }
    return null
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

  /**
   * Up close the label sits inside the glow's target ring, just under the ring's line. Session 20:
   * drawn larger from the mats it can't fit there, so it moves out past the glow, below it, or above
   * or beside it when another ring is in the way. Never over a ring or the glow from 2.5 m (l1).
   */
  private labelCentre(id: string): WallPt {
    const h = this.holds[id]
    const k = this.callouts.getLabelScale()
    const hw = LABEL_HALF_W * k, hh = LABEL_HALF_H * k
    const inside = this.ringRadius(id) + this.getRingLineWidth() / 2 + LABEL_GAP * k
    const glow = this.glowRadius(id) + LABEL_GLOW_GAP
    const t = Math.min(1, Math.max(0, (k - 1) / (LABEL_OUT_SCALE - 1)))
    const below = {x: h.x, y: h.y - (inside + (glow + hh - inside) * t)}
    if (t < 1) return below
    const line = this.getRingLineWidth() / 2
    const clearance = (c: WallPt) => {
      let m = Math.min(c.x - hw, 240 - c.x - hw)
      for (const o of this.getProblemHolds()) {
        if (o !== id) m = Math.min(m, boxCircleGap(c, hw, hh, this.holds[o].x, this.holds[o].y, this.ringRadius(o) + line) - LABEL_GLOW_GAP)
      }
      return m
    }
    let best = below, bestClear = clearance(below)
    for (const c of [{x: h.x, y: h.y + glow + hh}, {x: h.x + glow + hw, y: h.y}, {x: h.x - glow - hw, y: h.y}]) {
      if (bestClear >= 0) break
      const m = clearance(c)
      if (m > bestClear) { best = c; bestClear = m }
    }
    return best
  }

  /** how much larger the glow is drawn than its 110 cm span: in Ground it keeps "as large as at 110 cm",
   *  it doesn't take the label's extra size, or it would swallow the holds beside it */
  private glowScale(): number {
    return this.view === "ground" ? Math.max(1, minReadSize(this.groundCm) / this.callouts.getLabelBaseSize()) : 1
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

  /** the control row's plate, as four world corners */
  private rowCorners(): vec3[] {
    const size = this.controlRow.getSize()
    const hw = size ? size.x / 2 : ROW_HALF_W
    const hh = size ? size.y / 2 : ROW_HALF_H
    const row = this.controlRow.getTransform().getWorldTransform()
    return [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(([x, y]) => row.multiplyPoint(new vec3(x, y, 0)))
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
   * On wall: out of the line of sight to the one ring, just below its glow as the eye sees it
   * (beside it with no room below), re-placed every frame as the eye moves; in view only as far as
   * that allows (session 18). In setup On wall: below the hands, kept in view. In Ground: beside the problem, level with its start holds, on
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
    const ring = this.overlay && this.mode === "climb" ? this.overlay.glowHoldId : null
    if (!ring) {
      // no suggested ring (setup): below the hands, kept in view, as before
      const hands = HAND_LIMBS.map((l) => this.position[l]).filter((id) => id != null && this.holds[id]) as string[]
      let x = 120, y = 120
      if (hands.length > 0) {
        x = hands.reduce((s, id) => s + this.holds[id].x, 0) / hands.length
        y = Math.min(...hands.map((id) => this.holds[id].y)) - this.rowDropCm
      }
      x = Math.min(220, Math.max(20, x))
      y = Math.max(12, y)
      const kept = this.keepInView(this.wall.wallToWorld(x, y, PANEL_Z), halfW, halfH)
      if (this.mode === "climb" && !this.beta.betaShown) {
        // session 23, beta hidden: the row (30 x 33 cm in a 40 x 46 cm view) doesn't slide up over the wall
        // the climber is working out and any hint's rings. It hangs below the hands, the brief's place:
        // into view sideways and downward only; glance down to it, as for the one ring
        const kv = this.toWall(kept)
        this.controlRow.placeAt(this.wall.wallToWorld(kv.x, Math.min(y, kv.y), PANEL_Z), this.wallRot(), k)
        return
      }
      this.controlRow.placeAt(kept, this.wallRot(), k)
      return
    }
    // On wall the one ring and its word are the view: the row goes out of the line of sight to it.
    // Below the ring's glow as the eye sees it (the row stands PANEL_Z in front of the wall, so it is
    // placed where its outline, projected from the eye onto the wall, clears the glow), or beside it
    // when there is no room below. It comes into view only as far as it can without crossing the
    // ring: from 70 cm the view is about 40 x 46 cm, so it mostly hangs just under it; glance down.
    const eye = this.eyeOnWall()
    const s = eye ? this.seenScale(eye, PANEL_Z) : 1
    const h = this.holds[ring]
    const R = this.glowRadius(ring) + ROW_RING_GAP
    const below = h.y - R - 2 * halfH * s >= 0
    const seen = below ? {x: h.x, y: h.y - R - halfH * s}
      : {x: h.x < 120 ? h.x + R + halfW * s : h.x - R - halfW * s, y: h.y}
    const p = this.unproject(seen, eye, s)
    const kv = this.toWall(this.keepInView(this.wall.wallToWorld(p.x, p.y, PANEL_Z), halfW, halfH))
    // below: it may slide sideways into view, and down, never up toward the ring; beside: up or down
    const x = below ? kv.x : p.x
    const y = Math.max(halfH + 2, below ? Math.min(p.y, kv.y) : kv.y)
    this.controlRow.placeAt(this.wall.wallToWorld(x, y, PANEL_Z), this.wallRot(), k)
  }

  /** the suggested ring's outer edge with its glow (wall cm): the "one ring" On wall */
  private glowRadius(id: string): number {
    return this.ringRadius(id) + this.getRingLineWidth() / 2 + GLOW_PROFILE.span * this.glowScale()
  }

  /** the eye in wall cm: x from the wall's left edge, y up from the floor, z out from the face; null without a camera */
  private eyeOnWall(): {x: number; y: number; z: number} | null {
    const finder = WorldCameraFinderProvider.getInstance()
    const cam = finder ? finder.getComponent() : null
    if (!cam) return null
    const l = this.wall.getTransform().getInvertedWorldTransform().multiplyPoint(cam.getSceneObject().getTransform().getWorldPosition())
    return {x: l.x - this.wall.wallToLocal(0, 0).x, y: l.y, z: l.z}
  }

  /** how much larger something `z` cm in front of the wall looks, projected from the eye onto the wall */
  private seenScale(eye: {z: number} | null, z: number): number {
    return eye && eye.z > z + 1 ? eye.z / (eye.z - z) : 1
  }

  /** the point on a plane in front of the wall that the eye sees at wall point q (s = seenScale for that plane) */
  private unproject(q: WallPt, eye: {x: number; y: number} | null, s: number): WallPt {
    return eye ? {x: eye.x + (q.x - eye.x) / s, y: eye.y + (q.y - eye.y) / s} : {x: q.x, y: q.y}
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

  /**
   * The why-line sits against the asked hold's ring, as the eye sees it: below or above it (toward
   * the middle of the view first), else to its right or left. Each place is slid into view, and the
   * first that covers no ring, label, tag or badge, and whose nearest ring is still the asked one,
   * wins (else the clearest). From 2.5 m it is drawn 2.3x: slid into view below h11 it lay across
   * rh's green ring and read as that hold's caption.
   */
  private showWhyFor(id: string, why: string): void {
    const h = this.holds[id]
    const k = this.panelScale()
    const halfW = whyHalfWidth(why) * k, halfH = WHY_HALF_H * k
    const eye = this.eyeOnWall()
    const s = this.seenScale(eye, PANEL_Z)
    const hw = halfW * s, hh = halfH * s
    const own = this.shownRingRadius(id)
    const d = own + WHY_RING_GAP
    const others = this.getHoldIds().filter((o) => o !== id && this.isRingVisible(o))
      .map((o) => ({x: this.holds[o].x, y: this.holds[o].y, r: this.shownRingRadius(o)}))
    const texts = this.visuals.getTextBoxes()
    // and the control row, as the eye sees it on the wall
    const row = this.rowOutlineOnWall()
    if (row) {
      const xs = row.map((p) => p.x), ys = row.map((p) => p.y)
      const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys)
      texts.push({x: (x0 + x1) / 2, y: (y0 + y1) / 2, hw: (x1 - x0) / 2, hh: (y1 - y0) / 2})
    }
    const ys = this.isAboveViewCentre(this.wall.wallToWorld(h.x, h.y, 0)) ? [h.y - d - hh, h.y + d + hh] : [h.y + d + hh, h.y - d - hh]
    // below / above, centred, then slid along the ring away from a neighbour (still under or over it)
    const cands: WallPt[] = []
    for (const y of ys) for (const dx of [0, -0.5, 0.5, -0.9, 0.9]) cands.push({x: h.x + dx * hw, y})
    cands.push({x: h.x + d + hw, y: h.y}, {x: h.x - d - hw, y: h.y})
    let best: {p: WallPt; clear: number} | null = null
    for (const c of cands) {
      const q = this.unproject(c, eye, s)
      const p = this.toWall(this.keepInView(this.wall.wallToWorld(q.x, q.y, PANEL_Z), halfW, halfH))
      // back to where it is seen on the wall, to measure against the rings there
      const v = eye ? {x: eye.x + (p.x - eye.x) * s, y: eye.y + (p.y - eye.y) * s} : p
      const ownGap = boxCircleGap(v, hw, hh, h.x, h.y, own)
      let clear = ownGap
      let nearest = true
      for (const o of others) {
        const g = boxCircleGap(v, hw, hh, o.x, o.y, o.r)
        clear = Math.min(clear, g - WHY_RING_GAP)
        // the asked ring must be clearly the nearest, not by a hair: a glow's bloom reaches far
        if (g < ownGap + WHY_RING_GAP) nearest = false
      }
      for (const b of texts) clear = Math.min(clear, boxBoxGap(v, hw, hh, b) - WHY_RING_GAP)
      if (!nearest) clear = Math.min(clear, -0.5)
      if (clear >= 0) { best = {p, clear}; break }
      if (!best || clear > best.clear) best = {p, clear}
    }
    this.callouts.showWhy(this.wall.wallToWorld(best!.p.x, best!.p.y, PANEL_Z), this.wallRot(), why, id, k)
  }

  /** a hold's ring as drawn, its line (and its glow, if it glows) included (wall cm) */
  private shownRingRadius(id: string): number {
    return this.isRingGlowing(id) ? this.glowRadius(id) : this.ringRadius(id) + this.getRingLineWidth() / 2
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
    this.ripple.play(name, tr.getWorldPosition().add(out.uniformScale(2.2 * k)), this.wallRot(), 3.4 * k, 0.7 * k)
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
    return this.scoredHoldsFor(this.position)
  }
  /** the same for another position (par starts from the go's start) */
  private scoredHoldsFor(p: Position): Holds {
    const out: Holds = {}
    for (const id of Object.keys(this.holds)) {
      if (this.problem[id] || p.LH === id || p.RH === id || p.LF === id || p.RF === id) out[id] = this.holds[id]
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
  /** how much larger the suggestion label is drawn than at 110 cm */
  getLabelScale(): number { return this.callouts.getLabelScale() }
  /** the control row outline (wall cm) the stick figure fades behind, or null */
  getFigureMask(): WallPt[] | null { return this.visuals ? this.visuals.getFigureMask() : null }
  /** the torso point of the stick figure, in wall cm (null before the first recompute) */
  getTorso(): {x: number; y: number} | null { return this.overlay && this.overlay.torso ? {...this.overlay.torso} : null }
  /** the stick figure's body as drawn: shoulders, hips, arm and leg length, head radius (wall cm) */
  getFigureBody(): FigureBody | null { return this.overlay && this.overlay.body ? this.overlay.body : null }
  getPosition(): Position { return {...this.position} }
  getSelectedLimb(): Limb { return this.selected }
  /** the limb picked on a toggle for the next move, or null */
  getLimbOverride(): Limb | null { return this.override }
  getOverrideLabel(): string { return this.controlRow.getOverrideLabel() }
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
  /** Ring colour for the limb a pinch on this hold moves, or null when the hold shows no ring. */
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
    const s = this.mode === "climb" && !this.isTopped() ? this.evaluation.suggestion : null
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
  isOffViewArrowMoved(): boolean { return this.offViewArrow.isArrowMoved() }
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
  /** the why plate's size (cm, at its 110 cm size; drawn getWhyScale() x that) */
  getWhyPlateSize(): vec2 { return this.callouts.getWhyPlateSize() }
  /** every pinch ripple played (newest last): the hold id or button name it landed on, and when */
  getRippleLog(): RippleEvent[] { return this.ripple ? this.ripple.getLog() : [] }
  isRippleVisible(): boolean { return this.ripple ? this.ripple.isVisible() : false }
  getRippleWorldPosition(): vec3 | null { return this.ripple ? this.ripple.getWorldPosition() : null }
  /** the ripple's radius and its white band's width right now (cm) */
  getRippleRadius(): number { return this.ripple ? this.ripple.getRadius() : 0 }
  getRippleBandWidth(): number { return this.ripple ? this.ripple.getBandWidth() : 0 }
  /** getTime() when a hand reached the top hold, or -1 when not topped out */
  getToppedAt(): number { return this.toppedAt }
  /** every refused pinch (newest last): which hold, and when */
  getRefusalLog(): {hold: string; time: number}[] { return this.refusalLog.slice() }
  /** the ring pulsing now and how large it is drawn (1 = its own size), or null */
  getRingPulse(): {hold: string; scale: number} | null { return this.visuals ? this.visuals.getPulse() : null }
  // session 23
  isBetaShown(): boolean { return this.beta.betaShown }
  getHintStep(): HintStep { return this.beta.hintStep }
  getMovesMade(): number { return this.beta.moves }
  getAttempt(): number { return this.beta.attempt }
  isOutlineVisible(id: string): boolean { return this.visuals ? this.visuals.isOutlineVisible(id) : false }
  isCueVisible(): boolean { return this.cueOn }
  isCameOffVisible(): boolean { return this.callouts.isCameOffVisible() }
  getCameOffText(): string { return this.callouts.getCameOffText() }
  getShowBetaLabel(): string { return this.controlRow.getShowBetaLabel() }
  isShowBetaLit(): boolean { return this.controlRow.isShowBetaLit() }
  // session 24
  getPage(): RowPage { return this.controlRow.getPage() }
  getAskDots(): string { return this.controlRow.getAskDots() }
  isSetupLit(): boolean { return this.controlRow.isSetupLit() }
  getPlannedLine(): string { return this.controlRow.getPlannedLine() }
  isResultVisible(): boolean { return this.callouts.isResultVisible() }
  getResultLines(): string[] { return this.callouts.getResultLines() }
  isAgainVisible(): boolean { return this.callouts.isAgainVisible() }
  /** the last top's result (kept until a move, Again or setup), whether or not its card is on show */
  getLastResult(): {go: Go; par: number | null; lines: string[]; key: string} | null { return this.result }
  /** par for your body: the planner's shortest secure route to the top from this go's start position, at this height */
  getPar(): number | null {
    const top = this.getTopHold()
    if (!top) return null
    const r = routeToTop({holds: this.scoredHoldsFor(this.startPos), holdTypes: this.holdTypes, position: {...this.startPos}, reach: this.reach(), top})
    return r ? r.length : null
  }
  getStartPosition(): Position { return {...this.startPos} }
  getBestKey(): string { return this.bestKeyNow() }
  getLastWrite(): string { return this.save.lastWrite }
  getStoreMaxBytes(): number { return this.save.maxBytes() }
  getHintsThisGo(): number { return this.beta.hintsThisGo }
  isBetaSeenThisGo(): boolean { return this.beta.betaSeenThisGo }
  getPinnedHint(): {at: string; step: number} | null { return this.beta.pin ? {...this.beta.pin} : null }
}

/** gap (cm) between a box (centre c, half sizes hw x hh) and a circle; < 0 when they overlap */
function boxCircleGap(c: WallPt, hw: number, hh: number, x: number, y: number, r: number): number {
  return Math.hypot(Math.max(0, Math.abs(x - c.x) - hw), Math.max(0, Math.abs(y - c.y) - hh)) - r
}

/** gap (cm) between two boxes; < 0 when they overlap */
function boxBoxGap(c: WallPt, hw: number, hh: number, b: {x: number; y: number; hw: number; hh: number}): number {
  const dx = Math.abs(b.x - c.x) - hw - b.hw, dy = Math.abs(b.y - c.y) - hh - b.hh
  return dx > 0 || dy > 0 ? Math.hypot(Math.max(0, dx), Math.max(0, dy)) : Math.max(dx, dy)
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
