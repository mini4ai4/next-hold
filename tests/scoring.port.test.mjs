// Unit check for the TypeScript port (Assets/Scripts/NextHoldScoring.ts).
// Run from the project root:  node tests/scoring.port.test.mjs
// (Node 22.6+ strips the TS types natively.)
//
// 1. Re-runs the reference checks from devpost/scoring-reference (colour rule and
//    upward goal) against the port.
// 2. Equivalence: port == reference for every hold x every limb x several top holds on the Lens wall.
// 3. bestMove(): returns the max-rank (limb, hold) across all four limbs.
// 4. Demo layout: the preset problem shows green, yellow and red from the start.
// 5. sequence(): the 1-2-3 behind the glow and the "2 · LH" tags, a search over limbs and holds for
//    the cheapest secure route to the top, checked against a brute force over every route, and
//    at 155 vs 195 cm (two heights, two betas).
// 6. Beta on request (Assets/Scripts/NextHoldBeta.ts): what is shown and when; the hint ladder, the
//    cue, came off; the hint's rings against the rule over every state a pinch can reach.
import { createRequire } from "node:module";
import * as P from "../Assets/Scripts/NextHoldScoring.ts";
import * as B from "../Assets/Scripts/NextHoldBeta.ts";
import { HOLDS, PRESET_POSITION, PRESET_PROBLEM, PRESET_START, PRESET_TOP, CLIMBER_REACH } from "../Assets/Scripts/Wall/WallLayout.ts";

const require = createRequire(import.meta.url);
const R = require("../devpost/scoring-reference/scoring.js");

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log("  ok  " + name); }
  else { fail++; console.log(" FAIL " + name + (extra ? "  -> " + JSON.stringify(extra) : "")); }
}

// ---- 1. the reference's 11 checks, against the port -------------------------
const REACH = 77;
const holds = {
  lf: { x: 95, y: 40 }, rf: { x: 145, y: 45 },
  lh: { x: 90, y: 150 }, rh: { x: 150, y: 150 },
  up: { x: 140, y: 190 }, far: { x: 250, y: 215 },
  side: { x: 35, y: 150 }, low: { x: 150, y: 95 },
};
const holdTypes = { lf: "jug", rf: "jug", lh: "jug", rh: "jug", up: "jug", far: "jug", side: "crimp", low: "sloper" };
const position = { LH: "lh", RH: "rh", LF: "lf", RF: "rf" };

const upRes = P.scoreHold({ limb: "RH", holdId: "up", holds, holdTypes, position, reach: REACH });
check("jug in reach, feet planted, above COM -> green", upRes.colour === "green", upRes);
const farRes = P.scoreHold({ limb: "RH", holdId: "far", holds, holdTypes, position, reach: REACH });
check("out-of-reach hold -> red", farRes.colour === "red" && farRes.parts.reachFactor === 0, farRes);
const sideRes = P.scoreHold({ limb: "RH", holdId: "side", holds, holdTypes, position, reach: REACH });
check("cross-body crimp -> not green", sideRes.colour !== "green", sideRes);
const oneFoot = { ...position, RF: null };
const lowRes = P.scoreHold({ limb: "RH", holdId: "low", holds, holdTypes, position: oneFoot, reach: REACH });
check("sloper below COM, foot off -> red", lowRes.colour === "red", lowRes);
check("reachFactor comfortable (0.5R) = 1.0", P.reachFactor(0.5 * REACH, REACH) === 1.0);
check("reachFactor at 100% = 0.6", Math.abs(P.reachFactor(REACH, REACH) - 0.6) < 1e-9);
check("reachFactor beyond = 0", P.reachFactor(1.3 * REACH, REACH) === 0);
check("colour thresholds", P.colourFor(0.7) === "green" && P.colourFor(0.4) === "yellow" && P.colourFor(0.39) === "red");
const ev = P.evaluate({ holds, holdTypes, position, limb: "RH", reach: REACH });
check("every candidate hold gets one colour", ev.results.every((r) => ["green", "yellow", "red"].includes(r.colour)));
check("a best next move is suggested and in reach", ev.suggestion && ev.suggestion.score > 0, ev.suggestion);
check("suggestion is the jug 'up'", ev.suggestion && ev.suggestion.holdId === "up", ev.suggestion);
// the reference's upward-goal checks, against the port
check("no top hold: goalFactor 1, rank = score", upRes.parts.goalFactor === 1 && upRes.rank === upRes.score, upRes);
const gHolds = { ...holds, hiJug: { x: 165, y: 175 }, loJug: { x: 165, y: 125 }, top: { x: 150, y: 280 } };
const gTypes = { ...holdTypes, hiJug: "jug", loJug: "jug", top: "jug" };
const hi = P.scoreHold({ limb: "RH", holdId: "hiJug", holds: gHolds, holdTypes: gTypes, position, reach: REACH, top: "top" });
const lo = P.scoreHold({ limb: "RH", holdId: "loJug", holds: gHolds, holdTypes: gTypes, position, reach: REACH, top: "top" });
check("same-grip jugs: equal score, the higher one nearer the top ranks better", hi.score === lo.score && hi.rank > lo.rank);
check("the goal never changes the colour (both jugs stay green)", hi.colour === "green" && lo.colour === "green");
const gEv = P.evaluate({ holds: gHolds, holdTypes: gTypes, position, limb: "RH", reach: REACH, top: "top" });
const gRank = {};
for (const r of gEv.results) gRank[r.holdId] = r.rank;
check("with a top hold, green jugs rank by height: up > hiJug > loJug, suggestion up",
  gRank.up > gRank.hiJug && gRank.hiJug > gRank.loJug && gEv.suggestion && gEv.suggestion.holdId === "up", gRank);
