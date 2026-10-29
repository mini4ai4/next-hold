// NextHoldReferenceRule — the TEST's own port of devpost/scoring-reference/scoring.js.
//
// Deliberately independent of Assets/Scripts/NextHoldScoring.ts: the tests
// compute the expected colour / score / why for every hold with this file and
// compare that to what the Lens renders. Do not import the Lens scoring here.
// bestMove() follows the brief: evaluate all four limbs, keep the single best
// (limb, hold) by rank (score x the upward goal toward the top hold), first
// limb wins ties in LH, RH, LF, RF order. The colour stays from the score.

export type RefLimb = "LH" | "RH" | "LF" | "RF"
export type RefColour = "green" | "yellow" | "red"
export interface RefPt {x: number; y: number}
export type RefPosition = {[limb: string]: string | null}

export const REF_LIMBS: RefLimb[] = ["LH", "RH", "LF", "RF"]
const REF_GRIP: {[t: string]: number} = {jug: 1.0, pinch: 0.75, crimp: 0.6, pocket: 0.55, sloper: 0.45}

export interface RefResult {
  holdId: string
  limb: RefLimb
  score: number
  colour: RefColour
  /** score x goalFactor: what the suggestion is picked by */
  rank: number
  why: string
  dist: number
  reachFactor: number
  balanceFactor: number
  goalFactor: number
}

export class ReferenceRule {
  /** top: the problem's top hold (the upward goal); null = no goal, rank = score */
  constructor(
    private holds: {[id: string]: RefPt},
    private types: {[id: string]: string},
    private reach: number,
    private top: string | null = null,
  ) {}

  com(p: RefPosition): RefPt {
    let sx = 0, sy = 0, n = 0
    for (const l of REF_LIMBS) {
      const id = p[l]
      if (id != null && this.holds[id]) {
        sx += this.holds[id].x
        sy += this.holds[id].y
        n++
      }
    }
    return n === 0 ? {x: 120, y: 100} : {x: sx / n, y: sy / n}
  }

  anchor(limb: RefLimb, com: RefPt): RefPt {
    const side = limb === "RH" || limb === "RF" ? 18 : -18
    const up = limb === "LH" || limb === "RH" ? 35 : -35
    return {x: com.x + side, y: com.y + up}
  }

  score(limb: RefLimb, holdId: string, p: RefPosition): RefResult {
    const t = this.holds[holdId]
    const q = REF_GRIP[this.types[holdId]] !== undefined ? REF_GRIP[this.types[holdId]] : 0.5
    const com = this.com(p)
    const a = this.anchor(limb, com)
    const d = Math.sqrt((a.x - t.x) * (a.x - t.x) + (a.y - t.y) * (a.y - t.y))
    const r = d / this.reach
    const rf = r <= 0.8 ? 1.0 : r <= 1.0 ? 1.0 - (r - 0.8) * 2.0 : 0.0

    let bf = 1.0
    if (limb === "LH" || limb === "RH") {
      if (!(p.LF != null && p.RF != null)) bf *= 0.6
      if (t.y <= com.y) bf *= 0.75
      const other = limb === "RH" ? p.LH : p.RH
      if (other != null && this.holds[other]) {
        const mid = this.holds[other].x
        if (limb === "RH" ? t.x < mid : t.x > mid) bf *= 0.6
      }
    } else {
      if (!(p.LH != null && p.RH != null)) bf *= 0.7
    }

    const s = q * rf * bf
    // upward goal: (height gained + distance to the top saved) / (2 x reach), from the limb's hold
    let gf = 1.0
    const top = this.top != null ? this.holds[this.top] : undefined
    if (top) {
      const on = p[limb]
      const from = on != null && this.holds[on] ? this.holds[on] : a
      const dt = (u: RefPt) => Math.sqrt((u.x - top.x) * (u.x - top.x) + (u.y - top.y) * (u.y - top.y))
      const progress = Math.max(-1, Math.min(1, ((t.y - from.y) + (dt(from) - dt(t))) / (2 * this.reach)))
      gf = 0.75 + 0.25 * progress
    }
    const why: string[] = [String(this.types[holdId] || "unmarked").toUpperCase() + " HOLD"]
    if (rf === 0) why.push("OUT OF REACH")
    else if (rf < 1) why.push("LONG REACH")
    if (bf < 1) why.push("COMMITTING BALANCE")
    const colour: RefColour = s >= 0.7 ? "green" : s >= 0.4 ? "yellow" : "red"
    return {holdId, limb, score: s, colour, rank: s * gf, why: why.join(" · "), dist: d, reachFactor: rf, balanceFactor: bf, goalFactor: gf}
  }

  /** Every hold no limb is on, scored for `limb`. */
  evaluate(limb: RefLimb, p: RefPosition): {results: RefResult[]; suggestion: RefResult | null} {
    const occ: {[id: string]: boolean} = {}
    for (const l of REF_LIMBS) if (p[l] != null) occ[p[l] as string] = true
    const results: RefResult[] = []
    for (const id of Object.keys(this.holds)) if (!occ[id]) results.push(this.score(limb, id, p))
    let best: RefResult | null = null
    for (const r of results) if (r.rank > (best ? best.rank : -1)) best = r
    return {results, suggestion: best && best.score > 0 ? best : null}
  }

  bestMove(p: RefPosition): RefResult | null {
    let best: RefResult | null = null
    for (const l of REF_LIMBS) {
      const s = this.evaluate(l, p).suggestion
      if (s && s.rank > (best ? best.rank : -1)) best = s
    }
    return best
  }

  /**
   * Sequence preview, per the review: the next 2-3 moves by bestMove from `p`.
   * Step 1 is `limb`'s suggestion when given (the glowing ring). A move that
   * puts a limb back on a hold it left in this look-ahead is never chosen; the
   * best other move is. Ends after a hand reaches the top.
   */
  sequence(p: RefPosition, limb: RefLimb | null = null, steps = 3): RefResult[] {
    const out: RefResult[] = []
    let pos: RefPosition = {...p}
    const left: {[l: string]: string[]} = {LH: [], RH: [], LF: [], RF: []}
    for (let i = 0; i < steps; i++) {
      let m: RefResult | null = null
      for (const l of i === 0 && limb ? [limb] : REF_LIMBS) {
        for (const r of this.evaluate(l, pos).results) {
          if (r.score > 0 && left[l].indexOf(r.holdId) < 0 && r.rank > (m ? m.rank : -1)) m = r
        }
      }
      if (!m) break
      out.push(m)
      const from = pos[m.limb]
      if (from != null) left[m.limb].push(from)
      pos = {...pos, [m.limb]: m.holdId}
      if (this.top != null && m.holdId === this.top && (m.limb === "LH" || m.limb === "RH")) break
    }
    return out
  }

  /** the same rule without the upward goal (to show what the goal changes) */
  withoutGoal(): ReferenceRule {
    return new ReferenceRule(this.holds, this.types, this.reach, null)
  }
}
