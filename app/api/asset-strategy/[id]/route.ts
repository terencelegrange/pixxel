import { NextRequest, NextResponse } from "next/server";
import mysql from "mysql2/promise";
import { getDb, setupDatabase } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { requireUser } from "@/lib/require-user";

// PUT /api/asset-strategy/[id]
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = requireUser(req);
  if (!auth.ok) return auth.response;
  const { user } = auth;
  try {
    await setupDatabase();
    const body = await req.json();
    const { name, description, sortOrder } = body;

    if (!name?.trim()) return NextResponse.json({ error: "Strategy name is required." }, { status: 400 });

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
      performedById: user.id, performedByName: user.name,
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
  const auth = requireUser(req);
  if (!auth.ok) return auth.response;
  const { user } = auth;
  try {
    await setupDatabase();

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
      performedById: user.id, performedByName: user.name,
      oldValues: { name: current.name, description: current.description },
      newValues: null,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/asset-strategy/:id]", err);
    return NextResponse.json({ error: "Failed to delete strategy." }, { status: 500 });
  }
}
