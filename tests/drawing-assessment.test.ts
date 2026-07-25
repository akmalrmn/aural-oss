import assert from "node:assert/strict";
import test from "node:test";
import {
  createApplicationDrawingAssessment,
  DRAWING_STARTER_SHAPES,
  DRAWING_HARDCODED_SCORE,
  isCompleteDrawingResponses,
  isDrawingAssessmentReusable,
  normalizeDrawingAssessmentSnapshot,
  parseApplicationDrawingAssessment,
} from "../src/lib/drawing-assessment";

test("drawing assessment score is enforced by the server normalization", () => {
  const normalized = normalizeDrawingAssessmentSnapshot({
    assessmentMode: "DRAWING",
    hardcodedScore: 3,
    scoreMode: "CANDIDATE_SUPPLIED",
    strokes: [[{ x: 0.2, y: 0.3 }]],
  });

  assert.equal(normalized.hardcodedScore, DRAWING_HARDCODED_SCORE);
  assert.equal(normalized.scoreMode, "HARDCODED");
});

test("ordinary whiteboard snapshots are not modified", () => {
  const snapshot = { elements: [{ id: "line-1" }] };
  assert.equal(normalizeDrawingAssessmentSnapshot(snapshot), snapshot);
});

const completeResponses = DRAWING_STARTER_SHAPES.map((shape, index) => ({
  starterShape: shape.value,
  phrase: `Drawing ${index + 1}`,
  imageDataUrl: "data:image/png;base64,c2tpbGlv",
}));

test("application drawing set requires all ten ordered drawings and phrases", () => {
  assert.equal(isCompleteDrawingResponses(completeResponses), true);
  assert.equal(isCompleteDrawingResponses(completeResponses.slice(0, 9)), false);
  assert.equal(
    isCompleteDrawingResponses([
      completeResponses[1],
      completeResponses[0],
      ...completeResponses.slice(2),
    ]),
    false,
  );
});

test("completed application drawings can be reused for one year", () => {
  const completedAt = new Date("2025-07-25T00:00:00.000Z");
  const assessment = createApplicationDrawingAssessment(
    completeResponses,
    completedAt,
  );

  assert.equal(
    isDrawingAssessmentReusable(
      assessment,
      new Date("2026-07-24T23:59:59.000Z"),
    ),
    true,
  );
  assert.equal(
    isDrawingAssessmentReusable(
      assessment,
      new Date("2026-07-25T00:00:00.000Z"),
    ),
    false,
  );
  assert.equal(
    parseApplicationDrawingAssessment({
      ...assessment,
      score: 3,
      scoreMode: "CLIENT",
    })?.score,
    DRAWING_HARDCODED_SCORE,
  );
});
