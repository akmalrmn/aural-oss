import assert from "node:assert/strict";
import test from "node:test";
import {
  applicationFileFingerprint,
  MAX_APPLICATION_FILE_BYTES,
  MAX_RESUME_FILE_BYTES,
  normalizeApplicationFileSkills,
  validateApplicationFile,
} from "../src/lib/jobs/application-files";
import {
  createApplicationFileUploadToken,
  verifyApplicationFileUploadToken,
} from "../src/lib/jobs/application-file-upload-token";

test("application files are constrained by kind, type, and size", () => {
  assert.equal(
    validateApplicationFile(
      { name: "resume.pdf", size: 1024, type: "application/pdf" },
      "resume",
    ),
    null,
  );
  assert.equal(
    validateApplicationFile(
      { name: "demo.mp4", size: 1024, type: "video/mp4" },
      "skill_artifact",
    ),
    null,
  );
  assert.match(
    validateApplicationFile(
      { name: "demo.mp4", size: 1024, type: "image/png" },
      "skill_artifact",
    ) ?? "",
    /does not match/,
  );
  assert.match(
    validateApplicationFile(
      { name: "resume.png", size: 1024, type: "image/png" },
      "resume",
    ) ?? "",
    /PDF, DOC, or DOCX/,
  );
  assert.equal(
    validateApplicationFile(
      { name: "work.png", size: 1024, type: "image/png" },
      "skill_artifact",
    ),
    null,
  );
  assert.match(
    validateApplicationFile(
      {
        name: "large.pdf",
        size: MAX_APPLICATION_FILE_BYTES + 1,
        type: "application/pdf",
      },
      "skill_artifact",
    ) ?? "",
    /100 MB/,
  );
  assert.match(
    validateApplicationFile(
      {
        name: "resume.pdf",
        size: MAX_RESUME_FILE_BYTES + 1,
        type: "application/pdf",
      },
      "resume",
    ) ?? "",
    /10 MB/,
  );
});

test("skill tags and local file fingerprints are normalized", () => {
  assert.deepEqual(
    normalizeApplicationFileSkills(["Research", " research ", "", "Writing"]),
    ["Research", "Writing"],
  );
  assert.equal(
    applicationFileFingerprint({
      name: "Proof.PDF",
      size: 200,
      type: "application/pdf",
    }),
    "proof.pdf:200:application/pdf",
  );
});

test("application file upload tokens are scoped and expire", () => {
  const previousSecret = process.env.APPLICATION_FILE_UPLOAD_SECRET;
  process.env.APPLICATION_FILE_UPLOAD_SECRET = "test-file-upload-secret";
  try {
    const issuedAt = Date.parse("2026-07-29T00:00:00.000Z");
    const token = createApplicationFileUploadToken(
      "application-1",
      issuedAt,
    );

    assert.equal(
      verifyApplicationFileUploadToken(token, "application-1", issuedAt),
      true,
    );
    assert.equal(
      verifyApplicationFileUploadToken(token, "application-2", issuedAt),
      false,
    );
    assert.equal(
      verifyApplicationFileUploadToken(
        token,
        "application-1",
        issuedAt + 16 * 60 * 1000,
      ),
      false,
    );
  } finally {
    if (previousSecret === undefined) {
      delete process.env.APPLICATION_FILE_UPLOAD_SECRET;
    } else {
      process.env.APPLICATION_FILE_UPLOAD_SECRET = previousSecret;
    }
  }
});
