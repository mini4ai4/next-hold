// Waits for one LEAF scenario's result in the Lens Studio log (run_leaf_scenario often times out while the run
// goes on). Usage: node tests/leaf_wait.mjs <scenario id> [timeout s, default 900] [after line, default: the log's
// current end]. Prints the scenario's RUNS..PASSED/FAILED block (its own prints and the failure message), then
// "RESULT <id> PASSED|FAILED|TIMEOUT|ABORTED" and the log path and line of RUNS (for extract_leaf_run.mjs).
// ABORTED: "Lens has been reset" came after RUNS with no result (the sign-in refresh): dispatch it once more.
import {readFileSync, readdirSync, statSync} from "node:fs"
import {join} from "node:path"
import {homedir} from "node:os"

const [id, timeoutArg, afterArg] = process.argv.slice(2)
if (!id) { console.error("usage: node tests/leaf_wait.mjs <id> [timeout s] [after line]"); process.exit(2) }
const dir = join(homedir(), "Library/Preferences/Snap/Lens Studio/logs")
const newest = () => readdirSync(dir).filter((f) => f.startsWith("LensStudioLog-")).map((f) => join(dir, f))
  .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0]
const log = newest()
const read = () => readFileSync(log, "utf8").split("\n")
const after = afterArg ? Number(afterArg) : read().length
const deadline = Date.now() + (timeoutArg ? Number(timeoutArg) : 900) * 1000
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

for (;;) {
  const lines = read()
  let runs = -1, end = -1, verdict = ""
  for (let i = after; i < lines.length; i++) {
    const l = lines[i]
    if (l.includes(`RUNS: ${id} `)) { runs = i; end = -1; verdict = "" }
    if (runs >= 0 && end < 0) {
      if (l.includes(`PASSED: ${id}`)) { end = i; verdict = "PASSED" }
      else if (l.includes(`FAILED: ${id}`)) { end = i; verdict = "FAILED" }
      else if (i > runs && l.includes("Lens has been reset")) { end = i; verdict = "ABORTED" }
    }
  }
  if (verdict) {
    for (let i = runs; i <= Math.min(lines.length - 1, end + 3); i++) {
      const l = lines[i]
      if (l.includes("Running with runner config")) continue
      const short = l.replace(/^(\S+ \S+) .*?\[Assets\/Tests\/Leaf\/[^\]]*\] /, "$1 ").replace(/^(\S+ \S+) .*?Logger\.ts:\d+\] /, "$1 ")
      if (l.includes("[Assets/Tests/Leaf/") || l.includes("Logger.ts") || l.includes("Error") || l.includes(" E ")) console.log(short.slice(0, 1600))
    }
    console.log(`RESULT ${id} ${verdict} (log ${log}, RUNS at line ${runs + 1})`)
    process.exit(0)
  }
  if (Date.now() > deadline) { console.log(`RESULT ${id} TIMEOUT (${runs >= 0 ? "running since line " + (runs + 1) : "not started"})`); process.exit(0) }
  await sleep(3000)
}
