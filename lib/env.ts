/**
 * lib/env.ts  —  SERVER ONLY
 *
 * Validates required environment variables at startup.
 * Call from instrumentation.ts so failures surface before the first request.
 *
 * DB credentials are optional when site.config.json is present and valid,
 * because the setup wizard writes credentials there. JWT_SECRET is always
 * required — it must be set in .env.local (never in site.config.json).
 */
import fs from "fs";
import path from "path";

function hasSiteConfig(): boolean {
  try {
    const raw = fs.readFileSync(path.join(process.cwd(), "site.config.json"), "utf-8");
    const cfg = JSON.parse(raw);
    return !!(cfg?.db?.host && cfg?.db?.password !== undefined);
  } catch {
    return false;
  }
}

export function validateEnv(): void {
  const errors: string[] = [];

  // JWT_SECRET is always required once JWT auth is in use.
  const secret = process.env.JWT_SECRET ?? "";
  if (!secret) {
    errors.push("JWT_SECRET is not set");
  } else if (secret.length < 32) {
    errors.push(`JWT_SECRET is too short (${secret.length} chars — need ≥ 32)`);
  }

  // DB credentials are only required when site.config.json isn't available.
  if (!hasSiteConfig()) {
    const required: [string, string][] = [
      ["DB_HOST", process.env.DB_HOST ?? ""],
      ["DB_USER", process.env.DB_USER ?? ""],
      ["DB_PASSWORD", process.env.DB_PASSWORD ?? ""],
      ["DB_NAME", process.env.DB_NAME ?? ""],
    ];
    for (const [name, value] of required) {
      if (!value) errors.push(`${name} is not set (and no site.config.json was found)`);
    }
  }

  if (errors.length > 0) {
    throw new Error(
      `\n\nServer startup aborted — missing or invalid configuration:\n` +
        errors.map((e) => `  • ${e}`).join("\n") +
        `\n\nFix the above in .env.local and restart the server.\n`
    );
  }
}
