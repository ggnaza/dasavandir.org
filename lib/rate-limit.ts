type Entry = { count: number; resetAt: number };

// In-memory store — scoped per serverless instance.
// For multi-instance production, swap backing store to Vercel KV or Upstash Redis.
const store = new Map<string, Entry>();

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1 };
  }

  if (entry.count >= limit) {
    return { allowed: false, remaining: 0 };
  }

  entry.count++;
  return { allowed: true, remaining: limit - entry.count };
}

export function rateLimitResponse(): Response {
  return new Response("Too many requests. Please slow down.", {
    status: 429,
    headers: { "Retry-After": "60" },
  });
}
