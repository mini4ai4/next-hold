// Unit check for the TypeScript port (Assets/Scripts/NextHoldScoring.ts).
// Run from the project root:  node tests/scoring.port.test.mjs
// (Node 22.6+ strips the TS types natively.)
//
// 1. Re-runs the reference checks from devpost/scoring-reference (colour rule and
//    upward goal) against the port.
// 2. Equivalence: port == reference for every hold x every limb x several top holds on the Lens wall.
// 3. bestMove(): returns the max-rank (limb, hold) across all four limbs.
// 4. Demo layout: the preset problem shows green, yellow and red from the start.
// 5. sequence(): the 2-3 move look-ahead over bestMove behind the numbered ghost rings.
import { createRequire } from "node:module";
import * as P from "../Assets/Scripts/NextHoldScoring.ts";
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
const WHY_FORM = /^[A-Z]+ HOLD( · (LONG REACH|OUT OF REACH|COMMITTING BALANCE))*$/;
check("every why is capitals in the form \"<TYPE> HOLD · ...\" (no lowercase \"pinch\")",
  ev.results.concat(gEv.results, [pinRes, lowRes]).every((r) => WHY_FORM.test(r.why)));

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
let chainOk = true, chainPos = { ...wPos };
for (const m of seq) {
  const b = P.bestMove({ ...seqArgs, position: chainPos });
  if (!b || b.limb !== m.limb || b.holdId !== m.holdId || b.rank !== m.rank) chainOk = false;
  chainPos = { ...chainPos, [m.limb]: m.holdId };
}
check("every step is bestMove from the position the earlier steps leave", chainOk);
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

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
