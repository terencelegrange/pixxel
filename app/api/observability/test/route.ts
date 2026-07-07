import { NextRequest, NextResponse } from "next/server";
import logger from "@/lib/logger";
import { requireUser } from "@/lib/require-user";
import { sendToCustomCollector } from "@/lib/observability/sinks/customCollector";
import { getDb, setupDatabase } from "@/lib/db";
import mysql from "mysql2/promise";
import { MASKED_VALUE } from "@/lib/secretSettings";

// POST /api/observability/test — send a test log entry using the values
// currently in the form (not necessarily saved yet), so admins can verify
// connectivity before hitting Save.
export async function POST(req: NextRequest) {
  const auth = await requireUser(req, "Admin");
  if (!auth.ok) return auth.response;
  try {
    const body = await req.json();
    const { collectorUrl, apiKey } = body as { collectorUrl?: string; apiKey?: string };

    if (!collectorUrl?.trim()) {
      return NextResponse.json({ error: "Collector URL is required." }, { status: 400 });
    }

    let resolvedApiKey = apiKey?.trim() ?? "";
    if (resolvedApiKey === MASKED_VALUE) {
      // Form field wasn't touched — use the already-saved key.
      await setupDatabase();
      const db = getDb();
      const [rows] = await db.execute<mysql.RowDataPacket[]>(
        "SELECT `value` FROM app_settings WHERE `key` = 'observability.api_key' LIMIT 1"
      );
      resolvedApiKey = rows[0]?.value ?? "";
    }

    const result = await sendToCustomCollector(
      { enabled: true, provider: "custom", collectorUrl: collectorUrl.trim(), authType: "bearer", apiKey: resolvedApiKey, minLevel: "debug" },
      {
        level: "info",
        message: "Pixxel observability test log",
        timestamp: new Date().toISOString(),
        metadata: { source: "settings-test-button", triggeredBy: auth.user.name },
      }
    );

    if (!result.ok) {
      return NextResponse.json({ error: result.error ?? `Collector returned ${result.status}.` }, { status: 502 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error({ err, route: "POST /api/observability/test" }, "request failed");
    return NextResponse.json({ error: "Failed to send test log." }, { status: 500 });
  }
}
