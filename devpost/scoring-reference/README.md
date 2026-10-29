# scoring-reference — design validation (not the Lens)

This folder proves the **Next Hold** colour rule works *before* CLAD builds the Lens, so
the design brief's done-criteria rest on a rule that's been run, not guessed.

- `scoring.js` — a pure-JS reference of the green/yellow/red rule from `../IDEA.md`
  (grip quality × reach factor × balance factor → green ≥ 0.7, yellow 0.4–0.7, red < 0.4),
  plus the upward goal (below).
- `scoring.test.js` — 27 assertions tying the rule to the brief's done-criteria. Run:
  `node scoring.test.js` → **27 passed, 0 failed**.

## Feet reach like legs (added 29 Oct, session 14)
Until then a foot used the arm's 77 cm reach. Now a foot reaches from the **hip** with the
leg's reach (1.25 × the arm's), and the hip hangs 0.5 × reach below the lower hand, because a
climber pulls the hip in toward the hands for a foot move. A foot can go well below the hands
(a rock-over about 40 cm under them is green), but a target above the hip is a **high step**:
its reach falls to 0 at 0.35 × reach above the hip, and the why-line says "HIGH STEP". Hands
are unchanged. Every number is a share of reach, so all of it scales with the climber's height.

## The upward goal (added 28 Oct, after the pre-submission review)
Among moves of similar quality, a hold that gets you higher and closer to the problem's
top hold should rank better. `goalFactor = 0.75 + 0.25 × progress`, where progress is
(height gained + distance to the top saved) ÷ (2 × reach), clamped to −1…1, measured from
the hold the moving limb is on now. No top hold → 1.

The goal only **ranks**: `rank = score × goalFactor` picks the suggestion, while the
colour still comes from `score` alone. So green keeps meaning "secure grip for you, from
where you are now", and out of reach is still score 0 → red, ranked last, even when that
hold is the top. Without it the rule kept suggesting "back down to the hold you just left"
after a good move up (a jug going down beat a pinch going up), so a look-ahead over the best
move went up, down, up.

## What this is and isn't
This is **design work**, kept deliberately separate from the submission's Lens code. The
hackathon requires the Lens itself to be **built with CLAD** inside Lens Studio — CLAD
writes that. This reference only de-risks the algorithm and lets me say "logic proven" for
the scoring. When CLAD builds the Lens it implements the same rule in the scene; this JS
is the spec it works from, documented here for transparency (disclosed as pre-written
design, per the rules).

## What the tests showed
Validating numerically caught a design bug the first run: a hold placed at 96% of reach
was (correctly) coloured yellow, not green — "within 80% reach" is the green band. The
rule was right; the demo wall geometry was wrong. Fixed the geometry, not the rule. This
is exactly the kind of thing that would otherwise only surface late, in the preview.
