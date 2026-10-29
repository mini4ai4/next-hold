// NextHoldScoring — the green / yellow / red rule and the upward goal, ported
// line-for-line from devpost/scoring-reference/scoring.js. Same constants, same
// "why" strings. Adds bestMove(): evaluate() for all four limbs, return the
// single best (limb, hold) by rank.
//
// Owns: pure scoring maths only. No Lens globals, no scene access, so it can
// be unit-checked outside Lens Studio (tests/scoring.port.test.mjs).
// Must not: touch SceneObjects, materials, or UI.
//
// Model: the wall is a 2D plane, positions in centimetres. x = horizontal
// (0 = left edge), y = vertical (0 = floor). A "position" is which hold each
// of the four limbs is on (or null for a limb that's off the wall).

export type Limb = "LH" | "RH" | "LF" | "RF";
export type Colour = "green" | "yellow" | "red";
export interface Pt { x: number; y: number; }
export type Holds = { [id: string]: Pt };
export type HoldTypes = { [id: string]: string };
export type Position = { LH: string | null; RH: string | null; LF: string | null; RF: string | null };

export interface ScoreResult {
  holdId: string;
  limb: Limb;
  /** grip x reach x balance: decides the colour */
  score: number;
  colour: Colour;
  /** score x goalFactor: decides the suggestion */
  rank: number;
  why: string;
  parts: { quality: number; reachFactor: number; balanceFactor: number; goalFactor: number; dist: number };
}

export interface Evaluation {
  results: ScoreResult[];
  suggestion: ScoreResult | null;
}

export const GRIP: { [type: string]: number } = { jug: 1.0, pinch: 0.75, crimp: 0.6, pocket: 0.55, sloper: 0.45 };

export const HANDS: Limb[] = ["LH", "RH"];
export const FEET: Limb[] = ["LF", "RF"];
export const LIMBS: Limb[] = ["LH", "RH", "LF", "RF"];

function dist(a: Pt, b: Pt): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// Centre of mass = average of the holds the limbs currently occupy.
export function centreOfMass(position: Position, holds: Holds): Pt {
  const pts: Pt[] = [];
  for (const limb of [...HANDS, ...FEET]) {
    const id = position[limb];
    if (id != null && holds[id]) pts.push(holds[id]);
  }
  if (pts.length === 0) return { x: 120, y: 100 }; // mid-wall fallback
  return {
    x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
    y: pts.reduce((s, p) => s + p.y, 0) / pts.length,
  };
}

// Shoulder of the moving limb ≈ COM shifted up into the torso and to that side.
export function shoulderOf(limb: Limb, com: Pt): Pt {
  const side = limb === "RH" || limb === "RF" ? +18 : -18; // ~shoulder half-width
  const up = limb === "LH" || limb === "RH" ? 35 : -35;    // hands reach from torso top
  return { x: com.x + side, y: com.y + up };
}

// reach r = distance / climber reach.  <=0.8 comfortable, 0.8–1.0 a stretch, >1.0 none.
export function reachFactor(d: number, reach: number): number {
  const r = d / reach;
  if (r <= 0.8) return 1.0;
  if (r <= 1.0) return 1.0 - (r - 0.8) * 2.0; // 1.0 -> 0.6 across the stretch band
  return 0.0; // out of reach is always red
}

export function balanceFactor(limb: Limb, target: Pt, position: Position, holds: Holds, com: Pt): number {
  const isHand = HANDS.indexOf(limb) >= 0;
  let f = 1.0;
  if (isHand) {
    const bothFeet = position.LF != null && position.RF != null;
    if (!bothFeet) f *= 0.6;              // a hand move with a foot off is committing
    if (target.y <= com.y) f *= 0.75;     // pulling up above the COM is steadier
    // crossing the body line (RH going left of the left hand, or vice versa) costs
    const otherHand = limb === "RH" ? position.LH : position.RH;
    if (otherHand != null && holds[otherHand]) {
      const mid = holds[otherHand].x;
      const crosses = limb === "RH" ? target.x < mid : target.x > mid;
      if (crosses) f *= 0.6;
    }
  } else {
    // a foot move is low-risk as long as the hands are on
    const bothHands = position.LH != null && position.RH != null;
    if (!bothHands) f *= 0.7;
  }
  return f;
}

// Goal: among moves of similar quality, the hold that gets you higher and closer
// to the problem's top hold ranks better.
//   progress = (height gained + distance to the top saved) / (2 x reach), in -1..1
//   goalFactor = 0.75 + 0.25 x progress            (0.5 = a full move away, 1 = a full move up)
// "From" is the hold the moving limb is on now (its anchor if it is off the wall).
// No top hold -> 1. The goal only ranks moves: it never changes the colour, which
// stays grip x reach x balance, so an out-of-reach hold is still score 0 -> red,
// and it ranks last (rank = score x goalFactor = 0).
export const GOAL_WEIGHT = 0.25;

export function goalFactor(limb: Limb, target: Pt, position: Position, holds: Holds, top: string | null,
                           reach: number, com: Pt): number {
  if (top == null || !holds[top]) return 1.0;
  const on = position[limb];
  const from = on != null && holds[on] ? holds[on] : shoulderOf(limb, com);
  const t = holds[top];
  const gained = (target.y - from.y) + (dist(from, t) - dist(target, t));
  const progress = Math.max(-1, Math.min(1, gained / (2 * reach)));
  return 1.0 - GOAL_WEIGHT + GOAL_WEIGHT * progress;
}

