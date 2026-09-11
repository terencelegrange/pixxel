/**
 * lib/api-keys.ts  —  SERVER ONLY
 *
 * Generation and hashing helpers for API keys (see lib/require-user.ts for
 * the bearer-token auth path that consumes these). Raw keys are never
 * persisted — only a fast SHA-256 hash, since verification is a per-request
 * lookup-by-hash rather than a login (where bcrypt's deliberate slowness
 * earns its keep); the raw key's own 256 bits of entropy already makes
 * offline brute-forcing infeasible regardless of hash speed.
 */
import { randomBytes, createHash } from "crypto";

const KEY_PREFIX_LITERAL = "pxk_";

/** Generates a new raw API key: "pxk_" + 32 random bytes, base64url-encoded. */
export function generateApiKey(): string {
  return `${KEY_PREFIX_LITERAL}${randomBytes(32).toString("base64url")}`;
}

/** One-way SHA-256 hex digest — used for both storage and lookup-by-hash. */
export function hashApiKey(rawKey: string): string {
  return createHash("sha256").update(rawKey, "utf8").digest("hex");
}

/** Short, non-secret identifier for display in the UI/logs (e.g. "pxk_9f2a1c"). */
export function keyPrefixFor(rawKey: string): string {
  return rawKey.slice(0, 10);
}

/** Cheap shape check before a DB hit — filters out obviously-malformed headers. */
export function looksLikeApiKey(value: string): boolean {
  return value.startsWith(KEY_PREFIX_LITERAL) && value.length > KEY_PREFIX_LITERAL.length + 20;
}
