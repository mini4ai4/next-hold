// NextHoldBeta — beta on request (v7 part A, session 23; goes and pinned hints, session 24; v7.2, session 26):
// what the climber is shown, and when.
//
// A plain state machine with no Lens globals, no scene access and no scoring, so it is unit-checked
// outside Lens Studio (tests/scoring.port.test.mjs). NextHoldMain owns one BetaState, calls these
// functions on each event and draws what reveal() allows. The scoring core doesn't know any of this:
// the colours, the suggestion and the 1-2-3 are worked out as before, and only what is shown changes.
//
// betaShown false (the default): from the mats the problem's holds show a neutral outline with START
// and TOP; on the wall only the four position markers. "Show my beta" sets it: the full v6 read. Session
// 24: it is a toggle ("Hide beta" takes it down again), and once shown the go stays "with beta".
// The hint ladder, each step on request with "?": (1) grip-coloured rings on the holds in reach,
// (2) the glow and the one word for the next move, (3) why that move works, merged into its label (session
// 26). A move ends the hint: the next position starts from nothing.
//
// A go (session 24, session 26): it begins at the start holds and ends at the top or at a fall.
// - Session 26: every rung of the ladder is a hint (rung 1 colours the holds in reach, which is beta too), so
//   "Hints" counts each rung taken, once per position, and any hint makes the first go a FLASH, not an ONSIGHT.
// - A fall ends the go. Climbing on from where you came off is not a new go and not a send: the go is "not from
//   the start" (fromStart false) until the climber is back on the start holds (Again, or the limbs back on them),
//   and a top from there gets no tick (NextHoldAttempt.resumedLines). A second fall while climbing on isn't
//   another go either.
// - Hints and "beta seen" taken after a fall belong to the next go, and Again keeps them (they were wiped).
// - A height change in the middle of a go ends it, as Again does (Main also re-reads the go's number).
//
// Came off: the eye was on the wall and steps back to the mats, below the top and with a move made
// since the last time. The card offers the hint at that position, which stays as it was: N is the move
// the climber was going for (moves made + 1). A hint taken there is pinned to that position: it shows
// again whenever the climber is back there (after Again, say), and goes once the move from there is made.
// A pinned hint counts once per go.

export type HintStep = 0 | 1 | 2 | 3

export interface BetaState {
  betaShown: boolean
  hintStep: HintStep
  /** the go: the one under way, or the one the next move starts (1 = the first go on this problem) */
  attempt: number
  /** moves made since the position was last the start */
  moves: number
  /** the move a came-off offers a hint for while its card is up; null = no card */
  cameOffMove: number | null
  /** `moves` when the last go ended (a fall or the top): the same fall isn't counted twice */
  fellAtMoves: number
  /** the time the idle clock runs from: the last move, or arriving on the wall */
  idleFrom: number
  /** this go: the hints taken (session 26: every rung) */
  hintsThisGo: number
  /** this go: the beta was shown at some point */
  betaSeenThisGo: boolean
  /** a hint taken after a fall, pinned to the position it was taken at, how far up the ladder, and the go it
   *  was last counted in */
  pin: {at: string; step: HintStep; go: number} | null
  /** the current position, as a key (the pin is matched against it) */
  here: string
  /** session 26: this go began at the start holds; false after a fall or a top until the climber is back on them */
  fromStart: boolean
}

export const CUE_SECONDS = 20
export const CUE_TEXT = "? for a hint"

export function initialBeta(betaShown: boolean, now: number, attempt = 1, here = ""): BetaState {
  return {betaShown, hintStep: 0, attempt, moves: 0, cameOffMove: null, fellAtMoves: 0, idleFrom: now,
    hintsThisGo: 0, betaSeenThisGo: betaShown, pin: null, here, fromStart: true}
}

/** a position as a key: which hold each limb is on */
export function positionKey(p: {LH: string | null; RH: string | null; LF: string | null; RF: string | null}): string {
  return [p.LH, p.RH, p.LF, p.RF].map((h) => h || "-").join("/")
}

/** "Show my beta": the full read. It also answers the card, if one is up. The go is now "with beta". */
export function showBeta(s: BetaState): BetaState {
  return {...s, betaShown: true, betaSeenThisGo: true, cameOffMove: null}
}

/** "Hide beta": back to the hidden read, from the start of the ladder. The go stays "with beta". */
export function hideBeta(s: BetaState): BetaState {
  return {...s, betaShown: false, hintStep: 0}
}

/** up the ladder to `step`: each new rung is one hint; at the pin's position the pin climbs with it */
function climb(s: BetaState, step: HintStep): BetaState {
  const added = Math.max(0, step - s.hintStep)
  const pin = s.pin && s.pin.at === s.here ? {at: s.pin.at, step, go: s.attempt} : s.pin
  return {...s, hintStep: step, hintsThisGo: s.hintsThisGo + added, pin}
}

