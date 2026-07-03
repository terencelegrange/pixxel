/**
 * lib/jwt.ts  —  SERVER ONLY
 *
 * Minimal HS256 JWT implementation using Node.js built-in crypto.
 * No external dependencies.
 *
 * JWT_SECRET must be ≥ 32 chars (enforced by lib/env.ts at boot).
 */
import { createHmac, timingSafeEqual } from "crypto";

export interface JwtPayload {
  sub: string;   // user.id
  name: string;
  email: string;
  role: string;
  tokenVersion: number;
  iat: number;
  exp: number;
}

const HEADER = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");

export function signJwt(
  user: Pick<JwtPayload, "sub" | "name" | "email" | "role" | "tokenVersion">,
  expiresInSec = 7 * 24 * 3600
): string {
  const secret = process.env.JWT_SECRET!;
  const now = Math.floor(Date.now() / 1000);
  const claims = Buffer.from(
    JSON.stringify({ ...user, iat: now, exp: now + expiresInSec })
  ).toString("base64url");
  const data = `${HEADER}.${claims}`;
  const sig = createHmac("sha256", secret).update(data).digest().toString("base64url");
  return `${data}.${sig}`;
}

export function verifyJwt(token: string): JwtPayload | null {
  const secret = process.env.JWT_SECRET;
  if (!secret) return null;

  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [header, claims, sig] = parts;
  const data = `${header}.${claims}`;
  const expected = createHmac("sha256", secret).update(data).digest().toString("base64url");

  // Constant-time comparison to prevent timing attacks
  try {
    const a = Buffer.from(sig, "base64url");
    const b = Buffer.from(expected, "base64url");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(claims, "base64url").toString()) as JwtPayload;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
