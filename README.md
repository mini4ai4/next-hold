# Next Hold

A bouldering coach for SPECS that colours the holds you can reach next, right on the wall: green, yellow or red,
worked out from where your body is right now. One ring glows with a short label, "R hand": that's the move.

Built for **Learn AR with SPECS** with Lens Studio 5.23.2, CLAD and the Lens Studio MCP.

## Open it
1. Open `NextHold.esproj` in Lens Studio 5.23.2 (sign in, so SIK, UI Kit and LEAF load).
2. Press Preview. Pick a limb (LH, RH, LF, RF), pinch a hold, and every ring recolours. Pinch "?" and then a ring for
   the reason. "Setup" marks your problem: pinch a hold to add it, set its type, Start and Top in any order, then
   Done (pinch it again to change or Remove it). "Height − / +" sets your height (150–200 cm); reach follows it, so
   the colours and the 1-2-3 change for a taller or shorter climber (at 155 cm step 2 is the pinch h09, from 185 cm
   the jug h10).
3. Walk back with WASD past 1.2 m and the Lens shows **Ground**: every ring of the problem, the next moves as
   "2 · LH", "3 · LF" (each tag, and the ring under it, in its own move's colour), and "TOP". Walk in under 80 cm
   and it shows **On wall**: one ring, its label, and a stick figure for your body (hidden in Ground). The Ground / On wall button overrides until you next cross one of those distances.
4. To record the demo, select the `DemoAutopilot` object, tick **Play On Start** and refresh the preview: 3 s later
   the Lens plays VIDEO_PLAN scenes 0–7 by itself (about 2:15) and prints "SCENE n start t=…" to the Logger. Untick it
   when done. The timeline is `Assets/Scripts/Demo/DemoTimeline.ts`.

## Tests
- LEAF: open the LEAF panel and run all eighteen scenarios (one per done criterion in `devpost/design-brief.md`, one per review fix, and d1 for the demo autopilot).
  The raw output of the last full run (18 of 18 pass, session 17): `devpost/LEAF_RUN_2026-10-29_s17.txt`, copied out of
  the Lens Studio log with `node tests/extract_leaf_run.mjs <log> <first line>`.
- Scoring port: `node tests/scoring.port.test.mjs` (57 checks, including the 1-2-3 search against a brute force).
- Reference rule, written before the build: `node devpost/scoring-reference/scoring.test.js` (27 checks). This is
  pre-written design code; CLAD ported it to TypeScript.

## What's in here
- `Assets/Scripts/`: the lens (Main owns the state; the views are passive).
- `devpost/design-brief.md`: the approved plan from `plan-lens`.
- `devpost/BUILD_LOG.md`: every CLAD session, what it did, and the LEAF results.
- `devpost/DEVPOST.md`, `devpost/VIDEO_PLAN.md`: the write-up and the video plan.
- `devpost/visual/`: screenshots from the current build (Ground from 1.85 m and from 2.5 m, the 1-2-3 at 155 and
  195 cm, On wall, the height row).

## What's stood in
The preview can't see a real wall or track a body, so hold recognition is a setup mode and body position is four
limb toggles. The logic is proven in tests and the preview; how it feels on a real wall needs real SPECS.

Green never means "safe". It means "a secure grip for you, from where you are now".

## License
MIT, see `LICENSE`. Lens Studio templates and packages keep their own terms.
