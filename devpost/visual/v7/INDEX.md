# v7 screenshots (session 25)

Taken from the Lens Studio preview (SPECS 27 device) on 5 Nov 2026, saved as PNG at the preview panel's size,
1392 x 1910. The Lens's own frame is y 160–1750; the grey bands above and below it aren't part of the frame.
Preset problem, 175 cm unless the name says otherwise, on a fresh in-memory store, so nothing here came from a kept
height or a kept best.

States were set by a short capture script that called the same NextHoldMain methods a pinch calls (not SIK pinches) and held the camera still; it was deleted after the session and isn't in the repo. Real pinches reach each of these states in LEAF: 01/03 h1, 02 h2, 04–06 h3, 07 h5, 08 k1, 09 g1, 10–11 r7, 12 e1.

These are the session-25 build (v7). Session 26 (v7.2) changed what several of them show and they have not been
retaken yet: the label "Mark holds", the came-off card (now a headline over [Hint · move 3] [Again]), the result card
(now in the panel's place, worded "SEND · go 2"), the wall panel (a 1 x 2 strip, ? and Body), the bigger labels and
dots, and rung 3 (now under the move's label, no plate). See BUILD_LOG session 26.

Most of the mats shots are from 4.25 m, a little right of the problem, not 2.5 m. From 2.5 m the frame is only
about 1.4 m wide and the control panel always lands at its right edge, half cut off (the older 2.5 m shots in
`../` show the same). 4.25 m is the closest pose where the whole problem and all four controls fit together.

| File | What it shows |
|---|---|
| `01_mats_beta_hidden.png` | Opening read from the mats, beta hidden: every hold of the problem in a neutral outline, START under the two start holds, TOP over the top. Panel: Show my beta, ? (○○○), Body, Setup. |
| `02_mats_beta_shown.png` | After Show my beta, same pose: grip rings (green solid, yellow dashed, red with a gap), the glow and "R hand" on "up", the blue "2 · LH" and "3 · LF" badges on neutral outlines. The button now reads Hide beta. |
| `03_wall_quiet.png` | On wall, about 1.15 m out, beta hidden: the right-hand marker on its hold and no ring anywhere. Three controls (?, Body, Setup); Show my beta's slot is empty on the wall. |
| `04_hint_rung1.png` | First "?": coloured rings only on the holds in reach from the start (two green, two yellow); the rest keep their outlines. No glow, no word. Dots ●○○. |
| `05_hint_rung2.png` | Second "?": the glow and "R hand" on the next move, the rings stay. Dots ●●○. |
| `06_hint_rung3.png` | Third "?": the next move's why-line, "JUG HOLD", under the glowing hold. Dots ●●●. |
| `07_came_off_card.png` | Two moves on the wall, then back to 2.5 m, looking level: "Came off at move 3. Hint for that move?" low in view. Again is also up, higher on the wall (see the note below). |
| `08_result_card.png` | Second go topped with one hint, after an onsight first go: "SEND (attempt 2)", "5 moves · par for your body 4", "Hints: 1 · Best: ONSIGHT, 5 moves", with Again beside the card. |
| `09_setup_panel.png` | Setup open from the mats: the height row (− 175 cm +), the view override (Ground), the mark-holds button, Setup lit. |
| `10_height_155.png` | Beta shown at 155 cm from the start: "2 · LH" on h09, "3 · LF" on lh. Panel says Planned for 155 cm. |
| `11_height_195.png` | Same start and pose at 195 cm: "2 · LH" moves up to h10, h09 is now a plain green ring. Planned for 195 cm. |
| `12_tag_on_neutral_195.png` | Close-up from 1.85 m at 195 cm: the "2 · LH" badge sits on h10's neutral outline, not on a red ring, though h10 scores red from the start for this body. |

## Things these shots show that need a look (not fixed in session 25; each addressed in session 26, shots not retaken)

- `09`: the mark-holds button reads "Marknholds". The source default is "Mark holds", but the committed
  `Assets/Scripts/NextHoldControlRowUI.ts.meta` still carries the old `markLabel: Marknholds`, and the Lens uses it.
- `07`: on the walk-back path H5 uses (wall, then 0, 60 and 125 cm), Again ends up high over the problem,
  well above the card instead of beside it.
- `08`: from 4.25 m the card and Again cover the bottom of the control panel (the disclaimer line).
- `06`: from 4.25 m the why-line plate covers the top of the right start hold's outline.
