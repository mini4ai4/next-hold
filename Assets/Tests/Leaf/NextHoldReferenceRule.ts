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
  /** from the shoulder (hand) or the hip (foot) */
  dist: number
  /** the arm's reach for a hand, the leg's (1.25 x) for a foot */
  limbReach: number
  /** feet: 1 at or below the hip, falling to 0 at 0.35 x reach above it; hands: 1 */
  highStep: number
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

  /** a hand's shoulder (hands reach from here with the arm's reach) */
  anchor(limb: RefLimb, com: RefPt): RefPt {
    const side = limb === "RH" || limb === "RF" ? 18 : -18
    const up = limb === "LH" || limb === "RH" ? 35 : -35
    return {x: com.x + side, y: com.y + up}
  }

  /** a foot's hip: 0.5 x reach below the lower hand on (no hand on: the COM), 10 cm to the foot's side */
  hip(limb: RefLimb, p: RefPosition, com: RefPt): RefPt {
    let low = Infinity
    for (const l of ["LH", "RH"]) {
      const id = p[l]
      if (id != null && this.holds[id]) low = Math.min(low, this.holds[id].y)
    }
    return {x: com.x + (limb === "RF" ? 10 : -10), y: low < Infinity ? low - 0.5 * this.reach : com.y}
  }

  score(limb: RefLimb, holdId: string, p: RefPosition): RefResult {
    const t = this.holds[holdId]
    const q = REF_GRIP[this.types[holdId]] !== undefined ? REF_GRIP[this.types[holdId]] : 0.5
    const com = this.com(p)
    // hands: arm reach from the shoulder. Feet: leg reach (1.25 x) from the hip, and a target
    // above the hip loses reach in a straight line to 0 at 0.35 x reach above it (the high step)
    const isHand = limb === "LH" || limb === "RH"
    const a = isHand ? this.anchor(limb, com) : this.hip(limb, p, com)
    const limbReach = isHand ? this.reach : 1.25 * this.reach
    const rise = t.y - a.y
    const high = isHand || rise <= 0 ? 1.0 : rise >= 0.35 * this.reach ? 0.0 : 1.0 - rise / (0.35 * this.reach)
    const d = Math.sqrt((a.x - t.x) * (a.x - t.x) + (a.y - t.y) * (a.y - t.y))
    const r = d / limbReach
    const legOrArm = r <= 0.8 ? 1.0 : r <= 1.0 ? 1.0 - (r - 0.8) * 2.0 : 0.0
    const rf = legOrArm * high

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
    else if (legOrArm < 1) why.push("LONG REACH")
    if (high < 1) why.push("HIGH STEP")
    if (bf < 1) why.push("COMMITTING BALANCE")
    const colour: RefColour = s >= 0.7 ? "green" : s >= 0.4 ? "yellow" : "red"
    return {holdId, limb, score: s, colour, rank: s * gf, why: why.join(" · "), dist: d, reachFactor: rf, balanceFactor: bf, goalFactor: gf,
      limbReach, highStep: high}
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
   * Sequence preview (session 15): step 1 is `limb`'s suggestion when given (the glowing ring),
   * else bestMove. After it, the cheapest route to a hand on the top over every limb and hold:
   * only secure moves (score >= 0.4), never a limb back on a hold it left in this look-ahead;
   * fewest moves first, then the least sum of (1 - score), then the route whose "LIMB>hold" list
   * sorts first. No top or no route within 8 moves: the steps - 1 secure moves with the highest
   * total rank (no undo; ties by the same list). Written apart from the Lens's search on purpose.
   */
  sequence(p: RefPosition, limb: RefLimb | null = null, steps = 3): RefResult[] {
    const route = this.route(p, limb)
    if (route) return route.slice(0, steps)
    const first = limb ? this.evaluate(limb, p).suggestion : this.bestMove(p)
    if (!first) return []
    const after = {...p, [first.limb]: first.holdId}
    const left: {[l: string]: string[]} = {LH: [], RH: [], LF: [], RF: []}
    if (p[first.limb] != null) left[first.limb].push(p[first.limb] as string)
    return [first].concat(this.plies(after, steps - 1, left).moves)
  }

  /** The glow and the whole cheapest secure route to the top after it (see sequence); null if none. */
  route(p: RefPosition, limb: RefLimb | null = null): RefResult[] | null {
    const first = limb ? this.evaluate(limb, p).suggestion : this.bestMove(p)
    if (!first) return null
    const topOut = (m: RefResult) => this.top != null && m.holdId === this.top && (m.limb === "LH" || m.limb === "RH")
    if (topOut(first)) return [first]
    if (this.top == null) return null
    const keyOf = (q: RefPosition) => REF_LIMBS.map((l) => String(q[l])).join("|")
    const listOf = (ms: RefResult[]) => ms.map((m) => m.limb + ">" + m.holdId)
    const before = (a: {cost: number; moves: RefResult[]}, b: {cost: number; moves: RefResult[]}) => {
      if (Math.abs(a.cost - b.cost) > 1e-9) return a.cost < b.cost
      const x = listOf(a.moves), y = listOf(b.moves)
      for (let i = 0; i < x.length && i < y.length; i++) if (x[i] !== y[i]) return x[i] < y[i]
      return x.length < y.length
    }
    const left0: {[l: string]: string[]} = {LH: [], RH: [], LF: [], RF: []}
    if (p[first.limb] != null) left0[first.limb].push(p[first.limb] as string)
    // open list kept sorted, cheapest first
    let open: {cost: number; moves: RefResult[]; pos: RefPosition; left: {[l: string]: string[]}}[] =
      [{cost: 0, moves: [], pos: {...p, [first.limb]: first.holdId}, left: left0}]
    const seen: {[k: string]: boolean} = {}
    while (open.length) {
      const cur = open.shift()!
      if (cur.moves.length && topOut(cur.moves[cur.moves.length - 1])) return [first].concat(cur.moves)
      const k = keyOf(cur.pos)
      if (seen[k]) continue
      seen[k] = true
      if (cur.moves.length >= 8) continue
      for (const l of REF_LIMBS) {
        for (const r of this.evaluate(l, cur.pos).results) {
          if (r.score < 0.4 || cur.left[l].indexOf(r.holdId) >= 0) continue
          const pos = {...cur.pos, [l]: r.holdId}
          if (seen[keyOf(pos)] && !topOut(r)) continue
          const from = cur.pos[l]
          const node = {cost: cur.cost + 10 + (1 - r.score), moves: cur.moves.concat([r]), pos,
            left: {...cur.left, [l]: from != null ? cur.left[l].concat([from as string]) : cur.left[l]}}
          let i = 0
          while (i < open.length && !before(node, open[i])) i++
          open.splice(i, 0, node)
        }
      }
    }
    return null
  }

  private plies(p: RefPosition, n: number, left: {[l: string]: string[]}): {total: number; moves: RefResult[]} {
    if (n <= 0) return {total: 0, moves: []}
    let best: {total: number; moves: RefResult[]} = {total: 0, moves: []}
    const names = (ms: RefResult[]) => ms.map((m) => m.limb + ">" + m.holdId)
    for (const l of REF_LIMBS) {
      for (const r of this.evaluate(l, p).results) {
        if (r.score < 0.4 || left[l].indexOf(r.holdId) >= 0) continue
        const from = p[l]
        const top = this.top != null && r.holdId === this.top && (l === "LH" || l === "RH")
        const rest = top ? {total: 0, moves: []} : this.plies({...p, [l]: r.holdId}, n - 1,
          {...left, [l]: from != null ? left[l].concat([from as string]) : left[l]})
        const cand = {total: r.rank + rest.total, moves: [r].concat(rest.moves)}
        let better = cand.moves.length > best.moves.length
        if (cand.moves.length === best.moves.length) {
          if (cand.total > best.total + 1e-9) better = true
          else if (Math.abs(cand.total - best.total) <= 1e-9) {
            const x = names(cand.moves), y = names(best.moves)
            for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) { better = x[i] < y[i]; break }
          }
        }
        if (better) best = cand
      }
    }
    return best
  }

  /** the same rule without the upward goal (to show what the goal changes) */
  withoutGoal(): ReferenceRule {
    return new ReferenceRule(this.holds, this.types, this.reach, null)
  }
}
