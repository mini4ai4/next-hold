// Next Hold — scoring reference (DESIGN VALIDATION, not the Lens code).
//
// This is a pure-JS reference of the green/yellow/red rule from IDEA.md, kept
// separate so the design can be validated numerically before CLAD builds the
// Lens in Lens Studio. CLAD writes the actual Lens; this proves the rule gives
// sensible, explainable colours and that the brief's done-criteria hold.
//
// Model: the wall is a 2D plane, positions in centimetres. x = horizontal
// (0 = left edge), y = vertical (0 = floor). A "position" is which hold each of
// the four limbs is on (or null for a limb that's off the wall).

const GRIP = { jug: 1.0, pinch: 0.75, crimp: 0.6, pocket: 0.55, sloper: 0.45 };

const HANDS = ["LH", "RH"];
const FEET = ["LF", "RF"];

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// Centre of mass = average of the holds the limbs currently occupy.
function centreOfMass(position, holds) {
  const pts = [];
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
function shoulderOf(limb, com) {
  const side = limb === "RH" || limb === "RF" ? +18 : -18; // ~shoulder half-width
  const up = limb === "LH" || limb === "RH" ? 35 : -35;    // hands reach from torso top
  return { x: com.x + side, y: com.y + up };
}

// reach r = distance / climber reach.  <=0.8 comfortable, 0.8–1.0 a stretch, >1.0 none.
function reachFactor(d, reach) {
  const r = d / reach;
  if (r <= 0.8) return 1.0;
  if (r <= 1.0) return 1.0 - (r - 0.8) * 2.0; // 1.0 -> 0.6 across the stretch band
  return 0.0; // out of reach is always red
}

function balanceFactor(limb, target, position, holds, com) {
  const isHand = HANDS.includes(limb);
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

function colourFor(score) {
  if (score >= 0.7) return "green";
  if (score >= 0.4) return "yellow";
  return "red";
}

// Score one candidate hold for the limb that would move to it.
function scoreHold({ limb, holdId, holds, holdTypes, position, reach }) {
  const target = holds[holdId];
  const quality = GRIP[holdTypes[holdId]] ?? 0.5;
  const com = centreOfMass(position, holds);
  const shoulder = shoulderOf(limb, com);
  const d = dist(shoulder, target);
  const rf = reachFactor(d, reach);
  const bf = balanceFactor(limb, target, position, holds, com);
  const score = quality * rf * bf;

  // human-readable "why" (shown only on the suggested hold / on ask)
  const why = [];
  why.push(quality >= 0.9 ? "good jug" : holdTypes[holdId]);
  if (rf === 0) why.push("out of reach");
  else if (rf < 1) why.push("a long reach");
  if (bf < 1) why.push("committing balance");

  return { holdId, limb, score, colour: colourFor(score), why: why.join(", "),
           parts: { quality, reachFactor: rf, balanceFactor: bf, dist: d } };
}

// Colour every reachable candidate hold, and pick the single best next move.
function evaluate({ holds, holdTypes, position, limb, reach }) {
  const occupied = new Set([position.LH, position.RH, position.LF, position.RF]);
  const results = Object.keys(holds)
    .filter((id) => !occupied.has(id))
    .map((holdId) => scoreHold({ limb, holdId, holds, holdTypes, position, reach }));
  const best = results.reduce((b, r) => (r.score > (b?.score ?? -1) ? r : b), null);
  return { results, suggestion: best && best.score > 0 ? best : null };
}

module.exports = { GRIP, reachFactor, balanceFactor, colourFor, scoreHold, evaluate };
