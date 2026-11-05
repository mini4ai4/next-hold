// NextHoldBeta — beta on request (v7 part A, session 23): what the climber is shown, and when.
//
// A plain state machine with no Lens globals, no scene access and no scoring, so it is unit-checked
// outside Lens Studio (tests/scoring.port.test.mjs). NextHoldMain owns one BetaState, calls these
// functions on each event and draws what reveal() allows. The scoring core doesn't know any of this:
// the colours, the suggestion and the 1-2-3 are worked out as before, and only what is shown changes.
//
// betaShown false (the default): from the mats the problem's holds show a neutral outline with START
// and TOP; on the wall only the four position markers. "Show my beta" sets it: the full v6 read.
// The hint ladder, each step on request with "?": (1) grip-coloured rings on the holds in reach,
// (2) the glow and the one word for the next move, (3) "?" arms, as it always has, and the next pinch
// on a ring shows its why-line, one-shot. A move ends the hint: the next position starts from nothing.
//
// Came off: the eye was on the wall and steps back to the mats, with beta hidden, below the top and
// with a move made since the last time. It ends the attempt and offers the hint at that position,
// which stays as it was: N is the move the climber was going for (moves made + 1).
// With beta shown, stepping back isn't a came-off: nothing is hidden, so there is nothing to offer,
// and the plan moves on with you as in v6.

export type HintStep = 0 | 1 | 2 | 3

export interface BetaState {
  betaShown: boolean
  hintStep: HintStep
  /** 1 until an attempt has ended: the cue doesn't show before that */
  attempt: number
  /** moves made since this attempt's position was last the start */
  moves: number
  /** the move a came-off offers a hint for while its card is up; null = no card */
  cameOffMove: number | null
  /** `moves` when the climber last came off: the same fall isn't counted twice */
  fellAtMoves: number
  /** the time the idle clock runs from: the last move, or arriving on the wall */
  idleFrom: number
}

export const CUE_SECONDS = 20
export const CUE_TEXT = "? for a hint"

export function initialBeta(betaShown: boolean, now: number): BetaState {
  return {betaShown, hintStep: 0, attempt: 1, moves: 0, cameOffMove: null, fellAtMoves: 0, idleFrom: now}
}

/** "Show my beta": the full read. It also answers the card, if one is up. */
export function showBeta(s: BetaState): BetaState {
  return {...s, betaShown: true, cameOffMove: null}
}

/**
 * A pinch on "?". `armed`: is "?" armed now. Returns the new state and whether it is armed after this.
 * With the card up: the same as pinching the card. Beta hidden: step 1, step 2, then step 3, which arms
 * it. Otherwise it toggles as it always has. Topped out with beta hidden there is no next move to hint.
 */
export function ask(s: BetaState, armed: boolean, topped: boolean): {state: BetaState; armed: boolean} {
  if (s.cameOffMove !== null) return {state: takeHint(s), armed: false}
  if (s.betaShown) return {state: s, armed: !armed}
  if (topped) return {state: s, armed: false}
  if (s.hintStep === 0) return {state: {...s, hintStep: 1}, armed: false}
  if (s.hintStep === 1) return {state: {...s, hintStep: 2}, armed: false}
  if (s.hintStep === 2) return {state: {...s, hintStep: 3}, armed: true}
  return {state: s, armed: !armed}
}

/** One pinch on the card: the ladder opens at the fall's position, on its first step. */
export function takeHint(s: BetaState): BetaState {
  return {...s, cameOffMove: null, hintStep: 1}
}

/** A limb moved: the idle clock restarts, the hint and any card are over. */
export function moved(s: BetaState, now: number): BetaState {
  return {...s, moves: s.moves + 1, hintStep: 0, cameOffMove: null, idleFrom: now}
}

/** The eye went from on the wall to the mats. Came off, or nothing changes (see the header). */
export function steppedBack(s: BetaState, topped: boolean): BetaState {
  if (s.betaShown || topped || s.moves <= s.fellAtMoves) return s
  return {...s, attempt: s.attempt + 1, hintStep: 0, cameOffMove: s.moves + 1, fellAtMoves: s.moves}
}

/** The view became On wall: the idle clock starts here, and the card, if unanswered, goes. */
export function arrivedOnWall(s: BetaState, now: number): BetaState {
  return {...s, cameOffMove: null, idleFrom: now}
}

/** A new attempt: betaShown goes back to `betaDefault` (false, outside tests and the demo). */
export function newAttempt(s: BetaState, betaDefault: boolean, now: number): BetaState {
  return {...initialBeta(betaDefault, now), attempt: s.attempt + 1}
}

/** A cue only: it changes no state and nothing in reveal(). */
export function cueShown(s: BetaState, c: {onWall: boolean; climbing: boolean; topped: boolean; now: number}): boolean {
  return c.climbing && c.onWall && !c.topped && !s.betaShown && s.hintStep === 0 && s.attempt > 1 &&
    s.cameOffMove === null && c.now - s.idleFrom >= CUE_SECONDS
}

export function cameOffLine(move: number): string {
  return `Came off at move ${move}. Hint for that move?`
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
