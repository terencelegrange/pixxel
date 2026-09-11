import { NextRequest, NextResponse } from "next/server";
import logger from "@/lib/logger";
import { getDb, setupDatabase, withTransaction } from "@/lib/db";
import mysql from "mysql2/promise";
import { writeAudit } from "@/lib/audit";
import { requireUser } from "@/lib/require-user";

export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;
  try {
    await setupDatabase();
    const db = getDb();
    const [diagrams] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT * FROM plantuml_diagrams WHERE id = ?", [params.id]
    );
    if (!diagrams.length) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const [versions] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT * FROM plantuml_versions WHERE diagram_id = ? ORDER BY version_number DESC LIMIT 1", [params.id]
    );
    return NextResponse.json({ diagram: diagrams[0], latestVersion: versions[0] ?? null });
  } catch (err) {
    logger.error({ err, route: "GET /api/plantuml/:id" }, "request failed");
    return NextResponse.json({ error: "Failed to load diagram." }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await requireUser(req, ["Admin", "Member"]);
  if (!auth.ok) return auth.response;
  const { user } = auth;
  try {
    await setupDatabase();
    const db = getDb();
    const { name, description } = await req.json();

    const [rows] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT name, description FROM plantuml_diagrams WHERE id = ?", [params.id]
    );
    const current = rows[0];
    if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await db.execute("UPDATE plantuml_diagrams SET name = ?, description = ? WHERE id = ?", [name, description ?? null, params.id]);

    await writeAudit({
      tableName: "plantuml_diagrams", recordId: params.id, action: "UPDATE",
      performedById: user.id, performedByName: user.name,
      oldValues: { name: current.name, description: current.description },
      newValues: { name, description: description ?? null },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error({ err, route: "PUT /api/plantuml/:id" }, "request failed");
    return NextResponse.json({ error: "Failed to update diagram." }, { status: 500 });
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
      "SELECT name, description FROM plantuml_diagrams WHERE id = ?", [params.id]
    );
    const current = rows[0];
    if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await withTransaction(async (tx) => {
      await tx.execute("DELETE FROM plantuml_diagram_assets WHERE diagram_id = ?", [params.id]);
      await tx.execute("DELETE FROM plantuml_versions WHERE diagram_id = ?", [params.id]);
      await tx.execute("DELETE FROM plantuml_diagrams WHERE id = ?", [params.id]);
    });

    await writeAudit({
      tableName: "plantuml_diagrams", recordId: params.id, action: "DELETE",
      performedById: user.id, performedByName: user.name,
      oldValues: { name: current.name, description: current.description }, newValues: null,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error({ err, route: "DELETE /api/plantuml/:id" }, "request failed");
    return NextResponse.json({ error: "Failed to delete diagram." }, { status: 500 });
  }
}
