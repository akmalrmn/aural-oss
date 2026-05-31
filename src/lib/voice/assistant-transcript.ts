export function appendAssistantTranscriptDelta(
  current: string,
  delta: string,
): string {
  if (!delta) return current;
  return current ? `${current}${delta}` : delta;
}

export function normalizeAssistantTranscript(text: string): string {
  return text
    .replace(/[ \t]+([,.!?;:])/g, "$1")
    .replace(/([([{])\s+/g, "$1")
    .replace(/\s+([\])}])/g, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}
