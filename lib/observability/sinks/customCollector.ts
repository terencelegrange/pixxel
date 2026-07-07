/**
 * lib/observability/sinks/customCollector.ts  —  SERVER ONLY
 *
 * Sends a single log entry to a self-hosted log collector's POST /ingest
 * endpoint (one entry per request — the collector has no batch endpoint).
 * Never throws — a down/unreachable collector must never affect the app.
 * The caller decides whether the result matters: the logging hook (forward.ts)
 * ignores it, the "Send test log" settings button reports it to the admin.
 */
import { ObservabilityConfig } from "../config";

export interface CollectorLogEntry {
  level: "debug" | "info" | "warn" | "error";
  message: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface SendResult {
  ok: boolean;
  status?: number;
  error?: string;
}

const REQUEST_TIMEOUT_MS = 3000;
const MAX_MESSAGE_LENGTH = 10_000;

export async function sendToCustomCollector(config: ObservabilityConfig, entry: CollectorLogEntry): Promise<SendResult> {
  if (!config.collectorUrl) return { ok: false, error: "No collector URL configured." };

  try {
    const res = await fetch(config.collectorUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        level: entry.level,
        message: entry.message.slice(0, MAX_MESSAGE_LENGTH),
        timestamp: entry.timestamp,
        metadata: entry.metadata,
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, status: res.status, error: body || res.statusText };
    }
    return { ok: true, status: res.status };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
