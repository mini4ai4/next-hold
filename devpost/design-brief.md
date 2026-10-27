---
status: approved
---

# Design brief: Next Hold

<!-- Filled in by plan-lens from the learner's interview. Use the learner's words. Mark any value they didn't choose as (default). -->

## The one spatial moment
I'm three moves up, both hands on, feet planted, and I can't work out where to go. I look up the wall and a coloured ring sits on each hold I could go to, and the single best move glows with the limb to use, "R hand". Hands stay on the rock, eyes stay up, nothing floats in my face.

## Why it belongs on glasses
- Uses: draws in the world (rings sit on the holds themselves) and leaves your body free (hands stay on the wall, eyes stay up). On real SPECS it would also share your view (seeing the holds you're looking at).
- Why it's better than the phone or laptop version: it coaches on the wall, in the moment. You can't look at a phone while hanging, and a beta app has to be studied before you get on the wall.
- Positioning shown in the Lens: green means "secure grip for you, from where you are now". The glasses never say "safe". The Lens states it's for indoor bouldering/top-rope and not a replacement for a spotter or instructor.

## Product or overlay
- Type: overlay. It responds to real holds and the climber's real body position.
- What the real version would sense: hold positions and types (hold detection), and where each hand and foot is (hand tracking and body position).
- Stand-in for the preview:
  - **Wall:** a virtual bouldering wall at real scale, 240 cm wide by 300 cm tall, standing on the floor about 100 cm in front of the user. CLAD generates the holds.
  - **Hold recognition:** setup mode. Pinch a hold once to mark it, and a type picker appears beside it with big buttons: jug / crimp / pinch / pocket / sloper.
  - **Body position:** four limb toggles (LH, RH, LF, RF). Pinch one to select the limb, then pinch a destination hold and that limb "moves" there.
  - **Centre of mass:** the average of the four occupied holds.
  - **Climber:** reach is a one-time number. A 175 cm climber has 77 cm of arm reach (height × 0.44).
  - **Demo preset:** the Lens opens in climb mode. Every hold is already marked with its type, and the preset position has both feet and both hands on low holds, so the rings show right away.

## The scoring rule (port exactly, don't reinvent)
- The tested reference is in `devpost/scoring-reference/` (`scoring.js`, `scoring.test.js`, 11 checks). Port that exact logic to TypeScript.
- Score = grip quality × reach factor × balance factor.
  - Grip quality by type: jug 1.0, pinch 0.75, crimp 0.6, pocket 0.55, sloper 0.45.
  - Reach factor, measured from the moving limb's anchor: within 80% of reach is 1.0 (comfortable); 80–100% falls from 1.0 to 0.6 (a stretch); beyond 100% is 0 (out of reach, always red).
  - Anchors: a hand's anchor is the shoulder, which is the centre of mass shifted 18 cm to that side and 35 cm up. A foot's anchor is the hip, 18 cm to that side and 35 cm down. Feet use the same 77 cm reach.
  - Balance factor: as in `balanceFactor()`. It penalises a hand move with a foot off, a target at or below the centre of mass, crossing the body, and a foot move with a hand off.
- Colours: score ≥ 0.7 green, 0.4–0.7 yellow, under 0.4 red.
- Addition on top of the reference: `bestMove()` runs `evaluate()` for all four limbs and returns the single best (limb, hold) by score. It gets its own test.
- Everything recomputes every time a limb moves.

## Where things live
- Where the user is looking during the main task: at the patch of wall around their four current holds and just above, roughly 100 cm away.
- **Wall:** on the floor, 100 cm in front of the user at start, 240 × 300 cm, facing the user. Light-coloured panel and holds so they read on the additive display (default).
- **Rings:** one on each marked hold, lying flat on the wall face and slightly bigger than the hold, about 15–20 cm across (default).
- **Position markers:** a small dim marker on each of the four occupied holds.
- **Suggested hold:** its ring glows, with a short label beside it, e.g. "R hand".
- **Control row:** a compact row on the wall plane, anchored to the hands. It is centred horizontally between the two current hand holds, about 15 cm below the lower hand hold, and slides when a hand moves. That keeps it inside the patch you look at while choosing a hand move; for a foot move you're looking down anyway. It holds:
  - the four limb toggles (LH, RH, LF, RF)
  - a '?' button
  - a Setup/Climb mode switch
  - Buttons about 8 cm wide with gaps of 2 cm or more (default).
- **Type picker (setup mode only):** on the wall, right beside the hold just pinched.
- **Off-view arrow:** at the edge of the view nearest the suggested hold.

## Hands and input
Every action is a single pinch (in the preview, a mouse click).
- **Select limb:** pinch one of the LH / RH / LF / RF toggles. The rings recolour for that limb and the glow moves to that limb's best hold.
- **Move limb:** pinch a hold. The selected limb moves there. In climb mode, a pinch on a hold always means "move here" unless '?' is armed.
- **Ask why:** pinch '?'. It lights up while armed. The next pinch on a ring shows that hold's "why" line (e.g. "good jug, but a long reach") without moving any limb. It's one-shot, then the row goes back to normal.
- **Switch mode:** pinch the Setup/Climb switch. Switching back to climb recomputes everything.
- **Mark a hold (setup):** pinch a hold, then pinch a type on the picker beside it. This changes or adds the hold's type.
- Targets are big and highlight when aimed at.
- Voice: none.

## When things show
- **Rings:** always on in climb mode. The read is the point. No rings at all in setup mode.
- **Auto-select:** after every move, the Lens finds the best (limb, hold) across all four limbs and auto-selects that limb on the toggle row.
- **Suggestion label:** shows only on the one suggested hold. It fades after about 2 s, or as soon as you move. The ring glow stays.
- **After a limb moves:** everything recomputes in the same frame, and the label shows again for the new suggestion.
- **"Why" line:** hidden unless asked for with '?'.
- **Type picker:** setup mode only, while marking a hold.
- **If the suggestion is out of view:** a small arrow appears at that edge with one soft chime, then quiet.

## Done criteria
Each one can be checked in Lens Studio's preview.
1. When the Lens opens in climb mode, every marked hold that no limb is on shows exactly one ring (green, yellow or red). Each colour matches the reference rule (`devpost/scoring-reference`) for the selected limb from the preset position. The four occupied holds show only the dim position marker, no ring (the reference doesn't score them).
2. Pinching a hold moves the selected limb there. Its dim position marker jumps to that hold, all rings recompute in the same frame, and the limb with the best next move is auto-selected on the toggle row.
3. A hold beyond reach is always red. A jug within 80% of reach, above the centre of mass, with both feet on holds, is green.
4. The single suggested hold glows with the limb label (e.g. "R hand"), and the label fades after about 2 s. If that hold is outside the view, an arrow appears at that edge.
5. Pinching '?' lights it up, and the next pinch on a ring shows that hold's "why" line ("good jug, but a long reach") without moving any limb.

## Out of scope
- Real hold detection, hand tracking and body tracking (all faked by setup mode and the limb toggles).
- Separate leg reach. Feet use the arm-reach number.
- Remembering a marked wall between sessions.
- Voice, two-hand or custom gestures.
- Other people. No one else is in the scene, nothing is recorded, no one is identified.

## Risks and open questions
- Feet use the same 77 cm reach as hands. This is a deliberate simplification for this version.
- Wording risk: the Lens must never say "safe". Green is "secure grip for you, from where you are now", plus the not-a-spotter note.
- Feel unproven: whether rings are readable mid-climb, real hold detection accuracy, real hand tracking on a wall, and the comfort of looking up at a wall through a narrow view.
- Preview viewpoint: you stand about 1 m from the wall instead of being on it, so the view only approximates a climber's.

## Build notes for CLAD
- Build for SPECS so it runs and can be demonstrated in Lens Studio's preview. No SPECS device is available.
- Use Spectacles Interaction Kit (SIK) and UI Kit for all interactions, so they work with the mouse in Interactive Preview and with LEAF.
- Build any stand-in exactly as described above, and keep it obvious in the scene.
- Use real-world scale in centimeters. Keep content inside the user's view during the main task.
- The display is additive: black renders as transparent. Don't rely on black or very dark content to be seen; keep text light and readable from where the user stands.
- Get the basic flow working first, then add detail.
- Write LEAF scenarios for each done criterion, run them in preview, and report which pass. Say which criteria have no test.
- Don't record, identify, or follow people.

## After the build: judge it
This part is for you, after CLAD finishes.

1. **Does it work?** Ask your agent which LEAF tests passed and which done criteria have no test.
2. **Walk around it.** Open the preview in Interactive Preview. Use WASD to move, Q and E to go down and up, and right-drag (or hold Shift) to look around. Clicking acts as a pinch. Stand where a user would and look at the task.
3. **Ask the three questions.**
   - Does it use what I'm looking at?
   - Does it put something in my space, where it belongs?
   - Does it free my hands or let me keep my eyes up?
   - Would it be just as good on a phone? If so, what would make it need the glasses?
4. **Check comfort.**
   - Everything I need is in view while I do the task. Nothing sits at the edges, behind me, or stuck to my face.
   - Every control is within reach of someone standing there.
   - Text reads easily from where I stand. No dark UI disappearing.
   - Things show when needed and get out of the way.
5. **Label what you know.** Write "logic proven" next to anything the tests and preview show working, and "feel unproven" next to anything only real glasses could tell you (comfort over time, real hand tracking, real recognition).
6. **Fix with design notes, not code.** Tell your agent what to change in design terms, for example: "Move the step card 15 cm lower and next to the pan. Make the Next button twice as big. Re-run the tests." If a fix takes under a minute, like nudging a panel, do it yourself in the scene.
7. **Submit.** Record a video under 3 minutes of your Lens in the preview, public on YouTube. Make your repo public with your Lens Studio project and this `devpost/` folder. Details are on the hackathon site: https://learn-specs.devpost.com/resources