export function colourFor(score: number): Colour {
  if (score >= 0.7) return "green";
  if (score >= 0.4) return "yellow";
  return "red";
}

export interface ScoreArgs {
  limb: Limb;
  holdId: string;
  holds: Holds;
  holdTypes: HoldTypes;
  position: Position;
  reach: number;
  /** the problem's top hold; null/absent = no goal (goalFactor 1) */
  top?: string | null;
}

// Score one candidate hold for the limb that would move to it.
// score (-> colour) = grip x reach x balance; rank (-> the suggestion) = score x goal.
export function scoreHold(a: ScoreArgs): ScoreResult {
  const { limb, holdId, holds, holdTypes, position, reach } = a;
  const top = a.top ?? null;
  const target = holds[holdId];
  const quality = GRIP[holdTypes[holdId]] ?? 0.5;
  const com = centreOfMass(position, holds);
  const shoulder = shoulderOf(limb, com);
  const d = dist(shoulder, target);
  const rf = reachFactor(d, reach);
  const bf = balanceFactor(limb, target, position, holds, com);
  const score = quality * rf * bf;
  const gf = goalFactor(limb, target, position, holds, top, reach, com);
  const rank = score * gf;

  // human-readable "why" (shown only on the suggested hold / on ask)
  const why: string[] = [];
  why.push(quality >= 0.9 ? "good jug" : holdTypes[holdId]);
  if (rf === 0) why.push("out of reach");
  else if (rf < 1) why.push("a long reach");
  if (bf < 1) why.push("committing balance");

  return { holdId, limb, score, colour: colourFor(score), rank, why: why.join(", "),
           parts: { quality, reachFactor: rf, balanceFactor: bf, goalFactor: gf, dist: d } };
}

export interface EvaluateArgs {
  holds: Holds;
  holdTypes: HoldTypes;
  position: Position;
  limb: Limb;
  reach: number;
  top?: string | null;
}

// Colour every reachable candidate hold, and pick the single best next move (by rank).
export function evaluate(a: EvaluateArgs): Evaluation {
  const { holds, holdTypes, position, limb, reach } = a;
  const top = a.top ?? null;
  const occupied = new Set<string | null>([position.LH, position.RH, position.LF, position.RF]);
  const results = Object.keys(holds)
    .filter((id) => !occupied.has(id))
    .map((holdId) => scoreHold({ limb, holdId, holds, holdTypes, position, reach, top }));
  const best = results.reduce<ScoreResult | null>((b, r) => (r.rank > (b?.rank ?? -1) ? r : b), null);
  return { results, suggestion: best && best.score > 0 ? best : null };
}

export interface MoveArgs {
  holds: Holds;
  holdTypes: HoldTypes;
  position: Position;
  reach: number;
  top?: string | null;
}

// Addition on top of the reference: run evaluate() for all four limbs and
// return the single best (limb, hold) by rank. Ties keep the earlier limb in
// LH, RH, LF, RF order. null when no limb has a hold with score > 0.
export function bestMove(a: MoveArgs): ScoreResult | null {
  let best: ScoreResult | null = null;
  for (const limb of LIMBS) {
    const s = evaluate({ holds: a.holds, holdTypes: a.holdTypes, position: a.position, limb, reach: a.reach, top: a.top }).suggestion;
    if (s && s.rank > (best?.rank ?? -1)) best = s;
  }
  return best;
}

// Sequence preview: a small look-ahead over bestMove. Step 1 is the move
// suggested now (for `limb` if given: the selected limb's best, the glowing
// ring; otherwise bestMove). Each later step is bestMove from the position the
// earlier steps leave, leaving out moves that only undo an earlier step (a limb
// going back to a hold it left in this look-ahead). It ends after a hand
// reaches the top hold, or when no move is left.
export function sequence(a: MoveArgs & { limb?: Limb | null; steps?: number }): ScoreResult[] {
  const steps = a.steps ?? 3;
  const out: ScoreResult[] = [];
  let position: Position = { ...a.position };
  const left: { [limb: string]: string[] } = { LH: [], RH: [], LF: [], RF: [] };
  for (let i = 0; i < steps; i++) {
    // bestMove (same order, same tie rule), without the undo moves
    let m: ScoreResult | null = null;
    for (const limb of i === 0 && a.limb ? [a.limb] : LIMBS) {
      const ev = evaluate({ holds: a.holds, holdTypes: a.holdTypes, position, limb, reach: a.reach, top: a.top });
      for (const r of ev.results) {
        if (r.score > 0 && left[limb].indexOf(r.holdId) < 0 && r.rank > (m?.rank ?? -1)) m = r;
      }
    }
    if (!m) break;
    out.push(m);
    const from = position[m.limb];
    if (from != null) left[m.limb].push(from);
    position = { ...position, [m.limb]: m.holdId };
    if (a.top != null && m.holdId === a.top && HANDS.indexOf(m.limb) >= 0) break;
  }
  return out;
}
