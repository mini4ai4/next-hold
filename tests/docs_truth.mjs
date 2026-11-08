// Session 28 (v7.3 P2-9): the docs say what the build does. Each line below is a sentence a judge found false in
// session 27's docs (judge_v7_2/hound.md, engineer.md) or a word the build no longer shows; none may come back in the
// README or the current screenshot INDEX. Run: node tests/docs_truth.mjs (exits 1 on a hit). DEVPOST.md is the
// author's own text and isn't checked here.
import {readFileSync, existsSync} from "node:fs"

const files = ["README.md", "devpost/visual/v7_3/INDEX.md", "devpost/visual/v8/INDEX.md"].filter((f) => existsSync(f))
const banned = [
  [/every button is 11 × 10 cm with a 2\.2 cm label/, "label sizes: '?' and −/+ are 4 cm, Show my beta 1.7 cm"],
  [/needs a network connection/, "voice: the API reports NoInternet; Snap's page doesn't say it always needs one"],
  [/preview has no microphone/i, "voice: AsrModule doesn't run in the preview"],
  [/covers no ring\b(?![^.]*as far as)/, "panel: it keeps off rings as far as the view allows, not always"],
  [/Came off at move/, "the card now says 'Came off from here'"],
  [/your par \d/, "the card now says 'the shortest for you'"],
  [/ticked on this go/, "dropped from the card"],
  [/"jug, in reach"/, "rung 3 now says what the move sets up"],
  [/no capture script calling NextHoldMain/, "the capture calls useStore and injectVoice"],
  [/refreshed once at the start/, "LEAF resets the Lens before every scenario"],
  // session 29 (v8 change 3): the card shows your time after a top from the start (never a clock while you climb)
  [/There's no timer|There is no timer|No timer, no points/i, "v8: no clock while you climb; the card shows your time after the top"],
  // session 30, the hound's table (judge_v8_brief/hound.md §4): words never used for the eye height, the split, the time
  [/measures your height|knows how tall|auto-?detects? your height|calibrated to your body|fits your body exactly/i, "it proposes your height from your eye height; − / + change it"],
  [/accurate to the cent|precise height/i, "a starting number, a few cm either way"],
  [/0\.93 (×|x) stature|÷ 0\.93\b(?!5)|EYE_RATIO = 0\.93\b(?!5)/, "the ratio is 0.935 (adult tables 0.933–0.937)"],
  [/weight doesn't matter|reach doesn't depend on (it|weight)/i, "weight, strength and flexibility aren't modelled, and they change what's secure for you"],
  [/best way to climb|the correct (route|way)|optimal (beta|route|way)|the right route|you went wrong|your mistake/i, "the shortest for you, by our model; a shorter line to try"],
  [/provably shortest|guaranteed shortest/i, "the fewest moves the planner finds, within its search limit"],
  [/no par for your body/i, "the card says 'no shortest found'"],
  [/learns your climbing|remembers how you climb|gets smarter/i, "a stored record plus a recomputed search"],
  [/time trials?|race the clock|beat your time/i, "how long it took, after you're down"],
  [/\d:\d\d on the wall|time on the wall/i, "'start to top', not 'on the wall'"],
]
let hits = 0
for (const f of files) {
  const text = readFileSync(f, "utf8")
  for (const [re, why] of banned) {
    const m = text.match(re)
    if (m) { hits++; console.log(` FAIL ${f}: "${m[0]}" (${why})`) }
  }
}
console.log(`${files.length} files, ${banned.length} checks each: ${hits ? hits + " false sentence(s)" : "none found"}`)
process.exit(hits ? 1 : 0)
