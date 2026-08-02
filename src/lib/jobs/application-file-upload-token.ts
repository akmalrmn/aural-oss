import { createHmac, timingSafeEqual } from "node:crypto";

const TOKEN_TTL_SECONDS = 15 * 60;

type UploadTokenPayload = {
  applicationId: string;
  expiresAt: number;
};

function getTokenSecret() {
  const secret =
    process.env.APPLICATION_FILE_UPLOAD_SECRET ??
    process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) {
    throw new Error("Application file upload signing secret is not configured.");
  }
  return secret;
}

function sign(encodedPayload: string) {
  return createHmac("sha256", getTokenSecret())
    .update(encodedPayload)
    .digest("base64url");
}

export function createApplicationFileUploadToken(
  applicationId: string,
  now = Date.now(),
) {
  const payload: UploadTokenPayload = {
    applicationId,
    expiresAt: Math.floor(now / 1000) + TOKEN_TTL_SECONDS,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
    "base64url",
  );
  return `${encodedPayload}.${sign(encodedPayload)}`;
}

export function verifyApplicationFileUploadToken(
  token: string,
  applicationId: string,
  now = Date.now(),
) {
  const [encodedPayload, suppliedSignature, ...rest] = token.split(".");
  if (!encodedPayload || !suppliedSignature || rest.length > 0) return false;

  const expectedSignature = sign(encodedPayload);
  const supplied = Buffer.from(suppliedSignature);
  const expected = Buffer.from(expectedSignature);
  if (
    supplied.length !== expected.length ||
    !timingSafeEqual(supplied, expected)
  ) {
    return false;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    ) as Partial<UploadTokenPayload>;
    return (
      payload.applicationId === applicationId &&
      typeof payload.expiresAt === "number" &&
      payload.expiresAt >= Math.floor(now / 1000)
    );
  } catch {
    return false;
  }
}
