// How often do two climbers of different height get a different 1-2-3 on the same problem?
// Random problems on the 240 × 300 cm wall (seeded, reproducible), the Lens's own planner (NextHoldScoring.ts).
// Run: node tests/measure_heights.mjs [problems=300] [seed=7]
import * as P from "../Assets/Scripts/NextHoldScoring.ts";
const N = +(process.argv[2] || 300); let seed = +(process.argv[3] || 7);
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const TYPES = ["jug", "jug", "crimp", "pinch", "pocket", "sloper"];
let solvable = 0, both3 = 0, differ = 0, differFirst = 0;
for (let n = 0; n < N; n++) {
  const holds = {}, holdTypes = {};
  const put = (id, x, y, t) => { holds[id] = { x, y }; holdTypes[id] = t; };
  // start: two feet low, two hands at chest height, the top near the top of the wall
  put("lf", 80 + rnd() * 20, 30 + rnd() * 20, "jug"); put("rf", 140 + rnd() * 20, 30 + rnd() * 20, "jug");
  put("lh", 80 + rnd() * 20, 130 + rnd() * 20, "jug"); put("rh", 140 + rnd() * 20, 130 + rnd() * 20, "jug");
  put("top", 60 + rnd() * 120, 270 + rnd() * 20, "jug");
  const k = 10 + Math.floor(rnd() * 6);
  for (let i = 0; i < k; i++) put("h" + i, 20 + rnd() * 200, 40 + rnd() * 230, TYPES[Math.floor(rnd() * TYPES.length)]);
  const position = { LH: "lh", RH: "rh", LF: "lf", RF: "rf" };
  const at = (h) => ({ holds, holdTypes, reach: h * 0.44, position, top: "top" });
  const b155 = P.bestMove(at(155)), b195 = P.bestMove(at(195));
  if (!b155 || !b195) continue;
  const r155 = P.fullRoute({ ...at(155), limb: b155.limb }), r195 = P.fullRoute({ ...at(195), limb: b195.limb });
  if (!r155 || !r195) continue;
  solvable++;
  const s155 = P.sequence({ ...at(155), limb: b155.limb }), s195 = P.sequence({ ...at(195), limb: b195.limb });
  if (s155.length === 3 && s195.length === 3) {
    both3++;
    const key = (s) => s.map((m) => m.limb + ">" + m.holdId).join(" ");
    if (key(s155) !== key(s195)) differ++;
    if (s155[0].limb + s155[0].holdId !== s195[0].limb + s195[0].holdId) differFirst++;
  }
}
const pct = (a, b) => b ? (100 * a / b).toFixed(1) + "%" : "–";
console.log(`problems ${N}, solvable for both heights ${solvable}, with a three-move plan for both ${both3}`);
console.log(`155 cm vs 195 cm: different 1-2-3 in ${differ} of ${both3} (${pct(differ, both3)}); different first move in ${differFirst} (${pct(differFirst, both3)})`);
