// NextHoldAttempt — the climb in climbing's own words, and what is kept (v7 parts B and C, session 24).
//
// Plain code with no Lens globals, so it is unit-checked in Node (tests/scoring.port.test.mjs). The
// store is passed in: on SPECS it is global.persistentStorageSystem.store; LEAF and the demo autopilot
// hand in a fresh GeneralDataStore.create(); Node hands in a plain fake with the same methods.
//
// A go ends at the top (NextHoldBeta.toppedOut) or at a fall. Topped, the result card reads three lines
// (session 26, the climber's and designer's wording):
//   SEND · go 2                            (ONSIGHT · go 1 | FLASH · go 1 | SEND · go N | REPEAT · go N)
//   4 moves · the shortest for you         (session 28; par: the planner's shortest secure route from the start, at
//                                           your height; over it: "6 moves · shortest for you: 4")
//   1 hint · sent! Again without it?       (session 28, a first top; a REPEAT: "1 hint · ticked: onsight (go 1)";
//                                           an ONSIGHT says "Clean onsight. Pick something harder?")
// ONSIGHT: the first go on this problem, beta never shown and no hint at all (session 26: rung 1 is a hint).
// FLASH: the first go, with beta or a hint. SEND: the first top on a later go. Session 26: the count stops at the
// first top: that is the problem's tick, and every later top is a REPEAT. Goes are counted per problem (a new
// height is the same problem, so it brings no fresh ONSIGHT); the best is kept per problem and height and ranked
// tick, then go (first tops only), then hints, then moves. A top climbed on from a fall, not from the start, gets
// no tick (resumedLines). No points. v8 (session 29): no clock while you climb; the card shows your time after the
// top, as a fourth line (timeLine), only for a top from the start, and time never ranks a go.
// v8 change 2: over the shortest, line 2 says at which move the go left it ("5 moves · shortest 4 · split at move 4",
// NextHoldPlan.splitMove); it never names the move's hold or limb (that would be the answer key).
//
// Kept (each read and write in try/catch, so a bad value or a full store never stops the Lens):
//   nh.goes.<hash of the problem>          {"g": goes ended, "b": the tick {"t", "n": go, "m": moves, "h": hints} | null}
//   nh.best.<hash of problem@height>       {"g": 0, "b": the best top at this height | null, "s": fastest top from the
//                                          start at this height, seconds (v8; optional, older records have none)}
//   nh.height                              the climber's height, cm
// Before each write the store's size is checked against getMaxSizeInBytes() (a store reporting 0 gets our own
// 10 KB cap); if the store can't be read, or the write would pass 90% of the cap, nothing is written. A record is
// about 70 bytes, so the preview's 100 KB store holds about 1,300 of them; past that nothing more is kept (there
// is no eviction).

export type Tick = "ONSIGHT" | "FLASH" | "SEND" | "REPEAT"

export interface Go { tick: Tick; go: number; moves: number; hints: number }
export interface ProblemRecord { goes: number; best: Go | null; secs?: number }

export const HEIGHT_KEY = "nh.height"
export const BEST_PREFIX = "nh.best."
export const GOES_PREFIX = "nh.goes."
export const STORE_HEADROOM = 0.9
/** the cap used when a store reports none (measured: the preview's persistent store says 102400 bytes, an
 *  in-memory GeneralDataStore.create() says 0) */
export const FALLBACK_MAX_BYTES = 10240
export const ONSIGHT_LINE = "Clean onsight. Pick something harder?"

/** ONSIGHT / FLASH / SEND from what the go recorded (NextHoldBeta: attempt, betaSeenThisGo, hintsThisGo), for the
 *  problem's first top; a later top is a REPEAT (tickOf). */
export function tickFor(go: number, betaSeen: boolean, hints: number): Tick {
  if (go > 1) return "SEND"
  return !betaSeen && hints === 0 ? "ONSIGHT" : "FLASH"
}

/** the tick of a top from the start: REPEAT if the problem is already ticked, else tickFor */
export function tickOf(ticked: Go | null, go: number, betaSeen: boolean, hints: number): Tick {
  return ticked ? "REPEAT" : tickFor(go, betaSeen, hints)
}

const RANK: {[t: string]: number} = {ONSIGHT: 0, FLASH: 1, SEND: 2, REPEAT: 3}

/** Is `a` better than `b` (session 26, the climber's order): the tick first, then the earlier go (first tops only:
 *  goes-to-send is the number), then fewer hints (clean beats beta'd), and moves only break a tie. */
