/**
 * lib/mfa.ts  —  SERVER ONLY
 *
 * TOTP (RFC 6238) generation/verification, recovery codes, and the
 * short-lived "MFA challenge" token issued between password success and
 * code entry during login.
 *
 * The challenge token uses the same HMAC-SHA256 primitive as lib/jwt.ts but
 * a deliberately different payload shape (`purpose: "mfa_challenge"`) and
 * its own sign/verify pair, kept separate from JwtPayload so a challenge
 * token can never be mistaken for — or accepted as — a real session JWT.
 */
import { createHmac, timingSafeEqual, randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { generateSecret, generateURI, generate, verify } from "otplib";
import QRCode from "qrcode";

const ISSUER = "Pixxel";

export async function generateMfaSecret(): Promise<string> {
  return generateSecret();
}

export function getOtpAuthUri(email: string, secret: string): string {
  return generateURI({ issuer: ISSUER, label: email, secret });
}

export async function getQrCodeDataUrl(otpauthUri: string): Promise<string> {
  return QRCode.toDataURL(otpauthUri);
}

export async function verifyTotp(secret: string, code: string): Promise<boolean> {
  if (!/^\d{6}$/.test(code)) return false;
  const result = await verify({ secret, token: code });
  return result.valid;
}

// Exposed for tests that need a known-good code for a given secret.
export async function generateTotp(secret: string): Promise<string> {
  return generate({ secret });
}

// ---------------------------------------------------------------------------
// Recovery codes
// ---------------------------------------------------------------------------
const RECOVERY_CODE_COUNT = 10;

function randomRecoveryCode(): string {
  const bytes = randomBytes(5).toString("hex").toUpperCase(); // 10 hex chars
  return `${bytes.slice(0, 5)}-${bytes.slice(5, 10)}`;
}

export function generateRecoveryCodes(count = RECOVERY_CODE_COUNT): string[] {
  return Array.from({ length: count }, randomRecoveryCode);
}

export async function hashRecoveryCode(code: string): Promise<string> {
  return bcrypt.hash(code, 12);
}

export async function verifyRecoveryCode(code: string, hash: string): Promise<boolean> {
  return bcrypt.compare(code, hash);
}

// ---------------------------------------------------------------------------
// MFA challenge token — bridges login's password step and the code step
// ---------------------------------------------------------------------------
interface MfaChallengePayload {
  sub: string; // user.id
  purpose: "mfa_challenge";
  iat: number;
  exp: number;
}

const HEADER = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
const CHALLENGE_TTL_SEC = 5 * 60;

export function signMfaChallengeToken(userId: string): string {
  const secret = process.env.JWT_SECRET!;
  const now = Math.floor(Date.now() / 1000);
  const payload: MfaChallengePayload = { sub: userId, purpose: "mfa_challenge", iat: now, exp: now + CHALLENGE_TTL_SEC };
  const claims = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const data = `${HEADER}.${claims}`;
  const sig = createHmac("sha256", secret).update(data).digest().toString("base64url");
  return `${data}.${sig}`;
}

export function verifyMfaChallengeToken(token: string): { sub: string } | null {
  const secret = process.env.JWT_SECRET;
  if (!secret) return null;

  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [header, claims, sig] = parts;
  const data = `${header}.${claims}`;
  const expected = createHmac("sha256", secret).update(data).digest().toString("base64url");

  try {
    const a = Buffer.from(sig, "base64url");
    const b = Buffer.from(expected, "base64url");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(claims, "base64url").toString()) as MfaChallengePayload;
    if (payload.purpose !== "mfa_challenge") return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return { sub: payload.sub };
  } catch {
    return null;
  }
}
