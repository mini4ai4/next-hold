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
  /** dist: from the shoulder (hand) or hip (foot); limbReach: arm or leg reach; highStep: 1 for hands */
  parts: { quality: number; reachFactor: number; balanceFactor: number; goalFactor: number; dist: number;
           limbReach: number; highStep: number };
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

// Feet (session 14): a foot does not reach like an arm. It reaches from the hip, and
// while the hands hold on, the climber pulls the hip in and up toward them for a foot
// move. So a foot can go well below the hands (a rock-over with the foot about 40 cm
// under the hands is a normal move) but not far above the hip.
//   hip       = HIP_DROP x reach below the lower hand (no hand on: the COM), at the
//               COM's x, HIP_SIDE cm to the foot's side
//   leg reach = LEG_REACH x reach from the hip, same 0.8 / 1.0 bands as an arm
//   high step = a target above the hip loses reach in a straight line, down to 0 at
//               HIGH_STEP x reach above it
// A foot's reach factor is the leg's factor x the high-step factor. Hands are unchanged.
// Everything is a share of `reach`, so it all scales with the climber's height.
export const LEG_REACH = 1.25; // 96 cm for a 175 cm climber
export const HIP_DROP = 0.5;   // 38.5 cm below the lower hand
export const HIGH_STEP = 0.35; // 27 cm above the hip is out of reach
const HIP_SIDE = 10;

export function hipOf(limb: Limb, position: Position, holds: Holds, com: Pt, reach: number): Pt {
  const hands = HANDS.map((l) => position[l]).filter((id) => id != null && holds[id]) as string[];
  const y = hands.length ? Math.min(...hands.map((id) => holds[id].y)) - HIP_DROP * reach : com.y;
  return { x: com.x + (limb === "RF" ? +HIP_SIDE : -HIP_SIDE), y };
}

export function highStepFactor(target: { y: number }, hip: Pt, reach: number): number {
  const rise = target.y - hip.y;
  if (rise <= 0) return 1.0;
  if (rise >= HIGH_STEP * reach) return 0.0;
  return 1.0 - rise / (HIGH_STEP * reach);
}

// Where the moving limb reaches from, how far it reaches, and (feet only) the high step.
export function limbReach(limb: Limb, target: Pt, position: Position, holds: Holds, com: Pt,
                          reach: number): { from: Pt; reach: number; high: number } {
  if (HANDS.indexOf(limb) >= 0) return { from: shoulderOf(limb, com), reach, high: 1.0 };
  const hip = hipOf(limb, position, holds, com, reach);
  return { from: hip, reach: LEG_REACH * reach, high: highStepFactor(target, hip, reach) };
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
  const from = on != null && holds[on] ? holds[on] : limbReach(limb, target, position, holds, com, reach).from;
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
  // hands reach from the shoulder; feet from the hip, with the high step (see limbReach)
  const lr = limbReach(limb, target, position, holds, com, reach);
  const d = dist(lr.from, target);
  const legOrArm = reachFactor(d, lr.reach);
  const rf = legOrArm * lr.high;
  const bf = balanceFactor(limb, target, position, holds, com);
  const score = quality * rf * bf;
  const gf = goalFactor(limb, target, position, holds, top, reach, com);
  const rank = score * gf;

  // human-readable "why" (shown only on ask), in capitals: "PINCH HOLD · LONG REACH".
  // The type is always written as "<TYPE> HOLD", so "pinch" can't be read as a
  // gesture instruction.
  const why: string[] = [];
  why.push(String(holdTypes[holdId] || "unmarked").toUpperCase() + " HOLD");
  if (rf === 0) why.push("OUT OF REACH");
  else if (legOrArm < 1) why.push("LONG REACH");
  if (lr.high < 1) why.push("HIGH STEP");
  if (bf < 1) why.push("COMMITTING BALANCE");

  return { holdId, limb, score, colour: colourFor(score), rank, why: why.join(" · "),
           parts: { quality, reachFactor: rf, balanceFactor: bf, goalFactor: gf, dist: d,
                    limbReach: lr.reach, highStep: lr.high } };
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
