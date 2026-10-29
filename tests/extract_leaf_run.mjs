// Copies one LEAF run out of the Lens Studio log, so devpost/LEAF_RUN_*.txt can be rebuilt from the raw log.
// Usage: node tests/extract_leaf_run.mjs <LensStudioLog-*.txt> <first line number of the run> [last line number]
// Keeps every LEAF runner line (RUNS / PASSED / FAILED, runner config, but not "Register scenario"), every
// scenario print (Assets/Tests/Leaf/...), the LEAF plugin's view-model lines ("Running scenario", "completed")
// and Lens Studio's "Lens has been reset". Cuts only the C++ / JS source prefix of each line; the time stays,
// the message is not changed.

import {readFileSync} from "node:fs"

const [logPath, fromArg, toArg] = process.argv.slice(2)
if (!logPath || !fromArg) {
  console.error("usage: node tests/extract_leaf_run.mjs <log> <first line> [last line]")
  process.exit(2)
}
const from = Number(fromArg), to = toArg ? Number(toArg) : Infinity
const lines = readFileSync(logPath, "utf8").split("\n")

for (let n = from; n <= Math.min(to, lines.length); n++) {
  const line = lines[n - 1]
  if (!line) continue
  const time = line.split(" ")[1]
  let msg = null
  if (line.includes("Lens has been reset")) msg = "Lens has been reset"
  else if (line.includes("[LeafPlugin][PluginViewModel]")) msg = line.slice(line.indexOf("[LeafPlugin][PluginViewModel]"))
  else if (line.includes("Leaf.lspkg/Utils/common/Logger.ts") && !line.includes("Register scenario")) {
    const m = line.match(/Logger\.ts:\d+\] [A-Z] \[[^\]]*\] (.*)$/)
    if (m) msg = m[1]
  } else if (line.includes("[Assets/Tests/Leaf/")) {
    const m = line.match(/\[Assets\/Tests\/Leaf\/[^\]]*\] (.*)$/)
    if (m) msg = m[1]
  }
  if (msg !== null) console.log(time + " " + msg)
}
