# v7.2 screenshots (session 27)

Taken from the Lens Studio preview (SPECS 27 device) on 6 Nov 2026 on build 4bb4547, the build that passed the full LEAF
run in `../../LEAF_RUN_2026-11-06_s27.txt` (36 of 36). Saved as PNG at the preview panel's size, 1392 x 1910. The
Lens's own frame is y 160–1750; the grey bands above and below it aren't part of the frame. Preset problem, 175 cm
unless the name says otherwise.

## How they were taken

Every state was reached through the real Lens, with no capture script calling NextHoldMain to set it. One LEAF
scenario, `x1-capture` (`Assets/Tests/Leaf/X1CaptureScenario.ts`, committed), ran once per shot, each time on a freshly
refreshed preview:
- It moves the real eye to the shot's pose, with device tracking off.
- It reaches the state with real SIK pinches from LEAF's simulated hand on the Lens's own buttons and holds:
  "?", Show my beta, Setup, −/+, Again, and the holds.
- It checks the state it reached, holds it for 90 s, and the frame is shot during the hold.

Disclosures, all of them:
- **Store.** The Lens is handed a fresh in-memory store first, as every LEAF test does, so nothing a shot does is
  kept. The scenario keeps its own shot counter under one key (`nh.capture.s27b`) in the preview's store and
  removes it after the last shot.
- **Hidden during the hold.** LEAF's status banner ("RUNS: …" / "PASSED") and the preview's two simulated hand
  models are switched off. The banner is drawn by LEAF's own camera over the top of the frame. The hands stay where
  they pinched, over the panel. Neither is part of the Lens.
- **S12.** The preview has no microphone. Its voice input is typed text handed to the Lens's injected voice source,
  and the chip says so on every frame. The chip lasts 1 s, less than a tool round trip, so for this shot the
  scenario says "next hold" every 0.8 s while it holds. That is why the panel shows rung 3.
- **Mats shots** (01, 02, 04–06, 09, 12) are from 4.25 m, 37.5 cm right of the problem, pitch −2°: all ten holds,
  TOP included, are in frame. From 2.5 m TOP is cut off at the top.
- **The card shots** (07, 08) are from 2.5 m, level.
- **The height shots** (10, 11) are from 2.5 m, pitched up 8.8°, the same pose as v7's 10 and 11.
- **v7's `12_tag_on_neutral_195.png`** (a close-up from 1.85 m) wasn't retaken. S12 here is the voice chip.

The head-follow panel (session 27) is drawn where the Lens put it: 60 cm out, at the lower edge of the frame (the
preview frame is ±18.3° tall, so 25–30° below the gaze would be out of view). From 4.25 m that is the lower right,
over no ring; LEAF r5 checks this.

| File | Pose | What it shows |
|---|---|---|
| `S01_mats_beta_hidden.png` | 4.25 m | Opening read from the mats, beta hidden: every hold of the problem in a neutral outline, START under the two start holds, TOP over the top. Panel: Show my beta, ? (Hint ○○○), Body, Setup, "Planned for 175 cm". |
| `S02_mats_beta_shown.png` | 4.25 m | After a pinch on Show my beta: grip rings (green solid, yellow dashed, red broken), the glow on "up", the blue "2 · LH" and "3 · LF" badges on neutral outlines. The button reads Hide beta and "?" reads Why. The "R hand" word under the glow had faded before the shot (it fades on the mats). |
| `S03_wall_quiet.png` | 1.10 m, on wall (entered at 60 cm) | Beta hidden: the right-hand marker on its hold, no ring anywhere. The wall's 1 x 2 strip: ? (Hint ○○○) and Body. |
| `S04_hint_rung1.png` | 4.25 m | One pinch on "?": coloured rings only on the holds in reach from the start (two green, two yellow); the rest keep their outlines. No glow. Dots ●○○, the word under "?" now Move. |
| `S05_hint_rung2.png` | 4.25 m | Two pinches: the glow on the next move ("up"), the rings stay. Dots ●●○, word Why. "R hand" had faded, as in S02. |
| `S06_hint_rung3.png` | 4.25 m | Three pinches: the move's label "R hand" with rung 3's why, "jug, in reach", under it (no plate), up and to the right of the glowing hold. Dots ●●●. |
| `S07_came_off_card.png` | 2.5 m | Two moves on the wall (up, h09) then back to 2.5 m: "Came off at move 3" over [Hint · move 3] [Again], low in view, the panel hidden while the card is up. |
| `S08_result_card.png` | 2.5 m | Go 1 came off; Again; go 2 from the start with one hint ("?" once on the wall), climbed to the top with real pinches, then back to 2.5 m: "SEND · go 2" / "4 moves · your par 4" / "1 hint · ticked on this go", in the panel's place, Again beside it. |
| `S09_setup_panel.png` | 4.25 m | Setup pinched: Mark holds, Ground (the view override), − and +, Done lit, "Planned for 175 cm". |
| `S10_height_155.png` | 2.5 m, pitch +8.8° | Four pinches on −, then Show my beta: "2 · LH" on h09, "3 · LF" on lh. "Planned for 155 cm". |
| `S11_height_195.png` | 2.5 m, pitch +8.8° | Four pinches on +, then Show my beta: "2 · LH" moves up to h10; h09 is a plain green ring. "Planned for 195 cm". |
| `S12_voice_chip.png` | 4.25 m | "next hold" said (typed, in the preview): the chip, 70 cm out and 13° above the gaze, reads “next hold” over "Preview: typed text stands in for speech". "?" ripples as a pinch would; the panel is on rung 3 (●●●), the move's label and its why beside the glow. |

## Things these shots show that need a look (not fixed in session 27)

- `S12`: for its 1 s the chip covers part of the top hold's ring and the "R hand" line of the why. LEAF v1 checks the
  chip is in frame and clear of the panel, not clear of rings.
- `S09`: from 4.25 m the settings page reaches the frame's right edge ("Ground" touches it). r5 checks the climb
  page's panel in frame, not the settings page.
