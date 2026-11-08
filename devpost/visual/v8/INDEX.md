# v8 screenshots (session 31)

Taken in the Lens Studio preview (SPECS 27 device) on 8 Nov 2026, after the session 31 full LEAF run, on the frozen
build `bf73da7` (the run: `../../LEAF_RUN_2026-11-08_s31.txt`, BUILD_LOG row 31). Saved as PNG at the panel's size,
1392 x 1910. The Lens's frame is y 160–1750; the grey bands above and below it aren't part of it. Preset problem.
These four replace session 30's set: the eye line, the card's wording and the time line changed in session 31
(`../../../../CHANGES_V8_FIX1.md` items 1–3).

## How they were taken

The same way as v7_3 (see `../v7_3/INDEX.md`): one LEAF run of `x1-capture` (`Assets/Tests/Leaf/X1CaptureScenario.ts`,
shots 13–16) per shot, on a freshly reset Lens, with the preview camera reset and pitched up 25°. The run moves the
real eye (tracking off) and reaches the state with real SIK pinches from LEAF's simulated hand on the Lens's own buttons
and holds. It checks the state (the words below, word for word), holds it for 5 s, and leaves LEAF's banner camera and
the simulated hand models hidden for the still. Test hooks used:
- `useStore` (a fresh in-memory store, every shot);
- `enableEyeProposal` (V01, V04), which turns the eye's height proposal on the way an open with no kept height does.

The preview has no body. Its eye height is wherever the scene puts it: y = 0 is 166 cm over the stand-in wall's
floor, which reads as 180 cm. For V01 and V04 the eye stands 3 cm lower (163 cm), so the proposal is 175 cm, the
height the other stills use. This shows the logic, not a measurement, and the panel's second line names the preview
camera.

Poses (the eye from the wall face; x from the preview's reset eye):
- V01, V04: S01's mats pose (4.25 m, 37.5 cm right, pitch −2°), the eye 3 cm lower.
- V02, V03: 2.5 m, level (S08's pose).

## The cards, measured as drawn (x1 prints them in the run)

| Card | Line | Drawn height | Clear of the line above |
|---|---|---|---|
| V02 | "SEND · go 2" | 1.93° | |
| | "5 moves · 4 is possible · rethink move 4" | 0.61° | 0.60° |
| | "No hints · sent! Again in 4?" | 0.63° | 0.28° |
| | "0:06 start to top" | 0.62° | 0.26° |
| V03 | "SEND · go 2" | 1.93° | |
| | "4 moves · the shortest for you" | 0.62° | 0.59° |
| | "1 hint · sent! Again without it?" | 0.63° | 0.28° |
| | "0:05 start to top" | 0.62° | 0.26° |

Every line is whole, inside the plate (V02's longest line spans x 0.273–0.553 of the frame, the plate 0.178–0.822),
and at least 0.5° tall. The time is the capture's own timing: the pinches are scripted, so "0:05" is not a climber's
time (demo timing). It has no suffix because it is the first time kept at this height; later ones read "· fastest
0:05" or "· fastest yet".

| File | What it shows |
|---|---|
| `V01_mats_eye_line.png` | S01 with the eye's proposal on, beta hidden. The panel's lines read "Planned for 175 cm" / "from your eye height (preview camera)" (on SPECS: "from your eye height"). Before that, for the 2 s the eye is read, the first line reads "Reading your eye height…" (in the take, not in a still). |
| `V02_over_par_card_rethink.png` | As the v8 take's go 2: go 1 came off; Again; go 2 from the start one hand move off the plan (RH up, LH h09, LF lh, LH h10, LH h20), read from 2.5 m: "SEND · go 2" / "5 moves · 4 is possible · rethink move 4" / "No hints · sent! Again in 4?" / "0:06 start to top", Again on the same plate. The card names no hold and no limb. (An onsight over the shortest reads "5 moves · 4 is possible" / "Onsight: first go, no hints.": climbed blind, it gets no move number.) |
| `V03_four_line_card_time.png` | S08 again, with v8's fourth line. Go 1 came off; Again; go 2 from the start with one hint, to the top in par: "SEND · go 2" / "4 moves · the shortest for you" / "1 hint · sent! Again without it?" / "0:05 start to top". This replaces v7_3's S08: it is the only v7_3 still whose look changed. |
| `V04_setup_eye_height.png` | Setup opened after the eye's proposal: "Your height: 175 cm" / "from your eye height · − / + to change" under − and +. After a − / + (or with a kept height) the second line is gone. |
