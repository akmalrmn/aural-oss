import sharp from "sharp";

export const MAX_EVIDENCE_IMAGE_EDGE = 1600;

export async function prepareEvidenceImage(buffer: Buffer) {
  const image = sharp(buffer, { failOn: "warning" });
  const metadata = await image.metadata();
  if (!metadata.width || !metadata.height || !["png", "jpeg", "webp"].includes(metadata.format ?? "")) {
    throw new Error("Unsupported evidence image.");
  }
  const resized = await image
    .rotate()
    .resize({
      width: MAX_EVIDENCE_IMAGE_EDGE,
      height: MAX_EVIDENCE_IMAGE_EDGE,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });
  return {
    buffer: resized.data,
    width: resized.info.width,
    height: resized.info.height,
    mimeType: "image/jpeg" as const,
  };
}
