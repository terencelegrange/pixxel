import { NextRequest, NextResponse } from "next/server";
import logger from "@/lib/logger";
import mysql from "mysql2/promise";
import { getDb, setupDatabase } from "@/lib/db";
import { AuditLog } from "@/types";
import { requireUser } from "@/lib/require-user";

// GET /api/audit
// Query params:
//   page      — 1-based page number (default: 1)
//   pageSize  — rows per page (default: 25, max: 100)
//   table     — filter by table_name (optional)
//   action    — filter by action: CREATE | UPDATE | DELETE (optional)
//   performer — partial match on performed_by_name (optional)
export async function GET(req: NextRequest) {
  const auth = await requireUser(req, "Admin");
  if (!auth.ok) return auth.response;
  try {
    await setupDatabase();
    const db = getDb();

    const { searchParams } = req.nextUrl;
    const page     = Math.max(1, parseInt(searchParams.get("page")     ?? "1",  10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") ?? "25", 10)));
    const table    = searchParams.get("table")     ?? "";
    const action   = searchParams.get("action")    ?? "";
    const performer = searchParams.get("performer") ?? "";

    const conditions: string[] = [];
    const params: string[]     = [];

    if (table)     { conditions.push("table_name = ?");             params.push(table); }
    if (action)    { conditions.push("action = ?");                 params.push(action); }
    if (performer) { conditions.push("performed_by_name LIKE ?");   params.push(`%${performer}%`); }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const [[countRows], [auditRows]] = await Promise.all([
      db.execute<mysql.RowDataPacket[]>(
        `SELECT COUNT(*) AS total FROM audit_log ${where}`,
        params
      ),
      db.execute<mysql.RowDataPacket[]>(
        `SELECT * FROM audit_log ${where} ORDER BY performed_at DESC LIMIT ? OFFSET ?`,
        [...params, pageSize, (page - 1) * pageSize]
      ),
    ]);

    const total = countRows[0].total as number;

    const entries: AuditLog[] = auditRows.map((row) => ({
      id:              row.id,
      tableName:       row.table_name,
      recordId:        row.record_id,
      action:          row.action as AuditLog["action"],
      performedById:   row.performed_by_id,
      performedByName: row.performed_by_name,
      performedAt:     row.performed_at instanceof Date
        ? row.performed_at.toISOString()
        : String(row.performed_at),
      oldValues: row.old_values
        ? (typeof row.old_values === "string" ? JSON.parse(row.old_values) : row.old_values)
        : null,
      newValues: row.new_values
        ? (typeof row.new_values === "string" ? JSON.parse(row.new_values) : row.new_values)
        : null,
    }));

    return NextResponse.json({ entries, total, page, pageSize });
  } catch (err) {
    logger.error({ err, route: "GET /api/audit" }, "request failed");
    return NextResponse.json({ error: "Failed to load audit log." }, { status: 500 });
  }
}
