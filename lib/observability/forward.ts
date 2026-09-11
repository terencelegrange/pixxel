/**
 * lib/observability/forward.ts  —  SERVER ONLY
 *
 * Bridges pino's logMethod hook (see lib/logger.ts) to whichever
 * observability sink is configured. Adding a new provider later (Datadog,
 * New Relic, Splunk) means adding a case here and a new sinks/* module —
 * the logger call sites never change.
 */
import { getObservabilityConfig, MinLevel } from "./config";
import { sendToCustomCollector, CollectorLogEntry } from "./sinks/customCollector";

const LEVEL_ORDER: Record<MinLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

// Collector only accepts debug/info/warn/error — fold pino's trace/fatal in.
function toCollectorLevel(pinoLevelNumber: number): CollectorLogEntry["level"] {
  if (pinoLevelNumber <= 20) return "debug"; // trace, debug
  if (pinoLevelNumber === 30) return "info";
  if (pinoLevelNumber === 40) return "warn";
  return "error"; // error, fatal
}

function extractMessageAndMetadata(args: unknown[]): { message: string; metadata: Record<string, unknown> } {
  const [first, second] = args;
  if (first && typeof first === "object") {
    const mergeObj = { ...(first as Record<string, unknown>) };
    const message = typeof second === "string" ? second : "";
    if (mergeObj.err instanceof Error) {
      mergeObj.err = { message: mergeObj.err.message, stack: mergeObj.err.stack, name: mergeObj.err.name };
    }
    return { message, metadata: mergeObj };
  }
  return { message: typeof first === "string" ? first : "", metadata: {} };
}

export function forwardLog(pinoLevelNumber: number, args: unknown[]): void {
  // Never let a forwarding failure throw out of the logging call site.
  void (async () => {
    const config = await getObservabilityConfig();
    if (!config.enabled || config.provider === "none") return;

    const level = toCollectorLevel(pinoLevelNumber);
    if (LEVEL_ORDER[level] < LEVEL_ORDER[config.minLevel]) return;

    const { message, metadata } = extractMessageAndMetadata(args);
    const entry: CollectorLogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
    };

    if (config.provider === "custom") {
      const result = await sendToCustomCollector(config, entry);
      if (!result.ok) {
        console.error("[observability] failed to forward log to collector:", result.error ?? result.status);
      }
    }
  })().catch((err) => {
    console.error("[observability] unexpected error forwarding log:", err);
  });
}
