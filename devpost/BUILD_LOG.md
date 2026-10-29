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

Sessions 3 and 4 are the ones we learned most from: the field of view, not the scoring, decides the design.

## LEAF, last full run (27 Oct, 16:23)

| Scenario | Done criterion | Result |
|---|---|---|
| `c1-open-rings` | At open, each free hold has one ring matching the reference rule; occupied holds show only a marker | pass |
| `c2-pinch-move` | Pinching a hold moves the limb, rings recompute the same frame, best limb auto-selected | pass |
| `c3-reach-and-jug` | Out of reach is red; a jug within 80% of reach, above the centre of mass, both feet on, is green | pass |
| `c4-suggestion-label-arrow` | The suggestion glows with a short label; off-view, an edge arrow and a chime | pass |
| `c5-ask-why` | "?" then a ring gives the reason in plain words | pass |
| `extra-ik-reach-controls` | The reach model and the controls stay consistent | pass |

`node tests/scoring.port.test.mjs` → `18 passed, 0 failed`. The plain-JavaScript reference: `node devpost/scoring-reference/scoring.test.js` → 11 of 11.

The LEAF tests drive real SIK pinches, read state in the same frame, check the rendered ring colour against an
independent copy of the reference rule, and check off-view with `camera.isSphereVisible`.
