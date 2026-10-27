# Devpost draft: Next Hold (v0, 27.10). Learn AR with SPECS. Entrant: to confirm with Roma.

## Tagline
A bouldering coach that colours the holds you can reach next, right on the wall, while your hands stay on it.

## What it does
You're three moves up, both hands on, feet planted, and you can't work out where to go. You look up the wall and every hold you could move to has a ring on it: green, yellow or red. One ring glows, with a short label beside it, "R hand". That's the move.

The colour isn't a guess about the route. It's worked out from where your body is right now:
- **Grip:** a jug is easier to hold than a crimp, a crimp easier than a sloper.
- **Reach:** how far the hold is from the shoulder (or hip) of the limb that would move, against your own reach. Past it, the hold is always red.
- **Balance:** a hand move is better with both feet on and the new hold above your centre of mass; crossing your body costs.

Move a hand or a foot and every ring recolours in the same frame, and the Lens picks the best next move across all four limbs. Pinch "?" and then a ring, and it tells you why in plain words: "good jug, but a long reach".

## Who it's for
Indoor boulderers, especially newer ones, who stall halfway up a problem because they can't see their options from where they hang. A phone can't help there: you'd have to let go of the wall to look at it, and a beta video has to be studied before you start, not while you're on the problem.

## Why it needs glasses
- **It draws in the world.** The rings sit flat on the holds themselves, at real size, not on a panel.
- **It leaves your body free.** Hands stay on the holds, eyes stay up the wall.
- **On real SPECS it would share your view,** seeing the holds you're looking at.
Green never means "safe". It means "a secure grip for you, from where you are now". The Lens says it's for indoor bouldering and top-rope, and it doesn't replace a spotter or an instructor.

## What's real and what's stood in
The preview can't recognise a real wall or track a body, so, as the rules suggest, we faked the moment of recognition and built everything after it for real:
- **The wall** is a virtual bouldering wall at real scale, 240 × 300 cm, standing about a metre away: birch-ply panels with T-nuts and shaped holds.
- **Hold recognition** is a setup mode: pinch a hold and pick its type (jug, crimp, pinch, pocket, sloper).
- **Body position** is four limb toggles, LH, RH, LF and RF. Pick one, pinch a hold, and that limb moves there.

## How we built it
We planned it with the `plan-lens` skill, which wrote `devpost/design-brief.md`, and built it with CLAD through the Lens Studio MCP. The scoring rule came first, as a small tested reference in plain JavaScript (`devpost/scoring-reference/`, 11 checks), and CLAD ported it to TypeScript; the port passes 18 checks, including the best-move search. Every done criterion in the brief has a LEAF scenario, and all six pass in the preview.

**Logic proven** (tests and preview): the colours match the rule, a move recomputes everything in one frame, an out-of-reach hold is always red, the suggestion and its label, the "why" line.
**Feel unproven** (only real glasses can tell): whether rings read well mid-climb, real hold detection, hand tracking on a wall, and looking up through a narrow view.

## What we learned
- **The field of view decides the design.** SPECS shows roughly a 49 × 66 cm window at a metre, and a climber's hands are about 60 cm apart. Both hands, the suggestion and the controls never fit at once. So we designed for where you're actually looking when you choose a hand move: one hand, the suggested hold and the control row, which follows your hands along the wall. We moved the wall back to about 115 cm to make that fit.
- **On an additive display, dark is invisible.** The first wall was grey and the holds disappeared into it. Light wood, light holds and glowing rings fixed it.
- **The words matter as much as the colours.** "Safe" would be a promise a pair of glasses can't keep, so the Lens never says it.
- **Writing the rule down first paid off.** Because the reference had its own tests, we could check CLAD's port line by line instead of eyeballing colours.

## What's next
Real hold detection and hand tracking on SPECS, separate leg reach, and remembering a marked wall so a gym's problems are set up once.

## Built with
Lens Studio 5.23.2, CLAD, Lens Studio MCP, Spectacles Interaction Kit, UI Kit, LEAF, TypeScript.
