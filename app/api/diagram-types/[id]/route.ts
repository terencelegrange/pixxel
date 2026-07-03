import { NextRequest, NextResponse } from "next/server";
import logger from "@/lib/logger";
import mysql from "mysql2/promise";
import { getDb, setupDatabase } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { requireUser } from "@/lib/require-user";

// PUT /api/diagram-types/[id]
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
      "SELECT * FROM diagram_types WHERE id = ? LIMIT 1", [params.id]
    );
    const current = rows[0];
    if (!current) return NextResponse.json({ error: "Diagram type not found." }, { status: 404 });

    await db.execute(
      "UPDATE diagram_types SET name = ?, description = ?, sort_order = ? WHERE id = ?",
      [name.trim(), description?.trim() || null, sortOrder ?? null, params.id]
    );
    await writeAudit({
      tableName: "diagram_types", recordId: params.id, action: "UPDATE",
      performedById: user.id, performedByName: user.name,
      oldValues: { name: current.name, description: current.description, sortOrder: current.sort_order },
      newValues: { name: name.trim(), description: description?.trim() || null, sortOrder: sortOrder ?? null },
    });
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const e = err as { code?: string };
    if (e.code === "ER_DUP_ENTRY") return NextResponse.json({ error: "A type with that name already exists." }, { status: 409 });
    logger.error({ err, route: "PUT /api/diagram-types/:id" }, "request failed");
    return NextResponse.json({ error: "Failed to update diagram type." }, { status: 500 });
  }
}

// DELETE /api/diagram-types/[id]
export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await requireUser(req, ["Admin", "Member"]);
  if (!auth.ok) return auth.response;
  const { user } = auth;
  try {
    await setupDatabase();

    const db = getDb();
    const [rows] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT * FROM diagram_types WHERE id = ? LIMIT 1", [params.id]
    );
    const current = rows[0];
    if (!current) return NextResponse.json({ error: "Diagram type not found." }, { status: 404 });

    // Block delete if diagrams use this type
    const [usageRows] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT COUNT(*) AS cnt FROM diagrams WHERE diagram_type_id = ?", [params.id]
    );
    if (Number(usageRows[0].cnt) > 0) {
      return NextResponse.json(
        { error: `Cannot delete — ${usageRows[0].cnt} diagram(s) use this type. Reassign them first.` },
        { status: 409 }
      );
    }

    await db.execute("DELETE FROM diagram_types WHERE id = ?", [params.id]);
    await writeAudit({
      tableName: "diagram_types", recordId: params.id, action: "DELETE",
      performedById: user.id, performedByName: user.name,
      oldValues: { name: current.name }, newValues: null,
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error({ err, route: "DELETE /api/diagram-types/:id" }, "request failed");
    return NextResponse.json({ error: "Failed to delete diagram type." }, { status: 500 });
  }
}
