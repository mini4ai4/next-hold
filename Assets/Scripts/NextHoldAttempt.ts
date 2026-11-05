// NextHoldAttempt — the climb in climbing's own words, and what is kept (v7 parts B and C, session 24).
//
// Plain code with no Lens globals, so it is unit-checked in Node (tests/scoring.port.test.mjs). The
// store is passed in: on SPECS it is global.persistentStorageSystem.store; LEAF and the demo autopilot
// hand in a fresh GeneralDataStore.create(); Node hands in a plain fake with the same methods.
//
// A go ends at the top (NextHoldBeta.toppedOut) or at a fall. Topped, the result card reads three lines:
//   ONSIGHT | FLASH | SEND (attempt N)
//   6 moves · par for your body 6          (par: the planner's shortest secure route from the start, at your height)
//   Hints: 1 · Best: SEND in 3, 7 moves     (after an ONSIGHT: "Clean onsight. Pick something harder?")
// ONSIGHT: the first go on this problem at this height, beta never shown and no hint taken. FLASH: the first
// go, with beta or hints. SEND: a later go. No timer, no points. "Best" is kept per problem and height.
//
// Kept (each read and write in try/catch, so a bad value or a full store never stops the Lens):
//   nh.best.<hash>  {"g": goes ended, "b": {"t": tick, "n": go, "m": moves, "h": hints} | null}
//   nh.height       the climber's height, cm
// Before each write the store's size is checked against getMaxSizeInBytes() (a store reporting 0 gets our own
// 10 KB cap); if the store can't be read, or the write would pass 90% of the cap, nothing is written.

export type Tick = "ONSIGHT" | "FLASH" | "SEND"

export interface Go { tick: Tick; go: number; moves: number; hints: number }
export interface ProblemRecord { goes: number; best: Go | null }

export const HEIGHT_KEY = "nh.height"
export const BEST_PREFIX = "nh.best."
export const STORE_HEADROOM = 0.9
/** the cap used when a store reports none (measured: the preview's persistent store says 102400 bytes, an
 *  in-memory GeneralDataStore.create() says 0) */
export const FALLBACK_MAX_BYTES = 10240
export const ONSIGHT_LINE = "Clean onsight. Pick something harder?"

/** ONSIGHT / FLASH / SEND from what the go recorded (NextHoldBeta: attempt, betaSeenThisGo, hintsThisGo). */
export function tickFor(go: number, betaSeen: boolean, hints: number): Tick {
  if (go > 1) return "SEND"
  return !betaSeen && hints === 0 ? "ONSIGHT" : "FLASH"
}

const RANK: {[t: string]: number} = {ONSIGHT: 0, FLASH: 1, SEND: 2}

/** Is `a` better than `b`: the tick first, then fewer moves, fewer hints, an earlier go. */
export function better(a: Go, b: Go | null): boolean {
  if (!b) return true
  if (RANK[a.tick] !== RANK[b.tick]) return RANK[a.tick] < RANK[b.tick]
  if (a.moves !== b.moves) return a.moves < b.moves
  if (a.hints !== b.hints) return a.hints < b.hints
  return a.go < b.go
}

export function fmtBest(b: Go): string {
  return b.tick === "SEND" ? `SEND in ${b.go}, ${b.moves} moves` : `${b.tick}, ${b.moves} moves`
}

/** The result card's three lines. `prevBest`: the best before this go (null: none). */
export function cardLines(g: Go, par: number | null, prevBest: Go | null): string[] {
  const l1 = g.tick === "SEND" ? `SEND (attempt ${g.go})` : g.tick
  const l2 = par === null ? `${g.moves} moves · no par for your body` : `${g.moves} moves · par for your body ${par}`
  const l3 = g.tick === "ONSIGHT" ? ONSIGHT_LINE
    : `Hints: ${g.hints} · ` + (better(g, prevBest) ? "New best" : `Best: ${fmtBest(prevBest!)}`)
  return [l1, l2, l3]
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

/** the store key for a problem (NextHoldBeta.problemKey: holds, starts, top) at a height */
export function bestKey(problem: string, heightCm: number): string {
  return BEST_PREFIX + fnv1a(problem + "@" + Math.round(heightCm))
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
  return JSON.stringify({g: r.goes, b: r.best ? {t: r.best.tick, n: r.best.go, m: r.best.moves, h: r.best.hints} : null})
}

/** a stored record, or the empty one if it is missing or not a record */
export function decodeRecord(s: string): ProblemRecord {
  const empty: ProblemRecord = {goes: 0, best: null}
  try {
    const o = JSON.parse(s)
    if (!o || typeof o.g !== "number" || o.g < 0 || !isFinite(o.g)) return empty
    const b = o.b
    const ok = b && RANK[b.t] !== undefined && [b.n, b.m, b.h].every((v) => typeof v === "number" && isFinite(v) && v >= 0)
    return {goes: Math.floor(o.g), best: ok ? {tick: b.t as Tick, go: b.n, moves: b.m, hints: b.h} : null}
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
