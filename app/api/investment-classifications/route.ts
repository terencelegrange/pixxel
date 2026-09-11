import { NextRequest, NextResponse } from "next/server";
import logger from "@/lib/logger";
import { randomUUID } from "crypto";
import mysql from "mysql2/promise";
import { getDb, setupDatabase } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { requireUser } from "@/lib/require-user";

function rowToClassification(row: mysql.RowDataPacket) {
  const toISO = (v: unknown) => v instanceof Date ? v.toISOString() : v ? String(v) : null;
  return {
    id:            row.id,
    name:          row.name,
    color:         row.color,
    sortOrder:     row.sort_order ?? null,
    createdById:   row.created_by_id,
    createdByName: row.created_by_name,
    createdAt:     toISO(row.created_at)!,
    updatedAt:     toISO(row.updated_at)!,
  };
}

export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;
  try {
    await setupDatabase();
    const db = getDb();
    const [rows] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT * FROM investment_classifications ORDER BY sort_order ASC, name ASC"
    );
    return NextResponse.json({ classifications: rows.map(rowToClassification) });
  } catch (err) {
    logger.error({ err, route: "GET /api/investment-classifications" }, "request failed");
    return NextResponse.json({ error: "Failed to load investment classifications." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireUser(req, ["Admin", "Member"]);
  if (!auth.ok) return auth.response;
  const { user } = auth;
  try {
    await setupDatabase();
    const body = await req.json();
    const { name, color, sortOrder } = body;

    if (!name?.trim())  return NextResponse.json({ error: "Name is required." }, { status: 400 });
    if (!color?.trim()) return NextResponse.json({ error: "Color is required." }, { status: 400 });

    const db = getDb();
    const id = randomUUID();

    await db.execute(
      `INSERT INTO investment_classifications (id, name, color, sort_order, created_by_id, created_by_name)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, name.trim(), color.trim(), sortOrder ?? null, user.id, user.name]
    );

    await writeAudit({
      tableName: "investment_classifications", recordId: id, action: "CREATE",
      performedById: user.id, performedByName: user.name,
      oldValues: null,
      newValues: { name: name.trim(), color: color.trim(), sortOrder: sortOrder ?? null },
    });

    return NextResponse.json({ id }, { status: 201 });
  } catch (err) {
    logger.error({ err, route: "POST /api/investment-classifications" }, "request failed");
    return NextResponse.json({ error: "Failed to create investment classification." }, { status: 500 });
  }
}
