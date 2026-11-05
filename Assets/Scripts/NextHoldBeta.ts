// NextHoldBeta — beta on request (v7 part A, session 23; goes and pinned hints, session 24): what the
// climber is shown, and when.
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
// (2) the glow and the one word for the next move, (3) that move's why-line, shown at once (session 24:
// no extra pinch on a ring). A move ends the hint: the next position starts from nothing.
//
// A go (session 24): it ends at the top or at a fall. Every fall counts as a go, beta shown or not; only
// the card is skipped with beta shown, as there is nothing hidden to offer. Each go records the hints
// taken (rungs 2 and 3, the ones that name the move) and whether the beta was seen, and B's ONSIGHT /
// FLASH / SEND is worked out from that (NextHoldAttempt.tickFor).
//
// Came off: the eye was on the wall and steps back to the mats, below the top and with a move made
// since the last time. The card offers the hint at that position, which stays as it was: N is the move
// the climber was going for (moves made + 1). A hint taken there is pinned to that position: it shows
// again whenever the climber is back there (after Again, say), and goes once the move from there is made.

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
  /** session 24, this go: the hints taken (rungs 2 and 3) */
  hintsThisGo: number
  /** session 24, this go: the beta was shown at some point */
  betaSeenThisGo: boolean
  /** session 24: a hint taken after a fall, pinned to the position it was taken at, and how far up the ladder */
  pin: {at: string; step: HintStep} | null
  /** session 24: the current position, as a key (the pin is matched against it) */
  here: string
}

export const CUE_SECONDS = 20
export const CUE_TEXT = "? for a hint"

export function initialBeta(betaShown: boolean, now: number, attempt = 1, here = ""): BetaState {
  return {betaShown, hintStep: 0, attempt, moves: 0, cameOffMove: null, fellAtMoves: 0, idleFrom: now,
    hintsThisGo: 0, betaSeenThisGo: betaShown, pin: null, here}
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

/** the ladder's step after `from`, and whether it is a hint that names the move (rungs 2 and 3) */
function climb(s: BetaState, step: HintStep): BetaState {
  const counted = step >= 2 && step > s.hintStep
  const pin = s.pin && s.pin.at === s.here ? {at: s.pin.at, step} : s.pin
  return {...s, hintStep: step, hintsThisGo: s.hintsThisGo + (counted ? 1 : 0), pin}
}

/**
 * A pinch on "?". `armed`: is "?" armed now. Returns the new state, whether it is armed after this, and
 * whether the next move's why-line is to show now (rung 3). With the card up: the same as pinching the
 * card. Beta hidden: step 1, step 2, step 3 (the why-line, at once; again on each further pinch). Beta
 * shown: it arms and disarms as in v6. Topped out with beta hidden there is no next move to hint.
 */
export function ask(s: BetaState, armed: boolean, topped: boolean): {state: BetaState; armed: boolean; why: boolean} {
  if (s.cameOffMove !== null) return {state: takeHint(s), armed: false, why: false}
  if (s.betaShown) return {state: s, armed: !armed, why: false}
  if (topped) return {state: s, armed: false, why: false}
  const step = Math.min(3, s.hintStep + 1) as HintStep
  return {state: climb(s, step), armed: false, why: step === 3}
}

/** One pinch on the card: the ladder opens at the fall's position, on its first step, pinned there. */
export function takeHint(s: BetaState): BetaState {
  return {...s, cameOffMove: null, hintStep: 1, pin: {at: s.here, step: 1}}
}

/** A limb moved to the position `to`. The move from a pinned position uses the pin up. The idle clock
 *  restarts, the card is over, and the hint is the pinned one if this is its position, else none. */
export function moved(s: BetaState, now: number, to = ""): BetaState {
  const pin = s.pin && s.pin.at === s.here ? null : s.pin
  const hintStep: HintStep = pin && pin.at === to ? pin.step : 0
  return {...s, moves: s.moves + 1, hintStep, cameOffMove: null, idleFrom: now, here: to, pin}
}

/** the ended go's counts start afresh for the next one */
function nextGo(s: BetaState): BetaState {
  return {...s, attempt: s.attempt + 1, fellAtMoves: s.moves, hintStep: 0, hintsThisGo: 0, betaSeenThisGo: s.betaShown}
}

/** a go is under way: a move was made since the last one ended */
export function isLive(s: BetaState): boolean {
  return s.moves > s.fellAtMoves
}

/** The eye went from on the wall to the mats. A fall ends the go (whatever the beta), or nothing changes. */
export function steppedBack(s: BetaState, topped: boolean): BetaState {
  if (topped || !isLive(s)) return s
  return {...nextGo(s), cameOffMove: s.betaShown ? null : s.moves + 1}
}

/** A hand reached the top hold: the go ends (its result is read from `s` before this). */
export function toppedOut(s: BetaState): BetaState {
  return {...nextGo(s), pin: null, cameOffMove: null}
}

/** The view became On wall: the idle clock starts here, and the card, if unanswered, goes. */
export function arrivedOnWall(s: BetaState, now: number): BetaState {
  return {...s, cameOffMove: null, idleFrom: now}
}

/** A hand off the top climbs on: a new go, with betaShown back to `betaDefault` (false outside tests and the demo). */
export function newAttempt(s: BetaState, betaDefault: boolean, now: number): BetaState {
  return {...initialBeta(betaDefault, now, s.attempt, s.here), pin: s.pin}
}

/**
 * "Again" (or resetAttempt): back at the start holds, `start` the position's key. A go still under way
 * counts as ended (the climber stepped off). Beta goes back to `betaDefault`; a pinned hint stays pinned
 * to its own position, and shows if that is the start.
 */
export function again(s: BetaState, betaDefault: boolean, now: number, start: string): BetaState {
  const attempt = isLive(s) ? s.attempt + 1 : s.attempt
  const pin = s.pin
  return {...initialBeta(betaDefault, now, attempt, start), pin, hintStep: pin && pin.at === start ? pin.step : 0}
}

/** A cue only: it changes no state and nothing in reveal(). */
export function cueShown(s: BetaState, c: {onWall: boolean; climbing: boolean; topped: boolean; now: number}): boolean {
  return c.climbing && c.onWall && !c.topped && !s.betaShown && s.hintStep === 0 && s.attempt > 1 &&
    s.cameOffMove === null && c.now - s.idleFrom >= CUE_SECONDS
}

export function cameOffLine(move: number): string {
  return `Came off at move ${move}. Hint for that move?`
}

/** Session 24: the step dots on "?", one per rung: "●○○" on rung 1. Empty with beta shown (no ladder). */
export function askDots(s: BetaState): string {
  if (s.betaShown) return ""
  return "●●●".slice(0, s.hintStep) + "○○○".slice(0, 3 - s.hintStep)
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
}

export function reveal(s: BetaState): Reveal {
  if (s.betaShown) return {rings: "all", glow: true, limb: true, steps: true, figure: true, outlines: false}
  const next = s.hintStep >= 2
  return {rings: s.hintStep >= 1 ? "reach" : "none", glow: next, limb: next, steps: false, figure: false, outlines: true}
}

/** The holds a hint's rings go on: those a limb can reach from here, whatever the colour. */
export function inReach<T extends {parts: {reachFactor: number}}>(result: T | null | undefined): boolean {
  return !!result && result.parts.reachFactor > 0
}

/** Which problem this is: its holds, start holds and top. A hold's type isn't part of it (a correction). */
export function problemKey(holds: string[], starts: string[], top: string | null): string {
  return holds.slice().sort().join(",") + "|" + starts.slice().sort().join(",") + "|" + (top || "")
}
