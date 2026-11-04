// Validates that the scoring rule produces the colours the brief's done-criteria
// promise. Run: node scoring.test.js
const S = require("./scoring");

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log("  ok  " + name); }
  else { fail++; console.log(" FAIL " + name + (extra ? "  -> " + JSON.stringify(extra) : "")); }
}

const REACH = 77; // 175 cm climber, reach = height * 0.44

// A small demo wall (cm). Feet low, hands mid; candidates spread up and out.
const holds = {
  lf:   { x: 95,  y: 40 },   rf:  { x: 145, y: 45 },   // feet
  lh:   { x: 90,  y: 150 },  rh:  { x: 150, y: 150 },  // hands
  up:   { x: 140, y: 190 },  // a jug up and right, within 80% reach of the RH shoulder
  far:  { x: 250, y: 215 },  // way out right, out of reach
  side: { x: 35,  y: 150 },  // across the body to the far left
  low:  { x: 150, y: 95 },   // below the hands
};
const holdTypes = {
  lf: "jug", rf: "jug", lh: "jug", rh: "jug",
  up: "jug", far: "jug", side: "crimp", low: "sloper",
};
const position = { LH: "lh", RH: "rh", LF: "lf", RF: "rf" };

// Done-criterion #4a: jug within 80% reach, both feet placed, above COM = GREEN.
const upRes = S.scoreHold({ limb: "RH", holdId: "up", holds, holdTypes, position, reach: REACH });
check("jug in reach, feet planted, above COM -> green", upRes.colour === "green", upRes);

// Done-criterion #4b: a hold beyond reach is ALWAYS red.
const farRes = S.scoreHold({ limb: "RH", holdId: "far", holds, holdTypes, position, reach: REACH });
check("out-of-reach hold -> red", farRes.colour === "red" && farRes.parts.reachFactor === 0, farRes);

// Crossing the body to a crimp costs -> not green.
const sideRes = S.scoreHold({ limb: "RH", holdId: "side", holds, holdTypes, position, reach: REACH });
check("cross-body crimp -> not green", sideRes.colour !== "green", sideRes);

// A sloper below the COM with a foot lifted -> red (low quality x poor balance).
const oneFoot = { ...position, RF: null };
const lowRes = S.scoreHold({ limb: "RH", holdId: "low", holds, holdTypes, position: oneFoot, reach: REACH });
check("sloper below COM, foot off -> red", lowRes.colour === "red", lowRes);

// reachFactor bands.
check("reachFactor comfortable (0.5R) = 1.0", S.reachFactor(0.5 * REACH, REACH) === 1.0);
check("reachFactor at 100% = 0.6", Math.abs(S.reachFactor(REACH, REACH) - 0.6) < 1e-9);
check("reachFactor beyond = 0", S.reachFactor(1.3 * REACH, REACH) === 0);
check("colour thresholds", S.colourFor(0.7) === "green" && S.colourFor(0.4) === "yellow" && S.colourFor(0.39) === "red");

// Done-criterion #2/#3: every unoccupied hold gets exactly one colour, and a best move is picked.
const ev = S.evaluate({ holds, holdTypes, position, limb: "RH", reach: REACH });
const allColoured = ev.results.every((r) => ["green", "yellow", "red"].includes(r.colour));
check("every candidate hold gets one colour", allColoured);
check("a best next move is suggested and in reach", ev.suggestion && ev.suggestion.score > 0, ev.suggestion);
check("suggestion is the jug 'up'", ev.suggestion && ev.suggestion.holdId === "up", ev.suggestion);

// ---- the upward goal (a top hold) -------------------------------------------
// No top hold: the goal is neutral, so everything above is unchanged.
check("no top hold: goalFactor 1, rank = score", upRes.parts.goalFactor === 1 && upRes.rank === upRes.score, upRes);

// Two jugs both in comfortable reach of the RH shoulder, above the COM, no crossing:
// same grip, same score. With a top hold up the wall, the higher one ranks better.
const gHolds = { ...holds, hiJug: { x: 165, y: 175 }, loJug: { x: 165, y: 125 }, top: { x: 150, y: 280 } };
const gTypes = { ...holdTypes, hiJug: "jug", loJug: "jug", top: "jug" };
const hi = S.scoreHold({ limb: "RH", holdId: "hiJug", holds: gHolds, holdTypes: gTypes, position, reach: REACH, top: "top" });
const lo = S.scoreHold({ limb: "RH", holdId: "loJug", holds: gHolds, holdTypes: gTypes, position, reach: REACH, top: "top" });
check("same-grip jugs: equal score, the higher one nearer the top ranks better",
  hi.score === lo.score && hi.rank > lo.rank, { hi: hi.rank, lo: lo.rank });
