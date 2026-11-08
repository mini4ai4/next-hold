// NextHoldPlan — the glow follows the plan (v7.2, session 26), and what rung 3 says about the move.
//
// Plain code with no Lens globals, unit-checked in Node (tests/scoring.port.test.mjs). It only calls functions
// NextHoldScoring already exports (bestMove, routeToTop, fullRoute, sequence); the scoring core is unchanged.
//
// Before: the glow was bestMove (the surest single move by rank), re-picked at every position, and par was the
// shortest secure route from the start. They disagreed: at 7 of 11 heights a climber who followed the glow made
// one move more than par (after LF to lh the glow preferred the surer RF to rh over the top-out). Now the glow
// stays the greedy best while it lies on a shortest route from here (the greedy move plus the shortest route after
// it is no longer than the shortest route); only when following it would cost a move does the glow become the
// first move of the shortest route. Following the glow then takes par moves at every height, and the opening glow
// (RH to up) is unchanged. The 1-2-3 is the plan's first three moves.

import {type MoveArgs, type ScoreResult, HANDS, bestMove, fullRoute, routeToTop, sequence} from "./NextHoldScoring"

export interface Plan {
  /** the move the glow shows; null if no limb has a move */
  glow: ScoreResult | null
  /** the 1-2-3 from here (step 1 is the glow) */
  steps: ScoreResult[]
  /** true when the glow is the shortest route's first move because the greedy best would cost a move */
  planned: boolean
}

export function plan(a: MoveArgs): Plan {
  const greedy = bestMove(a)
  if (!greedy) return {glow: null, steps: [], planned: false}
  const route = routeToTop(a)
  const viaGreedy = fullRoute(a)
  if (route && route.length && (!viaGreedy || viaGreedy.length > route.length)) {
    return {glow: route[0], steps: route.slice(0, 3), planned: true}
  }
  return {glow: greedy, steps: sequence({...a, limb: greedy.limb}), planned: false}
}

/**
 * Rung 3 (session 26): why the move works, in a few words, merged into the move's label ("R hand" over
 * "jug, in reach"). The hold's grip, then the one reason that matters most: it is the top; it saves a move
 * (the plan's move where the surer one costs a move); a high step; a stretch; a committing move; else in reach.
 * Session 28 (v7.3 P1-3): "in reach" is what the green ring already says, so it is never the why: when nothing else
 * applies, the plan's next move says what this one is for ("sets up LH to the pinch", "sets up LH to the top");
 * `next` is that step (the plan's second move) with its hold's type, or null at the end of the plan.
 */
export function moveWhy(m: ScoreResult, holdType: string | null | undefined, planned: boolean, top: string | null | undefined,
    next: {limb: string; holdId: string; holdType: string | null | undefined} | null = null): string {
  const grip = holdType ? holdType : "hold"
  const topOut = top != null && m.holdId === top && (m.limb === "LH" || m.limb === "RH")
  const reason = topOut ? "the top"
    : planned ? "saves a move"
    : m.parts.highStep < 1 ? "high step"
    : m.parts.reachFactor < 1 ? "a stretch"
    : m.parts.balanceFactor < 1 ? "committing"
    : next ? `sets up ${next.limb} to the ${top != null && next.holdId === top ? "top" : next.holdType || "next hold"}`
    : "in reach"
  return `${grip}, ${reason}`
}

/**
 * v8 change 2 (session 29): where a go left the shortest. `positions[0]` is the go's start, `positions[k]` the
 * position after move k; `distTo(p)` is the number of moves of the shortest secure route to the top from p (0 when a
 * hand is already on the top, Infinity when the search found none: unknown, skipped). The split is the first move that doesn't bring the
 * top at least one move closer: the first k with distTo(positions[k]) >= distTo(positions[k-1]). That holds against
 * any shortest route, not just the one the planner prints (shortest routes aren't unique, and a climber on another
 * one must not be told they left it). null when every move brought the top closer (at par there is never a split;
 * over par there always is one).
 */
export function splitMove<T>(positions: T[], distTo: (p: T) => number): number | null {
  // session 31 (CHANGES_V8_FIX1 item 4): Infinity is "the search gave up" (its 6,000-position cap, or past 8 moves), not a
  // dead end (a go that topped out from there had a secure route), so it is unknown: no move into or out of such a
  // position is judged, and it is never the split. With nothing judged the card says "shortest for you: N".
  let prev = NaN
  for (let k = 0; k < positions.length; k++) {
    const d = distTo(positions[k])
    if (!isFinite(d)) { prev = NaN; continue }
    if (k > 0 && isFinite(prev) && !(d < prev)) return k
    prev = d
  }
  return null
}

/** v8: the moves of the shortest secure route to the top from `a.position`: 0 when a hand is already on the top
 *  (routeToTop from a topped position plans a new climb and says 2), Infinity when there is none */
export function routeDist(a: MoveArgs): number {
  if (a.top != null && HANDS.some((l) => a.position[l] === a.top)) return 0
  const r = routeToTop(a)
  return r ? r.length : Infinity
}
