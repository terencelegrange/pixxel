/**
 * lib/observability/config.ts  —  SERVER ONLY
 *
 * Reads observability.* keys from app_settings and caches them in-process
 * (log calls happen far more often than settings change, so we don't want a
 * DB round trip per log line). refreshObservabilityConfig() is called by
 * PUT /api/settings to invalidate the cache after a save.
 */
import mysql from "mysql2/promise";
import { getDb } from "@/lib/db";

export type ObservabilityProvider = "none" | "custom";
export type ObservabilityAuthType = "bearer";
export type MinLevel = "debug" | "info" | "warn" | "error";

export interface ObservabilityConfig {
  enabled: boolean;
  provider: ObservabilityProvider;
  collectorUrl: string;
  authType: ObservabilityAuthType;
  apiKey: string;
  minLevel: MinLevel;
}

const DEFAULT_CONFIG: ObservabilityConfig = {
  enabled: false,
  provider: "none",
  collectorUrl: "",
  authType: "bearer",
  apiKey: "",
  minLevel: "warn",
};

let cached: ObservabilityConfig | null = null;
let inFlight: Promise<ObservabilityConfig> | null = null;

async function loadConfig(): Promise<ObservabilityConfig> {
  try {
    const db = getDb();
    const [rows] = await db.execute<mysql.RowDataPacket[]>(
      `SELECT \`key\`, \`value\` FROM app_settings WHERE \`key\` LIKE 'observability.%'`
    );
    const raw: Record<string, string> = {};
    rows.forEach((r) => { raw[r.key] = r.value ?? ""; });

    return {
      enabled: raw["observability.enabled"] === "true",
      provider: (raw["observability.provider"] as ObservabilityProvider) || "none",
      collectorUrl: raw["observability.collector_url"] ?? "",
      authType: (raw["observability.auth_type"] as ObservabilityAuthType) || "bearer",
      apiKey: raw["observability.api_key"] ?? "",
      minLevel: (raw["observability.min_level"] as MinLevel) || "warn",
    };
  } catch {
    // DB not configured yet (e.g. before /setup completes), or table missing.
    // Forwarding is best-effort — never let this break the app.
    return DEFAULT_CONFIG;
  }
}

export function getObservabilityConfig(): Promise<ObservabilityConfig> {
  if (cached) return Promise.resolve(cached);
  if (!inFlight) {
    inFlight = loadConfig().then((cfg) => {
      cached = cfg;
      inFlight = null;
      return cfg;
    });
  }
  return inFlight;
}

export function refreshObservabilityConfig(): void {
  cached = null;
  inFlight = null;
}
