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

export type VoiceCommand = "nextHold" | "again" | "showBeta" | "why"

export const MAX_WORDS = 5

/** what is on offer right now (Main fills it from what is on screen) */
export interface VoiceContext {
  askOnScreen: boolean
  againOnScreen: boolean
  showBetaOnScreen: boolean
  betaShown: boolean
  /** the next "?" would say why (rung 3), i.e. a hint has named the move */
  whyOnOffer: boolean
}

const PHRASES: {cmd: VoiceCommand; words: string[]}[] = [
  {cmd: "nextHold", words: ["next", "hold"]},
  {cmd: "showBeta", words: ["show", "my", "beta"]},
  {cmd: "again", words: ["again"]},
  {cmd: "why", words: ["why"]},
]

/** lower case, letters, digits and apostrophes only, single spaces */
export function normalize(text: string): string[] {
  return String(text || "").toLowerCase().replace(/[^a-z0-9' ]+/g, " ").split(/\s+/).filter((w) => w.length > 0)
}

function contains(words: string[], phrase: string[]): boolean {
  for (let i = 0; i + phrase.length <= words.length; i++) {
    let ok = true
    for (let j = 0; j < phrase.length; j++) if (words[i + j] !== phrase[j]) { ok = false; break }
    if (ok) return true
  }
  return false
}

/** The command a final transcript asks for, by its words alone (null: none, more than one, or too long). */
export function matchCommand(text: string): VoiceCommand | null {
  const words = normalize(text)
  if (!words.length || words.length > MAX_WORDS) return null
  const found = PHRASES.filter((p) => contains(words, p.words)).map((p) => p.cmd)
  return found.length === 1 ? found[0] : null
}

/** Is that command on offer right now? */
export function onOffer(cmd: VoiceCommand, c: VoiceContext): boolean {
  if (cmd === "nextHold") return c.askOnScreen
  if (cmd === "again") return c.againOnScreen
  if (cmd === "showBeta") return c.showBetaOnScreen && !c.betaShown
  return c.askOnScreen && c.whyOnOffer
}

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
