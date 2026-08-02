export const DRAWING_HARDCODED_SCORE = 80;
export const DRAWING_REUSE_DAYS = 365;

export const DRAWING_STARTER_SHAPES = [
  { value: "CIRCLE", label: "Circle" },
  { value: "DIAMOND", label: "Diamond" },
  { value: "CROSS", label: "X" },
  { value: "SQUARE", label: "Square" },
  { value: "TEE", label: "T" },
  { value: "TRIANGLE", label: "Triangle" },
  { value: "DOT", label: "Dot" },
  { value: "HEXAGON", label: "Hexagon" },
  { value: "SLOPE", label: "Slope" },
  { value: "LINE", label: "Line" },
] as const;

export type DrawingStarterShape =
  (typeof DRAWING_STARTER_SHAPES)[number]["value"];

export type DrawingPoint = { x: number; y: number };
export type DrawingStroke = DrawingPoint[];

export type DrawingAssessmentSnapshot = {
  assessmentMode: "DRAWING";
  starterShape: DrawingStarterShape;
  hardcodedScore: number;
  scoreMode: "HARDCODED";
  strokes: DrawingStroke[];
};

export type ApplicationDrawingResponse = {
  starterShape: DrawingStarterShape;
  phrase: string;
  imageDataUrl: string;
};

export type ApplicationDrawingAssessment = {
  version: 1;
  completedAt: string;
  expiresAt: string;
  score: number;
  scoreMode: "HARDCODED";
  responses: ApplicationDrawingResponse[];
};

export function countDrawingPhraseWords(phrase: string) {
  return phrase.trim() ? phrase.trim().split(/\s+/).length : 0;
}

export function isValidDrawingPhrase(phrase: string) {
  const wordCount = countDrawingPhraseWords(phrase);
  return wordCount >= 1 && wordCount <= 3;
}

export function isCompleteDrawingResponses(
  responses: unknown,
): responses is ApplicationDrawingResponse[] {
  if (!Array.isArray(responses) || responses.length !== DRAWING_STARTER_SHAPES.length) {
    return false;
  }

  return DRAWING_STARTER_SHAPES.every((shape, index) => {
    const response = responses[index];
    if (!response || typeof response !== "object" || Array.isArray(response)) {
      return false;
    }
    const record = response as Record<string, unknown>;
    return (
      record.starterShape === shape.value &&
      typeof record.phrase === "string" &&
      record.phrase.trim().length > 0 &&
      typeof record.imageDataUrl === "string" &&
      record.imageDataUrl.startsWith("data:image/png;base64,")
    );
  });
}

export function getCompleteOrderedDrawingResponses<
  T extends ApplicationDrawingResponse,
>(responses: Array<T | undefined>): T[] | null {
  if (responses.some((response) => !response)) return null;
  return isCompleteDrawingResponses(responses) ? (responses as T[]) : null;
}

export function parseApplicationDrawingAssessment(
  value: unknown,
): ApplicationDrawingAssessment | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (
    record.version !== 1 ||
    typeof record.completedAt !== "string" ||
    typeof record.expiresAt !== "string" ||
    !isCompleteDrawingResponses(record.responses)
  ) {
    return null;
  }

  return {
    version: 1,
    completedAt: record.completedAt,
    expiresAt: record.expiresAt,
    score: DRAWING_HARDCODED_SCORE,
    scoreMode: "HARDCODED",
    responses: record.responses,
  };
}

export function isDrawingAssessmentReusable(
  assessment: ApplicationDrawingAssessment,
  now = new Date(),
) {
  const completedAt = new Date(assessment.completedAt);
  const expiresAt = new Date(assessment.expiresAt);
  return (
    Number.isFinite(completedAt.getTime()) &&
    Number.isFinite(expiresAt.getTime()) &&
    completedAt.getTime() <= now.getTime() &&
    expiresAt.getTime() > now.getTime()
  );
}

export function createApplicationDrawingAssessment(
  responses: ApplicationDrawingResponse[],
  completedAt = new Date(),
): ApplicationDrawingAssessment {
  const expiresAt = new Date(completedAt);
  expiresAt.setUTCDate(expiresAt.getUTCDate() + DRAWING_REUSE_DAYS);
  return {
    version: 1,
    completedAt: completedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    score: DRAWING_HARDCODED_SCORE,
    scoreMode: "HARDCODED",
    responses,
  };
}

export function normalizeDrawingAssessmentSnapshot(
  snapshot: Record<string, unknown>,
) {
  if (snapshot.assessmentMode !== "DRAWING") return snapshot;
  return {
    ...snapshot,
    hardcodedScore: DRAWING_HARDCODED_SCORE,
    scoreMode: "HARDCODED" as const,
  };
}
