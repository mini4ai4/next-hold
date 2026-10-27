# scoring-reference — design validation (not the Lens)

This folder proves the **Next Hold** colour rule works *before* CLAD builds the Lens, so
the design brief's done-criteria rest on a rule that's been run, not guessed.

- `scoring.js` — a pure-JS reference of the green/yellow/red rule from `../IDEA.md`
  (grip quality × reach factor × balance factor → green ≥ 0.7, yellow 0.4–0.7, red < 0.4).
- `scoring.test.js` — 11 assertions tying the rule to the brief's done-criteria. Run:
  `node scoring.test.js` → **11 passed, 0 failed**.

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
