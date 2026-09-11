/**
 * lib/rate-limit.ts  —  SERVER ONLY
 *
 * In-process fixed-window rate limiter. Sufficient for single-server
 * deployments. For multi-instance deployments, replace the Map with a
 * shared store (Redis INCR + EXPIRE).
 *
 * Usage:
 *   const result = rateLimit(req, { limit: 10, windowMs: 15 * 60 * 1000 });
 *   if (!result.ok) return result.response;
 */
import { NextRequest, NextResponse } from "next/server";

interface WindowEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, WindowEntry>();

// Prune expired entries periodically so the map doesn't grow unbounded.
// unref() so this timer alone doesn't keep the process (or a Jest run) alive.
const pruneInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.resetAt <= now) store.delete(key);
  }
}, 60_000);
pruneInterval.unref();

interface Options {
  limit: number;
  windowMs: number;
}

type Result =
  | { ok: true }
  | { ok: false; response: NextResponse };

export function rateLimit(req: NextRequest, { limit, windowMs }: Options): Result {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  const key = `${req.nextUrl.pathname}::${ip}`;
  const now = Date.now();

  let entry = store.get(key);
  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + windowMs };
    store.set(key, entry);
  }

  entry.count += 1;

  if (entry.count > limit) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Too many requests. Please try again later." },
        {
          status: 429,
          headers: {
            "Retry-After": String(retryAfter),
            "X-RateLimit-Limit": String(limit),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": String(Math.ceil(entry.resetAt / 1000)),
          },
        }
      ),
    };
  }

  return { ok: true };
}
