export const DEFAULT_TTS_BARGE_IN_MIN_AUDIO_MS = 900;
export const DEFAULT_TTS_BARGE_IN_MIN_AUDIO_BYTES = 72_000;

export function normalizeRealtimeTranscriptionLanguage(
  _language?: string | null,
): "en" {
  // Skilio voice assessments are English-only even if interview metadata says otherwise.
  return "en";
}

export function buildRealtimeTranscriptionConfig(
  model: string,
  language?: string | null,
) {
  const normalizedLanguage = normalizeRealtimeTranscriptionLanguage(language);
  const config: {
    model: string;
    language: "en";
    delay?: "minimal" | "low" | "medium" | "high" | "xhigh";
  } = {
    model,
    language: normalizedLanguage,
  };
  if (isRealtimeWhisperTranscriptionModel(model)) {
    config.delay = "low";
  }
  return config;
}

export function isRealtimeWhisperTranscriptionModel(model: string): boolean {
  return model.trim().toLowerCase() === "gpt-realtime-whisper";
}

export function buildManualRealtimeTurnDetectionConfig(model?: string) {
  if (model && isRealtimeWhisperTranscriptionModel(model)) {
    return null;
  }
  return {
    type: "semantic_vad" as const,
    eagerness: "low" as const,
    create_response: false,
    interrupt_response: false,
  };
}

export interface TtsBargeInDecision {
  inEchoCooldown: boolean;
  modelIsSpeaking: boolean;
  responseAudioStarted: boolean;
  ttsAudioStartedAt: number;
  nowMs: number;
  responseTtsBytes: number;
  rms: number;
  thresholdRms: number;
  consecutiveFrames: number;
  thresholdFrames: number;
  minAudioMs?: number;
  minAudioBytes?: number;
}

export interface UserTurnAssistantResponseDelayInput {
  vadSpeechActive: boolean;
  speechStopForwardGraceUntil: number;
  lastVadSpeechEnd: number;
  lastTranscriptUpdateAt: number;
  nowMs: number;
  speechStopFinalizeMs: number;
  transcriptStabilityMs: number;
}

export function getUserTurnAssistantResponseDelayMs({
  vadSpeechActive,
  speechStopForwardGraceUntil,
  lastVadSpeechEnd,
  lastTranscriptUpdateAt,
  nowMs,
  speechStopFinalizeMs,
  transcriptStabilityMs,
}: UserTurnAssistantResponseDelayInput): number {
  const waits: number[] = [];
  if (vadSpeechActive) waits.push(speechStopFinalizeMs);
  if (speechStopForwardGraceUntil > nowMs) {
    waits.push(speechStopForwardGraceUntil - nowMs);
  }
  if (lastVadSpeechEnd > 0) {
    waits.push(speechStopFinalizeMs - (nowMs - lastVadSpeechEnd));
  }
  if (lastTranscriptUpdateAt > 0) {
    waits.push(transcriptStabilityMs - (nowMs - lastTranscriptUpdateAt));
  }
  return Math.max(0, ...waits);
}

export function shouldAllowTtsBargeIn({
  inEchoCooldown,
  modelIsSpeaking,
  responseAudioStarted,
  ttsAudioStartedAt,
  nowMs,
  responseTtsBytes,
  rms,
  thresholdRms,
  consecutiveFrames,
  thresholdFrames,
  minAudioMs = DEFAULT_TTS_BARGE_IN_MIN_AUDIO_MS,
  minAudioBytes = DEFAULT_TTS_BARGE_IN_MIN_AUDIO_BYTES,
}: TtsBargeInDecision): boolean {
  if (!inEchoCooldown || !modelIsSpeaking || !responseAudioStarted) return false;
  if (ttsAudioStartedAt <= 0) return false;
  if (nowMs - ttsAudioStartedAt < minAudioMs) return false;
  if (responseTtsBytes < minAudioBytes) return false;
  if (rms < thresholdRms) return false;
  if (consecutiveFrames < thresholdFrames) return false;
  return true;
}
