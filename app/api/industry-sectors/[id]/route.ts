import { NextRequest, NextResponse } from "next/server";
import mysql from "mysql2/promise";
import { getDb, setupDatabase } from "@/lib/db";
import { writeAudit } from "@/lib/audit";

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await setupDatabase();
    const { name, description, userId, userName } = await req.json();
    if (!name?.trim()) return NextResponse.json({ error: "Name is required." }, { status: 400 });
    if (!userId || !userName) return NextResponse.json({ error: "Authenticated user is required." }, { status: 401 });

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
      performedById: userId, performedByName: userName,
      oldValues: { name: current.name, description: current.description },
      newValues: { name: name.trim(), description: description?.trim() || null },
    });
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const e = err as { code?: string };
    if (e.code === "ER_DUP_ENTRY") return NextResponse.json({ error: "An industry sector with that name already exists." }, { status: 409 });
    console.error("[PUT /api/industry-sectors/:id]", err);
    return NextResponse.json({ error: "Failed to update industry sector." }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await setupDatabase();
    const { userId, userName } = await req.json() as { userId?: string; userName?: string };
    if (!userId || !userName) return NextResponse.json({ error: "Authenticated user is required." }, { status: 401 });

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
      performedById: userId, performedByName: userName,
      oldValues: { name: current.name, description: current.description }, newValues: null,
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/industry-sectors/:id]", err);
    return NextResponse.json({ error: "Failed to delete industry sector." }, { status: 500 });
  }
}