check("the goal never changes the colour (both jugs stay green)", hi.colour === "green" && lo.colour === "green");
const gEv = S.evaluate({ holds: gHolds, holdTypes: gTypes, position, limb: "RH", reach: REACH, top: "top" });
// three green jugs (up at y 190, hiJug 175, loJug 125): the higher, the better ranked
const gRank = {};
for (const r of gEv.results) gRank[r.holdId] = r.rank;
check("with a top hold, green jugs rank by height: up > hiJug > loJug, suggestion up",
  gRank.up > gRank.hiJug && gRank.hiJug > gRank.loJug && gEv.suggestion && gEv.suggestion.holdId === "up", gRank);
check("colour is still grip x reach x balance for every hold", gEv.results.every((r) => r.colour === S.colourFor(r.score)));
check("goalFactor stays within 0.5..1", gEv.results.every((r) => r.parts.goalFactor >= 0.5 && r.parts.goalFactor <= 1));

// Out of reach stays red even when the hold IS the top: the goal can't lift it.
const farTop = S.scoreHold({ limb: "RH", holdId: "far", holds, holdTypes, position, reach: REACH, top: "far" });
check("out of reach stays red and ranks 0, even as the top hold",
  farTop.colour === "red" && farTop.score === 0 && farTop.rank === 0 && farTop.parts.goalFactor > 0.75, farTop);

// ---- the "why" line wording --------------------------------------------------
// The hold type is written "<TYPE> HOLD" in capitals, so "pinch" reads as a hold
// type, never as a gesture instruction ("pinch this").
check("why for a jug in comfortable reach: \"JUG HOLD\"", upRes.why === "JUG HOLD", upRes.why);
const wHolds = { ...holds, pin: { x: 138, y: 201 } }; // ~70 cm from the RH shoulder: a stretch
const wTypes = { ...holdTypes, pin: "pinch" };
const pinRes = S.scoreHold({ limb: "RH", holdId: "pin", holds: wHolds, holdTypes: wTypes, position, reach: REACH });
check("why for a pinch at a stretch: \"PINCH HOLD · LONG REACH\"", pinRes.why === "PINCH HOLD · LONG REACH", pinRes.why);
check("why for the far cross-body crimp: \"CRIMP HOLD · OUT OF REACH · COMMITTING BALANCE\"",
  sideRes.why === "CRIMP HOLD · OUT OF REACH · COMMITTING BALANCE", sideRes.why);
const WHY_FORM = /^[A-Z]+ HOLD( · (LONG REACH|OUT OF REACH|HIGH STEP|COMMITTING BALANCE))*$/;
check("every why is capitals in the form \"<TYPE> HOLD · ...\" (no lowercase \"pinch\")",
  ev.results.concat(gEv.results, [pinRes, lowRes]).every((r) => WHY_FORM.test(r.why)));

// ---- feet reach from the hip, not with the arm's reach (session 14) -----------
// Hands high (both at 190), feet still low. The hip hangs HIP_DROP x reach (38.5 cm)
// below the lower hand: y 151.5.
const fHolds = { ...holds, hiL: { x: 115, y: 190 }, hiR: { x: 140, y: 190 },
                 rock: { x: 150, y: 150 },   // 40 cm below the hands: a rock-over
                 high: { x: 150, y: 172 } }; // ~20 cm above the hip, 18 cm below the hands
const fTypes = { ...holdTypes, hiL: "jug", hiR: "jug", rock: "jug", high: "jug" };
const hiHands = { LH: "hiL", RH: "hiR", LF: "lf", RF: "rf" };
const comHi = { x: (115 + 140 + 95 + 145) / 4, y: (190 + 190 + 40 + 45) / 4 };
const hip = S.hipOf("RF", hiHands, fHolds, comHi, REACH);
check("the hip hangs 0.5 x reach below the lower hand, 10 cm to the foot's side",
  Math.abs(hip.y - (190 - 0.5 * REACH)) < 1e-9 && Math.abs(hip.x - (comHi.x + 10)) < 1e-9, hip);
const rock = S.scoreHold({ limb: "RF", holdId: "rock", holds: fHolds, holdTypes: fTypes, position: hiHands, reach: REACH });
check("foot: a rock-over 40 cm below the hands is green, measured from the hip with leg reach (1.25 x 77)",
  rock.colour === "green" && rock.parts.limbReach === 1.25 * REACH && rock.parts.highStep === 1 &&
  Math.abs(rock.parts.dist - Math.hypot(150 - hip.x, 150 - hip.y)) < 1e-9, rock);
