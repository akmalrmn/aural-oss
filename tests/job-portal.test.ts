import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createJobPublicSlug,
  getNextJobStatus,
  summarizeJobAttribution,
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

  it("summarizes application pipeline counts with scoring disabled", () => {
    const summary = summarizeJobApplications([
      { status: "NEW", matchScore: 80, applicationMethod: "SKILIO" },
      { status: "SHORTLISTED", matchScore: 90, applicationMethod: "GUEST" },
      { status: "REJECTED", matchScore: null, applicationMethod: "SKILIO" },
    ]);

    assert.equal(summary.totalApplicants, 3);
    assert.equal(summary.shortlisted, 1);
    assert.equal(summary.averageMatch, null);
    assert.deepEqual(summary.applicationMethods, [
      { method: "SKILIO", count: 2 },
      { method: "GUEST", count: 1 },
    ]);
  });

  it("summarizes first-touch source performance separately from application method", () => {
    const summary = summarizeJobAttribution(
      [
        {
          id: "linkedin",
          name: "LinkedIn",
          channel: "LINKEDIN",
          trackingCode: "linkedin-code",
        },
        {
          id: "campaign",
          name: "Design community",
          channel: "CUSTOM",
          trackingCode: "campaign-code",
        },
      ],
      [
        { sourceLinkId: "linkedin", applicationStartedAt: "2026-07-25" },
        { sourceLinkId: "linkedin", applicationStartedAt: null },
        { sourceLinkId: "campaign", applicationStartedAt: "2026-07-25" },
      ],
      [
        {
          status: "SHORTLISTED",
          matchScore: 90,
          applicationMethod: "SKILIO",
          sourceLinkId: "linkedin",
        },
        {
          status: "NEW",
          matchScore: 70,
          applicationMethod: "GUEST",
          sourceLinkId: null,
        },
      ],
    );

    assert.equal(summary.totalVisits, 3);
    assert.equal(summary.totalStarted, 2);
    assert.equal(summary.totalAttributedApplications, 1);
    assert.deepEqual(summary.sources[0], {
      sourceLinkId: "linkedin",
      name: "LinkedIn",
      channel: "LINKEDIN",
      trackingCode: "linkedin-code",
      archivedAt: null,
      visits: 2,
      started: 1,
      submitted: 1,
      accepted: 1,
      conversionRate: 50,
    });
    assert.equal(summary.sources.at(-1)?.name, "Direct");
    assert.equal(summary.sources.at(-1)?.submitted, 1);
  });

});
