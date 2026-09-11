/**
 * lib/mfa-crypto.ts  —  SERVER ONLY
 *
 * Encrypts TOTP secrets at rest. Unlike passwords, a TOTP secret must be
 * recoverable (HMAC-ing a code requires the raw secret), so it can't be
 * hashed — it's encrypted instead.
 *
 * Key source: MFA_ENCRYPTION_KEY if set, otherwise derived from JWT_SECRET
 * (so no new required env var for existing installs). Keeping these two
 * secrets independent means rotating JWT_SECRET doesn't silently make every
 * user's MFA secret undecryptable — set MFA_ENCRYPTION_KEY once and JWT
 * rotation becomes safe to do without a mass MFA lockout.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

function getKey(): Buffer {
  const secret = process.env.MFA_ENCRYPTION_KEY ?? process.env.JWT_SECRET!;
  return createHash("sha256").update(`${secret}:mfa-secret-key`).digest();
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("base64"), authTag.toString("base64"), ciphertext.toString("base64")].join(":");
}

export function decryptSecret(encrypted: string): string {
  const [ivB64, authTagB64, ciphertextB64] = encrypted.split(":");
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(authTagB64, "base64");
  const ciphertext = Buffer.from(ciphertextB64, "base64");
  const decipher = createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