export function better(a: Go, b: Go | null): boolean {
  if (!b) return true
  if (RANK[a.tick] !== RANK[b.tick]) return RANK[a.tick] < RANK[b.tick]
  if (a.tick !== "REPEAT" && a.go !== b.go) return a.go < b.go
  if (a.hints !== b.hints) return a.hints < b.hints
  return a.moves < b.moves
}

export function hintsText(n: number): string {
  return n === 1 ? "1 hint" : `${n} hints`
}

export function movesText(n: number): string {
  return n === 1 ? "1 move" : `${n} moves`
}

/** the card's first line: the tick and the go */
export function heroLine(g: Go): string {
  return `${g.tick} · go ${g.go}`
}

/** The result card's three lines for a top from the start. `ticked`: the problem's tick before this go (null: this
 *  go is the tick). Session 28 (v7.3 P1-7, the climber's P2s): par is the fewest secure moves and a pinch only makes
 *  secure moves, so it can be tied, never beaten: line 2 says "the shortest for you" (over it, "shortest for you: N");
 *  "ticked on this go" repeated the first line and is gone; a first top that isn't an onsight gets one line that
 *  points at the next go (SEND is the most common result, and got nothing). */
export function cardLines(g: Go, par: number | null, ticked: Go | null, split: number | null = null): string[] {
  // session 30 (the hound): par is null when the search gives up (its state cap) or a route is over 8 moves, so the
  // card says what happened, "no shortest found", not that there's no route for your body
  const l2 = par === null ? `${movesText(g.moves)} · no shortest found`
    : g.moves <= par ? `${movesText(g.moves)} · the shortest for you`
    : split !== null ? `${movesText(g.moves)} · shortest ${par} · split at move ${split}`
    : `${movesText(g.moves)} · shortest for you: ${par}`
  const l3 = g.tick === "ONSIGHT" ? ONSIGHT_LINE
    : ticked ? `${hintsText(g.hints)} · ticked: ${ticked.tick.toLowerCase()} (go ${ticked.go})`
    : firstTopLine(g, par)
  return [heroLine(g), l2, l3]
}

/** session 28: the third line of a first top that isn't an onsight: the hints, and the next thing to try */
export function firstTopLine(g: Go, par: number | null): string {
  const done = g.tick === "FLASH" ? "flashed" : "sent"
  if (g.hints > 0) return `${hintsText(g.hints)} · ${done}! Again without ${g.hints === 1 ? "it" : "them"}?`
  if (par !== null && g.moves > par) return `No hints · ${done}! Again in ${par}?`
  return g.tick === "FLASH" ? "No hints · flashed with your beta" : "No hints · clean send!"
}

/** v8 (session 29): seconds as m:ss ("1:42", "0:07"); whole seconds, never tenths (tenths say "race") */
export function clockText(sec: number): string {
  const t = Math.max(0, Math.floor(isFinite(sec) ? sec : 0))
  const m = Math.floor(t / 60), r = t % 60
  return `${m}:${r < 10 ? "0" : ""}${r}`
}

/** v8: is `sec` a new best time against the kept one (none kept, or faster) */
export function isNewBestTime(sec: number, best: number | null | undefined): boolean {
  return best === null || best === undefined || sec < best
}

/** v8: the card's fourth line after a top from the start: "1:42 start to top · best 1:31", or "· new best" when it
 *  is the first or the fastest at this problem and height. `best` is the kept best before this go. */
export function timeLine(sec: number, best: number | null | undefined): string {
  return `${clockText(sec)} start to top · ` + (isNewBestTime(sec, best) ? "new best" : `best ${clockText(best as number)}`)
}

/** Session 26: the card for a top climbed on from a fall (not from the start holds): no tick, no best. */
export const RESUMED_HERO = "TOPPED · not from the start"
export const RESUMED_LINE = "A tick needs a go from the start"
export function resumedLines(hints: number): string[] {
  return [RESUMED_HERO, RESUMED_LINE, `${hintsText(hints)} · Again to go from the start`]
}

/** 32-bit FNV-1a, as 8 hex digits */
export function fnv1a(s: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return ("0000000" + h.toString(16)).slice(-8)
}

/** the store key for a problem's best (NextHoldBeta.problemKey: holds, starts, top) at a height */
export function bestKey(problem: string, heightCm: number): string {
  return BEST_PREFIX + fnv1a(problem + "@" + Math.round(heightCm))
}

/** Session 26: the store key for a problem's goes and tick, whatever the height */
export function goesKey(problem: string): string {
  return GOES_PREFIX + fnv1a(problem)
}

/** a stored height, snapped to 5 cm in 150-200; null if it isn't one */
export function cleanHeight(v: number, min = 150, max = 200, step = 5): number | null {
  if (typeof v !== "number" || !isFinite(v) || v < min || v > max) return null
  return Math.round(v / step) * step
}