check("colour is still grip x reach x balance for every hold", gEv.results.every((r) => r.colour === P.colourFor(r.score)));
check("goalFactor stays within 0.5..1", gEv.results.every((r) => r.parts.goalFactor >= 0.5 && r.parts.goalFactor <= 1));
const farTop = P.scoreHold({ limb: "RH", holdId: "far", holds, holdTypes, position, reach: REACH, top: "far" });
check("out of reach stays red and ranks 0, even as the top hold",
  farTop.colour === "red" && farTop.score === 0 && farTop.rank === 0 && farTop.parts.goalFactor > 0.75, farTop);
// the reference's why-wording checks, against the port
check("why for a jug in comfortable reach: \"JUG HOLD\"", upRes.why === "JUG HOLD", upRes.why);
const pinRes = P.scoreHold({ limb: "RH", holdId: "pin", holds: { ...holds, pin: { x: 138, y: 201 } },
  holdTypes: { ...holdTypes, pin: "pinch" }, position, reach: REACH });
check("why for a pinch at a stretch: \"PINCH HOLD · LONG REACH\"", pinRes.why === "PINCH HOLD · LONG REACH", pinRes.why);
check("why for the far cross-body crimp: \"CRIMP HOLD · OUT OF REACH · COMMITTING BALANCE\"",
  sideRes.why === "CRIMP HOLD · OUT OF REACH · COMMITTING BALANCE", sideRes.why);
const WHY_FORM = /^[A-Z]+ HOLD( · (LONG REACH|OUT OF REACH|HIGH STEP|COMMITTING BALANCE))*$/;
check("every why is capitals in the form \"<TYPE> HOLD · ...\" (no lowercase \"pinch\")",
  ev.results.concat(gEv.results, [pinRes, lowRes]).every((r) => WHY_FORM.test(r.why)));
// the reference's foot checks (session 14), against the port
const fHolds = { ...holds, hiL: { x: 115, y: 190 }, hiR: { x: 140, y: 190 }, rock: { x: 150, y: 150 }, high: { x: 150, y: 172 } };
const fTypes = { ...holdTypes, hiL: "jug", hiR: "jug", rock: "jug", high: "jug" };
const hiHands = { LH: "hiL", RH: "hiR", LF: "lf", RF: "rf" };
const comHi = P.centreOfMass(hiHands, fHolds);
const hip = P.hipOf("RF", hiHands, fHolds, comHi, REACH);
check("the hip hangs 0.5 x reach below the lower hand, 10 cm to the foot's side",
  Math.abs(hip.y - (190 - 0.5 * REACH)) < 1e-9 && Math.abs(hip.x - (comHi.x + 10)) < 1e-9, hip);
const rock = P.scoreHold({ limb: "RF", holdId: "rock", holds: fHolds, holdTypes: fTypes, position: hiHands, reach: REACH });
check("foot: a rock-over 40 cm below the hands is green, from the hip with leg reach (1.25 x 77)",
  rock.colour === "green" && rock.parts.limbReach === 1.25 * REACH && rock.parts.highStep === 1, rock);
const high = P.scoreHold({ limb: "RF", holdId: "high", holds: fHolds, holdTypes: fTypes, position: hiHands, reach: REACH });
check("foot: a jug ~20 cm above the hip is hard (red), and the why says HIGH STEP",
  high.colour === "red" && high.parts.highStep < 0.4 && high.why === "JUG HOLD · HIGH STEP", high);
check("hands are unchanged: arm reach from the shoulder, no high step",
  upRes.parts.limbReach === REACH && upRes.parts.highStep === 1, upRes.parts);
// the reference's own feet checks, port == reference on the foot wall too
let feetSame = true;
for (const limb of P.LIMBS) {
  const a = R.evaluate({ holds: fHolds, holdTypes: fTypes, position: hiHands, limb, reach: REACH });
  const b = P.evaluate({ holds: fHolds, holdTypes: fTypes, position: hiHands, limb, reach: REACH });
  if (JSON.stringify(a) !== JSON.stringify(b)) feetSame = false;
}
check("port == reference with the hands high (every limb, every hold)", feetSame);

// ---- 2. port == reference on the real Lens wall ------------------------------
const wHolds = {}, wTypes = {};
for (const h of HOLDS) { wHolds[h.id] = { x: h.x, y: h.y }; wTypes[h.id] = h.type; }
const wPos = { ...PRESET_POSITION };
let same = true, firstDiff = null;
const positions = [wPos, { ...wPos, RF: null }, { ...wPos, LH: null }, { LH: "h10", RH: "h11", LF: "h16", RF: "h14" }];
const tops = [null, PRESET_TOP, "h24", "lf"];
for (const pos of positions) {
  for (const limb of P.LIMBS) {
    for (const top of tops) {
      const a = R.evaluate({ holds: wHolds, holdTypes: wTypes, position: pos, limb, reach: CLIMBER_REACH, top });
      const b = P.evaluate({ holds: wHolds, holdTypes: wTypes, position: pos, limb, reach: CLIMBER_REACH, top });
      if (JSON.stringify(a) !== JSON.stringify(b)) { same = false; firstDiff = firstDiff || { limb, pos, top }; }
    }
  }
}
check("port output identical to reference (4 positions x 4 limbs x 4 tops x all holds)", same, firstDiff);

