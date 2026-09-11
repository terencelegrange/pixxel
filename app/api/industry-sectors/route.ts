import { NextRequest, NextResponse } from "next/server";
import logger from "@/lib/logger";
import { randomUUID } from "crypto";
import mysql from "mysql2/promise";
import { getDb, setupDatabase } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { requireUser } from "@/lib/require-user";

export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;
  try {
    await setupDatabase();
    const db = getDb();
    const [rows] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT * FROM industry_sectors ORDER BY name ASC"
    );
    const sectors = rows.map((r) => ({
      id: r.id, name: r.name, description: r.description ?? null,
      createdById: r.created_by_id, createdByName: r.created_by_name,
      createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
      updatedAt: r.updated_at instanceof Date ? r.updated_at.toISOString() : String(r.updated_at),
    }));
    return NextResponse.json({ sectors });
  } catch (err) {
    logger.error({ err, route: "GET /api/industry-sectors" }, "request failed");
    return NextResponse.json({ error: "Failed to load industry sectors." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireUser(req, ["Admin", "Member"]);
  if (!auth.ok) return auth.response;
  const { user } = auth;
  try {
    await setupDatabase();
    const { name, description } = await req.json();
    if (!name?.trim()) return NextResponse.json({ error: "Name is required." }, { status: 400 });

    const db = getDb();
    const id = randomUUID();
    await db.execute(
      "INSERT INTO industry_sectors (id, name, description, created_by_id, created_by_name) VALUES (?,?,?,?,?)",
      [id, name.trim(), description?.trim() || null, user.id, user.name]
    );
    await writeAudit({
      tableName: "industry_sectors", recordId: id, action: "CREATE",
      performedById: user.id, performedByName: user.name,
      oldValues: null, newValues: { name: name.trim(), description: description?.trim() || null },
    });
    return NextResponse.json({ id }, { status: 201 });
  } catch (err: unknown) {
    const e = err as { code?: string };
    if (e.code === "ER_DUP_ENTRY") return NextResponse.json({ error: "An industry sector with that name already exists." }, { status: 409 });
    logger.error({ err, route: "POST /api/industry-sectors" }, "request failed");
    return NextResponse.json({ error: "Failed to create industry sector." }, { status: 500 });
  }
}
