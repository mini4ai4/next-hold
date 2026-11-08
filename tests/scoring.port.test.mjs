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
check("ladder 3 (session 26): the why at once (under the move's label), not armed, nothing else shows",
  a3.state.hintStep === 3 && !a3.armed && a3.why && B.reveal(a3.state).why && !r2.why && shownKeys({ ...B.reveal(a3.state), why: false }) === shownKeys(r2));
check("after the ladder '?' shows the why again, never arms", a4.state.hintStep === 3 && !a4.armed && a4.why);
check("session 26: hints this go: every rung is one (rung 1 too), a repeat of 3 isn't",
  a1.state.hintsThisGo === 1 && a2.state.hintsThisGo === 2 && a3.state.hintsThisGo === 3 && a4.state.hintsThisGo === 3, [a1, a2, a3, a4].map((a) => a.state.hintsThisGo));
check("step dots on '?': one per rung; session 28: none with the beta shown (no \"Why ○○○\")",
  B.askDots(B0) === "○○○" && B.askDots(a1.state) === "●○○" && B.askDots(a2.state) === "●●○" && B.askDots(a3.state) === "●●●" && B.askDots(B.showBeta(B0)) === "");
check("the word under '?' names what the next pinch gives: Hint, Move, Why; session 28: no word at ●●● (a fourth pinch gives nothing new); Why with beta shown",
  B.askWord(B0) === "Hint" && B.askWord(a1.state) === "Move" && B.askWord(a2.state) === "Why" && B.askWord(a3.state) === "" && B.askWord(B.showBeta(B0)) === "Why");
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
const shownOff = B.steppedBack(shownM, false);
check("session 24: with beta shown a fall is a go too, only the card is skipped",
  shownOff.attempt === 2 && shownOff.cameOffMove === null && shownOff.betaShown && shownOff.betaSeenThisGo && shownOff.moves === 1, shownOff);
const off = B.steppedBack(m2, false);
check("two moves made, came off: the card names move 3, the attempt is over, the position's count stays",
  off.cameOffMove === 3 && off.attempt === 2 && off.moves === 2 && off.hintStep === 0, off);
// session 28 (v7.3 P1-6): the headline agrees with the pulse (on the hold last reached); the button is one line
check("session 28: the card's headline and its hint button, word for word", B.cameOffLine(3) === "Came off from here" && B.cameOffHintLabel(3) === "Hint · move 3" && B.cameOffHintLabel(4).indexOf("\n") < 0);
check("stepping back again with no new move is the same fall", B.steppedBack({ ...off, cameOffMove: null }, false).attempt === 2 && B.steppedBack({ ...off, cameOffMove: null }, false).cameOffMove === null);
const hint = B.takeHint(off);
check("one pinch on the card opens the ladder on step 1, at that position",
  hint.cameOffMove === null && hint.hintStep === 1 && hint.moves === 2 && B.reveal(hint).rings === "reach" && !B.reveal(hint).glow);
const viaAsk = B.ask(off, false, false);
check("'?' with the card up does the same as the card", viaAsk.state.hintStep === 1 && viaAsk.state.cameOffMove === null && !viaAsk.armed);
const again = B.steppedBack(B.moved(B.arrivedOnWall(hint, 170), 175), false);
check("session 26: climbing on from there, the next fall names the next move, and is no new go (climbing on isn't one)", again.cameOffMove === 4 && again.attempt === 2 && !again.fromStart, again);
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
const fresh = B.newAttempt(B.toppedOut(B.showBeta(m2)), false, 200);
check("a hand off the top: the next go's number (counted at the top), beta hidden again, the hint and the count cleared, not from the start",
  !fresh.betaShown && fresh.hintStep === 0 && fresh.moves === 0 && fresh.attempt === 2 && fresh.idleFrom === 200 && !fresh.betaSeenThisGo && !fresh.fromStart, fresh);
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

// ---- 6b. goes and pinned hints (session 24, NextHoldBeta.ts) ----------------------------------------
{
  const s0 = B.initialBeta(false, 0, 1, "S");
  const go1 = B.moved(B.moved(s0, 1, "A"), 2, "P");
  check("a go is live once a move is made", !B.isLive(s0) && B.isLive(go1));
  const seen = B.hideBeta(B.showBeta(go1));
  check("Hide beta takes the read down, the go stays \"with beta\"", !seen.betaShown && seen.betaSeenThisGo && seen.hintStep === 0);
  const fell = B.steppedBack(B.ask(B.ask(seen, false, false).state, false, false).state, false);
  check("a fall ends the go: the next go starts with no hints and, beta hidden, not \"with beta\"",
    fell.attempt === 2 && fell.hintsThisGo === 0 && !fell.betaSeenThisGo && fell.cameOffMove === 3, fell);
  const topped = B.toppedOut(B.moved(B.showBeta(s0), 1, "T"));
  check("topping out ends the go too: attempt 2, counts cleared, stepping back from the top isn't another go",
    topped.attempt === 2 && topped.hintsThisGo === 0 && B.steppedBack(topped, false) === topped, topped);
  // pinned: the hint taken on the card at P
  const taken = B.takeHint(fell);
  check("the card's hint is pinned to the fall's position, on rung 1", taken.pin && taken.pin.at === "P" && taken.pin.step === 1 && taken.hintStep === 1);
  const up2 = B.ask(taken, false, false).state;
  check("climbing the ladder there moves the pin up with it, and counts both rungs for the next go (session 26: rung 1 is a hint)", up2.pin.step === 2 && up2.hintsThisGo === 2);
  const back = B.again(up2, false, 10, "S");
  check("Again: at the start holds, no hint shows, the pin waits at P, no new go counted (the fall ended it)",
    back.hintStep === 0 && back.pin && back.pin.at === "P" && back.attempt === 2 && back.moves === 0 && back.here === "S", back);
  check("session 26 (engineer bug 1): Again keeps the hints taken after the fall (they were wiped)", back.hintsThisGo === 2, back.hintsThisGo);
  const atA = B.moved(back, 11, "A"), atP = B.moved(atA, 12, "P");
  check("on the way up nothing shows; back at P the pinned rung shows again", atA.hintStep === 0 && atP.hintStep === 2 && atP.pin.at === "P", atP);
  const past = B.moved(atP, 13, "Q");
  check("the move from P is made: the pin is gone", past.pin === null && past.hintStep === 0);
  const elsewhere = B.moved(B.moved(back, 11, "X"), 12, "Y");
  check("a different way up keeps the pin for when the climber is at P", elsewhere.pin && elsewhere.pin.at === "P" && elsewhere.hintStep === 0);
  check("climbing on from the fall without Again: the hint is already showing at P, and goes with the next move",
    taken.here === "P" && B.moved(taken, 20, "Q").pin === null);
  const liveAgain = B.again(go1, false, 30, "S");
  check("Again (resetAttempt) in the middle of a go counts that go as ended", liveAgain.attempt === 2 && liveAgain.moves === 0);
  check("Again puts beta back to the default", !B.again(B.showBeta(go1), false, 30, "S").betaShown && B.again(go1, true, 30, "S").betaShown);
  check("positionKey: one key per placement of the four limbs",
    B.positionKey({ LH: "a", RH: "b", LF: null, RF: "c" }) === "a/b/-/c" && B.positionKey({ LH: "b", RH: "a", LF: null, RF: "c" }) !== "a/b/-/c");
}