// ---- 3. bestMove ------------------------------------------------------------
function bruteBest(h, t, pos, reach, top = null) {
  let best = null;
  for (const limb of ["LH", "RH", "LF", "RF"]) {
    for (const r of R.evaluate({ holds: h, holdTypes: t, position: pos, limb, reach, top }).results) {
      if (r.score > 0 && (!best || r.rank > best.rank)) best = r;
    }
  }
  return best;
}
const bm = P.bestMove({ holds, holdTypes, position, reach: REACH });
check("bestMove on reference wall = RH -> up", bm && bm.limb === "RH" && bm.holdId === "up", bm);
let bmOk = true;
for (const pos of positions) {
  for (const top of tops) {
    const got = P.bestMove({ holds: wHolds, holdTypes: wTypes, position: pos, reach: CLIMBER_REACH, top });
    const want = bruteBest(wHolds, wTypes, pos, CLIMBER_REACH, top);
    if (!got || !want || got.rank !== want.rank) bmOk = false;
  }
}
check("bestMove rank = max over all limbs and holds (4 positions x 4 tops)", bmOk);
check("bestMove returns null when nothing is reachable",
  P.bestMove({ holds: { a: { x: 0, y: 0 }, b: { x: 500, y: 500 } }, holdTypes: { a: "jug", b: "jug" },
               position: { LH: "a", RH: null, LF: null, RF: null }, reach: 77 }) === null);

// ---- 3b. the limb a pinch moves: the best for that hold (session 20) ----------
let perHoldOk = true, firstPerHold = null;
for (const pos of positions) {
  for (const top of tops) {
    const got = P.bestPerHold({ holds: wHolds, holdTypes: wTypes, position: pos, reach: CLIMBER_REACH, top });
    for (const g of got) {
      // the reference's own scores, every limb: the highest rank among green or yellow moves (of all
      // of them if there are none), the earlier limb on a tie
      let want = null, wantSecure = null;
      for (const limb of ["LH", "RH", "LF", "RF"]) {
        const r = R.scoreHold({ limb, holdId: g.holdId, holds: wHolds, holdTypes: wTypes, position: pos, reach: CLIMBER_REACH, top });
        if (!want || r.rank > want.rank) want = r;
        if (r.colour !== "red" && (!wantSecure || r.rank > wantSecure.rank)) wantSecure = r;
      }
      want = wantSecure || want;
      if (JSON.stringify(g) !== JSON.stringify(want)) { perHoldOk = false; firstPerHold = firstPerHold || { g, want }; }
    }
  }
}
check("bestPerHold = the highest-ranked secure limb for each hold by the reference's own scores (4 positions x 4 tops)", perHoldOk, firstPerHold);
let holdsAgree = true;
for (const pos of positions) {
  for (const top of tops) {
    const args = { holds: wHolds, holdTypes: wTypes, position: pos, reach: CLIMBER_REACH, top };
    const b = P.bestMove(args);
    if (b && P.bestLimbFor({ ...args, holdId: b.holdId }).limb !== b.limb) holdsAgree = false;
  }
}
check("the best move's limb is the best limb for its hold: a pinch on the glow moves the limb its label names", holdsAgree);
check("bestPerHold skips the holds a limb is on", P.bestPerHold({ holds: wHolds, holdTypes: wTypes, position: wPos, reach: CLIMBER_REACH }).every((r) => !Object.values(wPos).includes(r.holdId)));
const nobody = P.bestLimbFor({ holds: wHolds, holdTypes: wTypes, position: wPos, reach: CLIMBER_REACH, holdId: "h24" });
check("no limb reaches it: the first limb, score 0, red", nobody.limb === "LH" && nobody.score === 0 && nobody.colour === "red", nobody);