/** what a store must offer (GeneralDataStore does) */
export interface KVStore {
  has(key: string): boolean
  getString(key: string): string
  putString(key: string, value: string): void
  getInt(key: string): number
  putInt(key: string, value: number): void
  remove(key: string): void
  getAllKeys(): string[]
  getMaxSizeInBytes(): number
}

export function encodeRecord(r: ProblemRecord): string {
  const o: {g: number; b: {t: Tick; n: number; m: number; h: number} | null; s?: number} =
    {g: r.goes, b: r.best ? {t: r.best.tick, n: r.best.go, m: r.best.moves, h: r.best.hints} : null}
  if (typeof r.secs === "number" && isFinite(r.secs) && r.secs >= 0) o.s = Math.round(r.secs * 10) / 10
  return JSON.stringify(o)
}

/** a stored record, or the empty one if it is missing or not a record */
export function decodeRecord(s: string): ProblemRecord {
  const empty: ProblemRecord = {goes: 0, best: null}
  try {
    const o = JSON.parse(s)
    if (!o || typeof o.g !== "number" || o.g < 0 || !isFinite(o.g)) return empty
    const b = o.b
    const ok = b && RANK[b.t] !== undefined && [b.n, b.m, b.h].every((v) => typeof v === "number" && isFinite(v) && v >= 0)
    const r: ProblemRecord = {goes: Math.floor(o.g), best: ok ? {tick: b.t as Tick, go: b.n, moves: b.m, hints: b.h} : null}
    // v8: the fastest top from the start, if kept (older records have none and read as before)
    if (typeof o.s === "number" && isFinite(o.s) && o.s >= 0) r.secs = o.s
    return r
  } catch (e) {
    return empty
  }
}

/** The Lens's only door to the store. Never throws. */
export class NextHoldSave {
  /** what the last write did, for the read API and the log */
  lastWrite = ""
  private store: KVStore | null
  constructor(store: KVStore | null) { this.store = store }

  hasStore(): boolean { return !!this.store }

  /** the store's cap; a store that reports none (GeneralDataStore.create() says 0 in the preview) gets
   *  FALLBACK_MAX_BYTES, so nothing is ever written without a cap. 0 if the store can't be read at all. */
  maxBytes(): number {
    try {
      if (!this.store) return 0
      const m = this.store.getMaxSizeInBytes()
      return typeof m === "number" && m > 0 ? m : FALLBACK_MAX_BYTES
    } catch (e) {
      return 0
    }
  }

  /** bytes the store holds by our count (each key and its value; an int counts 8) */
  usedBytes(): number {
    if (!this.store) return 0
    try {
      let n = 0
      for (const k of this.store.getAllKeys()) {
        let v = ""
        try { v = this.store.getString(k) } catch (e) { v = "" }
        n += k.length + (v ? v.length : 8)
      }
      return n
    } catch (e) {
      return 0
    }
  }

  /** would `extra` more bytes under `key` (replacing what is there) still fit? */
  fits(key: string, extra: number): boolean {
    const max = this.maxBytes()
    if (!(max > 0)) return false
    let old = 0
    try { if (this.store!.has(key)) old = key.length + (this.store!.getString(key).length || 8) } catch (e) { old = 0 }
    return this.usedBytes() - old + key.length + extra <= max * STORE_HEADROOM
  }

  readRecord(key: string): ProblemRecord {
    try {
      if (this.store && this.store.has(key)) return decodeRecord(this.store.getString(key))
    } catch (e) { /* fall through */ }
    return {goes: 0, best: null}
  }

  writeRecord(key: string, r: ProblemRecord): boolean {
    const v = encodeRecord(r)
    if (!this.store || !this.fits(key, v.length)) { this.lastWrite = "skipped " + key; return false }
    try {
      this.store.putString(key, v)
      this.lastWrite = "wrote " + key + " " + v
      return true
    } catch (e) {
      this.lastWrite = "failed " + key
      return false
    }
  }

  readHeight(): number | null {
    try {
      if (this.store && this.store.has(HEIGHT_KEY)) return cleanHeight(this.store.getInt(HEIGHT_KEY))
    } catch (e) { /* fall through */ }
    return null
  }

  writeHeight(cm: number): boolean {
    if (!this.store || !this.fits(HEIGHT_KEY, 8)) { this.lastWrite = "skipped " + HEIGHT_KEY; return false }
    try {
      this.store.putInt(HEIGHT_KEY, Math.round(cm))
      this.lastWrite = "wrote " + HEIGHT_KEY + " " + Math.round(cm)
      return true
    } catch (e) {
      this.lastWrite = "failed " + HEIGHT_KEY
      return false
    }
  }
}