// ---- 7. the climb in climbing's words, and what is kept (session 24, NextHoldAttempt.ts) -------------
import * as A from "../Assets/Scripts/NextHoldAttempt.ts";
{
  check("ONSIGHT: first go, no beta, no hints; FLASH: first go with beta or a hint; SEND: any later go",
    A.tickFor(1, false, 0) === "ONSIGHT" && A.tickFor(1, true, 0) === "FLASH" && A.tickFor(1, false, 1) === "FLASH" &&
    A.tickFor(2, false, 0) === "SEND" && A.tickFor(5, true, 3) === "SEND");
  const send3 = { tick: "SEND", go: 3, moves: 7, hints: 1 };
  const send4 = { tick: "SEND", go: 4, moves: 6, hints: 2 };
  // session 26, the climber's order: tick, then go (first tops only), then hints, and moves only break a tie
  check("session 26: better: the tick first, then the earlier go, then fewer hints, then fewer moves",
    A.better({ tick: "FLASH", go: 1, moves: 9, hints: 3 }, send3) && !A.better(send4, send3) && A.better(send3, send4) &&
    A.better({ ...send3, hints: 0 }, send3) && A.better({ ...send3, moves: 6 }, send3) && !A.better(send3, send3) && A.better(send3, null));
  check("session 26: a send on go 2 in 5 moves beats a send on go 5 in 4, whatever the moves",
    A.better({ tick: "SEND", go: 2, moves: 5, hints: 0 }, { tick: "SEND", go: 5, moves: 4, hints: 0 }));
  check("session 26: a clean send beats one with 2 hints in fewer moves",
    A.better({ tick: "SEND", go: 2, moves: 5, hints: 0 }, { tick: "SEND", go: 2, moves: 4, hints: 2 }));
  check("session 26: among repeats the go doesn't count (fewer hints wins), and any first top beats a repeat",
    A.better({ tick: "REPEAT", go: 6, moves: 5, hints: 0 }, { tick: "REPEAT", go: 3, moves: 4, hints: 1 }) &&
    A.better({ tick: "SEND", go: 9, moves: 9, hints: 9 }, { tick: "REPEAT", go: 2, moves: 4, hints: 0 }));
  check("session 26: the count stops at the first top: later tops are REPEAT",
    A.tickOf(null, 2, false, 1) === "SEND" && A.tickOf({ tick: "ONSIGHT", go: 1, moves: 4, hints: 0 }, 2, false, 1) === "REPEAT" && A.tickOf(null, 1, false, 0) === "ONSIGHT");
  const tickedOnsight = { tick: "ONSIGHT", go: 1, moves: 4, hints: 0 };
  // session 28 (v7.3 P1-7): par can't be beaten, so "the shortest for you"; no "ticked on this go"; a line that points on
  const sendCard = A.cardLines({ tick: "SEND", go: 2, moves: 5, hints: 1 }, 4, null);
  check("session 28: a send over par, word for word: \"SEND · go 2\" / \"5 moves · shortest for you: 4\" / \"1 hint · sent! Again without it?\"",
    sendCard.join(" | ") === "SEND · go 2 | 5 moves · shortest for you: 4 | 1 hint · sent! Again without it?", sendCard);
  check("session 28: a send at par: \"4 moves · the shortest for you\"; with no hints \"No hints · clean send!\"; a flash \"flashed\"; two hints \"them\"",
    A.cardLines({ tick: "SEND", go: 2, moves: 4, hints: 0 }, 4, null).join(" | ") === "SEND · go 2 | 4 moves · the shortest for you | No hints · clean send!" &&
    A.cardLines({ tick: "FLASH", go: 1, moves: 4, hints: 2 }, 4, null)[2] === "2 hints · flashed! Again without them?" &&
    A.cardLines({ tick: "FLASH", go: 1, moves: 4, hints: 0 }, 4, null)[2] === "No hints · flashed with your beta" &&
    A.cardLines({ tick: "SEND", go: 3, moves: 6, hints: 0 }, 4, null)[2] === "No hints · sent! Again in 4?");
  const repCard = A.cardLines({ tick: "REPEAT", go: 3, moves: 4, hints: 1 }, 4, tickedOnsight);
  check("a repeat: \"REPEAT · go 3\" / \"4 moves · the shortest for you\" / \"1 hint · ticked: onsight (go 1)\"",
    repCard.join(" | ") === "REPEAT · go 3 | 4 moves · the shortest for you | 1 hint · ticked: onsight (go 1)", repCard);
  check("an onsight: \"Clean onsight. Pick something harder?\" on line 3",
    A.cardLines({ tick: "ONSIGHT", go: 1, moves: 5, hints: 0 }, 5, null).join(" | ") === "ONSIGHT · go 1 | 5 moves · the shortest for you | Clean onsight. Pick something harder?");
  check("session 28: no card line says \"par\" or \"ticked on this go\"",
    [sendCard, repCard, A.cardLines({ tick: "SEND", go: 2, moves: 4, hints: 0 }, 4, null)].flat().every((l) => !/\bpar\b|ticked on this go/.test(l)));
  check("no par (the search gave up or ran past 8 moves) reads \"no shortest found\", never \"no par for your body\"; one move and one hint in the singular",
    A.cardLines(send3, null, null)[1] === "7 moves · no shortest found" && A.movesText(1) === "1 move" && A.hintsText(0) === "0 hints" && A.hintsText(1) === "1 hint");
  check("session 26 (hound 3a): a top climbed on from a fall: no tick, it says so",
    A.resumedLines(2).join(" | ") === "TOPPED · not from the start | A tick needs a go from the start | 2 hints · Again to go from the start");
  // v8 (session 29): rewritten from "no timer and no points anywhere on the card": no clock on any of the card's three
  // lines (the split line too) and no points; the time is its own fourth line, only after a top from the start (section 10)
  check("v8: no clock on any card line and no points; the time line only after a top from the start",
    !A.cardLines(send4, 5, send3).concat(repCard, A.resumedLines(1), A.cardLines(send4, 4, null, 3)).join(" ").match(/\d:\d\d|point|pts/i));
  check("FNV-1a known values", A.fnv1a("") === "811c9dc5" && A.fnv1a("a") === "e40c292c", [A.fnv1a(""), A.fnv1a("a")]);
  const pk = B.problemKey(PRESET_PROBLEM, PRESET_START, PRESET_TOP);
  check("the best's key covers the problem and the height",
    A.bestKey(pk, 175) === A.bestKey(pk, 175) && A.bestKey(pk, 175) !== A.bestKey(pk, 155) &&
    A.bestKey(pk, 175) !== A.bestKey(B.problemKey(PRESET_PROBLEM.slice(1), PRESET_START, PRESET_TOP), 175) && A.bestKey(pk, 175).startsWith("nh.best."), A.bestKey(pk, 175));
  check("session 26: the goes' key covers the problem, not the height",
    A.goesKey(pk).startsWith("nh.goes.") && A.goesKey(pk) !== A.goesKey(B.problemKey(PRESET_PROBLEM.slice(1), PRESET_START, PRESET_TOP)) && A.goesKey(pk) !== A.bestKey(pk, 175));
  const rec = { goes: 3, best: send3 };
  check("a record survives the store; garbage reads as no record",
    JSON.stringify(A.decodeRecord(A.encodeRecord(rec))) === JSON.stringify(rec) && A.decodeRecord("{oops").goes === 0 &&
    A.decodeRecord('{"g":2,"b":{"t":"WIN","n":1,"m":1,"h":0}}').best === null && A.decodeRecord('{"g":-1}').goes === 0 && A.decodeRecord("").best === null);
  check("a stored height is snapped to 5 cm in 150-200, anything else is no height",
    A.cleanHeight(160) === 160 && A.cleanHeight(161) === 160 && A.cleanHeight(149) === null && A.cleanHeight(0) === null && A.cleanHeight(NaN) === null && A.cleanHeight(201) === null);
  // a store with GeneralDataStore's methods, a size cap, and a switch to make it throw
  class FakeStore {
    constructor(max) { this.m = new Map(); this.max = max; this.boom = false; }
    t() { if (this.boom) throw new Error("boom"); }
    has(k) { this.t(); return this.m.has(k); }
    getString(k) { this.t(); const v = this.m.get(k); return typeof v === "string" ? v : ""; }
    putString(k, v) { this.t(); this.m.set(k, v); }
    getInt(k) { this.t(); const v = this.m.get(k); return typeof v === "number" ? v : 0; }
    putInt(k, v) { this.t(); this.m.set(k, v); }
    remove(k) { this.t(); this.m.delete(k); }
    getAllKeys() { this.t(); return [...this.m.keys()]; }
    getMaxSizeInBytes() { this.t(); return this.max; }
  }
  const st = new FakeStore(10000), save = new A.NextHoldSave(st), key = A.bestKey(pk, 175);
  check("an empty store: no record, no height", save.readRecord(key).goes === 0 && save.readRecord(key).best === null && save.readHeight() === null);
  check("write and read back a record and a height", save.writeRecord(key, rec) && JSON.stringify(save.readRecord(key)) === JSON.stringify(rec) &&
    save.writeHeight(160) && save.readHeight() === 160 && st.getInt("nh.height") === 160);
  check("rewriting a key replaces it (the size check counts the old value out)", save.writeRecord(key, { goes: 4, best: send3 }) && save.readRecord(key).goes === 4);
  const full = new FakeStore(10000); full.putString("filler", "x".repeat(8990));
  const sf = new A.NextHoldSave(full);
  check("a full store: nothing written, nothing thrown", !sf.writeRecord(key, rec) && !full.has(key) && !sf.writeHeight(170) && sf.lastWrite.startsWith("skipped"));
  const zero = new FakeStore(0), nomax = new A.NextHoldSave(zero);
  check("a store that reports no cap (as GeneralDataStore.create() does) gets our own 10 KB one: written, and stopped there",
    nomax.maxBytes() === A.FALLBACK_MAX_BYTES && nomax.writeRecord(key, rec) && (() => { zero.putString("filler", "x".repeat(9200)); return !nomax.writeHeight(170); })());
  const broken = new FakeStore(10000); broken.putString(key, A.encodeRecord(rec)); broken.boom = true;
  const sb = new A.NextHoldSave(broken);
  check("a store that throws: reads give no record and no height, writes give false, nothing escapes",
    sb.readRecord(key).goes === 0 && sb.readHeight() === null && !sb.writeRecord(key, rec) && !sb.writeHeight(170));
  const none = new A.NextHoldSave(null);
  check("no store at all: the same", !none.hasStore() && none.readRecord(key).goes === 0 && !none.writeHeight(170));
  check("a record is small: under 100 bytes", A.encodeRecord({ goes: 99, best: { tick: "ONSIGHT", go: 99, moves: 99, hints: 99 } }).length + key.length < 100);
  // par for your body: the planner's shortest secure route from the preset start, at three heights
  const ph = {}, tp = {};
  for (const h of HOLDS) if (PRESET_PROBLEM.includes(h.id)) { ph[h.id] = { x: h.x, y: h.y }; tp[h.id] = h.type; }
  const par = (cm) => { const r = P.routeToTop({ holds: ph, holdTypes: tp, position: { ...PRESET_POSITION }, reach: cm * 0.44, top: PRESET_TOP }); return r ? r.length : null; };
  console.log(`  par for your body from the preset start: 155 cm ${par(155)}, 175 cm ${par(175)}, 195 cm ${par(195)}`);
  const plan = (cm) => { const r = P.fullRoute({ holds: ph, holdTypes: tp, position: { ...PRESET_POSITION }, reach: cm * 0.44, top: PRESET_TOP }); return r ? r.length : null; };
  // t1 takes 5 by following the glow move by move (after LF to lh the glow prefers the surer RF to rh);
  // the 1-2-3 seen from the start (glow + route) is a par route
  check("par at 175 cm is 4 (LH h09, RH up, LF lh, LH h20 yellow), and at every height the 1-2-3 from the start is that long",
    par(175) === 4 && [155, 175, 195].every((cm) => plan(cm) === par(cm)), [155, 175, 195].map((cm) => [par(cm), plan(cm)]));
  check("par differs with the body: a taller climber's par is never longer", par(195) <= par(175) && par(175) <= par(155), [par(155), par(175), par(195)]);
}

