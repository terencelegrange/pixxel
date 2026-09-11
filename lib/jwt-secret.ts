/**
 * lib/jwt-secret.ts  —  SERVER ONLY
 *
 * Resolves the JWT signing secret at boot. An operator-supplied JWT_SECRET
 * env var always wins. If unset, a secret is generated once and persisted
 * to .jwt-secret (sibling to site.config.json, same "written to /app at
 * runtime" pattern) so it survives process restarts — people who just pull
 * the Docker image and run it aren't expected to set anything up front.
 *
 * Only a full container recreation without a persisted volume loses the
 * generated secret, which simply invalidates existing sessions (users log
 * in again) — no data loss.
 *
 * Single-instance only: running more than one replica of this container
 * without an explicit, shared JWT_SECRET means each replica generates its
 * own secret independently and rejects tokens signed by the others. Set
 * JWT_SECRET explicitly for any multi-instance deployment.
 */
import fs from "fs";
import path from "path";
import { randomBytes } from "crypto";

const SECRET_FILE = path.join(process.cwd(), ".jwt-secret");

export function getOrCreateJwtSecret(): string {
  try {
    const existing = fs.readFileSync(SECRET_FILE, "utf-8").trim();
    if (existing.length >= 32) return existing;
  } catch {
    // File doesn't exist yet (or is unreadable) — generate below.
  }

  const generated = randomBytes(32).toString("base64");
  fs.writeFileSync(SECRET_FILE, generated, { mode: 0o600 });
  return generated;
}
