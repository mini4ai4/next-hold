# Next Hold: video plan (v3, 29.10, after session 18). Under 3:00, public YouTube. Roma approves the cut before upload.

v3 (session 18, for the re-record after the 6.3 judge, `VIDEO_JUDGE_2026-10-29_nh_v3.md`): scene 0 opens on the lit
read, not an empty wall; On wall the panel tucks under the ring; every pinch shows a ripple; the height beat keeps the
−/+ row in shot; the why-line sits on its own ring; the arrow points past bare wall at the next hold. Scene start
times are unchanged.

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
| 0 | 0:00–0:08 | The lit Ground read from 2.6 m, drifting in to 2.5 m: the overlays fade in over 1–2 s, then the glow on "up" with "R hand", "2 · LH", "3 · LF" and TOP. The hook is on screen by 2 s. | "Halfway up a problem, arms burning, a lot of newer indoor boulderers stop because they can't see where to go next." |
| 1 | 0:08–0:30 | Standing about 2.5 m back. Look down at the lower half (the start, the feet and their markers), then up again at the upper half (the glow, "2 · LH", "3 · LF", "TOP"). Legend card. | "So you read the problem first, from the mats, the way climbers do. Every hold gets a ring for your body: green is a secure grip from where you are, red is out of reach. The glow is your next move, and the tags are the two after it." |
| 2 | 0:30–0:48 | Walk in toward "up". Past 1.2 m the rings stay; under 80 cm the view switches to On wall by itself: one ring and "R hand", centred, the whole glow in shot. The panel tucks just under the ring's glow, only its top edge at the bottom of the frame. | "Walk up to the wall and the glasses only see about one hold. So the Lens switches by itself: one ring, one word." |
| 3 | 0:48–1:05 | Pinch RH, pinch the glowing hold "up": a ripple on "up", the hand marker jumps, the ring moves to h09 with "L hand", and the eye follows it. Step back past 1.2 m: Ground again, the tags have moved on. | "Make the move and everything recomputes in the same frame. Step back and the plan has moved on with you." |
| 4 | 1:05–1:30 | A step left and back to 2.8 m: the panel now stands beside h09 and h10, so the −/+ row, "Height … cm" and "2 · LH" share one frame. RH back on its start hold first (ripple on rh). Four pinches on "−" (a ripple on the button each time) down to 155 cm: "2 · LH" on the pinch h09. Eight on "+" up to 195 cm: "2 · LH" jumps to the big jug h10. 4 s and 11 s holds. The cut to `beta-155cm.png` / `beta-195cm.png` side by side is now optional. | "The plan is searched for your body. A shorter climber takes the pinch; a taller one skips it for the big jug up to the left, and the top gets easy. Same wall, same start, a different 1-2-3." |
| 5 | 1:30–1:45 | Back to 2.5 m and 175 cm, between lh and h11. Follow the plan: RH to up, then LH to h09. Pinch LF: lh, the rock-over about 40 cm under the hands, is green. Pinch "?" and then h11, high on the right: "POCKET HOLD · HIGH STEP" sits right over h11's own red ring, covering no other ring. | "Feet reach from the hip, not like an arm. A foot well above it is a high step, and the Lens says so in plain words." |
| 6 | 1:45–1:57 | Look up and to the right, over the top of the problem: lh goes out of view down to the left, and the arrow in the lower left points back at it past bare wall (a dark disc behind it so it reads on the ply). Look back: the arrow goes. | "If the next hold is out of view, an arrow and a soft chime point you to it." |
| 7 | 1:57–2:10 | Setup: pinch a hold, pick "Crimp", then Start, then Done; pinch it again, Remove. | "On real glasses it would recognise the holds. Here you mark them yourself, in any order, which is the stand-in the rules suggest." |
| 8 | 2:10–2:30 | Screen recording: the brief, CLAD building in the terminal, then the LEAF panel with 17 of 17 green and the a2 print "two head positions from 250 cm cover 10/10", then `node tests/scoring.port.test.mjs` ending "57 passed". | "We planned it with the plan-lens skill and built it with CLAD. Every done criterion has a LEAF test, and all seventeen pass." |
| 9 | 2:30–2:42 | Card, white on dark: "Logic proven in the preview: colours, the plan, the switch, the sizes. Feel unproven until real SPECS and a real wall." | "The logic is proven in the preview. How it feels on a real wall, only real glasses can tell." |
| 10 | 2:42–2:52 | End card: wordmark, "A bouldering coach on SPECS", "Indoor bouldering and top-rope. Not a spotter." | "Next Hold never says safe. It shows you your next hold." |

Scenes 0–7 play themselves (session 17; reworked in session 18). Recording:
1. Preview panel: Interactive, the default scene, device **SPECS 27** (the frame is a portrait strip, about 0.875:1).
   Camera reset. No LEAF banner on screen (refresh after any LEAF run).
2. Tick "Play On Start" on the `DemoAutopilot` object (Time Scale 1, Start At 0) and refresh the preview.
3. Record from the refresh: 3 s of pre-roll holding the first pose, then 2:10 of take, then 2 s of hold: **2:15 in
   all**; start the recorder a second before the refresh and stop it after "SCENE end t=130.0" in the Logger. The
   Logger prints "SCENE n start t=…" at each scene, for the cut.
4. Untick "Play On Start" and save.
In the edit, scale the strip to the full 1080 px height (it is drawn at 1590 px on a Retina screen, so it is sharp).
A wider frame: Simulation Mode "No Simulation" with Settings → Device Type Override → Spectacles keeps the hand
input working (SIK refuses a plain desktop or phone device), and the camera then takes the panel's shape. It is
**not tried**: the override is a Preview-panel setting the agent tools can't reach. It shows more wall than SPECS
does, so if used, say "a wider window than the glasses" on screen, and expect the panel to sit in a wider view.
Timeline: `Assets/Scripts/Demo/DemoTimeline.ts`. The steps below are for a take by hand.
Before recording: Lens Studio open on NextHold, preview refreshed (no LEAF banner on screen), camera reset, height 175,
the demo preset, then step back 125 cm with S for scene 1. Check that the control panel sits beside the problem, not
over it, before starting the take.
Assets on hand: `devpost/visual/beta-155cm.png`, `devpost/visual/beta-195cm.png` (scene 4, optional now); the LEAF run
log `devpost/LEAF_RUN_2026-10-29_s18.txt` (scene 8: 18 of 18, the 17 plus the demo check d1).