// ---- 8. session 26: the glow follows the plan (Assets/Scripts/NextHoldPlan.ts) and the go's bookkeeping -------
// NextHoldPlan imports "./NextHoldScoring" the way Lens Studio wants it (no extension); Node needs the ".ts"
import { registerHooks } from "node:module";
registerHooks({
  resolve(spec, ctx, next) {
    if (spec.startsWith("./") && !/\.[cm]?[jt]s$/.test(spec) && ctx.parentURL && ctx.parentURL.includes("/Assets/Scripts/")) return next(spec + ".ts", ctx);
    return next(spec, ctx);
  },
});
const N = await import("../Assets/Scripts/NextHoldPlan.ts");
{
  const ph = {}, tp = {};
  for (const h of HOLDS) if (PRESET_PROBLEM.includes(h.id)) { ph[h.id] = { x: h.x, y: h.y }; tp[h.id] = h.type; }
  const args = (cm, position) => ({ holds: ph, holdTypes: tp, position, reach: cm * 0.44, top: PRESET_TOP });
  const isTop = (m) => m.holdId === PRESET_TOP && P.HANDS.includes(m.limb);
  // follow the glow from the preset start, pinch by pinch, as a climber would (a pinch on the glowing hold moves
  // the glow's limb), until a hand is on the top; and the old greedy glow, for the record
  const follow = (cm, pick) => {
    let pos = { ...PRESET_POSITION }; const moves = [];
    for (let i = 0; i < 12; i++) {
      const g = pick(args(cm, pos));
      if (!g) return { moves, topped: false };
      moves.push(g.limb + ">" + g.holdId);
      pos = { ...pos, [g.limb]: g.holdId };
      if (isTop(g)) return { moves, topped: true };
    }
    return { moves, topped: false };
  };
  const heights = [150, 155, 160, 165, 170, 175, 180, 185, 190, 195, 200];
  const rows = heights.map((cm) => {
    const par = P.routeToTop(args(cm, { ...PRESET_POSITION }));
    const glow = follow(cm, (a) => N.plan(a).glow), greedy = follow(cm, (a) => P.bestMove(a));
    return { cm, par: par ? par.length : null, glow: glow.topped ? glow.moves.length : null, greedy: greedy.topped ? greedy.moves.length : null, path: glow.moves.join(" ") };
  });
  console.log("\n  following the glow, by height (par / new glow / old greedy glow):");
  for (const r of rows) console.log(`    ${r.cm} cm: par ${r.par}, glow ${r.glow}, greedy ${r.greedy}   ${r.path}`);
  check("session 26 (glow = plan): following the glow takes exactly par moves at all 11 heights, 150-200 cm",
    rows.every((r) => r.par !== null && r.glow === r.par), rows.map((r) => [r.cm, r.par, r.glow]));
  check("before the fix the greedy glow took more than par at some heights (the 5 vs 4 the card printed)",
    rows.some((r) => r.greedy > r.par), rows.map((r) => [r.cm, r.par, r.greedy]));
  const open = (cm) => N.plan(args(cm, { ...PRESET_POSITION }));
  check("the opening glow is unchanged at 155, 175 and 195 cm (RH to up = bestMove), and so is the 1-2-3 from the start",
    [155, 175, 195].every((cm) => { const p = open(cm), b = P.bestMove(args(cm, { ...PRESET_POSITION }));
      const s = P.sequence({ ...args(cm, { ...PRESET_POSITION }), limb: b.limb });
      return !p.planned && p.glow.limb === "RH" && p.glow.holdId === "up" && p.glow.limb === b.limb && p.glow.holdId === b.holdId && sameMoves(p.steps, s); }));
  check("the 155|195 split holds: step 2 is LH h09 at 155 and LH h10 at 195",
    open(155).steps[1].holdId === "h09" && open(195).steps[1].holdId === "h10" && open(155).steps[1].limb === "LH" && open(195).steps[1].limb === "LH");
  // the case the engineer found: after RH up, LH h09, LF lh at 175 the greedy glow was RF to rh; the plan tops out
  const k1pos = { ...PRESET_POSITION, RH: "up", LH: "h09", LF: "lh" };
  const k1 = N.plan(args(175, k1pos)), k1g = P.bestMove(args(175, k1pos));
  check("at 175 cm after LF to lh: the greedy best was RF to rh; the glow is now the top-out LH to h20, planned",
    k1g.limb === "RF" && k1g.holdId === "rh" && k1.planned && k1.glow.limb === "LH" && k1.glow.holdId === PRESET_TOP && k1.steps.length === 1, [k1g.limb + k1g.holdId, k1.glow.limb + k1.glow.holdId]);
  // every state a pinch can reach at 3 heights: the glow is a secure move, and its 1-2-3 starts with it
  let st = 0, bad = null;
  for (const cm of [150, 175, 200]) {
    const seen = new Set(), todo = [{ ...PRESET_POSITION }];
    while (todo.length && st < 4000) {
      const pos = todo.pop(), key = JSON.stringify(pos);
      if (seen.has(key)) continue;
      seen.add(key); st++;
      const p = N.plan(args(cm, pos));
      if (p.glow && (p.glow.score < 0.4 && p.planned || !p.steps.length || p.steps[0].holdId !== p.glow.holdId || p.steps[0].limb !== p.glow.limb)) bad = bad || { cm, pos };
      if ([pos.LH, pos.RH].includes(PRESET_TOP)) continue;
      for (const r of P.bestPerHold(args(cm, pos))) { const m = P.pinchMove({ ...args(cm, pos), holdId: r.holdId }); if (m.moves) todo.push({ ...pos, [m.limb]: r.holdId }); }
    }
  }
  check(`the 1-2-3 starts with the glow in every reachable state (${st} states at 150/175/200 cm), and a planned glow is secure`, bad === null && st > 100, bad);
  // rung 3's words
  // session 28: the Lens hands moveWhy the plan's second move (NextHoldMain.labelText)
  const w = (pos, cm, id, planned = false) => {
    const r = N.plan(args(cm, pos)); const n = r.steps[1];
    return N.moveWhy(r.glow, tp[r.glow.holdId], r.planned || planned, PRESET_TOP, n ? { limb: n.limb, holdId: n.holdId, holdType: tp[n.holdId] } : null);
  };
  check("rung 3 says why the move works: the opening RH to up \"jug, sets up LH to the pinch\" (the plan's next move, not \"in reach\"); \"the top\" for a top-out",
    w({ ...PRESET_POSITION }, 175) === "jug, sets up LH to the pinch" && w(k1pos, 175) === `${tp[PRESET_TOP]}, the top`, [w({ ...PRESET_POSITION }, 175), w(k1pos, 175)]);
  // session 28: "in reach" is never the why while the plan has a next move; a next move onto the top says "the top"
  {
    let bad = null, n = 0;
    for (const cm of [155, 175, 195]) for (const pos of [{ ...PRESET_POSITION }, { ...PRESET_POSITION, RH: "up" }, { ...PRESET_POSITION, RH: "up", LH: "h09" }, { ...PRESET_POSITION, RH: "up", LH: "h09", LF: "lh" }]) {
      const r = N.plan(args(cm, pos)); if (!r.glow) continue; n++;
      const s = w(pos, cm);
      if (r.steps[1] && /in reach/.test(s)) bad = bad || { cm, pos, s };
      if (r.steps[1] && r.steps[1].holdId === PRESET_TOP && /sets up/.test(s) && !/to the top$/.test(s)) bad = bad || { cm, pos, s };
    }
    check(`rung 3 never says "in reach" while the plan has a next move (${n} states at 155/175/195 cm)`, bad === null && n >= 9, bad);
  }
  check("moveWhy with nothing else to say: \"sets up LH to the pinch\", \"sets up LH to the top\", and \"in reach\" only with no next move",
    N.moveWhy({ holdId: "x", limb: "RH", parts: { highStep: 1, reachFactor: 1, balanceFactor: 1 } }, "jug", false, "t", { limb: "LH", holdId: "p", holdType: "pinch" }) === "jug, sets up LH to the pinch" &&
    N.moveWhy({ holdId: "x", limb: "LF", parts: { highStep: 1, reachFactor: 1, balanceFactor: 1 } }, "jug", false, "t", { limb: "LH", holdId: "t", holdType: "jug" }) === "jug, sets up LH to the top" &&
    N.moveWhy({ holdId: "x", limb: "RH", parts: { highStep: 1, reachFactor: 1, balanceFactor: 1 } }, "jug", false, "t") === "jug, in reach");
  check("moveWhy: a planned move \"saves a move\"; a stretch; a high step; a committing move",
    N.moveWhy({ holdId: "x", limb: "LF", parts: { highStep: 1, reachFactor: 1, balanceFactor: 1 } }, "crimp", true, "t") === "crimp, saves a move" &&
    N.moveWhy({ holdId: "x", limb: "LH", parts: { highStep: 1, reachFactor: 0.8, balanceFactor: 1 } }, "pinch", false, "t") === "pinch, a stretch" &&
    N.moveWhy({ holdId: "x", limb: "LF", parts: { highStep: 0.5, reachFactor: 0.5, balanceFactor: 1 } }, "pocket", false, "t") === "pocket, high step" &&
    N.moveWhy({ holdId: "x", limb: "RH", parts: { highStep: 1, reachFactor: 1, balanceFactor: 0.6 } }, null, false, "t") === "hold, committing");

  // the go's bookkeeping (engineer bugs 1-3, hound 3a-3d), with the beta module's own functions
  const S = "S", s0 = B.initialBeta(false, 0, 1, S);
  const up = (s, ...keys) => keys.reduce((x, k, i) => B.moved(x, i + 1, k, S), s);
  // engineer bug 1, the probe: fall, card hint, "?" to rung 2, Again
  const fell = B.steppedBack(up(s0, "A", "P"), false);
  const hinted = B.ask(B.takeHint(fell), false, false).state;
  const ag = B.again(hinted, false, 9, S);
  check("bug 1: fall, card hint, '?' to rung 2, Again: go 2 keeps its 2 hints (they were wiped)", ag.attempt === 2 && ag.hintsThisGo === 2 && hinted.hintsThisGo === 2, [ag.attempt, ag.hintsThisGo]);
  const seenAg = B.again(B.showBeta(fell), false, 9, S);
  check("bug 1: \"Show my beta\" after a fall, then Again: go 2 is still \"with beta\"", seenAg.betaSeenThisGo && !seenAg.betaShown && seenAg.attempt === 2);
  // the pin shows again at P in go 2 without counting twice; in go 3 it counts once more
  const atP = up(ag, "A", "P");
  check("a pinned hint showing again in the go it was counted in isn't counted twice", atP.hintStep === 2 && atP.hintsThisGo === 2, atP.hintsThisGo);
  const go3 = B.again(atP, false, 20, S), atP3 = up(go3, "A", "P");
  check("in a later go the pinned hint counts again, once (it is beta that go too)", go3.attempt === 3 && go3.hintsThisGo === 0 && atP3.hintStep === 2 && atP3.hintsThisGo === 2, [go3.attempt, atP3.hintsThisGo]);
  // hound 3a: climbing on after a fall is no send; back on the start holds is a fresh go
  const resumed = up(fell, "Q", "T");
  check("hound 3a: climbing on from the fall: not from the start; topping there ends no go", !resumed.fromStart && B.toppedOut(resumed).attempt === 2 && !B.toppedOut(resumed).fromStart);
  const restarted = B.moved(fell, 5, S, S);
  check("back on the start holds after a fall (no Again): a fresh go from the start, 0 moves, same go number", restarted.fromStart && restarted.moves === 0 && !B.isLive(restarted) && restarted.attempt === 2, restarted);
  check("a second fall while climbing on is no new go", B.steppedBack(B.moved(fell, 6, "Q", S), false).attempt === 2);
  // engineer bug 2: a height change in the middle of a go from the start ends it
  const mid = up(s0, "A");
  const hc = B.heightChanged(mid);
  check("bug 2: a height change mid-go ends the go (go 2 next), and climbing on from there isn't from the start",
    hc.attempt === 2 && !hc.fromStart && !B.isLive(hc) && B.heightChanged(s0) === s0, hc);
  // a top from the start ends the go; a hand off the top climbing back down to the start starts the next one there
  const topped = B.toppedOut(up(s0, "A", "T"));
  check("a top from the start ends go 1; climbing back to the start holds is go 2 from the start",
    topped.attempt === 2 && !topped.fromStart && B.moved(B.newAttempt(topped, false, 7), 8, S, S).fromStart);
  // engineer 3 / hound 3b: rung 1 breaks an onsight
  const r1 = B.ask(s0, false, false).state;
  check("hound 3b: rung 1 alone is a hint: the first go reads FLASH, not ONSIGHT", A.tickFor(r1.attempt, r1.betaSeenThisGo, r1.hintsThisGo) === "FLASH" && r1.hintsThisGo === 1);
  // session 27 (P1 item 11): start feet aren't marked with beta hidden unless the setter marked them
  check("item 11: beta hidden, a foot on its unmarked starting hold shows no marker; a hand always does",
    !B.footMarkerShown("LF", "lf", "lf", false, false) && !B.footMarkerShown("RF", "rf", "rf", false, false) && B.footMarkerShown("LH", "lh", "lh", false, false));
  check("item 11: the setter marked it as a start hold, or the foot moved, or beta is shown: the marker shows",
    B.footMarkerShown("LF", "lf", "lf", true, false) && B.footMarkerShown("LF", "lh", "lf", false, false) && B.footMarkerShown("LF", "lf", "lf", false, true));
}

