const EMAIL_COOLDOWN_MS = 60_000;

const globalForAuthEmail = globalThis as typeof globalThis & {
  authEmailLastSentAt?: Map<string, number>;
};

const lastSentAt =
  globalForAuthEmail.authEmailLastSentAt ?? new Map<string, number>();

if (process.env.NODE_ENV !== "production") {
  globalForAuthEmail.authEmailLastSentAt = lastSentAt;
}

export function claimAuthEmailSend(key: string) {
  const now = Date.now();
  const normalizedKey = key.trim().toLowerCase();
  const previous = lastSentAt.get(normalizedKey);

  if (previous && now - previous < EMAIL_COOLDOWN_MS) {
    return {
      ok: false as const,
      retryAfterSeconds: Math.ceil(
        (EMAIL_COOLDOWN_MS - (now - previous)) / 1000,
      ),
    };
  }

  lastSentAt.set(normalizedKey, now);
  return { ok: true as const };
}
