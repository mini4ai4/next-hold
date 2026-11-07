// Session 28: wait until a regex shows up in one scenario's latest run block of the newest Lens Studio log (e.g. the
// capture's "holding ... shoot now"), then print the match. Usage:
//   node tests/leaf_until.mjs <scenario id> <after line> <regex> [timeout s, default 600]
// Exits 0 on a match, 1 on timeout, 2 if the block ended (PASSED/FAILED) without one.
import {readFileSync, readdirSync, statSync} from "node:fs"
import {join} from "node:path"
import {homedir} from "node:os"

const [id, afterArg, pattern, timeoutArg] = process.argv.slice(2)
if (!id || !pattern) { console.error("usage: node tests/leaf_until.mjs <id> <after line> <regex> [timeout s]"); process.exit(3) }
const dir = join(homedir(), "Library/Preferences/Snap/Lens Studio/logs")
const re = new RegExp(pattern)
const deadline = Date.now() + (Number(timeoutArg) || 600) * 1000
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
for (;;) {
  const log = readdirSync(dir).filter((f) => f.startsWith("LensStudioLog-")).map((f) => join(dir, f))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0]
  const lines = readFileSync(log, "utf8").split("\n")
  let start = -1
  for (let i = Number(afterArg) || 0; i < lines.length; i++) if (lines[i].includes(`RUNS: ${id} `)) start = i
  if (start >= 0) {
    for (let i = start; i < lines.length; i++) {
      const t = lines[i].replace(/^.*\[Preview 1\] /, "")
      const m = t.match(re)
      if (m) { console.log(t.slice(0, 400)); process.exit(0) }
      if (lines[i].includes(`PASSED: ${id}`) || lines[i].includes(`FAILED: ${id}`)) { console.log("ended: " + t.slice(0, 400)); process.exit(2) }
    }
  }
  if (Date.now() > deadline) { console.log("timeout"); process.exit(1) }
  await sleep(2000)
}
