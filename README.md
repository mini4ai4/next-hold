# Next Hold

A bouldering coach for SPECS that colours the holds you can reach next, right on the wall: green, yellow or red,
worked out from where your body is right now. One ring glows with a short label, "R hand": that's the move.

Built for **Learn AR with SPECS** with Lens Studio 5.23.2, CLAD and the Lens Studio MCP.

## Open it
1. Open `NextHold.esproj` in Lens Studio 5.23.2 (sign in, so SIK, UI Kit and LEAF load).
2. Press Preview. It opens with your beta hidden: from the mats the problem's holds have a plain outline with START
   and TOP, and on the wall you see only where your hands and feet are. Pinch "Show my beta" for the full read below,
   or pinch "?" for a hint, one step at a time: the holds in reach, then the next move, then why. Step back off the
   wall after a move and the Lens offers "Came off at move N. Hint for that move?". Pinch a hold: the best limb for it moves there, and every ring recolours. Green is a solid ring, yellow
   dashed, red has one gap. If no limb has a green or yellow move to that hold, nothing moves: its ring pulses and the
   why-line says "OUT OF REACH", or "STEP 1 FIRST" on a hold with a "2 · LH" or "3 · LF" tag. To move another limb, pick it first (LH, RH, LF, RF: the panel shows "Limb override: LF"
   until the next move; it too moves only on green or yellow). Pinch "?" and then a ring for
   the reason. "Setup" marks your problem: pinch a hold to add it, set its type, Start and Top in any order, then
   Done (pinch it again to change or Remove it). "Height − / +" sets your height (150–200 cm); reach follows it, so
   the colours and the 1-2-3 change for a taller or shorter climber (at 155 cm step 2 is the pinch h09, from 185 cm
   the jug h10).
3. Walk back with WASD past 1.2 m and the Lens shows **Ground**: every ring of the problem, the next moves as
   "2 · LH", "3 · LF" (each tag its own blue badge, so a ring's colour only ever means the grip for you), and "TOP". Walk in under 80 cm
   and it shows **On wall**: one ring, its label, and a stick figure for your body (hidden in Ground). The Ground / On wall button overrides until you next cross one of those distances.
4. To record the demo, select the `DemoAutopilot` object, tick **Play On Start** and refresh the preview: 3 s later
   the Lens plays VIDEO_PLAN scenes 0–8 by itself (about 2:20) and prints "SCENE n start t=…" to the Logger. Untick it
   when done. The timeline is `Assets/Scripts/Demo/DemoTimeline.ts`.

## Tests
- LEAF: open the LEAF panel and run all twenty-nine scenarios (one per done criterion in `devpost/design-brief.md`, one per review fix, h1–h5 and e1 for beta on request and the tag's badge, and d1 for the demo autopilot).
  The raw output of the last full run (29 of 29 pass, session 23): `devpost/LEAF_RUN_2026-11-05_s23.txt`, copied out of
  the Lens Studio log with `node tests/extract_leaf_run.mjs <log> <first line>`.
- Scoring port and beta logic: `node tests/scoring.port.test.mjs` (100 checks, including the 1-2-3 search against a brute
  force and the hint ladder, cue and came-off rules of `NextHoldBeta.ts`).
- How often height changes the plan: `node tests/measure_heights.mjs 300 7` runs the Lens's own planner on 300 random
  problems (seeded). On the problems both a 155 cm and a 195 cm climber can finish, their 1-2-3 differs in 184 of 192
  (95.8%). Over ten seeds (1, 2, 3, 5, 7, 11, 13, 23, 42, 99) it ranges from 92.7% (seed 11) to 96.7% (seed 42),
  and the very first move differs in 38–55%.
- Reference rule, written before the build: `node devpost/scoring-reference/scoring.test.js` (35 checks). This is
  pre-written design code; CLAD ported it to TypeScript.

## What's in here
- `Assets/Scripts/`: the lens (Main owns the state; the views are passive).
- `devpost/design-brief.md`: the approved plan from `plan-lens`.
- `devpost/BUILD_LOG.md`: every CLAD session, what it did, and the LEAF results.
- `devpost/DEVPOST.md`, `devpost/VIDEO_PLAN.md`: the write-up and the video plan.
- `devpost/visual/`: screenshots from the current build (Ground from 1.85 m and from 2.5 m, the 1-2-3 at 155 and
  195 cm, On wall, the height row).

## What's stood in
The preview can't see a real wall or track a body, so hold recognition is a setup mode and body position is stood in by
pinches: pinch a hold and the limb with the best move to it goes there (LH/RH/LF/RF are an override). The logic is proven in tests and the preview; how it feels on a real wall needs real SPECS.

Green never means "safe". It means "a secure grip for you, from where you are now".

## License
MIT, see `LICENSE`. Lens Studio templates and packages keep their own terms.
