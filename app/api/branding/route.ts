import { NextRequest, NextResponse } from "next/server";
import mysql from "mysql2/promise";
import { getDb, setupDatabase } from "@/lib/db";
import { requireUser } from "@/lib/require-user";
import logger from "@/lib/logger";

// GET /api/branding — any authenticated user (Sidebar/Header need this
// regardless of role). Only exposes the two public branding fields, never
// the full app_settings row (which includes admin-only integration secrets).
export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;
  try {
    await setupDatabase();
    const db = getDb();
    const [rows] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT `key`, `value` FROM app_settings WHERE `key` IN ('branding.company_name', 'branding.logo_data_url')"
    );
    const raw: Record<string, string> = {};
    rows.forEach((r) => { raw[r.key] = r.value ?? ""; });
    return NextResponse.json({
      companyName: raw["branding.company_name"] || null,
      logoDataUrl: raw["branding.logo_data_url"] || null,
    });
  } catch (err) {
    logger.error({ err, route: "GET /api/branding" }, "request failed");
    return NextResponse.json({ error: "Failed to load branding." }, { status: 500 });
  }
}
