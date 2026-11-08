# v8 screenshots (session 30)

Taken in the Lens Studio preview (SPECS 27 device) on 8 Nov 2026, 07:00–07:04 CST, and saved as PNG at the panel's
size, 1392 x 1910. The Lens's frame is y 160–1750; the grey bands above and below it aren't part of it. Preset problem.
All four were taken on the build committed as a543e0b. V02 was shot before that commit's wall fix (below), with the eye
at y = 0, where the fix makes no visible difference. The full LEAF run is on the frozen build; see BUILD_LOG row 30.

## How they were taken

The same way as v7_3 (see `../v7_3/INDEX.md`): one LEAF run of `x1-capture` (`Assets/Tests/Leaf/X1CaptureScenario.ts`,
shots 13–16, added in session 30) per shot, on a freshly reset Lens, with the preview camera reset and pitched up 25°.
The run moves the real eye (tracking off) and reaches the state with real SIK pinches from LEAF's simulated hand on the
Lens's own buttons and holds. It checks the state, holds it for 5 s, and leaves LEAF's banner camera and the simulated
hand models hidden for the still. Test hooks used:
- `useStore` (a fresh in-memory store, every shot);
- `enableEyeProposal` (V01, V04), which turns the eye's height proposal on the way an open with no kept height does.

The preview has no body. Its eye height is wherever the scene puts it: y = 0 is 166 cm over the stand-in wall's
floor, which reads as 180 cm. For V01 and V04 the eye stands 3 cm lower (163 cm), so the proposal is the 175 cm the
rest of the stills use. This shows the logic, not a measurement, and the panel's second line says so.

**The wall fix (a543e0b).** The first V01, taken at y = −3, had dark horizontal bands across the wall. The stand-in's
textured face sat only 0.02 cm in front of its panel box, and from 4.25 m the two fought in the depth buffer at some
eye heights. The box's front now sits 0.5 cm further back, so the bands are gone. The Lens's own overlays didn't change.

Poses (the eye from the wall face; x from the preview's reset eye):
- V01, V04: S01's mats pose (4.25 m, 37.5 cm right, pitch −2°), the eye 3 cm lower.
- V02, V03: 2.5 m, level (S08's pose).

## The card, measured as drawn (x1 prints it in the run)

| Card | Line | Drawn height | Clear of the line above |
|---|---|---|---|
| V02 | "ONSIGHT · go 1" | 1.93° | |
| | "5 moves · shortest 4 · split at move 4" | 0.61° | 0.60° |
| | "Clean onsight. Pick something harder?" | 0.63° | 0.28° |
| | "0:06 start to top · new best" | 0.62° | 0.26° |
| V03 | "SEND · go 2" | 1.93° | |
| | "4 moves · the shortest for you" | 0.62° | 0.59° |
| | "1 hint · sent! Again without it?" | 0.63° | 0.28° |
| | "0:05 start to top · new best" | 0.62° | 0.26° |

Every line is whole, inside the plate, and at least 0.5° tall (the floor the result card is built to). The body lines
are 2.3 cm apart at their 1 cm cap on the 7.5 cm half-height plate, so no card was changed. The time is the capture's
own timing: the pinches are scripted, so "0:05" is not a climber's time.

| File | Commit | What it shows |
|---|---|---|
| `V01_mats_eye_line.png` | a543e0b | S01 with the eye's proposal on, beta hidden. The panel's line reads "Planned for 175 cm" over "Preview: the camera's height stands in" (on SPECS: "from your eye height"). Nothing else on the wall changes. |
| `V02_over_par_card_split.png` | a543e0b | Go 1 climbed off the plan at move 4 (RH up, LH h09, LF lh, RF rh, LH h20: k6's climb), read from 2.5 m: "ONSIGHT · go 1" / "5 moves · shortest 4 · split at move 4" / "Clean onsight. Pick something harder?" / "0:06 start to top · new best", Again on the same plate. The card names no hold and no limb. |
| `V03_four_line_card_time.png` | a543e0b | S08 again, with v8's fourth line. Go 1 came off; Again; go 2 from the start with one hint, to the top in par: "SEND · go 2" / "4 moves · the shortest for you" / "1 hint · sent! Again without it?" / "0:05 start to top · new best". This replaces v7_3's S08: it is the only v7_3 still whose look changed. |
| `V04_setup_eye_height.png` | a543e0b | Setup opened after the eye's proposal: "Your height: 175 cm" over − and +. The source line shows only on the climb page; − / + here override the proposal. |