/** the pinned hint shows here: its rung, counted once in this go */
function showPin(s: BetaState): BetaState {
  const p = s.pin!
  if (p.go === s.attempt) return {...s, hintStep: p.step}
  return {...s, hintStep: p.step, hintsThisGo: s.hintsThisGo + p.step, pin: {...p, go: s.attempt}}
}

/**
 * A pinch on "?". `armed`: is "?" armed now. Returns the new state, whether it is armed after this, and
 * whether the next move's why is to show now (rung 3). With the card up: the same as pinching the card.
 * Beta hidden: step 1, step 2, step 3 (the why, at once; again on each further pinch). Beta shown: it arms
 * and disarms as in v6. Topped out with beta hidden there is no next move to hint.
 */
export function ask(s: BetaState, armed: boolean, topped: boolean): {state: BetaState; armed: boolean; why: boolean} {
  if (s.cameOffMove !== null) return {state: takeHint(s), armed: false, why: false}
  if (s.betaShown) return {state: s, armed: !armed, why: false}
  if (topped) return {state: s, armed: false, why: false}
  const step = Math.min(3, s.hintStep + 1) as HintStep
  return {state: climb(s, step), armed: false, why: step === 3}
}

/** One pinch on the card's hint: the ladder opens at the fall's position, on its first step (a hint), pinned there. */
export function takeHint(s: BetaState): BetaState {
  return {...s, cameOffMove: null, hintStep: 1, hintsThisGo: s.hintsThisGo + (s.hintStep < 1 ? 1 : 0),
    pin: {at: s.here, step: 1, go: s.attempt}}
}

/**
 * A limb moved to the position `to`. The move from a pinned position uses the pin up. The idle clock restarts,
 * the card is over, and the hint is the pinned one if this is its position, else none. Session 26: `start` is
 * the go's start position; back on it after a fall or a top, a fresh go from the start begins there (as Again).
 */
export function moved(s: BetaState, now: number, to = "", start?: string): BetaState {
  const pin = s.pin && s.pin.at === s.here ? null : s.pin
  let next: BetaState = {...s, moves: s.moves + 1, hintStep: 0, cameOffMove: null, idleFrom: now, here: to, pin}
  if (!s.fromStart && start !== undefined && to === start) next = {...next, moves: 0, fellAtMoves: 0, fromStart: true}
  return pin && pin.at === to ? showPin(next) : next
}

/** the ended go's counts start afresh for the next one */
function nextGo(s: BetaState): BetaState {
  return {...s, attempt: s.attempt + 1, fellAtMoves: s.moves, hintStep: 0, hintsThisGo: 0, betaSeenThisGo: s.betaShown}
}

/** a go is under way: a move was made since the last one ended */
export function isLive(s: BetaState): boolean {
  return s.moves > s.fellAtMoves
}

/**
 * The eye went from on the wall to the mats. A fall from a go that began at the start ends that go (whatever the
 * beta); climbing on from there is "not from the start". A fall while climbing on is no new go. Either way the card
 * (beta hidden) offers the hint for the next move.
 */
export function steppedBack(s: BetaState, topped: boolean): BetaState {
  if (topped || !isLive(s)) return s
  const card = s.betaShown ? null : s.moves + 1
  if (!s.fromStart) return {...s, fellAtMoves: s.moves, hintStep: 0, cameOffMove: card}
  return {...nextGo(s), fromStart: false, cameOffMove: card}
}

/** A hand reached the top hold. From the start: the go ends (its result is read from `s` before this). Not from
 *  the start: no go ends (the fall ended it); the hints taken since stay with the next go. */
export function toppedOut(s: BetaState): BetaState {
  if (!s.fromStart) return {...s, fellAtMoves: s.moves, hintStep: 0, pin: null, cameOffMove: null}
  return {...nextGo(s), pin: null, cameOffMove: null, fromStart: false}
}

/** The view became On wall: the idle clock starts here, and the card, if unanswered, goes. */
export function arrivedOnWall(s: BetaState, now: number): BetaState {
  return {...s, cameOffMove: null, idleFrom: now}
}

/** A hand off the top climbs on: beta back to `betaDefault` (false outside tests and the demo); not from the start. */
export function newAttempt(s: BetaState, betaDefault: boolean, now: number): BetaState {
  return {...initialBeta(betaDefault, now, s.attempt, s.here), pin: s.pin, fromStart: false}
}

/**
 * "Again" (or resetAttempt): back at the start holds, `start` the position's key. A go from the start still under
 * way counts as ended (the climber stepped off). Session 26: otherwise the hints and "beta seen" taken since the
 * last go ended are the next go's, and are kept. Beta goes back to `betaDefault`; a pinned hint stays pinned to its
 * own position, and shows if that is the start.
 */