// ---- 9. session 27: voice commands, scoped (Assets/Scripts/NextHoldVoice.ts) ---------------------------------
const V = await import("../Assets/Scripts/NextHoldVoice.ts");
{
  // session 28: "why" is on offer when "?" reads Why (askWord), not by a separate flag
  const all = { askOnScreen: true, againOnScreen: true, showBetaOnScreen: true, betaShown: false, askWord: "Why" };
  check("voice: the four words, as said in a gym (case, punctuation, a 'please')",
    V.matchCommand("Next hold?") === "nextHold" && V.matchCommand("next hold please") === "nextHold" && V.matchCommand("AGAIN!") === "again" &&
    V.matchCommand("show my beta") === "showBeta" && V.matchCommand("why?") === "why", ["Next hold?", "AGAIN!"].map(V.matchCommand));
  check("voice: chatter does nothing: too long, two commands at once, or no command",
    V.matchCommand("why'd you go left on that one mate") === null && V.matchCommand("again why") === null && V.matchCommand("nice send") === null &&
    V.matchCommand("") === null && V.matchCommand("hold") === null && V.matchCommand("show beta") === null);
  check("voice: only a final transcript acts", V.parseCommand("next hold", false, all) === null && V.parseCommand("next hold", true, all) === "nextHold");
  check("voice: 'again' only while Again is on screen; 'show my beta' only while its button is, beta hidden",
    V.parseCommand("again", true, { ...all, againOnScreen: false }) === null && V.parseCommand("again", true, all) === "again" &&
    V.parseCommand("show my beta", true, { ...all, showBetaOnScreen: false }) === null && V.parseCommand("show my beta", true, { ...all, betaShown: true }) === null);
  check("voice: 'why' exactly when '?' reads Why (session 28: also with the beta shown); 'next hold' only while '?' is on screen",
    V.parseCommand("why", true, { ...all, askWord: "Move" }) === null && V.parseCommand("why", true, { ...all, askWord: "Hint" }) === null &&
    V.parseCommand("why", true, all) === "why" && V.parseCommand("why", true, { ...all, betaShown: true }) === "why" &&
    V.parseCommand("next hold", true, { ...all, askOnScreen: false }) === null);
  check("voice: the chip echoes the words heard; the preview label says what stands in",
    V.chipText("nextHold") === "“next hold”" && V.chipText("again") === "“again”" && V.PREVIEW_VOICE_LABEL === "Preview: typed text stands in for speech" && V.CHIP_SECONDS === 1);
  // session 28 (v7.3 P1-5): the engineer's probe strings, word for word
  const probe = ["why’d you go left", "don't show my beta", "that's not the next hold", "go again", "again again", "that was a nice why", "don’t show my beta", "no, next hold"];
  check("voice: chatter the probe found firing does nothing (curly apostrophe, negation, a command under half of what was said)",
    V.matchCommand(probe[0]) === null && V.matchCommand(probe[1]) === null && V.matchCommand(probe[2]) === null && V.matchCommand(probe[5]) === null &&
    V.matchCommand(probe[6]) === null && V.matchCommand(probe[7]) === null, probe.map(V.matchCommand));
  check("voice: short commands with a word around them still work ('go again', 'next hold please', 'show my beta please')",
    V.matchCommand(probe[3]) === "again" && V.matchCommand("next hold please") === "nextHold" && V.matchCommand("show my beta please") === "showBeta" &&
    V.matchCommand("Why?") === "why");
}

