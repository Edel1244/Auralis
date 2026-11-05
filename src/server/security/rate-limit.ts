import "server-only";
import { ApiError } from "../http";

/**
 * Fixed-window in-memory rate limiter. Suitable for a single-instance deployment
 * (the default self-hosting model). For horizontally scaled deployments, swap the
 * store for Redis — the `consume` contract stays the same.
 */
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();
let lastSweep = Date.now();

function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
}

export function consume(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  sweep(now);
  let b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    b = { count: 0, resetAt: now + windowMs };
    buckets.set(key, b);
  }
  b.count++;
  return { ok: b.count <= limit, remaining: Math.max(0, limit - b.count), resetAt: b.resetAt };
}

export function rateLimit(key: string, limit: number, windowMs: number) {
  const r = consume(key, limit, windowMs);
  if (!r.ok) {
    throw new ApiError("RATE_LIMITED", "Too many requests, please try again later", undefined, {
      "retry-after": String(Math.ceil((r.resetAt - Date.now()) / 1000)),
    });
  }
}

/** Test helper. */
export function _resetRateLimits() {
  buckets.clear();
}
