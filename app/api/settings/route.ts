import { NextRequest, NextResponse } from "next/server";
import { getDb, setupDatabase, getDbDialect } from "@/lib/db";
import mysql from "mysql2/promise";
import { requireUser } from "@/lib/require-user";
import { MASKED_VALUE, SECRET_SETTING_KEYS, maskSecretSettings } from "@/lib/secretSettings";
import { refreshObservabilityConfig } from "@/lib/observability/config";
import { upsertSql } from "@/lib/sql-compat";
import logger from "@/lib/logger";

// Admin-only: these are integration credentials, not general app config.
export async function GET(req: NextRequest) {
  const auth = await requireUser(req, "Admin");
  if (!auth.ok) return auth.response;
  try {
    await setupDatabase();
    const db = getDb();
    const [rows] = await db.execute<mysql.RowDataPacket[]>("SELECT `key`, `value` FROM app_settings");
    const settings: Record<string, string> = {};
    rows.forEach((r) => { settings[r.key] = r.value ?? ""; });
    return NextResponse.json({ settings: maskSecretSettings(settings) });
  } catch (err) {
    logger.error({ err, route: "GET /api/settings" }, "request failed");
    return NextResponse.json({ error: "Failed to load settings." }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const auth = await requireUser(req, "Admin");
  if (!auth.ok) return auth.response;
  try {
    await setupDatabase();
    const db = getDb();
    const body = await req.json();
    // body.settings is Record<string, string>
    const settings = (body.settings ?? {}) as Record<string, string>;
    for (const [key, value] of Object.entries(settings)) {
      // The client echoes the masked sentinel back for secret fields it didn't
      // touch — skip those so we don't overwrite the real stored value.
      if (SECRET_SETTING_KEYS.has(key) && value === MASKED_VALUE) continue;
      await db.execute(
        upsertSql("app_settings", ["key", "value"], "value", getDbDialect()),
        [key, value]
      );
    }
    refreshObservabilityConfig();
    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error({ err, route: "PUT /api/settings" }, "request failed");
    return NextResponse.json({ error: "Failed to save settings." }, { status: 500 });
  }
}
