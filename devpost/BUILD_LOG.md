# How Next Hold was built with CLAD

Every session below ran CLAD (the `ls-clad` plugin, `lens-studio-router` skill) against this project through the
Lens Studio MCP. Times and costs are from each session's own log.

| # | Date | What we asked | What CLAD did | Tools used | Time | Cost |
|---|---|---|---|---|---|---|
| 0 | 27 Oct | Plan the lens with `plan-lens` from our interview answers | Eight-turn interview; caught four real gaps (limbs need a stand-in; scoring per limb vs best move across all four; occupied holds; what "done" means). Wrote `devpost/design-brief.md` (status: approved) | — | — | ~$6 |
| 1 | 27 Oct | Build the brief | Stopped at the readiness gate: Lens Studio wasn't signed in, and SIK, UI Kit and LEAF need it. No files changed | 7 | 0.4 min | $0.62 |
| 2 | 27 Oct | Build the brief (signed in) | Built the lens: wall, holds, rings, limb markers, control row, type picker, why-line, off-view arrow. Ported the scoring reference to TypeScript (18 checks pass). Wrote one LEAF scenario per done criterion plus an IK reach scenario. **6 of 6 pass** | 302 | 49.8 min | $17.42 |
| 3 | 27 Oct | Frame the start pose in view | Measured the preview's field of view (about ±18° vertical, ±16° horizontal). Moved the wall to 320 cm, which broke 2 LEAF tests, so it left the change uncommitted for us to decide | 44 | 6.8 min | $2.39 |
| 4 | 27 Oct | Fit both hands at 100–110 cm | Showed it can't be done: the SPECS display is about 49 × 66 cm at 100 cm and the hands are 60 cm apart. Changed nothing | 25 | 5.4 min | $1.48 |
| 5 | 27 Oct | Frame the right hand, the suggestion and the control row | Moved only the wall root to (−10.5, −166, −125), about 115 cm, the closest distance where they all fit. **6 of 6 pass** | 44 | 8.0 min | $2.39 |
| 6 | 27 Oct | Visual pass: the wall disappeared on an additive display | Lit birch-ply wall, shaped holds, glowing rings; light colours that survive additive blending. **6 of 6 pass** | 159 | 28.8 min | $9.04 |
| 7 | 28–29 Oct | Five fixes from a strict review: mark your problem, upward goal, sequence preview, why-line wording, control row in view | Changed the plain-JS reference first (11→22 checks), then the port (18→42). Committed items 1–4 with a LEAF scenario each. Stopped before the last run when Lens Studio froze on a plugin permission dialog | — | 37.5 min | $11.54 |
| 8 | 29 Oct | Finish session 7 | Found that the compile failure came from a preview-helper package auto-updated to a newer SIK than the lens uses; parked it (not deleted). Committed item 5. Caught that C4's setup no longer found an off-view suggestion in one move after the scoring changes, and widened it to three. **11 of 11 pass**; checked that r5 fails with the old placement | — | 7.5 min | $2.82 |
| 9 | 29 Oct | Two viewing modes (Ground / On wall) and a stick figure, from the review's distance flaw | One button switches what is shown, same state, same frame. A thin light figure joins the limbs at the centre of mass. Its own 180 cm viewpoint check **failed honestly**: only 6 of 10 holds fit | — | 18.0 min | $7.82 |
| 10 | 29 Oct | Find where the whole problem fits | Made the check strict (whole rings inside the view) and scanned in 1 cm steps: **3.65 m**, not 3 m. Sized Ground for that distance; the figure fades where it passes behind the control row. **14 of 14 pass** | — | 17.8 min | $6.70 |
| 11 | 29 Oct | Ground looked huge at the preset 125 cm | Ground now sizes itself from the real camera-to-wall distance every frame (110–365 cm), so rings look the same wherever you stand. **14 of 14 pass** | — | 10.6 min | $4.55 |
| 12 | 29 Oct | The glow's ring ran through ghost number 1 | Found the cause: overlays write no depth, so the engine sorted them itself. Set the draw order outright (glow and rings, path, badges, numbers on top). Badges move clear of the glow and of each other; a dotted path joins 1 → 2 → 3. r3 and a2 project badges and glow onto the screen. Both checks **failed when broken on purpose**. **14 of 14 pass** | — | 21 min | not logged |
| 13 | 29 Oct | A strict judge pass (7.7): fix the distance story, badges, view switch, On-wall label, Ground panels | Reframed reading the problem as climbers do it: from 2.5 m, two head positions (lower half, upper half) cover all 10 rings (a2). Dropped badge 1 (the glow is step 1); badges "2 · LH", "3 · RF" are pinned on their own ring, with a new on-screen attribution check. The view now switches by itself under 80 cm / over 120 cm, the button overrides until the next crossing (new a3). On wall keeps its label. In Ground the control row and why-line scale with distance, the row sits beside the problem, and the top hold says "TOP". Each new check **failed when broken on purpose**. **15 of 15 pass** | — | ~50 min | not logged |
| 14 | 29 Oct | Judge plan items 7 and 8: feet must not use arm reach; let the climber set their height in the Lens | Feet now reach from the hip (half a reach below the lower hand) with 1.25 × the arm's reach; a foot above the hip is a "HIGH STEP" and falls to red 27 cm above it. Hands unchanged. Reference first (22→27 checks), then the port (42→48) and the test's own rule copy; C3 now reads "out of reach" per limb. A fourth panel row, "− Height 175 cm +", 150–200 cm in 5 cm steps, recolours in the same frame. Look-ahead step 3 became LF → lh (also a 40 cm rock-over, now scored from the hip). New r6 (same hold green at 190 cm hands, red with HIGH STEP at 172) and r7 (h09 green at 175, yellow at 150). Port check and r7 **failed when broken on purpose**. **17 of 17 pass** | — | ~45 min | not logged |

