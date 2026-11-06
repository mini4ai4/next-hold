# Next Hold

A bouldering coach for SPECS that colours the holds you can reach next, right on the wall: green, yellow or red,
worked out from where your body is right now. One ring glows with a short label, "R hand": that's the move.

Built for **Learn AR with SPECS** with Lens Studio 5.23.2, CLAD and the Lens Studio MCP.

## Open it
1. Open `NextHold.esproj` in Lens Studio 5.23.2 (sign in, so SIK, UI Kit and LEAF load).
2. Press Preview. It opens with your beta hidden: from the mats the problem's holds have a plain outline with START
   and TOP, and on the wall you see only where your hands and feet are. Four big buttons while climbing on the mats
   ("Show my beta", pinch again to hide it; "?"; Body; Setup), two on the wall ("?" and Body, a strip at the side of
   your hands, never below them); every button is 11 × 10 cm with a 2.2 cm label, and Setup's − / + are full-size
   buttons too. "?" gives a hint one step at a time, and its word says what the next pinch gives (Hint, Move, Why;
   the dots under it fill as you go): the holds in reach, then the next move, then why that move works, under its
   label ("R hand" / "jug, in reach"). Every step counts as a hint. The glow follows the plan: following it takes
   par moves (the planner's shortest secure route for your height). Step back off the wall after a move and the Lens
   shows "Came off at move N" with two buttons side by side, [Hint · move N] and [Again], while the hold you came off
   from pulses; a hint taken there stays with that position until you make that move. Top out and, once "TOPPED"
   fades, the result card takes the panel's place: "SEND · go 2" (ONSIGHT, FLASH or SEND on your first top of the
   problem, REPEAT after), your moves against your par, and your hints with the problem's tick. Goes are counted per
   problem; your best is kept per problem and height. Climbing on after a fall without going back to the start
   holds tops out as "TOPPED · not from the start", with no tick. Pinch a hold: the best limb for it moves there (on
   the glowing hold, the glow's limb), and every ring recolours. Green is a solid ring, yellow
   dashed, red has one gap. If no limb has a green or yellow move to that hold, nothing moves: its ring pulses and the
   why-line says "OUT OF REACH", or "STEP 1 FIRST" on a hold with a "2 · LH" or "3 · LF" tag (those holds wear a
   plain outline: the tag isn't a grip colour). To move another limb, pinch Body and pick it (LH, RH, LF, RF: the
   panel shows "Limb override: LF" until the next move; it too moves only on green or yellow). Setup holds the rest:
   "Mark holds" marks your problem (pinch a hold to add it, set its type, Start and Top in any order, then Done; pinch
   it again to change or Remove it), the Ground / On wall switch, − and + for your height (150–200 cm, kept for next
   time; "Planned for 175 cm" shows under the panel), and Done. Reach follows the height, so the colours and the 1-2-3
   change for a taller or shorter climber (at 155 cm step 2 is the pinch h09, from 185 cm the jug h10).
3. Walk back with WASD past 1.2 m and the Lens shows **Ground**: every ring of the problem, the next moves as
   "2 · LH", "3 · LF" (each tag its own blue badge, so a ring's colour only ever means the grip for you), and "TOP". Walk in under 80 cm
   and it shows **On wall**: one ring, its label, and a stick figure for your body (hidden in Ground). The Ground / On wall switch (in Setup) overrides until you next cross one of those distances.
4. To record the demo, select the `DemoAutopilot` object, tick **Play On Start** and refresh the preview: 3 s later
   the Lens plays VIDEO_PLAN scenes 0–8 by itself (about 2:20) and prints "SCENE n start t=…" to the Logger. Untick it
   when done. The timeline is `Assets/Scripts/Demo/DemoTimeline.ts`. It starts from 175 cm with a fresh in-memory
   store, so nothing kept in the preview changes the take, and the take keeps nothing.

## Tests
- LEAF: open the LEAF panel and run all thirty-five scenarios (one per done criterion in `devpost/design-brief.md`, one per review fix, h1–h5 and e1 for beta on request and the tag's outline, g1 for the control count, k1–k3 for the result card, Again, the pinned hint and what is kept, the k4/k5 pair for a kept height on reopen (run k4 then k5), and d1 for the demo autopilot).
  The raw output of the last full run (35 of 35 pass, session 24): `devpost/LEAF_RUN_2026-11-05_s24.txt`, copied out of
  the Lens Studio log with `node tests/extract_leaf_run.mjs <log> <first line>`. `node tests/leaf_wait.mjs <id>` waits
  for one scenario's result in the log when the run call times out.
- Scoring port, plan, beta and attempt logic: `node tests/scoring.port.test.mjs` (163 checks, including the 1-2-3 search
  against a brute force, following the glow = par at all 11 heights from 150 to 200 cm (`NextHoldPlan.ts`), the hint
  ladder, cue, came-off, goes and pinned-hint rules of `NextHoldBeta.ts`, and the ticks, card lines, best and fail-safe
  store of `NextHoldAttempt.ts`). The store keeps about 70 bytes a record, so the preview's 100 KB store holds about
  1,300 problem × height records; past that nothing more is kept (no eviction).
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
- `devpost/visual/`: v6 screenshots (3 Nov); v7 in `visual/v7/` (see its INDEX). Neither is the session-26 build:
  the v7 shots predate the v7.2 cards, labels and wall strip, and haven't been retaken.

## What's stood in
The preview can't see a real wall or track a body, so hold recognition is a setup mode and body position is stood in by
pinches: pinch a hold and the limb with the best move to it goes there (LH/RH/LF/RF, behind Body, are an override).
Coming off is stood in by the eye: on the wall (under 80 cm) and then back past 120 cm. The logic is proven in tests and the preview; how it feels on a real wall needs real SPECS.

Green never means "safe". It means "a secure grip for you, from where you are now".

## License
MIT, see `LICENSE`. Lens Studio templates and packages keep their own terms.
