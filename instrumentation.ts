/**
 * instrumentation.ts
 *
 * Next.js 14 instrumentation hook — runs once on server startup before any
 * request is handled. We use it to fail fast on misconfiguration rather than
 * letting the server boot and serve cryptic 500s on the first real request.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { validateEnv } = await import("@/lib/env");
    validateEnv();
  }
}
