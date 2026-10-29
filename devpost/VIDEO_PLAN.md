# Next Hold: video plan (v2, 29.10, after session 15). Under 3:00, public YouTube. Roma approves the cut before upload.

Rules: under 3 min, shows the Lens working end to end in the preview (judges won't run it), says what problem it
solves and for whom. Showing the brief, the agent building and the design ideas is encouraged. No third-party
trademarks or copyrighted music. Ties are broken by Design first, so the design reasoning gets screen time.
Voice: the climber's problem first, in general terms (no invented person, no unverified numbers), woven through the
mechanics (Roma, 27.10). Calm and plain, one sentence per clip, at least 1.1 s of breath, 1.5 s between scenes. Music: our own, low.

**Footage.** Mostly real Lens Studio Interactive Preview, recorded from the screen at 1920×1080, the preview filling
the whole frame (no editor chrome, no picture-in-picture). Scenes 1–6 are one continuous take with WASD and the mouse,
cut only where marked. Corner note on every preview shot: "Lens Studio preview. Hold recognition and body position
are stood in, as the rules suggest."
**Legend card** (on screen for the first 6 s of scene 1, top left, small): "Ring = how secure that hold is for you,
now · Green / yellow / red · Tag "2 · LH" = your next moves, in their own colour · TOP = the end of the problem".

| # | Time | Picture (full frame) | Voice-over |
|---|---|---|---|
| 0 | 0:00–0:08 | Black, then the wall fades in from 2.5 m back, no overlays yet. | "Halfway up a problem, arms burning, a lot of climbers stop because they can't see where to go next." |
| 1 | 0:08–0:30 | Overlays on, standing about 2.5 m back. Look down at the lower half (the start, the feet and their markers), then up at the upper half (the glow on "up", "2 · LH", "3 · LF", "TOP"). Legend card. | "So you read the problem first, from the mats, the way climbers do. Every hold gets a ring for your body: green is a secure grip from where you are, red is out of reach. The glow is your next move, and the tags are the two after it." |
| 2 | 0:30–0:48 | Walk in with W. Past 1.2 m the rings stay; under 80 cm the view switches to On wall by itself: one ring, "R hand", the panel's button reads "On wall". | "Walk up to the wall and the glasses only see about one hold. So the Lens switches by itself: one ring, one word." |
| 3 | 0:48–1:05 | Pinch RH, pinch the glowing hold "up". The hand marker jumps, the ring moves to h09 and its label changes. Step back past 1.2 m: Ground again, the tags have moved on. | "Make the move and everything recomputes in the same frame. Step back and the plan has moved on with you." |
| 4 | 1:05–1:30 | Ground, the upper look. Pinch "Height −" down to 155 cm: "2 · LH" sits on the pinch h09. Pinch "+" up to 195 cm: in one pinch, "2 · LH" jumps to the big jug h10. Hold for 2 s on each. Then cut to `beta-155cm.png` and `beta-195cm.png` side by side for 3 s. | "The plan is searched for your body. A shorter climber takes the pinch; a taller one skips it for the big jug up to the left, and the top gets easy. Same wall, same start, a different 1-2-3." |
| 5 | 1:30–1:45 | Back at 175 cm, follow the plan one more move (LH to h09). Pinch LF: lh, the rock-over about 40 cm under the hands, is green. Pinch "?" and then h11, high on the right: "POCKET HOLD · HIGH STEP" (checked against the rule for this position). | "Feet reach from the hip, not like an arm. A foot well above it is a high step, and the Lens says so in plain words." |
| 6 | 1:45–1:57 | Look away from the next hold: the edge arrow and the chime. Look back. | "If the next hold is out of view, an arrow and a soft chime point you to it." |
| 7 | 1:57–2:10 | Setup: pinch a hold, pick "Crimp", then Start, then Done; pinch it again, Remove. | "On real glasses it would recognise the holds. Here you mark them yourself, in any order, which is the stand-in the rules suggest." |
| 8 | 2:10–2:30 | Screen recording: the brief, CLAD building in the terminal, then the LEAF panel with 17 of 17 green and the a2 print "two head positions from 250 cm cover 10/10", then `node tests/scoring.port.test.mjs` ending "57 passed". | "We planned it with the plan-lens skill and built it with CLAD. Every done criterion has a LEAF test, and all seventeen pass." |
| 9 | 2:30–2:42 | Card, white on dark: "Logic proven in the preview: colours, the plan, the switch, the sizes. Feel unproven until real SPECS and a real wall." | "The logic is proven in the preview. How it feels on a real wall, only real glasses can tell." |
| 10 | 2:42–2:52 | End card: wordmark, "A bouldering coach on SPECS", "Indoor bouldering and top-rope. Not a spotter." | "Next Hold never says safe. It shows you your next hold." |

Before recording: Lens Studio open on NextHold, preview refreshed (no LEAF banner on screen), camera reset, height 175,
the demo preset, then step back 125 cm with S for scene 1. Check that the control panel sits beside the problem, not
over it, before starting the take.
Assets on hand: `devpost/visual/beta-155cm.png`, `devpost/visual/beta-195cm.png` (scene 4); the LEAF run log
`devpost/LEAF_RUN_2026-10-29.txt` (scene 8).
