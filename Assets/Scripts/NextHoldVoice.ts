// NextHoldVoice — voice commands, scoped tight (v7.2 P1 item 12, session 27). Plain code with no Lens globals,
// unit-checked in Node (tests/scoring.port.test.mjs).
//
// The words, each mapped onto a button that already exists (no new states, no LLM, nothing spoken back):
//   "next hold"      = "?" (the next hint step), whenever "?" is on screen            (also "next hold please" etc.)
//   "again"          = the Again button, only while Again is on screen
//   "show my beta"   = the Show my beta button, only while it is on screen (on the mats) and the beta is hidden
//   "why"            = "?" for the why, only after a hint has named the move (the next "?" would say why)
// Gyms are loud and "again!" and "why'd you go left" are everyday gym words, so: only final transcripts act; the
// whole utterance must be short (at most MAX_WORDS words); exactly one command may match; and a command that
// isn't on offer right now is ignored silently. The Lens shows a 1 s chip echoing what it heard.
// Session 28 (v7.3 P1-5): typographic apostrophes are apostrophes; a negation before the command, or a command that is
// less than half of what was said, is chatter; "why" is "?" whenever "?" reads Why (also with the beta shown).

export type VoiceCommand = "nextHold" | "again" | "showBeta" | "why"

export const MAX_WORDS = 5

/** what is on offer right now (Main fills it from what is on screen) */
export interface VoiceContext {
  askOnScreen: boolean
  againOnScreen: boolean
  showBetaOnScreen: boolean
  betaShown: boolean
  /** session 28 (v7.3 P1-5): "why" is "?" exactly when "?" reads Why (the word under it, NextHoldBeta.askWord); it
   *  replaced `whyOnOffer`, which ignored "Why" with the beta shown */
  askWord: string
}

/** session 28: words that turn what follows into chatter ("don't show my beta", "that's not the next hold") */
const NEGATIONS = ["not", "don't", "dont", "no", "never", "isn't", "wasn't", "won't"]

const PHRASES: {cmd: VoiceCommand; words: string[]}[] = [
  {cmd: "nextHold", words: ["next", "hold"]},
  {cmd: "showBeta", words: ["show", "my", "beta"]},
  {cmd: "again", words: ["again"]},
  {cmd: "why", words: ["why"]},
]

/** lower case, letters, digits and apostrophes only, single spaces. Session 28: typographic apostrophes (’ ‘ ʼ) are
 *  apostrophes ("why’d" was cut into "why" "d", and fired "why") */
export function normalize(text: string): string[] {
  return String(text || "").toLowerCase().replace(/[‘’ʼ`´]/g, "'").replace(/[^a-z0-9' ]+/g, " ")
    .split(/\s+/).filter((w) => w.length > 0)
}

/** where the phrase starts in the words, or -1 */
function indexOf(words: string[], phrase: string[]): number {
  for (let i = 0; i + phrase.length <= words.length; i++) {
    let ok = true
    for (let j = 0; j < phrase.length; j++) if (words[i + j] !== phrase[j]) { ok = false; break }
    if (ok) return i
  }
  return -1
}

/** The command a final transcript asks for, by its words alone (null: none, more than one, or too long). Session 28
 *  (v7.3 P1-5): also null when a negation comes before it ("don't show my beta", "that's not the next hold"), and when
 *  the command is less than half of what was said ("that was a nice why" is chatter, "next hold please" is not). */
export function matchCommand(text: string): VoiceCommand | null {
  const words = normalize(text)
  if (!words.length || words.length > MAX_WORDS) return null
  const found = PHRASES.map((p) => ({p, at: indexOf(words, p.words)})).filter((f) => f.at >= 0)
  if (found.length !== 1) return null
  const {p, at} = found[0]
  if (words.slice(0, at).some((w) => NEGATIONS.indexOf(w) >= 0)) return null
  if (p.words.length * 2 < words.length) return null
  return p.cmd
}

/** Is that command on offer right now? */
export function onOffer(cmd: VoiceCommand, c: VoiceContext): boolean {
  if (cmd === "nextHold") return c.askOnScreen
  if (cmd === "again") return c.againOnScreen
  if (cmd === "showBeta") return c.showBetaOnScreen && !c.betaShown
  return c.askOnScreen && c.askWord === "Why"
}

/** session 28: the chip's words while recognition is paused after an error */
export const VOICE_PAUSED = "voice paused"
/** session 28: how long the transcript log keeps (entries; on a device recognition runs as long as the Lens does) */
export const VOICE_LOG_MAX = 50
/** session 28: the waits before trying recognition again after an error (s), the last one repeated */
export const VOICE_BACKOFF = [1, 2, 4, 8, 16, 30]

/** A transcript in: the command to act on, or null (partial, chatter, or not on offer now). */
export function parseCommand(text: string, isFinal: boolean, c: VoiceContext): VoiceCommand | null {
  if (!isFinal) return null
  const cmd = matchCommand(text)
  return cmd && onOffer(cmd, c) ? cmd : null
}

/** the chip's words for a command heard */
export function chipText(cmd: VoiceCommand): string {
  return cmd === "nextHold" ? "“next hold”" : cmd === "again" ? "“again”" : cmd === "showBeta" ? "“show my beta”" : "“why”"
}

export const CHIP_SECONDS = 1
/** said on every preview frame the chip shows in: the preview has no microphone */
export const PREVIEW_VOICE_LABEL = "Preview: typed text stands in for speech"
