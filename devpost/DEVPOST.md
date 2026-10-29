# Devpost draft: Next Hold (v2, 29.10, Ground and On wall). Learn AR with SPECS. Entrant: Roman Pryvrotskyi (individual).

## Tagline
A bouldering coach on your glasses: read the problem for your own body from the mats, then climb with one ring showing the next move.

## What it does
You stand on the mats, about two and a half metres back, and look up and down the problem you've marked, the way climbers read a problem before they start. Every hold in it has a ring: green, yellow or red. The rings stay on the holds as you look around, so the whole problem never has to fit in one view. The best next move glows with its label, "R hand", and the two moves after it are small tags on their own holds, "2 · LH" and "3 · RF", for *your* reach. The top hold says "TOP". Holds that aren't part of the problem fade back. That's reading the problem, the thing good climbers do before they touch the wall, worked out for your body.

Then you climb. Up close the glasses see about one hold at a time, so when you come closer than about 80 cm the Lens switches to **On wall** by itself: one ring on the next hold, and its label, "R hand", which stays. Step back past about 1.2 m and the whole problem is there again. If the next hold is out of view, an arrow at the edge and a soft chime point you to it.

The colour isn't a guess about the route. It's worked out from where your body is right now:
- **Grip:** a jug is easier to hold than a crimp, a crimp easier than a sloper.
- **Reach:** how far the hold is from the shoulder (or hip) of the limb that would move, against your own reach. Past it, the hold is always red.
- **Balance:** a hand move is better with both feet on and the new hold above your centre of mass; crossing your body costs.
- **Upward:** among moves that are about as good, the one that takes you higher and closer to the top hold wins.

Move a hand or a foot and every ring recolours in the same frame, and the Lens picks the best next move across all four limbs. A thin stick figure on the wall joins your four limbs at your centre of mass, so you can see where your body is. Pinch "?" and then a ring, and it tells you why in plain words: "PINCH HOLD · LONG REACH".

## Who it's for
Indoor boulderers, especially newer ones, who stall halfway up a problem because they can't see their options from where they hang. A phone can't help there: you'd have to let go of the wall to look at it, and a beta video has to be studied before you start, not while you're on the problem.

## How it's different from a light-up wall
Gyms already light up holds: LED training boards and projected walls show a set problem to everyone who looks. You mark the problem in Next Hold too (its holds, the start and the top), but that's only where it begins. It doesn't show *the* route, it shows *your* options: which holds are good for your body, from where you hang right now, on your own glasses, on any wall. Two people on the same problem see different colours.

## Why it needs glasses
- **It draws in the world.** The rings sit flat on the holds themselves, at real size, not on a panel.
- **It leaves your body free.** Hands stay on the holds, eyes stay up the wall.
- **On real SPECS it would share your view,** seeing the holds you're looking at.
Green never means "safe". It means "a secure grip for you, from where you are now". The Lens says it's for indoor bouldering and top-rope, and it doesn't replace a spotter or an instructor.

## What's real and what's stood in
The preview can't recognise a real wall or track a body, so, as the rules suggest, we faked the moment of recognition and built everything after it for real:
- **The wall** is a virtual bouldering wall at real scale, 240 × 300 cm: birch-ply panels with T-nuts and shaped holds. In the preview you walk back from it to read the problem.
- **Hold recognition** is a setup mode: pinch the holds of your problem, then the start and the top, and pick each hold's type (jug, crimp, pinch, pocket, sloper).
- **Body position** is four limb toggles, LH, RH, LF and RF. Pick one, pinch a hold, and that limb moves there.

On real SPECS, the limb toggles would be body tracking, so climbing itself takes no pinches at all: you move, and the rings follow. Asking "why" would be a look-and-dwell on a ring. Both are our design for the device, and both are "feel unproven" until we can try them on a wall.

## How we built it
We planned it with the `plan-lens` skill, which wrote `devpost/design-brief.md`, and built it with CLAD through the Lens Studio MCP, in thirteen sessions logged in `devpost/BUILD_LOG.md`. The scoring rule came first, as a small tested reference in plain JavaScript we wrote before the build (`devpost/scoring-reference/`, now 22 checks). Every change to the rule went into the reference first, and CLAD ported it to TypeScript; the port passes 42 checks, including the best-move search and the three-move look-ahead. Every done criterion in the brief, and every later change, has a LEAF scenario: 15 of 15 pass in the preview. One puts a second camera 2.5 m back, turns it to the lower and then the upper half of the problem, and checks that between the two looks every ring is whole in the glasses' view. Another checks on screen that each next-move tag sits nearest its own hold and names the limb. A third walks a camera in and out and checks the view switches at 80 cm and 1.2 m.

**Logic proven** (tests and preview): the colours match the rule, a move recomputes everything in one frame, an out-of-reach hold is always red, the three-move look-ahead and its limb tags, the suggestion and its label, the "why" line, that two looks from 2.5 m cover the whole problem, and the switch between Ground and On wall by distance.
**Feel unproven** (only real glasses can tell): whether rings read well mid-climb, real hold detection, hand tracking on a wall, looking up through a narrow view, and whether 80 cm and 1.2 m are the right switch points on a real wall.

## What we learned
- **The field of view decides the design.** On the wall your face is 30–45 cm from the holds, and the glasses see about one hold there. From 1.8 m only 6 of the problem's 10 holds fit in one view, and real gym walls are taller than our 3 m stand-in. But climbers don't read a problem in one glance: they stand 2–3 m back and look up and down it. Rings that stay on the holds suit that, so the Lens splits the job the way climbers already do. From 2.5 m, one look at the lower half and one at the upper half cover every ring; then you climb with one ring at a time.
- **Sizes have to follow you.** A ring that reads at the wall is a speck from 2.5 m, so on the ground the rings, labels, tags and panels size themselves from your real distance and look the same wherever you stand. The control panel moves beside the problem there, so it never covers a hold.
- **On an additive display, dark is invisible.** The first wall was grey and the holds disappeared into it. Light wood, light holds and glowing rings fixed it.
- **The words matter as much as the colours.** "Safe" would be a promise a pair of glasses can't keep, so the Lens never says it.
- **Writing the rule down first paid off.** Because the reference had its own tests, we could check CLAD's port line by line instead of eyeballing colours.

## What's next
Real hold detection and body tracking on SPECS, separate leg reach, and remembering a marked wall so a gym's problems are set up once. Then the honest test: real climbers, a real wall, and whether reading the problem with Next Hold gets them to the top in fewer tries.

## Built with
Lens Studio 5.23.2, CLAD, Lens Studio MCP, Spectacles Interaction Kit, UI Kit, LEAF, TypeScript.
