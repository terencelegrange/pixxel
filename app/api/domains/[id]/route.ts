import { NextRequest, NextResponse } from "next/server";
import logger from "@/lib/logger";
import mysql from "mysql2/promise";
import { getDb, setupDatabase } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { requireUser } from "@/lib/require-user";

// PUT /api/domains/[id]
export async function PUT(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await requireUser(req, ["Admin", "Member"]);
  if (!auth.ok) return auth.response;
  const { user } = auth;
  try {
    await setupDatabase();
    const body = await req.json();
    const { name, description } = body;

    if (!name?.trim()) return NextResponse.json({ error: "Domain name is required." }, { status: 400 });

    const db = getDb();
    const [rows] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT * FROM domains WHERE id = ? LIMIT 1", [params.id]
    );
    const current = rows[0];
    if (!current) return NextResponse.json({ error: "Domain not found." }, { status: 404 });

    const values = {
      name: name.trim(),
      description: description?.trim() || null,
    };

    await db.execute(
      "UPDATE domains SET name=?, description=? WHERE id=?",
      [values.name, values.description, params.id]
    );

    await writeAudit({
      tableName: "domains", recordId: params.id, action: "UPDATE",
      performedById: user.id, performedByName: user.name,
      oldValues: { name: current.name, description: current.description },
      newValues: values,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error({ err, route: "PUT /api/domains/:id" }, "request failed");
    return NextResponse.json({ error: "Failed to update domain." }, { status: 500 });
  }
}

// DELETE /api/domains/[id]
export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await requireUser(req, ["Admin", "Member"]);
  if (!auth.ok) return auth.response;
  const { user } = auth;
  try {
    await setupDatabase();

    const db = getDb();
    const [rows] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT * FROM domains WHERE id = ? LIMIT 1", [params.id]
    );
    const current = rows[0];
    if (!current) return NextResponse.json({ error: "Domain not found." }, { status: 404 });

    // Unlink assets before deleting
    await db.execute("UPDATE assets SET domain_id = NULL WHERE domain_id = ?", [params.id]);
    await db.execute("DELETE FROM domains WHERE id = ?", [params.id]);

    await writeAudit({
      tableName: "domains", recordId: params.id, action: "DELETE",
      performedById: user.id, performedByName: user.name,
      oldValues: { name: current.name, description: current.description },
      newValues: null,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error({ err, route: "DELETE /api/domains/:id" }, "request failed");
    return NextResponse.json({ error: "Failed to delete domain." }, { status: 500 });
  }
}
