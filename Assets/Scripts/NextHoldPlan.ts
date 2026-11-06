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

import {type MoveArgs, type ScoreResult, bestMove, fullRoute, routeToTop, sequence} from "./NextHoldScoring"

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
