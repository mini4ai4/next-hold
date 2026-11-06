// NextHoldVoiceSource — where voice transcripts come from (v7.2 P1 item 12, session 27; session 28, v7.3 P1-5).
//
// Two sources behind one interface, so the Lens, the preview and LEAF all go through the same path:
// - AsrVoiceSource: on Spectacles, Snap's speech recognition, require("LensStudio:AsrModule"). Snap's ASR page says the API
//   is only available on Spectacles; its typings have an AsrStatusCode.NoInternet ("Device is not connected to the
//   internet"), so we expect it to need a connection, though the page doesn't say. Not tried on a device. Listening runs
//   as long as the Lens does (the mic stays on).
//   Session 28: after each final transcript it stops the session and starts the next one on the next frame (starting
//   again inside the callback, with the session maybe still live, was untested and could leave voice dead); after an
//   error it reports it (Main shows a "voice paused" chip) and tries again after 1, 2, 4, 8, 16, then every 30 s, until a
//   transcript arrives. The module and the clock are handed in, so node drives it with a fake module (scoring.port).
// - InjectedVoiceSource: in the preview, where AsrModule doesn't run, typed text stands in for speech: inject(text,
//   isFinal). Every frame its chip shows in says so (NextHoldVoice.PREVIEW_VOICE_LABEL).
// NextHoldMain picks one with global.deviceInfoSystem.isEditor(), and tests hand in their own with useVoice().

import {VOICE_BACKOFF} from "./NextHoldVoice"

export interface VoiceSource {
  readonly kind: "asr" | "injected"
  /** onText for every transcript; onError(why) when recognition stops on an error (it then tries again by itself) */
  start(onText: (text: string, isFinal: boolean) => void, onError: (why: string) => void): void
  stop(): void
}

export class InjectedVoiceSource implements VoiceSource {
  readonly kind = "injected" as const
  private onText: ((text: string, isFinal: boolean) => void) | null = null
  start(onText: (text: string, isFinal: boolean) => void, _onError: (why: string) => void): void { this.onText = onText }
  stop(): void { this.onText = null }
  /** what the preview "hears": a transcript, final unless said otherwise */
  inject(text: string, isFinal = true): void { if (this.onText) this.onText(text, isFinal) }
}

/** the part of AsrModule this uses (the real one, or node's fake) */
export interface AsrApi {
  /** a fresh options object with its two events; null if speech recognition isn't available here */
  createOptions(): AsrOptions | null
  startTranscribing(o: AsrOptions): void
  stopTranscribing(): void
  /** the status code that means "no network", and the one that means "not signed in" */
  noInternet: unknown
  unauthenticated: unknown
}
export interface AsrOptions {
  mode?: unknown
  silenceUntilTerminationMs: number
  onTranscriptionUpdateEvent: {add(fn: (e: {text: string; isFinal: boolean}) => void): unknown}
  onTranscriptionErrorEvent: {add(fn: (code: unknown) => void): unknown}
}
/** run fn after `seconds` (0: the next frame) */
export type Schedule = (fn: () => void, seconds: number) => void

/** the Lens's own AsrModule, or null where it can't be loaded */
export function lensAsr(): AsrApi | null {
  let asr: AsrModule
  try {
    asr = require("LensStudio:AsrModule") as AsrModule
  } catch (e) {
    return null
  }
  return {
    createOptions: () => {
      const o = AsrModule.AsrTranscriptionOptions.create()
      o.mode = AsrModule.AsrMode.Balanced
      return o as unknown as AsrOptions
    },
    startTranscribing: (o) => asr.startTranscribing(o as unknown as AsrModule.AsrTranscriptionOptions),
    stopTranscribing: () => asr.stopTranscribing(),
    noInternet: AsrModule.AsrStatusCode.NoInternet,
    unauthenticated: AsrModule.AsrStatusCode.Unauthenticated,
  }
}

export class AsrVoiceSource implements VoiceSource {
  readonly kind = "asr" as const
  private api: AsrApi | null
  private schedule: Schedule
  private options: AsrOptions | null = null
  private running = false
  /** how many errors in a row (the next wait is VOICE_BACKOFF of it) */
  private failures = 0
  /** a start is scheduled; another isn't */
  private pending = false

  /** api: the module (lensAsr() on the Lens); schedule: Main's delayed callback */
  constructor(api: AsrApi | null, schedule: Schedule) {
    this.api = api
    this.schedule = schedule
  }

  start(onText: (text: string, isFinal: boolean) => void, onError: (why: string) => void): void {
    const api = this.api
    const options = api ? api.createOptions() : null
    if (!api || !options) {
      onError("speech recognition isn't available here")
      return
    }
    options.silenceUntilTerminationMs = 600
    options.onTranscriptionUpdateEvent.add((e) => {
      if (!this.running) return
      this.failures = 0
      onText(e.text, e.isFinal)
      // one utterance per session: end it, and listen again on the next frame
      if (e.isFinal) {
        api.stopTranscribing()
        this.later(0)
      }
    })
    options.onTranscriptionErrorEvent.add((code) => {
      if (!this.running) return
      onError(code === api.noInternet ? "no network" : code === api.unauthenticated ? "not signed in" : "recognition error")
      api.stopTranscribing()
      this.later(VOICE_BACKOFF[Math.min(this.failures, VOICE_BACKOFF.length - 1)])
      this.failures++
    })
    this.options = options
    this.running = true
    this.listen()
  }

  stop(): void {
    this.running = false
    if (this.api) this.api.stopTranscribing()
  }

  /** tests: errors in a row so far */
  getFailures(): number { return this.failures }

  private later(seconds: number): void {
    if (this.pending) return
    this.pending = true
    this.schedule(() => {
      this.pending = false
      if (this.running) this.listen()
    }, seconds)
  }

  private listen(): void {
    if (this.api && this.options) this.api.startTranscribing(this.options)
  }
}
