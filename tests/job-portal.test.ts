import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeApplicationMatch,
  createJobPublicSlug,
  getNextJobStatus,
  summarizeJobApplications,
} from "../src/lib/jobs/job-utils";

describe("job portal utilities", () => {
  it("creates stable public slugs from job titles and suffixes", () => {
    assert.equal(
      createJobPublicSlug("Senior Product Designer", "abc123"),
      "senior-product-designer-abc123",
    );
    assert.equal(createJobPublicSlug("  C++ / AI Engineer  ", "XYZ"), "c-ai-engineer-xyz");
    assert.equal(createJobPublicSlug("", "fallback"), "job-fallback");
  });

  it("allows only supported job status transitions", () => {
    assert.equal(getNextJobStatus("DRAFT", "publish"), "ACTIVE");
    assert.equal(getNextJobStatus("ACTIVE", "pause"), "PAUSED");
    assert.equal(getNextJobStatus("PAUSED", "publish"), "ACTIVE");
    assert.equal(getNextJobStatus("ACTIVE", "close"), "CLOSED");
    assert.equal(getNextJobStatus("CLOSED", "archive"), "ARCHIVED");
    assert.throws(() => getNextJobStatus("ARCHIVED", "publish"), /Cannot publish/);
  });

  it("summarizes application pipeline counts and average match", () => {
    const summary = summarizeJobApplications([
      { status: "NEW", matchScore: 80, source: "skilio" },
      { status: "SHORTLISTED", matchScore: 90, source: "linkedin" },
      { status: "REJECTED", matchScore: null, source: "skilio" },
    ]);

    assert.equal(summary.totalApplicants, 3);
    assert.equal(summary.shortlisted, 1);
    assert.equal(summary.averageMatch, 85);
    assert.deepEqual(summary.sources, [
      { source: "skilio", count: 2 },
      { source: "linkedin", count: 1 },
    ]);
  });

  it("computes match score from overlapping required and optional skills", () => {
    const score = computeApplicationMatch({
      requiredSkills: ["Data Analysis", "Communication"],
      optionalSkills: ["Excel", "Project Management"],
      candidateSkills: ["communication", "excel", "public speaking"],
    });

    assert.equal(score, 50);
  });
});