// ---- 9b. session 28: the ASR source's restarts, with a fake AsrModule and a fake clock (NextHoldVoiceSource.ts) -----
const VS = await import("../Assets/Scripts/NextHoldVoiceSource.ts");
{
  const NO_NET = "NoInternet", AUTH = "Unauthenticated";
  const calls = [], queue = [];
  let opts = null;
  const api = {
    createOptions: () => { const u = [], e = []; opts = { silenceUntilTerminationMs: 750, onTranscriptionUpdateEvent: { add: (f) => u.push(f) }, onTranscriptionErrorEvent: { add: (f) => e.push(f) }, u, e }; return opts; },
    startTranscribing: () => calls.push("start"), stopTranscribing: () => calls.push("stop"), noInternet: NO_NET, unauthenticated: AUTH,
  };
  const schedule = (fn, s) => queue.push({ fn, s });
  const run = () => { const q = queue.splice(0); q.forEach((x) => x.fn()); return q.map((x) => x.s); };
  const heard = [], errors = [];
  const src = new VS.AsrVoiceSource(api, schedule);
  src.start((t, f) => heard.push(t + (f ? "." : "…")), (w) => errors.push(w));
  const s0 = calls.join();
  opts.u.forEach((f) => f({ text: "next", isFinal: false }));
  opts.u.forEach((f) => f({ text: "next hold", isFinal: true }));
  const afterFinal = calls.join(), waits0 = queue.map((x) => x.s);
  const r0 = run(), afterRun = calls.join();
  check("ASR (fake module): listens at start; a partial passes on; a final passes on, ends the session, and listens again on the next frame (not inside the callback)",
    s0 === "start" && heard.join() === "next…,next hold." && afterFinal === "start,stop" && waits0.join() === "0" && r0.join() === "0" && afterRun === "start,stop,start",
    { s0, heard, afterFinal, waits0, afterRun });
  const waits = [];
  for (let i = 0; i < 8; i++) { opts.e.forEach((f) => f(i === 0 ? NO_NET : AUTH)); waits.push(...run()); }
  check("ASR (fake module): after an error it says why and tries again after 1, 2, 4, 8, 16, then every 30 s",
    errors[0] === "no network" && errors[1] === "not signed in" && waits.join() === "1,2,4,8,16,30,30,30" && src.getFailures() === 8, { errors: errors.slice(0, 2), waits });
  opts.u.forEach((f) => f({ text: "again", isFinal: true })); run();
  opts.e.forEach((f) => f(NO_NET)); const w1 = run();
  check("ASR (fake module): a transcript resets the wait (the next error waits 1 s again)", w1.join() === "1", w1);
  src.stop(); opts.e.forEach((f) => f(NO_NET)); const nStart = calls.filter((c) => c === "start").length; run();
  check("ASR (fake module): after stop() nothing listens again", calls.filter((c) => c === "start").length === nStart && queue.length === 0);
  const e2 = []; new VS.AsrVoiceSource(null, schedule).start(() => {}, (w) => e2.push(w));
  check("ASR: where the module can't load, it says so", e2.join() === "speech recognition isn't available here", e2);
}

