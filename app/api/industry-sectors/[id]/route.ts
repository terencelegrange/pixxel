import { NextRequest, NextResponse } from "next/server";
import logger from "@/lib/logger";
import mysql from "mysql2/promise";
import { getDb, setupDatabase } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { requireUser } from "@/lib/require-user";

export async function PUT(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = requireUser(req, ["Admin", "Member"]);
  if (!auth.ok) return auth.response;
  const { user } = auth;
  try {
    await setupDatabase();
    const { name, description } = await req.json();
    if (!name?.trim()) return NextResponse.json({ error: "Name is required." }, { status: 400 });

    const db = getDb();
    const [rows] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT * FROM industry_sectors WHERE id = ? LIMIT 1", [params.id]
    );
    const current = rows[0];
    if (!current) return NextResponse.json({ error: "Industry sector not found." }, { status: 404 });

    await db.execute(
      "UPDATE industry_sectors SET name = ?, description = ? WHERE id = ?",
      [name.trim(), description?.trim() || null, params.id]
    );
    await writeAudit({
      tableName: "industry_sectors", recordId: params.id, action: "UPDATE",
      performedById: user.id, performedByName: user.name,
      oldValues: { name: current.name, description: current.description },
      newValues: { name: name.trim(), description: description?.trim() || null },
    });
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const e = err as { code?: string };
    if (e.code === "ER_DUP_ENTRY") return NextResponse.json({ error: "An industry sector with that name already exists." }, { status: 409 });
    logger.error({ err, route: "PUT /api/industry-sectors/:id" }, "request failed");
    return NextResponse.json({ error: "Failed to update industry sector." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = requireUser(req, ["Admin", "Member"]);
  if (!auth.ok) return auth.response;
  const { user } = auth;
  try {
    await setupDatabase();

    const db = getDb();
    const [rows] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT * FROM industry_sectors WHERE id = ? LIMIT 1", [params.id]
    );
    const current = rows[0];
    if (!current) return NextResponse.json({ error: "Industry sector not found." }, { status: 404 });

    // Block delete if capabilities exist for this sector
    const [capRows] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT COUNT(*) AS cnt FROM business_capabilities WHERE industry_sector_id = ?", [params.id]
    );
    if ((capRows[0].cnt as number) > 0) {
      return NextResponse.json({
        error: "Cannot delete — this sector has business capabilities linked to it. Remove them first."
      }, { status: 409 });
    }

    await db.execute("DELETE FROM industry_sectors WHERE id = ?", [params.id]);
    await writeAudit({
      tableName: "industry_sectors", recordId: params.id, action: "DELETE",
      performedById: user.id, performedByName: user.name,
      oldValues: { name: current.name, description: current.description }, newValues: null,
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error({ err, route: "DELETE /api/industry-sectors/:id" }, "request failed");
    return NextResponse.json({ error: "Failed to delete industry sector." }, { status: 500 });
  }
}
