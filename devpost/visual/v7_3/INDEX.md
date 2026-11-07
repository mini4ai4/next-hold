# v7.3 screenshots (session 28)

Taken in the Lens Studio preview (SPECS 27 device), saved as PNG at the panel's size, 1392 x 1910. The Lens's frame is
y 160–1750; the grey bands above and below it aren't part of it. Preset problem, 175 cm unless the name says otherwise.
S01–S11 were taken 6 Nov, 18:36–20:25, on 5c8986b. S12 was retaken 7 Nov, 04:02, on fccc8a1: the first take (6 Nov,
20:35) had the voice chip over Body, which fccc8a1 fixed. The full LEAF run (37 of 37,
`../../LEAF_RUN_2026-11-06_s28.txt`) is on ea5b025. 5c8986b adds only the capture driver and a capture-only hook that
keeps the chip up. fccc8a1 changes only where the voice chip goes (v1 and d2 pass on it).

## How they were taken

The same way as v7_2 (see `../v7_2/INDEX.md`): one LEAF run of `x1-capture` (`Assets/Tests/Leaf/X1CaptureScenario.ts`)
per shot, on a freshly reset Lens. It moves the real eye (tracking off), reaches the state with real SIK pinches from
LEAF's simulated hand on the Lens's own buttons and holds, checks it, and holds it. Test hooks used: `useStore` (a fresh
in-memory store, every shot). For S12 only: `injectVoice` (the typed voice path) and `holdVoiceChipForCapture` (keeps
the 1 s chip up for the still). Changes in session 28:
- **The still is shot after the run.** Lens Studio doesn't answer a screenshot during a run. The run holds its
  state 5 s and leaves LEAF's banner camera and the two simulated hand models hidden when it ends. Neither is part of
  the Lens.
- **The preview camera is pitched up 25°** before each shot (reset, then pitch +25). The preview draws its own scene
  behind the additive display, and with the camera level its floor showed through the wall as a dark band from
  y ≈ 1315 (every v7_2 still has it). The Lens is unchanged by this.
- **S12, once:** "next hold" said once at rung 0, so the panel shows rung 1, not rung 3 as in v7_2. For the retake
  alone, x1's `FIRST_SHOT` was set to 12 for one run and put back (not committed).

Poses (the eye from the wall face; x from the preview's reset eye):
- Mats shots S01, S02, S04–S06, S09, S10, S11: 4.25 m, 37.5 cm right, pitch −2°. S10/S11 now use S01's pose, so they
  match it. x1 requires the panel's place to be rank 3 (over nothing).
- The card shots S07, S08: 2.5 m, level.
- S03: 1.10 m (entered On wall at 60 cm).
- S12: 1.05 m, 4.5 cm right, pitch +2°, On wall.

On the mats the panel follows the head. It sits 60 cm out, low in view, at the lower right of the frame here, over no
ring, tag or glow, and the same place in S01, S10 and S11.

| File | Commit | What it shows |
|---|---|---|
| `S01_mats_beta_hidden.png` | 5c8986b | Opening read from the mats, beta hidden: neutral outlines on the problem's holds, START under the start holds, TOP over the top. Panel low right: Show my beta, ? (Hint ○○○), Body, Setup, "Planned for 175 cm", the not-a-spotter note. |
| `S02_mats_beta_shown.png` | 5c8986b | After Show my beta: grip rings (green solid, yellow dashed, red with a gap), the glow on "up", blue "2 · LH" and "3 · LF" on neutral outlines. The button reads Hide beta; "?" reads Why, with no dots (beta shown). |
| `S03_wall_quiet.png` | 5c8986b | On wall, beta hidden: the limb markers, no ring. The wall strip: ? (Hint ○○○) and Body. |
| `S04_hint_rung1.png` | 5c8986b | One "?": rings only on the holds in reach (two green, two yellow); the rest keep their outlines; no glow. Dots ●○○, word Move. |
| `S05_hint_rung2.png` | 5c8986b | Two: the glow on "up" and "R hand" above it. Dots ●●○, word Why. |
| `S06_hint_rung3.png` | 5c8986b | Three: "R hand" / "jug, sets up LH" / "to the pinch" just above the glowing hold. Dots ●●●, no word. |
| `S07_came_off_card.png` | 5c8986b | Two moves on the wall (up, h09), then back to 2.5 m: "Came off from here" over [Hint · move 3] [Again], low in view; the panel hidden while the card is up. |
| `S08_result_card.png` | 5c8986b | Go 1 came off; Again; go 2 from the start with one hint, to the top; from 2.5 m: "SEND · go 2" / "4 moves · the shortest for you" / "1 hint · sent! Again without it?", Again on the same plate. |
| `S09_setup_panel.png` | 5c8986b | Setup: Mark holds, Ground (the view switch), Done (lit), − and +, "Your height: 175 cm". |
| `S10_height_155.png` | 5c8986b | Four −, then Show my beta: "2 · LH" on h09, "3 · LF" on lh; "Planned for 155 cm". Panel low right, as in S01. |
| `S11_height_195.png` | 5c8986b | Four +, then Show my beta: "2 · LH" up on h10, h09 a plain green ring; "Planned for 195 cm". Panel low right, as in S01. |
| `S12_voice_chip.png` | fccc8a1 | On wall, "next hold" said (typed, in the preview): rung 1 (●○○, Move), the two green rings in view. The chip, “next hold” over "Preview: typed text stands in for speech", sits above "?" flush with its left edge, over no ring and not on Body. Its lower edge overlaps the strip's top margin (the plate, not a button). |