// ---- 3c. a pinch only makes a green or yellow move (session 21) ---------------
let pmSame = true, firstPm = null;
for (const pos of positions) {
  for (const top of tops) {
    for (const override of [null, ...P.LIMBS]) {
      for (const holdId of Object.keys(wHolds)) {
        if (Object.values(pos).includes(holdId)) continue;
        const a = { holdId, holds: wHolds, holdTypes: wTypes, position: pos, reach: CLIMBER_REACH, top, override };
        const got = P.pinchMove(a), want = R.pinchMove(a);
        if (JSON.stringify(got) !== JSON.stringify(want)) { pmSame = false; firstPm = firstPm || { a, got, want }; }
      }
    }
  }
}
check("pinchMove == the reference's (4 positions x 4 tops x 5 overrides x all holds)", pmSame, firstPm);
const pmArgs = { holds: pHoldsAll(), holdTypes: wTypes, position: wPos, reach: CLIMBER_REACH, top: PRESET_TOP };
function pHoldsAll() { const o = {}; for (const id of PRESET_PROBLEM) o[id] = wHolds[id]; return o; }
const pmTop = P.pinchMove({ ...pmArgs, holdId: PRESET_TOP });
check("from the start the top hold is refused: no limb has a green or yellow move", pmTop.moves === false && pmTop.result.colour === "red", pmTop);
check("from the start 'up' moves RH", P.pinchMove({ ...pmArgs, holdId: "up" }).moves && P.pinchMove({ ...pmArgs, holdId: "up" }).limb === "RH");
const pmRedOver = P.pinchMove({ ...pmArgs, holdId: "up", override: "LF" });
check("an override whose move is red is refused, though RH could make the move", pmRedOver.moves === false && pmRedOver.limb === "LF", pmRedOver);
const pmOver = P.pinchMove({ ...pmArgs, holdId: "up", override: "LH" });
check("an override whose move is green moves that limb, not the best limb", pmOver.moves === true && pmOver.limb === "LH", pmOver);
// a red move can outrank a yellow one, as the goal only ranks: the hold isn't refused, the yellow move is made
const pmLow = { ...pmArgs, reach: 150 * 0.44, position: { LH: "h10", RH: "rh", LF: "up", RF: "rf" }, holdId: "h16" };
const lowRed = P.scoreHold({ ...pmLow, limb: "RF" }), lowYellow = P.scoreHold({ ...pmLow, limb: "LF" });
check("on the Lens's wall a red move can outrank a yellow one (150 cm)", lowRed.colour === "red" && lowYellow.colour === "yellow" && lowRed.rank > lowYellow.rank, { lowRed, lowYellow });
check("then the pinch makes the yellow move, and the ring (bestLimbFor) shows it", P.pinchMove(pmLow).moves && P.pinchMove(pmLow).limb === "LF" && P.bestLimbFor(pmLow).colour === "yellow", P.pinchMove(pmLow));
// from every position a climber can reach at any height: a move exists, so the new rule strands no one
let stuck = null, seenStates = 0;
{
  const seen = new Set(), queue = [[{ ...wPos }, 175]];
  seen.add(JSON.stringify(queue[0]));
  while (queue.length) {
    const [pos, h] = queue.shift();
    seenStates++;
    const a = { ...pmArgs, position: pos, reach: h * 0.44 };
    const moves = [];
    for (const holdId of PRESET_PROBLEM) {
      if (Object.values(pos).includes(holdId)) continue;
      for (const limb of P.LIMBS) { const m = P.pinchMove({ ...a, holdId, override: limb }); if (m.moves) moves.push(m); }
    }
    if (!moves.length) stuck = stuck || { pos, h };
    const push = (p, n) => { const k = JSON.stringify([p, n]); if (!seen.has(k)) { seen.add(k); queue.push([p, n]); } };
    for (const m of moves) push({ ...pos, [m.limb]: m.result.holdId }, h);
    for (const n of [h - 5, h + 5]) if (n >= 150 && n <= 200) push(pos, n);
  }
}
console.log(`  every state a climber can reach on the preset problem: ${seenStates}`);
check("no reachable position on the preset problem, at any height, leaves a climber with no legal move", stuck === null && seenStates > 1000, stuck);

// ---- 4. demo layout: the preset problem ("your problem") ---------------------
// Outside setup the Lens scores only the problem's holds, so the opening view is these.
const pHolds = {};
for (const id of PRESET_PROBLEM) pHolds[id] = wHolds[id];
check("preset problem: 8-10 holds, includes the preset position, start and top",
  PRESET_PROBLEM.length >= 8 && PRESET_PROBLEM.length <= 10 &&
  Object.values(PRESET_POSITION).every((id) => PRESET_PROBLEM.includes(id)) &&
  PRESET_START.every((id) => PRESET_PROBLEM.includes(id)) && PRESET_PROBLEM.includes(PRESET_TOP), PRESET_PROBLEM);
check("the top hold is the problem's clear top (highest by 30 cm or more)",
  PRESET_PROBLEM.every((id) => id === PRESET_TOP || wHolds[PRESET_TOP].y - wHolds[id].y >= 30));
const best = P.bestMove({ holds: pHolds, holdTypes: wTypes, position: wPos, reach: CLIMBER_REACH });
const sel = P.evaluate({ holds: pHolds, holdTypes: wTypes, position: wPos, limb: best.limb, reach: CLIMBER_REACH });
const counts = { green: 0, yellow: 0, red: 0 };
for (const r of sel.results) counts[r.colour]++;
console.log(`\n  preset problem: auto-selected ${best.limb}, suggestion ${best.holdId} (${best.score.toFixed(2)}); colours ${JSON.stringify(counts)}`);
check("preset problem shows green, yellow and red for the auto-selected limb", counts.green > 0 && counts.yellow > 0 && counts.red > 0, counts);
const com = P.centreOfMass(wPos, pHolds);
const greenJug = sel.results.some((r) => wTypes[r.holdId] === "jug" && r.colour === "green" && r.parts.reachFactor === 1 && pHolds[r.holdId].y > com.y);
check("a jug within 80% reach above the COM is green", greenJug);
check("an out-of-reach hold is red", sel.results.some((r) => r.parts.reachFactor === 0 && r.colour === "red"));