const high = S.scoreHold({ limb: "RF", holdId: "high", holds: fHolds, holdTypes: fTypes, position: hiHands, reach: REACH });
check("foot: a jug ~20 cm above the hip is hard (red), and the why says HIGH STEP",
  high.colour === "red" && high.parts.highStep < 0.4 && high.why === "JUG HOLD · HIGH STEP", high);
check("high step: 1 at or below the hip, 0 from 0.35 x reach above it",
  S.highStepFactor({ y: hip.y }, hip, REACH) === 1 && S.highStepFactor({ y: hip.y - 50 }, hip, REACH) === 1 &&
  S.highStepFactor({ y: hip.y + 0.351 * REACH }, hip, REACH) === 0 &&
  Math.abs(S.highStepFactor({ y: hip.y + 0.175 * REACH }, hip, REACH) - 0.5) < 1e-9);
// the same holds for a hand: arm reach from the shoulder, no high step (hands unchanged)
check("hands are unchanged: arm reach from the shoulder, no high step",
  upRes.parts.limbReach === REACH && upRes.parts.highStep === 1 &&
  Math.abs(upRes.parts.dist - Math.hypot(140 - (120 + 18), 190 - (96.25 + 35))) < 1e-9, upRes.parts);

// ---- a pinch only makes a green or yellow move (session 21) -------------------
const pm = (holdId, override = null, top = null, h = holds, t = holdTypes, p = position, reach = REACH) =>
  S.pinchMove({ holdId, holds: h, holdTypes: t, position: p, reach, top, override });
check("a hold red for every limb is refused", pm("far").moves === false && pm("far").result.colour === "red", pm("far"));
const topFar = pm("top", null, "top", gHolds, gTypes);
check("the top hold out of reach from the start is refused, however good the goal", topFar.moves === false, topFar);
check("no override: the best limb moves", pm("up").moves === true && pm("up").limb === "RH", pm("up"));
const redOver = pm("up", "LF");
check("an override whose move is red is refused, though another limb could make the move",
  redOver.moves === false && redOver.limb === "LF" && pm("up").moves === true, redOver);
const goodOver = pm("up", "LH");
check("an override whose move is green moves that limb, not the best limb",
  goodOver.moves === true && goodOver.limb === "LH" && goodOver.result.colour !== "red", goodOver);
// A red move can outrank a yellow one: the goal only ranks. (150 cm climber: reach 66.)
const hHolds = { h10: { x: 72, y: 216 }, rh: { x: 150, y: 150 }, up: { x: 140, y: 190 }, rf: { x: 145, y: 45 },
                 h16: { x: 70, y: 72 }, h20: { x: 98, y: 252 } };
const hTypes = { h10: "jug", rh: "jug", up: "jug", rf: "jug", h16: "crimp", h20: "jug" };
const hPos = { LH: "h10", RH: "rh", LF: "up", RF: "rf" };
const hArgs = { holdId: "h16", holds: hHolds, holdTypes: hTypes, position: hPos, reach: 66, top: "h20" };
const hRed = S.scoreHold({ ...hArgs, limb: "RF" }), hYellow = S.scoreHold({ ...hArgs, limb: "LF" });
check("the case exists: a red move outranks a yellow one to the same hold",
  hRed.colour === "red" && hYellow.colour === "yellow" && hRed.rank > hYellow.rank, { hRed, hYellow });
const hMove = S.pinchMove(hArgs);
check("then the yellow move is made: the hold isn't refused while a limb can make the move",
  hMove.moves === true && hMove.limb === "LF" && S.bestLimbFor(hArgs).limb === "LF", hMove);
// every hold, every position: refused exactly when no limb has a green or yellow move
let pmOk = true;
for (const p of [position, oneFoot, { ...position, LH: null }, hiHands]) {
  for (const id of Object.keys(fHolds)) {
    if (Object.values(p).includes(id)) continue;
    const a = { holdId: id, holds: fHolds, holdTypes: fTypes, position: p, reach: REACH };
    const any = ["LH", "RH", "LF", "RF"].some((limb) => S.scoreHold({ ...a, limb }).colour !== "red");
    if (S.pinchMove(a).moves !== any) pmOk = false;
  }
}
check("refused exactly when no limb has a green or yellow move (4 positions x all holds)", pmOk);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
