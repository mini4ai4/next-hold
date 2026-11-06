// Session 26: where a long LEAF run stands. Usage: node tests/leaf_status.mjs [after line]
// Prints the newest log's line count, then for every scenario that RAN after `after` its last verdict
// (PASSED / FAILED + the message / ABORTED if the preview reset with no verdict / RUNNING), in run order.
import {readFileSync, readdirSync, statSync} from "node:fs"
import {join} from "node:path"
import {homedir} from "node:os"

const dir = join(homedir(), "Library/Preferences/Snap/Lens Studio/logs")
const log = readdirSync(dir).filter((f) => f.startsWith("LensStudioLog-")).map((f) => join(dir, f))
  .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0]
const lines = readFileSync(log, "utf8").split("\n")
const after = Number(process.argv[2] || 0)
const runs = new Map()
let current = null
for (let i = after; i < lines.length; i++) {
  const l = lines[i]
  const r = l.match(/RUNS: (\S+) /)
  if (r) { current = r[1]; runs.delete(current); runs.set(current, {verdict: "RUNNING", line: i + 1, msg: ""}); continue }
  const v = l.match(/\]\s*(PASSED|FAILED): (\S+?)( - (.*))?$/)
  if (v && runs.has(v[2]) && runs.get(v[2]).verdict === "RUNNING") runs.get(v[2]).verdict = v[1], runs.get(v[2]).msg = (v[4] || "").slice(0, 300)
  if (current && l.includes("Lens has been reset") && runs.get(current) && runs.get(current).verdict === "RUNNING") runs.get(current).verdict = "ABORTED"
}
console.log(`${log} has ${lines.length} lines`)
let pass = 0
for (const [id, r] of runs) { if (r.verdict === "PASSED") pass++; console.log(`${r.verdict.padEnd(8)} ${id} (line ${r.line})${r.msg ? " " + r.msg : ""}`) }
console.log(`${pass} of ${runs.size} passed`)