// the upward goal on the preset problem: after RH -> up, the old rule says "RH back down to rh";
// with the top hold it says a move that keeps climbing
const afterUp = { ...wPos, RH: "up" };
const noGoal = P.bestMove({ holds: pHolds, holdTypes: wTypes, position: afterUp, reach: CLIMBER_REACH });
const withGoal = P.bestMove({ holds: pHolds, holdTypes: wTypes, position: afterUp, reach: CLIMBER_REACH, top: PRESET_TOP });
console.log(`  after RH -> up: without the goal ${noGoal.limb} -> ${noGoal.holdId}; with it ${withGoal.limb} -> ${withGoal.holdId}`);
check("preset problem: without the goal the best move after RH -> up is back down to rh", noGoal.limb === "RH" && noGoal.holdId === "rh", noGoal);
check("preset problem: with the goal it climbs on (higher target, not back to rh)",
  withGoal.holdId !== "rh" && pHolds[withGoal.holdId].y > pHolds[afterUp[withGoal.limb]].y, withGoal);
const presetGoal = P.bestMove({ holds: pHolds, holdTypes: wTypes, position: wPos, reach: CLIMBER_REACH, top: PRESET_TOP });
check("preset problem with the goal still opens on RH -> up", presetGoal.limb === "RH" && presetGoal.holdId === "up", presetGoal);

// ---- 5. sequence preview: look-ahead over bestMove ---------------------------
const seqArgs = { holds: pHolds, holdTypes: wTypes, reach: CLIMBER_REACH, top: PRESET_TOP };
const seq = P.sequence({ ...seqArgs, position: wPos });
console.log(`\n  preset look-ahead: ${seq.map((m, i) => `${i + 1}. ${m.limb} -> ${m.holdId}`).join("  ")}`);
check("preset look-ahead has 3 moves, step 1 = bestMove", seq.length === 3 &&
  seq[0].limb === presetGoal.limb && seq[0].holdId === presetGoal.holdId, seq.map((m) => m.limb + m.holdId));
// The search (session 15), checked against a brute force written separately here: every route of
// secure moves (score >= 0.4, no limb back on a hold it left) from the position after step 1,
// depth by depth, until one reaches the top. The Lens's route must be the shortest, then the
// cheapest (sum of 1 - score), then the first by its "LIMB>hold" list.
function bruteRoute(args, limb) {
  const first = limb ? P.evaluate({ ...args, limb }).suggestion : P.bestMove(args);
  const isTop = (m) => m.holdId === args.top && P.HANDS.includes(m.limb);
  if (isTop(first)) return [first];
  const start = { ...args.position, [first.limb]: first.holdId };
  const left0 = { LH: [], RH: [], LF: [], RF: [] };
  if (args.position[first.limb] != null) left0[first.limb].push(args.position[first.limb]);
  for (let depth = 1; depth <= 6; depth++) {
    let best = null;
    const walk = (pos, left, acc, cost) => {
      if (acc.length === depth) return;
      for (const l of P.LIMBS) for (const r of P.evaluate({ ...args, position: pos, limb: l }).results) {
        if (r.score < 0.4 || left[l].includes(r.holdId)) continue;
        const next = [...acc, r], c = cost + (1 - r.score);
        if (isTop(r)) {
          if (next.length !== depth) continue;
          const keys = next.map((m) => m.limb + ">" + m.holdId);
          if (!best || c < best.c - 1e-9 || (Math.abs(c - best.c) <= 1e-9 && keys.join(" ") < best.keys.join(" "))) best = { c, keys, moves: next };
          continue;
        }
        walk({ ...pos, [l]: r.holdId }, { ...left, [l]: [...left[l], pos[l]] }, next, c);
      }
    };
    walk(start, left0, [], 0);
    if (best) return [first, ...best.moves];
  }
  return null;
}
const sameMoves = (a, b) => !!a && !!b && a.length === b.length && a.every((m, i) => m.limb === b[i].limb && m.holdId === b[i].holdId);
const fmtSeq = (s) => (s || []).map((m) => `${m.limb}->${m.holdId} (${m.colour})`).join(", ");
const route175 = P.fullRoute({ ...seqArgs, position: wPos, limb: "RH" });
check("the route is the brute force's: shortest to the top, then most secure (175 cm, from the preset)",
  sameMoves(route175, bruteRoute({ ...seqArgs, position: wPos }, "RH")), fmtSeq(route175));
check("the 1-2-3 is the route's first three moves", sameMoves(seq, route175.slice(0, 3)));
check("every step after the glow is green or yellow for you at its turn", seq.slice(1).every((m) => m.score >= 0.4));
// two heights, two betas, from the same start
const at = (h) => ({ ...seqArgs, reach: h * 0.44, position: wPos });
const s155 = P.sequence({ ...at(155), limb: P.bestMove(at(155)).limb });
const s195 = P.sequence({ ...at(195), limb: P.bestMove(at(195)).limb });
console.log(`  155 cm: ${fmtSeq(s155)}\n  195 cm: ${fmtSeq(s195)}`);
check("155 cm and 195 cm get different 1-2-3s from the same start", s155.length === 3 && s195.length === 3 &&
  s155.map((m) => m.limb + m.holdId).join() !== s195.map((m) => m.limb + m.holdId).join(), [fmtSeq(s155), fmtSeq(s195)]);
