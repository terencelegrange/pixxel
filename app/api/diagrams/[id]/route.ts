import { NextRequest, NextResponse } from "next/server";
import mysql from "mysql2/promise";
import { getDb, setupDatabase } from "@/lib/db";
import { writeAudit } from "@/lib/audit";

const toISO = (v: unknown) =>
  v instanceof Date ? v.toISOString() : v ? String(v) : null;

// GET /api/diagrams/[id] — fetch diagram metadata + latest version content
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await setupDatabase();
    const db = getDb();

    const [[diagRows], [versionRows]] = await Promise.all([
      db.execute<mysql.RowDataPacket[]>(
        "SELECT * FROM diagrams WHERE id = ? LIMIT 1", [params.id]
      ),
      db.execute<mysql.RowDataPacket[]>(
        "SELECT * FROM diagram_versions WHERE diagram_id = ? ORDER BY version_number DESC LIMIT 1",
        [params.id]
      ),
    ]);

    const diag = diagRows[0];
    if (!diag) return NextResponse.json({ error: "Diagram not found." }, { status: 404 });

    const latestVersion = versionRows[0];

    return NextResponse.json({
      diagram: {
        id: diag.id, name: diag.name, description: diag.description ?? null,
        projectId: diag.project_id ?? null,
        diagramTypeId: diag.diagram_type_id ?? null,
        latestVersion: latestVersion ? Number(latestVersion.version_number) : 0,
        content: latestVersion?.content ?? JSON.stringify({ elements: [], appState: {}, files: {} }),
        createdById: diag.created_by_id, createdByName: diag.created_by_name,
        createdAt: toISO(diag.created_at)!, updatedAt: toISO(diag.updated_at)!,
      },
    });
  } catch (err) {
    console.error("[GET /api/diagrams/:id]", err);
    return NextResponse.json({ error: "Failed to load diagram." }, { status: 500 });
  }
}

// PUT /api/diagrams/[id] — update metadata only (name, description)
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await setupDatabase();
    const { name, description, projectId, diagramTypeId, userId, userName } = await req.json();
    if (!name?.trim()) return NextResponse.json({ error: "Name is required." }, { status: 400 });
    if (!userId || !userName) return NextResponse.json({ error: "Authenticated user is required." }, { status: 401 });

    const db = getDb();
    const [rows] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT * FROM diagrams WHERE id = ? LIMIT 1", [params.id]
    );
    const current = rows[0];
    if (!current) return NextResponse.json({ error: "Diagram not found." }, { status: 404 });

    await db.execute(
      "UPDATE diagrams SET name = ?, description = ?, project_id = ?, diagram_type_id = ? WHERE id = ?",
      [name.trim(), description?.trim() || null, projectId || null, diagramTypeId || null, params.id]
    );

    await writeAudit({
      tableName: "diagrams", recordId: params.id, action: "UPDATE",
      performedById: userId, performedByName: userName,
      oldValues: { name: current.name, description: current.description, projectId: current.project_id, diagramTypeId: current.diagram_type_id },
      newValues: { name: name.trim(), description: description?.trim() || null, projectId: projectId || null, diagramTypeId: diagramTypeId || null },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[PUT /api/diagrams/:id]", err);
    return NextResponse.json({ error: "Failed to update diagram." }, { status: 500 });
  }
}

// DELETE /api/diagrams/[id]
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
      "SELECT * FROM diagrams WHERE id = ? LIMIT 1", [params.id]
    );
    const current = rows[0];
    if (!current) return NextResponse.json({ error: "Diagram not found." }, { status: 404 });

    await db.execute("DELETE FROM diagram_assets WHERE diagram_id = ?", [params.id]);
    await db.execute("DELETE FROM diagram_versions WHERE diagram_id = ?", [params.id]);
    await db.execute("DELETE FROM diagrams WHERE id = ?", [params.id]);

    await writeAudit({
      tableName: "diagrams", recordId: params.id, action: "DELETE",
      performedById: userId, performedByName: userName,
      oldValues: { name: current.name, description: current.description }, newValues: null,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/diagrams/:id]", err);
    return NextResponse.json({ error: "Failed to delete diagram." }, { status: 500 });
  }
}
