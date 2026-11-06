// Session 28 (v7.3 P2-9): the docs say what the build does. Each line below is a sentence a judge found false in
// session 27's docs (judge_v7_2/hound.md, engineer.md) or a word the build no longer shows; none may come back in the
// README or the current screenshot INDEX. Run: node tests/docs_truth.mjs (exits 1 on a hit). DEVPOST.md is the
// author's own text and isn't checked here.
import {readFileSync, existsSync} from "node:fs"

const files = ["README.md", "devpost/visual/v7_3/INDEX.md"].filter((f) => existsSync(f))
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
