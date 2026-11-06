// Session 28: print what matches a regex in one scenario's latest run block of the newest Lens Studio log.
// Usage: node tests/leaf_grep.mjs <scenario id> <after line> <regex> [max chars per match, default 400]
// The block runs from the last "RUNS: <id> " after <after line> to its PASSED / FAILED line (or the log's end). Each
// match prints on its own line; a FAILED message is split at "\n" so every error shows on its own line.
import {readFileSync, readdirSync, statSync} from "node:fs"
import {join} from "node:path"
import {homedir} from "node:os"

const [id, afterArg, pattern, maxArg] = process.argv.slice(2)
if (!id || !pattern) { console.error("usage: node tests/leaf_grep.mjs <id> <after line> <regex> [max]"); process.exit(2) }
const dir = join(homedir(), "Library/Preferences/Snap/Lens Studio/logs")
const log = readdirSync(dir).filter((f) => f.startsWith("LensStudioLog-")).map((f) => join(dir, f))
  .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0]
const lines = readFileSync(log, "utf8").split("\n")
let start = -1
for (let i = Number(afterArg) || 0; i < lines.length; i++) if (lines[i].includes(`RUNS: ${id} `)) start = i
if (start < 0) { console.log(`no RUNS: ${id} after line ${afterArg}`); process.exit(1) }
let end = lines.length
for (let i = start; i < lines.length; i++) if (lines[i].includes(`PASSED: ${id}`) || lines[i].includes(`FAILED: ${id}`)) { end = i + 1; break }
const re = new RegExp(pattern, "g")
const max = Number(maxArg) || 400
for (const l of lines.slice(start, end)) {
  const text = l.replace(/^.*\[Preview 1\] /, "")
  for (const m of text.matchAll(re)) for (const part of m[0].split("\\n")) console.log(part.slice(0, max))
}
