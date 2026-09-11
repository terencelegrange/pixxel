/**
 * lib/env.ts  —  SERVER ONLY
 *
 * Validates required environment variables at startup.
 * Call from instrumentation.ts so failures surface before the first request.
 *
 * DB credentials are optional on a brand-new, unconfigured instance — that's
 * the documented zero-env-var path where the server boots straight into the
 * /setup wizard, which writes site.config.json (mysql or sqlite) on
 * completion. Once setup has completed, isSetupComplete() is the
 * dialect-agnostic source of truth that DB access is configured, so DB env
 * vars are only enforced pre-setup when the operator has started supplying
 * them (a partial set is almost certainly a typo, e.g. missing DB_PASSWORD)
 * — matching the pre-configured docker-compose deployment path.
 *
 * JWT_SECRET is never required to be set explicitly: if absent, one is
 * generated and persisted on first boot (see lib/jwt-secret.ts) so people
 * who just pull the Docker image and run it don't have to configure
 * anything up front. An explicitly-set-but-too-short value is still a real
 * misconfiguration and is rejected rather than silently overridden.
 */
import { isSetupComplete } from "@/lib/setup";
import { getOrCreateJwtSecret } from "@/lib/jwt-secret";

export function validateEnv(): void {
  const errors: string[] = [];

  const providedSecret = process.env.JWT_SECRET ?? "";
  if (providedSecret && providedSecret.length < 32) {
    errors.push(`JWT_SECRET is too short (${providedSecret.length} chars — need ≥ 32)`);
  } else if (!providedSecret) {
    process.env.JWT_SECRET = getOrCreateJwtSecret();
  }

  if (!isSetupComplete()) {
    const dbEnv: [string, string][] = [
      ["DB_HOST", process.env.DB_HOST ?? ""],
      ["DB_USER", process.env.DB_USER ?? ""],
      ["DB_PASSWORD", process.env.DB_PASSWORD ?? ""],
      ["DB_NAME", process.env.DB_NAME ?? ""],
    ];
    const anyDbEnvSet = dbEnv.some(([, value]) => value !== "");
    if (anyDbEnvSet) {
      for (const [name, value] of dbEnv) {
        if (!value) errors.push(`${name} is not set`);
      }
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
