import { NextRequest, NextResponse } from "next/server";
import logger from "@/lib/logger";
import { randomUUID } from "crypto";
import mysql from "mysql2/promise";
import { getDb, setupDatabase } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { requireUser } from "@/lib/require-user";

const toISO = (v: unknown) =>
  v instanceof Date ? v.toISOString() : v ? String(v) : null;

// GET /api/diagram-types
export async function GET(req: NextRequest) {
  const auth = requireUser(req);
  if (!auth.ok) return auth.response;
  try {
    await setupDatabase();
    const db = getDb();
    const [rows] = await db.execute<mysql.RowDataPacket[]>(
      `SELECT * FROM diagram_types ORDER BY sort_order IS NULL ASC, sort_order ASC, name ASC`
    );
    const types = rows.map((r) => ({
      id: r.id, name: r.name, description: r.description ?? null,
      sortOrder: r.sort_order ?? null,
      createdById: r.created_by_id, createdByName: r.created_by_name,
      createdAt: toISO(r.created_at)!, updatedAt: toISO(r.updated_at)!,
    }));
    return NextResponse.json({ types });
  } catch (err) {
    logger.error({ err, route: "GET /api/diagram-types" }, "request failed");
    return NextResponse.json({ error: "Failed to load diagram types." }, { status: 500 });
  }
}

// POST /api/diagram-types
export async function POST(req: NextRequest) {
  const auth = requireUser(req, ["Admin", "Member"]);
  if (!auth.ok) return auth.response;
  const { user } = auth;
  try {
    await setupDatabase();
    const { name, description, sortOrder } = await req.json();
    if (!name?.trim()) return NextResponse.json({ error: "Name is required." }, { status: 400 });

    const db = getDb();
    const id = randomUUID();
    await db.execute(
      "INSERT INTO diagram_types (id, name, description, sort_order, created_by_id, created_by_name) VALUES (?,?,?,?,?,?)",
      [id, name.trim(), description?.trim() || null, sortOrder ?? null, user.id, user.name]
    );
    await writeAudit({
      tableName: "diagram_types", recordId: id, action: "CREATE",
      performedById: user.id, performedByName: user.name,
      oldValues: null, newValues: { name: name.trim(), description: description?.trim() || null },
    });
    return NextResponse.json({ id }, { status: 201 });
  } catch (err: unknown) {
    const e = err as { code?: string };
    if (e.code === "ER_DUP_ENTRY") return NextResponse.json({ error: "A type with that name already exists." }, { status: 409 });
    logger.error({ err, route: "POST /api/diagram-types" }, "request failed");
    return NextResponse.json({ error: "Failed to create diagram type." }, { status: 500 });
  }
}
