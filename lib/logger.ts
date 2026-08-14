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
import pretty from "pino-pretty";
import { forwardLog } from "@/lib/observability/forward";

// Pretty-print in development, built as a plain in-thread stream rather than
// via pino's `transport` option. `transport` spawns pino-pretty in a worker
// thread (thread-stream), and that worker's dynamic module resolution breaks
// under Next.js's bundled dev server ("Cannot find module .../worker.js"),
// which then permanently kills logging for the rest of the process — any
// later logger call throws "the worker has exited" and crashes the request.
const prettyStream = process.env.NODE_ENV !== "production"
  ? pretty({ colorize: true, translateTime: "HH:MM:ss", ignore: "pid,hostname" })
  : undefined;

const logger = pino(
  {
    level: process.env.LOG_LEVEL ?? "info",
    hooks: {
      // Forward to the configured observability sink (if any) in addition to
      // normal output. Never blocks or throws — see forward.ts.
      logMethod(args, method, level) {
        forwardLog(level, args);
        method.apply(this, args);
      },
    },
  },
  prettyStream
);

export default logger;
