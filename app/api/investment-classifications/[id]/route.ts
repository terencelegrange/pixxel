import { NextRequest, NextResponse } from "next/server";
import logger from "@/lib/logger";
import mysql from "mysql2/promise";
import { getDb, setupDatabase } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { requireUser } from "@/lib/require-user";

export async function PUT(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
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
    const [rows] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT * FROM investment_classifications WHERE id = ? LIMIT 1", [params.id]
    );
    if (rows.length === 0) return NextResponse.json({ error: "Classification not found." }, { status: 404 });
    const current = rows[0];

    await db.execute(
      "UPDATE investment_classifications SET name = ?, color = ?, sort_order = ? WHERE id = ?",
      [name.trim(), color.trim(), sortOrder ?? null, params.id]
    );

    await writeAudit({
      tableName: "investment_classifications", recordId: params.id, action: "UPDATE",
      performedById: user.id, performedByName: user.name,
      oldValues: { name: current.name, color: current.color, sortOrder: current.sort_order },
      newValues: { name: name.trim(), color: color.trim(), sortOrder: sortOrder ?? null },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error({ err, route: "PUT /api/investment-classifications/[id]" }, "request failed");
    return NextResponse.json({ error: "Failed to update investment classification." }, { status: 500 });
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
      "SELECT * FROM investment_classifications WHERE id = ? LIMIT 1", [params.id]
    );
    if (rows.length === 0) return NextResponse.json({ error: "Classification not found." }, { status: 404 });
    const current = rows[0];

    const [phases] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT id FROM asset_roadmap_phases WHERE classification_id = ? LIMIT 1", [params.id]
    );
    if (phases.length > 0) {
      return NextResponse.json(
        { error: "Cannot delete: this classification is in use by one or more roadmap phases." },
        { status: 409 }
      );
    }

    await db.execute("DELETE FROM investment_classifications WHERE id = ?", [params.id]);

    await writeAudit({
      tableName: "investment_classifications", recordId: params.id, action: "DELETE",
      performedById: user.id, performedByName: user.name,
      oldValues: { name: current.name, color: current.color },
      newValues: null,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error({ err, route: "DELETE /api/investment-classifications/[id]" }, "request failed");
    return NextResponse.json({ error: "Failed to delete investment classification." }, { status: 500 });
  }
}
