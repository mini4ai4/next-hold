// NextHoldScoring — the green / yellow / red rule, ported line-for-line from
// devpost/scoring-reference/scoring.js (11/11 checks). Same constants, same
// "why" strings. Adds bestMove(): evaluate() for all four limbs, return the
// single best (limb, hold).
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
  score: number;
  colour: Colour;
  why: string;
  parts: { quality: number; reachFactor: number; balanceFactor: number; dist: number };
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
}

// Score one candidate hold for the limb that would move to it.
export function scoreHold(a: ScoreArgs): ScoreResult {
  const { limb, holdId, holds, holdTypes, position, reach } = a;
  const target = holds[holdId];
  const quality = GRIP[holdTypes[holdId]] ?? 0.5;
  const com = centreOfMass(position, holds);
  const shoulder = shoulderOf(limb, com);
  const d = dist(shoulder, target);
  const rf = reachFactor(d, reach);
  const bf = balanceFactor(limb, target, position, holds, com);
  const score = quality * rf * bf;

  // human-readable "why" (shown only on the suggested hold / on ask)
  const why: string[] = [];
  why.push(quality >= 0.9 ? "good jug" : holdTypes[holdId]);
  if (rf === 0) why.push("out of reach");
  else if (rf < 1) why.push("a long reach");
  if (bf < 1) why.push("committing balance");

  return { holdId, limb, score, colour: colourFor(score), why: why.join(", "),
           parts: { quality, reachFactor: rf, balanceFactor: bf, dist: d } };
}

export interface EvaluateArgs {
  holds: Holds;
  holdTypes: HoldTypes;
  position: Position;
  limb: Limb;
  reach: number;
}

// Colour every reachable candidate hold, and pick the single best next move.
export function evaluate(a: EvaluateArgs): Evaluation {
  const { holds, holdTypes, position, limb, reach } = a;
  const occupied = new Set<string | null>([position.LH, position.RH, position.LF, position.RF]);
  const results = Object.keys(holds)
    .filter((id) => !occupied.has(id))
    .map((holdId) => scoreHold({ limb, holdId, holds, holdTypes, position, reach }));
  const best = results.reduce<ScoreResult | null>((b, r) => (r.score > (b?.score ?? -1) ? r : b), null);
  return { results, suggestion: best && best.score > 0 ? best : null };
}

// Addition on top of the reference: run evaluate() for all four limbs and
// return the single best (limb, hold) by score. Ties keep the earlier limb in
// LH, RH, LF, RF order. null when no limb has a hold with score > 0.
export function bestMove(a: { holds: Holds; holdTypes: HoldTypes; position: Position; reach: number }): ScoreResult | null {
  let best: ScoreResult | null = null;
  for (const limb of LIMBS) {
    const s = evaluate({ holds: a.holds, holdTypes: a.holdTypes, position: a.position, limb, reach: a.reach }).suggestion;
    if (s && s.score > (best?.score ?? -1)) best = s;
  }
  return best;
}
