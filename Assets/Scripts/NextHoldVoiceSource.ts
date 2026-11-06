// NextHoldVoiceSource — where voice transcripts come from (v7.2 P1 item 12, session 27).
//
// Two sources behind one interface, so the Lens, the preview and LEAF all go through the same path:
// - AsrVoiceSource: on Spectacles, the device's speech recognition, require("LensStudio:AsrModule") with
//   AsrTranscriptionOptions (Balanced mode, 600 ms of silence ends an utterance). A session ends after each final
//   transcript, so it starts again at once. Not tried on a device. It needs a network connection: the module reports
//   AsrModule.AsrStatusCode.NoInternet ("Device is not connected to the internet") when there is none (from this
//   project's Support/StudioLib.d.ts; the Lens Studio docs search needs a Snapchat login and wasn't reachable).
// - InjectedVoiceSource: in the preview (no microphone), typed text stands in for speech: inject(text, isFinal).
//   Every frame its chip shows in says so (NextHoldVoice.PREVIEW_VOICE_LABEL).
// NextHoldMain picks one with global.deviceInfoSystem.isEditor(), and tests hand in their own with useVoice().

export interface VoiceSource {
  readonly kind: "asr" | "injected"
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

export class AsrVoiceSource implements VoiceSource {
  readonly kind = "asr" as const
  private asr: AsrModule | null = null
  private options: AsrModule.AsrTranscriptionOptions | null = null
  private running = false

  start(onText: (text: string, isFinal: boolean) => void, onError: (why: string) => void): void {
    try {
      this.asr = require("LensStudio:AsrModule") as AsrModule
    } catch (e) {
      onError("speech recognition isn't available here")
      return
    }
    const options = AsrModule.AsrTranscriptionOptions.create()
    options.mode = AsrModule.AsrMode.Balanced
    options.silenceUntilTerminationMs = 600
    options.onTranscriptionUpdateEvent.add((e: AsrModule.TranscriptionUpdateEvent) => {
      onText(e.text, e.isFinal)
      // one utterance per session: listen again for the next command
      if (e.isFinal && this.running) this.listen()
    })
    options.onTranscriptionErrorEvent.add((code: AsrModule.AsrStatusCode) => {
      onError(code === AsrModule.AsrStatusCode.NoInternet ? "voice needs a network connection"
        : code === AsrModule.AsrStatusCode.Unauthenticated ? "voice: not signed in" : "voice: recognition error")
    })
    this.options = options
    this.running = true
    this.listen()
  }

  stop(): void {
    this.running = false
    if (this.asr) this.asr.stopTranscribing()
  }

  private listen(): void {
    if (this.asr && this.options) this.asr.startTranscribing(this.options)
  }
}
