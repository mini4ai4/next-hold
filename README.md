# Next Hold

A bouldering coach for SPECS that colours the holds you can reach next, right on the wall: green, yellow or red,
worked out from where your body is right now. One ring glows with a short label, "R hand": that's the move.

Built for **Learn AR with SPECS** with Lens Studio 5.23.2, CLAD and the Lens Studio MCP.

## Open it
1. Open `NextHold.esproj` in Lens Studio 5.23.2 (sign in, so SIK, UI Kit and LEAF load).
2. Press Preview. Pick a limb (LH, RH, LF, RF), pinch a hold, and every ring recolours. Pinch "?" and then a ring for
   the reason. "Setup" retypes a hold.

## Tests
- LEAF: open the LEAF panel and run all eleven scenarios (one per done criterion in `devpost/design-brief.md`, plus one per review fix).
- Scoring port: `node tests/scoring.port.test.mjs` (42 checks).
- Reference rule, written before the build: `node devpost/scoring-reference/scoring.test.js` (22 checks). This is
  pre-written design code; CLAD ported it to TypeScript.

## What's in here
- `Assets/Scripts/`: the lens (Main owns the state; the views are passive).
- `devpost/design-brief.md`: the approved plan from `plan-lens`.
- `devpost/BUILD_LOG.md`: every CLAD session, what it did, and the LEAF results.
- `devpost/DEVPOST.md`, `devpost/VIDEO_PLAN.md`: the write-up and the video plan.

## What's stood in
The preview can't see a real wall or track a body, so hold recognition is a setup mode and body position is four
limb toggles. The logic is proven in tests and the preview; how it feels on a real wall needs real SPECS.

Green never means "safe". It means "a secure grip for you, from where you are now".
