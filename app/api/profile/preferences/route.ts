import { NextRequest, NextResponse } from "next/server";
import mysql from "mysql2/promise";
import { getDb, setupDatabase, getDbDialect } from "@/lib/db";
import { nowSql } from "@/lib/sql-compat";
import { requireUser } from "@/lib/require-user";
import logger from "@/lib/logger";

// GET /api/profile/preferences — the current user's own timezone/language/
// notification preferences. Distinct from /api/profile (name/email) and
// unrelated to /api/settings (admin-only, install-wide config).
export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;
  try {
    await setupDatabase();
    const db = getDb();
    const [rows] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT timezone, language, notify_new_feedback, notify_contracts_expiring, tour_enabled, tour_seen_at FROM users WHERE id = ? LIMIT 1",
      [auth.user.id]
    );
    const row = rows[0];
    return NextResponse.json({
      timezone: row?.timezone ?? null,
      language: row?.language ?? "en",
      notifyNewFeedback: !!row?.notify_new_feedback,
      notifyContractsExpiring: !!row?.notify_contracts_expiring,
      tourEnabled: row?.tour_enabled == null ? true : !!row.tour_enabled,
      tourSeenAt: row?.tour_seen_at ? new Date(row.tour_seen_at).toISOString() : null,
    });
  } catch (err) {
    logger.error({ err, route: "GET /api/profile/preferences" }, "request failed");
    return NextResponse.json({ error: "Failed to load preferences." }, { status: 500 });
  }
}

// PUT /api/profile/preferences — updates only the fields present in the
// body (partial update), since the General and Notifications settings pages
// each save a different subset of this same row and must not clobber
// whichever fields the other page owns.
export async function PUT(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;
  try {
    await setupDatabase();
    const body = await req.json();
    const { timezone, language, notifyNewFeedback, notifyContractsExpiring, tourEnabled, tourSeen } = body as {
      timezone?: string | null; language?: string; notifyNewFeedback?: boolean; notifyContractsExpiring?: boolean;
      tourEnabled?: boolean;
      // Client sends true to mark the tour seen (completed/skipped) or false
      // to reset it (Replay) -- the timestamp itself is always server-set,
      // never trusted from the client.
      tourSeen?: boolean;
    };

    const sets: string[] = [];
    const params: unknown[] = [];
    if (timezone !== undefined) { sets.push("timezone = ?"); params.push(timezone?.trim() || null); }
    if (language !== undefined) { sets.push("language = ?"); params.push(language?.trim() || "en"); }
    if (notifyNewFeedback !== undefined) { sets.push("notify_new_feedback = ?"); params.push(!!notifyNewFeedback); }
    if (notifyContractsExpiring !== undefined) { sets.push("notify_contracts_expiring = ?"); params.push(!!notifyContractsExpiring); }
    if (tourEnabled !== undefined) { sets.push("tour_enabled = ?"); params.push(!!tourEnabled); }
    if (tourSeen !== undefined) { sets.push(`tour_seen_at = ${tourSeen ? nowSql(getDbDialect()) : "NULL"}`); }

    if (sets.length === 0) return NextResponse.json({ error: "No fields to update." }, { status: 400 });

    const db = getDb();
    await db.execute(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`, [...params, auth.user.id]);

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error({ err, route: "PUT /api/profile/preferences" }, "request failed");
    return NextResponse.json({ error: "Failed to save preferences." }, { status: 500 });
  }
}
