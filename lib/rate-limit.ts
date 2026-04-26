import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

type Entry = { count: number; resetAt: number };

const memStore = new Map<string, Entry>();
const rlCache = new Map<string, Ratelimit>();

function getDistributedLimiter(limit: number, windowMs: number): Ratelimit | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }
  const cacheKey = `${limit}:${windowMs}`;
  if (!rlCache.has(cacheKey)) {
    const secs = Math.round(windowMs / 1000);
    const window: `${number} ${"ms" | "s" | "m" | "h" | "d"}` =
      secs >= 3600 ? `${Math.round(secs / 3600)} h` : `${Math.round(secs / 60)} m`;
    rlCache.set(cacheKey, new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(limit, window),
    }));
  }
  return rlCache.get(cacheKey)!;
}

function memCheck(
  key: string,
  limit: number,
  windowMs: number
): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = memStore.get(key);
  if (!entry || entry.resetAt < now) {
    memStore.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1 };
  }
  if (entry.count >= limit) return { allowed: false, remaining: 0 };
  entry.count++;
  return { allowed: true, remaining: limit - entry.count };
}

export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<{ allowed: boolean; remaining: number }> {
  const limiter = getDistributedLimiter(limit, windowMs);
  if (limiter) {
    const { success, remaining } = await limiter.limit(key);
    return { allowed: success, remaining };
  }
  return memCheck(key, limit, windowMs);
}

export function rateLimitResponse(info?: { limit: number; windowSecs: number }): Response {
  const windowSecs = info?.windowSecs ?? 60;
  const reset = Math.floor(Date.now() / 1000) + windowSecs;
  return new Response("Too many requests. Please slow down.", {
    status: 429,
    headers: {
      "Retry-After": String(windowSecs),
      "RateLimit-Limit": String(info?.limit ?? 0),
      "RateLimit-Remaining": "0",
      "RateLimit-Reset": String(reset),
    },
  });
}
