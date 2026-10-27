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

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