Sessions 3, 4, 9–10 and 13 are the ones we learned most from: the field of view, not the scoring, decides the design. On the wall the view holds about one hold. From the mats you read the problem the way climbers do, looking up and down it from about 2.5 m: the rings stay on the holds, so the whole problem never has to fit in one view.

## LEAF, last full run (29 Oct, session 14)

| Scenario | Done criterion | Result |
|---|---|---|
| `c1-open-rings` | At open, each free hold has one ring matching the reference rule; occupied holds show only a marker | pass |
| `c2-pinch-move` | Pinching a hold moves the limb, rings recompute the same frame, best limb auto-selected | pass |
| `c3-reach-and-jug` | Out of reach is red (a hand's arm reach, a foot's leg reach and high step); a jug within 80% of reach, above the centre of mass, both feet on, is green | pass |
| `c4-suggestion-label-arrow` | The suggestion glows with a short label; off-view, an edge arrow and a chime | pass |
| `c5-ask-why` | "?" then a ring gives the reason in plain words | pass |
| `extra-ik-reach-controls` | The reach model and the controls stay consistent | pass |
| `r1-mark-problem` | Setup marks which holds are in your problem, with a start and a top; the rest dim; outside setup only "TOP" shows, in Ground | pass |
| `r2-upward-goal` | Among similar moves, the one that gets you higher and nearer the top ranks better | pass |
| `r3-sequence-preview` | Step 1 is the glow; badges "2 · LH", "3 · RF" update the same frame; on screen each badge's nearest ring is its own (by ≥ 2 cm) and its text names the limb; the path stays clear of the glow and the label | pass |
| `r4-why-wording` | The why-line names the hold type in capitals ("PINCH HOLD"), never as a gesture; "HIGH STEP" is one of its words | pass |
| `r5-control-row-in-view` | On wall: the whole panel is in the straight-ahead view. Ground: the panel and why-line are x D/110, the panel sits beside the problem (no ring under it) and is fully in view with the head turned to it (125 and 250 cm); "TOP" above the top hold | pass |
| `r6-foot-reach` | Hands at 190 cm: the right foot to a jug 40 cm under them (at the hip) renders green. Right hand down to 172 cm: the same jug is 16.5 cm above the hip and renders red, "JUG HOLD · HIGH STEP". 48 rings match the rule; hand rings also match the plain arm rule | pass |
| `r7-height` | "Height − / +" with real pinches: 175 → 150 in the pinch's own frame turns h09 green → yellow for the same position and limb; reach 77 → 66; the range stops at 150 and 200; every ring matches the rule at that height | pass |
| `a1-view-modes` | On wall leaves exactly one ring (the suggestion) and keeps its label in full; Ground restores every ring with unchanged colours and still fades the label; sizes match the real distance | pass |
| `a2-ground-scan-250` | From 2.5 m back, a look at the lower half and one at the upper half together hold every whole ring of the problem (6 + 6 of 10, 10 of 10 covered); badges still attributed from there | pass |
| `a3-auto-view` | Moving the eye across 80 cm / 120 cm switches On wall / Ground, with hysteresis; the button overrides until the next crossing | pass |
| `b1-stick-figure` | After a limb moves, the figure's ends sit on the limbs in the same frame; it fades behind the panel On wall | pass |

`node tests/scoring.port.test.mjs` → `48 passed, 0 failed`. The plain-JavaScript reference: `node devpost/scoring-reference/scoring.test.js` → 27 of 27.

The LEAF tests drive real SIK pinches, read state in the same frame, check the rendered ring colour against an
independent copy of the reference rule, and check off-view with `camera.isSphereVisible`.