check("at 155 and 195 cm every step of the 1-2-3 is green or yellow", s155.concat(s195).every((m) => m.colour !== "red"));
check("195 cm: the left hand skips the pinch h09 for the jug h10; 155 cm: h10 is out of reach, it takes h09",
  s195[1].limb === "LH" && s195[1].holdId === "h10" && s155[1].limb === "LH" && s155[1].holdId === "h09" &&
  P.scoreHold({ ...at(155), position: { ...wPos, RH: "up" }, limb: "LH", holdId: "h10" }).colour === "red");
const r155 = P.fullRoute({ ...at(155), limb: "RH" }), r195 = P.fullRoute({ ...at(195), limb: "RH" });
console.log(`  to the top: 155 cm ${r155.length} moves, 195 cm ${r195.length} moves`);
check("the routes at 155 and 195 cm are the brute force's", sameMoves(r155, bruteRoute(at(155), "RH")) && sameMoves(r195, bruteRoute(at(195), "RH")));
// what the search adds over one best step at a time (the session-14 look-ahead, rebuilt here):
// after RH -> up, at 175 cm the top is three moves away and the search goes for it, where the
// greedy chain spends a move on the right foot; at 155 cm the top is out of reach without that
// foot, and the search keeps it
function greedyChain(args) {
  const out = [];
  let pos = { ...args.position };
  const left = { LH: [], RH: [], LF: [], RF: [] };
  for (let i = 0; i < 3; i++) {
    let m = null;
    for (const l of i === 0 && args.limb ? [args.limb] : P.LIMBS) {
      for (const r of P.evaluate({ ...args, position: pos, limb: l }).results) {
        if (r.score > 0 && !left[l].includes(r.holdId) && r.rank > (m ? m.rank : -1)) m = r;
      }
    }
    if (!m) break;
    out.push(m);
    if (pos[m.limb] != null) left[m.limb].push(pos[m.limb]);
    pos = { ...pos, [m.limb]: m.holdId };
    if (m.holdId === args.top && P.HANDS.includes(m.limb)) break;
  }
  return out;
}
const afterUpAt = (h) => ({ ...at(h), position: { ...wPos, RH: "up" } });
const g175 = greedyChain({ ...afterUpAt(175), limb: "LH" }), q175 = P.sequence({ ...afterUpAt(175), limb: "LH" });
const q155 = P.sequence({ ...afterUpAt(155), limb: "LH" });
console.log(`  after RH -> up: 175 cm greedy ${fmtSeq(g175)}\n                  175 cm search ${fmtSeq(q175)}\n                  155 cm search ${fmtSeq(q155)}`);
check("after RH -> up, 175 cm: the search reaches the top in 3 (LH h09, LF lh, LH h20), the greedy chain moves the right foot instead",
  q175.map((m) => m.limb + ">" + m.holdId).join(" ") === "LH>h09 LF>lh LH>h20" && g175[2].limb === "RF");
check("after RH -> up, 155 cm: the top is out of reach without the right foot, so the search brings it up",
  q155.map((m) => m.limb + ">" + m.holdId).join(" ") === "LH>h09 LF>lh RF>rh");
let routesOk = true;
for (const h of [150, 160, 170, 180, 185, 190, 200]) {
  for (const limb of P.LIMBS) {
    const got = P.fullRoute({ ...at(h), limb }), want = bruteRoute(at(h), limb);
    if (!(got === null ? want === null : sameMoves(got, want))) routesOk = false;
  }
}
check("route == brute force for 7 heights x 4 selected limbs", routesOk);
check("every foot step of the preset look-ahead is a leg move: no high step, within leg reach", (() => {
  let p = { ...wPos };
  for (const m of seq) {
    if (P.FEET.includes(m.limb) && !(m.parts.highStep === 1 && m.parts.dist <= m.parts.limbReach && m.parts.limbReach > CLIMBER_REACH)) return false;
    p = { ...p, [m.limb]: m.holdId };
  }
  return seq.some((m) => P.FEET.includes(m.limb));
})(), seq.map((m) => ({ limb: m.limb, hold: m.holdId, parts: m.parts })));
check("the preset look-ahead climbs: each target is higher than the hold that limb leaves", (() => {
  let p = { ...wPos };
  for (const m of seq) { if (!(pHolds[m.holdId].y > pHolds[p[m.limb]].y)) return false; p = { ...p, [m.limb]: m.holdId }; }
  return true;
})());
// step 1 follows the selected limb when one is given (the glowing ring)
const seqLF = P.sequence({ ...seqArgs, position: wPos, limb: "LF" });
const evLF = P.evaluate({ ...seqArgs, position: wPos, limb: "LF" }).suggestion;
check("with a selected limb, step 1 = that limb's suggestion", seqLF.length > 0 && seqLF[0].limb === "LF" && seqLF[0].holdId === evLF.holdId, seqLF[0]);
// no undo: a look-ahead never puts a limb back on a hold it left earlier in the same look-ahead.
// Without the goal plain bestMove would go RH up, RH back down; the look-ahead takes the next move instead.
function undoes(s, start) {
  let p = { ...start };
  const left = { LH: [], RH: [], LF: [], RF: [] };
  for (const m of s) { if (left[m.limb].includes(m.holdId)) return true; left[m.limb].push(p[m.limb]); p = { ...p, [m.limb]: m.holdId }; }
  return false;
}
const seqNoGoal = P.sequence({ ...seqArgs, top: null, position: wPos });
check("no goal: plain bestMove after RH -> up is RH back to rh, the look-ahead skips it",
  P.bestMove({ ...seqArgs, top: null, position: { ...wPos, RH: "up" } }).holdId === "rh" &&
  seqNoGoal.length === 3 && seqNoGoal[0].holdId === "up" && !undoes(seqNoGoal, wPos), seqNoGoal.map((m) => m.limb + m.holdId));
