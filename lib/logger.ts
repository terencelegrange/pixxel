/**
 * lib/logger.ts  —  SERVER ONLY
 *
 * Structured JSON logger (pino) for API routes and server-side lib code.
 * Ships JSON lines in production so log aggregators (Datadog, ELK, CloudWatch)
 * can parse level/route/err as fields instead of scraping console text;
 * pretty-prints in development for readability.
 *
 * Usage:
 *   import logger from "@/lib/logger";
 *   logger.error({ err, route: "GET /api/assets" }, "request failed");
 */
import pino from "pino";
import { forwardLog } from "@/lib/observability/forward";

const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  transport: process.env.NODE_ENV !== "production"
    ? { target: "pino-pretty", options: { colorize: true, translateTime: "HH:MM:ss", ignore: "pid,hostname" } }
    : undefined,
  hooks: {
    // Forward to the configured observability sink (if any) in addition to
    // normal output. Never blocks or throws — see forward.ts.
    logMethod(args, method, level) {
      forwardLog(level, args);
      method.apply(this, args);
    },
  },
});

export default logger;
