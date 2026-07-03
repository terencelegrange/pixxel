import { NextRequest, NextResponse } from "next/server";
import logger from "@/lib/logger";
import mysql from "mysql2/promise";
import { getDb, setupDatabase } from "@/lib/db";
import { AuditLog } from "@/types";
import { requireUser } from "@/lib/require-user";

// GET /api/assets/[id]/history — audit log entries for a specific asset
export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;
  try {
    await setupDatabase();
    const db = getDb();
    const [rows] = await db.execute<mysql.RowDataPacket[]>(
      `SELECT * FROM audit_log
       WHERE table_name = 'assets' AND record_id = ?
       ORDER BY performed_at DESC`,
      [params.id]
    );

    const entries: AuditLog[] = rows.map((row) => ({
      id: row.id,
      tableName: row.table_name,
      recordId: row.record_id,
      action: row.action as AuditLog["action"],
      performedById: row.performed_by_id,
      performedByName: row.performed_by_name,
      performedAt: row.performed_at instanceof Date
        ? row.performed_at.toISOString()
        : String(row.performed_at),
      oldValues: row.old_values ? (typeof row.old_values === "string" ? JSON.parse(row.old_values) : row.old_values) : null,
      newValues: row.new_values ? (typeof row.new_values === "string" ? JSON.parse(row.new_values) : row.new_values) : null,
    }));

    return NextResponse.json({ history: entries });
  } catch (err) {
    logger.error({ err, route: "GET /api/assets/:id/history" }, "request failed");
    return NextResponse.json({ error: "Failed to load audit history." }, { status: 500 });
  }
}