// ---- 10. v8 (session 29): height from eye height, your path against the shortest, your time after the top -----
const E = await import("../Assets/Scripts/NextHoldEyeHeight.ts");
{
  // the ratio and the snapping (engineer §1): 163 -> 175, 166 -> 180 (the preview's own eye), 157 -> 170
  const p = (eye) => E.proposeHeight(E.statureFromEye(eye));
  check("eye height: 163 cm -> 175, 166 -> 180, 157 -> 170 (stature = eye / 0.935, snapped to 5 cm)",
    p(163).cm === 175 && p(166).cm === 180 && p(157).cm === 170 && !p(163).clamped, [p(163), p(166), p(157)]);
  // session 30 (the hound): the ratio is 0.935 (adult tables 0.933-0.937), not 0.93; 161 cm tells them apart
  // (161 / 0.935 = 172.2 -> 170, 161 / 0.93 = 173.1 -> 175)
  check("eye height: EYE_RATIO is 0.935; 161 cm -> 170 (0.93 would give 175), 163.6 -> 175",
    E.EYE_RATIO === 0.935 && p(161).cm === 170 && p(163.6).cm === 175, [E.EYE_RATIO, p(161), p(163.6)]);
  check("eye height: outside 140-210 cm of stature is no proposal (sitting, crouching, a bench); inside it, held to 150-200",
    p(120) === null && p(125) === null && E.proposeHeight(139.9) === null && E.proposeHeight(210.1) === null && E.proposeHeight(NaN) === null &&
    E.proposeHeight(142).cm === 150 && E.proposeHeight(142).clamped && E.proposeHeight(208).cm === 200 && E.proposeHeight(208).clamped,
    [p(120), E.proposeHeight(142), E.proposeHeight(208)]);
  // the sampler, fed at 30 frames a second
  const feed = (st, from, secs, f) => {
    let s = st;
    for (let t = from; t < from + secs - 1e-9; t += 1 / 30) s = E.pushSample(s, { t, pitchDeg: 0, rollDeg: 0, onMats: true, goLive: false, x: 0, z: 250, ...f(t) });
    return s;
  };
  const lvl = (eye) => () => ({ eyeCm: eye });
  const s19 = feed(E.initialEye(), 0, 1.9, lvl(163));
  const s21 = feed(s19, 1.9, 0.2, lvl(163));
  check("sampler: nothing before the 2.0 s window is full; then 175 from a level, still head at 163 cm",
    s19.proposal === null && s19.last === "window filling" && s21.proposal === 175 && Math.abs(s21.eyeCm - 163) < 1e-9, [s19.proposal, s21.proposal]);
  const pitched = feed(E.initialEye(), 0, 4, () => ({ eyeCm: 163, pitchDeg: 15 }));
  const rolled = feed(E.initialEye(), 0, 4, () => ({ eyeCm: 163, rollDeg: 10 }));
  const pitch10 = feed(E.initialEye(), 0, 2.2, () => ({ eyeCm: 163, pitchDeg: -10 }));
  check("sampler: a head pitched 15° or rolled 10° is ignored (4 s of it); 10° of pitch still counts",
    pitched.proposal === null && pitched.last === "head pitched" && rolled.proposal === null && rolled.last === "head rolled" && pitch10.proposal === 175,
    [pitched.last, rolled.last, pitch10.proposal]);
  const bob = feed(E.initialEye(), 0, 4, (t) => ({ eyeCm: 163 + 2 * Math.sin(t * 6) }));
  const walk = feed(E.initialEye(), 0, 4, (t) => ({ eyeCm: 163, x: 10 * t }));
  const stroll = feed(E.initialEye(), 0, 2.2, (t) => ({ eyeCm: 163, x: 3 * t }));
  check("sampler: a moving head (±2 cm) or walking (10 cm/s) gives nothing; 3 cm/s of sway still counts",
    bob.proposal === null && bob.last === "head moving" && walk.proposal === null && walk.last === "walking" && stroll.proposal === 175, [bob.last, walk.last, stroll.proposal]);
  const crouch = feed(E.initialEye(), 0, 4, lvl(106));
  check("sampler: a steady crouch (eye 106 cm, stature 114) changes nothing", crouch.proposal === null && crouch.last === "implausible", crouch.last);
  const low = feed(E.initialEye(), 0, 2.5, lvl(140));
  const up = feed(low, 2.5, 3, (t) => ({ eyeCm: t < 3 ? 140 + (t - 2.5) * 46 : 163 }));
  const up3 = feed(low, 2.5, 3, lvl(143));
  const down = feed(s21, 2.1, 3, lvl(150));
  check("sampler: after a half crouch (140 cm: 150) standing up to 163 revises to 175; under 4 cm higher or any lower never revises",
    low.proposal === 150 && up.proposal === 175 && up3.proposal === 150 && down.proposal === 175, [low.proposal, up.proposal, up3.proposal, down.proposal]);
  const frozen = feed(E.freezeEye(s19), 1.9, 3, lvl(163));
  const frozenAfter = feed(E.freezeEye(s21), 2.1, 3, lvl(180));
  check("sampler: frozen (the first move, a manual − / +) it takes nothing more, before or after a proposal",
    frozen.proposal === null && frozen.frozen && frozenAfter.proposal === 175, [frozen.proposal, frozenAfter.proposal]);
  const live = feed(E.initialEye(), 0, 4, () => ({ eyeCm: 163, goLive: true }));
  const wall = feed(E.initialEye(), 0, 4, () => ({ eyeCm: 163, onMats: false }));
  const broken = feed(feed(E.initialEye(), 0, 1.5, lvl(163)), 1.5, 0.1, () => ({ eyeCm: 163, pitchDeg: 30 }));
  const restart = feed(broken, 1.6, 1.9, lvl(163));
  check("sampler: nothing while a go is under way or off the mats; a pitched frame starts the window again",
    live.proposal === null && live.last === "go under way" && wall.proposal === null && restart.proposal === null && feed(restart, 3.5, 0.2, lvl(163)).proposal === 175);
  check("precedence: kept > manual this session > eye > Inspector (kept 165 plus a proposal of 180 gives 165)",
    E.heightSource(165, null, 180, 175).cm === 165 && E.heightSource(165, null, 180, 175).source === "kept" &&
    E.heightSource(null, 170, 180, 175).source === "manual" && E.heightSource(null, null, 180, 175).cm === 180 &&
    E.heightSource(null, null, 180, 175).source === "eye" && E.heightSource(null, null, null, 175).source === "inspector");
  check("the planned line: \"Planned for 175 cm\" / \"from your eye height\"; in the preview \"Preview: the camera's height stands in\"; any other source one line",
    E.plannedText(175, "eye", false) === "Planned for 175 cm\nfrom your eye height" &&
    E.plannedText(175, "eye", true) === "Planned for 175 cm\nPreview: the camera's height stands in" &&
    ["kept", "manual", "inspector"].every((src) => E.plannedText(165, src, true) === "Planned for 165 cm"));
}
{
  // change 2: where a go left the shortest (NextHoldPlan.splitMove over routeDist)
  const ph = {}, tp = {};
  for (const h of HOLDS) if (PRESET_PROBLEM.includes(h.id)) { ph[h.id] = { x: h.x, y: h.y }; tp[h.id] = h.type; }
  const args = (cm, position) => ({ holds: ph, holdTypes: tp, position, reach: cm * 0.44, top: PRESET_TOP });
  const memo = new Map();
  const dist = (cm) => (pos) => {
    const k = cm + ":" + B.positionKey(pos);
    if (!memo.has(k)) memo.set(k, N.routeDist(args(cm, pos)));
    return memo.get(k);
  };
  const walkMoves = (moves) => { const out = [{ ...PRESET_POSITION }]; for (const [l, h] of moves) out.push({ ...out[out.length - 1], [l]: h }); return out; };
  const greedy = (cm) => {
    const out = [{ ...PRESET_POSITION }];
    for (let i = 0; i < 12; i++) {
      const pos = out[out.length - 1];
      if (P.HANDS.some((l) => pos[l] === PRESET_TOP)) break;
      const g = P.bestMove(args(cm, pos)); if (!g) break;
      out.push({ ...pos, [g.limb]: g.holdId });
    }
    return out;
  };
  const toppedPos = { ...PRESET_POSITION, LH: PRESET_TOP };
  const raw = P.routeToTop(args(155, toppedPos));
  check("routeDist: topped counts 0 (routeToTop from a topped position plans another climb)",
    N.routeDist(args(155, toppedPos)) === 0 && raw && raw.length > 0 && N.routeDist(args(175, { ...PRESET_POSITION })) === 4, raw && raw.length);
  const g155 = greedy(155), g175 = greedy(175), g195 = greedy(195);
  const seqOf = (ps, cm) => ps.map((q) => dist(cm)(q));
  console.log(`  old greedy line, distance to the top after each move: 155 cm ${seqOf(g155, 155).join(",")}, 175 cm ${seqOf(g175, 175).join(",")}, 195 cm ${seqOf(g195, 195).join(",")}`);
  check("split: 155 cm following the old greedy glow is at par (5): no split, though its last step reads 1 -> topped",
    g155.length - 1 === dist(155)(g155[0]) && N.splitMove(g155, dist(155)) === null, seqOf(g155, 155));
  check("split: 175 cm and 195 cm following the old greedy glow (one over par): split at move 4",
    g175.length - 1 === 5 && N.splitMove(g175, dist(175)) === 4 && N.splitMove(g195, dist(195)) === 4, [seqOf(g175, 175), seqOf(g195, 195)]);
  const k6 = walkMoves([["RH", "up"], ["LH", "h09"], ["LF", "lh"], ["RF", "rh"], ["LH", "h20"]]);
  check("split: k6's climb at 175 (RH up, LH h09, LF lh, RF rh, LH h20) splits at move 4 (RF to rh)",
    N.splitMove(k6, dist(175)) === 4 && dist(175)(k6[5]) === 0, seqOf(k6, 175));
  // every secure climb of exactly par moves from the start (each move green or yellow, a pinch could make it):
  // none is told it split, whichever shortest route it took
  const secureFrom = (cm, pos) => {
    const out = [];
    for (const l of P.LIMBS) for (const id of Object.keys(ph)) {
      if (Object.values(pos).includes(id)) continue;
      const r = P.scoreHold({ limb: l, holdId: id, holds: ph, holdTypes: tp, position: pos, reach: cm * 0.44, top: PRESET_TOP });
      if (r.colour !== "red") out.push({ ...pos, [l]: id });
    }
    return out;
  };
  let parClimbs = 0, parSplits = 0, routesSeen = new Set(), overClimbs = 0, overNoSplit = 0;
  for (const cm of [155, 175, 195]) {
    const par = dist(cm)(PRESET_POSITION);
    const go = (path) => {
      const pos = path[path.length - 1], n = path.length - 1;
      if (dist(cm)(pos) === 0) {
        if (n === par) { parClimbs++; routesSeen.add(cm + ":" + path.map((q) => B.positionKey(q)).join(">")); if (N.splitMove(path, dist(cm)) !== null) parSplits++; }
        else { overClimbs++; if (N.splitMove(path, dist(cm)) === null) overNoSplit++; }
        return;
      }
      if (n >= par + 1) return;
      // only moves that can still top out within par + 1 (the search is exhaustive within that budget)
      for (const q of secureFrom(cm, pos)) if (dist(cm)(q) <= par - n) go(path.concat([q]));
    };
    go([{ ...PRESET_POSITION }]);
  }
  console.log(`  secure climbs from the start at 155/175/195 cm: ${parClimbs} at par (${routesSeen.size} distinct), ${overClimbs} one over par`);
  check("split: every secure climb at par (any shortest route, not just the planner's) has no split; every one over par has one",
    parClimbs > 3 && parSplits === 0 && overClimbs > 0 && overNoSplit === 0, { parClimbs, parSplits, overClimbs, overNoSplit });
  const D = { a: 3, b: Infinity, c: 2, d: 1, e: 0 };
  check("split: a dead end (no route from there) is the split; fewer than two positions has none",
    N.splitMove(["a", "b", "c", "d", "e"], (k) => D[k]) === 1 && N.splitMove(["a", "c", "d", "e"], (k) => D[k]) === null && N.splitMove(["a"], (k) => D[k]) === null);
  const over = A.cardLines({ tick: "SEND", go: 2, moves: 5, hints: 0 }, 4, null, 4);
  check("card over the shortest: \"5 moves · shortest 4 · split at move 4\"; at par unchanged (\"4 moves · the shortest for you\"), with or without a split",
    over[1] === "5 moves · shortest 4 · split at move 4" && over[2] === "No hints · sent! Again in 4?" &&
    A.cardLines({ tick: "SEND", go: 2, moves: 4, hints: 0 }, 4, null, null)[1] === "4 moves · the shortest for you" &&
    A.cardLines({ tick: "SEND", go: 2, moves: 4, hints: 0 }, 4, null, 2)[1] === "4 moves · the shortest for you", over);
  const holdNames = Object.keys(ph).concat(["LH", "RH", "LF", "RF", "L hand", "R hand", "L foot", "R foot", "jug", "pinch", "crimp", "sloper", "pocket"]);
  check("card: the split line names no move, hold or limb, and fits one line (under 40 characters)",
    !holdNames.some((w) => new RegExp("\\b" + w + "\\b").test(over[1])) && over[1].length < 40, over[1].length);
}
{
  // change 3: the time after the top
  check("clock: m:ss in whole seconds: 102 -> 1:42, 7 -> 0:07, 59.9 -> 0:59, 600 -> 10:00",
    A.clockText(102) === "1:42" && A.clockText(7) === "0:07" && A.clockText(59.9) === "0:59" && A.clockText(600) === "10:00" && A.clockText(-3) === "0:00");
  check("time line: \"1:42 start to top · best 1:31\"; the first or a faster one \"· new best\"",
    A.timeLine(102, 91) === "1:42 start to top · best 1:31" && A.timeLine(102, null) === "1:42 start to top · new best" &&
    A.timeLine(80, 91) === "1:20 start to top · new best" && A.timeLine(91, 91) === "1:31 start to top · best 1:31");
  const withS = { goes: 0, best: { tick: "SEND", go: 2, moves: 4, hints: 0 }, secs: 91.24 };
  check("the best record keeps the fastest time as \"s\" (0.1 s), and reads it back",
    A.encodeRecord(withS) === '{"g":0,"b":{"t":"SEND","n":2,"m":4,"h":0},"s":91.2}' && A.decodeRecord(A.encodeRecord(withS)).secs === 91.2);
  check("a legacy record (no \"s\") reads as before, and a record with no time encodes exactly as before",
    A.decodeRecord('{"g":0,"b":{"t":"SEND","n":2,"m":4,"h":0}}').secs === undefined &&
    A.encodeRecord({ goes: 3, best: { tick: "SEND", go: 3, moves: 7, hints: 1 } }) === '{"g":3,"b":{"t":"SEND","n":3,"m":7,"h":1}}' &&
    A.decodeRecord('{"g":0,"b":null,"s":"x"}').secs === undefined && A.decodeRecord('{"g":0,"b":null,"s":-1}').secs === undefined);
  check("time never ranks a go: better() is unchanged by time (a slower clean send still beats a faster beta'd one)",
    A.better({ tick: "SEND", go: 2, moves: 4, hints: 0 }, { tick: "SEND", go: 2, moves: 4, hints: 1 }) && A.isNewBestTime(80, 91) && !A.isNewBestTime(95, 91) && A.isNewBestTime(95, undefined));
  // the clock and the path in the beta module
  const s0 = B.initialBeta(false, 0, 1, "S");
  const m1 = B.moved(s0, 10, "P1", "S"), m2 = B.moved(m1, 14, "P2", "S");
  check("go clock: starts at the go's first move from the start, not at the open (10 s, not 0), and doesn't restart on later moves",
    s0.goFrom === null && m1.goFrom === 10 && m2.goFrom === 10, [s0.goFrom, m1.goFrom, m2.goFrom]);
  check("path: grows by the position after each move", JSON.stringify(m2.path) === '["P1","P2"]' && s0.path.length === 0, m2.path);
  const fell = B.steppedBack(m2, false);
  const on = B.moved(fell, 30, "P3", "S");
  check("a fall stops the clock (a top climbed on from there gets no time) and keeps the path",
    fell.goFrom === null && on.goFrom === null && !on.fromStart && JSON.stringify(on.path) === '["P1","P2","P3"]', [fell.goFrom, on.goFrom, on.path]);
  const back = B.moved(on, 40, "S", "S"), first = B.moved(back, 45, "P1", "S");
  check("back on the start holds: a fresh go, path empty, clock starts again on its first move",
    back.fromStart && back.path.length === 0 && back.goFrom === null && first.goFrom === 45 && JSON.stringify(first.path) === '["P1"]');
  const ag = B.again(m2, false, 50, "S"), ag1 = B.moved(ag, 52, "P1", "S");
  const top = B.toppedOut(m2);
  check("Again clears the clock and the path; the next go's clock starts on its first move; a top keeps the path",
    ag.goFrom === null && ag.path.length === 0 && ag1.goFrom === 52 && JSON.stringify(top.path) === '["P1","P2"]');
  const hc = B.heightChanged(m2);
  check("a height change mid-go stops the clock (that go ended)", hc.goFrom === null && !hc.fromStart);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
