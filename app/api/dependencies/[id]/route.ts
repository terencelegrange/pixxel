import { NextRequest, NextResponse } from "next/server";
import logger from "@/lib/logger";
import mysql from "mysql2/promise";
import { getDb, setupDatabase } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { DependencyConnectionType, DependencyDirection } from "@/types";
import { requireUser } from "@/lib/require-user";

const VALID_TYPES: DependencyConnectionType[] = [
  'API', 'Database', 'File Transfer', 'Event / Message', 'UI Embed', 'Other',
];
const VALID_DIRECTIONS: DependencyDirection[] = ['outbound', 'bidirectional'];

export async function PUT(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await requireUser(req, ["Admin", "Member"]);
  if (!auth.ok) return auth.response;
  const { user } = auth;
  try {
    await setupDatabase();
    const body = await req.json();
    const { type, direction, notes } = body;

    if (!type || !VALID_TYPES.includes(type))
      return NextResponse.json({ error: "Invalid type." }, { status: 400 });
    if (!direction || !VALID_DIRECTIONS.includes(direction))
      return NextResponse.json({ error: "direction must be outbound or bidirectional." }, { status: 400 });

    const db = getDb();
    const [rows] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT * FROM asset_dependencies WHERE id = ? LIMIT 1",
      [params.id]
    );
    const current = rows[0];
    if (!current)
      return NextResponse.json({ error: "Dependency not found." }, { status: 404 });

    await db.execute(
      "UPDATE asset_dependencies SET type = ?, direction = ?, notes = ? WHERE id = ?",
      [type, direction, notes?.trim() || null, params.id]
    );

    await writeAudit({
      tableName: "asset_dependencies", recordId: params.id, action: "UPDATE",
      performedById: user.id, performedByName: user.name,
      oldValues: { type: current.type, direction: current.direction, notes: current.notes },
      newValues: { type, direction, notes: notes?.trim() || null },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error({ err, route: "PUT /api/dependencies/:id" }, "request failed");
    return NextResponse.json({ error: "Failed to update dependency." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await requireUser(req, ["Admin", "Member"]);
  if (!auth.ok) return auth.response;
  const { user } = auth;
  try {
    await setupDatabase();

    const db = getDb();
    const [rows] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT * FROM asset_dependencies WHERE id = ? LIMIT 1",
      [params.id]
    );
    const current = rows[0];
    if (!current)
      return NextResponse.json({ error: "Dependency not found." }, { status: 404 });

    await db.execute("DELETE FROM asset_dependencies WHERE id = ?", [params.id]);

    await writeAudit({
      tableName: "asset_dependencies", recordId: params.id, action: "DELETE",
      performedById: user.id, performedByName: user.name,
      oldValues: {
        sourceAssetId: current.source_asset_id,
        targetAssetId: current.target_asset_id,
        type: current.type,
        direction: current.direction,
      },
      newValues: null,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error({ err, route: "DELETE /api/dependencies/:id" }, "request failed");
    return NextResponse.json({ error: "Failed to delete dependency." }, { status: 500 });
  }
}