export function again(s: BetaState, betaDefault: boolean, now: number, start: string): BetaState {
  const ends = isLive(s) && s.fromStart
  const next: BetaState = {...initialBeta(betaDefault, now, ends ? s.attempt + 1 : s.attempt, start), pin: s.pin,
    hintsThisGo: ends ? 0 : s.hintsThisGo, betaSeenThisGo: betaDefault || (!ends && s.betaSeenThisGo)}
  return next.pin && next.pin.at === start ? showPin(next) : next
}

/** Session 26: the height changed. A go from the start under way ends there (as Again would), and climbing on is
 *  not from the start; otherwise nothing changes here (Main re-reads the go's number for the problem). */
export function heightChanged(s: BetaState): BetaState {
  if (!isLive(s)) return s
  if (!s.fromStart) return {...s, fellAtMoves: s.moves}
  return {...nextGo(s), fromStart: false}
}

/** A cue only: it changes no state and nothing in reveal(). */
export function cueShown(s: BetaState, c: {onWall: boolean; climbing: boolean; topped: boolean; now: number}): boolean {
  return c.climbing && c.onWall && !c.topped && !s.betaShown && s.hintStep === 0 && s.attempt > 1 &&
    s.cameOffMove === null && c.now - s.idleFrom >= CUE_SECONDS
}

/** Session 26: the came-off card's headline, and its hint button's label (two lines in an 11 cm cell) */
export function cameOffLine(_move: number): string {
  // session 28 (v7.3 P1-6): the words and the pulse agree. The pulse is on the hold the climber last reached (pulsing
  // the next move's hold would be beta); "Came off at move 3" sent them looking for move 3, a hold not yet made
  return "Came off from here"
}
export function cameOffHintLabel(move: number): string {
  // session 28: one line, in a 16 cm button (it wrapped as "Hint ·" / "move 3")
  return `Hint · move ${move}`
}

/** The step dots on "?", one per rung: "●○○" on rung 1. Session 26: kept with beta shown too (all hollow until
 *  a rung is taken), so "?" never loses its state. */
export function askDots(s: BetaState): string {
  // session 28 (v7.3 P1-7): none with the beta shown: "Why ○○○" read as a ladder not yet climbed under a word that
  // promised its third rung (S02, S10, S11); with the beta shown "?" then a ring says why, and there is no ladder
  if (s.betaShown) return ""
  return "●●●".slice(0, s.hintStep) + "○○○".slice(0, 3 - s.hintStep)
}

/** Session 26: the word under "?": what the next pinch gives. With the card up it is the card's hint; with beta
 *  shown "?" then a ring says why; hidden: Hint, then Move, then Why. */
export function askWord(s: BetaState): string {
  if (s.cameOffMove !== null) return "Hint"
  if (s.betaShown) return "Why"
  // session 28 (v7.3 P1-7): at ●●● the next pinch gives nothing new (rung 3 again): no word, not "Why"
  return s.hintStep === 0 ? "Hint" : s.hintStep === 1 ? "Move" : s.hintStep === 2 ? "Why" : ""
}

export interface Reveal {
  /** which holds get a grip-coloured ring */
  rings: "all" | "reach" | "none"
  /** the glow and the one word for the next move, with the off-view arrow that points at it */
  glow: boolean
  /** the best limb lit on the row and brightest among the markers: it names the next move */
  limb: boolean
  /** the 1-2-3 */
  steps: boolean
  /** the stick figure, On wall */
  figure: boolean
  /** the hidden read: neutral outlines and START, from the mats */
  outlines: boolean
  /** session 26: rung 3, why the move works, under its label */
  why: boolean
}

export function reveal(s: BetaState): Reveal {
  if (s.betaShown) return {rings: "all", glow: true, limb: true, steps: true, figure: true, outlines: false, why: false}
  const next = s.hintStep >= 2
  return {rings: s.hintStep >= 1 ? "reach" : "none", glow: next, limb: next, steps: false, figure: false, outlines: true, why: s.hintStep >= 3}
}

/**
 * Session 27 (P1 item 11, the climber): with beta hidden, a foot's position marker on its starting hold is beta (most
 * gym problems are "feet free"), so it shows only if the setter marked that hold as a start hold. Once the foot has
 * moved its marker shows again (it is where the body is), and with beta shown every marker shows.
 */
export function footMarkerShown(limb: string, on: string | null, startOn: string | null, isStartHold: boolean, betaShown: boolean): boolean {
  if (limb !== "LF" && limb !== "RF") return true
  if (betaShown || !on) return true
  return on !== startOn || isStartHold
}

/** The holds a hint's rings go on: those a limb can reach from here, whatever the colour. */
export function inReach<T extends {parts: {reachFactor: number}}>(result: T | null | undefined): boolean {
  return !!result && result.parts.reachFactor > 0
}

/** Which problem this is: its holds, start holds and top. A hold's type isn't part of it (a correction). */
export function problemKey(holds: string[], starts: string[], top: string | null): string {
  return holds.slice().sort().join(",") + "|" + starts.slice().sort().join(",") + "|" + (top || "")
}
