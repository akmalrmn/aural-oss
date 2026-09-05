import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import {
  MAX_EVIDENCE_IMAGE_EDGE,
  prepareEvidenceImage,
} from "../src/lib/jobs/application-evidence-image";

test("evidence images are validated and resized for multimodal extraction", async () => {
  const source = await sharp({
    create: { width: 2400, height: 1200, channels: 3, background: "#2f7d4f" },
  }).png().toBuffer();
  const prepared = await prepareEvidenceImage(source);
  assert.equal(prepared.mimeType, "image/jpeg");
  assert.equal(prepared.width, MAX_EVIDENCE_IMAGE_EDGE);
  assert.equal(prepared.height, 800);
  assert.ok(prepared.buffer.length > 0);
});

test("non-image bytes are rejected", async () => {
  await assert.rejects(() => prepareEvidenceImage(Buffer.from("not an image")));
});
