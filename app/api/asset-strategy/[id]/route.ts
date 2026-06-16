import { NextRequest, NextResponse } from "next/server";
import mysql from "mysql2/promise";
import { getDb, setupDatabase } from "@/lib/db";
import { writeAudit } from "@/lib/audit";

// PUT /api/asset-strategy/[id]
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await setupDatabase();
    const body = await req.json();
    const { name, description, sortOrder, userId, userName } = body;

    if (!name?.trim()) return NextResponse.json({ error: "Strategy name is required." }, { status: 400 });
    if (!userId || !userName) return NextResponse.json({ error: "Authenticated user is required." }, { status: 401 });

    const db = getDb();
    const [rows] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT * FROM asset_strategies WHERE id = ? LIMIT 1", [params.id]
    );
    const current = rows[0];
    if (!current) return NextResponse.json({ error: "Strategy not found." }, { status: 404 });

    const parsedOrder = sortOrder !== undefined && sortOrder !== "" && sortOrder !== null
      ? Number(sortOrder) : null;
    const values = {
      name: name.trim(),
      description: description?.trim() || null,
      sortOrder: parsedOrder,
    };

    await db.execute(
      "UPDATE asset_strategies SET name=?, description=?, sort_order=? WHERE id=?",
      [values.name, values.description, values.sortOrder, params.id]
    );

    await writeAudit({
      tableName: "asset_strategies", recordId: params.id, action: "UPDATE",
      performedById: userId, performedByName: userName,
      oldValues: { name: current.name, description: current.description, sortOrder: current.sort_order },
      newValues: values,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[PUT /api/asset-strategy/:id]", err);
    return NextResponse.json({ error: "Failed to update strategy." }, { status: 500 });
  }
}

// DELETE /api/asset-strategy/[id]
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
      "SELECT * FROM asset_strategies WHERE id = ? LIMIT 1", [params.id]
    );
    const current = rows[0];
    if (!current) return NextResponse.json({ error: "Strategy not found." }, { status: 404 });

    // Unlink assets before deleting
    await db.execute("UPDATE assets SET strategy_id = NULL WHERE strategy_id = ?", [params.id]);
    await db.execute("DELETE FROM asset_strategies WHERE id = ?", [params.id]);

    await writeAudit({
      tableName: "asset_strategies", recordId: params.id, action: "DELETE",
      performedById: userId, performedByName: userName,
      oldValues: { name: current.name, description: current.description },
      newValues: null,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/asset-strategy/:id]", err);
    return NextResponse.json({ error: "Failed to delete strategy." }, { status: 500 });
  }
}
