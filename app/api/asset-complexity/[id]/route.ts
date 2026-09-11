import { NextRequest, NextResponse } from "next/server";
import logger from "@/lib/logger";
import mysql from "mysql2/promise";
import { getDb, setupDatabase } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { requireUser } from "@/lib/require-user";

// PUT /api/asset-complexity/[id]
export async function PUT(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await requireUser(req, ["Admin", "Member"]);
  if (!auth.ok) return auth.response;
  const { user } = auth;
  try {
    await setupDatabase();
    const { name, description, sortOrder } = await req.json();

    if (!name?.trim()) return NextResponse.json({ error: "Name is required." }, { status: 400 });

    const db = getDb();
    const [rows] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT * FROM asset_complexities WHERE id = ? LIMIT 1", [params.id]
    );
    const current = rows[0];
    if (!current) return NextResponse.json({ error: "Complexity not found." }, { status: 404 });

    const parsedOrder = sortOrder !== undefined && sortOrder !== "" && sortOrder !== null
      ? Number(sortOrder) : null;
    const values = {
      name: name.trim(),
      description: description?.trim() || null,
      sortOrder: parsedOrder,
    };

    await db.execute(
      "UPDATE asset_complexities SET name=?, description=?, sort_order=? WHERE id=?",
      [values.name, values.description, values.sortOrder, params.id]
    );

    await writeAudit({
      tableName: "asset_complexities", recordId: params.id, action: "UPDATE",
      performedById: user.id, performedByName: user.name,
      oldValues: { name: current.name, description: current.description, sortOrder: current.sort_order },
      newValues: values,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error({ err, route: "PUT /api/asset-complexity/:id" }, "request failed");
    return NextResponse.json({ error: "Failed to update complexity." }, { status: 500 });
  }
}

// DELETE /api/asset-complexity/[id]
export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await requireUser(req, ["Admin", "Member"]);
  if (!auth.ok) return auth.response;
  const { user } = auth;
  try {
    await setupDatabase();

    const db = getDb();
    const [rows] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT * FROM asset_complexities WHERE id = ? LIMIT 1", [params.id]
    );
    const current = rows[0];
    if (!current) return NextResponse.json({ error: "Complexity not found." }, { status: 404 });

    // Unlink assets before deleting
    await db.execute("UPDATE assets SET complexity_id = NULL WHERE complexity_id = ?", [params.id]);
    await db.execute("DELETE FROM asset_complexities WHERE id = ?", [params.id]);

    await writeAudit({
      tableName: "asset_complexities", recordId: params.id, action: "DELETE",
      performedById: user.id, performedByName: user.name,
      oldValues: { name: current.name, description: current.description }, newValues: null,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error({ err, route: "DELETE /api/asset-complexity/:id" }, "request failed");
    return NextResponse.json({ error: "Failed to delete complexity." }, { status: 500 });
  }
}