let noUndo = true, minLen = 3;
for (const pos of [wPos, { ...wPos, RH: "up" }, { ...wPos, RH: "up", LH: "h09" }]) {
  for (const limb of [null, ...P.LIMBS]) {
    for (const top of [PRESET_TOP, null]) {
      const s = P.sequence({ ...seqArgs, top, position: pos, limb });
      if (undoes(s, pos)) noUndo = false;
      minLen = Math.min(minLen, s.length);
    }
  }
}
check("no look-ahead undoes its own moves, and each shows 2-3 moves (3 positions x 5 limb choices x 2 tops)", noUndo && minLen >= 2, minLen);
// stops at the top: play the look-ahead forward until a hand reaches it
let climbPos = { ...wPos }, reached = false;
for (let i = 0; i < 6 && !reached; i++) {
  const s = P.sequence({ ...seqArgs, position: climbPos });
  if (!s.length) break;
  const lastTop = s.findIndex((m) => m.holdId === PRESET_TOP);
  if (lastTop >= 0) { reached = lastTop === s.length - 1; break; }
  climbPos = { ...climbPos, [s[0].limb]: s[0].holdId };
}
check("following the look-ahead reaches the top hold, and the look-ahead ends there", reached, climbPos);
check("look-ahead is empty when nothing is reachable",
  P.sequence({ holds: { a: { x: 0, y: 0 }, b: { x: 500, y: 500 } }, holdTypes: { a: "jug", b: "jug" },
               position: { LH: "a", RH: null, LF: null, RF: null }, reach: 77 }).length === 0);

// ---- 6. beta on request (session 23): what is shown, and when (NextHoldBeta.ts) ----------------
const B0 = B.initialBeta(false, 100);
const shownKeys = (r) => JSON.stringify(r);
check("beta is hidden by default, at step 0, first attempt", !B0.betaShown && B0.hintStep === 0 && B0.attempt === 1 && B0.moves === 0);
const r0 = B.reveal(B0);
check("hidden: no rings, glow, limb, 1-2-3 or figure; outlines from the mats",
  r0.rings === "none" && !r0.glow && !r0.limb && !r0.steps && !r0.figure && r0.outlines, r0);
const rShown = B.reveal(B.showBeta(B0));
check("Show my beta: the full read, no outlines", rShown.rings === "all" && rShown.glow && rShown.limb && rShown.steps && rShown.figure && !rShown.outlines, rShown);
// the ladder, pinch by pinch
const a1 = B.ask(B0, false, false), a2 = B.ask(a1.state, a1.armed, false), a3 = B.ask(a2.state, a2.armed, false), a4 = B.ask(a3.state, a3.armed, false);
const r1 = B.reveal(a1.state), r2 = B.reveal(a2.state);
check("ladder 1: rings on the holds in reach, no glow, no limb, not armed",
  a1.state.hintStep === 1 && !a1.armed && r1.rings === "reach" && !r1.glow && !r1.limb && !r1.steps, r1);
check("ladder 2: the glow and the word too, still no 1-2-3, not armed",
  a2.state.hintStep === 2 && !a2.armed && r2.rings === "reach" && r2.glow && r2.limb && !r2.steps, r2);
check("ladder 3: arms '?', shows nothing more", a3.state.hintStep === 3 && a3.armed && shownKeys(B.reveal(a3.state)) === shownKeys(r2));
check("after the ladder '?' toggles as it always has", a4.state.hintStep === 3 && !a4.armed && B.ask(a4.state, false, false).armed);
const aShown = B.ask(B.showBeta(B0), false, false);
check("beta shown: '?' arms at once, as in v6", aShown.armed && aShown.state.hintStep === 0 && !B.ask(aShown.state, true, false).armed);
check("hidden and topped out: '?' does nothing, there is no next move", (() => { const t = B.ask(B0, false, true); return t.state === B0 && !t.armed; })());
const m1 = B.moved(a2.state, 130);
check("a move ends the hint and restarts the idle clock", m1.hintStep === 0 && m1.moves === 1 && m1.idleFrom === 130 && B.reveal(m1).rings === "none");
// came off
const m2 = B.moved(m1, 140);
check("stepping back with no move made is not a fall", B.steppedBack(B0, false) === B0);
check("stepping back on the top hold is not a fall", B.steppedBack(m2, true) === m2);
const shownM = B.moved(B.showBeta(B0), 110);
check("stepping back with beta shown is not a fall: the plan moves on with you", B.steppedBack(shownM, false) === shownM);
const off = B.steppedBack(m2, false);
check("two moves made, came off: the card names move 3, the attempt is over, the position's count stays",
  off.cameOffMove === 3 && off.attempt === 2 && off.moves === 2 && off.hintStep === 0, off);
