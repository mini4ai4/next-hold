# Devpost draft: Next Hold (v3, 29.10, after session 15). Learn AR with SPECS. Entrant: Roman Pryvrotskyi (individual).

## Tagline
A bouldering coach on your glasses: read the problem for your own body from the mats, then climb with one ring showing the next move.

## What it does
You stand on the mats, about two and a half metres back, and look up and down the problem you've marked, the way climbers read a problem before they start. Every free hold in it has a ring: green, yellow or red, for the hand or foot you'd move now (the holds you're on show a small marker). The rings stay on the holds as you look around, so the whole problem never has to fit in one view. The best next move glows with its label, "R hand", and the two moves after it are small tags on their own holds, "2 · LH" and "3 · LF". Each tag is outlined in its own colour, green or yellow: how secure that move will be for you when its turn comes. If a later move goes onto a hold one of your limbs is on now, that hold gets a ring in the tag's colour. The top hold says "TOP". Holds that aren't part of the problem fade back. That's reading the problem, the thing good climbers do before they touch the wall, worked out for your body.

Then you climb. Up close the glasses see about one hold at a time, so when you come closer than about 80 cm the Lens switches to **On wall** by itself: one ring on the next hold, and its label, "R hand", which stays. Step back past about 1.2 m and the whole problem is there again. If the next hold is out of view, an arrow at the edge and a soft chime point you to it.

The colour isn't a guess about the route. It's worked out from where your body is right now:
- **Grip:** a jug is easier to hold than a crimp, a crimp easier than a sloper.
- **Reach:** how far the hold is from the shoulder of the hand, or the hip of the foot, that would move, against your own reach. Past it, the hold is always red. Feet reach from the hip, not with the arm's reach: a rock-over about 40 cm under your hands is green, and a foot well above your hip is a "HIGH STEP" and goes hard.
- **Balance:** a hand move is better with both feet on and the new hold above your centre of mass; crossing your body costs.
- **Upward:** among moves that are about as good, the one that takes you higher and closer to the top hold wins.

The 1-2-3 is a plan, not three greedy guesses. After the glowing move, the Lens searches every hand and foot and every hold of the problem for the shortest way to the top in moves you can make (green or yellow), and among those the most secure. It shows the first three moves of that plan. You set your height in the panel (150 to 200 cm) and every reach rescales, so the plan changes with your body. From the same start, a 155 cm climber gets "R hand up, then L hand to the pinch, then L foot up"; from about 185 cm the left hand goes straight to the big jug up and left of the pinch instead, and the last reach to the top gets easy. The two screenshots `beta-155cm.png` and `beta-195cm.png` show it.

Move a hand or a foot, or change your height, and every ring, the glow and the tags update in the same frame. A thin, soft stick figure on the wall shows where your body is: a small head, a spine from the shoulders to the hips, and arms and legs bent at the elbows and knees, each ending on its hold. Pinch "?" and then a ring, and it tells you why in plain words: "PINCH HOLD · LONG REACH".

## Who it's for
Indoor boulderers, especially newer ones, who stall halfway up a problem because they can't see their options from where they hang. A phone can't help there: you'd have to let go of the wall to look at it, and a beta video has to be studied before you start, not while you're on the problem.

## How it's different from a light-up wall
Gyms already light up holds: LED training boards and projected walls show a set problem to everyone who looks. You mark the problem in Next Hold too (its holds, the start and the top), but that's only where it begins. It doesn't show *the* route, it shows *your* options: which holds are good for your body, from where you hang right now, on your own glasses, on any wall. Two people on the same problem see different colours and can get a different 1-2-3.

## Why it needs glasses
- **It draws in the world.** The rings sit flat on the holds themselves, at real size, not on a panel.
- **It leaves your body free.** Hands stay on the holds, eyes stay up the wall.
- **On real SPECS it would share your view,** seeing the holds you're looking at.
Green never means "safe". It means "a secure grip for you, from where you are now". The Lens says it's for indoor bouldering and top-rope, and it doesn't replace a spotter or an instructor.

## What's real and what's stood in
The preview can't recognise a real wall or track a body, so, as the rules suggest, we faked the moment of recognition and built everything after it for real:
- **The wall** is a virtual bouldering wall at real scale, 240 × 300 cm: birch-ply panels with T-nuts and shaped holds. In the preview you walk back from it to read the problem.
- **Hold recognition** is a setup mode: pinch a hold to add it and open its panel, then set its type (jug, crimp, pinch, pocket, sloper), Start and Top in any order, and press Done. Pinch a marked hold again to change it or remove it.
- **Body position** is four limb toggles, LH, RH, LF and RF. Pick one, pinch a hold, and that limb moves there.

On real SPECS, the limb toggles would be body tracking, so climbing itself takes no pinches at all: you move, and the rings follow. Asking "why" would be a look-and-dwell on a ring. Both are our design for the device, and both are "feel unproven" until we can try them on a wall.

## How we built it
We planned it with the `plan-lens` skill, which wrote `devpost/design-brief.md`, and built it with CLAD through the Lens Studio MCP, in fifteen sessions logged in `devpost/BUILD_LOG.md`. The scoring rule came first, as a small tested reference in plain JavaScript we wrote before the build (`devpost/scoring-reference/`, 27 checks). Every change to the rule went into the reference first, and CLAD ported it to TypeScript; the port passes 57 checks, including the best-move search and the 1-2-3 plan, which is checked against a brute force over every possible route. Every done criterion in the brief, and every later change, has a LEAF scenario: 17 of 17 pass in the preview, and the raw output of the last full run is in `devpost/LEAF_RUN_2026-10-29.txt`. One sets the height with real pinches and checks that 155 and 195 cm get different 1-2-3s from the same start, every step green or yellow, and that the switch happens inside the pinch's own frame. One puts a second camera 2.5 m back, turns it to the lower and then the upper half of the problem, and checks that between the two looks every ring is whole in the glasses' view. Another checks on screen that each next-move tag sits nearest its own hold and names the limb, and that it wears its step's colour. A third walks a camera in and out and checks the view switches at 80 cm and 1.2 m.

**Logic proven** (tests and preview): the colours match the rule, a move or a height change recomputes everything in one frame, an out-of-reach hold is always red, after the glow the 1-2-3 follows the shortest secure route to the top for that height, the tags and their colours, the suggestion and its label, the "why" line, that two looks from 2.5 m cover the whole problem, the switch between Ground and On wall by distance, and setup in any order.
**Feel unproven** (only real glasses can tell): whether rings read well mid-climb, real hold detection, hand tracking on a wall, looking up through a narrow view, and whether 80 cm and 1.2 m are the right switch points on a real wall.

## What we learned
- **The field of view decides the design.** On the wall your face is 30–45 cm from the holds, and the glasses see about one hold there. Even from 1.8 m the whole problem doesn't fit in one view, and real gym walls are taller than our 3 m stand-in. But climbers don't read a problem in one glance: they stand 2–3 m back and look up and down it. Rings that stay on the holds suit that, so the Lens splits the job the way climbers already do. From 2.5 m, one look at the lower half and one at the upper half cover every ring (5 and 7 of the 10, all 10 between them); then you climb with one ring at a time.
- **Sizes have to follow you.** A ring that reads at the wall is a speck from 2.5 m, so on the ground the rings, labels, tags, the control panel and the why-line size themselves from your real distance and look the same wherever you stand. The control panel moves beside the problem there, so it never covers a hold. (The setup panel doesn't resize yet; you use it up close.)
- **On an additive display, dark is invisible.** The first wall was grey and the holds disappeared into it. Light wood, light holds and glowing rings fixed it.
- **Beta depends on the body, and a greedy look-ahead hides it.** Taking the best move one step at a time picks the same holds for almost everyone. Searching for the way to the top is what makes a tall climber skip a hold and a shorter one bring a foot up first.
- **The words matter as much as the colours.** "Safe" would be a promise a pair of glasses can't keep, so the Lens never says it.
- **Writing the rule down first paid off.** Because the reference had its own tests, we could check CLAD's port line by line instead of eyeballing colours.

## What's next
Real hold detection and body tracking on SPECS, plans that also use matching and swapping hands on one hold, and remembering a marked wall so a gym's problems are set up once. Then the honest test: real climbers, a real wall, and whether reading the problem with Next Hold gets them to the top in fewer tries.

## Built with
Lens Studio 5.23.2, CLAD, Lens Studio MCP, Spectacles Interaction Kit, UI Kit, LEAF, TypeScript.
