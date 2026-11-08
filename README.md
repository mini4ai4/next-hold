# Next Hold

A bouldering coach for SPECS that colours the holds you can reach next, right on the wall: green, yellow or red,
worked out from where your body is right now. One ring glows with a short label, "R hand": that's the move.

Built for **Learn AR with SPECS** with Lens Studio 5.23.2, CLAD and the Lens Studio MCP.

## Open it
1. Open `NextHold.esproj` in Lens Studio 5.23.2 (sign in, so SIK, UI Kit and LEAF load).
2. Press Preview. It opens with your beta hidden: from the mats the problem's holds have a plain outline with START
   and TOP, and on the wall you see only where your hands and feet are. Four big buttons while climbing on the mats
   ("Show my beta", pinch again to hide it; "?"; Body; Setup), two on the wall ("?" and Body, a strip at the side of
   your hands, not below them when a clear place is in view; otherwise just under the glow). Every button is
   11 × 10 cm (the came-off card's hint button 16 cm); labels are 2.2 cm tall, "?" and − / + 4 cm, "Show my beta" and
   the Ground / On wall switch 1.7 cm. On the mats the panel follows your head, 60 cm out and low in view (its centre
   at least 5° below your line of sight), and moves once you turn more than 8°, step more than 10 cm, or it has slid
   out of view. It never gets smaller than a readable size ("?" about 4.5° wide). It keeps off the glow and the
   beta's words first, then off the problem's rings and START/TOP, then off other holds, as far as the view allows;
   from 2.5 m looking up with your beta shown no place in view is clear of the glow, so it waits just below your view
   until you glance down. With beta hidden, START marks your feet only where the setter marked start feet. "?" gives
   a hint one step at a time, and its word says what the next pinch gives (Hint, Move, Why; the dots under it fill as
   you go; after the third step there is no word, since a fourth pinch gives nothing new): the holds in reach, then
   the next move with its limb word, then why that move works, by its hold ("R hand" / "jug, sets up LH" / "to the
   pinch": what the move is for, from the plan). Every step counts as a hint. With your beta shown "?" reads Why and
   has no dots: "?" then a ring says why. The glow follows the plan: following it takes the fewest secure moves for
   your height. Step back off the wall after a move and the Lens shows "Came off from here" over two buttons side by
   side, [Hint · move N] and [Again], while the hold you came off from pulses; a hint taken there stays with that
   position until you make that move, and Again stays where it was. Top out and, once "TOPPED" fades, the result card
   takes the panel's place, with Again on its plate: "SEND · go 2" (ONSIGHT, FLASH or SEND on your first top of the
   problem, REPEAT after), "4 moves · the shortest for you" (nobody can beat the shortest secure route, so over it the
   line says "shortest for you: 4"), and your hints with a nudge on a first top ("1 hint · sent! Again without it?")
   or the problem's tick on a repeat. Goes are counted per
   problem; your best is kept per problem and height. Climbing on after a fall without going back to the start
   holds tops out as "TOPPED · not from the start", with no tick. Pinch a hold: the best limb for it moves there (on
   the glowing hold, the glow's limb), and every ring recolours. Green is a solid ring, yellow
   dashed, red has one gap. If no limb has a green or yellow move to that hold, nothing moves: its ring pulses and the
   why-line says "OUT OF REACH", or "STEP 1 FIRST" on a hold with a "2 · LH" or "3 · LF" tag (those holds wear a
   plain outline: the tag isn't a grip colour). To move another limb, pinch Body and pick it (LH, RH, LF, RF: the
   panel shows "Limb override: LF" until the next move; it too moves only on green or yellow). Setup holds the rest:
   "Mark holds" marks your problem (pinch a hold to add it, set its type, Start and Top in any order, then Done; pinch
   it again to change or Remove it), the Ground / On wall switch, Done, and − and + for your height over the line
   "Your height: 175 cm" (150–200 cm, kept for next time; the climb page says "Planned for 175 cm"). Reach follows the height, so the colours and the 1-2-3
   change for a taller or shorter climber (at 155 cm step 2 is the pinch h09, from 185 cm the jug h10).
3. Walk back with WASD past 1.2 m and the Lens shows **Ground**; with your beta shown that is every ring of the
   problem, the next moves as "2 · LH", "3 · LF" (each tag its own blue badge, so a ring's colour only ever means the
   grip for you), and "TOP". Walk in under 80 cm and it shows **On wall**: with your beta shown, one ring, its label,
   and a stick figure for your body (hidden in Ground). The Ground / On wall switch (in Setup) overrides until you next cross one of those distances.
4. To record the demo: in the preview, reset the camera and pitch it up 25° (MovePreviewCamera, or drag the preview
   view up), so only the preview scene's sky is behind the wall (below its horizon its floor and grid show through the
   additive display as a dark band); select the `DemoAutopilot` object, tick **Play On Start** and refresh: 3 s later
   the Lens plays the v7 take by itself (`Assets/Scripts/Demo/DemoTimelineV7.ts`, 2:00) and prints "SCENE n start
   t=…" to the Logger. It opens as the Lens opens, beta hidden: the hidden read, Show my beta, 155 | 195 in Setup,
   the quiet wall, "next hold" typed (the chip says so), "?" twice, two moves and off the wall ("Came off from
   here"), the card's hint, Again, go 2 to the top, and the card "SEND · go 2 / 4 moves · the shortest for you /
   1 hint · sent! Again without it?" for the last 5.7 s. Untick it when done. It starts from 175 cm with a fresh
   in-memory store, so nothing kept in the preview changes the take, and the take keeps nothing. (The older v4 take,
   the full read from its first frame, is kept for LEAF d1: tick **Legacy V4 Take**.)

## Tests
- LEAF: open the LEAF panel and run all thirty-seven scenarios (one per done criterion in `devpost/design-brief.md`, one per review fix, h1–h5 and e1 for beta on request and the tag's outline, g1 for the control count, k1–k3 for the result card, Again, the pinned hint and what is kept, the k4/k5 pair for a kept height on reopen (run k4, refresh, then k5), v1 for voice on the preview's typed path, d1 for the v4 demo autopilot and d2 for the v7 one).
  `x1-capture` is also listed: it is the screenshot driver for `devpost/visual/v7_3/`, not a test.
  The raw output of the last full run (37 of 37 pass, session 28, one clean run on one build): `devpost/LEAF_RUN_2026-11-06_s28.txt`, copied out of
  the Lens Studio log with `node tests/extract_leaf_run.mjs <log> <first line>`. `node tests/leaf_wait.mjs <id>` waits
  for one scenario's result in the log when the run call times out; `node tests/leaf_status.mjs <first line>` lists
  every scenario's last verdict since then. Run LEAF in the preview (`onDevice: false`).
- Scoring port, plan, beta and attempt logic: `node tests/scoring.port.test.mjs` (182 checks, including the voice parser, the 1-2-3 search
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
- `devpost/visual/`: v6 screenshots (3 Nov); v7 in `visual/v7/`; the current build (session 28) in `visual/v7_3/`,
  S01–S12, taken through the real Lens with real pinches (see its INDEX for poses and what was hidden while shooting).

## What's stood in
The preview can't see a real wall or track a body, so hold recognition is a setup mode and body position is stood in by
pinches: pinch a hold and the limb with the best move to it goes there (LH/RH/LF/RF, behind Body, are an override).
Coming off is stood in by the eye: on the wall (under 80 cm) and then back past 120 cm. The logic is proven in tests and the preview; how it feels on a real wall needs real SPECS.

Voice is four words, each a button already on screen: "next hold" and "why" (both "?"; "why" while "?" reads Why),
"show my beta", "again". Only short, final phrases count, and only while that button is showing; "don't…", "not…"
and chatter where the word is under half of what was said do nothing. When a word changes something, a 1 s chip by
the button it pressed echoes it. On SPECS it uses Snap's speech recognition (`AsrModule`), which runs only on
Spectacles; its API reports a "no internet" status (`NoInternet`) without a network, and Snap's ASR page doesn't say
whether it always needs one. It has been tried only with typed text in the preview, never on a device. While the Lens
runs the microphone stays on (listening starts again after every phrase); after an error the Lens says "voice
paused" by "?" and tries again after 1, 2, 4 … 30 s. In the preview, where `AsrModule` doesn't run, typed text stands
in for speech and the chip says so. An "again!" shouted by a friend while Again is up does what Again does: back to the
start holds, and the fall has already ended that go.

Green never means "safe". It means "a secure grip for you, from where you are now".

## License
MIT, see `LICENSE`. Lens Studio templates and packages keep their own terms.