check("the card's line, word for word", B.cameOffLine(3) === "Came off at move 3. Hint for that move?");
check("stepping back again with no new move is the same fall", B.steppedBack({ ...off, cameOffMove: null }, false).attempt === 2 && B.steppedBack({ ...off, cameOffMove: null }, false).cameOffMove === null);
const hint = B.takeHint(off);
check("one pinch on the card opens the ladder on step 1, at that position",
  hint.cameOffMove === null && hint.hintStep === 1 && hint.moves === 2 && B.reveal(hint).rings === "reach" && !B.reveal(hint).glow);
const viaAsk = B.ask(off, false, false);
check("'?' with the card up does the same as the card", viaAsk.state.hintStep === 1 && viaAsk.state.cameOffMove === null && !viaAsk.armed);
const again = B.steppedBack(B.moved(B.arrivedOnWall(hint, 170), 175), false);
check("climbing on from there, the next fall names the next move", again.cameOffMove === 4 && again.attempt === 3, again);
check("walking back in leaves the card unanswered, and the idle clock starts there",
  (() => { const w = B.arrivedOnWall(off, 170); return w.cameOffMove === null && w.idleFrom === 170 && w.hintStep === 0; })());
check("a move answers the card too", B.moved(off, 170).cameOffMove === null);
// the cue
const cue = (s, now, o = {}) => B.cueShown(s, { onWall: true, climbing: true, topped: false, now, ...o });
const back = B.arrivedOnWall(off, 170);
check("no cue on the first attempt before a fall, however long", !cue(B0, 100 + 1000));
check("after a fall: no cue at 19.9 s on the wall, a cue at 20 s", !cue(back, 189.9) && cue(back, 190));
check("the idle clock counts from the last move", !cue(B.moved(back, 185), 200) && cue(B.moved(back, 185), 205));
check("no cue on the mats, in setup, topped out, with beta shown, or once a hint was asked",
  !cue(back, 300, { onWall: false }) && !cue(back, 300, { climbing: false }) && !cue(back, 300, { topped: true }) &&
  !cue(B.showBeta(back), 300) && !cue(B.ask(back, false, false).state, 300));
check("the cue is pure: it changes nothing in the state", (() => { const j = JSON.stringify(back); cue(back, 300); return JSON.stringify(back) === j; })());
// a new attempt or a new problem
const fresh = B.newAttempt(B.showBeta(m2), false, 200);
check("a new attempt hides beta again, clears the hint and the count", !fresh.betaShown && fresh.hintStep === 0 && fresh.moves === 0 && fresh.attempt === 2 && fresh.idleFrom === 200);
check("the same with beta kept on by a test's default", B.newAttempt(m2, true, 200).betaShown);
check("problemKey: order doesn't matter; holds, start holds and top do",
  B.problemKey(["a", "b"], ["a"], "b") === B.problemKey(["b", "a"], ["a"], "b") && B.problemKey(["a", "b"], ["a"], "b") !== B.problemKey(["a", "b", "c"], ["a"], "b") &&
  B.problemKey(["a", "b"], ["a"], "b") !== B.problemKey(["a", "b"], ["b"], "b") && B.problemKey(["a", "b"], ["a"], "b") !== B.problemKey(["a", "b"], ["a"], "a"));
// the hint's rings against the real rule: the glow is always on a ringed hold, over every state a pinch can reach
{
  const pIds = PRESET_PROBLEM, tp = {}, ph = {};
  for (const h of HOLDS) if (pIds.includes(h.id)) { ph[h.id] = { x: h.x, y: h.y }; tp[h.id] = h.type; }
  let states = 0, offRing = 0, redIn = 0, outOfReachShown = 0, noReach = 0;
  for (const height of [150, 175, 200]) {
    const seen = new Set(), todo = [{ ...PRESET_POSITION }], reach = height * 0.44;
    while (todo.length) {
      const pos = todo.pop(), key = JSON.stringify(pos);
      if (seen.has(key)) continue;
      seen.add(key); states++;
      const args = { holds: ph, holdTypes: tp, position: pos, reach, top: PRESET_TOP };
      const per = P.bestPerHold(args), ringed = per.filter((r) => B.inReach(r));
      if (!ringed.length) noReach++;
      for (const r of per) {
        if (B.inReach(r) && r.colour === "red") redIn++;
        if (B.inReach(r) && r.parts.reachFactor === 0) outOfReachShown++;
      }
      const best = P.bestMove(args);
      if (best && !ringed.some((r) => r.holdId === best.holdId)) offRing++;
      if ([pos.LH, pos.RH].includes(PRESET_TOP)) continue;
      for (const r of per) {
        const m = P.pinchMove({ ...args, holdId: r.holdId });
        if (m.moves) todo.push({ ...pos, [m.limb]: r.holdId });
      }
    }
  }
  console.log(`  hint rings over ${states} states at 3 heights: ${redIn} rings in reach but red, ${noReach} states with nothing in reach`);
  check("in every state a pinch can reach, the glow's hold is among the hint's rings", states > 100 && offRing === 0, { states, offRing });
  check("an in-reach red ring exists (it says too hard, not out of reach), and no out-of-reach hold is ringed", redIn > 0 && outOfReachShown === 0, { redIn });
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
