import assert from "node:assert/strict";
import test from "node:test";

import {
  appendAssistantTranscriptDelta,
  normalizeAssistantTranscript,
} from "../src/lib/voice/assistant-transcript";

test("assistant transcript deltas preserve partial words", () => {
  let transcript = "";
  for (const delta of ["English Reading Com", "preh", "ension"]) {
    transcript = appendAssistantTranscriptDelta(transcript, delta);
  }

  assert.equal(
    normalizeAssistantTranscript(transcript),
    "English Reading Comprehension",
  );
});

test("assistant transcript normalization removes spaces before punctuation only", () => {
  assert.equal(
    normalizeAssistantTranscript("Thanks for sharing that context . Could you continue ?"),
    "Thanks for sharing that context. Could you continue?",
  );
});
