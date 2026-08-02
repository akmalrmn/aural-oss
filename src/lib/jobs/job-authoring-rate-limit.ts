const WINDOW_MS = 60_000;
const MAX_REQUESTS = 8;

const requests = new Map<string, { count: number; resetAt: number }>();

setInterval(() => {
  const now = Date.now();
  requests.forEach((entry, key) => {
    if (entry.resetAt <= now) requests.delete(key);
  });
}, WINDOW_MS).unref();

export function consumeJobAuthoringRateLimit(
  identifier: string,
  now = Date.now(),
): number | null {
  const current = requests.get(identifier);
  if (!current || current.resetAt <= now) {
    requests.set(identifier, { count: 1, resetAt: now + WINDOW_MS });
    return null;
  }

  current.count += 1;
  if (current.count <= MAX_REQUESTS) return null;
  return Math.max(1, Math.ceil((current.resetAt - now) / 1000));
}

export function resetJobAuthoringRateLimitForTests() {
  requests.clear();
}
