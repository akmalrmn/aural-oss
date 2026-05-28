import assert from "node:assert/strict";
import test from "node:test";

import {
  buildRealtimeTranscriptionConfig,
  normalizeRealtimeTranscriptionLanguage,
  shouldAllowTtsBargeIn,
} from "../server/openai-voice-relay-helpers";

test("does not allow TTS barge-in before assistant audio has actually started", () => {
  assert.equal(
    shouldAllowTtsBargeIn({
      inEchoCooldown: true,
      modelIsSpeaking: true,
      responseAudioStarted: false,
      ttsAudioStartedAt: 0,
      nowMs: 1000,
      responseTtsBytes: 0,
      rms: 3000,
      thresholdRms: 2400,
      consecutiveFrames: 3,
      thresholdFrames: 3,
    }),
    false,
  );
});

test("does not allow TTS barge-in until enough assistant audio has been delivered", () => {
  assert.equal(
    shouldAllowTtsBargeIn({
      inEchoCooldown: true,
      modelIsSpeaking: true,
      responseAudioStarted: true,
      ttsAudioStartedAt: 900,
      nowMs: 1600,
      responseTtsBytes: 60_000,
      rms: 3000,
      thresholdRms: 2400,
      consecutiveFrames: 3,
      thresholdFrames: 3,
    }),
    false,
  );
});

test("allows TTS barge-in only after sustained strong speech once assistant audio is underway", () => {
  assert.equal(
    shouldAllowTtsBargeIn({
      inEchoCooldown: true,
      modelIsSpeaking: true,
      responseAudioStarted: true,
      ttsAudioStartedAt: 500,
      nowMs: 1600,
      responseTtsBytes: 96_000,
      rms: 3000,
      thresholdRms: 2400,
      consecutiveFrames: 3,
      thresholdFrames: 3,
    }),
    true,
  );
});

test("normalizes Skilio assessment transcription language to English only", () => {
  assert.equal(normalizeRealtimeTranscriptionLanguage("en"), "en");
  assert.equal(normalizeRealtimeTranscriptionLanguage("en-US"), "en");
  assert.equal(normalizeRealtimeTranscriptionLanguage("id-ID"), "en");
  assert.equal(normalizeRealtimeTranscriptionLanguage("zh-CN"), "en");
  assert.equal(normalizeRealtimeTranscriptionLanguage("Chinese"), "en");
  assert.equal(normalizeRealtimeTranscriptionLanguage(undefined), "en");
});

test("builds English-only Realtime transcription config", () => {
  assert.deepEqual(
    buildRealtimeTranscriptionConfig("gpt-4o-mini-transcribe", "zh-CN"),
    {
      model: "gpt-4o-mini-transcribe",
      language: "en",
      prompt:
        "Transcribe the participant's speech as English only. Preserve English words as spoken. Do not translate to Malay, Indonesian, Chinese, or any other language.",
    },
  );
});
